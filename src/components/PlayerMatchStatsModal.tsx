import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getLatestMatchEventMinute, validateMatchEventMinute } from '@/lib/matchStatsChronology'
import {
  addConversionMinute,
  calculatePlayerMinutesPlayed,
  getLastUnconvertedTryMinute,
  getPlayersOnFieldAtMinute,
  hasPlayerBeenOnField,
  hasUnconvertedTry,
  isStarterPlayerNumber,
  markTryConverted,
  validatePlayerOnFieldAtMinute,
} from '@/lib/matchStatsConversions'

const statsFormFieldClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent [color-scheme:light] [&_option]:bg-white [&_option]:text-gray-900'

interface Player {
  player_id: string
  number: number
  name: string
  role?: string
}

interface PlayerStats {
  id?: string
  player_id: string
  tries: number
  try_minutes: number[]
  conversions: number
  conversion_minutes: number[]
  converted_try_minutes?: number[]
  drop_goals: number
  drop_goal_minutes: number[]
  yellow_cards: number
  yellow_card_minutes: number[]
  red_cards: number
  red_card_minutes: number[]
  substitution_in_minute?: number
  substitution_out_minute?: number
  substituted_by_player_id?: string
  minutes_played: number
}

interface PlayerMatchStatsModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
  player: Player
  matchListId: string
  eventId?: string | null
  existingStats?: PlayerStats | null
  allPlayers: Player[]
  allPlayerStats?: Record<string, PlayerStats>
}

function emptyPlayerStats(playerId: string): PlayerStats {
  return {
    player_id: playerId,
    tries: 0,
    try_minutes: [],
    conversions: 0,
    conversion_minutes: [],
    converted_try_minutes: [],
    drop_goals: 0,
    drop_goal_minutes: [],
    yellow_cards: 0,
    yellow_card_minutes: [],
    red_cards: 0,
    red_card_minutes: [],
    minutes_played: 0,
  }
}

export default function PlayerMatchStatsModal({
  isOpen,
  onClose,
  onUpdate,
  player,
  matchListId,
  eventId,
  existingStats,
  allPlayers,
  allPlayerStats = {}
}: PlayerMatchStatsModalProps) {
  const [stats, setStats] = useState<PlayerStats>(() => emptyPlayerStats(player.player_id))
  const [showMinuteInput, setShowMinuteInput] = useState<{
    type: 'try' | 'conversion' | 'drop_goal' | 'yellow_card' | 'red_card' | null
  }>({ type: null })
  const [minuteValue, setMinuteValue] = useState('')
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false)
  const [availableSubstitutes, setAvailableSubstitutes] = useState<Player[]>([])
  const [selectedSubstitute, setSelectedSubstitute] = useState<string>('')
  const [substitutionType, setSubstitutionType] = useState<'in' | 'out'>('in')
  const [saving, setSaving] = useState(false)
  const [showConvertedPrompt, setShowConvertedPrompt] = useState(false)
  const [pendingTryMinute, setPendingTryMinute] = useState<number | null>(null)
  const [conversionFlow, setConversionFlow] = useState<{ tryMinute: number; tryScorerId: string } | null>(null)
  const [showConversionPlayerPicker, setShowConversionPlayerPicker] = useState(false)
  const [conversionMinutePending, setConversionMinutePending] = useState<number | null>(null)
  const [selectedConverterId, setSelectedConverterId] = useState('')
  const [otherPlayerStatsDelta, setOtherPlayerStatsDelta] = useState<Record<string, PlayerStats>>({})

  useEffect(() => {
    if (existingStats) {
      setStats({
        ...existingStats,
        converted_try_minutes: existingStats.converted_try_minutes ?? [],
      })
    } else {
      setStats(emptyPlayerStats(player.player_id))
    }
    setShowConvertedPrompt(false)
    setPendingTryMinute(null)
    setConversionFlow(null)
    setShowConversionPlayerPicker(false)
    setConversionMinutePending(null)
    setSelectedConverterId('')
    setOtherPlayerStatsDelta({})
  }, [existingStats, player.player_id, isOpen])

  const getEffectivePlayerStats = (playerId: string): PlayerStats => {
    if (playerId === player.player_id) return stats
    if (otherPlayerStatsDelta[playerId]) return otherPlayerStatsDelta[playerId]
    if (allPlayerStats[playerId]) {
      return {
        ...allPlayerStats[playerId],
        converted_try_minutes: allPlayerStats[playerId].converted_try_minutes ?? [],
      }
    }
    return emptyPlayerStats(playerId)
  }

  const getStatsLookupForField = (): Record<string, PlayerStats> => {
    const lookup: Record<string, PlayerStats> = { ...allPlayerStats, ...otherPlayerStatsDelta }
    lookup[player.player_id] = stats
    return lookup
  }

  const handleAddStat = (type: 'try' | 'conversion' | 'drop_goal' | 'yellow_card' | 'red_card') => {
    if (!hasPlayerBeenOnField(player.number, stats)) {
      alert('Non è possibile: il giocatore non risulta in campo (né titolare né entrato per sostituzione).')
      return
    }

    if (type === 'conversion') {
      const lastUnconvertedTry = getLastUnconvertedTryMinute(stats)
      if (lastUnconvertedTry === null) {
        alert('Non è possibile: devi prima segnare una meta senza trasformazione.')
        return
      }
      setConversionFlow({ tryMinute: lastUnconvertedTry, tryScorerId: player.player_id })
    } else {
      setConversionFlow(null)
    }

    setShowMinuteInput({ type })
    setMinuteValue('')
  }

  const applyConversion = (converterPlayerId: string, conversionMinute: number, tryMinute: number, tryScorerId: string) => {
    const converterStats = getEffectivePlayerStats(converterPlayerId)
    const converterPlayer = allPlayers.find(p => p.player_id === converterPlayerId)
    const tryScorerStats = getEffectivePlayerStats(tryScorerId)
    const tryScorerPlayer = allPlayers.find(p => p.player_id === tryScorerId)

    const converterFieldError = converterPlayer
      ? validatePlayerOnFieldAtMinute(converterPlayer.number, converterStats, conversionMinute)
      : null
    if (converterFieldError) {
      alert(converterFieldError)
      return false
    }

    const tryScorerFieldError = tryScorerPlayer
      ? validatePlayerOnFieldAtMinute(tryScorerPlayer.number, tryScorerStats, tryMinute)
      : null
    if (tryScorerFieldError) {
      alert(tryScorerFieldError)
      return false
    }

    const chronologyError = validateMatchEventMinute(converterStats, conversionMinute)
    if (chronologyError) {
      alert(chronologyError)
      return false
    }

    if (conversionMinute < tryMinute) {
      alert(`Non è possibile: la trasformazione non può essere prima della meta (${tryMinute}').`)
      return false
    }

    let nextCurrentStats = stats
    const nextOtherStats = { ...otherPlayerStatsDelta }

    const updatePlayerRecord = (playerId: string, nextStats: PlayerStats) => {
      if (playerId === player.player_id) {
        nextCurrentStats = nextStats
      } else {
        nextOtherStats[playerId] = nextStats
      }
    }

    updatePlayerRecord(
      tryScorerId,
      markTryConverted(getEffectivePlayerStats(tryScorerId), tryMinute)
    )
    updatePlayerRecord(
      converterPlayerId,
      addConversionMinute(getEffectivePlayerStats(converterPlayerId), conversionMinute)
    )

    setStats(nextCurrentStats)
    setOtherPlayerStatsDelta(nextOtherStats)
    return true
  }

  const handleMinuteSubmit = () => {
    if (!minuteValue || isNaN(Number(minuteValue))) return

    const minute = parseInt(minuteValue)
    if (minute < 0 || minute > 120) {
      alert('Il minuto deve essere tra 0 e 120')
      return
    }

    if (showMinuteInput.type === 'conversion' && conversionFlow) {
      if (minute < conversionFlow.tryMinute) {
        alert(`Non è possibile: la trasformazione non può essere prima della meta (${conversionFlow.tryMinute}').`)
        return
      }

      const tryScorerStats = getEffectivePlayerStats(conversionFlow.tryScorerId)
      const tryScorerPlayer = allPlayers.find(p => p.player_id === conversionFlow.tryScorerId)
      const chronologyError = validateMatchEventMinute(tryScorerStats, minute)
      if (chronologyError) {
        alert(chronologyError)
        return
      }

      if (tryScorerPlayer) {
        const tryScorerFieldError = validatePlayerOnFieldAtMinute(tryScorerPlayer.number, tryScorerStats, minute)
        if (tryScorerFieldError) {
          alert(tryScorerFieldError)
          return
        }
      }

      setConversionMinutePending(minute)
      setShowMinuteInput({ type: null })
      setMinuteValue('')
      setSelectedConverterId('')
      setShowConversionPlayerPicker(true)
      return
    }

    const chronologyError = validateMatchEventMinute(stats, minute)
    if (chronologyError) {
      alert(chronologyError)
      return
    }

    const onFieldError = validatePlayerOnFieldAtMinute(player.number, stats, minute)
    if (onFieldError) {
      alert(onFieldError)
      return
    }

    const newStats = { ...stats }

    switch (showMinuteInput.type) {
      case 'try':
        newStats.tries += 1
        newStats.try_minutes = [...newStats.try_minutes, minute].sort((a, b) => a - b)
        setStats(newStats)
        setShowMinuteInput({ type: null })
        setMinuteValue('')
        setPendingTryMinute(minute)
        setShowConvertedPrompt(true)
        return
      case 'conversion':
        break
      case 'drop_goal':
        newStats.drop_goals += 1
        newStats.drop_goal_minutes = [...newStats.drop_goal_minutes, minute].sort((a, b) => a - b)
        break
      case 'yellow_card':
        newStats.yellow_cards += 1
        newStats.yellow_card_minutes = [...newStats.yellow_card_minutes, minute].sort((a, b) => a - b)
        break
      case 'red_card':
        newStats.red_cards += 1
        newStats.red_card_minutes = [...newStats.red_card_minutes, minute].sort((a, b) => a - b)
        break
    }

    setStats(newStats)
    setShowMinuteInput({ type: null })
    setMinuteValue('')
  }

  const handleConvertedPrompt = (converted: boolean) => {
    const tryMinute = pendingTryMinute
    setShowConvertedPrompt(false)
    setPendingTryMinute(null)

    if (!converted || tryMinute === null) {
      setConversionFlow(null)
      return
    }

    setConversionFlow({ tryMinute, tryScorerId: player.player_id })
    setShowMinuteInput({ type: 'conversion' })
    setMinuteValue('')
  }

  const handleConversionPlayerConfirm = () => {
    if (!selectedConverterId || conversionFlow === null || conversionMinutePending === null) {
      alert('Seleziona il giocatore che ha trasformato')
      return
    }

    const applied = applyConversion(
      selectedConverterId,
      conversionMinutePending,
      conversionFlow.tryMinute,
      conversionFlow.tryScorerId
    )

    if (!applied) return

    setShowConversionPlayerPicker(false)
    setConversionFlow(null)
    setConversionMinutePending(null)
    setSelectedConverterId('')
  }

  const handleRemoveStat = (type: 'try' | 'conversion' | 'drop_goal' | 'yellow_card' | 'red_card', index: number) => {
    const newStats = { ...stats }

    switch (type) {
      case 'try': {
        const tryMinute = newStats.try_minutes[index]
        if (tryMinute != null && (newStats.converted_try_minutes ?? []).includes(tryMinute)) {
          alert('Non è possibile eliminare una meta che ha già una trasformazione abbinata.')
          return
        }
        newStats.tries = Math.max(0, newStats.tries - 1)
        newStats.try_minutes = newStats.try_minutes.filter((_, i) => i !== index)
        break
      }
      case 'conversion':
        newStats.conversions = Math.max(0, newStats.conversions - 1)
        newStats.conversion_minutes = newStats.conversion_minutes.filter((_, i) => i !== index)
        break
      case 'drop_goal':
        newStats.drop_goals = Math.max(0, newStats.drop_goals - 1)
        newStats.drop_goal_minutes = newStats.drop_goal_minutes.filter((_, i) => i !== index)
        break
      case 'yellow_card':
        newStats.yellow_cards = Math.max(0, newStats.yellow_cards - 1)
        newStats.yellow_card_minutes = newStats.yellow_card_minutes.filter((_, i) => i !== index)
        break
      case 'red_card':
        newStats.red_cards = Math.max(0, newStats.red_cards - 1)
        newStats.red_card_minutes = newStats.red_card_minutes.filter((_, i) => i !== index)
        break
    }

    setStats(newStats)
  }

  const handleSubstitutionClick = (type: 'in' | 'out') => {
    setSubstitutionType(type)
    
    // Converti il numero del giocatore corrente a intero
    const currentPlayerNumber = typeof player.number === 'string' ? parseInt(player.number, 10) : player.number
    const isCurrentPlayerStarter = currentPlayerNumber >= 1 && currentPlayerNumber <= 15
    const isCurrentPlayerBench = currentPlayerNumber >= 16 && currentPlayerNumber <= 22
    
    if (type === 'in') {
      // "Entra in Campo" - SOLO per giocatori in panchina (16-22)
      // Mostra i giocatori che sono IN CAMPO (1-15 + quelli entrati dopo sostituzione)
      const availablePlayers = allPlayers.filter(p => {
        // Escludi il giocatore corrente
        if (p.player_id === player.player_id) return false
        
        // Converti il numero a intero
        const playerNumber = typeof p.number === 'string' ? parseInt(p.number, 10) : p.number
        if (isNaN(playerNumber)) return false
        
        // Include SOLO giocatori che sono in campo:
        // - Titolari (1-15)
        // - Giocatori entrati dopo sostituzione (hanno substitution_in_minute)
        const playerStat = allPlayerStats[p.player_id]
        const isStarter = playerNumber >= 1 && playerNumber <= 15
        const hasEntered = playerStat && playerStat.substitution_in_minute
        
        return isStarter || hasEntered
      })
      
      console.log('📋 Giocatori in campo disponibili per sostituzione:', availablePlayers.map(p => `N° ${p.number} - ${p.name}`))
      setAvailableSubstitutes(availablePlayers)
    } else {
      // "Uscito dal Campo" - SOLO per giocatori titolari (1-15)
      // Mostra SOLO i giocatori in panchina (16-22) che NON sono ancora entrati
      const availablePlayers = allPlayers.filter(p => {
        // Escludi il giocatore corrente
        if (p.player_id === player.player_id) return false
        
        // Converti il numero a intero
        const playerNumber = typeof p.number === 'string' ? parseInt(p.number, 10) : p.number
        if (isNaN(playerNumber)) return false
        
        // SOLO giocatori in panchina (16-22)
        if (playerNumber < 16 || playerNumber > 22) return false
        
        // Escludi giocatori che sono già entrati in campo (hanno substitution_in_minute)
        const playerStat = allPlayerStats[p.player_id]
        if (playerStat && playerStat.substitution_in_minute) return false
        
        return true
      })
      
      console.log('📋 Giocatori in panchina disponibili per entrare:', availablePlayers.map(p => `N° ${p.number} - ${p.name}`))
      setAvailableSubstitutes(availablePlayers)
    }
    
    setShowSubstitutionModal(true)
  }

  const handleSubstitutionConfirm = async () => {
    if (!selectedSubstitute) {
      alert('Seleziona un giocatore')
      return
    }

    const minute = prompt('Inserisci il minuto della sostituzione:')
    if (!minute || isNaN(Number(minute))) {
      return
    }

    const minuteNum = parseInt(minute)
    if (minuteNum < 0 || minuteNum > 120) {
      alert('Il minuto deve essere tra 0 e 120')
      return
    }

    const chronologyError = validateMatchEventMinute(stats, minuteNum)
    if (chronologyError) {
      alert(chronologyError)
      return
    }

    const newStats = { ...stats }
    
    if (substitutionType === 'in') {
      // Giocatore entra in campo
      newStats.substitution_in_minute = minuteNum
      newStats.substituted_by_player_id = selectedSubstitute
      // Minuti giocati = 80 - minuto_entrata
      newStats.minutes_played = 80 - minuteNum
      
      // Aggiorna anche le statistiche del giocatore che esce
      // Il giocatore sostituto (selectedSubstitute) deve avere substitution_out_minute = minuteNum
      // Questo verrà gestito quando salveremo le statistiche
    } else {
      // Giocatore esce dal campo
      newStats.substitution_out_minute = minuteNum
      newStats.substituted_by_player_id = selectedSubstitute
      // Minuti giocati = minuto_uscita (se è titolare)
      // Se è entrato dopo, i minuti sono già calcolati
      if (!newStats.substitution_in_minute) {
        // Titolare che esce: minuti = minuto_uscita
        newStats.minutes_played = minuteNum
      } else {
        // Giocatore entrato che esce: minuti = minuto_uscita - minuto_entrata
        newStats.minutes_played = minuteNum - newStats.substitution_in_minute
      }
    }

    setStats(newStats)
    setShowSubstitutionModal(false)
    setSelectedSubstitute('')
  }

  const handleDeleteSubstitution = () => {
    if (!confirm('Sei sicuro di voler cancellare questa sostituzione?')) {
      return
    }

    const hadSubstitutionIn = !!stats.substitution_in_minute
    const hadSubstitutionOut = !!stats.substitution_out_minute
    const linkedPlayerId = stats.substituted_by_player_id

    const newStats = { ...stats }

    if (newStats.substitution_in_minute) {
      newStats.substitution_in_minute = undefined
      if (!newStats.substitution_out_minute) {
        newStats.minutes_played = 0
      }
    }
    if (newStats.substitution_out_minute) {
      newStats.substitution_out_minute = undefined
      if (newStats.substitution_in_minute) {
        newStats.minutes_played = 80 - newStats.substitution_in_minute
      } else {
        newStats.minutes_played = isStarterPlayerNumber(player.number) ? 80 : 0
      }
    }
    newStats.substituted_by_player_id = undefined

    const nextOtherStats = { ...otherPlayerStatsDelta }

    if (linkedPlayerId) {
      const linkedPlayer = allPlayers.find(p => p.player_id === linkedPlayerId)
      const linkedStats = getEffectivePlayerStats(linkedPlayerId)
      const updatedLinked: PlayerStats = { ...linkedStats, player_id: linkedPlayerId }

      if (hadSubstitutionIn) {
        updatedLinked.substitution_out_minute = undefined
        if (updatedLinked.substituted_by_player_id === player.player_id) {
          updatedLinked.substituted_by_player_id = undefined
        }
      }

      if (hadSubstitutionOut) {
        updatedLinked.substitution_in_minute = undefined
        if (updatedLinked.substituted_by_player_id === player.player_id) {
          updatedLinked.substituted_by_player_id = undefined
        }
      }

      updatedLinked.minutes_played = calculatePlayerMinutesPlayed(
        linkedPlayer?.number ?? 0,
        updatedLinked
      )
      nextOtherStats[linkedPlayerId] = updatedLinked
    }

    newStats.minutes_played = calculatePlayerMinutesPlayed(player.number, newStats)

    setStats(newStats)
    setOtherPlayerStatsDelta(nextOtherStats)
  }

  const buildStatsPayload = (playerStats: PlayerStats, includeConvertedTryMinutes = true) => {
    const payload: Record<string, unknown> = {
      match_list_id: matchListId,
      player_id: playerStats.player_id,
      event_id: eventId || null,
      tries: playerStats.tries,
      try_minutes: playerStats.try_minutes,
      conversions: playerStats.conversions,
      conversion_minutes: playerStats.conversion_minutes,
      drop_goals: playerStats.drop_goals,
      drop_goal_minutes: playerStats.drop_goal_minutes,
      yellow_cards: playerStats.yellow_cards,
      yellow_card_minutes: playerStats.yellow_card_minutes,
      red_cards: playerStats.red_cards,
      red_card_minutes: playerStats.red_card_minutes,
      substitution_in_minute: playerStats.substitution_in_minute || null,
      substitution_out_minute: playerStats.substitution_out_minute || null,
      substituted_by_player_id: playerStats.substituted_by_player_id || null,
      minutes_played: playerStats.minutes_played,
    }

    if (includeConvertedTryMinutes && (playerStats.converted_try_minutes?.length ?? 0) > 0) {
      payload.converted_try_minutes = playerStats.converted_try_minutes
    }

    return payload
  }

  const isMissingConvertedTryMinutesColumn = (error: unknown) => {
    if (!error || typeof error !== 'object') return false
    const dbError = error as { code?: string; message?: string }
    return dbError.code === 'PGRST204' && (dbError.message?.includes('converted_try_minutes') ?? false)
  }

  const upsertPlayerStats = async (playerStats: PlayerStats, existing?: PlayerStats | null) => {
    const existingId = existing?.id ?? allPlayerStats[playerStats.player_id]?.id
    const playerNumber = allPlayers.find(p => p.player_id === playerStats.player_id)?.number ?? 0
    const statsToSave: PlayerStats = {
      ...playerStats,
      minutes_played: calculatePlayerMinutesPlayed(playerNumber, playerStats),
    }

    const save = async (includeConvertedTryMinutes: boolean) => {
      const statsData = buildStatsPayload(statsToSave, includeConvertedTryMinutes)
      if (existingId) {
        return supabase.from('match_statistics').update(statsData).eq('id', existingId)
      }
      return supabase.from('match_statistics').insert([statsData])
    }

    let result = await save(true)
    if (result.error && isMissingConvertedTryMinutesColumn(result.error)) {
      result = await save(false)
    }
    if (result.error) throw result.error
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await upsertPlayerStats(stats, existingStats)

      for (const [playerId, playerStats] of Object.entries(otherPlayerStatsDelta)) {
        if (playerId === player.player_id) continue
        await upsertPlayerStats(playerStats, allPlayerStats[playerId])
      }

      // Se c'è una sostituzione, aggiorna anche le statistiche del giocatore sostituto
      if (stats.substituted_by_player_id) {
        const substitutePlayerId = stats.substituted_by_player_id
        const substituteStats = getEffectivePlayerStats(substitutePlayerId)
        const updatedSubstitute: PlayerStats = {
          ...substituteStats,
          player_id: substitutePlayerId,
        }

        if (stats.substitution_in_minute) {
          updatedSubstitute.substitution_out_minute = stats.substitution_in_minute
          updatedSubstitute.substituted_by_player_id = player.player_id
          if (!substituteStats.substitution_in_minute) {
            updatedSubstitute.minutes_played = stats.substitution_in_minute
          } else {
            updatedSubstitute.minutes_played = stats.substitution_in_minute - substituteStats.substitution_in_minute
          }
        } else if (stats.substitution_out_minute) {
          updatedSubstitute.substitution_in_minute = stats.substitution_out_minute
          updatedSubstitute.substituted_by_player_id = player.player_id
          updatedSubstitute.minutes_played = 80 - stats.substitution_out_minute
        }

        try {
          await upsertPlayerStats(updatedSubstitute, allPlayerStats[substitutePlayerId])
        } catch (subError) {
          console.error('Errore nell\'aggiornamento statistiche sostituto:', subError)
        }
      } else if (existingStats?.substituted_by_player_id) {
        // Se abbiamo rimosso la sostituzione (substituted_by_player_id è undefined ma esisteva prima)
        // Rimuovi anche la sostituzione dal giocatore sostituto
        const oldSubstitutePlayerId = existingStats.substituted_by_player_id
        const oldSubstituteStats = allPlayerStats[oldSubstitutePlayerId]
        
        if (oldSubstituteStats?.id) {
          const oldSubstitutePlayer = allPlayers.find(p => p.player_id === oldSubstitutePlayerId)
          const updatedOldSubstitute: PlayerStats = {
            ...oldSubstituteStats,
            substitution_in_minute: undefined,
            substitution_out_minute: undefined,
            substituted_by_player_id: undefined,
            minutes_played: calculatePlayerMinutesPlayed(
              oldSubstitutePlayer?.number ?? 0,
              {
                substitution_in_minute: undefined,
                substitution_out_minute: undefined,
              }
            ),
          }

          try {
            await upsertPlayerStats(updatedOldSubstitute, oldSubstituteStats)
          } catch (subError) {
            console.error('Errore nella rimozione sostituzione dal sostituto:', subError)
          }
        }
      }

      onUpdate()
      onClose()
    } catch (error) {
      console.error('Errore nel salvataggio statistiche:', error)
      alert('Errore nel salvataggio delle statistiche')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const playerCanReceivePoints = hasPlayerBeenOnField(player.number, stats)
  const latestEventMinute = getLatestMatchEventMinute(stats)
  const minuteInputLatest =
    showMinuteInput.type === 'conversion' && conversionFlow
      ? getLatestMatchEventMinute(getEffectivePlayerStats(conversionFlow.tryScorerId))
      : latestEventMinute
  const playersOnFieldForConversion =
    conversionMinutePending !== null
      ? getPlayersOnFieldAtMinute(conversionMinutePending, allPlayers, getStatsLookupForField())
      : []

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden [color-scheme:light]">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl">
            <div>
              <h2 className="text-2xl font-bold">Statistiche Giocatore</h2>
              <p className="text-indigo-100 mt-1">
                {player.name} - N° {player.number}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
            {!playerCanReceivePoints && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Questo giocatore non risulta ancora in campo. Registra prima la sostituzione oppure assegna punti solo ai minuti in cui era in campo.
              </div>
            )}
            <div className="space-y-6">
              <div className={!playerCanReceivePoints ? 'pointer-events-none opacity-50 space-y-6' : 'space-y-6'}>
              {/* Statistiche Offensive - Layout Orizzontale */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Mete */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">🏉 Mete</h3>
                    <button
                      onClick={() => handleAddStat('try')}
                      className="w-10 h-10 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xl font-bold transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-2xl font-bold text-gray-900">{stats.tries}</div>
                    {stats.try_minutes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stats.try_minutes.map((minute, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                          >
                            {minute}'
                            <button
                              onClick={() => handleRemoveStat('try', index)}
                              className="ml-2 text-green-600 hover:text-green-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Trasformazioni */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">⚡ Trasf.</h3>
                    <button
                      onClick={() => handleAddStat('conversion')}
                      disabled={!hasUnconvertedTry(stats)}
                      className={`w-10 h-10 rounded-lg text-xl font-bold transition-colors flex items-center justify-center ${
                        hasUnconvertedTry(stats)
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-2xl font-bold text-gray-900">{stats.conversions}</div>
                    {stats.conversion_minutes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stats.conversion_minutes.map((minute, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                          >
                            {minute}'
                            <button
                              onClick={() => handleRemoveStat('conversion', index)}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Piazzati */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">🎯 Piazzati</h3>
                    <button
                      onClick={() => handleAddStat('drop_goal')}
                      className="w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xl font-bold transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-2xl font-bold text-gray-900">{stats.drop_goals}</div>
                    {stats.drop_goal_minutes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stats.drop_goal_minutes.map((minute, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                          >
                            {minute}'
                            <button
                              onClick={() => handleRemoveStat('drop_goal', index)}
                              className="ml-2 text-purple-600 hover:text-purple-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cartellini */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">🟨 Cartellino Giallo</h3>
                    <button
                      onClick={() => handleAddStat('yellow_card')}
                      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      + Aggiungi
                    </button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-2xl font-bold text-gray-900">{stats.yellow_cards}</div>
                    {stats.yellow_card_minutes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stats.yellow_card_minutes.map((minute, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                          >
                            {minute}'
                            <button
                              onClick={() => handleRemoveStat('yellow_card', index)}
                              className="ml-1 text-yellow-600 hover:text-yellow-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">🟥 Cartellino Rosso</h3>
                    <button
                      onClick={() => handleAddStat('red_card')}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      + Aggiungi
                    </button>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-2xl font-bold text-gray-900">{stats.red_cards}</div>
                    {stats.red_card_minutes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {stats.red_card_minutes.map((minute, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                          >
                            {minute}'
                            <button
                              onClick={() => handleRemoveStat('red_card', index)}
                              className="ml-1 text-red-600 hover:text-red-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Riepilogo Punti */}
              <div className="bg-indigo-50 rounded-xl p-4 border-2 border-indigo-200">
                <h3 className="text-lg font-semibold text-indigo-900 mb-2">📊 Riepilogo</h3>
                <div className="text-3xl font-bold text-indigo-900">
                  {(stats.tries * 5) + (stats.conversions * 2) + (stats.drop_goals * 3)} Punti
                </div>
                <div className="text-sm text-indigo-700 mt-2">
                  {stats.tries} mete × 5 + {stats.conversions} trasformazioni × 2 + {stats.drop_goals} piazzati × 3
                </div>
              </div>
              </div>

              {/* Sostituzione */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">🔄 Sostituzione</h3>
                  {(stats.substitution_in_minute || stats.substitution_out_minute) && (
                    <button
                      onClick={handleDeleteSubstitution}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      🗑️ Cancella Sostituzione
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSubstitutionClick('in')}
                    disabled={player.number > 15 || !!stats.substitution_in_minute}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      player.number > 15 || !!stats.substitution_in_minute
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    Entrato in Campo
                  </button>
                  <button
                    onClick={() => handleSubstitutionClick('out')}
                    disabled={player.number > 15 && !stats.substitution_in_minute}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      player.number > 15 && !stats.substitution_in_minute
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                    }`}
                  >
                    Uscito dal Campo
                  </button>
                </div>
                {stats.substitution_in_minute && (() => {
                  const substitutedPlayer = allPlayers.find(p => p.player_id === stats.substituted_by_player_id)
                  const substitutedPlayerNumber = substitutedPlayer?.number
                  return (
                    <div className="mt-3 text-sm text-gray-600">
                      Entrato al minuto: {stats.substitution_in_minute}'
                      {substitutedPlayerNumber && (
                        <span className="ml-1">(al posto di N° {substitutedPlayerNumber})</span>
                      )}
                    </div>
                  )
                })()}
                {stats.substitution_out_minute && (() => {
                  const enteredPlayer = allPlayers.find(p => p.player_id === stats.substituted_by_player_id)
                  const enteredPlayerNumber = enteredPlayer?.number
                  return (
                    <div className="mt-3 text-sm text-gray-600">
                      Uscito al minuto: {stats.substitution_out_minute}'
                      {enteredPlayerNumber && (
                        <span className="ml-1">(N° {enteredPlayerNumber} entrato)</span>
                      )}
                    </div>
                  )
                })()}
                {calculatePlayerMinutesPlayed(player.number, stats) > 0 && (
                  <div className="mt-3 text-sm font-semibold text-gray-900">
                    Minuti giocati: {calculatePlayerMinutesPlayed(player.number, stats)}'
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t">
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Input Minuto */}
      {showMinuteInput.type && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full [color-scheme:light]">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {showMinuteInput.type === 'conversion'
                ? `Minuto trasformazione${conversionFlow ? ` (meta ${conversionFlow.tryMinute}')` : ''}`
                : 'Inserisci il minuto'}
            </h3>
            {minuteInputLatest !== null && (
              <p className="text-sm text-gray-600 mb-3">
                Ultimo evento registrato al {minuteInputLatest}&apos;. Inserisci un minuto uguale o successivo.
              </p>
            )}
            <input
              type="number"
              min={minuteInputLatest ?? 0}
              max="120"
              value={minuteValue}
              onChange={(e) => setMinuteValue(e.target.value)}
              placeholder={minuteInputLatest !== null ? `Minimo ${minuteInputLatest}'` : 'Minuto (0-120)'}
              className={`${statsFormFieldClass} mb-4`}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMinuteInput({ type: null })
                  setMinuteValue('')
                  setConversionFlow(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleMinuteSubmit}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meta trasformata? */}
      {showConvertedPrompt && pendingTryMinute !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full [color-scheme:light]">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Meta al {pendingTryMinute}&apos;</h3>
            <p className="text-sm text-gray-600 mb-6">La meta è stata trasformata?</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleConvertedPrompt(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                No
              </button>
              <button
                onClick={() => handleConvertedPrompt(true)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Sì
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chi ha trasformato */}
      {showConversionPlayerPicker && conversionFlow && conversionMinutePending !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto [color-scheme:light]">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Chi ha trasformato?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Meta al {conversionFlow.tryMinute}&apos; · Trasformazione al {conversionMinutePending}&apos;
            </p>
            {playersOnFieldForConversion.length === 0 ? (
              <p className="text-sm text-red-600 mb-4">Nessun giocatore in campo disponibile a questo minuto.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {playersOnFieldForConversion.map(p => (
                  <button
                    key={p.player_id}
                    type="button"
                    onClick={() => setSelectedConverterId(p.player_id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selectedConverterId === p.player_id
                        ? 'border-indigo-500 bg-indigo-50 text-gray-900'
                        : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    N° {p.number} - {allPlayers.find(playerItem => playerItem.player_id === p.player_id)?.name ?? 'Giocatore'}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConversionPlayerPicker(false)
                  setConversionMinutePending(null)
                  setSelectedConverterId('')
                  setConversionFlow(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleConversionPlayerConfirm}
                disabled={!selectedConverterId}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sostituzione */}
      {showSubstitutionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full [color-scheme:light]">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {substitutionType === 'in' ? 'Giocatore che entra' : 'Giocatore che esce'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Seleziona il giocatore {substitutionType === 'in' ? 'dalla panchina' : 'da sostituire'}:
            </p>
            <select
              value={selectedSubstitute}
              onChange={(e) => setSelectedSubstitute(e.target.value)}
              className={`${statsFormFieldClass} mb-4`}
            >
              <option value="">Seleziona giocatore...</option>
              {availableSubstitutes.map((p) => (
                <option key={p.player_id} value={p.player_id}>
                  N° {p.number} - {p.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSubstitutionModal(false)
                  setSelectedSubstitute('')
                }}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSubstitutionConfirm}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
