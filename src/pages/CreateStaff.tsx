import Header from '@/components/Header'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

interface StaffForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  membership_number: string
  role_ids: string[]
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

export default function CreateStaff() {
  const navigate = useNavigate()
  const [form, setForm] = useState<StaffForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    membership_number: '',
    role_ids: [],
    category_ids: []
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadCategories()
    loadRoles()
    generateMembershipNumber()
  }, [])

  const generateMembershipNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('people')
        .select('membership_number')
        .not('membership_number', 'is', null)
        .order('membership_number', { ascending: false })
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        // Prendi il numero tessera più alto e aggiungi 1
        const lastNumber = parseInt(data[0].membership_number) || 0
        const newNumber = (lastNumber + 1).toString()
        setForm(prev => ({
          ...prev,
          membership_number: newNumber
        }))
      } else {
        // Se non ci sono numeri tessera esistenti, inizia da 1
        setForm(prev => ({
          ...prev,
          membership_number: '1'
        }))
      }
    } catch (error) {
      console.error('Errore nel generare numero tessera:', error)
      setForm(prev => ({
        ...prev,
        membership_number: '1'
      }))
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
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
        .from('user_roles')
        .select('*')
        .not('name', 'in', '(Player,Famiglia)')
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
      // Crea il membro dello staff
      const { data: staffData, error: staffError } = await supabase
        .from('people')
        .insert({
          given_name: form.first_name,
          family_name: form.last_name,
          full_name: `${form.first_name} ${form.last_name}`,
          email: form.email || null,
          phone: form.phone || null,
          membership_number: form.membership_number,
          is_staff: true,
          is_player: false,
          status: 'active',
          staff_roles: form.role_ids,
          staff_categories: form.category_ids
        })
        .select('id')
        .single()

      if (staffError) throw staffError

      setMessage('Staff creato con successo!')
      
      // Reset form e genera nuovo numero tessera
      generateMembershipNumber()
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        membership_number: '',
        role_ids: [],
        category_ids: []
      })

      // Redirect dopo 2 secondi
      setTimeout(() => {
        navigate('/staff')
      }, 2000)

    } catch (error: any) {
      console.error('Errore nella creazione staff:', error)
      setMessage(`Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof StaffForm, value: string | string[]) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleRoleChange = (roleId: string, checked: boolean) => {
    if (checked) {
      handleInputChange('role_ids', [...form.role_ids, roleId])
    } else {
      handleInputChange('role_ids', form.role_ids.filter(id => id !== roleId))
    }
  }

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    if (checked) {
      handleInputChange('category_ids', [...form.category_ids, categoryId])
    } else {
      handleInputChange('category_ids', form.category_ids.filter(id => id !== categoryId))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Nuovo Staff" showBack={true} />
      
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Crea Nuovo Staff</h1>
            <p className="text-gray-600">Inserisci i dati per creare un nuovo membro dello staff</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informazioni Personali */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cognome *
                </label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Cognome"
                  required
                />
              </div>
            </div>

            {/* Numero Tessera */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Numero Tessera
              </label>
              <input
                type="text"
                value={form.membership_number}
                readOnly
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                placeholder="Generato automaticamente"
              />
              <p className="mt-1 text-sm text-gray-500">Il numero tessera viene generato automaticamente</p>
            </div>

            {/* Contatti */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email?.toLowerCase() || ''}
                  onChange={(e) => handleInputChange('email', e.target.value.toLowerCase())}
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

            {/* Ruoli Staff */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Ruoli Staff *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.role_ids.includes(role.id)}
                      onChange={(e) => handleRoleChange(role.id, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{role.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Categorie Staff */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Categorie Staff
              </label>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center space-x-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.category_ids.includes(category.id)}
                      onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{category.code}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Messaggio */}
            {message && (
              <div className={`p-4 rounded-lg ${
                message.includes('Errore') 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {message}
              </div>
            )}

            {/* Pulsanti */}
            <div className="flex gap-4 pt-6">
              <button
                type="submit"
                disabled={loading || form.role_ids.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creazione...
                  </>
                ) : (
                  <>
                    <span className="text-xl">➕</span>
                    Crea Staff
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => navigate('/staff')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
