import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'

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
  verbale_pdf?: string
  verbale_pdfs?: string[]
  created_at: string
  categories?: {
    code: string
    name: string
  }
}

interface Category {
  id: string
  code: string
  name: string
}

interface CouncilMember {
  id: string
  name: string
  role: 'president' | 'vice_president' | 'counselor'
}

export default function Events() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [councilMembers, setCouncilMembers] = useState<CouncilMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_date: '',
    event_time: '',
    start_time: '',
    end_time: '',
    event_type: 'partita',
    category_id: '',
    location: '',
    away_location: '',
    is_home: false,
    opponent: '',
    opponents: [] as string[],
    description: '',
    participants: [] as string[],
    invited: [] as string[],
    verbale_pdf: '',
    verbale_pdfs: [] as string[],
    is_championship: false,
    is_friendly: false
  })
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingEventType, setPendingEventType] = useState('')
  const [opponentCount, setOpponentCount] = useState(1)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showInvitedModal, setShowInvitedModal] = useState(false)
  const [tempInvited, setTempInvited] = useState<string[]>([])

  useEffect(() => {
    loadEvents()
    loadCategories()
    loadCouncilMembers()
  }, [])

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          categories(id, code, name)
        `)
        .order('event_date', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Errore nel caricamento eventi:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('sort', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const loadCouncilMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('council_members')
        .select('*')
        .order('role', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      setCouncilMembers(data || [])
    } catch (error) {
      console.error('Errore nel caricamento membri consiglio:', error)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Prepara i dati per l'inserimento
      const eventData = {
        ...newEvent,
        // Per i tornei, usa opponents invece di opponent
        opponent: newEvent.event_type === 'torneo' ? null : newEvent.opponent,
        opponents: newEvent.event_type === 'torneo' ? newEvent.opponents : null,
        // Salva sempre start_time e end_time
        start_time: newEvent.start_time || null,
        end_time: newEvent.end_time || null,
        event_time: newEvent.event_time || null,
        // Per eventi consiglio, usa participants e invited
        participants: newEvent.event_type === 'consiglio' ? newEvent.participants : null,
        invited: newEvent.event_type === 'consiglio' ? newEvent.invited : null,
        verbale_pdf: newEvent.event_type === 'consiglio' ? newEvent.verbale_pdf : null,
        verbale_pdfs: newEvent.event_type === 'consiglio' ? newEvent.verbale_pdfs : null,
        // Gestisci category_id per eventi che non richiedono categoria
        category_id: newEvent.category_id || null
      }
      
      // Rimuovi i campi che non esistono nella tabella
      delete eventData.is_championship
      delete eventData.is_friendly
      
      console.log('🔍 Dati da creare:', eventData)
      console.log('🔍 Data evento:', eventData.event_date)
      
      const { error } = await supabase
        .from('events')
        .insert([eventData])

      if (error) throw error

      setShowCreateForm(false)
      resetForm()
      loadEvents()
    } catch (error) {
      console.error('Errore nella creazione evento:', error)
    }
  }

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event)
    
    // Per i consigli, genera il titolo automaticamente
    let title = event.title
    if (event.event_type === 'consiglio' && event.event_date) {
      title = `del ${new Date(event.event_date).toLocaleDateString('it-IT')}`
    }
    
    setNewEvent({
      title: title,
      event_date: event.event_date,
      event_time: event.event_time || '',
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      event_type: event.event_type,
      category_id: event.category_id,
      location: event.location,
      away_location: event.away_location || '',
      is_home: event.is_home,
      opponent: event.opponent || '',
      opponents: event.opponents || [],
      description: event.description || '',
      participants: event.participants || [],
      invited: event.invited || [],
      verbale_pdf: event.verbale_pdf || '',
      verbale_pdfs: event.verbale_pdfs || [],
      is_championship: false,
      is_friendly: false
    })
    setOpponentCount(event.opponents?.length || 1)
    setShowCreateForm(true)
    
    // Scroll al form dopo un breve delay per permettere il rendering
    setTimeout(() => {
      const formElement = document.getElementById('event-form')
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingEvent) return
    
    try {
      // Prepara i dati per l'aggiornamento
      const eventData = {
        ...newEvent,
        // Per i tornei, usa opponents invece di opponent
        opponent: newEvent.event_type === 'torneo' ? null : newEvent.opponent,
        opponents: newEvent.event_type === 'torneo' ? newEvent.opponents : null,
        // Salva sempre start_time e end_time
        start_time: newEvent.start_time || null,
        end_time: newEvent.end_time || null,
        event_time: newEvent.event_time || null,
        // Per eventi consiglio, usa participants e invited
        participants: newEvent.event_type === 'consiglio' ? newEvent.participants : null,
        invited: newEvent.event_type === 'consiglio' ? newEvent.invited : null,
        verbale_pdf: newEvent.event_type === 'consiglio' ? newEvent.verbale_pdf : null,
        verbale_pdfs: newEvent.event_type === 'consiglio' ? newEvent.verbale_pdfs : null,
        // Gestisci category_id per eventi che non richiedono categoria
        category_id: newEvent.category_id || null
      }
      
      // Rimuovi i campi che non esistono nella tabella
      delete eventData.is_championship
      delete eventData.is_friendly
      

      
      const { error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', editingEvent.id)

      if (error) throw error

      setShowCreateForm(false)
      setEditingEvent(null)
      resetForm()
      loadEvents()
    } catch (error) {
      console.error('Errore nell\'aggiornamento evento:', error)
    }
  }

  const handleCancelEdit = () => {
    setShowCreateForm(false)
    setEditingEvent(null)
    resetForm()
  }

  const resetForm = () => {
    setNewEvent({
      title: '',
      event_date: '',
      event_time: '',
      start_time: '',
      end_time: '',
      event_type: 'partita',
      category_id: '',
      location: '',
      away_location: '',
      is_home: false,
      opponent: '',
      opponents: [],
      description: '',
      participants: [],
      invited: [],
      verbale_pdf: '',
      verbale_pdfs: [],
      is_championship: false,
      is_friendly: false
    })
    setOpponentCount(1)
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questo evento?')) {
      try {
        // Prima trova l'evento per ottenere il nome del PDF
        const eventToDelete = events.find(event => event.id === eventId)
        
        // Elimina l'evento dal database
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId)

        if (error) throw error

        // Se l'evento aveva PDF, elimina anche i file da Supabase Storage
        const pdfFiles = []
        if (eventToDelete?.verbale_pdf) pdfFiles.push(eventToDelete.verbale_pdf)
        if (eventToDelete?.verbale_pdfs) pdfFiles.push(...eventToDelete.verbale_pdfs)
        
        if (pdfFiles.length > 0) {
          try {
            // Rimuovi i file da Supabase Storage
            const filePaths = pdfFiles.map(filename => `events/${filename}`)
            const { error: storageError } = await supabase.storage
              .from('docs')
              .remove(filePaths)
            
            if (storageError) {
              console.warn('Errore nell\'eliminazione dei file PDF da Supabase Storage:', storageError)
            } else {
              console.log('File PDF eliminati da Supabase Storage:', pdfFiles)
            }
            
            // Rimuovi anche da localStorage (fallback)
            pdfFiles.forEach(filename => {
              localStorage.removeItem(`pdf_${filename}`)
            })
          } catch (fileError) {
            console.warn('Errore nell\'eliminazione dei file PDF:', fileError)
          }
        }

        loadEvents()
      } catch (error) {
        console.error('Errore nell\'eliminazione evento:', error)
      }
    }
  }

  const generateEventTitle = () => {
    if (newEvent.event_type !== 'partita') return ''

    const category = categories.find(cat => cat.id === newEvent.category_id)
    const categoryName = category ? category.name : ''
    
    // Verifica che tutti i campi necessari siano compilati
    if (!categoryName || !newEvent.opponent) return ''
    
    // Se è in casa: "Nostra Categoria vs Avversario" (per capire che giochiamo in casa)
    // Se è in trasferta: "Avversario vs Nostra Categoria" (per capire che giochiamo fuori)
    if (newEvent.is_home) {
      return `${newEvent.opponent} vs ${categoryName}`
    } else {
      return `${categoryName} vs ${newEvent.opponent}`
    }
  }

  const handleEventTypeChange = (eventType: string) => {
    // Controlla se ci sono dati inseriti
    const hasData = newEvent.title || newEvent.category_id || newEvent.opponent || 
                   newEvent.event_date || newEvent.location || newEvent.description ||
                   newEvent.opponents.some(opp => opp.trim() !== '')
    
    if (hasData && eventType !== newEvent.event_type) {
      // Mostra popup di conferma
      setPendingEventType(eventType)
      setShowConfirmDialog(true)
    } else {
      // Cambia direttamente il tipo
      changeEventType(eventType)
    }
  }

  const changeEventType = (eventType: string) => {
    setNewEvent({...newEvent, event_type: eventType})
    
    // Reset dei campi specifici per il nuovo tipo
    if (eventType === 'torneo') {
      setNewEvent(prev => ({
        ...prev,
        opponent: '',
        opponents: ['']
      }))
      setOpponentCount(1)
    } else {
      setNewEvent(prev => ({
        ...prev,
        opponent: '',
        opponents: []
      }))
      setOpponentCount(1)
    }
    
    // Se è una partita, genera automaticamente il titolo solo se tutti i campi sono compilati
    if (eventType === 'partita') {
      const autoTitle = generateEventTitle()
      if (autoTitle) {
        setNewEvent(prev => ({...prev, title: autoTitle}))
      }
    }
    
    // Se è un consiglio, genera automaticamente il titolo
    if (eventType === 'consiglio' && newEvent.event_date) {
      const councilTitle = `del ${new Date(newEvent.event_date).toLocaleDateString('it-IT')}`
      setNewEvent(prev => ({...prev, title: councilTitle}))
    }
  }

  const confirmEventTypeChange = () => {
    changeEventType(pendingEventType)
    setShowConfirmDialog(false)
    setPendingEventType('')
  }

  const cancelEventTypeChange = () => {
    setShowConfirmDialog(false)
    setPendingEventType('')
  }

  const handleCategoryChange = (categoryId: string) => {
    setNewEvent({...newEvent, category_id: categoryId})
    
    // Se è una partita, aggiorna il titolo automaticamente solo se tutti i campi sono compilati
    if (newEvent.event_type === 'partita') {
      const autoTitle = generateEventTitle()
      if (autoTitle) {
        setNewEvent(prev => ({...prev, title: autoTitle}))
      }
    }
  }

  const handleOpponentChange = (opponent: string) => {
    setNewEvent({...newEvent, opponent})
    
    // Se è una partita, aggiorna il titolo automaticamente solo se tutti i campi sono compilati
    if (newEvent.event_type === 'partita') {
      const autoTitle = generateEventTitle()
      if (autoTitle) {
        setNewEvent(prev => ({...prev, title: autoTitle}))
      }
    }
  }

  const handleHomeAwayChange = (isHome: boolean) => {
    setNewEvent({...newEvent, is_home: isHome})
    
    // Se è una partita, aggiorna il titolo automaticamente solo se tutti i campi sono compilati
    if (newEvent.event_type === 'partita') {
      const autoTitle = generateEventTitle()
      if (autoTitle) {
        setNewEvent(prev => ({...prev, title: autoTitle}))
      }
    }
  }

  const handleLocationChange = (location: string) => {
    setNewEvent({...newEvent, location, away_location: ''})
    
    // Controlla se la location è una sede di casa
    const homeLocations = ['Brescia', 'Gussago', 'Ospitaletto']
    const isHomeLocation = homeLocations.includes(location)
    
    // Se la location è una sede di casa, seleziona automaticamente il checkbox
    if (isHomeLocation && !newEvent.is_home) {
      setNewEvent(prev => ({...prev, is_home: true}))
      
      // Se è una partita, aggiorna anche il titolo solo se tutti i campi sono compilati
      if (newEvent.event_type === 'partita') {
        const autoTitle = generateEventTitle()
        if (autoTitle) {
          setNewEvent(prev => ({...prev, title: autoTitle}))
        }
      }
    }
    
    // Se la location NON è una sede di casa, deseleziona automaticamente il checkbox
    if (!isHomeLocation && newEvent.is_home) {
      setNewEvent(prev => ({...prev, is_home: false}))
      
      // Se è una partita, aggiorna anche il titolo solo se tutti i campi sono compilati
      if (newEvent.event_type === 'partita') {
        const autoTitle = generateEventTitle()
        if (autoTitle) {
          setNewEvent(prev => ({...prev, title: autoTitle}))
        }
      }
    }
  }

  const handleChampionshipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChampionship = e.target.checked
    setNewEvent(prev => ({ 
      ...prev, 
      is_championship: isChampionship,
      is_friendly: !isChampionship // Se campionato è selezionato, amichevole diventa false
    }))
  }

  const handleFriendlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isFriendly = e.target.checked
    setNewEvent(prev => ({ 
      ...prev, 
      is_friendly: isFriendly,
      is_championship: !isFriendly // Se amichevole è selezionato, campionato diventa false
    }))
  }

  const getEventTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'partita': 'Partita',
      'torneo': 'Torneo',
      'evento_sociale': 'Evento Sociale',
      'raduno': 'Raduno',
      'festa': 'Festa',
      'consiglio': 'Consiglio',
      'incontro_genitori': 'Incontro Genitori',
      'incontro_staff': 'Incontro Staff',
      'altro': 'Altro'
    }
    return types[type] || type
  }

  const addOpponent = () => {
    if (opponentCount < 16) {
      setNewEvent(prev => ({
        ...prev,
        opponents: [...prev.opponents, '']
      }))
      setOpponentCount(prev => prev + 1)
    }
  }

  const removeOpponent = (index: number) => {
    if (opponentCount > 1) {
      setNewEvent(prev => ({
        ...prev,
        opponents: prev.opponents.filter((_, i) => i !== index)
      }))
      setOpponentCount(prev => prev - 1)
    }
  }

  const updateOpponent = (index: number, value: string) => {
    setNewEvent(prev => ({
      ...prev,
      opponents: prev.opponents.map((opp, i) => i === index ? value : opp)
    }))
  }

  const addParticipant = (memberId: string) => {
    const member = councilMembers.find(m => m.id === memberId)
    if (member && !newEvent.participants.includes(member.name)) {
      setNewEvent(prev => ({
        ...prev,
        participants: [...prev.participants, member.name]
      }))
    }
  }

  const removeParticipant = (participantName: string) => {
    setNewEvent(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p !== participantName)
    }))
  }

  const getAvailableCouncilMembers = () => {
    return councilMembers.filter(member => 
      !newEvent.participants.includes(member.name)
    )
  }

  const openInvitedModal = () => {
    setTempInvited([...newEvent.invited, '']) // Aggiungi un campo vuoto
    setShowInvitedModal(true)
  }

  const addInvitedField = () => {
    if (tempInvited.length < 50) {
      setTempInvited([...tempInvited, ''])
    }
  }

  const updateInvitedField = (index: number, value: string) => {
    const updated = [...tempInvited]
    updated[index] = value
    setTempInvited(updated)
  }

  const removeInvitedField = (index: number) => {
    const updated = tempInvited.filter((_, i) => i !== index)
    setTempInvited(updated)
  }

  const saveInvited = () => {
    // Filtra i campi vuoti e rimuovi duplicati
    const validInvited = tempInvited
      .filter(name => name.trim() !== '')
      .map(name => name.trim())
      .filter((name, index, array) => array.indexOf(name) === index) // Rimuovi duplicati
    
    setNewEvent(prev => ({
      ...prev,
      invited: validInvited
    }))
    setShowInvitedModal(false)
  }

  const cancelInvitedModal = () => {
    setShowInvitedModal(false)
    setTempInvited([])
  }

  const removeInvited = (invitedName: string) => {
    setNewEvent(prev => ({
      ...prev,
      invited: prev.invited.filter(name => name !== invitedName)
    }))
  }

  const getEventTypeFields = () => {
    const eventType = newEvent.event_type
    
    // Campi comuni a tutti i tipi di evento
    const commonFields = {
      showCategory: false,
      showOpponent: false,
      showOpponents: false,
      showHomeAway: false,
      showChampionship: false,
      showParticipants: false,
      showInvited: false,
      showVerbalePdf: false,
      showTimeFields: true,
      timeFieldType: 'single' as 'single' | 'start_end'
    }

    switch (eventType) {
      case 'partita':
        return {
          ...commonFields,
          showCategory: true,
          showOpponent: true,
          showHomeAway: true,
          showChampionship: true,
          timeFieldType: 'start_end' as const
        }
      case 'torneo':
        return {
          ...commonFields,
          showCategory: true,
          showOpponents: true,
          showHomeAway: true,
          showChampionship: true,
          timeFieldType: 'start_end' as const
        }
      case 'consiglio':
        return {
          ...commonFields,
          showParticipants: true,
          showInvited: true,
          showVerbalePdf: true,
          timeFieldType: 'start_end' as const
        }
      case 'evento_sociale':
      case 'festa':
      case 'incontro_genitori':
      case 'incontro_staff':
      case 'raduno':
      case 'altro':
        return {
          ...commonFields,
          timeFieldType: 'start_end' as const
        }
      default:
        return commonFields
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  }

  const getEventIcon = (event: Event) => {
    // Se è un consiglio, mostra sempre "CON"
    if (event.event_type === 'consiglio') {
      return 'CON'
    }
    
    // Se è un incontro genitori, mostra sempre "GEN"
    if (event.event_type === 'incontro_genitori') {
      return 'GEN'
    }
    
    // Se ha una categoria, usa l'abbreviazione della categoria
    if (event.categories?.code) {
      return event.categories.code
    }
    
    // Altrimenti usa il tipo di evento come testo
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

  const getEventDetails = (event: Event) => {
    const details = []
    
    // Data
    details.push(formatDate(event.event_date))
    
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

  const getEventParticipants = (event: Event) => {
    if (event.event_type === 'torneo' && event.opponents && event.opponents.length > 0) {
      const validOpponents = event.opponents.filter(opp => opp.trim() !== '')
      if (validOpponents.length > 0) {
        return {
          participants: validOpponents.join(', '),
          count: validOpponents.length
        }
      }
    } else if (event.event_type === 'partita' && event.opponent) {
      return {
        participants: event.opponent,
        count: 1
      }
    } else if (event.event_type === 'consiglio' && event.participants?.length > 0) {
      return {
        participants: event.participants.join(', '),
        count: event.participants.length
      }
    }
    
    return null
  }

  const getAbsentCouncilMembers = (event: Event) => {
    if (event.event_type === 'consiglio') {
      const allCouncilMembers = councilMembers.map(member => member.name)
      const presentMembers = event.participants || []
      const absentMembers = allCouncilMembers.filter(member => !presentMembers.includes(member))
      
      return absentMembers.length > 0 ? absentMembers : null
    }
    return null
  }

  const getEventInvited = (event: Event) => {
    if (event.event_type === 'consiglio' && event.invited?.length > 0) {
      return {
        invited: event.invited.join(', '),
        count: event.invited.length
      }
    }
    return null
  }

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  const handleCloseEventModal = () => {
    setShowEventModal(false)
    setSelectedEvent(null)
  }

  const handleOpenPDF = async (filename: string) => {
    try {
      // Prima verifica se il file esiste
      const { data: fileList, error: listError } = await supabase.storage
        .from('docs')
        .list('events', {
          search: filename
        })
      
      if (listError) {
        console.error('Errore nel controllo esistenza file:', listError)
        throw listError
      }
      
      // Se il file non esiste, rimuovi il riferimento dal database
      if (!fileList || fileList.length === 0) {
        console.warn(`File ${filename} non trovato, rimuovo il riferimento dal database`)
        
        // Rimuovi il file dalla lista dei PDF dell'evento corrente
        if (selectedEvent) {
          const updatedVerbalePdfs = selectedEvent.verbale_pdfs?.filter(f => f !== filename) || []
          const updatedVerbalePdf = selectedEvent.verbale_pdf === filename ? '' : selectedEvent.verbale_pdf
          
          // Aggiorna immediatamente l'interfaccia
          setSelectedEvent(prev => prev ? {
            ...prev,
            verbale_pdf: updatedVerbalePdf,
            verbale_pdfs: updatedVerbalePdfs
          } : null)
          
          // Aggiorna l'evento nel database
          const { error: updateError } = await supabase
            .from('events')
            .update({
              verbale_pdf: updatedVerbalePdf || null,
              verbale_pdfs: updatedVerbalePdfs.length > 0 ? updatedVerbalePdfs : null
            })
            .eq('id', selectedEvent.id)
          
          if (updateError) {
            console.error('Errore nell\'aggiornamento del database:', updateError)
          } else {
            console.log(`Riferimento al file ${filename} rimosso dal database`)
            // Aggiorna immediatamente la lista degli eventi
            setEvents(prevEvents => prevEvents.map(event => {
              if (event.id === selectedEvent.id) {
                return {
                  ...event,
                  verbale_pdf: updatedVerbalePdf,
                  verbale_pdfs: updatedVerbalePdfs
                }
              }
              return event
            }))
          }
        }
        
        alert('Il file PDF non è più disponibile e è stato rimosso dalla lista')
        return
      }
      
      // Genera una signed URL per il file su Supabase Storage
      const { data, error } = await supabase.storage
        .from('docs')
        .createSignedUrl(`events/${filename}`, 60 * 60) // URL valido per 1 ora
      
      if (error) throw error
      
      // Apri il PDF in una nuova finestra
      window.open(data.signedUrl, '_blank')
    } catch (error) {
      console.error('Errore nell\'apertura del PDF:', error)
      alert('Errore nell\'apertura del PDF. Il file potrebbe non essere più disponibile.')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    try {
      const newFilenames = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // Verifica che sia un PDF
        if (file.type !== 'application/pdf') {
          alert(`File ${file.name} non è un PDF`)
          continue
        }
        
        // Verifica dimensione (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} troppo grande (max 10MB)`)
          continue
        }
        
        // Genera nome file unico
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const randomId = Math.random().toString(36).substr(2, 9)
        const filename = `verbale_${timestamp}_${randomId}.pdf`
        
        // Carica il file su Supabase Storage
        try {
          const { data, error } = await supabase.storage
            .from('docs')
            .upload(`events/${filename}`, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'application/pdf',
            })
          
          if (error) throw error
          
          newFilenames.push(filename)
          console.log(`File ${file.name} caricato su Supabase Storage come ${filename}`)
        } catch (uploadError) {
          console.error(`Errore nel caricamento di ${file.name}:`, uploadError)
          alert(`Errore nel caricamento di ${file.name}`)
        }
      }

      if (newFilenames.length > 0) {
        setNewEvent(prev => ({
          ...prev,
          verbale_pdfs: [...(prev.verbale_pdfs || []), ...newFilenames]
        }))
        
        alert(`${newFilenames.length} file PDF caricati con successo!`)
        console.log('File caricati:', newFilenames)
      }
      
    } catch (error) {
      console.error('Errore upload:', error)
      alert('Errore nel caricamento dei file')
    }
  }

  const removePDF = async (filename: string) => {
    try {
      // Prima rimuovi immediatamente dall'interfaccia per feedback istantaneo
      setNewEvent(prev => ({
        ...prev,
        verbale_pdfs: (prev.verbale_pdfs || []).filter(f => f !== filename),
        verbale_pdf: prev.verbale_pdf === filename ? '' : prev.verbale_pdf
      }))
      
      // Rimuovi il file da Supabase Storage
      const { error } = await supabase.storage
        .from('docs')
        .remove([`events/${filename}`])
      
      if (error) {
        console.error('Errore nella rimozione del file da Storage:', error)
        // Se c'è un errore, ripristina il file nella lista
        setNewEvent(prev => ({
          ...prev,
          verbale_pdfs: [...(prev.verbale_pdfs || []), filename]
        }))
        alert('Errore nella rimozione del file da Storage')
        return
      }
      
      // Rimuovi dal localStorage se presente (fallback)
      localStorage.removeItem(`pdf_${filename}`)
      
      // Se stiamo modificando un evento esistente, aggiorna anche il database
      if (editingEvent) {
        const updatedVerbalePdfs = newEvent.verbale_pdfs?.filter(f => f !== filename) || []
        const updatedVerbalePdf = newEvent.verbale_pdf === filename ? '' : newEvent.verbale_pdf
        
        const { error: updateError } = await supabase
          .from('events')
          .update({
            verbale_pdf: updatedVerbalePdf || null,
            verbale_pdfs: updatedVerbalePdfs.length > 0 ? updatedVerbalePdfs : null
          })
          .eq('id', editingEvent.id)
        
        if (updateError) {
          console.error('Errore nell\'aggiornamento del database:', updateError)
        } else {
          // Aggiorna anche l'evento selezionato nel modal se è lo stesso
          if (selectedEvent && selectedEvent.id === editingEvent.id) {
            setSelectedEvent(prev => prev ? {
              ...prev,
              verbale_pdf: updatedVerbalePdf,
              verbale_pdfs: updatedVerbalePdfs
            } : null)
          }
        }
      }
      
      console.log(`File ${filename} rimosso da Supabase Storage`)
      
      // Aggiorna la lista degli eventi per rimuovere il file da tutti i riferimenti
      setEvents(prevEvents => prevEvents.map(event => {
        if (event.verbale_pdf === filename) {
          return { ...event, verbale_pdf: '' }
        }
        if (event.verbale_pdfs?.includes(filename)) {
          return { 
            ...event, 
            verbale_pdfs: event.verbale_pdfs.filter(f => f !== filename)
          }
        }
        return event
      }))
    } catch (error) {
      console.error('Errore nella rimozione del PDF:', error)
      alert('Errore nella rimozione del PDF')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Gestione Eventi" 
        subtitle="Gestisci sessioni di allenamento, registra presenze, partite ed eventi"
        showBack={true}
        rightButton={
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            ➕ Nuovo Evento
          </button>
        }
      />
      
      <div className="max-w-6xl mx-auto p-6">


        {/* Form creazione/modifica evento */}
        {showCreateForm && (
          <div className="card p-6 mb-8" id="event-form">
            <h2 className="text-2xl font-bold text-navy mb-4">
              {editingEvent ? 'Modifica Evento' : 'Crea Nuovo Evento'}
            </h2>
            
            <form onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent} className="space-y-4">
              {(() => {
                const fields = getEventTypeFields()
                return (
                  <>
                    {/* PRIMA RIGA: Tipo Evento, Titolo Evento */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo Evento *
                  </label>
                  <select
                    required
                    value={newEvent.event_type}
                    onChange={(e) => handleEventTypeChange(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  >
                    <option value="partita">Partita</option>
                    <option value="torneo">Torneo</option>
                    <option value="evento_sociale">Evento Sociale</option>
                    <option value="raduno">Raduno</option>
                    <option value="festa">Festa</option>
                    <option value="consiglio">Consiglio</option>
                    <option value="incontro_genitori">Incontro Genitori</option>
                    <option value="incontro_staff">Incontro Staff</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titolo Evento *
                  </label>
                  {newEvent.event_type === 'consiglio' ? (
                    <input
                      type="text"
                      required
                      value={newEvent.event_date ? `del ${new Date(newEvent.event_date).toLocaleDateString('it-IT')}` : 'del...'}
                      readOnly
                      className="w-full p-3 rounded-2xl border border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed"
                      style={{ minWidth: '100%' }}
                    />
                  ) : (
                    <input
                      type="text"
                      required
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="Es. Partita U14 vs Rugby Milano"
                      style={{ minWidth: '100%' }}
                    />
                  )}
                </div>
                
                {fields.showCategory && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoria
                    </label>
                    <select
                      value={newEvent.category_id}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    >
                      <option value="">Seleziona categoria</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Pulsante Aggiungi per tornei */}
                {newEvent.event_type === 'torneo' && opponentCount < 16 && (
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={addOpponent}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-2xl hover:bg-green-600 font-medium"
                    >
                      ➕ Aggiungi
                    </button>
                  </div>
                )}
                
                {/* Campo Avversario per partite */}
                {fields.showOpponent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Avversario (per partite)
                    </label>
                    <input
                      type="text"
                      value={newEvent.opponent}
                      onChange={(e) => handleOpponentChange(e.target.value)}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="Es. Rugby Milano"
                    />
                  </div>
                )}
              </div>

              {/* SECONDA RIGA: Avversari per tornei */}
              {fields.showOpponents && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Avversari (per tornei)
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {newEvent.opponents.map((opponent, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={opponent}
                          onChange={(e) => updateOpponent(index, e.target.value)}
                          className="flex-1 p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                          placeholder="Avv."
                        />
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => removeOpponent(index)}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TERZA RIGA: Data, Location, Checkbox */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Evento *
                  </label>
                  <input
                    type="date"
                    required
                    value={newEvent.event_date}
                    onChange={(e) => {
                      const newDate = e.target.value
                      setNewEvent(prev => {
                        const updated = {...prev, event_date: newDate}
                        // Se è un consiglio, aggiorna automaticamente il titolo
                        if (prev.event_type === 'consiglio' && newDate) {
                          updated.title = `del ${new Date(newDate).toLocaleDateString('it-IT')}`
                        }
                        return updated
                      })
                    }}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <select
                    value={newEvent.location}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  >
                    <option value="">Seleziona location</option>
                    <option value="Brescia">Brescia</option>
                    <option value="Gussago">Gussago</option>
                    <option value="Ospitaletto">Ospitaletto</option>
                    <option value="Trasferta">Trasferta</option>
                  </select>
                  
                  {/* Campo condizionale per trasferta */}
                  {newEvent.location === 'Trasferta' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={newEvent.away_location}
                        onChange={(e) => setNewEvent({...newEvent, away_location: e.target.value})}
                        className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        placeholder="Dove in trasferta?"
                        required
                      />
                    </div>
                  )}
                </div>
                
                {(fields.showHomeAway || fields.showChampionship) && (
                  <div className="flex items-center justify-center space-x-4">
                    {fields.showHomeAway && (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newEvent.is_home}
                          onChange={(e) => handleHomeAwayChange(e.target.checked)}
                          className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Evento in casa</span>
                      </label>
                    )}
                    
                    {fields.showChampionship && (
                      <>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newEvent.is_championship}
                            onChange={handleChampionshipChange}
                            className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Campionato</span>
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newEvent.is_friendly}
                            onChange={handleFriendlyChange}
                            className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Amichevole</span>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* QUARTA RIGA: Orari */}
              <div className={`grid grid-cols-1 gap-4 ${fields.timeFieldType === 'start_end' ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
                
                {/* Campi orario dinamici in base al tipo evento */}
                {fields.timeFieldType === 'start_end' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ora Inizio
                      </label>
                      <input
                        type="time"
                        value={newEvent.start_time}
                        onChange={(e) => setNewEvent({...newEvent, start_time: e.target.value})}
                        className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ora Fine
                      </label>
                      <input
                        type="time"
                        value={newEvent.end_time}
                        onChange={(e) => setNewEvent({...newEvent, end_time: e.target.value})}
                        className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ora Evento
                    </label>
                    <input
                      type="time"
                      value={newEvent.event_time}
                      onChange={(e) => setNewEvent({...newEvent, event_time: e.target.value})}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* QUINTA RIGA: Partecipanti Consiglio */}
              {fields.showParticipants && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Partecipanti
                  </label>
                  
                  {/* Dropdown per selezionare membri del consiglio */}
                  {getAvailableCouncilMembers().length > 0 && (
                    <div className="mb-3 flex gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addParticipant(e.target.value)
                            e.target.value = ''
                          }
                        }}
                        className="flex-1 p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      >
                        <option value="">Seleziona un membro del consiglio</option>
                        {getAvailableCouncilMembers().map(member => (
                          <option key={member.id} value={member.id}>
                            {member.name} ({member.role === 'president' ? 'Presidente' : 
                                           member.role === 'vice_president' ? 'Vice Presidente' : 'Consigliere'})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (getAvailableCouncilMembers().length > 0) {
                            const firstMember = getAvailableCouncilMembers()[0]
                            addParticipant(firstMember.id)
                          }
                        }}
                        className="px-4 py-3 bg-green-500 text-white rounded-2xl hover:bg-green-600 font-medium"
                        title="Aggiungi primo membro disponibile"
                      >
                        ➕
                      </button>
                    </div>
                  )}
                  
                  {/* Lista partecipanti selezionati */}
                  {newEvent.participants.length > 0 && (
                    <div className="space-y-2">
                      {newEvent.participants.map((participant, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <span className="text-blue-800">{participant}</span>
                          <button
                            type="button"
                            onClick={() => removeParticipant(participant)}
                            className="text-red-600 hover:text-red-800"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {getAvailableCouncilMembers().length === 0 && newEvent.participants.length === 0 && (
                    <p className="text-gray-500 text-sm">Nessun membro del consiglio configurato. Vai in Settings → Sistema → Gestione Consiglio per aggiungere i membri.</p>
                  )}
                </div>
              )}

              {/* QUINTA RIGA: Invitati */}
              {fields.showInvited && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invitati
                  </label>
                  
                  {/* Pulsante per gestire invitati */}
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={openInvitedModal}
                      className="flex items-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 font-medium"
                    >
                      ➕ Gestisci Invitati ({newEvent.invited.length})
                    </button>
                  </div>
                  
                  {/* Lista invitati */}
                  {newEvent.invited.length > 0 && (
                    <div className="space-y-2">
                      {newEvent.invited.map((invited, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <span className="text-green-800">{invited}</span>
                          <button
                            type="button"
                            onClick={() => removeInvited(invited)}
                            className="text-red-600 hover:text-red-800"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SESTA RIGA: PDF Verbali */}
              {fields.showVerbalePdf && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verbali PDF
                  </label>
                  
                  {/* Upload Button */}
                  <div className="mb-3">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label
                      htmlFor="pdf-upload"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Carica PDF
                    </label>
                    <span className="ml-3 text-sm text-gray-500">
                      Puoi caricare più file PDF (max 10MB ciascuno)
                    </span>
                  </div>

                  {/* Lista PDF caricati */}
                  {newEvent.verbale_pdfs && newEvent.verbale_pdfs.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">File caricati:</h4>
                      {newEvent.verbale_pdfs.map((filename, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center">
                            <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm text-gray-700">{filename}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenPDF(filename)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              title="Apri PDF"
                            >
                              Apri
                            </button>
                            <button
                              onClick={() => removePDF(filename)}
                              className="text-red-600 hover:text-red-800 text-sm"
                              title="Rimuovi PDF"
                            >
                              Rimuovi
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SETTIMA RIGA: Descrizione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrizione
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  rows={3}
                  className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Descrizione dell'evento..."
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="btn bg-sky text-white px-6 py-3"
                >
                  {editingEvent ? 'Aggiorna Evento' : 'Crea Evento'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn bg-gray-500 text-white px-6 py-3"
                >
                  Annulla
                </button>
              </div>
                  </>
                )
              })()}
            </form>
          </div>
        )}

        {/* Popup di conferma per cambio tipo evento */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Conferma Cambio Tipo Evento
              </h3>
              <p className="text-gray-600 mb-6">
                Sei sicuro di voler cambiare il tipo di evento? Tutti i dati inseriti andranno persi.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelEventTypeChange}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmEventTypeChange}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal dettagli evento */}
        {showEventModal && selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {getEventTypeLabel(selectedEvent.event_type)}: {selectedEvent.title}
                </h3>
                <button
                  onClick={handleCloseEventModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Data e Orari */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">📅 Data e Orari</h4>
                  <p className="text-gray-600">{formatDate(selectedEvent.event_date)}</p>
                  {selectedEvent.start_time && selectedEvent.end_time && (
                    <p className="text-gray-600">
                      Inizio: {selectedEvent.start_time.substring(0, 5)} - Fine: {selectedEvent.end_time.substring(0, 5)}
                    </p>
                  )}
                  {selectedEvent.event_time && (
                    <p className="text-gray-600">Ora: {selectedEvent.event_time.substring(0, 5)}</p>
                  )}
                </div>

                {/* Location */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">📍 Location</h4>
                  <p className="text-gray-600">
                    {selectedEvent.location === 'Trasferta' ? selectedEvent.away_location : selectedEvent.location}
                    {selectedEvent.is_home ? ' (Casa)' : ' (Trasferta)'}
                  </p>
                </div>

                {/* Partecipanti */}
                {(() => {
                  const participants = getEventParticipants(selectedEvent)
                  if (participants) {
                    return (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-2">
                          {selectedEvent.event_type === 'torneo' ? '🏆 Squadre' : 
                           selectedEvent.event_type === 'consiglio' ? '👥 Partecipanti' : '⚽ Avversario'}
                        </h4>
                        <p className="text-blue-700">{participants.participants}</p>
                        <span className="text-xs bg-blue-200 px-2 py-1 rounded mt-2 inline-block">
                          {participants.count} {selectedEvent.event_type === 'torneo' ? 'squadre' : 
                           selectedEvent.event_type === 'consiglio' ? 'membri' : 'avversario'}
                        </span>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Invitati (solo per consiglio) */}
                {(() => {
                  const invited = getEventInvited(selectedEvent)
                  if (invited) {
                    return (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-800 mb-2">🎫 Invitati</h4>
                        <p className="text-green-700">{invited.invited}</p>
                        <span className="text-xs bg-green-200 px-2 py-1 rounded mt-2 inline-block">
                          {invited.count} invitati
                        </span>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Assenti (solo per consiglio) */}
                {(() => {
                  const absentMembers = getAbsentCouncilMembers(selectedEvent)
                  if (absentMembers) {
                    return (
                      <div className="bg-red-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-red-800 mb-2">❌ Assenti</h4>
                        <p className="text-red-700">{absentMembers.join(', ')}</p>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* PDF Verbali */}
                {selectedEvent.event_type === 'consiglio' && (selectedEvent.verbale_pdf || selectedEvent.verbale_pdfs?.length) && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">📄 Verbali</h4>
                    <div className="space-y-2">
                      {/* PDF singolo (legacy) */}
                      {selectedEvent.verbale_pdf && (
                        <button
                          onClick={() => handleOpenPDF(selectedEvent.verbale_pdf)}
                          className="text-blue-600 hover:text-blue-800 underline flex items-center gap-2"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {selectedEvent.verbale_pdf}
                        </button>
                      )}
                      
                      {/* PDF multipli */}
                      {selectedEvent.verbale_pdfs?.map((filename, index) => (
                        <button
                          key={index}
                          onClick={() => handleOpenPDF(filename)}
                          className="text-blue-600 hover:text-blue-800 underline flex items-center gap-2"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {filename}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Descrizione */}
                {selectedEvent.description && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-2">📝 Descrizione</h4>
                    <p className="text-gray-600">{selectedEvent.description}</p>
                  </div>
                )}
              </div>


            </div>
          </div>
        )}

        {/* Lista eventi */}
        <div className="card p-6">
          <h2 className="text-2xl font-bold text-navy mb-4">Eventi Programmati</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2">⏳</div>
              <p className="text-gray-500">Caricamento eventi...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2 text-gray-400">📅</div>
              <p className="text-gray-600">Nessun evento programmato</p>
              <p className="text-gray-500 text-sm mt-2">Crea il primo evento per iniziare</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => {
                const participants = getEventParticipants(event)
                const invited = getEventInvited(event)
                const absentMembers = getAbsentCouncilMembers(event)
                
                return (
                  <div key={event.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleEventClick(event)}>
                    <div className="flex items-start w-full">
                      {/* Pallino colorato + Icona - Larghezza fissa */}
                      <div className="flex items-center space-x-2 w-20 flex-shrink-0">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          event.is_home ? 'bg-blue-500' : 'bg-green-500'
                        }`}></div>
                        <div className="text-lg w-10 text-center flex-shrink-0" title={event.categories?.name || event.event_type}>
                          {getEventIcon(event)}
                        </div>
                      </div>
                      
                      {/* Contenuto principale - Larghezza variabile */}
                      <div className="flex-1 ml-4 min-w-0">
                        {/* Prima riga: Titolo */}
                        <div className="font-semibold text-lg leading-tight">
                          {getEventTypeLabel(event.event_type)}: {event.title}
                        </div>
                        
                        {/* Seconda riga: Dettagli evento */}
                        <div className="text-sm text-gray-600 mt-1 leading-tight">
                          {getEventDetails(event)}
                        </div>
                        
                        {/* Terza riga: Partecipanti (solo per partite, tornei e consiglio) */}
                        {participants && (
                          <div className="text-sm text-gray-500 mt-1 leading-tight">
                            <span className="font-medium">
                              {event.event_type === 'torneo' ? 'Squadre:' : 
                               event.event_type === 'consiglio' ? 'Partecipanti:' : 'Avversario:'}
                            </span> {participants.participants}
                            {event.event_type === 'torneo' && (
                              <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">
                                {participants.count} squadre
                              </span>
                            )}
                            {event.event_type === 'consiglio' && (
                              <span className="ml-2 text-xs bg-blue-200 px-2 py-1 rounded">
                                {participants.count} membri
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Quarta riga: Invitati (solo per consiglio) */}
                        {invited && (
                          <div className="text-sm text-green-600 mt-1 leading-tight">
                            <span className="font-medium">Invitati:</span> {invited.invited}
                            <span className="ml-2 text-xs bg-green-200 px-2 py-1 rounded">
                              {invited.count} invitati
                            </span>
                          </div>
                        )}
                        
                        {/* Quinta riga: PDF Verbali (solo per consiglio) */}
                        {event.event_type === 'consiglio' && (event.verbale_pdf || event.verbale_pdfs?.length) && (
                          <div className="text-xs text-blue-600 mt-1 leading-tight">
                            📄 Verbali: {event.verbale_pdfs?.length || 1} file
                          </div>
                        )}
                        
                        {/* Sesta riga: Assenti (solo per consiglio) */}
                        {absentMembers && (
                          <div className="text-xs text-red-600 mt-1 leading-tight">
                            ❌ Assenti: {absentMembers.join(', ')}
                          </div>
                        )}
                        
                        {/* Settima riga: Descrizione */}
                        {event.description && (
                          <div className="text-xs text-gray-500 mt-1 leading-tight">
                            {event.description}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifica evento"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        title="Elimina evento"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal per gestire invitati */}
      {showInvitedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                🎫 Gestisci Invitati ({tempInvited.filter(name => name.trim() !== '').length}/50)
              </h3>
              <button
                onClick={cancelInvitedModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {tempInvited.map((invited, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={invited}
                      onChange={(e) => updateInvitedField(index, e.target.value)}
                      placeholder={`Nome invitato ${index + 1}`}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  {/* Pulsante per aggiungere nuovo campo */}
                  {index === tempInvited.length - 1 && tempInvited.length < 50 && (
                    <button
                      type="button"
                      onClick={addInvitedField}
                      className="p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                      title="Aggiungi altro invitato"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Pulsante per rimuovere campo */}
                  {tempInvited.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInvitedField(index)}
                      className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                      title="Rimuovi invitato"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Messaggio informativo */}
            <div className="bg-blue-50 p-4 rounded-xl mb-6">
              <p className="text-blue-800 text-sm">
                💡 <strong>Suggerimento:</strong> Puoi aggiungere fino a 50 invitati. 
                I nomi duplicati e i campi vuoti verranno automaticamente rimossi.
              </p>
            </div>

            {/* Pulsanti di azione */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelInvitedModal}
                className="px-6 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={saveInvited}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium transition-colors"
              >
                Salva Invitati
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}