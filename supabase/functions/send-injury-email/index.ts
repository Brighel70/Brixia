// Edge Function: invia email con template e allegati (documenti infortunio) via Resend.
// Richiesta: { injuryId, recipientEmail, templateDestinatario?: 'assicurazione' | 'csen' | 'atleta' }
// Configurare RESEND_API_KEY e (opzionale) RESEND_FROM_EMAIL nei segreti Supabase.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY non configurato. Aggiungi il segreto in Supabase.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Brixia Rugby <onboarding@resend.dev>'

    const body = await req.json() as { injuryId?: string; recipientEmail?: string; templateDestinatario?: string }
    const { injuryId, recipientEmail, templateDestinatario = 'assicurazione' } = body
    if (!injuryId || !recipientEmail) {
      return new Response(JSON.stringify({ error: 'Mancano injuryId o recipientEmail' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Template per destinatario (primo in ordine)
    const { data: templates, error: tErr } = await supabase
      .from('injury_email_templates')
      .select('id, body')
      .eq('destinatario', templateDestinatario)
      .order('sort_order', { ascending: true })
      .limit(1)
    if (tErr || !templates?.length) {
      return new Response(JSON.stringify({ error: 'Nessun template trovato per il destinatario selezionato.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const template = templates[0]
    const emailBody = (template.body ?? '').trim() || '(Nessun testo nel template.)'

    // Tipi di documento associati al template
    const { data: linkRows } = await supabase
      .from('injury_email_template_document_types')
      .select('document_type_id')
      .eq('template_id', template.id)
    const typeIds = (linkRows || []).map((r: { document_type_id: string }) => r.document_type_id)
    let typeNames: string[] = []
    if (typeIds.length > 0) {
      const { data: types } = await supabase.from('injury_document_types').select('name').in('id', typeIds)
      typeNames = (types || []).map((t: { name: string }) => t.name)
    }

    // Documenti dell'infortunio per quel destinatario e tipo
    let docs: { name: string; file_path: string }[] = []
    if (typeNames.length > 0) {
      const { data: docRows } = await supabase
        .from('injury_documents')
        .select('name, file_path')
        .eq('injury_id', injuryId)
        .eq('category', templateDestinatario)
        .in('name', typeNames)
      docs = (docRows || []) as { name: string; file_path: string }[]
    }

    // Scarica file da Storage e costruisci allegati (base64)
    const attachments: { filename: string; content: string }[] = []
    for (const doc of docs) {
      const { data: blob, error: downErr } = await supabase.storage.from('injury-docs').download(doc.file_path)
      if (downErr || !blob) continue
      const buffer = await blob.arrayBuffer()
      const ext = doc.file_path.split('.').pop() || 'bin'
      const filename = `${doc.name.replace(/\s+/g, '_')}.${ext}`
      attachments.push({ filename, content: arrayBufferToBase64(buffer) })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: 'Apertura Sinistro',
        text: emailBody,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    })
    const resData = await res.json().catch(() => ({})) as { id?: string; message?: string }
    if (!res.ok) {
      const errMsg = resData?.message || res.statusText || 'Invio fallito'
      console.error('Resend API error:', res.status, resData)
      return new Response(JSON.stringify({ error: errMsg }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: resData.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('send-injury-email:', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
