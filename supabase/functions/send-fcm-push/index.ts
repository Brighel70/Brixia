// Edge Function: invia push FCM quando viene inserita una notifica.
// Attivata dal Database Webhook su INSERT in public.notifications.
// Supporta: 1) FCM_SERVER_KEY (API legacy)  2) FCM_SERVICE_ACCOUNT_JSON (API v1, consigliato)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

const FCM_LEGACY_URL = 'https://fcm.googleapis.com/fcm/send'
const FCM_V1_URL = 'https://fcm.googleapis.com/v1/projects'

type ServiceAccount = { client_email: string; private_key: string; project_id: string }

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const jwt = await new jose.SignJWT({})
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(await jose.importPKCS8(sa.private_key, 'RS256'))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OAuth2 token failed: ${res.status} ${t}`)
  }
  const data = await res.json()
  return data.access_token
}

async function sendFcmLegacy(serverKey: string, token: string, title: string, body: string, data: Record<string, string>) {
  const res = await fetch(FCM_LEGACY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${serverKey}`,
    },
    body: JSON.stringify({
      to: token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    }),
  })
  return res
}

async function sendFcmV1(projectId: string, accessToken: string, token: string, title: string, body: string, data: Record<string, string>) {
  const res = await fetch(`${FCM_V1_URL}/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      },
    }),
  })
  return res
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload?.record ?? payload
    const { user_id, title, body } = record

    if (!user_id || !title) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing user_id or title' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const dataPayload = { type: record.type ?? 'activity_updated', ...(record.metadata ?? {}) }
    const dataStrings = Object.fromEntries(Object.entries(dataPayload).map(([k, v]) => [k, String(v ?? '')]))

    // Opzione 1: API v1 con Service Account JSON (consigliato, niente Server key)
    const serviceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
    if (serviceAccountJson?.trim()) {
      let sa: ServiceAccount
      try {
        sa = JSON.parse(serviceAccountJson) as ServiceAccount
        if (!sa.client_email || !sa.private_key || !sa.project_id) throw new Error('Missing client_email, private_key or project_id')
      } catch (e) {
        console.error('Invalid FCM_SERVICE_ACCOUNT_JSON:', e)
        return new Response(JSON.stringify({ ok: false, error: 'Invalid FCM_SERVICE_ACCOUNT_JSON' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const accessToken = await getAccessToken(sa)
      const results = await Promise.all(
        tokens.map(({ token: fcmToken }) => sendFcmV1(sa.project_id, accessToken, fcmToken, title, body ?? '', dataStrings))
      )
      const ok = results.every((r) => r.ok)
      return new Response(JSON.stringify({ ok, sent: tokens.length, method: 'v1' }), {
        status: ok ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Opzione 2: API legacy con Server key
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY')
    if (!fcmServerKey) {
      console.error('Set FCM_SERVER_KEY or FCM_SERVICE_ACCOUNT_JSON in Edge Function secrets')
      return new Response(JSON.stringify({ ok: false, error: 'FCM not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const results = await Promise.all(
      tokens.map(({ token: fcmToken }) => sendFcmLegacy(fcmServerKey, fcmToken, title, body ?? '', dataStrings))
    )
    const ok = results.every((r) => r.ok)
    return new Response(JSON.stringify({ ok, sent: tokens.length, method: 'legacy' }), {
      status: ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
