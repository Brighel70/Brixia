/**
 * Session scheduler – delega a @brixia/shared con client Supabase locale.
 */

import { supabase } from './supabaseClient'
import {
  loadCategoryConfig as loadConfigShared,
  getLatestSession as getLatestShared,
  sessionExists as sessionExistsShared,
  calculateNextSessionDate as calcNextShared,
  createAutomaticSession as createOneShared,
  createMultipleAutomaticSessions as createMultipleShared,
  previewNextSession as previewShared,
  type TrainingLocationConfig,
  type CategorySessionConfig,
  type SessionToCreate,
  type ExistingSession
} from '@brixia/shared'

export type { TrainingLocationConfig, CategorySessionConfig, SessionToCreate, ExistingSession }

export const loadCategoryConfig = (categoryId: string) => loadConfigShared(supabase, categoryId)
export const getLatestSession = (categoryId: string) => getLatestShared(supabase, categoryId)
export const sessionExists = (categoryId: string, date: string) => sessionExistsShared(supabase, categoryId, date)
export const calculateNextSessionDate = (config: CategorySessionConfig, fromDate?: Date) =>
  calcNextShared(supabase, config, fromDate)
export const createAutomaticSession = (categoryId: string, fromDate?: Date) =>
  createOneShared(supabase, categoryId, fromDate)
export const createMultipleAutomaticSessions = (categoryId: string, count: number, fromDate?: Date) =>
  createMultipleShared(supabase, categoryId, count, fromDate)
export const previewNextSession = (categoryId: string, fromDate?: Date) =>
  previewShared(supabase, categoryId, fromDate)
