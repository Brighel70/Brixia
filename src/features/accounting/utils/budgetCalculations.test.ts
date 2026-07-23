import { describe, expect, it } from 'vitest'
import {
  buildBudgetComparison,
  computeActualCentsByCategory,
  computeBudgetOverviewTotals,
  computeFeesBudgetAggregate,
  isQuoteCategoryId,
  isReceivableActiveForBudget,
  safePercent
} from './budgetCalculations'
import type { AccountingBudgetLine, AccountingCategoryRef, MovementCategoryActualRow } from '../types'

const quoteCat: AccountingCategoryRef = {
  id: 'cat-quote',
  code: 'QUOTE',
  name: 'Quote',
  direction: 'income'
}
const otherIncome: AccountingCategoryRef = {
  id: 'cat-in',
  code: 'ALTRE_ENTRATE',
  name: 'Altre entrate',
  direction: 'income'
}
const otherExpense: AccountingCategoryRef = {
  id: 'cat-out',
  code: 'ALTRE_USCITE',
  name: 'Altre uscite',
  direction: 'expense'
}

describe('budgetCalculations', () => {
  it('aggrega Quote escludendo cancelled e archived; include paid', () => {
    const agg = computeFeesBudgetAggregate(
      [
        {
          expected_amount_cents: 10000,
          collected_amount_cents: 4000,
          residual_amount_cents: 6000,
          status: 'assigned',
          archived_at: null,
          accounting_category_id: 'cat-quote'
        },
        {
          expected_amount_cents: 5000,
          collected_amount_cents: 5000,
          residual_amount_cents: 0,
          status: 'paid',
          archived_at: null,
          accounting_category_id: 'cat-quote'
        },
        {
          expected_amount_cents: 9999,
          collected_amount_cents: 0,
          residual_amount_cents: 9999,
          status: 'cancelled',
          archived_at: null,
          accounting_category_id: 'cat-quote'
        },
        {
          expected_amount_cents: 8888,
          collected_amount_cents: 0,
          residual_amount_cents: 8888,
          status: 'assigned',
          archived_at: '2026-01-01',
          accounting_category_id: 'cat-quote'
        }
      ],
      'cat-quote'
    )

    expect(agg.expectedCents).toBe(15000)
    expect(agg.collectedCents).toBe(9000)
    expect(agg.residualCents).toBe(6000)
    expect(isReceivableActiveForBudget({ status: 'cancelled', archived_at: null })).toBe(false)
  })

  it('storno con originale gia stornato non riduce una seconda volta la categoria', () => {
    const rows: MovementCategoryActualRow[] = [
      {
        id: 'm1',
        category_id: 'cat-quote',
        direction: 'income',
        status: 'posted',
        amount_cents: 8000,
        reverses_movement_id: null
      },
      {
        id: 'm2',
        category_id: 'cat-quote',
        direction: 'income',
        status: 'reversed',
        amount_cents: 2000,
        reverses_movement_id: null
      },
      {
        id: 'm3',
        category_id: 'cat-quote',
        direction: 'reversal',
        status: 'posted',
        amount_cents: 2000,
        reverses_movement_id: 'm2'
      }
    ]

    const { byCategory, unattributedReversalCents } = computeActualCentsByCategory(rows)
    // m2 escluso (reversed); m1=8000; storno m3 attribuisce su originale m2 (income) → non tocca m1
    // Ma storno di m2: original was 2000 income reversed, subtracting from incomeCents which only has m1's 8000
    // Wait: original m2 is reversed and excluded from income sum. Reversal subtracts from category of m2.
    // So income starts at 8000 (m1 only), then reversal of m2 subtracts 2000 from income → 6000.
    expect(byCategory.get('cat-quote')?.incomeCents).toBe(8000)
    expect(unattributedReversalCents).toBe(0)
  })

  it('storno di uscita con originale gia stornato non riduce una seconda volta la categoria', () => {
    const rows: MovementCategoryActualRow[] = [
      {
        id: 'e1',
        category_id: 'cat-out',
        direction: 'expense',
        status: 'posted',
        amount_cents: 5000,
        reverses_movement_id: null
      },
      {
        id: 'e2',
        category_id: 'cat-out',
        direction: 'expense',
        status: 'reversed',
        amount_cents: 1500,
        reverses_movement_id: null
      },
      {
        id: 'r1',
        category_id: null,
        direction: 'reversal',
        status: 'posted',
        amount_cents: 1500,
        reverses_movement_id: 'e2'
      }
    ]

    const { byCategory } = computeActualCentsByCategory(rows)
    expect(byCategory.get('cat-out')?.expenseCents).toBe(5000)
  })

  it('storno senza originale: non attribuito, nessun indovinare', () => {
    const rows: MovementCategoryActualRow[] = [
      {
        id: 'i1',
        category_id: 'cat-in',
        direction: 'income',
        status: 'posted',
        amount_cents: 10000,
        reverses_movement_id: null
      },
      {
        id: 'r-orphan',
        category_id: 'cat-in',
        direction: 'reversal',
        status: 'posted',
        amount_cents: 3000,
        reverses_movement_id: null
      },
      {
        id: 'r-missing',
        category_id: 'cat-in',
        direction: 'reversal',
        status: 'posted',
        amount_cents: 500,
        reverses_movement_id: 'does-not-exist'
      }
    ]

    const { byCategory, unattributedReversalCents } = computeActualCentsByCategory(rows)
    expect(byCategory.get('cat-in')?.incomeCents).toBe(10000)
    expect(unattributedReversalCents).toBe(3500)
  })

  it('nessun doppio conteggio: originale reversed escluso + storno su originale', () => {
    const rows: MovementCategoryActualRow[] = [
      {
        id: 'pay',
        category_id: 'cat-quote',
        direction: 'income',
        status: 'reversed',
        amount_cents: 10000,
        reverses_movement_id: null
      },
      {
        id: 'rev',
        category_id: 'cat-quote',
        direction: 'reversal',
        status: 'posted',
        amount_cents: 10000,
        reverses_movement_id: 'pay'
      }
    ]

    const { byCategory } = computeActualCentsByCategory(rows)
    // originale escluso → income 0; storno sottrae da 0 → resta 0 (non negativo)
    expect(byCategory.get('cat-quote')?.incomeCents ?? 0).toBe(0)
  })

  it('gestisce divisione per zero nelle percentuali', () => {
    expect(safePercent(10, 0)).toBeNull()
    expect(safePercent(50, 100)).toBe(50)
  })

  it('costruisce confronto senza duplicare Quote manuali', () => {
    const lines: AccountingBudgetLine[] = [
      {
        id: 'l1',
        budget_id: 'b1',
        category_id: 'cat-in',
        direction: 'income',
        description: 'Sponsor',
        planned_amount_cents: 20000,
        sort_order: 0,
        notes: null,
        source_type: 'manual',
        created_at: '',
        updated_at: '',
        category: otherIncome
      },
      {
        id: 'l2',
        budget_id: 'b1',
        category_id: 'cat-out',
        direction: 'expense',
        description: 'Affitto',
        planned_amount_cents: 12000,
        sort_order: 0,
        notes: null,
        source_type: 'manual',
        created_at: '',
        updated_at: '',
        category: otherExpense
      }
    ]

    const { byCategory } = computeActualCentsByCategory([
      {
        id: 'a1',
        category_id: 'cat-quote',
        direction: 'income',
        status: 'posted',
        amount_cents: 9000,
        reverses_movement_id: null
      },
      {
        id: 'a2',
        category_id: 'cat-in',
        direction: 'income',
        status: 'posted',
        amount_cents: 15000,
        reverses_movement_id: null
      },
      {
        id: 'a3',
        category_id: 'cat-out',
        direction: 'expense',
        status: 'posted',
        amount_cents: 10000,
        reverses_movement_id: null
      }
    ])

    const comparison = buildBudgetComparison({
      lines,
      fees: {
        expectedCents: 15000,
        collectedCents: 9000,
        residualCents: 6000,
        quoteCategoryId: 'cat-quote'
      },
      quoteCategory: quoteCat,
      actualsByCategory: byCategory,
      categories: [quoteCat, otherIncome, otherExpense]
    })

    expect(comparison.find((r) => r.source === 'fees_live')?.plannedCents).toBe(15000)
    expect(comparison.find((r) => r.source === 'fees_live')?.editable).toBe(false)
    expect(comparison.filter((r) => r.categoryCode === 'QUOTE')).toHaveLength(1)

    const totals = computeBudgetOverviewTotals({
      comparisonRows: comparison,
      actualIncomeCents: 24000,
      actualExpenseCents: 10000,
      actualReversalCents: 0,
      actualBalanceCents: 14000,
      unattributedReversalCents: 0
    })

    expect(totals.plannedIncomeCents).toBe(35000)
    expect(totals.plannedExpenseCents).toBe(12000)
    expect(totals.plannedSurplusCents).toBe(23000)
    expect(totals.surplusVarianceCents).toBe(14000 - 23000)
    expect(totals.incomeRealizationPercent).toBeCloseTo((24000 / 35000) * 100)
  })

  it('riconosce la categoria QUOTE per bloccare righe manuali', () => {
    expect(isQuoteCategoryId('cat-quote', [quoteCat, otherIncome])).toBe(true)
    expect(isQuoteCategoryId('cat-in', [quoteCat, otherIncome])).toBe(false)
  })
})
