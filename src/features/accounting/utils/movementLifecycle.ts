export type MovementLifecycleAction =
  | 'post'
  | 'cancel'
  | 'reverse'
  | 'assign_account'
  | 'verify'

export interface MovementLifecycleRequest {
  action: MovementLifecycleAction
  movementId: string
  reason?: string
  overrideReason?: string
  movementDate?: string
  accountId?: string
}

export function isManualDraft(origin: string, status: string): boolean {
  return origin === 'manual' && (status === 'draft' || status === 'pending_account')
}

export function isManualPosted(origin: string, status: string): boolean {
  return origin === 'manual' && status === 'posted'
}

export function needsAccountAssignment(origin: string, status: string): boolean {
  return status === 'pending_account' && (origin === 'fee_sync' || origin === 'backfill')
}
