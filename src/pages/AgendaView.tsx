import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Activity, CalendarDays, CalendarPlus, CheckCircle2, Clock, Loader2, Save, Timer, User, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import Header from '@/components/Header'
import VisitListOutcomeModal from '@/components/VisitListOutcomeModal'
import InjuryActivityRow from '@/components/InjuryActivityRow'
import WeeklyCalendarView, { type AgendaItem } from '@/components/WeeklyCalendarView'
import { getUserIdByOperatorName, sendActivityUpdatedNotificationToUser, formatDateIt, type ActivityUpdatedPayload } from '@/lib/operatorNotifications'
import { toDateOnly } from '@/lib/dateUtils'
import { formatCurrency } from '@/utils/feeUtils'

/** Giorni tra due date (solo parte intera, senza ora). */
function daysBetween(dateStart: string, dateEnd: string): number {
  const a = new Date(dateStart.slice(0, 10))
  const b = new Date(dateEnd.slice(0, 10))
  const ms = b.getTime() - a.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}
import { checkOverlap, formatOverlapHardError, type OverlapActivity } from '@teamflow/shared'

type Appointment = {
  id: string
  date: string
  /** Data e orario della visita (per modifica: form mostra questi, non il ricontrollo) */
  activity_date: string
  activity_time: string | null
  ricontrollo_time: string | null
  /** Data di ricontrollo (se impostata); usata per "solo data" → orario da fissare in Attività da confermare */
  ricontrollo_date?: string | null
  duration_minutes: number | null
  massaggio: boolean
  tecar: boolean
  laser: boolean
  playerName: string
  operatorName: string
  activityType: string
  injury_id: string
  activity_type_raw: string
  person_id: string
  activity_description?: string | null
  confirmation_status?: string | null
  notes?: string | null
  cost?: number | null
  cost_currency?: string | null
  recheck_date?: string | null
  category_label?: string
  stato_visita?: string | null
  can_play_field?: boolean
  can_play_gym?: boolean
  richiesta_fisioterapia?: boolean
  expected_stop_days?: number | null
  /** Id dell'attività injury_activities parent (per voci ricontrollo → aggiorna ricontrollo_time) */
  sourceActivityId?: string
}

/** Restituisce l’etichetta TIPOLOGIA: per Fisioterapia i trattamenti, per Visita medica il tipo (Ricontrollo, Chiusura, ecc.). */
/** Tipi attività (FlowMe + web app). */
const ACTIVITY_TYPE_OPTIONS = [
  { value: 'medical_visit', label: 'Visita Medica' },
  { value: 'physiotherapy', label: 'Fisioterapia' },
  { value: 'test', label: 'Test/Esame' },
  { value: 'note', label: 'Annotazione' },
  { value: 'insurance_refund', label: 'Rimborso Assicurativo' },
  { value: 'equipment_purchase', label: 'Acquisto Attrezzatura' },
  { value: 'expenses', label: 'Spese Sostenute' },
  { value: 'other', label: 'Altro' }
] as const

/** Descrizione visita (solo se tipo = Visita Medica). */
const VISIT_DESCRIPTION_OPTIONS = [
  { value: 'prima_visita', label: 'Prima visita' },
  { value: 'visita_controllo', label: 'Visita di controllo' },
  { value: 'visita_chiusura', label: 'Visita di chiusura' }
] as const

const CURRENCY_OPTIONS = [{ value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }, { value: 'GBP', label: 'GBP' }] as const

/** Restituisce l'etichetta italiana del tipo attività. */
function getActivityTypeLabel(
  raw: string,
  dynamicTypes?: Array<{ code: string; name: string }>
): string {
  const code = (raw || '').trim()
  const fromDb = dynamicTypes?.find(t => t.code === code)
  if (fromDb) return fromDb.name
  const r = code.toLowerCase()
  if (r === 'medical_visit' || r === 'visita medica' || r === 'visita_medica') return 'Visita medica'
  if (r === 'visita_specialistica') return 'Visita Specialistica'
  if (r === 'physiotherapy' || r === 'fisioterapia') return 'Fisioterapia'
  if (r === 'test' || r === 'spesa_esami_diagnostici') return r === 'spesa_esami_diagnostici' ? 'Spesa Esami diagnostici' : 'Test/Esame'
  if (r === 'note' || r === 'annotazione') return r === 'annotazione' ? 'Annotazione' : 'Annotazione'
  if (r === 'insurance_refund') return 'Rimborso Assicurativo'
  if (r === 'insurance_communication') return 'Comunicazione assicurazione'
  if (r === 'equipment_purchase' || r === 'acquisto_tutore') return r === 'acquisto_tutore' ? 'Acquisto Tutore' : 'Acquisto Attrezzatura'
  if (r === 'expenses') return 'Spese Sostenute'
  if (r === 'other' || r === 'altro') return 'Altro'
  return code || '—'
}

function isMedicalVisitType(code: string): boolean {
  const r = (code || '').trim().toLowerCase()
  return r === 'medical_visit' || r === 'visita_medica' || r === 'visita_specialistica'
}

function isPhysiotherapyType(code: string): boolean {
  return (code || '').trim().toLowerCase() === 'physiotherapy'
}

function isPurchaseActivityType(code: string): boolean {
  const r = (code || '').trim().toLowerCase()
  return r === 'acquisto_tutore' || r === 'equipment_purchase'
}

function isInsuranceRefundType(code: string): boolean {
  return (code || '').trim().toLowerCase() === 'insurance_refund'
}

function resolveOperatorName(operatorName: string, operatorOther: string): string {
  if (operatorName === 'Altro') return operatorOther.trim() || 'Altro'
  return operatorName.trim()
}

const CONFERMA_OPZIONI = [
  { value: '', label: 'Non confermato' },
  { value: 'eseguita', label: 'Eseguita' },
  { value: 'assente', label: 'Assente' },
  { value: 'altro', label: 'Altro' }
] as const

function getTipologiaLabel(apt: Appointment): string {
  if (apt.activityType === 'Fisioterapia' || apt.activity_type_raw === 'physiotherapy') {
    const parts = [apt.massaggio && 'Massaggio', apt.tecar && 'Tecar', apt.laser && 'Laser'].filter(Boolean) as string[]
    return parts.length ? parts.join(', ') : '—'
  }
  const d = (apt.activity_description || '').trim()
  if (!d) return '—'
  if (d.toUpperCase().includes('CHIUSURA')) return 'Chiusura'
  if (d.toUpperCase().includes('PRIMA VISITA')) return 'Prima visita'
  if (d.toUpperCase().includes('CONTROLLO') || d.toUpperCase().includes('RICONTROLLO')) return 'Ricontrollo'
  if (d === 'Visita medica / Ricontrollo' || d === 'Visita di controllo') return 'Ricontrollo'
  return d
}

/** Mostra solo abbreviazioni: u14, u16, u18, C, B. Non mostra Senior/Seniores. SERIE_C → C, SERIE_B → B. */
function abbreviateCategoryLabel(label: string): string {
  if (!label?.trim()) return '—'
  const parts = label.split(',').map(p => p.trim()).filter(Boolean)
  const abbrev: string[] = []
  for (const p of parts) {
    const upper = p.toUpperCase()
    if (/^Under\s+14$/i.test(p) || upper === 'U14') abbrev.push('u14')
    else if (/^Under\s+16$/i.test(p) || upper === 'U16') abbrev.push('u16')
    else if (/^Under\s+18$/i.test(p) || upper === 'U18') abbrev.push('u18')
    else if (/^Serie\s+C$/i.test(p) || upper === 'SERIE_C') abbrev.push('C')
    else if (/^Serie\s+B$/i.test(p) || upper === 'SERIE_B') abbrev.push('B')
    /* Senior, Seniores, SENIORES: non mostrati */
  }
  return abbrev.length ? abbrev.join(', ') : '—'
}

/** Colore tag circolare categoria (stile app mobile: u14 viola, u18 rosso, C verde, B blu). */
function getCategoryTagColor(abbrev: string): string {
  const first = (abbrev || '—').split(',')[0].trim().toLowerCase()
  if (first === 'u14') return 'bg-violet-500'
  if (first === 'u16') return 'bg-amber-500'
  if (first === 'u18') return 'bg-red-500'
  if (first === 'c') return 'bg-emerald-500'
  if (first === 'b') return 'bg-blue-600'
  return 'bg-slate-500'
}

/** Colore sfondo filtri categoria quando selezionati: Tutti = bianco + font blu scuro, altri = colore categoria. */
function getCategoryFilterSelectedStyle(catId: string): string {
  if (catId === 'all') return 'bg-white text-slate-800'
  if (catId === 'u14') return 'bg-violet-500 text-white'
  if (catId === 'u16') return 'bg-amber-500 text-white'
  if (catId === 'u18') return 'bg-red-500 text-white'
  if (catId === 'C') return 'bg-emerald-500 text-white'
  if (catId === 'B') return 'bg-blue-600 text-white'
  return 'bg-slate-500 text-white'
}

/** Ordine categoria per sort: u14 < u16 < u18 < C < B. Restituisce il minimo se multipla. */
function getCategorySortOrder(label: string): number {
  const abbrev = abbreviateCategoryLabel(label || '')
  if (!abbrev || abbrev === '—') return 99
  const parts = abbrev.split(',').map(p => p.trim()).filter(Boolean)
  let min = 99
  for (const p of parts) {
    if (p === 'u14') min = Math.min(min, 0)
    else if (p === 'u16') min = Math.min(min, 1)
    else if (p === 'u18') min = Math.min(min, 2)
    else if (p === 'C') min = Math.min(min, 3)
    else if (p === 'B') min = Math.min(min, 4)
  }
  return min === 99 ? 99 : min
}

/** Impegno "cospicuo" = attività già svolta (activity_date passata) e ancora da refertare (visita senza esito) o da confermare (fisio senza stato). */
function isCospicuo(apt: Appointment, today: string): boolean {
  const dataSvolta = apt.activity_date || apt.date
  if (!dataSvolta || dataSvolta >= today) return false
  const isVisit = apt.activityType === 'Visita medica' || apt.activity_type_raw === 'medical_visit'
  const isPhysio = apt.activityType === 'Fisioterapia' || apt.activity_type_raw === 'physiotherapy'
  if (isVisit) return !(apt.stato_visita === 'eseguito' || apt.stato_visita === 'assente')
  if (isPhysio) return !(apt.confirmation_status?.trim())
  return false
}

/** Attività "solo data" = ricontrollo con data ma senza orario → il responsabile fisserà l'orario nel giorno della riprogrammazione. */
function isSoloDataDaConfermare(apt: Appointment): boolean {
  return !!(apt.ricontrollo_date && (apt.ricontrollo_time == null || apt.ricontrollo_time === ''))
}

const NAVY = '#0B1B3A'
const NAVY_2 = '#112B5C'

/** Palette Goleee – allineata ad Alert, Memo, Compleanni */
const GOLEE = {
  surface: '#FFFFFF',
  surfaceMuted: '#F4F6F8',
  border: '#E8ECF0',
  text: '#1A2332',
  textMuted: '#6B7280',
  accent: '#00C48C',
  accentSoft: '#E6FAF3',
  accentHover: '#00A876',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  success: '#10B981',
  successSoft: '#ECFDF5',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
} as const

const AIRTABLE = {
  border: '#E8ECF0',
  headerBg: '#FAFBFC',
  headerText: '#6B7280',
  rowBg: '#FFFFFF',
  rowHover: '#F4F6F8',
  icon: '#9CA3AF',
  iconHover: '#374151',
} as const

const thCell = (align: 'left' | 'center' | 'right' = 'left') => ({
  padding: '10px 12px',
  textAlign: align,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  color: AIRTABLE.headerText,
  borderBottom: `1px solid ${AIRTABLE.border}`,
  backgroundColor: AIRTABLE.headerBg,
  verticalAlign: 'middle' as const,
})

const tdCell = (align: 'left' | 'center' | 'right' = 'left') => ({
  padding: '6px 12px',
  textAlign: align,
  color: GOLEE.text,
  borderBottom: `1px solid ${AIRTABLE.border}`,
  verticalAlign: 'middle' as const,
  fontSize: '18px',
})

function SeverityBadge({ severity }: { severity: string }) {
  const style =
    severity === 'Grave'
      ? { bg: GOLEE.dangerSoft, text: GOLEE.danger }
      : severity === 'Moderato'
        ? { bg: GOLEE.warningSoft, text: GOLEE.warning }
        : { bg: GOLEE.successSoft, text: GOLEE.success }
  return (
    <span
      className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {severity}
    </span>
  )
}

/** Colore sfondo filtri categoria (tema chiaro Goleee). */
function getCategoryFilterSelectedStyleLight(catId: string): string {
  if (catId === 'all') return 'bg-slate-800 text-white shadow-sm'
  if (catId === 'u14') return 'bg-violet-500 text-white shadow-sm'
  if (catId === 'u16') return 'bg-amber-500 text-white shadow-sm'
  if (catId === 'u18') return 'bg-red-500 text-white shadow-sm'
  if (catId === 'C') return 'bg-emerald-500 text-white shadow-sm'
  if (catId === 'B') return 'bg-blue-600 text-white shadow-sm'
  return 'bg-slate-500 text-white shadow-sm'
}

interface AgendaViewProps {
  embedInLayout?: boolean
}

export default function AgendaView({ embedInLayout = false }: AgendaViewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const injuryIdFromUrl = searchParams.get('injuryId')
  const addFromUrl = searchParams.get('add') === '1'
  const typeFromUrl = searchParams.get('type')
  const editActivityIdFromUrl = searchParams.get('editActivity')
  /** Quando true, la pagina è aperta in iframe dalla scheda giocatore: mostra solo il modal, senza navigare. */
  const embedFromUrl = searchParams.get('embed') === '1'

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAttivita, setFilterAttivita] = useState('')
  const [filterTipologia, setFilterTipologia] = useState('')
  const [filterOperatore, setFilterOperatore] = useState('')
  const [filterGiocatore, setFilterGiocatore] = useState('')
  const tabFromUrl = searchParams.get('tab') as 'aperti' | 'attivita' | 'agenda' | 'confermare' | 'chiusura' | 'chiusi' | 'assente' | null
  const categoryFromUrl = searchParams.get('category')
  const expandFromUrl = searchParams.get('expand')
  const [activeTab, setActiveTab] = useState<'aperti' | 'attivita' | 'agenda' | 'confermare' | 'chiusura' | 'chiusi' | 'assente'>(
    (tabFromUrl && ['aperti', 'attivita', 'agenda', 'confermare', 'chiusura', 'chiusi', 'assente'].includes(tabFromUrl)) ? tabFromUrl : 'aperti'
  )
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (categoryFromUrl && ['all', 'u14', 'u16', 'u18', 'C', 'B'].includes(categoryFromUrl)) return categoryFromUrl
    return 'all'
  })
  const [openInjuries, setOpenInjuries] = useState<Array<{
    id: string
    person_id: string
    injury_type: string
    body_part?: string | null
    injury_date: string
    in_chiusura?: boolean
    person_name: string
    severity?: string
    expected_weeks_off?: number
    duration_days?: number
    category_label: string
    cause?: string | null
    current_status?: string
  }>>([])
  const [loadingOpenInjuries, setLoadingOpenInjuries] = useState(false)
  /** Id infortunio aperto nella tab "Infortuni aperti" per cui mostrare l'accordion sotto la riga */
  const [expandedOpenInjuryId, setExpandedOpenInjuryId] = useState<string | null>(expandFromUrl)
  /** Attività per infortunio (caricate al expand), key = injury_id */
  const [injuryActivitiesByInjuryId, setInjuryActivitiesByInjuryId] = useState<Record<string, Array<{
    id: string
    activity_type: string
    activity_date: string
    operator_name?: string | null
    duration_minutes?: number | null
    activity_description?: string | null
    notes?: string | null
    amount?: number | null
    cost?: number | null
    massaggio?: boolean
    tecar?: boolean
    laser?: boolean
    created_at: string
  }>>>({})
  const [closedInjuries, setClosedInjuries] = useState<Array<{
    id: string
    person_id: string
    injury_type: string
    body_part?: string | null
    injury_date: string
    closing_date?: string
    person_name: string
    category_label: string
  }>>([])
  const [loadingClosedInjuries, setLoadingClosedInjuries] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ id: string; label: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  /** Form unificato: stesso modal per nuova attività e modifica (anche dalla scheda persona). */
  const [activityForm, setActivityForm] = useState({
    injury_id: null as string | null,
    activity_type: 'physiotherapy',
    activity_description: '',
    date: '',
    activity_time: '',
    cost: '',
    cost_currency: 'EUR',
    operator_name: '',
    operator_other: '',
    duration_minutes: '',
    notes: '',
    recheck_date: '',
    massaggio: false,
    tecar: false,
    laser: false,
    confirmation_status: '',
    stato_visita: '' as '' | 'eseguito' | 'assente',
    can_play_field: false,
    can_play_gym: false,
    richiesta_fisioterapia: false,
    expected_stop_days: ''
  })
  const [medicalStaff, setMedicalStaff] = useState<Array<{ id: string; full_name: string; roles: string[] }>>([])
  const [savingActivity, setSavingActivity] = useState(false)
  const [notificationChoiceModal, setNotificationChoiceModal] = useState<{
    operatorName: string
    playerName: string
    payload: ActivityUpdatedPayload
  } | null>(null)
  const [sendingNotification, setSendingNotification] = useState(false)
  const [overlapConfirmModal, setOverlapConfirmModal] = useState<{ message: string } | null>(null)
  const [createOverlapConfirmModal, setCreateOverlapConfirmModal] = useState<{ message: string } | null>(null)
  const [showRicontrolloModal, setShowRicontrolloModal] = useState(false)
  const [showRicontrolloDatePicker, setShowRicontrolloDatePicker] = useState(false)
  const [selectedRicontrolloDate, setSelectedRicontrolloDate] = useState('')
  const [ricontrolloModalFromButton, setRicontrolloModalFromButton] = useState(false)
  const [ricontrolloDatePickerFromButton, setRicontrolloDatePickerFromButton] = useState(false)
  const [pendingRicontrolloChoice, setPendingRicontrolloChoice] = useState<null | 'no' | 'data_ora' | { type: 'solo_data'; date: string }>(null)
  const [visitListOutcomeAppointment, setVisitListOutcomeAppointment] = useState<Appointment | null>(null)
  const [injuryActivityTypes, setInjuryActivityTypes] = useState<Array<{ id: string; name: string; code: string; sort_order: number }>>([])

  const activityTypeOptions = useMemo(
    () => (injuryActivityTypes.length > 0
      ? injuryActivityTypes.map(t => ({ value: t.code, label: t.name }))
      : ACTIVITY_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))),
    [injuryActivityTypes]
  )

  const formatActivityType = useCallback(
    (code: string) => getActivityTypeLabel(code, injuryActivityTypes),
    [injuryActivityTypes]
  )

  const loadInjuryActivityTypes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('injury_activity_types')
        .select('id, name, code, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (!error && data?.length) {
        setInjuryActivityTypes(data as Array<{ id: string; name: string; code: string; sort_order: number }>)
      }
    } catch {
      // Tabella assente: si usano i tipi predefiniti
    }
  }, [])

  useEffect(() => {
    loadInjuryActivityTypes()
  }, [loadInjuryActivityTypes])

  const isEditMode = !!editingAppointment
  const activityFormValidation = useMemo(() => {
    const errors: string[] = []
    const isRefund = isInsuranceRefundType(activityForm.activity_type)
    if (!isEditMode && !activityForm.injury_id) errors.push('Seleziona il giocatore (infortunio)')
    const op = resolveOperatorName(activityForm.operator_name, activityForm.operator_other)
    if (!isRefund && !op) errors.push('Seleziona un operatore')
    if (!activityForm.date.trim()) errors.push('Seleziona una data')
    if (isRefund) {
      const amount = parseFloat(activityForm.cost)
      if (!activityForm.cost.trim() || isNaN(amount) || amount <= 0) errors.push('Inserisci l\'importo del rimborso')
    }
    if (isPhysiotherapyType(activityForm.activity_type) && !(activityForm.massaggio || activityForm.tecar || activityForm.laser)) errors.push('Seleziona almeno un trattamento (Fisioterapia)')
    if (activityForm.confirmation_status === 'altro' && !activityForm.notes?.trim()) errors.push('Note obbligatorie quando conferma è "Altro"')
    if (isMedicalVisitType(activityForm.activity_type)) {
      if (!(activityForm.stato_visita === 'eseguito' || activityForm.stato_visita === 'assente')) errors.push('Seleziona lo Stato (Eseguito o Assente)')
      if (!activityForm.notes?.trim()) errors.push('Compilare il Referto')
      if (activityForm.activity_description === 'prima_visita') {
        const stopDays = activityForm.expected_stop_days?.trim()
        if (!stopDays || isNaN(parseInt(stopDays, 10)) || parseInt(stopDays, 10) < 0) errors.push('Indicare i giorni di Previsione Stop')
      }
    }
    return { errors, ok: errors.length === 0 }
  }, [isEditMode, activityForm.injury_id, activityForm.operator_name, activityForm.operator_other, activityForm.date, activityForm.activity_type, activityForm.activity_description, activityForm.massaggio, activityForm.tecar, activityForm.laser, activityForm.confirmation_status, activityForm.notes, activityForm.stato_visita, activityForm.expected_stop_days, activityForm.cost])

  const loadMedicalStaff = useCallback(async () => {
    try {
      const { data: rolesData } = await supabase.from('user_roles').select('id, name').in('name', ['Medico', 'Fisio', 'Fisioterapista'])
      const medicalRoleIds = rolesData?.map((r: { id: string }) => r.id) || []
      const medicalRoleNames = ['Medico', 'Fisio', 'Fisioterapista']
      if (medicalRoleIds.length === 0) {
        setMedicalStaff([])
        return
      }
      const findRole = (idOrName: string): { id: string; name: string } | undefined => {
        const rById = rolesData?.find((r: { id: string }) => r.id === idOrName)
        if (rById) return rById
        const lower = String(idOrName).toLowerCase()
        if (lower === 'medico') return rolesData?.find((r: { name: string }) => r.name === 'Medico')
        if (lower === 'fisio' || lower === 'fisioterapista') return rolesData?.find((r: { name: string }) => r.name === 'Fisioterapista') || rolesData?.find((r: { name: string }) => r.name === 'Fisio')
        return rolesData?.find((r: { name: string }) => r.name === idOrName || String(idOrName).toLowerCase() === r.name.toLowerCase())
      }
      const toRoleArray = (val: unknown): string[] => {
        if (Array.isArray(val)) return val.map(String)
        if (val == null || val === '') return []
        if (typeof val === 'string') {
          const trimmed = val.trim()
          if (trimmed.startsWith('[')) {
            try { return (JSON.parse(trimmed) as unknown[]).map(String) } catch { return [trimmed] }
          }
          return [trimmed]
        }
        return [String(val)]
      }
      const { data: people } = await supabase.from('people').select('id, full_name, staff_roles, app_role, additional_roles').not('full_name', 'is', null).order('full_name')
      const hasMedicalRole = (p: { staff_roles?: unknown; app_role?: unknown; additional_roles?: unknown }) => {
        const staffArr = toRoleArray(p.staff_roles)
        if (staffArr.some((x: string) => medicalRoleIds.includes(x) || ['medico', 'fisio', 'fisioterapista'].includes(x.toLowerCase()))) return true
        if (p.app_role != null && p.app_role !== '' && (medicalRoleIds.includes(String(p.app_role)) || ['medico', 'fisio', 'fisioterapista'].includes(String(p.app_role).toLowerCase()))) return true
        const addArr = toRoleArray(p.additional_roles)
        if (addArr.some((x: string) => medicalRoleIds.includes(x) || ['medico', 'fisio', 'fisioterapista'].includes(x.toLowerCase()))) return true
        return false
      }
      const filtered = (people || []).filter(hasMedicalRole).map((p: any) => {
        const staffArr = toRoleArray(p.staff_roles)
        const personMedicalRoles: Array<{ id: string; name: string }> = []
        staffArr.forEach((roleIdOrName: string) => {
          const r = findRole(roleIdOrName)
          if (r && medicalRoleNames.includes(r.name) && !personMedicalRoles.some(m => m.id === r.id)) personMedicalRoles.push(r)
        })
        if (p.app_role != null && p.app_role !== '') {
          const r = findRole(String(p.app_role))
          if (r && !personMedicalRoles.some(m => m.id === r.id)) personMedicalRoles.push(r)
        }
        toRoleArray(p.additional_roles).forEach((roleIdOrName: string) => {
          const r = findRole(roleIdOrName)
          if (r && medicalRoleNames.includes(r.name) && !personMedicalRoles.some(m => m.id === r.id)) personMedicalRoles.push(r)
        })
        const roles: string[] = []
        personMedicalRoles.forEach((r: { name: string }) => {
          if (r.name === 'Medico' && !roles.includes('Medico')) roles.push('Medico')
          if ((r.name === 'Fisio' || r.name === 'Fisioterapista') && !roles.includes('Fisioterapista')) roles.push('Fisioterapista')
        })
        return { id: p.id, full_name: p.full_name || '', roles }
      })
      setMedicalStaff(filtered)
    } catch {
      setMedicalStaff([])
    }
  }, [])

  // Sincronizza activeTab con parametro URL (es. da dashboard ?tab=confermare)
  useEffect(() => {
    if (tabFromUrl && ['aperti', 'attivita', 'agenda', 'confermare', 'chiusura', 'chiusi', 'assente'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  useEffect(() => {
    if (categoryFromUrl && ['all', 'u14', 'u16', 'u18', 'C', 'B'].includes(categoryFromUrl)) {
      setSelectedCategory(categoryFromUrl)
    }
  }, [categoryFromUrl])

  const buildInfermeriaReturnUrl = useCallback((injuryId: string) => {
    const params = new URLSearchParams()
    params.set('tab', activeTab)
    if (selectedCategory !== 'all') params.set('category', selectedCategory)
    params.set('expand', injuryId)
    return `/infortuni?${params.toString()}`
  }, [activeTab, selectedCategory])

  // add=1 rimane su /infortuni: il modal si apre via useEffect sotto (nessun redirect a /infortuni/nuovo)

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true)
      const start = new Date()
      start.setMonth(start.getMonth() - 6)
      const end = new Date()
      end.setMonth(end.getMonth() + 6)
      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]

      const [{ data: activities, error: actError }, { data: listEntries, error: listError }] = await Promise.all([
        supabase
          .from('injury_activities')
          .select('id, activity_date, ricontrollo, ricontrollo_time, activity_time, duration_minutes, massaggio, tecar, laser, operator_name, activity_type, activity_description, injury_id, notes, confirmation_status, cost, cost_currency, recheck_date, stato_visita, can_play_field, can_play_gym, richiesta_fisioterapia, expected_stop_days')
          .order('activity_date', { ascending: true }),
        supabase
          .from('visit_list_entries')
          .select('id, player_id, visit_date, assigned_time, notes')
          .gte('visit_date', startStr)
          .lte('visit_date', endStr)
      ])
      if (actError) throw actError
      if (listError) console.warn('visit_list_entries:', listError)

      const list: Appointment[] = []
      const personIds = new Set<string>()

      if (activities?.length) {
        const injuryIds = [...new Set(activities.map((a: { injury_id: string }) => a.injury_id))]
        const { data: injuries, error: injError } = await supabase.from('injuries').select('id, person_id').in('id', injuryIds)
        if (injError) throw injError
        ;(injuries || []).forEach((i: { person_id: string }) => personIds.add(i.person_id))
      }
      ;(listEntries || []).forEach((e: { player_id: string }) => personIds.add(e.player_id))

      const { data: people, error: peopleError } = await supabase.from('people').select('id, full_name, player_categories').in('id', [...personIds])
      if (peopleError) throw peopleError
      const { data: categories } = await supabase.from('categories').select('id, name, code')
      const categoryById = Object.fromEntries((categories || []).map((c: { id: string; name?: string; code?: string }) => [c.id, (c.name || c.code || '—').trim()]))
      const personMap = Object.fromEntries((people || []).map((p: { id: string; full_name: string; player_categories?: string[] }) => {
        const catIds = Array.isArray(p.player_categories) ? p.player_categories : []
        const labels = catIds.map((id: string) => categoryById[id] || id).filter(Boolean)
        return [p.id, { name: p.full_name, category_label: labels.length ? labels.join(', ') : '—' }]
      }))

      const injuryIdsForAct = activities?.length ? [...new Set(activities.map((a: any) => a.injury_id))] : []
      const { data: injuriesData } = await supabase.from('injuries').select('id, person_id, is_closed')
      const injuriesList = injuriesData || []
      const injuryToPerson = Object.fromEntries(injuriesList.map((i: { id: string; person_id: string }) => [i.id, i.person_id]))
      const injuredPersonIds = new Set(injuriesList.filter((i: { is_closed?: boolean }) => !i.is_closed).map((i: { person_id: string }) => i.person_id))

      if (activities?.length) {
        activities.forEach((a: any) => {
          const personId = injuryToPerson[a.injury_id] || ''
          const personData = personMap[personId] as { name: string; category_label: string } | undefined
          const ricontrolloDate = a.ricontrollo ? toDateOnly(a.ricontrollo) : null
          const actDate = toDateOnly(a.activity_date) || ''
          const recheckDate = ricontrolloDate ? toDateOnly(ricontrolloDate) : null
          if (actDate && actDate >= startStr && actDate <= endStr) {
            list.push({
              id: a.id,
              date: actDate,
              activity_date: actDate,
              activity_time: a.activity_time ?? null,
              ricontrollo_time: a.activity_time ?? null,
              ricontrollo_date: ricontrolloDate,
              duration_minutes: a.duration_minutes ?? null,
              massaggio: a.massaggio ?? false,
              tecar: a.tecar ?? false,
              laser: a.laser ?? false,
              playerName: personData?.name || '—',
              operatorName: a.operator_name || '—',
              activityType: getActivityTypeLabel(a.activity_type),
              injury_id: a.injury_id,
              activity_type_raw: a.activity_type,
              person_id: personId,
              activity_description: a.activity_description ?? null,
              notes: a.notes ?? null,
              confirmation_status: a.confirmation_status ?? null,
              cost: a.cost ?? null,
              cost_currency: a.cost_currency ?? null,
              recheck_date: a.recheck_date ? toDateOnly(a.recheck_date) : null,
              category_label: personData?.category_label || '—',
              stato_visita: a.stato_visita ?? null,
              can_play_field: a.can_play_field ?? false,
              can_play_gym: a.can_play_gym ?? false,
              richiesta_fisioterapia: a.richiesta_fisioterapia ?? false,
              expected_stop_days: a.expected_stop_days ?? null
            })
          }
          if (recheckDate && recheckDate >= startStr && recheckDate <= endStr && recheckDate !== actDate) {
            list.push({
              id: `${a.id}-ricontrollo`,
              sourceActivityId: a.id,
              date: recheckDate,
              activity_date: recheckDate,
              activity_time: a.ricontrollo_time ?? a.activity_time ?? null,
              ricontrollo_time: a.ricontrollo_time ?? a.activity_time ?? null,
              ricontrollo_date: ricontrolloDate,
              duration_minutes: a.duration_minutes ?? null,
              massaggio: a.massaggio ?? false,
              tecar: a.tecar ?? false,
              laser: a.laser ?? false,
              playerName: personData?.name || '—',
              operatorName: a.operator_name || '—',
              activityType: getActivityTypeLabel(a.activity_type),
              injury_id: a.injury_id,
              activity_type_raw: a.activity_type,
              person_id: personId,
              activity_description: a.activity_description ?? null,
              notes: a.notes ?? null,
              confirmation_status: a.confirmation_status ?? null,
              cost: a.cost ?? null,
              cost_currency: a.cost_currency ?? null,
              recheck_date: a.recheck_date ? toDateOnly(a.recheck_date) : null,
              category_label: personData?.category_label || '—',
              stato_visita: a.stato_visita ?? null,
              can_play_field: a.can_play_field ?? false,
              can_play_gym: a.can_play_gym ?? false,
              richiesta_fisioterapia: a.richiesta_fisioterapia ?? false,
              expected_stop_days: a.expected_stop_days ?? null
            })
          }
        })
      }

      ;(listEntries || []).forEach((e: { id: string; player_id: string; visit_date: string; assigned_time: string | null; notes?: string | null }) => {
        if (injuredPersonIds.has(e.player_id)) return
        const visitDate = (e.visit_date || '').split('T')[0]
        if (!visitDate || visitDate < startStr || visitDate > endStr) return
        const personData = personMap[e.player_id] as { name: string; category_label: string } | undefined
        const timeStr = e.assigned_time ? String(e.assigned_time).substring(0, 5) : null
        list.push({
          id: `vle-${e.id}`,
          date: visitDate,
          activity_date: visitDate,
          activity_time: timeStr,
          ricontrollo_time: timeStr,
          ricontrollo_date: null,
          duration_minutes: null,
          massaggio: false,
          tecar: false,
          laser: false,
          playerName: personData?.name || '—',
          operatorName: '—',
          activityType: 'Visita in lista',
          injury_id: '',
          activity_type_raw: 'visit_list',
          person_id: e.player_id,
          activity_description: timeStr ? ((e.notes || '').trim() || 'Visita in lista') : 'Visita in lista',
          notes: e.notes ?? null,
          confirmation_status: null,
          cost: null,
          cost_currency: null,
          recheck_date: null,
          category_label: personData?.category_label || '—',
          stato_visita: null,
          can_play_field: false,
          can_play_gym: false,
          richiesta_fisioterapia: false,
          expected_stop_days: null
        })
      })

      list.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      setAppointments(list)
    } catch (e) {
      console.error('Errore caricamento infortuni/attività:', e)
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [])

  /** Carica le attività di un singolo infortunio (per accordion in tab Infortuni aperti) */
  const loadActivitiesForInjury = useCallback(async (injuryId: string) => {
    try {
      const { data, error } = await supabase
        .from('injury_activities')
        .select('id, activity_type, activity_date, operator_name, duration_minutes, activity_description, notes, amount, cost, massaggio, tecar, laser, created_at')
        .eq('injury_id', injuryId)
        .order('activity_date', { ascending: false })
      if (error) throw error
      setInjuryActivitiesByInjuryId(prev => ({ ...prev, [injuryId]: (data || []) as any }))
    } catch (e) {
      console.error('Errore caricamento attività infortunio:', e)
      setInjuryActivitiesByInjuryId(prev => ({ ...prev, [injuryId]: [] }))
    }
  }, [])

  // Ripristina riga espansa da URL (deep link / ritorno da scheda giocatore)
  useEffect(() => {
    if (!expandFromUrl || openInjuries.length === 0) return
    if (!openInjuries.some((i) => i.id === expandFromUrl)) return
    setExpandedOpenInjuryId(expandFromUrl)
  }, [expandFromUrl, openInjuries])

  // Carica attività quando cambia l'infortunio espanso
  useEffect(() => {
    if (!expandedOpenInjuryId) return
    loadActivitiesForInjury(expandedOpenInjuryId)
  }, [expandedOpenInjuryId, loadActivitiesForInjury])

  const loadOpenInjuries = useCallback(async () => {
    try {
      setLoadingOpenInjuries(true)
      let injuries: Array<{ id: string; person_id: string; injury_type: string; body_part?: string | null; injury_date: string; in_chiusura?: boolean; severity?: string; expected_weeks_off?: number; duration_days?: number; cause?: string | null; current_status?: string }> = []
      const { data: dataFull, error: err1 } = await supabase
        .from('injuries')
        .select('id, person_id, injury_type, body_part, injury_date, in_chiusura, severity, expected_weeks_off, duration_days, cause, current_status')
        .eq('is_closed', false)
        .order('injury_date', { ascending: false })
      if (!err1 && dataFull) {
        injuries = dataFull as typeof injuries
      } else {
        const { data: dataBasic, error: err2 } = await supabase
          .from('injuries')
          .select('id, person_id, injury_type, body_part, injury_date')
          .eq('is_closed', false)
          .order('injury_date', { ascending: false })
        if (!err2 && dataBasic) injuries = (dataBasic as Array<{ id: string; person_id: string; injury_type: string; body_part?: string | null; injury_date: string }>).map(i => ({ ...i, in_chiusura: false, severity: undefined, expected_weeks_off: undefined, duration_days: undefined, cause: null, current_status: undefined }))
      }
      const personIds = [...new Set(injuries.map(i => i.person_id))]
      const { data: people } = await supabase.from('people').select('id, full_name, player_categories').in('id', personIds)
      const { data: categories } = await supabase.from('categories').select('id, name, code')
      const categoryById = Object.fromEntries((categories || []).map((c: { id: string; name?: string; code?: string }) => [c.id, (c.name || c.code || '—').trim()]))
      const personMap = Object.fromEntries((people || []).map((p: { id: string; full_name: string; player_categories?: string[] }) => {
        const catIds = Array.isArray(p.player_categories) ? p.player_categories : []
        const labels = catIds.map((id: string) => categoryById[id] || id).filter(Boolean)
        return [p.id, { name: p.full_name, category_label: labels.length ? labels.join(', ') : '—' }]
      }))
      setOpenInjuries(injuries.map(i => ({
        id: i.id,
        person_id: i.person_id,
        injury_type: i.injury_type,
        body_part: i.body_part ?? null,
        injury_date: i.injury_date,
        in_chiusura: i.in_chiusura ?? false,
        person_name: (personMap[i.person_id] as { name: string })?.name || '—',
        severity: i.severity,
        expected_weeks_off: i.expected_weeks_off,
        duration_days: (i as { duration_days?: number }).duration_days,
        category_label: (personMap[i.person_id] as { category_label: string })?.category_label || '—',
        cause: (i as { cause?: string | null }).cause ?? null,
        current_status: (i as { current_status?: string }).current_status ?? (i.in_chiusura ? 'In chiusura' : 'In corso')
      })))
    } catch (e) {
      console.error('Errore caricamento infortuni aperti:', e)
      setOpenInjuries([])
    } finally {
      setLoadingOpenInjuries(false)
    }
  }, [])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  useEffect(() => {
    loadMedicalStaff()
  }, [loadMedicalStaff])

  useEffect(() => {
    loadOpenInjuries()
  }, [loadOpenInjuries])

  const loadClosedInjuries = useCallback(async () => {
    setLoadingClosedInjuries(true)
    try {
      let injuries: Array<{ id: string; person_id: string; injury_type?: string; body_part?: string | null; injury_date: string; injury_closed_date?: string | null }> = []
      const { data, error } = await supabase
        .from('injuries')
        .select('id, person_id, injury_type, body_part, injury_date, injury_closed_date')
        .eq('is_closed', true)
        .order('injury_closed_date', { ascending: false })
      if (error) {
        const errMsg = String(error?.message || '')
        if (errMsg.includes('is_closed') || errMsg.includes('column') || errMsg.includes('does not exist')) {
          const { data: fallback } = await supabase
            .from('injuries')
            .select('id, person_id, injury_type, body_part, injury_date, updated_at')
            .eq('current_status', 'Guarito')
            .order('updated_at', { ascending: false })
          injuries = ((fallback || []) as any[]).map((i: { id: string; person_id: string; injury_date: string; updated_at?: string }) => ({
            id: i.id,
            person_id: i.person_id,
            injury_date: i.injury_date,
            injury_closed_date: i.updated_at ? i.updated_at.slice(0, 10) : null
          } as any))
        } else throw error
      } else {
        injuries = data || []
      }
      if (!injuries.length) {
        setClosedInjuries([])
        setLoadingClosedInjuries(false)
        return
      }
      const personIds = [...new Set(injuries.map(i => i.person_id))]
      const { data: people } = await supabase.from('people').select('id, full_name, player_categories').in('id', personIds)
      const { data: categories } = await supabase.from('categories').select('id, name, code')
      const categoryById = Object.fromEntries((categories || []).map((c: { id: string; name?: string; code?: string }) => [c.id, (c.name || c.code || '—').trim()]))
      const personMap = Object.fromEntries((people || []).map((p: { id: string; full_name: string; player_categories?: string[] }) => {
        const catIds = Array.isArray(p.player_categories) ? p.player_categories : []
        const labels = catIds.map((id: string) => categoryById[id] || id).filter(Boolean)
        return [p.id, { name: p.full_name, category_label: labels.length ? labels.join(', ') : '—' }]
      }))
      setClosedInjuries(injuries.map(i => ({
        id: i.id,
        person_id: i.person_id,
        injury_type: i.injury_type,
        body_part: i.body_part ?? null,
        injury_date: i.injury_date,
        closing_date: i.injury_closed_date ?? null,
        person_name: (personMap[i.person_id] as { name: string })?.name || '—',
        category_label: (personMap[i.person_id] as { category_label: string })?.category_label || '—'
      })))
    } catch (e) {
      console.error('Errore caricamento infortuni chiusi:', e)
      setClosedInjuries([])
    } finally {
      setLoadingClosedInjuries(false)
    }
  }, [])

  useEffect(() => {
    loadClosedInjuries()
  }, [loadClosedInjuries])

  useEffect(() => {
    if (addFromUrl && injuryIdFromUrl && openInjuries.length > 0) {
      setShowCreateModal(true)
      const type = (typeFromUrl || 'physiotherapy').trim() || 'physiotherapy'
      const isRefund = isInsuranceRefundType(type)
      setActivityForm(prev => ({
        ...prev,
        injury_id: injuryIdFromUrl,
        activity_type: type,
        activity_description: isMedicalVisitType(type) ? 'prima_visita' : prev.activity_description,
        date: new Date().toISOString().split('T')[0],
        cost: isRefund ? '' : prev.cost,
        operator_name: isRefund ? '' : prev.operator_name,
        operator_other: isRefund ? '' : prev.operator_other,
        notes: isRefund ? '' : prev.notes,
        stato_visita: '',
        can_play_field: false,
        can_play_gym: false,
        richiesta_fisioterapia: false,
        expected_stop_days: ''
      }))
      loadMedicalStaff()
    }
  }, [addFromUrl, injuryIdFromUrl, typeFromUrl, openInjuries.length, loadMedicalStaff])

  // Previsione gg Stop: calcolo automatico (giorni aperti infortunio − giorni già trascorsi dalla data infortunio alla data attività)
  // Modificabile solo in "Prima visita"; per le altre visite il campo è in sola lettura.
  useEffect(() => {
    if (editingAppointment) return
    if (!isMedicalVisitType(activityForm.activity_type) || !activityForm.injury_id || !activityForm.date) return
    const inj = openInjuries.find(i => i.id === activityForm.injury_id)
    if (!inj?.injury_date) return
    const dur = (inj as { duration_days?: number }).duration_days
    const weeks = inj.expected_weeks_off ?? 0
    // Errore migrazione: 28 giorni salvati come 28*7=196 → se dur è N*7 con N in 14–60 (giorni tipici), usa N.
    const q = dur != null && dur % 7 === 0 ? dur / 7 : 0
    const wrongMigration = q >= 14 && q <= 60
    const totalDays = wrongMigration ? q : (dur != null && dur >= 1 && dur <= 365 ? dur : (weeks > 12 ? weeks : weeks * 7))
    const elapsed = daysBetween(inj.injury_date, activityForm.date)
    const remaining = Math.max(0, totalDays - elapsed)
    setActivityForm(prev => {
      const next = String(remaining)
      if (prev.expected_stop_days === next) return prev
      return { ...prev, expected_stop_days: next }
    })
  }, [activityForm.activity_type, activityForm.injury_id, activityForm.date, openInjuries, editingAppointment])

  // Apertura modifica da URL (scheda Infortuni o iframe dalla pagina giocatore)
  useEffect(() => {
    if (!editActivityIdFromUrl || appointments.length === 0) return
    const apt = appointments.find(a => a.id === editActivityIdFromUrl)
    if (apt) {
      openEditModal(apt)
      navigate(embedFromUrl ? `/infortuni?tab=attivita&embed=1` : `/infortuni?tab=attivita`, { replace: true })
    }
  }, [editActivityIdFromUrl, appointments, embedFromUrl])

  // Pulsante "Nuova attività" nell'header DashboardLayout (embedInLayout)
  useEffect(() => {
    const handler = () => openCreateModal()
    window.addEventListener('open-create-activity', handler)
    return () => window.removeEventListener('open-create-activity', handler)
  }, [])

  const openCreateModal = (injuryId?: string) => {
    setShowCreateModal(true)
    setEditingAppointment(null)
    setActivityForm({
      injury_id: injuryId ?? injuryIdFromUrl ?? null,
      activity_type: 'physiotherapy',
      activity_description: '',
      date: '',
      activity_time: '',
      cost: '',
      cost_currency: 'EUR',
      operator_name: '',
      operator_other: '',
      duration_minutes: '',
      notes: '',
      recheck_date: '',
      massaggio: false,
      tecar: false,
      laser: false,
      confirmation_status: '',
      stato_visita: '',
      can_play_field: false,
      can_play_gym: false,
      richiesta_fisioterapia: false,
      expected_stop_days: ''
    })
    setCreateOverlapConfirmModal(null)
    setOverlapConfirmModal(null)
    loadMedicalStaff()
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setEditingAppointment(null)
    setCreateOverlapConfirmModal(null)
    setOverlapConfirmModal(null)
    setShowRicontrolloModal(false)
    setShowRicontrolloDatePicker(false)
    setPendingRicontrolloChoice(null)
    setRicontrolloModalFromButton(false)
    setRicontrolloDatePickerFromButton(false)
    if (embedFromUrl) {
      try { window.parent.postMessage({ type: 'injury-activity-modal-close' }, '*') } catch { /* ignore */ }
      return
    }
    const tab = activeTab !== 'aperti' ? `?tab=${activeTab}` : ''
    navigate(`/infortuni${tab}`, { replace: true })
  }

  const getOperatorName = () => resolveOperatorName(activityForm.operator_name, activityForm.operator_other)

  const buildActivityDescription = () => {
    if (isPhysiotherapyType(activityForm.activity_type)) {
      const tipi = [activityForm.massaggio && 'Massaggio', activityForm.tecar && 'Tecar', activityForm.laser && 'Laser'].filter(Boolean) as string[]
      return tipi.length ? `Fisioterapia: ${tipi.join(', ')}` : 'Fisioterapia'
    }
    if (isMedicalVisitType(activityForm.activity_type)) {
      const v = activityForm.activity_description
      if (v === 'prima_visita') return 'Prima visita'
      if (v === 'visita_controllo') return 'Visita di controllo'
      if (v === 'visita_chiusura') return 'Visita di chiusura'
      return 'Visita medica / Ricontrollo'
    }
    if (isInsuranceRefundType(activityForm.activity_type)) return 'Rimborso assicurativo'
    return formatActivityType(activityForm.activity_type)
  }

  const performCreate = async (overrideOverlap: boolean, overrideRicontrollo?: { ricontrollo: string; ricontrollo_time: string | null }) => {
    const injuryId = activityForm.injury_id
    if (!injuryId) return
    const inj = openInjuries.find(i => i.id === injuryId)
    const personId = inj?.person_id
    if (!personId) {
      alert('Seleziona il giocatore (infortunio).')
      return
    }
    const isPhysio = isPhysiotherapyType(activityForm.activity_type)
    const isPurchase = isPurchaseActivityType(activityForm.activity_type)
    const isRefund = isInsuranceRefundType(activityForm.activity_type)
    const operatorName = isRefund ? 'Assicurazione' : getOperatorName()
    if (!isRefund && !operatorName) return
    const duration = activityForm.duration_minutes ? parseInt(activityForm.duration_minutes, 10) : null
    const ricontrolloDate = overrideRicontrollo?.ricontrollo ?? activityForm.date
    const ricontrolloTime = overrideRicontrollo !== undefined ? overrideRicontrollo.ricontrollo_time : (activityForm.activity_time?.trim() || null)
    const row: Record<string, unknown> = {
      injury_id: injuryId,
      activity_type: activityForm.activity_type,
      activity_description: buildActivityDescription(),
      activity_date: activityForm.date,
      ricontrollo: isPurchase || isRefund ? null : ricontrolloDate,
      ricontrollo_time: isPurchase || isRefund ? null : ricontrolloTime,
      activity_time: isPurchase || isRefund ? null : (activityForm.activity_time?.trim() || null),
      duration_minutes: isPurchase || isRefund ? null : (duration ?? undefined),
      buffer_minuti: 4,
      override_overlap: overrideOverlap,
      operator_name: operatorName,
      massaggio: isPhysio ? activityForm.massaggio : false,
      tecar: isPhysio ? activityForm.tecar : false,
      laser: isPhysio ? activityForm.laser : false,
      confirmation_status: isPhysio ? (activityForm.confirmation_status?.trim() || null) : null,
      notes: activityForm.notes?.trim() || null,
      recheck_date: isPurchase || isRefund ? null : (activityForm.recheck_date?.trim() || null),
      cost: activityForm.cost ? parseFloat(activityForm.cost) : null,
      cost_currency: activityForm.cost_currency || 'EUR',
      can_play_field: isMedicalVisitType(activityForm.activity_type) ? activityForm.can_play_field : false,
      can_play_gym: isMedicalVisitType(activityForm.activity_type) ? activityForm.can_play_gym : false,
      richiesta_fisioterapia: isMedicalVisitType(activityForm.activity_type) ? activityForm.richiesta_fisioterapia : false,
      expected_stop_days: activityForm.expected_stop_days ? parseInt(activityForm.expected_stop_days, 10) : null,
      stato_visita: (activityForm.stato_visita === 'eseguito' || activityForm.stato_visita === 'assente') ? activityForm.stato_visita : null
    }
    const { error } = await supabase.from('injury_activities').insert(row)
    if (error) throw error
    if (embedFromUrl) {
      try { window.parent.postMessage({ type: 'injury-activity-modal-saved' }, '*') } catch { /* ignore */ }
    }
    closeCreateModal()
    await loadAppointments()
    await loadOpenInjuries()
  }

  const confirmCreate = async () => {
    if (!activityForm.injury_id) {
      alert('Seleziona il giocatore (infortunio) per cui fissare l\'appuntamento.')
      return
    }
    const isRefund = isInsuranceRefundType(activityForm.activity_type)
    const operatorName = isRefund ? 'Assicurazione' : getOperatorName()
    if (!activityForm.date.trim()) {
      alert('Seleziona una data.')
      return
    }
    if (!isRefund && !operatorName) {
      alert('Seleziona l\'operatore o inserisci "Altro".')
      return
    }
    const isPhysio = isPhysiotherapyType(activityForm.activity_type)
    if (isPhysio && !(activityForm.massaggio || activityForm.tecar || activityForm.laser)) {
      alert('Seleziona almeno un tipo di trattamento (Massaggio, Tecar o Laser).')
      return
    }
    const duration = activityForm.duration_minutes ? parseInt(activityForm.duration_minutes, 10) : null
    const timeStr = activityForm.activity_time?.trim().substring(0, 5) || ''
    const inj = openInjuries.find(i => i.id === activityForm.injury_id)
    const personId = inj?.person_id ?? ''
    if (!personId) {
      alert('Impossibile determinare il giocatore.')
      return
    }
    try {
      setSavingActivity(true)
      const { data: existing } = await supabase
        .from('injury_activities')
        .select('id, injury_id, activity_type, operator_name, tecar, laser, activity_date, activity_time, ricontrollo, ricontrollo_time, duration_minutes, buffer_minuti, injuries(person_id)')
        .or(`activity_date.eq.${activityForm.date},ricontrollo.eq.${activityForm.date}`)
      const list: OverlapActivity[] = (existing || []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        injury_id: a.injury_id as string,
        person_id: ((a.injuries as { person_id?: string })?.person_id ?? '') as string,
        activity_type: (a.activity_type as string) || '',
        operator_name: a.operator_name as string | null,
        tecar: !!a.tecar,
        laser: !!a.laser,
        activity_date: (a.activity_date as string) || '',
        activity_time: (a.activity_time as string) || '',
        ricontrollo: (a.ricontrollo as string) || null,
        ricontrollo_time: (a.ricontrollo_time as string) || null,
        duration_minutes: a.duration_minutes as number | null,
        buffer_minuti: a.buffer_minuti as number | null
      })).filter((a) => (a.ricontrollo_time ?? a.activity_time) != null)
      const result = timeStr && duration ? checkOverlap(
        activityForm.date,
        timeStr,
        duration,
        personId,
        activityForm.activity_type,
        operatorName,
        activityForm.tecar,
        activityForm.laser,
        list,
        undefined
      ) : { hardError: null, warning: null }
      if (result.hardError) {
        alert(formatOverlapHardError(result.hardError, operatorName))
        setSavingActivity(false)
        return
      }
      if (result.warning) {
        setCreateOverlapConfirmModal({ message: result.warning.message })
        setSavingActivity(false)
        return
      }
      const isVisit = isMedicalVisitType(activityForm.activity_type)
      const hasReferto = !!(activityForm.notes?.trim())
      const isChiusura = activityForm.activity_description === 'visita_chiusura'
      if (isVisit && hasReferto && !activityForm.richiesta_fisioterapia && !isChiusura) {
        if (pendingRicontrolloChoice === 'no') {
          await performCreate(false)
          setPendingRicontrolloChoice(null)
        } else if (pendingRicontrolloChoice === 'data_ora') {
          await performCreate(false)
          setPendingRicontrolloChoice(null)
        } else if (pendingRicontrolloChoice?.type === 'solo_data') {
          await performCreate(false, { ricontrollo: pendingRicontrolloChoice.date, ricontrollo_time: null })
          setPendingRicontrolloChoice(null)
        } else {
          setShowRicontrolloModal(true)
          setSavingActivity(false)
          return
        }
      } else {
        await performCreate(false)
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      if (msg.includes('Impossibile salvare:') || msg.includes('Attenzione:')) {
        alert(msg)
      } else {
        console.error('Errore salvataggio:', e)
        alert('Errore nel salvataggio: ' + (e as Error)?.message)
      }
    } finally {
      setSavingActivity(false)
    }
  }

  const handleCreateOverlapConfirm = async () => {
    if (!createOverlapConfirmModal) return
    setCreateOverlapConfirmModal(null)
    try {
      setSavingActivity(true)
      await performCreate(true)
    } catch (e) {
      alert((e as Error)?.message || 'Errore nel salvataggio.')
    } finally {
      setSavingActivity(false)
    }
  }

  const handleRicontrolloNo = async () => {
    setShowRicontrolloModal(false)
    if (ricontrolloModalFromButton) {
      setPendingRicontrolloChoice('no')
      setRicontrolloModalFromButton(false)
      return
    }
    try {
      setSavingActivity(true)
      await performCreate(false)
    } catch (e) {
      alert((e as Error)?.message || 'Errore nel salvataggio.')
    } finally {
      setSavingActivity(false)
    }
  }

  const handleRicontrolloWithDateTime = async () => {
    setShowRicontrolloModal(false)
    if (ricontrolloModalFromButton) {
      setPendingRicontrolloChoice('data_ora')
      setRicontrolloModalFromButton(false)
      return
    }
    try {
      setSavingActivity(true)
      await performCreate(false)
    } catch (e) {
      alert((e as Error)?.message || 'Errore nel salvataggio.')
    } finally {
      setSavingActivity(false)
    }
  }

  const handleRicontrolloSoloData = () => {
    setShowRicontrolloModal(false)
    setSelectedRicontrolloDate(activityForm.date || toDateOnly(new Date()))
    setShowRicontrolloDatePicker(true)
    if (ricontrolloModalFromButton) {
      setRicontrolloModalFromButton(false)
      setRicontrolloDatePickerFromButton(true)
    }
  }

  const handleRicontrolloDateConfirm = async () => {
    if (!selectedRicontrolloDate) return
    setShowRicontrolloDatePicker(false)
    if (ricontrolloDatePickerFromButton) {
      setPendingRicontrolloChoice({ type: 'solo_data', date: selectedRicontrolloDate })
      setRicontrolloDatePickerFromButton(false)
      return
    }
    try {
      setSavingActivity(true)
      await performCreate(false, { ricontrollo: selectedRicontrolloDate, ricontrollo_time: null })
    } catch (e) {
      alert((e as Error)?.message || 'Errore nel salvataggio.')
    } finally {
      setSavingActivity(false)
    }
  }

  const today = toDateOnly(new Date())

  const appointmentsBaseFiltered = appointments
    .filter(apt => {
      // Solo da oggi in avanti, oppure passati se confermati (fisio: confirmation_status; visita: stato_visita eseguito/assente)
      if (apt.date >= today) return true
      if (apt.activityType === 'Visita medica' && (apt.stato_visita === 'eseguito' || apt.stato_visita === 'assente')) return true
      if (apt.activityType === 'Fisioterapia' && apt.confirmation_status?.trim()) return true
      return false
    })
    .filter(apt => {
      if (filterAttivita.trim() && !apt.activityType.toLowerCase().includes(filterAttivita.trim().toLowerCase())) return false
      if (filterTipologia.trim()) {
        const tipologia = getTipologiaLabel(apt).toLowerCase()
        if (!tipologia.includes(filterTipologia.trim().toLowerCase())) return false
      }
      if (filterOperatore.trim() && !(apt.operatorName || '').toLowerCase().includes(filterOperatore.trim().toLowerCase())) return false
      if (filterGiocatore.trim() && !apt.playerName.toLowerCase().includes(filterGiocatore.trim().toLowerCase())) return false
      return true
    })

  const applyCategoryFilter = (apt: Appointment) => {
    if (!selectedCategory || selectedCategory === 'all') return true
    const abbrev = abbreviateCategoryLabel(apt.category_label || '')
    if (selectedCategory === 'u14' && !abbrev.includes('u14')) return false
    if (selectedCategory === 'u16' && !abbrev.includes('u16')) return false
    if (selectedCategory === 'u18' && !abbrev.includes('u18')) return false
    if (selectedCategory === 'C' && !abbrev.includes('C')) return false
    if (selectedCategory === 'B' && !abbrev.includes('B')) return false
    return true
  }
  const applyTextFilters = (apt: Appointment) => {
    if (filterAttivita.trim() && !apt.activityType.toLowerCase().includes(filterAttivita.trim().toLowerCase())) return false
    if (filterTipologia.trim()) {
      const tipologia = getTipologiaLabel(apt).toLowerCase()
      if (!tipologia.includes(filterTipologia.trim().toLowerCase())) return false
    }
    if (filterOperatore.trim() && !(apt.operatorName || '').toLowerCase().includes(filterOperatore.trim().toLowerCase())) return false
    if (filterGiocatore.trim() && !apt.playerName.toLowerCase().includes(filterGiocatore.trim().toLowerCase())) return false
    return true
  }

  /** In "Attività future": injury_activities con orario E data >= oggi; visit_list con data >= oggi (con o senza orario). */
  const hasOrario = (apt: Appointment) =>
    apt.ricontrollo_time != null && String(apt.ricontrollo_time).trim() !== ''

  const isVisitList = (apt: Appointment) => apt.activity_type_raw === 'visit_list'

  const filteredAppointments = [...appointmentsBaseFiltered]
    .filter(apt => apt.date >= today)
    .filter(apt => isVisitList(apt) || hasOrario(apt))
    .filter(applyCategoryFilter)
    .sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '')
      if (dateCmp !== 0) return dateCmp
      return getCategorySortOrder(a.category_label || '') - getCategorySortOrder(b.category_label || '')
    })

  /** Stessa logica "in elenco" di appointmentsBaseFiltered: da oggi in avanti o passati già confermati. */
  const isInBaseElenco = (apt: Appointment) => {
    if (apt.date >= today) return true
    if (apt.activityType === 'Visita medica' && (apt.stato_visita === 'eseguito' || apt.stato_visita === 'assente')) return true
    if (apt.activityType === 'Fisioterapia' && apt.confirmation_status?.trim()) return true
    return false
  }

  const appointmentsDaConfermare = appointments
    .filter(apt =>
      isCospicuo(apt, today) ||
      isSoloDataDaConfermare(apt) ||
      (isInBaseElenco(apt) && !hasOrario(apt))
    )
    .filter(applyTextFilters)
    .filter(applyCategoryFilter)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  const appointmentsAssente = appointments
    .filter(apt => (apt.confirmation_status || '').toString() === 'assente')
    .filter(applyTextFilters)
    .filter(applyCategoryFilter)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  const handleDelete = (apt: Appointment) => {
    setDeleteModal({
      id: apt.id,
      label: `${apt.activityType} – ${apt.playerName} (${new Date(apt.date).toLocaleDateString('it-IT')})`
    })
  }

  const handleReorderAgendaItems = useCallback(async (dayKey: string, orderedItems: AgendaItem[]) => {
    if (orderedItems.length === 0) return
    try {
      const existingTimes = orderedItems
        .map((i) => i.activity_time?.substring?.(0, 5))
        .filter((t): t is string => !!t)
        .sort()
      const baseTime = existingTimes[0] || '18:00'
      const [bh, bm] = baseTime.split(':').map(Number)
      const baseMins = bh * 60 + bm
      const times: string[] = []
      for (let i = 0; i < orderedItems.length; i++) {
        const totalMins = baseMins + i * 5
        const nh = Math.floor(totalMins / 60) % 24
        const nm = totalMins % 60
        times.push(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`)
      }
      for (let i = 0; i < orderedItems.length; i++) {
        const item = orderedItems[i]
        const newTime = times[i] || times[0]
        const timeStr = `${newTime}:00`
        if (item.id.startsWith('vle-')) {
          const entryId = item.id.replace('vle-', '')
          await supabase.from('visit_list_entries').update({ assigned_time: timeStr }).eq('id', entryId)
        } else if (item.sourceActivityId) {
          await supabase.from('injury_activities').update({ ricontrollo_time: timeStr }).eq('id', item.sourceActivityId)
        } else {
          await supabase.from('injury_activities').update({ activity_time: timeStr }).eq('id', item.id)
        }
      }
      await loadAppointments()
    } catch (err) {
      console.error('Errore riordinamento:', err)
      alert('Errore durante il riordinamento. Riprova.')
    }
  }, [loadAppointments])

  const handleDeleteAgendaItem = useCallback((item: AgendaItem) => {
    setDeleteModal({
      id: item.id,
      label: `${item.activity_type || 'Attività'} – ${item.person_name ?? '—'} (${new Date(item.activity_date).toLocaleDateString('it-IT')})`
    })
  }, [])

  const confirmDelete = async () => {
    if (!deleteModal) return
    try {
      setDeleting(true)
      const isVisitList = deleteModal.id.startsWith('vle-')
      const isRicontrollo = deleteModal.id.endsWith('-ricontrollo')
      if (isVisitList) {
        const id = deleteModal.id.replace('vle-', '')
        const { error } = await supabase.from('visit_list_entries').delete().eq('id', id)
        if (error) throw error
      } else if (isRicontrollo) {
        const activityId = deleteModal.id.replace(/-ricontrollo$/, '')
        const { error } = await supabase.from('injury_activities').update({ ricontrollo: null, ricontrollo_time: null }).eq('id', activityId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('injury_activities').delete().eq('id', deleteModal.id)
        if (error) throw error
      }
      setDeleteModal(null)
      await loadAppointments()
    } catch (e) {
      console.error('Errore eliminazione:', e)
      alert('Errore durante l\'eliminazione: ' + (e as Error)?.message)
    } finally {
      setDeleting(false)
    }
  }

  const openEditModal = (apt: Appointment) => {
    setEditingAppointment(apt)
    // In modifica mostriamo data e orario della visita (activity_date/activity_time), non del ricontrollo
    const dateStr = apt.activity_date ? (typeof apt.activity_date === 'string' ? apt.activity_date.slice(0, 10) : new Date(apt.activity_date).toISOString().split('T')[0]) : (apt.date ? (typeof apt.date === 'string' ? apt.date.slice(0, 10) : new Date(apt.date).toISOString().split('T')[0]) : '')
    const timeStr = apt.activity_time ? String(apt.activity_time).slice(0, 5) : ''
    let visitDesc = ''
    const d = (apt.activity_description || '').trim().toLowerCase()
    if (d.includes('prima visita')) visitDesc = 'prima_visita'
    else if (d.includes('chiusura')) visitDesc = 'visita_chiusura'
    else if (d.includes('controllo') || d.includes('ricontrollo')) visitDesc = 'visita_controllo'
    const raw = (apt.activity_type_raw || '').trim().toLowerCase()
    const activityType = raw === 'medical_visit' || raw === 'visita medica' ? 'medical_visit' : raw === 'physiotherapy' || raw === 'fisioterapia' ? 'physiotherapy' : raw || 'physiotherapy'
    const staffNames = medicalStaff.map(s => s.full_name)
    const operatorName = apt.operatorName?.trim() || ''
    const isOtherOp = operatorName && !staffNames.includes(operatorName)
    setActivityForm({
      injury_id: apt.injury_id,
      activity_type: activityType,
      activity_description: visitDesc,
      date: dateStr,
      activity_time: timeStr,
      cost: apt.cost != null ? String(apt.cost) : '',
      cost_currency: apt.cost_currency || 'EUR',
      operator_name: isOtherOp ? 'Altro' : operatorName,
      operator_other: isOtherOp ? operatorName : '',
      duration_minutes: apt.duration_minutes?.toString() || '',
      notes: apt.notes ?? '',
      recheck_date: apt.recheck_date ? (typeof apt.recheck_date === 'string' ? apt.recheck_date.slice(0, 10) : new Date(apt.recheck_date).toISOString().split('T')[0]) : '',
      massaggio: apt.massaggio,
      tecar: apt.tecar,
      laser: apt.laser,
      confirmation_status: apt.confirmation_status ?? '',
      stato_visita: (apt.stato_visita === 'eseguito' || apt.stato_visita === 'assente' ? apt.stato_visita : '') as '' | 'eseguito' | 'assente',
      can_play_field: apt.can_play_field ?? false,
      can_play_gym: apt.can_play_gym ?? false,
      richiesta_fisioterapia: apt.richiesta_fisioterapia ?? false,
      expected_stop_days: apt.expected_stop_days != null ? String(apt.expected_stop_days) : ''
    })
    setShowCreateModal(false)
    loadMedicalStaff()
  }

  const performEdit = async (overrideOverlap: boolean) => {
    if (!editingAppointment) return
    const isPhysio = isPhysiotherapyType(activityForm.activity_type)
    const isPurchase = isPurchaseActivityType(activityForm.activity_type)
    const isRefund = isInsuranceRefundType(activityForm.activity_type)
    const operatorName = isRefund ? 'Assicurazione' : getOperatorName()
    if (!isRefund && !operatorName) return
    const duration = activityForm.duration_minutes ? parseInt(activityForm.duration_minutes, 10) : null
    const updatePayload: Record<string, unknown> = {
      activity_date: activityForm.date,
      ricontrollo: isPurchase || isRefund ? null : activityForm.date,
      ricontrollo_time: isPurchase || isRefund ? null : (activityForm.activity_time?.trim() || null),
      activity_time: isPurchase || isRefund ? null : (activityForm.activity_time?.trim() || null),
      duration_minutes: isPurchase || isRefund ? null : (duration ?? undefined),
      buffer_minuti: 4,
      override_overlap: overrideOverlap,
      operator_name: operatorName,
      activity_type: activityForm.activity_type,
      activity_description: buildActivityDescription(),
      massaggio: activityForm.massaggio,
      tecar: activityForm.tecar,
      laser: activityForm.laser,
      notes: activityForm.notes?.trim() || null,
      confirmation_status: isPhysio ? (activityForm.confirmation_status?.trim() || null) : null,
      recheck_date: isPurchase || isRefund ? null : (activityForm.recheck_date?.trim() || null),
      cost: activityForm.cost ? parseFloat(activityForm.cost) : null,
      cost_currency: activityForm.cost_currency || 'EUR',
      can_play_field: isMedicalVisitType(activityForm.activity_type) ? activityForm.can_play_field : false,
      can_play_gym: isMedicalVisitType(activityForm.activity_type) ? activityForm.can_play_gym : false,
      richiesta_fisioterapia: isMedicalVisitType(activityForm.activity_type) ? activityForm.richiesta_fisioterapia : false,
      expected_stop_days: activityForm.expected_stop_days ? parseInt(activityForm.expected_stop_days, 10) : null,
      stato_visita: (activityForm.stato_visita === 'eseguito' || activityForm.stato_visita === 'assente') ? activityForm.stato_visita : null
    }
    const { error } = await supabase.from('injury_activities').update(updatePayload).eq('id', editingAppointment.id)
    if (error) throw error
    setEditingAppointment(null)
    setOverlapConfirmModal(null)
    if (embedFromUrl) {
      try { window.parent.postMessage({ type: 'injury-activity-modal-saved' }, '*') } catch { /* ignore */ }
      closeCreateModal()
      await loadAppointments()
      await loadOpenInjuries()
      return
    }
    await loadAppointments()
    const origDate = toDateOnly(editingAppointment.date)
    const origTime = (editingAppointment.ricontrollo_time ?? editingAppointment.activity_time ?? '')?.toString().slice(0, 5) || ''
    const newTime = activityForm.activity_time?.trim().slice(0, 5) || ''
    const origOp = (editingAppointment.operatorName || '').trim()
    const dateChanged = origDate !== toDateOnly(activityForm.date)
    const timeChanged = origTime !== newTime
    const operatorChanged = origOp !== (operatorName || '').trim()
    const typeChanged = (editingAppointment.activity_type_raw || '') !== (activityForm.activity_type || '')
    const modificaImpegno = dateChanged || timeChanged || operatorChanged || typeChanged
    if (modificaImpegno) {
      const payload: ActivityUpdatedPayload = {
        activity_id: editingAppointment.id,
        player_name: editingAppointment.playerName,
        date: activityForm.date,
        time: activityForm.activity_time?.trim() || null,
        activity_type: activityForm.activity_type
      }
      setNotificationChoiceModal({
        operatorName,
        playerName: editingAppointment.playerName,
        payload
      })
    }
  }

  const confirmEdit = async () => {
    if (!editingAppointment) return
    const operatorName = isInsuranceRefundType(activityForm.activity_type) ? 'Assicurazione' : getOperatorName()
    if (!activityForm.date.trim()) {
      alert('Seleziona una data.')
      return
    }
    if (!isInsuranceRefundType(activityForm.activity_type) && !operatorName) {
      alert('Inserisci data e operatore.')
      return
    }
    const isPhysio = isPhysiotherapyType(activityForm.activity_type)
    if (isPhysio && !(activityForm.massaggio || activityForm.tecar || activityForm.laser)) {
      alert('Seleziona almeno un tipo di trattamento (Massaggio, Tecar o Laser) per la fisioterapia.')
      return
    }
    const duration = activityForm.duration_minutes ? parseInt(activityForm.duration_minutes, 10) : null
    const timeStr = activityForm.activity_time?.trim().substring(0, 5) || ''
    try {
      setSavingActivity(true)

      const { data: existing } = await supabase
        .from('injury_activities')
        .select('id, injury_id, activity_type, operator_name, tecar, laser, activity_date, activity_time, ricontrollo, ricontrollo_time, duration_minutes, buffer_minuti, injuries(person_id)')
        .or(`activity_date.eq.${activityForm.date},ricontrollo.eq.${activityForm.date}`)

      const list: OverlapActivity[] = (existing || []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        injury_id: a.injury_id as string,
        person_id: ((a.injuries as { person_id?: string })?.person_id ?? '') as string,
        activity_type: (a.activity_type as string) || '',
        operator_name: a.operator_name as string | null,
        tecar: !!a.tecar,
        laser: !!a.laser,
        activity_date: (a.activity_date as string) || '',
        activity_time: (a.activity_time as string) || '',
        ricontrollo: (a.ricontrollo as string) || null,
        ricontrollo_time: (a.ricontrollo_time as string) || null,
        duration_minutes: a.duration_minutes as number | null,
        buffer_minuti: a.buffer_minuti as number | null
      })).filter((a) => (a.ricontrollo_time ?? a.activity_time) != null)

      const result = timeStr && duration ? checkOverlap(
        activityForm.date,
        timeStr,
        duration,
        editingAppointment.person_id,
        activityForm.activity_type,
        operatorName,
        activityForm.tecar,
        activityForm.laser,
        list,
        editingAppointment.id
      ) : { hardError: null, warning: null }

      if (result.hardError) {
        alert(formatOverlapHardError(result.hardError, operatorName))
        setSavingActivity(false)
        return
      }

      if (result.warning) {
        setOverlapConfirmModal({ message: result.warning.message })
        setSavingActivity(false)
        return
      }

      await performEdit(false)
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      if (msg.includes('Impossibile salvare:') || msg.includes('Attenzione:')) {
        alert(msg)
      } else {
        console.error('Errore modifica:', e)
        alert('Errore durante la modifica: ' + (e as Error)?.message)
      }
    } finally {
      setSavingActivity(false)
    }
  }

  const handleOverlapConfirm = async () => {
    if (!overlapConfirmModal || !editingAppointment) return
    try {
      setSavingActivity(true)
      await performEdit(true)
    } catch (e) {
      alert((e as Error)?.message || 'Errore durante la modifica.')
    } finally {
      setSavingActivity(false)
    }
  }

  /** Operatori: tutti medici/fisio + opzione "Altro" con campo libero. */
  const activityModalStaffOptions = medicalStaff
  const activityModalOperatorValue = activityForm.operator_name === 'Altro' ? 'Altro' : activityForm.operator_name

  // Funzione per filtrare per categoria
  const matchesCategory = (categoryLabel: string): boolean => {
    if (selectedCategory === 'all') return true
    const abbrev = abbreviateCategoryLabel(categoryLabel)
    if (selectedCategory === 'u14') return abbrev.includes('u14')
    if (selectedCategory === 'u16') return abbrev.includes('u16')
    if (selectedCategory === 'u18') return abbrev.includes('u18')
    if (selectedCategory === 'C') return abbrev.includes('C')
    if (selectedCategory === 'B') return abbrev.includes('B')
    return false
  }

  // Conta record per categoria nella tab attiva (per i filtri categoria)
  const agendaItemsForCount = appointments.filter((apt) => apt.date >= today)

  const currentDataForCount = (() => {
    if (activeTab === 'aperti') return openInjuries.filter(i => !i.in_chiusura)
    if (activeTab === 'attivita') return filteredAppointments
    if (activeTab === 'agenda') return agendaItemsForCount
    if (activeTab === 'confermare') return appointmentsDaConfermare
    if (activeTab === 'assente') return appointmentsAssente
    if (activeTab === 'chiusura') return openInjuries.filter(i => i.in_chiusura)
    if (activeTab === 'chiusi') return closedInjuries
    return [] as Array<{ category_label?: string | null }>
  })()
  const countForCategory = (cat: string): number => {
    if (cat === 'all') return currentDataForCount.length
    return currentDataForCount.filter(item => {
      const abbrev = abbreviateCategoryLabel((item as { category_label?: string | null }).category_label || '')
      if (cat === 'u14') return abbrev.includes('u14')
      if (cat === 'u16') return abbrev.includes('u16')
      if (cat === 'u18') return abbrev.includes('u18')
      if (cat === 'C') return abbrev.includes('C')
      if (cat === 'B') return abbrev.includes('B')
      return false
    }).length
  }

  const handleSendNotification = async (to: 'operator' | 'player' | 'both') => {
    if (!notificationChoiceModal) return
    try {
      setSendingNotification(true)
      const { operatorName, playerName, payload } = notificationChoiceModal
      const operatorUserId = await getUserIdByOperatorName(operatorName)
      const playerUserId = await getUserIdByOperatorName(playerName)
      const sent = new Set<string>()
      if (to === 'operator' || to === 'both') {
        if (operatorUserId && !sent.has(operatorUserId)) {
          await sendActivityUpdatedNotificationToUser(operatorUserId, payload, { forPlayer: false })
          sent.add(operatorUserId)
        }
        // INSERT in activity_modification_notifications per l'app mobile FlowMe (Realtime)
        const dateFormatted = formatDateIt(payload.date)
        const timeStr = payload.time ? String(payload.time).slice(0, 5).replace(':', '.') : ''
        const changesSummary = timeStr ? `${dateFormatted}, ore ${timeStr}` : dateFormatted
        try {
          await supabase.from('activity_modification_notifications').insert({
            activity_id: payload.activity_id,
            operator_name: operatorName,
            player_name: playerName || null,
            changes_summary: changesSummary || 'Modifica effettuata'
          })
        } catch (e) {
          console.warn('activity_modification_notifications insert (FlowMe):', e)
        }
      }
      if (to === 'player' || to === 'both') {
        // INSERT anche per il giocatore (FlowMe ascolta operator_name e player_name)
        const dateFormattedPlayer = formatDateIt(payload.date)
        const timeStrPlayer = payload.time ? String(payload.time).slice(0, 5).replace(':', '.') : ''
        const changesSummaryPlayer = timeStrPlayer ? `${dateFormattedPlayer}, ore ${timeStrPlayer}` : dateFormattedPlayer
        try {
          await supabase.from('activity_modification_notifications').insert({
            activity_id: payload.activity_id,
            operator_name: playerName || '',
            player_name: playerName || null,
            changes_summary: changesSummaryPlayer || 'Modifica effettuata'
          })
        } catch (e) {
          console.warn('activity_modification_notifications insert player (FlowMe):', e)
        }
        if (playerUserId && !sent.has(playerUserId)) {
          await sendActivityUpdatedNotificationToUser(playerUserId, payload, { forPlayer: true })
          sent.add(playerUserId)
        }
      }
      setNotificationChoiceModal(null)
    } catch (e) {
      console.error('Errore invio notifica:', e)
      alert('Errore durante l\'invio della notifica: ' + (e as Error)?.message)
    } finally {
      setSendingNotification(false)
    }
  }

  const embedLight = embedInLayout && !embedFromUrl

  return (
    <div
      className={`flex flex-col w-full min-w-0 ${embedFromUrl ? 'min-h-screen bg-transparent' : embedInLayout ? 'h-full min-h-0 overflow-hidden min-h-full' : 'min-h-screen bg-gradient-to-br from-brand-primary via-brand-secondary to-brand-accent'}`}
      style={embedLight ? { backgroundColor: GOLEE.surfaceMuted } : undefined}
    >
      {!embedFromUrl && !embedInLayout && (
        <Header
          title="Infermeria"
          subtitle="Infermeria e impegni di medici e fisioterapisti"
          showBack={true}
          hideCenterLogo={true}
          rightButton={
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Nuova attività"
              aria-label="Nuova attività"
            >
              <CalendarPlus className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">Nuova attività</span>
            </button>
          }
        />
      )}
      {!embedFromUrl && (
        <main className="w-full min-w-0 flex flex-col flex-1 min-h-0">
        <div className={`shrink-0 px-6 lg:px-8 pt-6 pb-4 ${embedLight ? '' : 'bg-[#2A3051]/95 border-b border-white/10'}`}>
        <div
          className={`${embedLight ? 'rounded-2xl border shadow-sm overflow-hidden mb-0' : ''}`}
          style={embedLight ? { backgroundColor: GOLEE.surface, borderColor: GOLEE.border } : undefined}
        >
        <div className={`flex flex-wrap items-center gap-1 ${embedLight ? 'px-5 pt-3 border-b' : 'mb-4'}`} style={embedLight ? { borderColor: GOLEE.border } : undefined}>
          {[
            { id: 'aperti' as const, label: `Aperti (${openInjuries.filter(i => !i.in_chiusura).length})` },
            { id: 'attivita' as const, label: `Attività future (${filteredAppointments.length})` },
            { id: 'agenda' as const, label: 'Agenda' },
            { id: 'confermare' as const, label: `Attività da confermare (${appointmentsDaConfermare.length})` },
            { id: 'assente' as const, label: `Assenti (${appointmentsAssente.length})` },
            ...(openInjuries.filter(i => i.in_chiusura).length > 0
              ? [{ id: 'chiusura' as const, label: `In chiusura (${openInjuries.filter(i => i.in_chiusura).length})` }]
              : []),
            { id: 'chiusi' as const, label: 'Infortuni chiusi' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); navigate(`/infortuni?tab=${tab.id}`, { replace: true }) }}
              className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px focus:outline-none text-sm ${
                embedLight
                  ? activeTab === tab.id
                    ? 'border-[#00C48C]'
                    : 'border-transparent hover:border-[#00C48C]/40'
                  : activeTab === tab.id
                    ? 'text-white border-red-500'
                    : 'text-white/70 border-transparent hover:text-white'
              }`}
              style={embedLight ? { color: activeTab === tab.id ? GOLEE.text : GOLEE.textMuted } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className={`flex w-full flex-wrap gap-2 ${embedLight ? 'px-5 py-4' : 'mb-0 pb-4 border-b border-white/10'}`}
        >
          {[
            { id: 'all' as const, label: 'Tutti' },
            { id: 'u14' as const, label: 'Under 14' },
            { id: 'u16' as const, label: 'Under 16' },
            { id: 'u18' as const, label: 'Under 18' },
            { id: 'C' as const, label: 'Serie C' },
            { id: 'B' as const, label: 'Serie B' }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-1 min-w-[5.5rem] rounded-xl py-2 text-xs sm:text-sm font-medium transition-colors duration-200 border ${
                embedLight
                  ? selectedCategory === cat.id
                    ? getCategoryFilterSelectedStyleLight(cat.id)
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  : selectedCategory === cat.id
                    ? getCategoryFilterSelectedStyle(cat.id)
                    : 'bg-white/5 text-white/80 hover:bg-white/10 border-transparent'
              }`}
            >
              {cat.label} ({countForCategory(cat.id)})
            </button>
          ))}
        </div>
        </div>

        {/* Agenda: fascia date nella parte fissa; altezza vincolata per permettere scroll appuntamenti */}
        {activeTab === 'agenda' && (
          <div className="flex flex-col min-h-[200px] max-h-[calc(100vh-260px)] overflow-hidden min-w-0">
            <WeeklyCalendarView
            embedded
            className="flex-1 min-h-0 h-full"
            items={appointments
              .filter((apt) => apt.date >= today)
              .filter(applyCategoryFilter)
              .map((apt) => ({
                id: apt.id,
                activity_date: apt.date,
                activity_time: apt.activity_time ?? apt.ricontrollo_time,
                activity_type: apt.activity_type_raw,
                activity_description: apt.activity_description ?? null,
                person_name: apt.playerName,
                person_id: apt.person_id,
                category_label: apt.category_label ?? null,
                injury_id: apt.injury_id,
                duration_minutes: apt.duration_minutes,
                notes: apt.notes,
                confirmation_status: apt.confirmation_status,
                operator_name: apt.operatorName,
                sourceActivityId: apt.sourceActivityId,
              }))}
            onDeleteRequest={handleDeleteAgendaItem}
            onReorder={handleReorderAgendaItems}
          />
          </div>
        )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-6 lg:px-8 pb-6 pt-4">
        {/* Infortuni aperti */}
        {activeTab === 'aperti' && (
        <div className="mb-0 w-full">
          <section
            className="rounded-2xl border shadow-sm overflow-hidden w-full"
            style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
          >
            <div className="p-0">
              {loadingOpenInjuries ? (
                <div className="flex justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLEE.accent }} />
                  <span className="text-sm" style={{ color: GOLEE.textMuted }}>Caricamento...</span>
                </div>
              ) : openInjuries.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: GOLEE.textMuted }}>Nessun infortunio aperto.</p>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full min-w-full border-collapse">
                    <thead>
                      <tr>
                        <th style={thCell('center')}>Categoria</th>
                        <th style={thCell('left')}>Giocatore</th>
                        <th style={thCell('left')}>Infortunio</th>
                        <th style={thCell('center')}>Gravità</th>
                        <th style={thCell('center')}>Data</th>
                        <th style={thCell('center')}>GG</th>
                        <th style={thCell('center')}>Prev.</th>
                        <th style={thCell('center')}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openInjuries
                        .filter(inj => !inj.in_chiusura)
                        .filter(inj => matchesCategory(inj.category_label))
                        .map((inj) => {
                        const injuryDate = new Date(inj.injury_date)
                        const todayDate = new Date()
                        todayDate.setHours(0, 0, 0, 0)
                        injuryDate.setHours(0, 0, 0, 0)
                        const daysOpen = Math.floor((todayDate.getTime() - injuryDate.getTime()) / (1000 * 60 * 60 * 24))
                        const predictedDays = inj.expected_weeks_off ?? 0
                        const prevValue = predictedDays > 0 ? daysOpen - predictedDays : null
                        const isExpanded = expandedOpenInjuryId === inj.id
                        const handleRowClick = () => {
                          const nextId = isExpanded ? null : inj.id
                          setExpandedOpenInjuryId(nextId)
                          setSearchParams((prev) => {
                            const next = new URLSearchParams(prev)
                            if (nextId) next.set('expand', nextId)
                            else next.delete('expand')
                            return next
                          }, { replace: true })
                        }
                        const injuryActivities = injuryActivitiesByInjuryId[inj.id] || []
                        const medicalVisits = injuryActivities.filter(a => a.activity_type === 'medical_visit')
                        const physiotherapySessions = injuryActivities.filter(a => a.activity_type === 'physiotherapy')
                        const exams = injuryActivities.filter(a => a.activity_type === 'test')
                        const totalPhysioMinutes = physiotherapySessions.reduce((sum, a) => sum + (typeof a.duration_minutes === 'number' ? a.duration_minutes : parseInt(String(a.duration_minutes || 0), 10) || 0), 0)
                        const totalPhysioHours = Math.floor(totalPhysioMinutes / 60)
                        const remainingMinutes = totalPhysioMinutes % 60
                        const physioTimeDisplay = totalPhysioHours > 0 ? `${totalPhysioHours}h ${remainingMinutes}m` : `${remainingMinutes}m`
                        const totalMassaggi = physiotherapySessions.filter(a => a.massaggio).length
                        const totalLaser = physiotherapySessions.filter(a => a.laser).length
                        const totalTecar = physiotherapySessions.filter(a => a.tecar).length
                        const getActivityAmountValue = (a: { amount?: number | string | null; cost?: number | string | null }) => {
                          const raw = a.cost ?? a.amount
                          const value = typeof raw === 'number' ? raw : parseFloat(String(raw || 0))
                          return Number.isFinite(value) ? value : 0
                        }
                        const testCosts = injuryActivities.filter(a => (a.activity_type === 'test' || a.activity_type === 'spesa_esami_diagnostici') && getActivityAmountValue(a) > 0)
                        const equipmentCosts = injuryActivities.filter(a => (a.activity_type === 'equipment_purchase' || a.activity_type === 'acquisto_tutore') && getActivityAmountValue(a) > 0)
                        const expenses = injuryActivities.filter(a => a.activity_type === 'expenses' && getActivityAmountValue(a) > 0)
                        const refunds = injuryActivities.filter(a => a.activity_type === 'insurance_refund' && getActivityAmountValue(a) > 0)
                        const totalTestCosts = testCosts.reduce((s, a) => s + getActivityAmountValue(a), 0)
                        const totalEquipmentCosts = equipmentCosts.reduce((s, a) => s + getActivityAmountValue(a), 0)
                        const totalExpenses = expenses.reduce((s, a) => s + getActivityAmountValue(a), 0)
                        const totalRefunds = refunds.reduce((s, a) => s + getActivityAmountValue(a), 0)
                        const totalCosts = totalTestCosts + totalEquipmentCosts + totalExpenses
                        const statusLabel = inj.current_status || (inj.in_chiusura ? 'In chiusura' : 'In corso')
                        return (
                          <React.Fragment key={inj.id}>
                          <tr
                            onClick={handleRowClick}
                            className="cursor-pointer transition-colors"
                            style={{ backgroundColor: isExpanded ? GOLEE.accentSoft : AIRTABLE.rowBg }}
                            onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = AIRTABLE.rowHover }}
                            onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = AIRTABLE.rowBg }}
                          >
                            <td style={tdCell('center')}>
                              {(() => {
                                const abbr = abbreviateCategoryLabel(inj.category_label)
                                if (!abbr || abbr === '—') return <span style={{ color: GOLEE.textMuted }}>—</span>
                                const first = abbr.split(',')[0].trim()
                                return (
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-semibold ${getCategoryTagColor(abbr)}`} title={inj.category_label || ''}>
                                    {first}
                                  </span>
                                )
                              })()}
                            </td>
                            <td style={{ ...tdCell('left'), fontWeight: 600 }}>{inj.person_name}</td>
                            <td style={tdCell('left')}>
                              {inj.injury_type}{inj.body_part ? ` · ${inj.body_part}` : ''}
                            </td>
                            <td style={tdCell('center')}>
                              {inj.severity ? (
                                <SeverityBadge severity={inj.severity} />
                              ) : (
                                <span style={{ color: GOLEE.textMuted, fontSize: '16px' }}>—</span>
                              )}
                            </td>
                            <td style={{ ...tdCell('center'), color: GOLEE.textMuted }} className="whitespace-nowrap">
                              {new Date(inj.injury_date).toLocaleDateString('it-IT')}
                            </td>
                            <td style={{ ...tdCell('center'), fontVariantNumeric: 'tabular-nums' }}>{daysOpen}</td>
                            <td style={{ ...tdCell('center'), fontVariantNumeric: 'tabular-nums' }}>{prevValue !== null ? prevValue : '—'}</td>
                            <td style={tdCell('center')} onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openCreateModal(inj.id)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors mx-auto"
                                style={{ color: AIRTABLE.icon }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = AIRTABLE.iconHover
                                  e.currentTarget.style.backgroundColor = AIRTABLE.rowHover
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = AIRTABLE.icon
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                                title="Fissa appuntamento"
                                aria-label="Fissa appuntamento"
                              >
                                <CalendarPlus className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="px-4 py-4 align-top" style={{ backgroundColor: GOLEE.surfaceMuted, borderBottom: `1px solid ${AIRTABLE.border}` }}>
                                <div className="rounded-2xl border p-4 space-y-4" style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                    <div className="rounded-xl p-3 border text-center" style={{ backgroundColor: GOLEE.surfaceMuted, borderColor: GOLEE.border }}>
                                      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: GOLEE.textMuted }}>Tipo</div>
                                      <div className="text-sm font-bold" style={{ color: GOLEE.text }}>{inj.injury_type}{inj.body_part ? ` · ${inj.body_part}` : ''}</div>
                                    </div>
                                    <div className="rounded-xl p-3 border text-center" style={{ backgroundColor: GOLEE.surfaceMuted, borderColor: GOLEE.border }}>
                                      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: GOLEE.textMuted }}>Gravità</div>
                                      <div className="text-sm font-bold" style={{ color: GOLEE.text }}>{inj.severity || '—'}</div>
                                    </div>
                                    <div className="rounded-xl p-3 border text-center" style={{ backgroundColor: GOLEE.surfaceMuted, borderColor: GOLEE.border }}>
                                      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: GOLEE.textMuted }}>Stato</div>
                                      <div className="text-sm font-bold" style={{ color: GOLEE.text }}>{statusLabel}</div>
                                      {inj.in_chiusura && <span className="mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: GOLEE.warningSoft, color: GOLEE.warning }}>In chiusura</span>}
                                    </div>
                                    <div className="rounded-xl p-3 border text-center" style={{ backgroundColor: GOLEE.surfaceMuted, borderColor: GOLEE.border }}>
                                      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: GOLEE.textMuted }}>Giorni</div>
                                      <div className="text-lg font-bold" style={{ color: GOLEE.text }}>{daysOpen}</div>
                                    </div>
                                    <div className="rounded-xl p-3 border text-center" style={{ backgroundColor: GOLEE.surfaceMuted, borderColor: GOLEE.border }}>
                                      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: GOLEE.textMuted }}>Previsione</div>
                                      <div className="text-lg font-bold" style={{ color: GOLEE.text }}>{inj.expected_weeks_off ? `${inj.expected_weeks_off} giorni` : '—'}</div>
                                    </div>
                                    <div className="rounded-xl p-3 border text-center" style={{ backgroundColor: GOLEE.surfaceMuted, borderColor: GOLEE.border }}>
                                      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: GOLEE.textMuted }}>Causa</div>
                                      <div className="text-sm font-bold truncate" style={{ color: GOLEE.text }}>{inj.cause || '—'}</div>
                                    </div>
                                  </div>
                                  <div className="p-3 rounded-2xl border" style={{ backgroundColor: GOLEE.surfaceMuted, borderColor: GOLEE.border }}>
                                    <div className="grid grid-cols-3 items-center gap-3 text-base" style={{ color: GOLEE.text }}>
                                      <div className="text-left whitespace-nowrap">
                                        💸 Spese: <strong style={{ color: GOLEE.danger }}>{formatCurrency(totalCosts)}</strong>
                                      </div>
                                      <div className="text-center whitespace-nowrap">
                                        ⚖️ Bilancio: <strong style={{ color: (totalRefunds - totalCosts) >= 0 ? GOLEE.success : GOLEE.danger }}>{formatCurrency(totalRefunds - totalCosts)}</strong>
                                      </div>
                                      <div className="text-right whitespace-nowrap">
                                        💰 Rimborsi: <strong style={{ color: GOLEE.success }}>{formatCurrency(totalRefunds)}</strong>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-4 rounded-2xl border" style={{ backgroundColor: GOLEE.surfaceMuted, borderColor: GOLEE.border }}>
                                    <div className="text-center mb-3">
                                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>🏥 Attività Mediche</span>
                                    </div>
                                    <div className="flex flex-nowrap gap-2 text-sm overflow-x-auto">
                                      {[
                                        { icon: '🏥', label: 'Visite', value: medicalVisits.length, active: medicalVisits.length > 0, bg: GOLEE.infoSoft, text: GOLEE.info, border: '#BFDBFE' },
                                        { icon: '🔬', label: 'Esami', value: exams.length, active: exams.length > 0, bg: '#F3E8FF', text: '#7C3AED', border: '#DDD6FE' },
                                        { icon: '💪', label: 'Fisio', value: physiotherapySessions.length, active: physiotherapySessions.length > 0, bg: GOLEE.successSoft, text: GOLEE.success, border: '#A7F3D0' },
                                        { icon: '⚡', label: 'Tecar', value: totalTecar, active: totalTecar > 0, bg: GOLEE.warningSoft, text: GOLEE.warning, border: '#FDE68A' },
                                        { icon: '💆‍♂️', label: 'Massaggi', value: totalMassaggi, active: totalMassaggi > 0, bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
                                        { icon: '🔴', label: 'Laser', value: totalLaser, active: totalLaser > 0, bg: GOLEE.dangerSoft, text: GOLEE.danger, border: '#FECACA' },
                                        { icon: '⏱️', label: 'Ore', value: totalPhysioMinutes > 0 ? physioTimeDisplay : '0', active: totalPhysioMinutes > 0, bg: GOLEE.successSoft, text: GOLEE.success, border: '#A7F3D0' },
                                      ].map((item) => (
                                        <div
                                          key={item.label}
                                          className="text-center p-2.5 rounded-xl border font-medium shrink-0 flex-1 min-w-[5.5rem]"
                                          style={{
                                            backgroundColor: item.active ? item.bg : GOLEE.surface,
                                            borderColor: item.active ? item.border : GOLEE.border,
                                            color: item.active ? item.text : GOLEE.textMuted,
                                          }}
                                        >
                                          {item.icon} {item.label}{' '}
                                          <span className="font-bold">{item.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="border-t pt-4" style={{ borderColor: GOLEE.border }}>
                                    <h3 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: GOLEE.text }}>
                                      📋 Attività e Annotazioni ({injuryActivities.length})
                                    </h3>
                                    {injuryActivities.length === 0 ? (
                                      <p className="text-sm py-2" style={{ color: GOLEE.textMuted }}>Nessuna attività registrata.</p>
                                    ) : (
                                      <ul className="space-y-3">
                                        {injuryActivities.map((a) => (
                                          <li key={a.id}>
                                            <InjuryActivityRow
                                              activity={a}
                                              typeLabel={getActivityTypeLabel(a.activity_type, injuryActivityTypes)}
                                            />
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/create-person?edit=${inj.person_id}&tab=injuries&from=${encodeURIComponent(buildInfermeriaReturnUrl(inj.id))}`)}
                                      className="inline-flex items-center gap-1 mt-3 text-sm font-medium hover:underline"
                                      style={{ color: GOLEE.info }}
                                    >
                                      Vai alla scheda giocatore →
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
            )}
          </div>
        </section>
        </div>
        )}

        {/* Attività da confermare */}
        {activeTab === 'confermare' && (
        <div className="mb-0 w-full">
        <section className="rounded-2xl border shadow-sm overflow-hidden w-full" style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}>
          <div className="p-0">
            {loading ? (
              <div className="flex justify-center py-12 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLEE.accent }} />
              </div>
            ) : appointmentsDaConfermare.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: GOLEE.textMuted }}>Nessuna attività da confermare.</p>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th style={thCell('center')}>Data</th>
                      <th style={thCell('left')}>Giorno</th>
                      <th style={thCell('center')}>Cat.</th>
                      <th style={thCell('left')}>Giocatore</th>
                      <th style={thCell('center')}>Ora</th>
                      <th style={thCell('center')}>Durata</th>
                      <th style={thCell('left')}>Attività</th>
                      <th style={thCell('left')}>Tipologia</th>
                      <th style={thCell('left')}>Operatore</th>
                      <th style={thCell('center')}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointmentsDaConfermare.map((apt) => {
                      const start = apt.ricontrollo_time ? String(apt.ricontrollo_time).slice(0, 5) : '—'
                      const dur = apt.duration_minutes ?? 0
                      let slotText = start
                      if (start !== '—' && dur > 0) {
                        const [h, m] = start.split(':').map(Number)
                        const endMin = h * 60 + m + dur
                        const endH = Math.floor(endMin / 60) % 24
                        const endM = endMin % 60
                        slotText = `${start} – ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
                      } else if (dur > 0) slotText = `${dur} min`
                      const isSoloData = isSoloDataDaConfermare(apt)
                      const tipologiaDisplay = isSoloData ? 'Orario da fissare' : (apt.activityType === 'Visita medica' ? 'Da refertare' : 'Da confermare')
                      return (
                        <tr
                          key={apt.id}
                          style={{ backgroundColor: GOLEE.warningSoft }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FDE68A' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = GOLEE.warningSoft }}
                        >
                          <td style={{ ...tdCell('center'), fontWeight: 600 }} className="whitespace-nowrap text-sm">{new Date(apt.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                          <td style={tdCell('left')} className="text-sm capitalize">{new Date(apt.date).toLocaleDateString('it-IT', { weekday: 'long' })}</td>
                          <td style={tdCell('center')} className="text-sm">{abbreviateCategoryLabel(apt.category_label || '')}</td>
                          <td style={{ ...tdCell('left'), fontWeight: 600 }} className="text-sm">{apt.playerName}</td>
                          <td style={tdCell('center')} className="text-sm">{slotText}</td>
                          <td style={tdCell('center')} className="text-sm">{dur ? `${dur} min` : '—'}</td>
                          <td style={tdCell('left')} className="text-sm">{apt.activityType}</td>
                          <td style={{ ...tdCell('left'), color: GOLEE.warning, fontWeight: 600 }} className="text-sm">{tipologiaDisplay}</td>
                          <td style={tdCell('left')} className="text-sm">{apt.operatorName}</td>
                          <td style={tdCell('center')}>
                            <div className="flex items-center justify-center gap-1">
                              {apt.id.startsWith('vle-') ? (
                                <button type="button" onClick={() => setVisitListOutcomeAppointment(apt)} className="p-1.5 rounded transition-colors" style={{ color: GOLEE.info }} title="Esegui visita" aria-label="Esegui visita">
                                  <CheckCircle2 className="w-5 h-5" />
                                </button>
                              ) : (
                                <button type="button" onClick={() => openEditModal(apt)} className="p-1.5 rounded transition-colors" style={{ color: GOLEE.info }} title="Modifica" aria-label="Modifica">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                              )}
                              <button type="button" onClick={() => handleDelete(apt)} className="p-1.5 rounded transition-colors" style={{ color: GOLEE.danger }} title="Elimina" aria-label="Elimina">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
        </div>
        )}

        {/* Assenti */}
        {activeTab === 'assente' && (
        <div className="mb-0">
        <section className="rounded-2xl border shadow-sm overflow-hidden w-full" style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.warningSoft }}>
            <p className="text-sm" style={{ color: GOLEE.warning }}>Attività con stato &quot;Assente&quot; (giocatore non si è presentato).</p>
          </div>
          <div className="p-0">
            {loading ? (
              <div className="flex justify-center py-12 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLEE.accent }} />
              </div>
            ) : appointmentsAssente.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: GOLEE.textMuted }}>Nessuna attività con stato assente.</p>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th style={thCell('center')}>Data</th>
                      <th style={thCell('left')}>Giorno</th>
                      <th style={thCell('center')}>Cat.</th>
                      <th style={thCell('left')}>Giocatore</th>
                      <th style={thCell('center')}>Ora</th>
                      <th style={thCell('center')}>Durata</th>
                      <th style={thCell('left')}>Attività</th>
                      <th style={thCell('left')}>Tipologia</th>
                      <th style={thCell('left')}>Operatore</th>
                      <th style={thCell('center')}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointmentsAssente.map((apt) => {
                      const start = apt.ricontrollo_time ? String(apt.ricontrollo_time).slice(0, 5) : '—'
                      const dur = apt.duration_minutes ?? 0
                      let slotText = start
                      if (start !== '—' && dur > 0) {
                        const [h, m] = start.split(':').map(Number)
                        const endMin = h * 60 + m + dur
                        const endH = Math.floor(endMin / 60) % 24
                        const endM = endMin % 60
                        slotText = `${start} – ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
                      } else if (dur > 0) slotText = `${dur} min`
                      return (
                        <tr
                          key={apt.id}
                          style={{ backgroundColor: GOLEE.warningSoft }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FDE68A' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = GOLEE.warningSoft }}
                        >
                          <td style={{ ...tdCell('center'), fontWeight: 600 }} className="whitespace-nowrap text-sm">{new Date(apt.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                          <td style={tdCell('left')} className="text-sm capitalize">{new Date(apt.date).toLocaleDateString('it-IT', { weekday: 'long' })}</td>
                          <td style={tdCell('center')} className="text-sm">{abbreviateCategoryLabel(apt.category_label || '')}</td>
                          <td style={{ ...tdCell('left'), fontWeight: 600 }} className="text-sm">{apt.playerName}</td>
                          <td style={tdCell('center')} className="text-sm">{slotText}</td>
                          <td style={tdCell('center')} className="text-sm">{dur ? `${dur} min` : '—'}</td>
                          <td style={tdCell('left')} className="text-sm">{apt.activityType}</td>
                          <td style={{ ...tdCell('left'), color: GOLEE.warning, fontWeight: 600 }} className="text-sm">Assente</td>
                          <td style={tdCell('left')} className="text-sm">{apt.operatorName}</td>
                          <td style={tdCell('center')}>
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={() => openEditModal(apt)} className="p-1.5 rounded transition-colors" style={{ color: GOLEE.info }} title="Modifica" aria-label="Modifica">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button type="button" onClick={() => handleDelete(apt)} className="p-1.5 rounded transition-colors" style={{ color: GOLEE.danger }} title="Elimina" aria-label="Elimina">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
        </div>
        )}

        {/* Infortuni in chiusura */}
        {activeTab === 'chiusura' && (
        <div className="mb-0">
          <section className="rounded-2xl border shadow-sm overflow-hidden w-full" style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.warningSoft }}>
              <p className="text-sm" style={{ color: GOLEE.warning }}>Infortuni in fase di chiusura (visita di chiusura effettuata, non ancora chiusi definitivamente).</p>
            </div>
            <div className="p-0">
              {loadingOpenInjuries ? (
                <div className="flex justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLEE.accent }} />
                </div>
              ) : openInjuries.filter(i => i.in_chiusura).length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: GOLEE.textMuted }}>Nessun infortunio in chiusura.</p>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full min-w-full border-collapse">
                    <thead>
                      <tr>
                        <th style={thCell('left')}>Atleta</th>
                        <th style={thCell('left')}>Tipo infortunio</th>
                        <th style={thCell('center')}>Data infortunio</th>
                        <th style={thCell('center')}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openInjuries
                        .filter(i => i.in_chiusura)
                        .filter(inj => matchesCategory(inj.category_label))
                        .map((inj) => (
                        <tr
                          key={inj.id}
                          style={{ backgroundColor: AIRTABLE.rowBg }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = AIRTABLE.rowHover }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = AIRTABLE.rowBg }}
                        >
                          <td style={{ ...tdCell('left'), fontWeight: 600 }} className="text-sm">{inj.person_name}</td>
                          <td style={tdCell('left')} className="text-sm">{inj.injury_type}{inj.body_part ? ` · ${inj.body_part}` : ''}</td>
                          <td style={{ ...tdCell('center'), color: GOLEE.textMuted }} className="text-sm whitespace-nowrap">{new Date(inj.injury_date).toLocaleDateString('it-IT')}</td>
                          <td style={tdCell('center')}>
                            <button
                              type="button"
                              onClick={() => openCreateModal(inj.id)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors mx-auto"
                              style={{ color: AIRTABLE.icon }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = AIRTABLE.iconHover
                                e.currentTarget.style.backgroundColor = AIRTABLE.rowHover
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = AIRTABLE.icon
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                              title="Fissa appuntamento"
                              aria-label="Fissa appuntamento"
                            >
                              <CalendarPlus className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
        )}

        {/* Attività future (Impegni) */}
        {activeTab === 'attivita' && (
        <>
        {embedLight && (
          <div className="flex flex-wrap items-center gap-4 px-5 py-4 mb-4 rounded-2xl border shadow-sm" style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}>
            <div className="flex items-center gap-2 min-w-[180px] flex-1">
              <label className="text-sm font-medium shrink-0" style={{ color: GOLEE.textMuted }}>Giocatore:</label>
              <input
                type="text"
                value={filterGiocatore}
                onChange={(e) => setFilterGiocatore(e.target.value)}
                placeholder="Nome giocatore..."
                className="flex-1 rounded-lg px-3 py-1.5 text-sm border focus:ring-2 focus:ring-[#00C48C] focus:outline-none"
                style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface, color: GOLEE.text }}
              />
            </div>
            <div className="flex items-center gap-2 min-w-[180px] flex-1">
              <label className="text-sm font-medium shrink-0" style={{ color: GOLEE.textMuted }}>Attività:</label>
              <input
                type="text"
                value={filterAttivita}
                onChange={(e) => setFilterAttivita(e.target.value)}
                placeholder="Visita, Fisio..."
                className="flex-1 rounded-lg px-3 py-1.5 text-sm border focus:ring-2 focus:ring-[#00C48C] focus:outline-none"
                style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface, color: GOLEE.text }}
              />
            </div>
            <div className="flex items-center gap-2 min-w-[180px] flex-1">
              <label className="text-sm font-medium shrink-0" style={{ color: GOLEE.textMuted }}>Tipologia:</label>
              <input
                type="text"
                value={filterTipologia}
                onChange={(e) => setFilterTipologia(e.target.value)}
                placeholder="Ricontrollo, Massaggio..."
                className="flex-1 rounded-lg px-3 py-1.5 text-sm border focus:ring-2 focus:ring-[#00C48C] focus:outline-none"
                style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface, color: GOLEE.text }}
              />
            </div>
            <div className="flex items-center gap-2 min-w-[180px] flex-1">
              <label className="text-sm font-medium shrink-0" style={{ color: GOLEE.textMuted }}>Operatore:</label>
              <input
                type="text"
                value={filterOperatore}
                onChange={(e) => setFilterOperatore(e.target.value)}
                placeholder="Nome operatore..."
                className="flex-1 rounded-lg px-3 py-1.5 text-sm border focus:ring-2 focus:ring-[#00C48C] focus:outline-none"
                style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface, color: GOLEE.text }}
              />
            </div>
            <button
              type="button"
              onClick={() => { setFilterGiocatore(''); setFilterAttivita(''); setFilterTipologia(''); setFilterOperatore('') }}
              className="text-sm underline shrink-0"
              style={{ color: GOLEE.textMuted }}
            >
              Resetta filtri
            </button>
          </div>
        )}
        <div className="mb-0">
        <section className="rounded-2xl border shadow-sm overflow-hidden w-full" style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}>
          <div className="p-0">
            {loading ? (
              <div className="flex justify-center py-12 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLEE.accent }} />
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th style={thCell('center')}>Data</th>
                      <th style={thCell('left')}>Giorno</th>
                      <th style={thCell('center')}>Cat.</th>
                      <th style={thCell('left')}>Giocatore</th>
                      <th style={thCell('center')}>Ora</th>
                      <th style={thCell('center')}>Durata</th>
                      <th style={thCell('left')}>Attività</th>
                      <th style={thCell('left')}>Tipologia</th>
                      <th style={thCell('left')}>Operatore</th>
                      <th style={thCell('center')}>Azioni</th>
                    </tr>
                    {!embedLight && (
                    <tr>
                      <th style={thCell('center')} />
                      <th style={thCell('left')} />
                      <th style={thCell('center')} />
                      <th style={thCell('left')}>
                        <input
                          type="text"
                          value={filterGiocatore}
                          onChange={(e) => setFilterGiocatore(e.target.value)}
                          placeholder="Nome giocatore..."
                          className="w-full min-w-0 px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-sky-400"
                          style={{ borderColor: GOLEE.border }}
                        />
                      </th>
                      <th style={thCell('center')} />
                      <th style={thCell('center')} />
                      <th style={thCell('left')}>
                        <input
                          type="text"
                          value={filterAttivita}
                          onChange={(e) => setFilterAttivita(e.target.value)}
                          placeholder="Visita, Fisio..."
                          className="w-full min-w-0 px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-sky-400"
                          style={{ borderColor: GOLEE.border }}
                        />
                      </th>
                      <th style={thCell('left')}>
                        <input
                          type="text"
                          value={filterTipologia}
                          onChange={(e) => setFilterTipologia(e.target.value)}
                          placeholder="Ricontrollo..."
                          className="w-full min-w-0 px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-sky-400"
                          style={{ borderColor: GOLEE.border }}
                        />
                      </th>
                      <th style={thCell('left')}>
                        <input
                          type="text"
                          value={filterOperatore}
                          onChange={(e) => setFilterOperatore(e.target.value)}
                          placeholder="Operatore..."
                          className="w-full min-w-0 px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-sky-400"
                          style={{ borderColor: GOLEE.border }}
                        />
                      </th>
                      <th style={thCell('center')} />
                    </tr>
                    )}
                  </thead>
                  <tbody>
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-sm" style={{ color: GOLEE.textMuted }}>
                          Nessun impegno.
                        </td>
                      </tr>
                    ) : (
                    filteredAppointments.map((apt) => {
                      const start = apt.ricontrollo_time ? String(apt.ricontrollo_time).slice(0, 5) : '—'
                      const dur = apt.duration_minutes ?? 0
                      let slotText = start
                      if (start !== '—' && dur > 0) {
                        const [h, m] = start.split(':').map(Number)
                        const endMin = h * 60 + m + dur
                        const endH = Math.floor(endMin / 60) % 24
                        const endM = endMin % 60
                        slotText = `${start} – ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
                      } else if (dur > 0) slotText = `${dur} min`
                      const cospicuo = isCospicuo(apt, today)
                      const tipologiaDisplay = cospicuo
                        ? (apt.activityType === 'Visita medica' ? 'Da refertare' : 'Da confermare')
                        : getTipologiaLabel(apt)
                      const rowBg = cospicuo ? GOLEE.dangerSoft : AIRTABLE.rowBg
                      const rowHover = cospicuo ? '#FECACA' : AIRTABLE.rowHover
                      return (
                        <tr
                          key={apt.id}
                          style={{ backgroundColor: rowBg }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = rowHover }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = rowBg }}
                        >
                          <td style={{ ...tdCell('center'), fontWeight: 600 }} className="whitespace-nowrap text-sm">{new Date(apt.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                          <td style={tdCell('left')} className="text-sm capitalize">{new Date(apt.date).toLocaleDateString('it-IT', { weekday: 'long' })}</td>
                          <td style={tdCell('center')} className="text-sm">{abbreviateCategoryLabel(apt.category_label || '')}</td>
                          <td style={{ ...tdCell('left'), fontWeight: 600 }} className="text-sm">{apt.playerName}</td>
                          <td style={tdCell('center')} className="text-sm">{slotText}</td>
                          <td style={tdCell('center')} className="text-sm">{dur ? `${dur} min` : '—'}</td>
                          <td style={tdCell('left')} className="text-sm">{apt.activityType}</td>
                          <td style={{ ...tdCell('left'), color: cospicuo ? GOLEE.danger : GOLEE.text, fontWeight: cospicuo ? 600 : 400 }} className="text-sm">{tipologiaDisplay}</td>
                          <td style={tdCell('left')} className="text-sm">{apt.operatorName}</td>
                          <td style={tdCell('center')}>
                            <div className="flex items-center justify-center gap-1">
                              {apt.id.startsWith('vle-') ? (
                                <button type="button" onClick={() => setVisitListOutcomeAppointment(apt)} className="p-1.5 rounded transition-colors" style={{ color: GOLEE.info }} title="Esegui visita" aria-label="Esegui visita">
                                  <CheckCircle2 className="w-5 h-5" />
                                </button>
                              ) : (
                                <button type="button" onClick={() => openEditModal(apt)} className="p-1.5 rounded transition-colors" style={{ color: GOLEE.info }} title="Modifica attività" aria-label="Modifica attività">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                              )}
                              <button type="button" onClick={() => handleDelete(apt)} className="p-1.5 rounded transition-colors" style={{ color: GOLEE.danger }} title="Elimina appuntamento" aria-label="Elimina appuntamento">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }) )
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
        </div>
        </>
        )}

        {/* Infortuni chiusi */}
        {activeTab === 'chiusi' && (
        <div className="mb-0">
          <section className="rounded-2xl border shadow-sm overflow-hidden w-full" style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}>
            <div className="p-0">
              {loadingClosedInjuries ? (
                <div className="flex justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLEE.accent }} />
                </div>
              ) : closedInjuries.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: GOLEE.textMuted }}>Nessun infortunio chiuso.</p>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full min-w-full border-collapse">
                    <thead>
                      <tr>
                        <th style={thCell('center')}>Data infortunio</th>
                        <th style={thCell('center')}>Data chiusura</th>
                        <th style={thCell('left')}>Atleta</th>
                        <th style={thCell('center')}>Cat.</th>
                        <th style={thCell('left')}>Tipo infortunio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedInjuries
                        .filter(inj => matchesCategory(inj.category_label))
                        .map((inj) => (
                        <tr
                          key={inj.id}
                          style={{ backgroundColor: AIRTABLE.rowBg }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = AIRTABLE.rowHover }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = AIRTABLE.rowBg }}
                        >
                          <td style={{ ...tdCell('center'), color: GOLEE.textMuted }} className="text-sm whitespace-nowrap">{new Date(inj.injury_date).toLocaleDateString('it-IT')}</td>
                          <td style={{ ...tdCell('center'), color: GOLEE.textMuted }} className="text-sm whitespace-nowrap">{inj.closing_date ? new Date(inj.closing_date).toLocaleDateString('it-IT') : '—'}</td>
                          <td style={{ ...tdCell('left'), fontWeight: 600 }} className="text-sm">{inj.person_name}</td>
                          <td style={tdCell('center')} className="text-sm">{abbreviateCategoryLabel(inj.category_label)}</td>
                          <td style={tdCell('left')} className="text-sm">{inj.injury_type}{inj.body_part ? ` · ${inj.body_part}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
        )}
        </div>
      </main>
      )}

      {/* Modal unificato: Nuova attività / Modifica attività (FlowMe) */}
      <AnimatePresence>
        {(showCreateModal || editingAppointment) && (
          <motion.div
            key="create-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ background: `radial-gradient(800px 500px at 20% 20%, rgba(17,43,92,0.38), transparent 60%), rgba(2,6,23,0.55)` }}
            />
            <motion.div
              className={`relative w-full max-h-[100vh] overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl ${isInsuranceRefundType(activityForm.activity_type) ? 'max-w-md' : 'max-w-4xl'}`}
              initial={{ y: 14, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.98, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Hero header */}
              <div className="relative px-6 py-5" style={{ background: isInsuranceRefundType(activityForm.activity_type) ? 'linear-gradient(135deg, #166534 0%, #15803d 55%, #22c55e 130%)' : `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_2} 55%, #1f4aa3 130%)` }}>
                <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(600px 300px at 20% 30%, rgba(255,255,255,0.35), transparent 60%), radial-gradient(500px 240px at 85% 10%, rgba(255,255,255,0.25), transparent 60%)' }} />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-white">
                      {isInsuranceRefundType(activityForm.activity_type) ? <span className="text-lg">💰</span> : <Activity className="h-4 w-4" />}
                      <span className="text-lg font-semibold">
                        {isInsuranceRefundType(activityForm.activity_type)
                          ? (editingAppointment ? 'Modifica rimborso' : 'Rimborso assicurativo')
                          : (editingAppointment ? 'Modifica attività' : 'Nuova attività')}
                      </span>
                    </div>
                    {isInsuranceRefundType(activityForm.activity_type) ? (
                      <p className="mt-1 text-sm text-white/85">Registra l&apos;importo ricevuto dall&apos;assicurazione</p>
                    ) : editingAppointment ? (
                      <p className="mt-1 text-sm text-white/75">{editingAppointment.playerName} – {editingAppointment.activityType}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={editingAppointment ? confirmEdit : confirmCreate} disabled={savingActivity || !activityFormValidation.ok} title="Salva Attività" className="p-2 rounded-full text-white bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:pointer-events-none transition-colors">
                      <Save className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={closeCreateModal} className="p-2 rounded-full text-white bg-white/20 hover:bg-white/30 transition-colors" title="Chiudi">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Body */}
              {isInsuranceRefundType(activityForm.activity_type) ? (
                <div className="p-6 overflow-y-auto max-h-[calc(100vh-180px)]">
                  {!activityFormValidation.ok && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <p className="font-medium">Completa i campi obbligatori per salvare:</p>
                      <ul className="mt-1 list-disc list-inside">
                        {activityFormValidation.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                  {(() => {
                    const inj = activityForm.injury_id ? openInjuries.find(i => i.id === activityForm.injury_id) : null
                    if (inj) {
                      return (
                        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="text-xs text-slate-500">Infortunio</div>
                          <div className="text-sm font-semibold text-slate-800">{inj.person_name}</div>
                        </div>
                      )
                    }
                    if (!editingAppointment) {
                      return (
                        <div className="mb-5">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-2"><User className="h-4 w-4 text-slate-500" /> Giocatore (infortunio) <span className="text-red-500">*</span></label>
                          <select value={activityForm.injury_id || ''} onChange={e => setActivityForm(prev => ({ ...prev, injury_id: e.target.value || null }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" required>
                            <option value="">Seleziona giocatore (infortunio aperto)</option>
                            {openInjuries.map(i => <option key={i.id} value={i.id}>{i.person_name}</option>)}
                          </select>
                        </div>
                      )
                    }
                    return null
                  })()}
                  <div className="grid gap-5">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-2"><CalendarDays className="h-4 w-4 text-slate-500" /> Data ricezione rimborso <span className="text-red-500">*</span></label>
                      <input type="date" value={toDateOnly(activityForm.date)} onChange={e => setActivityForm(prev => ({ ...prev, date: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-2">Importo rimborsato (€) <span className="text-red-500">*</span></label>
                      <input type="number" step="0.01" min="0.01" autoFocus value={activityForm.cost} onChange={e => setActivityForm(prev => ({ ...prev, cost: e.target.value }))} placeholder="0,00" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg font-semibold text-slate-900 shadow-sm focus:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-2">Note (opzionale)</label>
                      <textarea value={activityForm.notes} onChange={e => setActivityForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} placeholder="Es. riferimento sinistro, polizza base..." className="min-h-[72px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" />
                    </div>
                  </div>
                  {activityForm.cost.trim() && !isNaN(parseFloat(activityForm.cost)) && parseFloat(activityForm.cost) > 0 && (
                    <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center">
                      <div className="text-xs text-green-700">Entrerà nel riepilogo finanziario come rimborso</div>
                      <div className="text-2xl font-bold text-green-700">€ {parseFloat(activityForm.cost).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                  )}
                </div>
              ) : (
              <div className="grid gap-0 md:grid-cols-5 overflow-hidden max-h-[calc(100vh-180px)]">
                <div className="md:col-span-3 p-6">
                  {!activityFormValidation.ok && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <p className="font-medium">Completa i campi obbligatori per salvare:</p>
                      <ul className="mt-1 list-disc list-inside">
                        {activityFormValidation.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="grid gap-5">
                    {!editingAppointment && (
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-2"><User className="h-4 w-4 text-slate-500" /> Giocatore (infortunio) <span className="text-red-500">*</span></label>
                      <select value={activityForm.injury_id || ''} onChange={e => setActivityForm(prev => ({ ...prev, injury_id: e.target.value || null }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" required>
                        <option value="">Seleziona giocatore (infortunio aperto)</option>
                        {openInjuries.map(inj => <option key={inj.id} value={inj.id}>{inj.person_name}</option>)}
                      </select>
                    </div>
                    )}
                    {/* Operatore e tipo attività. Per acquisti il tipo è già scelto dal popup. */}
                    <div className={`grid gap-4 min-w-0 ${isPurchaseActivityType(activityForm.activity_type) ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-slate-800 mb-2"><User className="h-4 w-4 text-slate-500 inline mr-1" /> Operatore</label>
                        <select value={activityModalOperatorValue} onChange={e => setActivityForm(prev => ({ ...prev, operator_name: e.target.value, operator_other: e.target.value === 'Altro' ? prev.operator_other : '' }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200">
                          <option value="">Seleziona</option>
                          {activityModalStaffOptions.map(s => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                          <option value="Altro">Altro</option>
                        </select>
                        {activityForm.operator_name === 'Altro' && (
                          <input type="text" value={activityForm.operator_other} onChange={e => setActivityForm(prev => ({ ...prev, operator_other: e.target.value }))} placeholder="Nome operatore (opzionale)" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" />
                        )}
                      </div>
                      {!isPurchaseActivityType(activityForm.activity_type) && (
                        <div className="min-w-0">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-2"><Activity className="h-4 w-4 text-slate-500" /> Tipo attività <span className="text-red-500">*</span></label>
                          <select value={activityForm.activity_type} onChange={e => setActivityForm(prev => ({ ...prev, activity_type: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200">
                            {activityTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    {isMedicalVisitType(activityForm.activity_type) && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-slate-800 mb-2">Descrizione visita</label>
                          <select value={activityForm.activity_description} onChange={e => setActivityForm(prev => ({ ...prev, activity_description: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200">
                            {VISIT_DESCRIPTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-800 mb-2">Stato <span className="text-red-500">*</span></label>
                          <select value={activityForm.stato_visita} onChange={e => setActivityForm(prev => ({ ...prev, stato_visita: (e.target.value === 'eseguito' || e.target.value === 'assente' ? e.target.value : '') as '' | 'eseguito' | 'assente' }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200">
                            <option value="">Seleziona stato</option>
                            <option value="eseguito">Eseguito</option>
                            <option value="assente">Assente</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 items-start">
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-sm font-medium text-slate-800 mb-2">Autorizzazioni</label>
                          <div className="flex flex-wrap items-center gap-4">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={activityForm.can_play_field} onChange={e => setActivityForm(prev => ({ ...prev, can_play_field: e.target.checked }))} className="shrink-0 w-4 h-4" />
                              <span className="text-slate-900 font-medium">Campo</span>
                            </label>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={activityForm.can_play_gym} onChange={e => setActivityForm(prev => ({ ...prev, can_play_gym: e.target.checked }))} className="shrink-0 w-4 h-4" />
                              <span className="text-slate-900 font-medium">Palestra</span>
                            </label>
                          </div>
                        </div>
                        <div className="flex-1 min-w-[140px] flex flex-col items-center">
                          <label className="block text-sm font-medium text-slate-800 mb-2 w-full text-center">Fisioterapia</label>
                          <label className="flex items-center justify-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={activityForm.richiesta_fisioterapia} onChange={e => setActivityForm(prev => ({ ...prev, richiesta_fisioterapia: e.target.checked }))} className="shrink-0 w-4 h-4" />
                            <span className="text-slate-900 font-medium">{activityForm.richiesta_fisioterapia ? 'Programmare' : 'No'}</span>
                          </label>
                        </div>
                        <div className="flex-1 min-w-0">
                          {activityForm.activity_description === 'prima_visita' && activityForm.activity_type === 'medical_visit' ? (
                            <>
                              <label className="block text-sm font-medium text-slate-800 mb-2">Previsione gg Stop <span className="text-red-500">*</span></label>
                              <input
                                type="number"
                                value={activityForm.expected_stop_days}
                                onChange={e => setActivityForm(prev => ({ ...prev, expected_stop_days: e.target.value }))}
                                placeholder="0"
                                min={0}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 bg-white"
                              />
                            </>
                          ) : isMedicalVisitType(activityForm.activity_type) ? (() => {
                            const inj = activityForm.injury_id ? openInjuries.find(i => i.id === activityForm.injury_id) : null
                            const dur = inj ? (inj as { duration_days?: number }).duration_days : null
                            const weeks = inj?.expected_weeks_off ?? 0
                            const q = dur != null && dur % 7 === 0 ? dur / 7 : 0
                            const wrongMigration = q >= 14 && q <= 60
                            const giorniPreventivati = wrongMigration ? q : (dur != null && dur >= 1 && dur <= 365 ? dur : (weeks > 12 ? weeks : weeks * 7))
                            return (
                              <div>
                                <label className="block text-sm font-medium text-slate-800 mb-2">Giorni preventivati stop</label>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                                  {giorniPreventivati > 0 ? giorniPreventivati : '—'}
                                </div>
                              </div>
                            )
                          })() : null}
                        </div>
                      </div>
                    </>
                    )}
                    <div className={`grid gap-4 ${isPurchaseActivityType(activityForm.activity_type) ? 'sm:grid-cols-1' : 'sm:grid-cols-3'}`}>
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-2"><CalendarDays className="h-4 w-4 text-slate-500" /> Data <span className="text-red-500">*</span></label>
                        <input type="date" value={toDateOnly(activityForm.date)} onChange={e => setActivityForm(prev => ({ ...prev, date: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" />
                      </div>
                      {!isPurchaseActivityType(activityForm.activity_type) && (
                        <>
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-2"><Clock className="h-4 w-4 text-slate-500" /> Orario</label>
                            <input type="time" value={activityForm.activity_time} onChange={e => setActivityForm(prev => ({ ...prev, activity_time: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" />
                          </div>
                          <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-2"><Timer className="h-4 w-4 text-slate-500" /> Durata (min)</label>
                            <input type="number" value={activityForm.duration_minutes} onChange={e => setActivityForm(prev => ({ ...prev, duration_minutes: e.target.value }))} placeholder="Es. 30" min={1} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" />
                          </div>
                        </>
                      )}
                    </div>
                    {isPhysiotherapyType(activityForm.activity_type) && (
                      <>
                        <div>
                          <label className="text-sm font-medium text-slate-800 mb-2 block">Trattamenti <span className="text-red-500">*</span></label>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setActivityForm(prev => ({ ...prev, massaggio: !prev.massaggio }))} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${activityForm.massaggio ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`} style={activityForm.massaggio ? { background: 'linear-gradient(135deg, #0B1B3A 0%, #112B5C 65%, #1f4aa3 150%)' } : undefined}>
                              <span className={`h-2 w-2 rounded-full ${activityForm.massaggio ? 'bg-white' : 'bg-slate-300'}`} />
                              Massaggio
                            </button>
                            <button type="button" onClick={() => setActivityForm(prev => ({ ...prev, tecar: !prev.tecar }))} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${activityForm.tecar ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`} style={activityForm.tecar ? { background: 'linear-gradient(135deg, #0B1B3A 0%, #112B5C 65%, #1f4aa3 150%)' } : undefined}>
                              <span className={`h-2 w-2 rounded-full ${activityForm.tecar ? 'bg-white' : 'bg-slate-300'}`} />
                              Tecar
                            </button>
                            <button type="button" onClick={() => setActivityForm(prev => ({ ...prev, laser: !prev.laser }))} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${activityForm.laser ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`} style={activityForm.laser ? { background: 'linear-gradient(135deg, #0B1B3A 0%, #112B5C 65%, #1f4aa3 150%)' } : undefined}>
                              <span className={`h-2 w-2 rounded-full ${activityForm.laser ? 'bg-white' : 'bg-slate-300'}`} />
                              Laser
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-2"><CheckCircle2 className="h-4 w-4 text-slate-500" /> Conferma esecuzione</label>
                          <select value={activityForm.confirmation_status} onChange={e => setActivityForm(prev => ({ ...prev, confirmation_status: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200">
                            {CONFERMA_OPZIONI.map(o => <option key={o.value || '_'} value={o.value}>{o.label}</option>)}
                          </select>
                          <p className="text-xs text-slate-500 mt-1">Eseguita = terapia effettuata. Assente = giocatore non presente. Altro = richiede motivazione nelle note.</p>
                        </div>
                      </>
                    )}
                    {!isMedicalVisitType(activityForm.activity_type) && (
                      <>
                        <div className={`grid gap-4 ${isPurchaseActivityType(activityForm.activity_type) ? 'sm:grid-cols-1' : 'sm:grid-cols-2'}`}>
                          <div>
                            <label className="block text-sm font-medium text-slate-800 mb-2">Costo</label>
                            <input type="number" step="0.01" min="0" value={activityForm.cost} onChange={e => setActivityForm(prev => ({ ...prev, cost: e.target.value }))} placeholder="0.00" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" />
                          </div>
                          {!isPurchaseActivityType(activityForm.activity_type) && (
                            <div>
                              <label className="block text-sm font-medium text-slate-800 mb-2">Valuta</label>
                              <select value={activityForm.cost_currency} onChange={e => setActivityForm(prev => ({ ...prev, cost_currency: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200">
                                {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                        {!isPurchaseActivityType(activityForm.activity_type) && (
                          <div>
                            <label className="block text-sm font-medium text-slate-800 mb-2">Ricontrollo (data)</label>
                            <input type="date" value={toDateOnly(activityForm.recheck_date)} onChange={e => setActivityForm(prev => ({ ...prev, recheck_date: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" />
                          </div>
                        )}
                      </>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-2">{isPurchaseActivityType(activityForm.activity_type) ? 'Descrizione' : isMedicalVisitType(activityForm.activity_type) ? <>Referto <span className="text-red-500">*</span></> : activityForm.confirmation_status === 'altro' ? <>Note (obbligatorie) <span className="text-red-500">*</span></> : 'Note aggiuntive'}</label>
                      <textarea value={activityForm.notes} onChange={e => setActivityForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} placeholder={isPurchaseActivityType(activityForm.activity_type) ? 'Descrivi il tutore o l\'acquisto...' : isMedicalVisitType(activityForm.activity_type) ? 'Referto della visita...' : 'Note dettagliate sull\'attività...'} className="min-h-[92px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200" />
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2 border-t border-slate-200 bg-slate-50/70 p-6 md:border-l md:border-t-0">
                  <div className="sticky top-6">
                    <div className="text-sm font-semibold" style={{ color: NAVY }}>Riepilogo</div>
                    <div className="mt-1 text-xs text-slate-500">Controllo finale prima di salvare.</div>
                    <div className="mt-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-slate-500">Operatore</div>
                          <div className="text-sm font-semibold text-slate-800">{resolveOperatorName(activityForm.operator_name, activityForm.operator_other) || '—'}</div>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">{formatActivityType(activityForm.activity_type)}</span>
                      </div>
                      <div className="my-3 h-px w-full bg-slate-200" />
                      <div className="grid gap-3 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Data</span><span className="font-medium text-slate-800 text-right">{activityForm.date ? new Date(activityForm.date).toLocaleDateString('it-IT') : '—'}</span></div>
                        {!isPurchaseActivityType(activityForm.activity_type) && (
                          <div className="flex justify-between"><span className="text-slate-500">Orario</span><span className="font-medium text-slate-800 text-right">{activityForm.activity_time ? activityForm.activity_time.slice(0,5) : '—'}</span></div>
                        )}
                        {!isPurchaseActivityType(activityForm.activity_type) && (
                          <div className="flex justify-between"><span className="text-slate-500">Durata</span><span className="font-medium text-slate-800 text-right">{activityForm.duration_minutes ? `${activityForm.duration_minutes} min` : '—'}</span></div>
                        )}
                        {isPurchaseActivityType(activityForm.activity_type) && (
                          <div className="flex justify-between"><span className="text-slate-500">Costo</span><span className="font-medium text-slate-800 text-right">{activityForm.cost ? `${activityForm.cost} EUR` : '—'}</span></div>
                        )}
                        {!isPurchaseActivityType(activityForm.activity_type) && (
                          <div className="flex justify-between"><span className="text-slate-500">Trattamenti</span><span className="font-medium text-slate-800 text-right">{isPhysiotherapyType(activityForm.activity_type) ? [activityForm.massaggio && 'Massaggio', activityForm.tecar && 'Tecar', activityForm.laser && 'Laser'].filter(Boolean).join(' • ') || '—' : '—'}</span></div>
                        )}
                        {!isPurchaseActivityType(activityForm.activity_type) && (
                          <div className="flex justify-between"><span className="text-slate-500">Conferma</span><span className="font-medium text-slate-800 text-right">{CONFERMA_OPZIONI.find(o => o.value === activityForm.confirmation_status)?.label || '—'}</span></div>
                        )}
                      </div>
                      {activityForm.notes?.trim() && <><div className="my-3 h-px w-full bg-slate-200" /><div className="text-xs text-slate-500">{isPurchaseActivityType(activityForm.activity_type) ? 'Descrizione' : 'Note'}</div><div className="mt-1 text-sm text-slate-800">{activityForm.notes}</div></>}
                    </div>
                    {isMedicalVisitType(activityForm.activity_type) && (
                      <div className="mt-4">
                        <button type="button" onClick={() => { setRicontrolloModalFromButton(true); setShowRicontrolloModal(true) }} className="w-full inline-flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-100 transition-colors">
                          {pendingRicontrolloChoice === 'no' ? 'Ricontrollo: No' : pendingRicontrolloChoice === 'data_ora' ? 'Ricontrollo: Sì, data e ora' : pendingRicontrolloChoice?.type === 'solo_data' ? `Ricontrollo: ${new Date(pendingRicontrolloChoice.date).toLocaleDateString('it-IT')}` : 'Fissa ricontrollo'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}

              {(createOverlapConfirmModal || overlapConfirmModal) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-3xl bg-black/60 p-4">
                  <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
                    <p className="text-gray-800 mb-6">{createOverlapConfirmModal?.message ?? overlapConfirmModal?.message}</p>
                    <div className="flex gap-3 justify-end">
                      <button type="button" onClick={() => { setCreateOverlapConfirmModal(null); setOverlapConfirmModal(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annulla</button>
                      <button type="button" onClick={editingAppointment ? handleOverlapConfirm : handleCreateOverlapConfirm} disabled={savingActivity} className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">Procedi comunque</button>
                    </div>
                  </div>
                </div>
              )}

              {showRicontrolloModal && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-3xl bg-black/60 p-4">
                  <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
                    <p className="text-gray-800 mb-4 font-medium">Fissare Ricontrollo?</p>
                    <div className="flex gap-2 flex-wrap justify-stretch">
                      <button type="button" onClick={handleRicontrolloNo} disabled={savingActivity} className="flex-1 min-w-[80px] px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">No</button>
                      <button type="button" onClick={handleRicontrolloWithDateTime} disabled={savingActivity} className="flex-1 min-w-[80px] px-3 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_2} 60%)` }}>Sì, data e ora</button>
                      <button type="button" onClick={handleRicontrolloSoloData} disabled={savingActivity} className="flex-1 min-w-[80px] px-3 py-2 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-700 disabled:opacity-50">Sì, solo data</button>
                    </div>
                  </div>
                </div>
              )}

              {showRicontrolloDatePicker && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-3xl bg-black/60 p-4">
                  <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
                    <p className="text-gray-900 mb-3 font-medium">Data del giorno del ricontrollo</p>
                    <input type="date" value={selectedRicontrolloDate} onChange={e => setSelectedRicontrolloDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 text-gray-900 bg-white [color-scheme:light]" />
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setShowRicontrolloDatePicker(false)} className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annulla</button>
                      <button type="button" onClick={handleRicontrolloDateConfirm} disabled={savingActivity || !selectedRicontrolloDate} className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_2} 60%)` }}>Conferma</button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: a chi inviare notifica della modifica */}
      {notificationChoiceModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => !sendingNotification && setNotificationChoiceModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Invia notifica della modifica?</h2>
            <p className="text-sm text-gray-600 mb-4">Vuoi avvisare qualcuno della variazione? Scegli a chi inviare la notifica sull&apos;app mobile.</p>
            <ul className="text-sm text-gray-700 mb-5 space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
              <li><span className="font-medium">Operatore:</span> {notificationChoiceModal.operatorName}</li>
              <li><span className="font-medium">Giocatore:</span> {notificationChoiceModal.playerName}</li>
            </ul>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => handleSendNotification('operator')} disabled={sendingNotification} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-brand-secondary rounded-lg hover:opacity-90 disabled:opacity-50">
                {sendingNotification ? 'Invio...' : 'Solo all\'operatore'}
              </button>
              <button type="button" onClick={() => handleSendNotification('player')} disabled={sendingNotification} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-brand-secondary rounded-lg hover:opacity-90 disabled:opacity-50">
                {sendingNotification ? 'Invio...' : 'Solo al giocatore'}
              </button>
              <button type="button" onClick={() => handleSendNotification('both')} disabled={sendingNotification} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-brand-primary rounded-lg hover:opacity-90 disabled:opacity-50">
                {sendingNotification ? 'Invio...' : 'A entrambi'}
              </button>
              <button type="button" onClick={() => setNotificationChoiceModal(null)} disabled={sendingNotification} className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                No, chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title="Elimina appuntamento"
        message="Sei sicuro di voler eliminare questo appuntamento da Infortuni?"
        itemName={deleteModal?.label}
        loading={deleting}
      />
      <VisitListOutcomeModal
        isOpen={!!visitListOutcomeAppointment}
        onClose={() => setVisitListOutcomeAppointment(null)}
        appointment={visitListOutcomeAppointment ? { id: visitListOutcomeAppointment.id, date: visitListOutcomeAppointment.date, playerName: visitListOutcomeAppointment.playerName, person_id: visitListOutcomeAppointment.person_id, activity_description: visitListOutcomeAppointment.activity_description, ricontrollo_time: visitListOutcomeAppointment.ricontrollo_time } : null}
        onSuccess={async () => { await loadAppointments(); await loadOpenInjuries() }}
        medicalStaff={medicalStaff.map(s => ({ id: s.id, full_name: s.full_name }))}
      />
    </div>
  )
}
