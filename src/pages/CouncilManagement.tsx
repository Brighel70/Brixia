import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'

type CouncilRole = 'president' | 'vice_president' | 'counselor' | 'representative_gussago' | 'representative_ospitaletto' | 'representative_brescia'

interface CouncilMember {
  id: string
  name: string
  role: CouncilRole
  created_at: string
}

interface CouncilManagementProps {
  embedInLayout?: boolean
}

export default function CouncilManagement({ embedInLayout = false }: CouncilManagementProps) {
  const navigate = useNavigate()
  const [councilMembers, setCouncilMembers] = useState<CouncilMember[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [newMember, setNewMember] = useState({ name: '', role: 'counselor' as CouncilRole })
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    loadCouncilMembers()
  }, [])

  useEffect(() => {
    const handler = () => setShowAddModal(true)
    window.addEventListener('open-add-council-member', handler)
    return () => window.removeEventListener('open-add-council-member', handler)
  }, [])

  const loadCouncilMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('council_members')
        .select('*')
        .order('role', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      setCouncilMembers(data || [])
    } catch (error) {
      console.error('Errore nel caricamento membri consiglio:', error)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (!newMember.name.trim()) {
        throw new Error('Il nome è obbligatorio')
      }

      // Verifica che non ci sia già un presidente se stiamo aggiungendo un presidente
      if (newMember.role === 'president') {
        const existingPresident = councilMembers.find(member => member.role === 'president')
        if (existingPresident) {
          throw new Error('Esiste già un Presidente. Puoi modificare quello esistente.')
        }
      }

      // Verifica che non ci sia già un vice presidente se stiamo aggiungendo un vice presidente
      if (newMember.role === 'vice_president') {
        const existingVicePresident = councilMembers.find(member => member.role === 'vice_president')
        if (existingVicePresident) {
          throw new Error('Esiste già un Vice Presidente. Puoi modificare quello esistente.')
        }
      }

      const { error } = await supabase
        .from('council_members')
        .insert({
          name: newMember.name.trim(),
          role: newMember.role
        })

      if (error) throw error

      setMessage('✅ Membro del consiglio aggiunto con successo!')
      setNewMember({ name: '', role: 'counselor' })
      setShowAddModal(false)
      loadCouncilMembers()
    } catch (error: any) {
      console.error('Errore nell\'aggiunta membro consiglio:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEditMember = (memberId: string, currentName: string) => {
    setEditingMember(memberId)
    setEditingName(currentName)
  }

  const handleSaveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('council_members')
        .update({ name: editingName.trim() })
        .eq('id', memberId)

      if (error) throw error

      setMessage('✅ Nome membro aggiornato con successo!')
      setEditingMember(null)
      setEditingName('')
      loadCouncilMembers()
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento membro:', error)
      setMessage(`❌ Errore: ${error.message}`)
    }
  }

  const handleCancelEdit = () => {
    setEditingMember(null)
    setEditingName('')
  }

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo membro del consiglio?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('council_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      setMessage('✅ Membro del consiglio eliminato con successo!')
      loadCouncilMembers()
    } catch (error: any) {
      console.error('Errore nell\'eliminazione membro:', error)
      setMessage(`❌ Errore: ${error.message}`)
    }
  }

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      'president': 'Presidente',
      'vice_president': 'Vice Presidente',
      'counselor': 'Consigliere',
      'representative_gussago': 'Rappresentante Gussago',
      'representative_ospitaletto': 'Rappresentante Ospitaletto',
      'representative_brescia': 'Rappresentante Brescia'
    }
    return roles[role] || role
  }

  const getRoleIcon = (role: string) => {
    const icons: Record<string, string> = {
      'president': '👑',
      'vice_president': '👑',
      'counselor': '👤',
      'representative_gussago': '🏛️',
      'representative_ospitaletto': '🏛️',
      'representative_brescia': '🏛️'
    }
    return icons[role] || '👤'
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'president': 'bg-yellow-100 border-yellow-300 text-yellow-800',
      'vice_president': 'bg-orange-100 border-orange-300 text-orange-800',
      'counselor': 'bg-blue-100 border-blue-300 text-blue-800',
      'representative_gussago': 'bg-emerald-100 border-emerald-300 text-emerald-800',
      'representative_ospitaletto': 'bg-teal-100 border-teal-300 text-teal-800',
      'representative_brescia': 'bg-cyan-100 border-cyan-300 text-cyan-800'
    }
    return colors[role] || 'bg-gray-100 border-gray-300 text-gray-800'
  }

  const president = councilMembers.find(member => member.role === 'president')
  const vicePresident = councilMembers.find(member => member.role === 'vice_president')
  const representativesGussago = councilMembers.filter(member => member.role === 'representative_gussago')
  const representativesOspitaletto = councilMembers.filter(member => member.role === 'representative_ospitaletto')
  const representativesBrescia = councilMembers.filter(member => member.role === 'representative_brescia')
  const counselors = councilMembers.filter(member => member.role === 'counselor')

  return (
    <div className={embedInLayout ? 'min-h-full bg-gray-50 text-gray-900' : 'min-h-screen bg-gray-50'}>
      {!embedInLayout && <Header title="Gestione Consiglio" showBack={true} />}
      
      <div className="w-full max-w-full mx-auto p-6">
        {!embedInLayout && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Gestione Consiglio</h1>
          </div>
        )}

        {/* Modal Aggiungi Nuovo Dirigente */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-navy mb-4">Aggiungi Nuovo Membro</h2>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={newMember.name}
                      onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent text-gray-900 placeholder:text-gray-500"
                      placeholder="Es. Mario Rossi"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ruolo *</label>
                    <select
                      value={newMember.role}
                      onChange={(e) => setNewMember({...newMember, role: e.target.value as CouncilRole})}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent text-gray-900"
                    >
                      <optgroup label="Consiglio Brixia">
                        <option value="president">Presidente</option>
                        <option value="vice_president">Vice Presidente</option>
                        <option value="counselor">Consigliere</option>
                      </optgroup>
                      <optgroup label="Rappresentanti società costituenti">
                        <option value="representative_gussago">Rappresentante Gussago</option>
                        <option value="representative_ospitaletto">Rappresentante Ospitaletto</option>
                        <option value="representative_brescia">Rappresentante Brescia</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
                <div className="flex justify-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn bg-gray-500 text-white px-6 py-3 hover:bg-gray-600"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn bg-sky text-white px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Aggiunta...' : 'Aggiungi dirigente'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4 CARD SEPARATE */}
        {councilMembers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8 text-center text-gray-500">
            <div className="text-4xl mb-4">🏛️</div>
            <p>Nessun membro del consiglio configurato</p>
            <p className="text-sm mt-2">Aggiungi il primo membro per iniziare</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* CARD 1: Il Consiglio del Brixia - stessa larghezza della card Ospitaletto (griglia 3 colonne, solo colonna centrale) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="hidden md:block" />
              <div className="bg-white rounded-2xl shadow-lg border-2 border-amber-200 overflow-hidden">
              <div className="bg-amber-100 border-b-2 border-amber-200 px-6 py-4">
                <h3 className="text-xl font-bold text-amber-900">Il Consiglio del Brixia</h3>
              </div>
              <div className="p-6 space-y-4">
                {!president && !vicePresident && counselors.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Nessun membro</p>
                ) : (
                  <>
                  {president && (
                <div className={`p-4 rounded-lg border-2 ${getRoleColor('president')}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getRoleIcon('president')}</span>
                      <div>
                        <div className="font-semibold text-lg">{president.name}</div>
                        <div className="text-sm opacity-75">{getRoleLabel('president')}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {editingMember === president.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-sky-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveMember(president.id)}
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
                        <>
                          <button
                            onClick={() => handleEditMember(president.id, president.name)}
                            className="btn bg-blue-500 text-white px-3 py-2 text-sm hover:bg-blue-600"
                            title="Modifica nome"
                          >
                            Modifica
                          </button>
                          <button
                            onClick={() => handleDeleteMember(president.id)}
                            className="btn bg-red-500 text-white px-3 py-2 text-sm hover:bg-red-600"
                            title="Elimina membro"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Vice Presidente */}
              {vicePresident && (
                <div className={`p-4 rounded-lg border-2 ${getRoleColor('vice_president')}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getRoleIcon('vice_president')}</span>
                      <div>
                        <div className="font-semibold text-lg">{vicePresident.name}</div>
                        <div className="text-sm opacity-75">{getRoleLabel('vice_president')}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {editingMember === vicePresident.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-sky-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveMember(vicePresident.id)}
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
                        <>
                          <button
                            onClick={() => handleEditMember(vicePresident.id, vicePresident.name)}
                            className="btn bg-blue-500 text-white px-3 py-2 text-sm hover:bg-blue-600"
                            title="Modifica nome"
                          >
                            Modifica
                          </button>
                          <button
                            onClick={() => handleDeleteMember(vicePresident.id)}
                            className="btn bg-red-500 text-white px-3 py-2 text-sm hover:bg-red-600"
                            title="Elimina membro"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Consiglieri - membri del consiglio Brixia */}
              {counselors.map((counselor) => (
                <div key={counselor.id} className={`p-4 rounded-lg border-2 ${getRoleColor('counselor')}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getRoleIcon('counselor')}</span>
                          <div>
                            <div className="font-semibold text-lg">{counselor.name}</div>
                            <div className="text-sm opacity-75">{getRoleLabel('counselor')}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {editingMember === counselor.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-sky-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveMember(counselor.id)}
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
                            <>
                              <button
                                onClick={() => handleEditMember(counselor.id, counselor.name)}
                                className="btn bg-blue-500 text-white px-3 py-2 text-sm hover:bg-blue-600"
                                title="Modifica nome"
                              >
                                Modifica
                              </button>
                              <button
                                onClick={() => handleDeleteMember(counselor.id)}
                                className="btn bg-red-500 text-white px-3 py-2 text-sm hover:bg-red-600"
                                title="Elimina membro"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                </div>
              ))}
                  </>
                )}
              </div>
            </div>
            </div>

            {/* FASCIA 2: Le tre società costituenti in 3 colonne */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CARD 2: Gussago */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-emerald-200 overflow-hidden">
              <div className="bg-emerald-100 border-b-2 border-emerald-200 px-6 py-4">
                <h3 className="text-xl font-bold text-emerald-900">Gussago</h3>
              </div>
              <div className="p-6 space-y-3">
                {representativesGussago.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Nessun rappresentante</p>
                ) : (
                  representativesGussago.map((rep) => (
                          <div key={rep.id} className={`p-3 rounded-lg border-2 ${getRoleColor(rep.role)}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-2 min-w-0">
                                <span className="text-xl shrink-0">{getRoleIcon(rep.role)}</span>
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{rep.name}</div>
                                  <div className="text-xs opacity-75">{getRoleLabel(rep.role)}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {editingMember === rep.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      className="text-sm border border-gray-300 rounded px-2 py-1 w-24 focus:ring-2 focus:ring-sky-500"
                                      autoFocus
                                    />
                                    <button onClick={() => handleSaveMember(rep.id)} className="text-xs bg-green-500 text-white px-2 py-1 rounded">Salva</button>
                                    <button onClick={handleCancelEdit} className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Annulla</button>
                                  </div>
                                ) : (
                                  <>
                                    <button onClick={() => handleEditMember(rep.id, rep.name)} className="btn bg-blue-500 text-white px-2 py-1 text-xs hover:bg-blue-600">Modifica</button>
                                    <button onClick={() => handleDeleteMember(rep.id)} className="btn bg-red-500 text-white px-2 py-1 text-xs hover:bg-red-600">🗑️</button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                )}
              </div>
            </div>

            {/* CARD 3: Ospitaletto */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-teal-200 overflow-hidden">
              <div className="bg-teal-100 border-b-2 border-teal-200 px-6 py-4">
                <h3 className="text-xl font-bold text-teal-900">Ospitaletto</h3>
              </div>
              <div className="p-6 space-y-3">
                {representativesOspitaletto.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Nessun rappresentante</p>
                ) : (
                  representativesOspitaletto.map((rep) => (
                          <div key={rep.id} className={`p-3 rounded-lg border-2 ${getRoleColor(rep.role)}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-2 min-w-0">
                                <span className="text-xl shrink-0">{getRoleIcon(rep.role)}</span>
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{rep.name}</div>
                                  <div className="text-xs opacity-75">{getRoleLabel(rep.role)}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {editingMember === rep.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      className="text-sm border border-gray-300 rounded px-2 py-1 w-24 focus:ring-2 focus:ring-sky-500"
                                      autoFocus
                                    />
                                    <button onClick={() => handleSaveMember(rep.id)} className="text-xs bg-green-500 text-white px-2 py-1 rounded">Salva</button>
                                    <button onClick={handleCancelEdit} className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Annulla</button>
                                  </div>
                                ) : (
                                  <>
                                    <button onClick={() => handleEditMember(rep.id, rep.name)} className="btn bg-blue-500 text-white px-2 py-1 text-xs hover:bg-blue-600">Modifica</button>
                                    <button onClick={() => handleDeleteMember(rep.id)} className="btn bg-red-500 text-white px-2 py-1 text-xs hover:bg-red-600">🗑️</button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                )}
              </div>
            </div>

            {/* CARD 4: Brescia */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-cyan-200 overflow-hidden">
              <div className="bg-cyan-100 border-b-2 border-cyan-200 px-6 py-4">
                <h3 className="text-xl font-bold text-cyan-900">Brescia</h3>
              </div>
              <div className="p-6 space-y-3">
                {representativesBrescia.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Nessun rappresentante</p>
                ) : (
                  representativesBrescia.map((rep) => (
                          <div key={rep.id} className={`p-3 rounded-lg border-2 ${getRoleColor(rep.role)}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-2 min-w-0">
                                <span className="text-xl shrink-0">{getRoleIcon(rep.role)}</span>
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{rep.name}</div>
                                  <div className="text-xs opacity-75">{getRoleLabel(rep.role)}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {editingMember === rep.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      className="text-sm border border-gray-300 rounded px-2 py-1 w-24 focus:ring-2 focus:ring-sky-500"
                                      autoFocus
                                    />
                                    <button onClick={() => handleSaveMember(rep.id)} className="text-xs bg-green-500 text-white px-2 py-1 rounded">Salva</button>
                                    <button onClick={handleCancelEdit} className="text-xs bg-gray-500 text-white px-2 py-1 rounded">Annulla</button>
                                  </div>
                                ) : (
                                  <>
                                    <button onClick={() => handleEditMember(rep.id, rep.name)} className="btn bg-blue-500 text-white px-2 py-1 text-xs hover:bg-blue-600">Modifica</button>
                                    <button onClick={() => handleDeleteMember(rep.id)} className="btn bg-red-500 text-white px-2 py-1 text-xs hover:bg-red-600">🗑️</button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                )}
              </div>
            </div>
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
      </div>
    </div>
  )
}












