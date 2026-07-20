export interface EventTypeFormFields {
  showCategory: boolean
  showOpponent: boolean
  showOpponents: boolean
  showHomeAway: boolean
  showChampionship: boolean
  showParticipants: boolean
  showInvited: boolean
  showOrdineDelGiorno: boolean
  showVerbalePdf: boolean
  /** Allegati multi-formato (Incontro Staff): riusa verbale_pdfs in storage */
  showAllegati: boolean
  timeFieldType: 'single' | 'start_end'
  listUsesColumns: boolean
  requiresCategory: boolean
  /** Festa del club: form con data inizio/fine invece degli orari */
  isClubParty: boolean
  /** Tipo evento può prevedere la registrazione di un vincitore (torneo, festa del rugby, ecc.) */
  allowsTournamentWinner: boolean
  /** Incontro staff: tag Coach / Area medica / Atletica + invitati/presenti */
  isStaffMeeting: boolean
  stripIcon?: string | null
}

export interface EventTypeConfig {
  id?: string
  code: string
  name: string
  is_sporting: boolean
  sort_order: number
  active: boolean
  form_fields: EventTypeFormFields
}

export const EMPTY_EVENT_FORM_FIELDS: EventTypeFormFields = {
  showCategory: false,
  showOpponent: false,
  showOpponents: false,
  showHomeAway: false,
  showChampionship: false,
  showParticipants: false,
  showInvited: false,
  showOrdineDelGiorno: false,
  showVerbalePdf: false,
  showAllegati: false,
  timeFieldType: 'start_end',
  listUsesColumns: false,
  requiresCategory: false,
  isClubParty: false,
  allowsTournamentWinner: false,
  isStaffMeeting: false,
  stripIcon: null,
}

function fields(partial: Partial<EventTypeFormFields>): EventTypeFormFields {
  return { ...EMPTY_EVENT_FORM_FIELDS, ...partial }
}

export const DEFAULT_EVENT_TYPES: EventTypeConfig[] = [
  {
    code: 'partita',
    name: 'Partita',
    is_sporting: true,
    sort_order: 1,
    active: true,
    form_fields: fields({
      showCategory: true,
      showOpponent: true,
      showHomeAway: true,
      showChampionship: true,
      listUsesColumns: true,
    }),
  },
  {
    code: 'torneo',
    name: 'Torneo',
    is_sporting: true,
    sort_order: 2,
    active: true,
    form_fields: fields({
      showCategory: true,
      showOpponents: true,
      showHomeAway: true,
      showChampionship: true,
      listUsesColumns: true,
    }),
  },
  {
    code: 'evento_sociale',
    name: 'Evento Sociale',
    is_sporting: false,
    sort_order: 3,
    active: true,
    form_fields: fields({}),
  },
  {
    code: 'raduno',
    name: 'Raduno',
    is_sporting: false,
    sort_order: 4,
    active: true,
    form_fields: fields({}),
  },
  {
    code: 'festa',
    name: 'Festa',
    is_sporting: false,
    sort_order: 5,
    active: true,
    form_fields: fields({ isClubParty: true, stripIcon: 'FDC' }),
  },
  {
    code: 'festa_del_rugby',
    name: 'Festa del Rugby',
    is_sporting: true,
    sort_order: 6,
    active: true,
    form_fields: fields({
      showCategory: true,
      showOpponents: true,
      listUsesColumns: true,
      requiresCategory: true,
    }),
  },
  {
    code: 'consiglio',
    name: 'Consiglio',
    is_sporting: false,
    sort_order: 7,
    active: true,
    form_fields: fields({
      showParticipants: true,
      showInvited: true,
      showOrdineDelGiorno: true,
      showVerbalePdf: true,
      stripIcon: 'CON',
    }),
  },
  {
    code: 'incontro_genitori',
    name: 'Incontro Genitori',
    is_sporting: false,
    sort_order: 8,
    active: true,
    form_fields: fields({ stripIcon: 'GEN' }),
  },
  {
    code: 'incontro_staff',
    name: 'Incontro Staff',
    is_sporting: false,
    sort_order: 9,
    active: true,
    form_fields: fields({
      isStaffMeeting: true,
      showOrdineDelGiorno: true,
      showAllegati: true,
      stripIcon: 'STAFF',
    }),
  },
  {
    code: 'altro',
    name: 'Altro',
    is_sporting: false,
    sort_order: 10,
    active: true,
    form_fields: fields({}),
  },
]

export function slugEventTypeCode(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
  return s || `tipo_${Date.now()}`
}

export function normalizeFormFields(raw: unknown): EventTypeFormFields {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<EventTypeFormFields>
  return fields(obj)
}

export function rowToEventTypeConfig(row: {
  id?: string
  code: string
  name: string
  is_sporting: boolean
  sort_order: number
  active: boolean
  form_fields?: unknown
}): EventTypeConfig {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    is_sporting: row.is_sporting,
    sort_order: row.sort_order,
    active: row.active,
    form_fields: normalizeFormFields(row.form_fields),
  }
}

export function resolveEventTypes(dbRows: EventTypeConfig[] | null | undefined): EventTypeConfig[] {
  if (!dbRows || dbRows.length === 0) return [...DEFAULT_EVENT_TYPES]
  return [...dbRows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it'))
}

export function getEventTypeByCode(types: EventTypeConfig[], code: string): EventTypeConfig | undefined {
  return types.find((t) => t.code === code) ?? DEFAULT_EVENT_TYPES.find((t) => t.code === code)
}

export function getEventTypeLabel(types: EventTypeConfig[], code: string): string {
  return getEventTypeByCode(types, code)?.name ?? code.replace(/_/g, ' ')
}

export function getEventTypeBadgeLabel(types: EventTypeConfig[], code: string): string {
  return getEventTypeLabel(types, code).toUpperCase()
}

export function isMultiTeamEventType(code: string, types: EventTypeConfig[]): boolean {
  const cfg = getEventTypeByCode(types, code)
  return cfg?.form_fields.showOpponents ?? false
}

export function usesEventRowColumns(code: string, types: EventTypeConfig[]): boolean {
  const cfg = getEventTypeByCode(types, code)
  return cfg?.form_fields.listUsesColumns ?? false
}

export function isSportingEventType(code: string, types: EventTypeConfig[]): boolean {
  return getEventTypeByCode(types, code)?.is_sporting ?? false
}

export function isClubPartyEventType(code: string, types: EventTypeConfig[]): boolean {
  return getEventTypeByCode(types, code)?.form_fields.isClubParty ?? false
}

export function getEventTypeFormFields(code: string, types: EventTypeConfig[]) {
  const cfg = getEventTypeByCode(types, code)
  const defaultFields = DEFAULT_EVENT_TYPES.find((t) => t.code === code)?.form_fields
  const f: EventTypeFormFields = {
    ...EMPTY_EVENT_FORM_FIELDS,
    ...(defaultFields ?? {}),
    ...(cfg?.form_fields ?? {}),
  }
  const isClubParty = f.isClubParty
  return {
    showCategory: f.showCategory,
    showOpponent: f.showOpponent,
    showOpponents: f.showOpponents,
    showHomeAway: f.showHomeAway && !isClubParty,
    showChampionship: f.showChampionship,
    showParticipants: f.showParticipants,
    showInvited: f.showInvited,
    showOrdineDelGiorno: f.isStaffMeeting ? true : f.showOrdineDelGiorno,
    showVerbalePdf: f.showVerbalePdf,
    showAllegati: f.isStaffMeeting ? true : f.showAllegati,
    isClubParty,
    isStaffMeeting: f.isStaffMeeting,
    showTimeFields: !isClubParty,
    timeFieldType: f.timeFieldType,
    allowsTournamentWinner: f.allowsTournamentWinner,
  }
}

export function usesCouncilFields(code: string, types: EventTypeConfig[]): boolean {
  const f = getEventTypeByCode(types, code)?.form_fields
  return !!(f?.showParticipants || f?.showInvited || f?.showOrdineDelGiorno || f?.showVerbalePdf)
}

export const FORM_FIELD_LABELS: Record<keyof Omit<EventTypeFormFields, 'timeFieldType' | 'stripIcon'>, string> = {
  showCategory: 'Categoria',
  showOpponent: 'Avversario (singolo)',
  showOpponents: 'Squadre multiple / gironi',
  showHomeAway: 'Casa / Trasferta',
  showChampionship: 'Campionato / Amichevole',
  showParticipants: 'Partecipanti',
  showInvited: 'Invitati',
  showOrdineDelGiorno: 'Ordine del giorno',
  showVerbalePdf: 'Verbale PDF',
  showAllegati: 'Allegati (PDF / Office / immagini)',
  listUsesColumns: 'Layout a colonne in lista',
  requiresCategory: 'Categoria obbligatoria',
  isClubParty: 'Festa del club',
  allowsTournamentWinner: 'Previsto vincitore (torneo / festa)',
  isStaffMeeting: 'Incontro staff (Coach / Area medica / Atletica)',
}
