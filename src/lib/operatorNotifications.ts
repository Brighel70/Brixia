import { supabase } from '@/lib/supabaseClient'

/**
 * Trova l'user_id (auth) dell'operatore dal suo nome (full_name).
 * Cerca in profiles collegati a people via person_id, oppure per full_name in profiles.
 */
export async function getUserIdByOperatorName(operatorName: string): Promise<string | null> {
  if (!operatorName?.trim()) return null
  const name = operatorName.trim()

  // 1) Profilo collegato a people: profiles.person_id -> people.id dove people.full_name = name
  const { data: byPerson } = await supabase
    .from('people')
    .select('id')
    .ilike('full_name', name)
    .limit(1)
    .maybeSingle()

  if (byPerson?.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('person_id', byPerson.id)
      .limit(1)
      .maybeSingle()
    if (profile?.id) return profile.id
  }

  // 2) Fallback: profiles.full_name (se l'app usa full_name sul profilo)
  const { data: byName } = await supabase
    .from('profiles')
    .select('id')
    .ilike('full_name', name)
    .limit(1)
    .maybeSingle()

  return byName?.id ?? null
}

export type ActivityUpdatedPayload = {
  activity_id: string
  player_name?: string
  date: string
  time?: string | null
  activity_type?: string
}

/**
 * Invia una notifica a un singolo utente (per user_id) per variazione appuntamento.
 * forPlayer: true = messaggio per il giocatore ("Il tuo appuntamento..."), false = per operatore.
 */
export function formatDateIt(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split(/[-/]/)
  if (!d || !m || !y) return dateStr
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
}

export async function sendActivityUpdatedNotificationToUser(
  userId: string,
  payload: ActivityUpdatedPayload,
  options?: { forPlayer?: boolean }
): Promise<void> {
  try {
    const forPlayer = options?.forPlayer ?? false
    const title = forPlayer ? 'Appuntamento modificato' : 'Appuntamento riprogrammato'
    const timeStr = payload.time ? String(payload.time).slice(0, 5).replace(':', '.') : ''
    const dateFormatted = formatDateIt(payload.date)
    const body = forPlayer
      ? `Il tuo appuntamento è stato modificato: ${dateFormatted}${timeStr ? `, ore ${timeStr}` : ''}`
      : payload.player_name
        ? `L'appuntamento con ${payload.player_name}\nè stato riprogrammato per il giorno\n${dateFormatted}${timeStr ? `, ore ${timeStr}` : ''}\n\nBrixia Rugby`
        : `Appuntamento riprogrammato per il giorno ${dateFormatted}${timeStr ? `, ore ${timeStr}` : ''}\n\nBrixia Rugby`

    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      body,
      type: 'activity_updated',
      metadata: {
        activity_id: payload.activity_id,
        player_name: payload.player_name,
        date: payload.date,
        time: payload.time,
        activity_type: payload.activity_type
      }
    })

    if (error) {
      console.error('Errore inserimento notifica:', error)
    }
  } catch (e) {
    console.error('Errore sendActivityUpdatedNotificationToUser:', e)
  }
}

/**
 * Invia una notifica all'operatore sull'app mobile quando un suo appuntamento viene modificato.
 * L'app mobile può ascoltare la tabella `notifications` (Realtime o polling) per user_id = auth.uid().
 */
export async function notifyOperatorOnActivityUpdate(
  operatorName: string,
  payload: ActivityUpdatedPayload
): Promise<void> {
  try {
    const userId = await getUserIdByOperatorName(operatorName)
    if (!userId) {
      console.warn('Operator notification: nessun user_id trovato per operatore', operatorName)
      return
    }
    await sendActivityUpdatedNotificationToUser(userId, payload, { forPlayer: false })
  } catch (e) {
    console.error('Errore notifyOperatorOnActivityUpdate:', e)
  }
}

/**
 * Verifica se l'attività ha data (e opzionalmente orario) nel futuro.
 */
export function isActivityInTheFuture(activityData: {
  ricontrollo?: string | null
  activity_date?: string | null
  ricontrollo_time?: string | null
}): boolean {
  const dateStr = activityData.ricontrollo || activityData.activity_date
  if (!dateStr) return false
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  if (date < today) return false
  if (date.getTime() === today.getTime() && activityData.ricontrollo_time) {
    const [h, m] = String(activityData.ricontrollo_time).slice(0, 5).split(':').map(Number)
    const appTime = new Date(today)
    appTime.setHours(h, m, 0, 0)
    return appTime > new Date()
  }
  return true
}
