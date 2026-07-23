import { supabase } from '@/lib/supabaseClient'
import type {
  AccountingAccountRef,
  AccountingCategoryRef,
  AccountingFiscalYear,
  AccountingMovement,
  AccountingMovementDetail,
  AccountingReceivable,
  CreateTransferInput,
  CreateMovementInput,
  MovementSummaryRow,
  ReconcileFeesPreview,
  UpdateMovementInput
} from '../types'
import { buildMovementsSearchOrClause, escapeIlikePattern } from '../utils/movementsSearch'

/** Cast mirato: tipi Supabase non rigenerati per le tabelle contabili. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function fetchFiscalYears(): Promise<AccountingFiscalYear[]> {
  const { data, error } = await db
    .from('accounting_fiscal_years')
    .select('id, code, starts_on, ends_on, status, currency')
    .order('starts_on', { ascending: false })

  if (error) throw error
  return (data ?? []) as AccountingFiscalYear[]
}

export async function fetchAccounts(): Promise<AccountingAccountRef[]> {
  const { data, error } = await db
    .from('accounting_accounts')
    .select('id, code, name, kind')
    .eq('is_active', true)
    .order('code')

  if (error) throw error
  return (data ?? []) as AccountingAccountRef[]
}

const CATEGORY_SELECT_WITH_SETTINGS = `
  id, code, name, direction, default_nature, group_id,
  is_active, is_system, available_in_movements, available_in_budget, available_in_reports,
  archived_at,
  group:accounting_category_groups(id, code, name, direction, is_active, archived_at)
`

/** Select compatibile con DB senza migration 019 (niente group_id / available_in_*). */
const CATEGORY_SELECT_LEGACY = `
  id, code, name, direction, default_nature,
  is_active, is_system, archived_at
`

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  }
  return String(err ?? '')
}

function isMissingCategorySettingsSchema(err: unknown): boolean {
  const msg = extractErrorMessage(err).toLowerCase()
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '').toLowerCase()
      : ''
  return (
    code === 'pgrst204' ||
    code === '42703' ||
    msg.includes('group_id') ||
    msg.includes('available_in_movements') ||
    msg.includes('available_in_budget') ||
    msg.includes('available_in_reports') ||
    msg.includes('recommended_active') ||
    msg.includes('accounting_category_groups') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find')
  )
}

function normalizeLegacyCategories(rows: AccountingCategoryRef[]): AccountingCategoryRef[] {
  return rows.map((c) => ({
    ...c,
    group_id: c.group_id ?? null,
    available_in_movements: c.available_in_movements ?? true,
    available_in_budget: c.available_in_budget ?? true,
    available_in_reports: c.available_in_reports ?? true,
    group: c.group ?? null
  }))
}

async function fetchCategoriesWithSchemaFallback(options: {
  includeInactive: boolean
}): Promise<{ rows: AccountingCategoryRef[]; usedLegacySchema: boolean }> {
  let query = db
    .from('accounting_categories')
    .select(CATEGORY_SELECT_WITH_SETTINGS)
    .is('archived_at', null)
    .order('sort_order')
    .order('code')

  if (!options.includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (!error) {
    return {
      rows: (data ?? []) as AccountingCategoryRef[],
      usedLegacySchema: false
    }
  }

  if (!isMissingCategorySettingsSchema(error)) {
    throw error
  }

  let legacy = db
    .from('accounting_categories')
    .select(CATEGORY_SELECT_LEGACY)
    .is('archived_at', null)
    .order('code')

  if (!options.includeInactive) {
    legacy = legacy.eq('is_active', true)
  }

  const { data: legacyData, error: legacyError } = await legacy
  if (legacyError) throw legacyError

  return {
    rows: normalizeLegacyCategories((legacyData ?? []) as AccountingCategoryRef[]),
    usedLegacySchema: true
  }
}

export async function fetchCategories(): Promise<AccountingCategoryRef[]> {
  const { rows } = await fetchCategoriesWithSchemaFallback({ includeInactive: false })
  return rows
}

/** Tutte le categorie non archiviate (inclusi inattivi) per storico/consuntivo. */
export async function fetchCategoriesIncludingInactive(): Promise<AccountingCategoryRef[]> {
  const { rows } = await fetchCategoriesWithSchemaFallback({ includeInactive: true })
  return rows
}

/**
 * Come fetchCategoriesIncludingInactive, ma espone se è stato usato lo schema pre-019.
 * Utile per banner UI senza bloccare l’intera Contabilità.
 */
export async function fetchCategoriesIncludingInactiveWithMeta(): Promise<{
  rows: AccountingCategoryRef[]
  usedLegacySchema: boolean
}> {
  return fetchCategoriesWithSchemaFallback({ includeInactive: true })
}

export async function createManualMovement(input: CreateMovementInput): Promise<AccountingMovement> {
  const { data, error } = await db
    .from('accounting_movements')
    .insert({
      fiscal_year_id: input.fiscalYearId,
      movement_date: input.movementDate,
      settlement_date: input.settlementDate,
      direction: input.type,
      amount_cents: input.amountCents,
      currency: 'EUR',
      account_id: input.accountId,
      category_id: input.categoryId,
      description: input.description.trim(),
      notes: input.notes?.trim() || null,
      origin: 'manual',
      status: 'draft',
      payment_method_raw: input.paymentMethod.trim() || null,
      document_type: input.documentType,
      document_number: input.documentNumber?.trim() || null,
      document_date: input.documentDate || null,
      reference: input.reference?.trim() || null
    })
    .select(
      `
      id, movement_date, settlement_date, description, direction, amount_cents, origin, status,
      payment_method_raw, document_type, document_number, document_date, reference, notes,
      created_at, updated_at,
      account:accounting_accounts!accounting_movements_account_id_fkey(id, code, name),
      transfer_account:accounting_accounts!accounting_movements_transfer_account_id_fkey(id, code, name),
      category:accounting_categories(id, code, name, direction)
    `
    )
    .single()

  if (error) throw error
  return data as AccountingMovement
}

export async function updateManualMovement(
  movementId: string,
  input: UpdateMovementInput
): Promise<AccountingMovement> {
  const { data, error } = await db
    .from('accounting_movements')
    .update({
      movement_date: input.movementDate,
      settlement_date: input.settlementDate,
      direction: input.type,
      amount_cents: input.amountCents,
      account_id: input.accountId,
      category_id: input.categoryId,
      description: input.description.trim(),
      notes: input.notes?.trim() || null,
      payment_method_raw: input.paymentMethod.trim() || null,
      document_type: input.documentType,
      document_number: input.documentNumber?.trim() || null,
      document_date: input.documentDate || null,
      reference: input.reference?.trim() || null
    })
    .eq('id', movementId)
    .eq('origin', 'manual')
    .in('status', ['draft', 'pending_account'])
    .select(
      `
      id, movement_date, settlement_date, description, direction, amount_cents, origin, status,
      payment_method_raw, document_type, document_number, document_date, reference, notes,
      created_at, updated_at,
      account:accounting_accounts!accounting_movements_account_id_fkey(id, code, name),
      transfer_account:accounting_accounts!accounting_movements_transfer_account_id_fkey(id, code, name),
      category:accounting_categories(id, code, name, direction)
    `
    )
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error('Movimento non modificabile: bozza manuale non trovata o permesso negato.')
  }
  return data as AccountingMovement
}

export async function createManualTransfer(input: CreateTransferInput): Promise<string> {
  const { data, error } = await db.rpc('accounting_create_manual_transfer', {
    p_fiscal_year_id: input.fiscalYearId,
    p_movement_date: input.movementDate,
    p_settlement_date: input.settlementDate,
    p_amount_cents: input.amountCents,
    p_source_account_id: input.sourceAccountId,
    p_destination_account_id: input.destinationAccountId,
    p_description: input.description.trim(),
    p_notes: input.notes?.trim() || null
  })

  if (error) throw error
  return data as string
}

export async function updateManualTransfer(
  movementId: string,
  input: Omit<CreateTransferInput, 'fiscalYearId'>
): Promise<string> {
  const { data, error } = await db.rpc('accounting_update_manual_transfer', {
    p_movement_id: movementId,
    p_movement_date: input.movementDate,
    p_settlement_date: input.settlementDate,
    p_amount_cents: input.amountCents,
    p_source_account_id: input.sourceAccountId,
    p_destination_account_id: input.destinationAccountId,
    p_description: input.description.trim(),
    p_notes: input.notes?.trim() || null
  })

  if (error) throw error
  return data as string
}

export async function postManualMovement(
  movementId: string,
  overrideReason?: string | null
): Promise<string> {
  const { data, error } = await db.rpc('accounting_post_manual_movement', {
    p_movement_id: movementId,
    p_override_reason: overrideReason?.trim() || null
  })
  if (error) throw error
  return data as string
}

export async function cancelManualMovement(movementId: string, reason: string | null): Promise<string> {
  const { data, error } = await db.rpc('accounting_cancel_manual_movement', {
    p_movement_id: movementId,
    p_reason: reason?.trim() || null
  })
  if (error) throw error
  return data as string
}

export async function reverseManualMovement(
  movementId: string,
  reversalDate: string,
  reason: string
): Promise<string> {
  const { data, error } = await db.rpc('accounting_reverse_manual_movement', {
    p_movement_id: movementId,
    p_reversal_date: reversalDate,
    p_reason: reason.trim()
  })
  if (error) throw error
  return data as string
}

export async function assignPendingAccount(
  movementId: string,
  accountId: string
): Promise<string> {
  const { data, error } = await db.rpc('accounting_assign_pending_account', {
    p_movement_id: movementId,
    p_account_id: accountId
  })
  if (error) throw error
  return data as string
}

export async function fetchMovementDetail(movementId: string): Promise<AccountingMovementDetail> {
  const { data, error } = await db
    .from('accounting_movements')
    .select(
      `
      id, movement_date, settlement_date, description, direction, amount_cents, origin, status,
      payment_method_raw, document_type, document_number, document_date, reference, notes,
      created_at, updated_at, verified_at, verified_by, verification_note,
      receivable_id, reverses_movement_id, reversed_by_movement_id,
      account:accounting_accounts!accounting_movements_account_id_fkey(id, code, name),
      transfer_account:accounting_accounts!accounting_movements_transfer_account_id_fkey(id, code, name),
      category:accounting_categories(id, code, name, direction),
      receivable:accounting_receivables(
        id, description, status, expected_amount_cents, collected_amount_cents, residual_amount_cents
      )
    `
    )
    .eq('id', movementId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Movimento non trovato.')

  const base = data as AccountingMovementDetail
  const [reverses, reversedBy] = await Promise.all([
    base.reverses_movement_id
      ? fetchMovementLink(base.reverses_movement_id)
      : Promise.resolve(null),
    base.reversed_by_movement_id
      ? fetchMovementLink(base.reversed_by_movement_id)
      : Promise.resolve(null)
  ])

  return {
    ...base,
    reverses_movement: reverses,
    reversed_by_movement: reversedBy
  }
}

async function fetchMovementLink(
  movementId: string
): Promise<AccountingMovementDetail['reverses_movement']> {
  const { data, error } = await db
    .from('accounting_movements')
    .select('id, description, amount_cents, movement_date, direction, status')
    .eq('id', movementId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as AccountingMovementDetail['reverses_movement']
}

export function mapSupabaseError(error: unknown): string {
  const msg = extractErrorMessage(error)
  if (!msg) return 'Operazione non riuscita.'
  if (msg.includes('permesso negato') || msg.includes('permission denied')) {
    return 'Permesso negato. Verifica i permessi contabili del tuo ruolo.'
  }
  if (msg.includes('row-level security') || msg.includes('RLS')) {
    return 'Operazione non consentita dalle regole di sicurezza contabili.'
  }
  if (msg.includes('violates check constraint')) {
    return 'Dati non validi: controlla importo, date e campi obbligatori.'
  }
  return msg
}

export async function fetchMovementSummaryRows(fiscalYearId: string): Promise<MovementSummaryRow[]> {
  const { data, error } = await db
    .from('accounting_movements')
    .select('id, direction, status, amount_cents, reverses_movement_id')
    .eq('fiscal_year_id', fiscalYearId)

  if (error) throw error
  return (data ?? []) as MovementSummaryRow[]
}

export async function fetchResidualCreditsCents(fiscalYearId: string): Promise<number> {
  const { data, error } = await db
    .from('accounting_receivables')
    .select('residual_amount_cents')
    .eq('fiscal_year_id', fiscalYearId)
    .is('archived_at', null)
    .not('status', 'in', '(cancelled,paid,refunded)')

  if (error) throw error
  const rows = (data ?? []) as { residual_amount_cents: number }[]
  return rows.reduce((sum, row) => sum + (row.residual_amount_cents ?? 0), 0)
}

export async function fetchPendingReviewCount(fiscalYearId: string): Promise<number> {
  const [{ count: movementCount, error: movErr }, { count: recvCount, error: recvErr }] =
    await Promise.all([
      db
        .from('accounting_movements')
        .select('id', { count: 'exact', head: true })
        .eq('fiscal_year_id', fiscalYearId)
        .in('status', ['pending_account', 'draft']),
      db
        .from('accounting_receivables')
        .select('id', { count: 'exact', head: true })
        .eq('fiscal_year_id', fiscalYearId)
        .eq('status', 'to_review')
        .is('archived_at', null)
    ])

  if (movErr) throw movErr
  if (recvErr) throw recvErr
  return (movementCount ?? 0) + (recvCount ?? 0)
}

export interface FetchMovementsParams {
  fiscalYearId: string
  search: string
  dateFrom: string
  dateTo: string
  direction: string
  status: string
  accountId: string
  page: number
  pageSize: number
}

export interface FetchMovementsResult {
  rows: AccountingMovement[]
  total: number
}

export async function fetchMovements(params: FetchMovementsParams): Promise<FetchMovementsResult> {
  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  let query = db
    .from('accounting_movements')
    .select(
      `
      id, movement_date, description, direction, amount_cents, origin, status,
      payment_method_raw, document_type, document_number, document_date, reference,
      account:accounting_accounts!accounting_movements_account_id_fkey(id, code, name),
      transfer_account:accounting_accounts!accounting_movements_transfer_account_id_fkey(id, code, name),
      category:accounting_categories(id, code, name)
    `,
      { count: 'exact' }
    )
    .eq('fiscal_year_id', params.fiscalYearId)
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (params.search.trim()) {
    const term = params.search.trim()
    const pattern = escapeIlikePattern(term)
    const [{ data: accounts }, { data: categories }] = await Promise.all([
      db
        .from('accounting_accounts')
        .select('id')
        .or(`name.ilike."%${pattern}%",code.ilike."%${pattern}%"`),
      db
        .from('accounting_categories')
        .select('id')
        .or(`name.ilike."%${pattern}%",code.ilike."%${pattern}%"`)
    ])

    const accountIds = ((accounts ?? []) as { id: string }[]).map((r) => r.id)
    const categoryIds = ((categories ?? []) as { id: string }[]).map((r) => r.id)
    query = query.or(buildMovementsSearchOrClause(term, accountIds, categoryIds))
  }
  if (params.dateFrom) query = query.gte('movement_date', params.dateFrom)
  if (params.dateTo) query = query.lte('movement_date', params.dateTo)
  if (params.direction !== 'all') query = query.eq('direction', params.direction)
  if (params.status !== 'all') query = query.eq('status', params.status)
  if (params.accountId !== 'all') query = query.eq('account_id', params.accountId)

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  return {
    rows: (data ?? []) as AccountingMovement[],
    total: count ?? 0
  }
}

/** Tutti i movimenti filtrati, usati esclusivamente per PDF/esportazioni. */
export async function fetchAllMovementsForExport(
  params: Omit<FetchMovementsParams, 'page' | 'pageSize'>
): Promise<AccountingMovement[]> {
  const pageSize = 500
  const firstPage = await fetchMovements({ ...params, page: 1, pageSize })
  const rows = [...firstPage.rows]

  for (let page = 2; rows.length < firstPage.total; page += 1) {
    const result = await fetchMovements({ ...params, page, pageSize })
    rows.push(...result.rows)
    if (result.rows.length === 0) break
  }

  return rows
}

export interface FetchReceivablesParams {
  fiscalYearId: string
  search: string
  status: string
  dueFilter: string
  page: number
  pageSize: number
}

export interface FetchReceivablesResult {
  rows: AccountingReceivable[]
  total: number
}

export async function fetchReceivables(
  params: FetchReceivablesParams
): Promise<FetchReceivablesResult> {
  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1
  const today = new Date().toISOString().slice(0, 10)

  let query = db
    .from('accounting_receivables')
    .select(
      `
      id, description, expected_amount_cents, collected_amount_cents, residual_amount_cents,
      due_date, status, nature, source_system, source_table, source_id,
      person:people(id, given_name, family_name, full_name),
      category:accounting_categories(id, code, name)
    `,
      { count: 'exact' }
    )
    .eq('fiscal_year_id', params.fiscalYearId)
    .is('archived_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (params.search.trim()) {
    query = query.ilike('description', `%${params.search.trim()}%`)
  }
  if (params.status !== 'all') query = query.eq('status', params.status)

  if (params.dueFilter === 'overdue') {
    query = query.lt('due_date', today).not('status', 'in', '(paid,cancelled,refunded)')
  } else if (params.dueFilter === 'upcoming') {
    query = query.gte('due_date', today)
  } else if (params.dueFilter === 'no_date') {
    query = query.is('due_date', null)
  }

  const { data, error, count } = await query.range(from, to)
  if (error) {
    if (error.message?.includes('people') || error.code === 'PGRST200') {
      let fallbackQuery = db
        .from('accounting_receivables')
        .select(
          `
          id, description, expected_amount_cents, collected_amount_cents, residual_amount_cents,
          due_date, status, nature, source_system, source_table, source_id,
          category:accounting_categories(id, code, name)
        `,
          { count: 'exact' }
        )
        .eq('fiscal_year_id', params.fiscalYearId)
        .is('archived_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (params.search.trim()) {
        fallbackQuery = fallbackQuery.ilike('description', `%${params.search.trim()}%`)
      }
      if (params.status !== 'all') fallbackQuery = fallbackQuery.eq('status', params.status)
      if (params.dueFilter === 'overdue') {
        fallbackQuery = fallbackQuery
          .lt('due_date', today)
          .not('status', 'in', '(paid,cancelled,refunded)')
      } else if (params.dueFilter === 'upcoming') {
        fallbackQuery = fallbackQuery.gte('due_date', today)
      } else if (params.dueFilter === 'no_date') {
        fallbackQuery = fallbackQuery.is('due_date', null)
      }

      const fallback = await fallbackQuery.range(from, to)
      if (fallback.error) throw fallback.error
      return {
        rows: ((fallback.data ?? []) as AccountingReceivable[]).map((row) => ({
          ...row,
          person: null
        })),
        total: fallback.count ?? 0
      }
    }
    throw error
  }

  return {
    rows: (data ?? []) as AccountingReceivable[],
    total: count ?? 0
  }
}

export async function reconcileFeesPreview(): Promise<ReconcileFeesPreview> {
  const { data, error } = await db.rpc('accounting_reconcile_fees_preview')
  if (error) throw error
  return data as ReconcileFeesPreview
}

export async function processPendingSync(limit = 200): Promise<Record<string, unknown>> {
  const { data, error } = await db.rpc('accounting_process_pending_sync', { p_limit: limit })
  if (error) throw error
  return (data ?? {}) as Record<string, unknown>
}

export function pickDefaultFiscalYear(years: AccountingFiscalYear[]): AccountingFiscalYear | null {
  if (years.length === 0) return null
  const today = new Date().toISOString().slice(0, 10)

  const openCurrent = years.find(
    (y) =>
      y.status === 'open' &&
      y.starts_on <= today &&
      y.ends_on >= today
  )
  if (openCurrent) return openCurrent

  const anyOpen = years.find((y) => y.status === 'open')
  if (anyOpen) return anyOpen

  return years[0]
}
