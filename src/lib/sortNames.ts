/**
 * Ordina nomi in formato "Nome Cognome" per cognome (alfabetico, locale it).
 */
export function sortNamesBySurname(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const cognomeA = (a.trim().split(/\s+/).pop() || '').toLowerCase()
    const cognomeB = (b.trim().split(/\s+/).pop() || '').toLowerCase()
    return cognomeA.localeCompare(cognomeB, 'it')
  })
}

function compareBySurname(a: string, b: string) {
  const cognomeA = (a.trim().split(/\s+/).pop() || '').toLowerCase()
  const cognomeB = (b.trim().split(/\s+/).pop() || '').toLowerCase()
  return cognomeA.localeCompare(cognomeB, 'it')
}

/** Presidente sempre primo, poi cognome alfabetico. */
export function sortCouncilBySurnameWithPresidentFirst<T extends { name: string; role?: string }>(
  items: T[]
): T[] {
  const presidents = items.filter((m) => m.role === 'president')
  const others = [...items.filter((m) => m.role !== 'president')].sort((a, b) =>
    compareBySurname(a.name, b.name)
  )
  return [...presidents, ...others]
}

export function sortCouncilParticipantNames(
  names: string[],
  members: { name: string; role?: string }[]
): string[] {
  const items = names.map((name) => ({
    name,
    role: members.find((m) => m.name === name)?.role,
  }))
  return sortCouncilBySurnameWithPresidentFirst(items).map((item) => item.name)
}

/** Etichetta visualizzata: suffisso (Pres) per il presidente del consiglio. */
export function formatCouncilMemberLabel(
  name: string,
  members: { name: string; role?: string }[]
): string {
  const member = members.find((m) => m.name === name)
  return member?.role === 'president' ? `${name} (Pres)` : name
}
