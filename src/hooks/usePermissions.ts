import { useState, useEffect } from 'react'
import { useAuth } from '@/store/auth'
import { supabase } from '@/lib/supabaseClient'
import { normalizeTeamflowRoleName } from '@teamflow/shared'

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
    if (profile?.is_super_admin) {
      const { data: allPermissions, error } = await supabase
        .from('permissions')
        .select('id, name, description, category, position_order')
        .order('position_order')

      if (error) console.warn('Errore nel caricamento catalogo Super Admin:', error)
      setPermissions((allPermissions || []) as Permission[])
      setUserRole({ id: 'super-admin', name: 'Super Admin', position_order: -1 })
      setLoading(false)
      return
    }

    if (!profile?.role) {
      setPermissions([])
      setUserRole(null)
      return
    }

    try {
      setLoading(true)
      
      const canonicalRole = normalizeTeamflowRoleName(profile.role)
      let roleQuery = supabase.from('user_roles').select('*')
      roleQuery = profile.user_role_id
        ? roleQuery.eq('id', profile.user_role_id)
        : roleQuery.ilike('name', canonicalRole || profile.role)

      const { data: roleData, error: roleError } = await roleQuery.maybeSingle()

      if (roleError || !roleData) {
        console.warn('Ruolo non trovato o non leggibile in user_roles:', profile.role, roleError)
        setPermissions([])
        setUserRole(null)
        return
      }
      
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
        .eq('role_id', roleData.id)

      if (permError) {
        console.warn('Errore nel caricamento permessi dal database:', permError)
        setPermissions([])
        return
      }
      
      // Permessi di base del ruolo
      const rolePermissions = (permData
        ?.map(rp => rp.permissions)
        .filter(Boolean)
        .flat() || []) as Permission[]
      
      // Carica i permessi personalizzati dell'utente
      const { data: customPerms, error: customError } = await supabase
        .from('user_permissions')
        .select(`
          permission_id,
          is_granted,
          permissions (
            id,
            name,
            description,
            category,
            position_order
          )
        `)
        .eq('user_id', profile.id)

      if (customError) {
        console.warn('Errore nel caricamento permessi personalizzati:', customError)
        // Se errore, usa solo i permessi del ruolo
        setPermissions(rolePermissions || [])
        return
      }

      // Combina permessi: (permessi ruolo + aggiunti) - rimossi
      const permissionsMap = new Map<string, Permission>()
      
      // Aggiungi tutti i permessi del ruolo
      rolePermissions?.forEach(perm => {
        permissionsMap.set(perm.name, perm)
      })
      
      // Applica permessi personalizzati (gestisce record senza join valido)
      customPerms?.forEach(cp => {
        const perm = (cp?.permissions ?? null) as unknown as Permission | null
        if (!perm || !perm.name) {
          return
        }
        if (cp.is_granted) {
          // Aggiungi permesso personalizzato
          permissionsMap.set(perm.name, perm)
        } else {
          // Rimuovi permesso del ruolo
          permissionsMap.delete(perm.name)
        }
      })
      
      setPermissions(Array.from(permissionsMap.values()))
      
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
  }, [profile?.id, profile?.role, profile?.user_role_id, profile?.is_super_admin])

  // Controlla se l'utente ha un permesso specifico
  const hasPermission = (permissionName: string): boolean => {
    if (profile?.is_super_admin) return true
    if (!permissions || permissions.length === 0) return false
    return permissions.some(permission => permission.name === permissionName)
  }

  // Controlla se l'utente ha un permesso in una categoria
  const hasPermissionInCategory = (category: string, permissionName: string): boolean => {
    if (profile?.is_super_admin) return true
    if (!permissions || permissions.length === 0) return false
    return permissions.some(permission => 
      permission.category === category && permission.name === permissionName
    )
  }

  // Controlla se l'utente ha almeno un permesso in una categoria
  const hasAnyPermissionInCategory = (category: string): boolean => {
    if (profile?.is_super_admin) return true
    if (!permissions || permissions.length === 0) return false
    return permissions.some(permission => permission.category === category)
  }

  // Controlla se l'utente è admin
  const isAdmin = (): boolean => {
    return profile?.is_super_admin === true || userRole?.name === 'Admin'
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
    return userRole?.name === 'Giocatore' || userRole?.name === 'Player'
  }

  // Controlla se l'utente è preparatore
  const isPreparatore = (): boolean => {
    return userRole?.name === 'Preparatore Atletico' || userRole?.name === 'Preparatore'
  }

  // Controlla se l'utente è medico
  const isMedico = (): boolean => {
    return userRole?.name === 'Medico'
  }

  // Controlla se l'utente è fisio
  const isFisio = (): boolean => {
    return userRole?.name === 'Fisioterapista' || userRole?.name === 'Fisio'
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
