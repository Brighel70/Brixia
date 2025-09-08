import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface ProfessionalCategory {
  id: string
  name: string
  description?: string
  is_sponsor_potential: boolean
  is_club_useful: boolean
}

interface Tutor {
  id: string
  full_name: string
  given_name?: string
  family_name?: string
  email?: string
  phone?: string
  address_street?: string
  address_city?: string
  address_zip?: string
  address_country?: string
  profession?: string
  professional_category_id?: string
  company?: string
  position?: string
  relationship?: string
  is_primary_contact?: boolean
  is_sponsor_potential?: boolean
  is_club_useful?: boolean
  notes?: string
}

interface TutorTabProps {
  athleteId: string
  athleteName: string
  isMinor: boolean
  onTutorAdded?: () => void
}

const TutorTab: React.FC<TutorTabProps> = ({ 
  athleteId, 
  athleteName, 
  isMinor, 
  onTutorAdded 
}) => {
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [professionalCategories, setProfessionalCategories] = useState<ProfessionalCategory[]>([])
  const [showTutorForm, setShowTutorForm] = useState(false)
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditingTutor, setIsEditingTutor] = useState(false)
  const isEditingTutorRef = useRef(false)

  // Funzione per capitalizzare il testo (prima lettera maiuscola, resto minuscolo)
  const capitalizeText = (text: string) => {
    if (!text) return ''
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Funzione per formattare il numero di telefono
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return ''
    
    // Rimuovi tutti i caratteri non numerici
    const cleaned = phone.replace(/\D/g, '')
    
    // Se inizia con 39, rimuovilo (sarà aggiunto +39)
    const withoutCountryCode = cleaned.startsWith('39') ? cleaned.slice(2) : cleaned
    
    // Se è vuoto, ritorna vuoto
    if (!withoutCountryCode) return ''
    
    // Formatta con spazi: 335 6222225
    let formatted = withoutCountryCode
    if (formatted.length >= 3) {
      formatted = formatted.substring(0, 3) + ' ' + formatted.substring(3)
    }
    
    // Aggiungi +39 all'inizio
    return `+39 ${formatted}`
  }

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    given_name: '',
    family_name: '',
    email: '',
    phone: '',
    address_street: '',
    address_city: '',
    address_zip: '',
    address_country: '',
    profession: '',
    professional_category_id: '',
    company: '',
    position: '',
    relationship: '',
    is_primary_contact: false,
    is_sponsor_potential: false,
    is_club_useful: false,
    notes: ''
  })

  // Carica categorie professionali
  useEffect(() => {
    loadProfessionalCategories()
  }, [])

  // Carica tutor dell'atleta
  useEffect(() => {
    if (athleteId) {
      loadTutors()
    }
  }, [athleteId])

  // Popola il form quando editingTutor cambia o quando il form si apre
  useEffect(() => {
    if (editingTutor && isEditingTutorRef.current && showTutorForm) {
      setFormData({
        full_name: editingTutor.full_name || '',
        given_name: editingTutor.given_name || '',
        family_name: editingTutor.family_name || '',
        email: editingTutor.email || '',
        phone: editingTutor.phone || '',
        address_street: editingTutor.address_street || '',
        address_city: editingTutor.address_city || '',
        address_zip: editingTutor.address_zip || '',
        address_country: editingTutor.address_country || '',
        profession: editingTutor.profession || '',
        professional_category_id: editingTutor.professional_category_id || '',
        company: editingTutor.company || '',
        position: editingTutor.position || '',
        relationship: editingTutor.relationship || '',
        is_primary_contact: editingTutor.is_primary_contact || false,
        is_sponsor_potential: editingTutor.is_sponsor_potential || false,
        is_club_useful: editingTutor.is_club_useful || false,
        notes: editingTutor.notes || ''
      })
    }
  }, [editingTutor, showTutorForm])

  // Traccia quando showTutorForm cambia (solo per log, nessun reset globale)
  useEffect(() => {
    if (!showTutorForm && isEditingTutorRef.current) {
      isEditingTutorRef.current = false
    }
  }, [showTutorForm])

  const loadProfessionalCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('professional_categories')
        .select('*')
        .eq('active', true)
        .order('position_order')

      if (error) throw error
      setProfessionalCategories(data || [])
    } catch (error) {
      console.error('Errore nel caricamento categorie professionali:', error)
    }
  }

  const loadTutors = async () => {
    try {
      setLoading(true)
      
      // Carica le relazioni
      const { data: relations, error: relationsError } = await supabase
        .from('tutor_athlete_relations')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false })

      if (relationsError) throw relationsError

      if (!relations || relations.length === 0) {
        setTutors([])
        return
      }

      // Carica i tutor associati
      const tutorIds = relations.map(r => r.tutor_id)
      const { data: tutorsData, error: tutorsError } = await supabase
        .from('tutors')
        .select(`
          id,
          full_name,
          given_name,
          family_name,
          email,
          phone,
          address_street,
          address_city,
          address_zip,
          address_country,
          profession,
          professional_category_id,
          company,
          position,
          is_sponsor_potential,
          is_club_useful
        `)
        .in('id', tutorIds)

      if (tutorsError) throw tutorsError

      // Combina i dati
      const tutors = tutorsData?.map(tutor => {
        const relation = relations.find(r => r.tutor_id === tutor.id)
        return {
          ...tutor,
          relationship: relation?.relationship || '',
          is_primary_contact: relation?.is_primary_contact || false,
          is_emergency_contact: relation?.is_emergency_contact || false,
          notes: relation?.notes || ''
        }
      }) || []

      setTutors(tutors)
    } catch (error) {
      console.error('Errore nel caricamento tutor:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Funzione per gestire il cambio di testo con capitalizzazione
  const handleTextChange = (field: string, value: string) => {
    const capitalizedValue = capitalizeText(value)
    handleInputChange(field, capitalizedValue)
  }

  // Funzione per gestire il cambio del telefono
  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    handleInputChange('phone', formatted)
  }

  const resetForm = () => {
    isEditingTutorRef.current = false
    setIsEditingTutor(false)
    setFormData({
      full_name: '',
      given_name: '',
      family_name: '',
      email: '',
      phone: '',
      address_street: '',
      address_city: '',
      address_zip: '',
      address_country: '',
      profession: '',
      professional_category_id: '',
      company: '',
      position: '',
      relationship: '',
      is_primary_contact: false,
      is_sponsor_potential: false,
      is_club_useful: false,
      notes: ''
    })
    setEditingTutor(null)
    // ⛔️ rimosso setShowAddForm(false) - gestito separatamente
  }

  const openTutorForm = () => setShowTutorForm(true)
  const closeTutorForm = () => setShowTutorForm(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Salva o aggiorna tutor
      let tutorId = editingTutor?.id
      
      if (!tutorId) {
        // Crea nuovo tutor
        const { data: tutorData, error: tutorError } = await supabase
          .from('tutors')
          .insert({
            full_name: formData.full_name,
            given_name: formData.given_name,
            family_name: formData.family_name,
            email: formData.email,
            phone: formData.phone,
            address_street: formData.address_street,
            address_city: formData.address_city,
            address_zip: formData.address_zip,
            address_country: formData.address_country,
            profession: formData.profession,
            professional_category_id: formData.professional_category_id || null,
            company: formData.company,
            position: formData.position,
            is_sponsor_potential: formData.is_sponsor_potential,
            is_club_useful: formData.is_club_useful
          })
          .select()
          .single()

        if (tutorError) throw tutorError
        tutorId = tutorData.id
      } else {
        // Aggiorna tutor esistente
        const { error: tutorError } = await supabase
          .from('tutors')
        .update({
          full_name: formData.full_name,
          given_name: formData.given_name,
          family_name: formData.family_name,
          email: formData.email,
          phone: formData.phone,
          address_street: formData.address_street,
          address_city: formData.address_city,
          address_zip: formData.address_zip,
          address_country: formData.address_country,
          profession: formData.profession,
          professional_category_id: formData.professional_category_id || null,
          company: formData.company,
          position: formData.position,
          is_sponsor_potential: formData.is_sponsor_potential,
          is_club_useful: formData.is_club_useful
        })
          .eq('id', tutorId)

        if (tutorError) throw tutorError
      }

      // Se questo tutor è contatto principale, deseleziona tutti gli altri
      if (formData.is_primary_contact) {
        const { error: deselectError } = await supabase
          .from('tutor_athlete_relations')
          .update({ is_primary_contact: false })
          .eq('athlete_id', athleteId)
          .neq('tutor_id', tutorId)

        if (deselectError) throw deselectError
      }

      // Salva o aggiorna relazione tutor-atleta
      if (editingTutor) {
        const { error: relationError } = await supabase
          .from('tutor_athlete_relations')
          .update({
            relationship: formData.relationship,
            is_primary_contact: formData.is_primary_contact,
            notes: formData.notes
          })
          .eq('tutor_id', tutorId)
          .eq('athlete_id', athleteId)

        if (relationError) throw relationError
      } else {
        const { error: relationError } = await supabase
          .from('tutor_athlete_relations')
          .insert({
            tutor_id: tutorId,
            athlete_id: athleteId,
            relationship: formData.relationship,
            is_primary_contact: formData.is_primary_contact,
            notes: formData.notes
          })

        if (relationError) throw relationError
      }

      // Se è contatto principale, aggiorna i dati di emergenza dell'atleta
      if (formData.is_primary_contact) {
        const { error: athleteError } = await supabase
          .from('people')
          .update({
            emergency_contact_name: formData.full_name,
            emergency_contact_phone: formData.phone
          })
          .eq('id', athleteId)

        if (athleteError) throw athleteError
      } else if (editingTutor && editingTutor.is_primary_contact) {
        // Se stiamo deselezionando un contatto principale, svuota i dati di emergenza
        const { error: athleteError } = await supabase
          .from('people')
          .update({
            emergency_contact_name: '',
            emergency_contact_phone: ''
          })
          .eq('id', athleteId)

        if (athleteError) throw athleteError
      }

      // Gestisci chiusura form dopo submit
      if (!isEditingTutor) {
        // creato nuovo tutor → chiudo form
        closeTutorForm()
        resetForm()
      } else {
        // aggiornato tutor esistente → chiudo form e reset
        setIsEditingTutor(false)
        closeTutorForm()
        resetForm()
      }
      loadTutors()
      onTutorAdded?.()
      
    } catch (error) {
      console.error('Errore nel salvataggio tutor:', error)
      alert(`Errore nel salvataggio: ${error.message || 'Errore sconosciuto'}`)
    }
  }

  const handleEdit = (tutor: Tutor) => {
    isEditingTutorRef.current = true
    setIsEditingTutor(true)
    setEditingTutor(tutor)
    setShowTutorForm(true)
  }

  const handleDelete = async (tutorId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo tutor?')) return

    try {
      // Controlla se questo tutor è contatto principale
      const tutorToDelete = tutors.find(t => t.id === tutorId)
      const wasPrimaryContact = tutorToDelete?.is_primary_contact

      const { error } = await supabase
        .from('tutor_athlete_relations')
        .delete()
        .eq('tutor_id', tutorId)
        .eq('athlete_id', athleteId)

      if (error) throw error

      // Se era contatto principale, svuota i dati di emergenza
      if (wasPrimaryContact) {
        const { error: athleteError } = await supabase
          .from('people')
          .update({
            emergency_contact_name: '',
            emergency_contact_phone: ''
          })
          .eq('id', athleteId)

        if (athleteError) throw athleteError
      }

      loadTutors()
    } catch (error) {
      console.error('Errore nell\'eliminazione tutor:', error)
      alert(`Errore nell'eliminazione: ${error.message || 'Errore sconosciuto'}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Tutor per {athleteName}
          </h3>
          <p className="text-sm text-gray-600">
            {isMinor ? 'Registrazione obbligatoria per atleti minorenni' : 'Gestione tutor (dati storici)'}
          </p>
        </div>
        <button
          onClick={openTutorForm}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi Tutor
        </button>
      </div>

      {/* Lista Tutor */}
      {tutors.length > 0 ? (
        <div className="space-y-4">
          {tutors.map((tutor) => (
            <div key={tutor.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-medium text-gray-900">{tutor.full_name}</h4>
                    {tutor.is_primary_contact && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        Contatto Principale
                      </span>
                    )}
                    {tutor.is_sponsor_potential && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Sponsor
                      </span>
                    )}
                    {tutor.is_club_useful && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                        Utile Club
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Relazione:</span> {tutor.relationship}
                    </div>
                    {tutor.profession && (
                      <div>
                        <span className="font-medium">Professione:</span> {tutor.profession}
                      </div>
                    )}
                    {tutor.phone && (
                      <div>
                        <span className="font-medium">Telefono:</span> {tutor.phone}
                      </div>
                    )}
                    {tutor.email && (
                      <div>
                        <span className="font-medium">Email:</span> {tutor.email}
                      </div>
                    )}
                  </div>
                  
                  {tutor.notes && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Note:</span> {tutor.notes}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(tutor)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Modifica"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(tutor.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Elimina"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>Nessun tutor registrato</p>
          {isMinor && (
            <p className="text-sm text-red-600 mt-1">
              ⚠️ Registrazione obbligatoria per atleti minorenni
            </p>
          )}
        </div>
      )}

      {/* Form Aggiungi/Modifica Tutor */}
      {showTutorForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">
                  {editingTutor ? 'Modifica Tutor' : 'Aggiungi Tutor'}
                </h3>
                <button
                  onClick={closeTutorForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Dati Personali */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => handleTextChange('full_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Relazione con l'atleta *
                    </label>
                    <select
                      required
                      value={formData.relationship}
                      onChange={(e) => handleInputChange('relationship', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Seleziona relazione</option>
                      <option value="Padre">Padre</option>
                      <option value="Madre">Madre</option>
                      <option value="Nonno">Nonno</option>
                      <option value="Nonna">Nonna</option>
                      <option value="Zio">Zio</option>
                      <option value="Zia">Zia</option>
                      <option value="Fratello">Fratello</option>
                      <option value="Sorella">Sorella</option>
                      <option value="Tutore">Tutore</option>
                      <option value="Altro">Altro</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefono
                    </label>
                    <input
                      type="tel"
                      value={formatPhoneNumber(formData.phone)}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleTextChange('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Dati Professionali */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Dati Professionali</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Professione
                      </label>
                      <input
                        type="text"
                        value={formData.profession}
                        onChange={(e) => handleTextChange('profession', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Categoria Professionale
                      </label>
                      <select
                        value={formData.professional_category_id}
                        onChange={(e) => handleInputChange('professional_category_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Seleziona categoria</option>
                        {professionalCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Azienda
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => handleTextChange('company', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Posizione/Ruolo
                      </label>
                      <input
                        type="text"
                        value={formData.position}
                        onChange={(e) => handleTextChange('position', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contatti */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Contatti</h4>
                  
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_primary_contact}
                        onChange={(e) => handleInputChange('is_primary_contact', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Contatto Principale</span>
                    </label>
                  </div>
                </div>

                {/* Potenziale Commerciale */}
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Potenziale Commerciale</h4>
                  
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_sponsor_potential}
                        onChange={(e) => handleInputChange('is_sponsor_potential', e.target.checked)}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Possibile Sponsor</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_club_useful}
                        onChange={(e) => handleInputChange('is_club_useful', e.target.checked)}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Utile al Club</span>
                    </label>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Note
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Note aggiuntive..."
                    />
                  </div>
                </div>

                {/* Bottoni */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeTutorForm}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingTutor ? 'Aggiorna' : 'Salva'} Tutor
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TutorTab
