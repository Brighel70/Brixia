import { useState, useEffect } from 'react'
import { useAuth } from '@/store/auth'
import { supabase } from '@/lib/supabaseClient'

export interface Permission {
  id: string
  name: string
  description: string
  category: string
  position_order: number
}

export interface UserRole {
  id: string
  name: string
  position_order: number
}

export const usePermissions = () => {
  const { profile } = useAuth()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(false)

  const loadUserPermissions = async () => {
    if (!profile?.user_role_id) {
      setPermissions([])
      setUserRole(null)
      return
    }

    try {
      setLoading(true)
      
      // Carica il ruolo dell'utente
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('id', profile.user_role_id)
        .single()

      if (roleError) throw roleError
      setUserRole(roleData)

      // Carica i permessi del ruolo
      const { data: permData, error: permError } = await supabase
        .from('role_permissions')
        .select(`
          permission_id,
          permissions (
            id,
            name,
            description,
            category,
            position_order
          )
        `)
        .eq('role_id', profile.user_role_id)

      if (permError) throw permError
      
      const userPermissions = permData
        ?.map(rp => rp.permissions)
        .filter(Boolean) as Permission[]
      
      setPermissions(userPermissions || [])
      
    } catch (error) {
      console.error('Errore nel caricamento permessi:', error)
      // In caso di errore, imposta permessi vuoti e continua
      setPermissions([])
      setUserRole(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUserPermissions()
  }, [profile?.id])

  // Controlla se l'utente ha un permesso specifico
  const hasPermission = (permissionName: string): boolean => {
    if (!permissions || permissions.length === 0) return false
    return permissions.some(permission => permission.name === permissionName)
  }

  // Controlla se l'utente ha un permesso in una categoria
  const hasPermissionInCategory = (category: string, permissionName: string): boolean => {
    if (!permissions || permissions.length === 0) return false
    return permissions.some(permission => 
      permission.category === category && permission.name === permissionName
    )
  }

  // Controlla se l'utente ha almeno un permesso in una categoria
  const hasAnyPermissionInCategory = (category: string): boolean => {
    if (!permissions || permissions.length === 0) return false
    return permissions.some(permission => permission.category === category)
  }

  // Controlla se l'utente è admin
  const isAdmin = (): boolean => {
    return userRole?.name === 'Admin'
  }

  // Controlla se l'utente è dirigente
  const isDirigente = (): boolean => {
    return userRole?.name === 'Dirigente'
  }

  // Controlla se l'utente è segreteria
  const isSegreteria = (): boolean => {
    return userRole?.name === 'Segreteria'
  }

  // Controlla se l'utente è direttore sportivo
  const isDirettoreSportivo = (): boolean => {
    return userRole?.name === 'Direttore Sportivo'
  }

  // Controlla se l'utente è direttore tecnico
  const isDirettoreTecnico = (): boolean => {
    return userRole?.name === 'Direttore Tecnico'
  }

  // Controlla se l'utente è allenatore
  const isAllenatore = (): boolean => {
    return userRole?.name === 'Allenatore'
  }

  // Controlla se l'utente è team manager
  const isTeamManager = (): boolean => {
    return userRole?.name === 'Team Manager'
  }

  // Controlla se l'utente è accompagnatore
  const isAccompagnatore = (): boolean => {
    return userRole?.name === 'Accompagnatore'
  }

  // Controlla se l'utente è player
  const isPlayer = (): boolean => {
    return userRole?.name === 'Player'
  }

  // Controlla se l'utente è preparatore
  const isPreparatore = (): boolean => {
    return userRole?.name === 'Preparatore'
  }

  // Controlla se l'utente è medico
  const isMedico = (): boolean => {
    return userRole?.name === 'Medico'
  }

  // Controlla se l'utente è fisio
  const isFisio = (): boolean => {
    return userRole?.name === 'Fisio'
  }

  // Controlla se l'utente è famiglia
  const isFamiglia = (): boolean => {
    return userRole?.name === 'Famiglia'
  }

  return {
    permissions,
    userRole,
    loading,
    hasPermission,
    hasPermissionInCategory,
    hasAnyPermissionInCategory,
    isAdmin,
    isDirigente,
    isSegreteria,
    isDirettoreSportivo,
    isDirettoreTecnico,
    isAllenatore,
    isTeamManager,
    isAccompagnatore,
    isPlayer,
    isPreparatore,
    isMedico,
    isFisio,
    isFamiglia,
    reloadPermissions: loadUserPermissions
  }
}


