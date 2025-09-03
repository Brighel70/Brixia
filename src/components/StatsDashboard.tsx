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
  
  // Statistiche Location
  locationStats: {
    brescia: number
    gussago: number
    ospitaletto: number
    trasferta: number
  }
  
  // Media presenze per sede
  locationAttendance: {
    brescia: number
    gussago: number
    ospitaletto: number
    trasferta: number
  }
  
  // Top Players
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
}

export default function StatsDashboard({ categoryId, categoryName }: StatsDashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [categoryId])

  const loadStats = async () => {
    try {
      setLoading(true)
      
      // Carica sessioni
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('category_id', categoryId)
        .order('session_date', { ascending: false })

      // Carica presenze
      const { data: attendance } = await supabase
        .from('attendance')
        .select(`
          *,
          sessions!inner(category_id),
          players(first_name, last_name)
        `)
        .eq('sessions.category_id', categoryId)

      // Carica giocatori
      const { data: players } = await supabase
        .from('players')
        .select('*')

      // Calcola statistiche
      const statsData = calculateStats(sessions || [], attendance || [], players || [])
      setStats(statsData)
    } catch (error) {
      console.error('Errore nel caricamento statistiche:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (sessions: any[], attendance: any[], players: any[]): StatsData => {
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

    // Statistiche location
    const locationStats = {
      brescia: 0,
      gussago: 0,
      ospitaletto: 0,
      trasferta: 0
    }

    // Media presenze per sede
    const locationAttendance = {
      brescia: 0,
      gussago: 0,
      ospitaletto: 0,
      trasferta: 0
    }

    const locationAttendanceCounts = {
      brescia: 0,
      gussago: 0,
      ospitaletto: 0,
      trasferta: 0
    }

    sessions.forEach(session => {
      switch (session.location) {
        case 'Brescia': locationStats.brescia++; break
        case 'Gussago': locationStats.gussago++; break
        case 'Ospitaletto': locationStats.ospitaletto++; break
        case 'Trasferta': locationStats.trasferta++; break
      }
    })

    // Calcola media presenze per sede
    sessions.forEach(session => {
      const sessionAttendance = attendance.filter(a => a.session_id === session.id)
      const presentCount = sessionAttendance.filter(a => a.status === 'PRESENTE').length
      const totalCount = sessionAttendance.length
      
      if (totalCount > 0) {
        const attendancePercentage = (presentCount / totalCount) * 100
        
        switch (session.location) {
          case 'Brescia': 
            locationAttendance.brescia += attendancePercentage
            locationAttendanceCounts.brescia++
            break
          case 'Gussago': 
            locationAttendance.gussago += attendancePercentage
            locationAttendanceCounts.gussago++
            break
          case 'Ospitaletto': 
            locationAttendance.ospitaletto += attendancePercentage
            locationAttendanceCounts.ospitaletto++
            break
          case 'Trasferta': 
            locationAttendance.trasferta += attendancePercentage
            locationAttendanceCounts.trasferta++
            break
        }
      }
    })

    // Calcola la media finale
    Object.keys(locationAttendance).forEach(location => {
      if (locationAttendanceCounts[location as keyof typeof locationAttendanceCounts] > 0) {
        locationAttendance[location as keyof typeof locationAttendance] = 
          Math.round(locationAttendance[location as keyof typeof locationAttendance] / 
          locationAttendanceCounts[location as keyof typeof locationAttendanceCounts])
      }
    })

    // Top players
    const playerStats = new Map()
    attendance.forEach(att => {
      const playerId = att.player_id
      const player = players.find(p => p.id === playerId)
      if (player) {
        const name = `${player.last_name} ${player.first_name}`
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

    return {
      totalSessions: sessions.length,
      totalPlayers: players.length,
      averageAttendance,
      monthlyTrend: monthlyData.length > 1 ? 
        Math.round(((monthlyData[monthlyData.length - 1].attendance - monthlyData[0].attendance) / monthlyData[0].attendance) * 100) : 0,
      attendanceBreakdown,
      locationStats,
      locationAttendance,
      topPlayers,
      monthlyData,
      predictions
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-6 shadow-lg animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Statistiche Principali */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header con Trend */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">📊 Dashboard {categoryName}</h2>
              <p className="text-blue-100">Analisi completa delle performance</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.averageAttendance}%</div>
              <div className="text-sm text-blue-100">Presenza Media</div>
              <div className={`text-sm ${stats.monthlyTrend >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                {stats.monthlyTrend >= 0 ? '↗️' : '↘️'} {Math.abs(stats.monthlyTrend)}% vs mese scorso
              </div>
            </div>
          </div>
        </div>

        {/* Grafico Presenze */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-4">📈 Distribuzione Presenze</h3>
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
                  <div className="text-2xl font-bold">{percentage}%</div>
                  <div className="text-sm text-gray-600 capitalize">{status}</div>
                  <div className="text-xs text-gray-400">{count} presenze</div>
                </div>
              )
            })}
          </div>
        </div>

                 {/* Top Players */}
         <div className="bg-white rounded-xl p-6 shadow-lg">
           <h3 className="text-lg font-semibold mb-4">🏆 Top Giocatori</h3>
           <div className="space-y-3">
             {stats.topPlayers.map((player, index) => (
               <div key={player.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                 <div className="flex items-center space-x-3">
                   <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                     {index + 1}
                   </div>
                   <span className="font-medium">{player.name}</span>
                 </div>
                 <div className="text-right">
                   <div className="text-lg font-bold text-green-600">{player.attendance}%</div>
                   <div className="text-xs text-gray-500">{player.sessions} sessioni</div>
                 </div>
               </div>
             ))}
           </div>
         </div>

         {/* Best Player Card */}
         <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 shadow-lg border border-yellow-200">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-semibold text-yellow-800">🏆 Best Player</h3>
             <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
               Top Performer
             </div>
           </div>
           
           {stats.topPlayers.length > 0 ? (
             <div className="space-y-4">
               {/* Player Info */}
               <div className="flex items-center space-x-4">
                 <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg">
                   {stats.topPlayers[0].name.split(' ').map(n => n[0]).join('')}
                 </div>
                 <div className="flex-1">
                   <h4 className="text-xl font-bold text-gray-800">{stats.topPlayers[0].name}</h4>
                   <p className="text-gray-600 text-sm">Categoria: {stats.topPlayers[0].category}</p>
                   <div className="flex items-center space-x-2 mt-1">
                     <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                     <span className="text-green-600 text-sm font-medium">
                       {stats.topPlayers[0].attendanceRate}% Presenze
                     </span>
                   </div>
                 </div>
               </div>
               
               {/* Player Stats */}
               <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white rounded-lg p-3 shadow-sm">
                   <div className="text-2xl font-bold text-blue-600">{stats.topPlayers[0].totalSessions}</div>
                   <div className="text-xs text-gray-600">Sessioni Totali</div>
                 </div>
                 <div className="bg-white rounded-lg p-3 shadow-sm">
                   <div className="text-2xl font-bold text-green-600">{stats.topPlayers[0].presentCount}</div>
                   <div className="text-xs text-gray-600">Presenze</div>
                 </div>
                 <div className="bg-white rounded-lg p-3 shadow-sm">
                   <div className="text-2xl font-bold text-orange-600">{stats.topPlayers[0].absentCount}</div>
                   <div className="text-xs text-gray-600">Assenze</div>
                 </div>
                 <div className="bg-white rounded-lg p-3 shadow-sm">
                   <div className="text-2xl font-bold text-purple-600">{stats.topPlayers[0].injuredCount}</div>
                   <div className="text-xs text-gray-600">Infortuni</div>
                 </div>
               </div>
               
               {/* Performance Badge */}
               <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg p-3 border border-yellow-200">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center space-x-2">
                     <span className="text-yellow-600">⭐</span>
                     <span className="text-sm font-medium text-yellow-800">Performance</span>
                   </div>
                   <div className="text-right">
                     <div className="text-lg font-bold text-yellow-700">
                       {stats.topPlayers[0].attendanceRate >= 90 ? 'Eccellente' :
                        stats.topPlayers[0].attendanceRate >= 80 ? 'Ottimo' :
                        stats.topPlayers[0].attendanceRate >= 70 ? 'Buono' : 'Da Migliorare'}
                     </div>
                     <div className="text-xs text-yellow-600">
                       {stats.topPlayers[0].attendanceRate}% di presenza
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           ) : (
             <div className="text-center py-8">
               <div className="text-gray-400 text-4xl mb-2">🏆</div>
               <p className="text-gray-500">Nessun dato disponibile</p>
             </div>
           )}
         </div>

         {/* Grafico Andamento Stagione */}
         <div className="bg-white rounded-xl p-6 shadow-lg">
           <h3 className="text-lg font-semibold mb-4">📈 Andamento Stagione</h3>
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

      {/* Sidebar Statistiche */}
      <div className="space-y-6">
                 {/* Statistiche Location */}
         <div className="bg-white rounded-xl p-6 shadow-lg">
           <h3 className="text-lg font-semibold mb-4">🏟️ Luoghi di Allenamento</h3>
           <div className="space-y-4">
             {Object.entries(stats.locationStats).map(([location, count]) => {
               const total = Object.values(stats.locationStats).reduce((a, b) => a + b, 0)
               const percentage = total > 0 ? Math.round((count / total) * 100) : 0
               const attendanceAvg = stats.locationAttendance[location as keyof typeof stats.locationAttendance]
               const icons = {
                 brescia: '🏟️',
                 gussago: '🌳',
                 ospitaletto: '🏃',
                 trasferta: '🚌'
               }
               
               return (
                 <div key={location} className="border-b border-gray-100 pb-3 last:border-b-0">
                   <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center space-x-2">
                       <span className="text-lg">{icons[location as keyof typeof icons]}</span>
                       <span className="capitalize font-medium">{location}</span>
                     </div>
                     <div className="text-right">
                       <div className="font-bold text-lg">{percentage}%</div>
                       <div className="text-xs text-gray-500">{count} sessioni</div>
                     </div>
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-sm text-gray-600">Media Presenze:</span>
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

        {/* Predizioni */}
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 text-white">
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
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-4">📊 Panoramica</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Sessioni Totali</span>
              <span className="font-bold">{stats.totalSessions}</span>
            </div>
            <div className="flex justify-between">
              <span>Giocatori</span>
              <span className="font-bold">{stats.totalPlayers}</span>
            </div>
            <div className="flex justify-between">
              <span>Presenza Media</span>
              <span className="font-bold text-green-600">{stats.averageAttendance}%</span>
            </div>
            <div className="flex justify-between">
              <span>Trend Mensile</span>
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
