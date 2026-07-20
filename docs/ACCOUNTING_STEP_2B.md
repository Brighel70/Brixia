# Contabilità — Step 2B (foundation)

## Stato

- Migration creata nel repository: `database/migrations/010_accounting_foundation.sql`
- Test read-only: `database/migrations/010_accounting_foundation_test.sql`
- **Non applicata** su Supabase produzione (né su remoto da questo step)

## Cosa include

- Helper `has_accounting_permission(text)`
- Tabelle: `accounting_settings`, `accounting_fiscal_params`, `accounting_fiscal_years`, `accounting_accounts`, `accounting_categories`, `accounting_payment_method_account_map`
- Permessi `accounting.*` nel catalogo + assegnazione al solo ruolo **Admin** (se presente in `user_roles`)
- Seed: Cassa/Banca, mapping cash/contanti/bank_transfer/bonifico, categorie QUOTE/ALTRE_*, parametri fiscali **unverified**
- RLS su tutte le nuove tabelle
- Nessun trigger sulle Quote; nessuna `accounting_schema_version`

## Parametri fiscali

Tutti i seed fiscali sono marcati:

**PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA.**

Nessuna aliquota/base IRES o IRAP.

## Come applicare (futuro, solo dopo approvazione)

1. Backup / snapshot progetto Supabase consigliato
2. SQL Editor → incollare **solo** `010_accounting_foundation.sql` → Run
3. Eseguire `010_accounting_foundation_test.sql` e verificare i check `T1`–`T13`
4. Controllare `T4_role_grants`: deve risultare Admin con 9 permessi; se 0, assegnare manualmente dopo verifica `user_roles`

## Non incluso (step successivi)

Receivables, movements, source_links, outbox, trigger Quote, UI, Storage, IVA, budget/rendiconto.
