import { describe, expect, it } from 'vitest'
import {
  buildConsuntivoBudgetCompare,
  computeConsuntivoReport,
  computeFilteredCategoryActuals,
  consuntivoReportToCsv,
  isMovementDocumented,
  movementPassesConsuntivoFilters,
  requiresDocumentCheck
} from './consuntivoCalculations'
import type {
  AccountingBudgetLine,
  AccountingCategoryRef,
  ConsuntivoFilterState,
  ConsuntivoMovementRow
} from '../types'

const quoteCat: AccountingCategoryRef = {
  id: 'cat-q',
  code: 'QUOTE',
  name: 'Quote',
  direction: 'income',
  default_nature: 'institutional'
}
const outCat: AccountingCategoryRef = {
  id: 'cat-out',
  code: 'ALTRE_USCITE',
  name: 'Altre uscite',
  direction: 'expense',
  default_nature: 'to_classify'
}
const inCat: AccountingCategoryRef = {
  id: 'cat-in',
  code: 'ALTRE_ENTRATE',
  name: 'Altre entrate',
  direction: 'income',
  default_nature: 'commercial',
  group: { id: 'group-income', code: 'ENTRATE', name: 'Entrate diverse', direction: 'income' }
}

const accounts = [
  { id: 'acc-cassa', code: 'CASSA', name: 'Cassa' },
  { id: 'acc-banca', code: 'BANCA', name: 'Banca' }
]

const baseFilters: ConsuntivoFilterState = {
  dateFrom: '',
  dateTo: '',
  accountId: 'all',
  categoryId: 'all',
  nature: 'all',
  direction: 'all',
  status: 'all'
}

function m(partial: Partial<ConsuntivoMovementRow> & Pick<ConsuntivoMovementRow, 'id'>): ConsuntivoMovementRow {
  return {
    movement_date: '2026-06-01',
    direction: 'income',
    status: 'posted',
    amount_cents: 1000,
    category_id: 'cat-in',
    account_id: 'acc-cassa',
    origin: 'manual',
    reverses_movement_id: null,
    document_type: null,
    document_number: null,
    reference: null,
    description: 'test',
    ...partial
  }
}

describe('consuntivoCalculations', () => {
  it('raggruppa per macro-categoria e conserva le categorie legacy', () => {
    const legacy: AccountingCategoryRef = {
      id: 'cat-legacy',
      code: 'STORICA',
      name: 'Voce storica',
      direction: 'income',
      default_nature: 'to_classify',
      archived_at: '2026-01-01',
      is_active: false
    }
    const report = computeConsuntivoReport({
      movements: [
        m({ id: 'grouped', category_id: 'cat-in', amount_cents: 1200 }),
        m({ id: 'legacy', category_id: 'cat-legacy', amount_cents: 800 })
      ],
      filters: baseFilters,
      categories: [inCat, legacy],
      accounts,
      budgetLines: [],
      hasActiveBudget: false,
      fees: null,
      quoteCategory: null
    })
    expect(report.categoryGroups).toHaveLength(2)
    expect(report.categoryGroups[0]).toMatchObject({
      groupCode: 'ENTRATE', incomeCents: 1200, movementCount: 1
    })
    expect(report.categoryGroups[1]).toMatchObject({
      isLegacy: true, incomeCents: 800
    })
    expect(report.categoryGroups[1].categories[0]).toMatchObject({
      isArchived: true, isInactive: true
    })
  })

  it('conteggia entrate e uscite posted', () => {
    const rows = [
      m({ id: '1', direction: 'income', amount_cents: 5000, category_id: 'cat-in' }),
      m({ id: '2', direction: 'expense', amount_cents: 2000, category_id: 'cat-out' })
    ]
    const ids = new Set(rows.map((r) => r.id))
    const { byCategory } = computeFilteredCategoryActuals(rows, ids)
    expect(byCategory.get('cat-in')?.incomeCents).toBe(5000)
    expect(byCategory.get('cat-out')?.expenseCents).toBe(2000)
  })

  it('storno di un originale gia stornato non riduce una seconda volta la categoria', () => {
    const rows = [
      m({ id: 'pay', direction: 'income', status: 'reversed', amount_cents: 3000, category_id: 'cat-q' }),
      m({
        id: 'keep',
        direction: 'income',
        status: 'posted',
        amount_cents: 8000,
        category_id: 'cat-q'
      }),
      m({
        id: 'rev',
        direction: 'reversal',
        status: 'posted',
        amount_cents: 3000,
        category_id: null,
        reverses_movement_id: 'pay'
      })
    ]
    const { byCategory } = computeFilteredCategoryActuals(
      rows,
      new Set(rows.map((r) => r.id))
    )
    expect(byCategory.get('cat-q')?.incomeCents).toBe(8000)
  })

  it('storno di un uscita gia stornata non riduce una seconda volta la categoria', () => {
    const rows = [
      m({
        id: 'exp',
        direction: 'expense',
        status: 'reversed',
        amount_cents: 1500,
        category_id: 'cat-out'
      }),
      m({
        id: 'exp2',
        direction: 'expense',
        status: 'posted',
        amount_cents: 4000,
        category_id: 'cat-out'
      }),
      m({
        id: 'rev',
        direction: 'reversal',
        status: 'posted',
        amount_cents: 1500,
        reverses_movement_id: 'exp'
      })
    ]
    const { byCategory } = computeFilteredCategoryActuals(
      rows,
      new Set(rows.map((r) => r.id))
    )
    expect(byCategory.get('cat-out')?.expenseCents).toBe(4000)
  })

  it('storno senza originale non attribuito', () => {
    const rows = [
      m({ id: 'i', direction: 'income', amount_cents: 10000 }),
      m({
        id: 'orphan',
        direction: 'reversal',
        status: 'posted',
        amount_cents: 2000,
        reverses_movement_id: null
      })
    ]
    const { byCategory, unattributedReversalCents } = computeFilteredCategoryActuals(
      rows,
      new Set(rows.map((r) => r.id))
    )
    expect(byCategory.get('cat-in')?.incomeCents).toBe(10000)
    expect(unattributedReversalCents).toBe(2000)
  })

  it('esclude draft, reversed e cancelled dal conteggio positivo', () => {
    const rows = [
      m({ id: 'ok', amount_cents: 1000 }),
      m({ id: 'd', status: 'draft', amount_cents: 9999 }),
      m({ id: 'c', status: 'cancelled', amount_cents: 8888 }),
      m({ id: 'r', status: 'reversed', amount_cents: 7777 })
    ]
    const { byCategory } = computeFilteredCategoryActuals(
      rows,
      new Set(rows.map((r) => r.id))
    )
    expect(byCategory.get('cat-in')?.incomeCents).toBe(1000)
  })

  it('credito Quote residuo non entra nelle entrate effettive', () => {
    const report = computeConsuntivoReport({
      movements: [m({ id: '1', direction: 'income', amount_cents: 1000, category_id: 'cat-in' })],
      filters: baseFilters,
      categories: [quoteCat, inCat, outCat],
      accounts,
      budgetLines: [],
      hasActiveBudget: false,
      fees: {
        expectedCents: 50000,
        collectedCents: 10000,
        residualCents: 40000,
        quoteCategoryId: 'cat-q'
      },
      quoteCategory: quoteCat
    })
    expect(report.kpis.incomeCents).toBe(1000)
    expect(report.kpis.quoteResidualCents).toBe(40000)
  })

  it('confronto preventivo e divisione per zero', () => {
    const lines: AccountingBudgetLine[] = [
      {
        id: 'l1',
        budget_id: 'b',
        category_id: 'cat-in',
        direction: 'income',
        description: 'Sponsor',
        planned_amount_cents: 0,
        sort_order: 0,
        notes: null,
        source_type: 'manual',
        created_at: '',
        updated_at: '',
        category: inCat
      }
    ]
    const compare = buildConsuntivoBudgetCompare({
      budgetLines: lines,
      fees: null,
      quoteCategory: null,
      actualByCategory: new Map([['cat-in', { incomeCents: 100, expenseCents: 0 }]]),
      actualIncomeCents: 100,
      actualExpenseCents: 0
    })
    const sponsor = compare.find((r) => r.key === 'line:l1')
    expect(sponsor?.realizationPercent).toBeNull()
    expect(sponsor?.varianceCents).toBe(100)
  })

  it('filtri e documentazione', () => {
    const row = m({
      id: 'x',
      account_id: 'acc-banca',
      document_type: 'invoice',
      document_number: '1'
    })
    expect(
      movementPassesConsuntivoFilters(
        row,
        { ...baseFilters, accountId: 'acc-cassa' },
        new Map([['cat-in', inCat]]),
        new Map([['x', row]])
      )
    ).toBe(false)
    expect(isMovementDocumented(row)).toBe(true)
    expect(requiresDocumentCheck({ origin: 'fee_sync' })).toBe(false)
    expect(requiresDocumentCheck({ origin: 'manual' })).toBe(true)
  })

  it('filtri aggiornano KPI e CSV coerentemente', () => {
    const movements = [
      m({
        id: 'cassa',
        account_id: 'acc-cassa',
        amount_cents: 1000,
        category_id: 'cat-in'
      }),
      m({
        id: 'banca',
        account_id: 'acc-banca',
        amount_cents: 9000,
        category_id: 'cat-in'
      })
    ]
    const filtered = computeConsuntivoReport({
      movements,
      filters: { ...baseFilters, accountId: 'acc-cassa' },
      categories: [quoteCat, inCat, outCat],
      accounts,
      budgetLines: [],
      hasActiveBudget: false,
      fees: null,
      quoteCategory: quoteCat
    })
    expect(filtered.kpis.incomeCents).toBe(1000)
    const csv = consuntivoReportToCsv(filtered, '2026')
    expect(csv).toContain('Entrate;1000')
    expect(csv).not.toContain('Entrate;10000')
  })

  it('esporta CSV con intestazione provvisoria', () => {
    const report = computeConsuntivoReport({
      movements: [
        m({ id: '1', amount_cents: 2000, reference: 'CRO-1' }),
        m({
          id: '2',
          direction: 'expense',
          amount_cents: 500,
          category_id: 'cat-out',
          document_type: null
        })
      ],
      filters: baseFilters,
      categories: [quoteCat, inCat, outCat],
      accounts,
      budgetLines: [],
      hasActiveBudget: false,
      fees: null,
      quoteCategory: quoteCat
    })
    const csv = consuntivoReportToCsv(report, '2026')
    expect(csv).toContain('Rendiconto gestionale provvisorio — non ancora chiuso')
    expect(csv).toContain('Nessun preventivo approvato')
    expect(csv).toContain('Entrate;2000')
  })
})
