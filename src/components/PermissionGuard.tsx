import React from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface PermissionGuardProps {
  children: React.ReactNode
  requiredPermission?: string
  requiredCategory?: string
  requiredRole?: 'Admin' | 'Dirigente' | 'Segreteria' | 'Direttore Sportivo' | 'Direttore Tecnico' | 'Allenatore' | 'Team Manager' | 'Accompagnatore' | 'Player' | 'Preparatore' | 'Medico' | 'Fisio' | 'Famiglia'
  fallback?: React.ReactNode
  showFallback?: boolean
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermission,
  requiredCategory,
  requiredRole,
  fallback = null,
  showFallback = false
}) => {
  const { 
    permissions,
    userRole,
    hasPermission, 
    hasPermissionInCategory, 
    hasAnyPermissionInCategory,
    isAdmin,
    isAllenatore,
    isMedico,
    isDirettoreSportivo,
    loading 
  } = usePermissions()

  // Se sta caricando, mostra i children (evita flash di contenuto)
  if (loading) {
    return <>{children}</>
  }

  // BYPASS COMPLETO PER ADMIN - Gli admin possono accedere a tutto
  if (isAdmin()) {
    return <>{children}</>
  }

  // Se non ci sono permessi (utente non autenticato o senza permessi), 
  // blocca l'accesso per sicurezza
  if (!permissions || permissions.length === 0) {
    return showFallback ? <>{fallback}</> : (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Accesso Negato</h2>
          <p className="text-gray-600 mb-4">
            Non hai i permessi necessari per accedere a questa sezione.
          </p>
          <p className="text-sm text-gray-500">
            Contatta l'amministratore per ottenere l'accesso.
          </p>
        </div>
      </div>
    )
  }

  // Controllo ruolo richiesto
  if (requiredRole) {
    const hasRole = userRole?.name === requiredRole
    if (!hasRole) {
      return showFallback ? <>{fallback}</> : null
    }
  }

  // Controllo permesso specifico
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return showFallback ? <>{fallback}</> : null
  }

  // Controllo permesso in categoria
  if (requiredCategory && requiredPermission && !hasPermissionInCategory(requiredCategory, requiredPermission)) {
    return showFallback ? <>{fallback}</> : null
  }

  // Controllo categoria generica
  if (requiredCategory && !requiredPermission && !hasAnyPermissionInCategory(requiredCategory)) {
    return showFallback ? <>{fallback}</> : null
  }

  // Se tutti i controlli passano, mostra i children
  return <>{children}</>
}

// Componenti di convenienza per permessi comuni
export const AdminOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Admin" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const DirigenteOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Dirigente" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const SegreteriaOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Segreteria" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const DirettoreSportivoOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Direttore Sportivo" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const DirettoreTecnicoOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Direttore Tecnico" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const AllenatoreOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Allenatore" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const TeamManagerOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Team Manager" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const AccompagnatoreOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Accompagnatore" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const PlayerOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Player" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const PreparatoreOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Preparatore" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const MedicoOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Medico" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const FisioOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Fisio" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const FamigliaOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="Famiglia" fallback={fallback}>
    {children}
  </PermissionGuard>
)




