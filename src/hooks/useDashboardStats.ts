import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface DashboardStats {
  // Statistiche persone
  totalPeople: number
  totalPlayers: number
  totalStaff: number
  minors: number
  adults: number
  
  // Statistiche presenze
  todayAttendance: {
    total: number
    present: number
    absent: number
    percentage: number
  }
  
  // Statistiche quote
  feesStats: {
    totalFees: number
    pendingFees: number
    paidFees: number
    overdueFees: number
    totalAmount: number
    pendingAmount: number
    paidAmount: number
  }
  
  // Statistiche eventi
  upcomingEvents: number
  thisWeekEvents: number
  
  // Alert e notifiche
  alerts: {
    expiredConsents: number
    expiringCertificates: number
    minorsWithoutGuardian: number
    missingDocuments: number
    overdueFees: number
  }
  
  // Dati per grafici
  attendanceTrend: Array<{
    date: string
    percentage: number
  }>
  
  feesByCategory: Array<{
    category: string
    amount: number
    count: number
  }>
  
  playersByCategory: Array<{
    category: string
    count: number
  }>
  
  playersByOriginClub: Array<{
    originClub: string
    count: number
  }>
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)

      // Carica tutte le statistiche in parallelo
      const [
        peopleStats,
        playersStats,
        staffStats,
        attendanceStats,
        feesStats,
        eventsStats,
        alertsStats,
        attendanceTrendData,
        feesByCategoryData,
        playersByCategoryData,
        playersByOriginClubData
      ] = await Promise.all([
        // Statistiche persone
        Promise.all([
          supabase.from('people').select('*', { count: 'exact', head: true }),
          supabase.from('people').select('*', { count: 'exact', head: true }).eq('is_minor', true),
          supabase.from('people').select('*', { count: 'exact', head: true }).eq('is_minor', false)
        ]),
        
        // Statistiche giocatori: solo persone con ruolo Giocatore (is_player = true)
        supabase.from('people').select('*', { count: 'exact', head: true }).eq('is_player', true),
        
        // Statistiche staff - Conta le persone con is_staff = true
        supabase.from('people').select('*', { count: 'exact', head: true }).eq('is_staff', true),
        
        // Statistiche presenze di oggi
        loadTodayAttendance(),
        
        // Statistiche quote
        loadFeesStats(),
        
        // Statistiche eventi
        loadEventsStats(),
        
        // Alert e notifiche
        loadAlertsStats(),
        
        // Dati per grafici
        loadAttendanceTrend(),
        loadFeesByCategory(),
        loadPlayersByCategory(),
        loadPlayersByOriginClub()
      ])

      // Calcola statistiche persone
      const totalPeople = peopleStats[0].count || 0
      const minors = peopleStats[1].count || 0
      const adults = peopleStats[2].count || 0
      const totalPlayers = playersStats.count || 0
      const totalStaff = staffStats.count || 0

      setStats({
        totalPeople,
        totalPlayers,
        totalStaff,
        minors,
        adults,
        todayAttendance: attendanceStats,
        feesStats: feesStats,
        upcomingEvents: eventsStats.upcoming,
        thisWeekEvents: eventsStats.thisWeek,
        alerts: alertsStats,
        attendanceTrend: attendanceTrendData,
        feesByCategory: feesByCategoryData,
        playersByCategory: playersByCategoryData,
        playersByOriginClub: playersByOriginClubData
      })

    } catch (err) {
      console.error('Errore nel caricamento statistiche dashboard:', err)
      setError('Errore nel caricamento delle statistiche')
    } finally {
      setLoading(false)
    }
  }

  // Carica presenze di oggi
  const loadTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('session_date', today)

      if (!sessions || sessions.length === 0) {
        return { total: 0, present: 0, absent: 0, percentage: 0 }
      }

      const sessionIds = sessions.map(s => s.id)
      
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status')
        .in('session_id', sessionIds)

      const total = attendance?.length || 0
      const present = attendance?.filter(a => a.status === 'PRESENTE').length || 0
      const absent = total - present
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0

      return { total, present, absent, percentage }
    } catch (error) {
      console.error('Errore nel caricamento presenze:', error)
      return { total: 0, present: 0, absent: 0, percentage: 0 }
    }
  }

  // Carica statistiche quote
  const loadFeesStats = async () => {
    try {
      const { data: assignments } = await supabase
        .from('fee_assignments')
        .select('amount, status')

      if (!assignments) {
        return {
          totalFees: 0,
          pendingFees: 0,
          paidFees: 0,
          overdueFees: 0,
          totalAmount: 0,
          pendingAmount: 0,
          paidAmount: 0
        }
      }

      const totalFees = assignments.length
      const pendingFees = assignments.filter(a => a.status === 'pending').length
      const paidFees = assignments.filter(a => a.status === 'paid').length
      const overdueFees = assignments.filter(a => a.status === 'overdue').length

      const totalAmount = assignments.reduce((sum, a) => sum + a.amount, 0)
      const pendingAmount = assignments
        .filter(a => a.status === 'pending')
        .reduce((sum, a) => sum + a.amount, 0)
      const paidAmount = assignments
        .filter(a => a.status === 'paid')
        .reduce((sum, a) => sum + a.amount, 0)

      return {
        totalFees,
        pendingFees,
        paidFees,
        overdueFees,
        totalAmount,
        pendingAmount,
        paidAmount
      }
    } catch (error) {
      console.error('Errore nel caricamento statistiche quote:', error)
      return {
        totalFees: 0,
        pendingFees: 0,
        paidFees: 0,
        overdueFees: 0,
        totalAmount: 0,
        pendingAmount: 0,
        paidAmount: 0
      }
    }
  }

  // Carica statistiche eventi
  const loadEventsStats = async () => {
    try {
      const today = new Date()
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      
      const { count: upcoming } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('event_date', today.toISOString().split('T')[0])

      const { count: thisWeek } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('event_date', today.toISOString().split('T')[0])
        .lte('event_date', nextWeek.toISOString().split('T')[0])

      return {
        upcoming: upcoming || 0,
        thisWeek: thisWeek || 0
      }
    } catch (error) {
      console.error('Errore nel caricamento statistiche eventi:', error)
      return { upcoming: 0, thisWeek: 0 }
    }
  }

  // Carica alert e notifiche
  const loadAlertsStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: assignments } = await supabase
        .from('fee_assignments')
        .select('id, status, due_date')

      // Conta le rate scadute: status='overdue' O (non pagate e due_date < oggi)
      const overdueFees = (assignments || []).filter(a => {
        if (a.status === 'paid' || a.status === 'cancelled') return false
        if (a.status === 'overdue') return true
        return a.due_date && a.due_date < today
      }).length

      return {
        expiredConsents: 0,
        expiringCertificates: 0,
        minorsWithoutGuardian: 0,
        missingDocuments: 0,
        overdueFees
      }
    } catch (error) {
      console.error('Errore nel caricamento alert:', error)
      return {
        expiredConsents: 0,
        expiringCertificates: 0,
        minorsWithoutGuardian: 0,
        missingDocuments: 0,
        overdueFees: 0
      }
    }
  }

  // Carica trend presenze (ultimi 7 giorni)
  const loadAttendanceTrend = async () => {
    try {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - i)
        return date.toISOString().split('T')[0]
      }).reverse()

      const trendData = await Promise.all(
        last7Days.map(async (date) => {
          try {
            // Carica presenze per la data specifica, non sempre oggi
            const attendance = await loadAttendanceForDate(date)
            return {
              date: new Date(date).toLocaleDateString('it-IT', { 
                weekday: 'short', 
                day: 'numeric' 
              }),
              percentage: attendance.percentage || 0
            }
          } catch (error) {
            console.error(`Errore per data ${date}:`, error)
            return {
              date: new Date(date).toLocaleDateString('it-IT', { 
                weekday: 'short', 
                day: 'numeric' 
              }),
              percentage: 0
            }
          }
        })
      )

      return trendData.filter(item => item && typeof item.percentage === 'number' && !isNaN(item.percentage))
    } catch (error) {
      console.error('Errore nel caricamento trend presenze:', error)
      return []
    }
  }

  // Carica presenze per una data specifica
  const loadAttendanceForDate = async (date: string) => {
    try {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('session_date', date)

      if (!sessions || sessions.length === 0) {
        return { total: 0, present: 0, absent: 0, percentage: 0 }
      }

      const sessionIds = sessions.map(s => s.id)
      
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status')
        .in('session_id', sessionIds)

      const total = attendance?.length || 0
      const present = attendance?.filter(a => a.status === 'PRESENTE').length || 0
      const absent = total - present
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0

      return { total, present, absent, percentage }
    } catch (error) {
      console.error(`Errore nel caricamento presenze per ${date}:`, error)
      return { total: 0, present: 0, absent: 0, percentage: 0 }
    }
  }

  // Carica quote per categoria
  const loadFeesByCategory = async () => {
    try {
      const { data: fees } = await supabase
        .from('fees')
        .select('category, amount')

      if (!fees) return []

      const categoryMap = new Map()
      fees.forEach(fee => {
        const existing = categoryMap.get(fee.category) || { amount: 0, count: 0 }
        categoryMap.set(fee.category, {
          amount: existing.amount + fee.amount,
          count: existing.count + 1
        })
      })

      return Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count
      }))
    } catch (error) {
      console.error('Errore nel caricamento quote per categoria:', error)
      return []
    }
  }

  // Carica giocatori per categoria da people (campo player_categories = array di id categoria)
  const loadPlayersByCategory = async () => {
    try {
      const { data: peopleData } = await supabase
        .from('people')
        .select('id, player_categories')
        .eq('is_player', true)

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name, code')

      const people = peopleData || []
      const categories = categoriesData || []
      const idToName = new Map(categories.map((c: { id: string; name?: string; code?: string }) => [c.id, (c.name || c.code || '')]))

      const categoryCount = new Map<string, number>()
      people.forEach((p: { id: string; player_categories?: string[] | null }) => {
        const catIds = Array.isArray(p.player_categories) ? p.player_categories : (() => { try { return JSON.parse((p.player_categories as any) || '[]') } catch { return [] } })()
        if (catIds.length === 0) return
        catIds.forEach((id: string) => {
          const name = idToName.get(id) || 'Senza categoria'
          categoryCount.set(name, (categoryCount.get(name) || 0) + 1)
        })
      })

      return Array.from(categoryCount.entries()).map(([category, count]) => ({
        category,
        count
      }))
    } catch (error) {
      console.error('Errore nel caricamento giocatori per categoria:', error)
      return []
    }
  }

  // Giocatori per società di origine (people.origin_club)
  const loadPlayersByOriginClub = async () => {
    try {
      const { data: peopleData } = await supabase
        .from('people')
        .select('id, origin_club')
        .eq('is_player', true)

      const people = peopleData || []
      const byClub = new Map<string, number>()
      people.forEach((p: { id: string; origin_club?: string | null }) => {
        const name = (p.origin_club && p.origin_club.trim()) ? p.origin_club.trim() : 'Non indicata'
        byClub.set(name, (byClub.get(name) || 0) + 1)
      })

      return Array.from(byClub.entries())
        .map(([originClub, count]) => ({ originClub, count }))
        .sort((a, b) => b.count - a.count)
    } catch (error) {
      console.error('Errore nel caricamento giocatori per società di origine:', error)
      return []
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  return {
    stats,
    loading,
    error,
    refetch: loadStats
  }
}
