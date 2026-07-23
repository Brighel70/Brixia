import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabaseClient'

interface PermissionRecord {
  id: string
  name: string
  description: string | null
  category: string
  position_order: number
}

interface RoleRecord {
  id: string
  name: string
  position_order: number
}

interface RolePermissions {
  role: RoleRecord
  permissionIds: string[]
}

export default function RolePermissionsManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [permissions, setPermissions] = useState<PermissionRecord[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermissions[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')

  const loadRolePermissions = async () => {
    setLoading(true)
    setError('')

    const [rolesResult, permissionsResult, mappingsResult] = await Promise.all([
      supabase.from('user_roles').select('id, name, position_order').order('position_order'),
      supabase.from('permissions').select('id, name, description, category, position_order').order('category').order('position_order'),
      supabase.from('role_permissions').select('role_id, permission_id'),
    ])

    const firstError = rolesResult.error || permissionsResult.error || mappingsResult.error
    if (firstError) {
      setError(`Impossibile caricare i permessi: ${firstError.message}`)
      setLoading(false)
      return
    }

    const roleRows = (rolesResult.data || []) as RoleRecord[]
    const permissionIdsByRole = new Map<string, string[]>()
    for (const mapping of mappingsResult.data || []) {
      const current = permissionIdsByRole.get(mapping.role_id) || []
      current.push(mapping.permission_id)
      permissionIdsByRole.set(mapping.role_id, current)
    }

    setPermissions((permissionsResult.data || []) as PermissionRecord[])
    setRolePermissions(roleRows.map((role) => ({
      role,
      permissionIds: permissionIdsByRole.get(role.id) || [],
    })))
    setSelectedRoleId((current) => current || roleRows[0]?.id || '')
    setLoading(false)
  }

  useEffect(() => {
    void loadRolePermissions()
  }, [])

  const selectedRole = rolePermissions.find((item) => item.role.id === selectedRoleId) || null
  const permissionsByCategory = useMemo(() => {
    const result = new Map<string, PermissionRecord[]>()
    for (const permission of permissions) {
      const group = result.get(permission.category) || []
      group.push(permission)
      result.set(permission.category, group)
    }
    return Array.from(result.entries())
  }, [permissions])

  const togglePermission = (permissionId: string) => {
    if (!selectedRole) return
    setRolePermissions((current) => current.map((item) => {
      if (item.role.id !== selectedRole.role.id) return item
      const included = item.permissionIds.includes(permissionId)
      return {
        ...item,
        permissionIds: included
          ? item.permissionIds.filter((id) => id !== permissionId)
          : [...item.permissionIds, permissionId],
      }
    }))
  }

  const saveSelectedRole = async () => {
    if (!selectedRole) return
    setSaving(true)
    setError('')
    setSuccess('')

    const { error: saveError } = await supabase.rpc('admin_replace_role_permissions', {
      p_role_id: selectedRole.role.id,
      p_permission_ids: selectedRole.permissionIds,
    })

    if (saveError) {
      setError(`Impossibile aggiornare i permessi: ${saveError.message}`)
      setSaving(false)
      return
    }

    setSuccess(`Permessi salvati per ${selectedRole.role.name}.`)
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Ruoli e permessi" showBack showSettings={false} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Ruoli e permessi</h1>
            <p className="mt-1 text-sm text-gray-600">
              Le modifiche qui vengono salvate nel database e valgono per TeamFlow e per le regole di accesso collegate.
            </p>
          </div>
          <button type="button" onClick={() => navigate('/users-management')} className="text-sm font-medium text-blue-700 hover:text-blue-900">
            Gestione utenti
          </button>
        </div>

        {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {success && <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</div>}

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">Caricamento ruoli...</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Ruoli</p>
              <div className="space-y-1">
                {rolePermissions.map((item) => (
                  <button
                    key={item.role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(item.role.id)}
                    className={`w-full rounded-md px-3 py-2 text-left transition ${selectedRoleId === item.role.id ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span className="block text-sm font-medium">{item.role.name}</span>
                    <span className="text-xs text-gray-500">{item.permissionIds.length} permessi</span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="rounded-lg border border-gray-200 bg-white">
              {selectedRole ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{selectedRole.role.name}</h2>
                      <p className="text-sm text-gray-600">Seleziona ciò che questo ruolo può fare.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveSelectedRole()}
                      disabled={saving}
                      className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? 'Salvataggio...' : 'Salva permessi'}
                    </button>
                  </div>
                  <div className="space-y-6 p-6">
                    {permissionsByCategory.map(([category, categoryPermissions]) => (
                      <div key={category}>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">{category}</h3>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {categoryPermissions.map((permission) => (
                            <label key={permission.id} className="flex cursor-pointer gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={selectedRole.permissionIds.includes(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-700"
                              />
                              <span>
                                <span className="block text-sm font-medium text-gray-900">{permission.name}</span>
                                {permission.description && <span className="mt-0.5 block text-xs text-gray-600">{permission.description}</span>}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div className="p-8 text-center text-gray-600">Nessun ruolo disponibile.</div>}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
