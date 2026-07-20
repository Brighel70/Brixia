/**
 * API Corrispondenza — TeamFlow
 * (tabelle nuove: finché non si rigenerano i tipi Supabase usiamo cast mirati)
 */

import { supabase } from '@/lib/supabaseClient'
import { formatDisplayPersonName } from '@/lib/formatPersonName'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type CorrThread = {
  id: string
  title: string
  to_society: boolean
  created_by_person_id: string | null
  created_at: string
  last_message_at: string
}

export type CorrMessage = {
  id: string
  thread_id: string
  sender_person_id: string | null
  from_society: boolean
  body: string
  created_at: string
  sender_name?: string
}

/** Riga inbox home: una conversazione (thread), non ogni singolo messaggio. */
export type CorrInboxItem = {
  /** Ultimo messaggio utente del thread (per anteprima). */
  messageId: string
  threadId: string
  title: string
  body: string
  /** Data/ora ultimo messaggio in arrivo (per ordinamento). */
  createdAt: string
  senderPersonId: string | null
  senderName: string
  /** true = non ancora aperto in home (sfondo verde). */
  unread: boolean
}

/** Thread dove la persona è partecipante, oppure thread società (staff HQ). */
export async function listThreadsForPerson(personId: string): Promise<CorrThread[]> {
  const { data: parts, error: pErr } = await db
    .from('correspondence_participants')
    .select('thread_id')
    .eq('person_id', personId)

  if (pErr) throw pErr
  const ids = (parts || []).map((p: { thread_id: string }) => p.thread_id)
  if (ids.length === 0) return []

  const { data, error } = await db
    .from('correspondence_threads')
    .select('id, title, to_society, created_by_person_id, created_at, last_message_at')
    .in('id', ids)
    .order('last_message_at', { ascending: false })

  if (error) throw error
  return (data || []) as CorrThread[]
}

/**
 * Inbox home: una riga per conversazione (thread).
 * Ordinata dal più recente in alto. Verde (unread) se non aperta dopo l'ultimo msg.
 */
export async function listInboxMessagesForDashboard(limit = 80): Promise<CorrInboxItem[]> {
  const { data: hiddenRows } = await db.from('correspondence_home_hidden').select('message_id')
  const hiddenIds = new Set(
    ((hiddenRows || []) as Array<{ message_id: string }>).map((r) => r.message_id)
  )

  const { data: openedRows } = await db.from('correspondence_home_opened').select('thread_id, opened_at')
  const openedAtByThread = new Map<string, string>()
  for (const r of (openedRows || []) as Array<{ thread_id: string; opened_at: string }>) {
    openedAtByThread.set(r.thread_id, r.opened_at)
  }

  const { data, error } = await db
    .from('correspondence_messages')
    .select(
      `
      id,
      thread_id,
      sender_person_id,
      from_society,
      body,
      created_at,
      correspondence_threads!inner ( id, title )
    `
    )
    .eq('from_society', false)
    .order('created_at', { ascending: false })
    .limit(400)

  if (error) throw error

  const allRows = ([...(data || [])] as Array<{
    id: string
    thread_id: string
    sender_person_id: string | null
    body: string
    created_at: string
    correspondence_threads: { id: string; title: string } | { id: string; title: string }[] | null
  }>).filter((r) => !hiddenIds.has(r.id))

  // Una sola riga per thread = ultimo messaggio in arrivo (già ordinati DESC)
  const latestByThread = new Map<string, (typeof allRows)[0]>()
  for (const r of allRows) {
    if (!latestByThread.has(r.thread_id)) {
      latestByThread.set(r.thread_id, r)
    }
  }

  const rows = [...latestByThread.values()]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)

  const personIds = [
    ...new Set(rows.map((r) => r.sender_person_id).filter((id): id is string => Boolean(id))),
  ]

  const nameMap: Record<string, string> = {}
  if (personIds.length > 0) {
    const { data: people } = await supabase
      .from('people')
      .select('id, full_name, given_name, family_name')
      .in('id', personIds)
    for (const p of people || []) {
      nameMap[p.id] =
        formatDisplayPersonName(
          p.full_name ||
            `${p.given_name || ''} ${p.family_name || ''}`.trim() ||
            'Utente'
        )
    }
  }

  const missingThreadIds = [
    ...new Set(rows.filter((r) => !r.sender_person_id).map((r) => r.thread_id)),
  ]
  const threadPersonMap: Record<string, string> = {}
  if (missingThreadIds.length > 0) {
    const { data: parts } = await db
      .from('correspondence_participants')
      .select('thread_id, person_id')
      .in('thread_id', missingThreadIds)
    const extraIds = [...new Set((parts || []).map((p: { person_id: string }) => p.person_id))]
    if (extraIds.length > 0) {
      const { data: people } = await supabase
        .from('people')
        .select('id, full_name, given_name, family_name')
        .in('id', extraIds)
      for (const p of people || []) {
        nameMap[p.id] = formatDisplayPersonName(
          p.full_name ||
            `${p.given_name || ''} ${p.family_name || ''}`.trim() ||
            'Utente'
        )
      }
    }
    for (const p of parts || []) {
      if (!threadPersonMap[p.thread_id]) threadPersonMap[p.thread_id] = p.person_id
    }
  }

  return rows.map((r) => {
    const thread = Array.isArray(r.correspondence_threads)
      ? r.correspondence_threads[0]
      : r.correspondence_threads
    const senderPersonId = r.sender_person_id || threadPersonMap[r.thread_id] || null
    const openedAt = openedAtByThread.get(r.thread_id)
    const unread = !openedAt || new Date(r.created_at).getTime() > new Date(openedAt).getTime()
    return {
      messageId: r.id,
      threadId: r.thread_id,
      title: thread?.title || 'Messaggio',
      body: r.body,
      createdAt: r.created_at,
      senderPersonId,
      senderName: senderPersonId ? nameMap[senderPersonId] || 'Utente' : 'Utente',
      unread,
    }
  })
}

/** Segna conversazione come aperta/letta nella card home. */
export async function markHomeInboxThreadOpened(params: {
  threadId: string
  authUserId: string
}): Promise<void> {
  const { error } = await db.from('correspondence_home_opened').upsert(
    {
      thread_id: params.threadId,
      opened_at: new Date().toISOString(),
      opened_by: params.authUserId,
    },
    { onConflict: 'thread_id' }
  )
  if (error) throw error
}

/** Nasconde un messaggio dalla card home (resta in anagrafica). */
export async function hideInboxMessageFromHome(params: {
  messageId: string
  authUserId: string
  reason?: 'dismissed' | 'replied'
}): Promise<void> {
  const { error } = await db.from('correspondence_home_hidden').upsert(
    {
      message_id: params.messageId,
      hidden_by: params.authUserId,
      hidden_at: new Date().toISOString(),
      reason: params.reason || 'dismissed',
    },
    { onConflict: 'message_id' }
  )
  if (error) throw error
}

/** Nasconde dalla home tutti i messaggi utente di un thread (es. dopo risposta). */
export async function hideThreadInboxFromHome(params: {
  threadId: string
  authUserId: string
  reason?: 'dismissed' | 'replied'
}): Promise<void> {
  const { data, error } = await db
    .from('correspondence_messages')
    .select('id')
    .eq('thread_id', params.threadId)
    .eq('from_society', false)

  if (error) throw error
  const ids = ((data || []) as Array<{ id: string }>).map((r) => r.id)
  if (ids.length === 0) return

  const rows = ids.map((message_id) => ({
    message_id,
    hidden_by: params.authUserId,
    hidden_at: new Date().toISOString(),
    reason: params.reason || 'replied',
  }))

  const { error: upErr } = await db
    .from('correspondence_home_hidden')
    .upsert(rows, { onConflict: 'message_id' })
  if (upErr) throw upErr
}

export async function listMessages(threadId: string): Promise<CorrMessage[]> {
  const { data, error } = await db
    .from('correspondence_messages')
    .select('id, thread_id, sender_person_id, from_society, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) throw error
  const msgs = (data || []) as CorrMessage[]
  const personIds = [...new Set(msgs.map((m) => m.sender_person_id).filter(Boolean))] as string[]
  if (personIds.length === 0) {
    return msgs.map((m) => ({
      ...m,
      sender_name: m.from_society ? 'Società' : 'Utente',
    }))
  }

  const { data: people } = await supabase
    .from('people')
    .select('id, full_name, given_name, family_name')
    .in('id', personIds)

  const nameMap: Record<string, string> = {}
  for (const p of people || []) {
    nameMap[p.id] = formatDisplayPersonName(
      p.full_name ||
        `${p.given_name || ''} ${p.family_name || ''}`.trim() ||
        'Utente'
    )
  }

  return msgs.map((m) => ({
    ...m,
    sender_name: m.from_society
      ? 'Società'
      : m.sender_person_id
        ? nameMap[m.sender_person_id] || 'Utente'
        : 'Società',
  }))
}

export async function createThreadFromTeamflow(params: {
  title: string
  targetPersonId: string
  body: string
  senderPersonId?: string | null
  authUserId: string
}): Promise<{ threadId: string }> {
  const title = params.title.trim()
  const body = params.body.trim()
  if (!title || !body) throw new Error('Titolo e messaggio obbligatori')

  const { data: thread, error: tErr } = await db
    .from('correspondence_threads')
    .insert({
      title,
      created_by_person_id: params.senderPersonId || null,
      created_by_auth_id: params.authUserId,
      origin: 'teamflow',
      to_society: true,
    })
    .select('id')
    .single()

  if (tErr || !thread) throw tErr || new Error('Creazione thread fallita')

  const participantIds = new Set<string>([params.targetPersonId])
  if (params.senderPersonId) participantIds.add(params.senderPersonId)

  const { error: pErr } = await db.from('correspondence_participants').insert(
    [...participantIds].map((person_id) => ({
      thread_id: thread.id,
      person_id,
    }))
  )
  if (pErr) throw pErr

  const { error: mErr } = await db.from('correspondence_messages').insert({
    thread_id: thread.id,
    sender_person_id: params.senderPersonId || null,
    sender_auth_id: params.authUserId,
    from_society: true,
    body,
  })
  if (mErr) throw mErr

  await db
    .from('correspondence_threads')
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', thread.id)

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('person_id', params.targetPersonId)
      .maybeSingle()
    await supabase.from('notifications').insert({
      ...(profile?.id ? { user_id: profile.id } : {}),
      person_id: params.targetPersonId,
      title: `Nuovo messaggio: ${title}`,
      body: body.length > 120 ? body.slice(0, 117) + '…' : body,
      type: 'correspondence',
      metadata: { thread_id: thread.id },
    })
  } catch {
    /* ignore */
  }

  return { threadId: thread.id }
}

export async function replyAsSociety(params: {
  threadId: string
  body: string
  senderPersonId?: string | null
  authUserId: string
}): Promise<void> {
  const body = params.body.trim()
  if (!body) throw new Error('Messaggio vuoto')

  const { error } = await db.from('correspondence_messages').insert({
    thread_id: params.threadId,
    sender_person_id: params.senderPersonId || null,
    sender_auth_id: params.authUserId,
    from_society: true,
    body,
  })
  if (error) throw error

  await db
    .from('correspondence_threads')
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', params.threadId)

  // Dopo risposta società → sparisce dalla card Messaggi in home
  try {
    await hideThreadInboxFromHome({
      threadId: params.threadId,
      authUserId: params.authUserId,
      reason: 'replied',
    })
  } catch (e) {
    console.warn('hideThreadInboxFromHome:', e)
  }
}
