import type {
  AccountingCategoryGroup,
  AccountingCategorySettingsRow,
  CategoryActivationBatchPayload
} from '../types'

export const PROTECTED_CATEGORY_CODES = new Set(['QUOTE'])

export function normalizeCategoryCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

export function suggestCodeFromName(name: string): string {
  return normalizeCategoryCode(name)
}

export function isProtectedCategory(cat: Pick<AccountingCategorySettingsRow, 'code' | 'is_system'>): boolean {
  return PROTECTED_CATEGORY_CODES.has(cat.code.toUpperCase()) || cat.code.toUpperCase() === 'QUOTE'
}

export type TriState = boolean | 'indeterminate'

export function groupActivationState(
  categories: AccountingCategorySettingsRow[]
): TriState {
  const activatable = categories.filter((c) => !isProtectedCategory(c))
  if (activatable.length === 0) {
    // Solo protette: se QUOTE attiva → indeterminate (macro resta attiva per protezione)
    return categories.some((c) => c.is_active) ? 'indeterminate' : false
  }
  const activeCount = activatable.filter((c) => c.is_active).length
  if (activeCount === 0) {
    // Protette ancora attive → indeterminate
    if (categories.some((c) => isProtectedCategory(c) && c.is_active)) return 'indeterminate'
    return false
  }
  if (activeCount === activatable.length) return true
  return 'indeterminate'
}

export function applyMasterGroupToggle(
  categories: AccountingCategorySettingsRow[],
  activate: boolean
): AccountingCategorySettingsRow[] {
  return categories.map((c) => {
    if (isProtectedCategory(c)) {
      return { ...c, is_active: true }
    }
    return { ...c, is_active: activate }
  })
}

export function buildActivationPayload(
  groups: AccountingCategoryGroup[],
  categories: AccountingCategorySettingsRow[]
): CategoryActivationBatchPayload {
  return {
    groups: groups.map((g) => ({
      id: g.id,
      is_active: g.is_active
    })),
    categories: categories.map((c) => ({
      id: c.id,
      is_active: isProtectedCategory(c) ? true : c.is_active,
      available_in_movements: c.available_in_movements,
      available_in_budget: c.available_in_budget,
      available_in_reports: c.available_in_reports
    }))
  }
}

export function filterSettingsRows(params: {
  groups: AccountingCategoryGroup[]
  categories: AccountingCategorySettingsRow[]
  direction: 'income' | 'expense'
  search: string
  statusFilter: 'all' | 'active' | 'inactive'
  originFilter: 'all' | 'system' | 'custom'
}): {
  groups: AccountingCategoryGroup[]
  categoriesByGroup: Map<string, AccountingCategorySettingsRow[]>
} {
  const q = params.search.trim().toLowerCase()
  const groups = params.groups
    .filter((g) => g.direction === params.direction)
    .filter((g) => {
      if (!q) return true
      if (g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q)) return true
      return params.categories.some(
        (c) =>
          c.group_id === g.id &&
          (c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      )
    })

  const categoriesByGroup = new Map<string, AccountingCategorySettingsRow[]>()
  for (const g of groups) {
    let cats = params.categories.filter((c) => c.group_id === g.id)
    if (params.statusFilter === 'active') cats = cats.filter((c) => c.is_active)
    if (params.statusFilter === 'inactive') cats = cats.filter((c) => !c.is_active)
    if (params.originFilter === 'system') cats = cats.filter((c) => c.is_system)
    if (params.originFilter === 'custom') cats = cats.filter((c) => !c.is_system)
    if (q) {
      const groupMatches =
        g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q)
      if (!groupMatches) {
        cats = cats.filter(
          (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
        )
      }
    }
    categoriesByGroup.set(g.id, cats)
  }

  return { groups, categoriesByGroup }
}

/** Categorie usabili nei form operativi (nuovi inserimenti). */
export function isCategorySelectableForMovements(
  c: Pick<
    AccountingCategorySettingsRow,
    'is_active' | 'available_in_movements' | 'archived_at'
  >
): boolean {
  return c.is_active && c.available_in_movements && !c.archived_at
}

export function isCategorySelectableForBudget(
  c: Pick<
    AccountingCategorySettingsRow,
    'is_active' | 'available_in_budget' | 'archived_at' | 'code'
  >
): boolean {
  if (c.code.toUpperCase() === 'QUOTE') return false
  return c.is_active && c.available_in_budget && !c.archived_at
}
