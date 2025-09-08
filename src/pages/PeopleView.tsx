import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'

interface Person {
  id: string
  full_name: string
  given_name: string
  family_name: string
  date_of_birth: string
  is_minor: boolean
  gender: string
  fiscal_code: string
  email: string
  phone: string
  status: string
  membership_number: string
  created_at: string
  // Dati aggiuntivi per la visualizzazione
  age: number
  role: string
  categories: string[]
}

export default function PeopleView() {
  const navigate = useNavigate()
  const [people, setPeople] = useState<Person[]>([])
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ageFilter, setAgeFilter] = useState('all')
  const [availableRoles, setAvailableRoles] = useState<string[]>([])

  // Carica le persone e i ruoli
  useEffect(() => {
    loadPeople()
    loadRoles()
  }, [])

  // Filtra le persone
  useEffect(() => {
    let filtered = [...people]

    // Filtro di ricerca
    if (searchTerm) {
      filtered = filtered.filter(person => 
        person.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.fiscal_code?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro per ruolo
    if (roleFilter !== 'all') {
      filtered = filtered.filter(person => person.role === roleFilter)
    }

    // Filtro per status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(person => person.status === statusFilter)
    }

    // Filtro per età
    if (ageFilter !== 'all') {
      const ageRanges = {
        'minor': (age: number) => age < 18,
        'adult': (age: number) => age >= 18,
        'senior': (age: number) => age >= 65
      }
      if (ageRanges[ageFilter as keyof typeof ageRanges]) {
        filtered = filtered.filter(person => ageRanges[ageFilter as keyof typeof ageRanges](person.age))
      }
    }

    setFilteredPeople(filtered)
  }, [people, searchTerm, roleFilter, statusFilter, ageFilter])

  const loadPeople = async () => {
    try {
      setLoading(true)
      
      // Carica tutte le persone
      const { data: peopleData, error: peopleError } = await supabase
        .from('people')
        .select('*')
        .order('family_name', { ascending: true })

      if (peopleError) throw peopleError

      // Carica i giocatori per determinare i ruoli
      const { data: playersData } = await supabase
        .from('players')
        .select('person_id, role_on_field')

      // Carica i ruoli staff dalla tabella people (campo staff_roles)
      // Non serve più caricare da profiles perché i ruoli sono salvati direttamente in people

      // Carica i ruoli staff per mappare gli ID ai nomi
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('id, name')

      // Carica le categorie dei giocatori
      const { data: categoriesData } = await supabase
        .from('player_categories')
        .select(`
          player_id,
          categories (id, name, code)
        `)

      // Carica tutte le categorie disponibili per mappare gli ID staff
      const { data: allCategoriesData } = await supabase
        .from('categories')
        .select('id, name, code')

      // Processa i dati
      const processedPeople = (peopleData || []).map(person => {
        // Calcola l'età
        const age = person.date_of_birth 
          ? Math.floor((new Date().getTime() - new Date(person.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : 0

        // Determina il ruolo
        let role = 'Persona'
        let categories: string[] = []

        // Controlla se è un giocatore
        const player = playersData?.find(p => p.person_id === person.id)
        if (player) {
          role = 'Giocatore'
          // Carica le categorie dal campo player_categories della tabella people
          if (person.player_categories && person.player_categories.length > 0) {
            const playerCategoryNames = person.player_categories.map(categoryId => {
              const category = allCategoriesData?.find(c => c.id === categoryId)
              return category?.name || ''
            }).filter(Boolean)
            categories = playerCategoryNames
          } else {
            // Fallback: cerca nelle categorie legacy se il nuovo campo è vuoto
            const playerCategories = categoriesData?.filter(c => c.player_id === player.person_id) || []
            categories = playerCategories.map(c => c.categories?.name || '').filter(Boolean)
          }
        }

        // Controlla se è staff usando il campo staff_roles
        if (person.staff_roles && person.staff_roles.length > 0) {
          // Se ha ruoli staff, mostra il primo ruolo
          const firstRoleId = person.staff_roles[0]
          
          // Mappa l'ID del ruolo al nome
          const staffRole = userRolesData?.find(r => r.id === firstRoleId)
          role = staffRole ? staffRole.name : 'Staff'
          
          // Carica le categorie staff se presenti
          if (person.staff_categories && person.staff_categories.length > 0) {
            const staffCategoryNames = person.staff_categories.map(categoryId => {
              const category = allCategoriesData?.find(c => c.id === categoryId)
              return category?.name || ''
            }).filter(Boolean)
            
            // Se non abbiamo ancora categorie (da giocatore), usa quelle staff
            if (categories.length === 0) {
              categories = staffCategoryNames
            } else {
              // Se ha sia categorie giocatore che staff, combinale
              categories = [...categories, ...staffCategoryNames]
            }
          }
        }

        return {
          ...person,
          age,
          role,
          categories
        }
      })

      setPeople(processedPeople)
    } catch (error) {
      console.error('Errore nel caricamento persone:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      console.log('🔄 Caricamento ruoli dal database...')
      
      // Carica solo i ruoli delle persone dalla tabella user_roles
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('name')
        .order('position_order')

      console.log('👥 Ruoli persone:', userRolesData, 'Errore:', userRolesError)

      if (userRolesError) throw userRolesError

      // Aggiungi i ruoli delle persone + ruolo di default
      const allRoles = [
        ...(userRolesData || []).map(role => role.name),
        'Persona' // Ruolo di default per persone senza ruolo specifico
      ]

      // Ordina i ruoli
      const sortedRoles = allRoles.sort()
      console.log('✅ Ruoli finali caricati:', sortedRoles)
      setAvailableRoles(sortedRoles)

    } catch (error) {
      console.error('❌ Errore nel caricamento ruoli:', error)
      // In caso di errore, usa i ruoli di default
      const fallbackRoles = ['Admin', 'Dirigente', 'Allenatore', 'Medico', 'Amministratore', 'Persona']
      console.log('🔄 Usando ruoli di fallback:', fallbackRoles)
      setAvailableRoles(fallbackRoles)
    }
  }

  const handleDeletePerson = async (personId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa persona?')) return

    try {
      const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', personId)

      if (error) throw error

      // Ricarica la lista
      loadPeople()
    } catch (error) {
      console.error('Errore nell\'eliminazione:', error)
      alert('Errore nell\'eliminazione della persona')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Giocatore': return 'bg-blue-100 text-blue-800'
      case 'Allenatore': return 'bg-orange-100 text-orange-800'
      case 'Dirigente': return 'bg-purple-100 text-purple-800'
      case 'Medico': return 'bg-red-100 text-red-800'
      case 'Amministratore': return 'bg-gray-100 text-gray-800'
      case 'Admin': return 'bg-gray-100 text-gray-800'
      case 'Dirigente': return 'bg-purple-100 text-purple-800'
      case 'Segreteria': return 'bg-indigo-100 text-indigo-800'
      case 'Direttore Sportivo': return 'bg-purple-100 text-purple-800'
      case 'Direttore Tecnico': return 'bg-purple-100 text-purple-800'
      case 'Team Manager': return 'bg-green-100 text-green-800'
      case 'Accompagnatore': return 'bg-yellow-100 text-yellow-800'
      case 'Player': return 'bg-blue-100 text-blue-800'
      case 'Preparatore': return 'bg-orange-100 text-orange-800'
      case 'Fisio': return 'bg-pink-100 text-pink-800'
      case 'Famiglia': return 'bg-cyan-100 text-cyan-800'
      case 'Tutor': return 'bg-teal-100 text-teal-800'
      case 'Medicina': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Anagrafica" showBack={true} />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">Caricamento in corso...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Anagrafica" showBack={true} />
      
      <div className="p-6">
        {/* Header con azioni */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Anagrafica</h1>
            <p className="text-white">Gestione unificata di tutte le anagrafiche del sistema</p>
          </div>
          <button
            onClick={() => navigate('/create-person')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            ➕ Nuova Persona
          </button>
        </div>

        {/* Filtri */}
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Ricerca */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ricerca</label>
              <input
                type="text"
                placeholder="Nome, email, codice fiscale..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filtro ruolo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tutti i ruoli</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tutti gli status</option>
                <option value="active">Attivo</option>
                <option value="inactive">Inattivo</option>
                <option value="pending">In attesa</option>
              </select>
            </div>

            {/* Filtro età */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Età</label>
              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tutte le età</option>
                <option value="minor">Minorenni</option>
                <option value="adult">Maggiorenni</option>
                <option value="senior">Over 65</option>
              </select>
            </div>
          </div>
        </div>

        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-blue-600">{people.length}</div>
            <div className="text-sm text-gray-600">Totale Persone</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-green-600">
              {people.filter(p => p.status === 'active').length}
            </div>
            <div className="text-sm text-gray-600">Attive</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-orange-600">
              {people.filter(p => p.is_minor).length}
            </div>
            <div className="text-sm text-gray-600">Minorenni</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-2xl font-bold text-purple-600">
              {people.filter(p => p.role === 'Giocatore').length}
            </div>
            <div className="text-sm text-gray-600">Giocatori</div>
          </div>
        </div>

        {/* Lista persone */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {filteredPeople.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm || roleFilter !== 'all' || statusFilter !== 'all' || ageFilter !== 'all' 
                ? 'Nessuna persona trovata con i filtri selezionati'
                : 'Nessuna persona presente nel sistema'
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Persona
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ruolo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Età
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPeople.map((person) => (
                    <tr 
                      key={person.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onDoubleClick={() => navigate(`/create-person?edit=${person.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {person.given_name?.[0]}{person.family_name?.[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {person.full_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {person.membership_number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(person.role)}`}>
                          {person.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {person.age} anni
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {person.categories && person.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {person.categories.map((category, index) => (
                              <span 
                                key={index}
                                className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800"
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(person.status)}`}>
                          {person.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/create-person?edit=${person.id}`);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Modifica
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePerson(person.id);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


