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

/** Values persisted for fees and payments are always expressed in cents. */
export const toCents = (amountInEuros: number): number => Math.round(Number(amountInEuros) * 100)

export const fromCents = (amountInCents: number): number => Number(amountInCents) / 100

/**
 * Calculate fee totals from assignments (FeesTab-style: amounts from assignments).
 * Amounts in fee_assignments are stored in cents.
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
    const amountInEuros = fromCents(a.amount)
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
      const amountInEuros = fromCents(a.amount)
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

export interface AssignmentPaymentInput {
  assignmentId: string
  amountInCents: number
  paymentMethod: string
  paymentDate: string
  reference?: string | null
  notes?: string | null
}

export interface AssignmentPaymentResult {
  paidAmount: number
  isFullyPaid: boolean
}

/**
 * Records one payment and derives the assignment status from its real payment
 * history. This is the only write path for a financial collection.
 */
export async function recordAssignmentPayment({
  assignmentId,
  amountInCents,
  paymentMethod,
  paymentDate,
  reference = null,
  notes = null
}: AssignmentPaymentInput): Promise<AssignmentPaymentResult> {
  const amount = Math.round(Number(amountInCents))
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('L\'importo del pagamento deve essere positivo')
  }

  const [{ data: assignment, error: assignmentError }, { data: existingPayments, error: paymentsError }] = await Promise.all([
    supabase.from('fee_assignments').select('id, amount').eq('id', assignmentId).single(),
    supabase.from('payments').select('amount').eq('assignment_id', assignmentId)
  ])

  if (assignmentError) throw assignmentError
  if (paymentsError) throw paymentsError

  const paidBefore = (existingPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  if (paidBefore + amount > Number(assignment.amount)) {
    throw new Error('Il pagamento supera il residuo della quota')
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    assignment_id: assignmentId,
    amount,
    payment_method: paymentMethod,
    payment_date: paymentDate,
    reference,
    notes
  })
  if (paymentError) throw paymentError

  const paidAmount = paidBefore + amount
  const isFullyPaid = paidAmount >= Number(assignment.amount)
  const paidAt = isFullyPaid ? new Date(paymentDate).toISOString() : null
  const { error: statusError } = await supabase
    .from('fee_assignments')
    .update({
      status: isFullyPaid ? 'paid' : 'pending',
      paid_at: paidAt,
      paid_date: isFullyPaid ? paymentDate : null,
      payment_method: paymentMethod
    })
    .eq('id', assignmentId)
  if (statusError) throw statusError

  return { paidAmount, isFullyPaid }
}

/**
 * Settles selected installments through payment records. Existing payments are
 * never deleted by a checkbox change: financial reversals need their own flow.
 */
export async function markInstallmentsPaid(updates: MarkInstallmentUpdate[]): Promise<void> {
  const selectedUpdates = updates.filter(update => update.isSelected)
  if (selectedUpdates.length === 0) return

  const assignmentIds = selectedUpdates.map(update => update.id)
  const [{ data: assignments, error: assignmentsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from('fee_assignments').select('id, amount').in('id', assignmentIds),
    supabase.from('payments').select('assignment_id, amount').in('assignment_id', assignmentIds)
  ])
  if (assignmentsError) throw assignmentsError
  if (paymentsError) throw paymentsError

  const paidByAssignment = (payments || []).reduce<Record<string, number>>((totals, payment) => {
    totals[payment.assignment_id] = (totals[payment.assignment_id] || 0) + Number(payment.amount || 0)
    return totals
  }, {})

  for (const update of selectedUpdates) {
    const assignment = assignments?.find(item => item.id === update.id)
    if (!assignment) throw new Error('Rata non trovata')
    const remainingAmount = Number(assignment.amount) - (paidByAssignment[update.id] || 0)
    if (remainingAmount <= 0) continue
    if (!update.paymentMethod) throw new Error('Metodo di pagamento mancante')

    await recordAssignmentPayment({
      assignmentId: update.id,
      amountInCents: remainingAmount,
      paymentMethod: update.paymentMethod,
      paymentDate: update.paymentDate
    })
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
