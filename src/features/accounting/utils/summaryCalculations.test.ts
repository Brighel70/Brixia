import { describe, expect, it } from 'vitest'
import { computeAccountingSummary } from './summaryCalculations'
import type { MovementSummaryRow } from '../types'

describe('computeAccountingSummary', () => {
  it('mantiene lo storno nello storico senza sottrarre due volte l originale gia stornato', () => {
    const rows: MovementSummaryRow[] = [
      { id: 'keep', direction: 'income', status: 'posted', amount_cents: 50000 },
      { id: 'original', direction: 'income', status: 'reversed', amount_cents: 20000 },
      { id: 'reversal', direction: 'reversal', status: 'posted', amount_cents: 20000, reverses_movement_id: 'original' },
      { id: 'expense', direction: 'expense', status: 'posted', amount_cents: 10000 }
    ]

    const summary = computeAccountingSummary(rows, 30000, 1)

    expect(summary.incomeCents).toBe(50000)
    expect(summary.expenseCents).toBe(10000)
    expect(summary.reversalCents).toBe(20000)
    expect(summary.balanceCents).toBe(40000)
    expect(summary.residualCreditsCents).toBe(30000)
    expect(summary.pendingReviewCount).toBe(1)
  })
})
