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
  const [playersPerPage] = useState(20)

  // Carica i giocatori
  useEffect(() => {
    loadPlayers()
  }, [])

  const loadPlayers = async () => {
    try {
      setLoading(true)
      
      // USO LEFT JOIN PER INCLUDERE TUTTI I GIOCATORI
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          first_name,
          last_name,
          birth_year,
          fir_code,
          role_id,
          injured,
          created_at,
          roles!left(id, name),
          player_categories!left(
            category_id,
            categories!left(id, code, name)
          )
        `)
        .order('last_name', { ascending: true })

      if (error) throw error

      console.log('Dati grezzi da Supabase:', data) // Debug

      // Formatta i dati con controlli di sicurezza
      const formattedPlayers = (data || []).map(player => {
        const formatted = {
          id: player.id,
          first_name: player.first_name || '',
          last_name: player.last_name || '',
          birth_year: player.birth_year || '',
          fir_code: player.fir_code || '',
          injured: player.injured || false,
          created_at: player.created_at,
          role: player.roles && player.roles.length > 0 ? player.roles[0] : null,
          categories: player.player_categories && player.player_categories.length > 0 
            ? player.player_categories.map((pc: any) => pc.categories).filter(Boolean)
            : []
        }
        
        console.log('Giocatore formattato:', formatted) // Debug
        return formatted
      })

      setPlayers(formattedPlayers)
      setFilteredPlayers(formattedPlayers)
      
      // Calcola statistiche
      const totalPlayers = formattedPlayers.length
      const injuredPlayers = formattedPlayers.filter(p => p.injured).length
      const newPlayers = formattedPlayers.filter(p => {
        const createdDate = new Date(p.created_at)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return createdDate > thirtyDaysAgo
      }).length
      
      // Conta categorie uniche
      const uniqueCategories = new Set()
      formattedPlayers.forEach(player => {
        player.categories.forEach((cat: any) => {
          if (cat && cat.code) uniqueCategories.add(cat.code)
        })
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

  // Estrai anno dalla data di nascita
  const getBirthYear = (birthDate: string) => {
    if (!birthDate) return ''
    try {
      return new Date(birthDate).getFullYear().toString()
    } catch {
      return ''
    }
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
        player.categories.some((cat: any) => cat.code?.toLowerCase().includes(globalFilter.toLowerCase()))
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
        player.birth_year?.toString().includes(columnFilters.birthYear)
      )
    }
    if (columnFilters.category) {
      filtered = filtered.filter(player => 
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
    return categories
      .filter(cat => cat && cat.code)
      .map(cat => cat.code)
      .join(', ') || 'N/A'
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
      <Header title="Gestione Giocatori" showBack={true} />
      
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
                    <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {player.last_name} {player.first_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getBirthYear(player.birth_year)}
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
