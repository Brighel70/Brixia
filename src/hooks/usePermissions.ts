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
    // DISABILITATO TEMPORANEAMENTE - Ritorna sempre permessi vuoti
    setLoading(true)
    setPermissions([])
    setUserRole(null)
    setLoading(false)
    
    // Codice originale commentato
    /*
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
    */
  }

  useEffect(() => {
    loadUserPermissions()
  }, [profile?.id])

  // Controlla se l'utente ha un permesso specifico
  const hasPermission = (permissionName: string): boolean => {
    // DISABILITATO - Ritorna sempre true per permettere la navigazione
    return true
  }

  // Controlla se l'utente ha un permesso in una categoria
  const hasPermissionInCategory = (category: string, permissionName: string): boolean => {
    // DISABILITATO - Ritorna sempre true per permettere la navigazione
    return true
  }

  // Controlla se l'utente ha almeno un permesso in una categoria
  const hasAnyPermissionInCategory = (category: string): boolean => {
    // DISABILITATO - Ritorna sempre true per permettere la navigazione
    return true
  }

  // Controlla se l'utente è admin
  const isAdmin = (): boolean => {
    return true // DISABILITATO - Ritorna sempre true
  }

  // Controlla se l'utente è coach
  const isCoach = (): boolean => {
    return true // DISABILITATO - Ritorna sempre true
  }

  // Controlla se l'utente è medic
  const isMedic = (): boolean => {
    return true // DISABILITATO - Ritorna sempre true
  }

  // Controlla se l'utente è director
  const isDirector = (): boolean => {
    return true // DISABILITATO - Ritorna sempre true
  }

  return {
    permissions,
    userRole,
    loading,
    hasPermission,
    hasPermissionInCategory,
    hasAnyPermissionInCategory,
    isAdmin,
    isCoach,
    isMedic,
    isDirector,
    reloadPermissions: loadUserPermissions
  }
}


