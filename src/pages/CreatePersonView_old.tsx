import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'
import InjuriesTab from '@/components/InjuriesTab'

interface PersonForm {
  full_name: string
  given_name: string
  family_name: string
  date_of_birth: string
  gender: string
  fiscal_code: string
  email: string
  phone: string
  address_street: string
  address_city: string
  address_zip: string
  address_region: string
  address_country: string
  nationality: string
  emergency_contact_name: string
  emergency_contact_phone: string
  medical_notes: string
  status: string
  // Campi per determinare il ruolo
  is_player: boolean
  is_staff: boolean
  staff_role: string
  staff_roles: string[]
  player_categories: string[]
  player_field_roles: string[]
  // Campi aggiuntivi per giocatore
  fir_code: string
  birth_date: string
  injured: boolean
}

interface Note {
  id: string
  date: string
  type: string
  content: string
  created_by: string
}

interface Injury {
  id: string
  date: string
  type: string
  severity: string
  notes: string
  recovery_time: string
}

export default function CreatePersonView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isEditing = !!editId
  
  // Stato per modalità di modifica
  const [isEditMode, setIsEditMode] = useState(false)
  
  // Stati per i tab
  const [activeTab, setActiveTab] = useState('personal')
  const [notes, setNotes] = useState<Note[]>([])
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [loadingInjuries, setLoadingInjuries] = useState(false)
  const [newNote, setNewNote] = useState({ content: '', type: 'note' })
  const [showAddNoteForm, setShowAddNoteForm] = useState(false)
  
  // Stati per filtri e ricerca note
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  
  // Stati per popup di conferma
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null)
  
  const [form, setForm] = useState<PersonForm>({
    full_name: '',
    given_name: '',
    family_name: '',
    date_of_birth: '',
    gender: '',
    fiscal_code: '',
    email: '',
    phone: '',
    address_street: '',
    address_city: '',
    address_zip: '',
    address_region: '',
    address_country: 'Italia',
    nationality: 'Italiana',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_notes: '',
    status: 'active',
    is_player: false,
    is_staff: false,
    staff_role: 'coach',
    staff_roles: [],
    player_categories: [],
    player_field_roles: [],
    // Campi aggiuntivi per giocatore
    fir_code: '',
    birth_date: '',
    injured: false
  })
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [fieldRoles, setFieldRoles] = useState<any[]>([])
  const [staffRoles, setStaffRoles] = useState<any[]>([])

  // Funzioni per gestire i tab
  const handleTabChange = (tabId: string) => {
    // Validazione del tab corrente prima di cambiare solo se in modalità modifica
    if (isEditMode) {
      if (activeTab === 'personal' && !validatePersonalTab()) {
        return
      }
      if (activeTab === 'player' && !validatePlayerTab()) {
        return
      }
    }
    setActiveTab(tabId)
  }

  const validatePersonalTab = () => {
    const requiredFields = ['full_name', 'given_name', 'family_name', 'date_of_birth', 'gender', 'fiscal_code']
    const missingFields = requiredFields.filter(field => !form[field as keyof PersonForm])
    
    if (missingFields.length > 0) {
      alert(`Compila i campi obbligatori: ${missingFields.join(', ')}`)
      return false
    }
    return true
  }

  const validatePlayerTab = () => {
    if (!form.is_player) return true
    
    if (form.player_categories.length === 0) {
      alert('Seleziona almeno una categoria per il giocatore')
      return false
    }
    return true
  }

  // Carica le categorie, i ruoli in campo e i dati della persona (se in modifica)
  useEffect(() => {
    loadCategories()
    loadFieldRoles()
    loadStaffRoles()
    if (isEditing && editId) {
      loadPersonData(editId)
    }
  }, [isEditing, editId])

  // Funzione per caricare le note
  const loadNotes = async () => {
    if (!isEditing || !editId) return
    
    try {
      setLoadingNotes(true)
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('person_id', editId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Errore nel caricamento delle note:', error)
        return
      }

      const notesData: Note[] = data.map(note => ({
        id: note.id,
        date: note.created_at,
        type: note.type,
        content: note.content,
        created_by: note.created_by
      }))

      setNotes(notesData)
    } catch (error) {
      console.error('Errore nel caricamento delle note:', error)
    } finally {
      setLoadingNotes(false)
    }
  }

  // Carica le note quando si è in modalità modifica
  useEffect(() => {
    loadNotes()
  }, [isEditing, editId])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
    }
  }

  const loadFieldRoles = async () => {
    try {
      
      const { data, error } = await supabase
        .from('player_positions')
        .select('*')
        .order('position_order')
        .limit(1000)

      
      if (error) {
        throw error
      }
      
      
      // Se non ci sono dati, usa il fallback
      if (!data || data.length === 0) {
        const fallbackRoles = [
          { id: 'fallback-1', name: 'Pilone DX', position_order: 1 },
          { id: 'fallback-2', name: 'Pilone SX', position_order: 2 },
          { id: 'fallback-3', name: 'Tallonatore', position_order: 3 },
          { id: 'fallback-4', name: 'Seconda Linea', position_order: 4 },
          { id: 'fallback-5', name: 'Terza Linea', position_order: 5 },
          { id: 'fallback-6', name: 'Mediano di Mischia', position_order: 6 },
          { id: 'fallback-7', name: 'Mediano d\'Apertura', position_order: 7 },
          { id: 'fallback-8', name: 'Centro', position_order: 8 },
          { id: 'fallback-9', name: 'Ala', position_order: 9 },
          { id: 'fallback-10', name: 'Estremo', position_order: 10 }
        ]
        setFieldRoles(fallbackRoles)
      } else {
        setFieldRoles(data)
      }
    } catch (error) {
      // Fallback con posizioni di base
      const fallbackRoles = [
        { id: 'fallback-1', name: 'Pilone DX', position_order: 1 },
        { id: 'fallback-2', name: 'Pilone SX', position_order: 2 },
        { id: 'fallback-3', name: 'Tallonatore', position_order: 3 },
        { id: 'fallback-4', name: 'Seconda Linea', position_order: 4 },
        { id: 'fallback-5', name: 'Terza Linea', position_order: 5 },
        { id: 'fallback-6', name: 'Mediano di Mischia', position_order: 6 },
        { id: 'fallback-7', name: 'Mediano d\'Apertura', position_order: 7 },
        { id: 'fallback-8', name: 'Centro', position_order: 8 },
        { id: 'fallback-9', name: 'Ala', position_order: 9 },
        { id: 'fallback-10', name: 'Estremo', position_order: 10 }
      ]
      setFieldRoles(fallbackRoles)
    }
  }

  const loadStaffRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .neq('name', 'Giocatore') // Esclude il ruolo Giocatore
        .order('position_order')

      if (error) throw error
      setStaffRoles(data || [])
    } catch (error) {
    }
  }

  const loadPersonData = async (personId: string) => {
    try {
      setLoading(true)
      
      // Carica i dati della persona
      const { data: personData, error: personError } = await supabase
        .from('people')
        .select('*')
        .eq('id', personId)
        .single()

      if (personError) throw personError

      // Carica i dati del giocatore (se esiste)
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select(`
          *,
          player_categories(categories(*))
        `)
        .eq('person_id', personId)
        .single()

      // Carica le posizioni del giocatore separatamente
      let playerPosition1 = null
      let playerPosition2 = null
      
      if (playerData?.player_position_id) {
        const { data: pos1 } = await supabase
          .from('player_positions')
          .select('*')
          .eq('id', playerData.player_position_id)
          .single()
        playerPosition1 = pos1
      }
      
      if (playerData?.player_position_id_2) {
        const { data: pos2 } = await supabase
          .from('player_positions')
          .select('*')
          .eq('id', playerData.player_position_id_2)
          .single()
        playerPosition2 = pos2
      }

      // Aggiungi le posizioni ai dati del giocatore
      if (playerData) {
        playerData.player_position_1 = playerPosition1
        playerData.player_position_2 = playerPosition2
      }

      
      if (playerError) {
      } else if (playerData) {
      } else {
      }

      // Carica i dati del profilo staff (se esiste)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, user_roles(*)')
        .eq('person_id', personId)
        .single()

      // Popola il form con i dati esistenti
      setForm({
        full_name: personData.full_name || '',
        given_name: personData.given_name || '',
        family_name: personData.family_name || '',
        date_of_birth: personData.date_of_birth || '',
        gender: personData.gender || '',
        fiscal_code: personData.fiscal_code || '',
        email: personData.email || '',
        phone: personData.phone || '',
        address_street: personData.address_street || '',
        address_city: personData.address_city || '',
        address_zip: personData.address_zip || '',
        address_region: personData.address_region || '',
        address_country: personData.address_country || 'Italia',
        nationality: personData.nationality || 'Italiana',
        emergency_contact_name: personData.emergency_contact_name || '',
        emergency_contact_phone: personData.emergency_contact_phone || '',
        medical_notes: personData.medical_notes || '',
        status: personData.status || 'active',
        is_player: !!playerData,
        is_staff: !!profileData,
        staff_role: profileData?.user_roles?.name || 'coach',
        staff_roles: profileData?.user_roles ? [profileData.user_roles.name] : [],
        player_categories: playerData?.player_categories?.map((pc: any) => pc.categories?.id) || [],
        player_field_roles: [
          ...(playerData?.player_position_1 ? [playerData.player_position_1.id] : []),
          ...(playerData?.player_position_2 ? [playerData.player_position_2.id] : [])
        ].filter(Boolean),
        // Campi aggiuntivi per giocatore
        fir_code: playerData?.fir_code || '',
        birth_date: playerData?.birth_date || '',
        injured: playerData?.injured || false
      })

      // Se stiamo modificando una persona esistente, inizia in modalità sola lettura
      if (isEditing) {
        setIsEditMode(false)
      }

    } catch (error) {
      alert('Errore nel caricamento dei dati della persona')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof PersonForm, value: any) => {
    // Solo se in modalità modifica, tranne per il campo 'injured' che è sempre editabile
    if (isEditMode || !isEditing || field === 'injured') {
      setForm(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  // Helper per determinare se un campo è disabilitato
  const isFieldDisabled = () => {
    return isEditing && !isEditMode
  }

  // Funzioni per gestire l'eliminazione delle note
  const handleDeleteNote = (note: Note) => {
    setNoteToDelete(note)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return
    
    try {
      setLoadingNotes(true)
      
      // Elimina la nota dal database
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteToDelete.id)

      if (error) {
        console.error('Errore nell\'eliminazione della nota:', error)
        alert('Errore nell\'eliminazione della nota')
      return
    }

      // Rimuovi la nota dallo stato locale
      setNotes(prev => prev.filter(note => note.id !== noteToDelete.id))
      
      // Chiudi il popup
      setShowDeleteConfirm(false)
      setNoteToDelete(null)
    } catch (error) {
      console.error('Errore nell\'eliminazione della nota:', error)
      alert('Errore nell\'eliminazione della nota')
    } finally {
      setLoadingNotes(false)
    }
  }

  const cancelDeleteNote = () => {
    setShowDeleteConfirm(false)
    setNoteToDelete(null)
  }

  // Funzione per ottenere il nome del tipo di nota (spostata fuori da renderNotesTab)
  const getNoteTypeName = (type: string) => {
    switch (type) {
      case 'medical': return 'Medica'
      case 'injury': return 'Infortunio'
      case 'training': return 'Allenamento'
      case 'secretary': return 'Segreteria'
      default: return 'Generale'
    }
  }

  // Funzione per filtrare e ordinare le note (spostata fuori da renderNotesTab)
  const getFilteredAndSortedNotes = () => {
    let filtered = notes

    // Filtro per testo
    if (searchQuery.trim()) {
      filtered = filtered.filter(note =>
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.created_by.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filtro per tipo
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(note => selectedTypes.includes(note.type))
    }

    // Filtro per data
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      filtered = filtered.filter(note => {
        const noteDate = new Date(note.date)
        const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate())
        
        switch (dateFilter) {
          case 'today':
            return noteDateOnly.getTime() === today.getTime()
          case 'week':
            const weekAgo = new Date(today)
            weekAgo.setDate(weekAgo.getDate() - 7)
            return noteDateOnly >= weekAgo
          case 'month':
            const monthAgo = new Date(today)
            monthAgo.setMonth(monthAgo.getMonth() - 1)
            return noteDateOnly >= monthAgo
          default:
            return true
        }
      })
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
          break
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
        case 'author':
          comparison = a.created_by.localeCompare(b.created_by)
          break
        default:
          comparison = 0
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }

  // Funzione per aggiungere note
  const handleAddNote = async () => {
    if (!newNote.content.trim()) return
    
    try {
      setLoadingNotes(true)
      
      // Salva la nota nel database
      const { data, error } = await supabase
        .from('notes')
        .insert([
          {
            person_id: editId,
            content: newNote.content.trim(),
            type: newNote.type,
            created_by: 'Sistema' // TODO: Sostituire con utente corrente
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Errore nel salvataggio della nota:', error)
        alert('Errore nel salvataggio della nota')
      return
    }

      // Aggiorna lo stato locale con la nota salvata
      const noteData: Note = {
        id: data.id,
        date: data.created_at,
        type: data.type,
        content: data.content,
        created_by: data.created_by
      }
      
      setNotes(prev => [noteData, ...prev])
      setNewNote({ content: '', type: 'note' })
      setShowAddNoteForm(false)
    } catch (error) {
      console.error('Errore nel salvataggio della nota:', error)
      alert('Errore nel salvataggio della nota')
    } finally {
      setLoadingNotes(false)
    }
  }

  // Funzioni per gestire la modalità di modifica
  const handleEditMode = () => {
    setIsEditMode(true)
  }

  const handleSaveChanges = async () => {
    if (!isEditMode) return
    
    // Validazione prima di salvare
    if (!validatePersonalTab()) return
    if (form.is_player && !validatePlayerTab()) return

    try {
      setLoading(true)
      await handleSubmit()
      // Dopo il salvataggio, torna in modalità sola lettura
      setIsEditMode(false)
    } catch (error) {
      console.error('Errore nel salvataggio:', error)
      alert('Errore nel salvataggio delle modifiche')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEdit = () => {
    if (isEditMode) {
      const confirmCancel = window.confirm('Sei sicuro di voler annullare le modifiche? Le modifiche non salvate andranno perse.')
      if (confirmCancel) {
        // Ricarica i dati originali
        if (editId) {
          loadPersonData(editId)
        }
        setIsEditMode(false)
      }
    }
  }

  // Gestione del pulsante indietro con conferma
  const handleBackWithConfirmation = () => {
    if (isEditMode) {
      const confirmBack = window.confirm('Sei sicuro di voler uscire? Le modifiche non salvate andranno perse.')
      if (confirmBack) {
        navigate('/people')
      }
    } else {
      navigate('/people')
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    // Se stiamo modificando una persona esistente, non salvare automaticamente
    if (isEditing && !isEditMode) {
      return
    }
    
    if (!validatePersonalTab()) return
    if (form.is_player && !validatePlayerTab()) return

    try {
      setLoading(true)

      // Crea o aggiorna la persona
      const personData = {
          full_name: form.full_name,
          given_name: form.given_name,
          family_name: form.family_name,
          date_of_birth: form.date_of_birth,
        gender: form.gender,
        fiscal_code: form.fiscal_code,
        email: form.email,
        phone: form.phone,
        address_street: form.address_street,
        address_city: form.address_city,
        address_zip: form.address_zip,
        address_region: form.address_region,
        address_country: form.address_country,
        nationality: form.nationality,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        medical_notes: form.medical_notes,
          status: form.status
      }

      let personId: string

      if (isEditing) {
        // Aggiorna persona esistente
        const { error: personError } = await supabase
          .from('people')
          .update(personData)
          .eq('id', editId)

        if (personError) throw personError
        personId = editId
      } else {
        // Crea nuova persona
        const { data: newPerson, error: personError } = await supabase
          .from('people')
          .insert(personData)
        .select()
        .single()

      if (personError) throw personError
        personId = newPerson.id
      }

      // Gestisci i dati del giocatore
      if (form.is_player) {
        const playerData = {
          person_id: personId,
            first_name: form.given_name,
            last_name: form.family_name,
          birth_date: form.birth_date || form.date_of_birth,
          fir_code: form.fir_code,
          injured: form.injured,
          player_position_id: form.player_field_roles.length > 0 ? form.player_field_roles[0] : null,
          player_position_id_2: form.player_field_roles.length > 1 ? form.player_field_roles[1] : null
        }

        if (isEditing) {
          // Aggiorna giocatore esistente
          const { data: existingPlayer, error: playerError } = await supabase
            .from('players')
            .update(playerData)
            .eq('person_id', personId)
            .select()
            .single()

          if (playerError) {
            throw playerError
          }

          // Aggiorna categorie del giocatore
          const { error: deleteCategoriesError } = await supabase
            .from('player_categories')
            .delete()
            .eq('player_id', existingPlayer.id)

          if (deleteCategoriesError) {
            throw deleteCategoriesError
          }

        if (form.player_categories.length > 0) {
          const categoryInserts = form.player_categories.map(categoryId => ({
              player_id: existingPlayer.id,
            category_id: categoryId
          }))

          const { error: categoriesError } = await supabase
            .from('player_categories')
            .insert(categoryInserts)

            if (categoriesError) {
              throw categoriesError
            }
          }
        } else {
          // Crea nuovo giocatore
          const { data: newPlayer, error: playerError } = await supabase
            .from('players')
            .insert(playerData)
            .select()
            .single()

          if (playerError) {
            throw playerError
          }

          // Aggiungi categorie del giocatore
          if (form.player_categories.length > 0) {
            const categoryInserts = form.player_categories.map(categoryId => ({
              player_id: newPlayer.id,
              category_id: categoryId
            }))

            const { error: categoriesError } = await supabase
              .from('player_categories')
              .insert(categoryInserts)

            if (categoriesError) {
              throw categoriesError
            }
          }
        }
      }

      // Solo per nuove persone, vai alla lista
      if (!isEditing) {
      alert('Persona creata con successo!')
      navigate('/people')
      }
      // Per le modifiche, salva silenziosamente senza messaggi
    } catch (error) {
      alert('Errore nel salvataggio della persona')
    } finally {
      setLoading(false)
    }
  }

  const renderPersonalTab = () => (
    <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Informazioni Personali</h2>
                
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Nome - 4 colonne */}
        <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.given_name}
                      onChange={(e) => handleInputChange('given_name', e.target.value)}
                      disabled={isEditing && !isEditMode}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                  
        {/* Cognome - 4 colonne */}
        <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cognome *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.family_name}
                      onChange={(e) => handleInputChange('family_name', e.target.value)}
                      disabled={isEditing && !isEditMode}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                  
        {/* Data di Nascita - 2 colonne */}
        <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data di Nascita *
                    </label>
                    <input
                      type="date"
                      required
                      value={form.date_of_birth}
                      onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                  
        {/* Sesso - 1 colonna */}
        <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
            Sesso *
                    </label>
                    <select
            required
                      value={form.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    >
            <option value="">-</option>
            <option value="M">M</option>
            <option value="F">F</option>
            <option value="X">X</option>
                    </select>
                  </div>
                  
        {/* Codice Fiscale - 4 colonne */}
        <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
            Codice Fiscale *
                    </label>
                    <input
                      type="text"
            required
                      maxLength={16}
                      value={form.fiscal_code}
            onChange={(e) => handleInputChange('fiscal_code', e.target.value)}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                  
        {/* Status - 2 colonne */}
        <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
            Status *
                    </label>
                    <select
            required
                      value={form.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    >
                      <option value="active">Attivo</option>
                      <option value="inactive">Inattivo</option>
                      <option value="pending">In attesa</option>
                    </select>
                  </div>
                  
        {/* Nazionalità - 2 colonne */}
        <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nazionalità
                    </label>
                    <input
                      type="text"
                      value={form.nationality}
              onChange={(e) => {
                const value = e.target.value
                const formattedValue = value
                  .toLowerCase()
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')
                handleInputChange('nationality', formattedValue)
              }}
              disabled={isFieldDisabled()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
              </div>

        {/* Ruolo - 4 colonne sulla stessa riga di Status e Nazionalità */}
        <div className="md:col-span-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ruolo
          </label>
          <div className="flex items-center space-x-6 mt-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={form.is_player}
                onChange={(e) => handleInputChange('is_player', e.target.checked)}
                disabled={isFieldDisabled()}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500  "
              />
              <span className="ml-2 text-sm text-gray-700">È un giocatore</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={form.is_staff}
                onChange={(e) => handleInputChange('is_staff', e.target.checked)}
                disabled={isFieldDisabled()}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500  "
              />
              <span className="ml-2 text-sm text-gray-700">È staff</span>
            </label>
                </div>
              </div>

        {/* Email - 7 colonne sotto Codice Fiscale */}
        <div className="md:col-span-7">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                  
        {/* Telefono - 5 colonne */}
        <div className="md:col-span-5">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefono
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                </div>
              </div>

              {/* Indirizzo */}
      <div className="border-t pt-6">
        <h3 className="text-md font-medium text-gray-900 mb-4">Indirizzo</h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Via/Indirizzo - 5 colonne */}
          <div className="md:col-span-5">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Via/Indirizzo
                    </label>
                    <input
                      type="text"
                      value={form.address_street}
                      onChange={(e) => handleInputChange('address_street', e.target.value)}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                  
          {/* CAP - 2 colonne */}
          <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CAP
                    </label>
                    <input
                      type="text"
              maxLength={5}
                      value={form.address_zip}
                      onChange={(e) => handleInputChange('address_zip', e.target.value)}
              disabled={isFieldDisabled()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                  
          {/* Paese - 3 colonne */}
          <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Paese
                    </label>
                    <input
                      type="text"
                      value={form.address_country}
                      onChange={(e) => {
                        const value = e.target.value
                        const formattedValue = value
                          .toLowerCase()
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ')
                        handleInputChange('address_country', formattedValue)
                      }}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                  
          {/* Città - 2 colonne */}
          <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Città
                    </label>
                    <input
                      type="text"
                      value={form.address_city}
                      onChange={(e) => handleInputChange('address_city', e.target.value)}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                  
                </div>
              </div>

      {/* Contatto di Emergenza */}
      <div className="border-t pt-6">
        <h3 className="text-md font-medium text-gray-900 mb-4">Contatto di Emergenza</h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Nome Contatto - 7 colonne */}
          <div className="md:col-span-7">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Contatto
                    </label>
                    <input
                      type="text"
                      value={form.emergency_contact_name}
                      onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                  
          {/* Telefono Contatto - 5 colonne */}
          <div className="md:col-span-5">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefono Contatto
                    </label>
                    <input
                      type="tel"
                      value={form.emergency_contact_phone}
                      onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                      disabled={isFieldDisabled()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
                    />
                  </div>
                </div>
              </div>

    </div>
  )

  const renderStaffTab = () => (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Dati Staff</h2>
                
                <div className="space-y-4">
        <h3 className="text-md font-medium text-gray-900 mb-4">Ruolo Staff</h3>
        <div className="grid grid-cols-2 gap-4">
          {staffRoles.map((role) => (
            <label key={role.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                checked={form.staff_roles.includes(role.name)}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleInputChange('staff_roles', [...form.staff_roles, role.name])
                  } else {
                    handleInputChange('staff_roles', form.staff_roles.filter(name => name !== role.name))
                  }
                }}
                disabled={isFieldDisabled()}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500  "
              />
              <span className="text-sm text-gray-700">{role.name}</span>
                    </label>
          ))}
                  </div>
      </div>
    </div>
  )

  const renderPlayerTab = () => {
    return (
      <div className={`space-y-6 ${form.injured ? 'bg-red-50 border border-red-200 rounded-lg p-4' : ''}`}>
        {/* Header con titolo e badge - Layout migliorato */}
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Giocatore</h2>
          
          {/* Card per categoria e ruoli in modalità sola lettura */}
          {isEditing && !isEditMode && (
            <div className="flex flex-wrap gap-2 ml-2">
              {/* Card Categoria */}
              {form.player_categories.length > 0 && form.player_categories.map(categoryId => {
                const category = categories.find(cat => cat.id === categoryId)
                return category ? (
                  <div key={categoryId} className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {category.name}
                  </div>
                ) : null
              })}
              
              {/* Card Ruoli */}
              {form.player_field_roles.length > 0 && form.player_field_roles.map(roleId => {
                const role = fieldRoles.find(r => r.id === roleId)
                return role ? (
                  <div key={roleId} className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {role.name}
                  </div>
                ) : null
              })}
            </div>
          )}
        </div>
      
        {/* Informazioni di base - Layout migliorato */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Codice FIR - 4 colonne */}
          <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Codice FIR
              </div>
                      </label>
                            <input
              type="text"
              value={form.fir_code}
              onChange={(e) => handleInputChange('fir_code', e.target.value)}
              disabled={isFieldDisabled()}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900 transition-colors"
            />
                      </div>
                  
          {/* Data di Nascita (per FIR) - 3 colonne */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Data di Nascita (per FIR)
                    </div>
            </label>
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => handleInputChange('birth_date', e.target.value)}
              disabled={isFieldDisabled()}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900 transition-colors"
            />
          </div>
                  
          {/* Checkbox infortunato - 5 colonne */}
          <div className="md:col-span-5 flex items-end">
            <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                checked={form.injured}
                onChange={(e) => handleInputChange('injured', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <div className="ml-3 flex items-center gap-2">
                {form.injured ? (
                  <>
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm font-medium text-red-700">Attualmente infortunato</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-green-700">In buone condizioni</span>
                  </>
                )}
              </div>
                    </label>
          </div>
                  </div>
                  
        {/* Statistiche Giocatore - Solo in modalità sola lettura */}
        {isEditing && !isEditMode ? (
          <div className="border-t pt-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Statistiche Giocatore
              </h3>
              
              {/* Informazioni aggiuntive */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Squadra: U18</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Ultimo allenamento: 2 giorni fa</span>
                </div>
              </div>
            </div>
            
            {/* Grid delle statistiche migliorato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Partite */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full">+2 questa stagione</span>
                </div>
                <div className="text-3xl font-bold text-blue-700 mb-1">15</div>
                <div className="text-sm font-medium text-blue-600">Partite</div>
              </div>
              
              {/* Minuti Giocati */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded-full">+150 min</span>
                </div>
                <div className="text-3xl font-bold text-green-700 mb-1">1,250</div>
                <div className="text-sm font-medium text-green-600">Minuti</div>
              </div>
              
              {/* Mete */}
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-yellow-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-yellow-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-yellow-600 bg-yellow-200 px-2 py-1 rounded-full">+1 questa settimana</span>
                </div>
                <div className="text-3xl font-bold text-yellow-700 mb-1">8</div>
                <div className="text-sm font-medium text-yellow-600">Mete</div>
              </div>
              
              {/* Punti */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded-full">+5 punti</span>
                </div>
                <div className="text-3xl font-bold text-purple-700 mb-1">45</div>
                <div className="text-sm font-medium text-purple-600">Punti</div>
              </div>
              
              {/* Presenze Allenamento */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-indigo-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-indigo-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-200 px-2 py-1 rounded-full">93% presenza</span>
                </div>
                <div className="text-3xl font-bold text-indigo-700 mb-1">42/45</div>
                <div className="text-sm font-medium text-indigo-600">Presenze</div>
              </div>
              
              {/* Infortuni */}
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-red-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-red-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-red-600 bg-red-200 px-2 py-1 rounded-full">Stato: Recuperato</span>
                </div>
                <div className="text-3xl font-bold text-red-700 mb-1">2</div>
                <div className="text-sm font-medium text-red-600">Infortuni</div>
                <div className="text-xs text-red-500 mt-1 font-medium">Ultimo: 3 mesi fa</div>
              </div>
            </div>
            
            {/* Stato forma */}
            <div className={`mt-6 p-4 rounded-xl border ${
              form.injured 
                ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200' 
                : 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    form.injured ? 'bg-red-500' : 'bg-green-500'
                  }`}>
                    {form.injured ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                      <div>
                    <h4 className="font-semibold text-gray-900">Stato Forma</h4>
                    <p className={`text-sm ${
                      form.injured ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {form.injured 
                        ? 'Infortunato - Non disponibile per la competizione' 
                        : 'Ottimo - Pronto per la competizione'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    form.injured ? 'bg-red-500' : 'bg-green-500'
                  } ${form.injured ? '' : 'animate-pulse'}`}></div>
                  <span className={`text-sm font-medium ${
                    form.injured ? 'text-red-700' : 'text-green-700'
                  }`}>
                    {form.injured ? 'Infortunato' : 'Attivo'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Modalità modifica - mostra le sezioni normali
          <>
            {/* Categorie */}
            <div className="border-t pt-6">
              <h3 className="text-md font-medium text-gray-900 mb-4">Categorie</h3>
              <div className="grid grid-cols-3 gap-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                      checked={form.player_categories.includes(category.id)}
                                onChange={(e) => {
                        if (e.target.checked) {
                          handleInputChange('player_categories', [...form.player_categories, category.id])
                        } else {
                          handleInputChange('player_categories', form.player_categories.filter(id => id !== category.id))
                        }
                      }}
                      disabled={isFieldDisabled()}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{category.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

            {/* Ruoli in Campo */}
            <div className="border-t pt-6">
              <h3 className="text-md font-medium text-gray-900 mb-4">Ruoli in Campo (max 2)</h3>
              {form.player_field_roles.length >= 2 && (
                <p className="text-sm text-amber-600 mb-2">
                  Hai selezionato 2 ruoli. Deseleziona un ruolo per sceglierne un altro.
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {fieldRoles.map((role) => (
                  <label key={role.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                      checked={form.player_field_roles.includes(role.id)}
                                onChange={(e) => {
                        if (e.target.checked) {
                          // Massimo 2 ruoli
                          if (form.player_field_roles.length < 2) {
                            handleInputChange('player_field_roles', [...form.player_field_roles, role.id])
                          }
                        } else {
                          handleInputChange('player_field_roles', form.player_field_roles.filter(id => id !== role.id))
                        }
                      }}
                      disabled={isFieldDisabled()}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{role.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
          </>
        )}
                    </div>
    )
  }

  const renderDocumentsTab = () => (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Documenti</h2>
      <p className="text-gray-500">Gestione documenti e certificati medici</p>
      {/* TODO: Implementare gestione documenti */}
              </div>
  )

  const renderNotesTab = () => {

    const handleTypeFilterChange = (type: string, checked: boolean) => {
      if (checked) {
        setSelectedTypes(prev => [...prev, type])
      } else {
        setSelectedTypes(prev => prev.filter(t => t !== type))
      }
    }

    const clearFilters = () => {
      setSearchQuery('')
      setSelectedTypes([])
      setDateFilter('all')
      setSortBy('date')
      setSortOrder('desc')
    }

    // Funzione per ottenere l'icona del tipo di nota
    const getNoteIcon = (type: string) => {
      switch (type) {
        case 'medical':
          return (
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
          )
        case 'injury':
          return (
            <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )
        case 'training':
          return (
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
          )
        case 'secretary':
          return (
            <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          )
        default:
          return (
            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          )
      }
    }

    // Funzione per ottenere il colore del tipo di nota
    const getNoteColor = (type: string) => {
      switch (type) {
        case 'medical': return 'border-l-red-500 bg-red-50'
        case 'injury': return 'border-l-orange-500 bg-orange-50'
        case 'training': return 'border-l-green-500 bg-green-50'
        case 'secretary': return 'border-l-purple-500 bg-purple-50'
        default: return 'border-l-blue-500 bg-blue-50'
      }
    }

    // Funzione per ottenere il nome del tipo di nota
    const getNoteTypeName = (type: string) => {
      switch (type) {
        case 'medical': return 'Medica'
        case 'injury': return 'Infortunio'
        case 'training': return 'Allenamento'
        case 'secretary': return 'Segreteria'
        default: return 'Generale'
      }
    }


    return (
      <div className="space-y-6">
        {/* Header con indicatore scroll */}
        <div className="flex items-center justify-end">
          {getFilteredAndSortedNotes().length > 3 && (
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              📜 Scroll per vedere tutte
            </span>
                  )}
                </div>

        {/* Filtri e ricerca */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Campo di ricerca */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                🔍 Cerca
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca nelle note..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              </div>

            {/* Filtro per tipo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                🏷️ Tipo
              </label>
              <div className="grid grid-cols-2 gap-1">
                {['note', 'medical', 'injury', 'training', 'secretary'].map(type => (
                  <label key={type} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={(e) => handleTypeFilterChange(type, e.target.checked)}
                      className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">{getNoteTypeName(type)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filtro per data */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                📅 Data
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">Tutte le date</option>
                <option value="today">Oggi</option>
                <option value="week">Ultima settimana</option>
                <option value="month">Ultimo mese</option>
              </select>
            </div>

            {/* Ordinamento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🔄 Ordina per
              </label>
              <div className="space-y-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="date">Data</option>
                  <option value="type">Tipo</option>
                  <option value="author">Autore</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="desc">Più recenti</option>
                  <option value="asc">Più vecchi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Pulsante per pulire i filtri */}
          <div className="mt-3 flex justify-end">
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Pulisci filtri
            </button>
          </div>
        </div>

        {/* Form per aggiungere nuova nota */}
        {showAddNoteForm && (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Aggiungi Nota</h3>
            <div className="space-y-4">
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo di nota
                </label>
                <select
                  value={newNote.type || 'note'}
                  onChange={(e) => setNewNote(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="note">Nota generale</option>
                  <option value="medical">Nota medica</option>
                  <option value="injury">Infortunio</option>
                  <option value="training">Allenamento</option>
                  <option value="secretary">Segreteria</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenuto della nota
                  </label>
                  <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Inserisci il contenuto della nota..."
                  rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleAddNote}
                  disabled={loadingNotes || !newNote.content.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingNotes ? 'Salvataggio...' : 'Aggiungi Nota'}
                </button>
                <button
                  onClick={() => {
                    setShowAddNoteForm(false)
                    setNewNote({ content: '', type: 'note' })
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista delle note */}
        {loadingNotes ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-500">Caricamento note...</p>
          </div>
        ) : getFilteredAndSortedNotes().length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-gray-500">
              {notes.length === 0 ? 'Nessuna nota presente' : 'Nessuna nota corrisponde ai filtri selezionati'}
            </p>
            <p className="text-sm text-gray-400">
              {notes.length === 0 ? 'Clicca sul pulsante + per aggiungere la prima nota' : 'Prova a modificare i filtri o la ricerca'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
            {getFilteredAndSortedNotes().map((note) => (
              <div key={note.id} className={`border-l-4 ${getNoteColor(note.type)} bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getNoteIcon(note.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                          {getNoteTypeName(note.type)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(note.date).toLocaleDateString('it-IT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <p className="text-gray-900 text-sm leading-relaxed">{note.content}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <span className="text-xs text-gray-500">{note.created_by}</span>
                    <button
                      onClick={() => handleDeleteNote(note)}
                      className="text-red-500 hover:text-red-700 p-1 transition-colors"
                      title="Elimina nota"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderInjuriesTab = () => {
    if (!editId) {
      return (
        <div className="space-y-6">
          <h2 className="text-lg font-medium text-gray-900">Infortuni</h2>
          <p className="text-gray-500">Gestione infortuni del giocatore</p>
          <div className="text-center py-8">
            <p className="text-gray-500">Salva prima la persona per gestire gli infortuni</p>
          </div>
        </div>
      )
    }

    return <InjuriesTab personId={editId} onNoteAdded={() => {
      // Ricarica le note se siamo nel tab note
      if (activeTab === 'notes') {
        loadNotes()
      }
    }} />
  }

  return (
                <div>
      <Header title={isEditing ? "Modifica Anagrafica" : "Nuova Persona"} showBack={true} />
      
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border">
            {/* Header con titolo */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? "Modifica Anagrafica" : "Crea Nuova Persona"}
              </h1>
                </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                <button
                  onClick={() => handleTabChange('personal')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'personal'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Informazioni Personali
                </button>
                
                {form.is_player && (
                  <button
                    onClick={() => handleTabChange('player')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'player'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Giocatore
                  </button>
                )}
                
                {form.is_staff && (
                  <button
                    onClick={() => handleTabChange('staff')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'staff'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Staff
                  </button>
                )}
                
                <button
                  onClick={() => handleTabChange('documents')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'documents'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Documenti
                </button>
                
                <button
                  onClick={() => handleTabChange('notes')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'notes'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Note
                </button>
                
                {form.is_player && (
                  <button
                    onClick={() => handleTabChange('injuries')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'injuries'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Infortuni
                  </button>
                )}
              </nav>
              </div>

            {/* Tab Content */}
            <div className="p-6">
              <form onSubmit={handleSubmit}>
                {activeTab === 'personal' && renderPersonalTab()}
                {activeTab === 'player' && renderPlayerTab()}
                {activeTab === 'staff' && renderStaffTab()}
                {activeTab === 'documents' && renderDocumentsTab()}
                {activeTab === 'notes' && renderNotesTab()}
                {activeTab === 'injuries' && renderInjuriesTab()}

                {/* Pulsanti di azione */}
                <div className="flex justify-between items-center pt-6 border-t border-gray-200 mt-6">
                  {/* Pulsante + per aggiungere nota e contatore - Solo nel tab Note - A sinistra */}
                  <div className="flex items-center space-x-3">
                    {activeTab === 'notes' && (
                      <>
                        <button
                          onClick={() => setShowAddNoteForm(true)}
                          className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-blue-700 shadow-lg"
                          title="Aggiungi nota"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                        
                        {/* Contatore note */}
                        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                          {getFilteredAndSortedNotes().length} di {notes.length} {notes.length === 1 ? 'nota' : 'note'}
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* Pulsanti di controllo a destra */}
                  <div className="flex space-x-3">
                <button
                  type="button"
                      onClick={handleBackWithConfirmation}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                      Indietro
                </button>
                    
                    {/* Pulsante Modifica/Aggiorna per modalità sola lettura */}
                    {isEditing && (
                      <>
                        {!isEditMode ? (
                          <button
                            type="button"
                            onClick={handleEditMode}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                          >
                            Modifica
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                            >
                              Annulla Modifiche
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveChanges}
                              disabled={loading}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {loading ? 'Salvataggio...' : 'Aggiorna'}
                            </button>
                          </>
                        )}
                      </>
                    )}
                    
                    {/* Pulsante normale per creazione nuova persona */}
                    {!isEditing && (
                <button
                  type="submit"
                  disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                        {loading ? 'Salvataggio...' : 'Crea'}
                </button>
                    )}
                  </div>
              </div>
            </form>
          </div>
        </div>
        </div>

        {/* Popup di conferma eliminazione - Stile Apple */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 ease-out scale-100">
              {/* Header del popup */}
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Elimina Nota</h3>
                    <p className="text-sm text-gray-500">Questa azione non può essere annullata</p>
                  </div>
                </div>
              </div>

              {/* Contenuto del popup */}
              <div className="px-6 py-4">
                <p className="text-gray-700 mb-4">
                  Sei sicuro di voler eliminare questa nota?
                </p>
                {noteToDelete && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
                        {getNoteTypeName(noteToDelete.type)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(noteToDelete.date).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 line-clamp-2">{noteToDelete.content}</p>
                  </div>
                )}
              </div>

              {/* Pulsanti del popup */}
              <div className="px-6 py-4 bg-gray-50 rounded-b-2xl">
                <div className="flex space-x-3">
                  <button
                    onClick={cancelDeleteNote}
                    className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={confirmDeleteNote}
                    disabled={loadingNotes}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {loadingNotes ? 'Eliminazione...' : 'Elimina'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
