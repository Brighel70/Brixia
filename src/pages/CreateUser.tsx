import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/store/auth'

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
  player_name: string // Nome del giocatore collegato (solo per ruolo Player)
}

export default function CreateUser() {
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
    player_name: ''
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
    setForm(prev => ({ ...prev, [name]: value }))
    
    // Se il ruolo è Player e si sta modificando il FIR code, cerca automaticamente il giocatore
    if (name === 'fir_code' && form.role === 'Player') {
      findPlayerByFirCode(value)
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
    
    // Validazione specifica per il ruolo Player
    if (form.role === 'Player') {
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
    
    // Per i ruoli diversi da Player, le categorie sono obbligatorie
    if (form.role !== 'Player' && form.categories.length === 0) {
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

      // Per il ruolo Player, aggiungi il FIR code per collegare al giocatore
      if (form.role === 'Player') {
        profileData.fir_code = form.fir_code
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })

      if (profileError) throw profileError

      // Collega l'utente alle categorie (solo per ruoli diversi da Player)
      if (form.role !== 'Player' && form.categories.length > 0) {
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
        player_name: ''
      })

      // Redirect dopo 2 secondi
      setTimeout(() => {
        navigate('/staff')
      }, 2000)

    } catch (error: any) {
      console.error('Errore nella creazione utente:', error)
      setError(error.message || 'Errore nella creazione utente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Header title="Crea Nuovo Utente" showBack={true} />
      
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Crea Nuovo Utente</h1>
          <p className="text-white/80">
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
                  value={form.email || ''}
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
                  <option value="admin">Amministratore</option>
                  <option value="admin">Admin</option>
                  <option value="director">Dirigente</option>
                  <option value="medic">Medico</option>
                  <option value="director">Direttore Tecnico</option>
                  <option value="medic">Medic</option>
                  <option value="director">Director</option>
                  <option value="director">Direttore Sportivo</option>
                  <option value="coach">Coach</option>
                  <option value="coach">Staff</option>
                  <option value="coach">Team Manager</option>
                  <option value="coach">Accompagnatore</option>
                  <option value="medic">Medicina</option>
                  <option value="admin">Segreteria</option>
                  <option value="coach">Tutor</option>
                  <option value="coach">Giocatore</option>
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

            {/* Campo Nome Giocatore - visibile solo per ruolo Player */}
            {form.role === 'Player' && (
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

            {/* Categorie - nascoste per il ruolo Player */}
            {form.role !== 'Player' && (
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
                onClick={() => navigate('/staff')}
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
