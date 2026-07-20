-- =============================================================================
-- reload_postgrest_schema.sql
-- =============================================================================
-- Dopo migration 018 (o altre DDL): PostgREST può rispondere 400/404 finché
-- la schema cache non è aggiornata.
--
-- READ-SAFE: nessuna modifica a tabelle/dati applicativi.
-- Esegui in Supabase → SQL Editor (ruolo postgres / dashboard).
-- =============================================================================

-- Ricarica schema API (tabelle, colonne, FK, viste esposte)
NOTIFY pgrst, 'reload schema';

-- Opzionale: ricarica anche la config PostgREST
NOTIFY pgrst, 'reload config';

-- Verifica immediata (sola lettura): le 3 tabelle 018 devono risultare presenti
SELECT jsonb_build_object(
  'meta', jsonb_build_object(
    'read_only', true,
    'modifies_data', false,
    'action', 'pgrst_reload_notified'
  ),
  'tables', jsonb_build_object(
    'accounting_commercial_documents',
      to_regclass('public.accounting_commercial_documents') IS NOT NULL,
    'accounting_commercial_document_payments',
      to_regclass('public.accounting_commercial_document_payments') IS NOT NULL,
    'accounting_vat_periods',
      to_regclass('public.accounting_vat_periods') IS NOT NULL
  )
) AS reload_check;
