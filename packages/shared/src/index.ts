/**
 * @brixia/shared - Codice condiviso tra TeamFlow (webapp) e FlowMe (PWA)
 */
export {
  checkOverlap,
  formatOverlapHardError,
  type OverlapActivity,
  type OverlapHardError,
  type OverlapResult,
} from './overlapCheck'

export {
  loadCategoryConfig,
  getLatestSession,
  sessionExists,
  calculateNextSessionDate,
  createAutomaticSession,
  createMultipleAutomaticSessions,
  previewNextSession,
  type TrainingLocationConfig,
  type CategorySessionConfig,
  type SessionToCreate,
  type ExistingSession,
} from './sessionScheduler'

export {
  ROLE_ACCESS_MATRIX,
  ALL_FLOWME_SECTIONS,
  RLS_READINESS,
  getRoleAccessRule,
  type AccessApp,
  type TeamflowRoleName,
  type FlowmeSectionId,
  type DataScope,
  type RoleAccessRule,
} from './accessModel'

export {
  normalizeCorrespondenceParty,
  canMessageParty,
  SOCIETY_RECIPIENT_ID,
  type CorrespondenceParty,
  type EligibleRecipient,
  type EligibleRecipientKind,
} from './correspondenceRules'
