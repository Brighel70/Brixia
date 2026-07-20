import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/store/auth'
import { PERMISSIONS, getRolePermissions } from '@/config/permissions'

interface UserForm {
  first_name: string
  last_name: string
  email: string
  role: string
  birth_date: string
  fir_code: string
  phone: string
  categories: string[]
  password: string
  confirmPassword: string
  player_name: string // Nome del giocatore collegato (solo per ruolo Giocatore)
  customPermissions: string[] // Permessi personalizzati
}

interface CreateUserProps {
  embedInLayout?: boolean
}

export default function CreateUser({ embedInLayout = false }: CreateUserProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categories, setCategories] = useState<any[]>([])

  const [form, setForm] = useState<UserForm>({
    first_name: '',
    last_name: '',
    email: '',
    role: '',
    birth_date: '',
    fir_code: '',
    phone: '',
    categories: [],
    password: '',
    confirmPassword: '',
    player_name: '',
    customPermissions: []
  })

  // Carica le categorie disponibili
  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, code, name')
        .eq('active', true)
        .order('sort', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  // Funzione per cercare il giocatore tramite FIR code
  const findPlayerByFirCode = async (firCode: string) => {
    if (!firCode.trim()) {
      setForm(prev => ({ ...prev, player_name: '' }))
      return
    }

    try {
      const { data, error } = await supabase
        .from('players')
        .select('first_name, last_name')
        .eq('fir_code', firCode.trim())
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Nessun giocatore trovato
          setForm(prev => ({ ...prev, player_name: '' }))
          setError('Nessun giocatore trovato con questo codice FIR')
        } else {
          throw error
        }
      } else if (data) {
        setForm(prev => ({ 
          ...prev, 
          player_name: `${data.first_name} ${data.last_name}` 
        }))
        setError('') // Rimuovi eventuali errori precedenti
      }
    } catch (error) {
      console.error('Errore nella ricerca giocatore:', error)
      setForm(prev => ({ ...prev, player_name: '' }))
      setError('Errore nella ricerca del giocatore')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    // Converti email in minuscolo
    const processedValue = name === 'email' ? value.toLowerCase() : value
    setForm(prev => ({ ...prev, [name]: processedValue }))
    
    // Se il ruolo è Giocatore e si sta modificando il FIR code, cerca automaticamente il giocatore
    if (name === 'fir_code' && form.role === 'giocatore') {
      findPlayerByFirCode(value)
    }
    
    // Logica automatica per is_player e is_staff in base al ruolo
    if (name === 'role') {
      const role = value as string
      
      console.log('🎯 Ruolo selezionato in CreateUser:', role)
      
      // Se il ruolo è 'giocatore', imposta automaticamente le opzioni per giocatore
      if (role === 'giocatore') {
        console.log('✅ Attivazione automatica opzioni giocatore')
      }
      // Se il ruolo è uno dei ruoli staff, imposta automaticamente le opzioni per staff
      else if (['allenatore', 'preparatore', 'team-manager', 'accompagnatore'].includes(role)) {
        console.log('✅ Attivazione automatica opzioni staff')
      }
    }
  }

  const handleCategoryChange = (categoryId: string) => {
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

  // Ottieni tutti i permessi disponibili raggruppati per categoria
  const getAllPermissions = () => {
    const permissionsByCategory: { [key: string]: { [key: string]: string } } = {}
    
    Object.entries(PERMISSIONS).forEach(([categoryName, categoryPermissions]) => {
      permissionsByCategory[categoryName] = categoryPermissions
    })
    
    return permissionsByCategory
  }

  // Ottieni i permessi di default per un ruolo
  const getDefaultPermissionsForRole = (role: string) => {
    return getRolePermissions(role)
  }

  // Verifica se un permesso è attivo (selezionato o incluso nel ruolo di default)
  const isPermissionActive = (permission: string) => {
    const defaultPermissions = getDefaultPermissionsForRole(form.role)
    return form.customPermissions.includes(permission) || defaultPermissions.includes(permission)
  }

  const validateForm = (): boolean => {
    if (!form.first_name.trim()) {
      setError('Il nome è obbligatorio')
      return false
    }
    if (!form.last_name.trim()) {
      setError('Il cognome è obbligatorio')
      return false
    }
    if (!form.email.trim()) {
      setError('L\'email è obbligatoria')
      return false
    }
    if (!form.role) {
      setError('Il ruolo è obbligatorio')
      return false
    }
    if (!form.birth_date) {
      setError('La data di nascita è obbligatoria')
      return false
    }
    if (!form.fir_code.trim()) {
      setError('Il codice FIR è obbligatorio')
      return false
    }
    
    // Validazione specifica per il ruolo Giocatore
    if (form.role === 'giocatore') {
      if (!form.player_name.trim()) {
        setError('Nessun giocatore trovato con questo codice FIR. Verifica il codice e riprova.')
        return false
      }
    }
    
    if (!form.password) {
      setError('La password è obbligatoria')
      return false
    }
    if (form.password !== form.confirmPassword) {
      setError('Le password non coincidono')
      return false
    }
    if (form.password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri')
      return false
    }
    
    // Per i ruoli diversi da Giocatore, le categorie sono obbligatorie
    if (form.role !== 'giocatore' && form.categories.length === 0) {
      setError('Seleziona almeno una categoria')
      return false
    }
    
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!validateForm()) return

    try {
      setLoading(true)

      // Crea l'utente tramite signup (richiede conferma email)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.first_name,
            last_name: form.last_name,
            role: form.role,
            birth_year: new Date(form.birth_date).getFullYear(),
            fir_code: form.fir_code,
            phone: form.phone
          }
        }
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Errore nella creazione dell\'utente')
      }

      const userId = authData.user.id

      // Inserisci il profilo nella tabella profiles
      const profileData: any = {
        id: userId, // Usa l'ID dell'utente auth direttamente
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        role: form.role,
        birth_year: new Date(form.birth_date).getFullYear(),
        fir_code: form.fir_code,
        phone: form.phone || null
      }

      console.log('🔍 Dati profilo da inserire:', profileData)

      // Per il ruolo Giocatore, aggiungi il FIR code per collegare al giocatore
      if (form.role === 'giocatore') {
        profileData.fir_code = form.fir_code
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })

      if (profileError) throw profileError

      // Crea anche la persona nella tabella people per visualizzarla in StaffView
      const personData = {
        id: userId, // Stesso ID dell'utente auth
        full_name: `${form.first_name} ${form.last_name}`,
        given_name: form.first_name,
        family_name: form.last_name,
        email: form.email,
        phone: form.phone || null,
        fiscal_code: null, // Sarà compilato successivamente
        date_of_birth: form.birth_date,
        gender: 'non_specificato', // Default
        status: 'attivo',
        membership_number: null, // Sarà assegnato successivamente
        staff_roles: [form.role], // Array con il ruolo
        staff_categories: form.categories, // Array con le categorie
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { error: personError } = await supabase
        .from('people')
        .upsert(personData, { onConflict: 'id' })

      if (personError) {
        console.warn('Errore nella creazione persona:', personError)
        // Non bloccare il processo se fallisce la creazione della persona
      }

      // Collega l'utente alle categorie (solo per ruoli diversi da Giocatore)
      if (form.role !== 'giocatore' && form.categories.length > 0) {
        const categoryLinks = form.categories.map(categoryId => ({
          user_id: userId, // Usa l'ID dell'utente auth
          category_id: categoryId
        }))

        const { error: categoryError } = await supabase
          .from('staff_categories')
          .insert(categoryLinks)

        if (categoryError) throw categoryError
      }

      setSuccess('Utente creato con successo! L\'utente riceverà un\'email di conferma per attivare l\'account.')
      
      // Reset form
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        role: '',
        birth_date: '',
        fir_code: '',
        phone: '',
        categories: [],
        password: '',
        confirmPassword: '',
        player_name: '',
        customPermissions: []
      })

      // Redirect dopo 2 secondi
      setTimeout(() => {
        navigate(embedInLayout ? '/users-management' : '/staff')
      }, 2000)

    } catch (error: any) {
      console.error('Errore nella creazione utente:', error)
      setError(error.message || 'Errore nella creazione utente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={embedInLayout ? 'min-h-full bg-gray-50' : ''}>
      {!embedInLayout && <Header title="Crea Nuovo Utente" showBack={true} />}
      
      <div className="p-6 max-w-4xl mx-auto">
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

        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${embedInLayout ? 'text-gray-900' : 'text-white'}`}>
            Crea Nuovo Utente
          </h1>
          <p className={embedInLayout ? 'text-gray-600' : 'text-white/80'}>
            Crea un nuovo account per staff, allenatori o famiglie
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informazioni Personali */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name || ''}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Nome"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cognome *
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name || ''}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Cognome"
                />
              </div>
            </div>

            {/* Email e Ruolo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email?.toLowerCase() || ''}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="email@esempio.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ruolo *
                </label>
                <select
                  name="role"
                  value={form.role || ''}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                >
                  <option value="">Seleziona ruolo</option>
                  <option value="admin">Admin</option>
                  <option value="dirigente">Dirigente</option>
                  <option value="segreteria">Segreteria</option>
                  <option value="direttore-sportivo">Direttore Sportivo</option>
                  <option value="direttore-tecnico">Direttore Tecnico</option>
                  <option value="allenatore">Allenatore</option>
        <option value="giocatore">Giocatore</option>
        <option value="preparatore">Preparatore Atletico</option>
        <option value="team-manager">Team Manager</option>
        <option value="accompagnatore">Accompagnatore</option>
        <option value="medico">Medico</option>
        <option value="fisio">Fisioterapista</option>
        <option value="familiare">Familiare</option>
        <option value="tutor">Tutor</option>
                </select>
              </div>
            </div>

            {/* Data di Nascita e Codice FIR */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data di Nascita *
                </label>
                <input
                  type="date"
                  name="birth_date"
                  value={form.birth_date || ''}
                  onChange={handleInputChange}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Codice FIR *
                </label>
                <input
                  type="text"
                  name="fir_code"
                  value={form.fir_code || ''}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="FIR-001"
                />
              </div>
            </div>

            {/* Campo Nome Giocatore - visibile solo per ruolo Giocatore */}
            {form.role === 'giocatore' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Giocatore Collegato
                </label>
                <input
                  type="text"
                  value={form.player_name || ''}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  placeholder="Inserisci il codice FIR per trovare il giocatore"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Questo campo si popola automaticamente quando inserisci un codice FIR valido
                </p>
              </div>
            )}

            {/* Telefono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefono
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone || ''}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="+39 123 456 7890"
              />
            </div>

            {/* Categorie - nascoste per il ruolo Giocatore */}
            {form.role !== 'giocatore' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categorie * (seleziona almeno una)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {categories.map((category) => (
                    <label key={category.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.categories.includes(category.id)}
                        onChange={() => handleCategoryChange(category.id)}
                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-sm text-gray-700">{category.code}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

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

            {/* Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password || ''}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Minimo 6 caratteri"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conferma Password *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword || ''}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Ripeti la password"
                />
              </div>
            </div>

            {/* Messaggi di errore e successo */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-600">{success}</p>
              </div>
            )}

            {/* Pulsanti */}
            <div className="flex justify-end space-x-4 pt-6">
              <button
                type="button"
                onClick={() => navigate(embedInLayout ? '/users-management' : '/staff')}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Annulla
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creazione...' : 'Crea Utente'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
