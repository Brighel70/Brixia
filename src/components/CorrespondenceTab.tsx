import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, Plus, Send, ArrowLeft } from 'lucide-react'
import { GOLEE } from '@/config/goleeTheme'
import { useAuth } from '@/store/auth'
import {
  createThreadFromTeamflow,
  listMessages,
  listThreadsForPerson,
  replyAsSociety,
  type CorrMessage,
  type CorrThread,
} from '@/lib/correspondence'

type Props = {
  personId: string | undefined
  personName: string
  /** Apre direttamente questo thread (es. da home Messaggi). */
  initialThreadId?: string | null
}

export default function CorrespondenceTab({ personId, personName, initialThreadId }: Props) {
  const { userId, profile } = useAuth()
  const [threads, setThreads] = useState<CorrThread[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<CorrMessage[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')

  const loadThreads = useCallback(async () => {
    if (!personId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listThreadsForPerson(personId)
      setThreads(data)
    } catch (e: any) {
      setError(e?.message || 'Errore caricamento corrispondenza')
      setThreads([])
    } finally {
      setLoading(false)
    }
  }, [personId])

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  const openThread = useCallback(async (id: string) => {
    setActiveThreadId(id)
    setShowNew(false)
    try {
      const msgs = await listMessages(id)
      setMessages(msgs)
    } catch (e: any) {
      setError(e?.message || 'Errore caricamento messaggi')
    }
  }, [])

  useEffect(() => {
    if (!initialThreadId || !personId) return
    void openThread(initialThreadId)
  }, [initialThreadId, personId, openThread])

  const handleCreate = async () => {
    if (!personId || !userId) return
    setSending(true)
    setError(null)
    try {
      const { threadId } = await createThreadFromTeamflow({
        title: newTitle,
        targetPersonId: personId,
        body: newBody,
        senderPersonId: profile?.person_id || null,
        authUserId: userId,
      })
      setNewTitle('')
      setNewBody('')
      setShowNew(false)
      await loadThreads()
      await openThread(threadId)
    } catch (e: any) {
      setError(e?.message || 'Invio fallito')
    } finally {
      setSending(false)
    }
  }

  const handleReply = async () => {
    if (!activeThreadId || !userId || !reply.trim()) return
    setSending(true)
    setError(null)
    try {
      await replyAsSociety({
        threadId: activeThreadId,
        body: reply,
        senderPersonId: profile?.person_id || null,
        authUserId: userId,
      })
      setReply('')
      setMessages(await listMessages(activeThreadId))
      await loadThreads()
    } catch (e: any) {
      setError(e?.message || 'Risposta fallita')
    } finally {
      setSending(false)
    }
  }

  if (!personId) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface }}>
        <MessageCircle className="mx-auto mb-3 h-10 w-10" style={{ color: GOLEE.textMuted }} />
        <p className="font-medium" style={{ color: GOLEE.text }}>Salva prima la persona</p>
        <p className="mt-1 text-sm" style={{ color: GOLEE.textMuted }}>
          La corrispondenza è disponibile dopo il primo salvataggio dell&apos;anagrafica.
        </p>
      </div>
    )
  }

  const activeThread = threads.find((t) => t.id === activeThreadId)

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface }}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold" style={{ color: GOLEE.text }}>
              Corrispondenza
            </h3>
            <p className="mt-0.5 text-sm" style={{ color: GOLEE.textMuted }}>
              Chat con {personName || 'questa persona'}. Ogni conversazione ha un titolo e la propria cronologia.
              Le notifiche automatiche (appuntamenti, quote…) restano separate e non sono rispondibili qui.
            </p>
          </div>
          {!showNew && !activeThreadId && (
            <button
              type="button"
              onClick={() => {
                setShowNew(true)
                setActiveThreadId(null)
              }}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: GOLEE.accent }}
            >
              <Plus className="h-4 w-4" />
              Nuovo messaggio
            </button>
          )}
        </div>

        {error && (
          <div
            className="mb-4 rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: '#FECACA', backgroundColor: GOLEE.dangerSoft, color: GOLEE.danger }}
          >
            {error}
          </div>
        )}

        {showNew && (
          <div className="mb-4 space-y-3 rounded-2xl border p-4" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowNew(false)} className="rounded-xl p-1.5 hover:bg-white">
                <ArrowLeft className="h-4 w-4" style={{ color: GOLEE.textMuted }} />
              </button>
              <p className="font-semibold" style={{ color: GOLEE.text }}>Nuova conversazione</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>
                Titolo
              </label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Es. Documenti tesseramento"
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: GOLEE.border, color: GOLEE.text }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>
                Messaggio
              </label>
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={4}
                placeholder="Scrivi il messaggio…"
                className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: GOLEE.border, color: GOLEE.text }}
              />
            </div>
            <button
              type="button"
              disabled={sending || !newTitle.trim() || !newBody.trim()}
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: GOLEE.accent }}
            >
              <Send className="h-4 w-4" />
              {sending ? 'Invio…' : 'Invia'}
            </button>
          </div>
        )}

        {activeThreadId && activeThread && (
          <div className="flex flex-col overflow-hidden rounded-2xl border" style={{ borderColor: GOLEE.border, minHeight: 360 }}>
            <div
              className="flex items-center gap-2 border-b px-4 py-3"
              style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveThreadId(null)
                  setMessages([])
                }}
                className="rounded-xl p-1.5 hover:bg-white"
              >
                <ArrowLeft className="h-4 w-4" style={{ color: GOLEE.textMuted }} />
              </button>
              <div className="min-w-0">
                <p className="truncate font-semibold" style={{ color: GOLEE.text }}>{activeThread.title}</p>
                <p className="text-xs" style={{ color: GOLEE.textMuted }}>Conversazione con {personName}</p>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ backgroundColor: '#E5DDD5', maxHeight: 420 }}>
              {messages.map((m) => {
                const mine = m.from_society
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-[80%] rounded-2xl px-3 py-2 shadow-sm"
                      style={{
                        backgroundColor: mine ? '#DCF8C6' : '#FFFFFF',
                        color: GOLEE.text,
                      }}
                    >
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>
                        {m.sender_name}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                      <p className="mt-1 text-right text-[10px]" style={{ color: GOLEE.textMuted }}>
                        {new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
              {messages.length === 0 && (
                <p className="py-8 text-center text-sm" style={{ color: GOLEE.textMuted }}>Nessun messaggio</p>
              )}
            </div>

            <div className="flex gap-2 border-t p-3" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface }}>
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleReply()
                    }
                  }}
                  placeholder="Rispondi…"
                  className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm"
                  style={{ borderColor: GOLEE.border, color: GOLEE.text, backgroundColor: GOLEE.surface }}
                />
                <button
                  type="button"
                  disabled={sending || !reply.trim()}
                  onClick={handleReply}
                  className="rounded-xl px-3 py-2.5 text-white disabled:opacity-50"
                  style={{ backgroundColor: GOLEE.accent }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
          </div>
        )}

        {!activeThreadId && !showNew && (
          <div className="space-y-2">
            {loading ? (
              <p className="py-8 text-center text-sm" style={{ color: GOLEE.textMuted }}>Caricamento…</p>
            ) : threads.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center" style={{ borderColor: GOLEE.border }}>
                <MessageCircle className="mx-auto mb-2 h-8 w-8" style={{ color: GOLEE.textMuted }} />
                <p className="text-sm font-medium" style={{ color: GOLEE.textMuted }}>Nessuna conversazione</p>
                <p className="mt-1 text-xs" style={{ color: GOLEE.textMuted }}>Avvia un nuovo messaggio con un titolo.</p>
              </div>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openThread(t.id)}
                  className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-[#F4F6F8]"
                  style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: GOLEE.accentSoft, color: GOLEE.accent }}
                  >
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold" style={{ color: GOLEE.text }}>{t.title}</p>
                    <p className="text-xs" style={{ color: GOLEE.textMuted }}>
                      {new Date(t.last_message_at).toLocaleString('it-IT')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
