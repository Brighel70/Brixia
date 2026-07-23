-- 044_accounting_remove_duplicate_categories_test.sql
-- Controllo non distruttivo della cancellazione e dell'assenza di doppioni
-- esatti tra le categorie attive e selezionabili nello stesso verso contabile.

WITH removed_codes(code) AS (
  VALUES
    ('I_BAR_MERCH_RICAVI_03'),
    ('I_QUOTE_SPORT_05'),
    ('E_BAR_MERCH_COSTI_01'),
    ('E_BAR_MERCH_COSTI_06')
), canonical_codes(code, expected_name) AS (
  VALUES
    ('MERCHANDISING', 'Vendita merchandising (abbigliamento e accessori)'),
    ('I_CORSI_FORMAZIONE_01', 'Corrispettivi corsi sportivi'),
    ('E_BAR_MERCH_COSTI_02', 'Acquisto alimenti e bevande per bar e ristoro'),
    ('E_BAR_MERCH_COSTI_05', 'Acquisto merchandising da rivendere (abbigliamento e accessori)')
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
  'T1_accounting_duplicate_categories_removed' AS check_id,
  NOT EXISTS (
    SELECT 1
    FROM public.accounting_categories AS category
    JOIN removed_codes ON upper(category.code) = removed_codes.code
  ) AS duplicate_rows_deleted,
  (
    SELECT count(*) = 4
    FROM public.accounting_categories AS category
    JOIN canonical_codes
      ON upper(category.code) = canonical_codes.code
     AND category.name = canonical_codes.expected_name
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
      JOIN removed_codes ON upper(category.code) = removed_codes.code
    )
    AND (
      SELECT count(*) = 4
      FROM public.accounting_categories AS category
      JOIN canonical_codes
        ON upper(category.code) = canonical_codes.code
       AND category.name = canonical_codes.expected_name
    )
    AND NOT EXISTS (SELECT 1 FROM active_exact_duplicates)
    AND NOT EXISTS (
      SELECT 1
      FROM public.accounting_categories
      WHERE lower(name) LIKE '%(storico:%'
    )
  ) AS all_checks_passed;
