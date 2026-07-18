import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface StatsData {
  // Statistiche Generali
  totalSessions: number
  totalPlayers: number
  averageAttendance: number
  monthlyTrend: number
  
  // Statistiche Presenze
  attendanceBreakdown: {
    presente: number
    assente: number
    infortunato: number
    permesso: number
    malato: number
  }
  
  // Statistiche Location (dinamiche per sede)
  locationStats: Record<string, number>
  locationAttendance: Record<string, number>
  
  // Statistiche Partite
  matchStats: {
    triesScored: number
    conversionsMade: number
    conversionsTotal: number
    conversionsPercentage: number
    dropGoals: number
    dropGoalsMade: number
    dropGoalsTotal: number
    dropGoalsPercentage: number
    pointsScored: number
    pointsConceded: number
    triesConceded: number
    dropGoalsConceded: number
    yellowCards: number
    redCards: number
    totalPlayersInMatches: number // Numero totale di giocatori entrati in campo (anche solo un minuto)
  }
  
  // Top Players per Punti
  topPlayersByPoints: Array<{
    playerId: string
    name: string
    points: number
    tries: number
    conversions: number
    dropGoals: number
  }>
  
  // Top Players per Minuti
  topPlayersByMinutes: Array<{
    playerId: string
    name: string
    minutes: number
  }>
  
  // Top Players per Presenze
  topPlayers: Array<{
    name: string
    attendance: number
    sessions: number
  }>
  
  // Trend Mensile
  monthlyData: Array<{
    month: string
    sessions: number
    attendance: number
  }>
  
  // Predizioni
  predictions: {
    nextMonthSessions: number
    expectedAttendance: number
    riskPlayers: string[]
  }
}

interface StatsDashboardProps {
  categoryId: string
  categoryName: string
  section: 'partite' | 'allenamenti'
}

export default function StatsDashboard({ categoryId, categoryName, section }: StatsDashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedMinutesTable, setExpandedMinutesTable] = useState(false)
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    loadStats()
  }, [categoryId])

  const loadStats = async () => {
    try {
      setLoading(true)
      
      // Carica sessioni della categoria
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('category_id', categoryId)
        .order('session_date', { ascending: false })

      const sessionIds = (sessions || []).map((s: any) => s.id)

      // Carica presenze solo per le sessioni di questa categoria
      let attendance: any[] = []
      if (sessionIds.length > 0) {
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .in('session_id', sessionIds)
        attendance = attendanceData || []
      }

      // Carica giocatori della categoria da people (player_categories contiene categoryId)
      let peopleInCategory: any[] = []
      const { data: peopleContain, error: peopleErr } = await supabase
        .from('people')
        .select('id, full_name, player_categories')
        .contains('player_categories', [categoryId])
      if (peopleErr) {
        const { data: allPeople } = await supabase.from('people').select('id, full_name, player_categories')
        peopleInCategory = (allPeople || []).filter((p: any) => {
          const cats = Array.isArray(p.player_categories) ? p.player_categories : (() => { try { return JSON.parse(p.player_categories || '[]') } catch { return [] } })()
          return cats.includes(categoryId)
        })
      } else {
        peopleInCategory = peopleContain || []
      }

      const players = peopleInCategory.map((p: any) => ({
        id: p.id,
        first_name: p.full_name?.trim().split(/\s+/).slice(-1)[0] || '',
        last_name: p.full_name?.trim().split(/\s+/).slice(0, -1).join(' ') || p.full_name || '',
        full_name: p.full_name || ''
      }))

      // Carica eventi (partite) per statistiche partite
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('category_id', categoryId)
        .eq('event_type', 'partita')
        .eq('is_championship', true)

      setEvents(eventsData || [])

      // Carica match_lists per calcolare giocatori entrati in campo
      const { data: matchLists } = await supabase
        .from('match_lists')
        .select('id, selected_players')
        .eq('category_id', categoryId)
        .eq('type', 'match')

      // Carica statistiche partite
      const matchListIds = matchLists?.map(ml => ml.id) || []
      const { data: matchStatistics } = matchListIds.length > 0 ? await supabase
        .from('match_statistics')
        .select(`
          *,
          people!match_statistics_player_id_fkey(id, first_name, last_name)
        `)
        .in('match_list_id', matchListIds) : { data: null }

      // Calcola statistiche
      const statsData = calculateStats(
        sessions || [], 
        attendance || [], 
        players || [], 
        eventsData || [], 
        categoryId, 
        matchLists || [],
        matchStatistics || []
      )
      setStats(statsData)
    } catch (error) {
      console.error('Errore nel caricamento statistiche:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (sessions: any[], attendance: any[], players: any[], events: any[], categoryId: string, matchLists: any[], matchStatistics: any[]): StatsData => {
    // Statistiche presenze
    const attendanceBreakdown = {
      presente: 0,
      assente: 0,
      infortunato: 0,
      permesso: 0,
      malato: 0
    }

    attendance.forEach(att => {
      switch (att.status) {
        case 'PRESENTE': attendanceBreakdown.presente++; break
        case 'ASSENTE': attendanceBreakdown.assente++; break
        case 'INFORTUNATO': attendanceBreakdown.infortunato++; break
        case 'PERMESSO': attendanceBreakdown.permesso++; break
        case 'MALATO': attendanceBreakdown.malato++; break
      }
    })

    const locationStats: Record<string, number> = {}
    const locationAttendance: Record<string, number> = {}
    const locationAttendanceCounts: Record<string, number> = {}

    sessions.forEach(session => {
      const key = session.location || 'Sconosciuto'
      locationStats[key] = (locationStats[key] || 0) + 1
    })

    sessions.forEach(session => {
      const sessionAttendance = attendance.filter(a => a.session_id === session.id)
      const presentCount = sessionAttendance.filter(a => a.status === 'PRESENTE').length
      const totalCount = sessionAttendance.length
      
      if (totalCount > 0) {
        const attendancePercentage = (presentCount / totalCount) * 100
        const key = session.location || 'Sconosciuto'
        locationAttendance[key] = (locationAttendance[key] || 0) + attendancePercentage
        locationAttendanceCounts[key] = (locationAttendanceCounts[key] || 0) + 1
      }
    })

    Object.keys(locationAttendance).forEach(location => {
      if (locationAttendanceCounts[location] > 0) {
        locationAttendance[location] = Math.round(locationAttendance[location] / locationAttendanceCounts[location])
      }
    })

    // Calcola statistiche partite dai dati reali
    let totalTries = 0
    let totalConversions = 0
    let totalDropGoals = 0
    let totalYellowCards = 0
    let totalRedCards = 0
    let pointsScoredFromResults = 0
    let pointsConcededFromResults = 0
    const uniquePlayersInMatches = new Set<string>()
    
    // Calcola numero totale di giocatori entrati in campo (anche solo un minuto)
    matchLists.forEach((list: any) => {
      if (list.selected_players && Array.isArray(list.selected_players)) {
        list.selected_players.forEach((player: any) => {
          const playerId = player?.player_id || player?.id || player
          if (playerId) {
            uniquePlayersInMatches.add(playerId)
          }
        })
      }
    })

    // Aggrega statistiche da match_statistics
    matchStatistics.forEach((stat: any) => {
      totalTries += stat.tries || 0
      totalConversions += stat.conversions || 0
      totalDropGoals += stat.drop_goals || 0
      totalYellowCards += stat.yellow_cards || 0
      totalRedCards += stat.red_cards || 0
    })

    events.forEach((event: any) => {
      const match = String(event.match_result || '').trim().match(/^(\d+)\s*[-–]\s*(\d+)$/)
      if (!match) return

      const homeScore = Number(match[1])
      const awayScore = Number(match[2])
      pointsScoredFromResults += event.is_home ? homeScore : awayScore
      pointsConcededFromResults += event.is_home ? awayScore : homeScore
    })

    // Calcola trasformazioni totali (assumiamo che ogni meta possa avere una trasformazione)
    const conversionsTotal = totalTries
    const conversionsPercentage = conversionsTotal > 0 ? Math.round((totalConversions / conversionsTotal) * 100) : 0

    // Calcola piazzati totali (assumiamo che ogni piazzato segnato sia anche tentato)
    const dropGoalsTotal = totalDropGoals
    const dropGoalsPercentage = dropGoalsTotal > 0 ? Math.round((totalDropGoals / dropGoalsTotal) * 100) : 0
    
    const matchStats = {
      triesScored: totalTries,
      conversionsMade: totalConversions,
      conversionsTotal: conversionsTotal,
      conversionsPercentage: conversionsPercentage,
      dropGoals: totalDropGoals,
      dropGoalsMade: totalDropGoals,
      dropGoalsTotal: dropGoalsTotal,
      dropGoalsPercentage: dropGoalsPercentage,
      pointsScored: pointsScoredFromResults,
      pointsConceded: pointsConcededFromResults,
      triesConceded: 0, // Da calcolare quando avremo i dati delle partite avversarie
      dropGoalsConceded: 0, // Da calcolare quando avremo i dati delle partite avversarie
      yellowCards: totalYellowCards,
      redCards: totalRedCards,
      totalPlayersInMatches: uniquePlayersInMatches.size
    }

    // Top players per punti dai dati reali
    const playerPointsMap = new Map<string, {
      playerId: string
      name: string
      points: number
      tries: number
      conversions: number
      dropGoals: number
    }>()

    matchStatistics.forEach((stat: any) => {
      const playerId = stat.player_id
      const player = stat.people
      const name = player ? `${player.last_name} ${player.first_name}` : 'Giocatore sconosciuto'
      
      if (!playerPointsMap.has(playerId)) {
        playerPointsMap.set(playerId, {
          playerId,
          name,
          points: 0,
          tries: 0,
          conversions: 0,
          dropGoals: 0
        })
      }
      
      const playerData = playerPointsMap.get(playerId)!
      playerData.tries += stat.tries || 0
      playerData.conversions += stat.conversions || 0
      playerData.dropGoals += stat.drop_goals || 0
      playerData.points = (playerData.tries * 5) + (playerData.conversions * 2) + (playerData.dropGoals * 3)
    })

    let topPlayersByPoints: Array<{
      playerId: string
      name: string
      points: number
      tries: number
      conversions: number
      dropGoals: number
    }> = Array.from(playerPointsMap.values())
    
    // Ordina decrescente per punti, in caso di parità per mete
    topPlayersByPoints = topPlayersByPoints.sort((a, b) => {
      // Ordina decrescente per punti
      if (b.points !== a.points) {
        return b.points - a.points
      }
      // In caso di parità, premia chi ha più mete
      return b.tries - a.tries
    }).slice(0, 10)

    // Top players per minuti dai dati reali
    const playerMinutesMap = new Map<string, {
      playerId: string
      name: string
      minutes: number
    }>()

    matchStatistics.forEach((stat: any) => {
      const playerId = stat.player_id
      const player = stat.people
      const name = player ? `${player.last_name} ${player.first_name}` : 'Giocatore sconosciuto'
      
      if (!playerMinutesMap.has(playerId)) {
        playerMinutesMap.set(playerId, {
          playerId,
          name,
          minutes: 0
        })
      }
      
      const playerData = playerMinutesMap.get(playerId)!
      playerData.minutes += stat.minutes_played || 0
    })

    const topPlayersByMinutes: Array<{
      playerId: string
      name: string
      minutes: number
    }> = Array.from(playerMinutesMap.values())
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10)

    // Top players per presenze (solo giocatori della categoria)
    const playerStats = new Map()
    attendance.forEach(att => {
      const playerId = att.player_id
      const player = players.find(p => p.id === playerId)
      if (player) {
        const name = player.full_name || `${player.last_name} ${player.first_name}`.trim() || '—'
        if (!playerStats.has(playerId)) {
          playerStats.set(playerId, { name, presente: 0, totale: 0 })
        }
        const stats = playerStats.get(playerId)
        stats.totale++
        if (att.status === 'PRESENTE') stats.presente++
      }
    })

    const topPlayers = Array.from(playerStats.values())
      .map(p => ({
        name: p.name,
        attendance: Math.round((p.presente / p.totale) * 100),
        sessions: p.totale
      }))
      .sort((a, b) => b.attendance - a.attendance)
      .slice(0, 5)

    // Calcoli avanzati
    const totalAttendance = attendance.length
    const averageAttendance = totalAttendance > 0 ? 
      Math.round((attendanceBreakdown.presente / totalAttendance) * 100) : 0

    // Trend mensile (ultimi 6 mesi)
    const monthlyData = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = date.toLocaleDateString('it-IT', { month: 'short' })
      
      const monthSessions = sessions.filter(s => {
        const sessionDate = new Date(s.session_date)
        return sessionDate.getMonth() === date.getMonth() && 
               sessionDate.getFullYear() === date.getFullYear()
      }).length

      const monthAttendance = attendance.filter(a => {
        const session = sessions.find(s => s.id === a.session_id)
        if (!session) return false
        const sessionDate = new Date(session.session_date)
        return sessionDate.getMonth() === date.getMonth() && 
               sessionDate.getFullYear() === date.getFullYear()
      }).length

      monthlyData.push({
        month: monthName,
        sessions: monthSessions,
        attendance: monthAttendance
      })
    }

    // Predizioni (semplificate)
    const recentSessions = sessions.slice(0, 10)
    const avgRecentAttendance = recentSessions.length > 0 ? 
      recentSessions.reduce((sum, s) => {
        const sessionAttendance = attendance.filter(a => a.session_id === s.id)
        return sum + (sessionAttendance.filter(a => a.status === 'PRESENTE').length / sessionAttendance.length || 0)
      }, 0) / recentSessions.length : 0

    const predictions = {
      nextMonthSessions: Math.round(sessions.length / 6), // Media mensile
      expectedAttendance: Math.round(avgRecentAttendance * 100),
      riskPlayers: topPlayers.filter(p => p.attendance < 60).map(p => p.name)
    }

    const monthlyTrendValue = monthlyData.length > 1 && monthlyData[0].attendance > 0
      ? Math.round(((monthlyData[monthlyData.length - 1].attendance - monthlyData[0].attendance) / monthlyData[0].attendance) * 100)
      : 0

    return {
      totalSessions: sessions.length,
      totalPlayers: players.length,
      averageAttendance,
      monthlyTrend: monthlyTrendValue,
      attendanceBreakdown,
      locationStats,
      locationAttendance,
      matchStats,
      topPlayersByPoints,
      topPlayersByMinutes,
      topPlayers,
      monthlyData,
      predictions
    }
  }

  if (loading) {
    return (
      <div className="w-full p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-lg animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return null

  // Sezione Partite
  if (section === 'partite') {
    return (
      <div className="w-full">
        {/* Prima Riga: Statistiche Partite */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Mete Segnate */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500 text-gray-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Mete Segnate</h3>
            <span className="text-2xl">🏉</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.matchStats.triesScored === 0 ? '-' : stats.matchStats.triesScored}
          </div>
        </div>

        {/* Trasformazioni */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Trasformazioni</h3>
            <span className="text-2xl">🏉</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.matchStats.conversionsTotal === 0 ? '-' : 
             `${stats.matchStats.conversionsMade}/${stats.matchStats.conversionsTotal} (${stats.matchStats.conversionsPercentage}%)`}
          </div>
        </div>

        {/* Piazzati */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Piazzati</h3>
            <span className="text-2xl">🎯</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.matchStats.dropGoalsTotal === 0 ? '-' : 
             `${stats.matchStats.dropGoalsMade}/${stats.matchStats.dropGoalsTotal} (${stats.matchStats.dropGoalsPercentage}%)`}
          </div>
        </div>

        {/* Punti Fatti */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Punti Fatti</h3>
            <span className="text-2xl">⭐</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.matchStats.pointsScored === 0 ? '-' : stats.matchStats.pointsScored}
          </div>
        </div>
      </div>

      {/* Seconda Riga: Statistiche Difensive e Cartellini */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Punti Subiti */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Punti Subiti</h3>
            <span className="text-2xl">🛡️</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.matchStats.pointsConceded === 0 ? '-' : stats.matchStats.pointsConceded}
          </div>
        </div>

        {/* Mete Subite */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Mete Subite</h3>
            <span className="text-2xl">🚫</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.matchStats.triesConceded === 0 ? '-' : stats.matchStats.triesConceded}
          </div>
        </div>

        {/* Piazzati Subiti */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-pink-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Piazzati Subiti</h3>
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.matchStats.dropGoalsConceded === 0 ? '-' : stats.matchStats.dropGoalsConceded}
          </div>
        </div>

        {/* Cartellini Gialli */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-400">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Cartellini Gialli</h3>
            <span className="text-2xl">🟨</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.matchStats.yellowCards === 0 ? '-' : stats.matchStats.yellowCards}
          </div>
        </div>
      </div>

      {/* Terza Riga: Cartellini Rossi e altre statistiche */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Cartellini Rossi */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-red-600">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Cartellini Rossi</h3>
            <span className="text-2xl">🟥</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.matchStats.redCards === 0 ? '-' : stats.matchStats.redCards}
          </div>
        </div>

        {/* Differenza Punti */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Differenza Punti</h3>
            <span className="text-2xl">📊</span>
          </div>
          <div className={`text-3xl font-bold ${
            (stats.matchStats.pointsScored - stats.matchStats.pointsConceded) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {stats.matchStats.pointsScored === 0 && stats.matchStats.pointsConceded === 0 ? '-' : 
             (stats.matchStats.pointsScored - stats.matchStats.pointsConceded) >= 0 ? '+' : ''}
            {stats.matchStats.pointsScored === 0 && stats.matchStats.pointsConceded === 0 ? '' : 
             stats.matchStats.pointsScored - stats.matchStats.pointsConceded}
          </div>
        </div>

        {/* Media Punti/Partita */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-teal-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Media Punti/Partita</h3>
            <span className="text-2xl">📈</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.matchStats.pointsScored === 0 ? '-' : 
             Math.round(stats.matchStats.pointsScored / Math.max(events.filter(e => e.match_result && e.match_result.trim() !== '').length || 1, 1) * 10) / 10}
          </div>
        </div>

        {/* Partite Giocate */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-cyan-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Partite Giocate</h3>
            <span className="text-2xl">🏉</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {events.filter((e: any) => e.match_result && e.match_result.trim() !== '').length === 0 ? '-' : 
             events.filter((e: any) => e.match_result && e.match_result.trim() !== '').length}
          </div>
        </div>
      </div>

      {/* Quarta Riga: Tabelle Top 10 Giocatori */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top 10 Giocatori per Punti */}
        <div className="bg-white rounded-xl p-6 shadow-lg text-gray-900">
          <h3 className="text-xl font-semibold mb-4 text-gray-900">🏆 Top 10 Giocatori - Punti</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">#</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Giocatore</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Punti</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Mete</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Tras. Piaz.</th>
                </tr>
              </thead>
              <tbody>
                {stats.topPlayersByPoints.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      Nessun dato disponibile
                    </td>
                  </tr>
                ) : (
                  stats.topPlayersByPoints.slice(0, 10).map((player, index) => (
                    <tr key={player.playerId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 ? 'bg-yellow-400 text-yellow-900' :
                          index === 1 ? 'bg-gray-300 text-gray-700' :
                          index === 2 ? 'bg-orange-300 text-orange-900' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">{player.name}</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-600">{player.points}</td>
                      <td className="py-3 px-4 text-center text-gray-900">{player.tries}</td>
                      <td className="py-3 px-4 text-center text-gray-900">{player.conversions + player.dropGoals}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 Giocatori per Minuti */}
        <div className="bg-white rounded-xl p-6 shadow-lg text-gray-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">⏱️ Top 10 Giocatori - Minuti</h3>
            <button
              onClick={() => setExpandedMinutesTable(!expandedMinutesTable)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {expandedMinutesTable ? 'Riduci' : 'Espandi'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">#</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Giocatore</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Minuti</th>
                </tr>
              </thead>
              <tbody>
                {stats.topPlayersByMinutes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-gray-500">
                      Nessun dato disponibile
                    </td>
                  </tr>
                ) : (
                  (expandedMinutesTable ? stats.topPlayersByMinutes : stats.topPlayersByMinutes.slice(0, 10))
                    .map((player, index) => (
                      <tr key={player.playerId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0 ? 'bg-yellow-400 text-yellow-900' :
                            index === 1 ? 'bg-gray-300 text-gray-700' :
                            index === 2 ? 'bg-orange-300 text-orange-900' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">{player.name}</td>
                        <td className="py-3 px-4 text-center font-bold text-green-600">{player.minutes}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    )
  }

  // Sezione Allenamenti
  return (
    <div className="w-full">
      {/* Prima Riga: Statistiche Generali Allenamenti */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Sessioni Totali */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500 text-gray-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Sessioni Totali</h3>
            <span className="text-2xl">📅</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.totalSessions === 0 ? '-' : stats.totalSessions}
          </div>
        </div>

        {/* Presenza Media */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500 text-gray-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Presenza Media</h3>
            <span className="text-2xl">✅</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.averageAttendance === 0 ? '-' : `${stats.averageAttendance}%`}
          </div>
        </div>

        {/* Giocatori Totali */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-purple-500 text-gray-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Giocatori Totali</h3>
            <span className="text-2xl">👥</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.totalPlayers === 0 ? '-' : stats.totalPlayers}
          </div>
        </div>

        {/* Trend Mensile */}
        <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-500 text-gray-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Trend Mensile</h3>
            <span className="text-2xl">📈</span>
          </div>
          <div className={`text-3xl font-bold ${stats.monthlyTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.monthlyTrend === 0 ? '-' : 
             `${stats.monthlyTrend >= 0 ? '+' : ''}${stats.monthlyTrend}%`}
          </div>
        </div>
      </div>

      {/* Seconda Riga: Distribuzione Presenze e Luoghi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Grafico Presenze */}
        <div className="bg-white rounded-xl p-6 shadow-lg text-gray-900">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">📈 Distribuzione Presenze</h3>
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(stats.attendanceBreakdown).map(([status, count]) => {
              const total = Object.values(stats.attendanceBreakdown).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? Math.round((count / total) * 100) : 0
              const colors = {
                presente: 'bg-green-500',
                assente: 'bg-red-500',
                infortunato: 'bg-orange-500',
                permesso: 'bg-blue-500',
                malato: 'bg-purple-500'
              }
              const icons = {
                presente: '✅',
                assente: '❌',
                infortunato: '🏥',
                permesso: '📋',
                malato: '🤒'
              }
              
              return (
                <div key={status} className="text-center">
                  <div className={`w-16 h-16 ${colors[status as keyof typeof colors]} rounded-full flex items-center justify-center text-white text-2xl mx-auto mb-2`}>
                    {icons[status as keyof typeof icons]}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{percentage}%</div>
                  <div className="text-sm text-gray-700 capitalize">{status}</div>
                  <div className="text-xs text-gray-600">{count} presenze</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Statistiche Location */}
        <div className="bg-white rounded-xl p-6 shadow-lg text-gray-900">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">🏟️ Luoghi di Allenamento</h3>
          <div className="space-y-4">
            {Object.entries(stats.locationStats).map(([location, count]) => {
              const total = Object.values(stats.locationStats).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? Math.round((count / total) * 100) : 0
              const attendanceAvg = stats.locationAttendance[location] ?? 0
              const icons: Record<string, string> = {
                Trasferta: '🚌',
              }
              
              return (
                <div key={location} className="border-b border-gray-100 pb-3 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{icons[location] ?? '🏟️'}</span>
                      <span className="font-medium text-gray-900">{location}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-gray-900">{percentage}%</div>
                      <div className="text-xs text-gray-600">{count} sessioni</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Media Presenze:</span>
                    <div className="flex items-center space-x-2">
                      <div className={`font-bold text-sm ${
                        attendanceAvg >= 80 ? 'text-green-600' : 
                        attendanceAvg >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {attendanceAvg}%
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        attendanceAvg >= 80 ? 'bg-green-500' : 
                        attendanceAvg >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Terza Riga: Top Giocatori per Presenze */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Players per Presenze */}
        <div className="bg-white rounded-xl p-6 shadow-lg text-gray-900">
          <h3 className="text-xl font-semibold mb-4 text-gray-900">🏆 Top 10 Giocatori - Presenze</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">#</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Giocatore</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Presenza %</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Sessioni</th>
                </tr>
              </thead>
              <tbody>
                {stats.topPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      Nessun dato disponibile
                    </td>
                  </tr>
                ) : (
                  stats.topPlayers.slice(0, 10).map((player, index) => (
                    <tr key={player.name} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 ? 'bg-yellow-400 text-yellow-900' :
                          index === 1 ? 'bg-gray-300 text-gray-700' :
                          index === 2 ? 'bg-orange-300 text-orange-900' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">{player.name}</td>
                      <td className="py-3 px-4 text-center font-bold text-green-600">{player.attendance}%</td>
                      <td className="py-3 px-4 text-center text-gray-900">{player.sessions}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grafico Andamento Stagione */}
        <div className="bg-white rounded-xl p-6 shadow-lg text-gray-900">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">📈 Andamento Stagione</h3>
          <div className="h-64 relative">
            <svg className="w-full h-full" viewBox="0 0 400 200">
              {/* Griglia di sfondo */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Linea del grafico */}
              {stats.monthlyData.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={stats.monthlyData.map((month, index) => {
                    const x = (index / (stats.monthlyData.length - 1)) * 360 + 20
                    const maxAttendance = Math.max(...stats.monthlyData.map(m => m.attendance))
                    const y = maxAttendance > 0 ? 180 - (month.attendance / maxAttendance) * 160 : 180
                    return `${x},${y}`
                  }).join(' ')}
                />
              )}
              
              {/* Punti del grafico */}
              {stats.monthlyData.map((month, index) => {
                const x = (index / (stats.monthlyData.length - 1)) * 360 + 20
                const maxAttendance = Math.max(...stats.monthlyData.map(m => m.attendance))
                const y = maxAttendance > 0 ? 180 - (month.attendance / maxAttendance) * 160 : 180
                const isLatest = index === stats.monthlyData.length - 1
                
                return (
                  <g key={month.month}>
                    {/* Punto del grafico */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isLatest ? "6" : "4"}
                      fill={isLatest ? "#1d4ed8" : "#3b82f6"}
                      stroke="white"
                      strokeWidth="2"
                    />
                    
                    {/* Tooltip al hover */}
                    <g className="opacity-0 hover:opacity-100 transition-opacity">
                      <rect
                        x={x - 30}
                        y={y - 40}
                        width="60"
                        height="30"
                        fill="#1f2937"
                        rx="4"
                      />
                      <text
                        x={x}
                        y={y - 20}
                        textAnchor="middle"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {month.attendance}
                      </text>
                    </g>
                  </g>
                )
              })}
              
              {/* Etichette dei mesi */}
              {stats.monthlyData.map((month, index) => {
                const x = (index / (stats.monthlyData.length - 1)) * 360 + 20
                return (
                  <text
                    key={`label-${month.month}`}
                    x={x}
                    y="195"
                    textAnchor="middle"
                    fill="#6b7280"
                    fontSize="10"
                    fontWeight="500"
                  >
                    {month.month}
                  </text>
                )
              })}
              
              {/* Etichette Y (valori) */}
              {[0, 25, 50, 75, 100].map(value => {
                const y = 180 - (value / 100) * 160
                return (
                  <g key={value}>
                    <line x1="15" y1={y} x2="20" y2={y} stroke="#d1d5db" strokeWidth="1"/>
                    <text x="10" y={y + 3} textAnchor="end" fill="#9ca3af" fontSize="8">
                      {value}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Presenze Mensili</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-800 rounded-full"></div>
                  <span className="text-gray-600">Mese Corrente</span>
                </div>
              </div>
              <div className="text-gray-500">
                Ultimi 6 mesi
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quarta Riga: Predizioni e Panoramica */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Predizioni */}
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 text-white shadow-lg">
          <h3 className="text-lg font-semibold mb-4">🔮 Predizioni</h3>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-purple-100">Prossimo Mese</div>
              <div className="text-xl font-bold">{stats.predictions.nextMonthSessions} sessioni previste</div>
            </div>
            <div>
              <div className="text-sm text-purple-100">Presenza Attesa</div>
              <div className="text-xl font-bold">{stats.predictions.expectedAttendance}%</div>
            </div>
            {stats.predictions.riskPlayers.length > 0 && (
              <div>
                <div className="text-sm text-purple-100">⚠️ Attenzione</div>
                <div className="text-sm">
                  {stats.predictions.riskPlayers.slice(0, 2).join(', ')}
                  {stats.predictions.riskPlayers.length > 2 && '...'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Statistiche Generali */}
        <div className="bg-white rounded-xl p-6 shadow-lg text-gray-900">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">📊 Panoramica</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-800">Sessioni Totali</span>
              <span className="font-bold text-gray-900">{stats.totalSessions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-800">Giocatori</span>
              <span className="font-bold text-gray-900">{stats.totalPlayers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-800">Presenza Media</span>
              <span className="font-bold text-green-600">{stats.averageAttendance}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-800">Trend Mensile</span>
              <span className={`font-bold ${stats.monthlyTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.monthlyTrend >= 0 ? '↗️' : '↘️'} {Math.abs(stats.monthlyTrend)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
