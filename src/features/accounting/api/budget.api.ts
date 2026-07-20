import { supabase } from '@/lib/supabaseClient'
import type {
  AccountingBudget,
  AccountingBudgetLine,
  AccountingCategoryRef,
  BudgetLineDirection,
  FeesBudgetAggregate,
  MovementCategoryActualRow
} from '../types'
import {
  computeFeesBudgetAggregate,
  findQuoteCategory,
  type ReceivableBudgetSourceRow
} from '../utils/budgetCalculations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const BUDGET_SELECT =
  'id, fiscal_year_id, name, status, version, notes, approved_at, approved_by, created_at, updated_at'

const LINE_SELECT = `
  id, budget_id, category_id, direction, description, planned_amount_cents,
  sort_order, notes, source_type, created_at, updated_at,
  category:accounting_categories(id, code, name, direction)
`

/** Preventivo attivo (draft|approved) per esercizio, se presente. */
export async function fetchActiveBudget(
  fiscalYearId: string
): Promise<AccountingBudget | null> {
  const { data, error } = await db
    .from('accounting_budgets')
    .select(BUDGET_SELECT)
    .eq('fiscal_year_id', fiscalYearId)
    .in('status', ['draft', 'approved'])
    .maybeSingle()

  if (error) throw error
  return (data as AccountingBudget | null) ?? null
}

/** Preventivo approvato dell'esercizio (per confronto consuntivo). */
export async function fetchApprovedBudget(
  fiscalYearId: string
): Promise<AccountingBudget | null> {
  const { data, error } = await db
    .from('accounting_budgets')
    .select(BUDGET_SELECT)
    .eq('fiscal_year_id', fiscalYearId)
    .eq('status', 'approved')
    .maybeSingle()

  if (error) throw error
  return (data as AccountingBudget | null) ?? null
}

export async function fetchBudgetLines(budgetId: string): Promise<AccountingBudgetLine[]> {
  const { data, error } = await db
    .from('accounting_budget_lines')
    .select(LINE_SELECT)
    .eq('budget_id', budgetId)
    .eq('source_type', 'manual')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as AccountingBudgetLine[]
}

export async function createBudget(input: {
  fiscalYearId: string
  name: string
  notes?: string | null
  version?: number
}): Promise<AccountingBudget> {
  const { data, error } = await db
    .from('accounting_budgets')
    .insert({
      fiscal_year_id: input.fiscalYearId,
      name: input.name.trim(),
      status: 'draft',
      version: input.version ?? 1,
      notes: input.notes?.trim() || null
    })
    .select(BUDGET_SELECT)
    .single()

  if (error) throw error
  return data as AccountingBudget
}

export async function updateBudgetNotes(
  budgetId: string,
  notes: string | null
): Promise<AccountingBudget> {
  const { data, error } = await db
    .from('accounting_budgets')
    .update({ notes: notes?.trim() || null })
    .eq('id', budgetId)
    .eq('status', 'draft')
    .select(BUDGET_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Preventivo non modificabile (solo bozza).')
  return data as AccountingBudget
}

export async function approveBudget(budgetId: string): Promise<AccountingBudget> {
  // approved_at / approved_by sono forzati dal trigger DB da auth.uid().
  // Il client invia solo lo status: non sceglie né inventa approved_by.
  const { data, error } = await db
    .from('accounting_budgets')
    .update({ status: 'approved' })
    .eq('id', budgetId)
    .eq('status', 'draft')
    .select(BUDGET_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Approvazione non riuscita: serve bozza e permesso accounting.post.')
  return data as AccountingBudget
}

export async function archiveBudget(budgetId: string): Promise<AccountingBudget> {
  const { data, error } = await db
    .from('accounting_budgets')
    .update({ status: 'archived' })
    .eq('id', budgetId)
    .eq('status', 'approved')
    .select(BUDGET_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Archiviazione non riuscita: solo preventivi approvati.')
  return data as AccountingBudget
}

/**
 * Archivia il preventivo approvato e crea subito una nuova bozza (v+1)
 * con le stesse voci manuali, così si possono aggiungere/modificare righe.
 */
export async function archiveBudgetAndOpenNewDraft(
  budget: AccountingBudget
): Promise<AccountingBudget> {
  if (budget.status !== 'approved') {
    throw new Error('Solo un preventivo approvato può essere archiviato per una nuova versione.')
  }

  const lines = await fetchBudgetLines(budget.id)
  await archiveBudget(budget.id)

  const latest = await fetchLatestBudgetVersion(budget.fiscal_year_id)
  const next = await createBudget({
    fiscalYearId: budget.fiscal_year_id,
    name: budget.name,
    notes: budget.notes,
    version: Math.max(latest, budget.version) + 1
  })

  for (const line of lines) {
    await createBudgetLine({
      budgetId: next.id,
      categoryId: line.category_id,
      direction: line.direction,
      description: line.description,
      plannedAmountCents: line.planned_amount_cents,
      notes: line.notes,
      sortOrder: line.sort_order
    })
  }

  return next
}

export async function createBudgetLine(input: {
  budgetId: string
  categoryId: string
  direction: BudgetLineDirection
  description: string
  plannedAmountCents: number
  notes?: string | null
  sortOrder?: number
}): Promise<AccountingBudgetLine> {
  const { data, error } = await db
    .from('accounting_budget_lines')
    .insert({
      budget_id: input.budgetId,
      category_id: input.categoryId,
      direction: input.direction,
      description: input.description.trim(),
      planned_amount_cents: input.plannedAmountCents,
      notes: input.notes?.trim() || null,
      sort_order: input.sortOrder ?? 0,
      source_type: 'manual'
    })
    .select(LINE_SELECT)
    .single()

  if (error) throw error
  return data as AccountingBudgetLine
}

export async function updateBudgetLine(
  lineId: string,
  input: {
    categoryId: string
    direction: BudgetLineDirection
    description: string
    plannedAmountCents: number
    notes?: string | null
    sortOrder?: number
  }
): Promise<AccountingBudgetLine> {
  const { data, error } = await db
    .from('accounting_budget_lines')
    .update({
      category_id: input.categoryId,
      direction: input.direction,
      description: input.description.trim(),
      planned_amount_cents: input.plannedAmountCents,
      notes: input.notes?.trim() || null,
      sort_order: input.sortOrder ?? 0,
      source_type: 'manual'
    })
    .eq('id', lineId)
    .eq('source_type', 'manual')
    .select(LINE_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Voce non modificabile.')
  return data as AccountingBudgetLine
}

export async function deleteBudgetLine(lineId: string): Promise<void> {
  const { error } = await db
    .from('accounting_budget_lines')
    .delete()
    .eq('id', lineId)
    .eq('source_type', 'manual')

  if (error) throw error
}

/** Aggregato Quote live: niente riga budget persistita. */
export async function fetchFeesBudgetAggregate(
  fiscalYearId: string,
  categories: AccountingCategoryRef[]
): Promise<FeesBudgetAggregate> {
  const quoteCategory = findQuoteCategory(categories)
  const quoteCategoryId = quoteCategory?.id ?? null

  let query = db
    .from('accounting_receivables')
    .select(
      'expected_amount_cents, collected_amount_cents, residual_amount_cents, status, archived_at, accounting_category_id'
    )
    .eq('fiscal_year_id', fiscalYearId)
    .is('archived_at', null)
    .neq('status', 'cancelled')

  if (quoteCategoryId) {
    query = query.eq('accounting_category_id', quoteCategoryId)
  }

  const { data, error } = await query
  if (error) throw error

  return computeFeesBudgetAggregate(
    (data ?? []) as ReceivableBudgetSourceRow[],
    quoteCategoryId
  )
}

export async function fetchMovementCategoryActualRows(
  fiscalYearId: string
): Promise<MovementCategoryActualRow[]> {
  const { data, error } = await db
    .from('accounting_movements')
    .select('id, category_id, direction, status, amount_cents, reverses_movement_id')
    .eq('fiscal_year_id', fiscalYearId)

  if (error) throw error
  return (data ?? []) as MovementCategoryActualRow[]
}

export async function fetchLatestBudgetVersion(fiscalYearId: string): Promise<number> {
  const { data, error } = await db
    .from('accounting_budgets')
    .select('version')
    .eq('fiscal_year_id', fiscalYearId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data?.version as number | undefined) ?? 0
}
