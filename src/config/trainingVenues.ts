export interface TrainingVenue {
  id?: string
  name: string
  is_home_venue: boolean
  requires_away_detail: boolean
  active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export function rowToTrainingVenue(row: Record<string, unknown>): TrainingVenue {
  return {
    id: row.id as string | undefined,
    name: String(row.name ?? ''),
    is_home_venue: Boolean(row.is_home_venue),
    requires_away_detail: Boolean(row.requires_away_detail),
    active: row.active !== false,
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  }
}

export function sortTrainingVenues(venues: TrainingVenue[]): TrainingVenue[] {
  return [...venues].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it'))
}

export function getVenueByName(venues: TrainingVenue[], name: string): TrainingVenue | undefined {
  return venues.find((v) => v.name === name)
}

export function venueRequiresAwayDetail(venues: TrainingVenue[], name: string): boolean {
  return getVenueByName(venues, name)?.requires_away_detail ?? name === 'Trasferta'
}

export function venueIsHome(venues: TrainingVenue[], name: string): boolean {
  const venue = getVenueByName(venues, name)
  if (venue) return venue.is_home_venue
  return name !== 'Trasferta' && name !== 'Altro'
}

export function getHomeVenueNames(venues: TrainingVenue[]): string[] {
  return sortTrainingVenues(venues.filter((v) => v.active && v.is_home_venue)).map((v) => v.name)
}

export function filterVenuesForSchedule(venues: TrainingVenue[]): TrainingVenue[] {
  return sortTrainingVenues(venues.filter((v) => v.active && !v.requires_away_detail))
}
