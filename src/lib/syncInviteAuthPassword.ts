/**
 * Allinea password Auth al codice invito (FlowMe / TeamFlow).
 * 1) Edge Function Admin API (se deployata)
 * 2) RPC SQL sync_flowme_auth_password (trigger + login)
 */

import { supabase } from '@/lib/supabaseClient'

export async function syncInviteAuthPassword(params: {
  email: string
  code: string
  door?: 'flowme' | 'teamflow'
}): Promise<{ ok: boolean; error?: string }> {
  const email = params.email.trim().toLowerCase()
  const code = params.code.trim()
  if (!email || !code) return { ok: false, error: 'missing' }

  try {
    const { data, error } = await supabase.functions.invoke('sync-invite-password', {
      body: { email, code, door: params.door || 'flowme' },
    })
    if (!error && data?.ok) return { ok: true }
    if (error) console.warn('sync-invite-password function:', error.message, data)
    else if (data && !data.ok) console.warn('sync-invite-password:', data.error)
  } catch (e) {
    console.warn('sync-invite-password invoke failed:', e)
  }

  const { error: rpcErr } = await supabase.rpc('sync_flowme_auth_password', {
    p_email: email,
    p_code: code,
  })
  if (!rpcErr) return { ok: true }
  console.warn('sync_flowme_auth_password rpc:', rpcErr.message)
  return { ok: false, error: rpcErr.message }
}
