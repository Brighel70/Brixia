/**
 * Core shared logic for payment management (FeesTab + FeesManagement).
 * Pure functions and Supabase wrappers - no React.
 */

import { supabase } from '@/lib/supabaseClient'

// --- PURE FUNCTIONS ---

/** Status of an installment based on due date */
export type InstallmentStatus = 'overdue' | 'regular'

/**
 * Get installment status from due date.
 * Returns 'overdue' if past due, 'regular' otherwise.
 */
export function getInstallmentStatus(dueDate: string): InstallmentStatus {
  const today = new Date()
  const due = new Date(dueDate)
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return due < today ? 'overdue' : 'regular'
}

/**
 * Calculate days between due date and paid date.
 * Positive = late, negative = early, 0 = on time.
 */
export function calculateDaysLate(dueDate: string, paidDate: string): number {
  const due = new Date(dueDate)
  const paid = new Date(paidDate)
  due.setHours(0, 0, 0, 0)
  paid.setHours(0, 0, 0, 0)
  return Math.ceil((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Check if there are changes in payment modal (selection or status vs initial).
 */
export function hasChanges(
  selectedInstallments: Record<string, boolean>,
  initialPaymentStatus: Record<string, boolean>
): boolean {
  const hasSelected = Object.values(selectedInstallments).some(Boolean)
  const hasStatusChanges = Object.keys(initialPaymentStatus).some(id => {
    const current = selectedInstallments[id] || false
    const initial = initialPaymentStatus[id] || false
    return current !== initial
  })
  return hasSelected || hasStatusChanges
}

export interface CanEditInstallmentOptions {
  /** If true, previous installment with status 'paid' counts as editable (FeesTab behavior). */
  considerPaidAsEditable?: boolean
}

/**
 * Check if an installment can be edited (previous must be paid or selected).
 * @param installmentIndex - 0-based index
 * @param paymentInstallments - array of installments with id, status
 * @param selectedInstallments - map of id -> selected
 * @param options - considerPaidAsEditable: FeesTab uses true, FeesManagement uses false
 */
export function canEditInstallment(
  installmentIndex: number,
  paymentInstallments: Array<{ id: string; status?: string }>,
  selectedInstallments: Record<string, boolean>,
  options: CanEditInstallmentOptions = {}
): boolean {
  const { considerPaidAsEditable = false } = options
  if (installmentIndex === 0) return true
  for (let i = 0; i < installmentIndex; i++) {
    const prev = paymentInstallments[i]
    const isPrevPaid = considerPaidAsEditable && prev && prev.status === 'paid'
    const isPrevSelected = prev ? (selectedInstallments[prev.id] || false) : false
    if (!isPrevPaid && !isPrevSelected) return false
  }
  return true
}

export interface FeeTotalsResult {
  total: number
  paid: number
  pending: number
  installments: Array<{
    amount: number
    due_date: string
    status: string
    notes: string
    paid_at: string | null
    installment_number: number
    installment_type: string | null
  }>
}

/**
 * Calculate fee totals from assignments (FeesTab-style: amounts from assignments).
 * Handles amount in cents (>=1000) or euros.
 */
export function calculateFeeTotals(
  feeId: string,
  assignments: Array<{
    fee_id: string
    amount: number
    due_date: string
    status: string
    notes?: string
    paid_at?: string | null
    installment_number?: number
    installment_type?: string | null
    fees?: unknown
  }>
): FeeTotalsResult {
  const feeAssignments = assignments.filter(a => a.fee_id === feeId)
  const fee = feeAssignments[0]?.fees
  if (!fee) return { total: 0, paid: 0, pending: 0, installments: [] }

  let totalAmount = 0
  const sortedAssignments = [...feeAssignments].sort(
    (a, b) => (a.installment_number || 1) - (b.installment_number || 1)
  )
  const installmentsData = sortedAssignments.map(a => {
    const amount = Number(a.amount)
    const amountInEuros = amount > 1000 ? amount / 100 : amount
    totalAmount += amountInEuros
    return {
      amount: amountInEuros,
      due_date: a.due_date,
      status: a.status,
      notes: a.notes || '',
      paid_at: a.paid_at || null,
      installment_number: a.installment_number || 1,
      installment_type: a.installment_type || null
    }
  })

  const paidAmount = feeAssignments
    .filter(a => a.status === 'paid')
    .reduce((sum, a) => {
      const amount = Number(a.amount)
      const amountInEuros = amount > 1000 ? amount / 100 : amount
      return sum + amountInEuros
    }, 0)

  return {
    total: totalAmount,
    paid: paidAmount,
    pending: totalAmount - paidAmount,
    installments: installmentsData
  }
}

/** Build update payload for a single installment */
export function buildInstallmentUpdatePayload(
  isSelected: boolean,
  paymentMethod: string | null,
  paymentDate: string
): { status: 'paid' | 'pending'; paid_at: string | null; payment_method: string | null } {
  const paidAt = isSelected ? paymentDate : null
  return {
    status: isSelected ? 'paid' : 'pending',
    paid_at: paidAt,
    payment_method: isSelected ? paymentMethod : null
  }
}

// --- SUPABASE WRAPPERS ---

export interface MarkInstallmentUpdate {
  id: string
  isSelected: boolean
  paymentMethod: string | null
  paymentDate: string
}

/**
 * Mark installments as paid/pending. Updates fee_assignments in DB.
 */
export async function markInstallmentsPaid(updates: MarkInstallmentUpdate[]): Promise<void> {
  for (const { id, isSelected, paymentMethod, paymentDate } of updates) {
    const paymentDateIso = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString()
    const updateData = {
      status: isSelected ? 'paid' : 'pending',
      paid_at: isSelected ? paymentDateIso : null,
      payment_method: isSelected ? paymentMethod : null
    }
    const { error } = await supabase.from('fee_assignments').update(updateData).eq('id', id)
    if (error) throw error
  }
}

/**
 * Update a single installment in fee_assignments.
 */
export async function updateInstallment(
  assignmentId: string,
  data: { status?: string; paid_at?: string | null; payment_method?: string | null }
): Promise<void> {
  const { error } = await supabase.from('fee_assignments').update(data).eq('id', assignmentId)
  if (error) throw error
}
