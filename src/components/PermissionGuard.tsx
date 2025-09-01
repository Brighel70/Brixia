import React from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface PermissionGuardProps {
  children: React.ReactNode
  requiredPermission?: string
  requiredCategory?: string
  requiredRole?: 'admin' | 'coach' | 'medic' | 'director'
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
    hasPermission, 
    hasPermissionInCategory, 
    hasAnyPermissionInCategory,
    isAdmin,
    isCoach,
    isMedic,
    isDirector,
    loading 
  } = usePermissions()

  // Se sta caricando, mostra i children (evita flash di contenuto)
  if (loading) {
    return <>{children}</>
  }

  // Se non ci sono permessi (utente non autenticato o senza permessi), 
  // mostra i children per permettere la navigazione base
  if (!hasPermission || hasPermission.length === 0) {
    return <>{children}</>
  }

  // Controllo ruolo richiesto
  if (requiredRole) {
    const hasRole = 
      (requiredRole === 'admin' && isAdmin()) ||
      (requiredRole === 'coach' && isCoach()) ||
      (requiredRole === 'medic' && isMedic()) ||
      (requiredRole === 'director' && isDirector())

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
  <PermissionGuard requiredRole="admin" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const CoachOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="coach" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const MedicOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="medic" fallback={fallback}>
    {children}
  </PermissionGuard>
)

export const DirectorOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback 
}) => (
  <PermissionGuard requiredRole="director" fallback={fallback}>
    {children}
  </PermissionGuard>
)




