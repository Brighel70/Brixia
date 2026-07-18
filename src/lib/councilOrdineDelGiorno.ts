import { arrayMove } from '@dnd-kit/sortable'

export const ODGCLOSURE_POINT = 'Varie ed eventuali'

export function isOdgClosurePoint(point: string): boolean {
  return point.trim().toLowerCase() === ODGCLOSURE_POINT.toLowerCase()
}

export function getOdgRegularPoints(points: string[] | null | undefined): string[] {
  return (points || []).map((point) => point.trim()).filter((point) => point && !isOdgClosurePoint(point))
}

/** Mantiene i punti liberi e, se ce n'è almeno uno, aggiunge sempre "Varie ed eventuali" in fondo. */
export function normalizeOrdineDelGiorno(points: string[] | null | undefined): string[] {
  const regular = getOdgRegularPoints(points)
  if (regular.length === 0) return []
  return [...regular, ODGCLOSURE_POINT]
}

export function addOdgPoint(points: string[] | null | undefined, newPoint: string): string[] {
  const trimmed = newPoint.trim()
  if (!trimmed || isOdgClosurePoint(trimmed)) return normalizeOrdineDelGiorno(points)
  const regular = getOdgRegularPoints(points)
  return [...regular, trimmed, ODGCLOSURE_POINT]
}

export function removeOdgPointAt(points: string[] | null | undefined, index: number): string[] {
  const list = normalizeOrdineDelGiorno(points)
  if (index < 0 || index >= list.length) return list
  if (isOdgClosurePoint(list[index]!)) return list

  const regular = getOdgRegularPoints(list).filter((_, i) => i !== index)
  return normalizeOrdineDelGiorno(regular)
}

export function updateOdgPointAt(points: string[] | null | undefined, index: number, text: string): string[] {
  const list = normalizeOrdineDelGiorno(points)
  if (index < 0 || index >= list.length || isOdgClosurePoint(list[index]!)) return list

  const trimmed = text.trim()
  if (!trimmed || isOdgClosurePoint(trimmed)) return list

  const regular = getOdgRegularPoints(list)
  if (index >= regular.length) return list

  regular[index] = trimmed
  return normalizeOrdineDelGiorno(regular)
}

export function reorderOdgPoints(points: string[] | null | undefined, oldIndex: number, newIndex: number): string[] {
  const list = normalizeOrdineDelGiorno(points)
  const regular = getOdgRegularPoints(list)
  const closureIndex = list.length - 1

  if (regular.length === 0) return []
  if (oldIndex === closureIndex || newIndex === closureIndex) return list
  if (oldIndex < 0 || oldIndex >= regular.length || newIndex < 0 || newIndex >= regular.length) return list

  const reordered = arrayMove(regular, oldIndex, newIndex)
  return [...reordered, ODGCLOSURE_POINT]
}
