# Come ottenere il file “Account di servizio” per le push (senza Server key)

Se in Firebase **non vedi la Server key** (o la pagina Google Cloud dà errore), puoi usare il **Account di servizio** (Service Account). **Non serve** andare su “Cloud Messaging” né su “Certificati web push” per questo.

---

## 1) Dove trovare l’Account di servizio in Firebase

1. Vai su **https://console.firebase.google.com**
2. Apri il progetto **AppBrixia**
3. Clicca sull’**ingranaggio** ⚙️ accanto a “Panoramica del…” → **Impostazioni del progetto**
4. In alto nella finestra clicca sulla scheda **“Account di servizio”** (o **“Service accounts”**)

---

## 2) Generare la chiave (file JSON)

1. Nella pagina **Account di servizio** vedi una tabella con una riga (es. “Firebase Admin SDK” o simile)
2. A destra c’è un pulsante **“Genera nuova chiave privata”** (o **“Generate new private key”**)
3. Clicca **“Genera nuova chiave privata”**
4. Si apre un messaggio tipo “Questa chiave permette di… Vuoi procedere?” → clicca **“Genera chiave”** (o **“Generate key”**)
5. Si **scarica un file JSON** sul computer (nome tipo `appbrixia-xxxxx-firebase-adminsdk-xxxxx.json`)

**Non condividere questo file**: contiene una chiave segreta. Lo userai solo per copiare il contenuto in Supabase (vedi sotto).

---

## 3) Cosa fare con il file in Supabase

1. Apri il file JSON scaricato con **Blocco note** (o un editor di testo)
2. Seleziona **tutto** il contenuto (Ctrl+A) e **copia** (Ctrl+C)
3. Vai su **Supabase** → **Edge Functions** → **Secrets**
4. Clicca **“Add new secret”**
5. **Name:** scrivi esattamente `FCM_SERVICE_ACCOUNT_JSON`
6. **Value:** incolla **tutto** il contenuto del file JSON (dalla prima `{` all’ultima `}`)
7. Salva

La nostra Edge Function userà questo invece della Server key: **non ti serve** la Server key né la pagina “Cloud Messaging” che dà errore.

---

## 4) Cosa NON usare

- **“Certificati web push”** e il pulsante **“Generate key pair”** in Firebase servono per le notifiche **nel browser** (siti web), **non** per l’app mobile. Puoi ignorarli.
- La **Server key** (API legacy) su progetti nuovi spesso non c’è più o la pagina per abilitarla dà errore: per questo usiamo l’Account di servizio (metodo consigliato da Google).

---

## Riepilogo

| Cosa fare | Dove |
|-----------|------|
| Aprire Impostazioni progetto | Firebase → ⚙️ → Impostazioni del progetto |
| Andare su Account di servizio | Scheda **Account di servizio** / Service accounts |
| Scaricare il JSON | Pulsante **Genera nuova chiave privata** |
| Mettere il JSON in Supabase | Edge Functions → Secrets → nome `FCM_SERVICE_ACCOUNT_JSON`, value = tutto il contenuto del file |

Dopo aver salvato il segreto in Supabase, **ridistribuisci** la Edge Function `send-fcm-push` (deploy) se non l’hai già fatto. Le push continueranno a funzionare usando l’API v1.
