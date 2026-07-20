-- =============================================================================
-- 015_accounting_movement_document_fields.sql
-- =============================================================================
-- STEP 3C (correzione) — Separare documento giustificativo da riferimento pagamento.
--
-- Aggiunge su accounting_movements:
--   - document_type   (invoice | receipt | fiscal_receipt | other)
--   - document_number (obbligatorio solo se document_type = 'invoice')
--
-- document_date esiste già dalla 012 (nullable): qui solo COMMENT di chiarimento.
--
-- reference resta il campo distinto “Riferimento pagamento”
-- (CRO/TRN, riferimento POS, numero assegno, ecc.). NON usarlo per tipo/numero
-- documento. Eventuali valori legacy FATTURA:/RICEVUTA:/… restano in reference
-- solo per compatibilità UI temporanea: NESSUN backfill automatico (DB vuoto /
-- pochi dati). I nuovi salvataggi usano le colonne dedicate.
--
-- NON modifica: Quote, FlowMe, movimenti fee_sync, migration 010–014.
-- NON APPLICARE senza revisione e approvazione.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Colonne documento
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_movements
  ADD COLUMN IF NOT EXISTS document_type text NULL;

ALTER TABLE public.accounting_movements
  ADD COLUMN IF NOT EXISTS document_number text NULL;

COMMENT ON COLUMN public.accounting_movements.document_type IS
  'Tipo documento giustificativo: invoice | receipt | fiscal_receipt | other. '
  'NULL = nessun documento. Distinto da reference (riferimento pagamento).';

COMMENT ON COLUMN public.accounting_movements.document_number IS
  'Numero/protocollo del documento. Obbligatorio se document_type = invoice.';

COMMENT ON COLUMN public.accounting_movements.document_date IS
  'Data del documento giustificativo (già presente dalla 012). '
  'Distinta da movement_date e settlement_date. Opzionale.';

COMMENT ON COLUMN public.accounting_movements.reference IS
  'Riferimento pagamento (CRO/TRN, rif. POS, numero assegno, ecc.). '
  'Non usare per tipo/numero documento: usare document_type / document_number.';

-- -----------------------------------------------------------------------------
-- 2) Vincoli
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounting_movements_document_type_check'
      AND conrelid = 'public.accounting_movements'::regclass
  ) THEN
    ALTER TABLE public.accounting_movements
      ADD CONSTRAINT accounting_movements_document_type_check
      CHECK (
        document_type IS NULL
        OR document_type IN ('invoice', 'receipt', 'fiscal_receipt', 'other')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounting_movements_invoice_needs_number'
      AND conrelid = 'public.accounting_movements'::regclass
  ) THEN
    ALTER TABLE public.accounting_movements
      ADD CONSTRAINT accounting_movements_invoice_needs_number
      CHECK (
        document_type IS DISTINCT FROM 'invoice'
        OR (document_number IS NOT NULL AND btrim(document_number) <> '')
      );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) Indici
-- -----------------------------------------------------------------------------
-- Nessun indice dedicato: non ci sono filtri UI/report su document_type o
-- document_number. Aggiungere in seguito solo se emergono query frequenti.

COMMIT;
