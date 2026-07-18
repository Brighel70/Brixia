import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  DEFAULT_EVENT_TYPES,
  EventTypeConfig,
  getEventTypeBadgeLabel,
  getEventTypeByCode,
  getEventTypeFormFields,
  getEventTypeLabel,
  isClubPartyEventType,
  isMultiTeamEventType,
  isSportingEventType,
  resolveEventTypes,
  rowToEventTypeConfig,
  usesCouncilFields,
  usesEventRowColumns,
} from '@/config/eventTypes'

export function useEventTypes() {
  const [eventTypes, setEventTypes] = useState<EventTypeConfig[]>(DEFAULT_EVENT_TYPES)
  const [loading, setLoading] = useState(true)
  const [fromDatabase, setFromDatabase] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('event_types')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      const rows = (data || []).map(rowToEventTypeConfig)
      setEventTypes(resolveEventTypes(rows))
      setFromDatabase(rows.length > 0)
    } catch {
      setEventTypes(DEFAULT_EVENT_TYPES)
      setFromDatabase(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const onUpdated = () => load()
    window.addEventListener('event-types-updated', onUpdated)
    return () => window.removeEventListener('event-types-updated', onUpdated)
  }, [load])

  const activeEventTypes = useMemo(
    () => eventTypes.filter((t) => t.active),
    [eventTypes]
  )

  const sportingCodes = useMemo(
    () => new Set(eventTypes.filter((t) => t.is_sporting).map((t) => t.code)),
    [eventTypes]
  )

  return {
    eventTypes,
    activeEventTypes,
    sportingCodes,
    loading,
    fromDatabase,
    reload: load,
    getByCode: (code: string) => getEventTypeByCode(eventTypes, code),
    getLabel: (code: string) => getEventTypeLabel(eventTypes, code),
    getBadgeLabel: (code: string) => getEventTypeBadgeLabel(eventTypes, code),
    getFormFields: (code: string) => getEventTypeFormFields(code, eventTypes),
    isMultiTeam: (code: string) => isMultiTeamEventType(code, eventTypes),
    listUsesColumns: (code: string) => usesEventRowColumns(code, eventTypes),
    isSporting: (code: string) => isSportingEventType(code, eventTypes),
    isClubParty: (code: string) => isClubPartyEventType(code, eventTypes),
    usesCouncil: (code: string) => usesCouncilFields(code, eventTypes),
  }
}
