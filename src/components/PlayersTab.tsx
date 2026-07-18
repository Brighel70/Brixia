import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import PlayerSelectionModal from './PlayerSelectionModal'

interface Player {
  id: string
  given_name: string
  family_name: string
  categories?: { name: string }[]
  relationship_type: string
}

interface PlayersTabProps {
  familyId: string
  isEditing: boolean
}

export default function PlayersTab({ familyId, isEditing }: PlayersTabProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [showPlayerModal, setShowPlayerModal] = useState(false)

  useEffect(() => {
    if (familyId) {
      loadFamilyPlayers()
    }
  }, [familyId])

  const loadFamilyPlayers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('family_player_relations')
        .select(`
          id,
          relationship_type,
          player_id,
          people!family_player_relations_player_id_fkey (
            id,
            given_name,
            family_name,
            player_categories
          )
        `)
        .eq('family_id', familyId)

      if (error) throw error

      // Get category names for each player
      const playersWithCategories = await Promise.all(
        (data || []).map(async (relation) => {
          const player = relation.people
          let categories = []
          
          if (player.player_categories && Array.isArray(player.player_categories)) {
            const { data: categoryData } = await supabase
              .from('categories')
              .select('name')
              .in('id', player.player_categories)
            categories = categoryData || []
          }

          return {
            id: player.id,
            given_name: player.given_name,
            family_name: player.family_name,
            categories,
            relationship_type: relation.relationship_type
          }
        })
      )

      setPlayers(playersWithCategories)
    } catch (error) {
      console.error('Errore nel caricamento giocatori del familiare:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPlayers = async (selectedPlayerIds: string[]) => {
    try {
      // Create relationships for each selected player
      const relationships = selectedPlayerIds.map(playerId => ({
        family_id: familyId,
        player_id: playerId,
        relationship_type: 'parent' // Default relationship type
      }))

      const { error } = await supabase
        .from('family_player_relations')
        .insert(relationships)

      if (error) throw error

      // Reload players
      await loadFamilyPlayers()
    } catch (error) {
      console.error('Errore nell\'aggiunta giocatori:', error)
      alert('Errore nell\'aggiunta dei giocatori')
    }
  }

  const handleRemovePlayer = async (playerId: string) => {
    if (!confirm('Sei sicuro di voler rimuovere questo giocatore?')) return

    try {
      const { error } = await supabase
        .from('family_player_relations')
        .delete()
        .eq('family_id', familyId)
        .eq('player_id', playerId)

      if (error) throw error

      // Reload players
      await loadFamilyPlayers()
    } catch (error) {
      console.error('Errore nella rimozione giocatore:', error)
      alert('Errore nella rimozione del giocatore')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">
          Giocatori Collegati ({players.length})
        </h3>
        {isEditing && (
          <button
            onClick={() => setShowPlayerModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Collega Giocatori
          </button>
        )}
      </div>

      {/* Players List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Caricamento giocatori...</p>
        </div>
      ) : players.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <div className="text-gray-400 text-4xl mb-2">👥</div>
          <p className="text-gray-600">Nessun giocatore collegato</p>
          {isEditing && (
            <p className="text-sm text-gray-500 mt-1">
              Clicca su "Collega Giocatori" per aggiungere giocatori
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {players.map(player => (
            <div
              key={player.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white"
            >
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {player.family_name} {player.given_name}
                </div>
                {player.categories && player.categories.length > 0 && (
                  <div className="text-sm text-gray-600 mt-1">
                    Categorie: {player.categories.map(cat => cat.name).join(', ')}
                  </div>
                )}
                <div className="text-sm text-blue-600 mt-1">
                  Relazione: {player.relationship_type === 'parent' ? 'Genitore' : player.relationship_type}
                </div>
              </div>
              {isEditing && (
                <button
                  onClick={() => handleRemovePlayer(player.id)}
                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                  title="Rimuovi giocatore"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Player Selection Modal */}
      <PlayerSelectionModal
        isOpen={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
        onConfirm={handleAddPlayers}
        familyId={familyId}
      />
    </div>
  )
}

