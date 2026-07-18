import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getBrandConfig } from '@/config/brand'

interface MatchSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  matchListId: string
  players: Array<{
    player_id: string
    number: number
    name: string
  }>
  playerStats: Record<string, any>
  opponentStats?: any
  eventId?: string | null
  opponentName?: string
}

interface TimelineEvent {
  minute: number
  type: 'try' | 'conversion' | 'drop_goal' | 'yellow_card' | 'red_card' | 'try_conceded' | 'drop_goal_conceded' | 'try_with_conversion'
  description: string
  points: number
  playerName?: string
  playerNumber?: number
  conversionPlayerName?: string
  cumulativePoints: number
  isHomeTeam: boolean // true = squadra di casa (sinistra, azzurro), false = avversario (destra, rosso)
  opponentScoreAtTime?: number // Punteggio dell'altra squadra al momento di questo evento
}

export default function MatchSummaryModal({
  isOpen,
  onClose,
  matchListId,
  players,
  playerStats,
  opponentStats,
  eventId,
  opponentName
}: MatchSummaryModalProps) {
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [isHome, setIsHome] = useState(true)
  const [eventDetails, setEventDetails] = useState<{
    title?: string
    opponent?: string
    match_result?: string
    categoryName?: string
  } | null>(null)

  useEffect(() => {
    if (isOpen && matchListId) {
      loadEventInfo()
      buildTimeline()
    }
  }, [isOpen, matchListId, players, playerStats, opponentStats, eventId])

  const loadEventInfo = async () => {
    if (!eventId) {
      setIsHome(true)
      return
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          is_home,
          opponent,
          match_result,
          title,
          categories(name)
        `)
        .eq('id', eventId)
        .single()

      if (error) throw error
      setIsHome(data?.is_home ?? true)
      setEventDetails({
        title: data?.title,
        opponent: data?.opponent || opponentName,
        match_result: data?.match_result,
        categoryName: (data?.categories as any)?.name
      })
    } catch (error) {
      console.error('Errore nel caricamento info evento:', error)
      setIsHome(true)
      setEventDetails({
        opponent: opponentName
      })
    }
  }

  const buildTimeline = () => {
    setLoading(true)
    const events: TimelineEvent[] = []
    let homeCumulativePoints = 0
    let awayCumulativePoints = 0

    // Raccogli tutte le mete e trasformazioni da tutti i giocatori per raggrupparle per minuto
    const allTryEvents: Array<{ minute: number; playerName: string; playerNumber?: number; playerId: string }> = []
    const allConversionEvents: Array<{ minute: number; playerName: string; playerId: string }> = []

    // Processa tutte le statistiche dei giocatori (squadra di casa)
    Object.entries(playerStats).forEach(([playerId, stats]) => {
      const player = players.find(p => p.player_id === playerId)
      const playerName = player?.name || 'Giocatore sconosciuto'
      const playerNumber = player?.number

      // Mete segnate
      if (stats.try_minutes && Array.isArray(stats.try_minutes)) {
        stats.try_minutes.forEach((minute: number) => {
          allTryEvents.push({ minute, playerName, playerNumber, playerId })
        })
      }

      // Trasformazioni
      if (stats.conversion_minutes && Array.isArray(stats.conversion_minutes)) {
        stats.conversion_minutes.forEach((minute: number) => {
          allConversionEvents.push({ minute, playerName, playerId })
        })
      }
    })

    // Raggruppa mete e trasformazioni per minuto
    allTryEvents.forEach((tryEvent) => {
      const conversionAtSameMinute = allConversionEvents.find(c => c.minute === tryEvent.minute)
      
      if (conversionAtSameMinute) {
        // Verifica se lo stesso giocatore ha fatto meta e trasformazione
        if (tryEvent.playerId === conversionAtSameMinute.playerId) {
          // Stesso giocatore: meta e trasformazione
          homeCumulativePoints += 7
          events.push({
            minute: tryEvent.minute,
            type: 'try_with_conversion',
            description: `${tryEvent.playerName} (M / TR)`,
            points: 7,
            playerName: tryEvent.playerName,
            playerNumber: tryEvent.playerNumber,
            conversionPlayerName: undefined, // Non serve se è lo stesso giocatore
            cumulativePoints: homeCumulativePoints,
            isHomeTeam: true
          })
        } else {
          // Giocatori diversi: meta e trasformazione
          homeCumulativePoints += 7
          events.push({
            minute: tryEvent.minute,
            type: 'try_with_conversion',
            description: `${tryEvent.playerName} (M)`,
            points: 7,
            playerName: tryEvent.playerName,
            playerNumber: tryEvent.playerNumber,
            conversionPlayerName: conversionAtSameMinute.playerName,
            cumulativePoints: homeCumulativePoints,
            isHomeTeam: true
          })
        }
      } else {
        // Solo meta
        homeCumulativePoints += 5
        events.push({
          minute: tryEvent.minute,
          type: 'try',
          description: `${tryEvent.playerName} (M)`,
          points: 5,
          playerName: tryEvent.playerName,
          playerNumber: tryEvent.playerNumber,
          cumulativePoints: homeCumulativePoints,
          isHomeTeam: true
        })
      }
    })

    // Trasformazioni senza meta (non dovrebbe succedere, ma gestiamolo)
    allConversionEvents.forEach((convEvent) => {
      const hasTryAtSameMinute = allTryEvents.find(t => t.minute === convEvent.minute)
      if (!hasTryAtSameMinute) {
        homeCumulativePoints += 2
        events.push({
          minute: convEvent.minute,
          type: 'conversion',
          description: `Tras. ${convEvent.playerName}`,
          points: 2,
          playerName: convEvent.playerName,
          cumulativePoints: homeCumulativePoints,
          isHomeTeam: true
        })
      }
    })

    // Processa piazzati e cartellini dei giocatori
    Object.entries(playerStats).forEach(([playerId, stats]) => {
      const player = players.find(p => p.player_id === playerId)
      const playerName = player?.name || 'Giocatore sconosciuto'
      const playerNumber = player?.number

      // Piazzati
      if (stats.drop_goal_minutes && Array.isArray(stats.drop_goal_minutes)) {
        stats.drop_goal_minutes.forEach((minute: number) => {
          homeCumulativePoints += 3
          events.push({
            minute,
            type: 'drop_goal',
            description: `Piazzato ${playerName}`,
            points: 3,
            playerName,
            playerNumber,
            cumulativePoints: homeCumulativePoints,
            isHomeTeam: true
          })
        })
      }

      // Cartellini gialli
      if (stats.yellow_card_minutes && Array.isArray(stats.yellow_card_minutes)) {
        stats.yellow_card_minutes.forEach((minute: number) => {
          events.push({
            minute,
            type: 'yellow_card',
            description: `Cartellino giallo ${playerName}`,
            points: 0,
            playerName,
            playerNumber,
            cumulativePoints: homeCumulativePoints,
            isHomeTeam: true
          })
        })
      }

      // Cartellini rossi
      if (stats.red_card_minutes && Array.isArray(stats.red_card_minutes)) {
        stats.red_card_minutes.forEach((minute: number) => {
          events.push({
            minute,
            type: 'red_card',
            description: `Cartellino rosso ${playerName}`,
            points: 0,
            playerName,
            playerNumber,
            cumulativePoints: homeCumulativePoints,
            isHomeTeam: true
          })
        })
      }
    })

    // Processa statistiche avversario
    if (opponentStats) {
      // Raccogli mete e trasformazioni dell'avversario
      const opponentTryMinutes = opponentStats.try_minutes || []
      const opponentConversionMinutes = opponentStats.conversion_minutes || []

      // Mete dell'avversario
      opponentTryMinutes.forEach((minute: number) => {
        const hasConversion = opponentConversionMinutes.includes(minute)
        if (hasConversion) {
          awayCumulativePoints += 7
          events.push({
            minute,
            type: 'try_with_conversion',
            description: 'Meta Trasformata',
            points: 7,
            cumulativePoints: awayCumulativePoints,
            isHomeTeam: false
          })
        } else {
          awayCumulativePoints += 5
          events.push({
            minute,
            type: 'try_conceded',
            description: 'Meta',
            points: 5,
            cumulativePoints: awayCumulativePoints,
            isHomeTeam: false
          })
        }
      })

      // Trasformazioni dell'avversario (senza meta)
      opponentConversionMinutes.forEach((minute: number) => {
        const hasTry = opponentTryMinutes.includes(minute)
        if (!hasTry) {
          awayCumulativePoints += 2
          events.push({
            minute,
            type: 'conversion',
            description: 'Trasformazione subita',
            points: 2,
            cumulativePoints: awayCumulativePoints,
            isHomeTeam: false
          })
        }
      })

      // Piazzati dell'avversario
      if (opponentStats.drop_goal_minutes && Array.isArray(opponentStats.drop_goal_minutes)) {
        opponentStats.drop_goal_minutes.forEach((minute: number) => {
          awayCumulativePoints += 3
          events.push({
            minute,
            type: 'drop_goal_conceded',
            description: 'Piazzato',
            points: 3,
            cumulativePoints: awayCumulativePoints,
            isHomeTeam: false
          })
        })
      }

      // Cartellini gialli avversario
      if (opponentStats.yellow_card_minutes && Array.isArray(opponentStats.yellow_card_minutes)) {
        opponentStats.yellow_card_minutes.forEach((minute: number) => {
          events.push({
            minute,
            type: 'yellow_card',
            description: 'Cartellino giallo avversario',
            points: 0,
            cumulativePoints: awayCumulativePoints,
            isHomeTeam: false
          })
        })
      }

      // Cartellini rossi avversario
      if (opponentStats.red_card_minutes && Array.isArray(opponentStats.red_card_minutes)) {
        opponentStats.red_card_minutes.forEach((minute: number) => {
          events.push({
            minute,
            type: 'red_card',
            description: 'Cartellino rosso avversario',
            points: 0,
            cumulativePoints: awayCumulativePoints,
            isHomeTeam: false
          })
        })
      }
    }

    // Ordina eventi per minuto
    events.sort((a, b) => a.minute - b.minute)

    // Ricalcola il punteggio cumulativo in ordine cronologico
    let homeCumulative = 0
    let awayCumulative = 0
    
    events.forEach(event => {
      if (event.isHomeTeam) {
        // Salva il punteggio dell'avversario prima di aggiungere i punti
        event.opponentScoreAtTime = awayCumulative
        homeCumulative += event.points
        event.cumulativePoints = homeCumulative
      } else {
        // Salva il punteggio della squadra di casa prima di aggiungere i punti
        event.opponentScoreAtTime = homeCumulative
        awayCumulative += event.points
        event.cumulativePoints = awayCumulative
      }
    })

    setTimelineEvents(events)
    setLoading(false)
  }

  // Calcola il risultato finale dai punteggi cumulativi finali
  const getFinalScore = () => {
    if (timelineEvents.length === 0) return null
    
    const lastHomeEvent = [...timelineEvents].reverse().find(e => e.isHomeTeam && e.points > 0)
    const lastAwayEvent = [...timelineEvents].reverse().find(e => !e.isHomeTeam && e.points > 0)
    
    const homeScore = lastHomeEvent?.cumulativePoints || 0
    const awayScore = lastAwayEvent?.cumulativePoints || 0
    
    // Se non ci sono eventi con punti, usa i punteggi finali calcolati
    if (homeScore === 0 && awayScore === 0) {
      const allHomePoints = timelineEvents.filter(e => e.isHomeTeam).reduce((sum, e) => sum + e.points, 0)
      const allAwayPoints = timelineEvents.filter(e => !e.isHomeTeam).reduce((sum, e) => sum + e.points, 0)
      return { home: allHomePoints, away: allAwayPoints }
    }
    
    return { home: homeScore, away: awayScore }
  }

  const finalScore = getFinalScore()

  // Salva automaticamente il risultato finale nella tabella events quando disponibile
  useEffect(() => {
    if (finalScore && eventId && isOpen && timelineEvents.length > 0) {
      const matchResult = `${finalScore.home}-${finalScore.away}`
      
      // Verifica se il risultato è già salvato per evitare aggiornamenti inutili
      supabase
        .from('events')
        .select('match_result')
        .eq('id', eventId)
        .single()
        .then(({ data: currentEvent }) => {
          // Salva solo se il risultato è diverso o non esiste
          if (!currentEvent?.match_result || currentEvent.match_result !== matchResult) {
            supabase
              .from('events')
              .update({ match_result: matchResult })
              .eq('id', eventId)
              .then(({ error }) => {
                if (error) {
                  console.error('Errore nel salvataggio risultato partita:', error)
                } else {
                  console.log('✅ Risultato partita salvato automaticamente:', matchResult)
                }
              })
          }
        })
        .catch((error) => {
          console.error('Errore nel controllo risultato esistente:', error)
        })
    }
  }, [finalScore, eventId, isOpen, timelineEvents.length])
  const brandConfig = getBrandConfig()
  const homeTeamName = brandConfig.clubName || 'Brixia Rugby'
  const awayTeamName = eventDetails?.opponent || opponentName || 'Avversario'

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-navy text-white p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-white hover:text-gray-200 text-2xl font-bold z-10"
          >
            ×
          </button>
          
          {/* Informazioni Partita - allineate con la linea verticale centrale */}
          <div className="flex items-center relative">
            {/* Squadra di casa e punteggio - a sinistra */}
            <div className="flex items-center gap-4 flex-1 justify-end pr-16">
              {finalScore && (
                <div className="text-4xl font-bold text-white">{finalScore.home}</div>
              )}
              <div className="text-lg font-semibold text-white">{homeTeamName}</div>
            </div>
            
            {/* VS - centrato esattamente al 50% (allineato con la linea verticale) */}
            <div className="absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold text-white/80">
              VS
            </div>
            
            {/* Squadra avversaria e punteggio - a destra */}
            <div className="flex items-center gap-4 flex-1 justify-start pl-16">
              <div className="text-lg font-semibold text-white">{awayTeamName}</div>
              {finalScore && (
                <div className="text-4xl font-bold text-white">{finalScore.away}</div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-240px)] overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-lg">Caricamento eventi...</div>
            </div>
          ) : timelineEvents.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessun Evento Registrato</h3>
              <p className="text-gray-600">
                Non ci sono ancora eventi registrati per questa partita.
              </p>
            </div>
          ) : (
            <div className="relative" style={{ minHeight: '400px' }}>
              {/* Timeline verticale centrale */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-400 transform -translate-x-1/2 z-0"></div>

              {/* Eventi */}
              <div className="space-y-6">
                {timelineEvents.map((event, index) => {
                  const isHomeTeam = event.isHomeTeam
                  const bgColor = isHomeTeam ? 'bg-navy' : 'bg-red-600'
                  const textColor = isHomeTeam ? 'text-navy' : 'text-red-700'
                  
                  // Controlla se questo è il primo evento dopo il minuto 40 (fine primo tempo)
                  const isFirstEventAfterHalfTime = event.minute > 40 && 
                    (index === 0 || timelineEvents[index - 1].minute <= 40)
                  
                  return (
                    <>
                      {/* Linea fine primo tempo */}
                      {isFirstEventAfterHalfTime && (
                        <div key={`halftime-${index}`} className="relative flex items-center py-4">
                          {/* Linea orizzontale */}
                          <div className="absolute left-0 right-0 h-0.5 bg-gray-300 z-0"></div>
                          {/* Etichetta */}
                          <div className="absolute left-1/2 transform -translate-x-1/2 bg-white px-3 py-1 rounded-full border border-gray-300 z-10">
                            <span className="text-xs font-semibold text-gray-600">Fine Primo Tempo (40')</span>
                          </div>
                        </div>
                      )}
                      
                      <div key={index} className="relative flex items-center min-h-[60px]">
                      {/* Punto sulla timeline */}
                      <div className={`absolute left-1/2 w-4 h-4 ${isHomeTeam ? 'bg-navy' : 'bg-red-600'} rounded-full border-2 border-white z-10 transform -translate-x-1/2`}></div>

                      {/* Metà sinistra - Squadra di casa */}
                      <div className="w-1/2 pr-2 text-right">
                        {event.points > 0 && !isHomeTeam && event.opponentScoreAtTime !== undefined ? (
                          // Mostra punteggio squadra di casa quando segna l'avversario
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-12 bg-navy rounded-lg flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0">
                              <span className="text-white">{event.opponentScoreAtTime}</span>
                            </div>
                          </div>
                        ) : isHomeTeam ? (
                          // Contenuto evento squadra di casa
                          event.type === 'try_with_conversion' ? (
                            event.conversionPlayerName ? (
                              // Giocatori diversi: marcatore sopra, trasformatore sotto allineato a sinistra del marcatore
                              <div className="w-full flex justify-end">
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-sm font-semibold text-gray-700">{event.minute}'</span>
                                      <span className={`text-sm font-medium ${textColor}`}>
                                        {event.description}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-gray-700 opacity-0">{event.minute}'</span>
                                      <span className={`text-xs ${textColor}`}>
                                        {event.conversionPlayerName} (TR)
                                      </span>
                                    </div>
                                  </div>
                                  {event.points > 0 && (
                                    <div className="w-12 h-12 bg-navy rounded-lg flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0">
                                      <span className="text-white">{event.cumulativePoints}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              // Stesso giocatore: un solo nome con (M / TR)
                              <div className="w-full flex justify-end">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-700">{event.minute}'</span>
                                    <span className={`text-sm font-medium ${textColor}`}>
                                      {event.description}
                                    </span>
                                  </div>
                                  {event.points > 0 && (
                                    <div className="w-12 h-12 bg-navy rounded-lg flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0">
                                      <span className="text-white">{event.cumulativePoints}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          ) : (
                            // Altri eventi squadra di casa
                            <div className="w-full flex justify-end">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-700">{event.minute}'</span>
                                  <span className={`text-sm ${textColor}`}>{event.description}</span>
                                </div>
                                {event.points > 0 && (
                                  <div className="w-12 h-12 bg-navy rounded-lg flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0">
                                    <span className="text-white">{event.cumulativePoints}</span>
                                  </div>
                                )}
                                {event.type === 'yellow_card' && (
                                  <div className="w-10 h-10 bg-yellow-500 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-md">
                                    🟨
                                  </div>
                                )}
                                {event.type === 'red_card' && (
                                  <div className="w-10 h-10 bg-red-600 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-md">
                                    🟥
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        ) : null}
                      </div>

                      {/* Metà destra - Avversario */}
                      <div className="w-1/2 pl-2 text-left">
                        {event.points > 0 && isHomeTeam && event.opponentScoreAtTime !== undefined ? (
                          // Mostra punteggio avversario quando segna la squadra di casa
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0">
                              <span className="text-white">{event.opponentScoreAtTime}</span>
                            </div>
                          </div>
                        ) : !isHomeTeam && (
                          // Contenuto evento avversario
                          event.type === 'try_with_conversion' ? (
                            // Meta trasformata avversario - senza "Trasf."
                            <div className="flex items-center gap-2">
                              {event.points > 0 && (
                                <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0">
                                  <span className="text-white">{event.cumulativePoints}</span>
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-700">{event.minute}'</span>
                                  <span className={`text-sm ${textColor}`}>{event.description}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Altri eventi avversario
                            <div className="flex items-center gap-2">
                              {event.points > 0 && (
                                <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0">
                                  <span className="text-white">{event.cumulativePoints}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-700">{event.minute}'</span>
                                <span className={`text-sm ${textColor}`}>{event.description}</span>
                              </div>
                              {event.type === 'yellow_card' && (
                                <div className="w-10 h-10 bg-yellow-500 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-md">
                                  🟨
                                </div>
                              )}
                              {event.type === 'red_card' && (
                                <div className="w-10 h-10 bg-red-600 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-md">
                                  🟥
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    </>
                  )
                })}
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
  )
}
