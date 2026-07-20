// Edge Function: allinea password Auth al codice FlowMe/TeamFlow (Admin API).
// Chiamata da login FlowMe e da salvataggio anagrafica TeamFlow.
// Body: { email, code, door?: 'flowme' | 'teamflow' }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const code = String(body?.code || '').trim()
    const door = body?.door === 'teamflow' ? 'teamflow' : 'flowme'

    if (!email || !code) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_email_or_code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: people, error: peopleErr } = await supabase
      .from('people')
      .select('id, email, invite_code, invite_code_teamflow, full_name, given_name, family_name, status')
      .ilike('email', email)
      .eq('status', 'active')

    if (peopleErr) throw peopleErr

    const person = (people || []).find((p) => {
      if (door === 'teamflow') {
        return p.invite_code_teamflow != null && String(p.invite_code_teamflow).trim() === code
      }
      return p.invite_code != null && String(p.invite_code).trim() === code
    })

    if (!person) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fullName =
      person.full_name ||
      `${person.given_name || ''} ${person.family_name || ''}`.trim() ||
      email

    // Cerca utente Auth via profiles o create
    let authUserId: string | null = null
    const { data: profileByPerson } = await supabase
      .from('profiles')
      .select('id')
      .eq('person_id', person.id)
      .maybeSingle()

    if (profileByPerson?.id) {
      authUserId = profileByPerson.id
    } else {
      const { data: profileByEmail } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle()
      authUserId = profileByEmail?.id || null
    }

    if (authUserId) {
      const { error: updErr } = await supabase.auth.admin.updateUserById(authUserId, {
        password: code,
        email_confirm: true,
      })
      if (updErr) throw updErr
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: code,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (createErr) {
        // Utente Auth esiste ma senza profile: prova list + update
        const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        })
        if (listErr) throw createErr
        const found = listed.users?.find((u) => (u.email || '').toLowerCase() === email)
        if (!found) throw createErr
        authUserId = found.id
        const { error: updErr } = await supabase.auth.admin.updateUserById(authUserId, {
          password: code,
          email_confirm: true,
        })
        if (updErr) throw updErr
      } else {
        authUserId = created.user?.id || null
      }
    }

    if (!authUserId) {
      return new Response(JSON.stringify({ ok: false, error: 'no_auth_user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('profiles').upsert(
      {
        id: authUserId,
        email,
        full_name: fullName,
        role: 'Famiglia',
        person_id: person.id,
      },
      { onConflict: 'id' }
    )

    return new Response(JSON.stringify({ ok: true, user_id: authUserId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('sync-invite-password:', message)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
