/**
 * Regole destinatari Corrispondenza (TeamFlow ↔ FlowMe).
 * Società può scrivere/ricevere da chiunque.
 * Tra ruoli di categoria: matrice sotto.
 */

export type CorrespondenceParty =
  | 'society'
  | 'allenatore'
  | 'team_manager'
  | 'accompagnatore'
  | 'giocatore'
  | 'genitore'
  | 'other'

const ROLE_ALIASES: Record<string, CorrespondenceParty> = {
  admin: 'society',
  dirigente: 'society',
  segreteria: 'society',
  society: 'society',
  societa: 'society',
  società: 'society',
  allenatore: 'allenatore',
  coach: 'allenatore',
  'team manager': 'team_manager',
  team_manager: 'team_manager',
  'team-manager': 'team_manager',
  accompagnatore: 'accompagnatore',
  giocatore: 'giocatore',
  player: 'giocatore',
  famiglia: 'genitore',
  familiare: 'genitore',
  family: 'genitore',
  tutor: 'genitore',
  genitore: 'genitore',
  guardian: 'genitore',
}

export function normalizeCorrespondenceParty(roleName: string | null | undefined): CorrespondenceParty {
  if (!roleName) return 'other'
  const key = roleName.trim().toLowerCase().replace(/\s+/g, ' ')
  return ROLE_ALIASES[key] || ROLE_ALIASES[key.replace(/ /g, '_')] || 'other'
}

/**
 * Può `from` avviare/partecipare a un messaggio verso `to`?
 * (Sempre true se uno dei due è società.)
 */
export function canMessageParty(from: CorrespondenceParty, to: CorrespondenceParty): boolean {
  if (from === 'society' || to === 'society') return true
  if (from === 'other' || to === 'other') return false

  const matrix: Record<Exclude<CorrespondenceParty, 'society' | 'other'>, CorrespondenceParty[]> = {
    allenatore: ['allenatore', 'team_manager', 'accompagnatore', 'giocatore', 'genitore'],
    team_manager: ['allenatore', 'team_manager', 'accompagnatore', 'giocatore', 'genitore'],
    accompagnatore: ['allenatore', 'team_manager', 'accompagnatore'],
    giocatore: ['allenatore', 'team_manager', 'genitore'],
    genitore: ['allenatore', 'team_manager', 'giocatore', 'genitore'],
  }

  return (matrix[from as keyof typeof matrix] || []).includes(to)
}

export const SOCIETY_RECIPIENT_ID = '__society__' as const

export type EligibleRecipientKind = 'person' | 'society'

export interface EligibleRecipient {
  id: string
  kind: EligibleRecipientKind
  label: string
  party: CorrespondenceParty
  subtitle?: string
}
