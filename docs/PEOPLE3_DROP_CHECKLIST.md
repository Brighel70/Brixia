# Checklist DROP people3 — Solo quando 100% sicuri

**Obiettivo:** Eliminare la tabella `people3` (archivio legacy) solo dopo aver verificato che non serve più.

**Regola:** Non eseguire il DROP finché tutti i punti sotto non sono ✅.

---

## 1) Periodo di transizione

- [ ] **Finestra minima 30–60 giorni** da quando people3 è stata deprecata (Prompt #7)
- [ ] In questo periodo people3 rimane come archivio, nessuna FK la usa
- [ ] Nessun problema segnalato dall'app o da integrazioni

---

## 2) Backup / snapshot (obbligatorio)

- [ ] **Backup database** o **snapshot Supabase** (Dashboard → Database → Backups)
- [ ] **Export people3 in CSV** (o dump SQL) come ulteriore sicurezza:
  ```sql
  -- In Supabase SQL Editor: esporta via "Download as CSV" dopo:
  SELECT * FROM public.people3;
  ```
- [ ] Conservare il backup in luogo sicuro per almeno 90 giorni post-drop

---

## 3) Verifiche tecniche (con query)

Esegui `database/inventory_people3_dependencies.sql` nel SQL Editor di Supabase.

- [ ] **Nessuna FK** che punta a people3
- [ ] **Nessuna view** che usa people3
- [ ] **Nessuna function/trigger** che usa people3
- [ ] **Nessuna policy RLS** legata a people3
- [ ] **Nessun riferimento** in SQL migrations "attive" (solo legacy ok; 001/002 sono migrazioni già eseguite)
- [ ] **Nessuna query runtime** nel codice app (già ok: grep su `src/` per `people3` → 0 risultati)

Se qualcosa non è OK → **NON procedere**. Vedi sezione 4.

---

## 4) Decisione

### Se tutto OK ✅
- [ ] Autorizzazione manuale al drop (team/deployer)
- [ ] Eseguire **`database/drop_people3_safe.sql`** nel SQL Editor di Supabase (controlla le FK e droppa people3), oppure `database/drop_people3__MANUAL_ONLY.sql` dopo aver letto l'header e decommentato la riga DROP

### Se qualcosa non OK ❌
- **FK attive:** Migrare le FK su `people` (vedi 002_player_guardian_fk_to_people.sql come riferimento)
- **Views/functions/triggers:** Aggiornare o eliminare prima del drop
- **RLS policies:** Rimuovere o aggiornare
- **Migrations attive:** Non dovrebbero referenziare people3; se sì, correggere

---

## 5) Post-drop

- [ ] **Rigenerare schema types** (se usi Supabase typed client): `supabase gen types typescript`
- [ ] **Smoke test** TeamFlow + FlowMe (login, persone, familiari, note, ecc.)
- [ ] **Monitor errori** 24–48h (log Supabase, Sentry, console)
- [ ] Aggiornare `docs/DEPRECATED_TABLES.md`: rimuovere people3 dalla lista (o segnare "eliminata")

---

## Riferimenti

- `docs/DEPRECATED_TABLES.md` — Perché people3 esiste, quando valutare drop
- `docs/PEOPLE_MIGRATION_PLAN.md` — Piano migrazione people3 → people
- `database/inventory_people3_dependencies.sql` — Query diagnostiche
- `database/drop_people3__MANUAL_ONLY.sql` — Script drop (solo dopo checklist)
