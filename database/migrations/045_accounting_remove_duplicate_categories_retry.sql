-- 045_accounting_remove_duplicate_categories_retry.sql
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
  WHERE name IN (
    'Vendita abbigliamento (storico: usare Vendita merchandising)',
    'Vendita merchandising (abbigliamento e accessori)',
    'Quota corsi (storico: usare Corsi e attivita formative)',
    'Corrispettivi corsi sportivi',
    'Acquisto prodotti per il bar (storico: usare Alimenti e bevande)',
    'Acquisto alimenti e bevande per bar e ristoro',
    'Acquisto abbigliamento da rivendere (storico: usare Merchandising)',
    'Acquisto merchandising da rivendere (abbigliamento e accessori)'
  );

  IF found_rows <> expected_rows THEN
    RAISE EXCEPTION
      '045: catalogo inatteso: attese % voci da unificare, trovate %',
      expected_rows, found_rows;
  END IF;

  WITH name_map(old_name, canonical_name) AS (
    VALUES
      ('Vendita abbigliamento (storico: usare Vendita merchandising)', 'Vendita merchandising (abbigliamento e accessori)'),
      ('Quota corsi (storico: usare Corsi e attivita formative)', 'Corrispettivi corsi sportivi'),
      ('Acquisto prodotti per il bar (storico: usare Alimenti e bevande)', 'Acquisto alimenti e bevande per bar e ristoro'),
      ('Acquisto abbigliamento da rivendere (storico: usare Merchandising)', 'Acquisto merchandising da rivendere (abbigliamento e accessori)')
  )
  SELECT count(*) INTO mismatch_rows
  FROM name_map
  JOIN public.accounting_categories AS old_category
    ON old_category.name = name_map.old_name
  JOIN public.accounting_categories AS canonical_category
    ON canonical_category.name = name_map.canonical_name
  WHERE old_category.direction <> canonical_category.direction;

  IF mismatch_rows <> 0 THEN
    RAISE EXCEPTION '045: non e possibile unificare categorie con direzioni diverse';
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
      ('Vendita abbigliamento (storico: usare Vendita merchandising)', 'Vendita merchandising (abbigliamento e accessori)'),
      ('Quota corsi (storico: usare Corsi e attivita formative)', 'Corrispettivi corsi sportivi'),
      ('Acquisto prodotti per il bar (storico: usare Alimenti e bevande)', 'Acquisto alimenti e bevande per bar e ristoro'),
      ('Acquisto abbigliamento da rivendere (storico: usare Merchandising)', 'Acquisto merchandising da rivendere (abbigliamento e accessori)')
  ) AS name_map(old_name, canonical_name)
  JOIN public.accounting_categories AS old_category
    ON old_category.name = name_map.old_name
  JOIN public.accounting_categories AS canonical_category
    ON canonical_category.name = name_map.canonical_name
)
UPDATE public.accounting_categories AS category
SET parent_id = category_map.canonical_id
FROM category_map
WHERE category.parent_id = category_map.old_id;

WITH category_map AS (
  SELECT old_category.id AS old_id, canonical_category.id AS canonical_id
  FROM (
    VALUES
      ('Vendita abbigliamento (storico: usare Vendita merchandising)', 'Vendita merchandising (abbigliamento e accessori)'),
      ('Quota corsi (storico: usare Corsi e attivita formative)', 'Corrispettivi corsi sportivi'),
      ('Acquisto prodotti per il bar (storico: usare Alimenti e bevande)', 'Acquisto alimenti e bevande per bar e ristoro'),
      ('Acquisto abbigliamento da rivendere (storico: usare Merchandising)', 'Acquisto merchandising da rivendere (abbigliamento e accessori)')
  ) AS name_map(old_name, canonical_name)
  JOIN public.accounting_categories AS old_category
    ON old_category.name = name_map.old_name
  JOIN public.accounting_categories AS canonical_category
    ON canonical_category.name = name_map.canonical_name
)
UPDATE public.accounting_receivables AS receivable
SET accounting_category_id = category_map.canonical_id
FROM category_map
WHERE receivable.accounting_category_id = category_map.old_id;

WITH category_map AS (
  SELECT old_category.id AS old_id, canonical_category.id AS canonical_id
  FROM (
    VALUES
      ('Vendita abbigliamento (storico: usare Vendita merchandising)', 'Vendita merchandising (abbigliamento e accessori)'),
      ('Quota corsi (storico: usare Corsi e attivita formative)', 'Corrispettivi corsi sportivi'),
      ('Acquisto prodotti per il bar (storico: usare Alimenti e bevande)', 'Acquisto alimenti e bevande per bar e ristoro'),
      ('Acquisto abbigliamento da rivendere (storico: usare Merchandising)', 'Acquisto merchandising da rivendere (abbigliamento e accessori)')
  ) AS name_map(old_name, canonical_name)
  JOIN public.accounting_categories AS old_category
    ON old_category.name = name_map.old_name
  JOIN public.accounting_categories AS canonical_category
    ON canonical_category.name = name_map.canonical_name
)
UPDATE public.accounting_movements AS movement
SET category_id = category_map.canonical_id
FROM category_map
WHERE movement.category_id = category_map.old_id;

WITH category_map AS (
  SELECT old_category.id AS old_id, canonical_category.id AS canonical_id
  FROM (
    VALUES
      ('Vendita abbigliamento (storico: usare Vendita merchandising)', 'Vendita merchandising (abbigliamento e accessori)'),
      ('Quota corsi (storico: usare Corsi e attivita formative)', 'Corrispettivi corsi sportivi'),
      ('Acquisto prodotti per il bar (storico: usare Alimenti e bevande)', 'Acquisto alimenti e bevande per bar e ristoro'),
      ('Acquisto abbigliamento da rivendere (storico: usare Merchandising)', 'Acquisto merchandising da rivendere (abbigliamento e accessori)')
  ) AS name_map(old_name, canonical_name)
  JOIN public.accounting_categories AS old_category
    ON old_category.name = name_map.old_name
  JOIN public.accounting_categories AS canonical_category
    ON canonical_category.name = name_map.canonical_name
)
UPDATE public.accounting_movement_allocations AS allocation
SET accounting_category_id = category_map.canonical_id
FROM category_map
WHERE allocation.accounting_category_id = category_map.old_id;

WITH category_map AS (
  SELECT old_category.id AS old_id, canonical_category.id AS canonical_id
  FROM (
    VALUES
      ('Vendita abbigliamento (storico: usare Vendita merchandising)', 'Vendita merchandising (abbigliamento e accessori)'),
      ('Quota corsi (storico: usare Corsi e attivita formative)', 'Corrispettivi corsi sportivi'),
      ('Acquisto prodotti per il bar (storico: usare Alimenti e bevande)', 'Acquisto alimenti e bevande per bar e ristoro'),
      ('Acquisto abbigliamento da rivendere (storico: usare Merchandising)', 'Acquisto merchandising da rivendere (abbigliamento e accessori)')
  ) AS name_map(old_name, canonical_name)
  JOIN public.accounting_categories AS old_category
    ON old_category.name = name_map.old_name
  JOIN public.accounting_categories AS canonical_category
    ON canonical_category.name = name_map.canonical_name
)
UPDATE public.accounting_budget_lines AS budget_line
SET category_id = category_map.canonical_id
FROM category_map
WHERE budget_line.category_id = category_map.old_id;

DELETE FROM public.accounting_categories
WHERE name IN (
  'Vendita abbigliamento (storico: usare Vendita merchandising)',
  'Quota corsi (storico: usare Corsi e attivita formative)',
  'Acquisto prodotti per il bar (storico: usare Alimenti e bevande)',
  'Acquisto abbigliamento da rivendere (storico: usare Merchandising)'
);

ALTER TABLE public.accounting_budget_lines ENABLE TRIGGER USER;
ALTER TABLE public.accounting_movement_allocations ENABLE TRIGGER USER;
ALTER TABLE public.accounting_movements ENABLE TRIGGER USER;
ALTER TABLE public.accounting_receivables ENABLE TRIGGER USER;
ALTER TABLE public.accounting_categories ENABLE TRIGGER USER;

NOTIFY pgrst, 'reload schema';

COMMIT;
