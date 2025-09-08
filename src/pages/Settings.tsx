import Header from '@/components/Header'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import EmailTemplateViewer from '@/components/EmailTemplateViewer'
import { PermissionsDebug } from '@/components/PermissionsDebug'
import QueryPerformanceMonitor from '@/components/QueryPerformanceMonitor'
import { useAuth } from '@/store/auth'

interface Category {
  id: string
  code: string
  name: string
  sort: number
  active: boolean
  created_at: string
}

interface ProfessionalCategory {
  id: string
  name: string
  description?: string
  is_sponsor_potential: boolean
  is_club_useful: boolean
  position_order: number
  active: boolean
  created_at: string
  updated_at: string
}

interface TrainingLocation {
  location: string
  weekday: string
  start_time: string
  end_time: string
}

interface NewCategory {
  code: string
  name: string
  training_locations: TrainingLocation[]
}

export default function Settings() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState<NewCategory>({ 
    code: '', 
    name: '', 
    training_locations: [{ location: '', weekday: '', start_time: '', end_time: '' }] 
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'categories' | 'system' | 'emails' | 'permissions' | 'debug' | 'performance'>('system')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCategoryData, setEditingCategoryData] = useState<Category | null>(null)
  const [editingTrainingLocations, setEditingTrainingLocations] = useState<TrainingLocation[]>([])
  const [categoryTrainingLocations, setCategoryTrainingLocations] = useState<Record<string, TrainingLocation[]>>({})
  
  // Stati per le professioni lavorative
  const [professionalCategories, setProfessionalCategories] = useState<ProfessionalCategory[]>([])
  const [newProfessionalCategory, setNewProfessionalCategory] = useState({
    name: '',
    description: '',
    is_sponsor_potential: false,
    is_club_useful: false
  })
  const [showProfessionalCategoryModal, setShowProfessionalCategoryModal] = useState(false)
  const [editingProfessionalCategory, setEditingProfessionalCategory] = useState<ProfessionalCategory | null>(null)
  const [expandedProfessionalCategories, setExpandedProfessionalCategories] = useState(false)

  useEffect(() => {
    loadCategories()
    loadProfessionalCategories()
    
    // Controlla se c'è un parametro tab nell'URL
    const urlParams = new URLSearchParams(window.location.search)
    const tabParam = urlParams.get('tab')
    
    if (tabParam && ['categories', 'system', 'emails', 'permissions', 'debug', 'performance'].includes(tabParam)) {
      setActiveTab(tabParam as 'categories' | 'system' | 'emails' | 'permissions' | 'debug' | 'performance')
    }
  }, [])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort', { ascending: true })

      if (error) throw error
      
      // Assicurati che tutte le categorie abbiano il campo active
      const categoriesWithActive = (data || []).map(cat => ({
        ...cat,
        active: cat.active !== undefined ? cat.active : true
      }))
      
      setCategories(categoriesWithActive)
      
      // Carica le sedi di allenamento per tutte le categorie
      await loadTrainingLocations(categoriesWithActive)
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const loadProfessionalCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('professional_categories')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setProfessionalCategories(data || [])
    } catch (error) {
      console.error('Errore nel caricamento professioni:', error)
    }
  }

  const handleCreateProfessionalCategory = async () => {
    if (!newProfessionalCategory.name.trim()) {
      setMessage('Il nome della professione è obbligatorio')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('professional_categories')
        .insert([{
          name: newProfessionalCategory.name.trim(),
          description: newProfessionalCategory.description.trim() || null,
          is_sponsor_potential: newProfessionalCategory.is_sponsor_potential,
          is_club_useful: newProfessionalCategory.is_club_useful,
          position_order: professionalCategories.length
        }])
        .select()

      if (error) throw error

      setMessage('Professione creata con successo!')
      setNewProfessionalCategory({
        name: '',
        description: '',
        is_sponsor_potential: false,
        is_club_useful: false
      })
      setShowProfessionalCategoryModal(false)
      loadProfessionalCategories()
    } catch (error) {
      console.error('Errore nella creazione professione:', error)
      setMessage('Errore nella creazione della professione')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProfessionalCategory = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa professione?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('professional_categories')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMessage('Professione eliminata con successo!')
      loadProfessionalCategories()
    } catch (error) {
      console.error('Errore nell\'eliminazione professione:', error)
      setMessage('Errore nell\'eliminazione della professione')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfessionalCategory = async () => {
    if (!editingProfessionalCategory) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('professional_categories')
        .update({
          name: editingProfessionalCategory.name.trim(),
          description: editingProfessionalCategory.description?.trim() || null,
          is_sponsor_potential: editingProfessionalCategory.is_sponsor_potential,
          is_club_useful: editingProfessionalCategory.is_club_useful
        })
        .eq('id', editingProfessionalCategory.id)

      if (error) throw error

      setMessage('Professione aggiornata con successo!')
      setEditingProfessionalCategory(null)
      loadProfessionalCategories()
    } catch (error) {
      console.error('Errore nell\'aggiornamento professione:', error)
      setMessage('Errore nell\'aggiornamento della professione')
    } finally {
      setLoading(false)
    }
  }

  const sortByWeekday = (locations: TrainingLocation[]): TrainingLocation[] => {
    const weekdayOrder = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
    
    return locations.sort((a, b) => {
      const aIndex = weekdayOrder.indexOf(a.weekday)
      const bIndex = weekdayOrder.indexOf(b.weekday)
      
      // Se i giorni sono diversi, ordina per giorno
      if (aIndex !== bIndex) {
        return aIndex - bIndex
      }
      
      // Se il giorno è lo stesso, ordina per orario di inizio
      return a.start_time.localeCompare(b.start_time)
    })
  }

  const loadTrainingLocations = async (categories: Category[]) => {
    try {
      const categoryIds = categories.map(cat => cat.id)
      
      const { data, error } = await supabase
        .from('training_locations')
        .select('*')
        .in('category_id', categoryIds)
        .order('start_time')

      if (error) throw error

      // Raggruppa le sedi per categoria
      const locationsByCategory: Record<string, TrainingLocation[]> = {}
      
      categories.forEach(cat => {
        locationsByCategory[cat.id] = []
      })

      if (data) {
        data.forEach(location => {
          if (locationsByCategory[location.category_id]) {
            locationsByCategory[location.category_id].push({
              location: location.location,
              weekday: location.weekday,
              start_time: location.start_time,
              end_time: location.end_time
            })
          }
        })
      }

      // Ordina i giorni della settimana per ogni categoria
      Object.keys(locationsByCategory).forEach(categoryId => {
        locationsByCategory[categoryId] = sortByWeekday(locationsByCategory[categoryId])
      })

      setCategoryTrainingLocations(locationsByCategory)
    } catch (error) {
      console.error('Errore nel caricamento sedi di allenamento:', error)
    }
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (!newCategory.code.trim() || !newCategory.name.trim()) {
        throw new Error('Codice e nome sono obbligatori')
      }

      // Validazione sedi di allenamento
      const validLocations = newCategory.training_locations.filter(loc => 
        loc.location.trim() && loc.weekday.trim() && loc.start_time.trim() && loc.end_time.trim()
      )
      
      if (validLocations.length === 0) {
        throw new Error('Devi inserire almeno una sede di allenamento completa')
      }

      // Verifica che il codice non esista già
      const existingCategory = categories.find(c => c.code === newCategory.code.toUpperCase())
      if (existingCategory) {
        throw new Error('Una categoria con questo codice esiste già')
      }

      // Determina il valore sort per la nuova categoria
      let sortValue = 999 // Valore di default per nuove categorie
      
      // Se è una delle categorie standard, assegna il sort corretto
      const standardSorts: { [key: string]: number } = {
        'U14': 1,
        'U16': 2,
        'U18': 3,
        'CADETTA': 4,
        'PRIMA': 5,
        'SENIORES': 6
      }
      
      if (standardSorts[newCategory.code.toUpperCase()]) {
        sortValue = standardSorts[newCategory.code.toUpperCase()]
      } else {
        // Per nuove categorie, trova il valore sort più alto e aggiungi 1
        const maxSort = Math.max(...categories.map(c => c.sort), 0)
        sortValue = maxSort + 1
      }

      // Inserisci la categoria
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .insert({
          code: newCategory.code.toUpperCase(),
          name: newCategory.name.trim(),
          sort: sortValue
        })
        .select()

      if (categoryError) throw categoryError

      const categoryId = categoryData[0].id

      // Inserisci le sedi di allenamento
      const trainingLocationsData = validLocations.map(loc => ({
        category_id: categoryId,
        location: loc.location.trim(),
        weekday: loc.weekday.trim(),
        start_time: loc.start_time.trim(),
        end_time: loc.end_time.trim()
      }))

      const { error: locationsError } = await supabase
        .from('training_locations')
        .insert(trainingLocationsData)

      if (locationsError) throw locationsError

      setMessage('✅ Categoria e sedi di allenamento create con successo!')
      setNewCategory({ 
        code: '', 
        name: '', 
        training_locations: [{ location: '', weekday: '', start_time: '', end_time: '' }] 
      })
      loadCategories() // Ricarica la lista e le sedi di allenamento
    } catch (error: any) {
      console.error('Errore nella creazione categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEditCategory = (categoryId: string, currentName: string) => {
    setEditingCategory(categoryId)
    setEditingName(currentName)
  }

  const handleSaveCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: editingName.trim() })
        .eq('id', categoryId)

      if (error) throw error

      setMessage('✅ Nome categoria aggiornato con successo!')
      setEditingCategory(null)
      setEditingName('')
      loadCategories()
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    }
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditingName('')
  }

  const handleToggleActive = async (categoryId: string, currentActive: boolean) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .update({ active: !currentActive })
        .eq('id', categoryId)
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        setMessage(`✅ Categoria ${!currentActive ? 'attivata' : 'disattivata'} con successo!`)
      } else {
        setMessage(`❌ Errore: Update non riuscito`)
      }
      
      await loadCategories()
    } catch (error: any) {
      console.error('Errore nel cambio stato categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      // PASSO 1: Controlla se ci sono giocatori collegati (usa i campi corretti)
      let players: any[] = []
      let playersError = null
      
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id, first_name, last_name') // Usa i campi corretti
          .eq('category_id', categoryId)
        
        players = data || []
        playersError = error
      } catch (e) {
        // Se la tabella players non esiste, ignora
        console.log('Tabella players non trovata, continuo...')
      }

      // PASSO 2: Controlla se ci sono utenti collegati
      let users: any[] = []
      let usersError = null
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('category_id', categoryId)
        
        users = data || []
        usersError = error
      } catch (e) {
        // Se la tabella profiles non esiste, ignora
        console.log('Tabella profiles non trovata, continuo...')
      }

      // PASSO 3: Se ci sono collegamenti, mostra popup dettagliato
      if ((players && players.length > 0) || (users && users.length > 0)) {
        let message = '❌ **IMPOSSIBILE ELIMINARE QUESTA CATEGORIA!**\n\n'
        message += '**Motivo:** La categoria è attualmente in uso da:\n\n'

        if (players && players.length > 0) {
          message += `🏃‍♂️ **${players.length} Giocatore/i:**\n`
          players.forEach(player => {
            const playerName = player.first_name && player.last_name 
              ? `${player.first_name} ${player.last_name}`
              : player.first_name || player.last_name || 'Nome non disponibile'
            message += `   • ${playerName}\n`
          })
          message += '\n'
        }

        if (users && users.length > 0) {
          message += `👥 **${users.length} Utente/i:**\n`
          users.forEach(user => {
            message += `   • ${user.full_name || 'Nome non disponibile'}\n`
          })
          message += '\n'
        }

        message += '**Soluzione:**\n'
        message += '1. Sposta tutti i giocatori/utenti in altre categorie\n'
        message += '2. Oppure elimina prima i giocatori/utenti collegati\n'
        message += '3. Poi riprova a eliminare la categoria'

        // Mostra popup con messaggio dettagliato
        alert(message)
        return
      }

      // PASSO 4: Se non ci sono collegamenti, procedi con l'eliminazione
      if (!confirm('Sei sicuro di voler eliminare questa categoria? Questa azione non può essere annullata.')) {
        return
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error

      setMessage('✅ Categoria eliminata con successo!')
      loadCategories() // Ricarica la lista
    } catch (error: any) {
      console.error('Errore nell\'eliminazione categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    }
  }

  const handleInputChange = (field: keyof NewCategory, value: string) => {
    setNewCategory(prev => ({ ...prev, [field]: value }))
  }

  const handleTrainingLocationChange = (index: number, field: keyof TrainingLocation, value: string) => {
    setNewCategory(prev => ({
      ...prev,
      training_locations: prev.training_locations.map((loc, i) => 
        i === index ? { ...loc, [field]: value } : loc
      )
    }))
  }

  const addTrainingLocation = () => {
    setNewCategory(prev => ({
      ...prev,
      training_locations: [...prev.training_locations, { location: '', weekday: '', start_time: '', end_time: '' }]
    }))
  }

  const removeTrainingLocation = (index: number) => {
    setNewCategory(prev => ({
      ...prev,
      training_locations: prev.training_locations.filter((_, i) => i !== index)
    }))
  }

  // Funzioni per il modal di modifica
  const openEditModal = async (category: Category) => {
    setEditingCategoryData(category)
    setShowEditModal(true)
    
    try {
      // Carica le sedi di allenamento esistenti
      const { data: locations, error } = await supabase
        .from('training_locations')
        .select('*')
        .eq('category_id', category.id)
        .order('location')

      if (error) throw error

      if (locations && locations.length > 0) {
        setEditingTrainingLocations(locations.map(loc => ({
          location: loc.location,
          weekday: loc.weekday || '',
          start_time: loc.start_time,
          end_time: loc.end_time
        })))
      } else {
        setEditingTrainingLocations([{ location: '', weekday: '', start_time: '', end_time: '' }])
      }
    } catch (error) {
      console.error('Errore nel caricamento sedi di allenamento:', error)
      setEditingTrainingLocations([{ location: '', weekday: '', start_time: '', end_time: '' }])
    }
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingCategoryData(null)
    setEditingTrainingLocations([])
  }

  const handleEditTrainingLocationChange = (index: number, field: keyof TrainingLocation, value: string) => {
    setEditingTrainingLocations(prev => 
      prev.map((loc, i) => 
        i === index ? { ...loc, [field]: value } : loc
      )
    )
  }

  const addEditTrainingLocation = () => {
    setEditingTrainingLocations(prev => [
      ...prev,
      { location: '', weekday: '', start_time: '', end_time: '' }
    ])
  }

  const removeEditTrainingLocation = (index: number) => {
    setEditingTrainingLocations(prev => prev.filter((_, i) => i !== index))
  }

  const saveCategoryEdit = async () => {
    if (!editingCategoryData) return

    setLoading(true)
    setMessage('')

    try {
      // Validazione sedi di allenamento
      const validLocations = editingTrainingLocations.filter(loc => 
        loc.location.trim() && loc.weekday.trim() && loc.start_time.trim() && loc.end_time.trim()
      )
      
      if (validLocations.length === 0) {
        throw new Error('Devi inserire almeno una sede di allenamento completa')
      }

      // Aggiorna la categoria
      const { error: categoryError } = await supabase
        .from('categories')
        .update({
          name: editingCategoryData.name.trim()
        })
        .eq('id', editingCategoryData.id)

      if (categoryError) throw categoryError

      // Elimina le sedi esistenti
      const { error: deleteError } = await supabase
        .from('training_locations')
        .delete()
        .eq('category_id', editingCategoryData.id)

      if (deleteError) throw deleteError

      // Inserisci le nuove sedi
      const trainingLocationsData = validLocations.map(loc => ({
        category_id: editingCategoryData.id,
        location: loc.location.trim(),
        weekday: loc.weekday.trim(),
        start_time: loc.start_time.trim(),
        end_time: loc.end_time.trim()
      }))

      const { error: locationsError } = await supabase
        .from('training_locations')
        .insert(trainingLocationsData)

      if (locationsError) throw locationsError

      setMessage('✅ Categoria e sedi di allenamento aggiornate con successo!')
      closeEditModal()
      loadCategories() // Ricarica la lista e le sedi di allenamento
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Header title="Configurazioni" showBack={true} />
      
      <div className="p-6">
        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => {
              setActiveTab('categories')
              navigate('/settings?tab=categories', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'categories'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📋 Categorie
          </button>
          <button
            onClick={() => {
              setActiveTab('system')
              navigate('/settings?tab=system', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'system'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ⚙️ Sistema
          </button>
          <button
            onClick={() => {
              setActiveTab('emails')
              navigate('/settings?tab=emails', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'emails'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📧 Email
          </button>
          <button
            onClick={() => {
              setActiveTab('permissions')
              navigate('/settings?tab=permissions', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'permissions'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🔐 I Tuoi Permessi
          </button>
          <button
            onClick={() => {
              setActiveTab('debug')
              navigate('/settings?tab=debug', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'debug'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🔧 Debug
          </button>
          <button
            onClick={() => {
              setActiveTab('performance')
              navigate('/settings?tab=performance', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'performance'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ⚡ Performance
          </button>
        </div>

        {/* Tab Categorie */}
        {activeTab === 'categories' && (
          <div className="space-y-8">
            {/* Aggiungi Categoria */}
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-4">Aggiungi Nuova Categoria</h2>
              
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Codice *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCategory.code}
                      onChange={(e) => handleInputChange('code', e.target.value)}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="Es. U16, SENIORES"
                      maxLength={10}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCategory.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="Es. Under 16, Seniores"
                    />
                  </div>
                </div>

                {/* Sedi di Allenamento */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Sedi di Allenamento *</h3>
                  <div className="space-y-4">
                    {newCategory.training_locations.map((location, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sede *
                          </label>
                          <select
                            required
                            value={location.location}
                            onChange={(e) => handleTrainingLocationChange(index, 'location', e.target.value)}
                            className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                          >
                            <option value="">Seleziona sede</option>
                            <option value="Brescia">Brescia</option>
                            <option value="Ospitaletto">Ospitaletto</option>
                            <option value="Gussago">Gussago</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Giorno *
                          </label>
                          <select
                            required
                            value={location.weekday}
                            onChange={(e) => handleTrainingLocationChange(index, 'weekday', e.target.value)}
                            className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                          >
                            <option value="">Seleziona giorno</option>
                            <option value="Lunedì">Lunedì</option>
                            <option value="Martedì">Martedì</option>
                            <option value="Mercoledì">Mercoledì</option>
                            <option value="Giovedì">Giovedì</option>
                            <option value="Venerdì">Venerdì</option>
                            <option value="Sabato">Sabato</option>
                            <option value="Domenica">Domenica</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dalle *
                          </label>
                          <input
                            type="time"
                            required
                            value={location.start_time}
                            onChange={(e) => handleTrainingLocationChange(index, 'start_time', e.target.value)}
                            className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Alle *
                          </label>
                          <input
                            type="time"
                            required
                            value={location.end_time}
                            onChange={(e) => handleTrainingLocationChange(index, 'end_time', e.target.value)}
                            className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                          />
                        </div>
                        
                        <div className="flex items-end">
                          {newCategory.training_locations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTrainingLocation(index)}
                              className="w-full p-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-colors"
                            >
                              🗑️ Rimuovi
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={addTrainingLocation}
                      className="w-full p-3 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                    >
                      ➕ Aggiungi Sede di Allenamento
                    </button>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="btn bg-sky text-white px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creazione...' : 'Aggiungi Categoria'}
                </button>
              </form>
            </div>

            {/* Lista Categorie */}
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-4">Categorie Esistenti</h2>
              
              {categories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📋</div>
                  <p>Nessuna categoria trovata</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {categories.map((category) => (
                    <div key={category.id} className={`flex items-center justify-between p-4 rounded-lg transition-colors duration-200 ${
                      category.active 
                        ? 'bg-green-50 border border-green-200' 
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-center space-x-4 relative">
                        {/* Checkbox per attivazione */}
                                                <div className="relative z-20">
                          <input
                            type="checkbox"
                            checked={category.active || false}
                            onChange={(e) => {
                              handleToggleActive(category.id, category.active || false)
                            }}
                            className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                            title={category.active ? 'Disattiva categoria' : 'Attiva categoria'}
                          />
                        </div>
                        
                        <div>
                          <div className="font-semibold text-lg">{category.code}</div>
                          {editingCategory === category.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-sky-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveCategory(category.id)}
                                className="text-sm bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                              >
                                Salva
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="text-sm bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                              >
                                Annulla
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600">{category.name}</div>
                          )}
                          <div className="text-xs text-gray-500">
                            Creata il {new Date(category.created_at).toLocaleDateString('it-IT')}
                            {category.active ? (
                              <span className="ml-2 text-green-600">✓ Attiva</span>
                            ) : (
                              <span className="ml-2 text-red-700">✗ Non attiva</span>
                            )}
                          </div>
                          
                          {/* Sedi di Allenamento */}
                          {categoryTrainingLocations[category.id] && categoryTrainingLocations[category.id].length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-medium text-gray-700 mb-1">Sedi di Allenamento:</div>
                              <div className="space-y-1">
                                {categoryTrainingLocations[category.id].map((location, index) => (
                                  <div key={index} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                    <span className="font-medium">{location.weekday}</span> - {location.location} 
                                    <span className="text-gray-500 ml-1">
                                      ({location.start_time} - {location.end_time})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {editingCategory !== category.id && (
                          <button
                            onClick={() => openEditModal(category)}
                            className="btn bg-blue-500 text-white px-3 py-2 text-sm hover:bg-blue-600"
                            title="Modifica categoria e sedi di allenamento"
                          >
                            Modifica
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="btn bg-red-500 text-white px-3 py-2 text-sm hover:bg-red-600"
                          title="Elimina categoria"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Sistema */}
        {activeTab === 'system' && (
          <div className="space-y-8">
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-4">Impostazioni Sistema</h2>
              
              <div className="space-y-6">
                {/* Personalizzazione Brand */}
                <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-pink-800 mb-2">🎨 Personalizzazione Brand</h3>
                    <p className="text-sm text-pink-700">
                      Personalizza logo, colori, nome squadra e aspetto grafico dell'app.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/brand-customization')}
                    className="btn bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-2 text-sm hover:from-pink-600 hover:to-purple-600 ml-4"
                  >
                    🎨 Personalizza
                  </button>
                </div>

                {/* Gestione Utenti */}
                <div className="p-4 bg-green-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-800 mb-2">👥 Gestione Utenti</h3>
                    <p className="text-sm text-green-700">
                      Creazione e gestione di utenti staff con diversi livelli di accesso.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/create-user')}
                    className="btn bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 ml-4"
                  >
                    ➕ Crea Nuovo Utente
                  </button>
                </div>

                {/* Gestione Giocatori */}
                <div className="p-4 bg-orange-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-800 mb-2">🏉 Gestione Giocatori</h3>
                    <p className="text-sm text-orange-700">
                      Registrazione giocatori e assegnazione alle categorie appropriate.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/create-player')}
                    className="btn bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700 ml-4"
                  >
                    ➕ Crea Nuovo Giocatore
                  </button>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">🔐 Autenticazione</h3>
                  <p className="text-sm text-blue-700">
                    Sistema di autenticazione personalizzato con gestione profili e ruoli.
                  </p>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">📊 Presenze</h3>
                  <p className="text-sm text-purple-700">
                    Sistema di tracciamento presenze per sessioni e allenamenti.
                  </p>
                </div>

                {/* Gestione Consiglio */}
                <div className="p-4 bg-yellow-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-800 mb-2">🏛️ Gestione Consiglio</h3>
                    <p className="text-sm text-yellow-700">
                      Configura Presidente, Vice Presidente e Consiglieri per gli eventi consiglio.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/council-management')}
                    className="btn bg-yellow-600 text-white px-4 py-2 text-sm hover:bg-yellow-700 ml-4"
                  >
                    ⚙️ Gestisci Consiglio
                  </button>
                </div>

                {/* Professioni Lavorative - ACCORDION */}
                <div className="bg-emerald-50 rounded-lg overflow-hidden">
                  {/* Header cliccabile */}
                  <div 
                    className="p-4 cursor-pointer transition-all duration-200 hover:bg-emerald-100/50 flex items-center justify-between"
                    onClick={() => setExpandedProfessionalCategories(!expandedProfessionalCategories)}
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-emerald-800 mb-1">💼 Professioni Lavorative</h3>
                      <p className="text-sm text-emerald-700">
                        Gestisci le professioni lavorative per categorizzare persone e identificare potenziali sponsor.
                      </p>
                    </div>
                    
                    {/* Pulsante Crea Nuova Professione */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowProfessionalCategoryModal(true)
                      }}
                      className="ml-4 bg-emerald-500 text-white px-3 py-2 text-sm rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
                    >
                      <span>➕</span>
                      <span>Crea Nuova</span>
                    </button>
                  </div>
                  
                  {/* Contenuto espandibile */}
                  {expandedProfessionalCategories && (
                    <div className="px-4 pb-4 border-t border-emerald-200/50">
                      {/* Lista professioni esistenti */}
                      <div className="space-y-2 mt-4">
                        {professionalCategories.length > 0 ? (
                          professionalCategories.map((profession) => (
                            <div key={profession.id} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex-1">
                                <div className="font-medium text-gray-800">{profession.name}</div>
                                {profession.description && (
                                  <div className="text-sm text-gray-600">{profession.description}</div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  {profession.is_sponsor_potential && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">💰 Sponsor</span>
                                  )}
                                  {profession.is_club_useful && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">🏢 Utile Club</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditingProfessionalCategory(profession)}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteProfessionalCategory(profession.id)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-500 text-sm text-center py-4">Nessuna professione creata</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* I Tuoi Permessi - NUOVA FASCIA */}
                <div className="p-4 bg-indigo-50 rounded-lg cursor-pointer transition-all duration-200 hover:scale-102 hover:bg-indigo-100"
                     onClick={() => setActiveTab('permissions')}>
                  <h3 className="font-semibold text-indigo-800 mb-2">🔐 I Tuoi Permessi</h3>
                  <p className="text-sm text-indigo-700 mb-3">
                    Visualizza i permessi del tuo ruolo e quelli non assegnati.
                  </p>
                  <div className="flex items-center text-indigo-600 text-sm">
                    <span>👆 Clicca per visualizzare i tuoi permessi</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Email */}
        {activeTab === 'emails' && (
          <div className="space-y-8">
            <EmailTemplateViewer />
          </div>
        )}

        {/* Tab I Tuoi Permessi */}
        {activeTab === 'permissions' && (
          <div className="space-y-8">
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-6">I Tuoi Permessi</h2>
              <p className="text-gray-600 mb-6">
                Visualizza i permessi del tuo ruolo e quelli non assegnati
              </p>
              
              {/* Informazioni Ruolo */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">👤</span>
                  <div>
                    <h3 className="font-semibold text-blue-800">Ruolo: {profile?.role || 'Non definito'}</h3>
                    <p className="text-sm text-blue-600">Visualizza i permessi associati al tuo ruolo</p>
                  </div>
                </div>
              </div>
              
              {/* Permessi Dinamici */}
              <div className="space-y-6">
                {/* Categoria: Attività */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-3">🏃‍♂️ Attività</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Visualizza Attività</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Crea Attività</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Modifica Attività</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Gestione Presenze</span>
                    </div>
                  </div>
                </div>

                {/* Categoria: Giocatori */}
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-3">🏉 Giocatori</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Visualizza Giocatori</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Modifica Giocatori</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Gestione Categorie</span>
                    </div>
                  </div>
                </div>

                {/* Categoria: Sessioni */}
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h3 className="font-semibold text-orange-800 mb-3">📅 Sessioni</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Visualizza Sessioni</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Crea Sessioni</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Modifica Sessioni</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Gestione Presenze</span>
                    </div>
                  </div>
                </div>

                {/* Categoria: Report */}
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-3">📊 Report</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Visualizza Report</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Crea Report</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Esporta Dati</span>
                    </div>
                  </div>
                </div>

                {/* Categoria: Sistema */}
                <div className="p-4 bg-red-50 rounded-lg">
                  <h3 className="font-semibold text-red-800 mb-3">⚙️ Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Gestione Utenti</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Gestione Ruoli</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Configurazioni</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal di modifica categoria */}
        {showEditModal && editingCategoryData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Modifica Categoria</h3>
                    <p className="text-sm text-gray-500">{editingCategoryData.name}</p>
                  </div>
                  <button
                    onClick={closeEditModal}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4">
                {/* Nome categoria */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Categoria *
                  </label>
                  <input
                    type="text"
                    value={editingCategoryData.name}
                    onChange={(e) => setEditingCategoryData(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Nome della categoria"
                  />
                </div>

                {/* Sedi di Allenamento */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Sedi di Allenamento *</h4>
                  <div className="space-y-4">
                    {editingTrainingLocations.map((location, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sede *
                          </label>
                          <select
                            required
                            value={location.location}
                            onChange={(e) => handleEditTrainingLocationChange(index, 'location', e.target.value)}
                            className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                          >
                            <option value="">Seleziona sede</option>
                            <option value="Brescia">Brescia</option>
                            <option value="Ospitaletto">Ospitaletto</option>
                            <option value="Gussago">Gussago</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Giorno *
                          </label>
                          <select
                            required
                            value={location.weekday}
                            onChange={(e) => handleEditTrainingLocationChange(index, 'weekday', e.target.value)}
                            className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                          >
                            <option value="">Seleziona giorno</option>
                            <option value="Lunedì">Lunedì</option>
                            <option value="Martedì">Martedì</option>
                            <option value="Mercoledì">Mercoledì</option>
                            <option value="Giovedì">Giovedì</option>
                            <option value="Venerdì">Venerdì</option>
                            <option value="Sabato">Sabato</option>
                            <option value="Domenica">Domenica</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dalle *
                          </label>
                          <input
                            type="time"
                            required
                            value={location.start_time}
                            onChange={(e) => handleEditTrainingLocationChange(index, 'start_time', e.target.value)}
                            className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Alle *
                          </label>
                          <input
                            type="time"
                            required
                            value={location.end_time}
                            onChange={(e) => handleEditTrainingLocationChange(index, 'end_time', e.target.value)}
                            className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                          />
                        </div>
                        
                        <div className="flex items-end">
                          {editingTrainingLocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEditTrainingLocation(index)}
                              className="w-full p-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-colors"
                            >
                              🗑️ Rimuovi
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={addEditTrainingLocation}
                      className="w-full p-3 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                    >
                      ➕ Aggiungi Sede di Allenamento
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-gray-50 flex space-x-3">
                <button
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={saveCategoryEdit}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Debug */}
        {activeTab === 'debug' && (
          <div className="space-y-8">
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-4">🔧 Debug Sistema Permessi</h2>
              <p className="text-gray-600 mb-6">
                Questo tab mostra lo stato del sistema di permessi per aiutare nel debugging.
              </p>
              <PermissionsDebug />
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-8">
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-4">⚡ Monitor Performance Query</h2>
              <p className="text-gray-600 mb-6">
                Monitora le performance delle query del database e la gestione della cache.
              </p>
              <QueryPerformanceMonitor />
            </div>
          </div>
        )}

        {/* Messaggio */}
        {message && (
          <div className={`fixed bottom-6 right-6 p-4 rounded-lg shadow-lg max-w-sm ${
            message.startsWith('✅') 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        {/* Modal Crea Professione */}
        {showProfessionalCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">💼 Crea Nuova Professione</h3>
              </div>
              
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Professione *
                  </label>
                  <input
                    type="text"
                    value={newProfessionalCategory.name}
                    onChange={(e) => setNewProfessionalCategory(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="es. Medico, Avvocato, Ingegnere..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione
                  </label>
                  <textarea
                    value={newProfessionalCategory.description}
                    onChange={(e) => setNewProfessionalCategory(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    rows={3}
                    placeholder="Descrizione opzionale della professione..."
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newProfessionalCategory.is_sponsor_potential}
                      onChange={(e) => setNewProfessionalCategory(prev => ({ ...prev, is_sponsor_potential: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">💰 Potenziale Sponsor</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newProfessionalCategory.is_club_useful}
                      onChange={(e) => setNewProfessionalCategory(prev => ({ ...prev, is_club_useful: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">🏢 Utile per il Club</span>
                  </label>
                </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 flex space-x-3">
                <button
                  onClick={() => {
                    setShowProfessionalCategoryModal(false)
                    setNewProfessionalCategory({
                      name: '',
                      description: '',
                      is_sponsor_potential: false,
                      is_club_useful: false
                    })
                  }}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleCreateProfessionalCategory}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Creazione...' : 'Crea Professione'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Modifica Professione */}
        {editingProfessionalCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">✏️ Modifica Professione</h3>
              </div>
              
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Professione *
                  </label>
                  <input
                    type="text"
                    value={editingProfessionalCategory.name}
                    onChange={(e) => setEditingProfessionalCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione
                  </label>
                  <textarea
                    value={editingProfessionalCategory.description || ''}
                    onChange={(e) => setEditingProfessionalCategory(prev => prev ? { ...prev, description: e.target.value } : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingProfessionalCategory.is_sponsor_potential}
                      onChange={(e) => setEditingProfessionalCategory(prev => prev ? { ...prev, is_sponsor_potential: e.target.checked } : null)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">💰 Potenziale Sponsor</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingProfessionalCategory.is_club_useful}
                      onChange={(e) => setEditingProfessionalCategory(prev => prev ? { ...prev, is_club_useful: e.target.checked } : null)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">🏢 Utile per il Club</span>
                  </label>
                </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 flex space-x-3">
                <button
                  onClick={() => setEditingProfessionalCategory(null)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleUpdateProfessionalCategory}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


