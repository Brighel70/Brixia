import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/store/auth'

export default function StaffView() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [staff, setStaff] = useState<any[]>([])
  const [filteredStaff, setFilteredStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  

  
  // Statistiche per il dashboard
  const [stats, setStats] = useState({
    totalStaff: 0,
    activeStaff: 0,
    newStaff: 0,
    rolesCount: 0
  })
  
  // Filtri
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState({
    fullName: '',
    email: '',
    role: '',
    category: '',
    firCode: ''
  })

  // Paginazione
  const [currentPage, setCurrentPage] = useState(1)
  const [staffPerPage] = useState(20)

  // Carica lo staff
  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          phone,
          fir_code,
          role,
          created_at
        `)
        .not('full_name', 'is', null)
        .neq('full_name', '')
        .order('full_name', { ascending: true })

      if (error) throw error

      // Formatta i dati con controlli di sicurezza
      const formattedStaff = (data || []).map(member => {
        const formatted = {
          id: member.id,
          full_name: member.full_name || '',
          email: member.email || '',
          phone: member.phone || '',
          fir_code: member.fir_code || '',
          created_at: member.created_at,
          role: member.role || null,
          categories: [] // Temporaneamente vuoto fino a quando non risolviamo la foreign key
        }
        
        return formatted
      })

      setStaff(formattedStaff)
      setFilteredStaff(formattedStaff)
      
      // Calcola statistiche
      const totalStaff = formattedStaff.length
      const activeStaff = formattedStaff.length // Tutti sono attivi per ora
      const newStaff = formattedStaff.filter(s => {
        const createdDate = new Date(s.created_at)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return createdDate > thirtyDaysAgo
      }).length
      
      // Conta ruoli unici
      const uniqueRoles = new Set()
      formattedStaff.forEach(member => {
        if (member.role && member.role.name) uniqueRoles.add(member.role.name)
      })
      
      setStats({
        totalStaff,
        activeStaff,
        newStaff,
        rolesCount: uniqueRoles.size
      })
    } catch (error) {
      console.error('Errore nel caricamento staff:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtra lo staff
  useEffect(() => {
    let filtered = [...staff]

    // Filtro globale
    if (globalFilter) {
      filtered = filtered.filter(member => 
        member.full_name.toLowerCase().includes(globalFilter.toLowerCase()) ||
        member.email.toLowerCase().includes(globalFilter.toLowerCase()) ||
        member.role?.name?.toLowerCase().includes(globalFilter.toLowerCase()) ||
        member.categories.some((cat: any) => cat.code?.toLowerCase().includes(globalFilter.toLowerCase()))
      )
    }

    // Filtri per colonna
    if (columnFilters.fullName) {
      filtered = filtered.filter(member => 
        member.full_name.toLowerCase().includes(columnFilters.fullName.toLowerCase())
      )
    }
    if (columnFilters.email) {
      filtered = filtered.filter(member => 
        member.email.toLowerCase().includes(columnFilters.email.toLowerCase())
      )
    }
    if (columnFilters.role) {
      filtered = filtered.filter(member => 
        member.role?.name?.toLowerCase().includes(columnFilters.role.toLowerCase())
      )
    }
    if (columnFilters.category) {
      filtered = filtered.filter(member => 
        member.categories.some((cat: any) => cat.code?.toLowerCase().includes(columnFilters.category.toLowerCase()))
      )
    }
    if (columnFilters.firCode) {
      filtered = filtered.filter(member => 
        member.fir_code?.toLowerCase().includes(columnFilters.firCode.toLowerCase())
      )
    }

    setFilteredStaff(filtered)
    setCurrentPage(1)
  }, [staff, globalFilter, columnFilters])

  // Calcola staff per pagina
  const indexOfLastStaff = currentPage * staffPerPage
  const indexOfFirstStaff = indexOfLastStaff - staffPerPage
  const currentStaff = filteredStaff.slice(indexOfFirstStaff, indexOfLastStaff)
  const totalPages = Math.ceil(filteredStaff.length / staffPerPage)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  // Formatta nomi categorie con controllo di sicurezza
  const getCategoryNames = (categories: any[]) => {
    if (!categories || categories.length === 0) return '-'
    return categories
      .map((cat: any) => cat?.code || cat?.name || '')
      .filter(Boolean)
      .join(', ')
  }

  // Formatta nome ruolo con controllo di sicurezza
  const getRoleName = (role: any) => {
    if (!role || !role.name) return '-'
    return role.name
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Gestione Staff" showBack={true} />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Dashboard interno con statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-2">
          <div className="card p-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">👥</div>
              <div>
                <div className="text-2xl font-bold">{stats.totalStaff}</div>
                <div className="text-sm text-orange-100">Staff Totale</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-green-500 to-green-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">✅</div>
              <div>
                <div className="text-2xl font-bold">{stats.activeStaff}</div>
                <div className="text-sm text-green-100">Staff Attivo</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🆕</div>
              <div>
                <div className="text-2xl font-bold">{stats.newStaff}</div>
                <div className="text-sm text-blue-100">Nuovi Membri</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🎭</div>
              <div>
                <div className="text-2xl font-bold">{stats.rolesCount}</div>
                <div className="text-sm text-purple-100">Ruoli</div>
              </div>
            </div>
          </div>
        </div>

        {/* Header con statistiche e pulsante allineati */}
        <div className="mt-8 mb-1 flex items-center justify-between">
          <div>
            <p className="text-navy/80">
              {filteredStaff.length} membri staff trovati su {staff.length} totali
            </p>
          </div>
          <button
            onClick={() => navigate('/create-user')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span className="text-xl">➕</span>
            Crea Nuovo Staff
          </button>
        </div>

        {/* Filtro globale */}
        <div className="mb-1">
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
                    <div className="mb-2">Staff</div>
                    <input
                      type="text"
                      placeholder="🔍 Filtra..."
                      value={columnFilters.fullName}
                      onChange={(e) => setColumnFilters(prev => ({ ...prev, fullName: e.target.value }))}
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
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="text-2xl mb-2">⏳</div>
                      <p className="text-gray-500">Caricamento staff...</p>
                    </td>
                  </tr>
                ) : currentStaff.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="text-2xl mb-2 text-gray-400">👥</div>
                      <p className="text-gray-500">Nessun membro staff trovato</p>
                    </td>
                  </tr>
                ) : (
                  currentStaff.map((staffMember) => (
                    <tr key={staffMember.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {staffMember.full_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getRoleName(staffMember.role)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getCategoryNames(staffMember.categories)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-mono">
                          {staffMember.fir_code || '-'}
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
                  Mostrando {indexOfFirstStaff + 1}-{Math.min(indexOfLastStaff, filteredStaff.length)} di {filteredStaff.length} membri staff
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
