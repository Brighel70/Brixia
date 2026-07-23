import { supabase } from '@/lib/supabaseClient'
import type {
  AccountingBankStatementLine,
  AccountingReconciliationSession,
  AccountingReconciliationSummary,
  ReconciliationCandidateMovement,
  ReconciliationCsvImportResult
} from '../types'

/** Cast mirato: tipi Supabase non rigenerati per le tabelle contabili. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const SESSION_SELECT = `
  id, fiscal_year_id, account_id, period_start, period_end,
  opening_balance_cents, closing_balance_statement_cents, status, notes,
  completed_at, created_at, updated_at,
  account:accounting_accounts(id, code, name, kind)
`

const LINE_SELECT = `
  id, session_id, line_date, amount_cents, description, reference, external_id,
  match_status, matched_movement_id, exclude_reason, created_at, updated_at
`

export async function fetchReconciliationSessions(
  fiscalYearId: string
): Promise<AccountingReconciliationSession[]> {
  const { data, error } = await db
    .from('accounting_reconciliation_sessions')
    .select(SESSION_SELECT)
    .eq('fiscal_year_id', fiscalYearId)
    .order('period_start', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AccountingReconciliationSession[]
}

export async function fetchBankStatementLines(
  sessionId: string
): Promise<AccountingBankStatementLine[]> {
  const { data, error } = await db
    .from('accounting_bank_statement_lines')
    .select(LINE_SELECT)
    .eq('session_id', sessionId)
    .order('line_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as AccountingBankStatementLine[]
}

export async function fetchReconciliationSummary(
  sessionId: string
): Promise<AccountingReconciliationSummary> {
  const { data, error } = await db.rpc('accounting_reconciliation_session_summary', {
    p_session_id: sessionId
  })
  if (error) throw error
  return data as AccountingReconciliationSummary
}

/**
 * Movimenti contabilizzati sul conto nel periodo (criterio cassa su settlement/movement),
 * candidati all'abbinamento con righe estratto.
 */
export async function fetchReconciliationCandidateMovements(params: {
  fiscalYearId: string
  accountId: string
  periodStart: string
  periodEnd: string
  excludeMovementIds?: string[]
}): Promise<ReconciliationCandidateMovement[]> {
  const { data, error } = await db
    .from('accounting_movements')
    .select(
      `id, movement_date, settlement_date, description, direction, amount_cents, status,
       reference, account_id, transfer_account_id`
    )
    .eq('fiscal_year_id', params.fiscalYearId)
    .eq('status', 'posted')
    .or(`account_id.eq.${params.accountId},transfer_account_id.eq.${params.accountId}`)
    .order('movement_date', { ascending: true })

  if (error) throw error

  const exclude = new Set(params.excludeMovementIds ?? [])
  const rows = (data ?? []) as ReconciliationCandidateMovement[]

  return rows.filter((m) => {
    if (exclude.has(m.id)) return false
    const cashDate = m.settlement_date || m.movement_date
    return cashDate >= params.periodStart && cashDate <= params.periodEnd
  })
}

export async function createReconciliationSession(input: {
  fiscalYearId: string
  accountId: string
  periodStart: string
  periodEnd: string
  openingBalanceCents: number
  closingBalanceStatementCents: number
  notes?: string | null
}): Promise<string> {
  const { data, error } = await db.rpc('accounting_reconciliation_session_create', {
    p_fiscal_year_id: input.fiscalYearId,
    p_account_id: input.accountId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_opening_balance_cents: input.openingBalanceCents,
    p_closing_balance_statement_cents: input.closingBalanceStatementCents,
    p_notes: input.notes?.trim() || null
  })
  if (error) throw error
  return data as string
}

export async function addReconciliationLine(input: {
  sessionId: string
  lineDate: string
  amountCents: number
  description?: string
  reference?: string | null
  externalId?: string | null
}): Promise<string> {
  const { data, error } = await db.rpc('accounting_reconciliation_line_add', {
    p_session_id: input.sessionId,
    p_line_date: input.lineDate,
    p_amount_cents: input.amountCents,
    p_description: input.description ?? '',
    p_reference: input.reference?.trim() || null,
    p_external_id: input.externalId?.trim() || null
  })
  if (error) throw error
  return data as string
}

export async function importReconciliationCsv(
  sessionId: string,
  csv: string
): Promise<ReconciliationCsvImportResult> {
  const { data, error } = await db.rpc('accounting_reconciliation_line_import_csv', {
    p_session_id: sessionId,
    p_csv: csv
  })
  if (error) throw error
  return data as ReconciliationCsvImportResult
}

export async function matchReconciliationLine(
  lineId: string,
  movementId: string
): Promise<string> {
  const { data, error } = await db.rpc('accounting_reconciliation_line_match', {
    p_line_id: lineId,
    p_movement_id: movementId
  })
  if (error) throw error
  return data as string
}

export async function unmatchReconciliationLine(lineId: string): Promise<string> {
  const { data, error } = await db.rpc('accounting_reconciliation_line_unmatch', {
    p_line_id: lineId
  })
  if (error) throw error
  return data as string
}

export async function excludeReconciliationLine(
  lineId: string,
  reason: string
): Promise<string> {
  const { data, error } = await db.rpc('accounting_reconciliation_line_exclude', {
    p_line_id: lineId,
    p_reason: reason
  })
  if (error) throw error
  return data as string
}

export async function completeReconciliationSession(sessionId: string): Promise<string> {
  const { data, error } = await db.rpc('accounting_reconciliation_session_complete', {
    p_session_id: sessionId
  })
  if (error) throw error
  return data as string
}

export async function cancelReconciliationSession(
  sessionId: string,
  reason?: string | null
): Promise<string> {
  const { data, error } = await db.rpc('accounting_reconciliation_session_cancel', {
    p_session_id: sessionId,
    p_reason: reason?.trim() || null
  })
  if (error) throw error
  return data as string
}
