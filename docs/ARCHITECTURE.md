# Architettura TeamFlow e FlowMe

## Panoramica

- **TeamFlow** – Webapp React (Vite) per la gestione completa della società: anagrafiche, categorie, sessioni, infortuni, eventi, quote, documenti. Target: staff, medici, segreteria (principalmente desktop).
- **FlowMe** – PWA React (Vite) per atleti, genitori e staff: presenze, calendario, infortuni, partite, notifiche. Stesso backend Supabase, target mobile/tablet.
- **Database** – Un solo progetto Supabase (PostgreSQL); RLS e profili per separare accessi. Tabelle principali: `people`, `profiles`, `sessions`, `attendance`, `injuries`, `injury_activities`, `events`, `categories`, `fees`, `fee_assignments`, ecc.

## Codice condiviso

- **`@teamflow/shared`** (pacchetto in `TeamFlow/packages/shared`):
  - **overlapCheck** – Validazione anti-accavallamento appuntamenti (buffer, regole giocatore/medico/macchinari).
  - **sessionScheduler** – Logica per creare sessioni automatiche da `training_locations`; entrambe le app usano lo stesso modulo passando il client Supabase.
- FlowMe referenzia il pacchetto con `"@teamflow/shared": "file:../../TEAMFLOW/TeamFlow/packages/shared"` (path relativo alla propria repo). Dopo il rename, aggiornare anche la dependency in FlowMe.

## Componenti duplicati

Alcuni componenti UI esistono in entrambe le app (modali infortuni/partite, calendario settimanale). Sono documentati in `Componenti_duplicati_TeamFlow_FlowMe.md`; le modifiche vanno tenute allineate a mano o in futuro spostate in un pacchetto condiviso (es. `@teamflow/shared-ui`).

## Brand e configurazione

- **FlowMe** – Brand (logo, colori, nome club) è gestito da Supabase: tabella `brand_settings`, chiave `brand_config` (JSON). All’avvio l’app carica il brand da Supabase e aggiorna il localStorage; `getBrandConfig()` legge da lì.
- **TeamFlow** – Configurazione principalmente da env e da Supabase dove serve (stesso DB).

## Database e migrazioni

- Schema e dati su **Supabase** (PostgreSQL).
- Migrazioni ordinate in `database/migrations/` (001, 002, 003, …); altri script in root e in `database/` sono one-off o storici. Vedi `database/migrations/README.md`.
