import React from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/config/permissions'

export const UserPermissions: React.FC = () => {
  const { permissions, userRole, loading } = usePermissions()

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Caricamento permessi...</p>
      </div>
    )
  }

  if (!permissions.length) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Nessun permesso assegnato</p>
      </div>
    )
  }

  // Raggruppa i permessi per categoria
  const groupedPermissions = permissions.reduce((acc, permission) => {
    const category = permission.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(permission)
    return acc
  }, {} as Record<string, typeof permissions>)

  return (
    <div className="space-y-4">
      {/* Ruolo dell'utente */}
      {userRole && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">
            👤 Ruolo: {userRole.name}
          </h3>
          <p className="text-sm text-blue-600">
            Posizione: {userRole.position_order}
          </p>
        </div>
      )}

      {/* Permessi raggruppati per categoria */}
      <div className="space-y-4">
        {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
          <div key={category} className="border rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
              <span className="mr-2">
                {category === 'activities' && '📊'}
                {category === 'users' && '👥'}
                {category === 'players' && '🏉'}
                {category === 'categories' && '📁'}
                {category === 'sessions' && '📅'}
                {category === 'system' && '⚙️'}
                {category === 'reports' && '📈'}
                {!['activities', 'users', 'players', 'categories', 'sessions', 'system', 'reports'].includes(category) && '🔑'}
              </span>
              {category.charAt(0).toUpperCase() + category.slice(1)}
              <span className="ml-2 text-sm text-gray-500">
                ({categoryPermissions.length} permessi)
              </span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {categoryPermissions.map((permission) => (
                <div key={permission.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">
                    {permission.name}
                  </span>
                  {permission.description && (
                    <span className="text-xs text-gray-500">
                      - {permission.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Riepilogo totale */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-700">
            {permissions.length}
          </div>
          <div className="text-sm text-green-600">
            Permessi totali assegnati
          </div>
        </div>
      </div>
    </div>
  )
}

// Componente compatto per mostrare solo il conteggio
export const PermissionsBadge: React.FC = () => {
  const { permissions, loading } = usePermissions()

  if (loading) {
    return <span className="text-gray-400">...</span>
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
      🔑 {permissions.length} permessi
    </span>
  )
}




