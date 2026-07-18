import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical, Pencil, Plus, Trash2, Calendar, Trophy, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import {
  EMPTY_EVENT_FORM_FIELDS,
  EventTypeConfig,
  EventTypeFormFields,
  FORM_FIELD_LABELS,
  rowToEventTypeConfig,
  slugEventTypeCode,
} from '@/config/eventTypes'
import { GOLEE, goleeCardClass, goleeInputClass, goleeInputStyle, goleeLabelClass } from '@/config/goleeTheme'

const CHECKBOX_FIELDS = Object.keys(FORM_FIELD_LABELS) as (keyof typeof FORM_FIELD_LABELS)[]

export default function EventTypesSettings() {
  const [types, setTypes] = useState<EventTypeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formSporting, setFormSporting] = useState(false)
  const [formActive, setFormActive] = useState(true)
  const [formSortOrder, setFormSortOrder] = useState(1)
  const [formFields, setFormFields] = useState<EventTypeFormFields>({ ...EMPTY_EVENT_FORM_FIELDS })
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const loadTypes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('event_types')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      setTypes((data || []).map(rowToEventTypeConfig))
    } catch (e: unknown) {
      console.error(e)
      setMessage('Errore nel caricamento. Esegui database/create_event_types_table.sql su Supabase.')
      setTypes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTypes()
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setFormCode('')
    setFormName('')
    setFormSporting(false)
    setFormActive(true)
    setFormSortOrder(types.length > 0 ? Math.max(...types.map((t) => t.sort_order), 0) + 1 : 1)
    setFormFields({ ...EMPTY_EVENT_FORM_FIELDS })
    setModalOpen(true)
  }

  const openEdit = (row: EventTypeConfig) => {
    setEditingId(row.id ?? null)
    setFormCode(row.code)
    setFormName(row.name)
    setFormSporting(row.is_sporting)
    setFormActive(row.active)
    setFormSortOrder(row.sort_order)
    setFormFields({ ...row.form_fields })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  const toggleFormField = (key: keyof typeof FORM_FIELD_LABELS) => {
    setFormFields((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const save = async () => {
    const name = formName.trim()
    const code = (editingId ? formCode : slugEventTypeCode(formName || formCode)).trim()
    if (!name) {
      setMessage('Inserisci il nome del tipo evento.')
      return
    }
    if (!code) {
      setMessage('Inserisci un codice valido.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const payload = {
        code,
        name,
        is_sporting: formSporting,
        active: formActive,
        sort_order: formSortOrder,
        form_fields: formFields,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase.from('event_types').update(payload).eq('id', editingId)
        if (error) throw error
        setMessage('Tipo evento aggiornato.')
      } else {
        const { error } = await supabase.from('event_types').insert([payload])
        if (error) throw error
        setMessage('Tipo evento aggiunto.')
      }
      closeModal()
      loadTypes()
      window.dispatchEvent(new Event('event-types-updated'))
    } catch (e: unknown) {
      const err = e as { message?: string }
      setMessage(err?.message || 'Errore durante il salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: EventTypeConfig) => {
    if (!row.id) return
    if (!confirm(`Eliminare il tipo "${row.name}"? Gli eventi già creati con codice "${row.code}" resteranno nel calendario.`)) return
    try {
      const { error } = await supabase.from('event_types').delete().eq('id', row.id)
      if (error) throw error
      setMessage('Tipo evento eliminato.')
      loadTypes()
      window.dispatchEvent(new Event('event-types-updated'))
    } catch (e: unknown) {
      const err = e as { message?: string }
      setMessage(err?.message || 'Errore durante l\'eliminazione.')
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)
    setDraggedIndex(null)
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (Number.isNaN(fromIndex) || fromIndex === toIndex) return
    const reordered = [...types]
    const [removed] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, removed)
    setTypes(reordered)
    setSavingOrder(true)
    setMessage('')
    try {
      await Promise.all(
        reordered.map((row, i) =>
          row.id
            ? supabase.from('event_types').update({ sort_order: i + 1 }).eq('id', row.id)
            : Promise.resolve()
        )
      )
      setMessage('Ordine aggiornato.')
      window.dispatchEvent(new Event('event-types-updated'))
    } catch (err: unknown) {
      const e = err as { message?: string }
      setMessage(e?.message || 'Errore nel salvataggio dell\'ordine.')
      loadTypes()
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <div className="w-full -mx-6 px-4 sm:px-6" style={{ backgroundColor: GOLEE.pageBg }}>
      <div className={`${goleeCardClass} p-5 md:p-6 w-full`} style={{ borderColor: GOLEE.border }}>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: GOLEE.infoSoft }}>
              <Calendar className="w-5 h-5" style={{ color: GOLEE.info }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: GOLEE.text }}>Tipi evento calendario</h2>
              <p className="text-sm mt-0.5 max-w-2xl" style={{ color: GOLEE.textMuted }}>
                Configura menu Tipo Evento, flag sportivo e campi del form creazione evento.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 shrink-0"
            style={{ backgroundColor: GOLEE.accent }}
          >
            <Plus className="w-4 h-4" />
            Nuovo tipo
          </button>
        </div>

        {message && (
          <div
            className="mb-5 px-4 py-3 rounded-xl text-sm font-medium border"
            style={{
              backgroundColor: message.includes('Errore') ? GOLEE.dangerSoft : GOLEE.successSoft,
              borderColor: message.includes('Errore') ? GOLEE.danger : GOLEE.success,
              color: message.includes('Errore') ? GOLEE.danger : GOLEE.success,
            }}
          >
            {message}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 rounded-xl border border-dashed" style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}>
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Caricamento tipi evento...</p>
          </div>
        ) : types.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed" style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}>
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nessun tipo configurato. Esegui lo script SQL o aggiungi il primo tipo.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Intestazione colonne */}
            <div className="hidden lg:grid grid-cols-[auto_48px_minmax(80px,0.65fr)_210px_90px_90px_1fr_auto] items-center gap-3 px-4 pb-1">
              <span className="w-5" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>#</span>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>Nome</span>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>Codice</span>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>Sportivo</span>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>Stato</span>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>Campi form</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-right" style={{ color: GOLEE.textMuted }}>Azioni</span>
            </div>

            {types.map((row, index) => {
              const activeFields = CHECKBOX_FIELDS.filter((k) => row.form_fields[k])
              const isDragging = draggedIndex === index
              const isDragOver = dragOverIndex === index

              return (
                <div
                  key={row.id ?? row.code}
                  draggable
                  onDragStart={(e) => {
                    setDraggedIndex(index)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', String(index))
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverIndex(index)
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={() => {
                    setDraggedIndex(null)
                    setDragOverIndex(null)
                  }}
                  className={`group grid grid-cols-1 lg:grid-cols-[auto_48px_minmax(80px,0.65fr)_210px_90px_90px_1fr_auto] items-center gap-3 lg:gap-4 p-3 lg:px-4 lg:py-3.5 rounded-xl border transition-all duration-150 leading-tight ${
                    isDragging ? 'opacity-50' : ''
                  }`}
                  style={{
                    backgroundColor: isDragOver
                      ? GOLEE.accentSoft
                      : row.active
                        ? GOLEE.successSoft
                        : GOLEE.dangerSoft,
                    borderColor: isDragOver
                      ? GOLEE.accent
                      : row.active
                        ? GOLEE.success
                        : GOLEE.danger,
                    boxShadow: isDragOver ? `0 0 0 2px ${GOLEE.accent}` : undefined,
                  }}
                >
                  <div className="hidden lg:flex items-center justify-center cursor-grab active:cursor-grabbing" style={{ color: GOLEE.textMuted }}>
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="flex items-center gap-2 lg:justify-center">
                    <GripVertical className="w-4 h-4 lg:hidden shrink-0 cursor-grab" style={{ color: GOLEE.textMuted }} />
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: GOLEE.surface, color: GOLEE.textMuted, border: `1px solid ${GOLEE.border}` }}
                    >
                      {row.sort_order}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="font-semibold text-[15pt] truncate block" style={{ color: GOLEE.text }}>
                      {row.name}
                    </span>
                  </div>

                  <div>
                    <span
                      className="inline-block text-xs font-mono px-2 py-0.5 rounded-md truncate max-w-full"
                      style={{ backgroundColor: GOLEE.surface, color: GOLEE.textMuted, border: `1px solid ${GOLEE.border}` }}
                    >
                      {row.code}
                    </span>
                  </div>

                  <div>
                    {row.is_sporting ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: GOLEE.infoSoft, color: GOLEE.info }}
                      >
                        <Trophy className="w-3 h-3" />
                        Sì
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: GOLEE.textMuted }}>—</span>
                    )}
                  </div>

                  <div>
                    {row.active ? (
                      <CheckCircle2 className="w-4 h-4" style={{ color: GOLEE.success }} aria-label="Attivo" />
                    ) : (
                      <XCircle className="w-4 h-4" style={{ color: GOLEE.danger }} aria-label="Non attivo" />
                    )}
                  </div>

                  <div className="min-w-0 flex flex-wrap gap-1.5">
                    {activeFields.length > 0 ? (
                      activeFields.slice(0, 3).map((k) => (
                        <span
                          key={k}
                          className="text-[11px] px-2 py-0.5 rounded-md whitespace-nowrap truncate max-w-[140px]"
                          style={{ backgroundColor: GOLEE.surface, border: `1px solid ${GOLEE.border}`, color: GOLEE.text }}
                          title={FORM_FIELD_LABELS[k]}
                        >
                          {FORM_FIELD_LABELS[k]}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs italic" style={{ color: GOLEE.textMuted }}>Solo titolo e orari</span>
                    )}
                    {activeFields.length > 3 && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                        style={{ backgroundColor: GOLEE.accentSoft, color: GOLEE.accent }}
                      >
                        +{activeFields.length - 3}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="p-2 rounded-xl border transition-colors hover:opacity-90"
                      style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.info, color: GOLEE.info }}
                      title="Modifica"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      className="p-2 rounded-xl border transition-colors hover:opacity-90"
                      style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.danger, color: GOLEE.danger }}
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}

            {savingOrder && (
              <p className="text-xs font-medium px-2 pt-1" style={{ color: GOLEE.textMuted }}>
                Salvataggio ordine...
              </p>
            )}
          </div>
        )}
      </div>

      {modalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div
            className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border"
            style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
          >
            <div
              className="px-6 py-4 border-b flex items-center gap-3 shrink-0"
              style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: GOLEE.infoSoft }}>
                <Calendar className="w-5 h-5" style={{ color: GOLEE.info }} />
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{ color: GOLEE.text }}>
                  {editingId ? 'Modifica tipo evento' : 'Nuovo tipo evento'}
                </h3>
                <p className="text-sm mt-0.5" style={{ color: GOLEE.textMuted }}>
                  {editingId ? formName || 'Configurazione tipo' : 'Aggiungi un nuovo tipo al calendario'}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Nome *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value)
                      if (!editingId) setFormCode(slugEventTypeCode(e.target.value))
                    }}
                    className={goleeInputClass}
                    style={goleeInputStyle}
                    placeholder="Es. Partita"
                  />
                </div>
                <div>
                  <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Codice *</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(slugEventTypeCode(e.target.value))}
                    disabled={!!editingId}
                    className={`${goleeInputClass} font-mono disabled:opacity-60`}
                    style={goleeInputStyle}
                    placeholder="partita"
                  />
                  {editingId && (
                    <p className="text-xs mt-1" style={{ color: GOLEE.textMuted }}>
                      Il codice non è modificabile dopo la creazione.
                    </p>
                  )}
                </div>
                <div>
                  <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Ordine nel menu</label>
                  <input
                    type="number"
                    min={1}
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(parseInt(e.target.value, 10) || 1)}
                    className={goleeInputClass}
                    style={goleeInputStyle}
                  />
                </div>
                <div
                  className="rounded-xl border p-4 space-y-3"
                  style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
                >
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: GOLEE.text }}>
                    <input type="checkbox" checked={formSporting} onChange={(e) => setFormSporting(e.target.checked)} className="accent-[#00C48C]" />
                    Evento sportivo (homepage)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: GOLEE.text }}>
                    <input
                      type="checkbox"
                      checked={formFields.isClubParty}
                      onChange={(e) => setFormFields((prev) => ({ ...prev, isClubParty: e.target.checked }))}
                      className="accent-[#00C48C]"
                    />
                    Festa del club
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: GOLEE.text }}>
                    <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="accent-[#00C48C]" />
                    Attivo nel menu
                  </label>
                </div>
              </div>

              <div className="rounded-xl border p-4" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface }}>
                <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Campi da mostrare nel form</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {CHECKBOX_FIELDS.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm p-2.5 rounded-xl border cursor-pointer transition-colors hover:opacity-90"
                      style={{
                        borderColor: formFields[key] ? GOLEE.accent : GOLEE.border,
                        backgroundColor: formFields[key] ? GOLEE.accentSoft : GOLEE.surfaceMuted,
                        color: GOLEE.text,
                      }}
                    >
                      <input type="checkbox" checked={!!formFields[key]} onChange={() => toggleFormField(key)} className="accent-[#00C48C]" />
                      {FORM_FIELD_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!formFields.isClubParty && (
                  <div>
                    <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Tipo orario</label>
                    <select
                      value={formFields.timeFieldType}
                      onChange={(e) =>
                        setFormFields((prev) => ({
                          ...prev,
                          timeFieldType: e.target.value as 'single' | 'start_end',
                        }))
                      }
                      className={goleeInputClass}
                      style={goleeInputStyle}
                    >
                      <option value="start_end">Inizio e fine</option>
                      <option value="single">Orario singolo</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Icona striscia (opz.)</label>
                  <input
                    type="text"
                    value={formFields.stripIcon ?? ''}
                    onChange={(e) => setFormFields((prev) => ({ ...prev, stripIcon: e.target.value || null }))}
                    className={`${goleeInputClass} font-mono text-center`}
                    style={goleeInputStyle}
                    placeholder="CON, GEN"
                    maxLength={8}
                  />
                </div>
              </div>
            </div>

            <div
              className="px-6 py-4 border-t flex gap-3 shrink-0"
              style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
            >
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-colors hover:opacity-90"
                style={{ borderColor: GOLEE.border, color: GOLEE.text, backgroundColor: GOLEE.surface }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: GOLEE.accent }}
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
