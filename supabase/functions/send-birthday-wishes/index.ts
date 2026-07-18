// Edge Function: invia auguri di compleanno automatici nell'app mobile
// Da chiamare ogni giorno alle 10:00 (es. con cron-job.org o Vercel Cron)
// Header: Authorization: Bearer <CRON_SECRET> oppure ?secret=<CRON_SECRET>

const BIRTHDAY_MESSAGE = `🏉🎉 Ehi {NOME}! Oggi si festeggia forte! 🎂🥳

Tantissimi auguri da tutta la famiglia Brixia Rugby! 💙
Che il tuo compleanno sia pieno di sorrisi, energia ed entusiasmo,
e ricco di mete nella tua vita! 💪🔥

Goditi la giornata come dopo una grande vittoria 💥

Un abbraccio enorme,
Brixia Rugby 🏉💙`

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (cronSecret) {
      const authHeader = req.headers.get('Authorization')
      const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
      const urlSecret = new URL(req.url).searchParams.get('secret')
      if (bearer !== cronSecret && urlSecret !== cronSecret) {
        return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const today = new Date()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${today.getFullYear()}-${month}-${day}`

    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, full_name, given_name, family_name, date_of_birth')
      .not('date_of_birth', 'is', null)

    if (peopleError) {
      return new Response(JSON.stringify({ ok: false, error: peopleError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const birthdaysToday = (people || []).filter((p) => {
      if (!p.date_of_birth) return false
      const d = String(p.date_of_birth).slice(0, 10)
      const [y, m, d2] = d.split('-')
      return m === month && d2 === day
    })

    let sent = 0
    const errors: string[] = []

    for (const person of birthdaysToday) {
      const firstName = (person.given_name || '').trim() ||
        (person.full_name || '').trim().split(/\s+/)[0] ||
        person.full_name ||
        ''
      const message = BIRTHDAY_MESSAGE.replace(/\{NOME\}/g, firstName)

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('person_id', person.id)
        .limit(1)
        .maybeSingle()

      if (!profile?.id) continue

      const { error: insertError } = await supabase.from('notifications').insert({
        user_id: profile.id,
        title: 'Auguri di compleanno! 🎂',
        body: message,
        type: 'birthday_wishes',
        metadata: { person_id: person.id },
      })

      if (insertError) {
        errors.push(`${person.full_name}: ${insertError.message}`)
      } else {
        sent++
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        date: todayStr,
        total: birthdaysToday.length,
        sent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
