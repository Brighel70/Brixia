import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface PlayerTabProps {
  personId: string
  onPlayerDataChange?: (playerData: any) => void
}

interface PlayerData {
  id?: string
  first_name: string
  last_name: string
  birth_date: string
  fir_code: string
  role_on_field: string
  injured: boolean
  aggregated_seniores: boolean
  categories: string[]
}

interface Role {
  id: string
  name: string
  position_order: number
}

interface Category {
  id: string
  code: string
  name: string
  sort: number
}

const PlayerTab: React.FC<PlayerTabProps> = ({ personId, onPlayerDataChange }) => {
  const [playerData, setPlayerData] = useState<PlayerData>({
    first_name: '',
    last_name: '',
    birth_date: '',
    fir_code: '',
    role_on_field: '',
    injured: false,
    aggregated_seniores: false,
    categories: []
  })
  const [roles, setRoles] = useState<Role[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadRoles()
    loadCategories()
    if (personId) {
      loadPlayerData()
    }
  }, [personId])

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('position_order')

      if (error) throw error
      setRoles(data || [])
    } catch (error) {
      console.error('Errore nel caricamento ruoli:', error)
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
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const loadPlayerData = async () => {
    if (!personId) return

    try {
      setLoading(true)
      
      // Carica i dati del giocatore
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select(`
          *,
          player_categories (
            category_id,
            categories (
              id,
              code,
              name
            )
          )
        `)
        .eq('id', personId)
        .single()

      if (playerError && playerError.code !== 'PGRST116') {
        throw playerError
      }

      if (player) {
        setPlayerData({
          id: player.id,
          first_name: player.first_name || '',
          last_name: player.last_name || '',
          birth_date: player.birth_date || '',
          fir_code: player.fir_code || '',
          role_on_field: player.role_on_field || '',
          injured: player.injured || false,
          aggregated_seniores: player.aggregated_seniores || false,
          categories: player.player_categories?.map((pc: any) => pc.category_id) || []
        })
      }
    } catch (error) {
      console.error('Errore nel caricamento dati giocatore:', error)
      setMessage('Errore nel caricamento dati giocatore')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof PlayerData, value: any) => {
    setPlayerData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    setPlayerData(prev => ({
      ...prev,
      categories: checked
        ? [...prev.categories, categoryId]
        : prev.categories.filter(id => id !== categoryId)
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage('')

      // Valida i dati obbligatori
      if (!playerData.first_name || !playerData.last_name || !playerData.birth_date) {
        setMessage('Nome, cognome e data di nascita sono obbligatori')
        return
      }

      if (personId) {
        // Aggiorna giocatore esistente
        const { error: playerError } = await supabase
          .from('players')
          .update({
            first_name: playerData.first_name,
            last_name: playerData.last_name,
            birth_date: playerData.birth_date,
            fir_code: playerData.fir_code,
            role_on_field: playerData.role_on_field,
            injured: playerData.injured,
            aggregated_seniores: playerData.aggregated_seniores
          })
          .eq('id', personId)

        if (playerError) throw playerError

        // Aggiorna le categorie
        if (playerData.categories.length > 0) {
          // Rimuovi categorie esistenti
          await supabase
            .from('player_categories')
            .delete()
            .eq('player_id', personId)

          // Aggiungi nuove categorie
          const categoryInserts = playerData.categories.map(categoryId => ({
            player_id: personId,
            category_id: categoryId
          }))

          const { error: categoriesError } = await supabase
            .from('player_categories')
            .insert(categoryInserts)

          if (categoriesError) throw categoriesError
        }

        setMessage('✅ Dati giocatore aggiornati con successo!')
      } else {
        // Crea nuovo giocatore
        const { data: newPlayer, error: playerError } = await supabase
          .from('players')
          .insert({
            first_name: playerData.first_name,
            last_name: playerData.last_name,
            birth_date: playerData.birth_date,
            fir_code: playerData.fir_code,
            role_on_field: playerData.role_on_field,
            injured: playerData.injured,
            aggregated_seniores: playerData.aggregated_seniores
          })
          .select()
          .single()

        if (playerError) throw playerError

        // Aggiungi le categorie
        if (newPlayer && playerData.categories.length > 0) {
          const categoryInserts = playerData.categories.map(categoryId => ({
            player_id: newPlayer.id,
            category_id: categoryId
          }))

          const { error: categoriesError } = await supabase
            .from('player_categories')
            .insert(categoryInserts)

          if (categoriesError) throw categoriesError
        }

        setMessage('✅ Giocatore creato con successo!')
        onPlayerDataChange?.(newPlayer)
      }
    } catch (error: any) {
      console.error('Errore nel salvataggio giocatore:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Caricamento dati giocatore...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">🏉 Dati Giocatore</h3>
        <p className="text-sm text-blue-700">
          Gestisci le informazioni specifiche del giocatore, inclusi ruolo in campo, categorie e stato infortunio.
        </p>
      </div>

      {/* Informazioni Base */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nome *
          </label>
          <input
            type="text"
            value={playerData.first_name}
            onChange={(e) => handleInputChange('first_name', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Nome del giocatore"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cognome *
          </label>
          <input
            type="text"
            value={playerData.last_name}
            onChange={(e) => handleInputChange('last_name', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Cognome del giocatore"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Data di Nascita *
          </label>
          <input
            type="date"
            value={playerData.birth_date}
            onChange={(e) => handleInputChange('birth_date', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Codice FIR
          </label>
          <input
            type="text"
            value={playerData.fir_code}
            onChange={(e) => handleInputChange('fir_code', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Codice FIR del giocatore"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ruolo in Campo
          </label>
          <select
            value={playerData.role_on_field}
            onChange={(e) => handleInputChange('role_on_field', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Seleziona ruolo</option>
            {roles.map(role => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stato Giocatore */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-800">Stato Giocatore</h4>
        
        <div className="flex items-center space-x-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={playerData.injured}
              onChange={(e) => handleInputChange('injured', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Infortunato</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={playerData.aggregated_seniores}
              onChange={(e) => handleInputChange('aggregated_seniores', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Aggregato Seniores</span>
          </label>
        </div>
      </div>

      {/* Categorie */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-800">Categorie</h4>
        <p className="text-sm text-gray-600">Seleziona le categorie a cui appartiene il giocatore</p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map(category => (
            <label key={category.id} className="flex items-center">
              <input
                type="checkbox"
                checked={playerData.categories.includes(category.id)}
                onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">
                {category.name} ({category.code})
              </span>
            </label>
          ))}
        </div>
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

      {/* Pulsanti */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Salvataggio...
            </>
          ) : (
            '💾 Salva Dati Giocatore'
          )}
        </button>
      </div>
    </div>
  )
}

export default PlayerTab


