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
