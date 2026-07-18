# Push FCM da Supabase (app chiusa/background)

Per far arrivare le notifiche sul telefono **anche con app chiusa o in background**, serve inviare una **push reale** tramite Firebase Cloud Messaging (FCM). Qui trovi come farlo con una **Supabase Edge Function** attivata da un **Database Webhook** su INSERT in `notifications`.

## 1. Cosa serve

- Progetto **Firebase** con Cloud Messaging abilitato.
- **Server key** (o account di servizio) FCM – in Firebase Console → Project Settings → Cloud Messaging.
- Tabella **`push_tokens`** in Supabase (esegui `create_push_tokens_table.sql`).
- **App mobile** che registra il token FCM in `push_tokens` al login/avvio.

## 2. Database Webhook su Supabase

1. In **Supabase Dashboard** → **Database** → **Webhooks**.
2. Crea un nuovo webhook:
   - **Name**: es. `on_notification_insert`
   - **Table**: `public.notifications`
   - **Events**: **Insert**
   - **Type**: **Supabase Edge Function**
   - **Function**: `send-fcm-push` (nome della funzione che creerai sotto).

Così, ogni volta che viene inserita una riga in `notifications`, Supabase chiama l’Edge Function con il payload della riga inserita.

## 3. Edge Function `send-fcm-push`

Crea la funzione nella cartella del progetto Supabase (es. `supabase/functions/send-fcm-push/index.ts`).

### 3.1 Struttura

```
supabase/
  functions/
    send-fcm-push/
      index.ts
```

### 3.2 Codice di esempio (`index.ts`)

```ts
// supabase/functions/send-fcm-push/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FCM_URL = 'https://fcm.googleapis.com/fcm/send'

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload?.record ?? payload
    const { user_id, title, body } = record

    if (!user_id || !title) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing user_id or title' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id)

    if (tokensError || !tokens?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no tokens' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY')
    if (!fcmServerKey) {
      console.error('FCM_SERVER_KEY not set')
      return new Response(JSON.stringify({ ok: false, error: 'FCM not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const results = await Promise.all(
      tokens.map(({ token: fcmToken }) =>
        fetch(FCM_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`
          },
          body: JSON.stringify({
            to: fcmToken,
            notification: { title, body },
            data: { type: record.type ?? 'activity_updated', ...(record.metadata ?? {}) }
          })
        })
      )
    )

    const ok = results.every((r) => r.ok)
    return new Response(
      JSON.stringify({ ok, sent: tokens.length }),
      { status: ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

### 3.3 Variabile d’ambiente FCM

- In **Supabase Dashboard** → **Edge Functions** → **Secrets** (o **Project Settings** → **Edge Function**).
- Aggiungi il secret: **`FCM_SERVER_KEY`** = Server key di Firebase (Cloud Messaging).

### 3.4 Deploy

```bash
supabase functions deploy send-fcm-push
```

## 4. App mobile: salvare il token FCM

Dopo il login (o all’avvio se l’utente è già loggato):

1. Ottieni il token FCM (Firebase SDK o Expo `getExpoPushTokenAsync` / equivalente FCM).
2. Inserisci/aggiorna in Supabase:

```ts
await supabase.from('push_tokens').upsert(
  {
    user_id: session.user.id,
    token: fcmToken,
    platform: Platform.OS, // 'android' | 'ios'
    updated_at: new Date().toISOString()
  },
  { onConflict: 'user_id,token' }
)
```

La tabella `push_tokens` ha RLS: l’utente può inserire/aggiornare solo le proprie righe.

## 5. Flusso completo

1. Dalla **pagina Agenda** modifichi un appuntamento e scegli “Invia notifica” (solo operatore / solo giocatore / entrambi).
2. La web app inserisce una riga in **`notifications`** (user_id, title, body, type, metadata).
3. Il **Database Webhook** su INSERT chiama l’Edge Function **`send-fcm-push`**.
4. L’Edge Function legge i **token** da **`push_tokens`** per quel `user_id` e invia una richiesta a **FCM** per ogni token.
5. FCM recapita la push al dispositivo: la notifica arriva **anche con app chiusa o in background**.

## 6. Nota su FCM “Legacy” vs HTTP v1

L’esempio usa l’endpoint **legacy** `https://fcm.googleapis.com/fcm/send` con **Server key**. Firebase consiglia l’API **HTTP v1** con **account di servizio (OAuth2)**. Se vuoi usare la v1:

- Endpoint: `https://fcm.googleapis.com/v1/projects/<PROJECT_ID>/messages:send`
- Header: `Authorization: Bearer <access_token>` (token OAuth2 ottenuto con le credenziali del service account).
- Body: formato FCM v1 (documentazione Firebase).

Puoi ottenere l’access token in Deno con una libreria OAuth2 o chiamando Google auth; la logica di lettura da `push_tokens` e invio a FCM resta la stessa.
