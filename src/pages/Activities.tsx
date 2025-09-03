import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '@/store/data'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'
import AttendanceRow from '@/components/AttendanceRow'

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
  opponents?: string[]
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

export default function Activities() {
  const navigate = useNavigate()
  const { currentCategory, pickCategory, loadPlayers, players, startSession, attendance, setCurrentSession } = useData()
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

  const loadSessions = async () => {
    try {

      
      // Calcola range settimana corrente
      const today = new Date()
      const startOfWeek = new Date(today)
      const endOfWeek = new Date(today)
      endOfWeek.setDate(today.getDate() + 7) // 7 giorni in avanti
      
      const startDate = startOfWeek.toISOString().split('T')[0]
      const endDate = endOfWeek.toISOString().split('T')[0]
      

      
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          category_id,
          session_date,
          location,
          away_place,
          created_at,
          categories(id, code, name)
        `)
        .gte('session_date', startDate)
        .lte('session_date', endDate)
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

      setSessions(transformedSessions)
      
      // Aggiorna solo le statistiche delle sessioni
      const totalSessions = data?.length || 0
      const activeSessions = totalSessions // Tutte le sessioni caricate sono della settimana corrente
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

  const loadEvents = async () => {
    try {

      const today = new Date()
      
      // Filtro per 30 giorni (per tutti gli eventi)
      const endDate = new Date(today)
      endDate.setDate(today.getDate() + 30)
      const startDate = today.toISOString().split('T')[0]
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
          opponents,
          description,
          created_at,
          categories(id, code, name)
        `)
        .gte('event_date', startDate)
        .lte('event_date', endDateStr)
        .order('event_date', { ascending: true })

      if (error) {
        console.error('Errore nel caricamento eventi:', error)
        return
      }


      // Trasforma i dati per gestire l'array categories
      const transformedEvents = (data || []).map(event => ({
        ...event,
        categories: (event.categories as any) || null
      }))

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



      // Filtra e ordina usando BRIXIA_CATEGORIES
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
      description: ''
    })
  }

  // ===== NUOVO SISTEMA INTELLIGENTE DI CREAZIONE SESSIONI =====

  // Funzione per aprire il modal di selezione tipo sessione
  const handleNewSessionClick = () => {
    setShowSessionTypeModal(true)
  }



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
      // Carica le sedi di allenamento per la categoria
      const trainingLocations = await loadTrainingLocations([category.id])
      const categoryLocations = trainingLocations[category.id] || []

      if (categoryLocations.length === 0) {
        alert('Nessuna sede di allenamento configurata per questa categoria')
        return
      }

      const sessionsToCreate = []
      const today = new Date()
      const weekdayOrder = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

      if (sessionType === 'single') {
        // Singolo allenamento - prossimo giorno disponibile
        const nextDay = getNextAvailableTrainingDay(categoryLocations, today)
        // Mappa i valori di location per la tabella sessions
        const locationMap: { [key: string]: string } = {
          'Brescia': 'Brescia',
          'Ospitaletto': 'Ospitaletto', 
          'Gussago': 'Gussago'
        }
        
        sessionsToCreate.push({
          category_id: category.id,
          session_date: nextDay.date.toISOString().split('T')[0],
          location: locationMap[nextDay.location.location] || nextDay.location.location,
          away_place: null
        })
      } else {
        // Calcola quante settimane
        const weeks = sessionType === 'weekly' ? 1 : sessionType === 'biweekly' ? 2 : 4
        
        // Per ogni settimana, crea sessioni per tutti i giorni di allenamento
        for (let week = 0; week < weeks; week++) {
          // Per ogni giorno di allenamento della categoria
          for (const location of categoryLocations) {
            // Calcola la data per questo giorno della settimana
            const sessionDate = new Date(today)
            const dayIndex = weekdayOrder.indexOf(location.weekday)
            const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1 // Converti domenica da 0 a 6
            
            // Calcola quanti giorni aggiungere per arrivare al prossimo giorno di allenamento
            let daysToAdd = (dayIndex - todayIndex + 7) % 7
            if (daysToAdd === 0) daysToAdd = 7 // Se è oggi, vai alla prossima settimana
            
            // Aggiungi i giorni per la settimana corrente
                                      daysToAdd += (week * 7)
                          
                          sessionDate.setDate(today.getDate() + daysToAdd)
            
            // Mappa i valori di location per la tabella sessions
            const locationMap: { [key: string]: string } = {
              'Brescia': 'Brescia',
              'Ospitaletto': 'Ospitaletto', 
              'Gussago': 'Gussago'
            }
            
            sessionsToCreate.push({
              category_id: category.id,
              session_date: sessionDate.toISOString().split('T')[0],
              location: locationMap[location.location] || location.location,
              away_place: null
            })
          }
        }
      }

      // Crea tutte le sessioni
      if (sessionsToCreate.length > 0) {
        const { error } = await supabase
          .from('sessions')
          .insert(sessionsToCreate)

        if (error) {
          console.error('❌ Errore inserimento sessioni:', error)
          throw error
        }

        alert(`✅ Create ${sessionsToCreate.length} sessioni per ${category.name}`)
        
        // Chiudi modal e ricarica
        setShowCreateModal(false)
        setSelectedCategoryForSession(null)
        setSessionType(null)
        setBulkSessionNote('')
        await loadSessions()
      }
    } catch (error) {
      console.error('Errore nella creazione sessioni multiple:', error)
      alert('Errore nella creazione delle sessioni')
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
      // Carica la categoria per ottenere il codice
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('code')
        .eq('id', categoryId)
        .single()

      if (categoryError || !categoryData) {
        console.error('Errore nel caricamento categoria:', categoryError)
        return
      }

      // Carica tutti i giocatori
      const { data: allPlayers, error: playersError } = await supabase
        .from('players')
        .select('id, first_name, last_name, fir_code')
        .order('last_name', { ascending: true })

      if (playersError) {
        console.error('Errore nel caricamento giocatori:', playersError)
        return
      }

      // Filtra i giocatori per categoria basandosi sul FIR code
      const players = (allPlayers || []).filter((player: any) => {
        if (!player.fir_code) return false
        
        const firParts = player.fir_code.split('-')
        if (firParts.length < 2) return false
        
        const categoryCode = firParts[1] // Es: FIR-U6-LR-001 -> U6
        
        // Mappa i codici alle categorie
        const categoryMapping = {
          'U6': 'U6',
          'U8': 'U8', 
          'U10': 'U10',
          'U12': 'U12',
          'U14': 'U14',
          'U16': 'U16',
          'U18': 'U18',
          'SC': 'SERIE_C',
          'SB': 'SERIE_B',
          'POD': 'PODEROSA',
          'GUS': 'GUSSAGOLD',
          'BRI': 'BRIXIAOLD',
          'LEO': 'LEONESSE'
        }
        
        const mappedCategory = categoryMapping[categoryCode]
        return mappedCategory === categoryData.code
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



      if (attendanceError) {
        console.error('Errore nel caricamento presenze:', attendanceError)
        return
      }

      // Crea una mappa delle presenze
      const attendanceMap = (attendanceData || []).reduce((acc, record) => {
        acc[record.player_id] = record.status
        return acc
      }, {} as Record<string, string>)

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
          id,
          category_id,
          session_date,
          location,
          away_place,
          categories(id, code, name)
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        console.error('Errore nel caricamento sessione:', sessionError)
        // Ripristina lo scroll in caso di errore
        document.body.style.overflow = 'unset'
        return
      }

      // Imposta la categoria e la sessione nello store
      if (sessionData.categories) {
        pickCategory(sessionData.categories)
        setCurrentSession(sessionData)

        // Carica i giocatori della categoria
        await loadPlayers(sessionData.categories.id)
      } else {
        console.error('Nessuna categoria trovata per la sessione')
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
    // Ripristina lo scroll della pagina
    document.body.style.overflow = 'unset'
    
    setShowAttendancePopup(false)
    setSelectedSessionId(null)
    setPopupExpanded(false)
    setIsOpeningPopup(false)
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

  // Filtra eventi per tipo e periodo
  const getFilteredEvents = (eventType: string, days: number) => {
    const today = new Date()
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + days)
    const endDateStr = endDate.toISOString().split('T')[0]
    
    return events.filter(event => {
      const isCorrectType = eventType === 'partite_tornei' 
        ? (event.event_type === 'partita' || event.event_type === 'torneo')
        : (event.event_type !== 'partita' && event.event_type !== 'torneo')
      
      return isCorrectType && event.event_date <= endDateStr
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
      const { data, error } = await supabase
        .from('training_locations')
        .select('start_time, end_time')
        .eq('category_id', session.category_id)
        .eq('weekday', weekday)
        .eq('location', session.location)
        .limit(1)

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

  // Funzione per ottenere il colore della categoria (Apple-style)
  const getCategoryColor = (categories: any) => {
    const code = categories?.code
    const colorMap: { [key: string]: string } = {
      'U6': 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-sm',
      'U8': 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-sm',
      'U10': 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-sm',
      'U12': 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-sm',
      'U14': 'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-sm',
      'U16': 'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-sm',
      'U18': 'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-sm',
      'SERIE_C': 'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-sm',
      'SERIE_B': 'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-sm',
      'GUSSAGOLD': 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-sm',
      'PODEROSA': 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-sm',
      'BRIXIAOLD': 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-sm',
      'LEONESSE': 'bg-gradient-to-br from-rose-400 to-rose-500 shadow-sm'
    }
    return colorMap[code] || 'bg-gradient-to-br from-sky-400 to-sky-500 shadow-sm'
  }

  // Funzione per ottenere il colore chiaro del cerchio basato sulla categoria (Apple-style)
  const getCategoryCircleColor = (categories: any) => {
    const code = categories?.code
    const colorMap: { [key: string]: string } = {
      'U6': 'bg-emerald-100 text-emerald-700',
      'U8': 'bg-emerald-100 text-emerald-700',
      'U10': 'bg-emerald-100 text-emerald-700',
      'U12': 'bg-emerald-100 text-emerald-700',
      'U14': 'bg-blue-100 text-blue-700',
      'U16': 'bg-blue-100 text-blue-700',
      'U18': 'bg-blue-100 text-blue-700',
      'SERIE_C': 'bg-blue-100 text-blue-700',
      'SERIE_B': 'bg-blue-100 text-blue-700',
      'GUSSAGOLD': 'bg-amber-100 text-amber-700',
      'PODEROSA': 'bg-amber-100 text-amber-700',
      'BRIXIAOLD': 'bg-amber-100 text-amber-700',
      'LEONESSE': 'bg-rose-100 text-rose-700'
    }
    return colorMap[code] || 'bg-gray-100 text-gray-700'
  }

  // Funzione per ottenere l'abbreviazione della categoria
  const getCategoryAbbreviation = (code: string) => {
    // Mappatura per codici
    const codeAbbreviations: { [key: string]: string } = {
      'U6': 'U6',
      'U8': 'U8', 
      'U10': 'U10',
      'U12': 'U12',
      'U14': 'U14',
      'U16': 'U16',
      'U18': 'U18',
      'SERIE_C': 'C',
      'SERIE_B': 'B',
      'SENIORES': 'SEN',
      'PODEROSA': 'POD',
      'GUSSAGOLD': 'GUS',
      'BRIXIAOLD': 'BRI',
      'LEONESSE': 'LEO'
    }
    
    // Mappatura per nomi completi (nel caso arrivino i nomi invece dei codici)
    const nameAbbreviations: { [key: string]: string } = {
      'Under 6': 'U6',
      'Under 8': 'U8',
      'Under 10': 'U10',
      'Under 12': 'U12',
      'Under 14': 'U14',
      'Under 16': 'U16',
      'Under 18': 'U18',
      'Serie C': 'C',
      'Serie B': 'B',
      'Seniores': 'SEN',
      'Poderosa': 'POD',
      'GussagOld': 'GUS',
      'Brixia Old': 'BRI',
      'Leonesse': 'LEO'
    }
    
    // Prova prima con i codici, poi con i nomi
    const result = codeAbbreviations[code] || nameAbbreviations[code] || code
    return result
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
      items: grouped[date]
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Gestione Attività" 
        showBack={true} 
      />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Dashboard interno con statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl p-6 bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-sm">
            <div className="flex items-center">
              <div className="text-3xl mr-6">📊</div>
              <div>
                <div className="text-2xl font-bold">{stats.totalSessions}</div>
                <div className="text-sm text-emerald-100">Sessioni Totali ({stats.averageAttendance}%)</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl p-6 bg-gradient-to-br from-sky-400 to-sky-500 text-white shadow-sm">
            <div className="flex items-center">
              <div className="text-3xl mr-6">🟢</div>
              <div>
                <div className="text-2xl font-bold">{stats.activeSessions}</div>
                <div className="text-sm text-sky-100">Totale Partite</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl p-6 bg-gradient-to-br from-violet-400 to-violet-500 text-white shadow-sm">
            <div className="flex items-center">
              <div className="text-3xl mr-6">✅</div>
              <div>
                <div className="text-2xl font-bold">{stats.completedSessions}</div>
                <div className="text-sm text-violet-100">Totale Tornei</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl p-6 bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm">
            <div className="flex items-center">
              <div className="text-3xl mr-6">🏈</div>
              <div>
                <div className="text-2xl font-bold">{stats.categoriesCount}</div>
                <div className="text-sm text-amber-100">Categorie</div>
              </div>
            </div>
          </div>
        </div>

        {/* Header per azioni rapide */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div className="flex gap-3">
            <button
              onClick={handleNewSessionClick}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              🚀 Nuova Sessione
            </button>

          </div>
          
          <div className="mt-4 md:mt-0">
            <button
              onClick={() => navigate('/events')}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
            >
              📅 Gestione Eventi
            </button>
          </div>
        </div>

        {/* Sezione categorie per visualizzazione attività */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Categorie</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={`card p-4 text-center cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${getCategoryColor(category)} text-white`}
              >
                <div className="font-semibold text-white text-lg">
                  {category.name}
                  {categoryAttendancePercentages[category.id] && (
                    <span className="text-sm font-normal opacity-90"> ({categoryAttendancePercentages[category.id]}%)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sezione attività - Layout a 3 colonne */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Colonna 1: Sessioni Questa Settimana */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Allenamenti Settimanali</h2>
          
          {loading ? (
              <div className="text-center py-8">
              <div className="text-2xl mb-2">⏳</div>
                <p className="text-gray-500 text-sm">Caricamento...</p>
            </div>
          ) : sessions.length === 0 ? null : (
              <div className="space-y-6">
                {groupByDate(sessions).map((dateGroup) => (
                  <div key={dateGroup.date}>
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-100 shadow-sm">
                        {formatDateHeader(dateGroup.date)}
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {dateGroup.items.map((session) => (
                    <div key={session.id} className="bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl p-4 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200" onClick={() => handleOpenAttendancePopup(session.id)}>
                      <div className="flex items-start">
                        <div className={`text-lg font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 mr-6 ${session.categories?.code ? getCategoryCircleColor(session.categories) : 'bg-gray-200 text-gray-800'}`}>
                          {session.categories?.code ? getCategoryAbbreviation(session.categories.code) : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-600 mt-1">
                            {formatDate(session.session_date)}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {sessionTimes[session.id] ? `${sessionTimes[session.id].start_time.substring(0, 5)} - ${sessionTimes[session.id].end_time.substring(0, 5)} • ` : ''}{session.location === 'Trasferta' ? session.away_place : session.location}
                          </p>
                        </div>
                        {/* Status indicator */}
                        <div className="flex-shrink-0 ml-2 flex items-center gap-1">
                          {(() => {
                            const status = sessionAttendanceStatus[session.id]
                            
                            if (status?.isComplete) {
                              return (
                                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">
                                    {status.totalPlayers}
                                  </span>
                                </div>
                              )
                            } else if (status?.hasUnassigned) {
                              return (
                                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">{status.unassignedCount}</span>
                                </div>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </div>
                                    </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* Colonna 2: Partite & Tornei (15 giorni) */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Partite & Tornei al {new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">⏳</div>
                <p className="text-gray-500 text-sm">Caricamento...</p>
              </div>
            ) : getFilteredEvents('partite_tornei', 15).length === 0 ? null : (
              <div className="space-y-6">
                {groupByDate(getFilteredEvents('partite_tornei', 15)).map((dateGroup) => (
                  <div key={dateGroup.date}>
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-100 shadow-sm">
                        {formatDateHeader(dateGroup.date)}
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {dateGroup.items.map((event) => (
                  <div key={event.id} className="bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl p-4 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200" onClick={() => handleEventClick(event)}>
                    <div className="flex items-start">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 mr-6 ${event.categories?.code ? getCategoryCircleColor(event.categories) : 'bg-gray-200 text-gray-800'}`}>
                        {event.categories?.code ? getCategoryAbbreviation(event.categories.code) : 
                         event.event_type === 'consiglio' ? 'CON' :
                         event.event_type === 'incontro_genitori' ? 'GEN' :
                         event.event_type === 'incontro_staff' ? 'STAFF' : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                          {event.event_type === 'consiglio' ? `Consiglio del ${formatDate(event.event_date)}` : event.title}
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDate(event.event_date)}
                          {event.start_time && event.end_time ? ` • ${event.start_time.substring(0, 5)} - ${event.end_time.substring(0, 5)}` : 
                           event.event_time ? ` • ${event.event_time.substring(0, 5)}` : ''}
                          {event.location && ` • ${event.location}`} {event.is_home ? '(Casa)' : '(Trasferta)'}
                        </p>
                      </div>
                    </div>

                                  </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* Colonna 3: Altri Eventi (30 giorni) */}
        <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Altri Eventi al {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">⏳</div>
                <p className="text-gray-500 text-sm">Caricamento...</p>
              </div>
            ) : getFilteredEvents('altri', 30).length === 0 ? null : (
              <div className="space-y-6">
                {groupByDate(getFilteredEvents('altri', 30)).map((dateGroup) => (
                  <div key={dateGroup.date}>
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-100 shadow-sm">
                        {formatDateHeader(dateGroup.date)}
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {dateGroup.items.map((event) => (
                  <div key={event.id} className="bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl p-4 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200" onClick={() => handleEventClick(event)}>
                    <div className="flex items-start">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 mr-6 ${event.categories?.code ? getCategoryCircleColor(event.categories) : 'bg-gray-200 text-gray-800'}`}>
                        {event.categories?.code ? getCategoryAbbreviation(event.categories.code) : 
                         event.event_type === 'consiglio' ? 'CON' :
                         event.event_type === 'incontro_genitori' ? 'GEN' :
                         event.event_type === 'incontro_staff' ? 'STAFF' : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                          {event.event_type === 'consiglio' ? `Consiglio del ${formatDate(event.event_date)}` : event.title}
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDate(event.event_date)}
                          {event.start_time && event.end_time ? ` • ${event.start_time.substring(0, 5)} - ${event.end_time.substring(0, 5)}` : 
                           event.event_time ? ` • ${event.event_time.substring(0, 5)}` : ''}
                          {event.location && ` • ${event.location}`} {event.is_home ? '(Casa)' : '(Trasferta)'}
                        </p>
                      </div>
                    </div>

                  </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal per selezione tipo sessione */}
        {showSessionTypeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🚀 Nuova Sessione</h2>
              <p className="text-gray-600 mb-6">Scegli il tipo di sessione che vuoi creare:</p>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSessionType('single')
                    setShowSessionTypeModal(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎯</span>
                    <div className="text-left">
                      <div className="font-semibold">Singolo Allenamento</div>
                      <div className="text-sm opacity-90">Prossimo giorno disponibile</div>
                    </div>
                  </div>
                  <span className="text-xl">→</span>
                </button>

                <button
                  onClick={() => {
                    setSessionType('weekly')
                    setShowSessionTypeModal(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full p-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📅</span>
                    <div className="text-left">
                      <div className="font-semibold">Settimanale</div>
                      <div className="text-sm opacity-90">Tutti i giorni di allenamento</div>
                    </div>
                  </div>
                  <span className="text-xl">→</span>
                </button>

                <button
                  onClick={() => {
                    setSessionType('biweekly')
                    setShowSessionTypeModal(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full p-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📆</span>
                    <div className="text-left">
                      <div className="font-semibold">2 Settimane</div>
                      <div className="text-sm opacity-90">Due settimane di allenamenti</div>
                    </div>
                  </div>
                  <span className="text-xl">→</span>
                </button>

                <button
                  onClick={() => {
                    setSessionType('monthly')
                    setShowSessionTypeModal(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full p-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🗓️</span>
                    <div className="text-left">
                      <div className="font-semibold">4 Settimane</div>
                      <div className="text-sm opacity-90">Un mese di allenamenti</div>
                    </div>
                  </div>
                  <span className="text-xl">→</span>
                </button>

                <button
                  onClick={() => {
                    setSessionType('extra')
                    setShowSessionTypeModal(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full p-4 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚙️</span>
                    <div className="text-left">
                      <div className="font-semibold">Allenamento Extra</div>
                      <div className="text-sm opacity-90">Configurazione manuale</div>
                    </div>
                  </div>
                  <span className="text-xl">→</span>
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

        {/* Modal per creare nuova sessione */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
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
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <select
                    required
                    value={newSession.location}
                    onChange={(e) => setNewSession({...newSession, location: e.target.value, away_location: ''})}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleziona location</option>
                    <option value="Brescia">Brescia</option>
                    <option value="Gussago">Gussago</option>
                    <option value="Ospitaletto">Ospitaletto</option>
                    <option value="Trasferta">Trasferta</option>
                  </select>
                </div>

                {/* Campo Trasferta (condizionale) */}
                {newSession.location === 'Trasferta' && (
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
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

        {/* Popup per le presenze */}
        {showAttendancePopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 max-h-[95vh] flex flex-col">
              {/* Header del popup */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  Presenze – {currentCategory?.code || 'Categoria'}
                </h2>
                <button
                  onClick={handleCloseAttendancePopup}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Chiudi"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Contenuto del popup */}
              <div className="flex-1 overflow-hidden">
                <div className="card p-0 overflow-hidden h-full">
                  <div className="max-h-full overflow-auto divide-y divide-white/50 relative">
                      {players.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <div className="text-2xl mb-2">👥</div>
                          <p>Nessun giocatore trovato per questa categoria</p>
                        </div>
                      ) : (
                        (() => {
                          // Raggruppa i giocatori per status
                          const groupedPlayers = players.reduce((groups, player) => {
                            const status = attendance[player.id]?.status
                            const place = attendance[player.id]?.injured_place
                            
                            let groupKey = 'Nessun Status'
                            if (!status) groupKey = 'Nessun Status'
                            else if (status === 'PRESENTE') groupKey = 'Presenti'
                            else if (status === 'INFORTUNATO' && place === 'PALESTRA') groupKey = 'Infortunati (Campo)'
                            else if (status === 'INFORTUNATO' && place === 'CASA') groupKey = 'Infortunati (Casa)'
                            else if (status === 'ASSENTE') groupKey = 'Assenti'
                            else if (status === 'MALATO') groupKey = 'Malati'

                            
                            if (!groups[groupKey]) groups[groupKey] = []
                            groups[groupKey].push(player)
                            return groups
                          }, {} as Record<string, typeof players>)

                          // Ordine dei gruppi
                          const groupOrder = [
                            'Nessun Status',
                            'Presenti', 
                            'Infortunati (Campo)',
                            'Infortunati (Casa)',
                            'Assenti',
                            'Malati',
                            'Permesso'
                          ]

                          return groupOrder.map(groupKey => {
                            const groupPlayers = groupedPlayers[groupKey]
                            if (!groupPlayers || groupPlayers.length === 0) return null

                            // Ordina i giocatori del gruppo per cognome
                            const sortedPlayers = groupPlayers.sort((a, b) => 
                              a.last_name.localeCompare(b.last_name)
                            )

                            return (
                              <div key={groupKey}>
                                {/* Titolo del gruppo */}
                                <div className="px-3 py-2 bg-gray-100 border-b border-gray-200">
                                  <h3 className="text-sm font-semibold text-gray-700">
                                    {groupKey} ({groupPlayers.length})
                                  </h3>
                                </div>
                                
                                {/* Giocatori del gruppo */}
                                {sortedPlayers.map(p => (
                                  <AttendanceRow 
                                    key={p.id} 
                                    player={p as any} 
                                    onExpandPopup={handleExpandPopup}
                                    onCollapsePopup={handleCollapsePopup}
                                  />
                                ))}
                              </div>
                            )
                          }).filter(Boolean)
                        })()
                      )}
                    </div>
                  </div>
                </div>
            </div>
            </div>
          )}
      </div>

      {/* Modal per i dettagli dell'evento - Stile Events */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header del modal */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-navy">
                  {selectedEvent.title}
                </h2>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Contenuto del modal - Stile Events */}
              <div className="space-y-6">
                {/* Data e Orari */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">📅 Data e Orari</h4>
                  <p className="text-blue-700">{formatDate(selectedEvent.event_date)}</p>
                  {selectedEvent.start_time && selectedEvent.end_time && (
                    <p className="text-blue-700">
                      Inizio: {selectedEvent.start_time.substring(0, 5)} - Fine: {selectedEvent.end_time.substring(0, 5)}
                    </p>
                  )}
                  {selectedEvent.event_time && !selectedEvent.start_time && (
                    <p className="text-blue-700">
                      Ora: {selectedEvent.event_time.substring(0, 5)}
                    </p>
                  )}
                </div>

                {/* Location */}
                {selectedEvent.location && (
                  <div className="bg-pink-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-pink-800 mb-2">📍 Location</h4>
                    <p className="text-pink-700">
                      {selectedEvent.location} {selectedEvent.is_home ? '(Casa)' : '(Trasferta)'}
                    </p>
                  </div>
                )}

                {/* Avversario */}
                {selectedEvent.opponent && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">🌍 Avversario</h4>
                    <p className="text-blue-700">{selectedEvent.opponent}</p>
                    <span className="text-xs bg-blue-200 px-2 py-1 rounded mt-2 inline-block">
                      1 avversario
                    </span>
                  </div>
                )}

                {/* Avversari (per tornei) */}
                {selectedEvent.opponents && selectedEvent.opponents.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">🌍 Squadre</h4>
                    <p className="text-blue-700">{selectedEvent.opponents.join(', ')}</p>
                    <span className="text-xs bg-blue-200 px-2 py-1 rounded mt-2 inline-block">
                      {selectedEvent.opponents.length} squadre
                    </span>
                  </div>
                )}

                {/* Partecipanti (solo per consiglio) */}
                {selectedEvent.event_type === 'consiglio' && selectedEvent.participants && selectedEvent.participants.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">👥 Partecipanti</h4>
                    <p className="text-blue-700">{selectedEvent.participants.join(', ')}</p>
                    <span className="text-xs bg-blue-200 px-2 py-1 rounded mt-2 inline-block">
                      {selectedEvent.participants.length} membri
                    </span>
                  </div>
                )}

                {/* Invitati (solo per consiglio) */}
                {selectedEvent.event_type === 'consiglio' && selectedEvent.invited && selectedEvent.invited.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">🎫 Invitati</h4>
                    <p className="text-green-700">{selectedEvent.invited.join(', ')}</p>
                    <span className="text-xs bg-green-200 px-2 py-1 rounded mt-2 inline-block">
                      {selectedEvent.invited.length} invitati
                    </span>
                  </div>
                )}

                {/* Categoria */}
                {selectedEvent.category_id && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">🏈 Categoria</h4>
                    <p className="text-purple-700">
                      {categories.find(cat => cat.id === selectedEvent.category_id)?.name || 'Categoria non trovata'}
                    </p>
                  </div>
                )}

                {/* Descrizione */}
                {selectedEvent.description && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-2">📝 Descrizione</h4>
                    <p className="text-gray-700">{selectedEvent.description}</p>
                  </div>
                )}
              </div>

              {/* Pulsanti di azione */}
              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t">
                <button
                  onClick={() => {
                    setShowEventModal(false)
                    navigate(`/events?edit=${selectedEvent.id}`)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  Modifica
                </button>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
