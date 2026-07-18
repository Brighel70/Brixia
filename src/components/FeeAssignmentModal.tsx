import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useActiveCategoriesForSelect } from '@/hooks/useActiveCategoriesForSelect'
import { formatCurrency, feeMatchesCategoryFilter, personMatchesCategoryFilter } from '@/utils/feeUtils'

interface Person {
  id: string
  given_name: string
  family_name: string
  date_of_birth: string
  is_player: boolean
  is_staff: boolean
  player_categories: string[]
  staff_roles: string[]
}

interface Fee {
  id: string
  name: string
  description: string
  type: string
  amount: number
  category: string
  applicable_categories?: string[] // Array delle categorie applicabili
  is_mandatory: boolean
}

interface FeeAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  selectedFee: Fee | null
  onAssignmentCreated: () => void
  singlePersonId?: string // ID della persona specifica (per assegnazione singola)
  singlePersonName?: string // Nome della persona specifica
}

const FeeAssignmentModal: React.FC<FeeAssignmentModalProps> = ({
  isOpen,
  onClose,
  selectedFee,
  onAssignmentCreated,
  singlePersonId,
  singlePersonName
}) => {
  const [people, setPeople] = useState<Person[]>([])
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([])
  const [selectedPeople, setSelectedPeople] = useState<string[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [filteredFees, setFilteredFees] = useState<Fee[]>([])
  const [selectedFeeId, setSelectedFeeId] = useState<string | null>(selectedFee?.id || null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [customAmount, setCustomAmount] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; code: string }[]>([])

  // Solo categorie attivate nell'app
  const brixiaCategories = useActiveCategoriesForSelect()

  const loadSinglePerson = async (personId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('people')
        .select('id, given_name, family_name, date_of_birth, is_player, is_staff, player_categories, staff_roles')
        .eq('id', personId)
        .single()

      if (error) throw error
      if (data) {
        setPeople([data])
        setSelectedPeople([personId])
      } else {
        setPeople([])
      }
    } catch (e) {
      console.error('Errore caricamento persona singola:', e)
      setPeople([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('🚀 MODAL OPENED:', { isOpen, singlePersonId, selectedFee: selectedFee?.name })
    
    if (isOpen) {
      if (singlePersonId) {
        // Modalità singola persona - carica la persona per mostrarla nella lista
        console.log('👤 MODALITÀ SINGOLA PERSONA:', singlePersonId)
        loadSinglePerson(singlePersonId)
      } else {
        // Modalità normale - carica tutte le persone
        console.log('👥 MODALITÀ NORMALE - Caricamento persone...')
        loadPeople()
      }
      
      // Carica sempre le quote quando il modal si apre
      console.log('💰 CARICAMENTO QUOTE...')
      loadFees()
      
      if (selectedFee) {
        console.log('🎯 QUOTA PRESELECIONATA:', selectedFee.name)
        setCustomAmount(selectedFee.amount / 100)
        setSelectedFeeId(selectedFee.id)
        // Imposta data scadenza a 30 giorni da oggi
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 30)
        setDueDate(futureDate.toISOString().split('T')[0])
      }
    }
  }, [isOpen, selectedFee, singlePersonId])

  useEffect(() => {
    filterPeople()
    filterFees()
  }, [people, fees, searchTerm, categoryFilter, dbCategories, brixiaCategories])

  // Aggiorna customAmount quando cambia la quota selezionata
  useEffect(() => {
    if (selectedFeeId) {
      const currentFee = fees.find(f => f.id === selectedFeeId)
      if (currentFee) {
        setCustomAmount(currentFee.amount / 100)
      }
    }
  }, [selectedFeeId, fees])

  const loadPeople = async () => {
    console.log('🔄 INIZIO loadPeople()')
    try {
      setLoading(true)
      const [{ data, error }, { data: categoriesData, error: categoriesError }] = await Promise.all([
        supabase
          .from('people')
          .select('id, given_name, family_name, date_of_birth, is_player, is_staff, player_categories, staff_roles')
          .order('family_name'),
        supabase
          .from('categories')
          .select('id, name, code')
          .eq('active', true)
      ])

      if (error) {
        console.error('❌ ERRORE SUPABASE loadPeople:', error)
        throw error
      }
      if (categoriesError) {
        console.error('❌ ERRORE SUPABASE categories:', categoriesError)
      } else {
        setDbCategories(categoriesData || [])
      }
      
      console.log('👥 PERSONE CARICATE DAL DATABASE:', data?.length || 0, 'persone')
      console.log('👥 PRIME 3 PERSONE:', data?.slice(0, 3).map(p => ({
        name: `${p.given_name} ${p.family_name}`,
        player_categories: p.player_categories,
        is_player: p.is_player
      })))
      setPeople(data || [])
    } catch (error) {
      console.error('Errore nel caricamento delle persone:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load fees from database
  const loadFees = async () => {
    console.log('🔄 INIZIO loadFees()')
    try {
      const { data, error } = await supabase
        .from('fees')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.error('❌ ERRORE SUPABASE loadFees:', error)
        throw error
      }
      
      console.log('💰 QUOTE CARICATE DAL DATABASE:', data?.length || 0, 'quote')
      console.log('💰 PRIME 3 QUOTE:', data?.slice(0, 3).map(f => ({
        name: f.name,
        category: f.category,
        applicable_categories: f.applicable_categories,
        is_active: f.is_active
      })))
      setFees(data || [])
    } catch (error) {
      console.error('Errore nel caricamento delle quote:', error)
    }
  }

  const filterPeople = () => {
    let filtered = people

    // Filtro per ricerca
    if (searchTerm) {
      filtered = filtered.filter(person =>
        `${person.given_name} ${person.family_name}`.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro per categoria Brixia - SOLO categoria dalla scheda del giocatore
    // In modalità singola persona, mostra sempre la persona (non filtrare per categoria)
    if (categoryFilter !== 'all' && !singlePersonId) {
      filtered = filtered.filter(person =>
        personMatchesCategoryFilter(person, categoryFilter, {
          categoryOptions: brixiaCategories,
          dbCategories
        })
      )
    }

    console.log(`🔍 FILTRO: Categoria "${categoryFilter}" - ${filtered.length} persone trovate su ${people.length} totali`)
    
    // Debug dettagliato per tutte le persone e le prime 5 filtrate
    console.log('🔍 TUTTE LE PERSONE:', people.map(p => ({
      name: `${p.given_name} ${p.family_name}`,
      age: new Date().getFullYear() - new Date(p.date_of_birth).getFullYear(),
      player_categories: p.player_categories,
      is_player: p.is_player,
      is_staff: p.is_staff
    })))
    
    if (filtered.length > 0) {
      console.log('🔍 PRIME 5 PERSONE FILTRATE:', filtered.slice(0, 5).map(p => ({
        name: `${p.given_name} ${p.family_name}`,
        age: new Date().getFullYear() - new Date(p.date_of_birth).getFullYear(),
        player_categories: p.player_categories,
        is_player: p.is_player,
        is_staff: p.is_staff
      })))
    } else {
      console.log('❌ NESSUNA PERSONA FILTRATA - Controlla i dati delle persone sopra')
    }
    
    setFilteredPeople(filtered)
  }

  // Funzione per filtrare le quote in base alla categoria selezionata
  const filterFees = () => {
    let filtered = fees

    // Filtro per categoria
    if (categoryFilter !== 'all') {
      const categoryLabel = brixiaCategories.find(c => c.value === categoryFilter)?.label
      filtered = filtered.filter(fee =>
        feeMatchesCategoryFilter(fee, categoryFilter, categoryLabel, {
          includeAllCategoryFees: true,
          categoryOptions: brixiaCategories
        })
      )
    }

    console.log(`💰 FILTRO QUOTE: Categoria "${categoryFilter}" - ${filtered.length} quote trovate su ${fees.length} totali`)
    
    setFilteredFees(filtered)
  }

  const handlePersonToggle = (personId: string) => {
    setSelectedPeople(prev =>
      prev.includes(personId)
        ? prev.filter(id => id !== personId)
        : [...prev, personId]
    )
  }

  const handleSelectAll = () => {
    if (selectedPeople.length === filteredPeople.length) {
      setSelectedPeople([])
    } else {
      setSelectedPeople(filteredPeople.map(p => p.id))
    }
  }

  const handleClose = () => {
    setSelectedPeople([])
    setSelectedFeeId(null)
    setSearchTerm('')
    setCategoryFilter('all')
    setCustomAmount(null)
    setDueDate('')
    setNotes('')
    setMessage('')
    onClose()
  }

  const handleCreateAssignments = async () => {
    if (!selectedFeeId || selectedPeople.length === 0) return

    // Trova la quota selezionata
    const currentFee = fees.find(f => f.id === selectedFeeId)
    if (!currentFee) return

    try {
      setLoading(true)
      const assignments = selectedPeople.map(personId => ({
        fee_id: currentFee.id,
        person_id: personId,
        amount: (customAmount || currentFee.amount / 100) * 100, // Convert to cents
        due_date: dueDate,
        notes: notes || null
      }))

      const { error } = await supabase
        .from('fee_assignments')
        .insert(assignments)

      if (error) throw error

      setMessage('Assegnazioni create con successo!')
      onAssignmentCreated()
      handleClose()
    } catch (error) {
      console.error('Errore nella creazione delle assegnazioni:', error)
      setMessage('Errore nella creazione delle assegnazioni')
    } finally {
      setLoading(false)
    }
  }

  const getPersonCategory = (person: Person) => {
    // Se la persona ha categorie specifiche, usa la prima
    if (person.player_categories && person.player_categories.length > 0) {
      const category = brixiaCategories.find(cat => cat.value === person.player_categories[0])
      return category ? category.label : person.player_categories[0]
    }
    
    // Se è staff, mostra Staff
    if (person.is_staff) return 'Staff'
    
    // Altrimenti calcola per età
    const age = new Date().getFullYear() - new Date(person.date_of_birth).getFullYear()
    if (age < 6) return 'Under 6'
    if (age < 8) return 'Under 8'
    if (age < 10) return 'Under 10'
    if (age < 12) return 'Under 12'
    if (age < 14) return 'Under 14'
    if (age < 16) return 'Under 16'
    if (age < 18) return 'Under 18'
    return 'Seniores'
  }

  const getPersonCategoryColor = (person: Person) => {
    // Se la persona ha categorie specifiche, usa il colore della categoria
    if (person.player_categories && person.player_categories.length > 0) {
      const category = brixiaCategories.find(cat => cat.value === person.player_categories[0])
      if (category) {
        return `${category.color} text-gray-800`
      }
    }
    
    // Se è staff, usa colore arancione
    if (person.is_staff) return 'bg-orange-100 text-orange-800'
    
    // Altrimenti calcola per età
    const age = new Date().getFullYear() - new Date(person.date_of_birth).getFullYear()
    if (age < 6) return 'bg-blue-100 text-blue-800'
    if (age < 8) return 'bg-blue-200 text-blue-800'
    if (age < 10) return 'bg-green-100 text-green-800'
    if (age < 12) return 'bg-green-200 text-green-800'
    if (age < 14) return 'bg-yellow-100 text-yellow-800'
    if (age < 16) return 'bg-yellow-200 text-yellow-800'
    if (age < 18) return 'bg-orange-100 text-orange-800'
    return 'bg-red-200 text-red-800'
  }

  if (!isOpen || !selectedFee) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {singlePersonName ? `Assegna Quota a ${singlePersonName}` : 'Assegna Quote'}
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Messaggio */}
          {message && (
            <div className={`mb-4 p-3 rounded-md ${
              message.includes('successo') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {message}
            </div>
          )}

          {/* Seleziona Quota */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Seleziona Quota</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {filteredFees.map((fee) => (
                <div
                  key={fee.id}
                  onClick={() => setSelectedFeeId(fee.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedFeeId === fee.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{fee.name}</h5>
                      {fee.description && (
                        <p className="text-sm text-gray-600 mt-1">{fee.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-lg font-semibold text-green-600">
                          {formatCurrency(fee.amount / 100)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          fee.is_mandatory ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {fee.is_mandatory ? 'Obbligatoria' : 'Opzionale'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex flex-wrap gap-1">
                        {fee.applicable_categories && fee.applicable_categories.length > 0 ? (
                          fee.applicable_categories.map(category => (
                            <span key={category} className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {category === 'all' ? 'Tutte' : category}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {fee.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredFees.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nessuna quota disponibile per la categoria selezionata
                </div>
              )}
            </div>
          </div>

          {/* Configurazione assegnazione */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Importo Personalizzato (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={customAmount || ''}
                onChange={(e) => setCustomAmount(parseFloat(e.target.value) || null)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Lascia vuoto per usare importo base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Scadenza
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Note opzionali"
              />
            </div>
          </div>

          {/* Filtri e ricerca - nascosti in modalità singola persona */}
          {!singlePersonId && (
            <>
              <div className="mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cerca Persona
                    </label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nome o cognome..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filtra per Categoria
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {brixiaCategories.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Lista persone */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-md font-medium text-gray-900">
                    Seleziona Persone ({selectedPeople.length} selezionate)
                  </h4>
                  <div className="text-sm text-gray-600">
                    {categoryFilter === 'all' 
                      ? `Mostrando tutte le ${people.length} persone`
                      : `Mostrando ${filteredPeople.length} persone per categoria "${brixiaCategories.find(c => c.value === categoryFilter)?.label}"`
                    }
                  </div>
                  <button
                    onClick={handleSelectAll}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    {selectedPeople.length === filteredPeople.length ? 'Deseleziona Tutti' : 'Seleziona Tutti'}
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                  {loading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Caricamento persone...</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredPeople.map((person) => (
                        <label
                          key={person.id}
                          className="flex items-center p-4 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPeople.includes(person.id)}
                            onChange={() => handlePersonToggle(person.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {person.given_name} {person.family_name}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {new Date().getFullYear() - new Date(person.date_of_birth).getFullYear()} anni
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs ${getPersonCategoryColor(person)}`}>
                                {getPersonCategory(person)}
                              </span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Informazione persona selezionata in modalità singola */}
          {singlePersonId && singlePersonName && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-medium">👤</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-900">
                    Assegnazione per: {singlePersonName}
                  </p>
                  <p className="text-xs text-blue-700">
                    La quota verrà assegnata direttamente a questa persona
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pulsanti azione */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
            >
              Annulla
            </button>
            <button
              onClick={handleCreateAssignments}
              disabled={loading || selectedPeople.length === 0 || !selectedFeeId}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creazione...' : singlePersonId ? 'Assegna Quota' : `Crea ${selectedPeople.length} Assegnazioni`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeeAssignmentModal
