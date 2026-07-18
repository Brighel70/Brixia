import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import PlayerSelectionModal from './PlayerSelectionModal'
import RelationshipAssignmentModal from './RelationshipAssignmentModal'

interface GuardianRelationship {
  id: string
  player_person_id: string
  relationship_type: string
  player: {
    given_name: string
    family_name: string
    date_of_birth: string
    player_categories: string[]
  }
}

interface GuardiansTabProps {
  guardianId: string // ID della persona (familiare) loggata
  isEditing: boolean
  initialRelationships?: any[]
  onRelationshipsChange?: (relationships: any[]) => void
}

interface RelationshipAssignment {
  playerId: string
  relationshipType: string
}

export default function GuardiansTab({ guardianId, isEditing, initialRelationships = [], onRelationshipsChange }: GuardiansTabProps) {
  const [relationships, setRelationships] = useState<GuardianRelationship[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPlayerSelectionModal, setShowPlayerSelectionModal] = useState(false)

  const [showRelationshipModal, setShowRelationshipModal] = useState(false)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [categoriesById, setCategoriesById] = useState<Record<string, { name: string; code?: string }>>({})

  const getCategoryLabel = (categoryId: string): string => {
    const cat = categoriesById[categoryId]
    return cat ? (cat.code || cat.name || categoryId) : categoryId
  }

  const relationshipLabels: { [key: string]: string } = {
    'padre': 'Padre',
    'madre': 'Madre',
    'nonno': 'Nonno',
    'nonna': 'Nonna',
    'zio': 'Zio',
    'zia': 'Zia',
    'tutore': 'Tutore'
  }

  useEffect(() => {
    if (guardianId) {
      loadCategories()
      loadRelationships()
    }
  }, [guardianId])

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

  const loadRelationships = async () => {
    if (!guardianId || guardianId === '') {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('player_guardian_relationships')
        .select(`
          id,
          player_person_id,
          relationship_type,
          player:people!player_person_id (
            given_name,
            family_name,
            date_of_birth,
            player_categories
          )
        `)
        .eq('guardian_person_id', guardianId)

      if (error) throw error

      setRelationships(data || [])
      
      // Notifica il componente padre del cambiamento
      if (onRelationshipsChange) {
        onRelationshipsChange(data || [])
      }
    } catch (err) {
      console.error('Errore nel caricamento delle relazioni:', err)
      setError('Errore nel caricamento delle relazioni')
    } finally {
      setLoading(false)
    }
  }

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const handleAddConnection = () => {
    if (!guardianId || guardianId === '') {
      return
    }
    setShowPlayerSelectionModal(true)
  }

  const handlePlayerSelectionConfirm = (playerIds: string[]) => {
    setSelectedPlayerIds(playerIds)
    setShowPlayerSelectionModal(false)
    setShowRelationshipModal(true)
  }

  const handlePlayerSelectionClose = () => {
    setShowPlayerSelectionModal(false)
    setSelectedPlayerIds([])
  }

  const handleRelationshipAssignmentConfirm = async (assignments: RelationshipAssignment[]) => {
    try {
      // Inserisci le nuove relazioni nel database
      const relationshipsToInsert = assignments.map(assignment => ({
        player_person_id: assignment.playerId,
        guardian_person_id: guardianId,
        relationship_type: assignment.relationshipType
      }))

      const { error } = await supabase
        .from('player_guardian_relationships')
        .upsert(relationshipsToInsert, {
          onConflict: 'player_person_id,guardian_person_id',
          ignoreDuplicates: false
        })

      if (error) throw error

      // Ricarica le relazioni
      await loadRelationships()

      // Chiudi il modal
      setShowRelationshipModal(false)
      setSelectedPlayerIds([])
    } catch (err) {
      console.error('Errore salvataggio relazioni:', err)
      setError('Errore nel salvataggio delle relazioni')
    }
  }

  const handleRelationshipAssignmentClose = () => {
    setShowRelationshipModal(false)
    setSelectedPlayerIds([])
  }

  const handleRemoveConnection = async (relationshipId: string) => {
    try {
      const { error } = await supabase
        .from('player_guardian_relationships')
        .delete()
        .eq('id', relationshipId)

      if (error) throw error

      // Ricarica le relazioni
      await loadRelationships()
      setDeleteConfirmId(null)
      
      // Notifica il componente padre del cambiamento
      if (onRelationshipsChange) {
        const updatedRelationships = relationships.filter(r => r.id !== relationshipId)
        onRelationshipsChange(updatedRelationships)
      }
    } catch (err) {
      console.error('Errore rimozione relazione:', err)
      setError('Errore nella rimozione della relazione')
    }
  }

  // Ottieni gli ID dei giocatori già collegati per escluderli dal modal
  const connectedPlayerIds = relationships.map(rel => rel.player_person_id)

  return (
    <div className="space-y-6">
      {/* Header con pulsante Nuovo collegamento */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-gray-900">Giocatori Collegati</h2>
        {(!guardianId || guardianId === '') ? (
          <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
            Salva la persona (pulsante Modifica in basso) per poter collegare i giocatori.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleAddConnection}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nuovo collegamento
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Tabella Collegamenti */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-500">Caricamento...</p>
          </div>
        ) : relationships.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-2 text-gray-500">Nessun giocatore collegato</p>
            <p className="text-sm text-gray-400">Clicca su "Nuovo collegamento" per aggiungere un giocatore</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parentela
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Età
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {relationships.map(relationship => {
                const player = Array.isArray(relationship.player) 
                  ? relationship.player[0] 
                  : relationship.player
                
                if (!player) return null

                const categories = player.player_categories || []
                const categoryLabels = categories.map(getCategoryLabel).join(', ')
                const age = calculateAge(player.date_of_birth)

                return (
                  <tr key={relationship.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {player.given_name} {player.family_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {relationshipLabels[relationship.relationship_type] || relationship.relationship_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{categoryLabels || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{age} anni</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {deleteConfirmId === relationship.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">Confermi?</span>
                          <button
                            onClick={() => handleRemoveConnection(relationship.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Sì
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(relationship.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Rimuovi collegamento"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <PlayerSelectionModal
        isOpen={showPlayerSelectionModal}
        onClose={handlePlayerSelectionClose}
        onConfirm={handlePlayerSelectionConfirm}
        excludePlayerIds={connectedPlayerIds}
        title="Collega giocatori al familiare"
        description="Seleziona uno o più giocatori da collegare a questo familiare. Nel passo successivo indica la parentela (Padre, Madre, ecc.) per ciascuno."
      />

      <RelationshipAssignmentModal
        isOpen={showRelationshipModal}
        onClose={handleRelationshipAssignmentClose}
        onConfirm={handleRelationshipAssignmentConfirm}
        selectedPlayerIds={selectedPlayerIds}
      />
    </div>
  )
}

