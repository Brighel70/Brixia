import Header from '@/components/Header'
import AttendanceRow from '@/components/AttendanceRow'
import AttendancePopup from '@/components/AttendancePopup'
import StatusPill from '@/components/StatusPill'
import StatsDashboard from '@/components/StatsDashboard'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, CalendarCheck, CheckCircle, Settings, Trash2, Users, Minus, ClipboardList, Triangle, Square, MapPin, Clock, CalendarDays, X } from 'lucide-react'
import { clsx } from 'clsx'
import { supabase } from '@/lib/supabaseClient'
import { usePermissions } from '@/hooks/usePermissions'
import { useSetPageTitle } from '@/context/PageTitleContext'
import { useData, type Status } from '@/store/data'
import { useAuth } from '@/store/auth'
import { createAutomaticSession, createMultipleAutomaticSessions } from '@/lib/sessionScheduler'
import MatchListModal from '@/components/MatchListModal'
import MatchScorecard from '@/components/MatchScorecard'
import jsPDF from 'jspdf'
import TrainingVenueSelect from '@/components/TrainingVenueSelect'
import { useTrainingVenues } from '@/hooks/useTrainingVenues'

const statuses = [
  { key: 'PRESENTE', short: 'P' },
  { key: 'ASSENTE', short: 'A' },
  { key: 'INFORTUNATO', short: 'INF' },
  { key: 'MALATO', short: 'M' },
  { key: 'PERMESSO', short: 'G' },
] as const

interface Session {
  id: string
  category_id: string
  session_date: string
  location: string
  created_at: string
  away_place?: string
  start_time?: string
  end_time?: string
  completed_at?: string
  categories: {
    id: string
    code: string
    name: string
  }[]
}

interface Event {
  id: string
  category_id: string
  event_date: string
  event_time?: string
  event_type: string
  title: string
  location: string
  away_location?: string
  opponent?: string
  is_home?: boolean
  is_championship?: boolean
  is_friendly?: boolean
  start_time?: string
  end_time?: string
  description?: string
  created_at: string
  categories: {
    id: string
    code: string
    name: string
  }[]
}

interface CategoryActivitiesProps {
  embedInLayout?: boolean
}

export default function CategoryActivities({ embedInLayout = false }: CategoryActivitiesProps) {
  const navigate = useNavigate()
  const { requiresAwayDetail, isHomeVenue, scheduleVenues } = useTrainingVenues()
  const defaultVenueName = scheduleVenues[0]?.name ?? ''
  const [searchParams] = useSearchParams()
  const setPageTitle = useSetPageTitle()
  const [sessions, setSessions] = useState<Session[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [sessionTimes, setSessionTimes] = useState<{[key: string]: {start_time: string, end_time: string}}>({})
  const [loading, setLoading] = useState(true)
  const [categoryName, setCategoryName] = useState('')
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [editForm, setEditForm] = useState({
    session_date: '',
    location: '',
    away_place: '',
    start_time: '',
    end_time: ''
  })
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [modalPlayers, setModalPlayers] = useState<any[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalAttendance, setModalAttendance] = useState<Record<string, { status: string; injured_place?: string }>>({})
  const [lastAttendanceUpdate, setLastAttendanceUpdate] = useState<Date | null>(null)
  const [lockedSessions, setLockedSessions] = useState<Set<string>>(new Set())
  const [showStats, setShowStats] = useState(false)
  const [statsSection, setStatsSection] = useState<'partite' | 'allenamenti'>('partite')
  /** Vista principale: Allenamenti (sessioni) | Partite (eventi) | Statistiche */
  const [mainView, setMainView] = useState<'allenamenti' | 'partite' | 'statistiche'>('allenamenti')
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null)
  const [pageCategory, setPageCategory] = useState<{ id: string; name: string; code: string } | null>(null)
  const [totalPlayersInMatches, setTotalPlayersInMatches] = useState<number>(0)
  const [averageAttendance, setAverageAttendance] = useState<number>(0)
  const [monthlyTrend, setMonthlyTrend] = useState<number>(0)
  /** Attivi ed Effettuati si aprono/chiudono insieme; default aperti */
  const [expandedAccordion, setExpandedAccordion] = useState<string | null>('attivi')
  /** Partite e Giocate si aprono/chiudono insieme; default aperti */
  const [partiteGiocateOpen, setPartiteGiocateOpen] = useState(true)
  /** Se true, in tabella Attivi mostri tutti gli allenamenti programmati; se false solo le ultime 4 settimane */
  const [showAllActiveSessions, setShowAllActiveSessions] = useState(false)
  /** Se true, in tabella Effettuati mostri tutte le sessioni; se false solo le ultime 4 settimane */
  const [showAllCompletedSessions, setShowAllCompletedSessions] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [showEventDeleteConfirm, setShowEventDeleteConfirm] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<string | null>(null)

  useEffect(() => {
    const requestedView = searchParams.get('view')
    if (requestedView === 'partite' || requestedView === 'allenamenti' || requestedView === 'statistiche') {
      setMainView(requestedView)
      setShowStats(requestedView === 'statistiche')
    }
  }, [searchParams])
  
  // Sistema di creazione sessioni intelligente
  const [showSmallSessionChoiceModal, setShowSmallSessionChoiceModal] = useState(false)
  const [showSessionTypeModal, setShowSessionTypeModal] = useState(false)
  const [sessionType, setSessionType] = useState<'single' | 'weekly' | 'biweekly' | 'monthly' | 'extra' | null>(null)
  const [bulkSessionNote, setBulkSessionNote] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  /** Popup di successo (grafica webapp) al posto di alert() dopo creazione sessioni */
  const [successPopup, setSuccessPopup] = useState<{ message: string } | null>(null)
  
  // Stati per le liste gara
  const [showMatchListModal, setShowMatchListModal] = useState(false)
  const [savedLists, setSavedLists] = useState<any[]>([])
  const [showSavedListsModal, setShowSavedListsModal] = useState(false)
  const [editingMatchList, setEditingMatchList] = useState<any>(null)
  const [selectedEventForList, setSelectedEventForList] = useState<string | null>(null)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [listToCopy, setListToCopy] = useState<any>(null)
  const [showListDetailsModal, setShowListDetailsModal] = useState(false)
  const [selectedListDetails, setSelectedListDetails] = useState<any>(null)
  const [showMatchScorecard, setShowMatchScorecard] = useState(false)
  const [selectedMatchList, setSelectedMatchList] = useState<any>(null)

  // Titolo header: "Attività [Nome Categoria]" (es. Attività Serie B)
  useEffect(() => {
    const name = categoryName || pageCategory?.name || ''
    if (name) setPageTitle(`Attività ${name}`)
    return () => setPageTitle(null)
  }, [categoryName, pageCategory?.name, setPageTitle])
  
  const eventMatchListCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    savedLists.forEach(list => {
      if (list.event_id) {
        counts[list.event_id] = Array.isArray(list.selected_players) ? list.selected_players.length : 0
      }
    })
    return counts
  }, [savedLists])
  
  // Stati per il popup di presenza
  const [showAttendancePopup, setShowAttendancePopup] = useState(false)
  const [currentCategory, setCurrentCategory] = useState<any>(null)
  const { attendance } = useData()
  const [isOpeningPopup, setIsOpeningPopup] = useState(false)
  
  // Stati per il modal di creazione eventi
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventForm, setEventForm] = useState({
    event_type: 'partita',
    title: '',
    category_id: '',
    opponent: '',
    event_date: '',
    event_time: '',
    location: '',
    away_location: '',
    is_home: true,
    is_championship: false,
    is_friendly: false,
    start_time: '',
    end_time: '',
    description: '',
    match_result: ''
  })
  const [showValidationPopup, setShowValidationPopup] = useState(false)
  
  // State per memorizzare lo status delle presenze per ogni sessione
  const [sessionAttendanceStatus, setSessionAttendanceStatus] = useState<Record<string, {
    hasUnassigned: boolean
    unassignedCount: number
    isComplete: boolean
    presentCount: number
    totalPlayers: number
  }>>({})
  
  // State per i dati del grafico settimanale

  

  
  const { isAdmin, isAllenatore, isTeamManager } = usePermissions()
  const { loadPlayers, players, setCurrentSession, setCurrentCategory: setDataCurrentCategory, currentSession } = useData()
  const { profile } = useAuth()

  useEffect(() => {
    const categoryCode = searchParams.get('category')
    if (categoryCode) {
      loadCategorySessions(categoryCode)
    } else {
      setLoading(false)
    }
  }, [searchParams])

  // Carica le statistiche delle sessioni quando cambiano le sessioni
  useEffect(() => {
    if (sessions.length > 0) {
      sessions.forEach(session => {
        if (session.category_id) {
          loadSessionAttendanceStatus(session.id, session.category_id)
        }
      })
      

    }
  }, [sessions])



  // Cleanup: ripristina lo scroll quando il componente viene smontato
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  // Carica gli orari delle sessioni quando le sessioni cambiano
  useEffect(() => {
    const loadSessionTimes = async () => {
      if (sessions && sessions.length > 0) {
        const times: {[key: string]: {start_time: string, end_time: string}} = {}
        
        for (const session of sessions) {
          const time = await getSessionTime(session)
          if (time) {
            times[session.id] = time
          }
        }
        
        setSessionTimes(times)
      }
    }
    
    loadSessionTimes()
  }, [sessions])

  // Carica totalPlayersInMatches quando currentCategoryId cambia
  useEffect(() => {
    const loadTotalPlayersInMatches = async () => {
      if (!currentCategoryId) {
        setTotalPlayersInMatches(0)
        return
      }

      try {
        // Carica match_lists per calcolare giocatori entrati in campo
        const { data: matchLists } = await supabase
          .from('match_lists')
          .select('selected_players')
          .eq('category_id', currentCategoryId)
          .eq('type', 'match')

        // Calcola numero totale di giocatori entrati in campo (anche solo un minuto)
        const uniquePlayersInMatches = new Set<string>()
        matchLists?.forEach((list: any) => {
          if (list.selected_players && Array.isArray(list.selected_players)) {
            list.selected_players.forEach((player: any) => {
              const playerId = player?.player_id || player?.id || player
              if (playerId) {
                uniquePlayersInMatches.add(playerId)
              }
            })
          }
        })

        setTotalPlayersInMatches(uniquePlayersInMatches.size)
      } catch (error) {
        console.error('Errore nel caricamento giocatori in campo:', error)
        setTotalPlayersInMatches(0)
      }
    }

    loadTotalPlayersInMatches()
  }, [currentCategoryId])

  // Calcola averageAttendance e monthlyTrend per l'header Allenamenti
  useEffect(() => {
    if (!currentCategoryId || !sessions.length) {
      setAverageAttendance(0)
      setMonthlyTrend(0)
      return
    }

    const calculateAttendanceStats = async () => {
      try {
        // Carica tutte le presenze per le sessioni di questa categoria
        const sessionIds = sessions.map(s => s.id)
        if (sessionIds.length === 0) {
          setAverageAttendance(0)
          setMonthlyTrend(0)
          return
        }

        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .in('session_id', sessionIds)

        if (!attendanceData) {
          setAverageAttendance(0)
          setMonthlyTrend(0)
          return
        }

        // Calcola averageAttendance
        const totalAttendance = attendanceData.length
        const presentCount = attendanceData.filter(a => a.status === 'PRESENTE').length
        const avgAttendance = totalAttendance > 0 ? 
          Math.round((presentCount / totalAttendance) * 100) : 0
        setAverageAttendance(avgAttendance)

        // Calcola monthlyTrend (ultimi 6 mesi)
        const monthlyData = []
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
          
          const monthSessions = sessions.filter(s => {
            const sessionDate = new Date(s.session_date)
            return sessionDate.getMonth() === date.getMonth() && 
                   sessionDate.getFullYear() === date.getFullYear()
          })

          const monthAttendance = attendanceData.filter(a => {
            const session = sessions.find(s => s.id === a.session_id)
            if (!session) return false
            const sessionDate = new Date(session.session_date)
            return sessionDate.getMonth() === date.getMonth() && 
                   sessionDate.getFullYear() === date.getFullYear()
          }).length

          monthlyData.push({
            month: date.toLocaleDateString('it-IT', { month: 'short' }),
            sessions: monthSessions.length,
            attendance: monthAttendance
          })
        }

        // Calcola trend mensile
        const trend = monthlyData.length > 1 && monthlyData[0].attendance > 0 ? 
          Math.round(((monthlyData[monthlyData.length - 1].attendance - monthlyData[0].attendance) / monthlyData[0].attendance) * 100) : 0
        setMonthlyTrend(trend)
      } catch (error) {
        console.error('Errore nel calcolo statistiche presenze:', error)
        setAverageAttendance(0)
        setMonthlyTrend(0)
      }
    }

    calculateAttendanceStats()
  }, [sessions, currentCategoryId])

  const loadCategorySessions = async (categoryCode: string) => {
    try {
      // Prima trova l'ID della categoria
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name, code')
        .eq('code', categoryCode)
        .single()

      if (categoryError) {
        console.error('Errore nel trovare categoria:', categoryError)
        return
      }

      setCategoryName(categoryData.name)
      setCurrentCategoryId(categoryData.id)
      setCurrentCategory(categoryData)
      setPageCategory(categoryData)

      // Poi carica le sessioni di quella categoria
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          category_id,
          session_date,
          location,
          created_at,
          away_place,
          start_time,
          end_time,
          completed_at,
          categories(id, code, name)
        `)
        .eq('category_id', categoryData.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Errore nel caricamento sessioni:', error)
        return
      }

      setSessions(data || [])

      // Carica le liste gara salvate
      await loadSavedLists(categoryData.id)

      // Carica i giocatori della categoria per Statistiche Categoria (Serie B, ecc.)
      await loadPlayers(categoryData.id)

      // Carica anche gli eventi della categoria
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          category_id,
          event_date,
          event_time,
          event_type,
          title,
          location,
          away_location,
          opponent,
          is_home,
          is_championship,
          is_friendly,
          start_time,
          end_time,
          description,
          match_result,
          created_at,
          categories(id, code, name)
        `)
        .eq('category_id', categoryData.id)
        .order('event_date', { ascending: false })

      if (eventsError) {
        console.error('Errore nel caricamento eventi:', eventsError)
      } else {
        setEvents(eventsData || [])
      }
    } catch (error) {
      console.error('Errore generale:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getSessionCategoryCode = (session: Session): string => {
    const cat = (session as any).categories ?? (session as any).category
    if (cat && typeof cat === 'object' && !Array.isArray(cat) && 'code' in cat) return (cat as { code: string }).code
    if (Array.isArray(cat) && cat.length > 0 && cat[0]?.code) return cat[0].code
    return pageCategory?.code ?? currentCategory?.code ?? searchParams.get('category') ?? ''
  }

  const getEventCategoryCode = (event: EventType): string => {
    // Supabase può restituire categories come oggetto singolo o array
    const cat = (event as any).categories ?? (event as any).category
    if (cat && typeof cat === 'object' && !Array.isArray(cat) && 'code' in cat) return (cat as { code: string }).code
    if (Array.isArray(cat) && cat.length > 0 && cat[0]?.code) return cat[0].code
    // Fallback: siamo nella vista filtrata per categoria
    return pageCategory?.code ?? currentCategory?.code ?? searchParams.get('category') ?? ''
  }

  const getCategoryAbbreviation = (code: string) => {
    const u = (code || '').toUpperCase()
    if (u === 'SENIOR' || u === 'SENIORES') return ''
    const abbreviations: { [key: string]: string } = {
      'U6': 'U6', 'U8': 'U8', 'U10': 'U10', 'U12': 'U12', 'U14': 'U14', 'U16': 'U16', 'U18': 'U18',
      'SERIE_C': 'C', 'SERIE_B': 'B', 'PODEROSA': 'POD', 'GUSSAGOLD': 'GUS', 'BRIXIAOLD': 'BRI', 'LEONESSE': 'LEO'
    }
    return abbreviations[code] || code
  }

  // Funzione per ottenere il colore della categoria (Apple-style)
  const getCategoryColor = (categoryCode: string) => {
    const colorMap: { [key: string]: string } = {
      'U6': 'bg-gradient-to-br from-emerald-400 to-emerald-500',
      'U8': 'bg-gradient-to-br from-emerald-400 to-emerald-500',
      'U10': 'bg-gradient-to-br from-emerald-400 to-emerald-500',
      'U12': 'bg-gradient-to-br from-emerald-400 to-emerald-500',
      'U14': 'bg-gradient-to-br from-blue-500 to-cyan-400',
      'U16': 'bg-gradient-to-br from-blue-500 to-cyan-400',
      'U18': 'bg-gradient-to-br from-yellow-500 to-yellow-400',
      'SERIE_C': 'bg-gradient-to-br from-blue-500 to-cyan-400',
      'SERIE_B': 'bg-gradient-to-br from-blue-500 to-cyan-400',
      'GUSSAGOLD': 'bg-gradient-to-br from-amber-400 to-amber-500',
      'PODEROSA': 'bg-gradient-to-br from-amber-400 to-amber-500',
      'BRIXIAOLD': 'bg-gradient-to-br from-amber-400 to-amber-500',
      'LEONESSE': 'bg-gradient-to-br from-rose-400 to-rose-500'
    }
    return colorMap[categoryCode] || 'bg-gradient-to-br from-sky-400 to-sky-500'
  }

  // Funzione per analizzare il risultato della partita
  const analyzeMatchResult = (matchResult: string, isHome: boolean) => {
    if (!matchResult || matchResult.trim() === '') {
      return { status: 'unknown', ourScore: 0, opponentScore: 0, display: matchResult }
    }

    // Pattern per riconoscere "28 - 35" o "28-35"
    const scorePattern = /^(\d+)\s*[-–]\s*(\d+)$/
    const match = matchResult.trim().match(scorePattern)
    
    if (!match) {
      // Se non è nel formato numerico, restituisci il testo originale
      return { status: 'unknown', ourScore: 0, opponentScore: 0, display: matchResult }
    }

    const score1 = parseInt(match[1])
    const score2 = parseInt(match[2])
    
    // Determina quale punteggio è nostro basandosi su "in casa"
    let ourScore: number, opponentScore: number
    
    if (isHome) {
      // Se siamo in casa, il primo punteggio è nostro
      ourScore = score1
      opponentScore = score2
    } else {
      // Se siamo in trasferta, il secondo punteggio è nostro
      ourScore = score2
      opponentScore = score1
    }

    let status: 'win' | 'loss' | 'draw' | 'unknown'
    if (ourScore > opponentScore) {
      status = 'win'
    } else if (ourScore < opponentScore) {
      status = 'loss'
    } else {
      status = 'draw'
    }

    return { status, ourScore, opponentScore, display: matchResult }
  }

  const getSessionTime = async (session: Session) => {
    try {
      // Ottieni il giorno della settimana dalla data della sessione
      const sessionDate = new Date(session.session_date)
      const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
      const weekday = weekdays[sessionDate.getDay()]
      
      // Cerca negli orari di allenamento per questa categoria e giorno
      let query = supabase
        .from('training_locations')
        .select('start_time, end_time')
        .eq('category_id', session.category_id)
        .eq('weekday', weekday)
      
      if (!requiresAwayDetail(session.location)) {
        query = query.eq('location', session.location)
      }
      
      const { data, error } = await query.limit(1)

      if (error) {
        // Log dell'errore per debug ma non bloccare l'app
        console.log(`Nessun orario trovato per ${session.categories?.[0]?.name} - ${weekday} - ${session.location}:`, error.message)
        return null
      }

      if (!data || data.length === 0) {
        return null
      }

      return {
        start_time: data[0].start_time,
        end_time: data[0].end_time
      }
    } catch (error) {
      console.error('Errore nel recupero orario sessione:', error)
      return null
    }
  }

  // Funzione helper per determinare il colore di sfondo della sessione
  const getSessionBackgroundColor = (sessionId: string) => {
    const status = sessionAttendanceStatus[sessionId]
    
    if (status?.isComplete) {
      const percentage = status.totalPlayers > 0 
        ? Math.round((status.presentCount / status.totalPlayers) * 100)
        : 0
      
      // Stessa logica di colorazione della percentuale
      if (percentage >= 75) {
        return 'bg-green-50 border-green-200' // Verde per >= 75%
      } else if (percentage >= 60) {
        return 'bg-orange-50 border-orange-200' // Arancione per 60-74%
      } else {
        return 'bg-red-50 border-red-200' // Rosso per < 60%
      }
    }
    
    return 'bg-white border-gray-100' // Colore di default
  }

  // Funzioni per il sistema di creazione sessioni intelligente
  const loadTrainingLocations = async (categoryIds: string[]) => {
    const { data, error } = await supabase
      .from('training_locations')
      .select('*')
      .in('category_id', categoryIds)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Errore nel caricamento delle sedi di allenamento:', error)
      return {}
    }

    // Raggruppa per category_id
    const grouped = data.reduce((acc: any, location: any) => {
      if (!acc[location.category_id]) {
        acc[location.category_id] = []
      }
      acc[location.category_id].push(location)
      return acc
    }, {})

    return grouped
  }

  const getNextAvailableTrainingDay = async (trainingLocations: any[], categoryId: string) => {
    const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Ordina le sedi per giorno della settimana
    const sortedLocations = [...trainingLocations].sort((a, b) => {
      const dayA = weekdays.indexOf(a.weekday)
      const dayB = weekdays.indexOf(b.weekday)
      return dayA - dayB
    })

    // Cerca il primo giorno configurato che sia oggi o dopo
    for (let i = 0; i < 14; i++) { // Cerca per 2 settimane
      const checkDate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
      const dayOfWeek = weekdays[checkDate.getDay()]
      
      const location = sortedLocations.find(loc => loc.weekday === dayOfWeek)
      if (location && checkDate >= today) {
        // Controlla se esiste già una sessione per questa data e categoria
        try {
          const { data: existingSession } = await supabase
            .from('sessions')
            .select('id')
            .eq('category_id', categoryId)
            .eq('session_date', checkDate.toISOString().split('T')[0])
            .single()
          
          // Se non esiste una sessione per questa data, è disponibile
          if (!existingSession) {
            return { date: checkDate, location }
          }
        } catch (error) {
          // Se c'è un errore nella query (es. 406), ignora e continua
          console.warn('Errore nel controllo sessione esistente:', error)
          return { date: checkDate, location }
        }
      }
    }

    return null
  }

  const createBulkSessions = async (category: any, sessionType: string, note: string = '') => {
    try {
      console.log('🚀 Creazione sessioni con nuovo sistema automatico...')
      
      if (sessionType === 'single') {
        // Singola sessione automatica
        const session = await createAutomaticSession(category.id)
        
        if (!session) {
          alert('❌ Impossibile creare la sessione. Verifica la configurazione training_locations.')
          return
        }
        
        console.log('✅ Sessione singola creata:', session)
        setSuccessPopup({ message: `Sessione creata per ${session.session_date} (${session.location})` })
        
      } else {
        // Calcola quante sessioni creare
        let sessionCount: number
        switch (sessionType) {
          case 'weekly':
            sessionCount = 3 // Assumendo 3 giorni configurati per settimana
            break
          case 'biweekly':
            sessionCount = 6 // 2 settimane
            break
          case 'monthly':
            sessionCount = 12 // 4 settimane
            break
          default:
            sessionCount = 3
        }
        
        console.log(`📅 Creando ${sessionCount} sessioni per ${sessionType}...`)
        
        const sessions = await createMultipleAutomaticSessions(category.id, sessionCount)
        
        if (!sessions || sessions.length === 0) {
          alert('❌ Impossibile creare le sessioni. Verifica la configurazione training_locations.')
          return
        }
        
        console.log('✅ Sessioni create:', sessions)
        setSuccessPopup({ message: `${sessions.length} sessioni create con successo!` })
      }
      
      // Ricarica le sessioni
      const categoryCode = searchParams.get('category')
      if (categoryCode) {
        await loadCategorySessions(categoryCode)
      }
      
      // Chiudi il modal
      setShowSessionTypeModal(false)
      setSessionType(null)
      setBulkSessionNote('')
      
    } catch (error) {
      console.error('❌ Errore nella creazione sessioni:', error)
      alert('❌ Errore nella creazione delle sessioni: ' + (error as Error).message)
    }
  }

  // Funzione per aprire il piccolo modal di scelta (Allenamento extra / Configurazione manuale)
  const handleNewSessionClick = () => {
    setShowSmallSessionChoiceModal(true)
  }

  // Funzioni per separare le sessioni
  const getActiveSessions = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return sessions
      .filter(session => new Date(session.session_date) >= today)
      .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()) // Dal prossimo al più lontano
  }

  const getCompletedSessions = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return sessions
      .filter(session => new Date(session.session_date) < today)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
  }

  // Sessioni effettuate visibili in tabella: solo ultime 4 settimane (ordine: più recente prima)
  const getCompletedSessionsForTable = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const fourWeeksAgo = new Date(today)
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    return getCompletedSessions().filter(session => {
      const d = new Date(session.session_date)
      d.setHours(0, 0, 0, 0)
      return d >= fourWeeksAgo && d < today
    })
  }

  // Sessioni attive visibili in tabella: solo prossime 4 settimane (da oggi incluso)
  const getActiveSessionsForTable = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const fourWeeksLater = new Date(today)
    fourWeeksLater.setDate(fourWeeksLater.getDate() + 28)
    return getActiveSessions().filter(session => {
      const d = new Date(session.session_date)
      d.setHours(0, 0, 0, 0)
      return d >= today && d <= fourWeeksLater
    })
  }

  // Funzioni per raggruppare per data
  const groupByDate = (items: any[]) => {
    const grouped = items.reduce((acc, item) => {
      const date = item.session_date || item.event_date
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(item)
      return acc
    }, {})

    // Ordina le date dalla più recente alla più vecchia
    const sortedDates = Object.keys(grouped).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    )

    return sortedDates.map(date => ({
      date,
      items: grouped[date].sort((a, b) => {
        // DEBUG: Verifica i valori effettivi
        console.log('🔍 WEBAPP DEBUG - Eventi da ordinare:', {
          eventA: { title: a.title, event_time: a.event_time, start_time: a.start_time },
          eventB: { title: b.title, event_time: b.event_time, start_time: b.start_time }
        })
        
        // Ordina per orario crescente se hanno la stessa data
        const timeA = a.event_time || a.start_time || '00:00:00'
        const timeB = b.event_time || b.start_time || '00:00:00'
        
        // Estrai solo l'ora (HH:MM) dal formato HH:MM:SS
        const extractTime = (timeStr) => {
          if (!timeStr) return '00:00'
          if (timeStr.includes(':') && timeStr.split(':').length === 3) {
            return timeStr.substring(0, 5)
          }
          return timeStr
        }
        
        const timeAOnly = extractTime(timeA)
        const timeBOnly = extractTime(timeB)
        
        console.log('🔍 WEBAPP DEBUG - Tempi estratti:', { timeAOnly, timeBOnly, comparison: timeAOnly.localeCompare(timeBOnly) })
        
        return timeAOnly.localeCompare(timeBOnly)
      })
    }))
  }

  // Funzione per raggruppare per data con ordinamento DECRESCENTE (per partite giocate)
  const groupByDateDescending = (items: any[]) => {
    const grouped = items.reduce((acc, item) => {
      const date = item.session_date || item.event_date
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(item)
      return acc
    }, {})

    // Ordina le date dalla più RECENTE alla più VECCHIA (DECRESCENTE)
    const sortedDates = Object.keys(grouped).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    )

    return sortedDates.map(date => ({
      date,
      items: grouped[date].sort((a, b) => {
        // Ordina per orario CRESCENTE (dal più vecchio al più recente) se hanno la stessa data
        const timeA = a.event_time || a.start_time || '00:00:00'
        const timeB = b.event_time || b.start_time || '00:00:00'
        
        // Estrai solo l'ora (HH:MM) dal formato HH:MM:SS
        const extractTime = (timeStr) => {
          if (!timeStr) return '00:00'
          if (timeStr.includes(':') && timeStr.split(':').length === 3) {
            return timeStr.substring(0, 5)
          }
          return timeStr
        }
        
        const timeAOnly = extractTime(timeA)
        const timeBOnly = extractTime(timeB)
        
        return timeAOnly.localeCompare(timeBOnly)
      })
    }))
  }

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString)
    const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
    const weekday = weekdays[date.getDay()]
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    
    return `${weekday}, ${day}/${month}`
  }

  // Controlla se l'utente può modificare/cancellare sessioni
  const canManageSessions = isAdmin() || isAllenatore() || isTeamManager()

  // Controlla se le presenze sono bloccate (dopo 24 ore dall'ultima modifica)
  const isAttendanceLocked = () => {
    if (!lastAttendanceUpdate) return false
    
    const now = new Date()
    const timeDiff = now.getTime() - lastAttendanceUpdate.getTime()
    const hoursDiff = timeDiff / (1000 * 3600)
    
    return hoursDiff >= 24
  }

  // Controlla se una sessione specifica è bloccata
  const isSessionLocked = (sessionId: string) => {
    return lockedSessions.has(sessionId)
  }

  // Carica le presenze per una sessione specifica
  const loadSessionAttendance = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('player_id, status, injured_place, updated_at')
        .eq('session_id', sessionId)

      if (error) throw error

      // Converte l'array in un oggetto per facilità d'uso
      const attendanceMap: Record<string, { status: string; injured_place?: string }> = {}
      let latestUpdate: Date | null = null
      
      data?.forEach(att => {
        attendanceMap[att.player_id] = {
          status: att.status,
          injured_place: att.injured_place
        }
        
        // Trova l'ultima modifica
        const updateDate = new Date(att.updated_at)
        if (!latestUpdate || updateDate > latestUpdate) {
          latestUpdate = updateDate
        }
      })

      setModalAttendance(attendanceMap)
      setLastAttendanceUpdate(latestUpdate)
      
      // Controlla se questa sessione è bloccata
      if (latestUpdate) {
        const now = new Date()
        const timeDiff = now.getTime() - latestUpdate.getTime()
        const hoursDiff = timeDiff / (1000 * 3600)
        
        setLockedSessions(prev => {
          const newSet = new Set(prev)
          if (hoursDiff >= 24) {
            newSet.add(sessionId)
          } else {
            newSet.delete(sessionId)
          }
          return newSet
        })
      }
    } catch (error) {
      console.error('Errore nel caricamento presenze:', error)
      setModalAttendance({})
      setLastAttendanceUpdate(null)
    }
  }

  // Salva le presenze per una sessione specifica
  // Funzione helper: Controlla se una sessione è modificabile (entro 7 giorni dal completamento)
  const isSessionEditable = (session: any): { editable: boolean; message?: string } => {
    // Se la sessione non è completata, è sempre modificabile
    if (!session.completed_at) {
      return { editable: true }
    }

    // Calcola la differenza in giorni dal completamento
    const completedDate = new Date(session.completed_at)
    const now = new Date()
    const daysSinceCompletion = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSinceCompletion > 7) {
      return { 
        editable: false, 
        message: `Sessione completata ${daysSinceCompletion} giorni fa. Le modifiche sono consentite solo entro 7 giorni dal completamento.` 
      }
    }

    return { editable: true }
  }

  // Funzione helper: Controlla se la sessione è completa e aggiorna completed_at
  const checkAndSetSessionCompleted = async (sessionId: string, categoryId: string) => {
    try {
      // Carica la sessione
      const { data: session } = await supabase
        .from('sessions')
        .select('id, session_date, category_id, completed_at')
        .eq('id', sessionId)
        .single()

      if (!session || session.completed_at) {
        return // Sessione non trovata o già completata
      }

      // Carica tutti i giocatori della categoria dal database
      const { data: allPeople } = await supabase
        .from('people')
        .select('*')
        .eq('is_player', true)

      // Filtra per categoria
      const categoryPlayers = (allPeople || []).filter((person: any) => {
        if (!person.player_categories) return false
        const categories = Array.isArray(person.player_categories) 
          ? person.player_categories 
          : JSON.parse(person.player_categories || '[]')
        return categories.includes(categoryId)
      })

      const totalPlayers = categoryPlayers.length

      // Conta le presenze segnate
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('id')
        .eq('session_id', sessionId)

      const markedCount = attendanceData?.length || 0

      // Se tutti i giocatori sono stati segnati, segna la sessione come completata
      if (markedCount >= totalPlayers && totalPlayers > 0) {
        await supabase
          .from('sessions')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', sessionId)

        console.log(`✅ Sessione ${sessionId} completata! Modificabile per 7 giorni.`)
      }
    } catch (error) {
      console.error('Errore nel controllo completamento sessione:', error)
    }
  }

  const saveModalAttendance = async (playerId: string, status: string, injured_place?: string) => {
    if (!selectedSession) return

    try {
      // Controlla se la sessione è modificabile
      const editableCheck = isSessionEditable(selectedSession)
      if (!editableCheck.editable) {
        alert(editableCheck.message)
        return
      }

      const payload: any = { 
        session_id: selectedSession.id, 
        player_id: playerId, 
        status 
      }
      if (status === 'INFORTUNATO' && injured_place) {
        payload.injured_place = injured_place
      }

      // Usa upsert con on_conflict per gestire il constraint unico
      const { error } = await supabase
        .from('attendance')
        .upsert(payload, { 
          onConflict: 'session_id,player_id',
          ignoreDuplicates: false 
        })
      
      if (error) throw error

      // Aggiorna lo stato locale
      setModalAttendance(prev => ({
        ...prev,
        [playerId]: { status, injured_place }
      }))
      
      // Controlla se la sessione è ora completa e aggiorna completed_at se necessario
      await checkAndSetSessionCompleted(selectedSession.id, selectedSession.category_id)
      
      // Aggiorna la data dell'ultima modifica
      setLastAttendanceUpdate(new Date())
    } catch (error) {
      console.error('Errore nel salvataggio presenze:', error)
    }
  }

  const removeModalAttendance = async (playerId: string) => {
    if (!selectedSession) return

    try {
      // Controlla se la sessione è modificabile
      const editableCheck = isSessionEditable(selectedSession)
      if (!editableCheck.editable) {
        alert(editableCheck.message)
        return
      }
      
      // Aggiorna SUBITO lo stato locale per feedback visivo immediato
      setModalAttendance(prev => {
        const { [playerId]: removed, ...rest } = prev
        return rest
      })
      
      // Poi cancella il record dal database in background
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('session_id', selectedSession.id)
        .eq('player_id', playerId)
      
      if (error) {
        console.error('❌ Errore nella rimozione dal database:', error)
        // In caso di errore, ripristina lo stato
        const { data: currentData } = await supabase
          .from('attendance')
          .select('*')
          .eq('session_id', selectedSession.id)
          .eq('player_id', playerId)
          .single()
        
        if (currentData) {
          setModalAttendance(prev => ({
            ...prev,
            [playerId]: { status: currentData.status, injured_place: currentData.injured_place }
          }))
        }
      }
      
      // Aggiorna la data dell'ultima modifica
      setLastAttendanceUpdate(new Date())
    } catch (error) {
      console.error('❌ Errore nella rimozione status:', error)
    }
  }

  const openAttendanceModal = async (session: Session) => {
    console.log('🔍 [openAttendanceModal] Apertura modal per sessione:', {
      sessionId: session.id,
      categoryId: session.category_id,
      categoryName: session.categories?.[0]?.name,
      categoryCode: session.categories?.[0]?.code
    })
    
    setSelectedSession(session)
    setShowAttendanceModal(true)
    setModalLoading(true)
    
    // Blocca lo scroll del body
    document.body.style.overflow = 'hidden'
    
    try {
      // Imposta la sessione corrente nello store globale
      setCurrentSession(session as any)
      setCurrentCategory(session.categories?.[0] || null)
      
      // Carica i giocatori per questa categoria
      await loadPlayers(session.category_id)
      
      // Verifica quanti giocatori sono stati caricati
      console.log('🔍 [openAttendanceModal] Giocatori nello store dopo loadPlayers:', players.length)
      
      // Carica le presenze specifiche per questa sessione
      await loadSessionAttendance(session.id)
      
      setModalLoading(false)
    } catch (error) {
      console.error('❌ Errore nel caricamento giocatori:', error)
      setModalLoading(false)
    }
  }

  const closeAttendanceModal = () => {
    setShowAttendanceModal(false)
    setSelectedSession(null)
    setModalAttendance({})
    setLastAttendanceUpdate(null)
    
    // Pulisci la sessione corrente dallo store
    setCurrentSession(null)
    setCurrentCategory(null)
    
    // Ripristina lo scroll del body
    document.body.style.overflow = 'unset'
  }

  // Avvia modifica sessione
  const startEditSession = (session: Session) => {
    const st = session.start_time ? session.start_time.substring(0, 5) : ''
    const et = session.end_time ? session.end_time.substring(0, 5) : ''
    setEditForm({
      session_date: session.session_date,
      location: session.location as any,
      away_place: session.away_place || '',
      start_time: st,
      end_time: et
    })
    setEditingSession(session)
  }

  // Salva modifiche sessione
  const saveSessionEdit = async () => {
    if (!editingSession) return

    try {
      const startTime = editForm.start_time ? (editForm.start_time.length === 5 ? `${editForm.start_time}:00` : editForm.start_time) : null
      const endTime = editForm.end_time ? (editForm.end_time.length === 5 ? `${editForm.end_time}:00` : editForm.end_time) : null
      const { error } = await supabase
        .from('sessions')
        .update({
          session_date: editForm.session_date,
          location: editForm.location,
          away_place: requiresAwayDetail(editForm.location) ? editForm.away_place : null,
          start_time: startTime,
          end_time: endTime
        })
        .eq('id', editingSession.id)

      if (error) {
        console.error('Errore nel salvataggio:', error)
        alert('Errore nel salvataggio delle modifiche')
        return
      }

      // Ricarica le sessioni
      const categoryCode = searchParams.get('category')
      if (categoryCode) {
        loadCategorySessions(categoryCode)
      }
      
      setEditingSession(null)
      setEditForm({
        session_date: '',
        location: defaultVenueName,
        away_place: '',
        start_time: '',
        end_time: ''
      })
    } catch (error) {
      console.error('Errore:', error)
      alert('Errore nel salvataggio')
    }
  }

  // Alias per compatibilità con il codice esistente
  const saveEditSession = saveSessionEdit

  // Funzioni per il popup di presenza
  const handleOpenAttendancePopup = async (sessionId: string) => {
    if (isOpeningPopup) return
    setIsOpeningPopup(true)
    
    try {
      // Blocca lo scroll
      document.body.style.overflow = 'hidden'
      
      // Carica i dati della sessione
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          completed_at,
          categories(id, code, name)
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        console.error('Errore nel caricamento sessione:', sessionError)
        alert('Errore nel caricamento della sessione')
        return
      }

      // Fix: categories potrebbe essere un oggetto singolo, non un array
      const categoryData = sessionData.categories
      const categoryId = categoryData?.id || sessionData.category_id

      setCurrentCategory(categoryData)
      setDataCurrentCategory(categoryId)
      setCurrentSession({
        ...sessionData,
        categories: Array.isArray(categoryData) ? categoryData : [categoryData]
      })
      
      // Carica i giocatori nello store globale CON le presenze della sessione
      await loadPlayers(categoryId, sessionId)
      
      // Carica le statistiche della sessione
      await loadSessionAttendanceStatus(sessionId)
      
      setShowAttendancePopup(true)
    } catch (error) {
      console.error('Errore nell\'apertura popup:', error)
      alert('Errore nell\'apertura del popup di presenza')
    } finally {
      document.body.style.overflow = 'unset'
      setIsOpeningPopup(false)
    }
  }

  const handleCloseAttendancePopup = () => {
    setShowAttendancePopup(false)
    setCurrentCategory(null)
    setIsOpeningPopup(false)
    document.body.style.overflow = 'unset'
  }

  const handleSaveAndExitAttendance = async () => {
    if (currentSession?.id) {
      await loadSessionAttendanceStatus(currentSession.id, currentSession.category_id)
      await checkAndSetSessionCompleted(currentSession.id, currentSession.category_id)
    }
  }

  const loadSessionAttendanceStatus = async (sessionId: string, categoryId?: string) => {
    try {
      let resolvedCategoryId: string
      let sessionDate: string | null = null
      
      if (categoryId) {
        resolvedCategoryId = categoryId
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('session_date')
          .eq('id', sessionId)
          .single()
        sessionDate = sessionData?.session_date || null
      } else {
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('category_id, session_date')
          .eq('id', sessionId)
          .single()
        if (!sessionData?.category_id) return
        resolvedCategoryId = sessionData.category_id
        sessionDate = sessionData.session_date
      }

      // Carica i giocatori dalla tabella people (come loadPlayers - usa player_categories)
      const { data: allPeople, error: peopleError } = await supabase
        .from('people')
        .select('id, player_categories, created_at')

      if (peopleError || !allPeople) return

      const sessionDateObj = sessionDate ? new Date(sessionDate) : null
      const sessionDateOnly = sessionDateObj ? sessionDateObj.toISOString().split('T')[0] : null

      const allPlayers = (allPeople || []).filter((p: any) => {
        if (!p.player_categories) return false
        const categories = Array.isArray(p.player_categories) 
          ? p.player_categories 
          : (() => { try { return JSON.parse(p.player_categories || '[]') } catch { return [] } })()
        if (!categories.includes(resolvedCategoryId)) return false
        if (sessionDateOnly && p.created_at) {
          try {
            const playerCreated = new Date(p.created_at).toISOString().split('T')[0]
            if (playerCreated > sessionDateOnly) return false
          } catch (_) {}
        }
        return true
      })

      // Carica le presenze esistenti
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', sessionId)

      // Crea la mappa delle presenze
      const attendanceMap: Record<string, { status: string; injured_place?: string }> = {}
      if (attendanceData) {
        attendanceData.forEach(att => {
          attendanceMap[att.player_id] = {
            status: att.status,
            injured_place: att.injured_place
          }
        })
      }

      // CONSOLIDAMENTO: Determina se la sessione è passata
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const isPastSession = sessionDate ? (() => {
        const sessionDateObj = new Date(sessionDate)
        sessionDateObj.setHours(0, 0, 0, 0)
        return sessionDateObj < today
      })() : false
      
      const markedCount = attendanceData?.length || 0

      // Calcola le statistiche
      const unassignedCount = allPlayers.filter(player => !attendanceMap[player.id]).length
      const hasUnassigned = unassignedCount > 0
      const isComplete = !hasUnassigned && allPlayers.length > 0
      const presentCount = allPlayers.filter(player => attendanceMap[player.id]?.status === 'PRESENTE').length
      
      // CONSOLIDAMENTO: Per sessioni passate con presenze salvate, usa markedCount
      // Per sessioni future o passate senza presenze, usa allPlayers.length
      let totalPlayers: number
      if (isPastSession && markedCount > 0) {
        // Sessione passata: usa il numero di presenze salvate (consolidato)
        totalPlayers = markedCount
      } else {
        // Sessione futura o passata senza presenze: usa i giocatori attuali
        totalPlayers = allPlayers.length
      }

      const newStatus = { hasUnassigned, unassignedCount, isComplete, presentCount, totalPlayers }

      // Aggiorna lo stato delle statistiche
      setSessionAttendanceStatus(prev => ({
        ...prev,
        [sessionId]: newStatus
      }))

      // Le presenze vengono gestite dal store globale
    } catch (error) {
      console.error('Errore nel caricamento presenze:', error)
    }
  }

  // Funzione per aggiornare le statistiche di una sessione
  const updateSessionStatus = (sessionId: string) => {
    // Ricarica le statistiche per questa sessione
    const session = sessions.find(s => s.id === sessionId)
    if (session) {
      loadSessionAttendanceStatus(sessionId, session.category_id)
    }
  }

  // Espone la funzione globalmente per essere chiamata da altri componenti
  useEffect(() => {
    (window as any).updateSessionStatus = updateSessionStatus
    return () => {
      delete (window as any).updateSessionStatus
    }
  }, [sessions])



  // Controlla se ci sono presenze per una sessione
  const checkSessionAttendance = async (sessionId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('attendance')
      .select('id')
      .eq('session_id', sessionId)
      .limit(1)

    if (error) {
      console.error('Errore nel controllo presenze:', error)
      return false
    }

    return (data && data.length > 0)
  }

  // Cancella sessione
  const deleteSession = async (sessionId: string) => {
    try {
      // Controlla se ci sono presenze
      const hasAttendance = await checkSessionAttendance(sessionId)
      
      if (hasAttendance) {
        // Mostra il modal di conferma invece di window.confirm
        setSessionToDelete(sessionId)
        setShowDeleteConfirm(true)
        return
      }

      // Cancella prima le presenze (se esistono)
      const { error: attendanceError } = await supabase
        .from('attendance')
        .delete()
        .eq('session_id', sessionId)

      if (attendanceError) {
        console.error('Errore nella cancellazione presenze:', attendanceError)
        alert('Errore nella cancellazione delle presenze')
        return
      }

      // Poi cancella la sessione
      const { error: sessionError } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)

      if (sessionError) {
        console.error('Errore nella cancellazione sessione:', sessionError)
        alert('Errore nella cancellazione della sessione')
        return
      }

      // Ricarica le sessioni
      const categoryCode = searchParams.get('category')
      if (categoryCode) {
        loadCategorySessions(categoryCode)
      }
    } catch (error) {
      console.error('Errore nella cancellazione:', error)
      alert('Errore nella cancellazione della sessione')
    }
  }

  // Conferma cancellazione dal modal
  const confirmDelete = async () => {
    if (!sessionToDelete) return
    
    setShowDeleteConfirm(false)
    
    try {
      // Cancella prima le presenze (se esistono)
      const { error: attendanceError } = await supabase
        .from('attendance')
        .delete()
        .eq('session_id', sessionToDelete)

      if (attendanceError) {
        console.error('Errore nella cancellazione presenze:', attendanceError)
        alert('Errore nella cancellazione delle presenze')
        return
      }

      // Poi cancella la sessione
      const { error: sessionError } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionToDelete)

      if (sessionError) {
        console.error('Errore nella cancellazione sessione:', sessionError)
        alert('Errore nella cancellazione della sessione')
        return
      }

      // Ricarica le sessioni
      const categoryCode = searchParams.get('category')
      if (categoryCode) {
        loadCategorySessions(categoryCode)
      }
    } catch (error) {
      console.error('Errore nella cancellazione:', error)
      alert('Errore nella cancellazione della sessione')
    } finally {
      setSessionToDelete(null)
    }
  }

  // Annulla cancellazione
  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setSessionToDelete(null)
  }

  // Cancella evento
  const deleteEvent = async (eventId: string) => {
    setEventToDelete(eventId)
    setShowEventDeleteConfirm(true)
  }

  // Conferma cancellazione evento
  const confirmEventDelete = async () => {
    if (!eventToDelete) return
    
    setShowEventDeleteConfirm(false)
    
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventToDelete)

      if (error) {
        console.error('Errore nella cancellazione evento:', error)
        alert('Errore nella cancellazione dell\'evento')
        return
      }

      // Ricarica gli eventi
      const categoryCode = searchParams.get('category')
      if (categoryCode) {
        loadCategorySessions(categoryCode)
      }
    } catch (error) {
      console.error('Errore nella cancellazione evento:', error)
      alert('Errore nella cancellazione dell\'evento')
    } finally {
      setEventToDelete(null)
    }
  }

  // Annulla cancellazione evento
  const cancelEventDelete = () => {
    setShowEventDeleteConfirm(false)
    setEventToDelete(null)
  }

  // Funzioni per il modal di creazione eventi
  const generateEventTitle = (opponent: string, location: string, categoryName: string) => {
    if (!opponent) return ''
    
    if (requiresAwayDetail(location)) {
      return `${opponent} vs ${categoryName}`
    } else {
      return `${categoryName} vs ${opponent}`
    }
  }

  const handleLocationChange = (newLocation: string) => {
    const isHome = isHomeVenue(newLocation)
    const newTitle = generateEventTitle(eventForm.opponent, newLocation, categoryName)
    const awayLocation = requiresAwayDetail(newLocation) ? '' : newLocation
    setEventForm(prev => ({
      ...prev,
      location: newLocation,
      is_home: isHome,
      title: newTitle,
      away_location: awayLocation
    }))
  }

  const handleOpponentChange = (newOpponent: string) => {
    const newTitle = generateEventTitle(newOpponent, eventForm.location, categoryName)
    
    setEventForm(prev => ({
      ...prev,
      opponent: newOpponent,
      title: newTitle
    }))
  }

  const handleCheckboxChange = (field: 'is_championship' | 'is_friendly', value: boolean) => {
    setEventForm(prev => ({
      ...prev,
      [field]: value,
      // Se sto selezionando uno, deseleziono l'altro
      [field === 'is_championship' ? 'is_friendly' : 'is_championship']: value ? false : prev[field === 'is_championship' ? 'is_friendly' : 'is_championship']
    }))
  }

  const validateEventForm = () => {
    // Controlla se almeno uno tra campionato o amichevole è selezionato
    if (!eventForm.is_championship && !eventForm.is_friendly) {
      setShowValidationPopup(true)
      return false
    }
    return true
  }

  const handleCreateEvent = async () => {
    if (!validateEventForm()) return
    try {
      const eventData = {
        event_type: eventForm.event_type,
        title: eventForm.title,
        category_id: eventForm.category_id,
        opponent: eventForm.opponent,
        event_date: eventForm.event_date,
        ...(eventForm.event_time && eventForm.event_time.trim() !== '' && { event_time: eventForm.event_time }),
        location: eventForm.location,
        away_location: eventForm.away_location,
        is_home: eventForm.is_home,
        is_championship: eventForm.is_championship,
        is_friendly: eventForm.is_friendly,
        description: eventForm.description
      }
      
      const { error } = await supabase
        .from('events')
        .insert([eventData])

      if (error) {
        console.error('Errore nella creazione evento:', error)
        alert('Errore nella creazione dell\'evento')
        return
      }


      
      alert('✅ Evento creato con successo!')
      
      // Chiudi modal e resetta form
      setShowEventModal(false)
      setEventForm({
        event_type: 'partita',
        title: '',
        category_id: '',
        opponent: '',
        event_date: '',
        event_time: '',
        location: '',
        away_location: '',
        is_home: true,
        is_championship: false,
        is_friendly: false,
        start_time: '',
        end_time: '',
        description: '',
        match_result: ''
      })

      // Ricarica gli eventi
      const categoryCode = searchParams.get('category')
      if (categoryCode) {
        loadCategorySessions(categoryCode)
      }
    } catch (error) {
      console.error('Errore:', error)
      alert('Errore nella creazione dell\'evento')
    }
  }

  const closeEventModal = () => {
    setShowEventModal(false)
    setEventForm({
      event_type: 'partita',
      title: '',
      category_id: '',
      opponent: '',
      event_date: '',
      event_time: '',
      location: '',
      away_location: '',
      is_home: true,
      is_championship: false,
      is_friendly: false,
      start_time: '',
      end_time: '',
      description: '',
      match_result: ''
    })
  }

  const cancelEditSession = () => {
    setEditingSession(null)
    setEditForm({
      session_date: '',
      location: defaultVenueName,
      away_place: '',
      start_time: '',
      end_time: ''
    })
  }

  // Funzioni per le liste gara
  const loadSavedLists = async (categoryId?: string) => {
    try {
      const targetCategoryId = categoryId || currentCategoryId
      console.log('🔍 Loading saved match lists for category:', targetCategoryId)
      
      if (!targetCategoryId) {
        console.warn('⚠️ No category ID available for loading saved lists')
        setSavedLists([])
        return
      }
      
      const { data, error } = await supabase
        .from('match_lists')
        .select(`
          *,
          events(title, event_date)
        `)
        .eq('category_id', targetCategoryId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading saved lists:', error)
        alert('Errore nel caricare le liste salvate')
        return
      }

      console.log('✅ Saved lists loaded:', data)
      setSavedLists(data || [])
    } catch (error) {
      console.error('Error loading saved lists:', error)
      alert('Errore nel caricare le liste salvate')
    }
  }

    const handleMatchListConfirm = async (selectedPlayers: any[], listName: string, listType: string, eventId?: string) => {
      try {
        // Verifica che il profilo sia caricato
        if (!profile) {
          console.error('Profile not loaded')
          alert('Errore: profilo utente non caricato')
          return
        }

        // Ottieni l'ID dell'utente autenticato (deve corrispondere a auth.uid() per la RLS)
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          console.error('Error getting auth user:', authError)
          alert('Errore: utente non autenticato')
          return
        }
        
        // created_by deve essere un ID valido in people.id
        // auth.uid() corrisponde a profiles.id, che potrebbe non essere lo stesso di people.id
        // Quindi dobbiamo usare profiles.person_id che fa riferimento a people.id
        let createdBy: string | null = null
        
        console.log('🔍 DEBUG match_lists created_by:', {
          authUserId: user.id,
          profileId: profile.id,
          profilePersonId: profile.person_id,
          profileEmail: profile.email,
          profileFullName: profile.full_name
        })
        
        // Prima verifica se profile.person_id esiste e punta a un record valido in people
        if (profile.person_id) {
          console.log('🔍 Verificando profile.person_id:', profile.person_id)
          const { data: personData, error: personError } = await supabase
            .from('people')
            .select('id, full_name')
            .eq('id', profile.person_id)
            .maybeSingle()
          
          console.log('🔍 Risultato verifica profile.person_id:', { personData, personError })
          
          if (personError) {
            console.error('Error checking person:', personError)
            alert('Errore nel verificare l\'utente: ' + personError.message)
            return
          }
          
          if (personData) {
            createdBy = profile.person_id
            console.log('✅ Usando profile.person_id come created_by:', createdBy)
          } else {
            console.warn('⚠️ profile.person_id non punta a un record valido, provo con auth.uid()')
            // profile.person_id non punta a un record valido, prova con auth.uid()
            const { data: personByAuthId, error: personByAuthIdError } = await supabase
              .from('people')
              .select('id, full_name')
              .eq('id', user.id)
              .maybeSingle()
            
            console.log('🔍 Risultato verifica auth.uid():', { personByAuthId, personByAuthIdError })
            
            if (personByAuthIdError) {
              console.error('Error checking person by auth.uid():', personByAuthIdError)
              alert('Errore nel verificare l\'utente: ' + personByAuthIdError.message)
              return
            }
            
            if (personByAuthId) {
              createdBy = user.id
              console.log('✅ Usando auth.uid() come created_by:', createdBy)
            } else {
              console.error('❌ Nessun record trovato in people per profile.person_id o auth.uid()')
              alert('Errore: l\'utente non ha un record valido nella tabella people. Contatta l\'amministratore per risolvere il problema.')
              return
            }
          }
        } else {
          console.warn('⚠️ profile.person_id non esiste, provo con auth.uid()')
          // profile.person_id non esiste, prova con auth.uid()
          const { data: personByAuthId, error: personByAuthIdError } = await supabase
            .from('people')
            .select('id, full_name')
            .eq('id', user.id)
            .maybeSingle()
          
          console.log('🔍 Risultato verifica auth.uid():', { personByAuthId, personByAuthIdError })
          
          if (personByAuthIdError) {
            console.error('Error checking person by auth.uid():', personByAuthIdError)
            alert('Errore nel verificare l\'utente: ' + personByAuthIdError.message)
            return
          }
          
          if (personByAuthId) {
            createdBy = user.id
            console.log('✅ Usando auth.uid() come created_by:', createdBy)
          } else {
            console.warn('⚠️ Nessun record trovato in people per auth.uid(), creo un record automaticamente')
            // Crea automaticamente un record in people per l'utente
            const { data: newPerson, error: createPersonError } = await supabase
              .from('people')
              .insert({
                id: user.id, // Usa auth.uid() come ID per people
                full_name: profile.full_name || 'Utente',
                email: profile.email,
                status: 'active',
                is_staff: true,
                staff_categories: profile.staff_categories || []
              })
              .select('id')
              .single()
            
            if (createPersonError) {
              console.error('❌ Errore nella creazione del record people:', createPersonError)
              // Se la creazione fallisce (es. ID già esiste), prova a usare comunque auth.uid()
              // La policy RLS potrebbe comunque permetterlo
              createdBy = user.id
              console.log('⚠️ Usando auth.uid() nonostante l\'errore:', createdBy)
            } else if (newPerson) {
              createdBy = newPerson.id
              console.log('✅ Creato nuovo record in people, usando come created_by:', createdBy)
              
              // Aggiorna anche il profilo con person_id
              await supabase
                .from('profiles')
                .update({ person_id: newPerson.id })
                .eq('id', user.id)
            } else {
              // Fallback: usa auth.uid() comunque
              createdBy = user.id
              console.log('⚠️ Usando auth.uid() come fallback:', createdBy)
            }
          }
        }
        
        if (!createdBy) {
          console.error('❌ createdBy è null dopo tutte le verifiche')
          alert('Errore: impossibile determinare l\'ID dell\'utente per creare la lista.')
          return
        }
        
        console.log('✅ createdBy finale:', createdBy)

        if (editingMatchList) {
          // Modifica lista esistente
          const { data, error } = await supabase
            .from('match_lists')
            .update({
              name: listName,
              type: listType,
              selected_players: selectedPlayers,
              event_id: eventId
            })
            .eq('id', editingMatchList.id)
            .select()

          if (error) {
            console.error('Error updating match list:', error)
            alert('Errore nella modifica della lista gara: ' + error.message)
            return
          }

          console.log('✅ Match list updated:', data)
          alert('Lista gara modificata con successo!')
        } else {
          // Crea nuova lista
          const { data, error } = await supabase
            .from('match_lists')
            .insert({
              name: listName,
              type: listType,
              category_id: currentCategoryId,
              selected_players: selectedPlayers,
              event_id: eventId,
              created_by: createdBy
            })
            .select()

          if (error) {
            console.error('Error creating match list:', error)
            alert('Errore nella creazione della lista gara: ' + error.message)
            return
          }

          console.log('✅ Match list created:', data)
          alert('Lista gara creata con successo!')
        }

        loadSavedLists(currentCategoryId)
        setEditingMatchList(null)
      } catch (error) {
        console.error('Error with match list:', error)
        alert('Errore nella gestione della lista gara: ' + (error as Error).message)
      }
    }


  const editMatchList = (list: any) => {
    // Imposta la lista da modificare
    setEditingMatchList(list)
    // Apri il modal di modifica
    setShowMatchListModal(true)
    // Chiudi il modal delle liste salvate
    setShowSavedListsModal(false)
  }

  const deleteMatchList = async (listId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa lista gara?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('match_lists')
        .delete()
        .eq('id', listId)

      if (error) {
        console.error('Error deleting match list:', error)
        alert('Errore nell\'eliminazione della lista gara')
        return
      }

      alert('✅ Lista gara eliminata con successo!')
      loadSavedLists(currentCategoryId)
    } catch (error) {
      console.error('Error deleting match list:', error)
      alert('Errore nell\'eliminazione della lista gara')
    }
  }

  // Funzione per aprire il modal di copia
  const openCopyModal = (list: any) => {
    setListToCopy(list)
    setShowCopyModal(true)
  }

  // Funzione per visualizzare i dettagli di una lista
  const viewListDetails = async (list: any) => {
    try {
      // Carica i dettagli dei giocatori
      const playerIds = list.selected_players.map((p: any) => p.player_id)
      
      const { data: playersData, error } = await supabase
        .from('people')
        .select('id, full_name')
        .in('id', playerIds)

      if (error) {
        console.error('Error loading players:', error)
        alert('Errore nel caricare i dettagli dei giocatori')
        return
      }

      // Tabella dei ruoli del rugby
      const RUGBY_ROLES: { [key: number]: string } = {
        1: 'Pilone SX', 2: 'Tallonatore', 3: 'Pilone DX', 4: '2^ Linea', 5: '2^ Linea',
        6: 'Flanker', 7: 'Flanker', 8: 'Terza Centro', 9: 'Mediano', 10: 'Apertura',
        11: 'Ala', 12: '1° Centro', 13: '2° Centro', 14: 'Ala', 15: 'Estremo'
      }

      const getRoleFromNumber = (number: number): string => {
        return RUGBY_ROLES[number] || '(a disposizione)'
      }

      // Crea i dettagli dei giocatori
      const playersDetails = list.selected_players.map((selectedPlayer: any) => {
        const player = playersData?.find(p => p.id === selectedPlayer.player_id)
        return {
          player_id: selectedPlayer.player_id,
          number: selectedPlayer.number,
          name: player?.full_name || 'Giocatore non trovato',
          role: getRoleFromNumber(selectedPlayer.number)
        }
      })

      // Ordina per numero
      const sortedPlayers = playersDetails.sort((a: any, b: any) => a.number - b.number)

      // Imposta i dettagli della lista
      setSelectedListDetails({
        ...list,
        playersDetails: sortedPlayers
      })
      
      // Mostra il modal
      setShowListDetailsModal(true)
      
    } catch (error) {
      console.error('Error loading list details:', error)
      alert('Errore nel caricare i dettagli della lista')
    }
  }

  // Funzione per copiare la lista negli appunti
  const copyListToClipboard = async (includeRoles: boolean) => {
    if (!listToCopy) return
    
    try {
      // Carica i dettagli dei giocatori
      const playerIds = listToCopy.selected_players.map((p: any) => p.player_id)
      
      const { data: playersData, error } = await supabase
        .from('people')
        .select('id, full_name')
        .in('id', playerIds)

      if (error) {
        console.error('Error loading players:', error)
        alert('Errore nel caricare i dettagli dei giocatori')
        return
      }

      // Tabella dei ruoli del rugby
      const RUGBY_ROLES: { [key: number]: string } = {
        1: 'Pilone SX', 2: 'Tallonatore', 3: 'Pilone DX', 4: '2^ Linea', 5: '2^ Linea',
        6: 'Flanker', 7: 'Flanker', 8: 'Terza Centro', 9: 'Mediano', 10: 'Apertura',
        11: 'Ala', 12: '1° Centro', 13: '2° Centro', 14: 'Ala', 15: 'Estremo'
      }

      const getRoleFromNumber = (number: number): string => {
        return RUGBY_ROLES[number] || '(a disposizione)'
      }

      // Crea i dettagli dei giocatori
      const playersDetails = listToCopy.selected_players.map((selectedPlayer: any) => {
        const player = playersData?.find(p => p.id === selectedPlayer.player_id)
        return {
          number: selectedPlayer.number,
          name: player?.full_name || 'Giocatore non trovato',
          role: getRoleFromNumber(selectedPlayer.number)
        }
      })

      // Ordina per numero
      const sortedPlayers = playersDetails.sort((a: any, b: any) => a.number - b.number)

      // Crea il testo da copiare
      let text = `📋 ${listToCopy.name}\n`
      text += `━━━━━━━━━━━━━━━━━━━━\n\n`
      text += `👥 GIOCATORI CONVOCATI:\n\n`
      
      if (includeRoles) {
        // CON RUOLI
        sortedPlayers.forEach((player: any) => {
          text += `${player.number}. ${player.name} - ${player.role}\n`
        })
      } else {
        // SENZA RUOLI
        sortedPlayers.forEach((player: any) => {
          text += `${player.number}. ${player.name}\n`
        })
      }

      text += `\n━━━━━━━━━━━━━━━━━━━━\n`
      text += `Totale: ${sortedPlayers.length} giocatori`

      // Copia negli appunti
      await navigator.clipboard.writeText(text)
      
      // Chiudi entrambi i modal
      setShowCopyModal(false)
      setListToCopy(null)
      setShowSavedListsModal(false)
      
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      alert('Errore nel copiare la lista negli appunti')
    }
  }

  const generatePDF = async (list: any) => {
    try {
      // Carica i dettagli dei giocatori
      const playerIds = list.selected_players.map((p: any) => p.player_id)
      
      const { data: playersData, error } = await supabase
        .from('people')
        .select('id, full_name')
        .in('id', playerIds)

      if (error) {
        console.error('Error loading players:', error)
        alert('Errore nel caricare i dettagli dei giocatori')
        return
      }

      // Tabella dei ruoli del rugby
      const RUGBY_ROLES: { [key: number]: string } = {
        1: 'Pilone SX', 2: 'Tallonatore', 3: 'Pilone DX', 4: '2^ Linea', 5: '2^ Linea',
        6: 'Flanker', 7: 'Flanker', 8: 'Terza Centro', 9: 'Mediano', 10: 'Apertura',
        11: 'Ala', 12: '1° Centro', 13: '2° Centro', 14: 'Ala', 15: 'Estremo'
      }

      const getRoleFromNumber = (number: number): string => {
        return RUGBY_ROLES[number] || '(a disposizione)'
      }

      // Crea i dettagli dei giocatori
      const playersDetails = list.selected_players.map((selectedPlayer: any) => {
        const player = playersData?.find(p => p.id === selectedPlayer.player_id)
        return {
          ...selectedPlayer,
          name: player?.full_name || 'Giocatore non trovato',
          role: getRoleFromNumber(selectedPlayer.number)
        }
      })

      // Ordina per numero
      const sortedPlayers = playersDetails.sort((a: any, b: any) => a.number - b.number)

      // Crea il PDF
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      
      // Colori moderni
      const primaryColor = [59, 130, 246] // blue-600
      const secondaryColor = [107, 114, 128] // gray-500
      const accentColor = [16, 185, 129] // emerald-500
      const darkBlue = [30, 58, 138] // blue-800
      
      // Header con gradiente moderno
      doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2])
      doc.rect(0, 0, pageWidth, 50, 'F')
      
      // Carica e inserisce il logo Brixia Rugby
      try {
        // Usa il logo bianco e celeste per lo sfondo scuro
        const logoResponse = await fetch('/logo bianco e celeste.png')
        const logoBlob = await logoResponse.blob()
        const logoUrl = URL.createObjectURL(logoBlob)
        
        // Crea un'immagine temporanea per ottenere le dimensioni originali
        const img = new Image()
        
        // Promisifica il caricamento dell'immagine
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = logoUrl
        })
        
        // Calcola le proporzioni corrette (rapporto aspetto)
        const aspectRatio = img.width / img.height
        
        // Dimensioni desiderate: larghezza 35mm, altezza proporzionale
        const logoWidth = 35
        const logoHeight = logoWidth / aspectRatio
        
        // Posiziona il logo centrato
        const logoX = pageWidth / 2 - logoWidth / 2
        const logoY = 5
        
        // Inserisce il logo con proporzioni corrette
        doc.addImage(logoUrl, 'PNG', logoX, logoY, logoWidth, logoHeight)
        
        // Pulisce l'URL temporaneo
        URL.revokeObjectURL(logoUrl)
      } catch (error) {
        console.warn('Errore nel caricamento del logo, uso testo di fallback:', error)
        // Fallback al testo se il logo non si carica
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(28)
        doc.setFont('helvetica', 'bold')
        doc.text('BRIXIA RUGBY', pageWidth / 2, 20, { align: 'center' })
      }
      
      // Nome della lista con stile elegante (SOTTO il logo, colore bianco)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(255, 255, 255) // Bianco invece di accentColor
      doc.text(list.name, pageWidth / 2, 40, { align: 'center' })
      
      let yPos = 55
      
      // Sezione giocatori con header moderno
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
      doc.rect(15, yPos - 5, pageWidth - 30, 12, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('GIOCATORI CONVOCATI', pageWidth / 2, yPos + 2, { align: 'center' })
      yPos += 15
      
      // Tabella giocatori con design moderno
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2])
      
      // Header tabella
      doc.setFillColor(241, 245, 249) // blue-50
      doc.rect(15, yPos - 5, pageWidth - 30, 8, 'F')
      
      doc.text('N°', 20, yPos)
      doc.text('Nome', 30, yPos)
      doc.text('Ruolo', pageWidth - 50, yPos)
      yPos += 8
      
      // Righe giocatori con design alternato
      doc.setFont('helvetica', 'normal')
      sortedPlayers.forEach((player: any, index: number) => {
        // Alterna colore di sfondo
        if (index % 2 === 0) {
          doc.setFillColor(255, 255, 255)
        } else {
          doc.setFillColor(248, 250, 252) // gray-50
        }
        doc.rect(15, yPos - 5, pageWidth - 30, 8, 'F')
        
        // Bordo sottile
        doc.setDrawColor(229, 231, 235)
        doc.setLineWidth(0.2)
        doc.rect(15, yPos - 5, pageWidth - 30, 8)
        
          // Numero con cerchio colorato (cerchio più piccolo, numero più grande)
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
          doc.circle(20, yPos - 1, 3, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(10) // Aumentato da 9 a 10
          doc.setFont('helvetica', 'bold')
          doc.text(player.number.toString(), 20, yPos, { align: 'center' })
        
        // Nome
        doc.setTextColor(31, 41, 55) // gray-800
        doc.setFontSize(12) // Aumentato da 11 a 12
        doc.setFont('helvetica', 'normal')
        doc.text(player.name, 30, yPos)
        
        // Ruolo con colore accent
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2])
        doc.setFontSize(11) // Aumentato da 10 a 11
        doc.text(player.role, pageWidth - 50, yPos)
        
        yPos += 8
      })
      
      // Footer elegante con gradiente
      const footerY = pageHeight - 25
      doc.setFillColor(17, 24, 39) // gray-900
      doc.rect(0, footerY, pageWidth, 25, 'F')
      
      doc.setTextColor(156, 163, 175) // gray-400
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('Generato automaticamente da Brixia Rugby Management System', pageWidth / 2, footerY + 8, { align: 'center' })
      
      // Data generazione
      const now = new Date()
      const generatedDate = now.toLocaleDateString('it-IT') + ' alle ' + now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      doc.text(`Generato il: ${generatedDate}`, pageWidth / 2, footerY + 15, { align: 'center' })
      
      // Crea il blob del PDF e aprilo con il software del sistema
      const pdfBlob = doc.output('blob')
      const fileName = `${list.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      
      // Crea URL temporaneo e apri in nuova finestra
      const url = URL.createObjectURL(pdfBlob)
      window.open(url, '_blank')
      
      // Pulisci l'URL dopo un breve delay
      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Errore nella generazione del PDF')
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-lg">Caricamento attività...</div>
      </div>
    )
  }

  return (
    <div className={embedInLayout ? 'min-h-full bg-[#EEF3F8]' : 'min-h-screen bg-[#EEF3F8]'}>
      {!embedInLayout && <Header title={categoryName} showBack={true} hideCenterLogo={true} />}
      
      {/* Tab bar: a sinistra sempre la scelta non fatta (Partite se sei in Allenamenti, Allenamenti se sei in Partite). A destra i tag del contesto corrente, sempre gli stessi. */}
      <div className="bg-[#232C4A] border-t border-slate-600 shadow-sm">
        <div className="max-w-[min(1800px,96vw)] w-full mx-auto px-4">
          <div className="flex items-center justify-between">
            {/* Sinistra: sempre la scelta non fatta (per passare all'altra vista) */}
            <div className="flex items-center shrink-0">
              {(mainView === 'allenamenti' || (mainView === 'statistiche' && statsSection === 'allenamenti')) && (
                <button
                  onClick={() => {
                    setMainView('partite')
                    setShowStats(false)
                  }}
                  className="px-4 py-3 font-medium transition-all duration-200 flex items-center space-x-2 text-sm border-b-2 border-transparent text-slate-300 hover:text-white outline-none"
                >
                  <span className="text-base">🏉</span>
                  <span>Partite</span>
                </button>
              )}
              {(mainView === 'partite' || (mainView === 'statistiche' && statsSection === 'partite')) && (
                <button
                  onClick={() => {
                    setMainView('allenamenti')
                    setShowStats(false)
                  }}
                  className="px-4 py-3 font-medium transition-all duration-200 flex items-center space-x-2 text-sm border-b-2 border-transparent text-slate-300 hover:text-white outline-none"
                >
                  <span className="text-base">🏃</span>
                  <span>Allenamenti</span>
                </button>
              )}
            </div>
            {/* Destra: tag del contesto corrente. In Allenamenti sempre: Allenamenti | Statistiche | Nuova Sessione. In Partite sempre: Partite | Statistiche | Nuovo Evento | Lista Gara | Liste Salvate. */}
            <div className="flex items-center justify-center flex-1">
              {/* Contesto Allenamenti: Allenamenti, Statistiche, Nuova Sessione (sempre questa visuale) */}
              {(mainView === 'allenamenti' || (mainView === 'statistiche' && statsSection === 'allenamenti')) && (
                <>
                  <button
                    onClick={() => { setMainView('allenamenti'); setShowStats(false) }}
                    className={`px-4 py-3 font-medium transition-all duration-200 flex items-center space-x-2 text-sm border-b-2 outline-none ${
                      mainView === 'allenamenti' ? 'border-orange-400 text-orange-300' : 'border-transparent text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="text-base">🏃</span>
                    <span>Allenamenti</span>
                  </button>
                  <button
                    onClick={() => {
                      setMainView('statistiche')
                      setShowStats(true)
                      setStatsSection('allenamenti')
                    }}
                    className={`px-4 py-3 font-medium transition-all duration-200 flex items-center space-x-2 text-sm border-b-2 outline-none ${
                      mainView === 'statistiche' ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="text-base">📊</span>
                    <span>Statistiche</span>
                  </button>
                  <button
                    onClick={handleNewSessionClick}
                    className="px-4 py-3 font-medium transition-all duration-200 flex items-center space-x-2 text-sm text-slate-300 hover:text-white border-b-2 border-transparent outline-none"
                  >
                    <span className="text-base">🚀</span>
                    <span>Nuova Sessione</span>
                  </button>
                </>
              )}
              {/* Contesto Partite: Partite, Statistiche, Nuovo Evento, Lista Gara, Liste Salvate (sempre questa visuale) */}
              {(mainView === 'partite' || (mainView === 'statistiche' && statsSection === 'partite')) && (
                <>
                  <button
                    onClick={() => { setMainView('partite'); setShowStats(false) }}
                    className={`px-4 py-3 font-medium transition-all duration-200 flex items-center space-x-2 text-sm border-b-2 outline-none ${
                      mainView === 'partite' ? 'border-green-400 text-green-300' : 'border-transparent text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="text-base">🏉</span>
                    <span>Partite</span>
                  </button>
                  <button
                    onClick={() => {
                      setMainView('statistiche')
                      setShowStats(true)
                      setStatsSection('partite')
                    }}
                    className={`px-4 py-3 font-medium transition-all duration-200 flex items-center space-x-2 text-sm border-b-2 outline-none ${
                      mainView === 'statistiche' ? 'border-sky-400 text-sky-300' : 'border-transparent text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="text-base">📊</span>
                    <span>Statistiche</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate('/events')
                      setTimeout(() => window.dispatchEvent(new CustomEvent('open-create-event')), 0)
                    }}
                    className="px-4 py-3 font-medium transition-all duration-200 flex items-center space-x-2 text-sm text-slate-300 hover:text-white border-b-2 border-transparent outline-none"
                  >
                    <span className="text-base">🏉</span>
                    <span>Nuovo Evento</span>
                  </button>
                  <button
                    onClick={() => setShowMatchListModal(true)}
                    className="px-4 py-3 font-medium transition-all duration-200 flex items-center space-x-2 text-sm text-slate-300 hover:text-white border-b-2 border-transparent outline-none"
                  >
                    <span className="text-base">📋</span>
                    <span>Lista Gara</span>
                  </button>
                  <button
                    onClick={async () => {
                      setShowSavedListsModal(true)
                      let categoryId = currentCategoryId
                      if (!categoryId) {
                        const categoryCode = searchParams.get('category')
                        if (categoryCode) {
                          const { data: categoryData } = await supabase
                            .from('categories')
                            .select('id')
                            .eq('code', categoryCode)
                            .single()
                          categoryId = categoryData?.id
                        }
                      }
                      loadSavedLists(categoryId)
                    }}
                    className="px-4 py-3 font-medium transition-all duration-200 flex items-center space-x-2 text-sm text-slate-300 hover:text-white border-b-2 border-transparent outline-none"
                  >
                    <span className="text-base">📚</span>
                    <span>Liste Salvate</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Header Dashboard - solo per sezione Partite */}
      {mainView === 'statistiche' && statsSection === 'partite' && (
        <div className="max-w-[min(1800px,96vw)] w-full mx-auto px-8">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-b-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">📊 Dashboard {categoryName} - Partite</h2>
                <p className="text-green-100 mt-1">Analisi completa delle performance nelle partite</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">{totalPlayersInMatches}</div>
                <div className="text-sm text-green-100">Giocatori in Campo</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Dashboard - solo per sezione Allenamenti */}
      {mainView === 'statistiche' && statsSection === 'allenamenti' && (
        <div className="max-w-[min(1800px,96vw)] w-full mx-auto px-8">
          <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-b-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">📊 Dashboard {categoryName} - Allenamenti</h2>
                <p className="text-orange-100 mt-1">Analisi completa delle performance negli allenamenti</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">{averageAttendance}%</div>
                <div className="text-sm text-orange-100">Presenza Media</div>
                <div className={`text-sm mt-1 ${monthlyTrend >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                  {monthlyTrend >= 0 ? '↗️' : '↘️'} {Math.abs(monthlyTrend)}% vs mese scorso
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-[min(1800px,96vw)] w-full mx-auto px-8 pb-8 pt-6">
        {/* Dashboard Statistiche Avanzate */}
        {mainView === 'statistiche' && currentCategoryId && (
          <div className="mb-8">
            <StatsDashboard 
              categoryId={currentCategoryId} 
              categoryName={categoryName}
              section={statsSection}
            />
          </div>
        )}

        {/* Card Partite campionato (giocate/totali) + Vinte/Pareggiate/Perse: solo Partite o Statistiche > Partite. Solo campionato, niente amichevoli. */}
        {(mainView === 'partite' || (mainView === 'statistiche' && statsSection === 'partite')) && (
        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Partite campionato: giocate / totali (solo campionato, no amichevoli) */}
                <div className="flex min-h-[86px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-center">
                  <div className="text-2xl font-black text-slate-950">
                    {(() => {
                      const campionatoMatches = events.filter(event =>
                        event.event_type === 'partita' && event.is_championship === true && !(event as any).is_friendly
                      )
                      const played = campionatoMatches.filter(event =>
                        (event as any).match_result && (event as any).match_result.trim() !== ''
                      )
                      return `${played.length}/${campionatoMatches.length}`
                    })()}
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Partite</div>
                </div>
                {/* Vinte: solo campionato, no amichevoli */}
                <div className="flex min-h-[86px] flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-center">
                  <div className="text-2xl font-black text-emerald-700">
                    {(() => {
                      const matches = events.filter(event =>
                        event.event_type === 'partita' && (event as any).match_result && event.is_championship === true && !(event as any).is_friendly
                      )
                      const count = matches.filter(event => {
                        const result = analyzeMatchResult((event as any).match_result, event.is_home || false)
                        return result.status === 'win'
                      }).length
                      return count === 0 ? '-' : count
                    })()}
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-600">Vinte</div>
                </div>
                {/* Pareggiate: solo campionato, no amichevoli */}
                <div className="flex min-h-[86px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-center">
                  <div className="text-2xl font-black text-slate-700">
                    {(() => {
                      const matches = events.filter(event =>
                        event.event_type === 'partita' && (event as any).match_result && event.is_championship === true && !(event as any).is_friendly
                      )
                      const count = matches.filter(event => {
                        const result = analyzeMatchResult((event as any).match_result, event.is_home || false)
                        return result.status === 'draw'
                      }).length
                      return count === 0 ? '-' : count
                    })()}
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Pareggiate</div>
                </div>
                {/* Perse: solo campionato, no amichevoli */}
                <div className="flex min-h-[86px] flex-col items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-center">
                  <div className="text-2xl font-black text-rose-600">
                    {(() => {
                      const matches = events.filter(event =>
                        event.event_type === 'partita' && (event as any).match_result && event.is_championship === true && !(event as any).is_friendly
                      )
                      const count = matches.filter(event => {
                        const result = analyzeMatchResult((event as any).match_result, event.is_home || false)
                        return result.status === 'loss'
                      }).length
                      return count === 0 ? '-' : count
                    })()}
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-[0.12em] text-rose-500">Perse</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Card Statistiche Categoria: solo in Allenamenti (tab) o in Statistiche > Allenamenti */}
        {(mainView === 'allenamenti' || (mainView === 'statistiche' && statsSection === 'allenamenti')) && (
        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex min-h-[86px] items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4">
                  <div className="flex items-center">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center mr-3 shadow-sm">
                      <span className="text-green-400 text-xs">📊</span>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Media Presenze</span>
                  </div>
                  <span className="text-2xl font-black text-emerald-700 shrink-0">
                    {(() => {
                      const totalSessions = sessions.length
                      if (totalSessions === 0) return '-'
                      let totalAttendance = 0, sessionsWithData = 0
                      sessions.forEach(session => {
                        const status = sessionAttendanceStatus[session.id]
                        if (status && status.totalPlayers > 0) {
                          totalAttendance += (status.presentCount / status.totalPlayers) * 100
                          sessionsWithData++
                        }
                      })
                      return sessionsWithData > 0 ? `${Math.round(totalAttendance / sessionsWithData)}%` : '-'
                    })()}
                  </span>
                </div>
                <div className="flex min-h-[86px] items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4">
                  <div className="flex items-center">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center mr-3 shadow-sm">
                      <span className="text-blue-400 text-xs">👥</span>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Giocatori Attivi</span>
                  </div>
                  <span className="text-2xl font-black text-blue-700 shrink-0">{players.length === 0 ? '-' : players.length}</span>
                </div>
                <div className="flex min-h-[86px] items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4">
                  <div className="flex items-center">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center mr-3 shadow-sm">
                      <span className="text-red-400 text-xs">🏥</span>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Infortunati</span>
                  </div>
                  <span className="text-2xl font-black text-rose-600 shrink-0">
                    {(() => {
                      const count = players.filter(p => p.injured).length
                      return count === 0 ? '-' : count
                    })()}
                  </span>
                </div>
                <div className="flex min-h-[86px] items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50 px-4">
                  <div className="flex items-center">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center mr-3 shadow-sm">
                      <span className="text-purple-400 text-xs">🚫</span>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Squalificati</span>
                  </div>
                  <span className="text-2xl font-black text-violet-700 shrink-0">
                    {(() => {
                      const count = players.filter((p: any) => p.disqualified === true).length
                      return count === 0 ? '-' : count
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* In Statistiche > Allenamenti: pulsante Nuova Sessione in evidenza */}
        {mainView === 'statistiche' && statsSection === 'allenamenti' && (
          <div className="mb-8">
            <button
              onClick={handleNewSessionClick}
              className="px-6 py-3 rounded-xl border-2 font-semibold text-white transition-all flex items-center gap-2 hover:opacity-90"
              style={{ backgroundColor: '#232C4A', borderColor: '#475569' }}
            >
              <span className="text-xl">🚀</span>
              Nuova Sessione
            </button>
          </div>
        )}

        {/* Lista sessioni */}
        <div>
          <div className="mb-8">
          </div>
          
          {/* Vista Allenamenti: solo sessioni */}
          {mainView === 'allenamenti' && (
          <>
          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2 text-slate-500">📊</div>
              <p className="text-slate-400">Nessuna sessione trovata per questa categoria</p>
              <p className="text-slate-500 text-sm mt-2">Crea la prima sessione per iniziare</p>
              <button
                onClick={handleNewSessionClick}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                🚀 Crea Prima Sessione
              </button>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {/* Accordion Attivi - si apre/chiude insieme a Effettuati; default aperto */}
              <div className="min-w-0">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] h-full">
                <button
                  onClick={() => setExpandedAccordion(expandedAccordion ? null : 'attivi')}
                  className="flex items-center justify-between w-full py-4 px-5 bg-white text-left font-semibold text-slate-950 border-b border-slate-200 hover:bg-slate-50 transition-all duration-300"
                >
                  <div className="flex items-center space-x-2">
                    <CalendarCheck className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                    <h3 className="text-base font-black">Attivi</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      onClick={(e) => { e.stopPropagation(); setShowAllActiveSessions(prev => !prev) }}
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-100 font-black px-3 py-1.5 rounded-full cursor-pointer hover:bg-blue-100 transition-colors"
                      title={showAllActiveSessions ? 'Mostra solo ultime 4 settimane' : 'Mostra tutti gli allenamenti della stagione'}
                    >
                      ({getActiveSessions().length})
                    </span>
                    <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform duration-300 shrink-0 ${expandedAccordion ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {expandedAccordion && (
                  <div className="px-5 pt-4 pb-5 bg-white">
                    {getActiveSessions().length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-2xl mb-2 text-slate-500">📊</div>
                        <p className="text-slate-400 text-sm">Nessuna sessione attiva</p>
                      </div>
                    ) : (
                      <>
                        {/* Tabella sessioni attive: 4 settimane o tutti (toggle cliccando il numero); presenze oggi: count + % + 👥 (sempre cliccabili per modificare) */}
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full text-sm text-left">
                            <thead className="text-slate-500 bg-slate-50 uppercase">
                              <tr>
                                <th className="px-3 py-2">data</th>
                                <th className="px-3 py-2">giorno</th>
                                <th className="px-3 py-2">Luogo</th>
                                <th className="px-3 py-2">orario</th>
                                <th className="px-3 py-2 text-right">Presenze</th>
                              </tr>
                            </thead>
                            <tbody className="text-slate-800">
                              {[...(showAllActiveSessions ? getActiveSessions() : getActiveSessionsForTable())]
                                .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
                                .map((session) => {
                                  const date = new Date(session.session_date)
                                  const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
                                  const giorno = weekdays[date.getDay()]
                                  const orario = session.start_time && session.end_time
                                    ? `${session.start_time.substring(0, 5)} - ${session.end_time.substring(0, 5)}`
                                    : session.start_time ? session.start_time.substring(0, 5) : '—'
                                  const luogo = requiresAwayDetail(session.location) && session.away_place ? session.away_place : session.location
                                  const status = sessionAttendanceStatus[session.id]
                                  const total = status?.totalPlayers ?? 0
                                  const present = status?.presentCount ?? 0
                                  const unassigned = status?.unassignedCount ?? 0
                                  const pct = total > 0 ? Math.round((present / total) * 100) : 0
                                  const pctColor = pct >= 80 ? 'bg-green-600' : pct >= 65 ? 'bg-amber-500' : 'bg-red-600'
                                  const tuttiConStatus = unassigned === 0 && total > 0
                                  const todayStr = new Date().toISOString().slice(0, 10)
                                  const isSessionToday = session.session_date === todayStr
                                  return (
                                    <tr
                                      key={session.id}
                                      onClick={() => { if (editingSession?.id !== session.id) startEditSession(session) }}
                                      className="border-b border-slate-100 hover:bg-blue-50/60 cursor-pointer transition-colors"
                                    >
                                      <td className="px-3 py-2">{formatDate(session.session_date)}</td>
                                      <td className="px-3 py-2">{giorno}</td>
                                      <td className="px-3 py-2">{luogo}</td>
                                      <td className="px-3 py-2">{orario}</td>
                                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                        {!isSessionToday ? (
                                          <span className="text-slate-500">—</span>
                                        ) : (
                                          <div className="flex items-center justify-end gap-1.5">
                                            {!tuttiConStatus && (
                                              <span className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold" title="Giocatori">{total}</span>
                                            )}
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleOpenAttendancePopup(session.id) }}
                                              className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg text-xs font-bold text-white ${pctColor} hover:opacity-90 transition-opacity`}
                                              title={tuttiConStatus ? 'Modifica presenze' : 'Gestisci presenze'}
                                            >
                                              {pct}%
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleOpenAttendancePopup(session.id) }}
                                              className="p-1.5 text-purple-500 hover:bg-purple-500/20 rounded-lg transition-colors"
                                              title="Gestisci Presenze"
                                            >
                                              <span className="text-lg">👥</span>
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              </div>

              {/* Accordion Effettuati - si apre/chiude insieme ad Attivi; default aperto */}
              <div className="min-w-0">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] h-full">
                <button
                  onClick={() => setExpandedAccordion(expandedAccordion ? null : 'effettuati')}
                  className="flex items-center justify-between w-full py-4 px-5 bg-white text-left font-semibold text-slate-950 border-b border-slate-200 hover:bg-slate-50 transition-all duration-300"
                >
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden />
                    <h3 className="text-base font-black">Effettuati</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      onClick={(e) => { e.stopPropagation(); setShowAllCompletedSessions(prev => !prev) }}
                      className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 font-black px-3 py-1.5 rounded-full cursor-pointer hover:bg-emerald-100 transition-colors"
                      title={showAllCompletedSessions ? 'Mostra solo ultime 4 settimane' : 'Mostra tutte le sessioni effettuate'}
                    >
                      ({getCompletedSessions().length})
                    </span>
                    <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform duration-300 shrink-0 ${expandedAccordion ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {expandedAccordion && (
                  <div className="px-5 pt-4 pb-5 bg-white">
                    {getCompletedSessions().length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-2xl mb-2 text-slate-500">📊</div>
                        <p className="text-slate-400 text-sm">Nessuna sessione completata</p>
                      </div>
                    ) : (
                      <>
                        {/* Tabella sessioni effettuate: come Attivi; Presenze = % + 👥 cliccabili se tutti hanno status */}
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full text-sm text-left">
                            <thead className="text-slate-500 bg-slate-50 uppercase">
                              <tr>
                                <th className="px-3 py-2">data</th>
                                <th className="px-3 py-2">giorno</th>
                                <th className="px-3 py-2">Luogo</th>
                                <th className="px-3 py-2">orario</th>
                                <th className="px-3 py-2 text-right">Presenze</th>
                              </tr>
                            </thead>
                            <tbody className="text-slate-800">
                              {[...(showAllCompletedSessions ? getCompletedSessions() : getCompletedSessionsForTable())]
                                .map((session) => {
                                  const date = new Date(session.session_date)
                                  const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
                                  const giorno = weekdays[date.getDay()]
                                  const orario = session.start_time && session.end_time
                                    ? `${session.start_time.substring(0, 5)} - ${session.end_time.substring(0, 5)}`
                                    : session.start_time ? session.start_time.substring(0, 5) : '—'
                                  const luogo = requiresAwayDetail(session.location) && session.away_place ? session.away_place : session.location
                                  const status = sessionAttendanceStatus[session.id]
                                  const total = status?.totalPlayers ?? 0
                                  const present = status?.presentCount ?? 0
                                  const unassigned = status?.unassignedCount ?? 0
                                  const pct = total > 0 ? Math.round((present / total) * 100) : 0
                                  const pctColor = pct >= 80 ? 'bg-green-600' : pct >= 65 ? 'bg-amber-500' : 'bg-red-600'
                                  const tuttiConStatus = unassigned === 0 && total > 0
                                  return (
                                    <tr
                                      key={session.id}
                                      onClick={() => { if (editingSession?.id !== session.id) startEditSession(session) }}
                                      className="border-b border-slate-100 hover:bg-emerald-50/60 cursor-pointer transition-colors"
                                    >
                                      <td className="px-3 py-2">{formatDate(session.session_date)}</td>
                                      <td className="px-3 py-2">{giorno}</td>
                                      <td className="px-3 py-2">{luogo}</td>
                                      <td className="px-3 py-2">{orario}</td>
                                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                        {tuttiConStatus ? (
                                          <div className="flex items-center justify-end gap-1.5">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleOpenAttendancePopup(session.id) }}
                                              className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-lg text-sm font-bold text-white ${pctColor} hover:opacity-90 transition-opacity`}
                                              title="Modifica presenze"
                                            >
                                              {pct}%
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleOpenAttendancePopup(session.id) }}
                                              className="p-1.5 text-purple-500 hover:bg-purple-500/20 rounded-lg transition-colors"
                                              title="Gestisci Presenze"
                                            >
                                              <span className="text-lg">👥</span>
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-slate-500">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Modal modifica sessione (clic sulla fascia): data, luogo, orario, elimina */}
            {editingSession && (
              <div
                className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                onClick={() => cancelEditSession()}
              >
                <div
                  className="bg-slate-800 rounded-2xl border border-slate-600 shadow-xl max-w-md w-full p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-white mb-4">Modifica sessione</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Data</label>
                      <input
                        type="date"
                        value={editForm.session_date}
                        onChange={(e) => setEditForm(prev => ({ ...prev, session_date: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Luogo</label>
                      <TrainingVenueSelect
                        value={editForm.location}
                        onChange={(value) => setEditForm(prev => ({ ...prev, location: value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {requiresAwayDetail(editForm.location) && (
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Luogo trasferta</label>
                        <input
                          type="text"
                          value={editForm.away_place}
                          onChange={(e) => setEditForm(prev => ({ ...prev, away_place: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white"
                          placeholder="Es. Milano"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Dalle</label>
                        <input
                          type="time"
                          value={editForm.start_time}
                          onChange={(e) => setEditForm(prev => ({ ...prev, start_time: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Alle</label>
                        <input
                          type="time"
                          value={editForm.end_time}
                          onChange={(e) => setEditForm(prev => ({ ...prev, end_time: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    <button
                      onClick={() => saveEditSession()}
                      className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      Salva
                    </button>
                    <button
                      onClick={() => { if (editingSession?.id) deleteSession(editingSession.id); cancelEditSession(); }}
                      className="w-full px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-medium"
                    >
                      Elimina
                    </button>
                    <button
                      onClick={() => cancelEditSession()}
                      className="w-full px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
          </>
          )}

          {/* Vista Partite: solo eventi/partite */}
          {mainView === 'partite' && (
          <>
          {(() => {
            const partiteEvents = events.filter(event => {
              const isMatch = event.event_type === 'MATCH' || event.event_type === 'TOURNAMENT' || event.event_type === 'partita' || event.event_type === 'torneo'
              return isMatch
            })
            if (partiteEvents.length === 0) {
              return (
                <div className="text-center py-12">
                  <div className="text-2xl mb-2 text-slate-500">🏉</div>
                  <p className="text-slate-400">Nessuna partita trovata per questa categoria</p>
                  <p className="text-slate-500 text-sm mt-2">Crea il primo evento partita per iniziare</p>
                  <button
                    onClick={() => { navigate('/events'); setTimeout(() => window.dispatchEvent(new CustomEvent('open-create-event')), 0) }}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    🏉 Nuovo Evento
                  </button>
                </div>
              )
            }
            return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {/* Accordion Partite - si apre/chiude insieme a Giocate; default aperto; solo angoli superiori arrotondati */}
              <div className="min-w-0">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] h-full">
                <button
                  onClick={() => setPartiteGiocateOpen(prev => !prev)}
                  className={`flex items-center justify-between w-full py-4 px-5 bg-white text-left font-semibold text-slate-950 border-b border-slate-200 hover:bg-slate-50 transition-all duration-300 ${!partiteGiocateOpen ? 'border' : ''}`}
                >
                  <div className="flex items-center min-h-[1.5rem] space-x-2">
                    <span className="text-2xl leading-none">🏉</span>
                    <h3 className="text-base font-black m-0 leading-none">Partite</h3>
                    {(() => {
                      const partiteInProgramma = events.filter(event => {
                        const isMatch = event.event_type === 'MATCH' ||
                          event.event_type === 'TOURNAMENT' ||
                          event.event_type === 'partita' ||
                          event.event_type === 'torneo'
                        if (!isMatch) return false
                        const eventDate = new Date(event.event_date)
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        return eventDate >= today
                      })
                      .sort((a, b) => {
                        const dateA = new Date(a.event_date).getTime()
                        const dateB = new Date(b.event_date).getTime()
                        if (dateA !== dateB) return dateA - dateB
                        const timeA = a.start_time || a.event_time || '00:00'
                        const timeB = b.start_time || b.event_time || '00:00'
                        return timeA.localeCompare(timeB)
                      })
                      if (partiteInProgramma.length === 0) return null
                      return (
                        <div className="flex items-center flex-wrap gap-1.5 ml-2 self-center">
                          {partiteInProgramma.map((match, index) => (
                            <div
                              key={`${match.id}-${index}`}
                              className="w-2.5 h-2.5 rounded-full bg-gray-400"
                              title={`${match.title} - In programma`}
                            />
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-orange-50 text-orange-700 border border-orange-100 font-black px-3 py-1.5 rounded-full">({(() => {
                      const matches = events.filter(event => {
                        const isMatch = event.event_type === 'MATCH' || 
                          event.event_type === 'TOURNAMENT' || 
                          event.event_type === 'partita' ||
                          event.event_type === 'torneo'
                        
                        if (!isMatch) return false
                        
                        const eventDate = new Date(event.event_date)
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        
                        return eventDate >= today
                      })
                      return matches.length
                    })()})</span>
                    <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform duration-300 shrink-0 ${partiteGiocateOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {partiteGiocateOpen && (
                  <div className="px-5 pt-4 pb-5 bg-white">
                    {(() => {
                      const partiteDaDisputare = events.filter(event => {
                        const isMatch = event.event_type === 'MATCH' || event.event_type === 'TOURNAMENT' || event.event_type === 'partita' || event.event_type === 'torneo'
                        if (!isMatch) return false
                        const eventDate = new Date(event.event_date)
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        return eventDate >= today
                      }).sort((a, b) => {
                        const dateA = new Date(a.event_date).getTime()
                        const dateB = new Date(b.event_date).getTime()
                        if (dateA !== dateB) return dateA - dateB
                        const timeA = (a.start_time || a.event_time || '00:00').toString().substring(0, 5)
                        const timeB = (b.start_time || b.event_time || '00:00').toString().substring(0, 5)
                        return timeA.localeCompare(timeB)
                      })
                      if (partiteDaDisputare.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <div className="text-2xl mb-2 text-slate-500">🏉</div>
                            <p className="text-slate-400 text-sm">Nessuna partita programmata</p>
                          </div>
                        )
                      }
                      const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
                      const getTipoLabel = (ev: EventType) => {
                        if (ev.event_type === 'TOURNAMENT' || ev.event_type === 'torneo') return 'Torneo'
                        if (ev.event_type === 'partita' && ev.is_championship) return 'Campionato'
                        if (ev.event_type === 'partita' && ev.is_friendly) return 'Amichevole'
                        if (ev.event_type === 'MATCH') return 'Partita'
                        return '—'
                      }
                      const getLuogo = (ev: EventType) => (ev as any).away_location?.trim() || (ev as any).location?.trim() || '—'
                      const ourTeamName = categoryName || pageCategory?.name || ''
                      const getAvversario = (title: string) => {
                        if (!title || !ourTeamName) return title
                        const parts = title.split(/\s+vs\s+/i)
                        if (parts.length !== 2) return title
                        const a = parts[0].trim()
                        const b = parts[1].trim()
                        if (a === ourTeamName) return b
                        if (b === ourTeamName) return a
                        return title
                      }
                      return (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full text-sm text-left">
                            <thead className="text-slate-500 bg-slate-50 uppercase">
                              <tr>
                                <th className="px-3 py-2">Data</th>
                                <th className="px-3 py-2">Giorno</th>
                                <th className="px-3 py-2">Ora</th>
                                <th className="px-3 py-2">Partita</th>
                                <th className="px-3 py-2">Luogo</th>
                                <th className="px-3 py-2">Tipo</th>
                                <th className="px-3 py-2 text-right w-20">Azioni</th>
                              </tr>
                            </thead>
                            <tbody className="text-slate-800">
                              {partiteDaDisputare.map((event) => {
                                const date = new Date(event.event_date)
                                const giorno = weekdays[date.getDay()]
                                const ora = (event.start_time || event.event_time) ? (event.start_time || event.event_time)!.toString().substring(0, 5) : '—'
                                return (
                                  <tr
                                    key={event.id}
                                    onClick={() => {
                                      const returnParams = new URLSearchParams(window.location.search)
                                      returnParams.set('view', mainView)
                                      const returnTo = `${window.location.pathname}?${returnParams.toString()}`
                                      navigate(`/events?eventId=${event.id}&returnTo=${encodeURIComponent(returnTo)}`)
                                    }}
                                    className="border-b border-slate-100 hover:bg-orange-50/60 cursor-pointer transition-colors"
                                  >
                                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(event.event_date)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{giorno}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{ora}</td>
                                    <td className="px-3 py-2 font-medium">{getAvversario(event.title)}</td>
                                    <td className="px-3 py-2">{getLuogo(event)}</td>
                                    <td className="px-3 py-2">
                                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                        getTipoLabel(event) === 'Campionato' ? 'bg-violet-50 text-violet-700 border border-violet-100' :
                                        getTipoLabel(event) === 'Amichevole' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                        'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}>
                                        {getTipoLabel(event)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteEvent(event.id) }}
                                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                        title="Elimina partita"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
              </div>

              {/* Accordion Giocate - si apre/chiude insieme a Partite; default aperto; solo angoli superiori arrotondati */}
              <div className="min-w-0">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] h-full">
                <button
                  onClick={() => setPartiteGiocateOpen(prev => !prev)}
                  className={`flex items-center justify-between w-full py-4 px-5 bg-white text-left font-semibold text-slate-950 border-b border-slate-200 hover:bg-slate-50 transition-all duration-300 ${!partiteGiocateOpen ? 'border' : ''}`}
                >
                  <div className="flex items-center min-h-[1.5rem] space-x-2">
                    <ClipboardList className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden />
                    <h3 className="text-base font-black m-0 leading-none">Giocate</h3>
                    {(() => {
                      const allPastMatches = events.filter(event => {
                        const isMatch = event.event_type === 'partita' &&
                          event.is_championship === true
                        if (!isMatch) return false
                        const eventDate = new Date(event.event_date)
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        return eventDate < today
                      })
                      .sort((a, b) => {
                        const dateA = new Date(a.event_date).getTime()
                        const dateB = new Date(b.event_date).getTime()
                        if (dateA !== dateB) return dateA - dateB
                        const timeA = a.start_time || a.event_time || '00:00'
                        const timeB = b.start_time || b.event_time || '00:00'
                        return timeA.localeCompare(timeB)
                      })
                      if (allPastMatches.length === 0) return null
                      return (
                        <div className="flex items-center flex-wrap gap-1 ml-2 self-center">
                          {allPastMatches.map((match, index) => {
                            const hasResult = (match as any).match_result && (match as any).match_result.trim() !== ''
                            const result = hasResult ? analyzeMatchResult((match as any).match_result, match.is_home) : null
                            const title = hasResult ? `${match.title} - ${result.display}` : `${match.title} - Non giocata`
                            if (!result || result.status === 'unknown') {
                              return <Square key={`${match.id}-${index}`} className="w-4 h-4 text-slate-400 shrink-0 fill-current" title={title} />
                            }
                            if (result.status === 'win') {
                              return <Triangle key={`${match.id}-${index}`} className="w-4 h-4 text-green-500 shrink-0 fill-current" title={title} />
                            }
                            if (result.status === 'loss') {
                              return <Triangle key={`${match.id}-${index}`} className="w-4 h-4 text-red-500 shrink-0 fill-current rotate-180" title={title} />
                            }
                            return <Square key={`${match.id}-${index}`} className="w-4 h-4 text-slate-400 shrink-0 fill-current" title={title} />
                          })}
                        </div>
                      )
                    })()}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 font-black px-3 py-1.5 rounded-full">({(() => {
                      const playedMatches = events.filter(event => {
                        const isMatch = event.event_type === 'partita' && event.is_championship === true
                        if (!isMatch) return false
                        const eventDate = new Date(event.event_date)
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        return eventDate < today
                      })
                      return playedMatches.length
                    })()})</span>
                    <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform duration-300 shrink-0 ${partiteGiocateOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {partiteGiocateOpen && (
                  <div className="px-5 pt-4 pb-5 bg-white">
                    {(() => {
                      const partiteGiocate = events.filter(event => {
                        const isMatch = event.event_type === 'partita' && event.is_championship === true
                        if (!isMatch) return false
                        const eventDate = new Date(event.event_date)
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        return eventDate < today
                      }).sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
                      if (partiteGiocate.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                            <p className="text-slate-400 text-sm">Nessuna partita giocata</p>
                          </div>
                        )
                      }
                      const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
                      const getEsito = (ev: EventType) => {
                        const result = (ev as any).match_result ? analyzeMatchResult((ev as any).match_result, ev.is_home ?? false) : null
                        if (!result || result.status === 'unknown') return { label: '—', class: 'bg-slate-100 text-slate-600 border border-slate-200' }
                        if (result.status === 'win') return { label: 'Vittoria', class: 'bg-emerald-50 text-emerald-700 border border-emerald-100' }
                        if (result.status === 'loss') return { label: 'Sconfitta', class: 'bg-rose-50 text-rose-700 border border-rose-100' }
                        return { label: 'Pareggio', class: 'bg-amber-50 text-amber-700 border border-amber-100' }
                      }
                      const getLuogoGiocate = (ev: EventType) => (ev as any).away_location?.trim() || (ev as any).location?.trim() || '—'
                      const ourTeamNameGiocate = categoryName || pageCategory?.name || ''
                      const getAvversarioGiocate = (title: string) => {
                        if (!title || !ourTeamNameGiocate) return title
                        const parts = title.split(/\s+vs\s+/i)
                        if (parts.length !== 2) return title
                        const a = parts[0].trim()
                        const b = parts[1].trim()
                        if (a === ourTeamNameGiocate) return b
                        if (b === ourTeamNameGiocate) return a
                        return title
                      }
                      return (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full text-sm text-left">
                            <thead className="text-slate-500 bg-slate-50 uppercase">
                              <tr>
                                <th className="px-3 py-2">Data</th>
                                <th className="px-3 py-2">Giorno</th>
                                <th className="px-3 py-2">Luogo</th>
                                <th className="px-3 py-2">Partita</th>
                                <th className="px-3 py-2">Risultato</th>
                                <th className="px-3 py-2">Esito</th>
                                <th className="px-3 py-2 text-right w-28">Azioni</th>
                              </tr>
                            </thead>
                            <tbody className="text-slate-800">
                              {partiteGiocate.map((event) => {
                                const date = new Date(event.event_date)
                                const giorno = weekdays[date.getDay()]
                                const result = (event as any).match_result ? analyzeMatchResult((event as any).match_result, event.is_home ?? false) : null
                                const esito = getEsito(event)
                                return (
                                  <tr
                                    key={event.id}
                                    onClick={() => {
                                      const returnParams = new URLSearchParams(window.location.search)
                                      returnParams.set('view', mainView)
                                      const returnTo = `${window.location.pathname}?${returnParams.toString()}`
                                      navigate(`/events?eventId=${event.id}&returnTo=${encodeURIComponent(returnTo)}`)
                                    }}
                                    className="border-b border-slate-100 hover:bg-emerald-50/60 cursor-pointer transition-colors"
                                  >
                                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(event.event_date)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{giorno}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{getLuogoGiocate(event)}</td>
                                    <td className="px-3 py-2 font-medium">{getAvversarioGiocate(event.title)}</td>
                                    <td className="px-3 py-2 font-semibold">{result ? result.display : '—'}</td>
                                    <td className="px-3 py-2">
                                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${esito.class}`}>{esito.label}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            const { data: existingList } = await supabase.from('match_lists').select('*').eq('event_id', event.id).maybeSingle()
                                            if (existingList) {
                                              editMatchList(existingList)
                                            } else {
                                              setEditingMatchList(null)
                                              setSelectedEventForList(event.id)
                                              setShowMatchListModal(true)
                                            }
                                          }}
                                          className={`p-1.5 rounded-lg transition-colors ${
                                            eventMatchListCounts[event.id] !== undefined
                                              ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/20'
                                              : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/20'
                                          }`}
                                          title={eventMatchListCounts[event.id] !== undefined ? 'Apri lista gara' : 'Lista convocati'}
                                        >
                                          <Users className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); deleteEvent(event.id) }}
                                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                          title="Elimina partita"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
              </div>
            </div>
            )
          })()}
          </>
          )}
        </div>

      </div> {/* <-- CHIUSURA del contenitore .max-w-7xl aperto a ~1804 */}

{/* Modal per le presenze */}
      {showAttendanceModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Presenze – {getCategoryAbbreviation(selectedSession.categories[0]?.code)}</h2>
                  <p className="text-blue-100 mt-1">
                    {selectedSession.session_date} • {selectedSession.location}
                    {selectedSession.away_place && ` • ${selectedSession.away_place}`}
                  </p>
                </div>
                <button
                  onClick={closeAttendanceModal}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Contenuto del modal */}
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-auto">
              {modalLoading ? (
                <div className="text-center py-8">
                  <div className="text-2xl mb-2">⏳</div>
                  <p className="text-gray-500">Caricamento giocatori...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {players.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-2xl mb-2">👥</div>
                      <p>Nessun giocatore trovato per questa categoria</p>
                      <p className="text-xs mt-2">Category ID: {selectedSession?.category_id}</p>
                      <p className="text-xs">Categoria: {selectedSession?.categories?.[0]?.name}</p>
                    </div>
                  ) : (
                    players.map(player => {
                      const current = modalAttendance[player.id]
                      return (
                        <div key={player.id} className="grid grid-cols-[auto,1fr,auto] items-center gap-2 py-1 px-2 border-b border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-gray-200 grid place-items-center font-semibold text-gray-700">
                            {player.family_name[0]}
                          </div>
                          <div className="truncate leading-tight">
                            <div className="font-semibold text-gray-900">{player.family_name} {player.given_name}</div>
                            {current?.status === 'INFORTUNATO' && (
                              <div className="text-xs text-gray-500">{current.injured_place === 'PALESTRA' ? 'Palestra' : 'Casa'}</div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {statuses.map(s => (
                              <StatusPill key={s.key}
                                label={s.short}
                                active={current?.status === s.key}
                                onClick={() => {
                                  if (isAttendanceLocked()) return
                                  
                                  // TOGGLE: Se clicco sullo status già selezionato, lo rimuovo
                                  if (current?.status === s.key) {
                                    removeModalAttendance(player.id)
                                    return
                                  }
                                  
                                  if (s.key === 'INFORTUNATO') {
                                    // toggle rapido: first click = PALESTRA, second = CASA
                                    const next = current?.injured_place === 'PALESTRA' ? 'CASA' : 'PALESTRA'
                                    saveModalAttendance(player.id, 'INFORTUNATO', next)
                                  } else {
                                    saveModalAttendance(player.id, s.key)
                                  }
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal di conferma cancellazione in stile Apple */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-red-600 text-lg">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Conferma Cancellazione</h3>
                  <p className="text-sm text-gray-500">Azione irreversibile</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>ATTENZIONE:</strong> Questa sessione ha già delle presenze registrate.
              </p>
              <p className="text-gray-700 leading-relaxed mt-3">
                Sei sicuro di voler cancellare la sessione? Questa azione cancellerà anche tutte le presenze registrate.
              </p>
              <p className="text-red-600 font-medium mt-3">
                Questa azione non può essere annullata.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 flex space-x-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal di conferma cancellazione evento */}
      {showEventDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-red-600 text-lg">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Conferma Cancellazione</h3>
                  <p className="text-sm text-gray-500">Azione irreversibile</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>ATTENZIONE:</strong> Stai per eliminare definitivamente questa partita.
              </p>
              <p className="text-gray-600 text-sm mt-2">
                Questa azione non può essere annullata.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 flex space-x-3">
              <button
                onClick={cancelEventDelete}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confirmEventDelete}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Piccolo modal di scelta: Allenamento extra oppure Configurazione manuale (tipo quinta immagine) */}
      {showSmallSessionChoiceModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSmallSessionChoiceModal(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl border border-slate-600 shadow-xl px-6 py-4 flex items-center gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowSmallSessionChoiceModal(false)
                const categoryCode = searchParams.get('category')
                if (categoryCode) navigate(`/start-qr?category=${categoryCode}`)
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              <Settings className="w-5 h-5 text-purple-400 shrink-0" aria-hidden />
              <span>Allenamento extra</span>
            </button>
            <button
              onClick={() => {
                setShowSmallSessionChoiceModal(false)
                setShowSessionTypeModal(true)
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              <span>Configurazione manuale</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal per selezione tipo sessione (Singolo / Settimanale / 2 settimane / 4 settimane / Extra) */}
      {showSessionTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">🚀 Nuova Sessione - {categoryName}</h2>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setSessionType('single')
                  setShowSessionTypeModal(false)
                  setShowCreateModal(true)
                }}
                className="w-full p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md"
              >
                <span>🏃 Singolo allenamento</span>
                <span className="text-sm opacity-90">Prossimo giorno disponibile</span>
              </button>

              <button
                onClick={() => {
                  setSessionType('weekly')
                  setShowSessionTypeModal(false)
                  setShowCreateModal(true)
                }}
                className="w-full p-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md"
              >
                <span>📅 Settimanale</span>
                <span className="text-sm opacity-90">Tutti i giorni della settimana</span>
              </button>

              <button
                onClick={() => {
                  setSessionType('biweekly')
                  setShowSessionTypeModal(false)
                  setShowCreateModal(true)
                }}
                className="w-full p-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md"
              >
                <span>📆 2 settimane</span>
                <span className="text-sm opacity-90">Due settimane complete</span>
              </button>

              <button
                onClick={() => {
                  setSessionType('monthly')
                  setShowSessionTypeModal(false)
                  setShowCreateModal(true)
                }}
                className="w-full p-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md"
              >
                <span>🗓️ 4 settimane</span>
                <span className="text-sm opacity-90">Un mese completo</span>
              </button>

              <button
                onClick={() => {
                  setSessionType('extra')
                  setShowSessionTypeModal(false)
                  setShowCreateModal(true)
                }}
                className="w-full p-4 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md"
              >
                <span>⚙️ Allenamento extra</span>
                <span className="text-sm opacity-90">Configurazione manuale</span>
              </button>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={() => setShowSessionTypeModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors"
              >
                ❌ Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal per creazione sessioni */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {sessionType === 'single' && '🏃 Singolo Allenamento'}
              {sessionType === 'weekly' && '📅 Settimanale'}
              {sessionType === 'biweekly' && '📆 2 Settimane'}
              {sessionType === 'monthly' && '🗓️ 4 Settimane'}
              {sessionType === 'extra' && '⚙️ Allenamento Extra'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria: {categoryName}
                </label>
              </div>

              {sessionType !== 'extra' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Note per tutte le sessioni (opzionale)
                  </label>
                  <textarea
                    value={bulkSessionNote}
                    onChange={(e) => setBulkSessionNote(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Es: Allenamento tecnico, preparazione partita..."
                  />
                </div>
              )}

              {sessionType === 'extra' && (
                <div className="text-center py-8">
                  <div className="text-2xl mb-2">⚙️</div>
                  <p className="text-gray-600">Per allenamenti extra, usa il form di creazione manuale</p>
                  <button
                    onClick={() => navigate(`/start-qr?category=${searchParams.get('category')}`)}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Apri Form Manuale
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setSessionType(null)
                  setBulkSessionNote('')
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors"
              >
                ❌ Annulla
              </button>
              {sessionType !== 'extra' && (
                <button
                  onClick={async () => {
                    const categoryCode = searchParams.get('category')
                    if (!categoryCode) return
                    
                    // Trova la categoria corrente
                    const { data: categories } = await supabase
                      .from('categories')
                      .select('*')
                      .eq('code', categoryCode)
                      .single()
                    
                    if (categories) {
                      await createBulkSessions(categories, sessionType!, bulkSessionNote)
                      // Chiudi il modal dopo la creazione
                      setShowCreateModal(false)
                      setSessionType(null)
                      setBulkSessionNote('')
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  ✅ Crea Sessioni
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Popup di successo (grafica webapp) – al posto dell'alert dopo creazione sessioni */}
      {successPopup && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setSuccessPopup(null)}
        >
          <div
            className="bg-slate-800 rounded-2xl border border-slate-600 shadow-xl max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-slate-200 text-base font-medium mb-6">{successPopup.message}</p>
            <button
              onClick={() => setSuccessPopup(null)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium transition-colors"
            >
              Ok
            </button>
          </div>
        </div>
      )}

      <AttendancePopup
        open={showAttendancePopup}
        onClose={handleCloseAttendancePopup}
        onSaveAndExit={handleSaveAndExitAttendance}
        categoryName={currentCategory?.name}
      />
      {/* Modal per creazione eventi */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <h2 className="text-2xl font-bold text-blue-900 mb-6">Crea Nuovo Evento</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Colonna Sinistra */}
              <div className="space-y-4">
                {/* Tipo Evento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo Evento <span className="text-red-500">*</span></label>
                  <select
                    value={eventForm.event_type}
                    onChange={(e) => setEventForm(prev => ({ ...prev, event_type: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="partita">Partita</option>
                    <option value="torneo">Torneo</option>
                  </select>
                </div>

                {/* Categoria */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                  <select
                    value={eventForm.category_id}
                    onChange={(e) => setEventForm(prev => ({ ...prev, category_id: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleziona categoria</option>
                    <option value={currentCategoryId}>{categoryName}</option>
                  </select>
                </div>

                {/* Data Evento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Evento <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={eventForm.event_date}
                    onChange={(e) => setEventForm(prev => ({ ...prev, event_date: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

              </div>

              {/* Colonna Destra */}
              <div className="space-y-4">
                {/* Titolo Evento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Titolo Evento <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={eventForm.title}
                    onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Es. Partita U14 vs Rugby Milano"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Avversario */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Avversario (per partite)</label>
                  <input
                    type="text"
                    value={eventForm.opponent}
                    onChange={(e) => handleOpponentChange(e.target.value)}
                    placeholder="Es. Rugby Milano"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

              </div>
            </div>

            {/* Location e Dove giocare sulla stessa riga */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <TrainingVenueSelect
                  value={eventForm.location}
                  onChange={handleLocationChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dove giocare</label>
                <input
                  type="text"
                  value={eventForm.away_location}
                  onChange={(e) => setEventForm(prev => ({ ...prev, away_location: e.target.value }))}
                  placeholder="Es. Stadio Comunale Milano"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Ora Inizio e Ora Fine (visibili quando è selezionata una location) */}
            {eventForm.location && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ora Inizio</label>
                  <input
                    type="time"
                    value={eventForm.start_time || ''}
                    onChange={(e) => setEventForm(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ora Fine</label>
                  <input
                    type="time"
                    value={eventForm.end_time || ''}
                    onChange={(e) => setEventForm(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Checkboxes */}
            <div className="flex space-x-6 mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={!eventForm.is_home}
                  onChange={(e) => setEventForm(prev => ({ ...prev, is_home: !e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">In trasferta</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={eventForm.is_championship}
                  onChange={(e) => handleCheckboxChange('is_championship', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Campionato</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={eventForm.is_friendly}
                  onChange={(e) => handleCheckboxChange('is_friendly', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Amichevole</span>
              </label>
            </div>

            {/* Descrizione */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
              <textarea
                value={eventForm.description}
                onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrizione dell'evento..."
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Pulsanti */}
            <div className="flex space-x-3">
              <button
                onClick={closeEventModal}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleCreateEvent}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
              >
                Crea Evento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup di validazione elegante */}
      {showValidationPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-orange-600 text-lg">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Selezione Obbligatoria</h3>
                  <p className="text-sm text-gray-500">Scegli il tipo di evento</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-gray-700 leading-relaxed">
                Devi selezionare almeno una delle seguenti opzioni:
              </p>
              <ul className="mt-3 text-gray-600 space-y-1">
                <li>• <strong>Campionato</strong> - per partite ufficiali</li>
                <li>• <strong>Amichevole</strong> - per partite non ufficiali</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowValidationPopup(false)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Ho Capito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal per la creazione liste gara */}
      <MatchListModal
        isOpen={showMatchListModal}
        onClose={() => {
          setShowMatchListModal(false)
          setEditingMatchList(null)
          setSelectedEventForList(null)
        }}
        onConfirm={handleMatchListConfirm}
        categoryId={currentCategoryId || ''}
        editingList={editingMatchList}
        initialEventId={selectedEventForList}
      />

      {/* Modal per visualizzare le liste salvate */}
      {showSavedListsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden border border-gray-200">
            {/* Header - stile app */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Liste Gara Salvate</h2>
                  <p className="text-blue-100 text-sm mt-0.5">Gestisci le liste gara della categoria {categoryName}</p>
                </div>
                <button
                  onClick={() => setShowSavedListsModal(false)}
                  className="text-white hover:text-gray-200 text-xl font-bold p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[calc(85vh-5rem)] overflow-y-auto bg-gray-50">
              {savedLists.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <div className="text-4xl mb-3">📚</div>
                  <h3 className="text-lg font-semibold mb-2">Nessuna Lista Gara</h3>
                  <p className="text-sm mb-4">Non ci sono ancora liste gara salvate per questa categoria.</p>
                  <button
                    onClick={() => {
                      setShowSavedListsModal(false)
                      setShowMatchListModal(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors text-sm"
                  >
                    Crea Prima Lista
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {savedLists.map((list) => (
                    <div key={list.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 text-base truncate min-w-0 flex-1">{list.name}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => viewListDetails(list)}
                          className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                          title="Visualizza dettagli"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => editMatchList(list)}
                          className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg transition-colors"
                          title="Modifica lista"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openCopyModal(list)}
                          className="p-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-600 rounded-lg transition-colors"
                          title="Copia lista"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => generatePDF(list)}
                          className="p-1.5 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-lg transition-colors"
                          title="Genera PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        {list.type === 'match' && (
                          <button
                            onClick={() => {
                              setSelectedMatchList(list)
                              setShowMatchScorecard(true)
                            }}
                            className="p-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-lg transition-colors"
                            title="Tabellino Partita"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => deleteMatchList(list.id)}
                          className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                          title="Elimina lista"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        {list.events && (
                          <p className="text-xs text-gray-600 truncate">
                            📅 {list.events.title} - {new Date(list.events.event_date).toLocaleDateString('it-IT')}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                          <span>👥 {Array.isArray(list.selected_players) ? list.selected_players.length : 0} giocatori</span>
                          <span className="text-gray-500">·</span>
                          <span className="text-gray-500">Creato il {new Date(list.created_at).toLocaleDateString('it-IT')} alle {new Date(list.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal per visualizzare i dettagli delle liste gara */}
      {showListDetailsModal && selectedListDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Dettagli Lista Gara</h2>
                  <p className="text-blue-100 mt-1">{selectedListDetails.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowListDetailsModal(false)
                    setSelectedListDetails(null)
                  }}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              {/* Info lista */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedListDetails.type === 'match' ? 'bg-blue-100 text-blue-800' :
                    selectedListDetails.type === 'friendly' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {selectedListDetails.type === 'match' ? 'Partita' : 
                     selectedListDetails.type === 'friendly' ? 'Amichevole' : 'Allenamento'}
                  </span>
                  <span className="text-sm text-gray-600">
                    {selectedListDetails.playersDetails?.length || 0} giocatori
                  </span>
                </div>
                
                {selectedListDetails.events && (
                  <p className="text-sm text-gray-600 mb-2">
                    📅 {selectedListDetails.events.title} - {new Date(selectedListDetails.events.event_date).toLocaleDateString('it-IT')}
                  </p>
                )}
                
                <p className="text-xs text-gray-500">
                  Creato il {new Date(selectedListDetails.created_at).toLocaleDateString('it-IT')} alle {new Date(selectedListDetails.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Lista giocatori */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Giocatori Convocati</h3>
                <div className="space-y-2">
                  {selectedListDetails.playersDetails?.map((player: any) => (
                    <div key={player.player_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {player.number}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{player.name}</div>
                          <div className="text-sm text-gray-600">{player.role}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t">
              <button
                onClick={() => {
                  setShowListDetailsModal(false)
                  setSelectedListDetails(null)
                }}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal per visualizzare i dettagli delle liste gara */}
      {showListDetailsModal && selectedListDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Dettagli Lista Gara</h2>
                  <p className="text-blue-100 mt-1">{selectedListDetails.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowListDetailsModal(false)
                    setSelectedListDetails(null)
                  }}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              {/* Info lista */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedListDetails.type === 'match' ? 'bg-blue-100 text-blue-800' :
                    selectedListDetails.type === 'friendly' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {selectedListDetails.type === 'match' ? 'Partita' : 
                     selectedListDetails.type === 'friendly' ? 'Amichevole' : 'Allenamento'}
                  </span>
                  <span className="text-sm text-gray-600">
                    {selectedListDetails.playersDetails?.length || 0} giocatori
                  </span>
                </div>
                
                {selectedListDetails.events && (
                  <p className="text-sm text-gray-600 mb-2">
                    📅 {selectedListDetails.events.title} - {new Date(selectedListDetails.events.event_date).toLocaleDateString('it-IT')}
                  </p>
                )}
                
                <p className="text-xs text-gray-500">
                  Creato il {new Date(selectedListDetails.created_at).toLocaleDateString('it-IT')} alle {new Date(selectedListDetails.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Lista giocatori */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Giocatori Convocati</h3>
                <div className="space-y-2">
                  {selectedListDetails.playersDetails?.map((player: any) => (
                    <div key={player.player_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {player.number}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{player.name}</div>
                          <div className="text-sm text-gray-600">{player.role}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t">
              <button
                onClick={() => {
                  setShowListDetailsModal(false)
                  setSelectedListDetails(null)
                }}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal per scegliere formato copia */}
      {showCopyModal && listToCopy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">📋 Copia Lista</h2>
                  <p className="text-yellow-100 mt-1">{listToCopy.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowCopyModal(false)
                    setListToCopy(null)
                  }}
                  className="text-white hover:text-gray-200 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-700 text-center mb-6">
                Come vuoi copiare la lista?
              </p>
              
              <div className="space-y-3">
                {/* Opzione CON RUOLI */}
                <button
                  onClick={() => copyListToClipboard(true)}
                  className="w-full p-4 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 transition-colors group"
                >
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-green-800">Con Ruoli</div>
                      <div className="text-sm text-green-600">Numero, Nome e Ruolo</div>
                    </div>
                  </div>
                </button>

                {/* Opzione SENZA RUOLI */}
                <button
                  onClick={() => copyListToClipboard(false)}
                  className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition-colors group"
                >
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                      #
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-blue-800">Solo Numeri</div>
                      <div className="text-sm text-blue-600">Numero e Nome</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t rounded-b-2xl">
              <button
                onClick={() => {
                  setShowCopyModal(false)
                  setListToCopy(null)
                }}
                className="w-full px-6 py-3 bg-gray-500 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tabellino Partita */}
      {showMatchScorecard && selectedMatchList && (
        <MatchScorecard
          isOpen={showMatchScorecard}
          onClose={() => {
            setShowMatchScorecard(false)
            setSelectedMatchList(null)
          }}
          matchList={selectedMatchList}
        />
      )}
    </div>
  )
}
