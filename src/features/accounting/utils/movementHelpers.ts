import type { AccountingMovement, MovementOrigin, MovementStatus } from '../types'

const SYSTEM_ORIGINS: MovementOrigin[] = ['fee_sync', 'backfill', 'reversal', 'refund']

export function isSystemMovementOrigin(origin: MovementOrigin): boolean {
  return SYSTEM_ORIGINS.includes(origin)
}

export function isManualDraftEditable(
  origin: MovementOrigin,
  status: MovementStatus
): boolean {
  return origin === 'manual' && (status === 'draft' || status === 'pending_account')
}

export function canOpenMovementDetail(_movement: AccountingMovement): boolean {
  return true
}
