import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import PlayerCategoryAssignment from './PlayerCategoryAssignment'
import TrainingLocationsManager from './TrainingLocationsManager'

interface Category {
  id: string
  code: string
  name: string
  active: boolean
  sort: number
  created_at: string
  updated_at: string
  player_count?: number
  staff_count?: number
}

interface TrainingLocation {
  id: string
  category_id: string
  location: string
  weekday: string
  start_time: string
  end_time: string
}

interface Player {
  id: string
  first_name: string
  last_name: string
  birth_date: string
  fir_code: string
  injured: boolean
  aggregated_seniores: boolean
}

interface Staff {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
}

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [trainingLocations, setTrainingLocations] = useState<Record<string, TrainingLocation[]>>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'players' | 'staff' | 'locations'>('overview')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [showPlayerAssignment, setShowPlayerAssignment] = useState(false)
  const [showTrainingLocations, setShowTrainingLocations] = useState(false)
  const [newCategory, setNewCategory] = useState({
    code: '',
    name: '',
    sort: 999
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadCategories(),
        loadPlayers(),
        loadStaff(),
        loadTrainingLocations()
      ])
    } catch (error) {
      console.error('Errore nel caricamento dati:', error)
      setMessage('Errore nel caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select(`
          *,
          player_categories(count),
          staff_categories(count)
        `)
        .order('sort')

      if (error) throw error

      const categoriesWithCounts = data?.map(cat => ({
        ...cat,
        player_count: cat.player_categories?.[0]?.count || 0,
        staff_count: cat.staff_categories?.[0]?.count || 0
      })) || []

      setCategories(categoriesWithCounts)
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
      throw error
    }
  }

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, first_name, last_name, birth_date, fir_code, injured, aggregated_seniores')
        .order('last_name, first_name')

      if (error) throw error
      setPlayers(data || [])
    } catch (error) {
      console.error('Errore nel caricamento giocatori:', error)
      throw error
    }
  }

  const loadStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .order('last_name, first_name')

      if (error) throw error
      setStaff(data || [])
    } catch (error) {
      console.error('Errore nel caricamento staff:', error)
      throw error
    }
  }

  const loadTrainingLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('training_locations')
        .select('*')
        .order('category_id, weekday, start_time')

      if (error) throw error

      const locationsByCategory = data?.reduce((acc, location) => {
        if (!acc[location.category_id]) {
          acc[location.category_id] = []
        }
        acc[location.category_id].push(location)
        return acc
      }, {} as Record<string, TrainingLocation[]>) || {}

      setTrainingLocations(locationsByCategory)
    } catch (error) {
      console.error('Errore nel caricamento sedi allenamento:', error)
      throw error
    }
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategory.code.trim() || !newCategory.name.trim()) {
      setMessage('❌ Codice e nome sono obbligatori')
      return
    }

    try {
      setLoading(true)
      setMessage('')

      // Verifica che il codice non esista già
      const existingCategory = categories.find(c => c.code === newCategory.code.toUpperCase())
      if (existingCategory) {
        setMessage('❌ Una categoria con questo codice esiste già')
        return
      }

      const { data, error } = await supabase
        .from('categories')
        .insert({
          code: newCategory.code.toUpperCase(),
          name: newCategory.name.trim(),
          sort: newCategory.sort,
          active: true
        })
        .select()

      if (error) throw error

      setMessage('✅ Categoria creata con successo!')
      setNewCategory({ code: '', name: '', sort: 999 })
      setShowCreateModal(false)
      loadCategories()
    } catch (error: any) {
      console.error('Errore nella creazione categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setShowEditModal(true)
  }

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory) return

    try {
      setLoading(true)
      setMessage('')

      const { error } = await supabase
        .from('categories')
        .update({
          code: editingCategory.code.toUpperCase(),
          name: editingCategory.name.trim(),
          sort: editingCategory.sort
        })
        .eq('id', editingCategory.id)

      if (error) throw error

      setMessage('✅ Categoria aggiornata con successo!')
      setShowEditModal(false)
      setEditingCategory(null)
      loadCategories()
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (categoryId: string, currentActive: boolean) => {
    try {
      setLoading(true)
      setMessage('')

      const { error } = await supabase
        .from('categories')
        .update({ active: !currentActive })
        .eq('id', categoryId)

      if (error) throw error

      setMessage(`✅ Categoria ${!currentActive ? 'attivata' : 'disattivata'} con successo!`)
      loadCategories()
    } catch (error: any) {
      console.error('Errore nel cambio stato categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa categoria? Questa azione non può essere annullata.')) {
      return
    }

    try {
      setLoading(true)
      setMessage('')

      // Prima rimuovi le associazioni
      await supabase
        .from('player_categories')
        .delete()
        .eq('category_id', categoryId)

      await supabase
        .from('staff_categories')
        .delete()
        .eq('category_id', categoryId)

      await supabase
        .from('training_locations')
        .delete()
        .eq('category_id', categoryId)

      // Poi elimina la categoria
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error

      setMessage('✅ Categoria eliminata con successo!')
      loadCategories()
    } catch (error: any) {
      console.error('Errore nell\'eliminazione categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getPlayersInCategory = (categoryId: string) => {
    // Questa funzione dovrebbe caricare i giocatori per categoria
    // Per ora restituiamo un array vuoto
    return []
  }

  const getStaffInCategory = (categoryId: string) => {
    // Questa funzione dovrebbe caricare lo staff per categoria
    // Per ora restituiamo un array vuoto
    return []
  }

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Caricamento categorie...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestione Categorie</h2>
          <p className="text-gray-600">Gestisci le categorie sportive e le loro associazioni</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
        >
          ➕ Nuova Categoria
        </button>
      </div>

      {/* Messaggio */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.startsWith('✅') 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Panoramica', icon: '📊' },
            { id: 'players', name: 'Giocatori', icon: '⚽' },
            { id: 'staff', name: 'Staff', icon: '👥' },
            { id: 'locations', name: 'Sedi Allenamento', icon: '🏟️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map(category => (
              <div key={category.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {category.name} ({category.code})
                    </h3>
                    <p className="text-sm text-gray-500">
                      Ordine: {category.sort}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      category.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {category.active ? 'Attiva' : 'Disattiva'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{category.player_count || 0}</div>
                    <div className="text-sm text-gray-500">Giocatori</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{category.staff_count || 0}</div>
                    <div className="text-sm text-gray-500">Staff</div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setSelectedCategory(category.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Dettagli →
                  </button>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="text-gray-600 hover:text-gray-800"
                      title="Modifica"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleToggleActive(category.id, category.active)}
                      className={category.active ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}
                      title={category.active ? "Disattiva" : "Attiva"}
                    >
                      {category.active ? "⏸️" : "▶️"}
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'players' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Gestione Giocatori per Categoria</h3>
            <p className="text-gray-600 mb-6">Seleziona una categoria per gestire i giocatori associati</p>
            
            {selectedCategory ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-md font-semibold text-gray-800">
                    Gestione Giocatori - {categories.find(c => c.id === selectedCategory)?.name}
                  </h4>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                  >
                    ← Torna alla lista
                  </button>
                </div>
                <PlayerCategoryAssignment
                  categoryId={selectedCategory}
                  onClose={() => setSelectedCategory(null)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className="p-4 border rounded-lg text-left hover:bg-gray-50 border-gray-200"
                  >
                    <div className="font-medium text-gray-900">{category.name}</div>
                    <div className="text-sm text-gray-500">{category.player_count || 0} giocatori</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Gestione Staff per Categoria</h3>
            <p className="text-gray-600 mb-6">Seleziona una categoria per gestire lo staff associato</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`p-4 border rounded-lg text-left hover:bg-gray-50 ${
                    selectedCategory === category.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="font-medium text-gray-900">{category.name}</div>
                  <div className="text-sm text-gray-500">{category.staff_count || 0} membri staff</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sedi di Allenamento</h3>
            <p className="text-gray-600 mb-6">Gestisci le sedi di allenamento per ogni categoria</p>
            
            {selectedCategory ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-md font-semibold text-gray-800">
                    Sedi di Allenamento - {categories.find(c => c.id === selectedCategory)?.name}
                  </h4>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                  >
                    ← Torna alla lista
                  </button>
                </div>
                <TrainingLocationsManager
                  categoryId={selectedCategory}
                  onClose={() => setSelectedCategory(null)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map(category => (
                  <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-gray-900">{category.name}</h4>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">
                          {trainingLocations[category.id]?.length || 0} sedi
                        </span>
                        <button
                          onClick={() => setSelectedCategory(category.id)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Gestisci
                        </button>
                      </div>
                    </div>
                    
                    {trainingLocations[category.id]?.length > 0 ? (
                      <div className="space-y-2">
                        {trainingLocations[category.id].slice(0, 3).map(location => (
                          <div key={location.id} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {location.location} - {location.weekday} {location.start_time}-{location.end_time}
                          </div>
                        ))}
                        {trainingLocations[category.id].length > 3 && (
                          <div className="text-sm text-gray-500">
                            ... e altre {trainingLocations[category.id].length - 3} sedi
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nessuna sede di allenamento configurata</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modali */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nuova Categoria</h3>
            <form onSubmit={handleCreateCategory}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Codice *
                  </label>
                  <input
                    type="text"
                    value={newCategory.code}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="es. U14, U16, SENIORES"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="es. Under 14, Under 16, Seniores"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ordine
                  </label>
                  <input
                    type="number"
                    value={newCategory.sort}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, sort: parseInt(e.target.value) || 999 }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creazione...' : 'Crea Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Modifica Categoria</h3>
            <form onSubmit={handleUpdateCategory}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Codice *
                  </label>
                  <input
                    type="text"
                    value={editingCategory.code}
                    onChange={(e) => setEditingCategory(prev => prev ? { ...prev, code: e.target.value } : null)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ordine
                  </label>
                  <input
                    type="number"
                    value={editingCategory.sort}
                    onChange={(e) => setEditingCategory(prev => prev ? { ...prev, sort: parseInt(e.target.value) || 999 } : null)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Aggiornamento...' : 'Aggiorna Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CategoryManagement
