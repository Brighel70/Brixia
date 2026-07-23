-- =============================================================================
-- Matrice ruoli e permessi (sola lettura)
-- =============================================================================
-- Esegui dopo 024. Restituisce un solo risultato, facile da copiare da
-- Supabase SQL Editor. Non modifica dati o autorizzazioni.

WITH role_rows AS (
  SELECT
    ur.name AS ruolo,
    COALESCE(count(rp.permission_id), 0) AS numero_permessi,
    COALESCE(
      jsonb_agg(p.name ORDER BY p.category, p.position_order, p.name)
        FILTER (WHERE p.id IS NOT NULL),
      '[]'::jsonb
    ) AS permessi
  FROM public.user_roles ur
  LEFT JOIN public.role_permissions rp ON rp.role_id = ur.id
  LEFT JOIN public.permissions p ON p.id = rp.permission_id
  GROUP BY ur.id, ur.name
), user_overrides AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'email', pr.email,
        'ruolo_effettivo', COALESCE(ur.name, pr.role, 'Senza ruolo'),
        'permesso', p.name,
        'concesso', up.is_granted
      )
      ORDER BY pr.email, p.name
    ),
    '[]'::jsonb
  ) AS eccezioni
  FROM public.user_permissions up
  JOIN public.profiles pr ON pr.id = up.user_id
  JOIN public.permissions p ON p.id = up.permission_id
  LEFT JOIN public.user_roles ur ON ur.id = pr.user_role_id
)
SELECT jsonb_build_object(
  'ruoli', COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'ruolo', ruolo,
        'numero_permessi', numero_permessi,
        'permessi', permessi
      ) ORDER BY ruolo
    ) FROM role_rows),
    '[]'::jsonb
  ),
  'eccezioni_personali', (SELECT eccezioni FROM user_overrides)
) AS matrice_ruoli;
