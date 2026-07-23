import { supabase } from '@/lib/supabaseClient'
import type {
  AccountingFiscalProfile,
  AccountingOperationalDeadline,
  DeadlineStatus,
  DeadlineType
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function fetchFiscalProfile(): Promise<AccountingFiscalProfile> {
  const { data, error } = await db.rpc('accounting_fiscal_profile_get')
  if (error) throw error
  return data as AccountingFiscalProfile
}

export async function updateFiscalProfile(
  payload: Record<string, unknown>,
  reason?: string | null
): Promise<AccountingFiscalProfile> {
  const { data, error } = await db.rpc('accounting_fiscal_profile_update', {
    p_payload: payload,
    p_reason: reason?.trim() || null
  })
  if (error) throw error
  return data as AccountingFiscalProfile
}

export async function fetchOperationalDeadlines(
  fiscalYearId?: string | null
): Promise<AccountingOperationalDeadline[]> {
  let query = db
    .from('accounting_operational_deadlines')
    .select(
      'id, fiscal_year_id, deadline_type, title, due_on, remind_on, assignee_profile_id, status, notes, is_fiscal_filing, created_at, completed_at'
    )
    .order('due_on', { ascending: true })

  if (fiscalYearId) {
    query = query.or(`fiscal_year_id.eq.${fiscalYearId},fiscal_year_id.is.null`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as AccountingOperationalDeadline[]
}

export async function createOperationalDeadline(input: {
  title: string
  dueOn: string
  deadlineType: DeadlineType
  fiscalYearId?: string | null
  assigneeProfileId?: string | null
  remindOn?: string | null
  notes?: string | null
}): Promise<string> {
  const { data, error } = await db.rpc('accounting_deadline_create', {
    p_title: input.title,
    p_due_on: input.dueOn,
    p_deadline_type: input.deadlineType,
    p_fiscal_year_id: input.fiscalYearId ?? null,
    p_assignee_profile_id: input.assigneeProfileId ?? null,
    p_remind_on: input.remindOn ?? null,
    p_notes: input.notes ?? null
  })
  if (error) throw error
  return data as string
}

export async function setOperationalDeadlineStatus(
  id: string,
  status: DeadlineStatus,
  notes?: string | null
): Promise<string> {
  const { data, error } = await db.rpc('accounting_deadline_set_status', {
    p_id: id,
    p_status: status,
    p_notes: notes ?? null
  })
  if (error) throw error
  return data as string
}

export async function setMovementApprovalMode(
  mode: 'simple' | 'verify_then_post',
  reason?: string | null
): Promise<string> {
  const { data, error } = await db.rpc('accounting_set_approval_mode', {
    p_mode: mode,
    p_reason: reason ?? null
  })
  if (error) throw error
  return data as string
}

export async function verifyManualMovement(
  movementId: string,
  note?: string | null
): Promise<string> {
  const { data, error } = await db.rpc('accounting_verify_manual_movement', {
    p_movement_id: movementId,
    p_note: note ?? null
  })
  if (error) throw error
  return data as string
}

export async function fetchAccountingAuditLog(options?: {
  limit?: number
  entityType?: string | null
}): Promise<
  Array<{
    id: string
    entity_type: string
    entity_id: string
    action: string
    action_label: string
    actor_display_name: string | null
    occurred_at: string
    reason: string | null
    origin: string
    old_value: unknown
    new_value: unknown
    metadata: unknown
  }>
> {
  let query = db
    .from('accounting_audit_log_readable')
    .select(
      'id, entity_type, entity_id, action, action_label, actor_display_name, occurred_at, reason, origin, old_value, new_value, metadata'
    )
    .order('occurred_at', { ascending: false })
    .limit(options?.limit ?? 100)

  if (options?.entityType) {
    query = query.eq('entity_type', options.entityType)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
