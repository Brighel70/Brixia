import Header from '@/components/Header'
import AttendanceRow from '@/components/AttendanceRow'
import StatusPill from '@/components/StatusPill'
import StatsDashboard from '@/components/StatsDashboard'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { usePermissions } from '@/hooks/usePermissions'
import { useData } from '@/store/data'

const statuses = [
  { key: 'PRESENTE', short: 'P' },
  { key: 'ASSENTE', short: 'A' },
  { key: 'INFORTUNATO', short: 'INF' },
  { key: 'PERMESSO', short: 'PR' },
  { key: 'MALATO', short: 'M' },
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
  categories: {
    id: string
    code: string
    name: string
  }
}

export default function CategoryActivities() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionTimes, setSessionTimes] = useState<{[key: string]: {start_time: string, end_time: string}}>({})
  const [loading, setLoading] = useState(true)
  const [categoryName, setCategoryName] = useState('')
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [editForm, setEditForm] = useState({
    session_date: '',
    location: 'Brescia' as 'Brescia'|'Gussago'|'Ospitaletto'|'Trasferta',
    away_place: ''
  })
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [modalPlayers, setModalPlayers] = useState<any[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [modalAttendance, setModalAttendance] = useState<Record<string, { status: string; injured_place?: string }>>({})
  const [lastAttendanceUpdate, setLastAttendanceUpdate] = useState<Date | null>(null)
  const [lockedSessions, setLockedSessions] = useState<Set<string>>(new Set())
  const [showStats, setShowStats] = useState(false)
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  
  // Sistema di creazione sessioni intelligente
  const [showSessionTypeModal, setShowSessionTypeModal] = useState(false)
  const [sessionType, setSessionType] = useState<'single' | 'weekly' | 'biweekly' | 'monthly' | 'extra' | null>(null)
  const [bulkSessionNote, setBulkSessionNote] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Stati per il popup di presenza
  const [showAttendancePopup, setShowAttendancePopup] = useState(false)
  const [currentCategory, setCurrentCategory] = useState<any>(null)
  const [attendance, setAttendance] = useState<Record<string, { status: string; injured_place?: string }>>({})
  const [isOpeningPopup, setIsOpeningPopup] = useState(false)
  
  // State per memorizzare lo status delle presenze per ogni sessione
  const [sessionAttendanceStatus, setSessionAttendanceStatus] = useState<Record<string, {
    hasUnassigned: boolean
    unassignedCount: number
    isComplete: boolean
    presentCount: number
    totalPlayers: number
  }>>({})
  
  const { isAdmin, isAllenatore, isTeamManager } = usePermissions()
  const { loadPlayers, players, setCurrentSession, setCurrentCategory: setDataCurrentCategory } = useData()

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

  const loadCategorySessions = async (categoryCode: string) => {
    try {
      // Prima trova l'ID della categoria
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('code', categoryCode)
        .single()

      if (categoryError) {
        console.error('Errore nel trovare categoria:', categoryError)
        return
      }

      setCategoryName(categoryData.name)
      setCurrentCategoryId(categoryData.id)

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
          categories!inner(id, code, name)
        `)
        .eq('category_id', categoryData.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Errore nel caricamento sessioni:', error)
        return
      }

      setSessions(data || [])
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

  const getCategoryAbbreviation = (code: string) => {
    const abbreviations: { [key: string]: string } = {
      'U6': 'U6', 'U8': 'U8', 'U10': 'U10', 'U12': 'U12', 'U14': 'U14', 'U16': 'U16', 'U18': 'U18',
      'SERIE_C': 'C', 'SERIE_B': 'B', 'SENIORES': 'SEN', 'PODEROSA': 'POD', 'GUSSAGOLD': 'GUS', 'BRIXIAOLD': 'BRI', 'LEONESSE': 'LEO'
    }
    return abbreviations[code] || code
  }

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

  const getNextAvailableTrainingDay = (trainingLocations: any[], startDate: Date) => {
    const weekdays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Ordina le sedi per giorno della settimana
    const sortedLocations = [...trainingLocations].sort((a, b) => {
      const dayA = weekdays.indexOf(a.weekday)
      const dayB = weekdays.indexOf(b.weekday)
      return dayA - dayB
    })

    // Cerca il prossimo giorno disponibile
    for (let i = 0; i < 14; i++) { // Cerca per 2 settimane
      const checkDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const dayOfWeek = weekdays[checkDate.getDay()]
      
      const location = sortedLocations.find(loc => loc.weekday === dayOfWeek)
      if (location && checkDate >= today) {
        return { date: checkDate, location }
      }
    }

    return null
  }

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
        setSessionType(null)
        setBulkSessionNote('')
        
        // Ricarica le sessioni
        const categoryCode = searchParams.get('category')
        if (categoryCode) {
          loadCategorySessions(categoryCode)
        }
      }
    } catch (error) {
      console.error('Errore nella creazione sessioni multiple:', error)
      alert('Errore nella creazione delle sessioni')
    }
  }

  // Funzione per aprire il modal di selezione tipo sessione
  const handleNewSessionClick = () => {
    setShowSessionTypeModal(true)
  }

  // Funzioni per separare le sessioni
  const getActiveSessions = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return sessions
      .filter(session => new Date(session.session_date) >= today)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
  }

  const getCompletedSessions = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return sessions
      .filter(session => new Date(session.session_date) < today)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
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
  const saveModalAttendance = async (playerId: string, status: string, injured_place?: string) => {
    if (!selectedSession) return

    try {
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
      
      // Aggiorna la data dell'ultima modifica
      setLastAttendanceUpdate(new Date())
    } catch (error) {
      console.error('Errore nel salvataggio presenze:', error)
    }
  }

  const openAttendanceModal = async (session: Session) => {
    setSelectedSession(session)
    setShowAttendanceModal(true)
    setModalLoading(true)
    
    // Blocca lo scroll del body
    document.body.style.overflow = 'hidden'
    
    try {
      // Imposta la sessione corrente nello store globale
      setCurrentSession(session)
      setCurrentCategory(session.categories)
      
      // Carica i giocatori per questa categoria
      await loadPlayers(session.category_id)
      
      // Carica le presenze specifiche per questa sessione
      await loadSessionAttendance(session.id)
      
      setModalLoading(false)
    } catch (error) {
      console.error('Errore nel caricamento giocatori:', error)
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
    setEditForm({
      session_date: session.session_date,
      location: session.location as any,
      away_place: session.away_place || ''
    })
    setEditingSession(session)
  }

  // Salva modifiche sessione
  const saveSessionEdit = async () => {
    if (!editingSession) return

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          session_date: editForm.session_date,
          location: editForm.location,
          away_place: editForm.location === 'Trasferta' ? editForm.away_place : null
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
        location: 'Brescia',
        away_place: ''
      })
    } catch (error) {
      console.error('Errore:', error)
      alert('Errore nel salvataggio')
    }
  }

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
          categories(id, code, name)
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        console.error('Errore nel caricamento sessione:', sessionError)
        alert('Errore nel caricamento della sessione')
        return
      }

      setCurrentCategory(sessionData.categories)
      setDataCurrentCategory(sessionData.categories.id)
      setCurrentSession(sessionId)
      
      // Carica i giocatori della categoria
      await loadPlayers(sessionData.categories.id)
      
      // Carica le presenze esistenti
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
    setAttendance({})
    setIsOpeningPopup(false)
    document.body.style.overflow = 'unset'
  }

  const loadSessionAttendanceStatus = async (sessionId: string, categoryId?: string) => {
    try {
      let categoryCode: string
      
      if (categoryId) {
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
        categoryCode = categoryData.code
      } else {
        // Carica il codice della categoria dalla sessione
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('categories!inner(code)')
          .eq('id', sessionId)
          .single()

        if (!sessionData?.categories?.code) return
        categoryCode = sessionData.categories.code
      }

      // Carica tutti i giocatori della categoria
      const { data: allPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('fir_code', categoryCode)

      if (!allPlayers) return

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

      // Calcola le statistiche
      const unassignedCount = allPlayers.filter(player => !attendanceMap[player.id]).length
      const hasUnassigned = unassignedCount > 0
      const isComplete = !hasUnassigned && allPlayers.length > 0
      const presentCount = allPlayers.filter(player => attendanceMap[player.id]?.status === 'PRESENTE').length
      const totalPlayers = allPlayers.length

      const newStatus = { hasUnassigned, unassignedCount, isComplete, presentCount, totalPlayers }

      // Aggiorna lo stato delle statistiche
      setSessionAttendanceStatus(prev => ({
        ...prev,
        [sessionId]: newStatus
      }))

      // Se è per il popup, aggiorna anche l'attendance
      if (!categoryId) {
        setAttendance(attendanceMap)
      }
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

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-lg">Caricamento attività...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`Attività - ${categoryName}`} showBack={true} />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Attività {categoryName}</h1>
              <p className="text-gray-600 mt-2">
                Sessioni e allenamenti della categoria {categoryName}
              </p>
            </div>
            <button
              onClick={() => setShowStats(!showStats)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                showStats 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <span>📊</span>
              <span>{showStats ? 'Nascondi' : 'Mostra'} Statistiche</span>
            </button>
          </div>
        </div>

        {/* Dashboard Statistiche Avanzate */}
        {showStats && currentCategoryId && (
          <div className="mb-8">
            <StatsDashboard 
              categoryId={currentCategoryId} 
              categoryName={categoryName} 
            />
          </div>
        )}

        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">📊</div>
              <div>
                <div className="text-2xl font-bold">{sessions.length}</div>
                <div className="text-sm text-blue-100">Sessioni Totali</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-green-500 to-green-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">📅</div>
              <div>
                <div className="text-2xl font-bold">
                  {sessions.length > 0 ? formatDate(sessions[0].session_date) : 'N/A'}
                </div>
                <div className="text-sm text-green-100">Ultima Sessione</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🏉</div>
              <div>
                <div className="text-2xl font-bold">{getCategoryAbbreviation(searchParams.get('category') || '')}</div>
                <div className="text-sm text-purple-100">Categoria</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista sessioni */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Sessioni</h2>
            <button
              onClick={handleNewSessionClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🚀 Nuova Sessione
            </button>
          </div>
          
          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2 text-gray-400">📊</div>
              <p className="text-gray-600">Nessuna sessione trovata per questa categoria</p>
              <p className="text-gray-500 text-sm mt-2">Crea la prima sessione per iniziare</p>
              <button
                onClick={handleNewSessionClick}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                🚀 Crea Prima Sessione
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Colonna Attivi */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Attivi</h3>
                {getActiveSessions().length === 0 ? null : (
                  <div className="space-y-6">
                    {groupByDate(getActiveSessions()).map((dateGroup) => (
                      <div key={dateGroup.date}>
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-100 shadow-sm">
                            {formatDateHeader(dateGroup.date)}
                          </h4>
                        </div>
                        <div className="space-y-3">
                          {dateGroup.items.map((session) => (
                <div key={session.id} className="card p-6">
                  {editingSession?.id === session.id ? (
                    // Form di modifica
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 mb-4">Modifica Sessione</h3>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data *</label>
                        <input
                          type="date"
                          value={editForm.session_date}
                          onChange={(e) => setEditForm(prev => ({ ...prev, session_date: e.target.value }))}
                          className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                        <select
                          value={editForm.location}
                          onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value as any }))}
                          className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="Brescia">Brescia</option>
                          <option value="Gussago">Gussago</option>
                          <option value="Ospitaletto">Ospitaletto</option>
                          <option value="Trasferta">Trasferta</option>
                        </select>
                      </div>

                      {editForm.location === 'Trasferta' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Luogo Trasferta</label>
                          <input
                            type="text"
                            value={editForm.away_place}
                            onChange={(e) => setEditForm(prev => ({ ...prev, away_place: e.target.value }))}
                            placeholder="Es: Stadio Comunale Milano"
                            className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}

                      <div className="flex gap-4">
                        <button
                          onClick={() => {
                            setEditingSession(null)
                            setEditForm({
                              session_date: '',
                              location: 'Brescia',
                              away_place: ''
                            })
                          }}
                          className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Annulla
                        </button>
                        <button
                          onClick={saveSessionEdit}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Salva Modifiche
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Vista normale della sessione
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl font-bold text-blue-600 bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center">
                          {getCategoryAbbreviation(session.categories?.code || '')}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">
                            Data: {formatDate(session.session_date)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {sessionTimes[session.id] ? `${sessionTimes[session.id].start_time.substring(0, 5)} - ${sessionTimes[session.id].end_time.substring(0, 5)} • ` : ''}Location: {session.location}
                            {session.away_place && ` - ${session.away_place}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => handleOpenAttendancePopup(session.id)}
                          disabled={isSessionLocked(session.id)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isSessionLocked(session.id)
                              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                          title={isSessionLocked(session.id) ? 'Presenze bloccate dopo 24 ore' : 'Registra presenze'}
                        >
                          📝 Registra Presenze
                        </button>
                        
                        {canManageSessions && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditSession(session)
                              }}
                              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modifica sessione"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteSession(session.id)
                              }}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Elimina sessione"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Colonna Effettuati */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Effettuati</h3>
                {getCompletedSessions().length === 0 ? null : (
                  <div className="space-y-6">
                    {groupByDate(getCompletedSessions()).map((dateGroup) => (
                      <div key={dateGroup.date}>
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-100 shadow-sm">
                            {formatDateHeader(dateGroup.date)}
                          </h4>
                        </div>
                        <div className="space-y-3">
                          {dateGroup.items.map((session) => (
                <div key={session.id} className="card p-6">
                  {editingSession?.id === session.id ? (
                    // Form di modifica
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 mb-4">Modifica Sessione</h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                        <input
                          type="date"
                          value={editForm.session_date}
                          onChange={(e) => setEditForm({...editForm, session_date: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                        <select
                          value={editForm.location}
                          onChange={(e) => setEditForm({...editForm, location: e.target.value as any})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="Brescia">Brescia</option>
                          <option value="Gussago">Gussago</option>
                          <option value="Ospitaletto">Ospitaletto</option>
                          <option value="Trasferta">Trasferta</option>
                        </select>
                      </div>
                      {editForm.location === 'Trasferta' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Dove in trasferta</label>
                          <input
                            type="text"
                            value={editForm.away_place}
                            onChange={(e) => setEditForm({...editForm, away_place: e.target.value})}
                            placeholder="Es: Milano, Bergamo..."
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button
                          onClick={saveEditSession}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Salva
                        </button>
                        <button
                          onClick={cancelEditSession}
                          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Vista normale della sessione
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl font-bold text-blue-600 bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center">
                          {getCategoryAbbreviation(session.categories?.code || '')}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">
                            Data: {formatDate(session.session_date)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {sessionTimes[session.id] ? `${sessionTimes[session.id].start_time.substring(0, 5)} - ${sessionTimes[session.id].end_time.substring(0, 5)} • ` : ''}Location: {session.location}
                            {session.away_place && ` - ${session.away_place}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenAttendancePopup(session.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                          >
                            Registra Presenze
                          </button>
                          {/* Status indicator */}
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
                        {canManageSessions && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditSession(session)
                              }}
                              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modifica sessione"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteSession(session.id)
                              }}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Elimina sessione"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal per le presenze */}
      {showAttendanceModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Presenze – {getCategoryAbbreviation(selectedSession.categories.code)}</h2>
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
                    </div>
                  ) : (
                    players.map(player => {
                      const current = modalAttendance[player.id]
                      return (
                        <div key={player.id} className="grid grid-cols-[auto,1fr,auto] items-center gap-2 py-1 px-2 border-b border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-gray-200 grid place-items-center font-semibold text-gray-700">
                            {player.last_name[0]}
                          </div>
                          <div className="truncate leading-tight">
                            <div className="font-semibold text-gray-900">{player.last_name} {player.first_name}</div>
                            {current?.status === 'INFORTUNATO' && (
                              <div className="text-xs text-gray-500">{current.injured_place === 'PALESTRA' ? 'Palestra' : 'Casa'}</div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {statuses.map(s => (
                              <StatusPill key={s.key}
                                label={s.short}
                                active={current?.status === s.key}
                                disabled={isAttendanceLocked()}
                                onClick={() => {
                                  if (isAttendanceLocked()) return
                                  
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

      {/* Modal per selezione tipo sessione */}
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
                    onClick={() => navigate(`/start?category=${searchParams.get('category')}`)}
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

      {/* Popup per le presenze */}
      {showAttendancePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 max-h-[95vh] flex flex-col">
            {/* Header del popup */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Presenze – {currentCategory?.name || 'Categoria'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {currentCategory && new Date().toLocaleDateString('it-IT', { 
                    weekday: 'long', 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
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
            <div className="flex-1 overflow-hidden flex">
              {/* Colonna sinistra - Lista giocatori */}
              <div className="flex-1 p-4">
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
                                  onExpandPopup={() => {}}
                                  onCollapsePopup={() => {}}
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
              
              {/* Colonna destra - Statistiche */}
              <div className="w-64 p-4 border-l border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Statistiche</h3>
                <div className="space-y-3">
                  {(() => {
                    // Calcola le statistiche
                    const stats = players.reduce((acc, player) => {
                      const status = attendance[player.id]?.status
                      if (status) {
                        acc[status] = (acc[status] || 0) + 1
                      }
                      return acc
                    }, {} as Record<string, number>)
                    
                    // Mappa i nomi degli status
                    const statusNames = {
                      'PRESENTE': 'P',
                      'ASSENTE': 'A', 
                      'INFORTUNATO': 'INF',
                      'PERMESSO': 'PR',
                      'MALATO': 'M'
                    }
                    
                    const totalPlayers = players.length
                    
                    // Mostra solo gli status selezionati con percentuali
                    return Object.entries(stats).map(([status, count]) => {
                      const percentage = totalPlayers > 0 ? Math.round((count / totalPlayers) * 100) : 0
                      return (
                        <div key={status} className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                          <span className="font-medium text-gray-700">
                            {statusNames[status as keyof typeof statusNames] || status}
                          </span>
                          <span className="text-lg font-bold text-gray-900">{percentage}%</span>
                        </div>
                      )
                    })
                  })()}
                  
                  {/* Totale */}
                  <div className="flex items-center justify-between bg-blue-100 rounded-lg p-3 shadow-sm border border-blue-200">
                    <span className="font-semibold text-blue-800">Totale</span>
                    <span className="text-lg font-bold text-blue-900">{players.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

