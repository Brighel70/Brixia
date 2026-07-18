import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { ArrowLeft } from 'lucide-react'
import Header from '@/components/Header'
import { PERMISSIONS, getRolePermissions } from '@/config/permissions'

interface UserForm {
  first_name: string
  last_name: string
  email: string
  role: string
  phone: string
  fir_code: string
  categories: string[]
  customPermissions: string[] // Permessi personalizzati
}

interface EditUserProps {
  embedInLayout?: boolean
}

export default function EditUser({ embedInLayout = false }: EditUserProps) {
  const navigate = useNavigate()
  const { userId } = useParams()
  const [loading, setLoading] = useState(false)
  const [loadingUser, setLoadingUser] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [userRoles, setUserRoles] = useState<any[]>([])
  
  const [form, setForm] = useState<UserForm>({
    first_name: '',
    last_name: '',
    email: '',
    role: '',
    phone: '',
    fir_code: '',
    categories: [],
    customPermissions: []
  })

  useEffect(() => {
    if (userId) {
      loadUserData()
      loadCategories()
      loadUserRoles()
    }
  }, [userId])

  const loadUserData = async () => {
    try {
      setLoadingUser(true)
      
      // Carica i dati dell'utente dalla tabella profiles
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          role,
          user_role_id,
          phone,
          fir_code
        `)
        .eq('id', userId)
        .single()

      if (userError) throw userError

      console.log('🔍 Dati utente caricati:', userData)

      // Determina il ruolo dell'utente (prova prima 'role', poi 'user_role_id')
      let userRole = userData.role
      if (!userRole && userData.user_role_id) {
        // Se role è NULL ma user_role_id esiste, carica il ruolo dalla tabella user_roles
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('name')
          .eq('id', userData.user_role_id)
          .single()
        
        if (roleData) {
          userRole = roleData.name
        }
      }

      console.log('🔍 Ruolo determinato:', userRole)

      // Carica anche le categorie assegnate all'utente
      const { data: userCategories, error: categoriesError } = await supabase
        .from('staff_categories')
        .select('category_id')
        .eq('user_id', userId)

      if (categoriesError) {
        console.warn('Errore nel caricamento categorie utente:', categoriesError)
      }

      // Carica i permessi personalizzati dell'utente
      const { data: customPerms, error: permsError } = await supabase
        .from('user_permissions')
        .select(`
          permission_id,
          is_granted,
          permissions (
            name
          )
        `)
        .eq('user_id', userId)
        .eq('is_granted', true) // Solo i permessi aggiunti

      if (permsError) {
        console.warn('Errore nel caricamento permessi personalizzati:', permsError)
      }

      // Estrai i nomi dei permessi personalizzati
      const customPermissions = customPerms
        ?.map(cp => (cp.permissions as any)?.name)
        .filter(Boolean) || []

      setForm({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        role: userRole || 'giocatore', // Usa il ruolo determinato o fallback a 'giocatore'
        phone: userData.phone || '',
        fir_code: userData.fir_code || '',
        categories: userCategories?.map(uc => uc.category_id) || [],
        customPermissions: customPermissions
      })
    } catch (error: any) {
      console.error('Errore nel caricamento utente:', error)
      setError('Errore nel caricamento dei dati utente')
    } finally {
      setLoadingUser(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, code')
        .eq('active', true)
        .order('sort')

      if (error) throw error
      
      console.log('🔍 Categorie caricate:', data)
      
      // Se non ci sono categorie, crea alcune di default per il test
      if (!data || data.length === 0) {
        console.warn('⚠️ Nessuna categoria trovata nel database, creo categorie di default')
        const defaultCategories = [
          { id: 'temp-1', name: 'Under 14', code: 'U14' },
          { id: 'temp-2', name: 'Under 16', code: 'U16' },
          { id: 'temp-3', name: 'Under 18', code: 'U18' },
          { id: 'temp-4', name: 'Senior', code: 'SEN' }
        ]
        setCategories(defaultCategories)
      } else {
        setCategories(data || [])
      }
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

        const loadUserRoles = async () => {
          try {
            // Ruoli corretti: mantieni tutti tranne quelli rimossi, aggiungi Giocatore, Familiare e Tutor
            const availableRoles = [
              { id: 'admin', name: 'Admin' },
              { id: 'dirigente', name: 'Dirigente' },
              { id: 'segreteria', name: 'Segreteria' },
              { id: 'direttore-sportivo', name: 'Direttore Sportivo' },
              { id: 'direttore-tecnico', name: 'Direttore Tecnico' },
              { id: 'allenatore', name: 'Allenatore' },
              { id: 'giocatore', name: 'Giocatore' },
              { id: 'preparatore', name: 'Preparatore Atletico' },
              { id: 'team-manager', name: 'Team Manager' },
              { id: 'accompagnatore', name: 'Accompagnatore' },
              { id: 'medico', name: 'Medico' },
              { id: 'fisio', name: 'Fisioterapista' },
              { id: 'familiare', name: 'Familiare' },
              { id: 'tutor', name: 'Tutor' }
            ]
            
            console.log('🔍 Ruoli caricati:', availableRoles)
            setUserRoles(availableRoles)
          } catch (error) {
            console.error('Errore nel caricamento ruoli:', error)
          }
        }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!userId) {
      setError('ID utente non valido')
      return
    }

    try {
      setLoading(true)

      // Aggiorna il profilo nella tabella profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          role: form.role,
          phone: form.phone || null,
          fir_code: form.fir_code || null,
          full_name: `${form.first_name} ${form.last_name}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (profileError) throw profileError

      // Aggiorna anche la persona nella tabella people se esiste
      const { error: personError } = await supabase
        .from('people')
        .update({
          full_name: `${form.first_name} ${form.last_name}`,
          given_name: form.first_name,
          family_name: form.last_name,
          email: form.email,
          phone: form.phone || null,
          staff_roles: [form.role],
          staff_categories: form.categories,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (personError) {
        console.warn('Errore nell\'aggiornamento persona:', personError)
        // Non bloccare il processo se la persona non esiste
      }

      // Aggiorna le categorie staff
      // Prima rimuovi tutte le categorie esistenti
      const { error: deleteError } = await supabase
        .from('staff_categories')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        console.warn('Errore nella rimozione categorie:', deleteError)
      }

      // Poi aggiungi le nuove categorie (solo se il ruolo non è Giocatore)
      if (form.role !== 'giocatore' && form.categories.length > 0) {
        const categoryLinks = form.categories.map(categoryId => ({
          user_id: userId,
          category_id: categoryId
        }))

        const { error: categoryError } = await supabase
          .from('staff_categories')
          .insert(categoryLinks)

        if (categoryError) {
          console.warn('Errore nell\'aggiornamento categorie:', categoryError)
        }
      }

      // Gestisci i permessi personalizzati
      if (form.customPermissions.length > 0) {
        // Rimuovi tutti i permessi personalizzati esistenti
        await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', userId)

        // Ottieni gli ID dei permessi dalla tabella permissions
        const { data: permissionsData } = await supabase
          .from('permissions')
          .select('id, name')
          .in('name', form.customPermissions)

        if (permissionsData && permissionsData.length > 0) {
          // Inserisci i nuovi permessi personalizzati
          const userPermsToInsert = permissionsData.map(perm => ({
            user_id: userId,
            permission_id: perm.id,
            is_granted: true
          }))

          const { error: permsError } = await supabase
            .from('user_permissions')
            .insert(userPermsToInsert)

          if (permsError) {
            console.warn('Errore nell\'aggiornamento permessi personalizzati:', permsError)
          }
        }
      } else {
        // Se non ci sono permessi personalizzati, rimuovi tutti quelli esistenti
        await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', userId)
      }

      setSuccess('Utente aggiornato con successo!')
      
      // Redirect dopo 2 secondi
      setTimeout(() => {
        navigate('/users-management')
      }, 2000)

    } catch (error: any) {
      console.error('Errore nell\'aggiornamento utente:', error)
      setError(error.message || 'Errore nell\'aggiornamento utente')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof UserForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleCategoryToggle = (categoryId: string) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter(id => id !== categoryId)
        : [...prev.categories, categoryId]
    }))
  }

  // Gestione permessi personalizzati
  const handlePermissionToggle = (permission: string) => {
    setForm(prev => ({
      ...prev,
      customPermissions: prev.customPermissions.includes(permission)
        ? prev.customPermissions.filter(p => p !== permission)
        : [...prev.customPermissions, permission]
    }))
  }

  const getAllPermissions = () => {
    const permissionsByCategory: { [key: string]: { [key: string]: string } } = {}
    
    Object.entries(PERMISSIONS).forEach(([categoryName, categoryPermissions]) => {
      permissionsByCategory[categoryName] = categoryPermissions
    })
    
    return permissionsByCategory
  }

  const getDefaultPermissionsForRole = (role: string) => {
    return getRolePermissions(role)
  }

  const isPermissionActive = (permission: string) => {
    const defaultPermissions = getDefaultPermissionsForRole(form.role)
    return form.customPermissions.includes(permission) || defaultPermissions.includes(permission)
  }

  if (loadingUser) {
    return (
      <div className={`min-h-full ${embedInLayout ? 'bg-gray-50' : 'min-h-screen bg-gradient-to-br from-gray-50 to-blue-50'}`}>
        {!embedInLayout && (
          <Header 
            title="Modifica Utente" 
            showBack={true}
            showSettings={false}
          />
        )}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="text-2xl mb-2">⏳</div>
            <p className="text-gray-500">Caricamento dati utente...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={`min-h-full ${embedInLayout ? 'bg-gray-50' : 'min-h-screen bg-gradient-to-br from-gray-50 to-blue-50'}`}>
      {!embedInLayout && (
        <Header 
          title="Modifica Utente" 
          showBack={true}
          showSettings={false}
        />
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tasto per tornare a Gestione Utenti quando embedded */}
        {embedInLayout && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate('/users-management')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={18} />
              Torna a Gestione Utenti
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Modifica Utente</h1>
            <p className="text-gray-600 mt-2">Aggiorna le informazioni dell'utente</p>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  value={form.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cognome *
                </label>
                <input
                  type="text"
                  required
                  value={form.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Cognome"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefono
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+39 123 456 7890"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ruolo *
                </label>
                <select
                  required
                  value={form.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleziona ruolo</option>
                  {userRoles.map(role => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Codice FIR
                </label>
                <input
                  type="text"
                  value={form.fir_code}
                  onChange={(e) => handleInputChange('fir_code', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="FIR-001"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categorie (seleziona almeno una) *
              </label>
              {categories.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ Nessuna categoria disponibile. Contatta l'amministratore per configurare le categorie del sistema.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {categories.map(category => (
                      <label key={category.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={form.categories.includes(category.id)}
                          onChange={() => handleCategoryToggle(category.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {category.code}
                        </span>
                      </label>
                    ))}
                  </div>
                  {form.categories.length === 0 && (
                    <p className="text-red-500 text-sm mt-1">Seleziona almeno una categoria</p>
                  )}
                </>
              )}
            </div>

            {/* Permessi Personalizzati */}
            {form.role && form.role !== 'giocatore' && (
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🔐 Permessi Personalizzati
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Personalizza i permessi per questo utente. I permessi di default del ruolo sono già inclusi.
                </p>
                
                <div className="space-y-6">
                  {Object.entries(getAllPermissions()).map(([categoryName, categoryPermissions]) => (
                    <div key={categoryName} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3 capitalize">
                        {categoryName.replace('_', ' ').replace(/PLAYERS/g, 'Giocatori').replace(/EVENTS/g, 'Eventi').replace(/SESSIONS/g, 'Sessioni').replace(/ATTENDANCE/g, 'Presenze').replace(/STAFF/g, 'Staff').replace(/CATEGORIES/g, 'Categorie').replace(/SETTINGS/g, 'Impostazioni').replace(/USERS/g, 'Utenti').replace(/COUNCIL/g, 'Consiglio').replace(/BRAND/g, 'Brand')}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(categoryPermissions).map(([permKey, permission]) => {
                          const isDefault = getDefaultPermissionsForRole(form.role).includes(permission)
                          const isCustom = form.customPermissions.includes(permission)
                          const isActive = isDefault || isCustom
                          
                          return (
                            <label key={permission} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={isActive}
                                onChange={() => handlePermissionToggle(permission)}
                                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                              />
                              <span className={`text-sm ${
                                isDefault 
                                  ? 'text-blue-700 font-medium' 
                                  : isCustom 
                                  ? 'text-green-700 font-medium' 
                                  : 'text-gray-700'
                              }`}>
                                {permKey.replace('_', ' ').replace(/VIEW/g, 'Visualizza').replace(/CREATE/g, 'Crea').replace(/EDIT/g, 'Modifica').replace(/DELETE/g, 'Elimina').replace(/EXPORT/g, 'Esporta').replace(/START/g, 'Avvia').replace(/STOP/g, 'Ferma').replace(/MARK/g, 'Segna').replace(/ROLES/g, 'Ruoli').replace(/MANAGE/g, 'Gestisci')}
                                {isDefault && <span className="ml-1 text-xs">(predefinito)</span>}
                                {isCustom && !isDefault && <span className="ml-1 text-xs">(personalizzato)</span>}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>💡 Suggerimento:</strong> I permessi contrassegnati con "(predefinito)" sono inclusi automaticamente nel ruolo selezionato. 
                    Puoi aggiungere permessi aggiuntivi o rimuovere quelli predefiniti per personalizzare l'accesso.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-4 pt-6">
              <button
                type="button"
                onClick={() => navigate('/users-management')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading || form.categories.length === 0}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Aggiornamento...' : 'Aggiorna Utente'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
