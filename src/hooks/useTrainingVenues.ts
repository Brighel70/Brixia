import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  filterVenuesForSchedule,
  getHomeVenueNames,
  getVenueByName,
  rowToTrainingVenue,
  sortTrainingVenues,
  TrainingVenue,
  venueIsHome,
  venueRequiresAwayDetail,
} from '@/config/trainingVenues'

export function useTrainingVenues() {
  const [venues, setVenues] = useState<TrainingVenue[]>([])
  const [loading, setLoading] = useState(true)
  const [fromDatabase, setFromDatabase] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('training_venues')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      const rows = sortTrainingVenues((data || []).map(rowToTrainingVenue))
      if (rows.length > 0) {
        setVenues(rows)
        setFromDatabase(true)
        return
      }

      // The registry migration may not have been applied yet. Keep every
      // scheduling screen usable by deriving the temporary registry from the
      // existing recurring schedules, without changing historical sessions.
      const { data: scheduledLocations, error: schedulesError } = await supabase
        .from('training_locations')
        .select('location')

      if (schedulesError) throw schedulesError

      const scheduleVenues = Array.from(new Set(
        (scheduledLocations || [])
          .map((row) => String(row.location || '').trim())
          .filter(Boolean)
      )).map((name, index) => ({
        name,
        is_home_venue: true,
        requires_away_detail: false,
        active: true,
        sort_order: index + 1,
      }))

      setVenues(sortTrainingVenues([
        ...scheduleVenues,
        { name: 'Trasferta', is_home_venue: false, requires_away_detail: true, active: true, sort_order: 900 },
        { name: 'Altro', is_home_venue: false, requires_away_detail: false, active: true, sort_order: 910 },
      ]))
      setFromDatabase(false)
    } catch {
      setVenues([])
      setFromDatabase(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const onUpdated = () => load()
    window.addEventListener('training-venues-updated', onUpdated)
    return () => window.removeEventListener('training-venues-updated', onUpdated)
  }, [load])

  const activeVenues = useMemo(() => venues.filter((v) => v.active), [venues])
  const scheduleVenues = useMemo(() => filterVenuesForSchedule(activeVenues), [activeVenues])
  const homeVenueNames = useMemo(() => getHomeVenueNames(activeVenues), [activeVenues])

  return {
    venues,
    activeVenues,
    scheduleVenues,
    homeVenueNames,
    loading,
    fromDatabase,
    reload: load,
    getByName: (name: string) => getVenueByName(venues, name),
    requiresAwayDetail: (name: string) => venueRequiresAwayDetail(activeVenues, name),
    isHomeVenue: (name: string) => venueIsHome(activeVenues, name),
  }
}
