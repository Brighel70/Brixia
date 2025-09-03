import Header from '@/components/Header'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useData } from '@/store/data'
import { useNavigate } from 'react-router-dom'

interface PlayerForm {
  first_name: string
  last_name: string
  birth_date: string
  fir_code: string
  role_id: string
  category_ids: string[]
}

interface Category {
  id: string
  code: string
  name: string
}

interface Role {
  id: string
  name: string
  position_order: number
}

export default function CreatePlayer() {
  const { loadMyCategories } = useData()
  const navigate = useNavigate()
  const [form, setForm] = useState<PlayerForm>({
    first_name: '',
    last_name: '',
    birth_date: '',
    fir_code: '',
    role_id: '',
    category_ids: []
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadCategories()
    loadRoles()
  }, [])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('code')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('position_order')

      if (error) throw error
      setRoles(data || [])

    } catch (error) {
      console.error('Errore nel caricamento ruoli:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Usa la data di nascita completa
      const birthDate = form.birth_date
      
      if (!birthDate) {
        throw new Error('Data di nascita non valida')
      }

      // Determina se è aggregato alle seniores
      const isAggregatedSeniores = form.category_ids.some(id => {
        const category = categories.find(c => c.id === id)
        return category?.code === 'CADETTA' || category?.code === 'PRIMA'
      })

      // Crea il giocatore
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .insert({
          first_name: form.first_name,
          last_name: form.last_name,
          birth_date: birthDate,
          fir_code: form.fir_code,
          role_id: form.role_id,
          injured: false,
          aggregated_seniores: isAggregatedSeniores
        })
        .select()
        .single()

      if (playerError) throw playerError

      // Associa il giocatore alle categorie selezionate
      if (form.category_ids.length > 0) {
        const playerCategories = form.category_ids.map(categoryId => ({
          player_id: playerData.id,
          category_id: categoryId
        }))

        const { error: categoryError } = await supabase
          .from('player_categories')
          .insert(playerCategories)

        if (categoryError) throw categoryError
      }

      setMessage('✅ Giocatore creato con successo!')
      
      // Reset del form
      setForm({
        first_name: '',
        last_name: '',
        birth_date: '',
        fir_code: '',
        role_id: '',
        category_ids: []
      })

      // Redirect alle impostazioni sistema dopo 2 secondi
      setTimeout(() => {
        navigate('/settings?tab=system')
      }, 2000)

    } catch (error: any) {
      console.error('Errore nella creazione giocatore:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof PlayerForm, value: string | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleCategory = (categoryId: string) => {
    setForm(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(categoryId)
        ? prev.category_ids.filter(id => id !== categoryId)
        : [...prev.category_ids, categoryId]
    }))
  }

  const getCurrentYear = () => new Date().getFullYear()

  return (
    <div>
      <Header title="Crea Nuovo Giocatore" showBack={true} />
      
      <div className="p-6 max-w-2xl mx-auto">
        <div className="card p-8">
          <h1 className="text-3xl font-bold text-navy mb-6">Crea Nuovo Giocatore</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome e Cognome */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  value={form.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
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
                  className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Cognome"
                />
              </div>
            </div>

            {/* Data di Nascita e Codice FIR sulla stessa riga */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data di Nascita *
                </label>
                <input
                  type="date"
                  required
                  value={form.birth_date}
                  onChange={(e) => handleInputChange('birth_date', e.target.value)}
                  className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Codice FIR *
                </label>
                <input
                  type="text"
                  required
                  value={form.fir_code}
                  onChange={(e) => handleInputChange('fir_code', e.target.value)}
                  className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Codice FIR"
                />
              </div>
            </div>

            {/* Ruolo in Campo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ruolo in Campo *
              </label>
              <select
                required
                value={form.role_id}
                onChange={(e) => handleInputChange('role_id', e.target.value)}
                className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="">Seleziona ruolo</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                {roles.length} ruoli disponibili
              </p>
            </div>

            {/* Categorie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categorie *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.category_ids.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-sm">{category.code}</span>
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Seleziona almeno una categoria
              </p>
            </div>

            {/* Messaggio */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.startsWith('✅') 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            {/* Pulsante Submit */}
            <button
              type="submit"
              disabled={loading || form.category_ids.length === 0}
              className="w-full btn bg-sky text-white py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creazione in corso...' : 'Crea Giocatore'}
            </button>
          </form>

          {/* Informazioni */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Informazioni</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• I giocatori di CADETTA e PRIMA sono automaticamente aggregati alle SENIORES</li>
              <li>• Un giocatore può appartenere a più categorie</li>
              <li>• Il ruolo in campo è obbligatorio</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
