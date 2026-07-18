# @brixia/shared

Codice condiviso tra **TeamFlow** (webapp) e **FlowMe** (PWA).

## Contenuto

- **overlapCheck** – Validazione anti-accavallamento appuntamenti (buffer, regole giocatore/medico/macchinari). Export: `checkOverlap`, `formatOverlapHardError`, tipi `OverlapActivity`, `OverlapHardError`, `OverlapResult`.

## Utilizzo

- **TeamFlow**: dipendenza `"@brixia/shared": "file:packages/shared"`, alias in `vite.config.ts`.
- **FlowMe**: dipendenza che punta a questo package (path relativo alla repo TeamFlow), alias in `vite.config.ts` su `node_modules/@brixia/shared/src/index.ts`.

## sessionScheduler

La logica è in **shared**: `sessionScheduler.ts`. Entrambe le app la usano tramite un thin wrapper locale che inietta il client Supabase (`TeamFlow/src/lib/sessionScheduler.ts`, `FlowMe/src/lib/sessionScheduler.ts`). Modifiche vanno fatte solo in `packages/shared/src/sessionScheduler.ts`.

## Componenti duplicati (fuori da shared)

Modali infortuni/partite e calendario sono ancora duplicati in TeamFlow e FlowMe. Vedi `docs/Componenti_duplicati_TeamFlow_FlowMe.md` nel repo TeamFlow per l’elenco e come tenerli allineati.
