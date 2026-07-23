/**
 * Allinea password Auth al codice invito (FlowMe / TeamFlow).
 *
 * Usa la RPC SQL `sync_flowme_auth_password` (già in DB + trigger su people).
 * L'Edge Function `sync-invite-password` non è ancora deployata sul progetto:
 * richiamarla da browser produce 404/CORS. Se in futuro verrà deployata,
 * si può ripristinare come percorso primario (Admin API).
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

  // Nota: `door` è gestita lato SQL (accetta codice FlowMe o TeamFlow).
  void params.door

  const { error: rpcErr } = await supabase.rpc('sync_flowme_auth_password', {
    p_email: email,
    p_code: code,
  })
  if (!rpcErr) return { ok: true }
  console.warn('sync_flowme_auth_password rpc:', rpcErr.message)
  return { ok: false, error: rpcErr.message }
}
