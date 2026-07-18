/**
 * Session scheduler – logica condivisa TeamFlow / FlowMe.
 * Creazione sessioni automatiche da training_locations.
 * Il client Supabase va passato a ogni funzione (dependency injection).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// TYPES
// ============================================================================

export interface TrainingLocationConfig {
  id: string
  category_id: string
  location: string
  weekday: string
  start_time: string
  end_time: string
  created_at?: string
  updated_at?: string
}

export interface CategorySessionConfig {
  category_id: string
  category_name: string
  category_code: string
  ordered_weekdays: string[]
  schedule: {
    [weekday: string]: {
      location: string
      start_time: string
      end_time: string
    }
  }
}

export interface SessionToCreate {
  category_id: string
  session_date: string
  location: string
  away_place: string | null
  start_time: string
  end_time: string
}

export interface ExistingSession {
  id: string
  category_id: string
  session_date: string
  location: string
  start_time?: string
  end_time?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const WEEKDAY_MAP: { [key: string]: number } = {
  'monday': 1, 'lunedì': 1,
  'tuesday': 2, 'martedì': 2,
  'wednesday': 3, 'mercoledì': 3,
  'thursday': 4, 'giovedì': 4,
  'friday': 5, 'venerdì': 5,
  'saturday': 6, 'sabato': 6,
  'sunday': 0, 'domenica': 0
}

function normalizeWeekday(weekday: string): string {
  const mapping: { [key: string]: string } = {
    'domenica': 'sunday',
    'lunedì': 'monday',
    'martedì': 'tuesday',
    'mercoledì': 'wednesday',
    'giovedì': 'thursday',
    'venerdì': 'friday',
    'sabato': 'saturday'
  }
  return mapping[weekday.toLowerCase()] || weekday.toLowerCase()
}

function getWeekday(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

function getNextDateForWeekday(fromDate: Date, targetWeekday: string): Date {
  const normalizedWeekday = normalizeWeekday(targetWeekday)
  const targetDayIndex = WEEKDAY_MAP[normalizedWeekday]
  const currentDayIndex = fromDate.getDay()

  if (targetDayIndex === undefined) {
    const result = new Date(fromDate)
    result.setDate(result.getDate() + 1)
    return result
  }

  let daysToAdd = targetDayIndex - currentDayIndex
  if (daysToAdd <= 0) daysToAdd += 7

  const result = new Date(fromDate)
  result.setDate(result.getDate() + daysToAdd)
  return result
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// ============================================================================
// CONFIGURATION LOADER
// ============================================================================

export async function loadCategoryConfig(
  supabase: SupabaseClient,
  categoryId: string
): Promise<CategorySessionConfig | null> {
  try {
    const { data: locations, error: locError } = await supabase
      .from('training_locations')
      .select('*')
      .eq('category_id', categoryId)
      .order('weekday')

    if (locError || !locations?.length) return null

    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('id, name, code')
      .eq('id', categoryId)
      .single()

    if (catError || !category) return null

    const orderedLocations = locations
      .map((loc: { weekday: string }) => ({ ...loc, weekday: normalizeWeekday(loc.weekday) }))
      .sort((a: { weekday: string }, b: { weekday: string }) =>
        WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday)
      )

    const config: CategorySessionConfig = {
      category_id: categoryId,
      category_name: category.name,
      category_code: category.code,
      ordered_weekdays: orderedLocations.map((loc: { weekday: string }) => loc.weekday.toLowerCase()),
      schedule: {}
    }

    orderedLocations.forEach((loc: { weekday: string; location: string; start_time: string; end_time: string }) => {
      config.schedule[loc.weekday.toLowerCase()] = {
        location: loc.location,
        start_time: loc.start_time,
        end_time: loc.end_time
      }
    })

    return config
  } catch {
    return null
  }
}

// ============================================================================
// SESSION QUERIES
// ============================================================================

export async function getLatestSession(
  supabase: SupabaseClient,
  categoryId: string
): Promise<ExistingSession | null> {
  try {
    const today = formatDate(new Date())
    const { data, error } = await supabase
      .from('sessions')
      .select('id, category_id, session_date, location, start_time, end_time')
      .eq('category_id', categoryId)
      .gte('session_date', today)
      .order('session_date', { ascending: false })
      .limit(1)
    if (error) return null
    return data?.[0] ?? null
  } catch {
    return null
  }
}

export async function sessionExists(
  supabase: SupabaseClient,
  categoryId: string,
  date: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id')
      .eq('category_id', categoryId)
      .eq('session_date', date)
    if (error) return false
    return (data?.length ?? 0) > 0
  } catch {
    return false
  }
}

// ============================================================================
// CORE ALGORITHM
// ============================================================================

export async function calculateNextSessionDate(
  supabase: SupabaseClient,
  config: CategorySessionConfig,
  fromDate?: Date
): Promise<SessionToCreate | null> {
  try {
    const anchor = fromDate ?? new Date()
    const latestSession = await getLatestSession(supabase, config.category_id)

    let candidateDate: Date

    if (!latestSession) {
      const todayWeekday = getWeekday(anchor)
      const todayIndex = config.ordered_weekdays.indexOf(todayWeekday)
      if (todayIndex !== -1) {
        candidateDate = new Date(anchor)
      } else {
        candidateDate = getNextDateForWeekday(anchor, config.ordered_weekdays[0])
      }
    } else {
      const lastDate = parseDate(latestSession.session_date)
      const lastWeekday = getWeekday(lastDate)
      const currentIndex = config.ordered_weekdays.indexOf(lastWeekday)

      if (currentIndex === -1) {
        candidateDate = getNextDateForWeekday(lastDate, config.ordered_weekdays[0])
      } else {
        const nextIndex = (currentIndex + 1) % config.ordered_weekdays.length
        const nextWeekday = config.ordered_weekdays[nextIndex]
        candidateDate = getNextDateForWeekday(lastDate, nextWeekday)
      }
    }

    let maxAttempts = 30
    while (maxAttempts > 0 && await sessionExists(supabase, config.category_id, formatDate(candidateDate))) {
      const currentWeekday = getWeekday(candidateDate)
      const currentIndex = config.ordered_weekdays.indexOf(currentWeekday)
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % config.ordered_weekdays.length
      const nextWeekday = config.ordered_weekdays[nextIndex]
      candidateDate = getNextDateForWeekday(candidateDate, nextWeekday)
      maxAttempts--
    }

    if (maxAttempts === 0) return null

    const weekday = getWeekday(candidateDate)
    const dayConfig = config.schedule[weekday]
    if (!dayConfig) return null

    return {
      category_id: config.category_id,
      session_date: formatDate(candidateDate),
      location: dayConfig.location,
      away_place: null,
      start_time: dayConfig.start_time,
      end_time: dayConfig.end_time
    }
  } catch {
    return null
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function createAutomaticSession(
  supabase: SupabaseClient,
  categoryId: string,
  fromDate?: Date
): Promise<ExistingSession | null> {
  try {
    const config = await loadCategoryConfig(supabase, categoryId)
    if (!config) return null

    const sessionData = await calculateNextSessionDate(supabase, config, fromDate)
    if (!sessionData) return null

    const { data, error } = await supabase
      .from('sessions')
      .insert([sessionData])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return createAutomaticSession(supabase, categoryId, new Date(sessionData.session_date))
      }
      return null
    }

    return data
  } catch {
    return null
  }
}

export async function createMultipleAutomaticSessions(
  supabase: SupabaseClient,
  categoryId: string,
  count: number,
  fromDate?: Date
): Promise<ExistingSession[]> {
  const created: ExistingSession[] = []
  let currentFrom = fromDate

  for (let i = 0; i < count; i++) {
    const session = await createAutomaticSession(supabase, categoryId, currentFrom)
    if (!session) break
    created.push(session)
    currentFrom = new Date(session.session_date)
    await new Promise(r => setTimeout(r, 100))
  }

  return created
}

export async function previewNextSession(
  supabase: SupabaseClient,
  categoryId: string,
  fromDate?: Date
): Promise<SessionToCreate | null> {
  const config = await loadCategoryConfig(supabase, categoryId)
  if (!config) return null
  return calculateNextSessionDate(supabase, config, fromDate)
}
