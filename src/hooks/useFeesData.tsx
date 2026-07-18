import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Fee {
  id: string
  name: string
  description: string
  amount: number
  category: string
  is_mandatory: boolean
  payment_mode: string
  installments: Array<{
    amount: number
    due_date: string
    notes: string
  }>
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
  fees: Fee
}

export const useFeesData = (personId: string) => {
  const [fees, setFees] = useState<Fee[]>([])
  const [assignments, setAssignments] = useState<FeeAssignment[]>([])
  const [loadingFees, setLoadingFees] = useState(false)
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [expandedFeeDetails, setExpandedFeeDetails] = useState<Record<string, boolean>>({})

  // Carica le quote disponibili
  const loadFees = async () => {
    setLoadingFees(true)
    try {
      const { data, error } = await supabase
        .from('fees')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) throw error
      setFees(data || [])
    } catch (error) {
      console.error('Errore nel caricamento delle quote:', error)
    } finally {
      setLoadingFees(false)
    }
  }

  // Carica le assegnazioni di quote per la persona
  const loadAssignments = async () => {
    if (!personId) return
    
    setLoadingAssignments(true)
    try {
      const { data, error } = await supabase
        .from('fee_assignments')
        .select(`
          *,
          fees (*)
        `)
        .eq('person_id', personId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAssignments(data || [])
    } catch (error) {
      console.error('Errore nel caricamento delle assegnazioni:', error)
    } finally {
      setLoadingAssignments(false)
    }
  }

  // Toggle per espandere/contrarre i dettagli di una quota
  const toggleFeeDetails = (feeId: string) => {
    setExpandedFeeDetails(prev => ({
      ...prev,
      [feeId]: !prev[feeId]
    }))
  }

  // Calcola i totali per una quota
  const calculateFeeTotals = (feeId: string) => {
    const feeAssignments = assignments.filter(a => a.fee_id === feeId)
    
    if (feeAssignments.length === 0) {
      return {
        total: 0,
        paid: 0,
        pending: 0,
        installments: []
      }
    }

    const fee = feeAssignments[0]?.fees
    if (!fee) return { total: 0, paid: 0, pending: 0, installments: [] }

    const total = fee.amount
    const paid = feeAssignments
      .filter(a => a.status === 'paid')
      .reduce((sum, a) => sum + a.amount, 0)
    const pending = total - paid

    return {
      total: total / 100, // Converti da centesimi
      paid: paid / 100,
      pending: pending / 100,
      installments: fee.installments || []
    }
  }

  // Ottiene la stagione sportiva corrente
  const getSportSeason = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1 // getMonth() restituisce 0-11
    
    // Se siamo tra settembre e dicembre, la stagione inizia quest'anno
    if (month >= 9) {
      return `${year}/${year + 1}`
    } else {
      // Altrimenti la stagione è iniziata l'anno scorso
      return `${year - 1}/${year}`
    }
  }

  // Determina lo stato di una rata
  const getInstallmentStatus = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    return today > due ? 'overdue' : 'pending'
  }

  // Calcola i giorni di ritardo
  const calculateDaysLate = (dueDate: string, paidAt: string) => {
    const due = new Date(dueDate)
    const paid = new Date(paidAt)
    const diffTime = paid.getTime() - due.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Assegna una quota
  const handleAssignFee = async (fee: Fee) => {
    try {
      const { error } = await supabase
        .from('fee_assignments')
        .insert({
          fee_id: fee.id,
          person_id: personId,
          amount: fee.amount,
          status: 'pending',
          due_date: new Date().toISOString().split('T')[0],
          installment_number: 1
        })

      if (error) throw error
      
      // Ricarica le assegnazioni
      await loadAssignments()
    } catch (error) {
      console.error('Errore nell\'assegnazione della quota:', error)
      alert('Errore nell\'assegnazione della quota: ' + (error as any)?.message || 'Errore sconosciuto')
    }
  }

  // Elimina un'assegnazione
  const handleDeleteAssignment = async (assignment: FeeAssignment) => {
    if (!confirm('Sei sicuro di voler eliminare questa assegnazione?')) return

    try {
      const { error } = await supabase
        .from('fee_assignments')
        .delete()
        .eq('id', assignment.id)

      if (error) throw error
      
      // Ricarica le assegnazioni
      await loadAssignments()
    } catch (error) {
      console.error('Errore nell\'eliminazione dell\'assegnazione:', error)
      alert('Errore nell\'eliminazione dell\'assegnazione: ' + (error as any)?.message || 'Errore sconosciuto')
    }
  }

  // Carica i dati quando cambia personId
  useEffect(() => {
    if (personId) {
      loadFees()
      loadAssignments()
    }
  }, [personId])

  return {
    fees,
    assignments,
    loadingFees,
    loadingAssignments,
    expandedFeeDetails,
    toggleFeeDetails,
    calculateFeeTotals,
    getSportSeason,
    getInstallmentStatus,
    calculateDaysLate,
    handleAssignFee,
    handleDeleteAssignment,
    loadAssignments
  }
}







