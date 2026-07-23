import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'

interface User {
  id: string
  person_id?: string | null
  full_name: string
  email: string
  role: string
  phone?: string
  created_at: string
  last_sign_in_at?: string
  categories?: any[]
  first_name?: string
  last_name?: string
}

interface UsersManagementProps {
  embedInLayout?: boolean
}

export default function UsersManagement({ embedInLayout = false }: UsersManagementProps) {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      
      // Carica gli utenti dalla tabella profiles
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          user_role_id,
          person_id,
          phone,
          created_at,
          first_name,
          last_name,
          user_roles (name)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Errore nel caricamento utenti:', error)
        return
      }

      // Carica anche le informazioni di autenticazione
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
      
      if (authError) {
        console.warn('Errore nel caricamento dati auth:', authError)
      }

      // Combina i dati e risolvi il ruolo (da role o da user_roles)
      const usersWithAuth = (data || []).map((user: any) => {
        const roleName = user.role || user.user_roles?.name || null
        const authUser = authData?.users?.find((auth: any) => auth.id === user.id)
        return {
          ...user,
          role: roleName,
          last_sign_in_at: authUser?.last_sign_in_at,
          email_confirmed: authUser?.email_confirmed_at ? true : false
        }
      })

      setUsers(usersWithAuth)
    } catch (error) {
      console.error('Errore nel caricamento utenti:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === 'all' ||
      (user.role && (user.role === filterRole || user.role.toLowerCase() === filterRole.toLowerCase()))
    return matchesSearch && matchesRole
  })

  const getRoleColor = (role: string) => {
    const r = role?.toLowerCase()
    if (!r) return 'bg-gray-100 text-gray-800'
    if (r === 'admin') return 'bg-red-100 text-red-800'
    if (r === 'allenatore' || r === 'coach') return 'bg-blue-100 text-blue-800'
    if (r === 'medico' || r === 'medic') return 'bg-green-100 text-green-800'
    if (r === 'fisioterapista' || r === 'fisio') return 'bg-pink-100 text-pink-800'
    if (r === 'team manager') return 'bg-emerald-100 text-emerald-800'
    if (r === 'preparatore atletico' || r === 'preparatore') return 'bg-amber-100 text-amber-800'
    if (r === 'dirigente' || r === 'director') return 'bg-purple-100 text-purple-800'
    if (r === 'segreteria') return 'bg-cyan-100 text-cyan-800'
    if (r === 'staff') return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getRoleLabel = (role: string) => {
    if (!role) return '-'
    const r = role.toLowerCase()
    if (r === 'admin') return 'Amministratore'
    if (r === 'allenatore' || r === 'coach') return 'Allenatore'
    if (r === 'medico' || r === 'medic') return 'Medico'
    if (r === 'fisioterapista' || r === 'fisio') return 'Fisioterapista'
    if (r === 'team manager') return 'Team Manager'
    if (r === 'preparatore atletico' || r === 'preparatore') return 'Preparatore Atletico'
    if (r === 'dirigente' || r === 'director') return 'Dirigente'
    if (r === 'segreteria') return 'Segreteria'
    if (r === 'staff') return 'Staff'
    return role
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleEditUser = (user: User) => {
    if (!user.person_id) {
      alert('Questo account non è collegato a una scheda persona. Apri Anagrafiche e completa il collegamento prima di modificarne l’accesso.')
      return
    }
    navigate(`/create-person?edit=${user.person_id}&tab=flowme&from=/users-management`)
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${userName}"?`)) {
      return
    }

    try {
      // Elimina dalla tabella profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (profileError) throw profileError

      // Ricarica la lista
      loadUsers()
      alert('Utente eliminato con successo!')
    } catch (error) {
      console.error('Errore nell\'eliminazione utente:', error)
      alert('Errore nell\'eliminazione dell\'utente')
    }
  }

  return (
    <div className={`min-h-full ${embedInLayout ? 'bg-gray-50' : 'min-h-screen bg-gradient-to-br from-gray-50 to-blue-50'}`}>
      {!embedInLayout && (
        <Header 
          title="Gestione Utenti" 
          showBack={true}
          showSettings={false}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">👥</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Totale Utenti</h3>
                <p className="text-3xl font-bold text-blue-600">{users.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">👑</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Amministratori</h3>
                <p className="text-3xl font-bold text-red-600">
                  {users.filter(u => u.role?.toLowerCase() === 'admin').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">🏃‍♂️</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Allenatori</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {users.filter(u => ['coach', 'allenatore'].includes(u.role?.toLowerCase() || '')).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <span className="text-2xl">⚕️</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Staff</h3>
                <p className="text-3xl font-bold text-green-600">
                  {users.filter(u => {
                    const r = u.role?.toLowerCase() || ''
                    return ['staff', 'medic', 'medico', 'director', 'dirigente', 'team manager', 'fisioterapista', 'fisio', 'preparatore atletico', 'preparatore', 'segreteria'].includes(r)
                  }).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtri */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cerca utente
              </label>
              <input
                type="text"
                placeholder="Nome o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-500 bg-white"
              />
            </div>
            <div className="md:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtra per ruolo
              </label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="all">Tutti i ruoli</option>
                <option value="Admin">Amministratore</option>
                <option value="Allenatore">Allenatore</option>
                <option value="Team Manager">Team Manager</option>
                <option value="Medico">Medico</option>
                <option value="Fisioterapista">Fisioterapista</option>
                <option value="Preparatore Atletico">Preparatore Atletico</option>
                <option value="Dirigente">Dirigente</option>
                <option value="Segreteria">Segreteria</option>
                <option value="Staff">Staff</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista utenti */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Elenco Utenti ({filteredUsers.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ruolo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefono
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Creato il
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-2xl mb-2">⏳</div>
                      <p className="text-gray-500">Caricamento utenti...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-2xl mb-2 text-gray-400">👥</div>
                      <p className="text-gray-500">Nessun utente trovato</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-lg">👤</span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.full_name || `${user.first_name} ${user.last_name}`}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {user.id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Apri scheda persona e accessi"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-slate-500 hover:text-slate-800 transition-colors"
                            title="Gli accessi si gestiscono dalla scheda persona"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
