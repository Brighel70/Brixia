# RLS Fase 1 — istruzioni

## Cosa fa `005_rls_helpers_and_phase1.sql`

1. Crea `get_my_person_id()` e `is_app_admin()` (JWT → `profiles`).
2. Chiude le policy aperte su:
   - `push_subscriptions`
   - `push_tokens`
  - `notifications` (lettura/modifica/delete solo proprie; **insert** consentito a qualsiasi utente autenticato, così TeamFlow può notificare altri)
  - `injury_reminders`
  - `activity_modification_notifications`
3. **Non tocca** ancora: `people`, quote/pagamenti, `documents`, `injuries`, `events`, guardian.

## Stato

- [x] Script `005` eseguito su Supabase (luglio 2026) senza errori.
- Controlli consigliati sotto.

## Prima di eseguire

1. Deploy FlowMe con Auth persistente (login che crea JWT).
2. Verifica che un utente di prova possa fare login FlowMe e TeamFlow.
3. Esegui lo script in **Supabase → SQL Editor → Run**.

## Dopo l’esecuzione — checklist rapida

- [ ] Login FlowMe → permesso notifiche → riga in `push_subscriptions` con il proprio `person_id`
- [ ] Login TeamFlow Admin → operazioni normali ok
- [ ] Da browser **senza login**, chiamata anon a `push_subscriptions` deve fallire (RLS)
- [ ] Edge Function push (service_role) continua a leggere/scrivere

## Se qualcosa non funziona

- Utente senza `profiles.person_id`: rifare login FlowMe (collega il profilo).
- Codice FlowMe ≠ password Auth (account già creato da TeamFlow): allineare password in Authentication → Users, oppure usare lo stesso codice.
- Admin assistenza: `profiles.role = Admin` → `is_app_admin()` = true.

## Prossime fasi (non in questo script)

- **006** — events / sessions / attendance / match_* (ambito categoria)
- **007** — injuries / injury_activities / visite
- **008** — people / documents / guardians / fees (le più delicate)
