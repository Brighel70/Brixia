import { QUOTE_CATEGORY_CODE } from '../constants'
import type {
  AccountingBudgetLine,
  AccountingCategoryRef,
  BudgetComparisonRow,
  BudgetOverviewTotals,
  CategoryActualsResult,
  FeesBudgetAggregate,
  MovementCategoryActualRow
} from '../types'

export interface ReceivableBudgetSourceRow {
  expected_amount_cents: number
  collected_amount_cents: number
  residual_amount_cents: number
  status: string
  archived_at: string | null
  accounting_category_id: string | null
}

/** Receivable “attivi” per preventivo Quote: non cancelled, non archiviati. */
export function isReceivableActiveForBudget(row: {
  status: string
  archived_at: string | null
}): boolean {
  if (row.archived_at) return false
  if (row.status === 'cancelled') return false
  return true
}

/**
 * Aggregato Quote live dai receivable.
 * - previsto = SUM expected
 * - incassato = SUM collected
 * - residuo = SUM residual
 * Esclude cancelled e archived. Include paid.
 */
export function computeFeesBudgetAggregate(
  rows: ReceivableBudgetSourceRow[],
  quoteCategoryId: string | null
): FeesBudgetAggregate {
  let expectedCents = 0
  let collectedCents = 0
  let residualCents = 0

  for (const row of rows) {
    if (!isReceivableActiveForBudget(row)) continue
    if (quoteCategoryId && row.accounting_category_id !== quoteCategoryId) continue

    expectedCents += row.expected_amount_cents ?? 0
    collectedCents += row.collected_amount_cents ?? 0
    residualCents += row.residual_amount_cents ?? 0
  }

  return {
    expectedCents,
    collectedCents,
    residualCents,
    quoteCategoryId
  }
}

/**
 * Effettivi per categoria.
 *
 * - income/expense con status posted → sommano sulla propria categoria
 * - status reversed / draft / cancelled → esclusi (niente doppio conteggio)
 * - reversal (posted | pending_account):
 *     usa reverses_movement_id → direction/category dell'originale
 *     storno entrata → riduce incomeCents della categoria originale
 *     storno uscita → riduce expenseCents della categoria originale
 *     senza originale → unattributedReversalCents (non si indovina)
 */
export function computeActualCentsByCategory(
  rows: MovementCategoryActualRow[]
): CategoryActualsResult {
  const byCategory = new Map<string, { incomeCents: number; expenseCents: number }>()
  let unattributedReversalCents = 0

  const byId = new Map<string, MovementCategoryActualRow>()
  for (const row of rows) {
    byId.set(row.id, row)
  }

  const touch = (categoryId: string | null) => {
    const key = categoryId ?? '__none__'
    let entry = byCategory.get(key)
    if (!entry) {
      entry = { incomeCents: 0, expenseCents: 0 }
      byCategory.set(key, entry)
    }
    return entry
  }

  for (const row of rows) {
    if (row.status === 'draft' || row.status === 'cancelled' || row.status === 'reversed') {
      continue
    }

    if (row.direction === 'income' && row.status === 'posted') {
      touch(row.category_id).incomeCents += row.amount_cents
      continue
    }

    if (row.direction === 'expense' && row.status === 'posted') {
      touch(row.category_id).expenseCents += row.amount_cents
      continue
    }

    if (
      row.direction === 'reversal' &&
      (row.status === 'posted' || row.status === 'pending_account')
    ) {
      const original = row.reverses_movement_id
        ? byId.get(row.reverses_movement_id)
        : undefined

      if (!original) {
        unattributedReversalCents += row.amount_cents
        continue
      }
      if (original.status === 'reversed') {
        continue
      }

      const entry = touch(original.category_id)
      if (original.direction === 'income') {
        entry.incomeCents = Math.max(0, entry.incomeCents - row.amount_cents)
      } else if (original.direction === 'expense') {
        entry.expenseCents = Math.max(0, entry.expenseCents - row.amount_cents)
      } else {
        // Originale non income/expense (es. già un reversal): non attribuire.
        unattributedReversalCents += row.amount_cents
      }
    }
  }

  return { byCategory, unattributedReversalCents }
}

export function safePercent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return (numerator / denominator) * 100
}

export function findQuoteCategory(
  categories: AccountingCategoryRef[]
): AccountingCategoryRef | null {
  return categories.find((c) => c.code.toUpperCase() === QUOTE_CATEGORY_CODE) ?? null
}

export function buildBudgetComparison(params: {
  lines: AccountingBudgetLine[]
  fees: FeesBudgetAggregate
  quoteCategory: AccountingCategoryRef | null
  actualsByCategory: Map<string, { incomeCents: number; expenseCents: number }>
  categories: AccountingCategoryRef[]
  unattributedReversalCents?: number
}): BudgetComparisonRow[] {
  const rows: BudgetComparisonRow[] = []
  const coveredActualKeys = new Set<string>()

  const quoteId = params.quoteCategory?.id ?? params.fees.quoteCategoryId
  if (quoteId || params.fees.expectedCents > 0) {
    const actual = quoteId
      ? params.actualsByCategory.get(quoteId)?.incomeCents ?? 0
      : 0
    if (quoteId) coveredActualKeys.add(`${quoteId}:income`)

    rows.push({
      key: 'fees_live',
      categoryId: quoteId,
      categoryCode: params.quoteCategory?.code ?? QUOTE_CATEGORY_CODE,
      categoryName: params.quoteCategory?.name ?? 'Quote',
      direction: 'income',
      source: 'fees_live',
      description: 'Quote assegnate (calcolate automaticamente)',
      plannedCents: params.fees.expectedCents,
      actualCents: actual,
      varianceCents: actual - params.fees.expectedCents,
      variancePercent: safePercent(actual - params.fees.expectedCents, params.fees.expectedCents),
      realizationPercent: safePercent(actual, params.fees.expectedCents),
      editable: false,
      lineId: null,
      feesCollectedCents: params.fees.collectedCents,
      feesResidualCents: params.fees.residualCents
    })
  }

  const sortedLines = [...params.lines].sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === 'income' ? -1 : 1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.description.localeCompare(b.description, 'it')
  })

  for (const line of sortedLines) {
    const cat = line.category
    const actualEntry = params.actualsByCategory.get(line.category_id)
    const actual =
      line.direction === 'income'
        ? actualEntry?.incomeCents ?? 0
        : actualEntry?.expenseCents ?? 0
    coveredActualKeys.add(`${line.category_id}:${line.direction}`)

    rows.push({
      key: `line:${line.id}`,
      categoryId: line.category_id,
      categoryCode: cat?.code ?? '—',
      categoryName: cat?.name ?? 'Categoria',
      direction: line.direction,
      source: 'manual',
      description: line.description,
      plannedCents: line.planned_amount_cents,
      actualCents: actual,
      varianceCents: actual - line.planned_amount_cents,
      variancePercent: safePercent(actual - line.planned_amount_cents, line.planned_amount_cents),
      realizationPercent: safePercent(actual, line.planned_amount_cents),
      editable: true,
      lineId: line.id
    })
  }

  // Categorie con solo effettivi (nessun previsto) — utili nel confronto.
  for (const [categoryId, amounts] of params.actualsByCategory) {
    if (categoryId === '__none__') continue
    const cat =
      params.categories.find((c) => c.id === categoryId) ??
      (quoteId === categoryId ? params.quoteCategory : null)

    if (amounts.incomeCents > 0 && !coveredActualKeys.has(`${categoryId}:income`)) {
      rows.push({
        key: `actual:${categoryId}:income`,
        categoryId,
        categoryCode: cat?.code ?? '—',
        categoryName: cat?.name ?? 'Categoria',
        direction: 'income',
        source: 'actual_only',
        description: 'Solo effettivo (nessuna voce di preventivo)',
        plannedCents: 0,
        actualCents: amounts.incomeCents,
        varianceCents: amounts.incomeCents,
        variancePercent: null,
        realizationPercent: null,
        editable: false,
        lineId: null
      })
    }

    if (amounts.expenseCents > 0 && !coveredActualKeys.has(`${categoryId}:expense`)) {
      rows.push({
        key: `actual:${categoryId}:expense`,
        categoryId,
        categoryCode: cat?.code ?? '—',
        categoryName: cat?.name ?? 'Categoria',
        direction: 'expense',
        source: 'actual_only',
        description: 'Solo effettivo (nessuna voce di preventivo)',
        plannedCents: 0,
        actualCents: amounts.expenseCents,
        varianceCents: amounts.expenseCents,
        variancePercent: null,
        realizationPercent: null,
        editable: false,
        lineId: null
      })
    }
  }

  return rows
}

export function computeBudgetOverviewTotals(params: {
  comparisonRows: BudgetComparisonRow[]
  actualIncomeCents: number
  actualExpenseCents: number
  actualReversalCents: number
  actualBalanceCents: number
  unattributedReversalCents?: number
}): BudgetOverviewTotals {
  let plannedIncomeCents = 0
  let plannedExpenseCents = 0

  for (const row of params.comparisonRows) {
    if (row.source === 'actual_only') continue
    if (row.direction === 'income') plannedIncomeCents += row.plannedCents
    else plannedExpenseCents += row.plannedCents
  }

  const plannedSurplusCents = plannedIncomeCents - plannedExpenseCents
  const surplusVarianceCents = params.actualBalanceCents - plannedSurplusCents

  return {
    plannedIncomeCents,
    plannedExpenseCents,
    plannedSurplusCents,
    actualIncomeCents: params.actualIncomeCents,
    actualExpenseCents: params.actualExpenseCents,
    actualReversalCents: params.actualReversalCents,
    actualBalanceCents: params.actualBalanceCents,
    surplusVarianceCents,
    incomeRealizationPercent: safePercent(params.actualIncomeCents, plannedIncomeCents),
    expenseRealizationPercent: safePercent(params.actualExpenseCents, plannedExpenseCents),
    unattributedReversalCents: params.unattributedReversalCents ?? 0
  }
}

/** Blocca duplicazione Quote: niente righe manuali sulla categoria QUOTE. */
export function isQuoteCategoryId(
  categoryId: string,
  categories: AccountingCategoryRef[]
): boolean {
  const cat = categories.find((c) => c.id === categoryId)
  return !!cat && cat.code.toUpperCase() === QUOTE_CATEGORY_CODE
}
