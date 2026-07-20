import React, { useState, useEffect } from 'react'
import { CheckCircle2, User, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export type VisitListAppointment = {
  id: string
  date: string
  playerName: string
  person_id: string
  activity_description?: string | null
  ricontrollo_time?: string | null
}

interface VisitListOutcomeModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: VisitListAppointment | null
  onSuccess: () => void
  medicalStaff: Array<{ id: string; full_name: string }>
}

type OutcomePath = 'injury' | 'no_injury'
type NoInjuryAction = 'stop' | 'physio_preventive'

const CAUSE_OPTIONS = [
  { value: '', label: 'Seleziona causa' },
  { value: 'Allenamento', label: 'Allenamento' },
  { value: 'Partita', label: 'Partita' },
  { value: 'Infortunio precedente', label: 'Infortunio precedente' },
  { value: 'Altro', label: 'Altro' }
]

export default function VisitListOutcomeModal({
  isOpen,
  onClose,
  appointment,
  onSuccess,
  medicalStaff
}: VisitListOutcomeModalProps) {
  const [path, setPath] = useState<OutcomePath>('injury')
  const [noInjuryAction, setNoInjuryAction] = useState<NoInjuryAction>('stop')
  const [operatorName, setOperatorName] = useState('')
  const [operatorOther, setOperatorOther] = useState('')
  const [injuryType, setInjuryType] = useState('')
  const [bodyPart, setBodyPart] = useState('')
  const [cause, setCause] = useState('')
  const [notes, setNotes] = useState('')
  const [statoVisita, setStatoVisita] = useState<'da_confermare' | 'eseguito' | 'assente'>('da_confermare')
  const [richiestaFisioterapia, setRichiestaFisioterapia] = useState(false)
  const [showRicontrolloModal, setShowRicontrolloModal] = useState(false)
  const [showRicontrolloDatePicker, setShowRicontrolloDatePicker] = useState(false)
  const [ricontrolloPickerMode, setRicontrolloPickerMode] = useState<'solo_data' | 'data_ora'>('solo_data')
  const [pendingRicontrollo, setPendingRicontrollo] = useState<null | 'no' | { type: 'solo_data'; date: string } | { type: 'data_ora'; date: string; time: string }>(null)
  const [selectedRicontrolloDate, setSelectedRicontrolloDate] = useState('')
  const [selectedRicontrolloTime, setSelectedRicontrolloTime] = useState('')
  const [canPlayField, setCanPlayField] = useState(false)
  const [canPlayGym, setCanPlayGym] = useState(false)
  const [expectedStopDays, setExpectedStopDays] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const visitDate = appointment?.date || ''
  const visitTime = appointment?.ricontrollo_time ? String(appointment.ricontrollo_time).slice(0, 5) : ''

  useEffect(() => {
    if (!isOpen || !appointment) return
    setPath('injury')
    setNoInjuryAction('stop')
    setOperatorName('')
    setOperatorOther('')
    setNotes('')
    setInjuryType('')
    setBodyPart('')
    setCause('')
    setStatoVisita('da_confermare')
    setRichiestaFisioterapia(false)
    setShowRicontrolloModal(false)
    setShowRicontrolloDatePicker(false)
    setPendingRicontrollo(null)
    setRicontrolloPickerMode('solo_data')
    setCanPlayField(false)
    setCanPlayGym(false)
    setExpectedStopDays('')
    setError('')
  }, [isOpen, appointment])

  const getOperatorName = () => operatorName === 'Altro' ? operatorOther.trim() : operatorName.trim()

  const handleRicontrolloNo = () => {
    setShowRicontrolloModal(false)
    setPendingRicontrollo('no')
  }
  const handleRicontrolloSoloData = () => {
    setShowRicontrolloModal(false)
    setRicontrolloPickerMode('solo_data')
    setSelectedRicontrolloDate(visitDate || new Date().toISOString().split('T')[0])
    setSelectedRicontrolloTime('')
    setShowRicontrolloDatePicker(true)
  }
  const handleRicontrolloDataOra = () => {
    setShowRicontrolloModal(false)
    setRicontrolloPickerMode('data_ora')
    setSelectedRicontrolloDate(visitDate || new Date().toISOString().split('T')[0])
    setSelectedRicontrolloTime(visitTime || '18:00')
    setShowRicontrolloDatePicker(true)
  }
  const handleRicontrolloDateConfirm = () => {
    if (!selectedRicontrolloDate) return
    setShowRicontrolloDatePicker(false)
    if (ricontrolloPickerMode === 'data_ora') {
      setPendingRicontrollo({ type: 'data_ora', date: selectedRicontrolloDate, time: selectedRicontrolloTime })
    } else {
      setPendingRicontrollo({ type: 'solo_data', date: selectedRicontrolloDate })
    }
    setSelectedRicontrolloDate('')
    setSelectedRicontrolloTime('')
  }

  const handleSubmit = async () => {
    if (!appointment) return
    const entryId = appointment.id.replace('vle-', '')
    setError('')

    if (path === 'no_injury') {
      if (noInjuryAction === 'stop') {
        try {
          setLoading(true)
          const { error: delErr } = await supabase.from('visit_list_entries').delete().eq('id', entryId)
          if (delErr) throw delErr
          onSuccess()
          onClose()
        } catch (e) {
          setError(String(e))
        } finally {
          setLoading(false)
        }
        return
      }
      if (noInjuryAction === 'physio_preventive') {
        const op = getOperatorName()
        if (!op) {
          setError('Seleziona l\'operatore.')
          return
        }
        try {
          setLoading(true)
          const { data: newInjury, error: injErr } = await supabase
            .from('injuries')
            .insert({
              person_id: appointment.person_id,
              injury_date: visitDate,
              injury_type: 'Controllo preventivo',
              severity: 'Lieve',
              body_part: 'Generale',
              cause: 'Visita di controllo',
              current_status: 'In corso',
              duration_days: 7,
              is_closed: false
            })
            .select('id')
            .single()
          if (injErr || !newInjury) throw injErr || new Error('Creazione infortunio fallita')
          const actRow = {
            injury_id: newInjury.id,
            activity_type: 'medical_visit',
            activity_description: 'Visita di controllo',
            activity_date: visitDate,
            ricontrollo: visitDate,
            ricontrollo_time: visitTime || null,
            activity_time: visitTime || null,
            operator_name: op,
            stato_visita: 'eseguito',
            richiesta_fisioterapia: true,
            notes: notes.trim() || 'Indirizzato a fisioterapia per cure preventive.',
            can_play_field: true,
            can_play_gym: true
          }
          const { error: actErr } = await supabase.from('injury_activities').insert(actRow)
          if (actErr) throw actErr
          const { error: delErr } = await supabase.from('visit_list_entries').delete().eq('id', entryId)
          if (delErr) throw delErr
          onSuccess()
          onClose()
        } catch (e) {
          setError(String(e))
        } finally {
          setLoading(false)
        }
        return
      }
    }

    if (path === 'injury') {
      const op = getOperatorName()
      if (!op) {
        setError('Seleziona l\'operatore.')
        return
      }
      if (!injuryType.trim()) {
        setError('Inserisci il tipo di infortunio.')
        return
      }
      if (!bodyPart.trim()) {
        setError('Inserisci la parte del corpo.')
        return
      }
      if (!cause.trim()) {
        setError('Seleziona la causa.')
        return
      }
      const needsReferto = statoVisita === 'eseguito' || statoVisita === 'assente'
      if (needsReferto && !notes.trim()) {
        setError('Compila il referto della visita.')
        return
      }
      try {
        setLoading(true)
        const { data: newInjury, error: injErr } = await supabase
          .from('injuries')
          .insert({
            person_id: appointment.person_id,
            injury_date: visitDate,
            injury_type: injuryType,
            severity: 'Lieve',
            body_part: bodyPart,
            cause: cause,
            current_status: 'In corso',
            duration_days: expectedStopDays ? parseInt(expectedStopDays, 10) || 7 : 7,
            is_closed: false
          })
          .select('id')
          .single()
        if (injErr || !newInjury) throw injErr || new Error('Creazione infortunio fallita')
        let ricontrolloDate = visitDate
        let ricontrolloTime: string | null = visitTime || null
        if (pendingRicontrollo && typeof pendingRicontrollo === 'object' && pendingRicontrollo.type === 'solo_data') {
          ricontrolloDate = pendingRicontrollo.date
          ricontrolloTime = null
        } else if (pendingRicontrollo && typeof pendingRicontrollo === 'object' && pendingRicontrollo.type === 'data_ora') {
          ricontrolloDate = pendingRicontrollo.date
          ricontrolloTime = pendingRicontrollo.time || null
        } else if (pendingRicontrollo === 'no') {
          ricontrolloDate = visitDate
          ricontrolloTime = visitTime || null
        }
        const actRow: Record<string, unknown> = {
          injury_id: newInjury.id,
          activity_type: 'medical_visit',
          activity_description: 'Prima visita',
          activity_date: visitDate,
          ricontrollo: ricontrolloDate,
          ricontrollo_time: ricontrolloTime,
          activity_time: visitTime || null,
          operator_name: op,
          stato_visita: statoVisita === 'da_confermare' ? null : statoVisita,
          richiesta_fisioterapia: richiestaFisioterapia,
          notes: notes.trim(),
          can_play_field: canPlayField,
          can_play_gym: canPlayGym,
          expected_stop_days: expectedStopDays ? parseInt(expectedStopDays, 10) : null
        }
        const { error: actErr } = await supabase.from('injury_activities').insert(actRow)
        if (actErr) throw actErr
        const { error: delErr } = await supabase.from('visit_list_entries').delete().eq('id', entryId)
        if (delErr) throw delErr
        onSuccess()
        onClose()
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Esito visita in lista</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {appointment && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 flex items-center gap-2">
              <User className="h-5 w-5 text-slate-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900 text-sm">{appointment.playerName}</div>
                <div className="text-xs text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">
                  {visitDate && new Date(visitDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {visitTime && ` • ${visitTime}`}
                  {appointment.activity_description && ` • ${appointment.activity_description}`}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">Cosa è emerso dalla visita?</label>
            <div className="flex flex-wrap gap-3">
              <label className="flex-1 min-w-[200px] flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition"
                style={{ borderColor: path === 'injury' ? '#0B1B3A' : '#e2e8f0', backgroundColor: path === 'injury' ? 'rgba(11,27,58,0.05)' : 'transparent' }}>
                <input type="radio" name="path" checked={path === 'injury'} onChange={() => setPath('injury')} className="w-4 h-4 shrink-0" />
                <div>
                  <span className="font-medium text-slate-900">Apri infortunio + prima visita</span>
                  <p className="text-xs text-slate-500 mt-0.5">Crea l&apos;infortunio e registra la visita con esito, referto, indirizzamento a fisio o ricontrollo.</p>
                </div>
              </label>
              <label className="flex-1 min-w-[200px] flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition"
                style={{ borderColor: path === 'no_injury' ? '#0B1B3A' : '#e2e8f0', backgroundColor: path === 'no_injury' ? 'rgba(11,27,58,0.05)' : 'transparent' }}>
                <input type="radio" name="path" checked={path === 'no_injury'} onChange={() => setPath('no_injury')} className="w-4 h-4 shrink-0" />
                <div>
                  <span className="font-medium text-slate-900">Nessun infortunio</span>
                  <p className="text-xs text-slate-500 mt-0.5">Ferma le visite o indirizza il giocatore ai fisioterapisti per cure preventive.</p>
                </div>
              </label>
            </div>
          </div>

          {path === 'no_injury' && (
            <div className="pl-4 border-l-2 border-slate-200 space-y-3">
              <label className="block text-sm font-medium text-slate-700">Azione</label>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="noInjury" checked={noInjuryAction === 'stop'} onChange={() => setNoInjuryAction('stop')} className="w-4 h-4" />
                  <span className="text-slate-900">Ferma ulteriori visite</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="noInjury" checked={noInjuryAction === 'physio_preventive'} onChange={() => setNoInjuryAction('physio_preventive')} className="w-4 h-4" />
                  <span className="text-slate-900">Indirizza a fisioterapia preventiva</span>
                </label>
              </div>
              {noInjuryAction === 'physio_preventive' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Operatore <span className="text-red-500">*</span></label>
                    <select value={operatorName} onChange={e => { setOperatorName(e.target.value); setOperatorOther('') }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500">
                      <option value="">Seleziona</option>
                      {medicalStaff.map(s => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                      <option value="Altro">Altro</option>
                    </select>
                    {operatorName === 'Altro' && (
                      <input type="text" value={operatorOther} onChange={e => setOperatorOther(e.target.value)} placeholder="Nome operatore" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500" />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Eventuali note..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500" />
                  </div>
                </>
              )}
            </div>
          )}

          {path === 'injury' && (
            <div className="pl-4 border-l-2 border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Operatore <span className="text-red-500">*</span></label>
                  <select value={operatorName} onChange={e => { setOperatorName(e.target.value); setOperatorOther('') }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500">
                    <option value="">Seleziona</option>
                    {medicalStaff.map(s => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                    <option value="Altro">Altro</option>
                  </select>
                  {operatorName === 'Altro' && (
                    <input type="text" value={operatorOther} onChange={e => setOperatorOther(e.target.value)} placeholder="Nome operatore" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo infortunio <span className="text-red-500">*</span></label>
                  <input type="text" value={injuryType} onChange={e => setInjuryType(e.target.value)} placeholder="Es. Distorsione, Contusione..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Parte del corpo <span className="text-red-500">*</span></label>
                  <input type="text" value={bodyPart} onChange={e => setBodyPart(e.target.value)} placeholder="Es. Ginocchio, Caviglia, Mano..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Causa <span className="text-red-500">*</span></label>
                  <select value={cause} onChange={e => setCause(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500">
                    {CAUSE_OPTIONS.map(o => <option key={o.value || '_'} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stato visita</label>
                  <select value={statoVisita} onChange={e => setStatoVisita(e.target.value as 'da_confermare' | 'eseguito' | 'assente')} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500">
                    <option value="da_confermare">Da confermare</option>
                    <option value="eseguito">Eseguito</option>
                    <option value="assente">Assente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Referto <span className="text-red-500">*</span></label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Esito della visita, diagnosi, indicazioni..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500" />
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={canPlayField} onChange={e => setCanPlayField(e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm text-slate-900">Autorizzato campo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={canPlayGym} onChange={e => setCanPlayGym(e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm text-slate-900">Autorizzato palestra</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={richiestaFisioterapia} onChange={e => setRichiestaFisioterapia(e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm text-slate-900">Indirizza a fisioterapia</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Previsione gg stop</label>
                <input type="number" value={expectedStopDays} onChange={e => setExpectedStopDays(e.target.value)} min={0} placeholder="0" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 max-w-[140px]" />
              </div>
              {statoVisita === 'eseguito' && notes.trim() && (
                <div>
                  <button type="button" onClick={() => setShowRicontrolloModal(true)} className="w-full inline-flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-100 transition-colors">
                    {pendingRicontrollo === 'no' ? 'Ricontrollo: No' : pendingRicontrollo?.type === 'solo_data' ? `Ricontrollo: ${new Date(pendingRicontrollo.date).toLocaleDateString('it-IT')}` : pendingRicontrollo?.type === 'data_ora' ? `Ricontrollo: ${new Date(pendingRicontrollo.date).toLocaleDateString('it-IT')} ${pendingRicontrollo.time}` : 'Fissa ricontrollo'}
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {showRicontrolloModal && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-2xl bg-black/60 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
              <p className="text-slate-800 mb-4 font-medium">Fissare Ricontrollo?</p>
              <div className="flex gap-2 flex-wrap justify-stretch">
                <button type="button" onClick={handleRicontrolloNo} className="flex-1 min-w-[80px] px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">No</button>
                <button type="button" onClick={handleRicontrolloDataOra} className="flex-1 min-w-[80px] px-3 py-2 text-sm font-medium text-white rounded-lg" style={{ background: 'linear-gradient(135deg, #0B1B3A 0%, #112B5C 60%)' }}>Sì, data e ora</button>
                <button type="button" onClick={handleRicontrolloSoloData} className="flex-1 min-w-[80px] px-3 py-2 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-700">Sì, solo data</button>
              </div>
            </div>
          </div>
        )}

        {showRicontrolloDatePicker && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-2xl bg-black/60 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
              <p className="text-slate-900 mb-3 font-medium">Data del giorno del ricontrollo</p>
              <input type="date" value={selectedRicontrolloDate} onChange={e => setSelectedRicontrolloDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 text-slate-900 bg-white" />
              {ricontrolloPickerMode === 'data_ora' && (
                <div className="mb-4">
                  <p className="text-slate-900 mb-2 font-medium">Orario</p>
                  <input type="time" value={selectedRicontrolloTime} onChange={e => setSelectedRicontrolloTime(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white" />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowRicontrolloDatePicker(false)} className="px-4 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Annulla</button>
                <button type="button" onClick={handleRicontrolloDateConfirm} disabled={!selectedRicontrolloDate} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0B1B3A 0%, #112B5C 60%)' }}>Conferma</button>
              </div>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition">
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white font-medium transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0B1B3A 0%, #112B5C 65%, #1f4aa3 150%)' }}
          >
            {loading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Salva
          </button>
        </div>
      </div>
    </div>
  )
}
