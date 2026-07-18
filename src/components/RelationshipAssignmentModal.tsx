import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

interface Player {
  id: string
  given_name: string
  family_name: string
  player_categories: string[]
}

interface RelationshipAssignment {
  playerId: string
  relationshipType: string
}

interface RelationshipAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (assignments: RelationshipAssignment[]) => void
  selectedPlayerIds: string[]
}

const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'Seleziona parentela...' },
  { value: 'padre', label: 'Padre' },
  { value: 'madre', label: 'Madre' },
  { value: 'nonno', label: 'Nonno' },
  { value: 'nonna', label: 'Nonna' },
  { value: 'zio', label: 'Zio' },
  { value: 'zia', label: 'Zia' },
  { value: 'tutore', label: 'Tutore' }
]

export default function RelationshipAssignmentModal({
  isOpen,
  onClose,
  onConfirm,
  selectedPlayerIds
}: RelationshipAssignmentModalProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [assignments, setAssignments] = useState<{ [playerId: string]: string }>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoriesById, setCategoriesById] = useState<Record<string, { name: string; code?: string }>>({})

  const getCategoryLabel = (categoryId: string): string => {
    const cat = categoriesById[categoryId]
    return cat ? (cat.code || cat.name || categoryId) : categoryId
  }

  useEffect(() => {
    if (isOpen && selectedPlayerIds.length > 0) {
      loadCategories() // carica categorie dal DB per mostrare code/nome al posto degli UUID
      loadPlayerDetails()
      const initialAssignments: { [key: string]: string } = {}
      selectedPlayerIds.forEach(id => {
        initialAssignments[id] = ''
      })
      setAssignments(initialAssignments)
    }
  }, [isOpen, selectedPlayerIds])

  const loadCategories = async () => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('id, name, code')
      const map: Record<string, { name: string; code?: string }> = {}
      ;(data || []).forEach((c: { id: string; name?: string; code?: string }) => {
        map[c.id] = { name: c.name || '', code: c.code }
      })
      setCategoriesById(map)
    } catch (err) {
      console.error('Errore caricamento categorie:', err)
    }
  }

  const loadPlayerDetails = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('people')
        .select('id, given_name, family_name, player_categories')
        .in('id', selectedPlayerIds)

      if (error) throw error
      setPlayers(data || [])
    } catch (err) {
      console.error('Errore caricamento dettagli giocatori:', err)
      setError('Errore nel caricamento dei dettagli dei giocatori')
    } finally {
      setLoading(false)
    }
  }

  const handleRelationshipChange = (playerId: string, relationshipType: string) => {
    setAssignments(prev => ({
      ...prev,
      [playerId]: relationshipType
    }))
    // Rimuovi l'errore quando l'utente inizia a selezionare
    if (error) setError(null)
  }

  const handleConfirm = () => {
    // Valida che tutte le parentele siano state assegnate
    const missingAssignments = selectedPlayerIds.filter(id => !assignments[id] || assignments[id] === '')
    
    if (missingAssignments.length > 0) {
      setError('Assegna una parentela a tutti i giocatori selezionati')
      return
    }

    // Crea l'array di assignments
    const assignmentsList: RelationshipAssignment[] = selectedPlayerIds.map(playerId => ({
      playerId,
      relationshipType: assignments[playerId]
    }))

    onConfirm(assignmentsList)
  }

  const handleClose = () => {
    setAssignments({})
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Assegna Parentele
          </h2>
          <p className="text-sm text-gray-700 mt-1">
            Seleziona il tipo di parentela per ogni giocatore
          </p>
        </div>

        {/* Players List with Relationship Dropdowns */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-700">Caricamento...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {players.map(player => {
                const categories = player.player_categories || []
                const categoryLabels = categories.map(getCategoryLabel).join(', ')
                const hasError = error && (!assignments[player.id] || assignments[player.id] === '')

                return (
                  <div
                    key={player.id}
                    className={`p-4 rounded-lg border-2 ${
                      hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">
                          {player.given_name} {player.family_name}
                        </div>
                        {categoryLabels && (
                          <div className="text-sm font-medium text-gray-700 mt-1">
                            Categoria: <span className="text-blue-700">{categoryLabels}</span>
                          </div>
                        )}
                      </div>
                      <div className="w-48 flex-shrink-0">
                        <select
                          value={assignments[player.id] || ''}
                          onChange={(e) => handleRelationshipChange(player.id, e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            hasError
                              ? 'border-red-300'
                              : 'border-gray-300'
                          }`}
                        >
                          {RELATIONSHIP_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
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
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-800 font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-white font-medium bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  )
}

