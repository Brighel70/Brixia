/**
 * Salva/legge l'elenco ordinato di id persone usato per la navigazione avanti/indietro
 * nella scheda persona. Impostato da PeopleView (lista filtrata) e usato da CreatePersonView.
 */
const PEOPLE_VIEW_NAV_IDS_KEY = 'people-view-nav-ids'

export function setPeopleNavIds(ids: string[]): void {
  try {
    sessionStorage.setItem(PEOPLE_VIEW_NAV_IDS_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

export function getPeopleNavIds(): string[] | null {
  try {
    const raw = sessionStorage.getItem(PEOPLE_VIEW_NAV_IDS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}
