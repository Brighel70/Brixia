// Edge Function: registra il token FCM dall'app mobile (FlowMe).
// L'app chiama questa funzione con person_id, token, platform dopo il login.
// Usa service role per inserire in push_tokens con user_id = profiles.id (auth.users.id).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-key',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const pushKey = req.headers.get('x-push-key')
    const expectedKey = Deno.env.get('PUSH_REGISTRATION_KEY')
    if (expectedKey && pushKey !== expectedKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { person_id, token, platform } = body ?? {}

    if (!person_id || !token) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing person_id or token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('person_id', person_id)
      .maybeSingle()

    if (profileError || !profile?.id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Profile not found for person_id' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const user_id = profile.id
    const updated_at = new Date().toISOString()

    const { error: upsertError } = await supabase
      .from('push_tokens')
      .upsert(
        { user_id, token, platform: platform ?? 'web', updated_at },
        { onConflict: 'user_id,token' }
      )

    if (upsertError) {
      console.error('push_tokens upsert error:', upsertError)
      return new Response(
        JSON.stringify({ ok: false, error: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, user_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error(e)
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
