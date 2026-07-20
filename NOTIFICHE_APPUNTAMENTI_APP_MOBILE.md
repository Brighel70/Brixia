# Notifiche modifica appuntamento – App mobile

Quando un operatore (medico/fisioterapista) ha un appuntamento **con data e orario futuri** e qualcuno **modifica** quell’attività dalla web app, il sistema scrive una notifica per quell’operatore.

## Cosa è stato implementato

1. **Tabella `notifications`** (Supabase)  
   - Esegui lo script: `create_notifications_table.sql`  
   - Colonne: `id`, `user_id` (auth dell’operatore), `title`, `body`, `type`, `metadata`, `read_at`, `created_at`.

2. **Web app**  
   - In modifica attività (scheda Infortuni → Modifica Attività), dopo il salvataggio:
     - Se l’attività ha **data futura** (o oggi con orario futuro), viene chiamato il servizio di notifica.
     - L’operatore è identificato da `operator_name` (nome della persona); si risale al suo `user_id` tramite `people.full_name` → `profiles.person_id` (o `profiles.full_name`).
     - Viene inserita una riga in `notifications` con `user_id` = utente auth dell’operatore.

3. **Contratto notifica**  
   - `type`: `'activity_updated'`  
   - `metadata`: `{ activity_id, player_name, date, time, activity_type }`  
   - `title`: `"Appuntamento modificato"`  
   - `body`: testo con giocatore, data e orario (se presenti).

## Perché la notifica arriva solo con l’app aperta?

Con l’implementazione attuale (Realtime o polling), la notifica **arriva solo se l’app è in primo piano** perché:

- **Realtime**: la connessione Supabase è attiva solo mentre l’app è in esecuzione e in foreground; in background o chiusa non c’è nessuno in ascolto.
- **Polling**: lo stesso: il polling gira solo quando l’app è aperta.

Per far arrivare la notifica **anche con app chiusa o in background** serve una **push notification reale** (FCM su Android, APNs su iOS): è il **sistema operativo** a ricevere il messaggio e mostrarlo, non l’app. Vedi sotto “Push con app chiusa/background”.

---

## Come farle arrivare sull’app mobile (app aperta)

L’app mobile deve **leggere le notifiche** per l’utente loggato (`auth.uid()` = `user_id`). Due modi tipici:

### A) Supabase Realtime (consigliato per app aperta)

Iscrizione ai nuovi inserimenti sulla tabella `notifications` per il proprio `user_id`:

```ts
const channel = supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${supabase.auth.getUser()?.id}`
    },
    (payload) => {
      // payload.new = { id, user_id, title, body, type, metadata, read_at, created_at }
      mostraNotificaPushLocale(payload.new.title, payload.new.body)
      // e/o salva in stato locale per la lista "Notifiche"
    }
  )
  .subscribe()
```

Quando ricevi l’evento, puoi mostrare una notifica locale in app e aggiornare la lista notifiche. **Funziona solo con app aperta.**

### B) Polling

- Periodicamente (es. ogni 30–60 s) fai una query su `notifications` con `user_id = auth.uid()` e `read_at IS NULL`, ordinata per `created_at DESC`.
- Per le nuove righe rispetto all’ultimo fetch, mostra notifica locale e/o badge. **Funziona solo con app aperta.**

---

## Push con app chiusa o in background (FCM)

Per far arrivare la notifica **anche con app chiusa o in background** serve:

1. **Firebase Cloud Messaging (FCM)** (Android e, tramite FCM, anche iOS).
2. **Tabella `push_tokens`** in Supabase: l’app mobile, al login, registra il token FCM dell’utente (tabella già presente; nessuno script locale da rieseguire).
3. **Backend che invia la push**: quando la web app inserisce una riga in `notifications`, qualcosa (Edge Function Supabase o altro backend) deve **anche** inviare una richiesta a FCM con quel token, così il dispositivo riceve la push anche con app chiusa.

### Passi operativi

1. **Verifica** in Supabase che esista la tabella `push_tokens` (già creata in passato).
2. **App mobile**  
   - Integra Firebase / FCM (o Expo Push Notifications che usa FCM).  
   - Al login (o all’avvio se già loggato), ottieni il token FCM e salvalo in `push_tokens`:
     - `INSERT INTO push_tokens (user_id, token, platform) VALUES (auth.uid(), '<FCM_TOKEN>', 'android'|'ios') ON CONFLICT (user_id, token) DO UPDATE SET updated_at = now();`
   - Usa RLS: l’utente può inserire/aggiornare solo i propri token.
3. **Backend che invia push**  
   - **Opzione A – Supabase Edge Function**: crea una funzione che si attiva su INSERT in `notifications` (Database Webhook), legge i token da `push_tokens` per quel `user_id` e chiama l’API HTTP di FCM per inviare la push (title, body). Vedi `docs/PUSH_FCM_EDGE_FUNCTION.md` per codice di esempio.  
   - **Opzione B – Servizio esterno**: un piccolo server (Node, Cloud Function, ecc.) che ascolta gli INSERT su `notifications` (es. via webhook Supabase) e invia la push tramite FCM.
4. **FCM**: in Firebase Console crea un progetto, abilita Cloud Messaging, e usa la **Server key** (o account di servizio) nella Edge Function / backend per le chiamate a FCM.

Dopo questi passi, modificando un appuntamento dalla pagina Agenda e inviando la notifica all’operatore, la push arriverà sul telefono **anche con app chiusa o in background**.

## Requisito operatore → utente

Per ricevere la notifica, l’operatore deve essere un **utente di login** con profilo collegato alla persona:

- **Opzione 1:** `profiles.person_id` = `people.id` della persona il cui `full_name` coincide con l’operatore scelto in agenda (`operator_name`).
- **Opzione 2:** in assenza di `person_id`, viene usato `profiles.full_name` (deve coincidere con `operator_name`).

Quindi medici/fisioterapisti che usano l’app mobile devono avere un account (auth) e un profilo collegato alla propria anagrafica (persona) con lo stesso nome usato come operatore negli appuntamenti.

---

## Riepilogo file utili

- Tabella **`notifications`** – già in uso in Supabase.
- Tabella **`push_tokens`** – già in Supabase (script storico non più nel repo).
- **`docs/PUSH_FCM_EDGE_FUNCTION.md`** – guida e codice di esempio per l’Edge Function che invia la push FCM quando viene inserita una riga in `notifications`.
