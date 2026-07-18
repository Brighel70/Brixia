import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { calculatePlayerMinutesPlayed } from '@/lib/matchStatsConversions'
import PlayerMatchStatsModal from './PlayerMatchStatsModal'
import MatchSummaryModal from './MatchSummaryModal'
import OpponentStatsModal from './OpponentStatsModal'

interface MatchScorecardProps {
  isOpen: boolean
  onClose: () => void
  matchList: any
}

interface Player {
  player_id: string
  number: number
  name: string
  role?: string
}

interface PlayerStats {
  id: string
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

export default function MatchScorecard({ isOpen, onClose, matchList }: MatchScorecardProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({})
  const [opponentStats, setOpponentStats] = useState<PlayerStats | null>(null)
  const [opponentName, setOpponentName] = useState<string>('')
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [showPlayerStatsModal, setShowPlayerStatsModal] = useState(false)
  const [showOpponentStatsModal, setShowOpponentStatsModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && matchList) {
      loadPlayers()
      loadPlayerStats()
      loadOpponentInfo()
    }
  }, [isOpen, matchList])

  const loadPlayers = async () => {
    if (!matchList?.selected_players) {
      console.log('⚠️ matchList.selected_players è vuoto o non esiste:', matchList)
      setLoading(false)
      return
    }

    try {
      // Gestisci il caso in cui selected_players sia una stringa JSON
      let selectedPlayersArray = matchList.selected_players
      if (typeof selectedPlayersArray === 'string') {
        try {
          selectedPlayersArray = JSON.parse(selectedPlayersArray)
        } catch (e) {
          console.error('Errore nel parsing JSON di selected_players:', e)
          setLoading(false)
          return
        }
      }

      // Verifica che sia un array
      if (!Array.isArray(selectedPlayersArray) || selectedPlayersArray.length === 0) {
        console.log('⚠️ selected_players non è un array o è vuoto:', selectedPlayersArray)
        setPlayers([])
        setLoading(false)
        return
      }

      console.log('📋 Caricamento giocatori, selected_players:', selectedPlayersArray)

      const playerIds = selectedPlayersArray.map((p: any) => {
        // Gestisci diversi formati possibili
        if (typeof p === 'string') return p
        return p.player_id || p.id || p
      }).filter(Boolean) // Rimuovi valori null/undefined

      if (playerIds.length === 0) {
        console.log('⚠️ Nessun player_id valido trovato')
        setPlayers([])
        setLoading(false)
        return
      }

      console.log('🔍 Player IDs da caricare:', playerIds)

      const { data: playersData, error } = await supabase
        .from('people')
        .select('id, full_name, given_name, family_name')
        .in('id', playerIds)

      if (error) {
        console.error('❌ Errore Supabase nel caricamento giocatori:', error)
        throw error
      }

      console.log('✅ Giocatori caricati dal database:', playersData)

      const playersList: Player[] = selectedPlayersArray.map((p: any) => {
        const playerId = typeof p === 'string' ? p : (p.player_id || p.id || p)
        const playerData = playersData?.find(pl => pl.id === playerId)
        // Usa full_name se disponibile, altrimenti combina given_name e family_name
        let playerName = 'Giocatore sconosciuto'
        if (playerData) {
          if (playerData.full_name) {
            playerName = playerData.full_name
          } else if (playerData.family_name || playerData.given_name) {
            playerName = `${playerData.family_name || ''} ${playerData.given_name || ''}`.trim()
          }
        }
        return {
          player_id: playerId,
          number: typeof p === 'object' ? (p.number || 0) : 0,
          name: playerName,
          role: typeof p === 'object' ? p.role : undefined
        }
      }).filter(p => p.player_id) // Rimuovi giocatori senza ID valido

      console.log('📊 Lista giocatori finale:', playersList)
      setPlayers(playersList.sort((a, b) => a.number - b.number))
    } catch (error) {
      console.error('❌ Errore nel caricamento giocatori:', error)
      setPlayers([])
    } finally {
      setLoading(false)
    }
  }

  const loadPlayerStats = async () => {
    if (!matchList?.id) return

    try {
      console.log('🔄 Caricamento statistiche per match_list_id:', matchList.id)
      const { data, error } = await supabase
        .from('match_statistics')
        .select('*')
        .eq('match_list_id', matchList.id)

      if (error) {
        console.error('❌ Errore query statistiche:', error)
        throw error
      }

      console.log('📋 Dati ricevuti da Supabase:', data)

      const statsMap: Record<string, PlayerStats> = {}
      let opponentStatsData: PlayerStats | null = null

      data?.forEach((stat: any) => {
        console.log('🔍 Processando statistica:', { player_id: stat.player_id, tries: stat.tries, conversions: stat.conversions })
        // Se player_id è null, sono statistiche dell'avversario
        if (stat.player_id === null || stat.player_id === undefined) {
          console.log('📊 Statistiche avversario trovate:', stat)
          opponentStatsData = {
            id: stat.id,
            player_id: '',
            tries: stat.tries || 0,
            try_minutes: stat.try_minutes || [],
            conversions: stat.conversions || 0,
            conversion_minutes: stat.conversion_minutes || [],
            converted_try_minutes: stat.converted_try_minutes || [],
            drop_goals: stat.drop_goals || 0,
            drop_goal_minutes: stat.drop_goal_minutes || [],
            yellow_cards: stat.yellow_cards || 0,
            yellow_card_minutes: stat.yellow_card_minutes || [],
            red_cards: stat.red_cards || 0,
            red_card_minutes: stat.red_card_minutes || [],
            substitution_in_minute: stat.substitution_in_minute,
            substitution_out_minute: stat.substitution_out_minute,
            substituted_by_player_id: stat.substituted_by_player_id,
            minutes_played: stat.minutes_played || 0
          }
        } else {
          statsMap[stat.player_id] = {
            id: stat.id,
            player_id: stat.player_id,
            tries: stat.tries || 0,
            try_minutes: stat.try_minutes || [],
            conversions: stat.conversions || 0,
            conversion_minutes: stat.conversion_minutes || [],
            converted_try_minutes: stat.converted_try_minutes || [],
            drop_goals: stat.drop_goals || 0,
            drop_goal_minutes: stat.drop_goal_minutes || [],
            yellow_cards: stat.yellow_cards || 0,
            yellow_card_minutes: stat.yellow_card_minutes || [],
            red_cards: stat.red_cards || 0,
            red_card_minutes: stat.red_card_minutes || [],
            substitution_in_minute: stat.substitution_in_minute,
            substitution_out_minute: stat.substitution_out_minute,
            substituted_by_player_id: stat.substituted_by_player_id,
            minutes_played: stat.minutes_played || 0
          }
        }
      })

      setPlayerStats(statsMap)
      setOpponentStats(opponentStatsData)
      console.log('✅ Statistiche caricate - Avversario:', opponentStatsData)
      console.log('✅ Statistiche caricate - Giocatori:', Object.keys(statsMap).length)
    } catch (error) {
      console.error('❌ Errore nel caricamento statistiche:', error)
    }
  }

  const loadOpponentInfo = async () => {
    if (!matchList?.event_id) {
      setOpponentName('Avversario')
      return
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select('opponent')
        .eq('id', matchList.event_id)
        .single()

      if (error) throw error

      setOpponentName(data?.opponent || 'Avversario')
    } catch (error) {
      console.error('Errore nel caricamento nome avversario:', error)
      setOpponentName('Avversario')
    }
  }

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player)
    setShowPlayerStatsModal(true)
  }

  const handleStatsUpdate = () => {
    loadPlayerStats()
  }

  const getPlayerStats = (playerId: string): PlayerStats | null => {
    return playerStats[playerId] || null
  }

  const calculatePoints = (stats: PlayerStats | null): number => {
    if (!stats) return 0
    // Usa la lunghezza degli array dei minuti se disponibili, altrimenti usa i conteggi
    const tries = stats.try_minutes?.length || stats.tries || 0
    const conversions = stats.conversion_minutes?.length || stats.conversions || 0
    const dropGoals = stats.drop_goal_minutes?.length || stats.drop_goals || 0
    return (tries * 5) + (conversions * 2) + (dropGoals * 3)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">📊 Tabellino Partita</h2>
                <p className="text-indigo-100 mt-1">
                  {matchList?.events?.title || matchList?.name || 'Partita'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowSummaryModal(true)}
                  className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  title="Resoconto"
                >
                  📋 Resoconto
                </button>
                <button
                  onClick={onClose}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
            {loading ? (
              <div className="text-center py-12">
                <div className="text-lg">Caricamento giocatori...</div>
              </div>
            ) : players.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessun Giocatore nella Lista</h3>
                <p className="text-gray-600 mb-4">
                  Questa lista gara non contiene giocatori selezionati.
                </p>
                <p className="text-sm text-gray-500">
                  Per aggiungere giocatori, modifica la lista gara dal menu principale.
                </p>
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Debug Info:</strong> selected_players = {JSON.stringify(matchList?.selected_players || 'null', null, 2)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Tabella Giocatori */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Lista Gara - {players.length} Giocatori</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Num.</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giocatore</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Mete</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trasf.</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Piazzati</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">Punti</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Gialli</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Rossi</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Minuti</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {/* Riga Avversario */}
                        <tr className="bg-red-50 hover:bg-red-100 transition-colors border-b-2 border-red-200">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                              ⚔️
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{opponentName}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {opponentStats && (opponentStats.tries > 0 || (opponentStats.try_minutes && opponentStats.try_minutes.length > 0)) ? (
                              <>
                                <span className="text-gray-900 font-medium">{opponentStats.try_minutes?.length || opponentStats.tries}</span>
                                {opponentStats.try_minutes && opponentStats.try_minutes.length > 0 && (
                                  <div className="text-xs text-gray-500">
                                    {opponentStats.try_minutes.join(', ')}'
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {opponentStats && (opponentStats.conversions > 0 || (opponentStats.conversion_minutes && opponentStats.conversion_minutes.length > 0)) ? (
                              <>
                                <span className="text-gray-900 font-medium">{opponentStats.conversion_minutes?.length || opponentStats.conversions}</span>
                                {opponentStats.conversion_minutes && opponentStats.conversion_minutes.length > 0 && (
                                  <div className="text-xs text-gray-500">
                                    {opponentStats.conversion_minutes.join(', ')}'
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {opponentStats && (opponentStats.drop_goals > 0 || (opponentStats.drop_goal_minutes && opponentStats.drop_goal_minutes.length > 0)) ? (
                              <>
                                <span className="text-gray-900 font-medium">{opponentStats.drop_goal_minutes?.length || opponentStats.drop_goals}</span>
                                {opponentStats.drop_goal_minutes && opponentStats.drop_goal_minutes.length > 0 && (
                                  <div className="text-xs text-gray-500">
                                    {opponentStats.drop_goal_minutes.join(', ')}'
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center bg-green-50">
                            {(() => {
                              if (!opponentStats) return <span className="text-gray-400">-</span>
                              // Calcola i punti basandosi sugli array dei minuti se disponibili
                              const tries = opponentStats.try_minutes?.length || opponentStats.tries || 0
                              const conversions = opponentStats.conversion_minutes?.length || opponentStats.conversions || 0
                              const dropGoals = opponentStats.drop_goal_minutes?.length || opponentStats.drop_goals || 0
                              const points = (tries * 5) + (conversions * 2) + (dropGoals * 3)
                              return points > 0 ? (
                                <span className="text-green-700 font-bold">{points}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )
                            })()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {opponentStats?.yellow_cards ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                {opponentStats.yellow_cards}
                                {opponentStats.yellow_card_minutes && opponentStats.yellow_card_minutes.length > 0 && (
                                  <span className="ml-1">({opponentStats.yellow_card_minutes.join(', ')}')</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {opponentStats?.red_cards ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {opponentStats.red_cards}
                                {opponentStats.red_card_minutes && opponentStats.red_card_minutes.length > 0 && (
                                  <span className="ml-1">({opponentStats.red_card_minutes.join(', ')}')</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-gray-400">-</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setShowOpponentStatsModal(true)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              Modifica
                            </button>
                          </td>
                        </tr>
                        {players.map((player) => {
                          const stats = getPlayerStats(player.player_id)
                          const points = calculatePoints(stats)
                          return (
                            <tr key={player.player_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                  {player.number}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{player.name}</div>
                                {player.role && (
                                  <div className="text-sm text-gray-500">{player.role}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {stats?.tries && stats.tries > 0 ? (
                                  <>
                                    <span className="text-gray-900 font-medium">{stats.tries}</span>
                                    {stats.try_minutes && stats.try_minutes.length > 0 && (
                                      <div className="text-xs text-gray-500">
                                        {stats.try_minutes.join(', ')}'
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {stats?.conversions && stats.conversions > 0 ? (
                                  <>
                                    <span className="text-gray-900 font-medium">{stats.conversions}</span>
                                    {stats.conversion_minutes && stats.conversion_minutes.length > 0 && (
                                      <div className="text-xs text-gray-500">
                                        {stats.conversion_minutes.join(', ')}'
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {stats?.drop_goals && stats.drop_goals > 0 ? (
                                  <>
                                    <span className="text-gray-900 font-medium">{stats.drop_goals}</span>
                                    {stats.drop_goal_minutes && stats.drop_goal_minutes.length > 0 && (
                                      <div className="text-xs text-gray-500">
                                        {stats.drop_goal_minutes.join(', ')}'
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center bg-green-50">
                                {points > 0 ? (
                                  <span className="text-green-700 font-bold">{points}</span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {stats?.yellow_cards ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    {stats.yellow_cards}
                                    {stats.yellow_card_minutes && stats.yellow_card_minutes.length > 0 && (
                                      <span className="ml-1">({stats.yellow_card_minutes.join(', ')}')</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {stats?.red_cards ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    {stats.red_cards}
                                    {stats.red_card_minutes && stats.red_card_minutes.length > 0 && (
                                      <span className="ml-1">({stats.red_card_minutes.join(', ')}')</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {(() => {
                                  const minutesPlayed = calculatePlayerMinutesPlayed(player.number, stats ?? undefined)

                                  // Numero del giocatore sostituito (se questo giocatore è entrato)
                                  let replacedPlayerNumber = null
                                  if (stats?.substitution_in_minute && stats.substituted_by_player_id) {
                                    const replacedPlayer = players.find(p => p.player_id === stats.substituted_by_player_id)
                                    if (replacedPlayer) {
                                      replacedPlayerNumber = replacedPlayer.number
                                    }
                                  }

                                  // Numero del giocatore che è entrato (se questo giocatore è uscito)
                                  let enteredPlayerNumber = null
                                  if (stats?.substitution_out_minute && stats.substituted_by_player_id) {
                                    const enteredPlayer = players.find(p => p.player_id === stats.substituted_by_player_id)
                                    if (enteredPlayer) {
                                      enteredPlayerNumber = enteredPlayer.number
                                    }
                                  }

                                  return (
                                    <>
                                      {minutesPlayed > 0 ? (
                                        <span className="text-gray-900 font-medium">{minutesPlayed}'</span>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                      {stats?.substitution_in_minute && (
                                        <div className="text-xs text-gray-500">
                                          Entrato: {stats.substitution_in_minute}'
                                          {replacedPlayerNumber && (
                                            <span className="ml-1">(al posto di N° {replacedPlayerNumber})</span>
                                          )}
                                        </div>
                                      )}
                                      {stats?.substitution_out_minute && (
                                        <div className="text-xs text-gray-500">
                                          Uscito: {stats.substitution_out_minute}'
                                          {enteredPlayerNumber && (
                                            <span className="ml-1">(N° {enteredPlayerNumber} entrato)</span>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  )
                                })()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => handlePlayerClick(player)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                  Modifica
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Statistiche Giocatore */}
      {selectedPlayer && (
        <PlayerMatchStatsModal
          isOpen={showPlayerStatsModal}
          onClose={() => {
            setShowPlayerStatsModal(false)
            setSelectedPlayer(null)
          }}
          onUpdate={handleStatsUpdate}
          player={selectedPlayer}
          matchListId={matchList?.id}
          eventId={matchList?.event_id}
          existingStats={getPlayerStats(selectedPlayer.player_id)}
          allPlayers={players}
          allPlayerStats={playerStats}
        />
      )}

      {/* Modal Resoconto */}
      <MatchSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        matchListId={matchList?.id}
        players={players}
        playerStats={playerStats}
        opponentStats={opponentStats}
        eventId={matchList?.event_id}
        opponentName={opponentName}
      />

      {/* Modal Statistiche Avversario */}
      <OpponentStatsModal
        isOpen={showOpponentStatsModal}
        onClose={() => setShowOpponentStatsModal(false)}
        onUpdate={handleStatsUpdate}
        opponentName={opponentName}
        matchListId={matchList?.id}
        eventId={matchList?.event_id}
        existingStats={opponentStats}
      />
    </>
  )
}
