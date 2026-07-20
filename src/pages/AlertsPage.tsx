import { useState, useEffect, type ElementType, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  FileText,
  StickyNote,
  CreditCard,
  Bell,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { getBrandConfig } from '@/config/brand'
import Header from '@/components/Header'
import { formatCurrency } from '@/utils/feeUtils'
import { formatDisplayPersonName } from '@/lib/formatPersonName'

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
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
  success: '#10B981',
  successSoft: '#ECFDF5',
} as const

type AlertFilter = 'all' | 'documents' | 'notes' | 'fees'

interface ExpiringDocument {
  id: string
  category: string
  expiry_date: string
  person_id: string
  people: {
    id: string
    full_name: string
  }
}

interface ExpiringNote {
  id: string
  content: string
  reminder_date: string
  person_id: string
  people: {
    id: string
    full_name: string
  }
}

interface OverdueFee {
  id: string
  amount: number
  due_date: string
  person_id: string
  installment_number?: number
  people: { id: string; full_name: string }
  fees: { id: string; name: string }
}

interface AlertsPageProps {
  embedInLayout?: boolean
}

export default function AlertsPage({ embedInLayout = false }: AlertsPageProps) {
  const navigate = useNavigate()
  const brand = getBrandConfig()
  const accentColor = GOLEE.accent

  const [expiringDocuments, setExpiringDocuments] = useState<ExpiringDocument[]>([])
  const [expiringNotes, setExpiringNotes] = useState<ExpiringNote[]>([])
  const [overdueFees, setOverdueFees] = useState<OverdueFee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState<AlertFilter>('all')

  const loadExpiringDocuments = async () => {
    try {
      const today = new Date()
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(today.getDate() + 30)

      const { data: documents, error } = await supabase
        .from('documents')
        .select(`
          id,
          category,
          expiry_date,
          person_id,
          people:person_id(
            id,
            full_name
          )
        `)
        .in('category', ['id_card', 'certificate'])
        .not('expiry_date', 'is', null)
        .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true })

      if (error) {
        console.error('Errore nel caricamento documenti in scadenza:', error)
        return
      }

      // Transform Supabase join results
      const transformedDocuments = (documents || []).map(doc => ({
        ...doc,
        people: Array.isArray(doc.people) ? doc.people[0] : doc.people
      }))

      setExpiringDocuments(transformedDocuments)
    } catch (error) {
      console.error('Errore nel caricamento documenti in scadenza:', error)
    }
  }

  const loadOverdueFees = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: assignments, error } = await supabase
        .from('fee_assignments')
        .select(`
          id,
          amount,
          due_date,
          person_id,
          status,
          installment_number,
          people:person_id(id, full_name),
          fees:fee_id(id, name)
        `)
        .in('status', ['pending', 'overdue'])

      if (error) {
        console.error('Errore nel caricamento quote scadute:', error)
        return
      }

      // Transform Supabase join results
      const transformedAssignments = (assignments || []).map(a => ({
        ...a,
        people: Array.isArray(a.people) ? a.people[0] : a.people,
        fees: Array.isArray(a.fees) ? a.fees[0] : a.fees
      }))

      const overdue = transformedAssignments.filter((a: { status: string; due_date?: string }) =>
        a.status === 'overdue' || (a.due_date && a.due_date < today)
      )
      setOverdueFees(overdue)
    } catch (error) {
      console.error('Errore nel caricamento quote scadute:', error)
    }
  }

  const loadExpiringNotes = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)

      const { data: notes, error } = await supabase
        .from('notes')
        .select(`
          id,
          content,
          reminder_date,
          person_id,
          people:person_id(
            id,
            full_name
          )
        `)
        .not('reminder_date', 'is', null)
        .lte('reminder_date', tomorrow.toISOString())
        .order('reminder_date', { ascending: true })

      if (error) {
        console.error('Errore nel caricamento note in scadenza:', error)
        return
      }

      // Transform Supabase join results
      const transformedNotes = (notes || []).map(note => ({
        ...note,
        people: Array.isArray(note.people) ? note.people[0] : note.people
      }))

      setExpiringNotes(transformedNotes)
    } catch (error) {
      console.error('Errore nel caricamento note in scadenza:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        loadExpiringDocuments(),
        loadExpiringNotes(),
        loadOverdueFees()
      ])
      setLoading(false)
    }
    loadData()
  }, [])

  const getDocumentTypeLabel = (category: string) => {
    switch (category) {
      case 'id_card':
        return 'Documento identità'
      case 'certificate':
        return 'Visita medica'
      default:
        return 'Documento'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date()
    const expiry = new Date(expiryDate)
    const diffTime = expiry.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const getExpiryStyle = (days: number) => {
    if (days <= 0) return { bg: GOLEE.dangerSoft, text: GOLEE.danger, border: '#FECACA', label: 'Scaduto' }
    if (days <= 7) return { bg: GOLEE.warningSoft, text: GOLEE.warning, border: '#FDE68A', label: days === 1 ? 'Scade domani' : `Scade tra ${days} giorni` }
    return { bg: GOLEE.infoSoft, text: GOLEE.info, border: '#BFDBFE', label: `Scade tra ${days} giorni` }
  }

  const filterDocuments = (documents: ExpiringDocument[]) => {
    if (!searchTerm) return documents
    const term = searchTerm.toLowerCase()
    return documents.filter(doc =>
      (doc.people?.full_name || '').toLowerCase().includes(term) ||
      getDocumentTypeLabel(doc.category).toLowerCase().includes(term)
    )
  }

  const filterNotes = (notes: ExpiringNote[]) => {
    if (!searchTerm) return notes
    const term = searchTerm.toLowerCase()
    return notes.filter(note =>
      (note.people?.full_name || '').toLowerCase().includes(term) ||
      'nota'.includes(term) ||
      note.content.toLowerCase().includes(term)
    )
  }

  const filterOverdueFees = (fees: OverdueFee[]) => {
    if (!searchTerm) return fees
    const term = searchTerm.toLowerCase()
    return fees.filter(f =>
      (f.people?.full_name || '').toLowerCase().includes(term) ||
      (f.fees?.name || '').toLowerCase().includes(term)
    )
  }

  const filteredDocuments = filterDocuments(expiringDocuments)
  const filteredNotes = filterNotes(expiringNotes)
  const filteredOverdueFees = filterOverdueFees(overdueFees)
  const totalAlerts = filteredDocuments.length + filteredNotes.length + filteredOverdueFees.length

  const showDocuments = activeFilter === 'all' || activeFilter === 'documents'
  const showNotes = activeFilter === 'all' || activeFilter === 'notes'
  const showFees = activeFilter === 'all' || activeFilter === 'fees'

  const pageBg = embedInLayout ? 'min-h-full' : 'min-h-screen'
  const contentBg = embedInLayout
    ? { backgroundColor: GOLEE.surfaceMuted }
    : { background: `linear-gradient(180deg, ${GOLEE.surfaceMuted} 0%, #EEF1F5 100%)` }

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
      className={`rounded-2xl p-5 border shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'hover:shadow-md'}`}
      style={{
        backgroundColor: GOLEE.surface,
        borderColor: active && activeColor ? activeColor : GOLEE.border,
        borderWidth: active ? '2px' : '1px',
        boxShadow: active && activeColor ? `0 0 0 3px ${activeColor}22` : undefined,
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLEE.textMuted }}>
            {label}
          </p>
          <p className="text-3xl font-bold leading-tight mt-0.5" style={{ color: GOLEE.text }}>
            {value}
          </p>
          <p className="text-sm mt-0.5" style={{ color: GOLEE.textMuted }}>
            {sublabel}
          </p>
        </div>
      </div>
    </div>
  )

  /** 'access' = tabella stile Airtable · 'cards' = layout card precedente (per tornare indietro) */
  const FEE_TABLE_VARIANT: 'access' | 'cards' = 'access'

  const FEE_ROW_COLUMNS = 'minmax(0,2.1fr) minmax(0,1.3fr) minmax(0,0.9fr) minmax(0,0.8fr) calc(6.125rem + 30px) 8.125rem'
  const feeGridStyle = { gridTemplateColumns: FEE_ROW_COLUMNS }

  const AIRTABLE = {
    border: '#E8ECF0',
    headerBg: '#FAFBFC',
    headerText: '#6B7280',
    rowBg: '#FFFFFF',
    rowHover: '#F4F6F8',
    statusBg: '#FFE8E6',
    statusText: '#C0392B',
    icon: '#9CA3AF',
    iconHover: '#374151',
  }

  const COL_LABELS = ['Quota / Rata', 'Tesserato', 'Scadenza', 'Importo', 'Stato', 'Azione']

  const FEE_COL_ALIGN: Record<number, 'left' | 'center' | 'right'> = {
    0: 'left',
    1: 'left',
    2: 'center',
    3: 'center',
    4: 'center',
    5: 'center',
  }

  const feeAlignClass = (align: 'left' | 'center' | 'right') =>
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'

  const getFeeRowData = (fee: OverdueFee) => ({
    quotaLabel: `${fee.fees?.name || 'Quota'}${fee.installment_number ? ` – Rata ${fee.installment_number}` : ''}`,
    personName: formatDisplayPersonName(fee.people?.full_name) || '—',
    dueDate: formatDate(fee.due_date),
    amount: formatCurrency(fee.amount / 100),
  })

  const feeHeaderCellClass = (align: 'left' | 'center' | 'right' = 'left') => {
    const justifyClass =
      align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
    return `min-w-0 px-3 h-full flex items-center ${justifyClass}`
  }

  const feeCellClass = (align: 'left' | 'center' | 'right' = 'left') => {
    const alignClass =
      align === 'right' ? 'text-right' : align === 'center' ? 'text-center items-center' : ''
    return `min-w-0 px-3 py-0.5 h-full flex flex-col justify-center ${alignClass}`
  }

  const FeeGridCells = ({
    quotaLabel,
    personName,
    dueDate,
    amount,
    onAction,
  }: {
    quotaLabel: string
    personName: string
    dueDate: string
    amount: string
    onAction: () => void
  }) => {
    const badgeStyle = { bg: GOLEE.dangerSoft, text: GOLEE.danger, border: '#FECACA' }
    return (
      <>
        <div className={feeCellClass('left')}>
          <p className="font-semibold truncate" style={{ color: GOLEE.text }}>{quotaLabel}</p>
        </div>
        <div className={feeCellClass(FEE_COL_ALIGN[1])}>
          <p className="text-sm truncate" style={{ color: GOLEE.text }}>{personName}</p>
        </div>
        <div className={feeCellClass(FEE_COL_ALIGN[2])}>
          <p className="text-sm" style={{ color: GOLEE.textMuted }}>{dueDate}</p>
        </div>
        <div className={feeCellClass(FEE_COL_ALIGN[3])}>
          <p className="text-sm font-semibold" style={{ color: GOLEE.text }}>{amount}</p>
        </div>
        <div className={feeCellClass(FEE_COL_ALIGN[4])}>
          <span
            className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap mx-auto"
            style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.border}` }}
          >
            Scaduta
          </span>
        </div>
        <div className={feeCellClass(FEE_COL_ALIGN[5])}>
          <button
            type="button"
            onClick={onAction}
            title="Apri"
            aria-label="Apri quote"
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors mx-auto"
            style={{ color: accentColor }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = GOLEE.accentSoft }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </>
    )
  }

  const FeeDesktopTableAccess = ({
    fees,
    onRowAction,
  }: {
    fees: OverdueFee[]
    onRowAction: () => void
  }) => (
    <div className="hidden md:block px-4 pb-4 pt-2">
      <div
        className="overflow-hidden rounded-lg"
        style={{
          border: `1px solid ${AIRTABLE.border}`,
          backgroundColor: AIRTABLE.rowBg,
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: AIRTABLE.headerBg }}>
                {COL_LABELS.map((label, i) => (
                  <th
                    key={label}
                    className={`px-4 py-2.5 text-xs font-medium ${feeAlignClass(FEE_COL_ALIGN[i])}`}
                    style={{
                      color: AIRTABLE.headerText,
                      borderBottom: `1px solid ${AIRTABLE.border}`,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => {
                const { quotaLabel, personName, dueDate, amount } = getFeeRowData(fee)
                return (
                  <tr
                    key={fee.id}
                    className="transition-colors duration-100"
                    style={{ backgroundColor: AIRTABLE.rowBg }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = AIRTABLE.rowHover }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = AIRTABLE.rowBg }}
                  >
                    <td
                      className={`px-4 py-3 truncate ${feeAlignClass(FEE_COL_ALIGN[0])}`}
                      style={{ color: GOLEE.text, borderBottom: `1px solid ${AIRTABLE.border}` }}
                      title={quotaLabel}
                    >
                      {quotaLabel}
                    </td>
                    <td
                      className={`px-4 py-3 truncate ${feeAlignClass(FEE_COL_ALIGN[1])}`}
                      style={{ color: GOLEE.text, borderBottom: `1px solid ${AIRTABLE.border}` }}
                      title={personName}
                    >
                      {personName}
                    </td>
                    <td
                      className={`px-4 py-3 tabular-nums ${feeAlignClass(FEE_COL_ALIGN[2])}`}
                      style={{ color: GOLEE.textMuted, borderBottom: `1px solid ${AIRTABLE.border}` }}
                    >
                      {dueDate}
                    </td>
                    <td
                      className={`px-4 py-3 tabular-nums ${feeAlignClass(FEE_COL_ALIGN[3])}`}
                      style={{ color: GOLEE.text, borderBottom: `1px solid ${AIRTABLE.border}` }}
                    >
                      {amount}
                    </td>
                    <td
                      className={`px-4 py-3 ${feeAlignClass(FEE_COL_ALIGN[4])}`}
                      style={{ borderBottom: `1px solid ${AIRTABLE.border}` }}
                    >
                      <span
                        className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{ backgroundColor: AIRTABLE.statusBg, color: AIRTABLE.statusText }}
                      >
                        Scaduta
                      </span>
                    </td>
                    <td
                      className={`px-3 py-3 ${feeAlignClass(FEE_COL_ALIGN[5])}`}
                      style={{ borderBottom: `1px solid ${AIRTABLE.border}` }}
                    >
                      <button
                        type="button"
                        onClick={onRowAction}
                        title="Apri"
                        aria-label="Apri quote"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-100"
                        style={{ color: AIRTABLE.icon }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = AIRTABLE.iconHover
                          e.currentTarget.style.backgroundColor = AIRTABLE.rowHover
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = AIRTABLE.icon
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const FeeDesktopTableCards = ({
    fees,
    onRowAction,
  }: {
    fees: OverdueFee[]
    onRowAction: () => void
  }) => (
    <div className="hidden md:block space-y-2">
      <div
        className="grid items-center min-h-[2.5rem] text-[10px] font-semibold uppercase tracking-wider"
        style={{ ...feeGridStyle, color: GOLEE.textMuted }}
      >
        {COL_LABELS.map((label, i) => (
          <div key={label} className={feeHeaderCellClass(FEE_COL_ALIGN[i])}>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {fees.map((fee) => {
        const { quotaLabel, personName, dueDate, amount } = getFeeRowData(fee)

        return (
          <div
            key={fee.id}
            className="grid items-center py-2 rounded-xl border transition-all hover:shadow-sm"
            style={{
              ...feeGridStyle,
              backgroundColor: GOLEE.surface,
              borderColor: GOLEE.border,
              borderLeftWidth: 4,
              borderLeftColor: GOLEE.danger,
            }}
          >
            <FeeGridCells
              quotaLabel={quotaLabel}
              personName={personName}
              dueDate={dueDate}
              amount={amount}
              onAction={onRowAction}
            />
          </div>
        )
      })}
    </div>
  )

  const FeeDesktopTable = (props: { fees: OverdueFee[]; onRowAction: () => void }) =>
    FEE_TABLE_VARIANT === 'access'
      ? <FeeDesktopTableAccess {...props} />
      : <FeeDesktopTableCards {...props} />

  const OverdueFeeRow = ({ fee, onAction }: { fee: OverdueFee; onAction: () => void }) => {
    const { quotaLabel } = getFeeRowData(fee)

    return (
      <div
        className="md:hidden rounded-xl border p-4 space-y-2"
        style={{
          backgroundColor: GOLEE.surface,
          borderColor: GOLEE.border,
          borderLeftWidth: '4px',
          borderLeftColor: GOLEE.danger,
        }}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: GOLEE.textMuted }}>Quota / Rata</p>
          <p className="font-semibold" style={{ color: GOLEE.text }}>{quotaLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: GOLEE.textMuted }}>Tesserato</p>
          <p className="text-sm" style={{ color: GOLEE.text }}>{formatDisplayPersonName(fee.people?.full_name) || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 text-center" style={{ color: GOLEE.textMuted }}>Scadenza</p>
          <p className="text-sm text-center" style={{ color: GOLEE.textMuted }}>{formatDate(fee.due_date)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 text-center" style={{ color: GOLEE.textMuted }}>Importo</p>
          <p className="text-sm font-semibold text-center" style={{ color: GOLEE.text }}>{formatCurrency(fee.amount / 100)}</p>
        </div>
        <div className="flex items-center justify-center gap-4 pt-1">
          <span
            className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: GOLEE.dangerSoft, color: GOLEE.danger, border: '1px solid #FECACA' }}
          >
            Scaduta
          </span>
          <button
            type="button"
            onClick={onAction}
            title="Apri"
            aria-label="Apri quote"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: accentColor }}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  const AlertRow = ({
    title,
    subtitle,
    badge,
    badgeStyle,
    onAction,
    actionLabel,
  }: {
    title: string
    subtitle: string
    badge: string
    badgeStyle: { bg: string; text: string; border: string }
    onAction: () => void
    actionLabel: string
  }) => (
    <div
      className="flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-all hover:shadow-sm"
      style={{
        backgroundColor: GOLEE.surface,
        borderColor: GOLEE.border,
        borderLeftWidth: '4px',
        borderLeftColor: badgeStyle.text,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate" style={{ color: GOLEE.text }}>{title}</p>
        <p className="text-sm mt-0.5 truncate" style={{ color: GOLEE.textMuted }}>{subtitle}</p>
      </div>
      <span
        className="px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
        style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.text, border: `1px solid ${badgeStyle.border}` }}
      >
        {badge}
      </span>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105 shrink-0"
        style={{ backgroundColor: accentColor }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = GOLEE.accentHover }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = accentColor }}
      >
        {actionLabel}
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )

  const SectionBlock = ({
    icon: Icon,
    title,
    subtitle,
    count,
    flushContent = false,
    children,
  }: {
    icon: ElementType
    title: string
    subtitle?: string
    count: number
    flushContent?: boolean
    children: ReactNode
  }) => (
    <div
      className="rounded-2xl border shadow-sm overflow-hidden"
      style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
    >
      <div
        className="px-5 sm:px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: GOLEE.accentSoft }}
          >
            <Icon className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: GOLEE.text }}>{title}</h3>
            {subtitle && (
              <p className="text-sm" style={{ color: GOLEE.textMuted }}>{subtitle}</p>
            )}
          </div>
        </div>
        <span
          className="px-3 py-1 rounded-full text-sm font-medium"
          style={{ backgroundColor: GOLEE.accentSoft, color: accentColor }}
        >
          {count}
        </span>
      </div>
      <div className={flushContent ? 'p-0' : 'p-4 sm:p-5 space-y-2'}>{children}</div>
    </div>
  )

  if (loading) {
    return (
      <div className={pageBg} style={contentBg}>
        {!embedInLayout && <Header title="Alert & Notifiche" showBack hideCenterLogo />}
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
          <p className="text-sm font-medium" style={{ color: GOLEE.textMuted }}>Caricamento avvisi...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={pageBg} style={contentBg}>
      {!embedInLayout && <Header title="Alert & Notifiche" showBack hideCenterLogo />}

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Intestazione */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: GOLEE.accentSoft }}
              >
                <Bell className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: GOLEE.text }}>Alert & Notifiche</h2>
                <p className="text-sm" style={{ color: GOLEE.textMuted }}>
                  {brand.clubShortName} · scadenze documenti, note e quote
                </p>
              </div>
            </div>

            <div className="relative w-full lg:w-auto lg:flex-1 lg:max-w-md lg:ml-auto">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                style={{ color: GOLEE.textMuted }}
              />
              <input
                type="text"
                placeholder="Cerca per nome, tipo documento, quota o contenuto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-shadow"
                style={{
                  backgroundColor: GOLEE.surface,
                  borderColor: GOLEE.border,
                  color: GOLEE.text,
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                  style={{ color: GOLEE.textMuted }}
                  title="Cancella ricerca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={Bell}
              label="Totale avvisi"
              value={totalAlerts}
              sublabel="Tutte le categorie"
              iconBg={GOLEE.accentSoft}
              iconColor={accentColor}
              onClick={() => setActiveFilter('all')}
              active={activeFilter === 'all'}
              activeColor={accentColor}
            />
            <StatCard
              icon={FileText}
              label="Documenti"
              value={filteredDocuments.length}
              sublabel="In scadenza o scaduti"
              iconBg={GOLEE.infoSoft}
              iconColor={GOLEE.info}
              onClick={() => setActiveFilter(prev => (prev === 'documents' ? 'all' : 'documents'))}
              active={activeFilter === 'documents'}
              activeColor={GOLEE.info}
            />
            <StatCard
              icon={StickyNote}
              label="Note"
              value={filteredNotes.length}
              sublabel="In scadenza o scadute"
              iconBg={GOLEE.warningSoft}
              iconColor={GOLEE.warning}
              onClick={() => setActiveFilter(prev => (prev === 'notes' ? 'all' : 'notes'))}
              active={activeFilter === 'notes'}
              activeColor={GOLEE.warning}
            />
            <StatCard
              icon={CreditCard}
              label="Quote scadute"
              value={filteredOverdueFees.length}
              sublabel="Rate non pagate"
              iconBg={GOLEE.dangerSoft}
              iconColor={GOLEE.danger}
              onClick={() => setActiveFilter(prev => (prev === 'fees' ? 'all' : 'fees'))}
              active={activeFilter === 'fees'}
              activeColor={GOLEE.danger}
            />
          </div>
        </div>

        {/* Sezioni avvisi — larghezza piena */}
        <div className="w-full space-y-6">
          {totalAlerts === 0 ? (
            <div
              className="rounded-2xl border shadow-sm flex flex-col items-center justify-center py-16 gap-3"
              style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: GOLEE.successSoft }}
              >
                <CheckCircle2 className="w-7 h-7" style={{ color: GOLEE.success }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: GOLEE.text }}>Tutto in ordine!</h3>
              <p className="text-sm" style={{ color: GOLEE.textMuted }}>
                Non ci sono avvisi di scadenze al momento
              </p>
            </div>
          ) : (
            <>
              {showDocuments && filteredDocuments.length > 0 && (
                <SectionBlock
                  icon={FileText}
                  title="Documenti in scadenza"
                  subtitle="Scaduti o in scadenza entro 30 giorni"
                  count={filteredDocuments.length}
                >
                  {filteredDocuments.map((doc) => {
                    const days = getDaysUntilExpiry(doc.expiry_date)
                    const style = getExpiryStyle(days)
                    return (
                      <AlertRow
                        key={doc.id}
                        title={`${getDocumentTypeLabel(doc.category)} — ${formatDisplayPersonName(doc.people?.full_name) || '—'}`}
                        subtitle={`Scadenza: ${formatDate(doc.expiry_date)}`}
                        badge={style.label}
                        badgeStyle={style}
                        onAction={() => navigate(`/create-person?edit=${doc.person_id}&tab=documents`)}
                        actionLabel="Profilo"
                      />
                    )
                  })}
                </SectionBlock>
              )}

              {showFees && filteredOverdueFees.length > 0 && (
                <SectionBlock
                  icon={CreditCard}
                  title="Quote scadute"
                  count={filteredOverdueFees.length}
                  flushContent={FEE_TABLE_VARIANT === 'access'}
                >
                  <FeeDesktopTable
                    fees={[...filteredOverdueFees].sort(
                      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                    )}
                    onRowAction={() => navigate('/fees')}
                  />
                  <div className={FEE_TABLE_VARIANT === 'access' ? 'md:hidden p-4 space-y-2' : 'contents'}>
                    {[...filteredOverdueFees]
                      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                      .map((fee) => (
                        <OverdueFeeRow
                          key={fee.id}
                          fee={fee}
                          onAction={() => navigate('/fees')}
                        />
                      ))}
                  </div>
                </SectionBlock>
              )}

              {showNotes && filteredNotes.length > 0 && (
                <SectionBlock
                  icon={StickyNote}
                  title="Note in scadenza"
                  subtitle="Note scadute o in scadenza oggi"
                  count={filteredNotes.length}
                >
                  {filteredNotes.map((note) => (
                    <AlertRow
                      key={note.id}
                      title={`Nota — ${formatDisplayPersonName(note.people?.full_name) || '—'}`}
                      subtitle={`"${note.content}" · Scade: ${formatDate(note.reminder_date)}`}
                      badge="Oggi"
                      badgeStyle={{ bg: GOLEE.warningSoft, text: GOLEE.warning, border: '#FDE68A' }}
                      onAction={() => navigate(`/create-person?edit=${note.person_id}&tab=notes`)}
                      actionLabel="Profilo"
                    />
                  ))}
                </SectionBlock>
              )}

              {activeFilter !== 'all' && totalAlerts > 0 && (
                (activeFilter === 'documents' && filteredDocuments.length === 0) ||
                (activeFilter === 'notes' && filteredNotes.length === 0) ||
                (activeFilter === 'fees' && filteredOverdueFees.length === 0)
              ) && (
                <div
                  className="rounded-2xl border flex flex-col items-center justify-center py-12 gap-3"
                  style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
                >
                  <AlertTriangle className="w-8 h-8" style={{ color: GOLEE.warning }} />
                  <p className="text-sm font-medium" style={{ color: GOLEE.textMuted }}>
                    Nessun avviso in questa categoria
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: GOLEE.accentSoft, color: accentColor }}
                  >
                    <X className="w-3 h-3" /> Mostra tutti
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
