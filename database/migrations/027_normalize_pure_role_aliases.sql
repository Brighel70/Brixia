-- =============================================================================
-- 027_normalize_pure_role_aliases.sql
-- =============================================================================
-- Elimina gli alias puri dal catalogo ruoli:
--   Player -> Giocatore
--   Preparatore -> Preparatore Atletico
--   Fisio -> Fisioterapista
-- Tutor e Familiare restano distinti per ora: hanno logiche familiari proprie.
-- Aggiorna profili e campi ruolo presenti in people; non elimina persone o dati.
-- =============================================================================

BEGIN;

-- Il ruolo canonico Fisioterapista puo non esistere nei database piu vecchi.
INSERT INTO public.user_roles (name, position_order)
SELECT
  'Fisioterapista',
  COALESCE((SELECT position_order FROM public.user_roles WHERE name = 'Fisio' LIMIT 1), 0)
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE name = 'Fisioterapista'
);

CREATE TEMP TABLE role_alias_map (
  legacy_role_id uuid PRIMARY KEY,
  canonical_role_id uuid NOT NULL,
  legacy_name text NOT NULL,
  canonical_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO role_alias_map (legacy_role_id, canonical_role_id, legacy_name, canonical_name)
SELECT legacy_role.id, canonical_role.id, aliases.legacy_name, aliases.canonical_name
FROM (
  VALUES
    ('Player'::text, 'Giocatore'::text),
    ('Preparatore'::text, 'Preparatore Atletico'::text),
    ('Fisio'::text, 'Fisioterapista'::text)
) AS aliases(legacy_name, canonical_name)
JOIN public.user_roles legacy_role ON legacy_role.name = aliases.legacy_name
JOIN public.user_roles canonical_role ON canonical_role.name = aliases.canonical_name;

-- Profili Auth: il ruolo effettivo e il relativo id diventano canonici.
UPDATE public.profiles pr
SET
  user_role_id = m.canonical_role_id,
  role = m.canonical_name
FROM role_alias_map m
WHERE pr.user_role_id = m.legacy_role_id
   OR lower(trim(coalesce(pr.role, ''))) = lower(m.legacy_name);

-- Ruolo principale delle due porte di accesso.
UPDATE public.people p
SET app_role = m.canonical_role_id::text
FROM role_alias_map m
WHERE p.app_role = m.legacy_role_id::text
   OR lower(trim(coalesce(p.app_role, ''))) = lower(m.legacy_name);

UPDATE public.people p
SET teamflow_app_role = m.canonical_role_id::text
FROM role_alias_map m
WHERE p.teamflow_app_role = m.legacy_role_id::text
   OR lower(trim(coalesce(p.teamflow_app_role, ''))) = lower(m.legacy_name);

-- Ruoli aggiuntivi FlowMe (text[]) e TeamFlow/staff (jsonb arrays).
UPDATE public.people p
SET additional_roles = ARRAY(
  SELECT COALESCE(m.canonical_role_id::text, item.value)
  FROM unnest(p.additional_roles) WITH ORDINALITY AS item(value, position)
  LEFT JOIN role_alias_map m
    ON item.value = m.legacy_role_id::text
    OR lower(trim(item.value)) = lower(m.legacy_name)
  ORDER BY item.position
)
WHERE p.additional_roles IS NOT NULL;

UPDATE public.people p
SET staff_roles = COALESCE((
  SELECT jsonb_agg(to_jsonb(COALESCE(m.canonical_role_id::text, item.value)) ORDER BY item.position)
  FROM jsonb_array_elements_text(p.staff_roles) WITH ORDINALITY AS item(value, position)
  LEFT JOIN role_alias_map m
    ON item.value = m.legacy_role_id::text
    OR lower(trim(item.value)) = lower(m.legacy_name)
), '[]'::jsonb)
WHERE jsonb_typeof(p.staff_roles) = 'array';

UPDATE public.people p
SET teamflow_additional_roles = COALESCE((
  SELECT jsonb_agg(to_jsonb(COALESCE(m.canonical_role_id::text, item.value)) ORDER BY item.position)
  FROM jsonb_array_elements_text(p.teamflow_additional_roles) WITH ORDINALITY AS item(value, position)
  LEFT JOIN role_alias_map m
    ON item.value = m.legacy_role_id::text
    OR lower(trim(item.value)) = lower(m.legacy_name)
), '[]'::jsonb)
WHERE jsonb_typeof(p.teamflow_additional_roles) = 'array';

-- Mantiene tutti i permessi dell'alias sul ruolo canonico, poi rimuove l'alias.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT m.canonical_role_id, rp.permission_id
FROM public.role_permissions rp
JOIN role_alias_map m ON m.legacy_role_id = rp.role_id
ON CONFLICT DO NOTHING;

DELETE FROM public.role_permissions rp
USING role_alias_map m
WHERE rp.role_id = m.legacy_role_id;

DELETE FROM public.user_roles ur
USING role_alias_map m
WHERE ur.id = m.legacy_role_id;

NOTIFY pgrst, 'reload schema';
COMMIT;
