import Header from '@/components/Header'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import MessageTemplatesManager from '@/components/MessageTemplatesManager'
import { TemplatesRicevuteSection } from '@/features/templatesRicevute'
import { ReceiptHeaderForm } from '@/features/templatesRicevute/components/ReceiptHeaderForm'
import { PermissionsDebug } from '@/components/PermissionsDebug'
import QueryPerformanceMonitor from '@/components/QueryPerformanceMonitor'
import { useAuth } from '@/store/auth'
import EventTypesSettings from '@/components/EventTypesSettings'
import TrainingVenuesPanel from '@/components/TrainingVenuesPanel'
import TrainingVenueSelect from '@/components/TrainingVenueSelect'
import { GOLEE, goleeCardClass, goleeInputClass, goleeInputStyle, goleeLabelClass } from '@/config/goleeTheme'
import { getCategoryCircleClass } from '@/config/categoryColors'
import { Plus, Pencil, Trash2, Layers, MapPin, Clock, AlertTriangle } from 'lucide-react'
import { createPortal } from 'react-dom'

interface Category {
  id: string
  code: string
  name: string
  abbreviation?: string | null
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
  name: string
  abbreviation: string
  training_locations: TrainingLocation[]
}

function deriveCategoryCodeFromAbbrev(abbreviation: string): string {
  return abbreviation.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 10)
}

function isTrainingLocationComplete(loc: TrainingLocation): boolean {
  return !!(loc.location.trim() && loc.weekday.trim() && loc.start_time.trim() && loc.end_time.trim())
}

function getTrainingCardHighlightStyle(isHighlighted: boolean) {
  return isHighlighted
    ? {
        borderColor: GOLEE.accent,
        backgroundColor: GOLEE.accentSoft,
        boxShadow: `0 0 0 2px ${GOLEE.accent}`,
      }
    : {
        borderColor: GOLEE.border,
        backgroundColor: GOLEE.surfaceMuted,
      }
}

interface SettingsProps {
  embedInLayout?: boolean
}

function getCategoryDisplayAbbrev(category: Category): string {
  if (category.abbreviation?.trim()) return category.abbreviation.trim()
  const code = (category.code || '').toUpperCase()
  if (code === 'SERIE_C') return 'C'
  if (code === 'SERIE_B') return 'B'
  if (code === 'SENIOR' || code === 'SENIORES') return ''
  const short: Record<string, string> = {
    PODEROSA: 'POD',
    GUSSAGOLD: 'GUS',
    BRIXIAOLD: 'BRI',
    LEONESSE: 'LEO',
  }
  return short[code] || category.code || '—'
}

export default function Settings({ embedInLayout = false }: SettingsProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState<NewCategory>({ 
    name: '',
    abbreviation: '',
    training_locations: [{ location: '', weekday: '', start_time: '', end_time: '' }] 
  })
  const [addAnotherTrainingDismissed, setAddAnotherTrainingDismissed] = useState(false)
  const [highlightedNewTrainingIndex, setHighlightedNewTrainingIndex] = useState<number | null>(null)
  const [highlightedEditTrainingIndex, setHighlightedEditTrainingIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'categories' | 'event-types' | 'system' | 'templates' | 'permissions' | 'debug' | 'performance'>('system')
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
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ id: string; name: string } | null>(null)
  const [deleteBlockedModal, setDeleteBlockedModal] = useState<{ name: string; players: { id: string; first_name?: string; last_name?: string }[]; users: { id: string; full_name?: string }[] } | null>(null)
  const [deletingCategory, setDeletingCategory] = useState(false)

  useEffect(() => {
    loadCategories()
    loadProfessionalCategories()
    
    // Controlla se c'è un parametro tab nell'URL
    const urlParams = new URLSearchParams(window.location.search)
    const tabParam = urlParams.get('tab')
    
    if (tabParam && ['categories', 'event-types', 'system', 'templates', 'emails', 'permissions', 'debug', 'performance'].includes(tabParam)) {
      setActiveTab((tabParam === 'emails' ? 'templates' : tabParam) as 'categories' | 'event-types' | 'system' | 'templates' | 'permissions' | 'debug' | 'performance')
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
      if (!newCategory.name.trim() || !newCategory.abbreviation.trim()) {
        throw new Error('Nome e abbreviazione sono obbligatori')
      }

      const categoryCode = deriveCategoryCodeFromAbbrev(newCategory.abbreviation)
      if (!categoryCode) {
        throw new Error('Abbreviazione non valida')
      }

      // Validazione sedi di allenamento
      const validLocations = newCategory.training_locations.filter(isTrainingLocationComplete)
      
      if (validLocations.length === 0) {
        throw new Error('Devi inserire almeno una sede di allenamento completa')
      }

      // Verifica duplicati
      const nameTaken = categories.some(
        (c) => c.name.trim().toLowerCase() === newCategory.name.trim().toLowerCase()
      )
      if (nameTaken) {
        throw new Error('Esiste già una categoria con questo nome')
      }

      const abbrevTaken = categories.some((c) => {
        const norm = newCategory.abbreviation.trim().toUpperCase()
        const existingAbbrev = c.abbreviation?.trim().toUpperCase() || ''
        const existingCode = c.code?.trim().toUpperCase() || ''
        return existingAbbrev === norm || existingCode === norm
      })
      if (abbrevTaken) {
        throw new Error('Esiste già una categoria con questa abbreviazione')
      }

      const codeTaken = categories.some(
        (c) => c.code.trim().toUpperCase() === categoryCode
      )
      if (codeTaken) {
        throw new Error('Esiste già una categoria con questa abbreviazione')
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
      
      if (standardSorts[categoryCode]) {
        sortValue = standardSorts[categoryCode]
      } else {
        // Per nuove categorie, trova il valore sort più alto e aggiungi 1
        const maxSort = Math.max(...categories.map(c => c.sort), 0)
        sortValue = maxSort + 1
      }

      // Inserisci la categoria
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .insert({
          code: categoryCode,
          name: newCategory.name.trim(),
          abbreviation: newCategory.abbreviation.trim(),
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
        name: '',
        abbreviation: '',
        training_locations: [{ location: '', weekday: '', start_time: '', end_time: '' }] 
      })
      setAddAnotherTrainingDismissed(false)
      setHighlightedNewTrainingIndex(null)
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

  const requestDeleteCategory = async (category: Category) => {
    try {
      let players: { id: string; first_name?: string; last_name?: string }[] = []
      try {
        const { data } = await supabase
          .from('players')
          .select('id, first_name, last_name')
          .eq('category_id', category.id)
        players = data || []
      } catch {
        console.log('Tabella players non trovata, continuo...')
      }

      let users: { id: string; full_name?: string }[] = []
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('category_id', category.id)
        users = data || []
      } catch {
        console.log('Tabella profiles non trovata, continuo...')
      }

      if (players.length > 0 || users.length > 0) {
        setDeleteBlockedModal({ name: category.name, players, users })
        return
      }

      setDeleteConfirmModal({ id: category.id, name: category.name })
    } catch (error: any) {
      console.error('Errore nel controllo eliminazione categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    }
  }

  const confirmDeleteCategory = async () => {
    if (!deleteConfirmModal) return

    setDeletingCategory(true)
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', deleteConfirmModal.id)

      if (error) throw error

      setMessage('✅ Categoria eliminata con successo!')
      setDeleteConfirmModal(null)
      loadCategories()
    } catch (error: any) {
      console.error('Errore nell\'eliminazione categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setDeletingCategory(false)
    }
  }

  const handleInputChange = (field: keyof NewCategory, value: string) => {
    setNewCategory(prev => ({ ...prev, [field]: value }))
  }

  const handleTrainingLocationChange = (index: number, field: keyof TrainingLocation, value: string) => {
    setAddAnotherTrainingDismissed(false)
    setNewCategory(prev => ({
      ...prev,
      training_locations: prev.training_locations.map((loc, i) => 
        i === index ? { ...loc, [field]: value } : loc
      )
    }))
  }

  const addTrainingLocation = () => {
    setAddAnotherTrainingDismissed(false)
    setNewCategory(prev => {
      setHighlightedNewTrainingIndex(prev.training_locations.length)
      return {
        ...prev,
        training_locations: [...prev.training_locations, { location: '', weekday: '', start_time: '', end_time: '' }]
      }
    })
  }

  const removeTrainingLocation = (index: number) => {
    setAddAnotherTrainingDismissed(false)
    setHighlightedNewTrainingIndex((prev) => {
      if (prev === null) return null
      if (prev === index) return null
      if (prev > index) return prev - 1
      return prev
    })
    setNewCategory(prev => ({
      ...prev,
      training_locations: prev.training_locations.filter((_, i) => i !== index)
    }))
  }

  const completedTrainingCount = newCategory.training_locations.filter(isTrainingLocationComplete).length
  const lastTrainingIndex = newCategory.training_locations.length - 1
  const lastTrainingComplete = isTrainingLocationComplete(newCategory.training_locations[lastTrainingIndex] ?? { location: '', weekday: '', start_time: '', end_time: '' })
  const showAddAnotherTrainingPrompt = lastTrainingComplete && !addAnotherTrainingDismissed
  const normalizedNewName = newCategory.name.trim().toLowerCase()
  const normalizedNewAbbrev = newCategory.abbreviation.trim().toUpperCase()
  const hasDuplicateCategoryName =
    normalizedNewName !== '' &&
    categories.some((c) => c.name.trim().toLowerCase() === normalizedNewName)
  const hasDuplicateCategoryAbbrev =
    normalizedNewAbbrev !== '' &&
    categories.some((c) => {
      const existingAbbrev = c.abbreviation?.trim().toUpperCase() || ''
      const existingCode = c.code?.trim().toUpperCase() || ''
      return existingAbbrev === normalizedNewAbbrev || existingCode === normalizedNewAbbrev
    })
  const identityFieldsComplete =
    newCategory.name.trim() !== '' &&
    newCategory.abbreviation.trim() !== ''
  const trainingReady =
    completedTrainingCount >= 1 &&
    lastTrainingComplete &&
    addAnotherTrainingDismissed
  const canSubmitNewCategory =
    identityFieldsComplete &&
    trainingReady &&
    !hasDuplicateCategoryName &&
    !hasDuplicateCategoryAbbrev

  const confirmNoMoreTrainings = () => {
    setAddAnotherTrainingDismissed(true)
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
    setHighlightedEditTrainingIndex(null)
  }

  const handleEditTrainingLocationChange = (index: number, field: keyof TrainingLocation, value: string) => {
    setEditingTrainingLocations(prev => 
      prev.map((loc, i) => 
        i === index ? { ...loc, [field]: value } : loc
      )
    )
  }

  const addEditTrainingLocation = () => {
    setEditingTrainingLocations(prev => {
      setHighlightedEditTrainingIndex(prev.length)
      return [
        ...prev,
        { location: '', weekday: '', start_time: '', end_time: '' }
      ]
    })
  }

  const removeEditTrainingLocation = (index: number) => {
    setHighlightedEditTrainingIndex((prev) => {
      if (prev === null) return null
      if (prev === index) return null
      if (prev > index) return prev - 1
      return prev
    })
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
          name: editingCategoryData.name.trim(),
          abbreviation: editingCategoryData.abbreviation?.trim() || null
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
    <div className={embedInLayout ? 'min-h-full bg-gray-50 text-gray-900' : ''}>
      {!embedInLayout && <Header title="Configurazioni" showBack={true} />}
      
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
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📋 Categorie
          </button>
          <button
            onClick={() => {
              setActiveTab('event-types')
              navigate('/settings?tab=event-types', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'event-types'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📅 Tipi evento
          </button>
          <button
            onClick={() => {
              setActiveTab('system')
              navigate('/settings?tab=system', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'system'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ⚙️ Sistema
          </button>
          <button
            onClick={() => {
              setActiveTab('templates')
              navigate('/settings?tab=templates', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'templates'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📝 Template
          </button>
          <button
            onClick={() => {
              setActiveTab('permissions')
              navigate('/settings?tab=permissions', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'permissions'
                ? 'bg-white text-gray-900 shadow-sm'
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
                ? 'bg-white text-gray-900 shadow-sm'
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
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ⚡ Performance
          </button>
        </div>

        {/* Tab Categorie */}
        {activeTab === 'categories' && (
          <div className="w-full -mx-6 px-4 sm:px-6 space-y-5" style={{ backgroundColor: GOLEE.pageBg }}>
          {/* Riga superiore: Aggiungi categoria 80% + Sedi 20% fissa */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,1fr)] gap-5 items-stretch w-full">
            <div className={`${goleeCardClass} p-5 md:p-6 w-full min-w-0 h-full`} style={{ borderColor: GOLEE.border }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: GOLEE.accentSoft }}>
                  <Layers className="w-5 h-5" style={{ color: GOLEE.accent }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: GOLEE.text }}>Aggiungi Nuova Categoria</h2>
                  <p className="text-sm mt-0.5" style={{ color: GOLEE.textMuted }}>Nome, abbreviazione e orari di allenamento</p>
                </div>
              </div>
              
              <form onSubmit={handleAddCategory} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,280px)_120px] gap-4 items-end w-fit max-w-full">
                  <div>
                    <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Nome *</label>
                    <input
                      type="text"
                      required
                      value={newCategory.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={goleeInputClass}
                      style={{
                        ...goleeInputStyle,
                        borderColor: hasDuplicateCategoryName ? GOLEE.danger : GOLEE.border,
                      }}
                      placeholder="Es. Under 16, Seniores"
                    />
                    {hasDuplicateCategoryName && (
                      <p className="text-xs mt-1" style={{ color: GOLEE.danger }}>Esiste già una categoria con questo nome</p>
                    )}
                  </div>

                  <div>
                    <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Abbrev. *</label>
                    <input
                      type="text"
                      required
                      value={newCategory.abbreviation}
                      onChange={(e) => handleInputChange('abbreviation', e.target.value)}
                      className={`${goleeInputClass} text-center`}
                      style={{
                        ...goleeInputStyle,
                        borderColor: hasDuplicateCategoryAbbrev ? GOLEE.danger : GOLEE.border,
                      }}
                      placeholder="U16"
                      maxLength={20}
                    />
                    {hasDuplicateCategoryAbbrev && (
                      <p className="text-xs mt-1 text-center" style={{ color: GOLEE.danger }}>Nome o codice abbreviazione già in uso</p>
                    )}
                  </div>
                </div>

                {/* Sedi di Allenamento */}
                <div className="pt-4 border-t" style={{ borderColor: GOLEE.border }}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: GOLEE.text }}>
                    Sedi di Allenamento <span style={{ color: GOLEE.danger }}>*</span>
                  </h3>
                  <div className="space-y-3">
                    {newCategory.training_locations.map((location, index) => {
                      const isHighlightedNewTraining =
                        index === highlightedNewTrainingIndex && !isTrainingLocationComplete(location)
                      return (
                      <div key={index}>
                        <div
                          className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 p-4 rounded-xl border transition-all duration-200"
                          style={getTrainingCardHighlightStyle(isHighlightedNewTraining)}
                        >
                          <div>
                            <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Sede *</label>
                            <TrainingVenueSelect
                              required
                              scheduleOnly
                              value={location.location}
                              onChange={(value) => handleTrainingLocationChange(index, 'location', value)}
                            />
                          </div>
                          
                          <div>
                            <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Giorno *</label>
                            <select
                              required
                              value={location.weekday}
                              onChange={(e) => handleTrainingLocationChange(index, 'weekday', e.target.value)}
                              className={goleeInputClass}
                              style={goleeInputStyle}
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
                            <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Dalle *</label>
                            <input
                              type="time"
                              required
                              value={location.start_time}
                              onChange={(e) => handleTrainingLocationChange(index, 'start_time', e.target.value)}
                              className={goleeInputClass}
                              style={goleeInputStyle}
                            />
                          </div>
                          
                          <div>
                            <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Alle *</label>
                            <input
                              type="time"
                              required
                              value={location.end_time}
                              onChange={(e) => handleTrainingLocationChange(index, 'end_time', e.target.value)}
                              className={goleeInputClass}
                              style={goleeInputStyle}
                            />
                          </div>
                          
                          <div className="flex items-end">
                            {newCategory.training_locations.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTrainingLocation(index)}
                                className="w-full md:w-auto px-3 py-2.5 rounded-xl text-sm font-medium text-white whitespace-nowrap transition-opacity hover:opacity-90"
                                style={{ backgroundColor: GOLEE.danger }}
                              >
                                Rimuovi
                              </button>
                            )}
                          </div>
                        </div>

                        {index === lastTrainingIndex && showAddAnotherTrainingPrompt && (
                          <div
                            className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border"
                            style={{ backgroundColor: GOLEE.accentSoft, borderColor: GOLEE.accent }}
                          >
                            <p className="text-sm font-medium" style={{ color: GOLEE.text }}>
                              Allenamento {index + 1} completato. Vuoi aggiungere un altro allenamento?
                            </p>
                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={confirmNoMoreTrainings}
                                className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors"
                                style={{ borderColor: GOLEE.border, color: GOLEE.textMuted, backgroundColor: GOLEE.surface }}
                              >
                                No, basta così
                              </button>
                              <button
                                type="button"
                                onClick={addTrainingLocation}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                                style={{ backgroundColor: GOLEE.accent }}
                              >
                                <Plus className="w-4 h-4" />
                                Sì, aggiungi
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                </div>

                {canSubmitNewCategory && (
                  <p
                    className="text-sm font-medium px-4 py-2.5 rounded-xl border"
                    style={{ backgroundColor: GOLEE.successSoft, borderColor: GOLEE.success, color: GOLEE.success }}
                  >
                    Tutto pronto: puoi salvare la categoria.
                  </p>
                )}

                {showAddAnotherTrainingPrompt && (
                  <p className="text-sm px-4 py-2.5 rounded-xl border" style={{ backgroundColor: GOLEE.infoSoft, borderColor: GOLEE.info, color: GOLEE.text }}>
                    Conferma con <strong>No, basta così</strong> per abilitare il salvataggio.
                  </p>
                )}

                {(hasDuplicateCategoryName || hasDuplicateCategoryAbbrev) && (
                  <p className="text-sm px-4 py-2.5 rounded-xl border" style={{ backgroundColor: GOLEE.dangerSoft, borderColor: GOLEE.danger, color: GOLEE.danger }}>
                    Correggi i campi evidenziati in rosso: nome o abbreviazione già utilizzati.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !canSubmitNewCategory}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:cursor-not-allowed transition-all hover:opacity-90"
                  style={{
                    backgroundColor: canSubmitNewCategory && !loading ? GOLEE.accent : '#CBD5E1',
                  }}
                >
                  {loading ? 'Creazione in corso...' : 'Aggiungi Categoria'}
                </button>
              </form>
            </div>

            <div
              className={`${goleeCardClass} p-4 w-full h-full flex flex-col min-h-0`}
              style={{ borderColor: GOLEE.border }}
            >
              <TrainingVenuesPanel />
            </div>
          </div>

          {/* Categorie esistenti: larghezza piena pagina */}
          <div className={`${goleeCardClass} p-5 md:p-6 w-full`} style={{ borderColor: GOLEE.border }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: GOLEE.infoSoft }}>
                  <Layers className="w-5 h-5" style={{ color: GOLEE.info }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: GOLEE.text }}>Categorie Esistenti</h2>
                  <p className="text-sm mt-0.5" style={{ color: GOLEE.textMuted }}>{categories.length} categorie configurate</p>
                </div>
              </div>
              
              {categories.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed" style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}>
                  <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Nessuna categoria trovata</p>
                </div>
              ) : (
                <div className="space-y-3 w-full">
                  {/* Intestazione colonne */}
                  <div className="hidden lg:flex w-full items-center pb-1 leading-tight">
                    <div className="w-12 shrink-0" aria-hidden />
                    <div className="grid flex-1 min-w-0 grid-cols-[auto_minmax(150px,1.2fr)_1fr_1fr_1fr_auto] items-center gap-4 px-5">
                      <span className="text-[12pt] font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>Attiva</span>
                      <span className="text-[12pt] font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>Categoria</span>
                      <span className="text-[12pt] font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>Allenamento 1</span>
                      <span className="text-[12pt] font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>Allenamento 2</span>
                      <span className="text-[12pt] font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>Allenamento 3</span>
                      <span className="text-[12pt] font-semibold uppercase tracking-wide text-right" style={{ color: GOLEE.textMuted }}>Azioni</span>
                    </div>
                  </div>
                  {categories.map((category) => (
                    editingCategory === category.id ? (
                      <div
                        key={category.id}
                        className="flex flex-wrap items-center gap-3 p-4 rounded-xl border"
                        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
                      >
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className={`${goleeInputClass} max-w-xs`}
                          style={goleeInputStyle}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveCategory(category.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                          style={{ backgroundColor: GOLEE.accent }}
                        >
                          Salva
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                          style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}
                        >
                          Annulla
                        </button>
                      </div>
                    ) : (
                    <div
                      key={category.id}
                      className="group flex w-full items-stretch rounded-xl border overflow-hidden transition-shadow hover:shadow-sm leading-tight"
                      style={{
                        borderColor: category.active ? GOLEE.success : GOLEE.danger,
                      }}
                    >
                      {/* Riquadro abbreviazione categoria (stile Attività) */}
                      <div
                        className={`w-12 shrink-0 flex items-center justify-center text-[11pt] font-bold ${getCategoryCircleClass(category)}`}
                        title={category.name}
                      >
                        {getCategoryDisplayAbbrev(category) || '—'}
                      </div>

                      <div
                        className="grid flex-1 min-w-0 grid-cols-1 lg:grid-cols-[auto_minmax(150px,1.2fr)_1fr_1fr_1fr_auto] items-center gap-3 lg:gap-4 py-3 lg:py-4 px-4 lg:px-5"
                        style={{
                          backgroundColor: category.active ? GOLEE.successSoft : GOLEE.dangerSoft,
                        }}
                      >
                      {/* Colonna: attiva/disattiva */}
                      <div className="flex items-center justify-center px-1">
                        <input
                          type="checkbox"
                          checked={category.active || false}
                          onChange={() => handleToggleActive(category.id, category.active || false)}
                          className="w-4 h-4 rounded cursor-pointer accent-[#00C48C]"
                          title={category.active ? 'Disattiva categoria' : 'Attiva categoria'}
                        />
                      </div>

                      {/* Colonna: nome */}
                      <div className="min-w-0 flex items-center">
                        <span className="font-semibold text-[13.5pt] lg:text-[15pt] truncate" style={{ color: GOLEE.text }}>
                          {category.name}
                        </span>
                      </div>

                      {/* Colonne: allenamenti (3 slot fissi incolonnati) */}
                      {[0, 1, 2].map((slot) => {
                        const loc = categoryTrainingLocations[category.id]?.[slot]
                        const total = categoryTrainingLocations[category.id]?.length || 0
                        return (
                          <div key={slot} className="min-w-0">
                            {loc ? (
                              <span
                                className="inline-flex items-center gap-1.5 text-[12pt] leading-none px-2.5 py-0.5 rounded-lg border whitespace-nowrap max-w-full overflow-hidden"
                                style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border, color: GOLEE.text }}
                              >
                                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: GOLEE.accent }} />
                                <span className="font-medium">{loc.weekday}</span>
                                <span style={{ color: GOLEE.textMuted }}>{loc.location}</span>
                                <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: GOLEE.textMuted }} />
                                <span style={{ color: GOLEE.textMuted }}>{loc.start_time?.substring(0, 5)}–{loc.end_time?.substring(0, 5)}</span>
                              </span>
                            ) : slot === 0 && total === 0 ? (
                              <span className="text-[12pt] italic leading-none" style={{ color: GOLEE.textMuted }}>Nessun allenamento</span>
                            ) : null}
                          </div>
                        )
                      })}

                      {/* Colonna: azioni (visibili solo al passaggio del mouse) */}
                      <div className="flex items-center justify-end gap-2 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                        <button
                          type="button"
                          onClick={() => openEditModal(category)}
                          className="p-2 rounded-xl transition-colors border hover:opacity-90"
                          style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.info, color: GOLEE.info }}
                          title="Modifica categoria e sedi di allenamento"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteCategory(category)}
                          className="p-2 rounded-xl transition-colors border hover:opacity-90"
                          style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.danger, color: GOLEE.danger }}
                          title="Elimina categoria"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      </div>
                    </div>
                    )
                  ))}
                </div>
              )}
          </div>
          </div>
        )}

        {activeTab === 'event-types' && <EventTypesSettings />}

        {/* Tab Sistema */}
        {activeTab === 'system' && (
          <div className="space-y-8">
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-4">Impostazioni Sistema</h2>
              
              <div className="space-y-6">
                <div className="p-4 bg-sky-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sky-800 mb-2">📅 Tipi evento calendario</h3>
                    <p className="text-sm text-sky-700">
                      Configura menu Tipo Evento, flag sportivo e campi del form creazione evento.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('event-types')
                      navigate('/settings?tab=event-types', { replace: true })
                    }}
                    className="btn bg-sky-600 text-white px-4 py-2 text-sm hover:bg-sky-700 ml-4"
                  >
                    📅 Gestisci tipi
                  </button>
                </div>

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
                    onClick={() => navigate('/users-management')}
                    className="btn bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 ml-4"
                  >
                    👥 Gestisci Utenti
                  </button>
                </div>

      <div className="p-4 bg-blue-50 rounded-lg flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-blue-800 mb-2">🔐 Gestione Permessi</h3>
          <p className="text-sm text-blue-700">
            Assegna e rimuovi permessi agli utenti del sistema come amministratore.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('permissions')}
          className="btn bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 ml-4"
        >
          ⚙️ Gestisci Permessi
        </button>
      </div>

      <div className="p-4 bg-purple-50 rounded-lg flex items-center justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-purple-800 mb-2">🎭 Configurazione Ruoli</h3>
          <p className="text-sm text-purple-700">
            Modifica i permessi di default per ogni ruolo del sistema (Admin, Allenatore, etc.).
          </p>
        </div>
        <button
          onClick={() => navigate('/role-permissions')}
          className="btn bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-700 ml-4"
        >
          🎭 Gestisci Ruoli
        </button>
      </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">📊 Presenze</h3>
                  <p className="text-sm text-purple-700">
                    Sistema di tracciamento presenze per sessioni e allenamenti.
                  </p>
                </div>

                {/* Infermeria / Assicurazione */}
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-800 mb-2">🏥 Infermeria / Assicurazione</h3>
                    <p className="text-sm text-amber-700">
                      Gestione infortuni, attività di fisioterapia e comunicazioni con l'assicurazione.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/infortuni-assicurazione')}
                    className="btn bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 text-sm hover:from-amber-600 hover:to-orange-600 ml-4"
                  >
                    🏥 Gestisci
                  </button>
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

                {/* Società di rugby */}
                <div className="p-4 bg-teal-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-teal-800 mb-2">🏉 Aggiungi Società di Rugby</h3>
                    <p className="text-sm text-teal-700">
                      Gestisci l&apos;elenco delle società di rugby: serve per indicare la squadra di origine dei giocatori
                      e per selezionare le squadre quando crei eventi (partite, tornei, feste del rugby e altri eventi con una o più società).
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/clubs')}
                    className="btn bg-teal-600 text-white px-4 py-2 text-sm hover:bg-teal-700 ml-4"
                  >
                    Gestisci
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

        {/* Tab Template: tre contenitori affiancati orizzontalmente */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="lg:min-w-0">
              <MessageTemplatesManager />
            </div>
            <div className="lg:min-w-0">
              <ReceiptHeaderForm />
            </div>
            <div className="lg:min-w-0">
              <TemplatesRicevuteSection />
            </div>
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
        {showEditModal && editingCategoryData && createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-4">
            <div
              className={`rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden border ${
                editingTrainingLocations.length > 3 ? 'max-h-[96vh]' : ''
              }`}
              style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
            >
              {/* Header premium */}
              <div
                className="px-6 py-4 border-b flex items-center gap-4 shrink-0"
                style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold shrink-0 shadow-sm ${getCategoryCircleClass(editingCategoryData)}`}
                >
                  {getCategoryDisplayAbbrev(editingCategoryData) || '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold tracking-tight" style={{ color: GOLEE.text }}>
                    Modifica Categoria
                  </h3>
                  <p className="text-sm mt-0.5 truncate" style={{ color: GOLEE.textMuted }}>
                    {editingCategoryData.code} · {editingCategoryData.name}
                  </p>
                </div>
              </div>

              {/* Body: scroll solo oltre 3 allenamenti */}
              <div
                className={`px-6 py-5 space-y-5 ${
                  editingTrainingLocations.length > 3 ? 'flex-1 min-h-0 overflow-y-auto' : ''
                }`}
              >
                {/* Sezione identità */}
                <div className="rounded-2xl border p-4" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surface }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4" style={{ color: GOLEE.accent }} />
                    <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: GOLEE.text }}>
                      Identità categoria
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4">
                    <div>
                      <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Nome categoria *</label>
                      <input
                        type="text"
                        value={editingCategoryData.name}
                        onChange={(e) => setEditingCategoryData(prev => prev ? { ...prev, name: e.target.value } : null)}
                        className={goleeInputClass}
                        style={goleeInputStyle}
                        placeholder="Nome della categoria"
                      />
                    </div>
                    <div>
                      <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Abbreviazione</label>
                      <input
                        type="text"
                        value={editingCategoryData.abbreviation ?? ''}
                        onChange={(e) => setEditingCategoryData(prev => prev ? { ...prev, abbreviation: e.target.value } : null)}
                        className={`${goleeInputClass} text-center font-semibold`}
                        style={goleeInputStyle}
                        placeholder="U12"
                        maxLength={20}
                      />
                    </div>
                  </div>
                </div>

                {/* Sezione allenamenti */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" style={{ color: GOLEE.accent }} />
                      <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: GOLEE.text }}>
                        Orari di allenamento <span style={{ color: GOLEE.danger }}>*</span>
                      </h4>
                    </div>
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: GOLEE.accentSoft, color: GOLEE.accent }}
                    >
                      {editingTrainingLocations.length} {editingTrainingLocations.length === 1 ? 'sessione' : 'sessioni'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {editingTrainingLocations.map((location, index) => {
                      const isHighlightedEditTraining =
                        index === highlightedEditTrainingIndex && !isTrainingLocationComplete(location)
                      return (
                      <div
                        key={index}
                        className="rounded-xl border overflow-hidden transition-all duration-200"
                        style={getTrainingCardHighlightStyle(isHighlightedEditTraining)}
                      >
                        <div
                          className="flex items-center justify-between px-3 py-2 border-b"
                          style={{
                            borderColor: isHighlightedEditTraining ? GOLEE.accent : GOLEE.border,
                            backgroundColor: GOLEE.surface,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{
                                backgroundColor: isHighlightedEditTraining ? GOLEE.accent : GOLEE.accentSoft,
                                color: isHighlightedEditTraining ? GOLEE.surface : GOLEE.accent,
                              }}
                            >
                              {index + 1}
                            </span>
                            <span className="text-sm font-medium" style={{ color: GOLEE.text }}>
                              Allenamento {index + 1}
                            </span>
                            {isHighlightedEditTraining && (
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: GOLEE.accent, color: GOLEE.surface }}
                              >
                                Da compilare
                              </span>
                            )}
                            {!isHighlightedEditTraining && isTrainingLocationComplete(location) && (
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: GOLEE.successSoft, color: GOLEE.success }}
                              >
                                Completo
                              </span>
                            )}
                          </div>
                          {editingTrainingLocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeEditTrainingLocation(index)}
                              className="p-2 rounded-lg transition-colors hover:opacity-80"
                              style={{ color: GOLEE.danger }}
                              title="Rimuovi allenamento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3">
                          <div>
                            <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Sede *</label>
                            <TrainingVenueSelect
                              required
                              scheduleOnly
                              value={location.location}
                              onChange={(value) => handleEditTrainingLocationChange(index, 'location', value)}
                            />
                          </div>
                          <div>
                            <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Giorno *</label>
                            <select
                              required
                              value={location.weekday}
                              onChange={(e) => handleEditTrainingLocationChange(index, 'weekday', e.target.value)}
                              className={goleeInputClass}
                              style={goleeInputStyle}
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
                            <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Dalle *</label>
                            <input
                              type="time"
                              required
                              value={location.start_time}
                              onChange={(e) => handleEditTrainingLocationChange(index, 'start_time', e.target.value)}
                              className={goleeInputClass}
                              style={goleeInputStyle}
                            />
                          </div>
                          <div>
                            <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>Alle *</label>
                            <input
                              type="time"
                              required
                              value={location.end_time}
                              onChange={(e) => handleEditTrainingLocationChange(index, 'end_time', e.target.value)}
                              className={goleeInputClass}
                              style={goleeInputStyle}
                            />
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>

                  <button
                    type="button"
                    onClick={addEditTrainingLocation}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed text-sm font-semibold transition-colors hover:opacity-90"
                    style={{ borderColor: GOLEE.accent, color: GOLEE.accent, backgroundColor: GOLEE.accentSoft }}
                  >
                    <Plus className="w-4 h-4" />
                    Aggiungi allenamento
                  </button>
                </div>
              </div>

              {/* Footer fisso */}
              <div
                className="px-6 py-3.5 border-t flex gap-3 shrink-0"
                style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
              >
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-colors hover:opacity-90"
                  style={{ borderColor: GOLEE.border, color: GOLEE.text, backgroundColor: GOLEE.surface }}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={saveCategoryEdit}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 shadow-sm"
                  style={{ backgroundColor: GOLEE.accent }}
                >
                  {loading ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal conferma eliminazione categoria */}
        {deleteConfirmModal && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
            <div className="rounded-2xl shadow-2xl max-w-md w-full border overflow-hidden" style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}>
              <div className="px-6 py-5 border-b flex items-start gap-4" style={{ borderColor: GOLEE.border }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: GOLEE.dangerSoft }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: GOLEE.danger }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: GOLEE.text }}>Elimina categoria</h3>
                  <p className="text-sm mt-1" style={{ color: GOLEE.textMuted }}>Azione irreversibile</p>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-[13.5pt] leading-relaxed" style={{ color: GOLEE.text }}>
                  Sei sicuro di voler eliminare la categoria{' '}
                  <span className="font-semibold">&quot;{deleteConfirmModal.name}&quot;</span>?
                </p>
                <p className="text-sm mt-2" style={{ color: GOLEE.textMuted }}>
                  Questa azione non può essere annullata.
                </p>
              </div>
              <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmModal(null)}
                  disabled={deletingCategory}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
                  style={{ borderColor: GOLEE.border, color: GOLEE.text, backgroundColor: GOLEE.surface }}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => { void confirmDeleteCategory() }}
                  disabled={deletingCategory}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: GOLEE.danger }}
                >
                  {deletingCategory ? 'Eliminazione...' : 'Elimina'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modal impossibile eliminare categoria */}
        {deleteBlockedModal && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
            <div className="rounded-2xl shadow-2xl max-w-lg w-full border overflow-hidden max-h-[90vh] flex flex-col" style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}>
              <div className="px-6 py-5 border-b flex items-start gap-4 shrink-0" style={{ borderColor: GOLEE.border }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: GOLEE.dangerSoft }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: GOLEE.danger }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: GOLEE.text }}>Impossibile eliminare</h3>
                  <p className="text-sm mt-1" style={{ color: GOLEE.textMuted }}>
                    La categoria &quot;{deleteBlockedModal.name}&quot; è in uso
                  </p>
                </div>
              </div>
              <div className="px-6 py-5 overflow-y-auto space-y-4">
                {deleteBlockedModal.players.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2" style={{ color: GOLEE.text }}>
                      {deleteBlockedModal.players.length} giocatore/i collegati
                    </p>
                    <ul className="space-y-1">
                      {deleteBlockedModal.players.map((player) => (
                        <li key={player.id} className="text-sm px-3 py-1.5 rounded-lg" style={{ backgroundColor: GOLEE.surfaceMuted, color: GOLEE.text }}>
                          {player.first_name && player.last_name
                            ? `${player.first_name} ${player.last_name}`
                            : player.first_name || player.last_name || 'Nome non disponibile'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {deleteBlockedModal.users.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2" style={{ color: GOLEE.text }}>
                      {deleteBlockedModal.users.length} utente/i collegati
                    </p>
                    <ul className="space-y-1">
                      {deleteBlockedModal.users.map((user) => (
                        <li key={user.id} className="text-sm px-3 py-1.5 rounded-lg" style={{ backgroundColor: GOLEE.surfaceMuted, color: GOLEE.text }}>
                          {user.full_name || 'Nome non disponibile'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: GOLEE.infoSoft, color: GOLEE.text }}>
                  <p className="font-semibold mb-1">Cosa fare</p>
                  <ul className="list-disc list-inside space-y-0.5" style={{ color: GOLEE.textMuted }}>
                    <li>Sposta giocatori e utenti in un&apos;altra categoria</li>
                    <li>Oppure elimina prima i collegamenti</li>
                    <li>Poi riprova a eliminare la categoria</li>
                  </ul>
                </div>
              </div>
              <div className="px-6 py-4 border-t shrink-0" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
                <button
                  type="button"
                  onClick={() => setDeleteBlockedModal(null)}
                  className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: GOLEE.accent }}
                >
                  Ho capito
                </button>
              </div>
            </div>
          </div>,
          document.body
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


