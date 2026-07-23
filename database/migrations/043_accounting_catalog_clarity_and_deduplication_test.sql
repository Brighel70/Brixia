-- 043_accounting_catalog_clarity_and_deduplication_test.sql
-- Controllo non distruttivo: verifica che le ambiguita principali abbiano
-- una sola voce operativa e che lo storico non sia stato eliminato.

WITH checks AS (
  SELECT
    EXISTS (
      SELECT 1 FROM public.accounting_categories
      WHERE upper(code) = 'MERCHANDISING'
        AND name = 'Vendita merchandising (abbigliamento e accessori)'
    ) AS merchandising_canonical,
    EXISTS (
      SELECT 1 FROM public.accounting_categories
      WHERE name = 'Vendita abbigliamento (storico: usare Vendita merchandising)'
        AND NOT is_active
        AND NOT available_in_movements
        AND NOT available_in_budget
        AND available_in_reports
    ) AS clothing_legacy_disabled,
    EXISTS (
      SELECT 1 FROM public.accounting_categories
      WHERE name = 'Quota corsi (storico: usare Corsi e attivita formative)'
        AND NOT is_active
        AND NOT available_in_movements
        AND NOT available_in_budget
        AND available_in_reports
    ) AS course_quote_legacy_disabled,
    EXISTS (
      SELECT 1 FROM public.accounting_categories
      WHERE name = 'Corrispettivi corsi sportivi'
        AND group_id = public.accounting_category_group_id_by_code('income', 'CORSI_FORMAZIONE')
    ) AS courses_canonical,
    EXISTS (
      SELECT 1 FROM public.accounting_categories
      WHERE name = 'Acquisto alimenti e bevande per bar e ristoro'
        AND group_id = public.accounting_category_group_id_by_code('expense', 'BAR_MERCH_COSTI')
    ) AS bar_food_canonical,
    EXISTS (
      SELECT 1 FROM public.accounting_categories
      WHERE name = 'Acquisto prodotti per il bar (storico: usare Alimenti e bevande)'
        AND NOT is_active
        AND NOT available_in_movements
        AND NOT available_in_budget
        AND available_in_reports
    ) AS bar_food_legacy_disabled,
    EXISTS (
      SELECT 1 FROM public.accounting_categories
      WHERE name = 'Acquisto merchandising da rivendere (abbigliamento e accessori)'
        AND group_id = public.accounting_category_group_id_by_code('expense', 'BAR_MERCH_COSTI')
    ) AS merchandising_cost_canonical,
    EXISTS (
      SELECT 1 FROM public.accounting_categories
      WHERE name = 'Acquisto abbigliamento da rivendere (storico: usare Merchandising)'
        AND NOT is_active
        AND NOT available_in_movements
        AND NOT available_in_budget
        AND available_in_reports
    ) AS clothing_cost_legacy_disabled,
    EXISTS (
      SELECT 1 FROM public.accounting_category_groups
      WHERE direction = 'income' AND code = 'QUOTE_SPORT'
        AND name = 'Quote associative e sportive'
    ) AS quote_group_clear,
    EXISTS (
      SELECT 1 FROM public.accounting_category_groups
      WHERE direction = 'income' AND code = 'BAR_MERCH_RICAVI'
        AND name = 'Bar, ristoro e vendita prodotti'
    ) AS sales_group_clear,
    EXISTS (
      SELECT 1 FROM public.accounting_category_groups
      WHERE direction = 'expense' AND code = 'ALLOGGI'
        AND name = 'Alloggi continuativi e foresteria'
    ) AS accommodation_group_clear
)
SELECT
  'T1_accounting_catalog_clarity_and_deduplication' AS check_id,
  to_jsonb(checks) - 'all_checks_passed' AS checks,
  (merchandising_canonical
    AND clothing_legacy_disabled
    AND course_quote_legacy_disabled
    AND courses_canonical
    AND bar_food_canonical
    AND bar_food_legacy_disabled
    AND merchandising_cost_canonical
    AND clothing_cost_legacy_disabled
    AND quote_group_clear
    AND sales_group_clear
    AND accommodation_group_clear) AS all_checks_passed
FROM checks;
