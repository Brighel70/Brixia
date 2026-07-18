import React from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/store/auth'

export const PermissionsDebug: React.FC = () => {
  const { profile } = useAuth()
  const { 
    permissions, 
    userRole, 
    loading, 
    hasPermission,
    isAdmin,
    isAllenatore 
  } = usePermissions()

  if (loading) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
        <h3 className="font-bold text-yellow-800">🔧 Debug Permessi</h3>
        <p>Caricamento permessi...</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-blue-100 border border-blue-400 rounded-lg">
      <h3 className="font-bold text-blue-800 mb-4">🔧 Debug Sistema Permessi</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Informazioni Utente */}
        <div className="bg-white p-3 rounded">
          <h4 className="font-semibold text-gray-800 mb-2">👤 Utente</h4>
          <p><strong>Nome:</strong> {profile?.full_name || 'N/A'}</p>
          <p><strong>Email:</strong> {profile?.email || 'N/A'}</p>
          <p><strong>Ruolo:</strong> {profile?.role || 'N/A'}</p>
          <p><strong>User Role ID:</strong> {profile?.user_role_id || 'N/A'}</p>
        </div>

        {/* Ruolo e Permessi */}
        <div className="bg-white p-3 rounded">
          <h4 className="font-semibold text-gray-800 mb-2">🔐 Ruolo e Permessi</h4>
          <p><strong>Ruolo Caricato:</strong> {userRole?.name || 'N/A'}</p>
          <p><strong>Numero Permessi:</strong> {permissions.length}</p>
          <p><strong>È Admin:</strong> {isAdmin() ? '✅ Sì' : '❌ No'}</p>
          <p><strong>È Allenatore:</strong> {isAllenatore() ? '✅ Sì' : '❌ No'}</p>
        </div>

        {/* Test Permessi Specifici */}
        <div className="bg-white p-3 rounded">
          <h4 className="font-semibold text-gray-800 mb-2">🧪 Test Permessi</h4>
          <p><strong>players.view:</strong> {hasPermission('players.view') ? '✅' : '❌'}</p>
          <p><strong>players.create:</strong> {hasPermission('players.create') ? '✅' : '❌'}</p>
          <p><strong>events.view:</strong> {hasPermission('events.view') ? '✅' : '❌'}</p>
          <p><strong>settings.edit:</strong> {hasPermission('settings.edit') ? '✅' : '❌'}</p>
        </div>

        {/* Lista Permessi Completa */}
        <div className="bg-white p-3 rounded">
          <h4 className="font-semibold text-gray-800 mb-2">📋 Tutti i Permessi</h4>
          <div className="max-h-32 overflow-y-auto">
            {permissions.length > 0 ? (
              <ul className="text-sm space-y-1">
                {permissions.map((permission, index) => (
                  <li key={index} className="flex justify-between">
                    <span>{permission.name}</span>
                    <span className="text-gray-500">{permission.category}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-red-600">Nessun permesso caricato</p>
            )}
          </div>
        </div>
      </div>

      {/* Stato Sistema */}
      <div className="mt-4 p-3 bg-gray-100 rounded">
        <h4 className="font-semibold text-gray-800 mb-2">⚙️ Stato Sistema</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div className={permissions.length > 0 ? 'text-green-600' : 'text-red-600'}>
            Permessi: {permissions.length > 0 ? '✅' : '❌'}
          </div>
          <div className={userRole ? 'text-green-600' : 'text-red-600'}>
            Ruolo: {userRole ? '✅' : '❌'}
          </div>
          <div className={profile?.user_role_id ? 'text-green-600' : 'text-red-600'}>
            User Role ID: {profile?.user_role_id ? '✅' : '❌'}
          </div>
          <div className={!loading ? 'text-green-600' : 'text-yellow-600'}>
            Caricamento: {loading ? '⏳' : '✅'}
          </div>
        </div>
      </div>
    </div>
  )
}



