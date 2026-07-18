# Analisi critica e costruttiva: TeamFlow + FlowMe + Database Supabase

**Data:** 12 febbraio 2026  
**Scope:** Webapp TeamFlow, App mobile FlowMe, Database Supabase

---

## 1. TEAMFLOW WEBAPP

### 1.1 File obsoleti / non utilizzati (candidati alla rimozione)

| File | Motivo | Azione consigliata |
|------|--------|-------------------|
| `src/pages/CreatePersonView_old.tsx` | Vecchia versione, non importata in routes | **Eliminare** |
| `src/pages/CreatePersonView_Refactored.tsx` | Esempio refactoring, non usato | **Eliminare** o spostare in `/docs/examples` |
| `src/pages/CategoryActivities_broken.tsx` | File "broken", non usato | **Eliminare** |
| `src/pages/CategoryActivities_part1.tsx` | Parte di split, **non importato** | **Eliminare** |
| `src/pages/CategoryActivities_part2.tsx` | Parte di split, **non importato** | **Eliminare** |
| `src/pages/CategoryActivities_backup.tsx` | Backup, non usato | **Eliminare** |
| `src/pages/AgendaNewView.tsx` | Non presente in routes (si usa AgendaView) | **Eliminare** o collegare se previsto |

### 1.2 Codice ridondante / duplicato

- **NotesTab** (`src/components/NotesTab.tsx`): componente standalone con logica note, ma **CreatePersonView** usa `renderNotesTab()` inline (~400 righe). NotesTab è commentato (`// import NotesTab`). Duplicazione di logica.
- **CreatePerson/FeesTab**: esiste come componente ma CreatePersonView usa `renderFeesTab()` inline. CreatePersonView_Refactored usa FeesTab; CreatePersonView principale no.
- **FeesManagement**: commenti "replica la logica di CreatePersonView" per modal pagamenti e toggle rate – logica duplicata tra FeesManagement e CreatePersonView.
- **AttendanceBoard vs AttendanceBoardHybrid**: due componenti simili per la stessa funzionalità (`/attendance`, `/board` vs `/board-hybrid`). Valutare unificazione.

### 1.3 Componenti duplicati con FlowMe

| TeamFlow | FlowMe | Note |
|----------|--------|------|
| `src/utils/overlapCheck.ts` | `src/utils/overlapCheck.ts` | Quasi identici, differenza solo nell’import di supabase |
| `src/lib/sessionScheduler.ts` | `src/lib/sessionScheduler.ts` | Quasi identici |
| `src/components/InjuryEditModal.tsx` | `src/components/InjuryEditModal.tsx` | Da confrontare |
| `src/components/MatchScorecard.tsx` | `src/components/MatchScorecard.tsx` | Da confrontare |
| `src/components/MatchListModal.tsx` | `src/components/MatchListModal.tsx` | Da confrontare |
| `src/components/VisitListOutcomeModal.tsx` | `src/components/VisitListOutcomeModal.tsx` | Da confrontare |
| `src/components/SortableAgendaCard.tsx` | `src/components/SortableAgendaCard.tsx` | Da confrontare |
| `src/components/WeeklyCalendarView.tsx` | `src/components/WeeklyCalendarView.tsx` | Da confrontare |

**Raccomandazione:** creare un pacchetto condiviso (es. `@brixia/shared`) con overlapCheck, sessionScheduler e componenti comuni, usato da entrambe le app.

### 1.4 Possibili bug / incoerenze

- **notes.created_by**: può essere UUID (auth) o stringa ("Sistema"). La risoluzione a nome da `profiles` è stata aggiunta; verificare che funzioni per tutti i casi.
- **package.json**: nome `"segna-presenze"` non riflette "TeamFlow". Valutare rinominare in `teamflow` o simile.

---

## 2. DATABASE SUPABASE

### 2.1 Tabelle people vs people3

**Problema:** esistono due tabelle persone:

- **people**: usata da TeamFlow, FlowMe, attendance, injuries, fee_assignments, match_lists, profiles, tutor_athlete_relations, ecc.
- **people3**: usata da documents (created_by, person_id), guardians, medical_certificates, person_consents, player_guardian_relationships, players.

**Conseguenze:**
- Rischio di incoerenza tra persone in `people` e `people3`
- documents.created_by → people3.id, ma notes.created_by può essere auth.users.id (profiles)
- guardians, medical_certificates, person_consents, players → people3

**Raccomandazione:** migrare tutto su **people** e deprecare **people3**, oppure definire chiaramente il ruolo di ciascuna tabella e documentarlo.

### 2.2 Foreign key incoerenti

- **documents.person_id** → people.id ✅  
- **documents.created_by** → people3.id ⚠️ (people3 vs people)
- **notes.person_id**: nessuna FK (rimossa per evitare 409). Logica: person_id punta a people.id
- **notes.created_by**: tipo text, può essere UUID (profiles) o stringa. Nessuna FK.

### 2.3 Tabelle potenzialmente ridondanti / legacy

- **players**: FK su people3; sembra legacy rispetto a people con `is_player`
- **tutors**: tabella separata; tutor_athlete_relations usa people
- **documenti_deposito**: non sembra usata nel codice; verificare utilizzo
- **staff_categories**: FK user_id → ? (schema non chiaro; potrebbe essere profiles.id)

### 2.4 Script SQL

Ci sono **~387 file .sql** nella root. Molti sono migration/fix one-off che potrebbero essere:
- consolidati in migrazioni numerate
- spostati in `database/migrations/` con naming chiaro
- eliminati se obsoleti

---

## 3. FLOWME APP MOBILE

### 3.1 Struttura

- **Auth:** email + `invite_code` (da people), sessione in `localStorage` (`flowme_session`). Nessun Supabase Auth persistente.
- **Sezioni:** staff, medico, player, guardian, segreteria, finanziario.
- **Integrazione webapp:** Segreteria/Finanziario su tablet usano viste native; su smartphone usano iframe verso `VITE_WEBAPP_URL` (TeamFlow).

### 3.2 Flusso auth FlowMe vs TeamFlow

| Aspetto | FlowMe | TeamFlow (webapp) |
|---------|--------|-------------------|
| Login | email + invite_code (people) | email + invite_code_teamflow (people) |
| Auth | localStorage flowme_session | Supabase Auth + profiles |
| Persistenza | persistSession: false | persistSession: true |

Due codici distinti: `invite_code` (FlowMe) e `invite_code_teamflow` (TeamFlow). Coerente con due app separate.

### 3.3 Configurazione brand

- FlowMe legge `localStorage.getItem('brixia-brand-config')` se la webapp l’ha impostato.
- TeamFlow usa IndexedDB + localStorage per brand.
- Sincronizzazione: l’utente deve aver visitato la webapp prima; altrimenti FlowMe usa i default.

### 3.4 File potenzialmente obsoleti

- Nessun file `*_old`, `*_broken` o `*_backup` trovato in FlowMe. Struttura più pulita di TeamFlow.

---

## 4. FLUSSI TEAMFLOW ↔ FLOWME

### 4.1 Dati condivisi

- **people**: anagrafica, invite_code, invite_code_teamflow, flowme_sections, flowme_access_blocked, teamflow_app_role
- **injuries, injury_activities**: infortuni e attività
- **sessions, attendance**: allenamenti e presenze
- **events, match_lists, match_statistics**: eventi e statistiche
- **fees, fee_assignments**: quote e assegnazioni

### 4.2 Flussi corretti

1. **Login FlowMe:** email + invite_code → people → flowme_session
2. **Blocco accesso:** flowme_access_blocked da TeamFlow → FlowMe non permette login
3. **Sezioni:** flowme_sections da people → quali sezioni FlowMe mostra
4. **PersonSchedaTablet (FlowMe):** modifica flowme_sections e flowme_access_blocked su people (come la webapp)
5. **WebAppSectionPage:** su smartphone apre iframe TeamFlow per Segreteria/Finanziario

### 4.3 Possibili miglioramenti

- **Brand:** FlowMe potrebbe leggere brand da Supabase (brand_settings) invece che da localStorage, per funzionare anche senza aver mai aperto la webapp.
- **Notifiche:** FlowMe registra push (FCM + Web Push); verificare che gli endpoint Supabase (send-activity-push, ecc.) siano allineati.

---

## 5. RACCOMANDAZIONI PRIORITIZZATE

### Priorità alta

1. **Rimuovere file obsoleti TeamFlow:** CreatePersonView_old, CategoryActivities_broken, CategoryActivities_backup, AgendaNewView (se non usato).
2. **Unificare people/people3:** piano di migrazione per usare solo `people` e deprecare `people3`.
3. **Ridurre duplicazione CreatePersonView:** valutare refactoring con CreatePerson/FeesTab e NotesTab per alleggerire il file (~6000 righe).

### Priorità media

4. **Pacchetto condiviso:** overlapCheck, sessionScheduler e componenti comuni in un modulo condiviso.
5. **Consolidare script SQL:** struttura `database/migrations/` con naming e ordine esecuzione chiari.
6. **Unificare AttendanceBoard:** un solo componente con varianti (es. prop `mode`).

### Priorità bassa

7. **Rinominare package:** da "segna-presenze" a "teamflow".
8. **Brand da Supabase in FlowMe:** per configurazione brand indipendente dalla webapp.
9. **Documentazione:** README con architettura, flussi auth e integrazione TeamFlow–FlowMe.

---

## 6. RIEPILOGO FILE DA ELIMINARE (TeamFlow)

```
src/pages/CreatePersonView_old.tsx
src/pages/CreatePersonView_Refactored.tsx
src/pages/CategoryActivities_broken.tsx
src/pages/CategoryActivities_backup.tsx
src/pages/AgendaNewView.tsx   (se confermato non usato)
```

`CategoryActivities_part1.tsx` e `CategoryActivities_part2.tsx` non sono importati da nessuno → **eliminabili**.
