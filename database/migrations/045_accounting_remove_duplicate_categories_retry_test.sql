-- 045_accounting_remove_duplicate_categories_retry_test.sql
-- Controllo non distruttivo della cancellazione e dell'assenza di doppioni
-- esatti tra le categorie attive e selezionabili nello stesso verso contabile.

WITH removed_names(name) AS (
  VALUES
    ('Vendita abbigliamento (storico: usare Vendita merchandising)'),
    ('Quota corsi (storico: usare Corsi e attivita formative)'),
    ('Acquisto prodotti per il bar (storico: usare Alimenti e bevande)'),
    ('Acquisto abbigliamento da rivendere (storico: usare Merchandising)')
), canonical_names(expected_name) AS (
  VALUES
    ('Vendita merchandising (abbigliamento e accessori)'),
    ('Corrispettivi corsi sportivi'),
    ('Acquisto alimenti e bevande per bar e ristoro'),
    ('Acquisto merchandising da rivendere (abbigliamento e accessori)')
), active_exact_duplicates AS (
  SELECT direction, lower(btrim(name)) AS normalized_name, count(*) AS duplicate_count
  FROM public.accounting_categories
  WHERE archived_at IS NULL
    AND is_active
    AND available_in_movements
  GROUP BY direction, lower(btrim(name))
  HAVING count(*) > 1
)
SELECT
  'T1_accounting_duplicate_categories_removed_retry' AS check_id,
  NOT EXISTS (
    SELECT 1
    FROM public.accounting_categories AS category
    JOIN removed_names ON category.name = removed_names.name
  ) AS duplicate_rows_deleted,
  (
    SELECT count(*) = 4
    FROM public.accounting_categories AS category
    JOIN canonical_names ON category.name = canonical_names.expected_name
  ) AS canonical_rows_present,
  NOT EXISTS (SELECT 1 FROM active_exact_duplicates) AS no_active_exact_duplicates,
  NOT EXISTS (
    SELECT 1
    FROM public.accounting_categories
    WHERE lower(name) LIKE '%(storico:%'
  ) AS no_duplicate_history_labels_remaining,
  (
    NOT EXISTS (
      SELECT 1
      FROM public.accounting_categories AS category
      JOIN removed_names ON category.name = removed_names.name
    )
    AND (
      SELECT count(*) = 4
      FROM public.accounting_categories AS category
      JOIN canonical_names ON category.name = canonical_names.expected_name
    )
    AND NOT EXISTS (SELECT 1 FROM active_exact_duplicates)
    AND NOT EXISTS (
      SELECT 1
      FROM public.accounting_categories
      WHERE lower(name) LIKE '%(storico:%'
    )
  ) AS all_checks_passed;
