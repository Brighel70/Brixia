import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/store/auth'

export default function PlayersView() {
  const { profile } = useAuth()
  const [players, setPlayers] = useState<any[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Statistiche per il dashboard
  const [stats, setStats] = useState({
    totalPlayers: 0,
    injuredPlayers: 0,
    newPlayers: 0,
    categoriesCount: 0
  })
  
  // Filtri
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState({
    fullName: '',
    birthYear: '',
    category: '',
    role: '',
    firCode: ''
  })

  // Paginazione
  const [currentPage, setCurrentPage] = useState(1)
  const [playersPerPage] = useState(30)

  // Carica i giocatori
  useEffect(() => {
    loadPlayers()
  }, [])

  const loadPlayers = async () => {
    try {
      setLoading(true)
      
      // APPROCCIO DIVERSO: Carica giocatori e categorie separatamente
      
      // 1. Carica tutti i giocatori
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .order('last_name', { ascending: true })

      if (playersError) throw playersError

      // 1.5. Carica le persone (injured + date_of_birth per Anno)
      const { data: peopleData, error: peopleError } = await supabase
        .from('people')
        .select('id, injured, is_player, date_of_birth')
        .eq('is_player', true)

      if (peopleError) {
        console.error('Errore nel caricamento people:', peopleError)
      }

      const peopleMap = new Map()
      peopleData?.forEach((person: { id: string; injured?: boolean; date_of_birth?: string }) => {
        peopleMap.set(person.id, { injured: person.injured, date_of_birth: person.date_of_birth })
      })

      // 1.6. Carica le posizioni (ruolo in campo) per mappare role_on_field al nome
      let positionsMap = new Map<string, { id: string; name: string }>()
      try {
        const { data: positionsData } = await supabase
          .from('player_positions')
          .select('id, name')
        positionsData?.forEach((p: { id: string; name: string }) => {
          positionsMap.set(p.id, p)
        })
      } catch (_) {}

      // 2. Carica tutte le associazioni giocatori-categorie
      
      let associationsData = []
      let associationsError = null
      
      try {
        const result = await supabase
          .from('player_categories')
          .select(`
            player_id,
            category_id,
            categories(
              id,
              code,
              name
            )
          `)
        
        associationsData = result.data
        associationsError = result.error
        
      } catch (error) {
        console.error('❌ Errore nel caricamento associazioni:', error)
        associationsError = error
      }

      if (associationsError) {
        console.error('❌ Errore nel caricamento associazioni:', associationsError)
        // Non bloccare, continua senza associazioni
        associationsData = []
      }


      // 3. Crea una mappa delle categorie per giocatore
      const categoriesMap = new Map()
      associationsData?.forEach(assoc => {
        if (!categoriesMap.has(assoc.player_id)) {
          categoriesMap.set(assoc.player_id, [])
        }
        if (assoc.categories) {
          categoriesMap.get(assoc.player_id).push(assoc.categories)
        }
      })


      // 4. Formatta i giocatori: Anno (people/players o stimato da FIR), Categoria (player_categories o FIR), Ruolo (position_id o role_on_field + player_positions)
      const categoryMapping: Record<string, { id: string; code: string; name: string }> = {
        'U6': { id: 'temp-u6', code: 'U6', name: 'Under 6' },
        'U8': { id: 'temp-u8', code: 'U8', name: 'Under 8' },
        'U10': { id: 'temp-u10', code: 'U10', name: 'Under 10' },
        'U12': { id: 'temp-u12', code: 'U12', name: 'Under 12' },
        'U14': { id: 'temp-u14', code: 'U14', name: 'Under 14' },
        'U16': { id: 'temp-u16', code: 'U16', name: 'Under 16' },
        'U18': { id: 'temp-u18', code: 'U18', name: 'Under 18' },
        'SC': { id: 'temp-sc', code: 'SERIE_C', name: 'Serie C' },
        'SB': { id: 'temp-sb', code: 'SERIE_B', name: 'Serie B' },
        'POD': { id: 'temp-pod', code: 'PODEROSA', name: 'Poderosa' },
        'GUS': { id: 'temp-gus', code: 'GUSSAGOLD', name: 'GussagOld' },
        'BRI': { id: 'temp-bri', code: 'BRIXIAOLD', name: 'Brixia Old' },
        'LEO': { id: 'temp-leo', code: 'LEONESSE', name: 'Leonesse' }
      }

      type PlayerRow = {
        id: string
        person_id: string
        first_name?: string
        last_name?: string
        date_of_birth?: string
        birth_date?: string
        fir_code?: string
        created_at?: string
        role_on_field?: string
        position_id?: string
      }

      const formattedPlayers = (playersData || []).map((player: PlayerRow) => {
        // Categoria: da player_categories (player_id = players.id) o da FIR
        let categories = (categoriesMap.get(player.id) || categoriesMap.get(player.person_id) || []) as { id?: string; code?: string; name?: string }[]
        if (categories.length === 0 && player.fir_code) {
          const firParts = player.fir_code.split('-')
          if (firParts.length >= 2) {
            const categoryCode = firParts[1]
            if (categoryMapping[categoryCode]) categories = [categoryMapping[categoryCode]]
          }
        }

        const personInfo = peopleMap.get(player.person_id)
        const birthDate = personInfo?.date_of_birth || player.birth_date || player.date_of_birth || ''
        const roleId = player.position_id || player.role_on_field
        const position = roleId ? positionsMap.get(roleId) : null

        return {
          id: player.id,
          first_name: player.first_name || '',
          last_name: player.last_name || '',
          date_of_birth: birthDate,
          fir_code: player.fir_code || '',
          injured: personInfo?.injured ?? false,
          created_at: player.created_at,
          role: position ? { id: position.id, name: position.name } : (roleId ? { id: roleId, name: String(roleId) } : null),
          categories
        }
      })

      setPlayers(formattedPlayers)
      setFilteredPlayers(formattedPlayers)
      
      // Calcola statistiche
      const totalPlayers = formattedPlayers.length
      
      // CALCOLO CORRETTO INFORTUNATI: Cerca davvero nelle persone con infortuni aperti
      let injuredPlayers = 0
      try {
        // Carica tutte le persone con infortuni aperti
        const { data: injuredPeople } = await supabase
          .from('people')
          .select('id, is_player')
          .eq('is_player', true)
          .eq('injured', true)
        
        injuredPlayers = injuredPeople?.length || 0
        
        // DEBUG: Log per verificare il calcolo
        console.log('🔍 DEBUG INFORTUNATI:', {
          totalPlayers,
          injuredFromPeople: injuredPeople?.length || 0,
          injuredFromPlayers: formattedPlayers.filter(p => p.injured).length
        })
      } catch (error) {
        console.error('Errore nel calcolo infortunati:', error)
        // Fallback: usa il calcolo precedente
        injuredPlayers = formattedPlayers.filter(p => p.injured).length
      }
      
      const newPlayers = formattedPlayers.filter(p => {
        const createdDate = new Date(p.created_at)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return createdDate > thirtyDaysAgo
      }).length
      
      // Conta categorie uniche
      const uniqueCategories = new Set()
      formattedPlayers.forEach(player => {
        if (player.categories && player.categories.length > 0) {
          player.categories.forEach((cat: any) => {
            if (cat && cat.code) uniqueCategories.add(cat.code)
          })
        }
      })
      
      
      setStats({
        totalPlayers,
        injuredPlayers,
        newPlayers,
        categoriesCount: uniqueCategories.size
      })
    } catch (error) {
      console.error('Errore nel caricamento giocatori:', error)
    } finally {
      setLoading(false)
    }
  }

  // Anno stimato dalla categoria (es. U16 = under 16 → nato ~2010)
  const categoryToMaxAge: Record<string, number> = {
    U6: 6, U8: 8, U10: 10, U12: 12, U14: 14, U16: 16, U18: 18
  }

  // Estrai anno dalla data di nascita; se manca, stima dalla categoria (da FIR o player_categories)
  const getBirthYear = (player: { date_of_birth?: string; categories?: { code?: string }[] }) => {
    if (player.date_of_birth) {
      try {
        const date = new Date(player.date_of_birth)
        return date.getFullYear().toString()
      } catch {
        // fallback sotto
      }
    }
    const code = player.categories?.[0]?.code
    if (code && categoryToMaxAge[code]) {
      const currentYear = new Date().getFullYear()
      const estimatedYear = currentYear - categoryToMaxAge[code]
      return `~${estimatedYear}`
    }
    return 'N/A'
  }

  // Filtra i giocatori
  useEffect(() => {
    let filtered = [...players]

    // Filtro globale
    if (globalFilter) {
      filtered = filtered.filter(player => 
        `${player.first_name} ${player.last_name}`.toLowerCase().includes(globalFilter.toLowerCase()) ||
        player.fir_code?.toLowerCase().includes(globalFilter.toLowerCase()) ||
        player.role?.name?.toLowerCase().includes(globalFilter.toLowerCase()) ||
        (player.categories && player.categories.length > 0 && 
         player.categories.some((cat: any) => cat.code?.toLowerCase().includes(globalFilter.toLowerCase())))
      )
    }

    // Filtri per colonna
    if (columnFilters.fullName) {
      filtered = filtered.filter(player => 
        `${player.first_name} ${player.last_name}`.toLowerCase().includes(columnFilters.fullName.toLowerCase())
      )
    }
    if (columnFilters.birthYear) {
      filtered = filtered.filter(player => 
        player.date_of_birth?.toString().includes(columnFilters.birthYear)
      )
    }
    if (columnFilters.category) {
      filtered = filtered.filter(player => 
        player.categories && player.categories.length > 0 && 
        player.categories.some((cat: any) => cat.code?.toLowerCase().includes(columnFilters.category.toLowerCase()))
      )
    }
    if (columnFilters.role) {
      filtered = filtered.filter(player => 
        player.role?.name?.toLowerCase().includes(columnFilters.role.toLowerCase())
      )
    }
    if (columnFilters.firCode) {
      filtered = filtered.filter(player => 
        player.fir_code?.toLowerCase().includes(columnFilters.firCode.toLowerCase())
      )
    }

    setFilteredPlayers(filtered)
    setCurrentPage(1)
  }, [players, globalFilter, columnFilters])

  // Calcola giocatori per pagina
  const indexOfLastPlayer = currentPage * playersPerPage
  const indexOfFirstPlayer = indexOfLastPlayer - playersPerPage
  const currentPlayers = filteredPlayers.slice(indexOfFirstPlayer, indexOfLastPlayer)
  const totalPages = Math.ceil(filteredPlayers.length / playersPerPage)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  // Formatta nomi categorie con controllo di sicurezza
  const getCategoryNames = (categories: any[]) => {
    if (!categories || categories.length === 0) return 'N/A'
    const validCategories = categories
      .filter(cat => cat && cat.code)
      .map(cat => cat.code)
    return validCategories.length > 0 ? validCategories.join(', ') : 'N/A'
  }

  // Formatta ruolo con controllo di sicurezza
  const getRoleName = (role: any) => {
    if (!role || !role.name) return 'N/A'
    return role.name
  }

  // Formatta codice FIR con controllo di sicurezza
  const getFirCode = (firCode: any) => {
    if (!firCode) return 'N/A'
    return firCode
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Gestione Giocatori" showBack={true} hideCenterLogo={true} />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Dashboard interno con statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🏉</div>
              <div>
                <div className="text-2xl font-bold">{stats.totalPlayers}</div>
                <div className="text-sm text-blue-100">Giocatori Totali</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-red-500 to-red-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🏥</div>
              <div>
                <div className="text-2xl font-bold">{stats.injuredPlayers}</div>
                <div className="text-sm text-red-100">Infortunati</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-green-500 to-green-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🆕</div>
              <div>
                <div className="text-2xl font-bold">{stats.newPlayers}</div>
                <div className="text-sm text-green-100">Nuove Iscrizioni</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🏷️</div>
              <div>
                <div className="text-2xl font-bold">{stats.categoriesCount}</div>
                <div className="text-sm text-purple-100">Categorie</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtro globale */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Cerca in tutte le colonne..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full p-4 pl-12 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent text-lg"
            />
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl">
              🔍
            </div>
          </div>
        </div>

        {/* Tabella */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Header con filtri per colonna */}
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    <div className="mb-2">Giocatore</div>
                    <input
                      type="text"
                      placeholder="🔍 Filtra..."
                      value={columnFilters.fullName}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    <div className="mb-2">Anno</div>
                    <input
                      type="text"
                      placeholder="🔍 Filtra..."
                      value={columnFilters.birthYear}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, birthYear: e.target.value }))}
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    <div className="mb-2">Categoria</div>
                    <input
                      type="text"
                      placeholder="🔍 Filtra..."
                      value={columnFilters.category}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    <div className="mb-2">Ruolo</div>
                    <input
                      type="text"
                      placeholder="🔍 Filtra..."
                      value={columnFilters.role}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                    <div className="mb-2">Codice FIR</div>
                    <input
                      type="text"
                      placeholder="🔍 Filtra..."
                      value={columnFilters.firCode}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, firCode: e.target.value }))}
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </th>
                </tr>
              </thead>

              {/* Corpo tabella */}
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="text-2xl mb-2">⏳</div>
                      <p className="text-gray-500">Caricamento giocatori...</p>
                    </td>
                  </tr>
                ) : currentPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="text-2xl mb-2 text-gray-400">🏉</div>
                      <p className="text-gray-500">Nessun giocatore trovato</p>
                    </td>
                  </tr>
                ) : (
                  currentPlayers.map((player) => (
                    <tr 
                      key={player.id} 
                      className={`transition-colors ${
                        player.injured 
                          ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-400' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {player.last_name} {player.first_name}
                          </div>
                          {player.injured && (
                            <div className="ml-2 flex items-center">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <rect x="9" y="3" width="6" height="18" fill="#DC2626"/>
                                <rect x="3" y="9" width="18" height="6" fill="#DC2626"/>
                              </svg>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getBirthYear(player)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getCategoryNames(player.categories)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getRoleName(player.role)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-mono">
                          {getFirCode(player.fir_code)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginazione */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando {indexOfFirstPlayer + 1}-{Math.min(indexOfLastPlayer, filteredPlayers.length)} di {filteredPlayers.length} giocatori
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Precedente
                  </button>
                  <span className="px-3 py-2 text-sm text-gray-700">
                    Pagina {currentPage} di {totalPages}
                  </span>
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Successiva →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
