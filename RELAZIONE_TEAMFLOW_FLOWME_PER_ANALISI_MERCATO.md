# Relazione dettagliata: TeamFlow + FlowMe — Per analisi di mercato e confronto con la concorrenza

**Scopo del documento:** fornire a un assistente (es. ChatGPT) tutte le informazioni necessarie per svolgere una ricerca sul web sul mercato italiano, individuare app/soluzioni simili o migliori, fare un termine di paragone, valutare come posizionare TeamFlow/FlowMe e stimare eventuali formule di vendita o monetizzazione.

**Data:** 19 febbraio 2025  
**Prodotto:** Suite gestionale per società sportive — Webapp **TeamFlow** + PWA mobile **FlowMe**

---

## 1. Panoramica del prodotto

Si tratta di **due applicazioni collegate** che formano un unico ecosistema:

| Applicazione | Tipo | Ruolo principale |
|--------------|------|-------------------|
| **TeamFlow** | Web application (SPA) | Back-office: segreteria, dirigenti, staff medico, amministrazione società |
| **FlowMe** | PWA (Progressive Web App) per smartphone e tablet | Front-office: atleti, genitori (guardian), staff sul campo, medico/fisioterapista in mobilità |

- **TeamFlow** e **FlowMe** condividono lo **stesso database** (Supabase/PostgreSQL) e le stesse regole di business.
- **TeamFlow** è il “centro di comando”: crea utenti, assegna codici invito, gestisce anagrafiche, quote, infortuni, eventi.
- **FlowMe** è l’app “in tasca” per atleti, genitori e staff: presenze, partite, pagamenti, infortuni, notifiche; le sezioni Segreteria e Finanziario su tablet/smartphone possono aprire la webapp TeamFlow in iframe.

**Settore di riferimento:** società sportive (nel caso d’uso attuale: rugby — Brixia Rugby); il prodotto è adattabile a qualsiasi sport di squadra o associazione con atleti, staff, categorie e quote.

---

## 2. TeamFlow — La web application principale

### 2.1 Cosa fa (funzionalità)

- **Dashboard:** statistiche aggregate (persone, minori, sessioni, presenze, quote, eventi).
- **Anagrafica unificata (Persone):**
  - Scheda persona unica con tab: Anagrafica, Giocatore, Staff, Tutor, Infortuni, Documenti, Note, Guardian, FlowMe, Quote.
  - Gestione giocatori (categorie, posizioni, associazioni), staff (ruoli, categorie), tutor/genitori e relazioni atleta–guardian.
- **Sessioni e presenze:**
  - Sessioni/allenamenti per categoria e sede.
  - Board presenze (anche ibrida e mobile), segnatura presenze, avvio allenamento da QR.
- **Eventi e partite:**
  - Calendario eventi, match, liste partita, statistiche partita e avversari.
- **Infortuni e agenda medico:**
  - Agenda infortuni, attività per infortunio (visite, fisioterapia, esami, ricontrolli), esiti visite, flusso email infortuni con template e allegati (Resend).
- **Quote e pagamenti:**
  - Gestione quote (iscrizione, gite, corsi, eventi, attrezzature, assicurazioni, altro).
  - Assegnazioni a persone, stati (in attesa, pagato, scaduto, annullato), rate, metodi di pagamento, ricevute PDF e template intestazione.
- **Documenti e note:**
  - Upload documenti (Supabase Storage), note con reminder.
- **Comunicazione:**
  - Template messaggi, notifiche in-app, email infortuni (Edge Function + Resend), auguri compleanno automatici (cron), push FCM verso app mobile.
- **Consiglio e permessi:**
  - Gestione consiglio, utenti, ruoli e permessi granulari (Admin, Dirigente, Segreteria, DT, DS, Allenatore, Team Manager, Medico, Fisio, Player, Famiglia, ecc.).
- **Brand e impostazioni:**
  - Personalizzazione brand, categorie, sedi allenamento, impostazioni infortuni/assicurazione.

### 2.2 Stack tecnologico

- **Frontend:** React 18, TypeScript, Vite 5, React Router v6.
- **UI:** Tailwind CSS, Radix UI, Lucide React, Motion, CVA, Sonner (toast).
- **Stato:** Zustand.
- **Backend/DB:** Supabase (Auth, PostgreSQL, Storage, Edge Functions in Deno).
- **PDF:** @react-pdf/renderer, jsPDF, html2canvas.
- **Altro:** xlsx, @dnd-kit (drag & drop), formidable (upload).

Non c’è backend Node/Express separato: la webapp è una SPA che parla direttamente a Supabase (RLS e permessi per ruolo).

### 2.3 Integrazioni esterne

- **Supabase:** auth (email/password + sessioni), database, storage, Edge Functions.
- **Resend:** invio email infortuni (template + allegati) da Edge Function.
- **Firebase Cloud Messaging (FCM):** push su app mobile (anche con app chiusa); registrazione token da FlowMe.
- **Cron esterni:** auguri compleanno (es. cron-job.org o Vercel Cron).

### 2.4 Punti di forza (TeamFlow)

- Scheda persona unica con tutti i dati (giocatore, staff, tutor, infortuni, documenti, note, guardian, FlowMe, quote).
- Agenda infortuni completa (attività, visite, ricontrolli) con flusso email automatico.
- Sistema quote e assegnazioni articolato (tipi, stati, rate, ricevute).
- Permessi granulari per ruolo.
- Stesso database e stessi dati per webapp e app mobile (nessuna duplicazione logica).

---

## 3. FlowMe — L’app mobile (PWA)

### 3.1 Cosa fa (funzionalità)

- **Accesso:** login con **email + codice invito** (codice generato in TeamFlow, scheda persona → tab FlowMe). Nessun account Supabase Auth per l’utente finale; sessione in `localStorage` (`flowme_session`).
- **Sezioni (multi-ruolo):**
  - **Player:** presenze, calendario partite, stato pagamenti.
  - **Staff:** categorie, sessioni, presenze giocatori, match list, statistiche avversari, vista infortuni.
  - **Guardian:** figli collegati, presenze/quote/documenti per figlio.
  - **Medical:** infortuni (aperti/chiusi), attività per infortunio (visite, fisio, esami, ecc.), overlap appuntamenti, notifiche modifica attività.
  - **Segreteria / Finanziario:** su tablet/smartphone possono usare la webapp TeamFlow in iframe (stessi dati).
- **Notifiche:** push FCM e Web Push (anche con app chiusa); template per partite, pagamenti, presenze, comunicazioni; badge e gestione permessi.
- **Offline:** indicatore online/offline, cache PWA (Workbox); dati sensibili (es. attività infortuni) aggiornati in rete.

### 3.2 Stack tecnologico

- **Tipo:** PWA (Progressive Web App), **non** app nativa (né React Native né Expo).
- **Runtime:** browser; installabile su iOS (Safari) e Android (Chrome).
- **Framework:** React 18, TypeScript, Vite 5, React Router v6.
- **UI:** Tailwind CSS, Radix UI, Motion, @dnd-kit.
- **Stato:** Zustand.
- **Backend:** stesso Supabase di TeamFlow.
- **PWA:** vite-plugin-pwa (Workbox, service worker, manifest).
- **Push:** Firebase (FCM) + Web Push (VAPID).
- **Export:** jsPDF, html2canvas.

### 3.3 Collegamento con TeamFlow

- **Stesso progetto Supabase:** stessi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- **Auth:** in FlowMe si usa `people.email` + `people.invite_code`; in TeamFlow si usa `invite_code_teamflow` (due codici distinti per le due app). In TeamFlow si abilitano le sezioni FlowMe (`flowme_sections`) e si può bloccare l’accesso (`flowme_access_blocked`).
- **Dati condivisi:** anagrafica (`people`), infortuni e attività (`injuries`, `injury_activities`), sessioni e presenze (`sessions`, `attendance`), eventi e partite (`events`, `match_lists`, `match_statistics`), quote e assegnazioni (`fees`, `fee_assignments`), notifiche e token push (`notifications`, `push_tokens`).
- **Push:** FlowMe registra il token FCM/Web Push tramite Edge Function `register-push-token`; le notifiche create dalla webapp (tabella `notifications`) vengono inviate con `send-fcm-push` anche ai dispositivi FlowMe.

### 3.4 Punti di forza (FlowMe)

- Una sola PWA per atleti, staff, genitori e medico; accesso in base a ruoli e sezioni abilitate da TeamFlow.
- Installabile da browser senza store; aggiornamenti come sito web.
- Push anche con app chiusa (FCM + Web Push).
- Sezioni Segreteria/Finanziario che riusano la webapp in iframe (stessi dati, zero duplicazione funzionale).
- Orientata a mobile/tablet e uso offline dove possibile.

---

## 4. Come sono collegate le due app (sintesi)

1. **Database unico:** Supabase PostgreSQL condiviso; RLS e permessi gestiti lato DB.
2. **Utenti:** creati e configurati in TeamFlow (anagrafica, codici invito, sezioni FlowMe, blocco accesso).
3. **FlowMe** usa solo email + codice invito (nessuna registrazione pubblica); i codici sono generati dalla webapp.
4. **Notifiche:** create dalla webapp (o da processi automatici), recapitate su FlowMe tramite FCM/Web Push.
5. **Segreteria/Finanziario in FlowMe:** su dispositivo mobile aprono la webapp TeamFlow in iframe, così si evitano doppie implementazioni.

---

## 5. Contesto per la ricerca di mercato e la valutazione

### 5.1 Cosa cercare sul web (suggerimenti per l’assistente)

- **Termini in italiano:**  
  “gestionale società sportiva”, “software gestione club sportivo”, “app presenze allenamenti società”, “gestione atleti quote iscrizioni”, “software infortuni società sportiva”, “app per genitori atleti”, “piattaforma sportiva amatoriale/agonistica”.
- **Confronto:**  
  Cercare soluzioni italiane (e eventualmente estere adattate all’Italia) che offrano: anagrafica atleti/staff, presenze/allenamenti, eventi/partite, quote e pagamenti, infortuni/agenda medico, app o portale per atleti/genitori, notifiche push.
- **Mercato:**  
  Società sportive (rugby, calcio, basket, volley, ecc.), federazioni minori, ASD, polisportive; focus su **mercato italiano** (prezzi in EUR, modelli B2B/B2C italiani).
- **Formule di vendita da indagare:**  
  Canone SaaS mensile/annuale per società, prezzo per atleta o per categoria, abbonamento “base + premium”, vendita una tantum (licenza), white-label per federazioni o leghe.

### 5.2 Elementi da evidenziare in un confronto

- **Unico ecosistema webapp + PWA** con stesso database e stesso prodotto “logico”.
- **Scheda persona unificata** (giocatore/staff/tutor/infortuni/documenti/note/guardian/FlowMe/quote) in un’unica interfaccia.
- **Agenda infortuni** con attività, visite, ricontrolli ed email automatiche (template + allegati).
- **Sistema quote e pagamenti** con tipi multipli, assegnazioni, stati, rate e ricevute.
- **Multi-ruolo e multi-sezione** in FlowMe (Player, Staff, Guardian, Medical, Segreteria, Finanziario) con un’unica app.
- **Push con app chiusa** per atleti e genitori.
- **Assenza di backend custom:** tutto su Supabase (riduzione costi infrastruttura e manutenzione).
- **PWA invece di app native:** nessun costo store, aggiornamenti immediati, un solo codebase web per mobile.

### 5.3 Possibili debolezze da considerare (onesti)

- **People vs people3:** in passato esistevano due tabelle “persone”; la migrazione verso un unico modello (`people`) è in corso o da completare — da considerare in caso di due diligence tecnica.
- **Codice duplicato:** alcuni componenti e utility (es. overlapCheck, sessionScheduler, modali infortuni/partite) sono presenti sia in TeamFlow che in FlowMe; un pacchetto condiviso migliorerebbe manutenzione e valore tecnico.
- **Nome package:** la webapp in `package.json` è ancora “segna-presenze”; il nome commerciale è TeamFlow — da allineare in caso di vendita o rebrand.

---

## 6. Informazioni tecniche rapide (per stime e due diligence)

| Aspetto | Dettaglio |
|--------|-----------|
| **TeamFlow – nome package** | `segna-presenze` (nome interno); nome prodotto: TeamFlow |
| **FlowMe – nome package** | `flowme-mobile` |
| **TeamFlow – repository/cartella** | `C:\Users\BRIXIA\Documents\TEAMFLOW\TeamFlow` |
| **FlowMe – repository/cartella** | `C:\Users\BRIXIA\Documents\FlowMe\FlowMe` |
| **Backend** | Solo Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| **Deploy webapp** | Adatto a Vercel, Netlify o simile (variabili `VITE_SUPABASE_*`) |
| **Deploy FlowMe** | PWA: stesso tipo di hosting (es. Vercel); nessun store |
| **Documentazione interna** | `docs/` in entrambi i progetti (FEES_MANAGEMENT, PUSH_FCM, PEOPLE_MIGRATION_PLAN, ANALISI_CRITICA_TEAMFLOW_FLOWME, ecc.) |

---

## 7. Riepilogo per il brief di ricerca

**Prodotto:**  
Suite composta da **TeamFlow** (webapp di back-office per società sportive) e **FlowMe** (PWA per atleti, genitori, staff e medico), con database e notifiche condivisi.

**Cosa fare con questo documento:**  
Usare questa relazione per (1) cercare sul web app e software simili o migliori nel mercato italiano, (2) fare un confronto funzionale e di posizionamento, (3) stimare a quanto si potrebbe vendere il prodotto e con quali formule (vendita una tantum, SaaS, white-label, ecc.) in base a quanto emerge dalla ricerca online.

**Target di mercato:**  
Società sportive italiane (ASD, SSD, club), federazioni minori, polisportive; gestione atleti, staff, categorie, presenze, eventi/partite, quote/pagamenti, infortuni e comunicazione con atleti e genitori.

---

*Fine relazione. Documento generato per supportare analisi di mercato e confronto con la concorrenza.*
