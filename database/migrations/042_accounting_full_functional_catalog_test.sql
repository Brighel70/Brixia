-- 042_accounting_full_functional_catalog_test.sql
-- Controllo non distruttivo del catalogo funzionale definitivo.

WITH expected_groups(direction, code) AS (
  VALUES
    ('income','QUOTE_SPORT'), ('income','SPONSOR_PUB'), ('income','CONTRIBUTI_LIBERALITA'),
    ('income','GARE_EVENTI'), ('income','CORSI_FORMAZIONE'), ('income','IMPIANTI_RICAVI'),
    ('income','BAR_MERCH_RICAVI'), ('income','SERVIZI_COMMERCIALI'), ('income','RIMBORSI_INDENNIZZI'),
    ('income','CESSIONI_BENI'), ('income','PROVENTI_STRAORDINARI'),
    ('expense','PERSONALE_COLLABORATORI'), ('expense','AFFILIAZIONI_FEDERALI'),
    ('expense','ASSICURAZIONI'), ('expense','AREA_MEDICA'), ('expense','MATERIALE_SPORTIVO'),
    ('expense','IMPIANTI_UTENZE'), ('expense','ALLOGGI'), ('expense','MEZZI_SOCIETARI'),
    ('expense','TRASFERTE_TRASPORTI'), ('expense','GARE_EVENTI_COSTI'),
    ('expense','SEGRETERIA_INFORMATICA'), ('expense','CONSULENZE_ADEMPIMENTI'),
    ('expense','COMUNICAZIONE_MARKETING'), ('expense','BAR_MERCH_COSTI'),
    ('expense','SPESE_BANCARIE_FISCALI'), ('expense','INVESTIMENTI_STRAORDINARI'),
    ('expense','SPESE_STRAORDINARIE')
), group_audit AS (
  SELECT
    e.direction,
    count(*) AS expected_count,
    count(g.id) AS found_count,
    array_agg(e.code ORDER BY e.code) FILTER (WHERE g.id IS NULL) AS missing_codes
  FROM expected_groups AS e
  LEFT JOIN public.accounting_category_groups AS g
    ON g.direction = e.direction AND g.code = e.code
  GROUP BY e.direction
), category_audit AS (
  SELECT
    g.direction,
    count(c.id) FILTER (WHERE c.archived_at IS NULL) AS categories_found
  FROM public.accounting_category_groups AS g
  LEFT JOIN public.accounting_categories AS c ON c.group_id = g.id
  WHERE (g.direction = 'income' AND g.code IN (SELECT code FROM expected_groups WHERE direction = 'income'))
     OR (g.direction = 'expense' AND g.code IN (SELECT code FROM expected_groups WHERE direction = 'expense'))
  GROUP BY g.direction
), technical_audit AS (
  SELECT
    bool_and(c.group_id = quote_group.id) FILTER (WHERE upper(c.code) = 'QUOTE') AS quote_in_correct_group,
    bool_and(NOT c.available_in_movements AND NOT c.available_in_budget AND c.available_in_reports)
      FILTER (WHERE upper(c.code) = 'QUOTE') AS quote_manual_use_protected,
    bool_and(c.group_id = sponsor_group.id) FILTER (WHERE upper(c.code) = 'SPONSOR') AS sponsor_in_correct_group
  FROM public.accounting_categories AS c
  CROSS JOIN LATERAL (
    SELECT id FROM public.accounting_category_groups
    WHERE direction = 'income' AND code = 'QUOTE_SPORT'
  ) AS quote_group
  CROSS JOIN LATERAL (
    SELECT id FROM public.accounting_category_groups
    WHERE direction = 'income' AND code = 'SPONSOR_PUB'
  ) AS sponsor_group
  WHERE upper(c.code) IN ('QUOTE', 'SPONSOR')
)
SELECT
  'T1_full_functional_accounting_catalog' AS check_id,
  jsonb_object_agg(group_audit.direction, jsonb_build_object(
    'expected_macro_categories', group_audit.expected_count,
    'found_macro_categories', group_audit.found_count,
    'missing_codes', COALESCE(to_jsonb(group_audit.missing_codes), '[]'::jsonb),
    'categories_found', COALESCE(category_audit.categories_found, 0)
  )) AS catalog,
  (SELECT quote_in_correct_group FROM technical_audit) AS quote_in_correct_group,
  (SELECT quote_manual_use_protected FROM technical_audit) AS quote_manual_use_protected,
  (SELECT sponsor_in_correct_group FROM technical_audit) AS sponsor_in_correct_group,
  (SELECT found_count = expected_count FROM group_audit WHERE direction = 'income')
    AND (SELECT found_count = expected_count FROM group_audit WHERE direction = 'expense')
    AND COALESCE((SELECT categories_found >= 72 FROM category_audit WHERE direction = 'income'), false)
    AND COALESCE((SELECT categories_found >= 166 FROM category_audit WHERE direction = 'expense'), false)
    AND COALESCE((SELECT quote_in_correct_group FROM technical_audit), false)
    AND COALESCE((SELECT quote_manual_use_protected FROM technical_audit), false)
    AND COALESCE((SELECT sponsor_in_correct_group FROM technical_audit), false) AS all_checks_passed
FROM group_audit
LEFT JOIN category_audit ON category_audit.direction = group_audit.direction
GROUP BY 1;
