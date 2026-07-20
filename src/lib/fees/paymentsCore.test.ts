import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => {
  return { supabase: { from: vi.fn() } }
})

import {
  buildInstallmentUpdatePayload,
  calculateDaysLate,
  calculateFeeTotals,
  canEditInstallment,
  fromCents,
  getInstallmentStatus,
  hasChanges,
  toCents,
} from './paymentsCore'

describe('paymentsCore pure helpers', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('converts euros <-> cents without float drift', () => {
    expect(toCents(10)).toBe(1000)
    expect(toCents(10.5)).toBe(1050)
    expect(toCents(19.99)).toBe(1999)
    expect(fromCents(1999)).toBe(19.99)
    expect(fromCents(toCents(12.34))).toBe(12.34)
  })

  it('marks installments overdue only after due date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T12:00:00'))
    expect(getInstallmentStatus('2026-07-17')).toBe('overdue')
    expect(getInstallmentStatus('2026-07-18')).toBe('regular')
    expect(getInstallmentStatus('2026-07-19')).toBe('regular')
  })

  it('calculates days late / early', () => {
    expect(calculateDaysLate('2026-07-01', '2026-07-05')).toBe(4)
    expect(calculateDaysLate('2026-07-10', '2026-07-08')).toBe(-2)
    expect(calculateDaysLate('2026-07-10', '2026-07-10')).toBe(0)
  })

  it('requires previous installments before editing later ones', () => {
    const installments = [
      { id: 'a1', status: 'pending' },
      { id: 'a2', status: 'pending' },
      { id: 'a3', status: 'pending' },
    ]
    expect(canEditInstallment(0, installments, {})).toBe(true)
    expect(canEditInstallment(1, installments, {})).toBe(false)
    expect(canEditInstallment(1, installments, { a1: true })).toBe(true)
    expect(canEditInstallment(1, installments, {}, { considerPaidAsEditable: true })).toBe(false)
    expect(
      canEditInstallment(1, [{ id: 'a1', status: 'paid' }, { id: 'a2' }], {}, { considerPaidAsEditable: true })
    ).toBe(true)
  })

  it('detects payment modal changes', () => {
    expect(hasChanges({ a1: false }, { a1: false })).toBe(false)
    expect(hasChanges({ a1: true }, { a1: false })).toBe(true)
    expect(hasChanges({ a1: false }, { a1: true })).toBe(true)
  })

  it('builds installment update payloads from selection', () => {
    expect(buildInstallmentUpdatePayload(true, 'bonifico', '2026-07-18')).toEqual({
      status: 'paid',
      paid_at: '2026-07-18',
      payment_method: 'bonifico',
    })
    expect(buildInstallmentUpdatePayload(false, 'bonifico', '2026-07-18')).toEqual({
      status: 'pending',
      paid_at: null,
      payment_method: null,
    })
  })

  it('calculates fee totals from assignment cents', () => {
    const totals = calculateFeeTotals('fee-1', [
      {
        fee_id: 'fee-1',
        amount: 10000,
        due_date: '2026-01-01',
        status: 'paid',
        installment_number: 1,
        fees: { id: 'fee-1' },
      },
      {
        fee_id: 'fee-1',
        amount: 5000,
        due_date: '2026-02-01',
        status: 'pending',
        installment_number: 2,
        fees: { id: 'fee-1' },
      },
      {
        fee_id: 'other',
        amount: 9999,
        due_date: '2026-01-01',
        status: 'paid',
        fees: { id: 'other' },
      },
    ])
    expect(totals.total).toBe(150)
    expect(totals.paid).toBe(100)
    expect(totals.pending).toBe(50)
    expect(totals.installments).toHaveLength(2)
  })
})
