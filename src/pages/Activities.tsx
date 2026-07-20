import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '@/store/data'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'
import AttendancePopup from '@/components/AttendancePopup'
import { createAutomaticSession, createMultipleAutomaticSessions } from '@/lib/sessionScheduler'
import { sortNamesBySurname } from '@/lib/sortNames'
import { BarChart2, Trophy, CheckCircle, Layers, Calendar, Rocket, Dumbbell, ChevronDown, ChevronRight, ArrowUp, ArrowDown, RotateCcw, Pencil } from 'lucide-react'
import { getPositionDisplayName } from '@/utils/personUtils'
import { getBrandConfig } from '@/config/brand'
import { getCategoryBgClass, getCategoryCircleClass, getCategoryTextClass } from '@/config/categoryColors'
import { getCategorySortOrder } from '@/config/categories'
import TrainingVenueSelect from '@/components/TrainingVenueSelect'
import { useTrainingVenues } from '@/hooks/useTrainingVenues'
import { readCategoryIds, personHasCategory } from '@/lib/categoryMemberships'

/** Palette Goleee – allineata a Memo, Eventi, Infermeria */
const GOLEE = {
  surface: '#FFFFFF',
  surfaceMuted: '#F4F6F8',
  pageBg: '#E3F2FC',
  gridBg: '#D6EBF7',
  border: '#E8ECF0',
  text: '#1A2332',
  textMuted: '#6B7280',
  accent: '#00C48C',
  accentSoft: '#E6FAF3',
  accentHover: '#00A876',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  success: '#10B981',
  successSoft: '#ECFDF5',
} as const

interface Session {
  id: string
  category_id: string
  session_date: string
  location: string
  away_place?: string
  start_time?: string
  end_time?: string
  created_at: string
  categories: {
    id: string
    code: string
    name: string
  }
}

/** Chiave slot: stessa categoria + giorno + orario inizio = stesso allenamento */
function sessionSlotKey(session: Session, startTime?: string) {
  const start = startTime ?? session.start_time
  const time = start ? String(start).substring(0, 5) : ''
  return `${session.category_id}|${session.session_date}|${time}`
}

/** Tieni una sola sessione per slot (la più recente per created_at) */
function dedupeSessionsBySlot(items: Session[]): Session[] {
  const byKey = new Map<string, Session>()
  for (const session of items) {
    const key = sessionSlotKey(session)
    const existing = byKey.get(key)
    if (!existing || session.created_at > existing.created_at) {
      byKey.set(key, session)
    }
  }
  return Array.from(byKey.values())
}

interface Event {
  id: string
  title: string
  event_date: string
  event_time?: string
  start_time?: string
  end_time?: string
  event_type: string
  category_id: string
  location: string
  away_location?: string
  is_home: boolean
  opponent?: string
  is_championship?: boolean
  is_friendly?: boolean
  description?: string
  participants?: string[]
  invited?: string[]
  created_at: string
  categories?: {
    id: string
    code: string
    name: string
  }
}

interface ActivitiesProps {
  embedInLayout?: boolean
}

export default function Activities({ embedInLayout = false }: ActivitiesProps) {
  const navigate = useNavigate()
  const { requiresAwayDetail } = useTrainingVenues()
  const { currentCategory, currentSession, pickCategory, loadPlayers, players, startSession, attendance, setCurrentSession } = useData()
  const [sessions, setSessions] = useState<Session[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [trainingLocations, setTrainingLocations] = useState<any[]>([])
  const [sessionTimes, setSessionTimes] = useState<{[key: string]: {start_time: string, end_time: string}}>({})
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAttendancePopup, setShowAttendancePopup] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [popupExpanded, setPopupExpanded] = useState(false)
  const [isOpeningPopup, setIsOpeningPopup] = useState(false)
  const [newSession, setNewSession] = useState({
    category_id: '',
    session_date: '',
    location: '',
    away_location: '',
    description: '',
    start_time: '',
    end_time: ''
  })

  // Nuovo sistema di creazione sessioni intelligente
  const [showSessionTypeModal, setShowSessionTypeModal] = useState(false)
  const [selectedCategoryForSession, setSelectedCategoryForSession] = useState<any>(null)
  const [sessionType, setSessionType] = useState<'single' | 'weekly' | 'biweekly' | 'monthly' | 'extra' | null>(null)
  const [bulkSessionNote, setBulkSessionNote] = useState('')
  
  // Statistiche per il dashboard
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    completedSessions: 0,
    categoriesCount: 0,
    averageAttendance: 0
  })

  // Percentuali di presenza per ogni categoria
  const [categoryAttendancePercentages, setCategoryAttendancePercentages] = useState<{[key: string]: number}>({})

  // Modal per i dettagli dell'evento
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [pastEventsAccordionOpen, setPastEventsAccordionOpen] = useState(false)

  // Tab Allenamenti / Prossimi Eventi / Giocatori
  const [activitiesTab, setActivitiesTab] = useState<'allenamenti' | 'eventi' | 'giocatori'>('allenamenti')
  // Filtro categorie multi-selezione sotto i tab (vuoto = tutte)
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([])
  const hasCategoryFilter = selectedCategoryFilters.length > 0

  const toggleCategoryFilter = (categoryId: string) => {
    setSelectedCategoryFilters((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    )
  }

  const sessionMatchesCategoryFilter = (categoryId: string) =>
    !hasCategoryFilter || selectedCategoryFilters.includes(categoryId)
  // Elenco giocatori per tab Giocatori
  const [allPlayersList, setAllPlayersList] = useState<Array<{
    id: string
    full_name: string
    birthYear: number | null
    categoryItems: Array<{ id: string; name: string; code?: string }>
    roleLabel: string
    injured: boolean
    disqualified: boolean
    disqualification_end_date: string | null
  }>>([])
  const [allPlayersLoading, setAllPlayersLoading] = useState(false)
  // Tab Giocatori: ordinamento colonne (null = nessuno, 'asc' | 'desc')
  const [playersTableSort, setPlayersTableSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null)
  // Tab Giocatori: ricerca per nome, cognome, anno, ruolo
  const [playersTableSearch, setPlayersTableSearch] = useState('')

  // Conteggio giocatori in base al filtro categoria (per label tab "Giocatori (N)")
  const playersCountByFilter = hasCategoryFilter
    ? allPlayersList.filter((p) => p.categoryItems.some((c) => selectedCategoryFilters.includes(c.id))).length
    : allPlayersList.length

  useEffect(() => {
    const loadData = async () => {
      await loadAllCategories()
      await loadSessions()
      await loadEvents()
    }
    loadData()
    
    // Cleanup: ripristina lo scroll quando il componente viene smontato
    return () => {
      document.body.style.overflow = 'unset'
      setIsOpeningPopup(false)
    }
  }, [])

  // Carica lo status delle presenze quando le sessioni cambiano
  useEffect(() => {

    if (sessions && sessions.length > 0) {
      sessions.forEach(session => {
        if (session.category_id) {

          loadSessionAttendanceStatus(session.id, session.category_id)
        }
      })
    }
  }, [sessions])

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

  // Funzione helper per determinare il colore di sfondo della sessione (stile coerente con home)
  const getSessionBackgroundColor = (sessionId: string, light = false) => {
    const status = sessionAttendanceStatus[sessionId]
    
    if (status?.isComplete) {
      const percentage = status.totalPlayers > 0 
        ? Math.round((status.presentCount / status.totalPlayers) * 100)
        : 0
      
      if (light) {
        if (percentage >= 75) return 'bg-emerald-50 border-emerald-200'
        if (percentage >= 60) return 'bg-amber-50 border-amber-200'
        return 'bg-red-50 border-red-200'
      }
      if (percentage >= 75) {
        return 'bg-emerald-900 border-emerald-600'
      } else if (percentage >= 60) {
        return 'bg-amber-900 border-amber-600'
      } else {
        return 'bg-red-900 border-red-600'
      }
    }
    
    return light ? 'bg-white border-slate-200' : 'bg-[var(--brixia-primary)] border-[var(--brixia-secondary)]'
  }

  const loadSessions = async () => {
    try {
      // Range: dalla settimana scorsa (14 giorni indietro) fino a 3 settimane avanti, per vedere anche gli allenamenti passati
      const today = new Date()
      const startDateObj = new Date(today)
      startDateObj.setDate(today.getDate() - 14)
      const endDate = new Date(today)
      endDate.setDate(today.getDate() + 21)
      
      const startDate = startDateObj.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          category_id,
          session_date,
          location,
          away_place,
          start_time,
          end_time,
          created_at,
          categories(id, code, name)
        `)
        .gte('session_date', startDate)
        .lte('session_date', endDateStr)
        .order('session_date', { ascending: true })

      if (error) {
        console.error('❌ Errore query sessioni:', error)
        throw error
      }

      // Trasforma i dati per gestire l'array categories
      const transformedSessions = (data || []).map(session => ({
        ...session,
        categories: (session.categories as any) || null
      }))

      const dedupedSessions = dedupeSessionsBySlot(transformedSessions)
      if (dedupedSessions.length < transformedSessions.length) {
        console.warn(
          `⚠️ Sessioni duplicate nascoste: ${transformedSessions.length - dedupedSessions.length} (stessa categoria/giorno/orario)`
        )
      }

      setSessions(dedupedSessions)
      
      // Aggiorna solo le statistiche delle sessioni
      const totalSessions = dedupedSessions.length
      const activeSessions = totalSessions // Tutte le sessioni caricate sono future
      const completedSessions = 0 // Non abbiamo sessioni completate in questa logica
      
      setStats(prevStats => ({
        ...prevStats,
        totalSessions,
        activeSessions,
        completedSessions
      }))
    } catch (error) {
      console.error('Errore nel caricamento sessioni:', error)
    } finally {
      setLoading(false)
    }
  }

  // Stagione sportiva: 1° luglio – 30 giugno (come in FeesManagement)
  const getSeasonStartDate = () => {
    const now = new Date()
    const year = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear()
    return `${year}-07-01`
  }

  const loadEvents = async () => {
    try {
      const today = new Date()
      const endDate = new Date(today)
      endDate.setDate(today.getDate() + 30)
      const startDate = getSeasonStartDate()
      const endDateStr = endDate.toISOString().split('T')[0]
      


      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          event_date,
          event_time,
          start_time,
          end_time,
          event_type,
          category_id,
          location,
          away_location,
          is_home,
          opponent,
          is_championship,
          is_friendly,
          description,
          created_at,
          categories(id, code, name)
        `)
        .gte('event_date', startDate)
        .lte('event_date', endDateStr)
        .order('event_date', { ascending: true })

      // DEBUG: Stampa SUBITO i dati grezzi
      console.log('🔍 SUPABASE RAW DATA:', {
        hasData: !!data,
        dataLength: data?.length,
        firstThree: data?.slice(0, 3)
      })

      // DEBUG: Stampa i valori di orario SEMPLICI
      if (data && data.length > 0) {
        console.log('🔍 ORARI SEMPLICI - Primo evento:', data[0].title, 'start_time:', data[0].start_time, 'event_time:', data[0].event_time)
        console.log('🔍 ORARI SEMPLICI - Secondo evento:', data[1].title, 'start_time:', data[1].start_time, 'event_time:', data[1].event_time)
      }

      if (error) {
        console.error('Errore nel caricamento eventi:', error)
        return
      }

      // Trasforma i dati per gestire l'array categories e convertire i campi time
      const transformedEvents = (data || []).map(event => {
        // Converti i campi time - potrebbero essere stringhe, oggetti Date, o altro
        const formatTime = (timeValue: any) => {
          if (!timeValue) return null
          if (typeof timeValue === 'string') return timeValue
          if (timeValue instanceof Date) return timeValue.toISOString().substring(11, 19) // HH:MM:SS
          // Se è un oggetto, prova a convertirlo
          return String(timeValue)
        }
        
        return {
          ...event,
          event_time: formatTime(event.event_time),
          start_time: formatTime(event.start_time),
          end_time: formatTime(event.end_time),
          categories: (event.categories as any) || null
        }
      })

      // DEBUG: Verifica i primi 3 eventi caricati dal database
      if (transformedEvents.length > 0) {
        console.log('🔍 DATABASE DEBUG - Primi 3 eventi caricati:', transformedEvents.slice(0, 3).map(e => ({
          title: e.title,
          event_date: e.event_date,
          event_time: e.event_time,
          event_time_type: typeof e.event_time,
          start_time: e.start_time,
          start_time_type: typeof e.start_time,
          end_time: e.end_time
        })))
      }

      // DEBUG: Stampa i valori DOPO trasformazione SEMPLICI
      if (transformedEvents.length > 0) {
        console.log('🔍 DOPO TRASFORMAZIONE - Primo evento:', transformedEvents[0].title, 'start_time:', transformedEvents[0].start_time, 'event_time:', transformedEvents[0].event_time)
        console.log('🔍 DOPO TRASFORMAZIONE - Secondo evento:', transformedEvents[1].title, 'start_time:', transformedEvents[1].start_time, 'event_time:', transformedEvents[1].event_time)
      }

      setEvents(transformedEvents)
      
      // Conta tutte le partite e i tornei
      const totalPartite = (data || []).filter(event => 
        event.event_type === 'partita'
      ).length
      
      const totalTornei = (data || []).filter(event => 
        event.event_type === 'torneo'
      ).length
      

      
      // Aggiorna le statistiche con tutte le partite e i tornei
      setStats(prevStats => ({
        ...prevStats,
        activeSessions: totalPartite,
        completedSessions: totalTornei
      }))
      
      // Calcola la media delle presenze tra tutte le categorie
      await calculateAverageAttendance()
    } catch (error) {
      console.error('Errore nel caricamento eventi:', error)
    }
  }

  const calculateAverageAttendance = async () => {
    try {

      
      // Carica tutte le sessioni con le presenze
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          id,
          category_id,
          attendance (
            player_id,
            status
          )
        `)
      
      if (sessionsError) {
        console.error('Errore nel caricamento sessioni per media presenze:', sessionsError)
        return
      }
      
      // Raggruppa le presenze per categoria
      const categoryAttendance: { [categoryId: string]: { total: number, present: number } } = {}
      
      sessionsData?.forEach(session => {
        if (!session.category_id) return
        
        if (!categoryAttendance[session.category_id]) {
          categoryAttendance[session.category_id] = { total: 0, present: 0 }
        }
        
        const attendance = session.attendance || []
        categoryAttendance[session.category_id].total += attendance.length
        categoryAttendance[session.category_id].present += attendance.filter((a: any) => a.status === 'PRESENTE').length
      })
      
      // Calcola la percentuale per ogni categoria e la media generale
      const categoryPercentages: {[key: string]: number} = {}
      const allPercentages: number[] = []
      
      Object.entries(categoryAttendance).forEach(([categoryId, data]) => {
        if (data.total > 0) {
          const percentage = (data.present / data.total) * 100
          categoryPercentages[categoryId] = Math.round(percentage)
          allPercentages.push(percentage)
        }
      })
      
      const averageAttendance = allPercentages.length > 0 
        ? allPercentages.reduce((sum, percentage) => sum + percentage, 0) / allPercentages.length
        : 0
      

      
      // Aggiorna le statistiche con la media delle presenze
      setStats(prevStats => ({
        ...prevStats,
        averageAttendance: Math.round(averageAttendance)
      }))
      
      // Aggiorna le percentuali per ogni categoria
      setCategoryAttendancePercentages(categoryPercentages)
      
    } catch (error) {
      console.error('Errore nel calcolo media presenze:', error)
    }
  }

  const loadAllCategories = async () => {
    try {

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true) // Solo categorie attive
        .order('sort', { ascending: true })

      if (error) {
        console.error('❌ Errore query categorie:', error)
        throw error
      }



      // Filtra e ordina: dal più piccolo al più grande (Serie C prima di Serie B)
      const brixiaCategories = [
        { code: 'U6', name: 'Under 6', sort: 1 },
        { code: 'U8', name: 'Under 8', sort: 2 },
        { code: 'U10', name: 'Under 10', sort: 3 },
        { code: 'U12', name: 'Under 12', sort: 4 },
        { code: 'U14', name: 'Under 14', sort: 5 },
        { code: 'U16', name: 'Under 16', sort: 6 },
        { code: 'U18', name: 'Under 18', sort: 7 },
        { code: 'SERIE_C', name: 'Serie C', sort: 8 },
        { code: 'SERIE_B', name: 'Serie B', sort: 9 },
        { code: 'SENIORES', name: 'Seniores', sort: 10 },
        { code: 'PODEROSA', name: 'Poderosa', sort: 11 },
        { code: 'GUSSAGOLD', name: 'GussagOld', sort: 12 },
        { code: 'BRIXIAOLD', name: 'Brixia Old', sort: 13 },
        { code: 'LEONESSE', name: 'Leonesse', sort: 14 }
      ]

      // Filtra solo le categorie attive e valide
      const filteredCategories = (data || [])
        .filter(cat => cat.active === true) // Solo categorie attive
        .filter(cat => brixiaCategories.some(bc => bc.code === cat.code)) // Solo categorie valide
        .sort((a, b) => {
          const aSort = brixiaCategories.find(bc => bc.code === a.code)?.sort || 999
          const bSort = brixiaCategories.find(bc => bc.code === b.code)?.sort || 999
          return aSort - bSort
        })



      setCategories(filteredCategories)
      
      // Aggiorna le statistiche con il numero corretto di categorie

      
      setStats(prevStats => {
        const newStats = {
          ...prevStats,
          categoriesCount: filteredCategories.length
        }

        return newStats
      })
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const loadAllPlayers = async () => {
    setAllPlayersLoading(true)
    try {
      const { data: positionsData } = await supabase
        .from('player_positions')
        .select('id, name')
        .order('position_order')
      const positionsMap = Object.fromEntries((positionsData || []).map((p: { id: string; name: string }) => [p.id, p.name]))

      const { data: peopleData, error: peopleError } = await supabase
        .from('people')
        .select('id, given_name, family_name, full_name, date_of_birth, player_categories, player_positions, injured, disqualified, disqualification_end_date')
        .or('is_player.eq.true,player_categories.neq.[]')
        .order('family_name', { ascending: true })

      if (peopleError) {
        console.error('Errore nel caricamento giocatori:', peopleError)
        setAllPlayersList([])
        return
      }

      const list = (peopleData || []).filter((p: any) => {
        const cats = readCategoryIds(p.player_categories)
        return cats.length > 0
      }).map((p: any) => {
        const birthYear = p.date_of_birth ? new Date(p.date_of_birth).getFullYear() : null
        const categoryIds = readCategoryIds(p.player_categories)
        const categoryItems = categoryIds
          .map((id: string) => {
            const cat = categories.find(c => c.id === id)
            return cat ? { id: cat.id, name: cat.name, code: cat.code } : null
          })
          .filter(Boolean) as Array<{ id: string; name: string; code?: string | null }>
        const positionIds = Array.isArray(p.player_positions) ? p.player_positions : []
        const roleLabel = positionIds.map((id: string) => getPositionDisplayName(positionsMap[id] || id)).filter(Boolean).join(', ') || '—'
        return {
          id: p.id,
          full_name: p.full_name || [p.given_name, p.family_name].filter(Boolean).join(' ') || '—',
          birthYear,
          categoryItems,
          roleLabel,
          injured: !!p.injured,
          disqualified: !!p.disqualified,
          disqualification_end_date: p.disqualification_end_date || null
        }
      })
      setAllPlayersList(list)
    } catch (e) {
      console.error('Errore loadAllPlayers:', e)
      setAllPlayersList([])
    } finally {
      setAllPlayersLoading(false)
    }
  }

  useEffect(() => {
    if (activitiesTab === 'giocatori' && categories.length > 0) {
      loadAllPlayers()
    }
  }, [activitiesTab, categories.length])

  // Carica le sedi di allenamento per le categorie
  const loadTrainingLocations = async (categoryIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('training_locations')
        .select('*')
        .in('category_id', categoryIds)
        .order('weekday, start_time')

      if (error) throw error

      // Raggruppa per category_id
      const locationsByCategory: { [key: string]: any[] } = {}
      if (data) {
        data.forEach(location => {
          if (!locationsByCategory[location.category_id]) {
            locationsByCategory[location.category_id] = []
          }
          locationsByCategory[location.category_id].push(location)
        })
      }

      return locationsByCategory
    } catch (error) {
      console.error('Errore nel caricamento sedi di allenamento:', error)
      return {}
    }
  }

  const handleCategoryClick = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId)
    if (category) {
      navigate(`/category-activities?category=${category.code}`)
    }
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Validazione campi obbligatori
      if (!newSession.category_id) {
        alert('Seleziona una categoria')
        return
      }
      if (!newSession.session_date) {
        alert('Seleziona una data')
        return
      }
      if (!newSession.location) {
        alert('Seleziona una location')
        return
      }
      if (newSession.location === 'Trasferta' && !newSession.away_location) {
        alert('Specifica dove in trasferta')
        return
      }

      // Determina la location finale
      const finalLocation = newSession.location === 'Trasferta' 
        ? newSession.away_location 
        : newSession.location



      const { data: insertData, error } = await supabase
        .from('sessions')
        .insert({
          category_id: newSession.category_id,
          session_date: newSession.session_date,
          location: newSession.location,
          away_place: newSession.location === 'Trasferta' ? finalLocation : null
          // start_time e end_time verranno aggiunti dopo aver eseguito lo script SQL
        })
        .select()



      if (error) throw error

      // Chiudi modal e ricarica sessioni
      setShowCreateModal(false)
      setNewSession({
        category_id: '',
        session_date: '',
        location: '',
        away_location: '',
        description: '',
        start_time: '',
        end_time: ''
      })
      
      // Ricarica le sessioni
      await loadSessions()
      
    } catch (error) {
      console.error('Errore nella creazione sessione:', error)
    }
  }

  const handleCancelCreate = () => {
    setShowCreateModal(false)
    setNewSession({
      category_id: '',
      session_date: '',
      location: '',
      away_location: '',
      description: '',
      start_time: '',
      end_time: ''
    })
  }

  // ===== NUOVO SISTEMA INTELLIGENTE DI CREAZIONE SESSIONI =====

  // Funzione per aprire il modal di selezione tipo sessione
  const handleNewSessionClick = () => {
    setShowSessionTypeModal(true)
  }

  // Ascolta l'evento dal pulsante nell'header ( quando embedInLayout )
  useEffect(() => {
    const handler = () => setShowSessionTypeModal(true)
    window.addEventListener('open-new-session', handler)
    return () => window.removeEventListener('open-new-session', handler)
  }, [])



  // Funzione per selezionare una categoria e procedere con il tipo di sessione
  const handleCategorySelection = async (category: any) => {
    setSelectedCategoryForSession(category)
    setShowSessionTypeModal(false)
    setShowCreateModal(true)
  }

  // Funzione per calcolare il prossimo giorno di allenamento disponibile
  const getNextAvailableTrainingDay = (trainingLocations: any[], startDate: Date = new Date()) => {
    const weekdayOrder = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
    const today = new Date(startDate)
    
    // Ordina le sedi per giorno della settimana
    const sortedLocations = trainingLocations.sort((a, b) => {
      const aIndex = weekdayOrder.indexOf(a.weekday)
      const bIndex = weekdayOrder.indexOf(b.weekday)
      return aIndex - bIndex
    })

    // Trova il prossimo giorno disponibile
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() + i)
      const dayOfWeek = weekdayOrder[checkDate.getDay() === 0 ? 6 : checkDate.getDay() - 1]
      
      const matchingLocation = sortedLocations.find(loc => loc.weekday === dayOfWeek)
      if (matchingLocation) {
        return {
          date: checkDate,
          location: matchingLocation
        }
      }
    }

    // Se non trova nulla nella settimana corrente, cerca nella prossima
    return getNextAvailableTrainingDay(trainingLocations, new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000))
  }

  // Funzione per creare sessioni multiple
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
        alert(`✅ Sessione creata per ${session.session_date} (${session.location})`)
        
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
        alert(`✅ ${sessions.length} sessioni create con successo!`)
      }
      
      // Ricarica le sessioni
      await loadSessions()
      
      // Chiudi il modal
      setShowSessionTypeModal(false)
      setSessionType(null)
      setBulkSessionNote('')
      
    } catch (error) {
      console.error('❌ Errore nella creazione sessioni:', error)
      alert('❌ Errore nella creazione delle sessioni: ' + (error as Error).message)
    }
  }

  // State per memorizzare lo status delle presenze per ogni sessione
  const [sessionAttendanceStatus, setSessionAttendanceStatus] = useState<Record<string, {
    hasUnassigned: boolean
    unassignedCount: number
    isComplete: boolean
    presentCount: number
    totalPlayers: number
  }>>({})

  // Funzione globale per aggiornare lo status della sessione
  useEffect(() => {
    (window as any).updateSessionStatus = (sessionId: string) => {
      const session = sessions.find(s => s.id === sessionId)
      if (session) {
        loadSessionAttendanceStatus(sessionId, session.category_id)
      }
    }
    
    return () => {
      delete (window as any).updateSessionStatus
    }
  }, [sessions])

  // Funzione per caricare lo status delle presenze per una sessione
  const loadSessionAttendanceStatus = async (sessionId: string, categoryId: string) => {
    try {
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('session_date')
        .eq('id', sessionId)
        .single()
      const sessionDate = sessionData?.session_date || null
      const sessionDateOnly = sessionDate ? new Date(sessionDate).toISOString().split('T')[0] : null

      // Carica tutti i giocatori con player_categories e created_at
      const { data: allPlayers, error: playersError } = await supabase
        .from('people')
        .select('id, given_name, family_name, fir_code, player_categories, created_at')
        .order('family_name', { ascending: true })

      if (playersError) {
        console.error('Errore nel caricamento giocatori:', playersError)
        return
      }

      // Filtra i giocatori per categoria e per data inserimento (solo chi era in rosa alla data della sessione)
      const players = (allPlayers || []).filter((player: any) => {
        if (!personHasCategory(player.player_categories, categoryId)) return false
        if (sessionDateOnly && player.created_at) {
          try {
            const playerCreated = new Date(player.created_at).toISOString().split('T')[0]
            if (playerCreated > sessionDateOnly) return false
          } catch (_) {}
        }
        return true
      })

      if (!players || players.length === 0) {
        setSessionAttendanceStatus(prev => ({
          ...prev,
          [sessionId]: { hasUnassigned: false, unassignedCount: 0, isComplete: false, presentCount: 0, totalPlayers: 0 }
        }))
        return
      }

      // Carica anche gli status di presenza salvati per questa sessione

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('player_id, status')
        .eq('session_id', sessionId)

      console.log('🔍 [loadSessionAttendanceStatus] Attendance Data:', {
        sessionId,
        attendanceData,
        attendanceError
      })

      if (attendanceError) {
        console.error('Errore nel caricamento presenze:', attendanceError)
        return
      }

      // Crea una mappa delle presenze
      const attendanceMap = (attendanceData || []).reduce((acc, record) => {
        acc[record.player_id] = record.status
        return acc
      }, {} as Record<string, string>)

      console.log('🔍 [loadSessionAttendanceStatus] Attendance Map:', attendanceMap)

      // Calcola lo status
      const unassignedCount = players.filter(player => !attendanceMap[player.id]).length
      const hasUnassigned = unassignedCount > 0
      const isComplete = !hasUnassigned && players.length > 0
      const presentCount = players.filter(player => attendanceMap[player.id] === 'PRESENTE').length
      const totalPlayers = players.length

      const newStatus = { hasUnassigned, unassignedCount, isComplete, presentCount, totalPlayers }
      
      setSessionAttendanceStatus(prev => ({
        ...prev,
        [sessionId]: newStatus
      }))

    } catch (error) {
      console.error('Errore nel caricamento status presenze:', error)
    }
  }

  // Funzioni per gestire il popup delle presenze
  const handleOpenAttendancePopup = async (sessionId: string) => {
    // Evita chiamate multiple
    if (isOpeningPopup) return
    
    try {
      setIsOpeningPopup(true)
      // Blocca lo scroll della pagina
      document.body.style.overflow = 'hidden'
      
      // Carica la sessione con la categoria
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          categories(id, code, name)
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        console.error('Errore nel caricamento sessione:', sessionError)
        document.body.style.overflow = 'unset'
        return
      }

      const existingSession = sessions.find(s => s.id === sessionId)
      const times = sessionTimes[sessionId]

      // Imposta la categoria e la sessione nello store
      if (sessionData.categories) {
        const categoryData = Array.isArray(sessionData.categories)
          ? sessionData.categories[0]
          : sessionData.categories
        pickCategory(categoryData)
        setCurrentSession({
          ...sessionData,
          start_time: sessionData.start_time ?? existingSession?.start_time ?? times?.start_time,
          end_time: sessionData.end_time ?? existingSession?.end_time ?? times?.end_time,
          categories: Array.isArray(sessionData.categories) ? sessionData.categories : [categoryData],
        })

        await loadPlayers(categoryData.id, sessionId)
      } else {
        console.error('Nessuna categoria trovata per la sessione')
        document.body.style.overflow = 'unset'
        return
      }
      
      setSelectedSessionId(sessionId)
      setShowAttendancePopup(true)
    } catch (error) {
      console.error('Errore nel caricamento sessione:', error)
      // Ripristina lo scroll in caso di errore
      document.body.style.overflow = 'unset'
    } finally {
      setIsOpeningPopup(false)
    }
  }

  const handleCloseAttendancePopup = () => {
    document.body.style.overflow = 'unset'
    setShowAttendancePopup(false)
    setSelectedSessionId(null)
    setPopupExpanded(false)
    setIsOpeningPopup(false)
  }

  const handleSaveAndExitAttendance = async () => {
    if (currentSession?.id && currentSession.category_id) {
      await loadSessionAttendanceStatus(currentSession.id, currentSession.category_id)
    }
  }

  const handleExpandPopup = () => {
    setPopupExpanded(true)
  }

  const handleCollapsePopup = () => {
    setPopupExpanded(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit'
    })
  }

  // Helper: Ottiene gli ID delle categorie da includere quando "Seniores" è selezionato
  const getCategoryIdsForSeniores = () => {
    const serieB = categories.find(cat => cat.code === 'SERIE_B' || cat.name === 'Serie B')
    const serieC = categories.find(cat => cat.code === 'SERIE_C' || cat.name === 'Serie C')
    const categoryIds: string[] = []
    if (serieB) categoryIds.push(serieB.id)
    if (serieC) categoryIds.push(serieC.id)
    return categoryIds
  }

  // Helper: Verifica se un evento appartiene alla categoria selezionata (considerando "Seniores")
  const eventBelongsToSelectedCategory = (event: Event, selectedCategoryId: string | null) => {
    if (!selectedCategoryId) return true // Nessuna categoria selezionata = mostra tutti
    
    // Se "Seniores" è selezionato (per nome o ID), include Serie B e Serie C
    const selectedCategory = categories.find(cat => cat.id === selectedCategoryId)
    if (selectedCategory && (selectedCategory.name === 'Seniores' || selectedCategory.code === 'SENIORES')) {
      const senioresCategoryIds = getCategoryIdsForSeniores()
      return senioresCategoryIds.includes(event.category_id)
    }
    
    // Altrimenti, filtro normale per categoria
    return event.category_id === selectedCategoryId
  }

  // Filtra eventi per tipo e periodo
  const getFilteredEvents = (eventType: string, days: number, selectedCategoryId: string | null = null) => {
    const today = new Date()
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + days)
    const endDateStr = endDate.toISOString().split('T')[0]
    
    console.log('🔍 getFilteredEvents chiamata con:', { eventType, days, endDateStr, selectedCategoryId })
    console.log('🔍 Eventi disponibili:', events.length)
    
    return events.filter(event => {
      let isCorrectType = false
      
      if (eventType === 'all') {
        // Per 'all' includi TUTTI gli eventi (partite, tornei, altri)
        isCorrectType = true
      } else if (eventType === 'partite_tornei') {
        // Solo partite e tornei
        isCorrectType = (event.event_type === 'partita' || event.event_type === 'torneo')
      } else if (eventType === 'altri') {
        // Solo eventi che NON sono partite o tornei
        isCorrectType = (event.event_type !== 'partita' && event.event_type !== 'torneo')
      }
      
      const isInDateRange = event.event_date <= endDateStr
      const isCorrectCategory = selectedCategoryId ? eventBelongsToSelectedCategory(event, selectedCategoryId) : true
      const result = isCorrectType && isInDateRange && isCorrectCategory
      
      console.log(`🔍 Evento "${event.title}" (${event.event_type}): ${result ? 'INCLUSO' : 'ESCLUSO'} - Tipo: ${isCorrectType}, Data: ${isInDateRange}, Categoria: ${isCorrectCategory}`)
      
      return result
    })
  }

  // Gestisce il click su un evento
  const handleEventClick = (event: Event) => {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  // Ottiene l'icona per l'evento
  const getEventIcon = (event: Event) => {
    // Se è un consiglio, mostra sempre "CON"
    if (event.event_type === 'consiglio') {
      return 'CON'
    }
    
    // Se è un incontro genitori, mostra sempre "GEN"
    if (event.event_type === 'incontro_genitori') {
      return 'GEN'
    }
    
    if (event.categories?.code) {
      // Per Serie C e Serie B, mostra solo la lettera finale
      if (event.categories.code === 'SERIE_C') {
        return 'C'
      }
      if (event.categories.code === 'SERIE_B') {
        return 'B'
      }
      return event.categories.code
    }
    
    const eventTypeLabels: { [key: string]: string } = {
      'partita': 'PARTITA',
      'torneo': 'TORNEO',
      'evento_sociale': 'SOCIALE',
      'raduno': 'RADUNO',
      'festa': 'FESTA',
      'consiglio': 'CONSIGLIO',
      'incontro_genitori': 'GENITORI',
      'incontro_staff': 'STAFF',
      'altro': 'ALTRO'
    }
    
    return eventTypeLabels[event.event_type] || 'EVENTO'
  }

  // Ottiene i dettagli dell'evento
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
      
      if (requiresAwayDetail(session.location)) {
        // Trasferta: orario solo per giorno, senza filtrare per sede fisica
      } else {
        query = query.eq('location', session.location)
      }
      
      const { data, error } = await query.limit(1)

      if (error) {
        // Log dell'errore per debug ma non bloccare l'app
        console.log(`Nessun orario trovato per ${session.categories?.name} - ${weekday} - ${session.location}:`, error.message)
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

  const getEventDetails = (event: Event) => {
    const details = []
    
    // Orari
    if (event.start_time && event.end_time) {
      details.push(`Inizio: ${event.start_time.substring(0, 5)}`)
      details.push(`Fine: ${event.end_time.substring(0, 5)}`)
    } else if (event.event_time) {
      details.push(`Ora: ${event.event_time.substring(0, 5)}`)
    }
    
    // Location
    const location = event.location === 'Trasferta' ? event.away_location : event.location
    if (location) {
      details.push(location)
    }
    
    // Casa/Trasferta
    details.push(event.is_home ? '(Casa)' : '(Trasferta)')
    
    return details.join(' • ')
  }

  // Colori categoria: ogni categoria ha un colore distinto (vedi src/config/categoryColors.ts)
  const getCategoryColor = getCategoryBgClass
  const getCategoryCircleColor = getCategoryCircleClass

  // Funzione per ottenere l'abbreviazione della categoria (Senior/Seniores non vanno mai mostrati; Serie B/C → B/C)
  const getCategoryAbbreviation = (code: string) => {
    const u = (code || '').toUpperCase().trim()
    if (u === 'SENIOR' || u === 'SENIORES') return ''
    if (code?.trim() === 'Seniores' || code?.trim() === 'Senior') return ''
    const codeAbbreviations: { [key: string]: string } = {
      'U6': 'U6', 'U8': 'U8', 'U10': 'U10', 'U12': 'U12', 'U14': 'U14', 'U16': 'U16', 'U18': 'U18',
      'SERIE_C': 'C', 'SERIE_B': 'B', 'PODEROSA': 'POD', 'GUSSAGOLD': 'GUS', 'BRIXIAOLD': 'BRI', 'LEONESSE': 'LEO'
    }
    const nameAbbreviations: { [key: string]: string } = {
      'Under 6': 'U6', 'Under 8': 'U8', 'Under 10': 'U10', 'Under 12': 'U12',
      'Under 14': 'U14', 'Under 16': 'U16', 'Under 18': 'U18',
      'Serie C': 'C', 'Serie B': 'B', 'Poderosa': 'POD', 'GussagOld': 'GUS', 'Brixia Old': 'BRI', 'Leonesse': 'LEO'
    }
    return codeAbbreviations[code] || nameAbbreviations[code] || code
  }

  /** Badge categoria/tipo evento: stessa formattazione per Consiglio (CON) e altre categorie (U14, B, ...). */
  const getEventCategoryBadge = (event: Event): { abbr: string; colorClass: string } => {
    if (event.event_type === 'consiglio') {
      return { abbr: 'CON', colorClass: 'bg-blue-600 text-white' }
    }
    if (event.event_type === 'incontro_genitori') {
      return { abbr: 'GEN', colorClass: 'bg-blue-600 text-white' }
    }
    if (event.categories?.code) {
      return {
        abbr: getCategoryAbbreviation(event.categories.code),
        colorClass: getCategoryCircleColor(event.categories)
      }
    }
    if (event.categories?.name) {
      const abbr = getCategoryAbbreviation(event.categories.name) || event.categories.name.slice(0, 3)
      return { abbr, colorClass: 'bg-blue-600 text-white' }
    }
    return { abbr: '—', colorClass: 'bg-gray-600 text-white' }
  }

  // Funzioni per raggruppare per data
  const groupByDate = (items: any[]) => {
    console.log('🔍 GROUPBYDATE DEBUG - Items ricevuti:', items.length, 'eventi')
    if (items.length > 0) {
      console.log('🔍 GROUPBYDATE DEBUG - Primo evento ricevuto:', {
        title: items[0].title,
        start_time: items[0].start_time,
        event_time: items[0].event_time,
        event_date: items[0].event_date
      })
    }
    
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
        console.log('🔍 ACTIVITIES DEBUG - Eventi da ordinare:', {
          eventA: { 
            title: a.title, 
            event_time: a.event_time, 
            start_time: a.start_time,
            event_date: a.event_date,
            fullEventA: a
          },
          eventB: { 
            title: b.title, 
            event_time: b.event_time, 
            start_time: b.start_time,
            event_date: b.event_date,
            fullEventB: b
          }
        })
        
        // Ordina per orario crescente se hanno la stessa data
        // Usa start_time se disponibile, altrimenti event_time (LOGICA CORRETTA da Events.tsx)
        const timeA = a.start_time || a.event_time || '00:00'
        const timeB = b.start_time || b.event_time || '00:00'
        
        console.log('🔍 ACTIVITIES DEBUG - Tempi estratti:', { timeA, timeB, comparison: timeA.localeCompare(timeB) })
        
        return timeA.localeCompare(timeB)
      })
    }))
  }

  // Funzione per limitare le sessioni a 6 per categoria
  const limitSessionsPerCategory = (sessions: Session[], limit: number = 6) => {
    const categorySessions: { [categoryId: string]: Session[] } = {}
    
    // Raggruppa per categoria
    sessions.forEach(session => {
      if (!categorySessions[session.category_id]) {
        categorySessions[session.category_id] = []
      }
      categorySessions[session.category_id].push(session)
    })
    
    // Limita a 6 sessioni per categoria e riunisci
    const limitedSessions: Session[] = []
    Object.values(categorySessions).forEach(categorySessionList => {
      const sortedSessions = categorySessionList.sort((a, b) => 
        new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
      )
      limitedSessions.push(...sortedSessions.slice(0, limit))
    })
    
    return limitedSessions.sort((a, b) => 
      new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
    )
  }

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString)
    const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
    const weekday = weekdays[date.getDay()]
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    
    return `${weekday}, ${day}/${month}`
  }

  // Raggruppa sessioni per settimana (lun–ven) e poi per giorno; una riga = una settimana, 5 colonne
  const getMonday = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setDate(d.getDate() + diff)
    return monday.toISOString().slice(0, 10)
  }

  const getSessionStartTime = (session: Session) => {
    const t = sessionTimes[session.id]?.start_time ?? session.start_time
    return t ? String(t).substring(0, 5) : '99:99'
  }

  const compareSessionsByTimeAndCategory = (a: Session, b: Session) => {
    const timeCmp = getSessionStartTime(a).localeCompare(getSessionStartTime(b))
    if (timeCmp !== 0) return timeCmp
    return getCategorySortOrder(a.categories?.code ?? '') - getCategorySortOrder(b.categories?.code ?? '')
  }

  const dedupeSessionsForDisplay = (items: Session[]) => {
    const byKey = new Map<string, Session>()
    for (const session of items) {
      const key = sessionSlotKey(session, sessionTimes[session.id]?.start_time)
      const existing = byKey.get(key)
      if (!existing || session.created_at > existing.created_at) {
        byKey.set(key, session)
      }
    }
    return Array.from(byKey.values())
  }

  const groupByWeekAndWeekday = (items: Session[]) => {
    const byWeek: Record<string, Record<string, Session[]>> = {}
    items.forEach((session) => {
      const weekKey = getMonday(session.session_date)
      if (!byWeek[weekKey]) byWeek[weekKey] = {}
      const dateKey = session.session_date
      if (!byWeek[weekKey][dateKey]) byWeek[weekKey][dateKey] = []
      byWeek[weekKey][dateKey].push(session)
    })
    const sortedWeeks = Object.keys(byWeek).sort((a, b) => a.localeCompare(b))
    return sortedWeeks.map((weekMonday) => {
      const weekStart = new Date(weekMonday + 'T12:00:00')
      const days: { date: string; label?: string; items: Session[] }[] = []
      for (let i = 0; i < 5; i++) {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        const dateStr = d.toISOString().slice(0, 10)
        const daySessions = (byWeek[weekMonday][dateStr] || []).sort(compareSessionsByTimeAndCategory)
        days.push({ date: dateStr, items: daySessions })
      }
      const satStr = new Date(weekStart)
      satStr.setDate(weekStart.getDate() + 5)
      const sunStr = new Date(weekStart)
      sunStr.setDate(weekStart.getDate() + 6)
      const weekendSessions = [
        ...(byWeek[weekMonday][satStr.toISOString().slice(0, 10)] || []),
        ...(byWeek[weekMonday][sunStr.toISOString().slice(0, 10)] || [])
      ].sort((a, b) => {
        const dateCmp = new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
        return dateCmp !== 0 ? dateCmp : compareSessionsByTimeAndCategory(a, b)
      })
      if (weekendSessions.length > 0) {
        days.push({ date: weekMonday, label: 'Sab/Dom', items: weekendSessions })
      }
      return { weekMonday, days }
    })
  }

  type WeekGrid = ReturnType<typeof groupByWeekAndWeekday>[number]

  const buildEmptyWeek = (weekMondayStr: string): WeekGrid => {
    const weekStart = new Date(weekMondayStr + 'T12:00:00')
    const days: { date: string; label?: string; items: Session[] }[] = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      days.push({ date: d.toISOString().slice(0, 10), items: [] })
    }
    return { weekMonday: weekMondayStr, days }
  }

  const buildConsecutiveWeeks = (startMondayStr: string, count: number, sessionWeeks: WeekGrid[]) => {
    const weekMap = new Map(sessionWeeks.map((w) => [w.weekMonday, w]))
    const weeks: WeekGrid[] = []
    const monday = new Date(startMondayStr + 'T12:00:00')
    for (let i = 0; i < count; i++) {
      const key = monday.toISOString().slice(0, 10)
      weeks.push(weekMap.get(key) ?? buildEmptyWeek(key))
      monday.setDate(monday.getDate() + 7)
    }
    return weeks
  }

  const brand = getBrandConfig()
  const { primary, secondary, dark } = brand.colors
  const embedLight = embedInLayout

  const activityTabs: { id: 'allenamenti' | 'eventi' | 'giocatori'; label: string }[] = [
    { id: 'allenamenti', label: 'Allenamenti' },
    { id: 'eventi', label: 'Prossimi Eventi' },
    { id: 'giocatori', label: `Giocatori (${playersCountByFilter})` },
  ]

  const renderActivitiesTabs = () => (
    <div
      className={`flex flex-wrap gap-1 ${embedLight ? 'px-4 pt-2 pb-0 border-b shrink-0' : 'border-b'}`}
      style={embedLight ? { borderColor: GOLEE.border } : { borderColor: `${secondary}30` }}
    >
      {activityTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActivitiesTab(tab.id)}
          className={`px-4 py-2 font-semibold transition-colors border-b-2 -mb-px focus:outline-none ${
            embedLight
              ? activitiesTab === tab.id
                ? 'border-[#00C48C] text-sm'
                : 'border-transparent hover:border-[#00C48C]/40 text-sm'
              : activitiesTab === tab.id
                ? 'w-[11rem] py-3 px-4 text-white border-b-2 text-base shrink-0 text-center'
                : 'w-[11rem] py-3 px-4 text-sm shrink-0 text-center'
          }`}
          style={
            embedLight
              ? { color: activitiesTab === tab.id ? GOLEE.text : GOLEE.textMuted }
              : activitiesTab === tab.id
                ? { backgroundColor: primary, borderBottomColor: secondary }
                : { color: secondary }
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  )

  const renderCategoryFilterRow = () => (
    <div
      className={`flex w-full flex-wrap gap-1.5 ${embedLight ? 'px-4 py-2 border-b' : 'border-t border-b'}`}
      style={embedLight ? { borderColor: GOLEE.border } : { borderColor: '#ffffff', backgroundColor: `${primary}66` }}
    >
      <button
        type="button"
        onClick={() => setSelectedCategoryFilters([])}
        className={
          embedLight
            ? `flex-1 min-w-[4.5rem] rounded-lg py-1.5 text-xs font-medium border transition-colors ${!hasCategoryFilter ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`
            : `flex-1 min-w-0 py-3 text-sm font-medium transition-all border-r border-white/20 ${categories.length === 0 ? 'border-r-0' : ''}`
        }
        style={
          !embedLight
            ? !hasCategoryFilter
              ? { backgroundColor: '#ffffff', color: primary }
              : { backgroundColor: `${primary}99`, color: secondary }
            : undefined
        }
      >
        Tutte
      </button>
      {categories.map((cat) => {
        const isSelected = selectedCategoryFilters.includes(cat.id)
        return (
        <button
          key={cat.id}
          type="button"
          onClick={() => toggleCategoryFilter(cat.id)}
          className={
            embedLight
              ? `flex-1 min-w-[4.5rem] rounded-lg py-1.5 text-xs font-medium border transition-colors ${getCategoryTextClass(cat)} ${getCategoryColor(cat)} ${isSelected ? 'ring-2 ring-offset-1 ring-slate-800 shadow-md scale-[1.02]' : 'opacity-90 hover:opacity-100'}`
              : `flex-1 min-w-0 py-3 text-sm font-medium transition-all border-r border-white/20 last:border-r-0 ${getCategoryTextClass(cat)} ${getCategoryColor(cat)} ${isSelected ? 'opacity-100 ring-2 ring-inset ring-white/70' : 'opacity-80 hover:opacity-100'}`
          }
        >
          {cat.name}
          {embedLight && categoryAttendancePercentages[cat.id] != null && (
            <span className="ml-0.5 opacity-90">({categoryAttendancePercentages[cat.id]}%)</span>
          )}
        </button>
        )
      })}
    </div>
  )

  const content = (
    <>
    <div
      className={`w-full min-w-0 flex flex-col ${embedLight ? 'p-4 gap-3 flex-1 min-h-0' : 'p-6'}`}
      style={embedLight ? { backgroundColor: GOLEE.pageBg } : undefined}
    >
        {/* Statistiche */}
        <div className={`flex flex-wrap ${embedLight ? 'gap-2 shrink-0' : 'gap-4 mb-6'}`}>
          {(embedLight
            ? [
                { icon: BarChart2, label: 'Sessioni totali', value: stats.totalSessions, sub: stats.averageAttendance != null ? `(${stats.averageAttendance}%)` : null, iconBg: GOLEE.accentSoft, iconColor: GOLEE.accent },
                { icon: Trophy, label: 'Totale partite', value: stats.activeSessions, sub: null, iconBg: GOLEE.infoSoft, iconColor: GOLEE.info },
                { icon: CheckCircle, label: 'Totali tornei', value: stats.completedSessions, sub: null, iconBg: GOLEE.warningSoft, iconColor: GOLEE.warning },
                { icon: Layers, label: 'Categorie', value: stats.categoriesCount, sub: null, iconBg: GOLEE.successSoft, iconColor: GOLEE.success },
              ]
            : null
          )?.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="flex-1 min-w-[120px] rounded-xl p-2.5 border shadow-sm"
                style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: item.iconBg }}>
                    <Icon className="w-4 h-4" style={{ color: item.iconColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: GOLEE.textMuted }}>{item.label}</p>
                    <p className="text-lg font-bold leading-tight" style={{ color: GOLEE.text }}>
                      {item.value}
                      {item.sub && <span className="text-xs font-normal ml-1" style={{ color: GOLEE.textMuted }}>{item.sub}</span>}
                    </p>
                  </div>
                </div>
              </div>
            )
          }) ?? (
            <>
          <div className="flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg transition-all duration-200 hover:scale-[1.02] text-center backdrop-blur border" style={{ background: `linear-gradient(145deg, ${primary} 0%, ${dark} 100%)`, borderColor: `${secondary}50` }}>
            <div className="text-2xl font-bold" style={{ color: secondary }}>{stats.totalSessions}</div>
            <div className="text-sm text-white/90 mt-0.5">Sessioni totali</div>
            {stats.averageAttendance != null && <div className="text-xs text-blue-200/70 mt-0.5">({stats.averageAttendance}%)</div>}
          </div>
          <div className="flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg transition-all duration-200 hover:scale-[1.02] text-center backdrop-blur border" style={{ background: `linear-gradient(145deg, ${primary} 0%, ${dark} 100%)`, borderColor: `${secondary}50` }}>
            <div className="text-2xl font-bold" style={{ color: secondary }}>{stats.activeSessions}</div>
            <div className="text-sm text-white/90">Totale partite</div>
          </div>
          <div className="flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg transition-all duration-200 hover:scale-[1.02] text-center backdrop-blur border" style={{ background: `linear-gradient(145deg, ${primary} 0%, ${dark} 100%)`, borderColor: `${secondary}50` }}>
            <div className="text-2xl font-bold" style={{ color: secondary }}>{stats.completedSessions}</div>
            <div className="text-sm text-white/90">Totali tornei</div>
          </div>
          <div className="flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg transition-all duration-200 hover:scale-[1.02] text-center backdrop-blur border" style={{ background: `linear-gradient(145deg, ${primary} 0%, ${dark} 100%)`, borderColor: `${secondary}50` }}>
            <div className="text-2xl font-bold" style={{ color: secondary }}>{stats.categoriesCount}</div>
            <div className="text-sm text-white/90">Categorie</div>
          </div>
            </>
          )}
        </div>

        {/* Navigazione categorie – click apre l'area della categoria */}
        <div
          className={`overflow-hidden shrink-0 ${embedLight ? 'rounded-xl border shadow-sm flex flex-wrap gap-1.5 p-2' : 'rounded-2xl mb-6 shadow-lg backdrop-blur-xl border'}`}
          style={embedLight ? { backgroundColor: GOLEE.surface, borderColor: GOLEE.border } : { backgroundColor: `${primary}99`, borderColor: `${secondary}40` }}
        >
          {embedLight ? (
            categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategoryClick(category.id)}
                className={`flex-1 min-w-[4.5rem] rounded-lg py-1.5 px-2 text-xs font-medium transition-all border ${getCategoryColor(category)} ${getCategoryTextClass(category)} hover:opacity-90 flex items-center justify-center`}
              >
                {category.name}
                {categoryAttendancePercentages[category.id] != null && (
                  <span className="ml-0.5 opacity-90">({categoryAttendancePercentages[category.id]}%)</span>
                )}
              </button>
            ))
          ) : (
          <div className="flex w-full">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategoryClick(category.id)}
                className={`flex-1 min-w-0 py-3 px-2 text-sm font-medium transition-all duration-200 border-r border-white/10 last:border-r-0 first:rounded-l-2xl last:rounded-r-2xl ${getCategoryColor(category)} ${getCategoryTextClass(category)} hover:opacity-90 flex items-center justify-center`}
              >
                {category.name}
                {categoryAttendancePercentages[category.id] != null && (
                  <span className="ml-1 opacity-90">({categoryAttendancePercentages[category.id]}%)</span>
                )}
              </button>
            ))}
          </div>
          )}
        </div>

        {/* Pulsanti azioni – solo se non in layout */}
        {!embedInLayout && (
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={handleNewSessionClick}
              className="px-4 py-2 rounded-lg border text-white font-medium transition-all flex items-center gap-2 hover:opacity-90"
              style={{ backgroundColor: secondary, borderColor: `${secondary}80` }}
            >
              <Rocket className="w-4 h-4" />
              Nuova Sessione
            </button>
            <button
              onClick={() => navigate('/events')}
              className="px-4 py-2 rounded-lg border font-medium transition-all flex items-center gap-2 hover:opacity-90"
              style={{ backgroundColor: `${primary}99`, borderColor: `${secondary}50`, color: secondary }}
            >
              <Calendar className="w-4 h-4" />
              Gestione Eventi
            </button>
          </div>
        )}

        {/* Contenuto: tab Allenamenti / Prossimi Eventi / Giocatori */}
        <div
          className={`overflow-hidden flex flex-col min-h-0 ${embedLight ? 'flex-1 rounded-2xl border shadow-sm' : 'shadow-lg backdrop-blur-xl border'}`}
          style={embedLight ? { backgroundColor: GOLEE.surface, borderColor: GOLEE.border } : { backgroundColor: `${primary}ee`, borderColor: `${secondary}40` }}
        >
        <div className={embedLight ? 'flex flex-col flex-1 min-h-0' : undefined}>
          {renderActivitiesTabs()}
          {renderCategoryFilterRow()}
          {loading ? (
            <div className="text-center py-8">
              <div className="text-2xl mb-2" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>⏳</div>
              <p className="text-sm" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>Caricamento...</p>
            </div>
          ) : activitiesTab === 'allenamenti' ? (
            /* Tab Allenamenti */
            <div className={embedLight ? 'flex flex-col flex-1 min-h-0' : undefined}>
              <div className={embedLight ? 'flex-1 min-h-0 overflow-auto p-3' : 'p-4'}>
            {(() => {
              const filteredSessions = dedupeSessionsForDisplay(
                hasCategoryFilter ? sessions.filter((s) => sessionMatchesCategoryFilter(s.category_id)) : sessions
              )
              if (filteredSessions.length === 0) {
                return (
                  <div className="text-center py-8">
                    <div className="text-2xl mb-2" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>📊</div>
                    <p className="text-sm" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>Nessuna sessione</p>
                  </div>
                )
              }
              const sorted = [...filteredSessions].sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
              const sessionWeeks = groupByWeekAndWeekday(sorted)
              const todayStr = new Date().toISOString().slice(0, 10)
              const currentMondayStr = getMonday(todayStr)
              const currentMonday = new Date(currentMondayStr + 'T12:00:00')
              const minMonday = new Date(currentMonday)
              minMonday.setDate(minMonday.getDate() - 7)
              const maxMonday = new Date(currentMonday)
              maxMonday.setDate(maxMonday.getDate() + 14)
              const minStr = minMonday.toISOString().slice(0, 10)
              const maxStr = maxMonday.toISOString().slice(0, 10)
              const visibleWeeks = embedLight
                ? buildConsecutiveWeeks(currentMondayStr, 2, sessionWeeks)
                : sessionWeeks.filter((w) => w.weekMonday >= minStr && w.weekMonday <= maxStr)
              const dayCardMinH = embedLight ? 'min-h-[11rem]' : ''
              const dayBodyMinH = embedLight ? 'min-h-[9rem]' : ''
              return (
                <div
                  className={embedLight ? 'space-y-4 rounded-xl p-3' : 'space-y-8'}
                  style={embedLight ? { backgroundColor: GOLEE.gridBg } : undefined}
                >
                  {visibleWeeks.map((week) => (
                  <div key={week.weekMonday} className={`grid min-w-0 ${embedLight ? 'gap-3' : 'gap-3'} ${week.days.length === 6 ? 'grid-cols-6' : 'grid-cols-5'}`}>
                    {week.days.map((daySlot) => {
                      const todayStr = new Date().toISOString().slice(0, 10)
                      const isToday = daySlot.date === todayStr
                      const hasSessions = daySlot.items.length > 0
                      return (
                      <div
                        key={daySlot.date + (daySlot.label || '')}
                        className={`min-w-0 flex flex-col rounded-xl overflow-hidden transition-shadow ${dayCardMinH} ${
                          embedLight
                            ? `border-2 shadow-md hover:shadow-lg ${isToday ? 'ring-2 ring-[#00C48C] ring-offset-2' : ''} ${hasSessions ? 'border-slate-300' : 'border-slate-200 border-dashed'}`
                            : 'border'
                        }`}
                        style={
                          embedLight
                            ? { backgroundColor: '#FFFFFF', borderColor: hasSessions ? '#CBD5E1' : '#E2E8F0' }
                            : { backgroundColor: `${primary}66`, borderColor: `${secondary}40` }
                        }
                      >
                        <div
                          className={`px-2 border-b text-center font-semibold shrink-0 ${embedLight ? 'py-2.5 text-sm tracking-wide' : 'py-2 rounded-t-xl text-sm'} ${embedLight && isToday ? '' : embedLight ? '' : isToday ? '' : 'text-white'}`}
                          style={
                            embedLight
                              ? isToday
                                ? { backgroundColor: GOLEE.accent, color: '#FFFFFF', borderColor: GOLEE.accent }
                                : hasSessions
                                  ? { backgroundColor: '#E2E8F0', color: GOLEE.text, borderColor: '#CBD5E1' }
                                  : { backgroundColor: '#F1F5F9', color: GOLEE.textMuted, borderColor: '#E2E8F0' }
                              : isToday
                                ? { backgroundColor: '#B8E0F0', color: '#0f2d52', borderColor: 'rgba(15,45,82,0.2)' }
                                : { backgroundColor: `${primary}cc`, borderColor: `${secondary}30` }
                          }
                        >
                          {daySlot.label ?? new Date(daySlot.date).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </div>
                        <div
                          className={`p-2.5 space-y-2 flex-1 min-h-0 overflow-auto ${dayBodyMinH} ${embedLight && !hasSessions ? 'bg-slate-50' : ''}`}
                          style={embedLight && hasSessions ? { backgroundColor: '#FAFBFC' } : undefined}
                        >
                          {daySlot.items.length === 0 ? (
                            <p className={`text-sm text-center flex items-center justify-center h-full ${embedLight ? 'min-h-[7rem] text-slate-400' : ''}`} style={!embedLight ? { color: `${secondary}99` } : undefined}>—</p>
                          ) : (
                            daySlot.items.map((session) => (
                              <div key={session.id} className={`${getSessionBackgroundColor(session.id, embedLight)} rounded-lg overflow-hidden flex cursor-pointer hover:opacity-90 transition-all duration-200 border ${embedLight ? 'min-h-[3.25rem] shadow-sm border-slate-200' : ''}`} style={embedLight ? undefined : { borderColor: `${secondary}40` }} onClick={() => handleOpenAttendancePopup(session.id)}>
                                <div className={`${embedLight ? 'w-11' : 'w-10'} min-h-[2.75rem] self-stretch flex items-center justify-center flex-shrink-0 text-sm font-bold text-white rounded-l-lg ${session.categories?.code ? getCategoryCircleColor(session.categories) : ''}`} style={!session.categories?.code ? { backgroundColor: dark } : undefined}>
                                  {session.categories?.code ? getCategoryAbbreviation(session.categories.code) : '?'}
                                </div>
                                <div className="flex items-center gap-2 flex-1 min-w-0 p-2">
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm truncate ${embedLight ? '' : 'text-white/90'}`} style={embedLight ? { color: GOLEE.text } : undefined} title={session.location === 'Trasferta' ? session.away_place : session.location}>
                                      {(() => {
                                        const times = sessionTimes[session.id]
                                        const start = times?.start_time ?? session.start_time
                                        const end = times?.end_time ?? session.end_time
                                        const timeStr = (start && end) ? `${String(start).substring(0, 5)}-${String(end).substring(0, 5)}` : (start ? String(start).substring(0, 5) : '')
                                        return timeStr ? `${timeStr} ` : ''
                                      })()}{session.location === 'Trasferta' ? session.away_place : session.location}
                                    </p>
                                  </div>
                                </div>
                                {(() => {
                                  const today = new Date()
                                  today.setHours(0, 0, 0, 0)
                                  const sessionDate = new Date(session.session_date)
                                  sessionDate.setHours(0, 0, 0, 0)
                                  if (sessionDate > today) return null
                                  const status = sessionAttendanceStatus[session.id]
                                  const total = status?.totalPlayers ?? 0
                                  const present = status?.presentCount ?? 0
                                  const unassigned = status?.unassignedCount ?? 0
                                  if (total === 0) return null
                                  const isPast = sessionDate < today
                                  const numColor = unassigned === 0 ? 'bg-green-600' : isPast ? 'bg-red-600' : 'bg-amber-500'
                                  const pct = Math.round((present / total) * 100)
                                  const pctTextColor = pct >= 85 ? 'text-green-500' : pct > 65 ? 'text-amber-500' : 'text-red-500'
                                  return (
                                    <div className="flex self-stretch flex-shrink-0 rounded-r-lg overflow-hidden" title={unassigned === 0 ? 'Completato' : isPast ? 'Da completare' : 'Da compilare'}>
                                      {!isPast && (
                                        <div className={`w-9 self-stretch flex items-center justify-center text-white text-sm font-bold ${numColor}`}>
                                          {unassigned}
                                        </div>
                                      )}
                                      <div className={`w-9 self-stretch flex items-center justify-center text-sm font-bold rounded-r-lg bg-transparent ${pctTextColor}`}>
                                        {pct}%
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );})}
                  </div>
                  ))}
                </div>
              );
            })()}
              </div>
            </div>
          ) : activitiesTab === 'eventi' ? (
            /* Tab Prossimi Eventi: tabella partite, tornei e feste del rugby */
            <div className={embedLight ? 'flex-1 min-h-0 overflow-auto' : undefined}>
            {(() => {
              const onlyPartiteTorneiFeste = events.filter(
                (e) => e.event_type === 'partita' || e.event_type === 'torneo' || e.event_type === 'festa' || e.event_type === 'MATCH' || e.event_type === 'TOURNAMENT'
              )
              const allEvents = [...onlyPartiteTorneiFeste].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
              const displayedEvents = hasCategoryFilter
                ? allEvents.filter((e) => e.category_id && sessionMatchesCategoryFilter(e.category_id))
                : allEvents
              const todayStr = new Date().toISOString().slice(0, 10)
              const seasonStartStr = getSeasonStartDate()
              const futureEvents = displayedEvents.filter((e) => e.event_date >= todayStr)
              const pastEvents = displayedEvents
                .filter((e) => e.event_date < todayStr && e.event_date >= seasonStartStr)
                .sort((a, b) => b.event_date.localeCompare(a.event_date))
              const getCategoryName = (e: Event) => e.categories?.name || e.categories?.code || ''
              /** Solo il titolo di evento senza categoria: "Campionato", "Amichevole", "Partita", "Festa del rugby", "Torneo" (+ eventuale titolo). */
              const getTipoEventoSolo = (e: Event) => {
                if (e.event_type === 'partita' || e.event_type === 'MATCH') {
                  return (e as any).is_championship ? 'Campionato' : (e as any).is_friendly ? 'Amichevole' : 'Partita'
                }
                if (e.event_type === 'torneo' || e.event_type === 'TOURNAMENT') return (e as any).title ? `Torneo – ${(e as any).title}` : 'Torneo'
                if (e.event_type === 'festa') return 'Festa del rugby'
                return e.event_type || '—'
              }
              const getGiorno = (dateStr: string) => {
                const d = new Date(dateStr + 'T12:00:00')
                const day = d.toLocaleDateString('it-IT', { weekday: 'long' })
                return day.charAt(0).toUpperCase() + day.slice(1)
              }
              const getDataFormatted = (dateStr: string) => {
                const [y, m, d] = dateStr.split('-')
                return `${d}/${m}/${y}`
              }
              const getOrarioInizio = (e: Event) => (e.start_time || e.event_time) ? (e.start_time || e.event_time)!.substring(0, 5) : '—'
              /** Indice di gruppo per data: stessa data = stesso indice; ogni nuova data incrementa. Usato per sfondo alternato per giorno. */
              const getDayGroupIndices = (events: { event_date: string }[]) => {
                const indices: number[] = []
                let group = -1
                let last = ''
                for (const e of events) {
                  if (e.event_date !== last) {
                    last = e.event_date
                    group += 1
                  }
                  indices.push(group)
                }
                return indices
              }
              const futureDayGroups = getDayGroupIndices(futureEvents)
              const pastDayGroups = getDayGroupIndices(pastEvents)
              const rowBgByDay = (dayIndex: number) =>
                embedLight
                  ? dayIndex % 2 === 0 ? GOLEE.surface : GOLEE.surfaceMuted
                  : dayIndex % 2 === 0 ? `${primary}99` : `${secondary}88`
              const tableHeadBg = embedLight ? GOLEE.surfaceMuted : `${primary}cc`
              const tableHeadColor = embedLight ? GOLEE.textMuted : secondary
              const tableBorderColor = embedLight ? GOLEE.border : `${secondary}30`
              const tableCellStyle = embedLight ? { color: GOLEE.text } : undefined
              const hasFuture = futureEvents.length > 0
              const hasPast = pastEvents.length > 0
              return !hasFuture && !hasPast ? (
                <div className="text-center py-8">
                  <div className="text-2xl mb-2" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>📅</div>
                  <p className="text-sm" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>Nessun evento in programma</p>
                </div>
              ) : (
                <>
                <div className="p-4">
                  <div className="overflow-x-auto rounded-xl border" style={embedLight ? { borderColor: GOLEE.border } : undefined}>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b" style={{ backgroundColor: tableHeadBg, borderColor: tableBorderColor }}>
                        <th className="px-2 py-3 font-semibold text-lg w-14 text-center" style={{ color: tableHeadColor }}>Cat.</th>
                        <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Tipo Evento</th>
                        <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Giorno</th>
                        <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Data</th>
                        <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Orario</th>
                        <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Avversario</th>
                        <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Luogo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {futureEvents.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-lg" style={{ color: tableHeadColor }}>
                            Nessun evento in programma
                          </td>
                        </tr>
                      )}
                      {futureEvents.map((event, index) => {
                        const isFirstForDate = index === 0 || futureEvents[index - 1].event_date !== event.event_date
                        const dayGroup = futureDayGroups[index]
                        return (
                        <tr
                          key={event.id}
                          className="border-b transition-colors cursor-pointer hover:opacity-90"
                          style={{ backgroundColor: rowBgByDay(dayGroup), borderColor: tableBorderColor }}
                          onClick={() => handleEventClick(event)}
                        >
                          <td className="px-2 py-3 align-middle text-center">
                            {(() => {
                              const badge = getEventCategoryBadge(event)
                              return (
                                <div
                                  className={`inline-flex items-center justify-center min-w-[2.125rem] w-[2.125rem] min-h-[2rem] py-1 text-sm font-bold text-white rounded-lg ${badge.colorClass}`}
                                  title={getCategoryName(event) || (event.event_type === 'consiglio' ? 'Consiglio' : undefined)}
                                >
                                  {badge.abbr}
                                </div>
                              )
                            })()}
                          </td>
                          <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>
                            {getTipoEventoSolo(event)}
                          </td>
                          <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>{isFirstForDate ? getGiorno(event.event_date) : ''}</td>
                          <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>{getDataFormatted(event.event_date)}</td>
                          <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>{getOrarioInizio(event)}</td>
                          <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white'}`} style={tableCellStyle}>{event.opponent || '—'}</td>
                          <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>
                            {event.location === 'Trasferta'
                              ? (event.away_location?.trim() || 'Trasferta')
                              : (event.location?.trim() || (event.is_home ? 'Casa' : 'Trasferta'))}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                  </div>
                </div>
                {hasPast && (
                  <div className="mt-8 px-4 pb-4">
                    <div
                      className={`overflow-hidden border rounded-xl ${embedLight ? 'shadow-sm' : ''}`}
                      style={embedLight ? { backgroundColor: GOLEE.surface, borderColor: GOLEE.border } : { backgroundColor: `${primary}99`, borderColor: `${secondary}40` }}
                    >
                      <button
                        type="button"
                        onClick={() => setPastEventsAccordionOpen((v) => !v)}
                        className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:opacity-90 transition-opacity ${embedLight ? '' : 'text-white'}`}
                        style={embedLight ? { color: GOLEE.text } : undefined}
                      >
                        <span className="text-lg font-semibold">Eventi passati (stagione in corso)</span>
                        <span className="text-sm font-medium" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>({pastEvents.length})</span>
                        {pastEventsAccordionOpen ? (
                          <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: embedLight ? GOLEE.textMuted : secondary }} />
                        ) : (
                          <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: embedLight ? GOLEE.textMuted : secondary }} />
                        )}
                      </button>
                      {pastEventsAccordionOpen && (
                        <div className="border-t" style={{ borderColor: tableBorderColor }}>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b" style={{ backgroundColor: tableHeadBg, borderColor: tableBorderColor }}>
                                  <th className="px-2 py-3 font-semibold text-lg w-14 text-center" style={{ color: tableHeadColor }}>Cat.</th>
                                  <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Tipo Evento</th>
                                  <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Giorno</th>
                                  <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Data</th>
                                  <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Orario</th>
                                  <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Avversario</th>
                                  <th className="px-4 py-3 font-semibold text-lg" style={{ color: tableHeadColor }}>Luogo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pastEvents.map((event, index) => {
                                  const isFirstForDate = index === 0 || pastEvents[index - 1].event_date !== event.event_date
                                  const dayGroup = pastDayGroups[index]
                                  return (
                                  <tr
                                    key={event.id}
                                    className="border-b transition-colors cursor-pointer hover:opacity-90"
                                    style={{ backgroundColor: rowBgByDay(dayGroup), borderColor: tableBorderColor }}
                                    onClick={() => handleEventClick(event)}
                                  >
                                    <td className="px-2 py-3 align-middle text-center">
                                      {(() => {
                                        const badge = getEventCategoryBadge(event)
                                        return (
                                          <div
                                            className={`inline-flex items-center justify-center min-w-[2.125rem] w-[2.125rem] min-h-[2rem] py-1 text-sm font-bold text-white rounded-lg ${badge.colorClass}`}
                                            title={getCategoryName(event) || (event.event_type === 'consiglio' ? 'Consiglio' : undefined)}
                                          >
                                            {badge.abbr}
                                          </div>
                                        )
                                      })()}
                                    </td>
                                    <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>
                                      {getTipoEventoSolo(event)}
                                    </td>
                                    <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>{isFirstForDate ? getGiorno(event.event_date) : ''}</td>
                                    <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>{getDataFormatted(event.event_date)}</td>
                                    <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>{getOrarioInizio(event)}</td>
                                    <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>{event.opponent || '—'}</td>
                                    <td className={`px-4 py-3 text-lg ${embedLight ? '' : 'text-white/90'}`} style={tableCellStyle}>
                                      {event.location === 'Trasferta'
                                        ? (event.away_location?.trim() || 'Trasferta')
                                        : (event.location?.trim() || (event.is_home ? 'Casa' : 'Trasferta'))}
                                    </td>
                                  </tr>
                                )})}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </>
              )
            })()}
            </div>
          ) : (
            /* Tab Giocatori: tabella con colori brand */
            <div className={embedLight ? 'flex-1 min-h-0 overflow-auto' : undefined}>
              <div className={embedLight ? 'p-3' : 'p-4'}>
                {allPlayersLoading ? (
                  <div className="text-center py-8">
                    <div className="text-2xl mb-2" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>⏳</div>
                    <p className="text-sm" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>Caricamento giocatori...</p>
                  </div>
                ) : (() => {
                  let filtered = hasCategoryFilter
                    ? allPlayersList.filter((p) => p.categoryItems.some((c) => selectedCategoryFilters.includes(c.id)))
                    : allPlayersList
                  const searchTrim = playersTableSearch.trim().toLowerCase()
                  if (searchTrim) {
                    filtered = filtered.filter((p) => {
                      const nameMatch = p.full_name?.toLowerCase().includes(searchTrim)
                      const yearMatch = p.birthYear != null && String(p.birthYear).includes(searchTrim)
                      const roleMatch = p.roleLabel?.toLowerCase().includes(searchTrim)
                      return nameMatch || yearMatch || roleMatch
                    })
                  }
                  const sortCol = playersTableSort?.column
                  const sortDir = playersTableSort?.direction
                  if (sortCol && sortDir) {
                    filtered = [...filtered].sort((a, b) => {
                      let va: string | number | boolean | null | undefined
                      let vb: string | number | boolean | null | undefined
                      switch (sortCol) {
                        case 'cat':
                          va = a.categoryItems.map((c) => c.name || c.code || '').join(' ')
                          vb = b.categoryItems.map((c) => c.name || c.code || '').join(' ')
                          break
                        case 'nome':
                          va = a.full_name ?? ''
                          vb = b.full_name ?? ''
                          break
                        case 'anno':
                          va = a.birthYear ?? -1
                          vb = b.birthYear ?? -1
                          break
                        case 'ruolo':
                          va = a.roleLabel ?? ''
                          vb = b.roleLabel ?? ''
                          break
                        case 'infortunato':
                          va = a.injured ? 1 : 0
                          vb = b.injured ? 1 : 0
                          break
                        case 'squalificato':
                          va = a.disqualified ? (a.disqualification_end_date ?? '') : ''
                          vb = b.disqualified ? (b.disqualification_end_date ?? '') : ''
                          break
                        default:
                          return 0
                      }
                      const cmp = typeof va === 'number' && typeof vb === 'number'
                        ? va - vb
                        : String(va).localeCompare(String(vb), undefined, { numeric: true })
                      return sortDir === 'asc' ? cmp : -cmp
                    })
                  }
                  const formatDisqualificationEnd = (d: string | null) => {
                    if (!d) return null
                    const [y, m, day] = d.split(/[-T]/)
                    return day && m && y ? `${day}/${m}/${y}` : d
                  }
                  const hasTableFilters = searchTrim !== '' || playersTableSort !== null
                  const cycleSort = (column: string) => {
                    setPlayersTableSort((prev) => {
                      if (prev?.column !== column) return { column, direction: 'asc' as const }
                      if (prev.direction === 'asc') return { column, direction: 'desc' as const }
                      return null
                    })
                  }
                  const SortIcon = ({ col }: { col: string }) => {
                    if (sortCol !== col) return <span className="opacity-40 ml-0.5 inline-block w-4" />
                    return sortDir === 'asc'
                      ? <ArrowUp className="inline w-4 h-4 ml-0.5" aria-hidden />
                      : <ArrowDown className="inline w-4 h-4 ml-0.5" aria-hidden />
                  }
                  return (
                    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: embedLight ? GOLEE.border : `${secondary}40` }}>
                      <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr className="border-b" style={{ backgroundColor: embedLight ? GOLEE.surfaceMuted : primary, borderColor: embedLight ? GOLEE.border : `${secondary}40` }}>
                            <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wider w-14" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>
                              <button type="button" onClick={() => cycleSort('cat')} className="flex items-center gap-0.5 hover:opacity-90 cursor-pointer">Cat. <SortIcon col="cat" /></button>
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-medium uppercase tracking-wider" style={{ color: embedLight ? GOLEE.textMuted : secondary, width: '20%' }}>
                              <div className="flex flex-row items-center gap-2 flex-wrap">
                                <button type="button" onClick={() => cycleSort('nome')} className="flex items-center gap-0.5 hover:opacity-90 cursor-pointer text-left shrink-0">Nome <SortIcon col="nome" /></button>
                                <input
                                  type="text"
                                  placeholder="Cerca nome, anno, ruolo..."
                                  value={playersTableSearch}
                                  onChange={(e) => setPlayersTableSearch(e.target.value)}
                                  className={
                                    embedLight
                                      ? 'min-w-[100px] max-w-[140px] px-2 py-1 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#00C48C]/30'
                                      : 'min-w-[100px] max-w-[140px] px-2 py-1 text-sm rounded border bg-white/10 border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/50'
                                  }
                                  style={
                                    embedLight
                                      ? { borderColor: GOLEE.border, backgroundColor: GOLEE.surface, color: GOLEE.text }
                                      : { color: 'inherit' }
                                  }
                                />
                              </div>
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-medium uppercase tracking-wider" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>
                              <button type="button" onClick={() => cycleSort('anno')} className="flex items-center justify-center gap-0.5 w-full hover:opacity-90 cursor-pointer">Anno <SortIcon col="anno" /></button>
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-medium uppercase tracking-wider" style={{ color: embedLight ? GOLEE.textMuted : secondary, width: '10%' }}>% Presenze</th>
                            <th className="px-4 py-3 text-center text-sm font-medium uppercase tracking-wider" style={{ color: embedLight ? GOLEE.textMuted : secondary, width: '11%' }}>Min./Par.</th>
                            <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wider" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>
                              <button type="button" onClick={() => cycleSort('ruolo')} className="flex items-center gap-0.5 hover:opacity-90 cursor-pointer">Ruolo <SortIcon col="ruolo" /></button>
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-medium uppercase tracking-wider" style={{ color: embedLight ? GOLEE.textMuted : secondary, width: '15%' }}>
                              <button type="button" onClick={() => cycleSort('infortunato')} className="flex items-center justify-center gap-0.5 w-full hover:opacity-90 cursor-pointer">Infortunato <SortIcon col="infortunato" /></button>
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wider" style={{ color: embedLight ? GOLEE.textMuted : secondary, width: '15%' }}>
                              <button type="button" onClick={() => cycleSort('squalificato')} className="flex items-center gap-0.5 hover:opacity-90 cursor-pointer">Squalificato <SortIcon col="squalificato" /></button>
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-medium uppercase tracking-wider" style={{ color: embedLight ? GOLEE.textMuted : secondary, width: '7%' }}>Azioni</th>
                            {hasTableFilters && (
                              <th className="px-3 py-3 text-right" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>
                                <button
                                  type="button"
                                  onClick={() => { setPlayersTableSearch(''); setPlayersTableSort(null) }}
                                  title="Annulla filtri e ordinamento"
                                  className={`p-1.5 rounded transition-colors ${embedLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                                >
                                  <RotateCcw className="w-5 h-5" />
                                </button>
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: embedLight ? GOLEE.border : `${secondary}30` }}>
                          {filtered.length === 0 ? (
                            <tr>
                              <td colSpan={hasTableFilters ? 10 : 9} className="px-4 py-8 text-center text-sm" style={{ color: embedLight ? GOLEE.textMuted : secondary }}>
                                Nessun giocatore trovato
                              </td>
                            </tr>
                          ) : (
                            filtered.map((row, rowIndex) => (
                              <tr
                                key={row.id}
                                className={`transition-colors ${row.disqualified ? 'border-l-4 border-l-red-400' : ''}`}
                                style={{ backgroundColor: embedLight ? (rowIndex % 2 === 0 ? GOLEE.surface : GOLEE.surfaceMuted) : dark }}
                              >
                                <td className="px-0 py-0 align-middle">
                                  <div className="flex items-stretch min-h-[3rem] gap-px">
                                    {row.categoryItems.map((cat) => (
                                      <div
                                        key={cat.id}
                                        className={`flex items-center justify-center flex-shrink-0 w-[2.125rem] min-w-[2.125rem] min-h-[2rem] text-sm font-bold text-white ${cat.code ? getCategoryCircleColor({ code: cat.code }) : ''}`}
                                        style={!cat.code ? { backgroundColor: dark } : undefined}
                                      >
                                        {cat.code ? getCategoryAbbreviation(cat.code) : cat.name}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className={`px-4 py-3 font-medium ${embedLight ? '' : 'text-white'}`} style={embedLight ? { color: GOLEE.text } : undefined}>{row.full_name}</td>
                                <td className={`px-4 py-3 text-center ${embedLight ? '' : 'text-white/90'}`} style={embedLight ? { color: GOLEE.text } : undefined}>{row.birthYear ?? '—'}</td>
                                <td className={`px-4 py-3 text-center ${embedLight ? '' : 'text-white/80'}`} style={embedLight ? { color: GOLEE.textMuted } : undefined}>—</td>
                                <td className={`px-4 py-3 text-center ${embedLight ? '' : 'text-white/80'}`} style={embedLight ? { color: GOLEE.textMuted } : undefined}>—</td>
                                <td className={`px-4 py-3 ${embedLight ? '' : 'text-white/90'}`} style={embedLight ? { color: GOLEE.text } : undefined}>{row.roleLabel}</td>
                                <td className="px-4 py-3 text-center">
                                  {row.injured ? <span className="rounded-md bg-amber-500/80 px-2 py-0.5 text-xs text-white">Sì</span> : '—'}
                                </td>
                                <td className={`px-4 py-3 ${embedLight ? '' : 'text-white/90'}`} style={embedLight ? { color: GOLEE.text } : undefined}>
                                  {row.disqualified && row.disqualification_end_date
                                    ? `fino al ${formatDisqualificationEnd(row.disqualification_end_date)}`
                                    : row.disqualified
                                      ? 'Sì'
                                      : '—'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/create-person?edit=${row.id}`)}
                                    title="Apri scheda anagrafica"
                                    className={`p-1.5 rounded transition-colors inline-flex items-center justify-center ${embedLight ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-800' : 'hover:bg-white/10 text-white/80 hover:text-white'}`}
                                  >
                                    <Pencil className="w-5 h-5" aria-hidden />
                                  </button>
                                </td>
                                {hasTableFilters && <td className="w-12" />}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      <div className="px-4 py-2 border-t text-sm" style={{ borderColor: embedLight ? GOLEE.border : `${secondary}30`, color: embedLight ? GOLEE.textMuted : secondary }}>
                        Totale: {filtered.length} giocatori
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Modal per selezione tipo sessione */}
        {showSessionTypeModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-600 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Dumbbell className="w-6 h-6 text-blue-400" />
                Nuova Sessione
              </h2>
              <p className="text-blue-200 text-sm mb-6">Scegli il tipo di sessione che vuoi creare:</p>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSessionType('single')
                    setShowSessionTypeModal(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full p-4 bg-blue-800 hover:bg-blue-700 border border-blue-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="font-semibold">Singolo Allenamento</div>
                      <div className="text-sm text-blue-200">Prossimo giorno disponibile</div>
                    </div>
                  </div>
                  <span className="text-blue-300">→</span>
                </button>

                <button
                  onClick={() => {
                    setSessionType('weekly')
                    setShowSessionTypeModal(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full p-4 bg-blue-800 hover:bg-blue-700 border border-blue-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="font-semibold">Settimanale</div>
                      <div className="text-sm text-blue-200">Tutti i giorni di allenamento</div>
                    </div>
                  </div>
                  <span className="text-blue-300">→</span>
                </button>

                <button
                  onClick={() => {
                    setSessionType('biweekly')
                    setShowSessionTypeModal(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full p-4 bg-blue-800 hover:bg-blue-700 border border-blue-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="font-semibold">2 Settimane</div>
                      <div className="text-sm text-blue-200">Due settimane di allenamenti</div>
                    </div>
                  </div>
                  <span className="text-blue-300">→</span>
                </button>

                <button
                  onClick={() => {
                    setSessionType('monthly')
                    setShowSessionTypeModal(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full p-4 bg-blue-800 hover:bg-blue-700 border border-blue-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="font-semibold">4 Settimane</div>
                      <div className="text-sm text-blue-200">Un mese di allenamenti</div>
                    </div>
                  </div>
                  <span className="text-blue-300">→</span>
                </button>

                <button
                  onClick={() => {
                    setSessionType('extra')
                    setShowSessionTypeModal(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full p-4 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="font-semibold">Allenamento Extra</div>
                      <div className="text-sm text-blue-200">Configurazione manuale</div>
                    </div>
                  </div>
                  <span className="text-blue-300">→</span>
                </button>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setShowSessionTypeModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-medium transition-colors border border-slate-600"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal per creare nuova sessione */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white text-gray-900 rounded-2xl p-6 max-w-md w-full mx-4 [&_select]:bg-white [&_select]:text-gray-900 [&_option]:bg-white [&_option]:text-gray-900">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {sessionType === 'single' && '🎯 Singolo Allenamento'}
                {sessionType === 'weekly' && '📅 Allenamenti Settimanali'}
                {sessionType === 'biweekly' && '📆 Allenamenti 2 Settimane'}
                {sessionType === 'monthly' && '🗓️ Allenamenti 4 Settimane'}
                {sessionType === 'extra' && '⚙️ Allenamento Extra'}
              </h2>
              
              {sessionType === 'extra' ? (
                // Form per allenamento extra (form originale)
                <form onSubmit={handleCreateSession} className="space-y-4">
                {/* Categoria */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    required
                    value={newSession.category_id}
                    onChange={(e) => setNewSession({...newSession, category_id: e.target.value})}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  >
                    <option value="">Seleziona categoria</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data Sessione */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Sessione *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={newSession.session_date}
                    onChange={(e) => setNewSession({...newSession, session_date: e.target.value})}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <TrainingVenueSelect
                    required
                    value={newSession.location}
                    onChange={(value) => setNewSession({...newSession, location: value, away_location: ''})}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>

                {/* Campo Trasferta (condizionale) */}
                {requiresAwayDetail(newSession.location) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dove in trasferta? *
                    </label>
                    <input
                      type="text"
                      required
                      value={newSession.away_location}
                      onChange={(e) => setNewSession({...newSession, away_location: e.target.value})}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Es. Milano, Bergamo, Cremona"
                    />
                  </div>
                )}

                {/* Orario di inizio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Orario di inizio
                  </label>
                  <input
                    type="time"
                    value={newSession.start_time}
                    onChange={(e) => setNewSession({...newSession, start_time: e.target.value})}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Orario di fine */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Orario di fine
                  </label>
                  <input
                    type="time"
                    value={newSession.end_time}
                    onChange={(e) => setNewSession({...newSession, end_time: e.target.value})}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Descrizione */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Note/Descrizione
                  </label>
                  <textarea
                    value={newSession.description}
                    onChange={(e) => setNewSession({...newSession, description: e.target.value})}
                    rows={3}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Note aggiuntive sulla sessione..."
                  />
                </div>

                {/* Pulsanti */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                  >
                    ✅ Crea Sessione
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCreate}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                  >
                    ❌ Annulla
                  </button>
                </div>
              </form>
              ) : (
                // Form per sessioni automatiche (singolo, settimanale, 2-4 settimane)
                <div className="space-y-4">
                  {/* Selezione Categoria */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoria *
                    </label>
                  <select
                    required
                    value={selectedCategoryForSession?.id || ''}
                    onChange={(e) => {
                        const category = categories.find(cat => cat.id === e.target.value)
                        setSelectedCategoryForSession(category)
                      }}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  >
                    <option value="">Seleziona categoria</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Note per tutte le sessioni */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Note (opzionale)
                    </label>
                    <textarea
                      value={bulkSessionNote}
                      onChange={(e) => setBulkSessionNote(e.target.value)}
                      rows={3}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Note che si applicheranno a tutte le sessioni create..."
                    />
                  </div>

                  {/* Informazioni sulla creazione */}
                  {selectedCategoryForSession && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">
                        {sessionType === 'single' && '🎯 Singolo Allenamento'}
                        {sessionType === 'weekly' && '📅 Allenamenti Settimanali'}
                        {sessionType === 'biweekly' && '📆 Allenamenti 2 Settimane'}
                        {sessionType === 'monthly' && '🗓️ Allenamenti 4 Settimane'}
                      </h4>
                      <p className="text-blue-700 text-sm">
                        {sessionType === 'single' && 'Verrà creato 1 allenamento per il prossimo giorno disponibile'}
                        {sessionType === 'weekly' && 'Verranno creati tutti gli allenamenti della settimana'}
                        {sessionType === 'biweekly' && 'Verranno creati tutti gli allenamenti per 2 settimane'}
                        {sessionType === 'monthly' && 'Verranno creati tutti gli allenamenti per 4 settimane'}
                      </p>
                      <p className="text-blue-600 text-xs mt-1">
                        Categoria: <strong>{selectedCategoryForSession.name}</strong>
                      </p>
                    </div>
                  )}

                  {/* Pulsanti */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={async () => {
                        if (!selectedCategoryForSession) {
                          alert('Seleziona una categoria')
                          return
                        }
                        await createBulkSessions(selectedCategoryForSession, sessionType!, bulkSessionNote)
                        // Chiudi il modal dopo la creazione
                        setShowCreateModal(false)
                        setSelectedCategoryForSession(null)
                        setSessionType(null)
                        setBulkSessionNote('')
                      }}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      ✅ Crea Sessioni
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateModal(false)
                        setSelectedCategoryForSession(null)
                        setSessionType(null)
                        setBulkSessionNote('')
                      }}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                    >
                      ❌ Annulla
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <AttendancePopup
          open={showAttendancePopup}
          onClose={handleCloseAttendancePopup}
          onSaveAndExit={handleSaveAndExitAttendance}
        />
      </div>

      {/* Modal per i dettagli dell'evento - Stile Events */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-navy">{selectedEvent.title}</h2>
                <button onClick={() => setShowEventModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
              </div>
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">📅 Data e Orari</h4>
                  <p className="text-blue-700">{formatDate(selectedEvent.event_date)}</p>
                  {selectedEvent.start_time && selectedEvent.end_time && (
                    <p className="text-blue-700">Inizio: {selectedEvent.start_time.substring(0, 5)} - Fine: {selectedEvent.end_time.substring(0, 5)}</p>
                  )}
                  {selectedEvent.event_time && !selectedEvent.start_time && (
                    <p className="text-blue-700">Ora: {selectedEvent.event_time.substring(0, 5)}</p>
                  )}
                </div>
                {selectedEvent.location && (
                  <div className="bg-pink-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-pink-800 mb-2">📍 Location</h4>
                    <p className="text-pink-700">{selectedEvent.location} {selectedEvent.is_home ? '(Casa)' : '(Trasferta)'}</p>
                  </div>
                )}
                {selectedEvent.opponent && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">🌍 Avversario</h4>
                    <p className="text-blue-700">{selectedEvent.opponent}</p>
                  </div>
                )}
                {selectedEvent.event_type === 'consiglio' && selectedEvent.participants?.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">👥 Partecipanti</h4>
                    <p className="text-blue-700">{sortNamesBySurname(selectedEvent.participants).join(', ')}</p>
                  </div>
                )}
                {selectedEvent.event_type === 'consiglio' && selectedEvent.invited?.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">🎫 Invitati</h4>
                    <p className="text-green-700">{sortNamesBySurname(selectedEvent.invited).join(', ')}</p>
                  </div>
                )}
                {selectedEvent.category_id && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">🏈 Categoria</h4>
                    <p className="text-purple-700">{categories.find(cat => cat.id === selectedEvent.category_id)?.name || 'Categoria non trovata'}</p>
                  </div>
                )}
                {selectedEvent.description && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-2">📝 Descrizione</h4>
                    <p className="text-gray-700">{selectedEvent.description}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t">
                <button
                  onClick={() => {
                    const returnTo = `${window.location.pathname}${window.location.search}`
                    setShowEventModal(false)
                    navigate(`/events?eventId=${selectedEvent.id}&returnTo=${encodeURIComponent(returnTo)}`)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  Modifica
                </button>
                <button onClick={() => setShowEventModal(false)} className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors">Chiudi</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (embedInLayout) {
    return (
      <div className="min-h-full flex flex-col" style={{ backgroundColor: GOLEE.pageBg }}>
        {content}
      </div>
    )
  }
  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: '#2A3051' }}>
      <Header 
        title="Squadre" 
        showBack={true}
        hideCenterLogo={true} 
      />
      {content}
    </div>
  )
}
