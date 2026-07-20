# Contabilità — Step 2E (sync Quote → Contabilità)

## Stato

- Migration repository: `database/migrations/013_accounting_fee_sync.sql`
- Test statici: `database/migrations/013_accounting_fee_sync_test.sql`
- **Non applicata** su Supabase finché non approvata
- Step 2E: implementato nel repository, in revisione
- Step 3 UI: non ancora avviato

## Comportamento

Fail-safe: i trigger su `fee_assignments` / `payments` non propagano errori a Quote (`WARNING` + outbox `failed`).

Flusso: trigger → outbox (`dedupe_key`) → processore immediato → receivables/movements/source_links + audit.

## Semantica `accounting_source_links.is_active`

| Valore | Significato |
|--------|-------------|
| `true` | La sorgente Quote **esiste ancora** e questo link è la mappa live verso Contabilità. |
| `false` | Link **storico** conservato: sorgente eliminata/annullata. I link non si eliminano mai. |

Regole per tipo:

- `assignment_receivable`: `true` mentre esiste `fee_assignments`; `false` dopo `assignment_delete` (receivable resta `cancelled`/`to_review`).
- `payment_movement`: `true` mentre esiste la riga `payments`; `false` dopo `payment_delete` / void (movimento originale resta, status `reversed`).
- `payment_reversal`: **sempre `is_active=false`**. Non esiste una riga Quote per lo storno; è solo audit storico. La riconciliazione **non** lo conta come pagamento attivo.

Riattivazione: se la stessa assegnazione viene sincronizzata di nuovo e il link esiste, `assignment_receivable` torna `is_active=true`.

UUID pagamento riutilizzato dopo storno: se esiste `payment_movement` con `is_active=false`, `payment_insert` **non** è idempotente silenzioso: fallisce con messaggio chiaro (outbox `failed`). Unique su `(source_system, source_table, source_id, link_type)` impedisce un secondo `payment_movement` senza alterare la storia.

## Riconciliazione (`accounting_reconcile_fees_preview`)

Non confronta solo i conteggi. Verifica:

1. ogni `fee_assignments` ha un `assignment_receivable` **attivo**;
2. nessun `assignment_receivable` attivo senza assegnazione;
3. ogni `payments` ha un `payment_movement` **attivo**;
4. nessun `payment_movement` attivo senza pagamento;
5. `collected_amount_cents` del receivable = `SUM(payments.amount)` per assegnazioni esistenti con link attivo;
6. outbox `pending` / `failed` = 0.

`payment_reversal` e link inattivi non entrano nei confronti “attivi”. `aligned=true` solo se tutti i mismatch sono zero.

## FK Quote (schema Supabase reale)

L’export Supabase **non** definisce `ON DELETE CASCADE` per:

- `payments.assignment_id` → `fee_assignments.id`
- `fee_assignments.fee_id` → `fees.id`
- `fee_assignments.person_id` → `people.id`

Il file storico `database/fees_tables.sql` documenta CASCADE, ma non riflette lo schema live.

## Eliminazione assegnazione / pagamento (codice TeamFlow)

**voidPayment** (`src/lib/fees/paymentsCore.ts`): DELETE su `payments` → `payment_delete` → storno + `payment_movement.is_active=false` + link `payment_reversal` storico.

**Eliminazione assegnazione** — DELETE diretto su `fee_assignments` senza cancellare prima i payments (`FeesTab`, `FeesManagement`, `useFeesData`). Con pagamenti collegati Supabase **rifiuta** la DELETE; `assignment_delete` non parte. Senza pagamenti: receivable `cancelled`, link `assignment_receivable` → `is_active=false`.

## Esercizio / Importi / Storno

Esercizio `2026` idempotente. Importi Quote già in centesimi. Data storno: `CURRENT_DATE` (annullamento tecnico).

## Non incluso

UI Contabilità (Step 3), backfill storico, IVA, FlowMe.
