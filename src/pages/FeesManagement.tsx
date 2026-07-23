import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, FileText, LayoutGrid, Plus, RotateCcw, Send, Table2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabaseClient'
import {
  getInstallmentStatus,
  calculateDaysLate,
  canEditInstallment as canEditInstallmentCore,
  recordAssignmentPayment,
  markInstallmentsPaid,
  voidPayment,
  toCents,
  fromCents
} from '@/lib/fees/paymentsCore'
import { formatCurrency, feeMatchesCategoryFilter, getPersonCategoryLabel, personMatchesCategoryFilter } from '@/utils/feeUtils'
import { useActiveCategoriesForSelect } from '@/hooks/useActiveCategoriesForSelect'
import { generateRicevutaPDF, type DatiRicevuta } from '@/lib/ricevutaPdfGenerator'
import { getBrandConfig } from '@/config/brand'
import { getReceiptHeaderSettings } from '@/features/templatesRicevute/api/receiptHeader.api'
import FeeAssignmentModal from '../components/FeeAssignmentModal'
import CompleteFeeAssignmentModal from '../components/CompleteFeeAssignmentModal'
import Header from '../components/Header'
import WhatsAppOpenModal from '../components/WhatsAppOpenModal'

interface Fee {
  id: string
  name: string
  description: string
  type: 'membership' | 'trip' | 'course' | 'event' | 'equipment' | 'insurance' | 'other'
  amount: number
  currency: string
  category: 'all' | 'U6' | 'U8' | 'U10' | 'U12' | 'U14' | 'U16' | 'U18' | 'SERIE_C' | 'SERIE_B' | 'SENIORES' | 'PODEROSA' | 'GUSSAGOLD' | 'BRIXIAOLD' | 'LEONESSE'
  applicable_categories?: string[] // Array delle categorie applicabili
  is_active: boolean
  is_mandatory: boolean
  due_date?: string
  created_at: string
  updated_at: string
  // Nuovi campi per modalità di pagamento
  payment_mode?: 'single' | 'installments'
  installment_count?: number
  installment_frequency?: 'monthly' | 'weekly'
  installment_start_date?: string
  // Configurazione manuale delle rate
  installments?: Array<{ amount: number; due_date: string; notes?: string; installment_number?: number }>
}

interface FeeAssignment {
  id: string
  fee_id: string
  person_id: string
  amount: number
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  due_date: string
  paid_date?: string
  paid_at?: string
  payment_method?: string
  notes?: string
  installment_number?: number
  installment_type?: string
  created_at: string
  updated_at?: string
  paid_amount?: number
  people?: any
  fees?: any
}

interface FeesManagementProps {
  embedInLayout?: boolean
}

const FeesManagement: React.FC<FeesManagementProps> = ({ embedInLayout = false }) => {
  const [searchParams] = useSearchParams()
  const categories = useActiveCategoriesForSelect()
  const isMobileView = searchParams.get('mobile') === '1'
  const deviceType = (searchParams.get('device') || 'phone') as 'tablet' | 'phone'
  const isReadOnly = isMobileView && deviceType === 'phone'
  const isMobileTablet = isMobileView && deviceType === 'tablet'

  const [fees, setFees] = useState<Fee[]>([])
  const [assignments, setAssignments] = useState<FeeAssignment[]>([])
  const [allCategoriesData, setAllCategoriesData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'fees' | 'assignments' | 'reports'>('reports')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingFee, setEditingFee] = useState<Fee | null>(null)
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [whatsAppModal, setWhatsAppModal] = useState<{ open: boolean; url: string; playerId?: string; feeId?: string; tutorId?: string }>({ open: false, url: '' })
  const [whatsAppConfirmModal, setWhatsAppConfirmModal] = useState(false)
  // Flusso Genera ricevuta (quote pagate)
  const [receiptRecipientModal, setReceiptRecipientModal] = useState<{
    open: boolean
    recipients: { id: string; name: string }[]
    assignmentGroup: FeeAssignment[]
    fee: Fee | null
    person: any
    paidWithoutReceipt?: FeeAssignment[]
  }>({ open: false, recipients: [], assignmentGroup: [], fee: null, person: null })
  const [receiptInstallmentModal, setReceiptInstallmentModal] = useState<{
    open: boolean
    paidInstallments: FeeAssignment[]
    recipientId: string
    recipientName: string
    assignmentGroup: FeeAssignment[]
    fee: Fee | null
    person: any
  }>({ open: false, paidInstallments: [], recipientId: '', recipientName: '', assignmentGroup: [], fee: null, person: null })
  const [receiptGenerating, setReceiptGenerating] = useState(false)
  const [receiptSelectedRecipientId, setReceiptSelectedRecipientId] = useState<string | null>(null)
  const [receiptPreviewModal, setReceiptPreviewModal] = useState<{
    open: boolean
    blob: Blob | null
    objectUrl: string | null
    targetAssignments: FeeAssignment[]
    recipientPersonId: string | null
  }>({ open: false, blob: null, objectUrl: null, targetAssignments: [], recipientPersonId: null })
  const [assignmentReceiptsMap, setAssignmentReceiptsMap] = useState<Record<string, string>>({})
  const [receiptSelectedInstallmentIds, setReceiptSelectedInstallmentIds] = useState<string[]>([])

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '' as Fee['type'],
    amount: 0,
    currency: 'EUR',
    category: 'all' as Fee['category'],
    is_active: true,
    is_mandatory: false,
    due_date: '',
    // Nuovi campi per modalità di pagamento
    payment_mode: 'single' as 'single' | 'installments',
    installment_count: 1,
    installment_frequency: 'monthly' as 'monthly' | 'weekly',
    installment_start_date: '',
    // Configurazione manuale delle rate
    installments: [] as Array<{ amount: number; due_date: string; notes?: string }>
  })

  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all'])

  const [assignmentFilters, setAssignmentFilters] = useState({
    search: '',
    category: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: ''
  })
  const [assignmentViewTab, setAssignmentViewTab] = useState<'all' | 'expiring' | 'overdue' | 'paid'>('all')
  const [filteredAssignments, setFilteredAssignments] = useState<FeeAssignment[]>([])
  const [feeViewMode, setFeeViewMode] = useState<'cards' | 'table'>('table')
  
  // Stati per i filtri delle quote
  const [feeFilters, setFeeFilters] = useState({
    search: '',
    type: 'all',
    category: 'all',
    status: 'all',
    amountMin: '',
    amountMax: ''
  })
  const [filteredFees, setFilteredFees] = useState<Fee[]>([])
  
  const [assignmentStatusSummary, setAssignmentStatusSummary] = useState({
    total: 0,
    pending: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
    totalAmount: 0,
    pendingAmount: 0,
    paidAmount: 0,
    overdueAmount: 0,
    cancelledAmount: 0
  })

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showInstallmentPaymentModal, setShowInstallmentPaymentModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<FeeAssignment | null>(null)
  const [selectedInstallments, setSelectedInstallments] = useState<Record<string, boolean>>({})
  const [paymentInstallments, setPaymentInstallments] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({})
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({})
  const [initialPaymentStatus, setInitialPaymentStatus] = useState<Record<string, boolean>>({})
  const [expandedAssignments, setExpandedAssignments] = useState<Record<string, boolean>>({})
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: 'cash' as 'cash' | 'bank_transfer' | 'card' | 'other',
    payment_date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: ''
  })
  const [assignmentPayments, setAssignmentPayments] = useState<Record<string, any[]>>({})
  const [showEditAssignmentModal, setShowEditAssignmentModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<FeeAssignment | null>(null)
  const [editAssignmentData, setEditAssignmentData] = useState({
    due_date: '',
    notes: ''
  })
  const [reportData, setReportData] = useState({
    totalRevenue: 0,
    totalPending: 0,
    totalOverdue: 0,
    totalAssignedFees: 0,
    monthlyRevenue: [] as { month: string; amount: number }[],
    categoryStats: [] as { category: string; total: number; paid: number; pending: number; overdue: number; totalFees: number; paidFees: number }[],
    recentPayments: [] as any[],
    upcomingDueDates: [] as any[],
    topPayers: [] as { name: string; totalPaid: number; onTimeRate: number }[],
    paymentMethods: [] as { method: string; count: number; amount: number }[],
    assignments: [] as FeeAssignment[]
  })
  // La stagione sportiva inizia sempre il 1° luglio: se siamo gen-giu è l'anno scorso, se lug-dic è quest'anno
  const getSeasonStartDate = () => {
    const now = new Date()
    const year = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear()
    return `${year}-07-01`
  }

  const todayStr = () => new Date().toISOString().split('T')[0]

  // Data Fine non può andare oltre il 30/06: se va oltre diventa oggi e Data Inizio diventa 01/07
  const handleReportDateToChange = (dateTo: string) => {
    if (!dateTo) {
      setReportFilters(prev => ({ ...prev, dateTo }))
      return
    }
    const [, m] = dateTo.split('-').map(Number)
    // Se mese >= 7 (luglio), la data va oltre il 30/06 → correggi
    if (m >= 7) {
      const year = parseInt(dateTo.slice(0, 4), 10)
      setReportFilters(prev => ({
        ...prev,
        dateTo: todayStr(),
        dateFrom: `${year}-07-01`
      }))
    } else {
      setReportFilters(prev => ({ ...prev, dateTo }))
    }
  }

  // Quando cambia Data Inizio, se Data Fine va oltre il 30/06 della stagione → correggi
  const handleReportDateFromChange = (dateFrom: string) => {
    setReportFilters(prev => {
      const yearFrom = parseInt(dateFrom.slice(0, 4), 10)
      const maxDateTo = `${yearFrom + 1}-06-30`
      const dateTo = prev.dateTo > maxDateTo ? todayStr() : prev.dateTo
      return { ...prev, dateFrom, dateTo }
    })
  }

  const [reportFilters, setReportFilters] = useState({
    dateFrom: getSeasonStartDate(),
    dateTo: todayStr(),
    category: 'all'
  })

  const feeTypes = [
    { value: '', label: '----', icon: '❓' },
    { value: 'membership', label: 'Quota di Iscrizione', icon: '🎫' },
    { value: 'trip', label: 'Gite/Trasferte', icon: '🚌' },
    { value: 'course', label: 'Corsi/Formazione', icon: '📚' },
    { value: 'event', label: 'Eventi/Tornei', icon: '🏆' },
    { value: 'equipment', label: 'Attrezzature/Divise', icon: '👕' },
    { value: 'insurance', label: 'Assicurazioni', icon: '🛡️' },
    { value: 'other', label: 'Altro', icon: '💰' }
  ]

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  }

  // Load categories from database
  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, code')
        .order('name')

      if (error) throw error
      setAllCategoriesData(data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  // Load fees from database
  const loadFees = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('fees')
        .select('*')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setFees(data || [])
    } catch (error) {
      console.error('Error loading fees:', error)
      setMessage('Errore nel caricamento delle quote')
    } finally {
      setLoading(false)
    }
  }

  // Funzione per filtrare le quote
  const filterFees = () => {
    let filtered = [...fees]

    // Filtro per ricerca testuale (nome o descrizione)
    if (feeFilters.search) {
      const searchLower = feeFilters.search.toLowerCase()
      filtered = filtered.filter(fee => 
        fee.name?.toLowerCase().includes(searchLower) ||
        (fee.description ?? '').toLowerCase().includes(searchLower)
      )
    }

    // Filtro per tipo
    if (feeFilters.type !== 'all') {
      filtered = filtered.filter(fee => fee.type === feeFilters.type)
    }

    // Filtro per categoria: badge in colonna Categoria oppure testo nel nome
    if (feeFilters.category !== 'all') {
      const categoryLabel = categories.find(c => c.value === feeFilters.category)?.label
      filtered = filtered.filter(fee =>
        feeMatchesCategoryFilter(fee, feeFilters.category, categoryLabel, {
          categoryOptions: categories
        })
      )
    }

    // Filtro per stato (attivo/inattivo)
    if (feeFilters.status !== 'all') {
      const isActive = feeFilters.status === 'active'
      filtered = filtered.filter(fee => fee.is_active === isActive)
    }

    // Filtro per importo minimo
    if (feeFilters.amountMin) {
      const minAmount = parseFloat(feeFilters.amountMin) * 100 // Converti in centesimi
      filtered = filtered.filter(fee => fee.amount >= minAmount)
    }

    // Filtro per importo massimo
    if (feeFilters.amountMax) {
      const maxAmount = parseFloat(feeFilters.amountMax) * 100 // Converti in centesimi
      filtered = filtered.filter(fee => fee.amount <= maxAmount)
    }

    setFilteredFees(filtered)
  }

  // Effetto per applicare i filtri quando cambiano
  useEffect(() => {
    filterFees()
  }, [fees, feeFilters, categories])

  // Load assignments from database
  const loadAssignments = async () => {
    try {
      // Assicuriamoci che le categorie siano caricate prima di elaborare le assegnazioni
      let categoriesData = allCategoriesData
      if (categoriesData.length === 0) {
        const { data: cats, error: catsError } = await supabase
          .from('categories')
          .select('id, name, code')
          .order('name')
        
        if (!catsError && cats) {
          categoriesData = cats
          setAllCategoriesData(cats)
        }
      }
      setLoading(true)
      
      // Load assignments with paid amounts using a custom query
      const { data, error } = await supabase
        .rpc('get_assignments_with_payments')

      if (error) {
        // Fallback to manual query if RPC doesn't exist
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('fee_assignments')
          .select(`
            *,
            fees (
              name,
              category,
              amount,
              due_date,
              installments,
              payment_mode
            ),
            people (
              given_name,
              family_name,
              player_categories!inner (
                category_id,
                categories!inner (
                  id,
                  name,
                  code
                )
              )
            )
          `)
          .order('created_at', { ascending: false })

        if (assignmentsError) throw assignmentsError

        // Load payments separately
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('assignment_id, amount')

        if (paymentsError) throw paymentsError

        // Calculate paid amounts
        const paidAmounts = paymentsData?.reduce((acc, payment) => {
          if (!acc[payment.assignment_id]) {
            acc[payment.assignment_id] = 0
          }
          acc[payment.assignment_id] += payment.amount
          return acc
        }, {} as Record<string, number>) || {}

        // Merge assignments with paid amounts
        const assignmentsWithPayments = assignmentsData?.map(assignment => ({
          ...assignment,
          paid_amount: paidAmounts[assignment.id] || 0
        })) || []

        // Update overdue assignments
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const updatedAssignments = assignmentsWithPayments.map(assignment => {
          // Only check for overdue if status is pending and not already paid
          if (assignment.status === 'pending' && assignment.due_date) {
            const dueDate = new Date(assignment.due_date)
            if (dueDate < today) {
              return { ...assignment, status: 'overdue' as const }
            }
          }
          // If status is overdue but due date is in the future, change back to pending
          if (assignment.status === 'overdue' && assignment.due_date) {
            const dueDate = new Date(assignment.due_date)
            if (dueDate >= today) {
              return { ...assignment, status: 'pending' as const }
            }
          }
          return assignment
        })
        
        setAssignments(updatedAssignments)
        setFilteredAssignments(updatedAssignments)
        const ids = (updatedAssignments as FeeAssignment[]).map((a: FeeAssignment) => a.id)
        if (ids.length > 0) {
          const { data: receipts } = await supabase.from('payment_receipts').select('fee_assignment_id, pdf_url').in('fee_assignment_id', ids)
          const map = (receipts || []).reduce((acc: Record<string, string>, r: { fee_assignment_id: string; pdf_url: string }) => { acc[r.fee_assignment_id] = r.pdf_url; return acc }, {})
          setAssignmentReceiptsMap(map)
        } else setAssignmentReceiptsMap({})
      } else {
        // Use RPC result
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const updatedAssignments = data?.map(assignment => {
          // Only check for overdue if status is pending and not already paid
          if (assignment.status === 'pending' && assignment.due_date) {
            const dueDate = new Date(assignment.due_date)
            if (dueDate < today) {
              return { ...assignment, status: 'overdue' as const }
            }
          }
          // If status is overdue but due date is in the future, change back to pending
          if (assignment.status === 'overdue' && assignment.due_date) {
            const dueDate = new Date(assignment.due_date)
            if (dueDate >= today) {
              return { ...assignment, status: 'pending' as const }
            }
          }
          return assignment
        }) || []
        
        setAssignments(updatedAssignments)
        setFilteredAssignments(updatedAssignments)
        const ids = (updatedAssignments as FeeAssignment[]).map((a: FeeAssignment) => a.id)
        if (ids.length > 0) {
          const { data: receipts } = await supabase.from('payment_receipts').select('fee_assignment_id, pdf_url').in('fee_assignment_id', ids)
          const map = (receipts || []).reduce((acc: Record<string, string>, r: { fee_assignment_id: string; pdf_url: string }) => { acc[r.fee_assignment_id] = r.pdf_url; return acc }, {})
          setAssignmentReceiptsMap(map)
        } else setAssignmentReceiptsMap({})
        // Reload payments for the single expanded assignment
        const expandedId = Object.keys(expandedAssignments).find(id => expandedAssignments[id])
        if (expandedId) {
          loadAssignmentPayments(expandedId)
        }
      }
    } catch (error) {
      console.error('Error loading assignments:', error)
      setMessage('Errore nel caricamento delle assegnazioni')
    } finally {
      setLoading(false)
    }
  }

  // Filter assignments based on filters
  const filterAssignments = () => {
    let filtered = assignments

    // Applica filtro basato sul tab selezionato
    if (assignmentViewTab !== 'all') {
      // Raggruppa per fee_id e person_id
      const groupedAssignments = filtered.reduce((groups, assignment) => {
        const key = `${assignment.fee_id}-${assignment.person_id}`
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(assignment)
        return groups
      }, {} as Record<string, typeof filtered>)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

      filtered = []
      Object.values(groupedAssignments).forEach(assignmentGroup => {
        let shouldInclude = false

        if (assignmentViewTab === 'paid') {
          // Almeno una rata pagata: così le rate pagate (es. 2/3 di Gabriele) compaiono in Pagate
          // La stessa quota può apparire anche in Scadute se ha rate scadute
          shouldInclude = assignmentGroup.some(a => a.status === 'paid')
        } else if (assignmentViewTab === 'overdue') {
          // Almeno una rata scaduta
          shouldInclude = assignmentGroup.some(a => {
            if (a.status === 'overdue') return true
            if (a.status !== 'paid' && a.due_date) {
              const dueDate = new Date(a.due_date)
              return dueDate < today
            }
            return false
          })
        } else if (assignmentViewTab === 'expiring') {
          // Almeno una rata in scadenza nei prossimi 7 giorni (non pagata)
          shouldInclude = assignmentGroup.some(a => {
            if (a.status !== 'paid' && a.due_date) {
              const dueDate = new Date(a.due_date)
              return dueDate >= today && dueDate <= oneWeekFromNow
            }
            return false
          })
        }

        if (shouldInclude) {
          filtered.push(...assignmentGroup)
        }
      })
    }

    if (assignmentFilters.search) {
      filtered = filtered.filter(assignment => {
        const person = assignment.people as any
        const fullName = `${person?.given_name || ''} ${person?.family_name || ''}`.toLowerCase()
        return fullName.includes(assignmentFilters.search.toLowerCase())
      })
    }

    if (assignmentFilters.category !== 'all') {
      filtered = filtered.filter(assignment => {
        const person = assignment.people as any
        return personMatchesCategoryFilter(person, assignmentFilters.category, {
          categoryOptions: categories,
          dbCategories: allCategoriesData
        })
      })
    }

    if (assignmentFilters.status !== 'all') {
      filtered = filtered.filter(assignment => assignment.status === assignmentFilters.status)
    }

    if (assignmentFilters.dateFrom) {
      filtered = filtered.filter(assignment => {
        const fee = assignment.fees as any
        return fee?.due_date && new Date(fee.due_date) >= new Date(assignmentFilters.dateFrom)
      })
    }

    if (assignmentFilters.dateTo) {
      filtered = filtered.filter(assignment => {
        const fee = assignment.fees as any
        return fee?.due_date && new Date(fee.due_date) <= new Date(assignmentFilters.dateTo)
      })
    }

    setFilteredAssignments(filtered)
  }

  // Calculate assignment status summary
  const calculateStatusSummary = (assignments: FeeAssignment[]) => {
    const summary = {
      total: 0,
      pending: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0,
      totalAmount: 0,
      pendingAmount: 0,
      paidAmount: 0,
      overdueAmount: 0,
      cancelledAmount: 0
    }

    // Raggruppa le assegnazioni per fee_id e person_id
    const groupedAssignments = assignments.reduce((groups, assignment) => {
      const key = `${assignment.fee_id}-${assignment.person_id}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(assignment)
      return groups
    }, {} as Record<string, FeeAssignment[]>)

    // Calcola i totali per ogni gruppo
    Object.values(groupedAssignments).forEach(assignmentGroup => {
      const assignment = assignmentGroup[0] // Usa la prima assegnazione come riferimento
      const fee = assignment.fees as any
      
      // Calcola l'importo totale della quota
      let totalFeeAmount = 0
      if (fee.installments && fee.installments.length > 0) {
        // Se ha rate configurate, usa la somma delle rate
        totalFeeAmount = fee.installments.reduce((sum: number, installment: any) => sum + installment.amount, 0)
      } else {
        // Altrimenti usa l'importo dell'assegnazione
        totalFeeAmount = assignment.amount / 100
      }
      
      summary.total++
      summary.totalAmount += totalFeeAmount
      
      // Determina lo status del gruppo basandosi sulle rate
      let groupStatus: 'pending' | 'paid' | 'overdue' | 'cancelled' = 'pending'
      if (assignmentGroup.every(a => a.status === 'paid')) {
        groupStatus = 'paid'
      } else if (assignmentGroup.some(a => a.status === 'overdue')) {
        groupStatus = 'overdue'
      } else if (assignmentGroup.some(a => a.status === 'cancelled')) {
        groupStatus = 'cancelled'
      }
      
      // Calcola gli importi pagati e residui
      const paidAmount = assignmentGroup
        .filter((a: any) => a.status === 'paid')
        .reduce((sum: number, a: any) => {
          if (fee.installments && fee.installments.length > 0) {
            const installmentNumber = a.installment_number || 1
            const configuredInstallment = fee.installments[installmentNumber - 1]
            if (configuredInstallment) {
              return sum + configuredInstallment.amount
            }
          }
          return sum + (a.amount / 100)
        }, 0)
      
      const remainingAmount = totalFeeAmount - paidAmount
      
      const summaryToday = new Date()
      summaryToday.setHours(0, 0, 0, 0)
      // A SCADERE: rate non pagate con due_date >= oggi
      const pendingAmount = assignmentGroup
        .filter((a: any) => {
          if (a.status === 'paid') return false
          if (!a.due_date) return true
          return new Date(a.due_date) >= summaryToday
        })
        .reduce((sum: number, a: any) => {
          if (fee.installments && fee.installments.length > 0) {
            const installmentNumber = a.installment_number || 1
            const configuredInstallment = fee.installments[installmentNumber - 1]
            if (configuredInstallment) {
              return sum + configuredInstallment.amount
            }
          }
          return sum + (a.amount / 100)
        }, 0)
      // SCADUTI: rate non pagate con due_date < oggi
      const overdueAmount = assignmentGroup
        .filter((a: any) => {
          if (a.status === 'paid') return false
          if (!a.due_date) return false
          return new Date(a.due_date) < summaryToday
        })
        .reduce((sum: number, a: any) => {
          if (fee.installments && fee.installments.length > 0) {
            const installmentNumber = a.installment_number || 1
            const configuredInstallment = fee.installments[installmentNumber - 1]
            if (configuredInstallment) {
              return sum + configuredInstallment.amount
            }
          }
          return sum + (a.amount / 100)
        }, 0)
      
      // Aggiungi sempre l'importo pagato al totale delle pagate (incasso del club)
      summary.paidAmount += paidAmount
      
      // Conta le rate pagate per la card "PAGATE"
      const paidInstallmentsCount = assignmentGroup.filter(a => a.status === 'paid').length
      summary.paid += paidInstallmentsCount
      
      switch (groupStatus) {
        case 'pending':
          summary.pending++
          summary.pendingAmount += pendingAmount
          break
        case 'paid':
          break
        case 'overdue':
          summary.overdue++
          summary.overdueAmount += overdueAmount
          break
        case 'cancelled':
          summary.cancelled++
          summary.cancelledAmount += remainingAmount
          break
      }
    })

    return summary
  }

  // Toggle accordion for assignment - only one open at a time
  const toggleAssignmentAccordion = async (assignmentId: string) => {
    // Se l'accordion è già aperto, chiudilo
    if (expandedAssignments[assignmentId]) {
      setExpandedAssignments({})
    } else {
      // Altrimenti, chiudi tutti gli altri e apri solo questo
      setExpandedAssignments({ [assignmentId]: true })
      // Load payments for this assignment if not already loaded
      if (!assignmentPayments[assignmentId]) {
        await loadAssignmentPayments(assignmentId)
      }
    }
  }

  // Load payments for a specific assignment
  const loadAssignmentPayments = async (assignmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('payment_date', { ascending: false })

      if (error) throw error
      
      // Replace existing payments to avoid duplication
      setAssignmentPayments(prev => ({
        ...prev,
        [assignmentId]: data || []
      }))
    } catch (error) {
      console.error('Error loading assignment payments:', error)
    }
  }

  // Void a payment
  const handleVoidPayment = async (paymentId: string, assignmentId: string) => {
    if (!window.confirm('Sei sicuro di voler annullare questo pagamento? Questa azione non può essere annullata.')) {
      return
    }

    try {
      setLoading(true)
      await voidPayment(paymentId)
      setMessage('Pagamento annullato con successo!')
      
      // Reload assignments and payments
      await loadAssignments()
      await loadAssignmentPayments(assignmentId)
    } catch (error) {
      console.error('Error voiding payment:', error)
      setMessage('Errore nell\'annullamento del pagamento')
      toast.error('Errore nell\'annullamento del pagamento')
    } finally {
      setLoading(false)
    }
  }

  // Open edit assignment modal
  const handleOpenEditAssignment = (assignment: FeeAssignment) => {
    setEditingAssignment(assignment)
    setEditAssignmentData({
      due_date: assignment.due_date ? new Date(assignment.due_date).toISOString().split('T')[0] : '',
      notes: assignment.notes || ''
    })
    setShowEditAssignmentModal(true)
  }

  // Handle edit assignment input changes
  const handleEditAssignmentInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditAssignmentData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Update assignment
  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAssignment) return

    try {
      setLoading(true)
      
      const updateData: any = {
        due_date: editAssignmentData.due_date || null,
        notes: editAssignmentData.notes || null
      }

      const { error } = await supabase
        .from('fee_assignments')
        .update(updateData)
        .eq('id', editingAssignment.id)

      if (error) throw error

      setMessage('Assegnazione aggiornata con successo!')
      setShowEditAssignmentModal(false)
      setEditingAssignment(null)
      setEditAssignmentData({
        due_date: '',
        notes: ''
      })
      
      // Reload assignments
      loadAssignments()
      
      // Reload payments for the single expanded assignment
      const expandedId = Object.keys(expandedAssignments).find(id => expandedAssignments[id])
      if (expandedId) {
        loadAssignmentPayments(expandedId)
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
      setMessage('Errore nell\'aggiornamento dell\'assegnazione')
    } finally {
      setLoading(false)
    }
  }

  // Generate comprehensive reports
  const generateReports = async () => {
    try {
      // Assicuriamoci che le categorie siano caricate prima di elaborare le assegnazioni
      let categoriesData = allCategoriesData
      if (categoriesData.length === 0) {
        console.log('🔄 DEBUG: Loading categories before processing reports')
        const { data: cats, error: catsError } = await supabase
          .from('categories')
          .select('id, name, code')
          .order('name')
        
        if (!catsError && cats) {
          categoriesData = cats
          setAllCategoriesData(cats)
          console.log('✅ DEBUG: Categories loaded for reports:', cats)
        }
      }
      
      setLoading(true)
      
      // Get all assignments with payments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('fee_assignments')
        .select(`
          *,
          fees (
            name,
            category,
            amount,
            due_date
          ),
          people (
            given_name,
            family_name,
            player_categories
          )
        `)

      if (assignmentsError) throw assignmentsError

      // Get all payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .gte('payment_date', reportFilters.dateFrom)
        .lte('payment_date', reportFilters.dateTo)

      if (paymentsError) throw paymentsError

      let assignments = assignmentsData || []
      let payments = paymentsData || []

      // Applica filtro categoria se non è "all"
      if (reportFilters.category !== 'all') {
        const categoryLabel = categories.find(c => c.value === reportFilters.category)?.label
        assignments = assignments.filter(a => {
          const fee = a.fees as Fee | undefined
          return fee && feeMatchesCategoryFilter(fee, reportFilters.category, categoryLabel, {
            categoryOptions: categories
          })
        })
        
        // Filtra pagamenti per assegnazioni filtrate
        const filteredAssignmentIds = assignments.map(a => a.id)
        payments = payments.filter(p => filteredAssignmentIds.includes(p.assignment_id))
      }

      // Raggruppa le assegnazioni per fee_id e person_id per calcoli corretti
      const groupedAssignments = assignments.reduce((groups, assignment) => {
        const key = `${assignment.fee_id}-${assignment.person_id}`
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(assignment)
        return groups
      }, {} as Record<string, typeof assignments>)

      // Calculate total revenue from paid installments
      const totalRevenue = assignments
        .filter(a => a.status === 'paid')
        .reduce((sum, a) => {
          const fee = a.fees as any
          if (fee.installments && fee.installments.length > 0) {
            const installmentNumber = a.installment_number || 1
            const configuredInstallment = fee.installments[installmentNumber - 1]
            if (configuredInstallment) {
              return sum + configuredInstallment.amount
            }
          }
          // amount è in centesimi, dividere per 100 per ottenere euro
          return sum + (a.amount / 100)
        }, 0)

      // Calcola oggi per separare "in scadenza" da "scaduti"
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // A SCADERE: solo rate non pagate con due_date >= oggi (non ancora scadute)
      const totalPending = assignments
        .filter(a => {
          if (a.status === 'paid') return false
          if (!a.due_date) return true
          const dueDate = new Date(a.due_date)
          return dueDate >= today
        })
        .reduce((sum, a) => {
          const fee = a.fees as any
          if (fee.installments && fee.installments.length > 0) {
            const installmentNumber = a.installment_number || 1
            const configuredInstallment = fee.installments[installmentNumber - 1]
            if (configuredInstallment) {
              return sum + configuredInstallment.amount
            }
          }
          return sum + (a.amount / 100)
        }, 0)

      // SCADUTI: solo rate non pagate con due_date < oggi (già scadute)
      const totalOverdue = assignments
        .filter(a => {
          if (a.status === 'paid') return false
          if (!a.due_date) return false
          const dueDate = new Date(a.due_date)
          return dueDate < today
        })
        .reduce((sum, a) => {
          const fee = a.fees as any
          if (fee.installments && fee.installments.length > 0) {
            const installmentNumber = a.installment_number || 1
            const configuredInstallment = fee.installments[installmentNumber - 1]
            if (configuredInstallment) {
              return sum + configuredInstallment.amount
            }
          }
          // amount è in centesimi, dividere per 100 per ottenere euro
          return sum + (a.amount / 100)
        }, 0)

      // Monthly revenue - calcola dagli incassi delle rate pagate
      const monthlyRevenue = assignments
        .filter(a => a.status === 'paid' && a.paid_at)
        .reduce((acc, assignment) => {
          const month = new Date(assignment.paid_at!).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })
        const existing = acc.find(item => item.month === month)
          const amount = assignment.amount / 100 // amount è in centesimi, converti in euro
        if (existing) {
            existing.amount += amount
        } else {
            acc.push({ month, amount })
        }
        return acc
      }, [] as { month: string; amount: number }[])
        .sort((a, b) => {
          // Ordina per data (più recente prima)
          const dateA = new Date(a.month.split(' ')[1] + '-' + (['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'].indexOf(a.month.split(' ')[0]) + 1).toString().padStart(2, '0'))
          const dateB = new Date(b.month.split(' ')[1] + '-' + (['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'].indexOf(b.month.split(' ')[0]) + 1).toString().padStart(2, '0'))
          return dateB.getTime() - dateA.getTime()
        })

      // Category statistics - raggruppa per categoria della persona
      const categoryMap = new Map<string, typeof assignments>()
      
      assignments.forEach((assignment, index) => {
        const person = assignment.people as any
        
        // Prima prova: usa direttamente playerCategories se disponibili
        if (person && person.player_categories && Array.isArray(person.player_categories)) {
          if (person.player_categories.length > 0 && typeof person.player_categories[0] === 'object') {
            person.player_categories.forEach((pc: any) => {
              const categoryData = pc.categories
              if (categoryData) {
                const categoryName = categoryData.name
                if (!categoryMap.has(categoryName)) categoryMap.set(categoryName, [])
                categoryMap.get(categoryName)!.push(assignment)
              }
            })
            return
          }
          if (person.player_categories.length > 0 && typeof person.player_categories[0] === 'string') {
            const categoryId = person.player_categories[0]
            const categoryData = categoriesData.find(c => c.id === categoryId)
            if (categoryData) {
              const categoryName = categoryData.name
              if (!categoryMap.has(categoryName)) categoryMap.set(categoryName, [])
              categoryMap.get(categoryName)!.push(assignment)
            }
            return
          }
        }
        if (person && person.players && Array.isArray(person.players)) {
          person.players.forEach((player: any) => {
            if (player.player_categories && Array.isArray(player.player_categories)) {
              player.player_categories.forEach((pc: any) => {
                const categoryData = pc.categories
                if (categoryData) {
                  const categoryName = categoryData.name
                  if (!categoryMap.has(categoryName)) categoryMap.set(categoryName, [])
                  categoryMap.get(categoryName)!.push(assignment)
                }
              })
            }
          })
          return
        }
        const fee = assignment.fees as any
        if (fee && fee.category && fee.category !== 'all') {
          const categoryName = fee.category
          if (!categoryMap.has(categoryName)) categoryMap.set(categoryName, [])
          categoryMap.get(categoryName)!.push(assignment)
        }
      })
      
      const categoryStats = Array.from(categoryMap.entries()).map(([categoryName, categoryAssignments]) => {
        
        // USA LA STESSA LOGICA DI "TUTTI" ma filtrando per categoria
        
        // Calculate total revenue from paid installments (STESSA LOGICA DI totalRevenue)
        const categoryRevenue = categoryAssignments
          .filter(a => a.status === 'paid')
          .reduce((sum, a) => {
            const fee = a.fees as any
            if (fee.installments && fee.installments.length > 0) {
              const installmentNumber = a.installment_number || 1
              const configuredInstallment = fee.installments[installmentNumber - 1]
              if (configuredInstallment) {
                return sum + configuredInstallment.amount
              }
            }
            // amount è in centesimi, dividere per 100 per ottenere euro
            return sum + (a.amount / 100)
          }, 0)

        // A SCADERE: solo rate non pagate con due_date >= oggi
        const categoryToday = new Date()
        categoryToday.setHours(0, 0, 0, 0)
        const categoryPending = categoryAssignments
          .filter(a => {
            if (a.status === 'paid') return false
            if (!a.due_date) return true
            const dueDate = new Date(a.due_date)
            return dueDate >= categoryToday
          })
          .reduce((sum, a) => {
            const fee = a.fees as any
            if (fee.installments && fee.installments.length > 0) {
              const installmentNumber = a.installment_number || 1
              const configuredInstallment = fee.installments[installmentNumber - 1]
              if (configuredInstallment) {
                return sum + configuredInstallment.amount
              }
            }
            return sum + (a.amount / 100)
          }, 0)

        // SCADUTI: solo rate non pagate con due_date < oggi
        const categoryOverdue = categoryAssignments
          .filter(a => {
            if (a.status === 'paid') return false
            if (!a.due_date) return false
            const dueDate = new Date(a.due_date)
            return dueDate < categoryToday
          })
          .reduce((sum, a) => {
            const fee = a.fees as any
            if (fee.installments && fee.installments.length > 0) {
              const installmentNumber = a.installment_number || 1
              const configuredInstallment = fee.installments[installmentNumber - 1]
              if (configuredInstallment) {
                return sum + configuredInstallment.amount
              }
            }
            // amount è in centesimi, dividere per 100 per ottenere euro
            return sum + (a.amount / 100)
          }, 0)

        // Calcola il totale (pagato + in scadenza + scaduti)
        const categoryTotal = categoryRevenue + categoryPending + categoryOverdue

        // Conta le quote (raggruppa per fee_id e person_id)
        const groupedCategoryAssignments = categoryAssignments.reduce((groups, assignment) => {
          const key = `${assignment.fee_id}-${assignment.person_id}`
          if (!groups[key]) {
            groups[key] = []
          }
          groups[key].push(assignment)
          return groups
        }, {} as Record<string, typeof categoryAssignments>)

        const totalFees = Object.keys(groupedCategoryAssignments).length
        const paidFees = Object.values(groupedCategoryAssignments).filter((assignmentGroup: any[]) => 
          assignmentGroup.every((a: any) => a.status === 'paid')
        ).length

        return {
          category: categoryName,
          total: categoryTotal,
          paid: categoryRevenue,
          pending: categoryPending,
          overdue: categoryOverdue,
          totalFees,
          paidFees
        }
      }).filter(stat => stat.total > 0) // Mostra solo categorie con assegnazioni effettive

      // Aggiungi riga "Tutti" con i totali generali
      const totalFeesCount = categoryStats.reduce((sum, stat) => sum + stat.totalFees, 0)
      const totalPaidFeesCount = categoryStats.reduce((sum, stat) => sum + stat.paidFees, 0)
      
      const totalStats = {
        category: 'Tutti',
        total: totalRevenue + totalPending + totalOverdue,
        paid: totalRevenue,
        pending: totalPending,
        overdue: totalOverdue,
        totalFees: totalFeesCount,
        paidFees: totalPaidFeesCount
      }
      
      // Aggiungi la riga "Tutti" all'inizio
      categoryStats.unshift(totalStats)

      // Recent payments
      const recentPayments = payments
        .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
        .slice(0, 10)
        .map(payment => {
          const assignment = assignments.find(a => a.id === payment.assignment_id)
          const person = assignment?.people as any
          return {
            ...payment,
            personName: person ? `${person.given_name} ${person.family_name}` : 'N/A',
            feeName: (assignment?.fees as any)?.name || 'N/A'
          }
        })

      // Upcoming due dates (next 30 days)
      const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      const upcomingDueDates = assignments
        .filter(a => {
          if (!a.due_date) return false
          const dueDate = new Date(a.due_date)
          return dueDate >= today && dueDate <= next30Days && a.status !== 'paid'
        })
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 10)
        .map(assignment => {
          const person = assignment.people as any
          const fee = assignment.fees as any
          return {
            ...assignment,
            personName: person ? `${person.given_name} ${person.family_name}` : 'N/A',
            feeName: fee?.name || 'N/A'
          }
        })

      // Top payers
      const payerStats = assignments.reduce((acc, assignment) => {
        const person = assignment.people as any
        const personName = person ? `${person.given_name} ${person.family_name}` : 'N/A'
        
        if (!acc[personName]) {
          acc[personName] = { totalPaid: 0, totalAssigned: 0, onTimeCount: 0, totalCount: 0 }
        }
        
        acc[personName].totalAssigned += assignment.amount
        if (assignment.status === 'paid') {
          acc[personName].totalPaid += assignment.amount
          acc[personName].onTimeCount += 1
        }
        acc[personName].totalCount += 1
        
        return acc
      }, {} as Record<string, { totalPaid: number; totalAssigned: number; onTimeCount: number; totalCount: number }>)

      const topPayers = Object.entries(payerStats)
        .map(([name, stats]: [string, { totalPaid: number; totalAssigned: number; onTimeCount: number; totalCount: number }]) => ({
          name,
          totalPaid: stats.totalPaid,
          onTimeRate: stats.totalCount > 0 ? (stats.onTimeCount / stats.totalCount) * 100 : 0
        }))
        .sort((a, b) => b.totalPaid - a.totalPaid)
        .slice(0, 10)

      // Payment methods - calcola dai metodi di pagamento delle rate pagate
      const paymentMethods = assignments
        .filter(a => a.status === 'paid' && a.payment_method)
        .reduce((acc, assignment) => {
          const method = assignment.payment_method!
          const amount = assignment.amount / 100 // amount è in centesimi, converti in euro
          const existing = acc.find(m => m.method === method)
        if (existing) {
          existing.count += 1
            existing.amount += amount
        } else {
            acc.push({ method, count: 1, amount })
        }
        return acc
      }, [] as { method: string; count: number; amount: number }[])
        .sort((a, b) => b.amount - a.amount) // Ordina per importo decrescente

      // Calcola l'importo totale di tutte le quote assegnate
      // È la somma di tutto ciò che è stato incassato + ciò che è ancora da incassare
      const totalAssignedFees = totalRevenue + totalPending

      setReportData({
        totalRevenue,
        totalPending,
        totalOverdue,
        totalAssignedFees,
        monthlyRevenue,
        categoryStats,
        recentPayments,
        upcomingDueDates,
        topPayers,
        paymentMethods,
        assignments
      })

    } catch (error) {
      console.error('Error generating reports:', error)
      setMessage('Errore nella generazione dei report')
    } finally {
      setLoading(false)
    }
  }

  // Apply filters when they change
  useEffect(() => {
    filterAssignments()
  }, [assignmentFilters, assignments, assignmentViewTab, categories, allCategoriesData])

  // Update status summary when assignments change
  useEffect(() => {
    setAssignmentStatusSummary(calculateStatusSummary(assignments))
  }, [assignments])

  // Generate reports when component loads
  useEffect(() => {
    if (activeTab === 'reports') {
      generateReports()
    }
  }, [activeTab, reportFilters])

  // Check for overdue assignments every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const updatedAssignments = assignments.map(assignment => {
        // Only check for overdue if status is pending and not already paid
        if (assignment.status === 'pending' && assignment.due_date) {
          const dueDate = new Date(assignment.due_date)
          if (dueDate < today) {
            return { ...assignment, status: 'overdue' as const }
          }
        }
        // If status is overdue but due date is in the future, change back to pending
        if (assignment.status === 'overdue' && assignment.due_date) {
          const dueDate = new Date(assignment.due_date)
          if (dueDate >= today) {
            return { ...assignment, status: 'pending' as const }
          }
        }
        return assignment
      })
      
      // Only update if there are changes
      const hasChanges = updatedAssignments.some((assignment, index) => 
        assignment.status !== assignments[index]?.status
      )
      
      if (hasChanges) {
        setAssignments(updatedAssignments)
        setFilteredAssignments(updatedAssignments)
      }
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [assignments])

  // Load data on component mount
  useEffect(() => {
    loadCategories()
    loadFees()
    loadAssignments()
    
    // Controlla se c'è un hash nell'URL per impostare il tab corretto
    const hash = window.location.hash.replace('#', '')
    if (hash === 'assignments') {
      setActiveTab('assignments')
    }
  }, [])

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : 
              type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              value
    }))

    // Gestione speciale per payment_mode
    if (name === 'payment_mode') {
      if (value === 'single') {
        // Quando si seleziona "Pagamento Unico", imposta sempre le 2 rate di default
        setDefaultSinglePaymentInstallments()
      } else if (value === 'installments') {
        // Quando si seleziona "Rate", mantieni le rate esistenti o svuota se non ce ne sono
        if (formData.installments.length === 0) {
          setFormData(prev => ({
            ...prev,
            installments: []
          }))
        }
        // Se ci sono già rate configurate, le mantiene
      }
    }
  }

  // Handle category selection
  const handleCategoryChange = (category: string) => {
    if (category === 'all') {
      setSelectedCategories(['all'])
    } else {
      setSelectedCategories(prev => {
        const newCategories = prev.filter(c => c !== 'all')
        if (newCategories.includes(category)) {
          return newCategories.filter(c => c !== category)
        } else {
          return [...newCategories, category]
        }
      })
    }
  }

  // Gestione rate manuali
  const addInstallment = () => {
    setFormData(prev => ({
      ...prev,
      installments: [...prev.installments, { amount: 0, due_date: '', notes: '' }]
    }))
  }

  const removeInstallment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      installments: prev.installments.filter((_, i) => i !== index)
    }))
  }

  const updateInstallment = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      installments: prev.installments.map((installment, i) => 
        i === index ? { ...installment, [field]: value } : installment
      )
    }))
  }

  const calculateTotalInstallments = () => {
    return formData.installments.reduce((total, installment) => total + installment.amount, 0)
  }

  // Imposta le 2 rate di default per pagamento unico
  const setDefaultSinglePaymentInstallments = () => {
    const currentYear = new Date().getFullYear()
    const defaultInstallments = [
      { amount: 50, due_date: `${currentYear}-07-07`, notes: 'Acconto' },
      { amount: 250, due_date: `${currentYear}-09-30`, notes: 'Saldo' }
    ]
    setFormData(prev => ({
      ...prev,
      installments: defaultInstallments
    }))
  }

  // Generate suggested fee name from type and category (optional)
  const generateSuggestedFeeName = (type: string, category: string) => {
    const typeLabel = feeTypes.find(t => t.value === type)?.label || type
    const categoryLabel = categories.find(c => c.value === category)?.label || category
    return `${typeLabel} - ${categoryLabel}`
  }

  // Get player category for display
  const getPlayerCategory = (person: any) =>
    getPersonCategoryLabel(person, categories, allCategoriesData)

  // Colori badge categoria: sfondo scuro + testo bianco per leggibilità
  const CATEGORY_BADGE_COLORS: Record<string, string> = {
    U6: 'bg-blue-600 text-white',
    U8: 'bg-blue-700 text-white',
    U10: 'bg-green-600 text-white',
    U12: 'bg-green-700 text-white',
    U14: 'bg-amber-600 text-white',
    U16: 'bg-amber-700 text-white',
    U18: 'bg-yellow-600 text-white',
    SERIE_C: 'bg-orange-700 text-white',
    SERIE_B: 'bg-red-600 text-white',
    SENIORES: 'bg-red-700 text-white',
    PODEROSA: 'bg-purple-600 text-white',
    GUSSAGOLD: 'bg-purple-700 text-white',
    BRIXIAOLD: 'bg-indigo-600 text-white',
    LEONESSE: 'bg-pink-600 text-white',
    // fallback per nome (es. da player_categories.categories)
    'Serie B': 'bg-red-600 text-white',
    'Serie C': 'bg-orange-700 text-white',
    'Under 6': 'bg-blue-600 text-white',
    'Under 8': 'bg-blue-700 text-white',
    'Under 10': 'bg-green-600 text-white',
    'Under 12': 'bg-green-700 text-white',
    'Under 14': 'bg-amber-600 text-white',
    'Under 16': 'bg-amber-700 text-white',
    'Under 18': 'bg-yellow-600 text-white'
  }

  const getFeeCategoryBadgeColor = (categoryCode: string) =>
    CATEGORY_BADGE_COLORS[categoryCode] || 'bg-slate-600 text-white'

  const getPlayerCategoryColor = (person: any) => {
    if (!person) return 'bg-gray-600 text-white'
    
    if (person.player_categories && person.player_categories.length > 0) {
      const firstCategory = person.player_categories[0]
      
      if (typeof firstCategory === 'string') {
        const category = allCategoriesData.find(c => c.id === firstCategory)
        if (category) {
          return CATEGORY_BADGE_COLORS[category.code] || CATEGORY_BADGE_COLORS[category.name] || 'bg-slate-600 text-white'
        }
        const staticCategory = categories.find(c => c.value === firstCategory)
        return staticCategory ? (CATEGORY_BADGE_COLORS[staticCategory.value] || 'bg-slate-600 text-white') : 'bg-gray-600 text-white'
      }
      if (typeof firstCategory === 'object') {
        const catName = firstCategory.categories?.name ?? firstCategory.name
        const catCode = firstCategory.categories?.code ?? firstCategory.code
        if (catName || catCode) {
          return CATEGORY_BADGE_COLORS[catCode] || CATEGORY_BADGE_COLORS[catName] || 'bg-slate-600 text-white'
        }
        const category = categories.find(c => c.label === catName)
        return category ? (CATEGORY_BADGE_COLORS[category.value] || 'bg-slate-600 text-white') : 'bg-slate-600 text-white'
      }
    }
    
    return 'bg-gray-600 text-white'
  }

  // Get row background color based on assignment status and due date
  const getRowBackgroundColor = (assignment: FeeAssignment, fee: any) => {
    // If paid, green background
    if (assignment.status === 'paid') {
      return 'bg-green-50 hover:bg-green-100'
    }
    
    // If cancelled, gray background
    if (assignment.status === 'cancelled') {
      return 'bg-gray-50 hover:bg-gray-100'
    }
    
    // If overdue, red background
    if (assignment.status === 'overdue') {
      return 'bg-red-50 hover:bg-red-100'
    }
    
    // If pending, check assignment due date
    if (assignment.status === 'pending') {
      if (assignment.due_date) {
        const dueDate = new Date(assignment.due_date)
        const today = new Date()
        today.setHours(0, 0, 0, 0) // Reset time to start of day for accurate comparison
        
        if (dueDate < today) {
          return 'bg-red-50 hover:bg-red-100' // Overdue - red background
        }
      }
    }
    
    // Default background for pending and not overdue
    return 'hover:bg-gray-50'
  }

  // Create new fee
  const handleCreateFee = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.type) {
      setMessage('Seleziona un tipo di quota')
      return
    }

    if (!formData.name.trim()) {
      setMessage('Inserisci un nome per la quota')
      return
    }

    try {
      setLoading(true)
      
      const validCategories = ['all', ...categories.filter(c => c.value !== 'all').map(c => c.value)]
      
      // Verifica che tutte le categorie selezionate siano valide
      const invalidCategories = selectedCategories.filter(cat => !validCategories.includes(cat))
      if (invalidCategories.length > 0) {
        setMessage(`Categorie non valide: ${invalidCategories.join(', ')}`)
        return
      }

      const dueDate = formData.due_date || null
      
      // Crea una sola quota che può essere assegnata a più categorie
             const feeData: any = {
               name: formData.name.trim(),
               description: formData.description,
               type: formData.type,
               amount: formData.amount * 100, // Convert euros to cents
               currency: formData.currency,
               category: 'all', // Sempre 'all' per permettere assegnazioni multiple
               applicable_categories: selectedCategories.includes('all') ? ['all'] : selectedCategories, // Riattivato
               is_active: formData.is_active,
               is_mandatory: formData.is_mandatory,
               due_date: dueDate
             }

        // Aggiungi i campi delle rate solo se sono definiti
        if (formData.payment_mode) {
          feeData.payment_mode = formData.payment_mode
        }
        if (formData.installment_count) {
          feeData.installment_count = formData.installment_count
        }
        if (formData.installment_frequency) {
          feeData.installment_frequency = formData.installment_frequency
        }
        if (formData.installment_start_date) {
          feeData.installment_start_date = formData.installment_start_date
        }
        if (formData.installments && formData.installments.length > 0) {
          feeData.installments = formData.installments
        }

        console.log('Salvando quota con dati:', feeData)
        const { error } = await supabase
          .from('fees')
          .insert([feeData])

        if (error) {
          console.error('Supabase error details:', error)
          throw error
        }
        console.log('Quota salvata con successo!')

      setMessage('Quota creata con successo!')
      setShowCreateModal(false)
      setFormData({
        name: '',
        description: '',
        type: '' as Fee['type'],
        amount: 0,
        currency: 'EUR',
        category: 'all' as Fee['category'],
        is_active: true,
        is_mandatory: false,
        due_date: '',
        payment_mode: 'single' as 'single' | 'installments',
        installment_count: 1,
        installment_frequency: 'monthly' as 'monthly' | 'weekly',
        installment_start_date: '',
        installments: [] as Array<{ amount: number; due_date: string; notes?: string }>
      })
      setSelectedCategories(['all'])
      loadFees()
    } catch (error) {
      console.error('Error creating fee:', error)
      setMessage('Errore nella creazione della quota')
    } finally {
      setLoading(false)
    }
  }

  // Update existing fee
  const handleUpdateFee = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingFee || !formData.type) {
      setMessage('Seleziona un tipo di quota')
      return
    }

    if (!formData.name.trim()) {
      setMessage('Inserisci un nome per la quota')
      return
    }

    try {
      setLoading(true)
      
      const validCategories = ['all', ...categories.filter(c => c.value !== 'all').map(c => c.value)]
      
      // Verifica che tutte le categorie selezionate siano valide
      const invalidCategories = selectedCategories.filter(cat => !validCategories.includes(cat))
      if (invalidCategories.length > 0) {
        setMessage(`Categorie non valide: ${invalidCategories.join(', ')}`)
        return
      }

      const dueDate = formData.due_date || null
      
             // Prepara i dati base
             const updateData: any = {
               name: formData.name.trim(),
               description: formData.description,
               type: formData.type,
               amount: formData.amount * 100, // Convert euros to cents
               currency: formData.currency,
               category: 'all', // Sempre 'all' per permettere assegnazioni multiple
               applicable_categories: selectedCategories.includes('all') ? ['all'] : selectedCategories, // Riattivato
               is_active: formData.is_active,
               is_mandatory: formData.is_mandatory,
               due_date: dueDate
             }

      // Aggiungi i campi delle rate solo se sono definiti
      if (formData.payment_mode) {
        updateData.payment_mode = formData.payment_mode
      }
      if (formData.installment_count) {
        updateData.installment_count = formData.installment_count
      }
      if (formData.installment_frequency) {
        updateData.installment_frequency = formData.installment_frequency
      }
      if (formData.installment_start_date) {
        updateData.installment_start_date = formData.installment_start_date
      }
      if (formData.installments && formData.installments.length > 0) {
        updateData.installments = formData.installments
      }

      console.log('Aggiornando quota con dati:', updateData)
      const { error } = await supabase
        .from('fees')
        .update(updateData)
        .eq('id', editingFee.id)

      if (error) {
        console.error('Supabase error details:', error)
        throw error
      }
      console.log('Quota aggiornata con successo!')

      // Update all assignments for this fee
      const { error: assignmentError } = await supabase
        .from('fee_assignments')
        .update({
          amount: formData.amount * 100 // Convert euros to cents
        })
        .eq('fee_id', editingFee.id)

      if (assignmentError) {
        console.warn('Warning: Fee updated but assignments not updated:', assignmentError)
      }

      setMessage('Quota e assegnazioni aggiornate con successo!')
      setShowCreateModal(false)
      setEditingFee(null)
      setFormData({
        name: '',
        description: '',
        type: '' as Fee['type'],
        amount: 0,
        currency: 'EUR',
        category: 'all' as Fee['category'],
        is_active: true,
        is_mandatory: false,
        due_date: '',
        payment_mode: 'single' as 'single' | 'installments',
        installment_count: 1,
        installment_frequency: 'monthly' as 'monthly' | 'weekly',
        installment_start_date: '',
        installments: [] as Array<{ amount: number; due_date: string; notes?: string }>
      })
      setSelectedCategories(['all'])
      loadFees()
      loadAssignments() // Reload assignments to reflect changes
    } catch (error) {
      console.error('Error updating fee:', error)
      setMessage('Errore nell\'aggiornamento della quota')
    } finally {
      setLoading(false)
    }
  }

  // Delete fee
  const handleDeleteFee = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa quota?')) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('fees')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMessage('Quota eliminata con successo!')
      loadFees()
    } catch (error) {
      console.error('Error deleting fee:', error)
      setMessage('Errore nell\'eliminazione della quota')
    } finally {
      setLoading(false)
    }
  }

  // Delete assignment
  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Sei sicuro di voler rimuovere questa assegnazione?')) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('fee_assignments')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMessage('Assegnazione rimossa con successo!')
      loadAssignments()
    } catch (error) {
      console.error('Error deleting assignment:', error)
      setMessage('Errore nella rimozione dell\'assegnazione')
    } finally {
      setLoading(false)
    }
  }

  // Invia sollecito quota scaduta al TUTOR PRINCIPALE del giocatore (WhatsApp + notifica Flowme se ha codice)
  const handleSendWhatsAppReminder = async (playerId: string, playerName: string, dueDate: string, amountEuros: number, feeId?: string) => {
    try {
      // 1. Trova il tutor principale del giocatore (is_primary_contact = true, altrimenti il primo)
      const { data: tutorRels, error: relError } = await supabase
        .from('tutor_athlete_relations')
        .select('tutor_id')
        .eq('athlete_id', playerId)
        .order('is_primary_contact', { ascending: false })

      if (relError || !tutorRels?.length) {
        alert('Questo giocatore non ha un tutor assegnato. Assegna un tutor nella scheda del giocatore (tab Tutor).')
        return
      }

      const tutorId = tutorRels[0].tutor_id

      // 2. Carica dati del tutor (telefono, invite_code per Flowme)
      const { data: tutorData, error: tutorError } = await supabase
        .from('people')
        .select('id, given_name, family_name, phone, invite_code')
        .eq('id', tutorId)
        .single()

      if (tutorError || !tutorData) {
        alert('Impossibile caricare i dati del tutor.')
        return
      }

      if (!tutorData.phone?.trim()) {
        alert(`Il tutor ${(tutorData.given_name || '')} ${(tutorData.family_name || '')} non ha un numero di cellulare. Aggiungi il telefono nella sua scheda.`)
        return
      }

      // 3. Carica template messaggio
      const { data: templates } = await supabase
        .from('message_templates')
        .select('name, content')
        .eq('type', 'whatsapp')
        .ilike('name', '%Sollecito quota scaduta%')

      const template = (templates || []).find(t => (t.name || '').toLowerCase().includes('sollecito quota scaduta'))
      const defaultContent = `Buongiorno,
vi ricordiamo gentilmente che la quota di [inserisci importo della quota] con scadenza [data_scadenza] relativa a [nome_giocatore] risulta ad oggi scaduta.

Vi chiediamo cortesemente di provvedere al saldo nei prossimi giorni.
Qualora aveste già effettuato il pagamento, vi preghiamo di non considerare questo messaggio.

Per qualsiasi necessità o chiarimento restiamo a disposizione.
Grazie per la collaborazione e per il sostegno al progetto.

Un cordiale saluto,
${getBrandConfig().clubName || 'Staff'}`

      const content = template?.content || defaultContent
      const dataScadenza = dueDate ? new Date(dueDate).toLocaleDateString('it-IT') : ''
      const importoQuota = formatCurrency(amountEuros)
      let msg = content
        .replace(/\[inserisci importo della quota\]/gi, importoQuota)
        .replace(/\[data_scadenza\]/gi, dataScadenza)
        .replace(/\[nome_giocatore\]/gi, playerName)
        .replace(/\[Data scadenza\]/gi, dataScadenza)
        .replace(/\[Nome giocatore\]/gi, playerName)
        .replace(/\[e qui metti la data che scadeva la quota\]/gi, dataScadenza)
        .replace(/\[qui metti il nome del giocatore\]/gi, playerName)

      // Fallback: se il template nel DB ha ancora il vecchio formato "la quota con scadenza", inserisci l'importo
      if (!msg.includes(importoQuota) && msg.includes('la quota con scadenza')) {
        msg = msg.replace(/la quota con scadenza/gi, `la quota di ${importoQuota} con scadenza`)
      }

      // 4. Se il tutor ha codice Flowme (registrato nell'app), invia anche notifica push
      const hasFlowmeCode = !!(tutorData.invite_code && String(tutorData.invite_code).trim().length > 0)
      if (hasFlowmeCode) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('person_id', tutorId)
          .limit(1)
          .maybeSingle()

        if (profile?.id) {
          try {
            await supabase.from('notifications').insert({
              user_id: profile.id,
              title: 'Sollecito quota scaduta',
              body: msg,
              type: 'fee_reminder',
              metadata: { player_id: playerId, player_name: playerName, due_date: dueDate }
            })
          } catch (notifErr) {
            console.warn('Errore invio notifica Flowme al tutor:', notifErr)
          }
        }
      }

      // 5. Mostra modal: attesa se app chiusa (Apri WhatsApp e torna qui), oppure "Invia" se già aperta
      const digits = String(tutorData.phone).replace(/\D/g, '')
      const whatsappNumber = digits.startsWith('39') ? digits : (digits.startsWith('0') ? '39' + digits.slice(1) : '39' + digits)
      const url = `whatsapp://send?phone=${whatsappNumber}&text=${encodeURIComponent(msg)}`
      setWhatsAppModal({ open: true, url, playerId, feeId, tutorId })
    } catch (err) {
      console.error('Errore invio sollecito:', err)
      alert('Errore nell\'invio del sollecito. Verifica che il giocatore abbia un tutor con numero di telefono.')
    }
  }

  // --- Genera ricevuta (quote pagate): destinatari → eventuale scelta rata → PDF, upload, DB, notifica
  const handleGenerateReceiptClick = async (
    assignment: FeeAssignment,
    assignmentGroup: FeeAssignment[],
    person: { id: string; given_name?: string; family_name?: string; fiscal_code?: string } | null,
    fee: Fee | null
  ) => {
    const playerId = assignment.person_id
    const paidInstallments = assignmentGroup.filter(a => a.status === 'paid').sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    const paidWithoutReceipt = paidInstallments.filter(a => !assignmentReceiptsMap[a.id])
    if (paidInstallments.length === 0) {
      toast.error('Nessuna rata pagata per questa quota.')
      return
    }
    if (paidWithoutReceipt.length === 0) {
      toast.info('Tutte le rate pagate hanno già una ricevuta.')
      return
    }

    const { data: recipientRows } = await supabase
      .from('person_receipt_recipients')
      .select('recipient_person_id')
      .eq('person_id', playerId)

    const recipientIds = (recipientRows || []).map(r => r.recipient_person_id).filter(Boolean) as string[]
    if (recipientIds.length === 0) {
      toast.error('Nessun destinatario ricevute configurato. Vai nella scheda del giocatore → tab Quote → "Destinatari ricevute di pagamento" e salva almeno un destinatario.')
      return
    }

    const { data: peopleRecipients } = await supabase
      .from('people')
      .select('id, given_name, family_name')
      .in('id', recipientIds)

    const recipients = (peopleRecipients || []).map(p => ({
      id: p.id,
      name: `${p.given_name || ''} ${p.family_name || ''}`.trim() || 'Senza nome'
    }))
    if (recipients.length === 0) {
      toast.error('Impossibile caricare i destinatari.')
      return
    }

    if (recipients.length === 1) {
      proceedAfterRecipient(recipients[0].id, recipients[0].name, paidWithoutReceipt, assignmentGroup, fee, person)
      return
    }
    setReceiptSelectedRecipientId(recipients[0]?.id ?? null)
    setReceiptRecipientModal({ open: true, recipients, assignmentGroup, fee, person, paidWithoutReceipt })
  }

  const proceedAfterRecipient = (
    recipientId: string,
    recipientName: string,
    paidWithoutReceipt: FeeAssignment[],
    assignmentGroup: FeeAssignment[],
    fee: Fee | null,
    person: any
  ) => {
    if (paidWithoutReceipt.length === 1) {
      doGenerateReceipt(recipientId, [paidWithoutReceipt[0]], assignmentGroup, fee, person)
      return
    }
    setReceiptSelectedInstallmentIds(paidWithoutReceipt.length > 0 ? [paidWithoutReceipt[0].id] : [])
    setReceiptInstallmentModal({
      open: true,
      paidInstallments: paidWithoutReceipt,
      recipientId,
      recipientName,
      assignmentGroup,
      fee,
      person
    })
  }

  const doGenerateReceipt = async (
    recipientPersonId: string,
    targetAssignments: FeeAssignment[],
    assignmentGroup: FeeAssignment[],
    fee: Fee | null,
    playerPerson: { id: string; given_name?: string; family_name?: string; fiscal_code?: string } | null
  ) => {
    if (targetAssignments.length === 0) return
    setReceiptGenerating(true)
    setReceiptInstallmentModal(prev => ({ ...prev, open: false }))
    const first = targetAssignments[0]
    try {
      const [recipientRes, playerRes, feeRes, headerSettings] = await Promise.all([
        supabase.from('people').select('given_name, family_name, fiscal_code, address_street, address_city, address_zip, address_country').eq('id', recipientPersonId).single(),
        supabase.from('people').select('given_name, family_name, fiscal_code').eq('id', first.person_id).single(),
        fee ? Promise.resolve({ data: fee }) : supabase.from('fees').select('*').eq('id', first.fee_id).single(),
        getReceiptHeaderSettings()
      ])
      const recipient = recipientRes.data
      const player = playerRes.data
      const feeData = feeRes.data as Fee | null
      const header = headerSettings ?? undefined
      if (!recipient || !player) {
        toast.error('Dati pagante o giocatore mancanti.')
        return
      }
      const nomePagante = `${recipient.given_name || ''} ${recipient.family_name || ''}`.trim() || 'N/A'
      const indirizzoParts = [recipient.address_street, [recipient.address_zip, recipient.address_city].filter(Boolean).join(' '), recipient.address_country].filter(Boolean)
      const indirizzoPagante = indirizzoParts.join(', ') || ''
      const nomeFiglio = `${player.given_name || ''} ${player.family_name || ''}`.trim() || 'N/A'
      const totalAmount = targetAssignments.reduce((s, a) => s + a.amount, 0)
      const importoEuros = totalAmount / 100
      const importoStr = importoEuros.toFixed(2).replace('.', ',')
      const lastPaid = [...targetAssignments].sort((a, b) => new Date((b.paid_date || b.paid_at || '')).getTime() - new Date((a.paid_date || a.paid_at || '')).getTime())[0]
      const dataPagamento = lastPaid?.paid_date || lastPaid?.paid_at ? new Date(lastPaid.paid_date || lastPaid.paid_at || '').toLocaleDateString('it-IT') : new Date().toLocaleDateString('it-IT')
      const anno = new Date().getFullYear().toString()
      const { count } = await supabase.from('payment_receipts').select('id', { count: 'exact', head: true }).gte('created_at', `${anno}-01-01`).lt('created_at', `${Number(anno) + 1}-01-01`)
      const numeroRicevuta = String((count ?? 0) + 1)
      const totalFeeAmount = assignmentGroup.reduce((s, a) => s + a.amount, 0)
      const isSoluzioneUnica = targetAssignments.length === 1 && targetAssignments[0].amount === totalFeeAmount
      const rataDescrizione = targetAssignments.length === 1
        ? (assignmentGroup.length > 1
          ? `Rata ${targetAssignments[0].installment_number ?? '-'} di ${(feeData?.name || 'Quota')} (scadenza ${targetAssignments[0].due_date ? new Date(targetAssignments[0].due_date).toLocaleDateString('it-IT') : '-'})`
          : (feeData?.name || 'Quota unica'))
        : targetAssignments.map(a => `Rata ${a.installment_number ?? '-'}: ${formatCurrency(a.amount / 100)}`).join('; ')
      const brand = getBrandConfig()
      const dati: DatiRicevuta = {
        numero_ricevuta: numeroRicevuta,
        anno,
        nome_pagante: nomePagante,
        cf_pagante: recipient.fiscal_code || '',
        indirizzo_pagante: indirizzoPagante,
        importo: importoStr,
        importo_lettere: '',
        nome_figlio: nomeFiglio,
        cf_figlio: player.fiscal_code || '',
        rata_descrizione: rataDescrizione,
        data: dataPagamento,
        luogo: header?.luogo ?? brand?.contact?.address ?? '',
        club_name: header?.nome_associazione ?? brand?.clubName ?? '',
        nome_associazione: header?.nome_associazione ?? brand?.clubName ?? '',
        sede_legale: header?.sede_legale ?? '',
        cf_associazione: header?.cf_associazione ?? '',
        piva_associazione: header?.piva_associazione ?? '',
        affiliazione_fir: header?.affiliazione_fir ?? ''
      }
      const templateName = isSoluzioneUnica ? 'ricevuta_soluzione_unica' : 'ricevuta_rateizzata'
      const blob = await generateRicevutaPDF(templateName, dati)
      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, '_blank')
      setReceiptPreviewModal({
        open: true,
        blob,
        objectUrl,
        targetAssignments,
        recipientPersonId
      })
    } catch (e) {
      console.error('Errore generazione ricevuta:', e)
      toast.error('Errore durante la generazione della ricevuta.')
    } finally {
      setReceiptGenerating(false)
    }
  }

  const confirmReceiptUpload = async () => {
    const { blob, objectUrl, targetAssignments, recipientPersonId } = receiptPreviewModal
    if (!blob || !targetAssignments?.length || !recipientPersonId) return
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    setReceiptPreviewModal({ open: false, blob: null, objectUrl: null, targetAssignments: [], recipientPersonId: null })
    setReceiptGenerating(true)
    try {
      const fileName = `ricevuta_${targetAssignments[0].id}_${recipientPersonId}.pdf`
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('ricevute').upload(fileName, blob, { contentType: 'application/pdf', upsert: true })
      if (uploadErr) {
        const msg = uploadErr.message || ''
        const hint = (msg.includes('Bucket') || uploadErr.name === 'StorageApiError') ? ' Crea il bucket "ricevute" in Supabase Storage (vedi setup_storage_ricevute.sql).' : ''
        toast.error('Errore caricamento PDF: ' + (msg || 'Storage non configurato.') + hint)
        return
      }
      const { data: urlData } = supabase.storage.from('ricevute').getPublicUrl(uploadData.path)
      const pdfUrl = urlData.publicUrl
      for (const ta of targetAssignments) {
        const { error: insertErr } = await supabase.from('payment_receipts').insert({
          fee_assignment_id: ta.id,
          recipient_person_id: recipientPersonId,
          pdf_url: pdfUrl
        })
        if (insertErr && insertErr.code !== '23505') {
          toast.error('Errore salvataggio ricevuta: ' + (insertErr.message || ''))
          return
        }
      }
      const { data: profile } = await supabase.from('profiles').select('id').eq('person_id', recipientPersonId).maybeSingle()
      if (profile?.id || recipientPersonId) {
        await supabase.from('notifications').insert({
          ...(profile?.id && { user_id: profile.id }),
          person_id: recipientPersonId,
          title: 'Ricevuta di pagamento',
          body: 'È stata inserita la ricevuta del pagamento.',
          type: 'receipt_uploaded',
          metadata: { fee_assignment_id: targetAssignments[0].id, pdf_url: pdfUrl }
        })
      }
      toast.success('Ricevuta caricata. Il destinatario la vedrà in FlowMe (sezione Pagamenti).')
      loadAssignments()
    } catch (e) {
      console.error('Errore caricamento ricevuta:', e)
      toast.error('Errore durante il caricamento della ricevuta.')
    } finally {
      setReceiptGenerating(false)
    }
  }

  const cancelReceiptPreview = () => {
    if (receiptPreviewModal.objectUrl) URL.revokeObjectURL(receiptPreviewModal.objectUrl)
    setReceiptPreviewModal({ open: false, blob: null, objectUrl: null, targetAssignments: [], recipientPersonId: null })
  }

  // Handle payment input change
  const handlePaymentInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setPaymentData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }))
  }

  // Register payment
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedAssignment || paymentData.amount <= 0) {
      setMessage('Inserisci un importo valido')
      return
    }

    try {
      setLoading(true)
      
      const paymentAmountInCents = toCents(paymentData.amount)
      const paymentResult = await recordAssignmentPayment({
        assignmentId: selectedAssignment.id,
        amountInCents: paymentAmountInCents,
        paymentMethod: paymentData.payment_method,
        paymentDate: paymentData.payment_date,
        reference: paymentData.reference || null,
        notes: paymentData.notes || null
      })

      setMessage('Pagamento registrato con successo!')
      setShowPaymentModal(false)
      setPaymentData({
        amount: 0,
        payment_method: 'cash',
        payment_date: new Date().toISOString().split('T')[0],
        reference: '',
        notes: ''
      })
      setSelectedAssignment(null)
      
      // Update assignments immediately
      const updatedAssignments = assignments.map(assignment => {
        if (assignment.id === selectedAssignment.id) {
          const newPaidAmount = paymentResult.paidAmount
          const newStatus = paymentResult.isFullyPaid ? 'paid' : 'pending'
          return {
            ...assignment,
            paid_amount: newPaidAmount,
            status: newStatus as 'pending' | 'paid' | 'overdue' | 'cancelled'
          }
        }
        return assignment
      })
      
      setAssignments(updatedAssignments as FeeAssignment[])
      setFilteredAssignments(updatedAssignments as FeeAssignment[])
      
      // Update status summary immediately
      setAssignmentStatusSummary(calculateStatusSummary(updatedAssignments))
      
      // Update payments in accordion immediately
      if (selectedAssignment) {
        const newPaidAmount = paymentResult.paidAmount
        
        // If assignment now has payments, expand it (and close others)
        if (newPaidAmount > 0) {
          setExpandedAssignments({ [selectedAssignment.id]: true })
        }
        
        // Always reload payments from database to avoid duplication
        await loadAssignmentPayments(selectedAssignment.id)
      }
    } catch (error) {
      console.error('Error registering payment:', error)
      setMessage('Errore nella registrazione del pagamento')
    } finally {
      setLoading(false)
    }
  }

  // Open payment modal - replica la logica di CreatePersonView
  const handleOpenPaymentModal = async (assignment: FeeAssignment) => {
    setSelectedAssignment(assignment)
    
    try {
      // Carica tutte le rate per questa quota direttamente dal database
      const { data: feeAssignments, error } = await supabase
        .from('fee_assignments')
        .select(`
          *,
          fees (
            name,
            description,
            amount,
            installments
          )
        `)
        .eq('fee_id', assignment.fee_id)
        .eq('person_id', assignment.person_id)

      if (error) throw error

      // Usa le assegnazioni esistenti dal database invece di creare rate temporanee
      let modalInstallments = []
      if (feeAssignments && feeAssignments.length > 0) {
        const fee = feeAssignments[0].fees
        if (fee?.installments && fee.installments.length > 0) {
          // Usa le rate configurate nella quota e abbina con le assegnazioni esistenti
          modalInstallments = fee.installments.map((installment: any, index: number) => {
            // Trova l'assegnazione corrispondente se esiste
            const assignment = feeAssignments.find(a => a.installment_number === index + 1)
            
            return {
              id: assignment?.id || `temp-${index}`, // Usa l'ID reale se esiste, altrimenti temp
              amount: installment.amount,
              due_date: installment.due_date,
              notes: installment.notes || (index === 0 ? 'Acconto' : index === fee.installments.length - 1 ? 'Saldo' : 'Acconto'),
              status: assignment?.status || 'pending',
              paid_at: assignment?.paid_at || null,
              installment_number: index + 1,
              isRealAssignment: !!assignment // Flag per distinguere assegnazioni reali da temporanee
            }
          })
        } else {
          // Se non ci sono rate configurate, usa le assegnazioni esistenti
          modalInstallments = feeAssignments.map((assignment: any) => ({
            id: assignment.id,
            amount: fromCents(assignment.amount),
            due_date: assignment.due_date,
            notes: assignment.notes || 'Rata',
            status: assignment.status || 'pending',
            paid_at: assignment.paid_at || null,
            installment_number: assignment.installment_number || 1,
            isRealAssignment: true
          }))
        }
      }

      setPaymentInstallments(modalInstallments)
      setSelectedInstallments({})
      setPaymentMethods({})
      setPaymentDates({})
      setInitialPaymentStatus({})
      console.log('🔍 DEBUG: Modal aperto, stati resettati')
      setShowInstallmentPaymentModal(true)
    } catch (error) {
      console.error('Errore nel caricamento delle rate:', error)
      alert('Errore nel caricamento delle rate')
    }
  }

  // Handle installment toggle - replica la logica di CreatePersonView
  const handleInstallmentToggle = (installmentId: string, installmentIndex: number) => {
    console.log(`🔍 DEBUG: Toggle rata ${installmentIndex + 1}, ID: ${installmentId}`)
    console.log('🔍 DEBUG: Stato attuale selectedInstallments:', selectedInstallments)
    
    if (selectedInstallments[installmentId]) {
      // Se deseleziono la rata, rimuovo anche il metodo di pagamento e la data
      setSelectedInstallments(prev => {
        const newSelection = { ...prev }
        delete newSelection[installmentId]
        return newSelection
      })
      setPaymentMethods(prev => {
        const newMethods = { ...prev }
        delete newMethods[installmentId]
        return newMethods
      })
      setPaymentDates(prev => {
        const newDates = { ...prev }
        delete newDates[installmentId]
        return newDates
      })
    } else {
      setSelectedInstallments(prev => ({
        ...prev,
        [installmentId]: true
      }))
      // Inizializza la data con la data odierna quando si seleziona una rata
      setPaymentDates(prev => ({
        ...prev,
        [installmentId]: new Date().toISOString().split('T')[0]
      }))
      console.log(`🔍 DEBUG: Rata ${installmentIndex + 1} selezionata, data inizializzata`)
    }
  }

  const handlePaymentMethodChange = (installmentId: string, method: string) => {
    setPaymentMethods(prev => ({
      ...prev,
      [installmentId]: method
    }))
  }

  const handlePaymentDateChange = (installmentId: string, date: string) => {
    setPaymentDates(prev => ({
      ...prev,
      [installmentId]: date
    }))
  }

  const canEditInstallment = (installmentIndex: number) =>
    canEditInstallmentCore(installmentIndex, paymentInstallments, selectedInstallments, { considerPaidAsEditable: false })

  // Toggle accordion expansion - only one open at a time
  const toggleAssignmentExpansion = (assignmentId: string) => {
    setExpandedAssignments(prev => {
      // Se l'accordion è già aperto, chiudilo
      if (prev[assignmentId]) {
        return {}
      } else {
        // Altrimenti, chiudi tutti gli altri e apri solo questo
        return { [assignmentId]: true }
      }
    })
  }

  // Handle payment submission - replica la logica di CreatePersonView
  const handlePaymentSubmit = async () => {
    try {
      const selectedInstallmentIds = Object.keys(selectedInstallments).filter(id => selectedInstallments[id])
      
      if (selectedInstallmentIds.length === 0) {
        alert('Seleziona almeno una rata da pagare')
        return
      }
      
      // Verifica che tutti abbiano un metodo di pagamento
      for (const installmentId of selectedInstallmentIds) {
        if (!paymentMethods[installmentId]) {
          alert('Devi selezionare un metodo di pagamento per tutte le rate selezionate')
          return
        }
      }
      
      const realInstallmentUpdates = selectedInstallmentIds.reduce<Array<{
        id: string
        isSelected: boolean
        paymentMethod: string
        paymentDate: string
      }>>((updates, installmentId) => {
          const installment = paymentInstallments.find(item => item.id === installmentId)
          if (!installment?.isRealAssignment) return updates
          updates.push({
            id: installmentId,
            isSelected: true,
            paymentMethod: paymentMethods[installmentId],
            paymentDate: paymentDates[installmentId] || new Date().toISOString().split('T')[0]
          })
          return updates
        }, [])

      if (realInstallmentUpdates.length > 0) {
        await markInstallmentsPaid(realInstallmentUpdates)
      }

      for (const installmentId of selectedInstallmentIds) {
        const installment = paymentInstallments.find(item => item.id === installmentId)
        if (!installment || installment.isRealAssignment) continue

        const paymentDate = paymentDates[installmentId] || new Date().toISOString().split('T')[0]
        const amountInCents = toCents(Number(installment.amount))
        const { data: createdAssignment, error: createError } = await supabase
          .from('fee_assignments')
          .insert({
            fee_id: selectedAssignment.fee_id,
            person_id: selectedAssignment.person_id,
            amount: amountInCents,
            due_date: installment.due_date,
            notes: installment.notes,
            installment_number: installment.installment_number,
            status: 'pending'
          })
          .select('id')
          .single()
        if (createError) throw createError

        await recordAssignmentPayment({
          assignmentId: createdAssignment.id,
          amountInCents,
          paymentMethod: paymentMethods[installmentId],
          paymentDate
        })
      }
      
      // Chiudi il modal e ricarica i dati
      setShowInstallmentPaymentModal(false)
      setSelectedAssignment(null)
      setSelectedInstallments({})
      setPaymentInstallments([])
      setPaymentMethods({})
      setPaymentDates({})
      setInitialPaymentStatus({})
      
      // Ricarica le assegnazioni
      loadAssignments()
      
      alert('Pagamenti registrati con successo!')
      
    } catch (error) {
      console.error('Errore nel salvataggio dei pagamenti:', error)
      alert('Errore nel salvataggio dei pagamenti: ' + (error as any)?.message || 'Errore sconosciuto')
    }
  }

  // Edit fee
  const handleEditFee = (fee: Fee) => {
    setEditingFee(fee)
    
    // Determina il payment_mode corretto
    let paymentMode = fee.payment_mode || 'single'
    let installments = fee.installments || []
    
    // Se la quota ha rate pre-configurate, imposta 'installments'
    if (installments.length > 0) {
      paymentMode = 'installments'
    }
    
    setFormData({
      name: fee.name,
      description: fee.description,
      type: fee.type,
      amount: fee.amount / 100, // Convert cents to euros for editing
      currency: fee.currency,
      category: fee.category,
      is_active: fee.is_active,
      is_mandatory: fee.is_mandatory,
      due_date: fee.due_date || '',
      payment_mode: paymentMode,
      installment_count: fee.installment_count || 1,
      installment_frequency: fee.installment_frequency || 'monthly',
      installment_start_date: fee.installment_start_date || '',
      installments: installments
    })
    // Carica le categorie applicabili se esistono, altrimenti usa la categoria singola
    if (fee.applicable_categories && fee.applicable_categories.length > 0) {
      setSelectedCategories(fee.applicable_categories)
    } else {
      setSelectedCategories([fee.category])
    }
    setShowCreateModal(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: '' as Fee['type'],
      amount: 0,
      currency: 'EUR',
      category: 'all' as Fee['category'],
      is_active: true,
      is_mandatory: false,
      due_date: '',
      payment_mode: 'single',
      installment_count: 1,
      installment_frequency: 'monthly',
      installment_start_date: '',
      installments: []
    })
    setSelectedCategories(['all'])
    setEditingFee(null)
  }

  // Set default due date for membership fees
  useEffect(() => {
    if (formData.type === 'membership' && !formData.due_date) {
      const currentYear = new Date().getFullYear()
      setFormData(prev => ({
        ...prev,
        due_date: `${currentYear}-12-15`
      }))
    }
  }, [formData.type])

  // Sincronizza tab, vista e read-only con l'header DashboardLayout (quando embedInLayout)
  useEffect(() => {
    if (!embedInLayout) return
    window.dispatchEvent(new CustomEvent('fees-tab-changed', { detail: { tab: activeTab } }))
  }, [embedInLayout, activeTab])
  useEffect(() => {
    if (!embedInLayout) return
    window.dispatchEvent(new CustomEvent('fees-view-changed', { detail: { mode: feeViewMode } }))
  }, [embedInLayout, feeViewMode])
  useEffect(() => {
    if (!embedInLayout) return
    window.dispatchEvent(new CustomEvent('fees-readonly', { detail: { value: isReadOnly } }))
  }, [embedInLayout, isReadOnly])
  useEffect(() => {
    if (!embedInLayout) return
    const onSetTable = () => setFeeViewMode('table')
    const onSetCards = () => setFeeViewMode('cards')
    const onOpenCreate = () => {
      if (!isReadOnly) {
        resetForm()
        setShowCreateModal(true)
      }
    }
    window.addEventListener('fees-set-view-table', onSetTable)
    window.addEventListener('fees-set-view-cards', onSetCards)
    window.addEventListener('fees-open-create-modal', onOpenCreate)
    return () => {
      window.removeEventListener('fees-set-view-table', onSetTable)
      window.removeEventListener('fees-set-view-cards', onSetCards)
      window.removeEventListener('fees-open-create-modal', onOpenCreate)
    }
  }, [embedInLayout, isReadOnly])

  return (
    <div className={embedInLayout ? 'min-h-full bg-slate-900 text-white' : ''}>
      {!embedInLayout && (
        <Header 
          title="Gestione Quote e Costi" 
          subtitle={isReadOnly ? 'Solo visualizzazione (da smartphone)' : isMobileTablet ? 'Modifica consentita (tablet)' : 'Gestisci le quote, le assegnazioni e i pagamenti'}
          showBack={true}
          hideCenterLogo={true}
          rightButton={activeTab === 'fees' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFeeViewMode('table')}
                className={`p-2 rounded-lg transition-colors text-white ${feeViewMode === 'table' ? 'bg-white/30' : 'bg-white/20 hover:bg-white/30'}`}
                title="Tabella"
              >
                <Table2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setFeeViewMode('cards')}
                className={`p-2 rounded-lg transition-colors text-white ${feeViewMode === 'cards' ? 'bg-white/30' : 'bg-white/20 hover:bg-white/30'}`}
                title="Card"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => { resetForm(); setShowCreateModal(true) }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors"
                  title="Nuova Quota"
                >
                  <Plus className="w-4 h-4" />
                  Nuova Quota
                </button>
              )}
            </div>
          ) : undefined}
        />
      )}
      
      <div className={isMobileView ? (deviceType === 'tablet' ? 'pt-2 px-4 pb-6 md:px-6 max-w-6xl mx-auto' : 'pt-2 px-3 pb-4 sm:px-4') : 'pt-2 px-6 pb-6'}>
          {/* Message */}
          {message && (
            <div className="mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded">
              {message}
              <button
                onClick={() => setMessage('')}
                className="ml-4 text-blue-500 hover:text-blue-700"
              >
                ✕
              </button>
            </div>
          )}

          {/* Tabs - subito sotto header principale */}
          <div className="mb-4">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`py-2 px-1 border-b-2 font-medium text-base focus:outline-none focus:ring-0 ${
                    activeTab === 'reports'
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-white hover:text-white hover:border-gray-300'
                  }`}
                >
                  Report
                </button>
                <button
                  onClick={() => setActiveTab('assignments')}
                  className={`py-2 px-1 border-b-2 font-medium text-base focus:outline-none focus:ring-0 ${
                    activeTab === 'assignments'
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-white hover:text-white hover:border-gray-300'
                  }`}
                >
                  Assegnazioni
                </button>
                <button
                  onClick={() => setActiveTab('fees')}
                  className={`py-2 px-1 border-b-2 font-medium text-base focus:outline-none focus:ring-0 ${
                    activeTab === 'fees'
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-white hover:text-white hover:border-gray-300'
                  }`}
                >
                  Quote
                </button>
              </nav>
            </div>
          </div>

          {/* Fees Tab */}
          {activeTab === 'fees' && (
            <div>
              {/* Campi di Ricerca */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cerca</label>
                    <input
                      type="text"
                      placeholder="Nome o descrizione..."
                      value={feeFilters.search}
                      onChange={(e) => setFeeFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={feeFilters.type}
                      onChange={(e) => setFeeFilters(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    >
                      <option value="all">Tutti i tipi</option>
                      {feeTypes.filter(type => type.value !== '').map(type => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select
                      value={feeFilters.category}
                      onChange={(e) => setFeeFilters(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    >
                      {categories.map(category => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                    <select
                      value={feeFilters.status}
                      onChange={(e) => setFeeFilters(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    >
                      <option value="all">Tutti gli stati</option>
                      <option value="active">✅ Attive</option>
                      <option value="inactive">❌ Inattive</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Importo Min (€)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={feeFilters.amountMin}
                      onChange={(e) => setFeeFilters(prev => ({ ...prev, amountMin: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Importo Max (€)</label>
                    <input
                      type="number"
                      placeholder="1000"
                      value={feeFilters.amountMax}
                      onChange={(e) => setFeeFilters(prev => ({ ...prev, amountMax: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  {(feeFilters.search !== '' || feeFilters.type !== 'all' || feeFilters.category !== 'all' || feeFilters.status !== 'all' || feeFilters.amountMin !== '' || feeFilters.amountMax !== '') && (
                    <button
                      type="button"
                      onClick={() => setFeeFilters({
                        search: '',
                        type: 'all',
                        category: 'all',
                        status: 'all',
                        amountMin: '',
                        amountMax: ''
                      })}
                      className="p-2 shrink-0 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Annulla filtri"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8 text-white/80">Caricamento...</div>
              ) : filteredFees.length === 0 ? (
                <div className="rounded-lg border border-white/20 bg-white/10 px-6 py-10 text-center text-white/90">
                  <p className="font-medium">Nessuna quota da mostrare</p>
                  <p className="mt-2 text-sm text-white/70">
                    {fees.length === 0
                      ? 'Il catalogo risulta vuoto oppure non hai permesso di vedere le quote (fees.view / ruolo club-wide). Se hai appena applicato le migration di sicurezza, applica anche 053_fix_fees_catalog_club_wide_access.sql.'
                      : 'Nessuna quota corrisponde ai filtri attuali. Prova a resettare ricerca, tipo, categoria o importi.'}
                  </p>
                  {message && (
                    <p className="mt-3 text-sm text-rose-200">{message}</p>
                  )}
                </div>
              ) : feeViewMode === 'table' ? (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nome
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Importo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Categoria
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stato
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Scadenza
                        </th>
                        {!isReadOnly && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Azioni
                          </th>
                        )}
                      </tr>
                    </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredFees
                            .sort((a, b) => {
                              // First sort by is_active (active first)
                              if (a.is_active !== b.is_active) {
                                return b.is_active ? 1 : -1
                              }
                              // Then by created_at (newest first)
                              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                            })
                            .map((fee) => (
                        <tr key={fee.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {fee.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {feeTypes.find(t => t.value === fee.type)?.label || fee.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(fee.amount / 100)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1">
                              {fee.applicable_categories && fee.applicable_categories.length > 0 ? (
                                fee.applicable_categories.map(category => (
                                  <span key={category} className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    getFeeCategoryBadgeColor(category)
                                  }`}>
                                    {categories.find(c => c.value === category)?.label || category}
                                  </span>
                                ))
                              ) : (
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  getFeeCategoryBadgeColor(fee.category)
                                }`}>
                                  {categories.find(c => c.value === fee.category)?.label || fee.category}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              fee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {fee.is_active ? 'Attiva' : 'Inattiva'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {fee.due_date ? new Date(fee.due_date).toLocaleDateString('it-IT') : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            {!isReadOnly && (
                              <>
                                <button
                                  onClick={() => handleEditFee(fee)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  Modifica
                                </button>
                                <button
                                  onClick={() => handleDeleteFee(fee.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Elimina
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedFee(fee)
                                    setShowAssignmentModal(true)
                                  }}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Assegna
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredFees
                        .sort((a, b) => {
                          // First sort by is_active (active first)
                          if (a.is_active !== b.is_active) {
                            return b.is_active ? 1 : -1
                          }
                          // Then by created_at (newest first)
                          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                        })
                        .map((fee) => (
                    <div key={fee.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">{fee.name}</h3>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          fee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {fee.is_active ? 'Attiva' : 'Inattiva'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Tipo:</span> {feeTypes.find(t => t.value === fee.type)?.label || fee.type}
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Importo:</span> {formatCurrency(fee.amount / 100)}
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Categorie:</span> 
                          <div className="flex flex-wrap gap-1 mt-1">
                            {fee.applicable_categories && fee.applicable_categories.length > 0 ? (
                              fee.applicable_categories.map(category => (
                                <span key={category} className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  getFeeCategoryBadgeColor(category)
                                }`}>
                                  {categories.find(c => c.value === category)?.label || category}
                                </span>
                              ))
                            ) : (
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                getFeeCategoryBadgeColor(fee.category)
                              }`}>
                                {categories.find(c => c.value === fee.category)?.label || fee.category}
                              </span>
                            )}
                          </div>
                        </p>
                        {fee.due_date && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Scadenza:</span> {new Date(fee.due_date).toLocaleDateString('it-IT')}
                          </p>
                        )}
                        {fee.description && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Descrizione:</span> {fee.description}
                          </p>
                        )}
                      </div>
                      
                      {!isReadOnly && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditFee(fee)}
                            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                          >
                            Modifica
                          </button>
                          <button
                            onClick={() => handleDeleteFee(fee.id)}
                            className="flex-1 bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700"
                          >
                            Elimina
                          </button>
                          <button
                            onClick={() => {
                              setSelectedFee(fee)
                              setShowAssignmentModal(true)
                            }}
                            className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700"
                          >
                            Assegna
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">Assegnazioni</h2>
                {!isReadOnly && (
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <span>➕</span>
                    Assegna Quote
                  </button>
                )}
              </div>

              {/* Status Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-white p-4 rounded-lg shadow min-h-[100px]">
                  <div className="flex items-stretch h-full gap-3">
                    <div className="flex-shrink-0 flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <span className="text-2xl">📊</span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0 w-full">
                      <p className="text-lg font-medium text-gray-600 w-full">Totale</p>
                      <p className="text-4xl font-bold text-gray-900 w-full">{assignmentStatusSummary.total}</p>
                      <p className="text-lg text-gray-500 w-full">{formatCurrency(assignmentStatusSummary.totalAmount)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow min-h-[100px]">
                  <div className="flex items-stretch h-full gap-3">
                    <div className="flex-shrink-0 flex items-center">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <span className="text-2xl">⏳</span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0 w-full">
                      <p className="text-lg font-medium text-gray-600 w-full">In Sospeso</p>
                      <p className="text-4xl font-bold text-yellow-600 w-full">{assignmentStatusSummary.pending}</p>
                      <p className="text-lg text-gray-500 w-full">{formatCurrency(assignmentStatusSummary.pendingAmount)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow min-h-[100px]">
                  <div className="flex items-stretch h-full gap-3">
                    <div className="flex-shrink-0 flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <span className="text-2xl">✅</span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0 w-full">
                      <p className="text-lg font-medium text-gray-600 w-full">Pagate</p>
                      <p className="text-4xl font-bold text-green-600 w-full">{assignmentStatusSummary.paid}</p>
                      <p className="text-lg text-gray-500 w-full">{formatCurrency(assignmentStatusSummary.paidAmount)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow min-h-[100px]">
                  <div className="flex items-stretch h-full gap-3">
                    <div className="flex-shrink-0 flex items-center">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <span className="text-2xl">⚠️</span>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center text-center min-w-0 w-full">
                      <p className="text-lg font-medium text-gray-600 w-full">Scadute</p>
                      <p className="text-4xl font-bold text-red-600 w-full">{assignmentStatusSummary.overdue}</p>
                      <p className="text-lg text-gray-500 w-full">{formatCurrency(assignmentStatusSummary.overdueAmount)}</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Assignment Filters - stessa logica del Report */}
              <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cerca per nome
                    </label>
                    <input
                      type="text"
                      value={assignmentFilters.search}
                      onChange={(e) => setAssignmentFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      placeholder="Nome persona..."
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoria
                    </label>
                    <select
                      value={assignmentFilters.category}
                      onChange={(e) => setAssignmentFilters(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    >
                      {categories.map(category => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data da
                    </label>
                    <input
                      type="date"
                      value={assignmentFilters.dateFrom}
                      onChange={(e) => setAssignmentFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data a
                    </label>
                    <input
                      type="date"
                      value={assignmentFilters.dateTo}
                      onChange={(e) => setAssignmentFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  {(assignmentFilters.search !== '' || assignmentFilters.category !== 'all' || assignmentFilters.status !== 'all' || assignmentFilters.dateFrom !== '' || assignmentFilters.dateTo !== '') && (
                    <button
                      onClick={() => setAssignmentFilters({
                        search: '',
                        category: 'all',
                        status: 'all',
                        dateFrom: '',
                        dateTo: ''
                      })}
                      className="p-2 shrink-0 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Annulla filtri"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs for filtering assignments */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg shadow mb-0">
                <div className="flex border-b border-gray-300">
                  <button
                    onClick={() => setAssignmentViewTab('all')}
                    className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                      assignmentViewTab === 'all'
                        ? 'border-blue-600 text-blue-700 bg-white'
                        : 'border-transparent text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    📋 Tutte
                  </button>
                  <button
                    onClick={() => setAssignmentViewTab('expiring')}
                    className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                      assignmentViewTab === 'expiring'
                        ? 'border-yellow-600 text-yellow-700 bg-white'
                        : 'border-transparent text-gray-700 hover:text-yellow-600 hover:bg-yellow-50'
                    }`}
                  >
                    ⏰ In Scadenza
                  </button>
                  <button
                    onClick={() => setAssignmentViewTab('overdue')}
                    className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                      assignmentViewTab === 'overdue'
                        ? 'border-red-600 text-red-700 bg-white'
                        : 'border-transparent text-gray-700 hover:text-red-600 hover:bg-red-50'
                    }`}
                  >
                    ❌ Scadute
                  </button>
                  <button
                    onClick={() => setAssignmentViewTab('paid')}
                    className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                      assignmentViewTab === 'paid'
                        ? 'border-green-600 text-green-700 bg-white'
                        : 'border-transparent text-gray-700 hover:text-green-600 hover:bg-green-50'
                    }`}
                  >
                    ✅ Pagate
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">Caricamento...</div>
              ) : (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Persona
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quota
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Categoria
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Importo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Importo Pagato
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stato
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Scadenza
                        </th>
                        {!isReadOnly && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Azioni
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAssignments.length === 0 ? (
                        <tr>
                          <td colSpan={isReadOnly ? 7 : 8} className="px-6 py-8 text-center text-gray-500">
                            Nessuna assegnazione trovata
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          // Raggruppa le assegnazioni per fee_id e person_id
                          const groupedAssignments = filteredAssignments.reduce((groups, assignment) => {
                            const key = `${assignment.fee_id}-${assignment.person_id}`
                            if (!groups[key]) {
                              groups[key] = []
                            }
                            groups[key].push(assignment)
                            return groups
                          }, {} as Record<string, typeof filteredAssignments>)
                          
                          // Converti in array e ordina per categoria e nome giocatore
                          const groupedArray = Object.values(groupedAssignments)
                            .map(group => {
                              // Ordina le assegnazioni del gruppo per installment_number
                              const sortedGroup = group.sort((a, b) => (a.installment_number || 1) - (b.installment_number || 1))
                              return sortedGroup
                            })
                            .sort((groupA, groupB) => {
                              const assignmentA = groupA[0]
                              const assignmentB = groupB[0]
                              const personA = assignmentA.people as any
                              const personB = assignmentB.people as any
                              
                              // Prima ordina per categoria (dalla più bassa alla più alta)
                              const categoryA = personA?.player_categories?.[0] || ''
                              const categoryB = personB?.player_categories?.[0] || ''
                              
                              // Mappa delle categorie per l'ordinamento (dalla più bassa alla più alta)
                              const categoryOrder = {
                                'U6': 1,
                                'U8': 2,
                                'U10': 3,
                                'U12': 4,
                                'U14': 5,
                                'U16': 6,
                                'U18': 7,
                                'SENIOR': 8,
                                'PODEROSA': 9,
                                'LEONESSE': 10
                              }
                              
                              const orderA = categoryOrder[categoryA as keyof typeof categoryOrder] || 999
                              const orderB = categoryOrder[categoryB as keyof typeof categoryOrder] || 999
                              
                              if (orderA !== orderB) {
                                return orderA - orderB
                              }
                              
                              // Se stessa categoria, ordina per nome giocatore (crescente)
                              const nameA = personA ? `${personA.given_name} ${personA.family_name}` : ''
                              const nameB = personB ? `${personB.given_name} ${personB.family_name}` : ''
                              return nameA.localeCompare(nameB, 'it')
                            })
                          
                          return groupedArray.map((assignmentGroup) => {
                            const assignment = assignmentGroup[0] // Usa la prima assegnazione come riferimento
                          const person = assignment.people as any
                          const fee = assignment.fees as any
                            
                            // Calcola il pagato correttamente
                            let paidAmount = 0
                            let remainingAmount = 0
                            let totalFeeAmount = 0
                            
                            if (fee.installments && fee.installments.length > 0) {
                              // Se la quota ha rate configurate, calcola dalle rate pagate
                              totalFeeAmount = fee.installments.reduce((sum: number, installment: any) => sum + installment.amount, 0)
                              
                              // Calcola il pagato dalle rate pagate nel gruppo
                              paidAmount = assignmentGroup
                                .filter(a => a.status === 'paid')
                                .reduce((sum, a) => {
                                  const installmentNumber = a.installment_number || 1
                                  const configuredInstallment = fee.installments[installmentNumber - 1]
                                  if (configuredInstallment) {
                                    return sum + configuredInstallment.amount
                                  }
                                  return sum + (a.amount / 100)
                                }, 0)
                              
                              remainingAmount = totalFeeAmount - paidAmount
                            } else {
                              // Se non ha rate, usa il campo paid_amount
                              totalFeeAmount = assignment.amount / 100
                              paidAmount = assignment.paid_amount || 0
                              remainingAmount = assignment.amount - paidAmount
                            }
                            
                            // Determina lo status della quota principale basandosi sulle rate
                            let mainStatus: 'pending' | 'paid' | 'overdue' | 'cancelled' = 'pending'
                            if (assignmentGroup.every(a => a.status === 'paid')) {
                              mainStatus = 'paid'
                            } else if (assignmentGroup.some(a => a.status === 'overdue')) {
                              mainStatus = 'overdue'
                            } else if (assignmentGroup.some(a => a.status === 'cancelled')) {
                              mainStatus = 'cancelled'
                            }
                            
                          const isExpanded = expandedAssignments[assignment.id] || false
                          
                          return (
                            <React.Fragment key={assignment.id}>
                              {/* Main assignment row - always clickable */}
                              <tr 
                                className={`${(() => {
                                  // Nel tab Pagate tutte le fasce sono verdi (solo rate/quote pagate)
                                  if (assignmentViewTab === 'paid') {
                                    return 'bg-green-50 hover:bg-green-100'
                                  }
                                  const unpaidInstallments = assignmentGroup
                                    .filter(a => a.status !== 'paid')
                                    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                                  const nextDueDate = unpaidInstallments.length > 0 ? unpaidInstallments[0].due_date : null
                                  return getRowBackgroundColor({...assignment, status: mainStatus, due_date: nextDueDate || assignment.due_date} as FeeAssignment, fee)
                                })()} cursor-pointer hover:opacity-80 ${isExpanded ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
                                onClick={() => toggleAssignmentExpansion(assignment.id)}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-lg font-medium text-gray-900">
                                  <div className="flex items-center">
                                    <span className="mr-2">
                                      {isExpanded ? '▼' : '▶'}
                                    </span>
                                    {person ? `${person.given_name} ${person.family_name}` : 'N/A'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-lg text-gray-500">
                                  {fee?.name || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                                    getPlayerCategoryColor(person)
                                  }`}>
                                    {getPlayerCategory(person)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-lg text-gray-500">
                                  {formatCurrency(totalFeeAmount)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-lg text-gray-500">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-green-600">
                                      {formatCurrency(paidAmount)}
                                      {assignmentGroup.length > 1 && (
                                        <span className="ml-2 text-sm text-gray-500">
                                          ({assignmentGroup.filter(a => a.status === 'paid').length}/{assignmentGroup.length})
                                        </span>
                                      )}
                                    </span>
                                    {remainingAmount > 0 && (
                                      <span className="text-sm text-red-500">
                                        Residuo: {formatCurrency(remainingAmount)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                                    statusColors[mainStatus]
                                  }`}>
                                    {mainStatus === 'pending' && 'Regolare'}
                                    {mainStatus === 'paid' && 'Pagato'}
                                    {mainStatus === 'overdue' && 'Scaduto'}
                                    {mainStatus === 'cancelled' && 'Annullato'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-lg text-gray-500">
                                  {(() => {
                                    // Trova la prossima rata non pagata (in ordine di scadenza)
                                    const unpaidInstallments = assignmentGroup
                                      .filter(a => a.status !== 'paid')
                                      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                                    
                                    // Se ci sono rate non pagate, mostra la prima in scadenza
                                    if (unpaidInstallments.length > 0) {
                                      return new Date(unpaidInstallments[0].due_date).toLocaleDateString('it-IT')
                                    }
                                    
                                    // Se tutte pagate, mostra la data dell'ultima rata pagata
                                    const lastPaid = assignmentGroup
                                      .filter(a => a.status === 'paid')
                                      .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())[0]
                                    
                                    return lastPaid?.due_date ? new Date(lastPaid.due_date).toLocaleDateString('it-IT') : '-'
                                  })()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-lg text-gray-500">
                                  {!isReadOnly && (
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          window.location.href = `/create-person?edit=${person.id}&tab=fees&from=assignments`
                                        }}
                                        className="text-blue-600 hover:text-blue-800 transition-colors"
                                        title="Apri scheda persona"
                                      >
                                        👤
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteAssignment(assignment.id)
                                        }}
                                        className="text-red-600 hover:text-red-800 transition-colors"
                                        title="Elimina assegnazione"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                              
                              {/* Installments accordion row */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={isReadOnly ? 7 : 8} className="px-6 py-4 bg-blue-100">
                                    <div className="space-y-3">
                                      <h4 className="text-lg font-medium text-gray-900 mb-3">
                                        {assignmentViewTab === 'paid' ? 'Rate pagate della quota' : 'Rate della quota'}
                                      </h4>
                                        <div className="space-y-2">
                                        {(assignmentViewTab === 'paid' ? assignmentGroup.filter(a => a.status === 'paid') : assignmentGroup).map((assignmentItem, index) => {
                                          const installmentNumber = assignmentItem.installment_number || (index + 1)
                                          const installmentStatus = assignmentItem.status
                                          const installmentPaidAt = assignmentItem.paid_at
                                          const installmentPaymentMethod = assignmentItem.payment_method
                                          const installmentAmount = assignmentItem.amount / 100
                                          const installmentDueDate = assignmentItem.due_date
                                          const installmentNotes = assignmentItem.notes
                                          
                                          // Calcola se la rata è stata pagata in ritardo
                                          let isLatePayment = false
                                          let daysLate = 0
                                          if (installmentStatus === 'paid' && installmentPaidAt && installmentDueDate) {
                                            const paidDate = new Date(installmentPaidAt)
                                            const dueDate = new Date(installmentDueDate)
                                            daysLate = Math.ceil((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                                            isLatePayment = daysLate > 0
                                          }
                                            
                                            return (
                                            <div key={assignmentItem.id} className={`p-4 rounded-lg border ${
                                              installmentStatus === 'paid' ? 'bg-blue-50 border-blue-200' :
                                                installmentStatus === 'overdue' ? 'bg-red-50 border-red-200' :
                                                'bg-white border-gray-200'
                                              }`}>
                                                <div className="flex justify-between items-center gap-4">
                                                  <div className="flex-1">
                                                    <div className="flex items-center space-x-4">
                                                    <span className="text-lg font-medium text-gray-900">
                                                      Rata {installmentNumber}: {formatCurrency(installmentAmount)}
                                                      </span>
                                                    <span className="text-base text-gray-500">
                                                      ({installmentNotes || (installmentNumber === 1 ? 'Acconto' : installmentNumber === assignmentGroup.length ? 'Saldo' : 'Rata')})
                                                      </span>
                                                    <span className="text-base text-gray-500">
                                                      Scadenza: {new Date(installmentDueDate).toLocaleDateString('it-IT')}
                                                      </span>
                                                    </div>
                                                    <div className="mt-2">
                                                    <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                                                        installmentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                                                        installmentStatus === 'overdue' ? 'bg-red-100 text-red-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                      }`}>
                                                        {installmentStatus === 'paid' ? '✅ Pagata' :
                                                         installmentStatus === 'overdue' ? '❌ Scaduta' :
                                                         '⏳ In attesa'}
                                                      </span>
                                                      {installmentPaidAt && (
                                                      <span className={`ml-2 text-base ${isLatePayment ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                                          Pagata il: {new Date(installmentPaidAt).toLocaleDateString('it-IT')}
                                                        {isLatePayment && (
                                                            <span className="ml-1 font-semibold">
                                                              ({daysLate} giorni di ritardo)
                                                            </span>
                                                          )}
                                                        </span>
                                                      )}
                                                      {installmentPaymentMethod && (
                                                        <span className="ml-2 text-base text-gray-500">
                                                          ({installmentPaymentMethod === 'cash' ? 'Contanti' :
                                                            installmentPaymentMethod === 'bank_transfer' ? 'Bonifico' :
                                                            installmentPaymentMethod === 'card' ? 'Carta' : 'Altro'})
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                  {!isReadOnly && (
                                                    <div className="flex items-center gap-2 shrink-0 mr-4" onClick={(e) => e.stopPropagation()}>
                                                      {installmentStatus === 'paid' && assignmentReceiptsMap[assignmentItem.id] && (
                                                        <a
                                                          href={assignmentReceiptsMap[assignmentItem.id]}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-blue-600 hover:text-blue-800 transition-colors"
                                                          title="Apri ricevuta PDF"
                                                        >
                                                          <FileText className="w-5 h-5" aria-hidden />
                                                        </a>
                                                      )}
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          if (installmentStatus === 'paid') {
                                                            handleGenerateReceiptClick(assignmentItem, assignmentGroup, person, fee)
                                                          } else {
                                                            const personName = person ? `${person.given_name || ''} ${person.family_name || ''}`.trim() || 'N/A' : 'N/A'
                                                            handleSendWhatsAppReminder(assignment.person_id, personName, installmentDueDate || '', installmentAmount, assignment.fee_id)
                                                          }
                                                        }}
                                                        className="text-green-600 hover:text-green-800 transition-colors"
                                                        title={installmentStatus === 'paid' ? 'Genera ricevuta' : 'Invia sollecito via WhatsApp'}
                                                      >
                                                        <Send className="w-5 h-5" aria-hidden />
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>

                                        {/* Payment History Section */}
                                        {assignmentPayments[assignment.id] && assignmentPayments[assignment.id].length > 0 && (
                                          <div className="mt-6 pt-4 border-t border-blue-300">
                                            <h4 className="text-lg font-medium text-gray-900 mb-3">
                                              Storico Pagamenti
                                            </h4>
                                            <div className="space-y-2">
                                              {assignmentPayments[assignment.id].map((payment: any) => (
                                                <div key={payment.id} className="p-3 rounded-lg bg-white border border-blue-200">
                                                  <div className="flex justify-between items-center">
                                                    <div className="flex-1">
                                                      <div className="flex items-center space-x-3">
                                                        <span className="text-base font-medium text-gray-900">
                                                          {formatCurrency(fromCents(payment.amount))}
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                          {new Date(payment.payment_date).toLocaleDateString('it-IT')}
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                          ({payment.payment_method === 'cash' ? 'Contanti' :
                                                            payment.payment_method === 'bank_transfer' ? 'Bonifico' :
                                                            payment.payment_method === 'card' ? 'Carta' : 'Altro'})
                                                        </span>
                                                        {payment.reference && (
                                                          <span className="text-sm text-gray-500">
                                                            Rif: {payment.reference}
                                                          </span>
                                                        )}
                                                      </div>
                                                      {payment.notes && (
                                                        <div className="mt-1 text-sm text-gray-600">
                                                          Note: {payment.notes}
                                                        </div>
                                                      )}
                                                    </div>
                                                    {!isReadOnly && (
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          handleVoidPayment(payment.id, assignment.id)
                                                        }}
                                                        className="ml-3 text-red-600 hover:text-red-800 transition-colors"
                                                        title="Annulla pagamento"
                                                      >
                                                        <Trash2 className="w-4 h-4" />
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Report Filters */}
              <div className="bg-white rounded-lg shadow p-6 relative">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Inizio
                    </label>
                    <input
                      type="date"
                      value={reportFilters.dateFrom}
                      onChange={(e) => handleReportDateFromChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Fine
                    </label>
                    <input
                      type="date"
                      value={reportFilters.dateTo}
                      onChange={(e) => handleReportDateToChange(e.target.value)}
                      max={`${parseInt(reportFilters.dateFrom.slice(0, 4), 10) + 1}-06-30`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoria
                    </label>
                    <select
                      value={reportFilters.category}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    >
                      {categories.map(category => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(reportFilters.category !== 'all' || reportFilters.dateFrom !== getSeasonStartDate() || reportFilters.dateTo !== todayStr()) && (
                    <button
                      onClick={() => setReportFilters({
                        dateFrom: getSeasonStartDate(),
                        dateTo: todayStr(),
                        category: 'all'
                      })}
                      className="p-2 shrink-0 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Annulla filtri"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Totale Quote Card */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <span className="text-lg">📋</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-blue-100">Totale Quote</p>
                      <p className="text-2xl font-bold">{formatCurrency(reportData.totalAssignedFees || 0)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <span className="text-lg">💰</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-green-100">Incassi Totali</p>
                      <p className="text-2xl font-bold">{formatCurrency(reportData.totalRevenue)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg shadow p-6 text-white">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <span className="text-lg">⏳</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-yellow-100">In Sospeso</p>
                      <p className="text-2xl font-bold">{formatCurrency(reportData.totalPending)}</p>
                    </div>
                  </div>
                </div>

                <div 
                  className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg shadow p-6 text-white cursor-pointer hover:from-red-600 hover:to-red-700 transition-colors duration-200"
                  onClick={() => {
                    // Cambia al tab Assegnazioni
                    setActiveTab('assignments')
                    // Imposta il filtro per le assegnazioni scadute
                    setAssignmentViewTab('overdue')
                  }}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <span className="text-lg">⚠️</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-red-100">Scadute</p>
                      <p className="text-2xl font-bold">{formatCurrency(reportData.totalOverdue)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Revenue Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">📈 Incassi Mensili</h3>
                  <div className="space-y-3">
                    {reportData.monthlyRevenue.length > 0 ? (
                      reportData.monthlyRevenue.map((item, index) => {
                        const maxAmount = Math.max(...reportData.monthlyRevenue.map(m => m.amount))
                        const percentage = (item.amount / maxAmount) * 100
                        return (
                          <div key={index} className="flex items-center space-x-3">
                            <div className="w-20 text-sm text-gray-600">{item.month}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-4">
                              <div 
                                className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <div className="w-20 text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(item.amount)}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-4">Nessun dato disponibile</p>
                    )}
                  </div>
                </div>

                {/* Payment Methods Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">💳 Metodi di Pagamento</h3>
                  <div className="space-y-3">
                    {reportData.paymentMethods.length > 0 ? (
                      reportData.paymentMethods.map((method, index) => {
                        const totalAmount = reportData.paymentMethods.reduce((sum, m) => sum + m.amount, 0)
                        const percentage = (method.amount / totalAmount) * 100
                        const methodLabels = {
                          'contanti': 'Contanti',
                          'bonifico': 'Bonifico',
                          'carta': 'Carta',
                          'altro': 'Altro'
                        }
                        return (
                          <div key={index} className="flex items-center space-x-3">
                            <div className="w-20 text-sm text-gray-600">{methodLabels[method.method as keyof typeof methodLabels] || method.method}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-4">
                              <div 
                                className="bg-green-500 h-4 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <div className="w-20 text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(method.amount)}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-4">Nessun dato disponibile</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Statistics */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">📊 Statistiche per Categoria</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Totale</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pagato</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In Sospeso</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scaduto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Pagato</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.categoryStats.map((stat, index) => {
                        const paidPercentage = stat.total > 0 ? (stat.paid / stat.total) * 100 : 0
                        const isTotalRow = stat.category === 'Tutti'
                        const barColor = paidPercentage >= 80 ? 'bg-green-500' : paidPercentage >= 60 ? 'bg-orange-500' : 'bg-red-500'
                        return (
                          <tr key={index} className={`hover:bg-gray-50 ${isTotalRow ? 'bg-blue-50 font-semibold' : ''}`}>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isTotalRow ? 'text-blue-900' : 'text-gray-900'}`}>
                              {stat.category}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(stat.total)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                              {formatCurrency(stat.paid)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                              {formatCurrency(stat.pending)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                              {formatCurrency(stat.overdue)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-gray-200 rounded-full h-4 min-w-[100px]">
                                  <div 
                                    className={`${barColor} h-4 rounded-full transition-all duration-300`}
                                    style={{ width: `${paidPercentage}%` }}
                                  ></div>
                                </div>
                                <span className="font-semibold text-gray-900 min-w-[50px]">{paidPercentage.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>


              {/* Statistiche Dettagliate */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">📈 Statistiche Dettagliate</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    const assignments = reportData.assignments || []
                    const totalToCollect = (reportData.totalRevenue || 0) + (reportData.totalPending || 0) + (reportData.totalOverdue || 0)
                    const paidAssignments = assignments.filter(a => a.status === 'paid')
                    const paidOnTime = paidAssignments.filter(a => {
                      if (!a.paid_at || !a.due_date) return false
                      return new Date(a.paid_at) <= new Date(a.due_date)
                    })
                    const quoteRegolariPct = paidAssignments.length > 0 ? (paidOnTime.length / paidAssignments.length) * 100 : 0
                    const inSospesoPct = totalToCollect > 0 ? ((reportData.totalPending || 0) / totalToCollect) * 100 : 0
                    const todayForOverdue = new Date()
                    todayForOverdue.setHours(0, 0, 0, 0)
                    const overdueCount = assignments.filter(a => {
                      if (a.status === 'paid') return false
                      if (!a.due_date) return false
                      const due = new Date(a.due_date)
                      return due < todayForOverdue
                    }).length
                    const scadutePct = totalToCollect > 0 ? ((reportData.totalOverdue || 0) / totalToCollect) * 100 : 0
                    const incassiPct = totalToCollect > 0 ? ((reportData.totalRevenue || 0) / totalToCollect) * 100 : 0
                    return (
                      <>
                        {/* QUOTE REGOLARI: % pagate entro scadenza */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-blue-700">Quote Regolari</p>
                              <p className="text-2xl font-bold text-blue-900">
                                {quoteRegolariPct.toFixed(1)}%
                              </p>
                              <p className="text-xs text-blue-600 mt-1">Pagate entro scadenza</p>
                            </div>
                            <div className="p-2 bg-blue-500 rounded-lg">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* IN SOSPESO: % importo in sospeso sul totale */}
                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-700">In Sospeso</p>
                              <p className="text-2xl font-bold text-green-900">
                                {inSospesoPct.toFixed(1)}%
                              </p>
                              <p className="text-xs text-green-600 mt-1">Sul totale da incassare</p>
                            </div>
                            <div className="p-2 bg-green-500 rounded-lg">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* SCADUTE: % importo scaduto + numero rate */}
                        <div 
                          className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200 cursor-pointer hover:from-red-100 hover:to-red-200 transition-colors duration-200"
                          onClick={() => {
                            setActiveTab('assignments')
                            setAssignmentViewTab('overdue')
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-red-700">Scadute</p>
                              <p className="text-2xl font-bold text-red-900">
                                {scadutePct.toFixed(1)}% <span className="text-lg font-normal">({overdueCount})</span>
                              </p>
                              <p className="text-xs text-red-600 mt-1">Sul totale da incassare</p>
                            </div>
                            <div className="p-2 bg-red-500 rounded-lg">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* % INCASSI: % incassato sul totale */}
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-purple-700">% Incassi (€)</p>
                              <p className="text-2xl font-bold text-purple-900">
                                {incassiPct.toFixed(1)}%
                              </p>
                              <p className="text-xs text-purple-600 mt-1">Incassato su totale da incassare</p>
                            </div>
                            <div className="p-2 bg-purple-500 rounded-lg">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Create/Edit Fee Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
              <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/20">
                <div>
                  <div className="flex justify-between items-start gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-5 text-white">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">Quote iscrizione</p>
                      <h3 className="mt-1 text-2xl font-bold tracking-tight">
                      {editingFee ? 'Modifica Quota' : 'Nuova Quota'}
                      </h3>
                      <p className="mt-2 text-sm text-slate-300">Configura importo, categorie e scadenze in un unico pannello ordinato.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false)
                        resetForm()
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[0px] text-white transition hover:bg-white/20"
                      aria-label="Chiudi"
                    >
                      <X className="h-5 w-5" />
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 bg-slate-50 px-6 py-4 md:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Importo quota</p>
                      <p className="mt-1 text-xl font-bold text-slate-950">{formatCurrency(formData.amount / 100)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Rate configurate</p>
                      <p className="mt-1 text-xl font-bold text-slate-950">{formData.installments.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Totale rate</p>
                      <p className="mt-1 text-xl font-bold text-emerald-700">{formatCurrency(calculateTotalInstallments())}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Stato</p>
                      <p className="mt-1 text-xl font-bold text-slate-950">{formData.is_active ? 'Attiva' : 'Inattiva'}</p>
                    </div>
                  </div>
                  
                  <form onSubmit={editingFee ? handleUpdateFee : handleCreateFee} className="max-h-[calc(100vh-7rem)] space-y-5 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,1.35fr)_minmax(220px,0.9fr)_minmax(210px,0.7fr)]">
                      {/* Nome Quota */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nome Quota *
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                          placeholder="Es. Tessera Under 18"
                        />
                        {formData.type && formData.category && (
                          <p className="mt-1 text-xs text-gray-500">
                            Suggerimento: {generateSuggestedFeeName(formData.type, selectedCategories[0] || 'all')}
                          </p>
                        )}
                      </div>

                      {/* Tipo Quota */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo Quota *
                        </label>
                        <select
                          name="type"
                          value={formData.type}
                          onChange={handleInputChange}
                          required
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                        >
                          {feeTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Importo */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Importo *
                        </label>
                        <div className="grid grid-cols-[minmax(92px,1fr)_74px] gap-2">
                          <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleInputChange}
                            required
                            min="0"
                            step="0.01"
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                            placeholder="0.00"
                          />
                          <select
                            name="currency"
                            value={formData.currency}
                            onChange={handleInputChange}
                            className="rounded-xl border border-slate-300 bg-white px-2 py-3 text-sm font-semibold text-slate-950 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                          >
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Descrizione */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrizione
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                        placeholder="Aggiungi eventuali note interne o dettagli della quota..."
                      />
                    </div>

                    {/* Categorie */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Categorie *
                      </label>
                      {formData.type ? (
                        formData.type === 'membership' ? (
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                            {categories.map(category => {
                              const selected = selectedCategories.includes(category.value)
                              return (
                                <label
                                  key={category.value}
                                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                                    selected
                                      ? 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm ring-2 ring-blue-100'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => handleCategoryChange(category.value)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${category.color}`}>
                                    {category.label}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        ) : (
                          <select
                            name="category"
                            value={selectedCategories[0] || 'all'}
                            onChange={(e) => setSelectedCategories([e.target.value])}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                          >
                            {categories.map(category => (
                              <option key={category.value} value={category.value}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        )
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">
                          Seleziona prima un tipo di quota.
                        </div>
                      )}
                    </div>

                    {/* Data di scadenza */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data di scadenza
                      </label>
                      <input
                        type="date"
                        name="due_date"
                        value={formData.due_date}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    {/* Modalità di Pagamento */}
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-xl">
                      <h4 className="text-base font-bold text-white">Modalita di pagamento</h4>
                      <p className="text-sm text-slate-300">Definisci se incassare tutto insieme o a rate.</p>
                      
                      <div>
                        <label className="block text-sm font-semibold text-slate-200 mb-2">
                          Tipo di Pagamento
                        </label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className={`cursor-pointer rounded-xl border p-3 transition ${formData.payment_mode === 'single' ? 'border-blue-400 bg-blue-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                            <input
                              type="radio"
                              name="payment_mode"
                              value="single"
                              checked={formData.payment_mode === 'single'}
                              onChange={handleInputChange}
                              className="sr-only"
                            />
                            <span className="block text-sm font-bold">Pagamento Unico</span>
                          </label>
                          <label className={`cursor-pointer rounded-xl border p-3 transition ${formData.payment_mode === 'installments' ? 'border-blue-400 bg-blue-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                            <input
                              type="radio"
                              name="payment_mode"
                              value="installments"
                              checked={formData.payment_mode === 'installments'}
                              onChange={handleInputChange}
                              className="sr-only"
                            />
                            <span className="block text-sm font-bold">Rate</span>
                          </label>
                        </div>
                      </div>

                      {/* Configurazione Rate Manuali */}
                      {(formData.payment_mode === 'installments' || formData.payment_mode === 'single') && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
                          <div className="flex justify-between items-center mb-4">
                            <h5 className="text-base font-bold text-slate-950">
                              {formData.payment_mode === 'single' ? 'Rate Pagamento Unico' : 'Configurazione Rate'}
                            </h5>
                            <button
                              type="button"
                              onClick={addInstallment}
                              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                            >
                              <Plus className="h-4 w-4" />
                              Rata
                            </button>
                          </div>
                          
                          {formData.payment_mode === 'single' && (
                            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                              <p className="text-sm text-blue-800">
                                <strong>Pagamento Unico:</strong> Configurazione automatica con 2 rate (50 + 250)
                              </p>
                            </div>
                          )}
                          
                          {formData.installments.length > 0 ? (
                            <div className="space-y-3">
                              {formData.installments.map((installment, index) => (
                                <div key={index} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                                  <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                                      Rata {index + 1} - Importo
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={installment.amount}
                                      onChange={(e) => updateInstallment(index, 'amount', parseFloat(e.target.value) || 0)}
                                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                                      Data Scadenza
                                    </label>
                                    <input
                                      type="date"
                                      value={installment.due_date}
                                      onChange={(e) => updateInstallment(index, 'due_date', e.target.value)}
                                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                                      Note (opzionale)
                                    </label>
                                    <input
                                      type="text"
                                      value={installment.notes || ''}
                                      onChange={(e) => updateInstallment(index, 'notes', e.target.value)}
                                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                      placeholder="Note..."
                                    />
                                  </div>
                                  
                                  <div className="flex items-end">
                                    <button
                                      type="button"
                                      onClick={() => removeInstallment(index)}
                                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Rimuovi
                                    </button>
                                  </div>
                                </div>
                              ))}
                              
                              {/* Riepilogo Totale */}
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold text-slate-600">Totale Rate:</span>
                                  <span className="text-xl font-bold text-emerald-700">
                                    {formatCurrency(calculateTotalInstallments())}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-sm text-slate-500">Importo Quota:</span>
                                  <span className="text-sm font-bold text-slate-950">
                                    {formatCurrency(formData.amount / 100)}
                                  </span>
                                </div>
                                {Math.abs(calculateTotalInstallments() - formData.amount) > 0.01 && (
                                  <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                    Attenzione: il totale rate non corrisponde all'importo della quota.
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                              <p className="text-sm font-bold text-slate-700">Nessuna rata configurata</p>
                              <p className="text-xs mt-1 text-slate-500">Usa il pulsante Rata per creare il piano di pagamento.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Opzioni */}
                    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
                      <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${formData.is_active ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                        <span>
                          <span className="block text-sm font-bold text-slate-900">Attiva</span>
                          <span className="block text-xs text-slate-500">La quota puo essere assegnata.</span>
                        </span>
                        <input
                          type="checkbox"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={handleInputChange}
                          className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </label>
                      <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${formData.is_mandatory ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                        <span>
                          <span className="block text-sm font-bold text-slate-900">Obbligatoria</span>
                          <span className="block text-xs text-slate-500">Evidenzia la quota come richiesta.</span>
                        </span>
                        <input
                          type="checkbox"
                          name="is_mandatory"
                          checked={formData.is_mandatory}
                          onChange={handleInputChange}
                          className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                    </div>

                    {/* Buttons */}
                    <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateModal(false)
                          resetForm()
                        }}
                        className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        Annulla
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? 'Salvataggio...' : (editingFee ? 'Aggiorna quota' : 'Crea quota')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Fee Assignment Modal */}
      <FeeAssignmentModal
        isOpen={showAssignmentModal}
        onClose={() => {
          setShowAssignmentModal(false)
          setSelectedFee(null)
        }}
        selectedFee={selectedFee}
        onAssignmentCreated={() => {
          loadAssignments()
          setMessage('Assegnazioni create con successo!')
        }}
      />

      {/* Edit Assignment Modal */}
      {showEditAssignmentModal && editingAssignment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-[90%] max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Modifica Assegnazione
              </h3>
              <form onSubmit={handleUpdateAssignment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giocatore
                  </label>
                  <input
                    type="text"
                    value={editingAssignment.people ? `${(editingAssignment.people as any).given_name} ${(editingAssignment.people as any).family_name}` : 'N/A'}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quota
                  </label>
                  <input
                    type="text"
                    value={(editingAssignment.fees as any)?.name || 'N/A'}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Scadenza
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    value={editAssignmentData.due_date}
                    onChange={handleEditAssignmentInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note
                  </label>
                  <textarea
                    name="notes"
                    value={editAssignmentData.notes}
                    onChange={handleEditAssignmentInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Note aggiuntive..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditAssignmentModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? 'Salvataggio...' : 'Salva Modifiche'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedAssignment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-[90%] max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Registra Pagamento
                </h3>
                <button
                  onClick={() => {
                    setShowPaymentModal(false)
                    setSelectedAssignment(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Dettagli Assegnazione</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Persona:</span>
                    <p className="font-medium">
                      {(selectedAssignment.people as any)?.given_name} {(selectedAssignment.people as any)?.family_name}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Quota:</span>
                    <p className="font-medium">{(selectedAssignment.fees as any)?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Importo Totale:</span>
                    <p className="font-medium">{formatCurrency(selectedAssignment.amount / 100)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Già Pagato:</span>
                    <p className="font-medium text-green-600">{formatCurrency((selectedAssignment.paid_amount || 0) / 100)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Residuo:</span>
                    <p className="font-medium text-red-600">
                      {formatCurrency((selectedAssignment.amount - (selectedAssignment.paid_amount || 0)) / 100)}
                    </p>
                  </div>
                </div>
              </div>
              
              <form onSubmit={handleRegisterPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Importo Pagamento *
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={paymentData.amount}
                    onChange={handlePaymentInputChange}
                    required
                    min="0.01"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Metodo di Pagamento *
                  </label>
                  <select
                    name="payment_method"
                    value={paymentData.payment_method}
                    onChange={handlePaymentInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cash">Contanti</option>
                    <option value="bank_transfer">Bonifico Bancario</option>
                    <option value="card">Carta di Credito/Debito</option>
                    <option value="other">Altro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Pagamento *
                  </label>
                  <input
                    type="date"
                    name="payment_date"
                    value={paymentData.payment_date}
                    onChange={handlePaymentInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Riferimento (opzionale)
                  </label>
                  <input
                    type="text"
                    name="reference"
                    value={paymentData.reference}
                    onChange={handlePaymentInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Numero bonifico, ricevuta, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (opzionale)
                  </label>
                  <textarea
                    name="notes"
                    value={paymentData.notes}
                    onChange={handlePaymentInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Note aggiuntive..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentModal(false)
                      setSelectedAssignment(null)
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? 'Registrazione...' : 'Registra Pagamento'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal completo per assegnazione quote */}
      <CompleteFeeAssignmentModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onAssignmentCreated={() => {
          loadAssignments()
          setMessage('Assegnazioni create con successo!')
        }}
      />

      {/* Modal per pagamenti delle rate - replica esatta di CreatePersonView */}
      {showInstallmentPaymentModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Gestione Pagamenti</h3>
              <button
                onClick={() => {
                  setShowInstallmentPaymentModal(false)
                  setSelectedAssignment(null)
                  setSelectedInstallments({})
                  setPaymentInstallments([])
                  setPaymentMethods({})
                  setPaymentDates({})
                  setInitialPaymentStatus({})
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Header della quota */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">
                  {selectedAssignment.fees?.name || 'Quota'}
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  {selectedAssignment.fees?.description}
                </p>
                <div className="text-sm text-gray-700">
                  <span className="font-medium">Tipo Pagamento:</span> 
                  <span className="ml-2">
                    {paymentInstallments.length === 2 && 
                     paymentInstallments[0]?.notes === 'Acconto' && 
                     paymentInstallments[1]?.notes === 'Saldo' 
                      ? 'Pagamento Unico' 
                      : 'Rate'
                    }
                  </span>
                </div>
              </div>
              
              {/* Pulsanti di conversione */}
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h5 className="font-medium text-yellow-900 mb-3">Opzioni di Conversione</h5>
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                    Converti in Pagamento Unico
                  </button>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                    Converti in Rate
                  </button>
                </div>
                <p className="text-xs text-yellow-700 mt-2">
                  ⚠️ La conversione cancellerà le modifiche non salvate
                </p>
              </div>

              {/* Lista delle rate */}
              <div className="space-y-3">
                <h5 className="font-medium text-gray-900">Seleziona le rate da segnare come pagate:</h5>
                
                {paymentInstallments.map((installment, index) => (
                    <div key={installment.id} className={`p-4 rounded-lg ${
                      (() => {
                        if (installment.status === 'paid') {
                          // Pagata - controlla se in ritardo o in tempo
                          const daysLate = calculateDaysLate(installment.due_date, installment.paid_at)
                          return daysLate > 0 ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'
                        } else {
                          // Non pagata - controlla se scaduta o regolare
                          const status = getInstallmentStatus(installment.due_date)
                          return status === 'overdue' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                        }
                      })()
                    }`}>
                      {/* Prima riga: Checkbox, dettagli rata e stato */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`installment-${installment.id}`}
                            checked={selectedInstallments[installment.id] || false}
                            onChange={() => handleInstallmentToggle(installment.id, index)}
                            disabled={!canEditInstallment(index)}
                            className={`w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 ${
                              !canEditInstallment(index) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          />
                          <div>
                            <label 
                              htmlFor={`installment-${installment.id}`} 
                              className={`font-medium ${!canEditInstallment(index) ? 'text-gray-500' : 'text-gray-900'}`}
                            >
                              Rata {installment.installment_number}
                            </label>
                            {!canEditInstallment(index) && (
                              <p className="text-sm text-gray-500 italic">
                                Devi pagare la rata precedente
                              </p>
                            )}
                            <p className="text-sm text-gray-900">
                              {formatCurrency(installment.amount)} ({installment.notes})
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                              Scadenza: {new Date(installment.due_date).toLocaleDateString('it-IT')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {installment.status === 'paid' ? (
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              calculateDaysLate(installment.due_date, installment.paid_at) > 0 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {calculateDaysLate(installment.due_date, installment.paid_at) > 0 
                                ? `✅ Pagata (${calculateDaysLate(installment.due_date, installment.paid_at)} giorni di ritardo)`
                                : '✅ Pagata in tempo'
                              }
                            </span>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              getInstallmentStatus(installment.due_date) === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {getInstallmentStatus(installment.due_date) === 'overdue' ? '❌ Scaduta' : '⏳ Regolare'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Seconda riga: Metodo di pagamento e data (solo se selezionata) */}
                      {(() => {
                        const isSelected = selectedInstallments[installment.id]
                        const canEdit = canEditInstallment(index)
                        console.log(`🔍 DEBUG Rata ${index + 1}:`, {
                          installmentId: installment.id,
                          isSelected,
                          canEdit,
                          showFields: isSelected && canEdit
                        })
                        return isSelected && canEdit
                      })() && (
                        <div className="pl-8 pt-2 border-t border-gray-200">
                          <div className="space-y-3">
                            {/* Metodo di pagamento */}
                            <div className="flex items-center space-x-4">
                              <span className="text-sm font-medium text-gray-900">Metodo di pagamento:</span>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`paymentMethod-${installment.id}`}
                                  value="contanti"
                                  checked={paymentMethods[installment.id] === 'contanti'}
                                  onChange={(e) => handlePaymentMethodChange(installment.id, e.target.value)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Contanti</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`paymentMethod-${installment.id}`}
                                  value="bonifico"
                                  checked={paymentMethods[installment.id] === 'bonifico'}
                                  onChange={(e) => handlePaymentMethodChange(installment.id, e.target.value)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Bonifico</span>
                              </label>
                            </div>
                            
                            {/* Data di pagamento */}
                            <div className="flex items-center space-x-4">
                              <span className="text-sm font-medium text-gray-900">Data di pagamento:</span>
                              <input
                                type="date"
                                value={paymentDates[installment.id] || new Date().toISOString().split('T')[0]}
                                onChange={(e) => handlePaymentDateChange(installment.id, e.target.value)}
                                className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                ))}
              </div>

              {/* Pulsanti di azione */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowInstallmentPaymentModal(false)
                    setSelectedAssignment(null)
                    setSelectedInstallments({})
                    setPaymentInstallments([])
                    setPaymentMethods({})
                    setPaymentDates({})
                    setInitialPaymentStatus({})
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Annulla
                </button>
                <button 
                  onClick={handlePaymentSubmit}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Registra Pagamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <WhatsAppOpenModal
        isOpen={whatsAppModal.open}
        url={whatsAppModal.url}
        onClose={() => setWhatsAppModal({ open: false, url: '' })}
        waitForReturn
        onAfterSend={() => {
          setWhatsAppModal(prev => ({ ...prev, open: false }))
          setWhatsAppConfirmModal(true)
        }}
      />

      {/* Modal: Scegli destinatario ricevuta */}
      {receiptRecipientModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Destinatario ricevuta</h3>
            <p className="text-gray-600 text-sm mb-4">Scegli a chi intestare la ricevuta (un solo destinatario).</p>
            <div className="space-y-2 mb-4">
              {receiptRecipientModal.recipients.map(r => (
                <label key={r.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                  <input
                    type="radio"
                    name="receiptRecipient"
                    checked={receiptSelectedRecipientId === r.id}
                    onChange={() => setReceiptSelectedRecipientId(r.id)}
                  />
                  <span className="text-gray-900">{r.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setReceiptRecipientModal(prev => ({ ...prev, open: false }))
                  setReceiptSelectedRecipientId(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = receiptSelectedRecipientId
                  const name = receiptRecipientModal.recipients.find(r => r.id === id)?.name ?? ''
                  if (!id || !name) return
                  setReceiptRecipientModal(prev => ({ ...prev, open: false }))
                  setReceiptSelectedRecipientId(null)
                  proceedAfterRecipient(id, name, receiptRecipientModal.paidWithoutReceipt || receiptRecipientModal.assignmentGroup.filter(a => a.status === 'paid').sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()), receiptRecipientModal.assignmentGroup, receiptRecipientModal.fee, receiptRecipientModal.person)
                }}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Scegli una o più rate per la ricevuta */}
      {receiptInstallmentModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rate per la ricevuta</h3>
            <p className="text-gray-600 text-sm mb-4">Destinatario: {receiptInstallmentModal.recipientName}. Seleziona una o più rate da includere nella stessa ricevuta.</p>
            <div className="space-y-2 mb-4">
              {receiptInstallmentModal.paidInstallments.map(a => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={receiptSelectedInstallmentIds.includes(a.id)}
                    onChange={() => {
                      setReceiptSelectedInstallmentIds(prev =>
                        prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id]
                      )
                    }}
                  />
                  <span className="text-gray-900">
                    Rata {a.installment_number ?? '-'} – {formatCurrency(a.amount / 100)} – scadenza {a.due_date ? new Date(a.due_date).toLocaleDateString('it-IT') : '-'}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setReceiptInstallmentModal(prev => ({ ...prev, open: false }))
                  setReceiptSelectedInstallmentIds([])
                }}
                className="flex-1 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={receiptGenerating || receiptSelectedInstallmentIds.length === 0}
                onClick={() => {
                  const selected = receiptInstallmentModal.paidInstallments.filter(x => receiptSelectedInstallmentIds.includes(x.id))
                  if (selected.length === 0) return
                  doGenerateReceipt(receiptInstallmentModal.recipientId, selected, receiptInstallmentModal.assignmentGroup, receiptInstallmentModal.fee, receiptInstallmentModal.person)
                  setReceiptSelectedInstallmentIds([])
                }}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50"
              >
                {receiptGenerating ? 'Generazione…' : 'Genera ricevuta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptGenerating && !receiptInstallmentModal.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl px-6 py-4 shadow-xl">Generazione ricevuta in corso…</div>
        </div>
      )}

      {/* Modal: anteprima ricevuta – conferma caricamento */}
      {receiptPreviewModal.open && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Anteprima ricevuta</h3>
            <p className="text-gray-600 text-sm mb-4">
              L&apos;anteprima della ricevuta è stata aperta in un&apos;altra scheda. Vuoi caricare la ricevuta e inviare la notifica al destinatario?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelReceiptPreview}
                className="flex-1 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmReceiptUpload}
                disabled={receiptGenerating}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50"
              >
                {receiptGenerating ? 'Caricamento…' : 'Sì, carica e notifica'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal conferma: Messaggio inviato? */}
      {whatsAppConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Messaggio inviato?</h3>
            <p className="text-gray-600 text-sm mb-4">
              Confermi di aver inviato il sollecito via WhatsApp?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  const { playerId, feeId, tutorId } = whatsAppModal
                  setWhatsAppConfirmModal(false)
                  setWhatsAppModal({ open: false, url: '' })
                  try {
                    const { data: { user } } = await supabase.auth.getUser()
                    const createdBy = user?.id
                    if (!createdBy) {
                      toast.error('Devi essere loggato per creare le note del sollecito.')
                      return
                    }
                    const content = 'Inviato sollecito quota scaduta'

                    // 1. Nota nella scheda del TUTOR (tab Note) - chi ha ricevuto il sollecito
                    if (tutorId) {
                      const { error: errTutor } = await supabase.from('notes').insert({
                        person_id: tutorId,
                        content,
                        type: 'quote',
                        created_by: createdBy
                      })
                      if (errTutor) throw errTutor
                    }

                    // 2. Nota nella scheda del GIOCATORE - base della card Quote (tab Quote)
                    if (playerId) {
                      const { error: errPlayer } = await supabase.from('notes').insert({
                        person_id: playerId,
                        content,
                        type: 'quote',
                        fee_id: feeId || null,
                        created_by: createdBy
                      })
                      if (errPlayer) throw errPlayer
                    }
                    toast.success('Note create: nella scheda del tutor (tab Note) e del giocatore (tab Quote)')
                  } catch (err) {
                    console.error('Errore creazione note sollecito:', err)
                    const msg = String((err as { message?: string })?.message || '')
                    if (msg.includes('403') || msg.includes('policy')) {
                      toast.error('Errore 403: esegui fix_notes_rls_insert.sql su Supabase (RLS)')
                    } else if (msg.includes('409') || msg.includes('23505') || msg.includes('23503') || msg.includes('duplicate') || msg.includes('foreign key')) {
                      toast.error('Errore 409: vincolo violato. Verifica che created_by sia UUID valido (profiles) e che fee_id esista in fees.')
                    } else {
                      toast.error('Errore creazione note: ' + msg)
                    }
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium"
              >
                Sì
              </button>
              <button
                type="button"
                onClick={() => {
                  setWhatsAppConfirmModal(false)
                  setWhatsAppModal({ open: false, url: '' })
                }}
                className="flex-1 py-2.5 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-medium"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FeesManagement
