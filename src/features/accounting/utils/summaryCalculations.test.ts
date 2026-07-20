import { describe, expect, it } from 'vitest'
import { computeAccountingSummary } from './summaryCalculations'
import type { MovementSummaryRow } from '../types'

describe('computeAccountingSummary', () => {
  it('esclude movimenti reversed e calcola storni senza doppio conteggio', () => {
    const rows: MovementSummaryRow[] = [
      { direction: 'income', status: 'posted', amount_cents: 50000 },
      { direction: 'income', status: 'reversed', amount_cents: 20000 },
      { direction: 'reversal', status: 'posted', amount_cents: 20000 },
      { direction: 'expense', status: 'posted', amount_cents: 10000 }
    ]

    const summary = computeAccountingSummary(rows, 30000, 1)

    expect(summary.incomeCents).toBe(50000)
    expect(summary.expenseCents).toBe(10000)
    expect(summary.reversalCents).toBe(20000)
    expect(summary.balanceCents).toBe(20000)
    expect(summary.residualCreditsCents).toBe(30000)
    expect(summary.pendingReviewCount).toBe(1)
  })
})
