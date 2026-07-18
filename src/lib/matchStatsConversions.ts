import type { MatchStatsMinutes } from '@/lib/matchStatsChronology'

export interface TryConversionStats extends MatchStatsMinutes {
  try_minutes?: number[]
  conversions?: number
  conversion_minutes?: number[]
  converted_try_minutes?: number[]
}

export function getConvertedTryMinutes(stats: TryConversionStats): number[] {
  return stats.converted_try_minutes ?? []
}

export function getLastUnconvertedTryMinute(stats: TryConversionStats): number | null {
  const tries = stats.try_minutes ?? []
  const converted = new Set(getConvertedTryMinutes(stats))
  const unconverted = tries.filter(minute => !converted.has(minute))
  if (unconverted.length === 0) return null
  return unconverted[unconverted.length - 1]
}

export function hasUnconvertedTry(stats: TryConversionStats): boolean {
  return getLastUnconvertedTryMinute(stats) !== null
}

export function markTryConverted<T extends TryConversionStats>(stats: T, tryMinute: number): T {
  const converted = getConvertedTryMinutes(stats)
  if (converted.includes(tryMinute)) return stats
  return {
    ...stats,
    converted_try_minutes: [...converted, tryMinute].sort((a, b) => a - b),
  }
}

export function addConversionMinute<T extends TryConversionStats>(stats: T, minute: number): T {
  return {
    ...stats,
    conversions: (stats.conversions ?? 0) + 1,
    conversion_minutes: [...(stats.conversion_minutes ?? []), minute].sort((a, b) => a - b),
  }
}

export interface PlayerOnFieldInput {
  player_id: string
  number: number
}

export interface PlayerOnFieldStats {
  substitution_in_minute?: number | null
  substitution_out_minute?: number | null
}

export function parsePlayerNumber(number: number | string): number {
  return typeof number === 'string' ? parseInt(number, 10) : number
}

export function isStarterPlayerNumber(playerNumber: number): boolean {
  return playerNumber >= 1 && playerNumber <= 15
}

export function hasPlayerBeenOnField(
  playerNumber: number | string,
  stats: PlayerOnFieldStats | undefined
): boolean {
  const number = parsePlayerNumber(playerNumber)
  if (isNaN(number)) return false
  if (isStarterPlayerNumber(number)) return true
  return stats?.substitution_in_minute != null
}

export function isPlayerOnFieldAtMinute(
  playerNumber: number | string,
  stats: PlayerOnFieldStats | undefined,
  minute: number
): boolean {
  const number = parsePlayerNumber(playerNumber)
  if (isNaN(number)) return false

  const isStarter = isStarterPlayerNumber(number)
  if (!stats) return isStarter

  const subIn = stats.substitution_in_minute
  const subOut = stats.substitution_out_minute

  if (isStarter) {
    if (subOut != null && subOut <= minute) return false
    return true
  }

  if (subIn == null || subIn > minute) return false
  if (subOut != null && subOut <= minute) return false
  return true
}

export function validatePlayerOnFieldAtMinute(
  playerNumber: number | string,
  stats: PlayerOnFieldStats | undefined,
  minute: number
): string | null {
  if (isPlayerOnFieldAtMinute(playerNumber, stats, minute)) return null
  return `Non è possibile: a ${minute}' il giocatore non era in campo.`
}

export function calculatePlayerMinutesPlayed(
  playerNumber: number | string,
  stats?: PlayerOnFieldStats & { minutes_played?: number }
): number {
  const number = parsePlayerNumber(playerNumber)
  if (isNaN(number)) return 0

  const isStarter = isStarterPlayerNumber(number)

  if (!stats) {
    return isStarter ? 80 : 0
  }

  if (stats.substitution_in_minute != null && stats.substitution_out_minute != null) {
    return stats.substitution_out_minute - stats.substitution_in_minute
  }
  if (stats.substitution_in_minute != null) {
    return 80 - stats.substitution_in_minute
  }
  if (stats.substitution_out_minute != null) {
    return stats.substitution_out_minute
  }
  if (isStarter) {
    return 80
  }

  return 0
}

export function getPlayersOnFieldAtMinute(
  minute: number,
  players: PlayerOnFieldInput[],
  statsByPlayer: Record<string, PlayerOnFieldStats | undefined>
): PlayerOnFieldInput[] {
  return players.filter(player => {
    const playerStats = statsByPlayer[player.player_id]
    return isPlayerOnFieldAtMinute(player.number, playerStats, minute)
  })
}
