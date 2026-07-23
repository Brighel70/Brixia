# TeamFlow

Webapp di gestione per società sportive (prodotto **TeamFlow**; identità club da Personalizzazione Brand): anagrafiche, categorie, sessioni/allenamenti, infortuni, eventi, quote, documenti.

## Avvio

- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Preview:** `npm run preview`

## Struttura progetto

- **`src/`** – App React (Vite): pagine, componenti, store, lib.
- **`packages/shared`** – Pacchetto `@teamflow/shared`: codice condiviso con FlowMe (overlapCheck, sessionScheduler).
- **`database/`** – Script SQL per Supabase; le migrazioni ordinate sono in `database/migrations/` (vedi README in quella cartella).
- **`docs/`** – Documentazione (architettura, componenti duplicati, ecc.).

## Database

Backend **Supabase** (PostgreSQL). Stesso database usato da **FlowMe** (PWA atleti/genitori/staff). Schema e RLS gestiti via script in `database/` e dalla Dashboard Supabase.

## Relazione con FlowMe

- **TeamFlow** – Uso prevalentemente da desktop; gestione completa (staff, medici, segreteria).
- **FlowMe** – PWA per atleti, genitori e staff da mobile/tablet; stesso DB, stesso Supabase.
- Codice condiviso: `@teamflow/shared` (logica sessioni, overlap appuntamenti). Vedi `docs/ARCHITECTURE.md` e `docs/Componenti_duplicati_TeamFlow_FlowMe.md`.
