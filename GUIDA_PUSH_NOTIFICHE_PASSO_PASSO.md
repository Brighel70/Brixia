# Guida passo-passo: notifiche push sul telefono (anche con app chiusa)

Questa guida ti accompagna **clicco per clicco**. Non serve essere programmatori: basta seguire i numeri.  
Se un passaggio non ti è chiaro, puoi chiedere a qualcuno che usa il computer (o uno sviluppatore) di farlo per te.

---

## Cosa è già stato fatto per te (nel progetto)

- **Tabella `push_tokens`**: già presente in Supabase (lo script storico non è più nel repo).
- **Edge Function** che invia la push: il codice è già nel progetto in `supabase/functions/send-fcm-push/index.ts`.

Tu (o qualcuno per te) deve solo: **Firebase**, **Supabase Dashboard** e **app mobile** come sotto.

---

## PARTE 1 – Firebase (ottenere la “chiave” per le push)

Hai **due modi**; usa quello che riesci a fare.

### Metodo A – Account di servizio (consigliato, niente Server key)

Se la pagina **Cloud Messaging** non ti mostra la Server key, o se in **Google Cloud** la pagina delle API dà **errore** (“Impossibile caricare”), usa questo metodo. **Non** serve andare su Cloud Messaging né su “Certificati web push”.

1. Apri **https://console.firebase.google.com** e seleziona il progetto **AppBrixia**.
2. Clicca sull’**ingranaggio** ⚙️ → **Impostazioni del progetto**.
3. In alto nella finestra clicca sulla scheda **“Account di servizio”** (o **“Service accounts”**).
4. Clicca **“Genera nuova chiave privata”** (o **“Generate new private key”**) → conferma. Si scarica un **file JSON**.
5. Apri quel file con il Blocco note, **copia tutto** il contenuto (dalla prima `{` all’ultima `}`).
6. In **Supabase** → **Edge Functions** → **Secrets** → aggiungi un segreto:
   - **Name:** `FCM_SERVICE_ACCOUNT_JSON`
   - **Value:** incolla tutto il contenuto del file JSON.
7. Salva. La nostra Edge Function userà questo; **non** ti serve la Server key.

Guida dettagliata: **`FIREBASE_ACCOUNT_SERVIZIO_PUSH.md`**.

### Metodo B – Server key (API legacy)

Solo se in Firebase vedi ancora la **Server key**:

1. Firebase → ⚙️ → **Impostazioni del progetto** → scheda **Cloud Messaging**.
2. Nella sezione **API Cloud Messaging (legacy)** copia la **Chiave del server** (Server key).
3. In Supabase → Edge Functions → Secrets → aggiungi **Name:** `FCM_SERVER_KEY`, **Value:** la Server key.

---

## PARTE 2 – Supabase (tabella, segreto, webhook, funzione)

Tutti i passi sotto si fanno dalla **Dashboard di Supabase**: **https://supabase.com/dashboard** → scegli il **progetto** della tua app.

### 2.1 Verificare la tabella per i token push

1. Nel menu a sinistra clicca **Table Editor**.
2. Cerca la tabella **`push_tokens`**.
3. Se c’è già, passa al punto 2.2. Se non c’è, chiedi a un tecnico di ricrearla (lo script storico non è più nel repo).

### 2.2 Inserire la chiave FCM (segretto)

1. Nel menu a sinistra vai su **Edge Functions** (se non lo vedi, cerca “Project Settings” → “Edge Functions” o “Functions”).
2. Cerca la voce **Secrets** (o “Environment variables” / “Secrets” per le Edge Functions).
3. Clicca **Add new secret** (o simile).
4. **Se hai usato il Metodo A (Account di servizio):**
   - **Name:** `FCM_SERVICE_ACCOUNT_JSON`
   - **Value:** incolla **tutto** il contenuto del file JSON scaricato da Firebase (Parte 1, Metodo A).
5. **Se hai usato il Metodo B (Server key):**
   - **Name:** `FCM_SERVER_KEY`
   - **Value:** incolla la Server key copiata da Firebase (Parte 1, Metodo B).
6. Salva.

### 2.3 Caricare e attivare la funzione “send-fcm-push”

La funzione è già scritta in **`supabase/functions/send-fcm-push/index.ts`** nel tuo progetto. Per metterla online su Supabase hai **due possibilità**:

- **Opzione A – Hai installato Supabase sul computer (Supabase CLI)**  
  1. Apri il terminale (o Prompt dei comandi) nella **cartella del progetto** (dove si trova la cartella `supabase`).  
  2. Esegui: `supabase login` (se non sei già loggato).  
  3. Poi: `supabase link --project-ref TUO_PROJECT_REF` (il “Project ref” lo vedi in Supabase Dashboard → Project Settings → General).  
  4. Infine: `supabase functions deploy send-fcm-push`.  
  5. Quando richiesto, inserisci la **FCM_SERVER_KEY** se non l’hai già messa nei Secrets (vedi 2.2).

- **Opzione B – Non usi il terminale / non hai Supabase CLI**  
  - Puoi **incaricare uno sviluppatore** (o un tecnico) di fare il deploy con i comandi sopra.  
  - Oppure, se Supabase nella tua regione permette di caricare la funzione dalla Dashboard (es. “Deploy from GitHub” o “Upload”), segui le istruzioni che vedi lì usando la cartella `supabase/functions/send-fcm-push` del progetto.

Quando la funzione è online, passa al punto 2.4.

### 2.4 Creare il webhook che chiama la funzione

1. Nel menu a sinistra vai su **Database** → **Webhooks** (o “Database” e poi la scheda “Webhooks”).
2. Clicca **Create a new hook** (o “Add webhook”).
3. Compila così:
   - **Name**: `on_notification_insert` (o un nome a piacere).
   - **Table**: scegli **`notifications`** (schema `public`).
   - **Events**: seleziona solo **Insert**.
   - **Type**: scegli **Supabase Edge Function** (o “Call Edge Function”).
   - **Function**: scegli **`send-fcm-push`** (deve essere il nome della funzione che hai caricato al punto 2.3).
4. Salva il webhook.

Da questo momento: ogni volta che qualcuno inserisce una riga nella tabella `notifications`, Supabase chiama automaticamente la funzione `send-fcm-push`, che invia la push sul telefono (se l’app ha registrato il token – vedi Parte 3).

---

## PARTE 3 – App mobile (registrare il token FCM)

Questo passaggio **non si può fare solo da browser**: serve **modificare il codice dell’app mobile** (React Native, Expo, Flutter, ecc.).  
Se non sei uno sviluppatore, puoi:

1. **Dare questo documento** (o il file **`CODICE_APP_MOBILE_PUSH.md`**) a **chi sviluppa o manutiene l’app mobile** (tuo team, sviluppatore esterno, ecc.).
2. Chiedere di:
   - integrare Firebase / FCM (o Expo Push) nell’app, se non c’è già;
   - ottenere il **token FCM** del dispositivo dopo il login (o all’avvio se l’utente è già loggato);
   - salvare quel token nella tabella **`push_tokens`** di Supabase (user_id, token, platform), come descritto in `CODICE_APP_MOBILE_PUSH.md`.

Nel progetto trovi **`CODICE_APP_MOBILE_PUSH.md`** con il codice di esempio e le istruzioni per lo sviluppatore.

---

## Riepilogo

| Cosa | Dove | Chi può farlo |
|------|------|----------------|
| Server key FCM | Firebase Console | Tu (seguendo Parte 1) |
| Tabella `push_tokens` | Supabase → SQL Editor | Tu (Parte 2.1) |
| Segreto FCM_SERVER_KEY | Supabase → Edge Functions → Secrets | Tu (Parte 2.2) |
| Deploy funzione send-fcm-push | Supabase CLI o Dashboard | Tu (se usi CLI) o uno sviluppatore |
| Webhook su INSERT notifications | Supabase → Database → Webhooks | Tu (Parte 2.4) |
| Registrazione token FCM nell’app | Codice app mobile | Sviluppatore app (Parte 3) |

Quando tutto è fatto, modificando un appuntamento dalla **pagina Agenda** e scegliendo di inviare la notifica all’operatore (o al giocatore), la notifica arriverà sul telefono **anche con app chiusa o in background**.
