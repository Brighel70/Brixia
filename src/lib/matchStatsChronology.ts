export interface MatchStatsMinutes {
  try_minutes?: number[]
  conversion_minutes?: number[]
  drop_goal_minutes?: number[]
  yellow_card_minutes?: number[]
  red_card_minutes?: number[]
  substitution_in_minute?: number | null
  substitution_out_minute?: number | null
}

export function collectMatchEventMinutes(stats: MatchStatsMinutes): number[] {
  const minutes = [
    ...(stats.try_minutes ?? []),
    ...(stats.conversion_minutes ?? []),
    ...(stats.drop_goal_minutes ?? []),
    ...(stats.yellow_card_minutes ?? []),
    ...(stats.red_card_minutes ?? []),
  ]

  if (stats.substitution_in_minute != null) {
    minutes.push(stats.substitution_in_minute)
  }
  if (stats.substitution_out_minute != null) {
    minutes.push(stats.substitution_out_minute)
  }

  return minutes
}

export function getLatestMatchEventMinute(stats: MatchStatsMinutes): number | null {
  const minutes = collectMatchEventMinutes(stats)
  if (minutes.length === 0) return null
  return Math.max(...minutes)
}

export function validateMatchEventMinute(stats: MatchStatsMinutes, minute: number): string | null {
  const latest = getLatestMatchEventMinute(stats)
  if (latest !== null && minute < latest) {
    return `Non è possibile: il minuto deve essere uguale o successivo all'ultimo evento registrato (${latest}').`
  }
  return null
}
