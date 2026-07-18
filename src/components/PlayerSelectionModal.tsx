import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

interface Player {
  id: string
  given_name: string
  family_name: string
  player_categories: string[]
  date_of_birth: string
  /** Nomi categorie dalla tabella player_categories (fonte di verità), così il modale mostra le stesse categorie della scheda giocatore */
  categoryNames?: string[]
}

interface PlayerSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedPlayerIds: string[]) => void
  excludePlayerIds?: string[] // Giocatori da escludere (già collegati)
  /** Se true, mostra solo giocatori fino a 19 anni compresi (età ≤ 19) - usato per abbinamento tutor */
  minorsOnly?: boolean
  /** Id già selezionati all'apertura (es. per modifica tutor) */
  initialSelectedIds?: string[]
  /** Titolo/descrizione personalizzati (es. per tutor) */
  title?: string
  description?: string
}

export default function PlayerSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  excludePlayerIds = [],
  minorsOnly = false,
  initialSelectedIds = [],
  title,
  description
}: PlayerSelectionModalProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoriesById, setCategoriesById] = useState<Record<string, { name: string; code?: string }>>({})

  useEffect(() => {
    if (isOpen) {
      loadPlayers()
      setSelectedPlayerIds(initialSelectedIds?.length ? [...initialSelectedIds] : [])
      setSearchTerm('')
    }
  }, [isOpen, initialSelectedIds?.join(',')])

  const loadPlayers = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name, code')
      const catMap: Record<string, { name: string; code?: string }> = {}
      ;(categoriesData || []).forEach((c: { id: string; name: string; code?: string }) => {
        catMap[c.id] = { name: c.name || '', code: c.code }
      })
      setCategoriesById(catMap)

      const { data: peopleData, error } = await supabase
        .from('people')
        .select('id, given_name, family_name, player_categories, date_of_birth')
        .eq('is_player', true)
        .order('family_name', { ascending: true })

      if (error) throw error

      let filtered = (peopleData || []).filter(p => !excludePlayerIds.includes(p.id))
      if (minorsOnly) {
        const today = new Date()
        const cutoff = new Date(today.getFullYear() - 19, today.getMonth(), today.getDate())
        filtered = filtered.filter(p => p.date_of_birth && new Date(p.date_of_birth) >= cutoff)
      }

      const personIds = filtered.map(p => p.id)

      const { data: playersData } = await supabase
        .from('players')
        .select('id, person_id')
        .in('person_id', personIds)

      const playerIds = (playersData || []).map((p: { id: string }) => p.id)
      const personIdByPlayerId = Object.fromEntries((playersData || []).map((p: { id: string; person_id: string }) => [p.id, p.person_id]))

      let personIdToCategoryNames: Record<string, string[]> = {}
      if (playerIds.length > 0) {
        const { data: assocData } = await supabase
          .from('player_categories')
          .select(`
            player_id,
            category_id,
            categories ( id, name, code )
          `)
          .in('player_id', playerIds)

        personIdToCategoryNames = {}
        ;(assocData || []).forEach((row: { player_id: string; category_id: string; categories?: { id: string; name: string; code?: string } }) => {
          const personId = personIdByPlayerId[row.player_id]
          if (!personId) return
          if (!personIdToCategoryNames[personId]) personIdToCategoryNames[personId] = []
          const name = row.categories?.name || catMap[row.category_id]?.name || row.category_id
          if (name) personIdToCategoryNames[personId].push(name)
        })
      }

      const result: Player[] = filtered.map((p: { id: string; given_name: string; family_name: string; player_categories?: string[]; date_of_birth: string }) => {
        const fromJunction = personIdToCategoryNames[p.id] || []
        const fromPeople = (p.player_categories || []).map((id: string) => catMap[id]?.name || id).filter(Boolean)
        const categoryNames = fromJunction.length > 0 ? fromJunction : fromPeople
        return {
          id: p.id,
          given_name: p.given_name || '',
          family_name: p.family_name || '',
          player_categories: p.player_categories || [],
          date_of_birth: p.date_of_birth || '',
          categoryNames
        }
      })
      setPlayers(result)
    } catch (err) {
      console.error('Errore caricamento giocatori:', err)
      setError('Errore nel caricamento dei giocatori')
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId)
      } else {
        return [...prev, playerId]
      }
    })
  }

  const handleConfirm = () => {
    if (selectedPlayerIds.length === 0 && !minorsOnly) {
      setError('Devi selezionare almeno un giocatore')
      return
    }
    onConfirm(selectedPlayerIds)
  }

  const handleClose = () => {
    setSelectedPlayerIds([])
    setSearchTerm('')
    setError(null)
    onClose()
  }

  const filteredPlayers = players.filter(player => {
    const fullName = `${(player as Player).given_name || ''} ${(player as Player).family_name || ''}`.toLowerCase()
    return fullName.includes(searchTerm.toLowerCase())
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {title || 'Seleziona Giocatori'}
          </h2>
          <p className="text-sm text-gray-700 mt-1">
            {description || (minorsOnly ? 'Seleziona uno o più giocatori (fino a 19 anni compresi) da abbinare come tutor' : 'Seleziona uno o più giocatori da collegare al familiare')}
          </p>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Cerca giocatore per nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Players List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-500">Caricamento giocatori...</p>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Nessun giocatore trovato</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlayers.map(player => {
                const categoryNames = (player.categoryNames && player.categoryNames.length > 0)
                  ? player.categoryNames.join(', ')
                  : (player.player_categories || []).map((id: string) => categoriesById[id]?.name || id).filter(Boolean).join(', ')
                const age = player.date_of_birth 
                  ? new Date().getFullYear() - new Date(player.date_of_birth).getFullYear()
                  : ''

                return (
                  <label
                    key={player.id}
                    className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedPlayerIds.includes(player.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={() => handleTogglePlayer(player.id)}
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-medium text-gray-900">
                        {player.given_name} {player.family_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {categoryNames && <span className="font-medium">{categoryNames}</span>}
                        {age && <span className="ml-2">• {age} anni</span>}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {selectedPlayerIds.length} giocator{selectedPlayerIds.length === 1 ? 'e' : 'i'} selezionat{selectedPlayerIds.length === 1 ? 'o' : 'i'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={handleConfirm}
              disabled={!minorsOnly && selectedPlayerIds.length === 0}
              className={`px-4 py-2 text-white rounded-md transition-colors ${
                (!minorsOnly && selectedPlayerIds.length === 0)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Conferma
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
