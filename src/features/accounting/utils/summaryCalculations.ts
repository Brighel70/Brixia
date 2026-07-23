import type { AccountingSummary, MovementSummaryRow, ReconcileFeesPreview } from '../types'

/**
 * Regole riepilogo movimenti (Step 3A):
 *
 * 1. ENTRATE: somma `amount_cents` con direction = 'income' e status = 'posted'.
 * 2. USCITE: somma con direction = 'expense' e status = 'posted'.
 * 3. STORNI: somma con direction = 'reversal' e status IN ('posted', 'pending_account').
 *    Gli storni riducono il saldo netto (annullano incassi/uscite già contabilizzati).
 * 4. NON contare movimenti con status = 'reversed' (originale già stornato).
 * 5. NON contare draft / cancelled nel saldo operativo.
 * 6. SALDO = entrate - uscite - storni.
 *
 * Evita doppio conteggio: quando un incasso viene stornato, l'originale passa a
 * status 'reversed' (escluso) e esiste un movimento 'reversal' (sottratto).
 */
export function computeAccountingSummary(
  movementRows: MovementSummaryRow[],
  residualCreditsCents: number,
  pendingReviewCount: number
): AccountingSummary {
  let incomeCents = 0
  let expenseCents = 0
  let reversalCents = 0
  let reversalBalanceAdjustmentCents = 0
  const byId = new Map(
    movementRows.flatMap((row) => (row.id ? [[row.id, row] as const] : []))
  )

  for (const row of movementRows) {
    if (row.status === 'reversed' || row.status === 'cancelled' || row.status === 'draft') {
      continue
    }

    if (row.direction === 'income' && row.status === 'posted') {
      incomeCents += row.amount_cents
      continue
    }

    if (row.direction === 'expense' && row.status === 'posted') {
      expenseCents += row.amount_cents
      continue
    }

    if (
      row.direction === 'reversal' &&
      (row.status === 'posted' || row.status === 'pending_account')
    ) {
      reversalCents += row.amount_cents
      const original = row.reverses_movement_id ? byId.get(row.reverses_movement_id) : undefined
      if (!original || original.status === 'reversed') continue

      reversalBalanceAdjustmentCents +=
        original.direction === 'expense' ? row.amount_cents : -row.amount_cents
    }
  }

  return {
    incomeCents,
    expenseCents,
    reversalCents,
    balanceCents: incomeCents - expenseCents + reversalBalanceAdjustmentCents,
    residualCreditsCents,
    pendingReviewCount
  }
}

export function isSyncAligned(preview: ReconcileFeesPreview | null): boolean {
  return preview?.aligned === true
}
