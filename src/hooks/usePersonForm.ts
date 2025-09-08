import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useNavigate, useSearchParams } from 'react-router-dom'

export interface PersonForm {
  given_name: string
  family_name: string
  date_of_birth: string
  gender: string
  fiscal_code: string
  status: string
  nationality: string
  email: string
  phone: string
  emergency_contact_name: string
  emergency_contact_phone: string
  medical_notes: string
  address_street: string
  address_city: string
  address_zip: string
  address_country: string
  membership_number: string
  // Player specific fields
  is_player: boolean
  is_staff: boolean
  injured: boolean
  player_categories: string[]
  player_positions: string[]
  // Staff specific fields
  staff_roles: string[]
  staff_categories: string[]
}

export const usePersonForm = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isEditing = !!editId

  const [form, setForm] = useState<PersonForm>({
    given_name: '',
    family_name: '',
    date_of_birth: '',
    gender: '',
    fiscal_code: '',
    status: 'active',
    nationality: '',
    email: '',
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_notes: '',
    address_street: '',
    address_city: '',
    address_zip: '',
    address_country: '',
    membership_number: '',
    is_player: false,
    is_staff: false,
    injured: false,
    player_categories: [],
    player_positions: [],
    staff_roles: [],
    staff_categories: []
  })

  const [isEditMode, setIsEditMode] = useState(!isEditing)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [playerPositions, setPlayerPositions] = useState<any[]>([])

  // Carica dati persona se in modalità modifica
  useEffect(() => {
    if (isEditing && editId) {
      loadPersonData(editId)
    }
  }, [isEditing, editId])

  // Carica categorie e posizioni
  useEffect(() => {
    loadCategories()
    loadPlayerPositions()
  }, [])

  const loadPersonData = async (personId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('id', personId)
        .single()

      if (error) throw error

      if (data) {
        // Controlla se ci sono infortuni aperti per questo giocatore
        let hasOpenInjuries = false
        if (data.is_player) {
          try {
            const { data: openInjuries } = await supabase
              .from('injuries')
              .select('id')
              .eq('person_id', personId)
              .eq('is_closed', false)
            
            hasOpenInjuries = openInjuries && openInjuries.length > 0
          } catch (error) {
            // Fallback: se i campi is_closed non esistono ancora, usa current_status
            console.warn('Campi is_closed non disponibili, uso current_status come fallback')
            const { data: injuries } = await supabase
              .from('injuries')
              .select('id, current_status')
              .eq('person_id', personId)
            
            hasOpenInjuries = injuries && injuries.some(injury => injury.current_status === 'In corso')
          }
        }

        setForm({
          given_name: data.given_name || '',
          family_name: data.family_name || '',
          date_of_birth: data.date_of_birth || '',
          gender: data.gender || '',
          fiscal_code: data.fiscal_code || '',
          status: data.status || 'active',
          nationality: data.nationality || '',
          email: data.email || '',
          phone: data.phone || '',
          emergency_contact_name: data.emergency_contact_name || '',
          emergency_contact_phone: data.emergency_contact_phone || '',
          medical_notes: data.medical_notes || '',
          address_street: data.address_street || '',
          address_city: data.address_city || '',
          address_zip: data.address_zip || '',
          address_country: data.address_country || '',
          membership_number: data.membership_number || '',
          is_player: data.is_player || false,
          is_staff: data.is_staff || false,
          injured: hasOpenInjuries, // Usa lo stato reale degli infortuni aperti
          player_categories: data.player_categories || [],
          player_positions: data.player_positions || [],
          staff_roles: data.staff_roles || [],
          staff_categories: data.staff_categories || [],
        })
      }
    } catch (error) {
      console.error('Errore nel caricamento persona:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const loadPlayerPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('player_positions')
        .select('*')
        .order('position_order')

      if (error) throw error
      setPlayerPositions(data || [])
    } catch (error) {
      console.error('Errore nel caricamento posizioni:', error)
    }
  }

  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const personData = {
      given_name: form.given_name,
      family_name: form.family_name,
      full_name: `${form.given_name} ${form.family_name}`,
      date_of_birth: form.date_of_birth,
      gender: form.gender,
      fiscal_code: form.fiscal_code,
      status: form.status,
      nationality: form.nationality,
      email: form.email,
      phone: form.phone,
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_phone: form.emergency_contact_phone,
      medical_notes: form.medical_notes,
      address_street: form.address_street,
      address_city: form.address_city,
      address_zip: form.address_zip,
      address_country: form.address_country,
      membership_number: form.membership_number || null,
      is_player: form.is_player,
      is_staff: form.is_staff,
      injured: form.injured,
      staff_roles: form.staff_roles.length > 0 ? form.staff_roles : null,
      staff_categories: form.staff_categories.length > 0 ? form.staff_categories : null,
      player_categories: form.player_categories.length > 0 ? form.player_categories : null,
      player_positions: form.player_positions.length > 0 ? form.player_positions : null,
    }
    
    try {
      setLoading(true)

      if (isEditing) {
        // Aggiorna persona esistente
        const { error } = await supabase
          .from('people')
          .update(personData)
          .eq('id', editId)

        if (error) throw error
      } else {
        // Crea nuova persona
        const { error } = await supabase
          .from('people')
          .insert(personData)

        if (error) throw error
        // navigate('/people') // Rimosso redirect automatico
      }
    } catch (error) {
      console.error('Errore nel salvataggio:', error)
      console.error('Dati che stavano per essere salvati:', personData)
      alert(`Errore nel salvataggio: ${error.message || 'Errore sconosciuto'}`)
    } finally {
      setLoading(false)
    }
  }

  const isFieldDisabled = () => {
    return isEditing && !isEditMode
  }

  const handleEdit = () => {
    setIsEditMode(true)
  }

  const handleSave = () => {
    handleSubmit(new Event('submit') as any)
    setIsEditMode(false)
  }

  const handleCancel = () => {
    if (isEditMode) {
      // Se siamo in modalità modifica, esci dalla modifica e torna alla modalità lettura
      setIsEditMode(false)
      // Ricarica i dati originali per annullare le modifiche
      if (editId) {
        loadPersonData(editId)
      }
    } else {
      // Se siamo in modalità lettura, torna alla pagina persone
      navigate('/people')
    }
  }

  return {
    form,
    setForm,
    isEditMode,
    loading,
    categories,
    playerPositions,
    isEditing,
    editId,
    handleInputChange,
    handleSubmit,
    isFieldDisabled,
    handleEdit,
    handleSave,
    handleCancel
  }
}

