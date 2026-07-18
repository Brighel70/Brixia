import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Plus, Trash2, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { rowToTrainingVenue, sortTrainingVenues, TrainingVenue } from '@/config/trainingVenues'
import { GOLEE, goleeInputClass, goleeInputStyle, goleeLabelClass } from '@/config/goleeTheme'

export default function TrainingVenuesPanel() {
  const [venues, setVenues] = useState<TrainingVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formHomeVenue, setFormHomeVenue] = useState(true)
  const [formRequiresAwayDetail, setFormRequiresAwayDetail] = useState(false)
  const [formActive, setFormActive] = useState(true)
  const [formSortOrder, setFormSortOrder] = useState(1)
  const [saving, setSaving] = useState(false)

  const loadVenues = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('training_venues')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      setVenues(sortTrainingVenues((data || []).map(rowToTrainingVenue)))
    } catch (e: unknown) {
      console.error(e)
      setMessage('Errore caricamento sedi.')
      setVenues([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVenues()
    const onUpdated = () => loadVenues()
    window.addEventListener('training-venues-updated', onUpdated)
    return () => window.removeEventListener('training-venues-updated', onUpdated)
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setFormName('')
    setFormHomeVenue(true)
    setFormRequiresAwayDetail(false)
    setFormActive(true)
    setFormSortOrder(venues.length > 0 ? Math.max(...venues.map((v) => v.sort_order), 0) + 1 : 1)
    setModalOpen(true)
  }

  const openEdit = (row: TrainingVenue) => {
    setEditingId(row.id ?? null)
    setFormName(row.name)
    setFormHomeVenue(row.is_home_venue)
    setFormRequiresAwayDetail(row.requires_away_detail)
    setFormActive(row.active)
    setFormSortOrder(row.sort_order)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  const save = async () => {
    const name = formName.trim()
    if (!name) {
      setMessage('Inserisci il nome della sede.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const payload = {
        name,
        is_home_venue: formRequiresAwayDetail ? false : formHomeVenue,
        requires_away_detail: formRequiresAwayDetail,
        active: formActive,
        sort_order: formSortOrder,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase.from('training_venues').update(payload).eq('id', editingId)
        if (error) throw error
        setMessage('Sede aggiornata.')
      } else {
        const { error } = await supabase.from('training_venues').insert([payload])
        if (error) throw error
        setMessage('Sede aggiunta.')
      }
      closeModal()
      loadVenues()
      window.dispatchEvent(new Event('training-venues-updated'))
    } catch (e: unknown) {
      const err = e as { message?: string }
      setMessage(err?.message || 'Errore durante il salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: TrainingVenue) => {
    if (!row.id) return
    if (!confirm(`Eliminare la sede "${row.name}"?`)) return
    try {
      const { error } = await supabase.from('training_venues').delete().eq('id', row.id)
      if (error) throw error
      setMessage('Sede eliminata.')
      loadVenues()
      window.dispatchEvent(new Event('training-venues-updated'))
    } catch (e: unknown) {
      const err = e as { message?: string }
      setMessage(err?.message || 'Errore durante l\'eliminazione.')
    }
  }

  return (
    <>
      <div className="flex flex-col flex-1 h-full min-h-0">
        <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: GOLEE.accentSoft }}>
              <MapPin className="w-4 h-4" style={{ color: GOLEE.accent }} />
            </div>
            <h2 className="text-base font-bold truncate" style={{ color: GOLEE.text }}>Sedi</h2>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center justify-center w-9 h-9 rounded-full text-white shadow-sm transition-opacity hover:opacity-90 shrink-0"
            style={{ backgroundColor: GOLEE.accent }}
            title="Nuova sede di allenamento"
            aria-label="Nuova sede di allenamento"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        {message && (
          <p
            className="text-xs mb-3 px-2.5 py-1.5 rounded-lg"
            style={{
              backgroundColor: message.includes('Errore') ? GOLEE.dangerSoft : GOLEE.successSoft,
              color: message.includes('Errore') ? GOLEE.danger : GOLEE.success,
            }}
          >
            {message}
          </p>
        )}

        <div className="flex flex-col flex-1 min-h-0">
        {loading ? (
          <p className="text-sm flex-1" style={{ color: GOLEE.textMuted }}>Caricamento...</p>
        ) : venues.length === 0 ? (
          <p className="text-xs leading-relaxed flex-1" style={{ color: GOLEE.textMuted }}>
            Nessuna sede. Tocca + per aggiungerne una.
          </p>
        ) : (
          <ul className="space-y-2 flex-1 min-h-0 overflow-y-auto">
            {venues.map((row) => (
              <li
                key={row.id ?? row.name}
                className="flex items-center justify-between gap-1 p-2.5 rounded-xl border text-sm"
                style={{
                  backgroundColor: row.active ? GOLEE.surfaceMuted : GOLEE.surfaceMuted,
                  borderColor: GOLEE.border,
                  opacity: row.active ? 1 : 0.55,
                }}
              >
                <span className="font-medium truncate" style={{ color: GOLEE.text }} title={row.name}>
                  {row.name}
                </span>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: GOLEE.info }}
                    title="Modifica"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: GOLEE.danger }}
                    title="Elimina"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>

      {modalOpen && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="rounded-2xl shadow-xl w-full max-w-md p-6 border" style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: GOLEE.text }}>
              {editingId ? 'Modifica sede' : 'Nuova sede di allenamento'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Nome *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={goleeInputClass}
                  style={goleeInputStyle}
                  placeholder="Es. Brescia, Gussago..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: GOLEE.text }}>
                <input
                  type="checkbox"
                  checked={formRequiresAwayDetail}
                  onChange={(e) => {
                    setFormRequiresAwayDetail(e.target.checked)
                    if (e.target.checked) setFormHomeVenue(false)
                  }}
                  className="accent-[#00C48C]"
                />
                Richiede campo &quot;Dove&quot; (es. Trasferta)
              </label>
              {!formRequiresAwayDetail && (
                <label className="flex items-center gap-2 text-sm" style={{ color: GOLEE.text }}>
                  <input
                    type="checkbox"
                    checked={formHomeVenue}
                    onChange={(e) => setFormHomeVenue(e.target.checked)}
                    className="accent-[#00C48C]"
                  />
                  Sede di casa del club
                </label>
              )}
              <label className="flex items-center gap-2 text-sm" style={{ color: GOLEE.text }}>
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="accent-[#00C48C]" />
                Attiva
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-3 rounded-xl text-sm font-medium border"
                style={{ borderColor: GOLEE.border, color: GOLEE.textMuted, backgroundColor: GOLEE.surface }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: GOLEE.accent }}
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
