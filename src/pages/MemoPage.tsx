import { useState, useEffect, type ElementType } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getBrandConfig } from '@/config/brand'
import Header from '@/components/Header'
import { useAuth } from '@/store/auth'
import {
  StickyNote,
  Bell,
  Calendar,
  CheckSquare,
  Plus,
  Search,
  Trash2,
  Pencil,
  Loader2,
  X,
  LayoutList,
} from 'lucide-react'

/** Palette ispirata al gestionale Goleee */
const GOLEE = {
  surface: '#FFFFFF',
  surfaceMuted: '#F4F6F8',
  border: '#E8ECF0',
  text: '#1A2332',
  textMuted: '#6B7280',
  accent: '#00C48C',
  accentSoft: '#E6FAF3',
  accentHover: '#00A876',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  success: '#10B981',
  successSoft: '#ECFDF5',
  violet: '#8B5CF6',
  violetSoft: '#F3E8FF',
  danger: '#EF4444',
} as const

export type MemoType = 'note' | 'reminder' | 'appointment' | 'todo'
type MemoFilter = MemoType | 'all'

interface UserMemo {
  id: string
  user_id: string
  type: MemoType
  content: string
  due_date: string | null
  due_time: string | null
  completed: boolean
  completed_at?: string | null
  created_at: string
  updated_at: string
}

interface MemoPageProps {
  embedInLayout?: boolean
}

const TYPE_CONFIG: Record<MemoType, { label: string; icon: ElementType; iconBg: string; iconColor: string }> = {
  note: { label: 'Nota', icon: StickyNote, iconBg: GOLEE.infoSoft, iconColor: GOLEE.info },
  reminder: { label: 'Promemoria', icon: Bell, iconBg: GOLEE.warningSoft, iconColor: GOLEE.warning },
  appointment: { label: 'Appuntamento', icon: Calendar, iconBg: GOLEE.successSoft, iconColor: GOLEE.success },
  todo: { label: 'Da fare', icon: CheckSquare, iconBg: GOLEE.violetSoft, iconColor: GOLEE.violet },
}

/** Todo e promemoria completati vengono eliminati automaticamente dopo questo numero di giorni */
const COMPLETED_AUTO_DELETE_DAYS = 7

export default function MemoPage({ embedInLayout = false }: MemoPageProps) {
  const { userId } = useAuth()
  const brand = getBrandConfig()
  const accentColor = GOLEE.accent

  const [memos, setMemos] = useState<UserMemo[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<MemoFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    type: 'note' as MemoType,
    content: '',
    due_date: '',
    due_time: ''
  })

  useEffect(() => {
    if (userId) loadMemos()
  }, [userId])

  const purgeOldCompletedMemos = async () => {
    if (!userId) return
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - COMPLETED_AUTO_DELETE_DAYS)
    const { error } = await supabase
      .from('user_memos')
      .delete()
      .eq('user_id', userId)
      .in('type', ['todo', 'reminder'])
      .eq('completed', true)
      .lt('completed_at', cutoff.toISOString())
    if (error && !error.message?.includes('completed_at')) {
      console.warn('Pulizia automatica memo completati:', error)
    }
  }

  const loadMemos = async () => {
    if (!userId) return
    try {
      setLoading(true)
      setTableMissing(false)
      await purgeOldCompletedMemos()
      const { data, error } = await supabase
        .from('user_memos')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
          setTableMissing(true)
        }
        throw error
      }
      setMemos((data || []) as UserMemo[])
    } catch (e) {
      console.error('Errore caricamento memo:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !form.content.trim()) return
    if (form.type === 'reminder' && (!form.due_date || !form.due_time)) {
      alert('Per un promemoria inserisci data e orario.')
      return
    }

    try {
      const payload = {
        user_id: userId,
        type: form.type,
        content: form.content.trim(),
        due_date: form.type === 'todo' ? null : (form.due_date || null),
        due_time: form.type === 'reminder' || form.type === 'appointment' ? (form.due_time || null) : null,
        completed: false
      }

      if (editingId) {
        const { error } = await supabase
          .from('user_memos')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_memos').insert([payload])
        if (error) throw error
      }

      setForm({ type: 'note', content: '', due_date: '', due_time: '' })
      setEditingId(null)
      setShowForm(false)
      loadMemos()
    } catch (e: unknown) {
      console.error('Errore salvataggio:', e)
      const err = e as { code?: string; message?: string }
      if (err?.code === 'PGRST204' || err?.code === 'PGRST205' || err?.message?.includes('Could not find the table')) {
        setTableMissing(true)
      }
      alert('Errore nel salvataggio')
    }
  }

  const handleToggleComplete = async (memo: UserMemo) => {
    if (memo.type !== 'todo' && memo.type !== 'reminder') return
    const nowCompleted = !memo.completed
    try {
      const { error } = await supabase
        .from('user_memos')
        .update({
          completed: nowCompleted,
          completed_at: nowCompleted ? new Date().toISOString() : null,
        })
        .eq('id', memo.id)
      if (error?.message?.includes('completed_at')) {
        await supabase
          .from('user_memos')
          .update({ completed: nowCompleted })
          .eq('id', memo.id)
      } else if (error) {
        throw error
      }
      loadMemos()
    } catch (e) {
      console.error('Errore:', e)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo memo?')) return
    try {
      await supabase.from('user_memos').delete().eq('id', id)
      if (editingId === id) setEditingId(null)
      loadMemos()
    } catch (e) {
      console.error('Errore eliminazione:', e)
      alert('Errore nell\'eliminazione')
    }
  }

  const handleEdit = (memo: UserMemo) => {
    setForm({
      type: memo.type,
      content: memo.content,
      due_date: memo.type === 'todo' ? '' : (memo.due_date || ''),
      due_time: memo.due_time ? memo.due_time.substring(0, 5) : ''
    })
    setEditingId(memo.id)
    setShowForm(true)
  }

  const searchFilteredMemos = memos.filter((m) => {
    const term = searchTerm.trim().toLowerCase()
    return !term ||
      m.content.toLowerCase().includes(term) ||
      TYPE_CONFIG[m.type].label.toLowerCase().includes(term)
  })

  const filteredMemos = searchFilteredMemos.filter((m) =>
    filterType === 'all' || m.type === filterType
  )

  const countByType = (type: MemoType) => memos.filter(m => m.type === type).length
  const hasActiveFilter = searchTerm.trim().length > 0 || filterType !== 'all'

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (value.trim()) setFilterType('all')
  }

  const handleFilterType = (type: MemoFilter) => {
    setSearchTerm('')
    setFilterType(type)
  }

  const toggleTypeFilter = (type: MemoType) => {
    setSearchTerm('')
    setFilterType(prev => (prev === type ? 'all' : type))
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    })
  }

  const formatTime = (t: string | null) => {
    if (!t) return ''
    return t.substring(0, 5)
  }

  const getMemoSortDate = (memo: UserMemo): number => {
    if ((memo.type === 'reminder' || memo.type === 'appointment') && memo.due_date) {
      const time = memo.due_time?.substring(0, 5) || (memo.type === 'reminder' ? '09:00' : '12:00')
      return new Date(`${memo.due_date}T${time}:00`).getTime()
    }
    return new Date(memo.created_at).getTime()
  }

  const getMemoSubtitle = (memo: UserMemo) => {
    if (memo.completed && memo.completed_at) {
      return `Completato · ${formatDate(memo.completed_at.slice(0, 10))}`
    }
    if (memo.type === 'todo') {
      return `Creato · ${formatDate(memo.created_at.slice(0, 10))}`
    }
    if (!memo.due_date && !memo.due_time) return null
    const datePart = memo.due_date ? formatDate(memo.due_date) : ''
    const timePart = memo.due_time ? formatTime(memo.due_time) : ''
    return [datePart, timePart].filter(Boolean).join(' · ')
  }

  const pageBg = embedInLayout ? 'min-h-full' : 'min-h-screen'
  const contentBg = embedInLayout
    ? { backgroundColor: GOLEE.surfaceMuted }
    : { background: `linear-gradient(180deg, ${GOLEE.surfaceMuted} 0%, #EEF1F5 100%)` }

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#00C48C33]'
  const inputStyle = { backgroundColor: GOLEE.surface, borderColor: GOLEE.border, color: GOLEE.text }

  const StatCard = ({
    icon: Icon,
    label,
    value,
    sublabel,
    iconBg,
    iconColor,
    onClick,
    active,
    activeColor,
  }: {
    icon: ElementType
    label: string
    value: number | string
    sublabel: string
    iconBg: string
    iconColor: string
    onClick?: () => void
    active?: boolean
    activeColor?: string
  }) => (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`rounded-2xl p-4 border shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'hover:shadow-md'}`}
      style={{
        backgroundColor: GOLEE.surface,
        borderColor: active && activeColor ? activeColor : GOLEE.border,
        borderWidth: active ? '2px' : '1px',
        boxShadow: active && activeColor ? `0 0 0 3px ${activeColor}22` : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider truncate" style={{ color: GOLEE.textMuted }}>
            {label}
          </p>
          <p className="text-2xl font-bold leading-tight" style={{ color: GOLEE.text }}>{value}</p>
          <p className="text-xs truncate" style={{ color: GOLEE.textMuted }}>{sublabel}</p>
        </div>
      </div>
    </div>
  )

  if (!userId) {
    return (
      <div className="min-h-full flex items-center justify-center" style={{ backgroundColor: GOLEE.surfaceMuted }}>
        <p style={{ color: GOLEE.textMuted }}>Effettua l'accesso per usare i memo personali.</p>
      </div>
    )
  }

  return (
    <div className={pageBg} style={contentBg}>
      {!embedInLayout && <Header title="Memo" showBack hideCenterLogo />}

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Intestazione */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: GOLEE.accentSoft }}
              >
                <StickyNote className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: GOLEE.text }}>Memo personali</h2>
                <p className="text-sm" style={{ color: GOLEE.textMuted }}>
                  {brand.clubShortName} · note, promemoria e appuntamenti
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto lg:flex-1 lg:justify-end lg:max-w-2xl">
              <div className="relative flex-1 lg:max-w-sm">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: GOLEE.textMuted }}
                />
                <input
                  type="text"
                  placeholder="Cerca per contenuto..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2"
                  style={{
                    ...inputStyle,
                    ...(searchTerm.trim()
                      ? { borderColor: accentColor, boxShadow: `0 0 0 3px ${accentColor}22` }
                      : {}),
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-lg"
                    style={{ color: GOLEE.textMuted }}
                    title="Cancella ricerca"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm({ type: 'note', content: '', due_date: '', due_time: '' })
                  setEditingId(null)
                  setShowForm(!showForm)
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 shrink-0"
                style={{ backgroundColor: accentColor }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = GOLEE.accentHover }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = accentColor }}
              >
                <Plus className="w-4 h-4" />
                {showForm ? 'Annulla' : 'Nuovo memo'}
              </button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <StatCard
              icon={LayoutList}
              label="Totale memo"
              value={memos.length}
              sublabel="Tutte le categorie"
              iconBg={GOLEE.accentSoft}
              iconColor={accentColor}
              onClick={() => handleFilterType('all')}
              active={filterType === 'all' && !searchTerm.trim()}
              activeColor={accentColor}
            />
            {(Object.keys(TYPE_CONFIG) as MemoType[]).map((type) => {
              const cfg = TYPE_CONFIG[type]
              return (
                <StatCard
                  key={type}
                  icon={cfg.icon}
                  label={cfg.label}
                  value={countByType(type)}
                  sublabel={cfg.label}
                  iconBg={cfg.iconBg}
                  iconColor={cfg.iconColor}
                  onClick={() => toggleTypeFilter(type)}
                  active={filterType === type && !searchTerm.trim()}
                  activeColor={cfg.iconColor}
                />
              )
            })}
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="max-w-3xl mx-auto mb-6 p-5 rounded-2xl border shadow-sm"
            style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
          >
            <h3 className="font-semibold mb-4" style={{ color: GOLEE.text }}>
              {editingId ? 'Modifica memo' : 'Nuovo memo'}
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.keys(TYPE_CONFIG) as MemoType[]).map((t) => {
                const cfg = TYPE_CONFIG[t]
                const Icon = cfg.icon
                const selected = form.type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      type: t,
                      due_date: t === 'todo' || t === 'note' ? '' : f.due_date,
                      due_time: t === 'appointment' || t === 'reminder' ? f.due_time : '',
                    }))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
                    style={{
                      backgroundColor: selected ? cfg.iconBg : GOLEE.surfaceMuted,
                      color: selected ? cfg.iconColor : GOLEE.textMuted,
                      borderColor: selected ? cfg.iconColor : GOLEE.border,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Scrivi qui..."
              rows={3}
              required
              className={`${inputClass} mb-3 resize-none`}
              style={inputStyle}
            />
            {(form.type === 'reminder' || form.type === 'appointment') && (
              <div className="flex flex-wrap gap-3 mb-4">
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  required={form.type === 'reminder'}
                  className={inputClass}
                  style={{ ...inputStyle, width: 'auto' }}
                />
                <input
                  type="time"
                  value={form.due_time}
                  onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))}
                  required={form.type === 'reminder'}
                  className={inputClass}
                  style={{ ...inputStyle, width: 'auto' }}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ color: GOLEE.textMuted }}
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: accentColor }}
              >
                {editingId ? 'Salva' : 'Aggiungi'}
              </button>
            </div>
          </form>
        )}

        {/* Contenuto */}
        <div className="w-full">
          {tableMissing ? (
            <div
              className="max-w-2xl mx-auto p-6 rounded-2xl border"
              style={{ backgroundColor: GOLEE.warningSoft, borderColor: '#FDE68A' }}
            >
              <h3 className="font-semibold mb-2" style={{ color: GOLEE.warning }}>Tabella mancante</h3>
              <p className="text-sm mb-4" style={{ color: GOLEE.text }}>
                La tabella <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: GOLEE.surface }}>user_memos</code> non esiste ancora.
                Esegui lo script <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: GOLEE.surface }}>create_user_memos.sql</code> in Supabase.
              </p>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: accentColor }}
              >
                Apri Supabase Dashboard
              </a>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
              <p className="text-sm font-medium" style={{ color: GOLEE.textMuted }}>Caricamento memo...</p>
            </div>
          ) : filteredMemos.length === 0 ? (
            <div
              className="rounded-2xl border flex flex-col items-center justify-center py-16 gap-3"
              style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: GOLEE.accentSoft }}
              >
                <StickyNote className="w-7 h-7" style={{ color: accentColor }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: GOLEE.text }}>
                {searchTerm || filterType !== 'all' ? 'Nessun memo corrisponde ai filtri' : 'Nessun memo presente'}
              </h3>
              {!showForm && !searchTerm && filterType === 'all' && (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="text-sm font-semibold"
                  style={{ color: accentColor }}
                >
                  Aggiungi il primo memo
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {(Object.keys(TYPE_CONFIG) as MemoType[]).map((type) => {
                const cfg = TYPE_CONFIG[type]
                const Icon = cfg.icon
                const sectionMemos = filteredMemos
                  .filter((m) => m.type === type)
                  .sort((a, b) => getMemoSortDate(a) - getMemoSortDate(b))
                if (filterType !== 'all' && filterType !== type) return null
                if (hasActiveFilter && sectionMemos.length === 0) return null

                return (
                  <div
                    key={type}
                    className="rounded-2xl border shadow-sm flex flex-col overflow-hidden"
                    style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
                  >
                    <div
                      className="px-4 py-3 border-b flex items-center gap-2"
                      style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: cfg.iconBg }}
                      >
                        <Icon className="w-4 h-4" style={{ color: cfg.iconColor }} />
                      </div>
                      <span className="font-semibold text-sm" style={{ color: GOLEE.text }}>{cfg.label}</span>
                      <span
                        className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: cfg.iconBg, color: cfg.iconColor }}
                      >
                        {sectionMemos.length}
                      </span>
                    </div>
                    <div className="flex-1 p-3 space-y-2 min-h-[120px]">
                      {sectionMemos.length === 0 ? (
                        <p className="text-sm py-6 text-center" style={{ color: GOLEE.textMuted }}>
                          Nessuno
                        </p>
                      ) : (
                        sectionMemos.map((memo) => (
                          <div
                            key={memo.id}
                            className="p-3 rounded-xl border flex items-start gap-2 transition-all hover:shadow-sm"
                            style={{
                              backgroundColor: GOLEE.surfaceMuted,
                              borderColor: GOLEE.border,
                              borderLeftWidth: '3px',
                              borderLeftColor: cfg.iconColor,
                            }}
                          >
                            {(memo.type === 'todo' || memo.type === 'reminder') && (
                              <button
                                type="button"
                                onClick={() => handleToggleComplete(memo)}
                                className="shrink-0 mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors"
                                style={{
                                  borderColor: memo.completed ? GOLEE.success : GOLEE.border,
                                  backgroundColor: memo.completed ? GOLEE.successSoft : GOLEE.surface,
                                }}
                              >
                                {memo.completed && <span className="text-xs" style={{ color: GOLEE.success }}>✓</span>}
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm ${memo.completed ? 'line-through opacity-60' : ''}`}
                                style={{ color: GOLEE.text }}
                              >
                                {memo.content}
                              </p>
                              {getMemoSubtitle(memo) && (
                                <p className="text-xs mt-0.5" style={{ color: GOLEE.textMuted }}>
                                  {getMemoSubtitle(memo)}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleEdit(memo)}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: GOLEE.info }}
                                title="Modifica"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(memo.id)}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: GOLEE.danger }}
                                title="Elimina"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
