/**
 * Contratto di accesso condiviso TeamFlow + FlowMe.
 *
 * REGOLA D'ORO (prima di qualsiasi RLS):
 * - Una persona = un record in `people`
 * - TeamFlow e FlowMe sono due porte opzionali sulla stessa persona
 * - Non attivare RLS basata solo su auth.uid() finché FlowMe non ha
 *   un'identità verificabile lato database (oggi usa sessione locale)
 *
 * Questo file è la fonte di verità "cosa dovrebbe vedere chi".
 * Le app possono ancora avere controlli UI separati; RLS arriva dopo.
 */

/** Porte di accesso possibili */
export type AccessApp = 'teamflow' | 'flowme'

/**
 * Come si riconosce la persona oggi
 * ---------------------------------
 * TeamFlow:
 *   login email + codice TeamFlow (invite_code_teamflow)
 *   → sessione Supabase Auth + riga profiles (role / user_role_id)
 *   → people.id collegato via profiles.person_id quando presente
 *
 * FlowMe:
 *   login email + codice FlowMe (invite_code)
 *   → verifica people, poi sessione Supabase Auth (password = codice FlowMe
 *     o, se già esistente, codice TeamFlow) + profiles.person_id
 *   → cache UI in flowme_session; JWT Auth per le API
 *   → client Supabase con persistSession (storageKey flowme-auth)
 *
 * Admin assistenza:
 *   email/password Auth (es. andreabulgari@me.com)
 *   → TeamFlow: profilo Admin
 *   → FlowMe: sessione sintetica is_support_admin (tutte le sezioni)
 */

export type TeamflowRoleName =
  | 'Admin'
  | 'Dirigente'
  | 'Segreteria'
  | 'Direttore Sportivo'
  | 'Direttore Tecnico'
  | 'Allenatore'
  | 'Team Manager'
  | 'Accompagnatore'
  | 'Giocatore'
  | 'Preparatore Atletico'
  | 'Medico'
  | 'Fisioterapista'
  | 'Famiglia'

export type FlowmeSectionId =
  | 'staff'
  | 'medico'
  | 'player'
  | 'family'
  | 'team_manager'
  | 'segreteria'
  | 'finanziario'

/** Ambito dati: cosa può vedere rispetto alle categorie / relazioni */
export type DataScope =
  | 'all' // tutte le categorie / tutto il club
  | 'assigned_categories' // solo categorie abbinate (staff_categories / player_categories)
  | 'self' // solo la propria persona
  | 'linked_children' // solo figli/tutor collegati
  | 'none'

export interface RoleAccessRule {
  /** Nome ruolo TeamFlow (user_roles.name) */
  teamflowRole: TeamflowRoleName
  /** Sezioni FlowMe tipiche (poi raffinate da people.flowme_sections) */
  defaultFlowmeSections: FlowmeSectionId[]
  /** Ambito categorie / persone */
  dataScope: DataScope
  /** Descrizione semplice */
  summaryIt: string
}

/**
 * Matrice operativa concordata (senza RLS ancora attiva).
 * Le sezioni FlowMe effettive restano quelle spuntate in scheda persona;
 * qui indichiamo il default sensato per ruolo.
 */
export const ROLE_ACCESS_MATRIX: RoleAccessRule[] = [
  {
    teamflowRole: 'Admin',
    defaultFlowmeSections: ['staff', 'medico', 'player', 'family', 'team_manager', 'segreteria', 'finanziario'],
    dataScope: 'all',
    summaryIt: 'Vede e gestisce tutto il club su TeamFlow e FlowMe.'
  },
  {
    teamflowRole: 'Dirigente',
    defaultFlowmeSections: ['staff', 'segreteria', 'finanziario', 'team_manager'],
    dataScope: 'all',
    summaryIt: 'Quasi tutto, senza dover gestire account tecnici.'
  },
  {
    teamflowRole: 'Segreteria',
    defaultFlowmeSections: ['segreteria', 'finanziario', 'family'],
    dataScope: 'all',
    summaryIt: 'Persone, documenti, quote, tesseramenti.'
  },
  {
    teamflowRole: 'Direttore Sportivo',
    defaultFlowmeSections: ['staff', 'team_manager', 'player'],
    dataScope: 'all',
    summaryIt: 'Area sportiva completa (squadre, eventi, attività).'
  },
  {
    teamflowRole: 'Direttore Tecnico',
    defaultFlowmeSections: ['staff', 'team_manager', 'player'],
    dataScope: 'assigned_categories',
    summaryIt: 'Gestione tecnica sulle categorie di competenza.'
  },
  {
    teamflowRole: 'Allenatore',
    defaultFlowmeSections: ['staff', 'player'],
    dataScope: 'assigned_categories',
    summaryIt: 'Solo le sue squadre: allenamenti, presenze, giocatori della categoria.'
  },
  {
    teamflowRole: 'Team Manager',
    defaultFlowmeSections: ['team_manager'],
    dataScope: 'assigned_categories',
    summaryIt: 'Liste, convocate, quote della categoria assegnata.'
  },
  {
    teamflowRole: 'Accompagnatore',
    defaultFlowmeSections: ['staff'],
    dataScope: 'assigned_categories',
    summaryIt: 'Supporto sulla categoria: soprattutto presenze/eventi.'
  },
  {
    teamflowRole: 'Preparatore Atletico',
    defaultFlowmeSections: ['staff', 'medico'],
    dataScope: 'assigned_categories',
    summaryIt: 'Preparazione fisica sulle categorie assegnate.'
  },
  {
    teamflowRole: 'Medico',
    defaultFlowmeSections: ['medico'],
    dataScope: 'all',
    summaryIt: 'Infermeria / stato fisico (ambito sanitario).'
  },
  {
    teamflowRole: 'Fisioterapista',
    defaultFlowmeSections: ['medico'],
    dataScope: 'all',
    summaryIt: 'Attività fisioterapiche e percorso infortuni.'
  },
  {
    teamflowRole: 'Giocatore',
    defaultFlowmeSections: ['player'],
    dataScope: 'self',
    summaryIt: 'Solo i propri dati: presenze, documenti, quote personali.'
  },
  {
    teamflowRole: 'Famiglia',
    defaultFlowmeSections: ['family'],
    dataScope: 'linked_children',
    summaryIt: 'Solo i figli collegati: situazione, pagamenti, documenti.'
  }
]

/** Sezioni FlowMe ammesse (allineate a FlowMe FLOWME_SECTION_IDS) */
export const ALL_FLOWME_SECTIONS: FlowmeSectionId[] = [
  'staff',
  'medico',
  'player',
  'family',
  'team_manager',
  'segreteria',
  'finanziario'
]

export function getRoleAccessRule(roleName: string | null | undefined): RoleAccessRule | null {
  if (!roleName) return null
  const norm = roleName.trim().toLowerCase()
  return (
    ROLE_ACCESS_MATRIX.find((r) => r.teamflowRole.toLowerCase() === norm) ||
    ROLE_ACCESS_MATRIX.find((r) => {
      if (norm === 'player' || norm === 'giocatore') return r.teamflowRole === 'Giocatore'
      if (norm === 'fisio' || norm === 'fisioterapista') return r.teamflowRole === 'Fisioterapista'
      if (norm === 'preparatore') return r.teamflowRole === 'Preparatore Atletico'
      if (norm === 'family' || norm === 'famiglia') return r.teamflowRole === 'Famiglia'
      return false
    }) ||
    null
  )
}

/**
 * Checklist prima di attivare RLS (non eseguire RLS finché non è tutto vero):
 * 1. FlowMe ha un'identità DB verificabile (Auth o token server) ✓
 * 2. Ogni sessione espone people.id in modo affidabile (via profiles.person_id)
 * 3. dataScope assigned_categories usa staff_categories / player_categories
 * 4. Genitori usano solo relazioni tutor/guardian
 * 5. Admin assistenza ha eccezione esplicita documentata
 *
 * Nota: le policy RLS strette NON sono ancora applicate; ora si possono progettare
 * su auth.uid() → profiles.person_id. Gli utenti devono ri-accedere una volta
 * per ottenere il JWT (sessioni solo-locali non bastano più).
 */
export const RLS_READINESS = {
  flowmeHasDbIdentity: true,
  teamflowUsesSupabaseAuth: true,
  categoryScopeCentralized: true,
  paymentsLedgerCentralized: true,
  supportAdminDocumented: true
} as const
