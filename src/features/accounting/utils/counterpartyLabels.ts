import type { CounterpartyKind } from '../types'

/** Tipi a cui tipicamente emettiamo documenti (entrate commerciali). */
export const COUNTERPARTY_KINDS_RECEIVABLE: CounterpartyKind[] = [
  'sponsor',
  'customer',
  'public_body',
  'federation',
  'sports_club',
  'member',
  'guardian',
  'other'
]

/** Tipi a cui tipicamente paghiamo (uscite / fornitori). */
export const COUNTERPARTY_KINDS_PAYABLE: CounterpartyKind[] = [
  'supplier',
  'collaborator',
  'public_body',
  'federation',
  'sports_club',
  'other'
]

export const COUNTERPARTY_KIND_LABELS: Record<CounterpartyKind, string> = {
  member: 'Socio / tesserato',
  guardian: 'Genitore / tutore',
  sponsor: 'Sponsor',
  customer: 'Cliente',
  supplier: 'Fornitore',
  collaborator: 'Collaboratore',
  public_body: 'Ente pubblico',
  federation: 'Federazione',
  sports_club: 'Società sportiva',
  other: 'Altro'
}

export const ALL_COUNTERPARTY_KINDS: CounterpartyKind[] = [
  'sponsor',
  'customer',
  'supplier',
  'collaborator',
  'public_body',
  'federation',
  'sports_club',
  'member',
  'guardian',
  'other'
]

export function counterpartyKindLabel(kind: string): string {
  return COUNTERPARTY_KIND_LABELS[kind as CounterpartyKind] ?? kind
}

export function counterpartyKindGroup(kind: string): 'receivable' | 'payable' | 'other' {
  if (kind === 'supplier' || kind === 'collaborator') return 'payable'
  if (
    kind === 'sponsor' ||
    kind === 'customer' ||
    kind === 'member' ||
    kind === 'guardian'
  ) {
    return 'receivable'
  }
  return 'other'
}
