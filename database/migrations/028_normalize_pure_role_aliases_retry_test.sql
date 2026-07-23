-- Usa questa verifica dopo la 028.
WITH canonical_roles(name) AS (
  VALUES ('Giocatore'::text), ('Preparatore Atletico'::text), ('Fisioterapista'::text)
), legacy_roles(name) AS (
  VALUES ('Player'::text), ('Preparatore'::text), ('Fisio'::text)
)
SELECT
  'T1_pure_role_aliases_normalized' AS check_id,
  NOT EXISTS (
    SELECT 1
    FROM canonical_roles expected
    LEFT JOIN public.user_roles ur ON ur.name = expected.name
    WHERE ur.id IS NULL
  ) AS ruoli_canonici_presenti,
  NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN legacy_roles legacy ON legacy.name = ur.name
  ) AS alias_rimossi,
  NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE lower(trim(coalesce(pr.role, ''))) IN ('player', 'preparatore', 'fisio')
  ) AS profili_allineati;
