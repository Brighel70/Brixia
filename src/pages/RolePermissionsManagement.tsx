import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabaseClient'
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, getRolePermissions } from '@/config/permissions'

interface RolePermissionData {
  role: string
  permissions: string[]
}

export default function RolePermissionsManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rolePermissions, setRolePermissions] = useState<RolePermissionData[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('')

  useEffect(() => {
    loadRolePermissions()
  }, [])

  const loadRolePermissions = () => {
    const permissions: RolePermissionData[] = []
    
    Object.entries(ROLE_PERMISSIONS).forEach(([role, rolePerms]) => {
      permissions.push({
        role,
        permissions: rolePerms
      })
    })
    
    setRolePermissions(permissions)
    if (permissions.length > 0) {
      setSelectedRole(permissions[0].role)
    }
  }

  const handlePermissionToggle = (permission: string) => {
    if (!selectedRole) return

    setRolePermissions(prev => prev.map(rp => {
      if (rp.role === selectedRole) {
        return {
          ...rp,
          permissions: rp.permissions.includes(permission)
            ? rp.permissions.filter(p => p !== permission)
            : [...rp.permissions, permission]
        }
      }
      return rp
    }))
  }

  const handleSaveChanges = async () => {
    if (!selectedRole) return

    try {
      setLoading(true)
      setError('')
      
      // Qui potresti salvare nel database se hai una tabella per i permessi dei ruoli
      // Per ora salvo solo in memoria
      
      setSuccess(`Permessi aggiornati per il ruolo ${selectedRole}`)
      
      // Reset del messaggio dopo 3 secondi
      setTimeout(() => setSuccess(''), 3000)
      
    } catch (error: any) {
      setError(error.message || 'Errore nel salvataggio dei permessi')
    } finally {
      setLoading(false)
    }
  }

  const handleResetToDefault = () => {
    if (!selectedRole) return

    const defaultPermissions = getRolePermissions(selectedRole)
    
    setRolePermissions(prev => prev.map(rp => {
      if (rp.role === selectedRole) {
        return {
          ...rp,
          permissions: defaultPermissions
        }
      }
      return rp
    }))
    
    setSuccess(`Permessi ripristinati ai valori di default per ${selectedRole}`)
    setTimeout(() => setSuccess(''), 3000)
  }

  const getSelectedRolePermissions = () => {
    return rolePermissions.find(rp => rp.role === selectedRole)?.permissions || []
  }

  const getAllPermissions = () => {
    const permissionsByCategory: { [key: string]: { [key: string]: string } } = {}
    
    Object.entries(PERMISSIONS).forEach(([categoryName, categoryPermissions]) => {
      permissionsByCategory[categoryName] = categoryPermissions
    })
    
    return permissionsByCategory
  }

  const isPermissionActive = (permission: string) => {
    return getSelectedRolePermissions().includes(permission)
  }

  const getRoleStats = () => {
    const totalRoles = Object.keys(ROLES).length
    const totalPermissions = Object.values(PERMISSIONS).flatMap(cat => Object.values(cat)).length
    
    return { totalRoles, totalPermissions }
  }

  const stats = getRoleStats()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Header 
        title="Gestione Permessi Ruoli" 
        showBack={true}
        showSettings={false}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ruoli Totali</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalRoles}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🔐</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Permessi Totali</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalPermissions}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚙️</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Permessi Attivi</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {selectedRole ? getSelectedRolePermissions().length : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestione Permessi Ruoli</h1>
            <p className="text-gray-600">
              Configura i permessi per ogni ruolo del sistema. Modifica e personalizza l'accesso per ogni tipo di utente.
            </p>
          </div>

          {/* Selezione Ruolo */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Seleziona Ruolo da Configurare
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {rolePermissions.map((roleData) => (
                <button
                  key={roleData.role}
                  onClick={() => setSelectedRole(roleData.role)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedRole === roleData.role
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="font-medium">{roleData.role}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {roleData.permissions.length} permessi
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Configurazione Permessi */}
          {selectedRole && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Permessi per: <span className="text-blue-600">{selectedRole}</span>
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={handleResetToDefault}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    🔄 Ripristina Predefiniti
                  </button>
                  <button
                    onClick={handleSaveChanges}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Salvataggio...' : '💾 Salva Modifiche'}
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(getAllPermissions()).map(([categoryName, categoryPermissions]) => (
                  <div key={categoryName} className="border border-gray-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 text-lg capitalize">
                      {categoryName.replace('_', ' ').replace(/PLAYERS/g, 'Giocatori').replace(/EVENTS/g, 'Eventi').replace(/SESSIONS/g, 'Sessioni').replace(/ATTENDANCE/g, 'Presenze').replace(/STAFF/g, 'Staff').replace(/CATEGORIES/g, 'Categorie').replace(/SETTINGS/g, 'Impostazioni').replace(/USERS/g, 'Utenti').replace(/COUNCIL/g, 'Consiglio').replace(/BRAND/g, 'Brand')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(categoryPermissions).map(([permKey, permission]) => (
                        <label key={permission} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isPermissionActive(permission)}
                            onChange={() => handlePermissionToggle(permission)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                              <span className="text-sm font-medium text-gray-700">
                                {permKey.replace('_', ' ').replace(/VIEW/g, 'Visualizza').replace(/CREATE/g, 'Crea').replace(/EDIT/g, 'Modifica').replace(/DELETE/g, 'Elimina').replace(/EXPORT/g, 'Esporta').replace(/START/g, 'Avvia').replace(/STOP/g, 'Ferma').replace(/MARK/g, 'Segna').replace(/ROLES/g, 'Ruoli').replace(/MANAGE/g, 'Gestisci')}
                              </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!selectedRole && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎭</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Seleziona un Ruolo</h3>
              <p className="text-gray-600">Scegli un ruolo dalla lista sopra per configurare i suoi permessi.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
