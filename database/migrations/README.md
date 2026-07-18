# Migrazioni database (Supabase)

## Struttura consigliata

- **`database/migrations/`** – script da eseguire in ordine numerico (001, 002, 003, …).
  - Usare questo folder per ogni modifica allo schema o ai dati che deve essere tracciata e ripetibile.
  - Naming: `NNN_descrizione_breve.sql` (es. `004_add_brand_settings.sql`).
- **Script in root** (`*.sql` nella root del repo) e **altri in `database/`** – script one-off, fix, check o storici. Non hanno un ordine ufficiale; vanno eseguiti solo se serve.

## Ordine migrazioni attuali

1. **001_people3_to_people_bridge.sql** – Ponte people3 → people (colonna bridge, tabella mapping).
2. **002_player_guardian_fk_to_people.sql** – FK player_guardian su people.
3. **003_player_guardian_unique.sql** – Vincolo unique su player_guardian.

Per nuove modifiche: aggiungere il prossimo numero (es. 004_…) in `database/migrations/` e documentarlo qui.

## Come eseguire

Da Supabase Dashboard: SQL Editor → incollare il contenuto dello script e eseguire. Oppure da CLI Supabase se configurata.
