import { supabase } from '@/lib/supabaseClient'
import type {
  AccountingCategoryGroup,
  AccountingCategorySettingsRow,
  CategoryActivationBatchPayload,
  ReceivableNature
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const GROUP_SELECT =
  'id, direction, code, name, description, is_active, is_system, sort_order, archived_at, created_at, updated_at'

const CATEGORY_SETTINGS_SELECT = `
  id, group_id, code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  available_in_movements, available_in_budget, available_in_reports,
  archived_at, created_at, updated_at
`

export async function fetchCategoryGroups(): Promise<AccountingCategoryGroup[]> {
  const { data, error } = await db
    .from('accounting_category_groups')
    .select(GROUP_SELECT)
    .is('archived_at', null)
    .order('direction')
    .order('sort_order')
    .order('code')

  if (error) throw error
  return (data ?? []) as AccountingCategoryGroup[]
}

export async function fetchCategoriesForSettings(): Promise<AccountingCategorySettingsRow[]> {
  const { data, error } = await db
    .from('accounting_categories')
    .select(CATEGORY_SETTINGS_SELECT)
    .is('archived_at', null)
    .order('sort_order')
    .order('code')

  if (error) throw error
  return (data ?? []) as AccountingCategorySettingsRow[]
}

export async function saveCategoryActivationBatch(
  payload: CategoryActivationBatchPayload
): Promise<unknown> {
  const { data, error } = await db.rpc('accounting_categories_save_activation_batch', {
    p_payload: payload
  })
  if (error) throw error
  return data
}

export async function resetRecommendedCategoryActivation(): Promise<unknown> {
  const { data, error } = await db.rpc('accounting_recommended_activation_reset')
  if (error) throw error
  return data
}

export async function createCategoryGroup(input: {
  direction: 'income' | 'expense'
  code: string
  name: string
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}): Promise<string> {
  const { data, error } = await db.rpc('accounting_category_group_create', {
    p_direction: input.direction,
    p_code: input.code,
    p_name: input.name,
    p_description: input.description ?? null,
    p_sort_order: input.sortOrder ?? 0,
    p_is_active: input.isActive ?? true
  })
  if (error) throw error
  return data as string
}

export async function updateCategoryGroup(input: {
  id: string
  name?: string | null
  description?: string | null
  sortOrder?: number | null
  isActive?: boolean | null
  archive?: boolean | null
}): Promise<void> {
  const { error } = await db.rpc('accounting_category_group_update', {
    p_id: input.id,
    p_name: input.name ?? null,
    p_description: input.description ?? null,
    p_sort_order: input.sortOrder ?? null,
    p_is_active: input.isActive ?? null,
    p_archive: input.archive ?? null
  })
  if (error) throw error
}

export async function createCategory(input: {
  groupId: string
  code: string
  name: string
  notes?: string | null
  defaultNature?: ReceivableNature
  includeInCommercialLimit?: boolean
  availableInMovements?: boolean
  availableInBudget?: boolean
  availableInReports?: boolean
  sortOrder?: number
  isActive?: boolean
}): Promise<string> {
  const { data, error } = await db.rpc('accounting_category_create', {
    p_group_id: input.groupId,
    p_code: input.code,
    p_name: input.name,
    p_notes: input.notes ?? null,
    p_default_nature: input.defaultNature ?? 'to_classify',
    p_include_in_commercial_limit: input.includeInCommercialLimit ?? false,
    p_available_in_movements: input.availableInMovements ?? true,
    p_available_in_budget: input.availableInBudget ?? true,
    p_available_in_reports: input.availableInReports ?? true,
    p_sort_order: input.sortOrder ?? 0,
    p_is_active: input.isActive ?? true
  })
  if (error) throw error
  return data as string
}

export async function updateCategory(input: {
  id: string
  name?: string | null
  notes?: string | null
  defaultNature?: ReceivableNature | null
  includeInCommercialLimit?: boolean | null
  availableInMovements?: boolean | null
  availableInBudget?: boolean | null
  availableInReports?: boolean | null
  sortOrder?: number | null
  isActive?: boolean | null
  archive?: boolean | null
}): Promise<void> {
  const { error } = await db.rpc('accounting_category_update', {
    p_id: input.id,
    p_name: input.name ?? null,
    p_notes: input.notes ?? null,
    p_default_nature: input.defaultNature ?? null,
    p_include_in_commercial_limit: input.includeInCommercialLimit ?? null,
    p_available_in_movements: input.availableInMovements ?? null,
    p_available_in_budget: input.availableInBudget ?? null,
    p_available_in_reports: input.availableInReports ?? null,
    p_sort_order: input.sortOrder ?? null,
    p_is_active: input.isActive ?? null,
    p_archive: input.archive ?? null
  })
  if (error) throw error
}

export async function countCategoryUsage(categoryId: string): Promise<{
  movements: number
  budgetLines: number
}> {
  const [mov, bud] = await Promise.all([
    db
      .from('accounting_movements')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId),
    db
      .from('accounting_budget_lines')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId)
  ])
  if (mov.error) throw mov.error
  if (bud.error) throw bud.error
  return { movements: mov.count ?? 0, budgetLines: bud.count ?? 0 }
}
