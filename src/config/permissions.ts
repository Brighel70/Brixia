// Configurazione permessi dell'applicazione

export const PERMISSIONS = {
  PLAYERS: {
    VIEW: 'players.view',
    CREATE: 'players.create',
    EDIT: 'players.edit',
    DELETE: 'players.delete',
    EXPORT: 'players.export'
  },
  EVENTS: {
    VIEW: 'events.view',
    CREATE: 'events.create',
    EDIT: 'events.edit',
    DELETE: 'events.delete'
  },
  SESSIONS: {
    VIEW: 'sessions.view',
    CREATE: 'sessions.create',
    EDIT: 'sessions.edit',
    DELETE: 'sessions.delete',
    START: 'sessions.start',
    STOP: 'sessions.stop'
  },
  ATTENDANCE: {
    VIEW: 'attendance.view',
    MARK: 'attendance.mark',
    EDIT: 'attendance.edit',
    EXPORT: 'attendance.export'
  },
  STAFF: {
    VIEW: 'staff.view',
    CREATE: 'staff.create',
    EDIT: 'staff.edit',
    DELETE: 'staff.delete'
  },
  CATEGORIES: {
    VIEW: 'categories.view',
    CREATE: 'categories.create',
    EDIT: 'categories.edit',
    DELETE: 'categories.delete'
  },
  SETTINGS: {
    VIEW: 'settings.view',
    EDIT: 'settings.edit',
    BRAND: 'settings.brand'
  },
  USERS: {
    VIEW: 'users.view',
    CREATE: 'users.create',
    EDIT: 'users.edit',
    DELETE: 'users.delete',
    ROLES: 'users.roles'
  }
} as const

export const ROLES = {
  ADMIN: 'Admin',
  DIRIGENTE: 'Dirigente',
  SEGRETERIA: 'Segreteria',
  DIRETTORE_SPORTIVO: 'Direttore Sportivo',
  DIRETTORE_TECNICO: 'Direttore Tecnico',
  ALLENATORE: 'Allenatore',
  TEAM_MANAGER: 'Team Manager',
  ACCOMPAGNATORE: 'Accompagnatore',
  PLAYER: 'Player',
  PREPARATORE: 'Preparatore',
  MEDICO: 'Medico',
  FISIO: 'Fisio',
  FAMIGLIA: 'Famiglia'
} as const

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    // Admin ha accesso completo a tutto
    ...Object.values(PERMISSIONS).flatMap(category => Object.values(category))
  ],
  [ROLES.DIRIGENTE]: [
    // Dirigente: accesso quasi completo, tranne gestione utenti
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.PLAYERS.CREATE,
    PERMISSIONS.PLAYERS.EDIT,
    PERMISSIONS.PLAYERS.DELETE,
    PERMISSIONS.PLAYERS.EXPORT,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.EVENTS.CREATE,
    PERMISSIONS.EVENTS.EDIT,
    PERMISSIONS.EVENTS.DELETE,
    PERMISSIONS.SESSIONS.VIEW,
    PERMISSIONS.SESSIONS.CREATE,
    PERMISSIONS.SESSIONS.EDIT,
    PERMISSIONS.SESSIONS.DELETE,
    PERMISSIONS.SESSIONS.START,
    PERMISSIONS.SESSIONS.STOP,
    PERMISSIONS.ATTENDANCE.VIEW,
    PERMISSIONS.ATTENDANCE.MARK,
    PERMISSIONS.ATTENDANCE.EDIT,
    PERMISSIONS.ATTENDANCE.EXPORT,
    PERMISSIONS.STAFF.VIEW,
    PERMISSIONS.CATEGORIES.VIEW,
    PERMISSIONS.CATEGORIES.CREATE,
    PERMISSIONS.CATEGORIES.EDIT,
    PERMISSIONS.CATEGORIES.DELETE,
    PERMISSIONS.SETTINGS.VIEW,
    PERMISSIONS.SETTINGS.EDIT,
    PERMISSIONS.SETTINGS.BRAND,
    PERMISSIONS.USERS.VIEW
  ],
  [ROLES.SEGRETERIA]: [
    // Segreteria: gestione amministrativa
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.PLAYERS.CREATE,
    PERMISSIONS.PLAYERS.EDIT,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.SESSIONS.VIEW,
    PERMISSIONS.ATTENDANCE.VIEW,
    PERMISSIONS.STAFF.VIEW,
    PERMISSIONS.CATEGORIES.VIEW,
    PERMISSIONS.USERS.VIEW
  ],
  [ROLES.DIRETTORE_SPORTIVO]: [
    // Direttore Sportivo: gestione sportiva
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.PLAYERS.CREATE,
    PERMISSIONS.PLAYERS.EDIT,
    PERMISSIONS.PLAYERS.DELETE,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.EVENTS.CREATE,
    PERMISSIONS.EVENTS.EDIT,
    PERMISSIONS.SESSIONS.VIEW,
    PERMISSIONS.SESSIONS.CREATE,
    PERMISSIONS.SESSIONS.EDIT,
    PERMISSIONS.SESSIONS.DELETE,
    PERMISSIONS.ATTENDANCE.VIEW,
    PERMISSIONS.ATTENDANCE.MARK,
    PERMISSIONS.ATTENDANCE.EDIT,
    PERMISSIONS.CATEGORIES.VIEW,
    PERMISSIONS.CATEGORIES.CREATE,
    PERMISSIONS.CATEGORIES.EDIT
  ],
  [ROLES.DIRETTORE_TECNICO]: [
    // Direttore Tecnico: gestione tecnica
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.PLAYERS.CREATE,
    PERMISSIONS.PLAYERS.EDIT,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.EVENTS.CREATE,
    PERMISSIONS.EVENTS.EDIT,
    PERMISSIONS.SESSIONS.VIEW,
    PERMISSIONS.SESSIONS.CREATE,
    PERMISSIONS.SESSIONS.EDIT,
    PERMISSIONS.ATTENDANCE.VIEW,
    PERMISSIONS.ATTENDANCE.MARK,
    PERMISSIONS.ATTENDANCE.EDIT,
    PERMISSIONS.CATEGORIES.VIEW
  ],
  [ROLES.ALLENATORE]: [
    // Allenatore: gestione allenamenti
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.PLAYERS.EDIT,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.EVENTS.CREATE,
    PERMISSIONS.EVENTS.EDIT,
    PERMISSIONS.SESSIONS.VIEW,
    PERMISSIONS.SESSIONS.CREATE,
    PERMISSIONS.SESSIONS.EDIT,
    PERMISSIONS.SESSIONS.START,
    PERMISSIONS.SESSIONS.STOP,
    PERMISSIONS.ATTENDANCE.VIEW,
    PERMISSIONS.ATTENDANCE.MARK,
    PERMISSIONS.ATTENDANCE.EDIT,
    PERMISSIONS.CATEGORIES.VIEW
  ],
  [ROLES.TEAM_MANAGER]: [
    // Team Manager: gestione squadra
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.PLAYERS.EDIT,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.SESSIONS.VIEW,
    PERMISSIONS.ATTENDANCE.VIEW,
    PERMISSIONS.ATTENDANCE.MARK,
    PERMISSIONS.CATEGORIES.VIEW
  ],
  [ROLES.ACCOMPAGNATORE]: [
    // Accompagnatore: supporto
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.SESSIONS.VIEW,
    PERMISSIONS.ATTENDANCE.VIEW,
    PERMISSIONS.ATTENDANCE.MARK
  ],
  [ROLES.PLAYER]: [
    // Player: accesso limitato ai propri dati e categoria
    PERMISSIONS.PLAYERS.VIEW, // Solo i propri dati
    PERMISSIONS.EVENTS.VIEW, // Solo eventi della sua categoria
    PERMISSIONS.SESSIONS.VIEW, // Solo sessioni della sua categoria
    PERMISSIONS.ATTENDANCE.VIEW, // Solo le sue presenze
    PERMISSIONS.CATEGORIES.VIEW // Solo la sua categoria
  ],
  [ROLES.PREPARATORE]: [
    // Preparatore: preparazione fisica
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.PLAYERS.EDIT,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.EVENTS.CREATE,
    PERMISSIONS.EVENTS.EDIT,
    PERMISSIONS.SESSIONS.VIEW,
    PERMISSIONS.SESSIONS.CREATE,
    PERMISSIONS.SESSIONS.EDIT,
    PERMISSIONS.ATTENDANCE.VIEW,
    PERMISSIONS.ATTENDANCE.MARK,
    PERMISSIONS.ATTENDANCE.EDIT
  ],
  [ROLES.MEDICO]: [
    // Medico: informazioni sanitarie
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.PLAYERS.EDIT,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.SESSIONS.VIEW,
    PERMISSIONS.ATTENDANCE.VIEW,
    PERMISSIONS.ATTENDANCE.MARK
  ],
  [ROLES.FISIO]: [
    // Fisio: fisioterapia
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.PLAYERS.EDIT,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.SESSIONS.VIEW,
    PERMISSIONS.ATTENDANCE.VIEW,
    PERMISSIONS.ATTENDANCE.MARK
  ],
  [ROLES.FAMIGLIA]: [
    // Famiglia: accesso limitato
    PERMISSIONS.PLAYERS.VIEW,
    PERMISSIONS.EVENTS.VIEW,
    PERMISSIONS.SESSIONS.VIEW
  ]
} as const

export const isValidPermission = (permission: string): boolean => {
  const allPermissions = Object.values(PERMISSIONS).flatMap(category => Object.values(category))
  return allPermissions.includes(permission as any)
}

export const getPermissionCategory = (permission: string): string | null => {
  for (const [categoryName, category] of Object.entries(PERMISSIONS)) {
    const categoryPermissions = Object.values(category)
    if (categoryPermissions.includes(permission as any)) {
      return categoryName.toLowerCase()
    }
  }
  return null
}

export const getRolePermissions = (role: string): readonly string[] => {
  return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || []
}

export const hasPermission = (userPermissions: string[], permission: string): boolean => {
  return userPermissions.includes(permission)
}

export const hasAnyPermission = (userPermissions: string[], permissions: string[]): boolean => {
  return permissions.some(permission => userPermissions.includes(permission))
}

export const hasAllPermissions = (userPermissions: string[], permissions: string[]): boolean => {
  return permissions.every(permission => userPermissions.includes(permission))
}

