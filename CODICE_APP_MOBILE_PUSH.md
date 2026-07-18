# Codice per l’app mobile: salvare il token FCM in Supabase

Questo file è pensato per **chi sviluppa l’app mobile** (React Native, Expo, ecc.).  
L’obiettivo: dopo il login (o all’avvio se l’utente è già loggato), ottenere il **token FCM** e salvarlo nella tabella **`push_tokens`** di Supabase, così le notifiche push arrivano anche con app chiusa o in background.

---

## 1. Cosa serve nell’app

- **Firebase / FCM** già configurato (o **Expo Notifications** che usa FCM).
- **Supabase client** già usato per il login (auth).
- Tabella **`push_tokens`** creata in Supabase (script `create_push_tokens_table.sql`).

---

## 2. Ottenere il token FCM

### Se usi Expo (React Native)

```ts
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

async function getExpoPushToken(): Promise<string | null> {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return null
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'TUO_EXPO_PROJECT_ID' // da app.json / app.config.js
  })
  return tokenData?.data ?? null
}
```

Per FCM “nativo” con Expo, puoi usare `expo-device` e il modulo Firebase per ottenere il token FCM; oppure usare direttamente il token Expo (Expo invia poi tramite FCM). Se usi **Expo Push Token**, salva quello in `push_tokens` e verifica se l’Edge Function deve usare l’API Expo Push invece di FCM (in quel caso serve adattare l’Edge Function per chiamare Expo Push API).

### Se usi React Native Firebase (@react-native-firebase/messaging)

```ts
import messaging from '@react-native-firebase/messaging'

async function getFCMToken(): Promise<string | null> {
  const authStatus = await messaging().requestPermission()
  if (authStatus !== messaging.AuthorizationStatus.AUTHORIZED &&
      authStatus !== messaging.AuthorizationStatus.PROVISIONAL) {
    return null
  }
  const token = await messaging().getToken()
  return token ?? null
}
```

---

## 3. Salvare il token in Supabase (tabella `push_tokens`)

Dopo il **login** (o all’**avvio** dell’app se l’utente è già autenticato), chiama una funzione come questa (adatta `getFCMToken` o `getExpoPushToken` a quello che usi):

```ts
import { supabase } from './supabaseClient' // o dove hai il client Supabase
import { Platform } from 'react-native'

export async function registerPushToken(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return

  const token = await getFCMToken() // oppure getExpoPushToken()
  if (!token) return

  const platform = Platform.OS // 'android' | 'ios'

  await supabase.from('push_tokens').upsert(
    {
      user_id: user.id,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' }
  )
}
```

- **Quando chiamarla**: subito dopo `supabase.auth.signIn(...)` (o dopo il controllo “se c’è già un utente loggato” all’avvio).
- La tabella `push_tokens` ha **RLS**: l’utente può inserire/aggiornare solo le proprie righe (`user_id = auth.uid()`), quindi l’upsert sopra è consentito.

---

## 4. Dove collegare il tutto nell’app

Esempio in uno screen di login (dopo login riuscito):

```ts
const handleLogin = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) { /* mostra errore */ return }
  await registerPushToken()
  // navigazione alla home, ecc.
}
```

E all’avvio dell’app (es. in `App.tsx` o nel root), se l’utente è già loggato:

```ts
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) registerPushToken()
  })
}, [])
```

---

## 5. Nota su Expo Push Token vs FCM

- Se nell’app usi **solo Expo Push Token** (non il token FCM nativo), la **Edge Function** attuale è scritta per **FCM** (endpoint `https://fcm.googleapis.com/fcm/send`).  
  In quel caso o:
  - **A)** nell’app usi Firebase e ottieni il **token FCM** e lo salvi in `push_tokens` (come sopra), oppure  
  - **B)** si modifica l’Edge Function per inviare push tramite **Expo Push API** (https://exp.host/--/api/v2/push/send) usando il token Expo.  
Se scegli B, lo sviluppatore può adattare `supabase/functions/send-fcm-push/index.ts` per leggere il token da `push_tokens` e chiamare l’API Expo invece di FCM.

---

## 6. Riepilogo per lo sviluppatore

1. Richiedere permesso notifiche e ottenere il token (FCM o Expo).
2. Dopo login (e all’avvio se già loggato) chiamare `registerPushToken()`.
3. Fare upsert su `push_tokens` con `user_id`, `token`, `platform`, `updated_at`.
4. Se usi solo Expo Push, valutare se adattare l’Edge Function a Expo Push API invece di FCM.
