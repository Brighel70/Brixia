import { supabase } from '@/lib/supabaseClient'

type PersonCategoryMembership = {
  id: string
  player_categories: string[] | null
  staff_categories: string[] | null
  teamflow_staff_categories: string[] | null
}

/** Normalize any DB/json category field to string[] of UUIDs */
export function readCategoryIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === 'string' && id.length > 0)
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0) : []
    } catch {
      return []
    }
  }
  return []
}

/** True if categoryField contains categoryId */
export function personHasCategory(categoryField: unknown, categoryId: string): boolean {
  return readCategoryIds(categoryField).includes(categoryId)
}

/** True if categoryField intersects categoryIds */
export function personHasAnyCategory(categoryField: unknown, categoryIds: string[]): boolean {
  const personCategories = readCategoryIds(categoryField)
  return categoryIds.some(id => personCategories.includes(id))
}

/**
 * Given a list of category records and a selected category id,
 * return the id list to match for filters.
 * If selected is Seniores/Senior/SENIORES: return [senioresId, serieBId?, serieCId?] (include seniores itself).
 * Otherwise return [selectedCategoryId].
 */
export function expandCategoryFilterIds(
  selectedCategoryId: string,
  categories: Array<{ id: string; name?: string | null; code?: string | null }>
): string[] {
  const selectedCat = categories.find(c => c.id === selectedCategoryId)
  if (!selectedCat) return [selectedCategoryId]

  const isSenieores = 
    selectedCat.code === 'SENIORES' || 
    selectedCat.name === 'Seniores' ||
    selectedCat.name === 'Senior'

  if (!isSenieores) return [selectedCategoryId]

  // Find Serie B and Serie C categories
  const serieB = categories.find(c => c.code === 'SERIE_B' || c.name === 'Serie B')
  const serieC = categories.find(c => c.code === 'SERIE_C' || c.name === 'Serie C')

  const result: string[] = [selectedCategoryId]
  if (serieB) result.push(serieB.id)
  if (serieC) result.push(serieC.id)

  return result
}

/**
 * Load people that belong to any of categoryIds.
 * Primary: people.is_player=true, status=active (if columns exist - select flexibly), filter by player_categories using readCategoryIds.
 * Fallback if empty: player_categories join table player_id IN ... then load those people.
 * Return people rows with at least id, full_name, player_categories.
 */
export async function loadPlayersForCategories(
  categoryIds: string[],
  options?: { select?: string }
): Promise<Array<Record<string, unknown>>> {
  const selectFields = options?.select || 'id, full_name, player_categories'

  // Try selecting with flexible field detection
  const selectAttempts = [
    `${selectFields}, injured, disqualified`,
    `${selectFields}`,
  ]

  let allPlayers: Array<Record<string, unknown>> = []
  let queryError: any = null

  for (const selectStr of selectAttempts) {
    const { data, error } = await supabase
      .from('people')
      .select(selectStr)
      .eq('is_player', true)
      .eq('status', 'active')

    if (!error && data) {
      allPlayers = data as unknown as Array<Record<string, unknown>>
      queryError = null
      break
    }
    queryError = error
  }

  if (queryError) {
    console.error('Error loading players:', queryError)
    return []
  }

  // Filter by category
  const categoryPlayers = allPlayers.filter((player: any) => {
    const categories = readCategoryIds(player.player_categories)
    return categories.some(catId => categoryIds.includes(catId))
  })

  // Fallback: if no players found, try player_categories join table
  if (categoryPlayers.length === 0) {
    const { data: pcData } = await supabase
      .from('player_categories')
      .select('player_id')
      .in('category_id', categoryIds)

    const playerIdsInCategory = new Set((pcData || []).map((r: any) => r.player_id))

    return allPlayers.filter((p: any) => playerIdsInCategory.has(p.id))
  }

  return categoryPlayers
}

export async function loadCategoryMembershipCounts() {
  const { data, error } = await supabase
    .from('people')
    .select('player_categories, staff_categories')

  if (error) throw error

  const playerCounts = new Map<string, number>()
  const staffCounts = new Map<string, number>()

  for (const person of data || []) {
    for (const categoryId of readCategoryIds(person.player_categories)) {
      playerCounts.set(categoryId, (playerCounts.get(categoryId) || 0) + 1)
    }
    for (const categoryId of readCategoryIds(person.staff_categories)) {
      staffCounts.set(categoryId, (staffCounts.get(categoryId) || 0) + 1)
    }
  }

  return { playerCounts, staffCounts }
}

/**
 * Removes a category from the currently authoritative people fields before the
 * category itself is deleted. Legacy relation tables are cleaned separately.
 */
export async function removeCategoryFromPeople(categoryId: string) {
  const { data, error } = await supabase
    .from('people')
    .select('id, player_categories, staff_categories, teamflow_staff_categories')

  if (error) throw error

  const affectedPeople = (data || []).filter((person: PersonCategoryMembership) =>
    [person.player_categories, person.staff_categories, person.teamflow_staff_categories]
      .some((categories) => readCategoryIds(categories).includes(categoryId))
  )

  await Promise.all(affectedPeople.map(async (person: PersonCategoryMembership) => {
    const updates = {
      player_categories: readCategoryIds(person.player_categories).filter((id) => id !== categoryId),
      staff_categories: readCategoryIds(person.staff_categories).filter((id) => id !== categoryId),
      teamflow_staff_categories: readCategoryIds(person.teamflow_staff_categories).filter((id) => id !== categoryId)
    }

    const { error: updateError } = await supabase
      .from('people')
      .update(updates)
      .eq('id', person.id)

    if (updateError) throw updateError
  }))
}

export async function updatePlayerCategoryMembership(
  personIds: string[],
  categoryId: string,
  isAssigned: boolean
) {
  if (personIds.length === 0) return

  const { data, error } = await supabase
    .from('people')
    .select('id, player_categories')
    .in('id', personIds)

  if (error) throw error

  await Promise.all((data || []).map(async (person) => {
    const currentCategories = readCategoryIds(person.player_categories)
    const nextCategories = isAssigned
      ? Array.from(new Set([...currentCategories, categoryId]))
      : currentCategories.filter((id) => id !== categoryId)

    const { error: updateError } = await supabase
      .from('people')
      .update({ player_categories: nextCategories })
      .eq('id', person.id)

    if (updateError) throw updateError
  }))
}

export async function updateStaffCategoryMembership(
  personIds: string[],
  categoryId: string,
  isAssigned: boolean
) {
  if (personIds.length === 0) return

  const { data, error } = await supabase
    .from('people')
    .select('id, staff_categories')
    .in('id', personIds)

  if (error) throw error

  await Promise.all((data || []).map(async (person) => {
    const currentCategories = readCategoryIds(person.staff_categories)
    const nextCategories = isAssigned
      ? Array.from(new Set([...currentCategories, categoryId]))
      : currentCategories.filter((id) => id !== categoryId)

    const { error: updateError } = await supabase
      .from('people')
      .update({ staff_categories: nextCategories })
      .eq('id', person.id)

    if (updateError) throw updateError
  }))
}
