# Migrazioni database (Supabase)

## Struttura consigliata

- **`database/migrations/`** – script da eseguire in ordine numerico (001, 002, 003, …).
  - Usare questo folder per ogni modifica allo schema o ai dati che deve essere tracciata e ripetibile.
  - Naming: `NNN_descrizione_breve.sql` (es. `005_add_brand_settings.sql`).
- **Altri script in `database/`** – setup puntuali (es. `ensure_support_admin.sql`) o feature ancora utili. Non sono una sequenza ufficiale.

## Ordine migrazioni attuali

1. **001_people3_to_people_bridge.sql** – Ponte people3 → people (colonna bridge, tabella mapping).
2. **002_player_guardian_fk_to_people.sql** – FK player_guardian su people.
3. **003_player_guardian_unique.sql** – Vincolo unique su player_guardian.
4. **004_reconcile_legacy_fee_payments.sql** – Crea il registro dei pagamenti e riallinea eventuali quote storiche già saldate.
5. **005_rls_helpers_and_phase1.sql** – Helper `get_my_person_id` / `is_app_admin` + RLS Fase 1 (push, notifications, reminder). Vedi `ISTRUZIONI_RLS_FASE1.md`.
6. **006_correspondence.sql** – Tabelle chat Corrispondenza (thread / messaggi / partecipanti) + RLS.
7. **006b_correspondence_rls_fix.sql** – GRANT + policy INSERT (se compare errore RLS su invio messaggio).
8. **007_sync_flowme_auth_password.sql** – Allinea password Auth al Codice FlowMe (dopo rigenerazione codice).

Per nuove modifiche: aggiungere il prossimo numero (es. `008_…`) in `database/migrations/` e documentarlo qui.

## Come eseguire

Da Supabase Dashboard: SQL Editor → incollare il contenuto dello script e eseguire. Oppure da CLI Supabase se configurata.
