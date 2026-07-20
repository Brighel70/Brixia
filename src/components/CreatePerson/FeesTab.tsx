import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { formatCurrency } from '@/utils/feeUtils'
import {
  getInstallmentStatus,
  calculateDaysLate,
  hasChanges,
  canEditInstallment as canEditInstallmentCore,
  calculateFeeTotals as calculateFeeTotalsCore,
  markInstallmentsPaid,
  fromCents,
  updateAssignmentMetadata,
  syncAssignmentFromLedger
} from '@/lib/fees/paymentsCore'

interface Fee {
  id: string
  name: string
  description: string
  amount: number
  category: string
  is_mandatory?: boolean
  payment_mode?: string
  installments?: Array<{ amount: number; due_date: string; notes?: string; installment_number?: number }>
  due_date?: string
  applicable_categories?: string[]
}

interface FeeFromDB {
  id: string
  name: string
  description: string
  type: string
  category: string
  amount: number
  payment_mode?: string
  installment_count?: number
  installment_frequency?: string
  installment_start_date?: string
  installments?: any
}

interface FeeAssignment {
  id: string
  fee_id: string
  person_id: string
  amount: number
  status: string
  due_date: string
  paid_at: string | null
  installment_number: number
  notes?: string
  payment_method?: string | null
  fees: Fee | FeeFromDB
}

interface NoteForFee {
  id: string
  content: string
  date: string
  fee_id?: string | null
}

interface Category {
  id: string
  code?: string
}

/** Tutor o familiare candidato come destinatario ricevute */
interface ReceiptRecipientCandidate {
  id: string
  given_name: string
  family_name: string
  role: 'tutor' | 'guardian'
}

interface FeesTabProps {
  personId: string
  /** Categorie del giocatore (IDs) per filtrare quote applicabili */
  playerCategories: string[]
  /** Lista categorie con id e code per il filtro */
  categories: Category[]
  /** Note con fee_id per "Note sulla quota" */
  notesForFees: NoteForFee[]
  /** Se la persona è giocatore - per aggiornare is_player quando si assegna quota */
  isPlayer: boolean
  /** Callback quando si assegna una quota e bisogna impostare is_player */
  onFormUpdate?: (patch: { is_player?: boolean }) => void
}

const FeesTab: React.FC<FeesTabProps> = ({
  personId,
  playerCategories,
  categories,
  notesForFees,
  isPlayer,
  onFormUpdate
}) => {
  const [fees, setFees] = useState<Fee[]>([])
  const [assignments, setAssignments] = useState<FeeAssignment[]>([])
  const [loadingFees, setLoadingFees] = useState(false)
  const [expandedFeeDetails, setExpandedFeeDetails] = useState<Record<string, boolean>>({})
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentAssignment, setSelectedPaymentAssignment] = useState<any>(null)
  const [selectedInstallments, setSelectedInstallments] = useState<Record<string, boolean>>({})
  const [paymentInstallments, setPaymentInstallments] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({})
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({})
  const [initialPaymentStatus, setInitialPaymentStatus] = useState<Record<string, boolean>>({})
  // Destinatari ricevute: tutor e familiari del giocatore
  const [receiptCandidates, setReceiptCandidates] = useState<ReceiptRecipientCandidate[]>([])
  const [receiptRecipientIds, setReceiptRecipientIds] = useState<string[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [savingRecipients, setSavingRecipients] = useState(false)
  const [recipientsLoadedOnce, setRecipientsLoadedOnce] = useState(false)
  /** pdf_url per fee_assignment_id (rate pagate con ricevuta emessa) */
  const [receiptPdfUrlByAssignmentId, setReceiptPdfUrlByAssignmentId] = useState<Record<string, string>>({})

  const loadReceiptCandidatesAndSaved = useCallback(async () => {
    if (!personId) return
    setLoadingRecipients(true)
    try {
      // Tutor: tutor_athlete_relations dove athlete_id = personId
      const { data: tutorRels } = await supabase
        .from('tutor_athlete_relations')
        .select('tutor_id')
        .eq('athlete_id', personId)
      const tutorIds = (tutorRels || []).map((r: { tutor_id: string }) => r.tutor_id).filter(Boolean)
      // Familiari: player_guardian_relationships dove player_person_id = personId
      const { data: guardianRels } = await supabase
        .from('player_guardian_relationships')
        .select('guardian_person_id')
        .eq('player_person_id', personId)
      const guardianIds = (guardianRels || []).map((r: { guardian_person_id: string }) => r.guardian_person_id).filter(Boolean)
      const allIds = [...new Set([...tutorIds, ...guardianIds])]
      if (allIds.length === 0) {
        setReceiptCandidates([])
        setReceiptRecipientIds([])
        setRecipientsLoadedOnce(true)
        return
      }
      const { data: peopleData } = await supabase
        .from('people')
        .select('id, given_name, family_name')
        .in('id', allIds)
      const peopleList = peopleData || []
      const candidates: ReceiptRecipientCandidate[] = peopleList.map((p: { id: string; given_name: string; family_name: string }) => ({
        id: p.id,
        given_name: p.given_name || '',
        family_name: p.family_name || '',
        role: tutorIds.includes(p.id) && guardianIds.includes(p.id) ? 'tutor' : tutorIds.includes(p.id) ? 'tutor' : 'guardian'
      }))
      setReceiptCandidates(candidates)
      // Carica destinatari salvati
      const { data: saved } = await supabase
        .from('person_receipt_recipients')
        .select('recipient_person_id')
        .eq('person_id', personId)
      const savedIds = (saved || []).map((r: { recipient_person_id: string }) => r.recipient_person_id)
      if (savedIds.length > 0) {
        setReceiptRecipientIds(savedIds)
      } else if (candidates.length === 1) {
        // Una sola persona: selezionata di default
        setReceiptRecipientIds([candidates[0].id])
      } else {
        setReceiptRecipientIds([])
      }
      setRecipientsLoadedOnce(true)
    } catch (e) {
      console.error('Errore caricamento destinatari ricevute:', e)
    } finally {
      setLoadingRecipients(false)
    }
  }, [personId])

  useEffect(() => {
    loadReceiptCandidatesAndSaved()
  }, [loadReceiptCandidatesAndSaved])

  const toggleReceiptRecipient = (recipientId: string) => {
    setReceiptRecipientIds((prev) =>
      prev.includes(recipientId) ? prev.filter((id) => id !== recipientId) : [...prev, recipientId]
    )
  }

  const saveReceiptRecipients = async () => {
    if (!personId) return
    setSavingRecipients(true)
    try {
      const { error: deleteError } = await supabase
        .from('person_receipt_recipients')
        .delete()
        .eq('person_id', personId)
      if (deleteError) {
        console.error('Errore cancellazione destinatari:', deleteError)
        toast.error('Errore nel salvataggio. Se persiste, verifica i permessi su Supabase (RLS per person_receipt_recipients).')
        return
      }
      if (receiptRecipientIds.length > 0) {
        const rows = receiptRecipientIds.map((recipient_person_id) => ({ person_id: personId, recipient_person_id }))
        const { error: insertError } = await supabase
          .from('person_receipt_recipients')
          .insert(rows)
        if (insertError) {
          console.error('Errore inserimento destinatari:', insertError)
          toast.error('Errore nel salvataggio: ' + (insertError.message || 'controlla la console.'))
          return
        }
      }
      toast.success('Destinatari ricevute salvati.')
    } catch (e) {
      console.error('Errore salvataggio destinatari ricevute:', e)
      toast.error('Errore nel salvataggio dei destinatari.')
    } finally {
      setSavingRecipients(false)
    }
  }

  const loadFeesAndAssignments = useCallback(async () => {
    if (!personId) return
    try {
      setLoadingFees(true)
      const { data: feesData, error: feesError } = await supabase
        .from('fees')
        .select('*, installments, payment_mode')
        .eq('is_active', true)
        .order('name')

      if (feesError) throw feesError

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('fee_assignments')
        .select(`
          id,
          fee_id,
          person_id,
          amount,
          due_date,
          notes,
          status,
          paid_at,
          paid_date,
          payment_method,
          installment_number,
          installment_type,
          created_at,
          updated_at,
          fees (
            name,
            description,
            type,
            category,
            amount,
            payment_mode,
            installment_count,
            installment_frequency,
            installment_start_date,
            installments
          )
        `)
        .eq('person_id', personId)
        .order('due_date', { ascending: true })

      if (assignmentsError) throw assignmentsError

      const assignedFeeIds = (assignmentsData || []).map((a: any) => a.fee_id)
      const personCategoryCodes = (playerCategories || [])
        .map((id: string) => categories.find(c => c.id === id)?.code)
        .filter(Boolean)
        .map((code: string) => (code || '').toUpperCase())

      const availableFees = (feesData || []).filter((fee: Fee) => {
        if (assignedFeeIds.includes(fee.id)) return false
        if (!fee.applicable_categories || fee.applicable_categories.length === 0) return true
        const feeCodes = (fee.applicable_categories || []).map((c: string) => (c || '').toUpperCase())
        return feeCodes.some((code: string) => personCategoryCodes.includes(code))
      })

      setFees(availableFees)
      setAssignments(assignmentsData as any || [])

      // Carica ricevute PDF per le rate pagate (come in FlowMe: icona per aprire ricevuta)
      const paidIds = (assignmentsData || []).filter((a: any) => a.status === 'paid').map((a: any) => a.id)
      if (paidIds.length > 0) {
        const { data: receipts } = await supabase
          .from('payment_receipts')
          .select('fee_assignment_id, pdf_url')
          .in('fee_assignment_id', paidIds)
        const urlByAssignment = (receipts || []).reduce<Record<string, string>>((acc, r) => {
          if (r.pdf_url && !acc[r.fee_assignment_id]) acc[r.fee_assignment_id] = r.pdf_url
          return acc
        }, {})
        setReceiptPdfUrlByAssignmentId(urlByAssignment)
      } else {
        setReceiptPdfUrlByAssignmentId({})
      }
    } catch (error) {
      console.error('Errore nel caricamento quote e assegnazioni:', error)
    } finally {
      setLoadingFees(false)
    }
  }, [personId, playerCategories, categories])

  useEffect(() => {
    if (personId && isPlayer) {
      loadFeesAndAssignments()
    }
  }, [personId, isPlayer, loadFeesAndAssignments])

  const handleAssignFee = async (fee: Fee) => {
    try {
      if (!isPlayer) {
        const { error: updateError } = await supabase
          .from('people')
          .update({ is_player: true })
          .eq('id', personId)

        if (updateError) {
          console.error('Errore nell\'aggiornamento is_player:', updateError)
        } else {
          onFormUpdate?.({ is_player: true })
        }
      }

      if (fee.payment_mode === 'installments' && fee.installments && fee.installments.length > 0) {
        const assignmentsToCreate = fee.installments.map((inst: any, index: number) => ({
          fee_id: fee.id,
          person_id: personId,
          amount: Math.round(inst.amount * 100),
          due_date: inst.due_date,
          status: 'pending',
          installment_number: inst.installment_number || (index + 1),
          notes: inst.notes || ''
        }))

        const { error } = await supabase.from('fee_assignments').insert(assignmentsToCreate)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fee_assignments').insert({
          fee_id: fee.id,
          person_id: personId,
          amount: fee.amount,
          due_date: fee.due_date || new Date().toISOString().split('T')[0],
          status: 'pending',
          installment_number: 1,
          installment_type: null
        })
        if (error) throw error
      }

      loadFeesAndAssignments()
    } catch (error) {
      console.error('Errore nell\'assegnazione della quota:', error)
      alert('Errore nell\'assegnazione della quota')
    }
  }

  const handleDeleteAssignment = async (assignment: FeeAssignment) => {
    if (!confirm('Sei sicuro di voler eliminare questa assegnazione di quota?')) return
    try {
      const { error } = await supabase.from('fee_assignments').delete().eq('id', assignment.id)
      if (error) throw error
      loadFeesAndAssignments()
    } catch (error) {
      console.error('Errore nell\'eliminazione dell\'assegnazione:', error)
      alert('Errore nell\'eliminazione dell\'assegnazione')
    }
  }

  const handlePayment = async (assignment: any) => {
    setSelectedPaymentAssignment(assignment)
    try {
      const { data: feeAssignments, error } = await supabase
        .from('fee_assignments')
        .select(`
          *,
          fees (
            name,
            description,
            payment_mode,
            installments,
            amount
          )
        `)
        .eq('fee_id', assignment.fee_id)
        .eq('person_id', assignment.person_id)
        .order('due_date', { ascending: true })

      if (error) throw error

      const initialSelection: Record<string, boolean> = {}
      const initialPaymentMethods: Record<string, string> = {}
      const initialStatus: Record<string, boolean> = {}

      feeAssignments?.forEach((a: any) => {
        const isPaid = a.status === 'paid'
        initialSelection[a.id] = isPaid
        initialStatus[a.id] = isPaid
        if (isPaid && a.payment_method) {
          initialPaymentMethods[a.id] = a.payment_method
        } else if (isPaid) {
          initialPaymentMethods[a.id] = 'contanti'
        }
      })

      const fee = feeAssignments?.[0]?.fees
      if (!fee) return

      const modalInstallments = feeAssignments?.map((a: any) => ({
        id: a.id,
        amount: fromCents(a.amount).toFixed(2),
        due_date: a.due_date,
        notes: a.notes,
        status: a.status,
        paid_at: a.paid_at,
        installment_number: a.installment_number || 1,
        installment_type: a.installment_type || null
      })) || []

      setPaymentInstallments(modalInstallments)
      setSelectedInstallments(initialSelection)
      setPaymentMethods(initialPaymentMethods)
      setInitialPaymentStatus(initialStatus)
      setShowPaymentModal(true)
    } catch (error) {
      console.error('Errore nel caricamento delle rate:', error)
      alert('Errore nel caricamento delle rate')
    }
  }

  const toggleFeeDetails = (feeId: string) => {
    setExpandedFeeDetails(prev => ({ ...prev, [feeId]: !prev[feeId] }))
  }

  const getSportSeason = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`
  }

  const calculateFeeTotals = (feeId: string) => calculateFeeTotalsCore(feeId, assignments)

  const handleEditInstallment = (installment: any, feeId: string) => {
    const tempInstallment = {
      ...installment,
      installment_number: installment.installment_number || 1,
      fee_id: feeId,
      person_id: personId,
      isTemporary: true
    }
    handlePayment(tempInstallment)
  }

  const canEditInstallment = (installmentIndex: number) =>
    canEditInstallmentCore(installmentIndex, paymentInstallments, selectedInstallments, { considerPaidAsEditable: true })

  const handlePaymentMethodChange = (installmentId: string, method: string) => {
    setPaymentMethods(prev => ({ ...prev, [installmentId]: method }))
  }

  const handlePaymentDateChange = (installmentId: string, date: string) => {
    setPaymentDates(prev => ({ ...prev, [installmentId]: date }))
  }

  const hasPaymentChanges = () => hasChanges(selectedInstallments, initialPaymentStatus)

  const handleInstallmentToggle = (installmentId: string, installmentIndex: number) => {
    if (!canEditInstallment(installmentIndex)) return
    if (initialPaymentStatus[installmentId]) return
    const isCurrentlySelected = selectedInstallments[installmentId]
    setSelectedInstallments(prev => ({ ...prev, [installmentId]: !isCurrentlySelected }))
    if (!isCurrentlySelected) {
      const inst = paymentInstallments.find(p => p.id === installmentId)
      const initialDate = inst?.paid_at ? new Date(inst.paid_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      setPaymentDates(prev => ({ ...prev, [installmentId]: initialDate }))
    } else {
      setPaymentMethods(prev => { const n = { ...prev }; delete n[installmentId]; return n })
      setPaymentDates(prev => { const n = { ...prev }; delete n[installmentId]; return n })
    }
  }

  const handleMarkPayment = async () => {
    try {
      const selectedIds = Object.entries(selectedInstallments)
        .filter(([, v]) => v)
        .map(([id]) => id)

      for (const id of selectedIds) {
        if (!paymentMethods[id]) {
          alert('Devi selezionare un metodo di pagamento per tutte le rate selezionate')
          return
        }
      }

      const updates = Object.entries(selectedInstallments).map(([id, isSelected]) => ({
        id,
        isSelected,
        paymentMethod: paymentMethods[id] || null,
        paymentDate: paymentDates[id] || new Date().toISOString().split('T')[0]
      }))
      await markInstallmentsPaid(updates)

      loadFeesAndAssignments()
      setShowPaymentModal(false)
      setSelectedPaymentAssignment(null)
      setSelectedInstallments({})
      setPaymentInstallments([])
      setPaymentMethods({})
      setPaymentDates({})
      setInitialPaymentStatus({})
    } catch (error) {
      console.error('Errore nella registrazione dei pagamenti:', error)
      alert('Errore nella registrazione dei pagamenti')
    }
  }

  const closePaymentModal = () => {
    setShowPaymentModal(false)
    setSelectedPaymentAssignment(null)
    setSelectedInstallments({})
    setPaymentInstallments([])
    setPaymentMethods({})
    setPaymentDates({})
    setInitialPaymentStatus({})
  }

  const handleConvertToSinglePayment = async () => {
    if (!selectedPaymentAssignment) return
    try {
      const fee = selectedPaymentAssignment.fees
      const totalAmount = fee?.amount ? fee.amount / 100 : 300
      const defaultInstallments = [
        { amount: 50, due_date: `${new Date().getFullYear()}-07-07`, notes: 'Acconto', installment_number: 1 },
        { amount: totalAmount - 50, due_date: `${new Date().getFullYear()}-09-30`, notes: 'Saldo', installment_number: 2 }
      ]
      setSelectedInstallments({})
      setPaymentMethods({})
      setPaymentDates({})

      const { data: newFeeAssignments, error } = await supabase
        .from('fee_assignments')
        .select(`*, fees (name, description, payment_mode, installments)`)
        .eq('fee_id', selectedPaymentAssignment.fee_id)
        .eq('person_id', selectedPaymentAssignment.person_id)
        .order('due_date', { ascending: true })

      if (error) throw error

      if (newFeeAssignments && newFeeAssignments.length > 0) {
        setPaymentInstallments(newFeeAssignments.map((a: any) => ({
          id: a.id,
          amount: a.amount / 100,
          due_date: a.due_date,
          notes: a.notes || '',
          status: a.status,
          paid_at: a.paid_at,
          installment_number: a.installment_number
        })))
      } else {
        setPaymentInstallments([])
      }
      alert('Convertito in Pagamento Unico con successo!')
    } catch (error) {
      console.error('Errore nella conversione:', error)
      alert('Errore nella conversione')
    }
  }

  const handleConvertToInstallments = async () => {
    if (!selectedPaymentAssignment) return
    try {
      const { data: feeData, error: feeError } = await supabase
        .from('fees')
        .select('installments, payment_mode')
        .eq('id', selectedPaymentAssignment.fee_id)
        .single()

      if (feeError) throw feeError
      if (!feeData.installments || feeData.installments.length === 0) {
        alert('Questa quota non ha rate configurate')
        return
      }

      const mainAssignment = assignments.find(a =>
        a.fee_id === selectedPaymentAssignment.fee_id && a.person_id === selectedPaymentAssignment.person_id
      )

      if (mainAssignment) {
        await updateAssignmentMetadata(mainAssignment.id, {
          notes: `${mainAssignment.notes || ''}\nConvertito a rate: ${feeData.installments.length} rate configurate`.trim()
        })
        // Stato pagato/non pagato resta derivato dal ledger payments
        await syncAssignmentFromLedger(mainAssignment.id)
      } else {
        alert('Errore: Assegnazione principale non trovata.')
        return
      }

      setSelectedInstallments({})
      setPaymentMethods({})
      setPaymentDates({})

      const modalInstallments = feeData.installments.map((inst: any, i: number) => ({
        id: `temp-${i}`,
        amount: inst.amount,
        due_date: inst.due_date,
        notes: inst.notes || '',
        status: 'pending',
        paid_at: null,
        installment_number: i + 1,
        isTemporary: true
      }))
      setPaymentInstallments(modalInstallments)
      alert('Convertito in Rate con successo!')
    } catch (error) {
      console.error('Errore nella conversione:', error)
      alert('Errore nella conversione')
    }
  }

  if (!personId) return null

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">💰 Gestione Quote</h3>
        <div className="text-sm text-gray-500">{assignments.length} assegnazioni</div>
      </div>

      {/* Quote disponibili: mostrata solo se ci sono quote da assegnare o è in caricamento */}
      {(loadingFees || fees.length > 0) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Quote disponibili (dal database)</h4>
          {loadingFees ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fees.map((fee) => (
                <div key={fee.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium text-gray-900">
                      {fee.name === 'Quota di Iscrizione annuale' ? `Quota di Iscrizione stagione ${getSportSeason()}` : fee.name}
                    </h5>
                    <span className={`px-2 py-1 rounded-full text-xs ${fee.is_mandatory ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {fee.is_mandatory ? 'Obbligatoria' : 'Opzionale'}
                    </span>
                  </div>
                  {fee.description && fee.description !== 'Tessera di iscrizione annuale per atleti adulti' && (
                    <p className="text-sm text-gray-600 mb-2">{fee.description}</p>
                  )}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-semibold text-green-600">{formatCurrency(fee.amount / 100)}</span>
                    <span className="text-xs text-gray-500">{fee.category}</span>
                  </div>
                  <button
                    onClick={() => handleAssignFee(fee)}
                    className="w-full bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    Assegna Quota
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Destinatari ricevute di pagamento: tutor e familiari del giocatore */}
      {(loadingRecipients || receiptCandidates.length > 0 || (recipientsLoadedOnce && receiptCandidates.length === 0)) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-md font-medium text-gray-900 mb-2">Destinatari ricevute di pagamento</h4>
          <p className="text-sm text-gray-500 mb-4">
            Seleziona le persone a cui inviare le ricevute delle quote (tutor o familiari collegati al giocatore).
          </p>
          {loadingRecipients ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : receiptCandidates.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">
              Nessun tutor o familiare collegato a questo giocatore. Collega tutor o familiari dalla scheda della persona (tab Tutor / Giocatore).
            </p>
          ) : (
            <div className="space-y-3">
              {receiptCandidates.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={receiptRecipientIds.includes(c.id)}
                    onChange={() => toggleReceiptRecipient(c.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-900">
                    {c.family_name} {c.given_name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {c.role === 'tutor' ? 'Tutor' : 'Familiare'}
                  </span>
                </label>
              ))}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={saveReceiptRecipients}
                  disabled={savingRecipients}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingRecipients ? 'Salvataggio...' : 'Salva destinatari'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quote Assegnate */}
      {assignments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Quote Assegnate</h4>
          <div className="space-y-4">
            {Array.from(new Set(assignments.map(a => a.fee_id))).map((feeId) => {
              const feeAssignments = assignments.filter(a => a.fee_id === feeId)
              const fee = feeAssignments[0]?.fees
              const totals = calculateFeeTotals(feeId)
              if (!fee) return null

              return (
                <div key={feeId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div
                    onClick={() => toggleFeeDetails(feeId)}
                    className="w-full flex items-center justify-between mb-3 p-2 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <h6 className="font-semibold text-gray-900 text-lg">
                          {fee.name === 'Quota di Iscrizione annuale' ? `Quota di Iscrizione stagione ${getSportSeason()}` : fee.name}
                        </h6>
                        {fee.description !== 'Tessera di iscrizione annuale per atleti adulti' && (
                          <p className="text-sm text-gray-600">{fee.description}</p>
                        )}
                        <div className="mt-1">
                          <span className="text-sm font-medium text-gray-700">Da pagare: </span>
                          <span className={`text-sm font-bold ml-1 ${totals.pending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(totals.pending)}
                          </span>
                          {totals.paid > 0 && (
                            <span className="text-xs text-gray-500 ml-2">(Pagato: {formatCurrency(totals.paid)})</span>
                          )}
                        </div>
                      </div>
                      <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandedFeeDetails[feeId] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          const tempInstallment = {
                            id: 'temp-0',
                            amount: fee.installments?.[0]?.amount || 0,
                            due_date: fee.installments?.[0]?.due_date || new Date().toISOString().split('T')[0],
                            notes: fee.installments?.[0]?.notes || '',
                            status: 'pending',
                            paid_at: null,
                            installment_number: 1,
                            fee_id: feeId,
                            person_id: personId,
                            isTemporary: true
                          }
                          handlePayment(tempInstallment)
                        }}
                        className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                        title="Gestisci pagamenti"
                      >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(feeAssignments[0])}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        title="Elimina quota"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Note sulla quota */}
                  {notesForFees.filter((n) => n.fee_id === feeId).length > 0 && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="text-sm font-medium text-amber-900 mb-2">Note sulla quota</div>
                      <div className="space-y-2">
                        {notesForFees.filter((n) => n.fee_id === feeId).map((n) => (
                          <div key={n.id} className="text-sm text-amber-800 bg-white/60 rounded px-2 py-1.5 border-l-2 border-amber-500">
                            {n.content}
                            <span className="text-xs text-amber-600 ml-1">({new Date(n.date).toLocaleDateString('it-IT')})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contenuto espandibile */}
                  {expandedFeeDetails[feeId] && (
                    <div className="mt-3">
                      {totals.installments.length > 1 && (
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Piano di Pagamento ({totals.installments.length} rate)
                          </div>
                          <div className="space-y-3">
                            {totals.installments.map((installment: any, index: number) => (
                              <div
                                key={index}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  installment.status === 'paid'
                                    ? 'bg-blue-50 border-blue-200'
                                    : getInstallmentStatus(installment.due_date) === 'overdue'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-green-50 border-green-200'
                                }`}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-semibold">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900">
                                      {formatCurrency(Number(installment.amount))}
                                      {installment.notes && <span className="text-sm font-normal text-gray-600 ml-1">({installment.notes})</span>}
                                    </div>
                                    <div className="text-sm text-gray-600">Scadenza: {new Date(installment.due_date).toLocaleDateString('it-IT')}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {installment.status === 'paid' ? (
                                    <div className="flex flex-col items-end">
                                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">✅ Pagata</span>
                                      <div className={`text-xs mt-1 ${installment.paid_at && calculateDaysLate(installment.due_date, installment.paid_at) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                        {installment.paid_at ? (
                                          <>
                                            {new Date(installment.paid_at).toLocaleDateString('it-IT')}
                                            {(() => {
                                              const daysLate = calculateDaysLate(installment.due_date, installment.paid_at)
                                              if (daysLate > 0) return ` (${daysLate} giorni di ritardo)`
                                              if (daysLate < 0) return ` (${Math.abs(daysLate)} giorni in anticipo)`
                                              return ' (in tempo)'
                                            })()}
                                          </>
                                        ) : (
                                          'Data pagamento non disponibile'
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getInstallmentStatus(installment.due_date) === 'overdue' ? 'bg-red-600 text-white' : 'bg-green-100 text-green-800'}`}>
                                      {getInstallmentStatus(installment.due_date) === 'overdue' ? '❌ Scaduta' : '⏳ Regolare'}
                                    </span>
                                  )}
                                  {installment.status === 'paid' && receiptPdfUrlByAssignmentId[feeAssignments[index]?.id] && (
                                    <a
                                      href={receiptPdfUrlByAssignmentId[feeAssignments[index].id]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                      title="Apri ricevuta PDF"
                                    >
                                      <FileText className="w-5 h-5" />
                                    </a>
                                  )}
                                  {installment.status !== 'paid' && (
                                    <button
                                      onClick={() => {
                                        const tempInstallment = {
                                          ...installment,
                                          installment_number: index + 1,
                                          fee_id: feeId,
                                          person_id: personId,
                                          isTemporary: true
                                        }
                                        handlePayment(tempInstallment)
                                      }}
                                      className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                                      title="Procedi al pagamento"
                                    >
                                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                      </svg>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleEditInstallment(installment, feeId)}
                                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                    title="Modifica"
                                  >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pagamento Singolo */}
                      {totals.installments.length === 1 && (
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="text-sm font-semibold text-gray-900 mb-3">Pagamento Singolo</div>
                          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tipo Pagamento</div>
                                <div className="text-sm font-semibold text-gray-900">{fee.payment_mode === 'single' ? 'Pagamento Unico' : 'Rate'}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Totale Quota</div>
                                <div className="text-lg font-bold text-gray-900">{formatCurrency(totals.total)}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pagato</div>
                                <div className="text-lg font-bold text-green-600">{formatCurrency(totals.paid)}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Da Pagare</div>
                                <div className="text-lg font-bold text-red-600">{formatCurrency(totals.pending)}</div>
                              </div>
                            </div>
                            {totals.installments.length > 0 && (
                              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="text-sm font-medium text-green-900 mb-2">Suddivisione Quota:</div>
                                <div className="space-y-2">
                                  {totals.installments.map((inst: any, idx: number) => {
                                    const asg = feeAssignments.find(a => a.installment_number === idx + 1) || feeAssignments[0]
                                    const getFasciaColor = () => {
                                      if (!asg) return 'bg-gray-50'
                                      if (asg.status === 'paid') return 'bg-blue-50'
                                      const isOverdue = new Date() > new Date(inst.due_date)
                                      return isOverdue ? 'bg-red-50' : 'bg-green-50'
                                    }
                                    return (
                                      <div key={idx} className={`flex items-center justify-between text-sm p-2 rounded ${getFasciaColor()}`}>
                                        <div className="flex items-center gap-2">
                                          <span className="w-6 h-6 bg-green-100 text-green-800 rounded-full flex items-center justify-center text-xs font-semibold">{idx + 1}</span>
                                          <span className="text-green-800">{formatCurrency(Number(inst.amount))}</span>
                                          <span className="text-green-600">({new Date(inst.due_date).toLocaleDateString('it-IT')})</span>
                                          {asg?.status === 'paid' && asg?.paid_at && (
                                            <span className="text-blue-600 text-xs">Pagata: {new Date(asg.paid_at).toLocaleDateString('it-IT')}</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {asg?.status === 'paid' && receiptPdfUrlByAssignmentId[asg.id] && (
                                            <a
                                              href={receiptPdfUrlByAssignmentId[asg.id]}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                              title="Apri ricevuta PDF"
                                            >
                                              <FileText className="w-4 h-4" />
                                            </a>
                                          )}
                                          {!asg ? (
                                            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">Non assegnata</span>
                                          ) : asg.status === 'paid' ? (
                                            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Pagata</span>
                                          ) : new Date() > new Date(inst.due_date) ? (
                                            <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                                              Scaduta ({Math.floor((new Date().getTime() - new Date(inst.due_date).getTime()) / (1000 * 60 * 60 * 24))} giorni)
                                            </span>
                                          ) : (
                                            <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">Regolare</span>
                                          )}
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const tempInstallment = {
                                                id: asg?.id || `temp-${idx}`,
                                                amount: inst.amount,
                                                due_date: inst.due_date,
                                                notes: inst.notes || '',
                                                status: asg?.status || 'pending',
                                                paid_at: asg?.paid_at || null,
                                                installment_number: idx + 1,
                                                fee_id: feeId,
                                                person_id: personId,
                                                isTemporary: !asg
                                              }
                                              handlePayment(tempInstallment)
                                            }}
                                            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-lg transition-colors cursor-pointer"
                                            title="Registra pagamento"
                                          >
                                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                            </svg>
                                          </div>
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleEditInstallment({ ...inst, id: asg?.id }, feeId)
                                            }}
                                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                                            title="Modifica rata"
                                          >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal Gestione Pagamenti */}
      {showPaymentModal && selectedPaymentAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Gestione Pagamenti</h3>
              <button onClick={closePaymentModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">{selectedPaymentAssignment.fees?.name || 'Quota'}</h4>
                <p className="text-sm text-gray-600 mb-2">{selectedPaymentAssignment.fees?.description}</p>
                <div className="text-sm text-gray-700">
                  <span className="font-medium">Tipo Pagamento:</span>
                  <span className="ml-2">
                    {paymentInstallments.length === 2 && paymentInstallments[0]?.notes === 'Acconto' && paymentInstallments[1]?.notes === 'Saldo'
                      ? 'Pagamento Unico'
                      : 'Rate'}
                  </span>
                </div>
              </div>
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h5 className="font-medium text-yellow-900 mb-3">Opzioni di Conversione</h5>
                <div className="flex gap-3">
                  <button onClick={handleConvertToSinglePayment} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                    Converti in Pagamento Unico
                  </button>
                  <button onClick={handleConvertToInstallments} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                    Converti in Rate
                  </button>
                </div>
                <p className="text-xs text-yellow-700 mt-2">⚠️ La conversione cancellerà le modifiche non salvate</p>
              </div>
              <div className="space-y-3">
                <h5 className="font-medium text-gray-900">Seleziona le rate da segnare come pagate:</h5>
                {paymentInstallments.map((installment, index) => (
                  <div
                    key={installment.id}
                    className={`p-4 rounded-lg ${
                      installment.status === 'paid'
                        ? (installment.paid_at && calculateDaysLate(installment.due_date, installment.paid_at) > 0 ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200')
                        : getInstallmentStatus(installment.due_date) === 'overdue'
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-green-50 border border-green-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id={`installment-${installment.id}`}
                          checked={selectedInstallments[installment.id] || false}
                          onChange={() => handleInstallmentToggle(installment.id, index)}
                          disabled={!canEditInstallment(index) || initialPaymentStatus[installment.id]}
                          className={`w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 ${!canEditInstallment(index) || initialPaymentStatus[installment.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <div>
                          <label htmlFor={`installment-${installment.id}`} className={`text-sm font-medium ${canEditInstallment(index) ? 'text-gray-900 cursor-pointer' : 'text-gray-500 cursor-not-allowed'}`}>
                            Rata {index + 1}
                            {!canEditInstallment(index) && <span className="ml-2 text-xs text-red-500">(Devi pagare la rata precedente)</span>}
                          </label>
                          <div className="text-sm text-gray-900">
                            <span className="font-semibold">{formatCurrency(Number(installment.amount))}{installment.notes && <span className="font-normal text-gray-700 ml-1">({installment.notes})</span>}</span>
                            <span className="mx-2">•</span>
                            <span className="font-medium">Scadenza: {new Date(installment.due_date).toLocaleDateString('it-IT')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {installment.status === 'paid' ? (
                          <div className="flex flex-col items-end">
                            <div className="text-sm font-medium text-blue-600">Pagata</div>
                            <div className={`text-xs mt-1 ${installment.paid_at && calculateDaysLate(installment.due_date, installment.paid_at) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                              {installment.paid_at ? (
                                <>
                                  {new Date(installment.paid_at).toLocaleDateString('it-IT')}
                                  {(() => {
                                    const daysLate = calculateDaysLate(installment.due_date, installment.paid_at)
                                    if (daysLate > 0) return ` (${daysLate} giorni di ritardo)`
                                    if (daysLate < 0) return ` (${Math.abs(daysLate)} giorni in anticipo)`
                                    return ' (in tempo)'
                                  })()}
                                </>
                              ) : (
                                'Data pagamento non disponibile'
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className={`text-sm font-medium px-2 py-1 rounded-full ${getInstallmentStatus(installment.due_date) === 'overdue' ? 'bg-red-600 text-white' : 'bg-green-100 text-green-800'}`}>
                            {getInstallmentStatus(installment.due_date) === 'overdue' ? 'Scaduta' : 'Regolare'}
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedInstallments[installment.id] && canEditInstallment(index) && !initialPaymentStatus[installment.id] && (
                      <div className="pl-8 pt-2 border-t border-gray-200">
                        <div className="flex items-center space-x-4">
                          <span className="text-sm font-medium text-gray-900">Metodo di pagamento:</span>
                          <label className="flex items-center">
                            <input type="radio" name={`paymentMethod-${installment.id}`} value="contanti" checked={paymentMethods[installment.id] === 'contanti'} onChange={(e) => handlePaymentMethodChange(installment.id, e.target.value)} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                            <span className="ml-2 text-sm text-gray-700">Contanti</span>
                          </label>
                          <label className="flex items-center">
                            <input type="radio" name={`paymentMethod-${installment.id}`} value="bonifico" checked={paymentMethods[installment.id] === 'bonifico'} onChange={(e) => handlePaymentMethodChange(installment.id, e.target.value)} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                            <span className="ml-2 text-sm text-gray-700">Bonifico</span>
                          </label>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm font-medium text-gray-900">Data di pagamento:</span>
                          <input
                            type="date"
                            value={paymentDates[installment.id] || (installment.paid_at ? new Date(installment.paid_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])}
                            onChange={(e) => handlePaymentDateChange(installment.id, e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-900">Rate selezionate:</span>
                  <span className="text-sm font-semibold text-blue-900">
                    {Object.values(selectedInstallments).filter(Boolean).length} di {paymentInstallments.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">Importo totale selezionato:</span>
                  <span className="text-lg font-bold text-blue-900">
                    {formatCurrency(paymentInstallments.filter(a => selectedInstallments[a.id]).reduce((sum, a) => sum + Number(a.amount), 0))}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={closePaymentModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Annulla
                </button>
                <button onClick={handleMarkPayment} disabled={!hasPaymentChanges()} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                  Aggiorna Pagamenti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FeesTab
