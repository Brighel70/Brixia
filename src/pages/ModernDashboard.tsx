import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Users,
  Activity,
  CreditCard,
  AlertTriangle,
  Clock,
  TrendingUp,
  Cake,
  Dumbbell,
  Calendar,
  BarChart2,
  StickyNote,
  Trophy,
  Stethoscope,
  UserX,
  UserPlus,
  CalendarPlus,
  ClipboardCheck,
  Send,
  MessageCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import { getBirthdayMessage } from '@/lib/birthdayMessage'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useEventTypes } from '@/hooks/useEventTypes'
import WhatsAppOpenModal from '@/components/WhatsAppOpenModal'
import { useAuth } from '@/store/auth'
import { supabase } from '@/lib/supabaseClient'
import { getBrandConfig } from '@/config/brand'
import { readCategoryIds } from '@/lib/categoryMemberships'
import { listInboxMessagesForDashboard, hideThreadInboxFromHome, markHomeInboxThreadOpened, type CorrInboxItem } from '@/lib/correspondence'
import { formatDisplayPersonName } from '@/lib/formatPersonName'

/** Palette Goleee – sezioni dashboard sotto il blocco hero */
const GOLEE = {
  surface: '#FFFFFF',
  surfaceMuted: '#F4F6F8',
  border: '#E8ECF0',
  text: '#1A2332',
  textMuted: '#6B7280',
  accent: '#00C48C',
  accentSoft: '#E6FAF3',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  success: '#10B981',
  successSoft: '#ECFDF5',
  violet: '#8B5CF6',
  violetSoft: '#F3E8FF',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
} as const

const goleeCardClass = 'rounded-2xl border shadow-sm overflow-hidden bg-white'

/** Testi card Goleee: +2px (~2pt) rispetto alle misure Tailwind standard */
const CARD = {
  micro: 'text-xs',
  tiny: 'text-[13px]',
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-[22px]',
  metric: 'text-[26px]',
} as const

const QUICK_ACTIONS = [
  { label: 'Nuova Anagrafica', path: '/create-person', icon: UserPlus },
  { label: 'Nuovo Evento', path: '/events', icon: CalendarPlus },
  { label: 'Segna Presenze', path: '/attendance', icon: ClipboardCheck },
  { label: 'Report Settimanale', path: '/resoconto-settimanale', icon: BarChart2 }
]

/** Ordine categoria dalla più piccola alla più grande (U6 → Serie B) */
function normalizeCategorySortKey(label: string | undefined): string {
  if (!label?.trim()) return ''
  const first = label.split(',')[0].trim()
  const lower = first.toLowerCase()
  const byName: Record<string, string> = {
    'under 6': 'U6', 'under 8': 'U8', 'under 10': 'U10', 'under 12': 'U12',
    'under 14': 'U14', 'under 16': 'U16', 'under 18': 'U18',
    'serie c': 'C', 'serie b': 'B',
  }
  if (byName[lower]) return byName[lower]
  const upper = first.toUpperCase()
  if (/^U\d{1,2}$/.test(upper)) return upper
  if (upper === 'C' || upper === 'B') return upper
  return upper
}

function categoryDisplayOrder(label: string): number {
  const key = normalizeCategorySortKey(label)
  if (key === 'U6') return 1
  if (key === 'U8') return 2
  if (key === 'U10') return 3
  if (key === 'U12') return 4
  if (key === 'U14') return 5
  if (key === 'U16') return 6
  if (key === 'U18') return 7
  if (key === 'C') return 8
  if (key === 'B') return 9
  return 10
}

/** Ordine categoria per partite/allenamenti (stesso orario): dalla più piccola alla più grande */
function partitaCategorySortOrder(name: string | undefined): number {
  return categoryDisplayOrder(name || '')
}

function getDashboardItemDate(item: { _date?: string; event_date?: string; session_date?: string }): string {
  return item._date || item.event_date || item.session_date || ''
}

function getDashboardItemTime(item: {
  displayTime?: string
  start_time?: string
  event_time?: string
  end_time?: string
}): string {
  return (item.displayTime || item.start_time || item.event_time || item.end_time || '00:00')
    .toString()
    .substring(0, 5)
}

function sortDashboardItems(a: any, b: any): number {
  const dA = getDashboardItemDate(a)
  const dB = getDashboardItemDate(b)
  if (dA !== dB) return dA.localeCompare(dB)
  const tA = getDashboardItemTime(a)
  const tB = getDashboardItemTime(b)
  if (tA !== tB) return tA.localeCompare(tB)
  const isSession = (item: any) =>
    item._type === 'session' || item.event_type === 'allenamento' || item.event_type === 'training'
  if (isSession(a) && isSession(b)) {
    return categoryDisplayOrder(a.categories?.name) - categoryDisplayOrder(b.categories?.name)
  }
  if (a.event_type === 'partita' && b.event_type === 'partita') {
    return partitaCategorySortOrder(a.categories?.name) - partitaCategorySortOrder(b.categories?.name)
  }
  return 0
}

const DASHBOARD_EVENT_TYPE_LABELS_FALLBACK: Record<string, string> = {
  consiglio: 'Consiglio',
  torneo: 'Torneo',
  festa_del_rugby: 'Festa del Rugby',
  evento_sociale: 'Evento sociale',
  raduno: 'Raduno',
  festa: 'Festa',
  incontro_genitori: 'Incontro genitori',
  incontro_staff: 'Incontro staff',
  altro: 'Altro',
}

/** Serie B/C → B/C; non mostrare mai Senior/Seniores */
function formatCategoryForDisplay(nameOrCode: string): string {
  if (!nameOrCode || !nameOrCode.trim()) return nameOrCode
  const u = nameOrCode.toUpperCase().trim()
  if (u === 'SENIOR' || u === 'SENIORES') return ''
  if (u === 'SERIE_B' || nameOrCode.trim() === 'Serie B') return 'B'
  if (u === 'SERIE_C' || nameOrCode.trim() === 'Serie C') return 'C'
  return nameOrCode.trim()
}

/** In dashboard: B/C → Serie B / Serie C (nome per esteso) */
function formatCategoryForDashboard(nameOrCode: string): string {
  const abbr = formatCategoryForDisplay(nameOrCode)
  if (!abbr) return abbr
  if (abbr === 'B') return 'Serie B'
  if (abbr === 'C') return 'Serie C'
  return abbr
}

/** Label categoria in dashboard: espande B/C in Serie B/C (per liste con più categorie tipo "U14, B") */
function formatCategoryLabelForDashboard(label: string): string {
  if (!label || !label.trim()) return label || '—'
  return label
    .split(',')
    .map((p) => formatCategoryForDashboard(p.trim()))
    .filter(Boolean)
    .join(', ') || '—'
}

/** Da lista di codici/nomi categoria: esclude Senior/Seniores, abbrevia Serie B/C → B/C, join con ", " */
function formatCategoryLabel(codesOrNames: string[]): string {
  const filtered = codesOrNames
    .map((c) => (c || '').trim())
    .filter((c) => {
      const u = c.toUpperCase()
      return u !== 'SENIOR' && u !== 'SENIORES' && c !== ''
    })
  const abbreviated = filtered.map((c) => formatCategoryForDisplay(c)).filter(Boolean)
  return abbreviated.join(', ') || '—'
}

type MemoType = 'note' | 'reminder' | 'appointment' | 'todo'
interface UserMemo {
  id: string
  type: MemoType
  content: string
  due_date: string | null
  due_time: string | null
  completed: boolean
  created_at: string
}

const MEMO_TYPE_LABELS: Record<MemoType, string> = {
  reminder: 'Promemoria',
  appointment: 'Appuntamenti',
  todo: 'Da fare',
  note: 'Note',
}

const MEMO_TYPE_ORDER: MemoType[] = ['reminder', 'appointment', 'todo', 'note']

const MEMO_TYPE_ICON: Record<MemoType, string> = {
  reminder: '🔔',
  appointment: '📅',
  todo: '☑',
  note: '📝',
}

const formatMemoDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

const getDashboardMemoSortDate = (memo: UserMemo): number => {
  if ((memo.type === 'reminder' || memo.type === 'appointment') && memo.due_date) {
    const time = memo.due_time?.substring(0, 5) || (memo.type === 'reminder' ? '09:00' : '12:00')
    return new Date(`${memo.due_date}T${time}:00`).getTime()
  }
  return new Date(memo.created_at).getTime()
}

const getDashboardMemoMeta = (memo: UserMemo) => {
  if (memo.due_date || memo.due_time) {
    const datePart = memo.due_date ? formatMemoDate(memo.due_date) : ''
    const timePart = memo.due_time ? memo.due_time.substring(0, 5) : ''
    return [datePart, timePart].filter(Boolean).join(' · ')
  }
  return null
}

const getDashboardMemoGroups = (memos: UserMemo[]) =>
  MEMO_TYPE_ORDER.map((type) => ({
    type,
    label: MEMO_TYPE_LABELS[type],
    items: memos
      .filter((m) => m.type === type && !((m.type === 'todo' || m.type === 'reminder') && m.completed))
      .sort((a, b) => getDashboardMemoSortDate(a) - getDashboardMemoSortDate(b)),
  })).filter((group) => group.items.length > 0)

export default function ModernDashboard() {
  const navigate = useNavigate()
  const { profile, userId, signOut } = useAuth()
  const [, setTick] = useState(0)
  const { stats, loading, error } = useDashboardStats()
  const { getLabel: getEventTypeLabel, isSporting } = useEventTypes()

  const [todayEvents, setTodayEvents] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const [loadingTodayEvents, setLoadingTodayEvents] = useState(false)
  const [injuryStats, setInjuryStats] = useState({
    infortuniAperti: 0,
    attivitaProgrammate: 0,
    daConfermareRefertare: 0,
    statoAssente: 0
  })
  const [loadingInjuryStats, setLoadingInjuryStats] = useState(false)
  const [visiteMedicheOggiCount, setVisiteMedicheOggiCount] = useState(0)
  const [loadingVisiteOggi, setLoadingVisiteOggi] = useState(false)
  const [feesStats, setFeesStats] = useState({ totalAmount: 0, paidAmount: 0, percentage: 0 })
  const [attendanceTrend, setAttendanceTrend] = useState<number[]>([])
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<Array<{
    id: string
    full_name: string
    given_name?: string | null
    family_name?: string | null
    date_of_birth: string
    phone?: string | null
    emergency_contact_phone?: string | null
    birthdayDate: Date
    daysUntilBirthday: number
    age: number
  }>>([])
  const [dismissedBirthdayIds, setDismissedBirthdayIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('birthday_whatsapp_sent')
      if (!stored) return new Set()
      const data = JSON.parse(stored) as Record<string, string[]>
      const year = new Date().getFullYear()
      const ids = data[String(year)] || []
      return new Set(ids)
    } catch {
      return new Set()
    }
  })
  const [birthdayConfirmModal, setBirthdayConfirmModal] = useState<{ personId: string; personName: string } | null>(null)
  const [whatsAppModal, setWhatsAppModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' })
  const [loadingBirthdays, setLoadingBirthdays] = useState(false)
  const [expiringCertificates, setExpiringCertificates] = useState<Array<{
    id: string
    full_name: string
    expiry_date: string
    daysUntilExpiry: number
  }>>([])
  const [loadingCertificates, setLoadingCertificates] = useState(false)
  const [alertsCount, setAlertsCount] = useState({ documents: 0, notes: 0, fees: 0 })
  const [userMemos, setUserMemos] = useState<UserMemo[]>([])
  const [loadingMemos, setLoadingMemos] = useState(false)
  const [inboxMessages, setInboxMessages] = useState<CorrInboxItem[]>([])
  const [loadingInbox, setLoadingInbox] = useState(false)
  const [expandedInboxId, setExpandedInboxId] = useState<string | null>(null)
  const [injuriesList, setInjuriesList] = useState<Array<{ id: string; full_name: string; categoryLabel: string; status: string }>>([])
  const [loadingInjuriesList, setLoadingInjuriesList] = useState(false)

  useEffect(() => {
    const onBrandUpdated = () => setTick((t) => t + 1)
    window.addEventListener('brand-config-updated', onBrandUpdated)
    return () => window.removeEventListener('brand-config-updated', onBrandUpdated)
  }, [])

  // Carica eventi E sessioni (allenamenti) per la settimana (oggi + 6 giorni)
  useEffect(() => {
    const loadTodayEvents = async () => {
      try {
        setLoadingTodayEvents(true)
        const d = new Date()
        const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const endDate = new Date(d)
        endDate.setDate(d.getDate() + 13)
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

        const [eventsRes, sessionsRes] = await Promise.all([
          supabase
            .from('events')
            .select('id, title, start_time, event_time, event_type, location, away_location, event_date, is_championship, is_friendly, categories(name)')
            .gte('event_date', startDate)
            .lte('event_date', endDateStr)
            .order('event_date', { ascending: true })
            .order('start_time', { ascending: true }),

          supabase
            .from('sessions')
            .select('id, session_date, start_time, end_time, location, away_place, categories(name)')
            .gte('session_date', startDate)
            .lte('session_date', endDateStr)
            .order('session_date', { ascending: true })
            .order('start_time', { ascending: true })
        ])

        const events = (eventsRes.data || []).map((e: any) => ({
          ...e,
          _type: 'event',
          displayTitle: e.title,
          displayTime: e.start_time || e.event_time
        }))

        const sessions = (sessionsRes.data || []).map((s: any) => {
          const catName = s.categories?.name || ''
          const locationPart = `${s.location || ''}${s.away_place ? ` - ${s.away_place}` : ''}`.trim()
          const displayTitle = catName
            ? `${catName} – ${locationPart}`.trim()
            : locationPart || 'Allenamento'
          return {
            ...s,
            _type: 'session',
            displayTitle,
            displayTime: s.start_time || s.end_time
          }
        })

        const combined = [...events, ...sessions].map((item) => ({
          ...item,
          _date: item.event_date || item.session_date
        })).sort(sortDashboardItems)

        setTodayEvents(combined)
      } catch {
        setTodayEvents([])
      } finally {
        setLoadingTodayEvents(false)
      }
    }
    loadTodayEvents()
  }, [])

  // Carica statistiche infortuni
  useEffect(() => {
    const loadInjuryStats = async () => {
      try {
        setLoadingInjuryStats(true)
        const today = new Date().toISOString().slice(0, 10)

        const { data: openInjuries, error: e1 } = await supabase
          .from('injuries')
          .select('id, in_chiusura')
          .eq('is_closed', false)
        const infortuniAperti = !e1 && openInjuries
          ? openInjuries.filter((i: { in_chiusura?: boolean }) => !i.in_chiusura).length
          : 0

        const { data: activities, error: e2 } = await supabase
          .from('injury_activities')
          .select('id, activity_date, ricontrollo, activity_type, notes, confirmation_status')
          .in('activity_type', ['physiotherapy', 'medical_visit', 'Fisioterapia', 'Visita medica'])

        if (e2 || !activities?.length) {
          setInjuryStats({ infortuniAperti, attivitaProgrammate: 0, daConfermareRefertare: 0, statoAssente: 0 })
          setLoadingInjuryStats(false)
          return
        }

        const isVisit = (a: any) => a.activity_type === 'medical_visit' || a.activity_type === 'Visita medica'
        const isPhysio = (a: any) => a.activity_type === 'physiotherapy' || a.activity_type === 'Fisioterapia'
        const dateStr = (a: any) => (a.ricontrollo || a.activity_date || '').toString().slice(0, 10)

        let attivitaProgrammate = 0
        let daConfermareRefertare = 0
        const statoAssente = activities.filter((a: any) => (a.confirmation_status || '').toString() === 'assente').length

        for (const a of activities) {
          const d = dateStr(a)
          if (d >= today) attivitaProgrammate++
          else if ((a.confirmation_status || '').toString() !== 'assente') {
            const refertato = isVisit(a) ? (a.notes || '').toString().trim() !== '' : false
            const confermato = isPhysio(a) ? (a.confirmation_status || '').toString().trim() !== '' : false
            if (!refertato && !confermato) daConfermareRefertare++
          }
        }

        setInjuryStats({ infortuniAperti, attivitaProgrammate, daConfermareRefertare, statoAssente })
      } catch {
        setInjuryStats({ infortuniAperti: 0, attivitaProgrammate: 0, daConfermareRefertare: 0, statoAssente: 0 })
      } finally {
        setLoadingInjuryStats(false)
      }
    }
    loadInjuryStats()
  }, [])

  // Lista ultimi infortuni aperti (per widget dashboard)
  useEffect(() => {
    const loadInjuriesList = async () => {
      try {
        setLoadingInjuriesList(true)
        const { data: rows, error } = await supabase
          .from('injuries')
          .select('id, person_id, in_chiusura')
          .eq('is_closed', false)
          .order('injury_date', { ascending: false })
          .limit(6)
        if (error || !rows?.length) {
          setInjuriesList([])
          return
        }
        const personIds = [...new Set((rows as any[]).map((i: any) => i.person_id))]
        const { data: people } = await supabase.from('people').select('id, full_name, player_categories').in('id', personIds)
        const peopleMap = Object.fromEntries((people || []).map((p: any) => [p.id, p]))
        const { data: cats } = await supabase.from('categories').select('id, name, code')
        const catMap = Object.fromEntries((cats || []).map((c: any) => [c.id, c.code || c.name]))
        setInjuriesList(
          (rows as any[]).map((i: any) => {
            const p = peopleMap[i.person_id]
            const catIds = readCategoryIds(p?.player_categories)
            const rawLabels = catIds.length ? catIds.map((id) => catMap[id] || id) : []
            const label = formatCategoryLabel(rawLabels)
            return {
              id: i.id,
              full_name: p?.full_name || '—',
              categoryLabel: label,
              status: i.in_chiusura ? 'In chiusura' : 'In corso'
            }
          })
        )
      } catch {
        setInjuriesList([])
      } finally {
        setLoadingInjuriesList(false)
      }
    }
    loadInjuriesList()
  }, [])

  // Carica numero giocatori con visita dal medico oggi
  useEffect(() => {
    const loadVisiteMedicheOggi = async () => {
      try {
        setLoadingVisiteOggi(true)
        const today = new Date().toISOString().split('T')[0]
        const { data: activities, error } = await supabase
          .from('injury_activities')
          .select('id, injury_id, injuries(person_id)')
          .in('activity_type', ['medical_visit', 'Visita medica'])
          .or(`activity_date.eq.${today},ricontrollo.eq.${today}`)

        if (error || !activities?.length) {
          setVisiteMedicheOggiCount(0)
          return
        }

        const personIds = new Set<string>()
        activities.forEach((a: any) => {
          const pid = a.injuries?.person_id
          if (pid) personIds.add(pid)
        })
        setVisiteMedicheOggiCount(personIds.size)
      } catch {
        setVisiteMedicheOggiCount(0)
      } finally {
        setLoadingVisiteOggi(false)
      }
    }
    loadVisiteMedicheOggi()
  }, [])

  // Carica statistiche quote
  useEffect(() => {
    const loadFeesStats = async () => {
      try {
        const { data: assignments, error } = await supabase
          .from('fee_assignments')
          .select('amount, status')

        if (error || !assignments) {
          setFeesStats({ totalAmount: 0, paidAmount: 0, percentage: 0 })
          return
        }

        const totalAmount = assignments.reduce((sum, a) => sum + a.amount, 0)
        const paidAmount = assignments
          .filter(a => a.status === 'paid')
          .reduce((sum, a) => sum + a.amount, 0)
        const percentage = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0

        setFeesStats({ totalAmount, paidAmount, percentage })
      } catch {
        setFeesStats({ totalAmount: 0, paidAmount: 0, percentage: 0 })
      }
    }
    loadFeesStats()
  }, [])

  // Carica conteggio alert (stesso calcolo della pagina Alert: documenti + note + quote)
  useEffect(() => {
    const loadAlertsCount = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(new Date().getDate() + 30)
        const tomorrow = new Date()
        tomorrow.setDate(new Date().getDate() + 1)

        const [docsRes, notesRes, feesRes] = await Promise.all([
          supabase
            .from('documents')
            .select('id', { count: 'exact', head: true })
            .in('category', ['id_card', 'certificate'])
            .not('expiry_date', 'is', null)
            .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0]),
          supabase
            .from('notes')
            .select('id', { count: 'exact', head: true })
            .not('reminder_date', 'is', null)
            .lte('reminder_date', tomorrow.toISOString()),
          supabase
            .from('fee_assignments')
            .select('id, status, due_date')
            .in('status', ['pending', 'overdue'])
        ])

        const feesData = feesRes.data || []
        const overdueFees = feesData.filter((a: any) =>
          a.status === 'overdue' || (a.due_date && a.due_date < today)
        )

        setAlertsCount({
          documents: docsRes.count ?? 0,
          notes: notesRes.count ?? 0,
          fees: overdueFees.length
        })
      } catch {
        setAlertsCount({ documents: 0, notes: 0, fees: 0 })
      }
    }
    loadAlertsCount()
  }, [])

  // Carica visite mediche in scadenza (certificati medici)
  useEffect(() => {
    const loadExpiringCertificates = async () => {
      try {
        setLoadingCertificates(true)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(today.getDate() + 30)

        const { data, error } = await supabase
          .from('documents')
          .select('id, expiry_date, person_id, people:person_id(id, full_name)')
          .eq('category', 'certificate')
          .not('expiry_date', 'is', null)
          .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0])
          .order('expiry_date', { ascending: true })
          .limit(10)

        if (error || !data) {
          setExpiringCertificates([])
          return
        }

        const list = data.map((doc: any) => {
          const expiryDate = new Date(doc.expiry_date)
          expiryDate.setHours(0, 0, 0, 0)
          const diffTime = expiryDate.getTime() - today.getTime()
          const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          const person = doc.people
          return {
            id: doc.id,
            full_name: person?.full_name || '—',
            expiry_date: doc.expiry_date,
            daysUntilExpiry
          }
        })

        setExpiringCertificates(list)
      } catch {
        setExpiringCertificates([])
      } finally {
        setLoadingCertificates(false)
      }
    }
    loadExpiringCertificates()
  }, [])

  // Carica trend presenze per grafico
  useEffect(() => {
    if (stats?.attendanceTrend?.length) {
      setAttendanceTrend(stats.attendanceTrend.map(t => t.percentage || 0))
    } else {
      setAttendanceTrend([40, 60, 50, 80, 70, 90])
    }
  }, [stats?.attendanceTrend])

  // Carica memo personali dell'utente
  useEffect(() => {
    const loadUserMemos = async () => {
      if (!userId) return
      try {
        setLoadingMemos(true)
        const { data, error } = await supabase
          .from('user_memos')
          .select('id, type, content, due_date, due_time, completed, created_at')
          .eq('user_id', userId)
        if (error) throw error
        setUserMemos((data || []) as UserMemo[])
      } catch {
        setUserMemos([])
      } finally {
        setLoadingMemos(false)
      }
    }
    loadUserMemos()
  }, [userId])

  // Messaggi chat interna (FlowMe / TeamFlow) per la home
  const reloadInbox = async () => {
    try {
      setLoadingInbox(true)
      const items = await listInboxMessagesForDashboard(80)
      setInboxMessages(items)
    } catch {
      setInboxMessages([])
    } finally {
      setLoadingInbox(false)
    }
  }

  useEffect(() => {
    void reloadInbox()
    const onFocus = () => {
      void reloadInbox()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const handleDismissInboxThread = async (threadId: string) => {
    if (!userId) return
    if (!confirm('Nascondere questa conversazione dalla home? Resterà disponibile in Anagrafica → Corrispondenza.')) {
      return
    }
    try {
      await hideThreadInboxFromHome({ threadId, authUserId: userId, reason: 'dismissed' })
      setInboxMessages((prev) => prev.filter((m) => m.threadId !== threadId))
      if (expandedInboxId === threadId) setExpandedInboxId(null)
    } catch (e) {
      console.error('hideThreadInboxFromHome:', e)
      alert('Impossibile nascondere. Esegui gli script SQL 008 e 009 in Supabase e riprova.')
    }
  }

  const handleOpenInboxRow = async (threadId: string) => {
    const willExpand = expandedInboxId !== threadId
    setExpandedInboxId(willExpand ? threadId : null)
    if (!willExpand || !userId) return
    try {
      await markHomeInboxThreadOpened({ threadId, authUserId: userId })
      setInboxMessages((prev) =>
        prev.map((m) => (m.threadId === threadId ? { ...m, unread: false } : m))
      )
    } catch (e) {
      console.warn('markHomeInboxThreadOpened:', e)
    }
  }

  // Carica compleanni nei prossimi 5 giorni (incluso oggi)
  useEffect(() => {
    const loadUpcomingBirthdays = async () => {
      try {
        setLoadingBirthdays(true)
        const { data, error } = await supabase
          .from('people')
          .select('id, full_name, given_name, family_name, date_of_birth, phone, emergency_contact_phone')
          .not('date_of_birth', 'is', null)

        if (error || !data) {
          setUpcomingBirthdays([])
          return
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const list = data
          .map(person => {
            if (!person.date_of_birth) return null
            const birthDate = new Date(person.date_of_birth)
            const currentYear = today.getFullYear()
            const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate())
            if (birthdayThisYear < today) birthdayThisYear.setFullYear(currentYear + 1)
            const daysUntilBirthday = Math.ceil((birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            const age = currentYear - birthDate.getFullYear() + (birthdayThisYear.getFullYear() - currentYear)
            return {
              id: person.id,
              full_name: person.full_name || '',
              given_name: person.given_name,
              family_name: person.family_name,
              date_of_birth: person.date_of_birth,
              phone: person.phone,
              emergency_contact_phone: person.emergency_contact_phone,
              birthdayDate: birthdayThisYear,
              daysUntilBirthday,
              age
            }
          })
          .filter((p): p is NonNullable<typeof p> => p !== null && p.daysUntilBirthday >= 0 && p.daysUntilBirthday <= 5)
          .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday)

        setUpcomingBirthdays(list)
      } catch {
        setUpcomingBirthdays([])
      } finally {
        setLoadingBirthdays(false)
      }
    }
    loadUpcomingBirthdays()
  }, [])

  // Alert: stesso conteggio della pagina Alert (documenti + note + quote scadute)
  const totalAlerts = alertsCount.documents + alertsCount.notes + alertsCount.fees

  const atletiCount = stats?.totalPlayers ?? 0
  const oggi = new Date()
  const oggiFormatted = oggi.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
  const oggiCapitalized = oggiFormatted.charAt(0).toUpperCase() + oggiFormatted.slice(1)

  // Fascia settimanale: primo giorno = oggi, poi i successivi 6
  const getWeekDays = () => {
    const d = new Date(oggi)
    d.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(d)
      date.setDate(d.getDate() + i)
      return date
    })
  }
  const weekDays = getWeekDays()

  const handleLogout = async () => {
    if (!window.confirm('Sei sicuro di voler uscire?')) return
    await signOut()
    navigate('/')
  }

  const getFirstNameForMessage = (p: { given_name?: string | null; full_name?: string; family_name?: string | null }) => {
    const gn = (p.given_name || '').trim()
    if (gn) return formatDisplayPersonName(gn)
    const full = (p.full_name || '').trim()
    if (full) return formatDisplayPersonName(full.split(/\s+/)[0] || full)
    return formatDisplayPersonName([p.given_name, p.family_name].filter(Boolean)[0]?.trim() || '')
  }

  const getPhoneForWhatsApp = (p: { phone?: string | null; emergency_contact_phone?: string | null }) => {
    const main = (p.phone || '').trim()
    if (main) return main
    return (p.emergency_contact_phone || '').trim()
  }

  const saveDismissedBirthday = (personId: string) => {
    const year = new Date().getFullYear()
    setDismissedBirthdayIds(prev => {
      const next = new Set(prev)
      next.add(personId)
      try {
        const stored = JSON.parse(localStorage.getItem('birthday_whatsapp_sent') || '{}') as Record<string, string[]>
        stored[String(year)] = Array.from(next)
        localStorage.setItem('birthday_whatsapp_sent', JSON.stringify(stored))
      } catch {}
      return next
    })
  }

  const handleBirthdaySend = async (person: typeof upcomingBirthdays[0], e: React.MouseEvent) => {
    e.stopPropagation()
    const firstName = getFirstNameForMessage(person)
    const message = getBirthdayMessage(firstName)
    const phone = getPhoneForWhatsApp(person)

    // Notifica app mobile (popup quando apre l'app)
    // Per utenti con profilo: user_id; per invite code: person_id (FlowMe legge per person_id)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('person_id', person.id)
        .limit(1)
        .maybeSingle()
      await supabase.from('notifications').insert({
        ...(profile?.id ? { user_id: profile.id } : {}),
        person_id: person.id,
        title: 'Auguri di compleanno! 🎂',
        body: message,
        type: 'birthday_wishes',
        metadata: { person_id: person.id }
      })
    } catch (err) {
      console.warn('Errore invio notifica app mobile:', err)
    }

    if (phone) {
      const digits = String(phone).replace(/\D/g, '')
      const whatsappNumber = digits.startsWith('39') ? digits : (digits.startsWith('0') ? '39' + digits.slice(1) : '39' + digits)
      const url = `whatsapp://send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}`
      setWhatsAppModal({ open: true, url })
      setBirthdayConfirmModal({ personId: person.id, personName: formatDisplayPersonName(person.full_name) })
    }
  }

  const handleBirthdayConfirmYes = () => {
    if (birthdayConfirmModal) {
      saveDismissedBirthday(birthdayConfirmModal.personId)
      setBirthdayConfirmModal(null)
    }
  }

  const handleBirthdayConfirmNo = () => {
    setBirthdayConfirmModal(null)
  }

  const visibleBirthdays = upcomingBirthdays.filter(p => !dismissedBirthdayIds.has(p.id))
  const brand = getBrandConfig()
  const { primary, secondary, accent, dark } = brand.colors

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: `linear-gradient(160deg, ${primary} 0%, ${dark} 50%, #0f172a 100%)` }}
      >
        <div className="text-center text-white">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Errore nel caricamento</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-white rounded-xl font-medium transition hover:opacity-90"
            style={{ backgroundColor: secondary }}
          >
            Riprova
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
        <div className="min-h-0 p-8 flex flex-col gap-8">
        {/* COMPLEANNI OGGI - card sopra tutto, subito sotto l'header */}
        {(() => {
          const birthdaysToday = visibleBirthdays.filter(p => p.daysUntilBirthday === 0)
          if (birthdaysToday.length === 0) return null
          return (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-4"
            >
              {birthdaysToday.map((person) => (
                <div
                  key={person.id}
                  className="bg-gradient-to-br from-amber-400/90 via-yellow-500/90 to-amber-600/90 backdrop-blur-xl rounded-2xl px-6 py-4 border border-amber-300/50 shadow-xl hover:scale-105 transition flex items-center justify-between gap-4"
                >
                  <div
                    onClick={() => navigate('/birthdays')}
                    className="flex items-center gap-4 cursor-pointer flex-1 min-w-0"
                  >
                    <span className="text-3xl">🎂</span>
                    <div>
                      <p className="font-bold text-amber-950 text-lg">{formatDisplayPersonName(person.full_name)}</p>
                      <p className="text-white font-bold text-sm">Compie {person.age} anni</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleBirthdaySend(person, e)}
                    title={getPhoneForWhatsApp(person).length > 0 ? 'Invia auguri WhatsApp + notifica app' : 'Invia auguri nell\'app mobile'}
                    className="p-2.5 rounded-full bg-green-600/80 text-white hover:bg-green-500 shrink-0 transition"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )
        })()}

        {/* INIZIO DASHBOARD: calendario settimanale + card Partite/Visite/Quote + azioni rapide */}
        {/* FASCIA SETTIMANALE - selettore giorni */}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          className="w-full rounded-2xl overflow-hidden bg-blue-700/60 border border-blue-500/30 shadow-lg min-h-[4rem] flex-shrink-0"
        >
          <div className="flex divide-x divide-white/20">
            {weekDays.map((d) => {
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              const isSelected = dateStr === selectedDate
              const dayName = d.toLocaleDateString('it-IT', { weekday: 'short' })
              const dayNum = d.getDate()
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex-1 flex flex-col items-center justify-center py-4 text-center min-w-0 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-600/50 text-white font-semibold' : 'text-blue-200 hover:bg-blue-700/30'
                  }`}
                >
                  <span className="uppercase tracking-wide" style={{ fontSize: isSelected ? '18px' : '12px' }}>{dayName}</span>
                  <span className="font-bold mt-0.5" style={{ fontSize: isSelected ? '24px' : '18px' }}>{dayNum}</span>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* SITUAZIONE OGGI - card Partite, Visite mediche in scadenza, Quote scadute */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-4"
        >
          {(() => {
            const partiteRaw = todayEvents.filter((e: any) =>
              e.event_type === 'partita' && (e._date || e.event_date) === selectedDate
            )
            const partite = [...partiteRaw].sort((a: any, b: any) => {
              const tA = (a.displayTime || a.start_time || a.event_time || '00:00').toString().substring(0, 5)
              const tB = (b.displayTime || b.start_time || b.event_time || '00:00').toString().substring(0, 5)
              if (tA !== tB) return tA.localeCompare(tB)
              const oA = partitaCategorySortOrder(a.categories?.name)
              const oB = partitaCategorySortOrder(b.categories?.name)
              return oA - oB
            })
            const allenamenti = [...todayEvents.filter((e: any) =>
              (e._type === 'session' || e.event_type === 'allenamento' || e.event_type === 'training') &&
              (e._date || e.session_date) === selectedDate
            )].sort((a: any, b: any) => {
              const tA = (a.start_time || a.displayTime || '00:00').toString().substring(0, 5)
              const tB = (b.start_time || b.displayTime || '00:00').toString().substring(0, 5)
              if (tA !== tB) return tA.localeCompare(tB)
              return categoryDisplayOrder(a.categories?.name) - categoryDisplayOrder(b.categories?.name)
            })
            const altriEventi = todayEvents.filter((e: any) =>
              e._type === 'event' &&
              e.event_type !== 'partita' &&
              (e._date || e.event_date) === selectedDate
            )
            const todayStr = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`
            const assenzeCount = stats?.todayAttendance?.absent ?? 0
            const visiteMedicheOggi = visiteMedicheOggiCount
            const quoteScaduteCount = stats?.alerts?.overdueFees ?? 0

            const baseCard = 'rounded-2xl p-6 shadow-xl flex-1 min-w-[180px] cursor-pointer hover:opacity-95 transition-opacity'
            const formatExpiryDate = (dateStr: string) =>
              new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })

            const sections: { key: string; show: boolean; title: string; icon: React.ComponentType<{ className?: string }>; content: React.ReactNode; onClick: () => void }[] = [
              {
                key: 'partite',
                show: partite.length > 0,
                title: 'Partite',
                icon: Trophy,
                content: loadingTodayEvents ? (
                  <p className="text-sm text-blue-100">Caricamento...</p>
                ) : (
                  <div className="space-y-2">
                    {partite.map((ev: any, i: number) => {
                      const time = ev.displayTime || ev.start_time || ev.event_time || '18:30'
                      const t = typeof time === 'string' ? time.substring(0, 5) : '18:30'
                      let title = ev.displayTitle || ev.title || ''
                      const cat = ev.categories?.name || ''
                      if (cat && title.endsWith(` – ${cat}`)) {
                        title = title.slice(0, -(` – ${cat}`).length).trim()
                      }
                      const parts = title.split(' vs ')
                      const squadraCasaRaw = parts[0]?.trim() || '-'
                      const squadraTrasfertaRaw = parts[1]?.trim() || '-'
                      const squadraCasa = squadraCasaRaw === '-' ? '-' : (formatCategoryForDashboard(squadraCasaRaw) || squadraCasaRaw)
                      const squadraTrasferta = squadraTrasfertaRaw === '-' ? '-' : (formatCategoryForDashboard(squadraTrasfertaRaw) || squadraTrasfertaRaw)
                      const luogo = ev.location === 'Trasferta' ? (ev.away_location?.trim() || '') : (ev.location?.trim() || '')
                      return (
                        <div key={ev.id || i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0 border-b border-blue-400/30 pb-2 last:border-0 last:pb-0 text-base text-blue-100">
                          <span className="font-medium shrink-0">{t}</span>
                          <span className="font-medium">{squadraCasa}</span>
                          <span className="font-medium">–</span>
                          <span className="font-medium">{squadraTrasferta}</span>
                          {luogo && <span className="text-blue-200/90">({luogo})</span>}
                        </div>
                      )
                    })}
                  </div>
                ),
                onClick: () => navigate('/events')
              },
              {
                key: 'eventi',
                show: altriEventi.length > 0,
                title: 'Eventi',
                icon: Calendar,
                content: loadingTodayEvents ? (
                  <p className="text-sm text-blue-100">Caricamento...</p>
                ) : (
                  <div className="space-y-2">
                    {altriEventi.map((ev: any, i: number) => {
                      const time = ev.displayTime || ev.start_time || ev.event_time || ev.end_time || ''
                      const t = time ? (typeof time === 'string' ? time.substring(0, 5) : '') : ''
                      const tipoLabels: Record<string, string> = {
                        consiglio: 'Consiglio',
                        torneo: 'Torneo',
                        evento_sociale: 'Evento sociale',
                        raduno: 'Raduno',
                        festa: 'Festa',
                        incontro_genitori: 'Incontro genitori',
                        incontro_staff: 'Incontro staff',
                        altro: 'Altro'
                      }
                      const tipo = tipoLabels[ev.event_type] || ev.event_type || 'Evento'
                      const title = ev.displayTitle || ev.title || tipo
                      const luogo = ev.location || ''
                      return (
                        <div key={ev.id || i} className="flex flex-col gap-0.5 border-b border-white/10 pb-2 last:border-0 last:pb-0 text-sm text-white/90">
                          <span className="font-medium">{title}</span>
                          <span className="text-white/60 text-xs">
                            {tipo}{t ? ` • ${t}` : ''}{luogo ? ` • ${luogo}` : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ),
                onClick: () => navigate('/events')
              },
              {
                key: 'allenamenti',
                show: allenamenti.length > 0,
                title: 'Allenamenti',
                icon: Dumbbell,
                content: loadingTodayEvents ? (
                  <p className="text-sm text-blue-100">Caricamento...</p>
                ) : (
                  <div className="space-y-2">
                    {allenamenti.map((ev: any, i: number) => {
                      const startTime = (ev.start_time || ev.displayTime || '').toString().substring(0, 5) || '—'
                      const endTime = (ev.end_time || '').toString().substring(0, 5) || '—'
                      const categoriaRaw = ev.categories?.name || '—'
                      const categoria = categoriaRaw === '—' ? '—' : (formatCategoryForDashboard(categoriaRaw) || categoriaRaw)
                      const sede = ev.location === 'Trasferta'
                        ? (ev.away_place?.trim() || 'Trasferta')
                        : (ev.location?.trim() || '—')
                      return (
                        <div
                          key={ev.id || i}
                          className="grid grid-cols-[3.5rem_3.5rem_1fr_auto] items-center gap-x-3 border-b border-blue-400/30 pb-2 last:border-0 last:pb-0 text-base text-blue-100"
                        >
                          <span className="font-medium tabular-nums">{startTime}</span>
                          <span className="font-medium tabular-nums">{endTime}</span>
                          <span className="font-medium truncate">{categoria}</span>
                          <span className="text-blue-200/90 shrink-0">{sede}</span>
                        </div>
                      )
                    })}
                  </div>
                ),
                onClick: () => navigate('/activities')
              },
              {
                key: 'visite-mediche',
                show: expiringCertificates.length > 0,
                title: `Visite mediche in scadenza (${expiringCertificates.length})`,
                icon: Stethoscope,
                content: loadingCertificates ? (
                  <p className="text-sm text-blue-100">Caricamento...</p>
                ) : (
                  <div className="space-y-1.5 max-h-[7rem] overflow-y-auto">
                    {expiringCertificates.map((c) => {
                      const daysText = c.daysUntilExpiry < 0
                        ? `${Math.abs(c.daysUntilExpiry)} gg fa`
                        : c.daysUntilExpiry === 0
                        ? '0 gg'
                        : `${c.daysUntilExpiry} gg`
                      return (
                        <p key={c.id} className="text-sm text-blue-100">
                          • {formatDisplayPersonName(c.full_name)} – {formatExpiryDate(c.expiry_date)} – {daysText}
                        </p>
                      )
                    })}
                  </div>
                ),
                onClick: () => navigate('/alerts')
              },
              {
                key: 'visite-mediche-oggi',
                show: visiteMedicheOggi > 0 && selectedDate === todayStr,
                title: 'Visite mediche oggi',
                icon: Stethoscope,
                content: <p className="text-sm text-blue-100">{visiteMedicheOggi} giocatore/i dal medico</p>,
                onClick: () => navigate('/infortuni')
              },
              {
                key: 'assenze',
                show: assenzeCount > 0 && selectedDate === todayStr,
                title: 'Assenze',
                icon: UserX,
                content: <p className="text-sm text-blue-100">{assenzeCount} da confermare</p>,
                onClick: () => navigate('/attendance')
              },
              {
                key: 'quote',
                show: quoteScaduteCount > 0,
                title: 'Quote scadute',
                icon: CreditCard,
                content: <p className="text-sm text-blue-100">{quoteScaduteCount} da pagare</p>,
                onClick: () => navigate('/fees')
              }
            ]

            const visibleSections = sections.filter(s => s.show)
            if (visibleSections.length === 0) {
              return (
                <div
                  className={`${baseCard} bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-600 flex items-center justify-between`}
                  onClick={() => navigate('/events')}
                >
                  <div>
                    <p className="text-blue-200/80 text-sm">Nessuna attività o alert per oggi</p>
                  </div>
                  <Clock className="w-10 h-10 text-white/50" />
                </div>
              )
            }

            return (
              <div className="w-full flex flex-col gap-4">
                <div className="flex flex-wrap gap-4">
                  {visibleSections.map((s) => (
                    <div
                      key={s.key}
                      onClick={s.onClick}
                      className={`${baseCard} bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-600 flex flex-col`}
                    >
                      <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                        {s.icon && <s.icon className="w-4 h-4 text-blue-200 shrink-0" />}
                        {s.title}
                      </h3>
                      <div className="space-y-1 flex-1">{s.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </motion.div>

        {/* HUB ORIZZONTALE AZIONI - Nuova Anagrafica, Nuovo Evento, Segna Presenze, Report Settimanale */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-4 gap-6"
        >
          {QUICK_ACTIONS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex items-center justify-center gap-3 rounded-2xl py-8 text-lg text-white border shadow-xl font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${secondary} 0%, ${primary} 100%)`,
                  borderColor: `${accent}30`
                }}
              >
                {Icon && <Icon className="w-6 h-6 shrink-0" />}
                {item.label}
              </button>
            )
          })}
        </motion.div>
        {/* FINE BLOCCO INIZIO DASHBOARD */}

        {/* BANDA STATO RAPIDO - card metriche Goleee */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-4 gap-6"
        >
          {([
            { icon: Users, label: 'Giocatori', value: loading ? '...' : String(atletiCount), iconBg: GOLEE.accentSoft, iconColor: GOLEE.accent, path: '/people' },
            { icon: Activity, label: 'Infermeria', value: loadingInjuryStats ? '...' : String(injuryStats.infortuniAperti), iconBg: GOLEE.warningSoft, iconColor: GOLEE.warning, path: '/infortuni' },
            { icon: CreditCard, label: 'Quote', value: loading ? '...' : `${feesStats.percentage}%`, iconBg: GOLEE.infoSoft, iconColor: GOLEE.info, path: '/fees' },
            { icon: AlertTriangle, label: 'Alert', value: loading ? '...' : String(totalAlerts), iconBg: GOLEE.dangerSoft, iconColor: GOLEE.danger, path: '/alerts' },
          ] as const).map((item, i) => (
            <div
              key={i}
              className={`${goleeCardClass} p-5 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01]`}
              style={{ borderColor: GOLEE.border }}
              onClick={() => navigate(item.path)}
            >
              <div className="flex justify-between items-center min-h-[3.5rem]">
                <div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: item.iconBg }}>
                    <item.icon className="w-5 h-5" style={{ color: item.iconColor }} />
                  </div>
                  <p className={`${CARD.xs} mt-2 uppercase tracking-wide font-semibold`} style={{ color: GOLEE.textMuted }}>{item.label}</p>
                </div>
                <span className={`${CARD.metric} font-bold`} style={{ color: GOLEE.text }}>{item.value}</span>
              </div>
            </div>
          ))}
        </motion.div>

        {/* GRIGLIA WIDGET tipo dashboard (Prossima partita, Presenze, Infermeria, Alert) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Partite ed eventi sportivi */}
          <div
            onClick={() => navigate('/events')}
            className={`${goleeCardClass} cursor-pointer hover:shadow-md transition-all flex flex-col min-h-[180px]`}
            style={{ borderColor: GOLEE.border }}
          >
            <div className="p-4 border-b flex items-center" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
              <h3 className={`${CARD.md} font-semibold flex items-center gap-2`} style={{ color: GOLEE.text }}>
                <Trophy className="w-5 h-5" style={{ color: GOLEE.accent }} />
                Partite ed eventi sportivi
              </h3>
            </div>
            <div className="px-4 pt-3 pb-2 border-b shrink-0" style={{ borderColor: GOLEE.border }}>
              <table className={`w-full ${CARD.sm} border-collapse table-fixed`}>
                <colgroup>
                  <col className="w-[3.5rem]" />
                  <col className="w-[7.5rem]" />
                  <col />
                  <col className="w-[5.75rem]" />
                </colgroup>
                <thead>
                  <tr className={`${CARD.micro} font-semibold uppercase tracking-[0.12em]`} style={{ color: GOLEE.textMuted }}>
                    <th className="text-left font-semibold pr-3">Orario</th>
                    <th className="text-left font-semibold pr-3">Tipo evento</th>
                    <th className="text-left font-semibold pr-3 pl-16">Squadre / Nome</th>
                    <th className="text-left font-semibold">Località</th>
                  </tr>
                </thead>
              </table>
            </div>
            <div className="px-4 py-2 flex-1 min-h-0 overflow-y-auto">
              {loadingTodayEvents ? (
                <p className={CARD.sm} style={{ color: GOLEE.textMuted }}>Caricamento...</p>
              ) : (() => {
                const todayStr = new Date().toISOString().slice(0, 10)
                const upcomingSportingEvents = (todayEvents || [])
                  .filter((item: any) => getDashboardItemDate(item) >= todayStr)
                  .filter((item: any) => item._type === 'event' && isSporting(item.event_type))
                  .sort(sortDashboardItems)

                if (upcomingSportingEvents.length === 0) {
                  return <p className={CARD.sm} style={{ color: GOLEE.textMuted }}>Nessun evento sportivo in programma</p>
                }

                const renderDateLabelRow = (dateStr: string) => (
                  <tr key={`date-${dateStr}`}>
                    <td colSpan={4} className={`pt-3 pb-1 ${CARD.sm} font-semibold uppercase tracking-wide`} style={{ color: GOLEE.textMuted }}>
                      {new Date(dateStr + 'T12:00:00').toLocaleDateString('it-IT', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </td>
                  </tr>
                )

                const renderSportingEventRow = (
                  key: string,
                  orario: string,
                  tipo: string,
                  nome: string,
                  luogo: string,
                  options?: { nomeBold?: boolean; isFirst?: boolean }
                ) => (
                  <tr
                    key={key}
                    className={options?.isFirst ? '' : 'border-t'}
                    style={options?.isFirst ? undefined : { borderColor: GOLEE.border }}
                  >
                    <td className="py-2 pr-3 font-medium tabular-nums align-top whitespace-nowrap" style={{ color: GOLEE.text }}>
                      {orario || '—'}
                    </td>
                    <td className="py-2 pr-3 align-top whitespace-nowrap" style={{ color: GOLEE.textMuted }}>
                      {tipo || '—'}
                    </td>
                    <td className={`py-2 pr-3 pl-16 align-top truncate ${options?.nomeBold ? 'font-semibold' : ''}`} style={{ color: GOLEE.text }}>
                      {nome || '—'}
                    </td>
                    <td className="py-2 align-top truncate" style={{ color: GOLEE.textMuted }}>
                      {luogo || '—'}
                    </td>
                  </tr>
                )

                const buildSportingEventRow = (item: any) => {
                  const tStr = getDashboardItemTime(item)
                  const luogo = item.location === 'Trasferta'
                    ? (item.away_location?.trim() || '')
                    : (item.location?.trim() || '')

                  if (item.event_type === 'partita') {
                    const title = item.title || item.displayTitle || ''
                    const parts = title.split(/ vs | – /)
                    const casaRaw = parts[0]?.trim() || '—'
                    const trasfertaRaw = parts[1]?.trim() || ''
                    const casa = casaRaw === '—' ? '—' : (formatCategoryForDashboard(casaRaw) || casaRaw)
                    const trasferta = !trasfertaRaw ? '' : (formatCategoryForDashboard(trasfertaRaw) || trasfertaRaw)
                    const squadre = trasferta ? `${casa} – ${trasferta}` : casa
                    const tipoEvento = item.is_championship
                      ? 'Campionato'
                      : item.is_friendly
                        ? 'Amichevole'
                        : '—'
                    return {
                      key: `partita-${item.id}`,
                      orario: tStr,
                      tipo: tipoEvento,
                      nome: squadre,
                      luogo,
                      nomeBold: false,
                    }
                  }

                  const tipo = getEventTypeLabel(item.event_type) || DASHBOARD_EVENT_TYPE_LABELS_FALLBACK[item.event_type] || item.event_type || 'Evento'
                  const title = item.displayTitle || item.title || tipo
                  return {
                    key: `evento-${item.id}`,
                    orario: tStr,
                    tipo,
                    nome: title,
                    luogo,
                    nomeBold: true,
                  }
                }

                let previousDate = ''
                let rowIndex = 0
                const sportingRows: React.ReactNode[] = []

                upcomingSportingEvents.forEach((item: any) => {
                  const itemDate = getDashboardItemDate(item)
                  if (itemDate !== previousDate) {
                    sportingRows.push(renderDateLabelRow(itemDate))
                    previousDate = itemDate
                  }
                  const row = buildSportingEventRow(item)
                  sportingRows.push(
                    renderSportingEventRow(row.key, row.orario, row.tipo, row.nome, row.luogo, {
                      nomeBold: row.nomeBold,
                      isFirst: rowIndex === 0,
                    })
                  )
                  rowIndex += 1
                })

                return (
                  <table className={`w-full ${CARD.sm} border-collapse table-fixed`}>
                    <colgroup>
                      <col className="w-[3.5rem]" />
                      <col className="w-[7.5rem]" />
                      <col />
                      <col className="w-[5.75rem]" />
                    </colgroup>
                    <tbody>{sportingRows}</tbody>
                  </table>
                )
              })()}
            </div>
          </div>

          {/* Messaggi (chat interna FlowMe / TeamFlow) */}
          <div
            className={`${goleeCardClass} flex flex-col min-h-[220px]`}
            style={{ borderColor: GOLEE.border }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
              <h3 className={`${CARD.md} font-semibold flex items-center gap-2`} style={{ color: GOLEE.text }}>
                <MessageCircle className="w-5 h-5" style={{ color: GOLEE.info }} />
                Messaggi
              </h3>
              {inboxMessages.length > 0 && (
                <span className={`bg-blue-100 text-blue-700 ${CARD.xs} font-bold px-2 py-0.5 rounded-full`}>
                  {inboxMessages.length}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto max-h-[280px]">
              {loadingInbox ? (
                <p className={`${CARD.sm} p-4`} style={{ color: GOLEE.textMuted }}>Caricamento...</p>
              ) : inboxMessages.length === 0 ? (
                <p className={`${CARD.sm} p-4`} style={{ color: GOLEE.textMuted }}>Nessun messaggio in arrivo</p>
              ) : (
                <table className={`w-full text-left ${CARD.sm}`}>
                  <thead className="sticky top-0" style={{ backgroundColor: GOLEE.surfaceMuted }}>
                    <tr className="border-b" style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}>
                      <th className="py-2 px-3 font-medium w-[7.5rem]">Data</th>
                      <th className="py-2 px-3 font-medium">Mittente</th>
                      <th className="py-2 px-3 font-medium">Titolo</th>
                      <th className="py-2 px-2 font-medium w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {inboxMessages.map((item) => {
                      const expanded = expandedInboxId === item.threadId
                      const dateLabel = new Date(item.createdAt).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })
                      const rowBg = item.unread
                        ? GOLEE.accentSoft
                        : expanded
                          ? GOLEE.infoSoft
                          : GOLEE.surface
                      return (
                        <React.Fragment key={item.threadId}>
                          <tr
                            className="border-b cursor-pointer hover:opacity-95"
                            style={{
                              borderColor: GOLEE.border,
                              backgroundColor: rowBg,
                            }}
                            onClick={() => {
                              void handleOpenInboxRow(item.threadId)
                            }}
                          >
                            <td className="py-2 px-3 whitespace-nowrap" style={{ color: GOLEE.textMuted }}>
                              {dateLabel}
                            </td>
                            <td className="py-2 px-3 font-medium truncate max-w-[140px]" style={{ color: GOLEE.text }}>
                              {item.senderName}
                            </td>
                            <td className="py-2 px-3 truncate max-w-[180px]" style={{ color: GOLEE.text }}>
                              {item.title}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  title="Nascondi dalla home"
                                  className="rounded-lg p-1 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void handleDismissInboxThread(item.threadId)
                                  }}
                                >
                                  <X className="w-4 h-4" style={{ color: GOLEE.danger }} />
                                </button>
                                {expanded ? (
                                  <ChevronUp className="w-4 h-4" style={{ color: GOLEE.textMuted }} />
                                ) : (
                                  <ChevronDown className="w-4 h-4" style={{ color: GOLEE.textMuted }} />
                                )}
                              </div>
                            </td>
                          </tr>
                          {expanded && (
                            <tr key={`${item.threadId}-expanded`} style={{ backgroundColor: item.unread ? GOLEE.accentSoft : GOLEE.surfaceMuted }}>
                              <td colSpan={4} className="px-3 pb-3 pt-0">
                                <div
                                  className="overflow-hidden rounded-xl border"
                                  style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface }}
                                >
                                  <div className="px-4 py-3">
                                    <p className={`${CARD.sm} whitespace-pre-wrap leading-relaxed`} style={{ color: GOLEE.text }}>
                                      {item.body}
                                    </p>
                                  </div>
                                  <div
                                    className="flex items-center justify-between gap-3 border-t px-4 py-2.5"
                                    style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
                                  >
                                    <button
                                      type="button"
                                      className={`${CARD.xs} font-medium transition-opacity hover:opacity-70`}
                                      style={{ color: GOLEE.danger }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        void handleDismissInboxThread(item.threadId)
                                      }}
                                    >
                                      Nascondi
                                    </button>
                                    {item.senderPersonId ? (
                                      <button
                                        type="button"
                                        className={`inline-flex items-center gap-1.5 ${CARD.xs} font-semibold transition-opacity hover:opacity-80`}
                                        style={{ color: GOLEE.accent }}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          navigate(
                                            `/create-person?edit=${item.senderPersonId}&tab=correspondence&thread=${item.threadId}`
                                          )
                                        }}
                                      >
                                        Apri conversazione
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <span className={CARD.xs} style={{ color: GOLEE.textMuted }}>
                                        Anagrafica non collegata
                                      </span>
                                    )}
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
              )}
            </div>
          </div>

          {/* Lista infortuni */}
          <div
            onClick={() => navigate('/infortuni')}
            className={`${goleeCardClass} cursor-pointer hover:shadow-md transition-all flex flex-col min-h-[200px]`}
            style={{ borderColor: GOLEE.border }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
              <h3 className={`${CARD.md} font-semibold flex items-center gap-2`} style={{ color: GOLEE.text }}>
                <Stethoscope className="w-5 h-5" style={{ color: GOLEE.warning }} />
                Infermeria
              </h3>
              <span className={CARD.sm} style={{ color: GOLEE.textMuted }}>Aperti</span>
            </div>
            <div className="p-2 flex-1 overflow-hidden">
              {loadingInjuriesList ? (
                <p className={`${CARD.sm} p-2`} style={{ color: GOLEE.textMuted }}>Caricamento...</p>
              ) : injuriesList.length === 0 ? (
                <p className={`${CARD.sm} p-2`} style={{ color: GOLEE.textMuted }}>Nessun infortunio in corso</p>
              ) : (
                <table className={`w-full text-left ${CARD.sm}`}>
                  <thead>
                    <tr className="border-b" style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}>
                      <th className="py-2 px-2 font-medium">Giocatore</th>
                      <th className="py-2 px-2 font-medium">Cat.</th>
                      <th className="py-2 px-2 font-medium">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...injuriesList]
                      .sort((a, b) => categoryDisplayOrder(a.categoryLabel) - categoryDisplayOrder(b.categoryLabel))
                      .map((row, idx) => (
                      <tr key={row.id} className="border-b" style={{ borderColor: GOLEE.border, backgroundColor: idx % 2 === 0 ? GOLEE.surface : GOLEE.surfaceMuted }}>
                        <td className="py-2 px-2 truncate max-w-[120px]" style={{ color: GOLEE.text }}>{formatDisplayPersonName(row.full_name)}</td>
                        <td className="py-2 px-2" style={{ color: GOLEE.textMuted }}>{formatCategoryLabelForDashboard(row.categoryLabel)}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded ${CARD.xs} font-medium ${
                              row.status === 'In corso' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Memo + Alert affiancati (stesso spazio di una sola card) */}
          <div className="grid grid-cols-2 gap-3 min-h-[200px]">
            <div
              onClick={() => navigate('/memo')}
              className={`${goleeCardClass} cursor-pointer hover:shadow-md transition-all flex flex-col min-h-[200px]`}
              style={{ borderColor: GOLEE.border }}
            >
              <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
                <h3 className={`${CARD.sm} font-semibold flex items-center gap-1.5`} style={{ color: GOLEE.text }}>
                  <StickyNote className="w-4 h-4" style={{ color: GOLEE.violet }} />
                  Memo
                </h3>
              </div>
              <div className="p-3 flex-1 overflow-y-auto max-h-[200px]">
                {loadingMemos ? (
                  <p className={CARD.xs} style={{ color: GOLEE.textMuted }}>Caricamento...</p>
                ) : (() => {
                  const groups = getDashboardMemoGroups(userMemos)
                  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0)
                  if (totalCount === 0) {
                    return <p className={CARD.xs} style={{ color: GOLEE.textMuted }}>Nessun memo</p>
                  }

                  const maxTotal = 6
                  let shown = 0

                  return (
                    <div className="space-y-2">
                      {groups.map((group) => {
                        if (shown >= maxTotal) return null
                        const remaining = maxTotal - shown
                        const items = group.items.slice(0, Math.min(2, remaining))
                        shown += items.length

                        return (
                          <div key={group.type}>
                            <p className={`${CARD.tiny} font-semibold uppercase tracking-wide mb-1`} style={{ color: GOLEE.textMuted }}>
                              {group.label}
                            </p>
                            <div className="space-y-1">
                              {items.map((m) => {
                                const meta = getDashboardMemoMeta(m)
                                return (
                                  <div key={m.id} className={`flex items-start gap-1.5 ${CARD.xs} min-w-0`}>
                                    <span className="shrink-0 leading-4">{MEMO_TYPE_ICON[m.type]}</span>
                                    <div className="min-w-0 flex-1">
                                      <p className={`truncate ${m.completed ? 'line-through opacity-70' : ''}`} style={{ color: GOLEE.text }}>
                                        {m.content}
                                      </p>
                                      {meta && (
                                        <p className={`${CARD.tiny} truncate`} style={{ color: GOLEE.textMuted }}>{meta}</p>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                      {totalCount > maxTotal && (
                        <p className={CARD.tiny} style={{ color: GOLEE.textMuted }}>+{totalCount - maxTotal} altri</p>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            <div
              onClick={() => navigate('/alerts')}
              className={`${goleeCardClass} cursor-pointer hover:shadow-md transition-all flex flex-col min-h-[200px]`}
              style={{ borderColor: GOLEE.border }}
            >
              <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
                <h3 className={`${CARD.sm} font-semibold flex items-center gap-1.5`} style={{ color: GOLEE.text }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: GOLEE.danger }} />
                  Alert
                </h3>
                {totalAlerts > 0 && (
                  <span className={`bg-red-100 text-red-700 ${CARD.tiny} font-bold px-1.5 py-0.5 rounded-full`}>{totalAlerts}</span>
                )}
              </div>
              <div className="p-3 flex-1 space-y-1.5">
                {alertsCount.documents > 0 && (
                  <p className={CARD.xs} style={{ color: GOLEE.text }}>• {alertsCount.documents} documenti in scadenza</p>
                )}
                {alertsCount.notes > 0 && (
                  <p className={CARD.xs} style={{ color: GOLEE.text }}>• {alertsCount.notes} note con promemoria</p>
                )}
                {alertsCount.fees > 0 && (
                  <p className={CARD.xs} style={{ color: GOLEE.text }}>• {alertsCount.fees} quote scadute</p>
                )}
                {totalAlerts === 0 && (
                  <p className={CARD.xs} style={{ color: GOLEE.textMuted }}>Nessun alert in sospeso</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* BLOCCO INSIGHT AVANZATO */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-3 gap-6"
        >
          <div
            className={`col-span-2 ${goleeCardClass}`}
            style={{ borderColor: GOLEE.border }}
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className={`${CARD.xl} font-semibold`} style={{ color: GOLEE.text }}>Trend Presenze</h3>
                <TrendingUp className="w-5 h-5" style={{ color: GOLEE.accent }} />
              </div>
              <div
                className="h-32 rounded-xl flex items-end justify-around p-4 gap-1"
                style={{ backgroundColor: GOLEE.surfaceMuted }}
              >
                {(attendanceTrend.length ? attendanceTrend : [40, 60, 50, 80, 70, 90]).map((h, i) => (
                  <div
                    key={i}
                    style={{
                      height: `${Math.min(Math.max(h, 10), 100)}%`,
                      backgroundColor: GOLEE.accent,
                      minHeight: '8px',
                      borderRadius: '8px',
                      width: '24px'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div
            className={`${goleeCardClass} cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.01] flex flex-col`}
            style={{ borderColor: GOLEE.border }}
            onClick={() => navigate('/attendance')}
          >
            <div className="p-4 flex items-center gap-2 border-b" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
              <ClipboardCheck className="w-5 h-5 shrink-0" style={{ color: GOLEE.accent }} />
              <h3 className={`${CARD.md} font-semibold`} style={{ color: GOLEE.text }}>Presenze</h3>
              <span className={`${CARD.sm} ml-auto`} style={{ color: GOLEE.textMuted }}>Oggi</span>
            </div>
            <div className="p-4 flex-1 flex items-center gap-4">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <path
                    fill="none"
                    stroke={GOLEE.border}
                    strokeWidth="3"
                    d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                  />
                  <path
                    fill="none"
                    stroke={GOLEE.accent}
                    strokeWidth="3"
                    strokeDasharray={`${(stats?.todayAttendance?.percentage ?? 0) * 0.97} 97`}
                    strokeLinecap="round"
                    d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className={`font-bold ${CARD.md}`} style={{ color: GOLEE.text }}>{stats?.todayAttendance?.percentage ?? 0}% Presenti</p>
                <p className={CARD.sm} style={{ color: GOLEE.textMuted }}>{stats?.todayAttendance?.absent ?? 0} Assenti</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* GIOCATORI PER CATEGORIA + COMPLEANNI PROSSIMI */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Giocatori per Categoria */}
          <div
            className={`${goleeCardClass} cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.01]`}
            style={{ borderColor: GOLEE.border }}
            onClick={() => navigate('/activities')}
          >
            <div className="p-8">
              <h3 className={`${CARD.xl} font-semibold text-center mb-6`} style={{ color: GOLEE.text }}>Giocatori per Categoria</h3>
              <div className="space-y-4">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 rounded w-24 mb-2" style={{ backgroundColor: GOLEE.border }} />
                        <div className="h-2 rounded-full" style={{ backgroundColor: GOLEE.surfaceMuted }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  (() => {
                    const raw = stats?.playersByCategory?.filter(
                      (item: { category?: string; count?: number }) => item && item.category
                    ) || []
                    const norm = (name: string) => {
                      const n = (name || '').trim()
                      if (/^u14$/i.test(n) || n === 'Under 14') return 'Under 14'
                      if (/^u16$/i.test(n) || n === 'Under 16') return 'Under 16'
                      if (/^u18$/i.test(n) || n === 'Under 18') return 'Under 18'
                      if (/serie\s*c$/i.test(n) || n === 'Serie C') return 'Serie C'
                      if (/serie\s*b$/i.test(n) || n === 'Serie B') return 'Serie B'
                      return name
                    }
                    const countByCategory: Record<string, number> = {}
                    raw.forEach((i: { category: string; count: number }) => {
                      const key = norm(i.category)
                      countByCategory[key] = (countByCategory[key] || 0) + (i.count || 0)
                    })
                    const categoryOrder = ['Under 14', 'Under 16', 'Under 18', 'Serie C', 'Serie B']
                    const items = categoryOrder.map(cat => ({
                      category: cat,
                      count: countByCategory[cat] ?? 0
                    }))
                    const maxCount = Math.max(...items.map((i: { count?: number }) => i.count || 0), 1)
                    return (
                      items.map((item: { category: string; count: number }, i: number) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className={`${CARD.sm} font-medium`} style={{ color: GOLEE.textMuted }}>{item.category}</span>
                            <span className={`${CARD.sm} font-semibold`} style={{ color: GOLEE.text }}>{item.count}</span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: GOLEE.surfaceMuted }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max((item.count / maxCount) * 100, 5)}%`,
                                backgroundColor: GOLEE.accent
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )
                  })()
                )}
              </div>
            </div>
          </div>

          {/* Giocatori per Società di origine */}
          <div
            className={`${goleeCardClass} cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.01]`}
            style={{ borderColor: GOLEE.border }}
            onClick={() => navigate('/people')}
          >
            <div className="p-8">
              <h3 className={`${CARD.xl} font-semibold text-center mb-6`} style={{ color: GOLEE.text }}>Giocatori per Società di origine</h3>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 rounded w-24 mb-2" style={{ backgroundColor: GOLEE.border }} />
                      <div className="h-2 rounded-full" style={{ backgroundColor: GOLEE.surfaceMuted }} />
                    </div>
                  ))}
                </div>
              ) : (
                (() => {
                  const items = (stats?.playersByOriginClub || []).filter(
                    (item: { originClub?: string; count?: number }) => item && (item.originClub != null || item.count != null)
                  )
                  if (items.length === 0) {
                    return (
                      <p className={`${CARD.sm} text-center py-4`} style={{ color: GOLEE.textMuted }}>Nessun dato società di origine</p>
                    )
                  }
                  const maxCount = Math.max(...items.map((i: { count?: number }) => i.count || 0), 1)
                  const formatOriginClubLabel = (s: string) => {
                    if (!s || s === 'Non indicata') return s
                    return s.replace(/\b\w/g, c => c.toUpperCase())
                  }
                  const twoColumns = items.length > 10
                  return (
                    <div className={twoColumns ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4' : 'space-y-4'}>
                      {items.map((item: { originClub: string; count: number }, i: number) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className={`${CARD.sm} font-medium truncate pr-2`} style={{ color: GOLEE.textMuted }}>{formatOriginClubLabel(item.originClub)}</span>
                            <span className={`${CARD.sm} font-semibold shrink-0`} style={{ color: GOLEE.text }}>{item.count}</span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: GOLEE.surfaceMuted }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max((item.count / maxCount) * 100, 5)}%`,
                                backgroundColor: GOLEE.info
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()
              )}
            </div>
          </div>

          {/* Prossimi Compleanni */}
          <div
            className={goleeCardClass}
            style={{ borderColor: GOLEE.border }}
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full border flex items-center justify-center"
                    style={{ backgroundColor: GOLEE.warningSoft, borderColor: GOLEE.border }}
                  >
                    <Cake className="w-6 h-6" style={{ color: GOLEE.warning }} />
                  </div>
                  <div>
                    <h3 className={`${CARD.xl} font-semibold`} style={{ color: GOLEE.text }}>Prossimi Compleanni</h3>
                    <p className={CARD.sm} style={{ color: GOLEE.textMuted }}>Nei prossimi 5 giorni</p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full ${CARD.sm} font-medium`}
                  style={{ backgroundColor: GOLEE.warningSoft, color: GOLEE.warning }}
                >
                  {loadingBirthdays ? '...' : visibleBirthdays.length}
                </span>
              </div>

              <div className="space-y-2">
                {loadingBirthdays ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: GOLEE.surfaceMuted }} />
                    ))}
                  </div>
                ) : visibleBirthdays.length === 0 ? (
                  <p className={`${CARD.sm} text-center py-4`} style={{ color: GOLEE.textMuted }}>Nessun compleanno nei prossimi 5 giorni</p>
                ) : (
                  visibleBirthdays.map((person) => {
                    const formattedDate = person.birthdayDate.toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit'
                    })
                    let statusText = ''
                    let statusClass = 'bg-pink-100 text-pink-700'
                    if (person.daysUntilBirthday === 0) {
                      statusText = 'Oggi!'
                      statusClass = 'bg-orange-100 text-orange-700'
                    } else if (person.daysUntilBirthday === 1) {
                      statusText = 'Domani'
                      statusClass = 'bg-amber-100 text-amber-700'
                    } else {
                      statusText = `Tra ${person.daysUntilBirthday} giorni`
                    }
                    return (
                      <div
                        key={person.id}
                        className="rounded-xl p-3 flex items-center justify-between gap-2 border"
                        style={{ backgroundColor: GOLEE.surfaceMuted, borderColor: GOLEE.border }}
                      >
                        <div
                          onClick={() => navigate('/birthdays')}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <span className="font-medium block" style={{ color: GOLEE.text }}>{formatDisplayPersonName(person.full_name)}</span>
                          <span className={CARD.sm} style={{ color: GOLEE.textMuted }}>
                            {formattedDate} • {person.age} anni
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-1 rounded-lg ${CARD.xs} font-medium ${statusClass}`}>
                            {statusText}
                          </span>
                          {person.daysUntilBirthday === 0 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleBirthdaySend(person, e) }}
                              title={getPhoneForWhatsApp(person).length > 0 ? 'Invia auguri WhatsApp + notifica app' : 'Invia auguri nell\'app mobile'}
                              className="p-1.5 rounded-full bg-green-600 text-white hover:bg-green-500 transition"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <button
                onClick={() => navigate('/birthdays')}
                className={`w-full mt-4 pt-4 border-t font-medium ${CARD.sm} transition-colors hover:opacity-90`}
                style={{ borderColor: GOLEE.border, color: GOLEE.accent }}
              >
                Visualizza Tutti i Compleanni
              </button>
            </div>
          </div>
        </motion.div>

        {/* Modal conferma invio WhatsApp */}
        {birthdayConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 border border-gray-200 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Messaggio WhatsApp inviato?</h3>
              <p className="text-gray-600 text-sm mb-4">
                Hai inviato gli auguri a {birthdayConfirmModal.personName}?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBirthdayConfirmYes}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium"
                >
                  Sì
                </button>
                <button
                  type="button"
                  onClick={handleBirthdayConfirmNo}
                  className="flex-1 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-medium"
                >
                  No
                </button>
              </div>
            </div>
          </div>
        )}

        <WhatsAppOpenModal
          isOpen={whatsAppModal.open}
          url={whatsAppModal.url}
          onClose={() => setWhatsAppModal({ open: false, url: '' })}
        />
        </div>
      </>
  )
}
