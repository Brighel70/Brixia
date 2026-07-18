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
  readable_categories?: string[] // Categorie leggibili mappate dal database
}

interface Fee {
  id: string
  name: string
  description: string
  amount: number
  category: string
  is_active: boolean
  payment_mode?: 'single' | 'installments'
  installment_count?: number
  installment_frequency?: 'monthly' | 'weekly'
  installment_start_date?: string
  installments?: Array<{ amount: number; due_date: string; notes?: string }>
  applicable_categories?: string[] // Array delle categorie applicabili
}

interface CompleteFeeAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  onAssignmentCreated: () => void
  singlePersonId?: string // ID della persona specifica (per assegnazione singola)
  singlePersonName?: string // Nome della persona specifica
}

const CompleteFeeAssignmentModal: React.FC<CompleteFeeAssignmentModalProps> = ({
  isOpen,
  onClose,
  onAssignmentCreated,
  singlePersonId,
  singlePersonName
}) => {
  const [fees, setFees] = useState<Fee[]>([])
  const [filteredFees, setFilteredFees] = useState<Fee[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null)
  const [selectedPeople, setSelectedPeople] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([])
  const [existingAssignments, setExistingAssignments] = useState<Map<string, string[]>>(new Map())
  
  // Configurazione rate
  const [paymentPlan, setPaymentPlan] = useState<'single' | 'installments'>('single')
  const [installmentCount, setInstallmentCount] = useState(1)
  const [installmentFrequency, setInstallmentFrequency] = useState<'monthly' | 'weekly'>('monthly')
  
  // Custom installments for assignment
  const [customInstallments, setCustomInstallments] = useState<Array<{ amount: number; due_date: string; notes?: string }>>([])
  
  // User configured installments (to maintain configurations when changing plan)
  const [userConfiguredInstallments, setUserConfiguredInstallments] = useState<Array<{ amount: number; due_date: string; notes?: string }>>([])
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; code: string }[]>([])

  // Solo categorie attivate nell'app
  const brixiaCategories = useActiveCategoriesForSelect()

  const loadSinglePerson = async (personId: string) => {
    try {
      setLoading(true)
      const { data: personData, error } = await supabase
        .from('people')
        .select('id, given_name, family_name, date_of_birth, is_player, is_staff, player_categories, staff_roles')
        .eq('id', personId)
        .single()

      if (error) throw error
      if (!personData) {
        setPeople([])
        return
      }

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name, code')
        .eq('active', true)

      setDbCategories(categoriesData || [])

      let readableCategories: string[] = []
      if (personData.player_categories?.length) {
        readableCategories = personData.player_categories.map((catId: string) => {
          if (typeof catId === 'string' && !catId.includes('-')) return catId
          const cat = categoriesData?.find((c: { id: string }) => c.id === catId)
          return cat?.code || cat?.name || catId
        }).filter(Boolean)
      }

      const personWithCategories: Person = {
        ...personData,
        readable_categories: readableCategories
      }
      setPeople([personWithCategories])
      setSelectedPeople([personId])
    } catch (e) {
      console.error('Errore caricamento persona singola:', e)
      setPeople([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      console.log('CompleteFeeAssignmentModal OPENED:', { isOpen, singlePersonId })
      loadFees()
      loadExistingAssignments() // Carica le assegnazioni esistenti
      if (singlePersonId) {
        // Modalità singola persona - carica la persona per mostrarla nella lista
        console.log('MODALITÀ SINGOLA PERSONA:', singlePersonId)
        loadSinglePerson(singlePersonId)
      } else {
        // Modalità normale - carica tutte le persone
        console.log('MODALITÀ NORMALE - Caricamento persone...')
        loadPeople()
        // Reset selectedPeople per modalità normale
        setSelectedPeople([])
      }
      
      // Reset del piano di pagamento (verrà impostato quando si seleziona una quota)
      setPaymentPlan('single')
      setCustomInstallments([])
      setUserConfiguredInstallments([])
    }
  }, [isOpen, singlePersonId])

  // Aggiorna filteredPeople quando cambiano people, searchTerm o categoryFilter
  useEffect(() => {
    const filtered = filterPeople()
    setFilteredPeople(filtered)
    
    // Aggiorna selectAll quando cambiano le persone filtrate o le selezioni
    const filteredPlayerIds = filtered.map(person => person.id)
    const allSelected = filteredPlayerIds.length > 0 && filteredPlayerIds.every(id => selectedPeople.includes(id))
    setSelectAll(allSelected)
  }, [people, searchTerm, categoryFilter, selectedPeople, dbCategories, brixiaCategories])

  // Carica le rate quando viene selezionata una quota
  useEffect(() => {
    if (selectedFee) {
      console.log('Quota selezionata:', selectedFee)
      console.log('Fee installments:', selectedFee.installments)
      console.log('Currently configured installments:', customInstallments)
      
      // Solo se non ci sono rate già configurate, carica quelle della quota
      if (customInstallments.length === 0) {
        // If fee has pre-configured installments, set "installments" and load them
        if (selectedFee.installments && selectedFee.installments.length > 0) {
          console.log('Caricando rate pre-configurate:', selectedFee.installments)
          setPaymentPlan('installments')
          setCustomInstallments(selectedFee.installments)
        } else {
          // Altrimenti imposta pagamento unico con le 2 rate di default
          setPaymentPlan('single')
          setDefaultSinglePaymentInstallments()
        }
      } else {
        console.log('Installments already configured, keeping existing ones')
      }
    }
  }, [selectedFee])

  // Imposta le 3 rate di default per pagamento unico
  const setDefaultSinglePaymentInstallments = () => {
    const currentYear = new Date().getFullYear()
    const defaultInstallments = [
      { amount: 100, due_date: `${currentYear}-07-07`, notes: 'Acconto' },
      { amount: 100, due_date: `${currentYear}-08-07`, notes: 'Rata 2' },
      { amount: 100, due_date: `${currentYear}-09-07`, notes: 'Saldo' }
    ]
    setCustomInstallments(defaultInstallments)
    // Non sovrascrivere le rate configurate dall'utente
    if (userConfiguredInstallments.length === 0) {
      setUserConfiguredInstallments(defaultInstallments)
    }
  }

  const loadFees = async () => {
    try {
      const { data, error } = await supabase
        .from('fees')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      console.log('Quote caricate:', data)
      setFees(data || [])
    } catch (error) {
      console.error('Errore nel caricamento delle quote:', error)
    }
  }

  const filterFees = () => {
    let filtered = fees

    if (categoryFilter !== 'all') {
      const categoryLabel = brixiaCategories.find(c => c.value === categoryFilter)?.label
      filtered = filtered.filter(fee =>
        feeMatchesCategoryFilter(fee, categoryFilter, categoryLabel, {
          includeAllCategoryFees: true,
          categoryOptions: brixiaCategories
        })
      )
    }

    console.log(`FILTRO QUOTE: Categoria "${categoryFilter}" - ${filtered.length} quote trovate su ${fees.length} totali`)
    setFilteredFees(filtered)
  }

  useEffect(() => {
    filterFees()
  }, [fees, categoryFilter])

  const loadExistingAssignments = async () => {
    try {
      // Carica tutte le assegnazioni esistenti
      const { data, error } = await supabase
        .from('fee_assignments')
        .select('person_id, fee_id')
      
      if (error) throw error
      
      // Crea una mappa: person_id -> array di fee_id assegnati
      const assignmentsMap = new Map<string, string[]>()
      data?.forEach(assignment => {
        const existing = assignmentsMap.get(assignment.person_id) || []
        if (!existing.includes(assignment.fee_id)) {
          existing.push(assignment.fee_id)
        }
        assignmentsMap.set(assignment.person_id, existing)
      })
      
      setExistingAssignments(assignmentsMap)
    } catch (error) {
      console.error('Errore nel caricamento delle assegnazioni esistenti:', error)
    }
  }

  const loadPeople = async () => {
    console.log('INIZIO loadPeople() in CompleteFeeAssignmentModal')
    try {
      setLoading(true)
      
      // Carica le persone con le categorie mappate
      const { data, error } = await supabase
        .from('people')
        .select(`
          id, 
          given_name, 
          family_name, 
          date_of_birth, 
          is_player, 
          is_staff, 
          player_categories, 
          staff_roles
        `)
        .order('family_name')

      if (error) {
        console.error('ERRORE SUPABASE loadPeople:', error)
        throw error
      }
      
      // Carica le categorie per mappare gli UUID ai nomi
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name, code')
        .eq('active', true)

      if (categoriesError) {
        console.error('ERRORE SUPABASE categories:', categoriesError)
        throw categoriesError
      }
      setDbCategories(categoriesData || [])

      // Mappa le persone con le categorie leggibili
      const peopleWithReadableCategories = (data || []).map(person => {
        let readableCategories: string[] = []
        
        if (person.player_categories && person.player_categories.length > 0) {
          readableCategories = person.player_categories.map(categoryId => {
            // Se è già una stringa leggibile (es. "U18"), usala direttamente
            if (typeof categoryId === 'string' && !categoryId.includes('-')) {
              return categoryId
            }
            
            // Se è un UUID, mappalo al nome della categoria
            const category = categoriesData?.find(c => c.id === categoryId)
            return category?.code || category?.name || categoryId
          }).filter(Boolean)
        }
        
        return {
          ...person,
          readable_categories: readableCategories
        }
      })
      
      console.log('PERSONE CARICATE DAL DATABASE:', peopleWithReadableCategories.length, 'persone')
      
      // Debug per vedere i giocatori U18
      const u18Players = peopleWithReadableCategories.filter(p => 
        p.readable_categories.includes('U18')
      )
      
      console.log('GIOCATORI U18 TROVATI:', u18Players.length)
      u18Players.forEach(player => {
        console.log('GIOCATORE U18:', {
          name: `${player.given_name} ${player.family_name}`,
          age: new Date().getFullYear() - new Date(player.date_of_birth).getFullYear(),
          readable_categories: player.readable_categories
        })
      })
      
      setPeople(peopleWithReadableCategories)
    } catch (error) {
      console.error('Errore nel caricamento delle persone:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterPeople = () => {
    let filtered = people

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(person =>
        (person.given_name || '').toLowerCase().includes(term) ||
        (person.family_name || '').toLowerCase().includes(term) ||
        (person.full_name || '').toLowerCase().includes(term)
      )
    }

    // Filtro per categoria Brixia - SOLO categoria dalla scheda del giocatore
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(person =>
        personMatchesCategoryFilter(person, categoryFilter, {
          categoryOptions: brixiaCategories,
          dbCategories
        })
      )
    }

    // In modalità singola persona, mostra sempre la persona (anche se non è giocatore)
    if (singlePersonId) {
      return filtered
    }
    return filtered.filter(person => person.is_player)
  }

  const togglePersonSelection = (personId: string, checked?: boolean) => {
    if (checked !== undefined) {
      // Chiamata dal checkbox individuale
      setSelectedPeople(prev =>
        checked
          ? [...prev, personId]
          : prev.filter(id => id !== personId)
      )
    } else {
      // Chiamata dal click sulla riga
      setSelectedPeople(prev =>
        prev.includes(personId)
          ? prev.filter(id => id !== personId)
          : [...prev, personId]
      )
    }
  }

  const addCustomInstallment = () => {
    const newInstallment = { amount: 0, due_date: '', notes: '' }
    setCustomInstallments(prev => [...prev, newInstallment])
    setUserConfiguredInstallments(prev => [...prev, newInstallment])
  }

  const updateCustomInstallment = (index: number, field: string, value: any) => {
    setCustomInstallments(prev =>
      prev.map((installment, i) =>
        i === index ? { ...installment, [field]: value } : installment
      )
    )
    setUserConfiguredInstallments(prev =>
      prev.map((installment, i) =>
        i === index ? { ...installment, [field]: value } : installment
      )
    )
  }

  const removeCustomInstallment = (index: number) => {
    setCustomInstallments(prev => prev.filter((_, i) => i !== index))
    setUserConfiguredInstallments(prev => prev.filter((_, i) => i !== index))
  }

  const calculateInstallments = () => {
    // Se ci sono rate personalizzate configurate, usale per l'anteprima
    if (customInstallments.length > 0) {
      return customInstallments.map((installment, index) => ({
        number: index + 1,
        amount: installment.amount,
        dueDate: installment.due_date
      }))
    }

    // Se non ci sono rate personalizzate e paymentPlan è 'single', usa le rate di default
    if (paymentPlan === 'single') {
      const currentYear = new Date().getFullYear()
      return [
        { number: 1, amount: 100, dueDate: `${currentYear}-07-07` },
        { number: 2, amount: 100, dueDate: `${currentYear}-08-07` },
        { number: 3, amount: 100, dueDate: `${currentYear}-09-07` }
      ]
    }

    const totalAmount = 300 // Importo fisso per ora
    const installmentAmount = totalAmount / installmentCount
    const startDate = new Date()

    return Array.from({ length: installmentCount }, (_, i) => {
      const installmentDate = new Date(startDate)
      
      if (installmentFrequency === 'monthly') {
        installmentDate.setMonth(startDate.getMonth() + i)
      } else {
        installmentDate.setDate(startDate.getDate() + (i * 7))
      }

      return {
        number: i + 1,
        amount: installmentAmount,
        dueDate: installmentDate.toISOString().split('T')[0]
      }
    })
  }

  const handleCreateAssignments = async () => {
    if (!selectedFee) {
      alert('Seleziona una quota dalla lista sopra (clicca su una delle quote disponibili).')
      return
    }
    if (selectedPeople.length === 0) {
      alert('Seleziona almeno una persona dalla lista.')
      return
    }
    const effectiveCount = getEffectiveAssignmentsCount()
    if (effectiveCount === 0) {
      alert('Le persone selezionate hanno già questa quota assegnata. Scegli altre persone o un\'altra quota.')
      return
    }

    try {
      setLoading(true)

      // STESSA LOGICA del sistema normale di assegnazione dalla scheda persona
      // Controlla se la quota ha rate configurate
      if (selectedFee.payment_mode === 'installments' && selectedFee.installments && selectedFee.installments.length > 0) {
        // Crea assegnazioni separate per ogni rata usando le rate preconfigurate della quota
        for (const personId of selectedPeople) {
          // Controlla se esiste già un'assegnazione per questa quota e persona
          const { data: existingAssignments } = await supabase
            .from('fee_assignments')
            .select('id')
            .eq('fee_id', selectedFee.id)
            .eq('person_id', personId)

          if (existingAssignments && existingAssignments.length > 0) {
            // Aggiorna le assegnazioni esistenti
            for (let i = 0; i < selectedFee.installments.length; i++) {
              const installment = selectedFee.installments[i]
              
              const { error: updateError } = await supabase
                .from('fee_assignments')
                .update({
                  amount: Math.round(installment.amount * 100),
                  due_date: installment.due_date,
                  notes: installment.notes || ''
                })
                .eq('fee_id', selectedFee.id)
                .eq('person_id', personId)
                .eq('installment_number', installment.installment_number || (i + 1))

              if (updateError) throw updateError
            }
          } else {
            // Crea nuove assegnazioni separate per ogni rata (STESSA LOGICA del sistema normale)
            const assignmentsToCreate = selectedFee.installments.map((installment: any, index: number) => ({
              fee_id: selectedFee.id,
              person_id: personId,
              amount: Math.round(installment.amount * 100), // Converti da euro a centesimi
              due_date: installment.due_date,
              status: 'pending',
              installment_number: installment.installment_number || (index + 1),
              notes: installment.notes || ''
            }))

            const { error: insertError } = await supabase
              .from('fee_assignments')
              .insert(assignmentsToCreate)

            if (insertError) throw insertError
          }
        }
      } else if (paymentPlan === 'single' && customInstallments.length > 0) {
        // Usa le rate personalizzate configurate nell'assegnazione (per quote senza rate preconfigurate)
        for (const personId of selectedPeople) {
          // Controlla se esiste già un'assegnazione per questa quota e persona
          const { data: existingAssignments } = await supabase
            .from('fee_assignments')
            .select('id')
            .eq('fee_id', selectedFee.id)
            .eq('person_id', personId)

          if (existingAssignments && existingAssignments.length > 0) {
            // Aggiorna le assegnazioni esistenti
            for (let i = 0; i < customInstallments.length; i++) {
              const installmentAmount = customInstallments[i].amount
              const installmentDate = new Date(customInstallments[i].due_date)
              
              const { error: updateError } = await supabase
                .from('fee_assignments')
                .update({
                  amount: installmentAmount * 100,
                  due_date: installmentDate.toISOString().split('T')[0],
                  notes: customInstallments[i].notes || `Rata ${i + 1}/${customInstallments.length}`
                })
                .eq('fee_id', selectedFee.id)
                .eq('person_id', personId)
                .eq('installment_number', i + 1)

              if (updateError) throw updateError
            }
          } else {
            // Crea nuove assegnazioni separate per ogni rata
            const assignmentsToCreate = customInstallments.map((installment, index) => ({
              fee_id: selectedFee.id,
              person_id: personId,
              amount: Math.round(installment.amount * 100), // Converti da euro a centesimi
              due_date: installment.due_date,
              status: 'pending',
              installment_number: installment.installment_number || (index + 1),
              notes: installment.notes || `Rata ${index + 1}/${customInstallments.length}`
            }))

            const { error: insertError } = await supabase
              .from('fee_assignments')
              .insert(assignmentsToCreate)

            if (insertError) throw insertError
          }
        }
      } else {
        // Crea una singola assegnazione per pagamento unico (STESSA LOGICA del sistema normale)
        for (const personId of selectedPeople) {
          // Controlla se esiste già un'assegnazione per questa quota e persona
          const { data: existingAssignments } = await supabase
            .from('fee_assignments')
            .select('id')
            .eq('fee_id', selectedFee.id)
            .eq('person_id', personId)

          if (existingAssignments && existingAssignments.length > 0) {
            // Aggiorna l'assegnazione esistente
            const { error: updateError } = await supabase
              .from('fee_assignments')
              .update({
                amount: selectedFee.amount,
                due_date: selectedFee.due_date || new Date().toISOString().split('T')[0],
                notes: ''
              })
              .eq('fee_id', selectedFee.id)
              .eq('person_id', personId)

            if (updateError) throw updateError
          } else {
            // Crea nuova assegnazione singola
            const { error: insertError } = await supabase
              .from('fee_assignments')
              .insert({
                fee_id: selectedFee.id,
                person_id: personId,
                amount: selectedFee.amount,
                due_date: selectedFee.due_date || new Date().toISOString().split('T')[0],
                status: 'pending',
                installment_number: 1,
                installment_type: null
              })

            if (insertError) throw insertError
          }
        }
      }

      onAssignmentCreated()
      handleClose()
    } catch (error: any) {
      console.error('Errore nella creazione delle assegnazioni:', error)
      const message = error?.message || error?.hint || 'Errore durante la creazione delle assegnazioni.'
      alert(`Impossibile creare le assegnazioni.\n\n${message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedFee(null)
    setSelectedPeople([])
    setSearchTerm('')
    setCategoryFilter('all')
    setPaymentPlan('single')
    setInstallmentCount(1)
    setInstallmentFrequency('monthly')
    setCustomInstallments([])
    setUserConfiguredInstallments([])
    onClose()
  }

  const getPersonCategory = (person: Person) => {
    // Usa le categorie leggibili se disponibili
    if (person.readable_categories && person.readable_categories.length > 0) {
      const category = brixiaCategories.find(cat => cat.value === person.readable_categories[0])
      return category ? category.label : person.readable_categories[0]
    }
    // Fallback alle categorie originali (se per qualche motivo readable_categories non è popolato)
    if (person.player_categories && person.player_categories.length > 0) {
      const category = brixiaCategories.find(cat => cat.value === person.player_categories[0])
      return category ? category.label : person.player_categories[0]
    }
    
    // Calcolo per età come fallback
    const age = new Date().getFullYear() - new Date(person.date_of_birth).getFullYear()
    if (person.is_staff) return 'Staff'
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
    // Usa le categorie leggibili se disponibili
    if (person.readable_categories && person.readable_categories.length > 0) {
      const category = brixiaCategories.find(cat => cat.value === person.readable_categories[0])
      if (category) {
        return `${category.color} text-gray-800`
      }
    }
    // Fallback alle categorie originali
    if (person.player_categories && person.player_categories.length > 0) {
      const category = brixiaCategories.find(cat => cat.value === person.player_categories[0])
      if (category) {
        return `${category.color} text-gray-800`
      }
    }
    
    // Calcolo per età come fallback
    const age = new Date().getFullYear() - new Date(person.date_of_birth).getFullYear()
    if (person.is_staff) return 'bg-orange-100 text-orange-800'
    if (age < 6) return 'bg-blue-100 text-blue-800'
    if (age < 8) return 'bg-blue-200 text-blue-800'
    if (age < 10) return 'bg-green-100 text-green-800'
    if (age < 12) return 'bg-green-200 text-green-800'
    if (age < 14) return 'bg-yellow-100 text-yellow-800'
    if (age < 16) return 'bg-yellow-200 text-yellow-800'
    if (age < 18) return 'bg-orange-100 text-orange-800'
    return 'bg-red-200 text-red-800'
  }

  // Verifica se una persona ha già la quota selezionata assegnata
  const hasExistingFeeAssignment = (personId: string): boolean => {
    if (!selectedFee) return false
    const personAssignments = existingAssignments.get(personId) || []
    return personAssignments.includes(selectedFee.id)
  }

  // Calcola il numero di assegnazioni effettive (escludendo chi ha già la quota)
  const getEffectiveAssignmentsCount = (): number => {
    if (!selectedFee) return 0
    const availablePeople = selectedPeople.filter(personId => !hasExistingFeeAssignment(personId))
    return availablePeople.length
  }

  // Gestione "Assegna tutti"
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      // Seleziona solo i giocatori che NON hanno già la quota assegnata
      const availablePlayerIds = filteredPeople
        .filter(person => !hasExistingFeeAssignment(person.id))
        .map(person => person.id)
      setSelectedPeople(availablePlayerIds)
    } else {
      // Deseleziona tutti
      setSelectedPeople([])
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-[95%] max-w-6xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {singlePersonName ? `Assegna Quota a ${singlePersonName}` : 'Assegna Quote'}
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Chiudi</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sezione Quote */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Seleziona Quota</h4>
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Caricamento quote...</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    <p className="text-xs text-gray-500 mb-2">Clicca su una quota per selezionarla (bordo blu = selezionata)</p>
                    {filteredFees.map((fee) => (
                      <div
                        key={fee.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedFee(fee)}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedFee(fee)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors rounded ${
                          selectedFee?.id === fee.id ? 'bg-blue-50 border-l-4 border-blue-500 ring-1 ring-blue-200' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-medium text-gray-900">{fee.name}</h5>
                              {selectedFee?.id === fee.id && (
                                <span className="text-xs font-medium text-blue-600">✓ Selezionata</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{fee.description}</p>
                            <div className="flex items-center mt-2 space-x-2">
                              <span className="text-lg font-bold text-green-600">
                                {formatCurrency(fee.amount / 100)}
                              </span>
                              {fee.applicable_categories && fee.applicable_categories.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {fee.applicable_categories.map((category, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800"
                                    >
                                      {category}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sezione Persone */}
            <div className="space-y-4">
              {/* Informazione persona selezionata in modalità singola */}
              {singlePersonId && singlePersonName && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-600 text-sm font-medium">👤</span>
                    <span className="text-sm text-blue-800">
                      <strong>{singlePersonName}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    La quota verrà assegnata direttamente a questa persona
                  </p>
                </div>
              )}

              {/* Filtri e ricerca - nascosti in modalità singola persona */}
              {!singlePersonId && (
                <>
                  <h4 className="text-md font-medium text-gray-900">Seleziona Persone</h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Cerca persona..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
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
                </>
              )}

              {/* Checkbox "Assegna tutti" - solo se non è modalità singola persona */}
              {!singlePersonId && filteredPeople.length > 0 && (
                <div className="flex items-center space-x-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="selectAll"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="selectAll" className="text-sm font-medium text-gray-700">
                    Assegna tutti ({filteredPeople.filter(person => !hasExistingFeeAssignment(person.id)).length} giocatori)
                  </label>
                </div>
              )}

              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Caricamento persone...</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredPeople.map((person) => {
                      const hasQuota = hasExistingFeeAssignment(person.id)
                      return (
                        <div
                          key={person.id}
                          className={`p-3 transition-colors ${
                            hasQuota 
                              ? 'bg-gray-100 opacity-60 cursor-not-allowed' 
                              : selectedPeople.includes(person.id) 
                                ? 'bg-blue-50 border-l-4 border-blue-500' 
                                : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={selectedPeople.includes(person.id)}
                                disabled={hasQuota}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  if (!hasQuota) {
                                    togglePersonSelection(person.id, e.target.checked)
                                  }
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <div>
                                <p className={`font-medium ${hasQuota ? 'text-gray-500' : 'text-gray-900'}`}>
                                  {person.given_name} {person.family_name}
                                  {hasQuota && <span className="ml-2 text-xs text-orange-600 font-semibold">✓ Già assegnata</span>}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {new Date().getFullYear() - new Date(person.date_of_birth).getFullYear()} anni
                                </p>
                              </div>
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPersonCategoryColor(person)}`}>
                              {getPersonCategory(person)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Configurazione Assegnazione */}
          {selectedFee && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 mb-4">Configurazione Assegnazione</h4>
              
              {/* Payment Settings */}
              {selectedFee.payment_mode && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Impostazioni Pagamento:</h5>
                  <div className="text-sm text-blue-800">
                    <p>
                      <strong>Tipo:</strong>{" "}
                      {selectedFee.payment_mode === "single" ? "Pagamento Unico" : "Rate"}
                    </p>

                    {selectedFee.payment_mode === "installments" && (
                      <>
                        {selectedFee.installments && selectedFee.installments.length > 0 ? (
                          <div>
                            <p>
                              <strong>Configured Installments:</strong>{" "}
                              {selectedFee.installments.length}
                            </p>
                            <div className="mt-2 space-y-1">
                              {selectedFee.installments.map((installment, index) => (
                                <div key={index} className="text-xs bg-white p-2 rounded border">
                                  <span className="font-medium">Installment {index + 1}:</span>
                                  <span className="text-green-600 ml-1">
                                    {formatCurrency(installment.amount)}
                                  </span>
                                  <span className="text-gray-600 ml-2">
                                    {new Date(installment.due_date).toLocaleDateString("it-IT")}
                                  </span>
                                  {installment.notes && (
                                    <span className="text-gray-500 ml-2">({installment.notes})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <p>
                              <strong>Installment Count:</strong>{" "}
                              {selectedFee.installment_count}
                            </p>
                            <p>
                              <strong>Frequency:</strong>{" "}
                              {selectedFee.installment_frequency === "monthly" ? "Monthly" : "Weekly"}
                            </p>
                            {selectedFee.installment_start_date && (
                              <p>
                                <strong>First Installment:</strong>{" "}
                                {new Date(selectedFee.installment_start_date).toLocaleDateString("it-IT")}
                              </p>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Importo Personalizzato (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="300.00"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Piano di Pagamento
                  </label>
                  <select
                    value={paymentPlan}
                    onChange={(e) => {
                      const newPlan = e.target.value as 'single' | 'installments'
                      setPaymentPlan(newPlan)
                      
                      if (newPlan === 'installments') {
                        // Quando si seleziona "Installments", ripristina le rate configurate dall'utente se ci sono
                        if (userConfiguredInstallments.length > 0) {
                          setCustomInstallments(userConfiguredInstallments)
                        } else {
                          setCustomInstallments([])
                        }
                      } else if (newPlan === 'single') {
                        // Quando si seleziona "Single", usa le rate di default
                        setDefaultSinglePaymentInstallments()
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="single">Pagamento Unico</option>
                    <option value="installments">Rate</option>
                  </select>
                </div>
                
                {(paymentPlan === 'installments' || paymentPlan === 'single') && (
                  <div className="col-span-full">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="text-sm font-medium text-gray-700">
                        {paymentPlan === 'single' ? 'Rate Pagamento Unico' : 'Configurazione Rate'}
                      </h5>
                      <button
                        type="button"
                        onClick={addCustomInstallment}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        + Aggiungi Rata
                      </button>
                    </div>
                    
                    {paymentPlan === 'single' && (
                      <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-700">
                          💡 <strong>Pagamento Unico:</strong> Configurazione automatica con 3 rate (€100 + €100 + €100)
                        </p>
                      </div>
                    )}

                    {customInstallments.length > 0 ? (
                      <div className="space-y-3">
                        {customInstallments.map((installment, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-white rounded border">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Rata {index + 1} - Importo (€)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={installment.amount}
                                onChange={(e) => updateCustomInstallment(index, 'amount', parseFloat(e.target.value) || 0)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Data Scadenza
                              </label>
                              <input
                                type="date"
                                value={installment.due_date}
                                onChange={(e) => updateCustomInstallment(index, 'due_date', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Note
                              </label>
                              <input
                                type="text"
                                value={installment.notes || ''}
                                onChange={(e) => updateCustomInstallment(index, 'notes', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Note..."
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => removeCustomInstallment(index)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                              >
                                Rimuovi
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        {/* Summary Total */}
                        <div className="p-3 bg-blue-50 rounded border">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">Totale Rate:</span>
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(customInstallments.reduce((total, installment) => total + installment.amount, 0))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-sm font-medium text-gray-700">Totale Quota:</span>
                            <span className="text-lg font-bold text-blue-600">
                              {formatCurrency(selectedFee ? selectedFee.amount / 100 : 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">Nessuna rata configurata</p>
                        <p className="text-xs mt-1">Clicca "Aggiungi Rata" per configurare le rate</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Anteprima Rate */}
              {(paymentPlan === 'installments' || (paymentPlan === 'single' && customInstallments.length > 0)) && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Anteprima Rate:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {calculateInstallments().map((installment) => (
                      <div key={installment.number} className="p-2 bg-white rounded border text-sm">
                        <div className="font-medium">Rata {installment.number}</div>
                        <div className="text-green-600">{formatCurrency(installment.amount)}</div>
                        <div className="text-gray-500">{new Date(installment.dueDate).toLocaleDateString('it-IT')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pulsanti di azione */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => handleCreateAssignments()}
              disabled={!selectedFee || getEffectiveAssignmentsCount() === 0 || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creazione...' : singlePersonId ? 'Assegna Quota' : `Crea ${getEffectiveAssignmentsCount()} Assegnazioni`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompleteFeeAssignmentModal