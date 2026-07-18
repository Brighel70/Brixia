import { supabase } from '@/lib/supabaseClient'

type PersonCategoryMembership = {
  id: string
  player_categories: string[] | null
  staff_categories: string[] | null
  teamflow_staff_categories: string[] | null
}

const readCategoryIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length > 0) : []

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
