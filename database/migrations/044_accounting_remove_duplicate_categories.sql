-- 044_accounting_remove_duplicate_categories.sql
--
-- Rimuove fisicamente le categorie duplicate della revisione 043. Eventuali
-- riferimenti vengono prima trasferiti alla voce canonica, senza perdere
-- movimenti, crediti, ripartizioni o righe di preventivo.

BEGIN;

DO $$
DECLARE
  expected_rows integer := 8;
  found_rows integer;
  mismatch_rows integer;
BEGIN
  SELECT count(*) INTO found_rows
  FROM public.accounting_categories
  WHERE upper(code) IN (
    'I_BAR_MERCH_RICAVI_03', 'MERCHANDISING',
    'I_QUOTE_SPORT_05', 'I_CORSI_FORMAZIONE_01',
    'E_BAR_MERCH_COSTI_01', 'E_BAR_MERCH_COSTI_02',
    'E_BAR_MERCH_COSTI_06', 'E_BAR_MERCH_COSTI_05'
  );

  IF found_rows <> expected_rows THEN
    RAISE EXCEPTION
      '044: catalogo inatteso: attese % voci da unificare, trovate %',
      expected_rows, found_rows;
  END IF;

  WITH code_map(old_code, canonical_code) AS (
    VALUES
      ('I_BAR_MERCH_RICAVI_03', 'MERCHANDISING'),
      ('I_QUOTE_SPORT_05', 'I_CORSI_FORMAZIONE_01'),
      ('E_BAR_MERCH_COSTI_01', 'E_BAR_MERCH_COSTI_02'),
      ('E_BAR_MERCH_COSTI_06', 'E_BAR_MERCH_COSTI_05')
  )
  SELECT count(*) INTO mismatch_rows
  FROM code_map
  JOIN public.accounting_categories AS old_category
    ON upper(old_category.code) = code_map.old_code
  JOIN public.accounting_categories AS canonical_category
    ON upper(canonical_category.code) = code_map.canonical_code
  WHERE old_category.direction <> canonical_category.direction;

  IF mismatch_rows <> 0 THEN
    RAISE EXCEPTION '044: non e possibile unificare categorie con direzioni diverse';
  END IF;
END;
$$;

-- Gli aggiornamenti mantengono sempre lo stesso verso contabile. Le guardie
-- vengono sospese solo durante questo trasferimento amministrativo atomico.
ALTER TABLE public.accounting_categories DISABLE TRIGGER USER;
ALTER TABLE public.accounting_receivables DISABLE TRIGGER USER;
ALTER TABLE public.accounting_movements DISABLE TRIGGER USER;
ALTER TABLE public.accounting_movement_allocations DISABLE TRIGGER USER;
ALTER TABLE public.accounting_budget_lines DISABLE TRIGGER USER;

-- Se una categoria duplicata fosse parent di una voce personalizzata, anche
-- quel collegamento viene preservato sulla categoria canonica.
WITH category_map AS (
  SELECT old_category.id AS old_id, canonical_category.id AS canonical_id
  FROM (
    VALUES
      ('I_BAR_MERCH_RICAVI_03', 'MERCHANDISING'),
      ('I_QUOTE_SPORT_05', 'I_CORSI_FORMAZIONE_01'),
      ('E_BAR_MERCH_COSTI_01', 'E_BAR_MERCH_COSTI_02'),
      ('E_BAR_MERCH_COSTI_06', 'E_BAR_MERCH_COSTI_05')
  ) AS code_map(old_code, canonical_code)
  JOIN public.accounting_categories AS old_category
    ON upper(old_category.code) = code_map.old_code
  JOIN public.accounting_categories AS canonical_category
    ON upper(canonical_category.code) = code_map.canonical_code
)
UPDATE public.accounting_categories AS category
SET parent_id = category_map.canonical_id
FROM category_map
WHERE category.parent_id = category_map.old_id;

WITH category_map AS (
  SELECT old_category.id AS old_id, canonical_category.id AS canonical_id
  FROM (
    VALUES
      ('I_BAR_MERCH_RICAVI_03', 'MERCHANDISING'),
      ('I_QUOTE_SPORT_05', 'I_CORSI_FORMAZIONE_01'),
      ('E_BAR_MERCH_COSTI_01', 'E_BAR_MERCH_COSTI_02'),
      ('E_BAR_MERCH_COSTI_06', 'E_BAR_MERCH_COSTI_05')
  ) AS code_map(old_code, canonical_code)
  JOIN public.accounting_categories AS old_category
    ON upper(old_category.code) = code_map.old_code
  JOIN public.accounting_categories AS canonical_category
    ON upper(canonical_category.code) = code_map.canonical_code
)
UPDATE public.accounting_receivables AS receivable
SET accounting_category_id = category_map.canonical_id
FROM category_map
WHERE receivable.accounting_category_id = category_map.old_id;

WITH category_map AS (
  SELECT old_category.id AS old_id, canonical_category.id AS canonical_id
  FROM (
    VALUES
      ('I_BAR_MERCH_RICAVI_03', 'MERCHANDISING'),
      ('I_QUOTE_SPORT_05', 'I_CORSI_FORMAZIONE_01'),
      ('E_BAR_MERCH_COSTI_01', 'E_BAR_MERCH_COSTI_02'),
      ('E_BAR_MERCH_COSTI_06', 'E_BAR_MERCH_COSTI_05')
  ) AS code_map(old_code, canonical_code)
  JOIN public.accounting_categories AS old_category
    ON upper(old_category.code) = code_map.old_code
  JOIN public.accounting_categories AS canonical_category
    ON upper(canonical_category.code) = code_map.canonical_code
)
UPDATE public.accounting_movements AS movement
SET category_id = category_map.canonical_id
FROM category_map
WHERE movement.category_id = category_map.old_id;

WITH category_map AS (
  SELECT old_category.id AS old_id, canonical_category.id AS canonical_id
  FROM (
    VALUES
      ('I_BAR_MERCH_RICAVI_03', 'MERCHANDISING'),
      ('I_QUOTE_SPORT_05', 'I_CORSI_FORMAZIONE_01'),
      ('E_BAR_MERCH_COSTI_01', 'E_BAR_MERCH_COSTI_02'),
      ('E_BAR_MERCH_COSTI_06', 'E_BAR_MERCH_COSTI_05')
  ) AS code_map(old_code, canonical_code)
  JOIN public.accounting_categories AS old_category
    ON upper(old_category.code) = code_map.old_code
  JOIN public.accounting_categories AS canonical_category
    ON upper(canonical_category.code) = code_map.canonical_code
)
UPDATE public.accounting_movement_allocations AS allocation
SET accounting_category_id = category_map.canonical_id
FROM category_map
WHERE allocation.accounting_category_id = category_map.old_id;

WITH category_map AS (
  SELECT old_category.id AS old_id, canonical_category.id AS canonical_id
  FROM (
    VALUES
      ('I_BAR_MERCH_RICAVI_03', 'MERCHANDISING'),
      ('I_QUOTE_SPORT_05', 'I_CORSI_FORMAZIONE_01'),
      ('E_BAR_MERCH_COSTI_01', 'E_BAR_MERCH_COSTI_02'),
      ('E_BAR_MERCH_COSTI_06', 'E_BAR_MERCH_COSTI_05')
  ) AS code_map(old_code, canonical_code)
  JOIN public.accounting_categories AS old_category
    ON upper(old_category.code) = code_map.old_code
  JOIN public.accounting_categories AS canonical_category
    ON upper(canonical_category.code) = code_map.canonical_code
)
UPDATE public.accounting_budget_lines AS budget_line
SET category_id = category_map.canonical_id
FROM category_map
WHERE budget_line.category_id = category_map.old_id;

DELETE FROM public.accounting_categories
WHERE upper(code) IN (
  'I_BAR_MERCH_RICAVI_03',
  'I_QUOTE_SPORT_05',
  'E_BAR_MERCH_COSTI_01',
  'E_BAR_MERCH_COSTI_06'
);

ALTER TABLE public.accounting_budget_lines ENABLE TRIGGER USER;
ALTER TABLE public.accounting_movement_allocations ENABLE TRIGGER USER;
ALTER TABLE public.accounting_movements ENABLE TRIGGER USER;
ALTER TABLE public.accounting_receivables ENABLE TRIGGER USER;
ALTER TABLE public.accounting_categories ENABLE TRIGGER USER;

NOTIFY pgrst, 'reload schema';

COMMIT;
