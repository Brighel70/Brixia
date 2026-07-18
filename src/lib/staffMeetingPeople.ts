/** Helper per Incontro Staff: gruppi ruolo + etichette A.Cognome (Cat).
 *
 * Fonte categorie: SOLO `staff_categories` (tab Staff anagrafica).
 * Non usa player_categories né permessi Flowme.
 */

export type StaffMeetingGroup = 'coach' | 'medical' | 'atletica' | 'assistenza'

export const STAFF_MEETING_GROUPS: {
  id: StaffMeetingGroup
  label: string
}[] = [
  { id: 'coach', label: 'Coach' },
  { id: 'medical', label: 'Area medica' },
  { id: 'atletica', label: 'Atletica' },
  { id: 'assistenza', label: 'Assistenti' },
]

export type StaffMeetingCategoryRef = {
  id: string
  /** Chiave stabile per bucket (id categoria) */
  key: string
  /** Etichetta colonna leggibile (Serie B, U16, …) */
  label: string
  sort: number
}

export type StaffMeetingPerson = {
  id: string
  given_name: string
  family_name: string
  full_name: string
  /** Nome chip senza categoria: A.Cognome */
  displayName: string
  staff_roles: string[]
  staff_categories: string[]
  roleNames: string[]
  /** Tutte le categorie staff (ordinate) */
  categoryRefs: StaffMeetingCategoryRef[]
  /** @deprecated alias etichette — preferire categoryRefs */
  categoryAbbrevs: string[]
  primaryCategoryKey: string
  primaryCategorySort: number
  /** Label default con prima categoria */
  label: string
  groups: StaffMeetingGroup[]
}

type RoleRow = { id: string; name: string }
type CategoryRow = {
  id: string
  name: string
  abbreviation?: string | null
  code?: string | null
  sort?: number | null
}

const NO_CATEGORY_KEY = '__none__'
const NO_CATEGORY_SORT = 9999

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function toIdArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {
      /* plain */
    }
    return value
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return []
}

function resolveRoleName(roleIdOrName: string, roles: RoleRow[]): string {
  const raw = String(roleIdOrName)
  const byId = roles.find((r) => r.id === raw)
  if (byId) return byId.name
  const n = norm(raw)
  const byName = roles.find((r) => norm(r.name) === n || norm(r.name).replace(/\s+/g, '-') === n)
  if (byName) return byName.name
  return raw
}

function roleMatchesGroup(roleName: string, group: StaffMeetingGroup): boolean {
  const n = norm(roleName)
  if (group === 'coach') {
    return n.includes('allenatore') || n === 'coach' || n.includes('coach')
  }
  if (group === 'medical') {
    return (
      n.includes('fisio') ||
      n.includes('fisioterapista') ||
      n === 'medico' ||
      n.includes('medico') ||
      n.includes('medicina')
    )
  }
  if (group === 'atletica') {
    return n.includes('preparatore') || n.includes('atletic')
  }
  return (
    n.includes('team manager') ||
    n.includes('team-manager') ||
    n.includes('teammanager') ||
    n.includes('accompagnatore') ||
    n.includes('accompagnatori')
  )
}

/** Etichetta colonna/chip leggibile: Serie B, U16, Seniores… (non solo “C”). */
export function categoryDisplayLabel(cat: CategoryRow | undefined): string {
  if (!cat) return ''
  const name = (cat.name || '').trim()
  const code = (cat.code || '').trim()
  const abbr = (cat.abbreviation || '').trim()
  const blob = `${name} ${code} ${abbr}`

  // Serie A/B/C → nome umano
  const serieMatch =
    blob.match(/\bserie\s*[_-]?\s*([abc])\b/i) || code.match(/^serie[_\s-]?([abc])$/i)
  if (serieMatch) {
    return `Serie ${serieMatch[1]!.toUpperCase()}`
  }
  if (/serie/i.test(name)) return name
  if (/serie/i.test(code)) return code.replace(/_/g, ' ')

  // Under / U16
  const uFromName = name.match(/\bU\s*(\d{1,2})\b/i) || name.match(/\bUnder\s*(\d{1,2})\b/i)
  if (uFromName) return `U${uFromName[1]}`
  if (abbr && /^U\s*\d{1,2}$/i.test(abbr)) return abbr.replace(/\s+/g, '').toUpperCase()
  if (code && /^U\s*\d{1,2}$/i.test(code)) return code.replace(/\s+/g, '').toUpperCase()

  // Seniores / Senior
  if (/senior/i.test(name) || /senior/i.test(code) || /senior/i.test(abbr)) {
    return name || 'Seniores'
  }

  // Abbreviazione chiara (2–6 char, non una sola lettera ambigua)
  if (abbr && abbr.length >= 2 && abbr.length <= 6) return abbr
  if (code && code.length >= 2 && code.length <= 10 && !/^serie/i.test(code)) {
    return code.replace(/_/g, ' ')
  }
  return name || abbr || code
}

export function formatStaffMeetingPersonLabel(
  givenName: string,
  familyName: string,
  categoryLabels: string[],
): string {
  const given = (givenName || '').trim()
  const family = (familyName || '').trim()
  const initial = given ? `${given.charAt(0).toUpperCase()}.` : ''
  const base = `${initial}${family}`.trim() || '—'
  const cats = categoryLabels.filter(Boolean)
  if (cats.length === 0) return base
  if (cats.length === 1) return `${base} (${cats[0]})`
  return `${base} (${cats.join(', ')})`
}

/** Chip nel contesto di una colonna categoria. */
export function formatStaffMeetingChipLabel(
  person: Pick<StaffMeetingPerson, 'displayName' | 'label'>,
  categoryLabel?: string,
): string {
  if (!categoryLabel || categoryLabel === 'Senza categoria') return person.displayName || person.label
  return `${person.displayName || person.label} (${categoryLabel})`
}

/** True se l'etichetta invitati/presenti appartiene a questa persona. */
export function staffMeetingInviteBelongsToPerson(
  inviteLabel: string,
  person: Pick<StaffMeetingPerson, 'displayName' | 'label' | 'id'>,
): boolean {
  const inv = (inviteLabel || '').trim()
  if (!inv) return false
  if (inv === person.label || inv === person.displayName) return true
  const base = (person.displayName || '').trim()
  if (!base) return false
  return inv === base || inv.startsWith(`${base} (`)
}

export function staffMeetingInvitedLabelsForPerson(
  invited: string[] | null | undefined,
  person: Pick<StaffMeetingPerson, 'displayName' | 'label' | 'id'>,
): string[] {
  return (invited || []).filter((n) => staffMeetingInviteBelongsToPerson(n, person))
}

export function buildStaffMeetingPeople(
  peopleRows: Array<{
    id: string
    given_name?: string | null
    family_name?: string | null
    full_name?: string | null
    staff_roles?: unknown
    staff_categories?: unknown
    app_role?: unknown
    additional_roles?: unknown
  }>,
  roles: RoleRow[],
  categories: CategoryRow[],
): StaffMeetingPerson[] {
  const catById = new Map(categories.map((c) => [c.id, c]))

  return peopleRows
    .map((p) => {
      const staffRoleIds = toIdArray(p.staff_roles)
      const appRole = p.app_role != null && p.app_role !== '' ? [String(p.app_role)] : []
      const additional = toIdArray(p.additional_roles)
      const allRoleRefs = [...staffRoleIds, ...appRole, ...additional]
      const roleNames = Array.from(
        new Set(allRoleRefs.map((r) => resolveRoleName(r, roles)).filter(Boolean)),
      )

      const groups = (['coach', 'medical', 'atletica', 'assistenza'] as StaffMeetingGroup[]).filter((g) =>
        roleNames.some((name) => roleMatchesGroup(name, g)),
      )
      if (groups.length === 0) return null

      // Solo Categorie Staff (anagrafica tab Staff)
      const staffCatIds = toIdArray(p.staff_categories)
      const resolvedCats = staffCatIds
        .map((id) => catById.get(id))
        .filter((c): c is CategoryRow => !!c)
        .sort((a, b) => (a.sort ?? NO_CATEGORY_SORT) - (b.sort ?? NO_CATEGORY_SORT))

      const categoryRefs: StaffMeetingCategoryRef[] = resolvedCats.map((c) => ({
        id: c.id,
        key: c.id,
        label: categoryDisplayLabel(c),
        sort: c.sort ?? NO_CATEGORY_SORT,
      }))

      const primaryCategoryKey = categoryRefs[0]?.key ?? NO_CATEGORY_KEY
      const primaryCategorySort = categoryRefs[0]?.sort ?? NO_CATEGORY_SORT
      const categoryAbbrevs = categoryRefs.map((c) => c.label)

      const given = (p.given_name || '').trim()
      const family = (p.family_name || '').trim()
      let givenName = given
      let familyName = family
      if (!givenName && !familyName && p.full_name) {
        const parts = p.full_name.trim().split(/\s+/)
        givenName = parts[0] || ''
        familyName = parts.slice(1).join(' ') || parts[0] || ''
      }

      const displayName = formatStaffMeetingPersonLabel(givenName, familyName, [])
      const label = formatStaffMeetingPersonLabel(givenName, familyName, categoryAbbrevs)

      return {
        id: p.id,
        given_name: givenName,
        family_name: familyName,
        full_name: p.full_name?.trim() || `${givenName} ${familyName}`.trim(),
        displayName,
        staff_roles: staffRoleIds,
        staff_categories: staffCatIds,
        roleNames,
        categoryRefs,
        categoryAbbrevs,
        primaryCategoryKey,
        primaryCategorySort,
        label,
        groups,
      } satisfies StaffMeetingPerson
    })
    .filter((p): p is StaffMeetingPerson => p != null)
    .sort((a, b) => {
      if (a.primaryCategorySort !== b.primaryCategorySort) {
        return a.primaryCategorySort - b.primaryCategorySort
      }
      return (a.family_name || a.label).localeCompare(b.family_name || b.label, 'it', {
        sensitivity: 'base',
      })
    })
}

export function filterStaffMeetingByGroup(
  people: StaffMeetingPerson[],
  groups: StaffMeetingGroup[] | StaffMeetingGroup | null,
): StaffMeetingPerson[] {
  const selected = Array.isArray(groups)
    ? groups
    : groups
      ? [groups]
      : []
  if (selected.length === 0) return []
  const set = new Set(selected)
  return people.filter((p) => p.groups.some((g) => set.has(g)))
}

export type StaffMeetingCategoryBucket = {
  key: string
  label: string
  sort: number
  people: StaffMeetingPerson[]
}

export type StaffMeetingGroupSection = {
  groupId: StaffMeetingGroup
  groupLabel: string
  categories: StaffMeetingCategoryBucket[]
}

/**
 * Raggruppa per tipología, poi per ogni Categoria Staff della persona
 * (una persona con Serie B + Serie C compare in entrambe le colonne).
 */
export function buildStaffMeetingSelectionSections(
  people: StaffMeetingPerson[],
  selectedGroups: StaffMeetingGroup[],
): StaffMeetingGroupSection[] {
  if (selectedGroups.length === 0) return []

  return selectedGroups
    .map((groupId) => {
      const groupLabel = STAFF_MEETING_GROUPS.find((g) => g.id === groupId)?.label ?? groupId
      const inGroup = people.filter((p) => p.groups.includes(groupId))
      const byCat = new Map<string, StaffMeetingCategoryBucket>()

      for (const person of inGroup) {
        const refs =
          person.categoryRefs.length > 0
            ? person.categoryRefs
            : [
                {
                  id: NO_CATEGORY_KEY,
                  key: NO_CATEGORY_KEY,
                  label: 'Senza categoria',
                  sort: NO_CATEGORY_SORT,
                } satisfies StaffMeetingCategoryRef,
              ]

        for (const ref of refs) {
          const existing = byCat.get(ref.key)
          if (existing) {
            if (!existing.people.some((p) => p.id === person.id)) {
              existing.people.push(person)
            }
          } else {
            byCat.set(ref.key, {
              key: ref.key,
              label: ref.label,
              sort: ref.sort,
              people: [person],
            })
          }
        }
      }

      const categories = Array.from(byCat.values())
        .map((bucket) => ({
          ...bucket,
          people: [...bucket.people].sort((a, b) =>
            (a.family_name || a.label).localeCompare(b.family_name || b.label, 'it', {
              sensitivity: 'base',
            }),
          ),
        }))
        .sort((a, b) => {
          if (a.sort !== b.sort) return a.sort - b.sort
          return a.label.localeCompare(b.label, 'it', { sensitivity: 'base' })
        })

      return { groupId, groupLabel, categories }
    })
    .filter((section) => section.categories.length > 0)
}
