import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { useNavigate } from 'react-router-dom'
import { useEmailConfirmation } from '@/hooks/useEmailConfirmation'
import { supabase } from '@/lib/supabaseClient'

interface AuthLayoutProps {
  children: React.ReactNode
  requireAuth?: boolean
}

const REMINDER_CHECK_INTERVAL_MS = 30 * 1000
const INJURY_STORAGE_KEY = 'injury_reminder_notified'
const MEMO_STORAGE_KEY = 'memo_reminder_notified'

type InjuryReminderPopup = {
  kind: 'injury'
  id: string
  content: string
  reminder_at: string
  injury_id: string
  playerName: string
}

type MemoReminderPopup = {
  kind: 'memo'
  id: string
  content: string
  due_date: string
  due_time: string | null
}

type ReminderPopup = InjuryReminderPopup | MemoReminderPopup

const getMemoDueDateTime = (dueDate: string, dueTime: string | null) => {
  const time = (dueTime || '09:00').substring(0, 5)
  return new Date(`${dueDate}T${time}:00`)
}

const getMemoReminderKey = (dueDate: string, dueTime: string | null) => {
  const time = (dueTime || '09:00').substring(0, 5)
  return `${dueDate}|${time}`
}

export default function AuthLayout({ children, requireAuth = false }: AuthLayoutProps) {
  const { userId, profile, initializeAuth } = useAuth()
  const authDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true'
  const [isInitialized, setIsInitialized] = useState(false)
  const navigate = useNavigate()
  const [reminderPopup, setReminderPopup] = useState<ReminderPopup | null>(null)
  const [reminderReschedule, setReminderReschedule] = useState({ date: '', time: '' })
  const [reminderShowReschedule, setReminderShowReschedule] = useState(false)
  const [reminderSaving, setReminderSaving] = useState(false)

  const getNotified = (storageKey: string): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}')
    } catch { return {} }
  }
  const setNotified = (storageKey: string, id: string, value: string) => {
    const o = getNotified(storageKey)
    o[id] = value
    try { localStorage.setItem(storageKey, JSON.stringify(o)) } catch {}
  }
  const clearNotified = (storageKey: string, id: string) => {
    const o = getNotified(storageKey)
    delete o[id]
    try { localStorage.setItem(storageKey, JSON.stringify(o)) } catch {}
  }

  // Promemoria infortuni e memo personali: popup in-app ogni 30 s
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    const checkDueReminders = async () => {
      if (reminderPopup) return
      const now = Date.now()
      const nowIso = new Date().toISOString()
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data: injuryList } = await supabase
        .from('injury_reminders')
        .select('id, content, reminder_at, injury_id, injuries(people(full_name))')
        .not('reminder_at', 'is', null)
        .lte('reminder_at', nowIso)
        .gte('reminder_at', from)

      const injuryNotified = getNotified(INJURY_STORAGE_KEY)
      const injuryRow = (injuryList || []).find((r: { id: string; reminder_at: string }) => injuryNotified[r.id] !== r.reminder_at)
      if (injuryRow) {
        const playerName = (injuryRow.injuries as { people?: { full_name?: string } } | null)?.people?.full_name ?? 'Atleta'
        setNotified(INJURY_STORAGE_KEY, injuryRow.id, injuryRow.reminder_at)
        setReminderPopup({
          kind: 'injury',
          id: injuryRow.id,
          content: injuryRow.content,
          reminder_at: injuryRow.reminder_at,
          injury_id: injuryRow.injury_id,
          playerName: String(playerName || 'Atleta').trim() || 'Atleta',
        })
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification('Promemoria infortunio', { body: injuryRow.content, icon: '/favicon.svg' })
          } catch {}
        }
        return
      }

      const { data: memoList } = await supabase
        .from('user_memos')
        .select('id, content, due_date, due_time')
        .eq('user_id', userId)
        .eq('type', 'reminder')
        .eq('completed', false)
        .not('due_date', 'is', null)

      const memoNotified = getNotified(MEMO_STORAGE_KEY)
      const memoRow = (memoList || []).find((m: { id: string; due_date: string; due_time: string | null }) => {
        const reminderKey = getMemoReminderKey(m.due_date, m.due_time)
        if (memoNotified[m.id] === reminderKey) return false
        const dueMs = getMemoDueDateTime(m.due_date, m.due_time).getTime()
        return dueMs <= now
      })

      if (!memoRow) return

      const reminderKey = getMemoReminderKey(memoRow.due_date, memoRow.due_time)
      setNotified(MEMO_STORAGE_KEY, memoRow.id, reminderKey)
      setReminderPopup({
        kind: 'memo',
        id: memoRow.id,
        content: memoRow.content,
        due_date: memoRow.due_date,
        due_time: memoRow.due_time,
      })
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('Promemoria memo', { body: memoRow.content, icon: '/favicon.svg' })
        } catch {}
      }
    }
    checkDueReminders()
    const t = setInterval(checkDueReminders, REMINDER_CHECK_INTERVAL_MS)
    return () => clearInterval(t)
  }, [userId, reminderPopup])

  const handleReminderDone = async () => {
    if (!reminderPopup) return
    setReminderSaving(true)
    try {
      if (reminderPopup.kind === 'injury') {
        await supabase.from('injury_reminders').delete().eq('id', reminderPopup.id)
        clearNotified(INJURY_STORAGE_KEY, reminderPopup.id)
      } else {
        await supabase
          .from('user_memos')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminderPopup.id)
        clearNotified(MEMO_STORAGE_KEY, reminderPopup.id)
      }
      setReminderPopup(null)
      setReminderShowReschedule(false)
    } catch (e) {
      console.error(e)
    } finally {
      setReminderSaving(false)
    }
  }

  const handleReminderReschedule = async () => {
    if (!reminderPopup) return
    const { date, time } = reminderReschedule
    if (!date.trim() || !time.trim()) return
    setReminderSaving(true)
    try {
      if (reminderPopup.kind === 'injury') {
        const reminderAt = new Date(`${date}T${time}`).toISOString()
        await supabase.from('injury_reminders').update({ reminder_at: reminderAt, updated_at: new Date().toISOString() }).eq('id', reminderPopup.id)
        clearNotified(INJURY_STORAGE_KEY, reminderPopup.id)
      } else {
        await supabase
          .from('user_memos')
          .update({
            due_date: date,
            due_time: time,
            completed: false,
            completed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminderPopup.id)
        clearNotified(MEMO_STORAGE_KEY, reminderPopup.id)
      }
      setReminderPopup(null)
      setReminderReschedule({ date: '', time: '' })
      setReminderShowReschedule(false)
    } catch (e) {
      console.error(e)
    } finally {
      setReminderSaving(false)
    }
  }

  const openRescheduleForm = () => {
    if (!reminderPopup) return
    if (reminderPopup.kind === 'injury') {
      const d = new Date(reminderPopup.reminder_at)
      setReminderReschedule({
        date: d.toISOString().slice(0, 10),
        time: d.toTimeString().slice(0, 5),
      })
    } else {
      setReminderReschedule({
        date: reminderPopup.due_date,
        time: (reminderPopup.due_time || '09:00').substring(0, 5),
      })
    }
    setReminderShowReschedule(true)
  }

  // Gestisce automaticamente la conferma email e creazione profilo
  useEmailConfirmation()

  // Inizializza l'autenticazione una sola volta
  useEffect(() => {
    const init = async () => {
      if (authDisabled) {
        setIsInitialized(true)
        return
      }
      await initializeAuth()
      setIsInitialized(true)
    }
    init()
  }, [initializeAuth, authDisabled])

  // Se richiede autenticazione e non è loggato, redirect al login
  useEffect(() => {
    if (isInitialized && !authDisabled && requireAuth && !userId) {
      navigate('/')
    }
  }, [isInitialized, authDisabled, requireAuth, userId, navigate])

  // Se è loggato e sta nella pagina login, redirect alla Home
  useEffect(() => {
    if (isInitialized && !authDisabled && userId && window.location.pathname === '/') {
      navigate('/home')
    }
  }, [isInitialized, authDisabled, userId, navigate])

  // Mostra loading durante l'inizializzazione
  if (!isInitialized || (!authDisabled && requireAuth && !userId)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento...</div>
      </div>
    )
  }

  return (
    <>
      {children}

      {/* Popup promemoria globali: infortunio o memo personale */}
      {reminderPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" aria-modal="true" role="dialog">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200/80" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Promemoria</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {reminderPopup.kind === 'injury'
                      ? `Infortunio: ${reminderPopup.playerName}`
                      : 'Memo personale'}
                  </p>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed mb-6">{reminderPopup.content}</p>

              {!reminderShowReschedule ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleReminderDone}
                    disabled={reminderSaving}
                    className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                  >
                    {reminderSaving ? '...' : 'Ho fatto'}
                  </button>
                  <button
                    type="button"
                    onClick={openRescheduleForm}
                    disabled={reminderSaving}
                    className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                  >
                    Ritarda
                  </button>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="flex gap-2 flex-wrap">
                    <label className="flex-1 min-w-[120px]">
                      <span className="block text-xs font-medium text-gray-500 mb-1">Nuova data</span>
                      <input
                        type="date"
                        value={reminderReschedule.date}
                        onChange={e => setReminderReschedule(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex-1 min-w-[80px]">
                      <span className="block text-xs font-medium text-gray-500 mb-1">Ora</span>
                      <input
                        type="time"
                        value={reminderReschedule.time}
                        onChange={e => setReminderReschedule(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReminderShowReschedule(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleReminderReschedule}
                      disabled={reminderSaving || !reminderReschedule.date || !reminderReschedule.time}
                      className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                    >
                      {reminderSaving ? 'Salvataggio...' : 'Riprogramma'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
