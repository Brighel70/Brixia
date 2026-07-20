# Contabilità — Step 2C (nucleo dati) — REVISIONE

## Stato

- Migration: `database/migrations/012_accounting_core.sql`
- Test: `database/migrations/012_accounting_core_test.sql`
- **Non applicata** su Supabase finché non approvata

## Prerequisiti

- `010` + `011` applicate

## Tabelle

| Tabella | Ruolo |
|---------|--------|
| `accounting_counterparties` | Anagrafica contabile; soft-delete `archived_at`; DELETE fisico vietato (anche service_role) |
| `accounting_receivables` | Crediti; residual GENERATED STORED; soft-delete; no write authenticated |
| `accounting_movements` | Prima nota; immutabilità via GRANT/policy (no trigger) |
| `accounting_movement_allocations` | Ripartizioni; DELETE solo bozze |
| `accounting_source_links` | **Mappa** stabile source→contabile (`link_type`), non log eventi |
| `accounting_audit_log` | Append-only intenzionale (UPDATE/DELETE bloccati anche per service_role) |

## source_links (mappa)

`link_type`: `assignment_receivable` | `payment_movement` | `refund_movement` | `legacy_receivable` | `legacy_movement`

- Unique `(source_system, source_table, source_id, link_type)`
- CHECK: receivable-types → solo `receivable_id`; movement-types → solo `movement_id`
- Eventi (`assignment_updated`, `payment_voided`, …) → **outbox 2E** + **audit_log**, non nuove righe source_links

## Posting / storno (futuro)

In 2C: nessun posting diretto; UPDATE solo `draft`/`pending_account`; nessun DELETE movements.

RPC SECURITY DEFINER + audit nello step dedicato (senza trigger di immutabilità che bloccherebbe le RPC).

## Non incluso

Outbox, trigger Quote, backfill, UI, IVA, RPC posting.
