// Configurazione permessi dell'applicazione
export const PERMISSIONS = {
  // Permessi per le attività
  ACTIVITIES: {
    VIEW: 'view_activities',
    CREATE: 'create_activities',
    EDIT: 'edit_activities',
    DELETE: 'delete_activities',
    MANAGE_ATTENDANCE: 'manage_attendance'
  },
  
  // Permessi per gli utenti
  USERS: {
    VIEW: 'view_users',
    CREATE: 'create_users',
    EDIT: 'edit_users',
    DELETE: 'delete_users',
    MANAGE_ROLES: 'manage_roles'
  },
  
  // Permessi per i giocatori
  PLAYERS: {
    VIEW: 'view_players',
    CREATE: 'create_players',
    EDIT: 'edit_players',
    DELETE: 'delete_players',
    MANAGE_CATEGORIES: 'manage_player_categories'
  },
  
  // Permessi per le categorie
  CATEGORIES: {
    VIEW: 'view_categories',
    CREATE: 'create_categories',
    EDIT: 'edit_categories',
    DELETE: 'delete_categories'
  },
  
  // Permessi per le sessioni
  SESSIONS: {
    VIEW: 'view_sessions',
    CREATE: 'create_sessions',
    EDIT: 'edit_sessions',
    DELETE: 'delete_sessions',
    MANAGE_PRESENCE: 'manage_presence'
  },
  
  // Permessi di sistema
  SYSTEM: {
    MANAGE_SETTINGS: 'manage_settings',
    VIEW_LOGS: 'view_logs',
    MANAGE_BACKUP: 'manage_backup',
    SYSTEM_ADMIN: 'system_admin'
  },
  
  // Permessi per i report
  REPORTS: {
    VIEW: 'view_reports',
    CREATE: 'create_reports',
    EXPORT: 'export_reports',
    ANALYTICS: 'view_analytics'
  }
} as const

// Categorie di permessi
export const PERMISSION_CATEGORIES = {
  ACTIVITIES: 'activities',
  USERS: 'users',
  PLAYERS: 'players',
  CATEGORIES: 'categories',
  SESSIONS: 'sessions',
  SYSTEM: 'system',
  REPORTS: 'reports'
} as const

// Ruoli predefiniti con permessi
export const DEFAULT_ROLES = {
  ADMIN: {
    name: 'Admin',
    description: 'Accesso completo a tutte le funzionalità',
    permissions: Object.values(PERMISSIONS).flatMap(category => Object.values(category))
  },
  
  COACH: {
    name: 'Allenatore',
    description: 'Gestione sessioni, presenze e giocatori',
    permissions: [
      PERMISSIONS.ACTIVITIES.VIEW,
      PERMISSIONS.ACTIVITIES.CREATE,
      PERMISSIONS.ACTIVITIES.EDIT,
      PERMISSIONS.ACTIVITIES.MANAGE_ATTENDANCE,
      PERMISSIONS.PLAYERS.VIEW,
      PERMISSIONS.PLAYERS.EDIT,
      PERMISSIONS.CATEGORIES.VIEW,
      PERMISSIONS.SESSIONS.VIEW,
      PERMISSIONS.SESSIONS.CREATE,
      PERMISSIONS.SESSIONS.EDIT,
      PERMISSIONS.SESSIONS.MANAGE_PRESENCE,
      PERMISSIONS.REPORTS.VIEW,
      PERMISSIONS.REPORTS.CREATE
    ]
  },
  
  MEDIC: {
    name: 'Medico',
    description: 'Gestione infortuni e stato salute giocatori',
    permissions: [
      PERMISSIONS.PLAYERS.VIEW,
      PERMISSIONS.PLAYERS.EDIT,
      PERMISSIONS.ACTIVITIES.VIEW,
      PERMISSIONS.SESSIONS.VIEW,
      PERMISSIONS.REPORTS.VIEW,
      PERMISSIONS.REPORTS.CREATE
    ]
  },
  
  DIRECTOR: {
    name: 'Direttore',
    description: 'Gestione organizzativa e report',
    permissions: [
      PERMISSIONS.ACTIVITIES.VIEW,
      PERMISSIONS.PLAYERS.VIEW,
      PERMISSIONS.CATEGORIES.VIEW,
      PERMISSIONS.SESSIONS.VIEW,
      PERMISSIONS.USERS.VIEW,
      PERMISSIONS.REPORTS.VIEW,
      PERMISSIONS.REPORTS.CREATE,
      PERMISSIONS.REPORTS.EXPORT,
      PERMISSIONS.REPORTS.ANALYTICS
    ]
  }
} as const

// Funzione helper per verificare se un permesso è valido
export const isValidPermission = (permission: string): boolean => {
  return Object.values(PERMISSIONS).some(category => 
    Object.values(category).includes(permission)
  )
}

// Funzione helper per ottenere la categoria di un permesso
export const getPermissionCategory = (permission: string): string | null => {
  for (const [categoryName, category] of Object.entries(PERMISSIONS)) {
    if (Object.values(category).includes(permission)) {
      return categoryName.toLowerCase()
    }
  }
  return null
}


