import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Player {
  id: string
  first_name: string
  last_name: string
  birth_date: string
  fir_code: string
  injured: boolean
  aggregated_seniores: boolean
  categories: string[]
}

interface Category {
  id: string
  code: string
  name: string
  active: boolean
  sort: number
}

interface PlayerCategoryAssignmentProps {
  categoryId: string
  onClose: () => void
}

const PlayerCategoryAssignment: React.FC<PlayerCategoryAssignmentProps> = ({ categoryId, onClose }) => {
  const [players, setPlayers] = useState<Player[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterInjured, setFilterInjured] = useState(false)
  const [filterAggregated, setFilterAggregated] = useState(false)

  useEffect(() => {
    if (categoryId) {
      loadData()
    }
  }, [categoryId])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadPlayers(),
        loadCategories()
      ])
    } catch (error) {
      console.error('Errore nel caricamento dati:', error)
      setMessage('Errore nel caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select(`
          *,
          player_categories (
            category_id
          )
        `)
        .order('last_name, first_name')

      if (error) throw error

      const playersWithCategories = data?.map(player => ({
        ...player,
        categories: player.player_categories?.map((pc: any) => pc.category_id) || []
      })) || []

      setPlayers(playersWithCategories)
    } catch (error) {
      console.error('Errore nel caricamento giocatori:', error)
      throw error
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('sort')

      if (error) throw error

      setCategories(data || [])
      
      // Trova la categoria selezionata
      const category = data?.find(c => c.id === categoryId)
      setSelectedCategory(category || null)
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
      throw error
    }
  }

  const handleCategoryToggle = async (playerId: string, categoryId: string, isAssigned: boolean) => {
    try {
      setSaving(true)
      setMessage('')

      if (isAssigned) {
        // Rimuovi associazione
        const { error } = await supabase
          .from('player_categories')
          .delete()
          .eq('player_id', playerId)
          .eq('category_id', categoryId)

        if (error) throw error

        // Aggiorna stato locale
        setPlayers(prev => prev.map(player => 
          player.id === playerId 
            ? { ...player, categories: player.categories.filter(id => id !== categoryId) }
            : player
        ))
      } else {
        // Aggiungi associazione
        const { error } = await supabase
          .from('player_categories')
          .insert({
            player_id: playerId,
            category_id: categoryId
          })

        if (error) throw error

        // Aggiorna stato locale
        setPlayers(prev => prev.map(player => 
          player.id === playerId 
            ? { ...player, categories: [...player.categories, categoryId] }
            : player
        ))
      }

      setMessage('✅ Associazione aggiornata con successo!')
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento associazione:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleBulkAssign = async (playerIds: string[], categoryId: string, assign: boolean) => {
    try {
      setSaving(true)
      setMessage('')

      if (assign) {
        // Aggiungi associazioni
        const associations = playerIds.map(playerId => ({
          player_id: playerId,
          category_id: categoryId
        }))

        const { error } = await supabase
          .from('player_categories')
          .insert(associations)

        if (error) throw error

        // Aggiorna stato locale
        setPlayers(prev => prev.map(player => 
          playerIds.includes(player.id)
            ? { ...player, categories: [...player.categories, categoryId] }
            : player
        ))
      } else {
        // Rimuovi associazioni
        const { error } = await supabase
          .from('player_categories')
          .delete()
          .in('player_id', playerIds)
          .eq('category_id', categoryId)

        if (error) throw error

        // Aggiorna stato locale
        setPlayers(prev => prev.map(player => 
          playerIds.includes(player.id)
            ? { ...player, categories: player.categories.filter(id => id !== categoryId) }
            : player
        ))
      }

      setMessage(`✅ ${playerIds.length} giocatori ${assign ? 'assegnati' : 'rimossi'} con successo!`)
    } catch (error: any) {
      console.error('Errore nell\'assegnazione bulk:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const filteredPlayers = players.filter(player => {
    const matchesSearch = searchTerm === '' || 
      player.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.fir_code.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesInjured = !filterInjured || player.injured
    const matchesAggregated = !filterAggregated || player.aggregated_seniores

    return matchesSearch && matchesInjured && matchesAggregated
  })

  const playersInCategory = filteredPlayers.filter(player => 
    player.categories.includes(categoryId)
  )

  const playersNotInCategory = filteredPlayers.filter(player => 
    !player.categories.includes(categoryId)
  )

  const calculateAge = (birthDate: string) => {
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    
    return age
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Caricamento giocatori...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Gestione Giocatori - {selectedCategory?.name}
          </h2>
          <p className="text-gray-600">
            Assegna o rimuovi giocatori dalla categoria {selectedCategory?.code}
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          ✕ Chiudi
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

      {/* Filtri */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cerca giocatore
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome, cognome o codice FIR..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filterInjured}
                onChange={(e) => setFilterInjured(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Solo infortunati</span>
            </label>
          </div>
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filterAggregated}
                onChange={(e) => setFilterAggregated(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Solo aggregati</span>
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleBulkAssign(
                playersNotInCategory.map(p => p.id), 
                categoryId, 
                true
              )}
              disabled={saving || playersNotInCategory.length === 0}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Assegna Tutti
            </button>
            <button
              onClick={() => handleBulkAssign(
                playersInCategory.map(p => p.id), 
                categoryId, 
                false
              )}
              disabled={saving || playersInCategory.length === 0}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              Rimuovi Tutti
            </button>
          </div>
        </div>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{playersInCategory.length}</div>
          <div className="text-sm text-blue-700">Giocatori in categoria</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-600">{playersNotInCategory.length}</div>
          <div className="text-sm text-gray-700">Giocatori disponibili</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{filteredPlayers.length}</div>
          <div className="text-sm text-green-700">Totale filtrati</div>
        </div>
      </div>

      {/* Lista Giocatori */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Giocatori in categoria */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Giocatori in Categoria ({playersInCategory.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {playersInCategory.map(player => (
              <div key={player.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {player.first_name} {player.last_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {player.fir_code} • {calculateAge(player.birth_date)} anni
                    {player.injured && <span className="ml-2 text-red-600">🏥 Infortunato</span>}
                    {player.aggregated_seniores && <span className="ml-2 text-blue-600">⭐ Aggregato</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleCategoryToggle(player.id, categoryId, true)}
                  disabled={saving}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  Rimuovi
                </button>
              </div>
            ))}
            {playersInCategory.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">⚽</div>
                <p>Nessun giocatore in questa categoria</p>
              </div>
            )}
          </div>
        </div>

        {/* Giocatori disponibili */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Giocatori Disponibili ({playersNotInCategory.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {playersNotInCategory.map(player => (
              <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {player.first_name} {player.last_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {player.fir_code} • {calculateAge(player.birth_date)} anni
                    {player.injured && <span className="ml-2 text-red-600">🏥 Infortunato</span>}
                    {player.aggregated_seniores && <span className="ml-2 text-blue-600">⭐ Aggregato</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleCategoryToggle(player.id, categoryId, false)}
                  disabled={saving}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Assegna
                </button>
              </div>
            ))}
            {playersNotInCategory.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">👥</div>
                <p>Nessun giocatore disponibile</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlayerCategoryAssignment

