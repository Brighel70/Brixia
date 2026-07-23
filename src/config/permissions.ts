/**
 * Permessi menu TeamFlow (CRUD per area).
 * Ambito dati / sezioni FlowMe: vedi `@teamflow/shared` → `accessModel.ts`
 * e `RUOLI_E_PERMESSI.md`.
 */
import {
  ROLE_ACCESS_MATRIX,
  getRoleAccessRule,
  type DataScope,
  type RoleAccessRule,
} from '@teamflow/shared'

export { ROLE_ACCESS_MATRIX, getRoleAccessRule }
export type { DataScope, RoleAccessRule }

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
    MANAGE_PERMISSIONS: 'users.manage_permissions'
  },
  COUNCIL: {
    MANAGE: 'council.manage'
  },
  BRAND: {
    MANAGE: 'brand.manage'
  },
  DOCUMENTS: {
    VIEW: 'documents.view',
    MANAGE: 'documents.manage'
  },
  HEALTH: {
    VIEW: 'health.view',
    MANAGE: 'health.manage'
  },
  FEES: {
    VIEW: 'fees.view',
    MANAGE: 'fees.manage'
  },
  ACCOUNTING: {
    VIEW: 'accounting.view',
    CREATE: 'accounting.create',
    EDIT_DRAFT: 'accounting.edit_draft',
    POST: 'accounting.post',
    VERIFY: 'accounting.verify',
    CLOSE_PERIOD: 'accounting.close_period',
    MANAGE_SETTINGS: 'accounting.manage_settings',
    EXPORT: 'accounting.export',
    AUDIT_VIEW: 'accounting.audit_view'
  }
} as const

// Funzione helper per ottenere la categoria di un permesso
export const getPermissionCategory = (permission: string): string => {
  const categoryMap: Record<string, string> = {
    'players.': 'Giocatori',
    'events.': 'Eventi',
    'sessions.': 'Sessioni',
    'attendance.': 'Presenze',
    'staff.': 'Staff',
    'categories.': 'Categorie',
    'settings.': 'Impostazioni',
    'users.': 'Utenti',
    'council.': 'Consiglio',
    'brand.': 'Brand',
    'documents.': 'Documenti',
    'health.': 'Sanitaria',
    'fees.': 'Quote'
  }

  for (const [prefix, category] of Object.entries(categoryMap)) {
    if (permission.startsWith(prefix)) {
      return category
    }
  }

  return 'Altro'
}

// Convenience constants per permessi comuni
export const CAN_VIEW_PLAYERS = PERMISSIONS.PLAYERS.VIEW
export const CAN_CREATE_PLAYERS = PERMISSIONS.PLAYERS.CREATE
export const CAN_EDIT_PLAYERS = PERMISSIONS.PLAYERS.EDIT
export const CAN_DELETE_PLAYERS = PERMISSIONS.PLAYERS.DELETE
export const CAN_EXPORT_PLAYERS = PERMISSIONS.PLAYERS.EXPORT

export const CAN_VIEW_EVENTS = PERMISSIONS.EVENTS.VIEW
export const CAN_CREATE_EVENTS = PERMISSIONS.EVENTS.CREATE
export const CAN_EDIT_EVENTS = PERMISSIONS.EVENTS.EDIT
export const CAN_DELETE_EVENTS = PERMISSIONS.EVENTS.DELETE

export const CAN_VIEW_SESSIONS = PERMISSIONS.SESSIONS.VIEW
export const CAN_CREATE_SESSIONS = PERMISSIONS.SESSIONS.CREATE
export const CAN_EDIT_SESSIONS = PERMISSIONS.SESSIONS.EDIT
export const CAN_DELETE_SESSIONS = PERMISSIONS.SESSIONS.DELETE
export const CAN_START_SESSIONS = PERMISSIONS.SESSIONS.START
export const CAN_STOP_SESSIONS = PERMISSIONS.SESSIONS.STOP

export const CAN_VIEW_ATTENDANCE = PERMISSIONS.ATTENDANCE.VIEW
export const CAN_MARK_ATTENDANCE = PERMISSIONS.ATTENDANCE.MARK
export const CAN_EDIT_ATTENDANCE = PERMISSIONS.ATTENDANCE.EDIT
export const CAN_EXPORT_ATTENDANCE = PERMISSIONS.ATTENDANCE.EXPORT

export const CAN_VIEW_STAFF = PERMISSIONS.STAFF.VIEW
export const CAN_CREATE_STAFF = PERMISSIONS.STAFF.CREATE
export const CAN_EDIT_STAFF = PERMISSIONS.STAFF.EDIT
export const CAN_DELETE_STAFF = PERMISSIONS.STAFF.DELETE

export const CAN_VIEW_CATEGORIES = PERMISSIONS.CATEGORIES.VIEW
export const CAN_CREATE_CATEGORIES = PERMISSIONS.CATEGORIES.CREATE
export const CAN_EDIT_CATEGORIES = PERMISSIONS.CATEGORIES.EDIT
export const CAN_DELETE_CATEGORIES = PERMISSIONS.CATEGORIES.DELETE

export const CAN_VIEW_SETTINGS = PERMISSIONS.SETTINGS.VIEW
export const CAN_EDIT_SETTINGS = PERMISSIONS.SETTINGS.EDIT
export const CAN_MANAGE_BRAND = PERMISSIONS.SETTINGS.BRAND

export const CAN_VIEW_USERS = PERMISSIONS.USERS.VIEW
export const CAN_CREATE_USERS = PERMISSIONS.USERS.CREATE
export const CAN_EDIT_USERS = PERMISSIONS.USERS.EDIT
export const CAN_DELETE_USERS = PERMISSIONS.USERS.DELETE
export const CAN_MANAGE_USER_PERMISSIONS = PERMISSIONS.USERS.MANAGE_PERMISSIONS

export const CAN_MANAGE_COUNCIL = PERMISSIONS.COUNCIL.MANAGE
export const CAN_MANAGE_BRAND_SETTINGS = PERMISSIONS.BRAND.MANAGE
