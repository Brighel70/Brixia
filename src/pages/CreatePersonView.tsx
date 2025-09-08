import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'
import PersonalInfoTab from '@/components/PersonalInfoTab'
import DocumentsTab from '@/components/DocumentsTab'
// import PlayerTab from '@/components/PlayerTab'
// import NotesTab from '@/components/NotesTab'
import InjuriesTab from '@/components/InjuriesTab'
import InjuryEditModal from '@/components/InjuryEditModal'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import TutorTab from '@/components/TutorTab'
import MinorTutorWarning from '@/components/MinorTutorWarning'
import { usePersonForm } from '@/hooks/usePersonForm'

// Memo sul componente evita render inutili senza causare remount
const MemoInjuriesTab = React.memo(InjuriesTab)

const CreatePersonView: React.FC = () => {
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isEditing = !!editId
  const navigate = useNavigate()

  const {
    form,
    setForm,
    isEditMode,
    loading,
    categories,
    playerPositions,
    handleInputChange: originalHandleInputChange,
    handleSubmit,
    isFieldDisabled,
    handleEdit,
    handleSave,
    handleCancel
  } = usePersonForm()

  // Stato per il modal degli infortuni
  const [showInjuryModal, setShowInjuryModal] = useState(false)
  const [editingInjury, setEditingInjury] = useState<any>(null)
  const [injuryRefreshTrigger, setInjuryRefreshTrigger] = useState(0)
  
  // Stato per il modal di eliminazione infortuni
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [injuryToDelete, setInjuryToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Stato per il form delle attività infortuni
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [selectedInjuryId, setSelectedInjuryId] = useState<string | null>(null)
  const [activityForm, setActivityForm] = useState({
    activity_type: 'medical_visit' as const,
    activity_date: new Date().toISOString().split('T')[0],
    operator_name: '',
    duration_minutes: '',
    description: '',
    notes: '',
    amount: '',
    currency: 'EUR',
    test_type: '', // Aggiungo il campo per il tipo di esame
    can_play_field: false, // Campo checkbox
    can_play_gym: false, // Palestra checkbox
    expected_stop_days: '', // Previsione stop in giorni
    ricontrollo: '', // Data ricontrollo
    massaggio: false, // Checkbox fisioterapia
    tecar: false, // Checkbox fisioterapia
    laser: false // Checkbox fisioterapia
  })
  const [medicalStaff, setMedicalStaff] = useState<Array<{id: string, full_name: string, role: string}>>([])
  const [customOperator, setCustomOperator] = useState('')
  
  // Stato per i ruoli staff
  const [staffRoles, setStaffRoles] = useState<Array<{id: string, name: string, position_order: number}>>([])
  
  // Stati per il modal di conferma eliminazione attività
  const [showDeleteActivityModal, setShowDeleteActivityModal] = useState(false)
  const [activityToDelete, setActivityToDelete] = useState<{id: string, injuryId: string, type: string} | null>(null)
  const [deletingActivity, setDeletingActivity] = useState(false)
  
  // Stati per il popup di conferma ricontrollo
  const [showRicontrolloModal, setShowRicontrolloModal] = useState(false)
  const [pendingActivityData, setPendingActivityData] = useState<any>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedRicontrolloDate, setSelectedRicontrolloDate] = useState('')
  
  // Stati per la modifica delle attività
  const [editingActivity, setEditingActivity] = useState<any>(null)
  const [isEditingActivity, setIsEditingActivity] = useState(false)

  // Funzioni per gestire il modal degli infortuni
  const openInjuryModal = (injury: any = null) => {
    setEditingInjury(injury)
    setShowInjuryModal(true)
  }

  // Funzioni per gestire il modal di eliminazione attività
  const openDeleteActivityModal = (activityId: string, injuryId: string, activityType: string) => {
    setActivityToDelete({ id: activityId, injuryId, type: activityType })
    setShowDeleteActivityModal(true)
  }

  // Funzioni per gestire la modifica delle attività
  const openEditActivityForm = (activity: any) => {
    setEditingActivity(activity)
    setIsEditingActivity(true)
    setSelectedInjuryId(activity.injury_id)
    
    // Pre-compila il form con i dati dell'attività
    setActivityForm({
      activity_type: activity.activity_type,
      activity_date: new Date(activity.activity_date).toISOString().split('T')[0],
      operator_name: activity.operator_name || '',
      duration_minutes: activity.duration_minutes?.toString() || '',
      description: activity.activity_description || activity.description || '',
      notes: activity.notes || '',
      amount: activity.amount?.toString() || '',
      currency: activity.currency || 'EUR',
      test_type: '', // Reset del tipo di test
      can_play_field: activity.can_play_field || false,
      can_play_gym: activity.can_play_gym || false,
      expected_stop_days: activity.expected_stop_days?.toString() || '',
      ricontrollo: activity.ricontrollo || '',
      massaggio: activity.massaggio || false,
      tecar: activity.tecar || false,
      laser: activity.laser || false
    })
    
    setShowActivityForm(true)
  }

  const closeEditActivityForm = () => {
    setEditingActivity(null)
    setIsEditingActivity(false)
    setShowActivityForm(false)
    setSelectedInjuryId(null)
    // Reset del form
    setActivityForm({
      activity_type: 'medical_visit' as const,
      activity_date: new Date().toISOString().split('T')[0],
      operator_name: '',
      duration_minutes: '',
      description: '',
      notes: '',
      amount: '',
      currency: 'EUR',
      test_type: '',
      can_play_field: false,
      can_play_gym: false,
      expected_stop_days: '',
      ricontrollo: '',
      massaggio: false,
      tecar: false,
      laser: false
    })
  }

  const closeDeleteActivityModal = () => {
    setShowDeleteActivityModal(false)
    setActivityToDelete(null)
    setDeletingActivity(false)
  }

  const confirmDeleteActivity = async () => {
    if (!activityToDelete) return

    setDeletingActivity(true)
    try {
      const { error } = await supabase
        .from('injury_activities')
        .delete()
        .eq('id', activityToDelete.id)

      if (error) throw error

      // Ricarica le attività per aggiornare la lista
      setInjuryRefreshTrigger(prev => prev + 1)
      console.log('✅ Attività eliminata con successo')
      closeDeleteActivityModal()
    } catch (error) {
      console.error('❌ Errore nell\'eliminazione dell\'attività:', error)
      alert('Errore nell\'eliminazione dell\'attività: ' + (error as any)?.message || 'Errore sconosciuto')
    } finally {
      setDeletingActivity(false)
    }
  }

  // Funzione helper per i nomi dei tipi di attività
  const getActivityTypeName = (type: string) => {
    const types = {
      medical_visit: 'Visita Medica',
      physiotherapy: 'Fisioterapia',
      test: 'Test/Esame',
      note: 'Annotazione',
      insurance_refund: 'Rimborso Assicurativo',
      equipment_purchase: 'Acquisto Attrezzatura',
      expenses: 'Spese Sostenute',
      other: 'Altro'
    }
    return types[type as keyof typeof types] || type
  }

  const closeInjuryModal = () => {
    setShowInjuryModal(false)
    setEditingInjury(null)
  }

  const handleInjurySaved = async () => {
    // Incrementa il trigger per forzare il refresh della lista infortuni
    setInjuryRefreshTrigger(prev => prev + 1)
    
    // Controlla se ci sono infortuni aperti per questo giocatore e aggiorna lo stato injured
    if (editId) {
      try {
        const { data: openInjuries } = await supabase
          .from('injuries')
          .select('id')
          .eq('person_id', editId)
          .eq('is_closed', false)
        
        const hasOpenInjuries = openInjuries && openInjuries.length > 0
        
        // Aggiorna lo stato injured basato sulla presenza di infortuni aperti
        setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
        await saveInjuredStatus(editId, hasOpenInjuries)
      } catch (error) {
        // Fallback: se i campi is_closed non esistono ancora, usa current_status
        console.warn('Campi is_closed non disponibili, uso current_status come fallback')
        const { data: injuries } = await supabase
          .from('injuries')
          .select('id, current_status')
          .eq('person_id', editId)
        
        const hasOpenInjuries = injuries && injuries.some(injury => injury.current_status === 'In corso')
        setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
        await saveInjuredStatus(editId, hasOpenInjuries)
      }
    }
  }

  // Funzioni per gestire l'eliminazione infortuni
  const openDeleteModal = (injury: any) => {
    setInjuryToDelete(injury)
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setInjuryToDelete(null)
  }

  const confirmDeleteInjury = async () => {
    if (!injuryToDelete) return

    try {
      setDeleting(true)
      
      const { error } = await supabase
        .from('injuries')
        .delete()
        .eq('id', injuryToDelete.id)

      if (error) {
        console.error('❌ Errore Supabase:', error)
        throw error
      }
      
      console.log('✅ Infortunio eliminato con successo')
      setInjuryRefreshTrigger(prev => prev + 1) // Refresh la lista
      
      // Controlla se ci sono ancora infortuni aperti dopo l'eliminazione
      if (editId) {
        try {
          const { data: openInjuries } = await supabase
            .from('injuries')
            .select('id')
            .eq('person_id', editId)
            .eq('is_closed', false)
          
          const hasOpenInjuries = openInjuries && openInjuries.length > 0
          
          // Aggiorna lo stato injured basato sulla presenza di infortuni aperti
          setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
          await saveInjuredStatus(editId, hasOpenInjuries)
        } catch (error) {
          // Fallback: se i campi is_closed non esistono ancora, usa current_status
          console.warn('Campi is_closed non disponibili, uso current_status come fallback')
          const { data: injuries } = await supabase
            .from('injuries')
            .select('id, current_status')
            .eq('person_id', editId)
          
          const hasOpenInjuries = injuries && injuries.some(injury => injury.current_status === 'In corso')
          setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
          await saveInjuredStatus(editId, hasOpenInjuries)
        }
      }
      
      closeDeleteModal()
    } catch (error) {
      console.error('❌ Errore nell\'eliminazione:', error)
      alert('Errore nell\'eliminazione: ' + (error as any)?.message || 'Errore sconosciuto')
    } finally {
      setDeleting(false)
    }
  }

  // Carica il personale medico dal database
  const loadMedicalStaff = async () => {
    try {
      console.log('🔍 Caricamento staff medico...')
      
      // Prima carica i ruoli per ottenere gli ID di "Medico" e "Fisio"
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, name')
        .in('name', ['Medico', 'Fisio'])

      if (rolesError) throw rolesError
      
      console.log('🔍 Ruoli medici trovati:', rolesData)

      const medicalRoleIds = rolesData?.map(role => role.id) || []
      console.log('🔍 ID ruoli medici:', medicalRoleIds)

      if (medicalRoleIds.length === 0) {
        console.log('⚠️ Nessun ruolo medico trovato')
        setMedicalStaff([])
        return
      }

      // Poi carica le persone che hanno questi ruoli staff
      const { data, error } = await supabase
        .from('people')
        .select('id, full_name, staff_roles')
        .not('staff_roles', 'is', null)
        .not('full_name', 'is', null)
        .order('full_name')

      if (error) throw error
      
      console.log('🔍 Tutte le persone caricate:', data)

      // Filtra solo le persone che hanno ruoli "Medico" o "Fisio"
      const filteredStaff = (data || []).filter(person => {
        if (!person.staff_roles || !Array.isArray(person.staff_roles)) return false
        return person.staff_roles.some(roleId => medicalRoleIds.includes(roleId))
      }).map(person => {
        // Trova i ruoli medici della persona dal database
        const personRoleIds = person.staff_roles || []
        const personMedicalRoles = personRoleIds
          .map(roleId => rolesData?.find(role => role.id === roleId))
          .filter(role => role && ['Medico', 'Fisio'].includes(role.name))
        
        // Determina il ruolo da mostrare (priorità: Medico > Fisio)
        let specificRole = 'Medico' // Default
        if (personMedicalRoles.length > 0) {
          const hasMedico = personMedicalRoles.some(role => role.name === 'Medico')
          const hasFisio = personMedicalRoles.some(role => role.name === 'Fisio')
          
          if (hasMedico && hasFisio) {
            specificRole = 'Medico' // Se ha entrambi, mostra Medico
          } else if (hasFisio) {
            specificRole = 'Fisio'
          } else if (hasMedico) {
            specificRole = 'Medico'
          }
        }
        
        return {
          id: person.id,
          full_name: person.full_name,
          role: specificRole
        }
      })

      console.log('🔍 Staff medico filtrato:', filteredStaff)
      setMedicalStaff(filteredStaff)
      console.log('✅ Staff medico caricato:', filteredStaff)
    } catch (error) {
      console.error('Errore nel caricamento del personale medico:', error)
    }
  }

  // Filtra il personale in base al tipo di attività
  const getFilteredMedicalStaff = () => {
    if (activityForm.activity_type === 'physiotherapy') {
      // Per fisioterapia, mostra solo i fisio
      return medicalStaff.filter(staff => staff.role === 'Fisio')
    } else if (activityForm.activity_type === 'medical_visit') {
      // Per visite mediche, mostra solo i medici
      return medicalStaff.filter(staff => staff.role === 'Medico')
    } else {
      // Per altri tipi, mostra tutti
      return medicalStaff
    }
  }

  // Carica i ruoli staff dal database
  const loadStaffRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, name, position_order')
        .not('name', 'in', '(Player,Famiglia)') // Sintassi corretta per escludere Player e Famiglia
        .order('position_order')

      if (error) {
        console.error('❌ Errore Supabase nel caricamento ruoli staff:', error)
        throw error
      }

      setStaffRoles(data || [])
    } catch (error) {
      console.error('❌ Errore nel caricamento dei ruoli staff:', error)
    }
  }

  // Carica i ruoli staff esistenti per questa persona
  const loadExistingStaffRoles = async () => {
    if (!editId) return

    try {
      // I ruoli staff sono ora caricati direttamente dal form tramite usePersonForm
      // Non serve più caricare separatamente
      console.log('✅ Ruoli staff caricati dal form:', form.staff_roles)
    } catch (error) {
      console.error('❌ Errore nel caricamento ruoli staff esistenti:', error)
    }
  }

  // Determina se i ruoli staff selezionati richiedono categorie
  const hasStaffRolesRequiringCategories = () => {
    const rolesRequiringCategories = ['Allenatore', 'Team Manager', 'Accompagnatore', 'Preparatore', 'Direttore Tecnico', 'Direttore Sportivo']
    
    return form.staff_roles.some(roleId => {
      const role = staffRoles.find(r => r.id === roleId)
      return role && rolesRequiringCategories.includes(role.name)
    })
  }

  // Funzioni per gestire il form delle attività
  const openActivityForm = (injuryId: string) => {
    console.log('🔧 openActivityForm chiamato con injuryId:', injuryId)
    setSelectedInjuryId(injuryId)
    setShowActivityForm(true)
    // Carica il personale medico quando si apre il form
    loadMedicalStaff()
  }

  const closeActivityForm = () => {
    setShowActivityForm(false)
    setSelectedInjuryId(null)
    setCustomOperator('')
    setEditingActivity(null)
    setIsEditingActivity(false)
    setActivityForm({
      activity_type: 'medical_visit',
      activity_date: new Date().toISOString().split('T')[0],
      operator_name: '',
      duration_minutes: '',
      description: '',
      notes: '',
      amount: '',
      currency: 'EUR',
      test_type: '',
      can_play_field: false,
      can_play_gym: false,
      expected_stop_days: '',
      ricontrollo: '',
      massaggio: false,
      tecar: false,
      laser: false
    })
  }

  const saveActivity = async () => {
    if (!selectedInjuryId) return

    try {
      // Per i test, combina il tipo di esame con la descrizione
      let finalDescription = activityForm.description || ''
      if (activityForm.activity_type === 'test' && activityForm.test_type) {
        finalDescription = `${activityForm.test_type}${finalDescription ? ` - ${finalDescription}` : ''}`
      }
      
      // Per la fisioterapia, crea la descrizione dalle checkbox
      if (activityForm.activity_type === 'physiotherapy') {
        const treatments = []
        if (activityForm.massaggio) treatments.push('Massaggio')
        if (activityForm.tecar) treatments.push('Tecar')
        if (activityForm.laser) treatments.push('Laser')
        finalDescription = treatments.length > 0 ? treatments.join(', ') : ''
      }
      
      // Per le visite mediche, usa direttamente la descrizione selezionata
      if (activityForm.activity_type === 'medical_visit') {
        finalDescription = activityForm.description || ''
      }
      
      // Per i rimborsi assicurativi, genera una descrizione automatica
      if (activityForm.activity_type === 'insurance_refund') {
        finalDescription = `Rimborso assicurativo di ${activityForm.amount || '0'} ${activityForm.currency || 'EUR'}`
      }
      
      // Per acquisti attrezzatura, genera una descrizione automatica
      if (activityForm.activity_type === 'equipment_purchase') {
        finalDescription = `Acquisto attrezzatura per ${activityForm.amount || '0'} ${activityForm.currency || 'EUR'}`
      }
      
      // Per spese sostenute, genera una descrizione automatica
      if (activityForm.activity_type === 'expenses') {
        finalDescription = `Spese sostenute per ${activityForm.amount || '0'} ${activityForm.currency || 'EUR'}`
      }

      const activityData = {
        injury_id: selectedInjuryId,
        activity_type: activityForm.activity_type,
        activity_date: activityForm.activity_date,
        operator_name: activityForm.operator_name || null,
        duration_minutes: activityForm.duration_minutes ? parseInt(activityForm.duration_minutes) : null,
        activity_description: finalDescription || null,
        notes: activityForm.notes || null,
        can_play_field: activityForm.can_play_field,
        can_play_gym: activityForm.can_play_gym,
        expected_stop_days: activityForm.expected_stop_days ? parseInt(activityForm.expected_stop_days) : null,
        ricontrollo: activityForm.ricontrollo || null,
        massaggio: activityForm.massaggio,
        tecar: activityForm.tecar,
        laser: activityForm.laser,
        test_type: activityForm.test_type || null,
        amount: activityForm.amount ? parseFloat(activityForm.amount) : null,
        currency: activityForm.currency || 'EUR'
      }

      // Controlla se è una visita medica o fisioterapia senza data di ricontrollo
      // Esclude "VISITA DI CHIUSURA" perché chiude l'infortunio
      const needsRicontrollo = (activityForm.activity_type === 'medical_visit' || activityForm.activity_type === 'physiotherapy') && 
                              !activityForm.ricontrollo && 
                              activityForm.description !== 'VISITA DI CHIUSURA' &&
                              !isEditingActivity // Solo per nuove attività

      if (needsRicontrollo) {
        // Mostra popup di conferma per ricontrollo
        setPendingActivityData(activityData)
        setShowRicontrolloModal(true)
        return
      }

      // Salva direttamente se non serve popup
      await performSaveActivity(activityData)
    } catch (error) {
      console.error('❌ Errore nel salvataggio dell\'attività:', error)
      alert('Errore nel salvataggio dell\'attività: ' + (error as any)?.message || 'Errore sconosciuto')
    }
  }

  const performSaveActivity = async (activityData: any) => {
    try {
      let error
      if (isEditingActivity && editingActivity) {
        // Modifica attività esistente
        const { error: updateError } = await supabase
          .from('injury_activities')
          .update(activityData)
          .eq('id', editingActivity.id)
        error = updateError
        console.log('✅ Attività modificata con successo')
      } else {
        // Crea nuova attività
        const { error: insertError } = await supabase
          .from('injury_activities')
          .insert(activityData)
        error = insertError
        console.log('✅ Attività salvata con successo')
      }

      if (error) throw error

      // Se è una VISITA DI CHIUSURA, chiudi l'infortunio e aggiorna lo stato del giocatore
      if (activityData.activity_description === 'VISITA DI CHIUSURA' && selectedInjuryId) {
        try {
          // Chiudi l'infortunio
          const { error: injuryError } = await supabase
            .from('injuries')
            .update({ 
              is_closed: true,
              injury_closed_date: new Date().toISOString().split('T')[0],
              current_status: 'Guarito'
            })
            .eq('id', selectedInjuryId)

          if (injuryError) throw injuryError

          // Aggiorna lo stato del giocatore (injured = false)
          if (editId) {
            const { error: personError } = await supabase
              .from('people')
              .update({ injured: false })
              .eq('id', editId)

            if (personError) throw personError
            
            // Aggiorna immediatamente lo stato locale del form
            setForm(prev => ({ ...prev, injured: false }))
          }

          console.log('✅ Infortunio chiuso e giocatore aggiornato')
        } catch (error) {
          console.error('❌ Errore nella chiusura infortunio:', error)
          // Non bloccare il salvataggio dell'attività se fallisce la chiusura
        }
      }

      // Ricarica le attività per aggiornare la lista
      setInjuryRefreshTrigger(prev => prev + 1)

      if (isEditingActivity) {
        closeEditActivityForm()
      } else {
        closeActivityForm()
      }
    } catch (error) {
      console.error('❌ Errore nel salvataggio dell\'attività:', error)
      alert('Errore nel salvataggio dell\'attività: ' + (error as any)?.message || 'Errore sconosciuto')
    }
  }

  // Funzioni per gestire il popup di ricontrollo
  const handleRicontrolloNo = async () => {
    setShowRicontrolloModal(false)
    await performSaveActivity(pendingActivityData)
    setPendingActivityData(null)
  }

  const handleRicontrolloYes = () => {
    // Calcola data di default (7 giorni da oggi)
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 7)
    const dateString = defaultDate.toISOString().split('T')[0]
    
    setSelectedRicontrolloDate(dateString)
    setShowDatePicker(true)
  }

  const handleRicontrolloWithDate = async (date: string) => {
    setShowRicontrolloModal(false)
    setShowDatePicker(false)
    const updatedData = { ...pendingActivityData, ricontrollo: date }
    await performSaveActivity(updatedData)
    setPendingActivityData(null)
  }

  const handleConfirmDate = async () => {
    await handleRicontrolloWithDate(selectedRicontrolloDate)
  }

  const handleCancelDate = () => {
    setShowDatePicker(false)
    setShowRicontrolloModal(true)
  }

  // Funzione per calcolare l'età e controllare se è minorenne
  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 0
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const checkIfMinor = (birthDate: string) => {
    const age = calculateAge(birthDate)
    return age < 18
  }

  // Funzione per salvare automaticamente lo stato di infortunio
  const saveInjuredStatus = async (personId: string, injured: boolean) => {
    try {
      
      const { error } = await supabase
        .from('people')
        .update({ injured })
        .eq('id', personId)

      if (error) {
        console.error('❌ Errore Supabase:', error)
        throw error
      }
      
      console.log('✅ Stato infortunio salvato:', injured ? 'Infortunato' : 'In buone condizioni')
    } catch (error) {
      console.error('❌ Errore nel salvataggio stato infortunio:', error)
    }
  }


  // Wrapper per handleInputChange che gestisce il cambio di tab
  const handleInputChange = (field: string, value: any) => {
    originalHandleInputChange(field, value)
    
    // Se deseleziona "È un giocatore" e siamo nel tab Giocatore o Infortuni, torna al tab Personal
    if (field === 'is_player' && !value && (activeTab === 'player' || activeTab === 'injuries')) {
      setActiveTab('personal')
    }
    
    // Se deseleziona "È staff" e siamo nel tab Staff, torna al tab Personal
    if (field === 'is_staff' && !value && activeTab === 'staff') {
      setActiveTab('personal')
    }
    
    // Se cambia la data di nascita, controlla se è minorenne
    if (field === 'date_of_birth') {
      const minor = checkIfMinor(value)
      setIsMinor(minor)
    }

    // Se cambia lo stato di infortunio, salva automaticamente
    if (field === 'injured' && editId) {
      saveInjuredStatus(editId, value)
    }
  }

  const [activeTab, setActiveTab] = useState('personal')
  const [notes, setNotes] = useState<any[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  
  // Stati per il tab Note
  const [newNote, setNewNote] = useState({ content: '', type: 'note' })
  const [showAddNoteForm, setShowAddNoteForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Stati per il sistema Tutor
  const [isMinor, setIsMinor] = useState(false)
  const [showTutorWarning, setShowTutorWarning] = useState(false)
  const [hasTutors, setHasTutors] = useState(false)
  const [tutorsCheckComplete, setTutorsCheckComplete] = useState(false)
  
  // Stato del form infortuni nel parent per sopravvivere ai remount
  const [showInjuryForm, setShowInjuryForm] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<any>(null)

  // Carica le note quando si è in modalità modifica
  useEffect(() => {
    if (isEditing && editId) {
      loadNotes()
    }
  }, [isEditing, editId])

  // Carica sempre i ruoli staff all'avvio
  useEffect(() => {
    loadStaffRoles()
  }, [])

  // Carica i ruoli staff esistenti quando si carica una persona
  useEffect(() => {
    if (editId && !loading) {
      loadExistingStaffRoles()
    }
  }, [editId, loading])

  // Controlla se è minorenne al caricamento e quando cambia la data di nascita
  useEffect(() => {
    if (form.date_of_birth) {
      const minor = checkIfMinor(form.date_of_birth)
      setIsMinor(minor)
    }
  }, [form.date_of_birth])

  // Controlla se ha tutor quando si carica la pagina
  useEffect(() => {
    if (editId && !loading) {
      checkTutors()
    }
  }, [editId, loading])

  // Disabilitato popup automatico - mostrato solo quando si naviga tra tab
  // useEffect(() => {
  //   if (isMinor && editId && !loading && tutorsCheckComplete) {
  //     if (hasTutors === false) {
  //       console.log('🚨 Mostrando popup tutor - atleta minorenne senza tutor')
  //       setShowTutorWarning(true)
  //     } else if (hasTutors === true) {
  //       console.log('✅ Atleta minorenne con tutor - popup non mostrato')
  //       setShowTutorWarning(false)
  //     }
  //   }
  // }, [isMinor, editId, loading, tutorsCheckComplete, hasTutors])

  // Funzione per controllare se ha tutor
  const checkTutors = async () => {
    try {
      const { data, error } = await supabase
        .from('tutor_athlete_relations')
        .select('id')
        .eq('athlete_id', editId)
        .limit(1)

      if (error) throw error
      const hasTutorsResult = data && data.length > 0
      setHasTutors(hasTutorsResult)
      setTutorsCheckComplete(true) // Marca il controllo come completato
      return hasTutorsResult
    } catch (error) {
      console.error('Errore nel controllo tutor:', error)
      setHasTutors(false)
      setTutorsCheckComplete(true) // Marca il controllo come completato anche in caso di errore
      return false
    }
  }


  const handleGoToTutor = () => {
    setShowTutorWarning(false)
    setActiveTab('tutor')
  }

  const handleTutorAdded = () => {
    setHasTutors(true)
    checkTutors() // Ricarica per aggiornare lo stato
  }

  const loadNotes = async () => {
    if (!isEditing || !editId) return
    
    try {
      setLoadingNotes(true)
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('person_id', editId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Errore nel caricamento delle note:', error)
      return
    }

      const notesData = data.map(note => ({
        id: note.id,
        date: note.created_at,
        type: note.type,
        content: note.content,
        created_by: note.created_by
      }))

      setNotes(notesData)
    } catch (error) {
      console.error('Errore nel caricamento delle note:', error)
    } finally {
      setLoadingNotes(false)
    }
  }

  // Funzione per aggiungere una nota
  const handleAddNote = async () => {
    if (!newNote.content.trim() || !editId) return

    try {
      setLoadingNotes(true)
      const { error } = await supabase
        .from('notes')
          .insert({
          person_id: editId,
          content: newNote.content.trim(),
          type: newNote.type,
          created_by: 'Sistema' // TODO: Sostituire con l'utente corrente
        })

      if (error) {
        console.error('Errore nel salvataggio della nota:', error)
      return
    }

      // Ricarica le note
      await loadNotes()
      
      // Reset del form
      setNewNote({ content: '', type: 'note' })
      setShowAddNoteForm(false)
    } catch (error) {
      console.error('Errore nel salvataggio della nota:', error)
    } finally {
      setLoadingNotes(false)
    }
  }

  // Funzione per eliminare una nota
  const handleDeleteNote = (note: any) => {
    setNoteToDelete(note)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteToDelete.id)

      if (error) {
        console.error('Errore nell\'eliminazione della nota:', error)
      return
    }

      // Ricarica le note
      await loadNotes()
    } catch (error) {
      console.error('Errore nell\'eliminazione della nota:', error)
    } finally {
      setShowDeleteConfirm(false)
      setNoteToDelete(null)
    }
  }

  const cancelDeleteNote = () => {
    setShowDeleteConfirm(false)
    setNoteToDelete(null)
  }

  // Funzione per ottenere il nome del tipo di nota
  const getNoteTypeName = (type: string) => {
    switch (type) {
      case 'medical': return 'Medica'
      case 'injury': return 'Infortunio'
      case 'training': return 'Allenamento'
      case 'secretary': return 'Segreteria'
      default: return 'Generale'
    }
  }

  // Funzione per filtrare e ordinare le note
  const getFilteredAndSortedNotes = () => {
    let filtered = notes

    // Filtro per testo
    if (searchQuery.trim()) {
      filtered = filtered.filter(note =>
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.created_by.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filtro per tipo
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(note => selectedTypes.includes(note.type))
    }

    // Filtro per data
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      filtered = filtered.filter(note => {
        const noteDate = new Date(note.date)
        const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate())
        
        switch (dateFilter) {
          case 'today':
            return noteDateOnly.getTime() === today.getTime()
          case 'week':
            const weekAgo = new Date(today)
            weekAgo.setDate(weekAgo.getDate() - 7)
            return noteDateOnly >= weekAgo
          case 'month':
            const monthAgo = new Date(today)
            monthAgo.setMonth(monthAgo.getMonth() - 1)
            return noteDateOnly >= monthAgo
          default:
            return true
        }
      })
    }

    // Ordinamento
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
          break
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
        case 'author':
          comparison = a.created_by.localeCompare(b.created_by)
          break
        default:
          comparison = 0
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }

  const tabs = [
    { id: 'personal', name: 'Informazioni Personali', icon: '👤' },
    // visibile solo se is_player = true
    { id: 'player', name: 'Giocatore', icon: '⚽', hidden: !form.is_player },
    // Tutor solo se minorenne (dopo Giocatore)
    ...(isMinor ? [{ id: 'tutor', name: 'Tutor', icon: '👨‍👩‍👧‍👦' }] : []),
    // Staff visibile solo se is_staff = true
    { id: 'staff', name: 'Staff', icon: '👥', hidden: !form.is_staff },
    { id: 'documents', name: 'Documenti', icon: '📄' },
    { id: 'notes', name: 'Note', icon: '📝' },
    // Infortuni: visibile solo se è un giocatore
    ...(form.is_player ? [{
      id: 'injuries',
      name: 'Infortuni',
      icon: '🏥',
      badge: form.injured ? 'INFORTUNATO' : null
    }] : [])
  ]

  // Se l'utente è su una tab che diventa "hidden", riportalo su personal
  useEffect(() => {
    const current = tabs.find(t => t.id === activeTab)
    if (current?.hidden) setActiveTab('personal')
    
    // Se non è più un giocatore e siamo nel tab infortuni, torna al tab personal
    if (!form.is_player && activeTab === 'injuries') {
      setActiveTab('personal')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.is_player])

  // Funzione per gestire i filtri delle note
  const handleTypeFilterChange = (type: string, checked: boolean) => {
    if (checked) {
      setSelectedTypes(prev => [...prev, type])
    } else {
      setSelectedTypes(prev => prev.filter(t => t !== type))
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedTypes([])
    setDateFilter('all')
    setSortBy('date')
    setSortOrder('desc')
  }

  // Funzione per ottenere l'icona del tipo di nota
  const getNoteIcon = (type: string) => {
    switch (type) {
      case 'medical':
  return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        )
      case 'injury':
        return (
          <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'training':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
          </svg>
        )
      case 'secretary':
        return (
          <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  // Funzione per ottenere il colore del tipo di nota
  const getNoteColor = (type: string) => {
    switch (type) {
      case 'medical': return 'border-l-red-500 bg-red-50'
      case 'injury': return 'border-l-orange-500 bg-orange-50'
      case 'training': return 'border-l-green-500 bg-green-50'
      case 'secretary': return 'border-l-purple-500 bg-purple-50'
      default: return 'border-l-blue-500 bg-blue-50'
    }
  }


  // Funzione per renderizzare il tab Staff
  const renderStaffTab = () => {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Ruoli Staff</h2>
        </div>

        {/* Ruoli Staff */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffRoles.map((role) => (
              <div key={role.id} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                  type="checkbox"
                  id={`staff-role-${role.id}`}
                  checked={form.staff_roles.includes(role.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleInputChange('staff_roles', [...form.staff_roles, role.id])
                    } else {
                      handleInputChange('staff_roles', form.staff_roles.filter(id => id !== role.id))
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label 
                  htmlFor={`staff-role-${role.id}`}
                  className="flex-1 text-sm font-medium text-gray-700 cursor-pointer"
                >
                  {role.name}
                </label>
              </div>
            ))}
          </div>
                  </div>
                  
        {/* Messaggio se nessun ruolo selezionato */}
        {form.staff_roles.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p>Seleziona i ruoli staff per questa persona</p>
          </div>
        )}

        {/* Ruoli selezionati */}
        {form.staff_roles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Ruoli selezionati:</h3>
            <div className="flex flex-wrap gap-2">
              {form.staff_roles.map(roleId => {
                const role = staffRoles.find(r => r.id === roleId)
                return role ? (
                  <div key={roleId} className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {role.name}
                  </div>
                ) : null
              })}
            </div>
          </div>
        )}

        {/* Categorie Staff - Mostra solo se ci sono ruoli staff che richiedono categorie */}
        {form.staff_roles.length > 0 && hasStaffRolesRequiringCategories() && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Categorie Staff</h3>
            <p className="text-sm text-gray-600 mb-4">
              Seleziona le categorie per i ruoli staff selezionati
            </p>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((category) => (
                <label key={category.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={form.staff_categories.includes(category.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleInputChange('staff_categories', [...form.staff_categories, category.id])
                      } else {
                        handleInputChange('staff_categories', form.staff_categories.filter(id => id !== category.id))
                      }
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{category.code}</span>
                </label>
              ))}
            </div>
            
            {/* Categorie staff selezionate */}
            {form.staff_categories.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Categorie selezionate:</h4>
                <div className="flex flex-wrap gap-2">
                  {form.staff_categories.map(categoryId => {
                    const category = categories.find(c => c.id === categoryId)
                    return category ? (
                      <div key={categoryId} className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {category.code}
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Funzione per renderizzare il tab Note
  const renderNotesTab = () => {
  return (
      <div className="space-y-6">
        {/* Header con indicatore scroll */}
        <div className="flex items-center justify-end">
          {getFilteredAndSortedNotes().length > 3 && (
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              📜 Scroll per vedere tutte
            </span>
          )}
                  </div>
                  
        {/* Filtri e ricerca */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Campo di ricerca */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                🔍 Cerca
                    </label>
                    <input
                      type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca nelle note..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  
            {/* Filtro per tipo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                🏷️ Tipo
                    </label>
              <div className="grid grid-cols-2 gap-1">
                {['note', 'medical', 'injury', 'training', 'secretary'].map(type => (
                  <label key={type} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={(e) => handleTypeFilterChange(type, e.target.checked)}
                      className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">{getNoteTypeName(type)}</span>
                  </label>
                ))}
              </div>
                  </div>
                  
            {/* Filtro per data */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                📅 Data
                    </label>
                    <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">Tutte le date</option>
                <option value="today">Oggi</option>
                <option value="week">Ultima settimana</option>
                <option value="month">Ultimo mese</option>
                    </select>
                  </div>
                  
            {/* Ordinamento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                🔄 Ordina per
                    </label>
              <div className="space-y-2">
                    <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="date">Data</option>
                  <option value="type">Tipo</option>
                  <option value="author">Autore</option>
                </select>
                    <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="desc">Più recenti</option>
                  <option value="asc">Più vecchi</option>
                    </select>
                  </div>
                </div>
              </div>

          {/* Pulsante per pulire i filtri */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Pulisci filtri
            </button>
          </div>
        </div>

        {/* Form per aggiungere nuova nota */}
        {showAddNoteForm && (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Aggiungi Nota</h3>
            <div className="space-y-4">
                  <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo di nota
                    </label>
                <select
                  value={newNote.type || 'note'}
                  onChange={(e) => setNewNote(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="note">Nota generale</option>
                  <option value="medical">Nota medica</option>
                  <option value="injury">Infortunio</option>
                  <option value="training">Allenamento</option>
                  <option value="secretary">Segreteria</option>
                </select>
                  </div>
                  <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenuto della nota
                    </label>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Inserisci il contenuto della nota..."
                  rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={loadingNotes || !newNote.content.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingNotes ? 'Salvataggio...' : 'Aggiungi Nota'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddNoteForm(false)
                    setNewNote({ content: '', type: 'note' })
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Annulla
                </button>
                </div>
              </div>
          </div>
        )}

        {/* Lista delle note */}
        {loadingNotes ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-500">Caricamento note...</p>
                  </div>
        ) : getFilteredAndSortedNotes().length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-gray-500">
              {notes.length === 0 ? 'Nessuna nota presente' : 'Nessuna nota corrisponde ai filtri selezionati'}
            </p>
            <p className="text-sm text-gray-400">
              {notes.length === 0 ? 'Clicca sul pulsante + per aggiungere la prima nota' : 'Prova a modificare i filtri o la ricerca'}
            </p>
                  </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
            {getFilteredAndSortedNotes().map((note) => (
              <div key={note.id} className={`border-l-4 ${getNoteColor(note.type)} bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getNoteIcon(note.type)}
                  </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                          {getNoteTypeName(note.type)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(note.date).toLocaleDateString('it-IT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                  </div>
                      <p className="text-gray-900 text-sm leading-relaxed">{note.content}</p>
                  </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <span className="text-xs text-gray-500">{note.created_by}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note)}
                      className="text-red-500 hover:text-red-700 p-1 transition-colors"
                      title="Elimina nota"
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
        )}
      </div>
    )
  }


  const renderPlayerTab = () => {
    return (
      <div className={`space-y-6 ${form.injured ? 'bg-red-50 rounded-lg p-4' : ''}`}>
        {/* Header con titolo e badge - Layout migliorato */}
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Giocatore</h2>
          
          {/* Card per categoria e ruoli in modalità sola lettura */}
          {isEditing && !isEditMode && (
            <div className="flex flex-wrap gap-2 ml-2">
              {/* Card Categoria */}
              {form.player_categories.length > 0 && form.player_categories.map(categoryId => {
                const category = categories.find(cat => cat.id === categoryId)
                return category ? (
                  <div key={categoryId} className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {category.name}
                  </div>
                ) : null
              })}
              
              {/* Card Ruoli */}
              {form.player_positions.length > 0 && form.player_positions.map(roleId => {
                const role = playerPositions.find(r => r.id === roleId)
                return role ? (
                  <div key={roleId} className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {role.name}
                  </div>
                ) : null
              })}
            </div>
          )}
                  </div>
                  
        {/* Informazioni di base - Layout migliorato */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Codice FIR - 4 colonne */}
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Codice FIR
              </div>
                    </label>
                    <input
                      type="text"
              value={form.fir_code}
              onChange={(e) => handleInputChange('fir_code', e.target.value)}
              disabled={isFieldDisabled()}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900 transition-colors"
                    />
                  </div>
                  
          {/* Data di Nascita (per FIR) - 3 colonne */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Data di Nascita (per FIR)
              </div>
                    </label>
                    <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
              disabled={isFieldDisabled()}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900 transition-colors"
                    />
                  </div>
                  
                  {/* Stato Infortunio */}
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Stato Infortunio
                    </label>
                    <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={form.injured}
                        onChange={(e) => handleInputChange('injured', e.target.checked)}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">
                        {form.injured ? 'Attualmente infortunato' : 'In buone condizioni'}
                      </span>
                  </div>
                  </div>
                  
                  </div>

        {/* Statistiche Giocatore - Solo in modalità sola lettura */}
        {isEditing && !isEditMode ? (
          <div className="border-t pt-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Statistiche Giocatore
              </h3>
              
              {/* Informazioni aggiuntive */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Squadra: U18</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Ultimo allenamento: 2 giorni fa</span>
                  </div>
                </div>
              </div>

            {/* Grid delle statistiche migliorato */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Partite */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full">+2 questa stagione</span>
                </div>
                <div className="text-3xl font-bold text-blue-700 mb-1">15</div>
                <div className="text-sm font-medium text-blue-600">Partite</div>
              </div>

              {/* Minuti Giocati */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded-full">+150 min</span>
                </div>
                <div className="text-3xl font-bold text-green-700 mb-1">1,250</div>
                <div className="text-sm font-medium text-green-600">Minuti</div>
                  </div>
                  
              {/* Mete */}
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-yellow-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-yellow-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-yellow-600 bg-yellow-200 px-2 py-1 rounded-full">+1 questa settimana</span>
                </div>
                <div className="text-3xl font-bold text-yellow-700 mb-1">8</div>
                <div className="text-sm font-medium text-yellow-600">Mete</div>
              </div>

              {/* Punti */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                      </div>
                  <span className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded-full">+5 punti</span>
                    </div>
                <div className="text-3xl font-bold text-purple-700 mb-1">45</div>
                <div className="text-sm font-medium text-purple-600">Punti</div>
              </div>
              
              {/* Presenze Allenamento */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-indigo-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-indigo-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-200 px-2 py-1 rounded-full">93% presenza</span>
                </div>
                <div className="text-3xl font-bold text-indigo-700 mb-1">42/45</div>
                <div className="text-sm font-medium text-indigo-600">Presenze</div>
                  </div>
                  
              {/* Infortuni */}
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-red-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-red-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-red-600 bg-red-200 px-2 py-1 rounded-full">Stato: Recuperato</span>
                </div>
                <div className="text-3xl font-bold text-red-700 mb-1">2</div>
                <div className="text-sm font-medium text-red-600">Infortuni</div>
                <div className="text-xs text-red-500 mt-1 font-medium">Ultimo: 3 mesi fa</div>
              </div>
            </div>
            
            {/* Stato forma */}
            <div className="mt-6 p-4 rounded-xl border bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${form.injured ? 'bg-red-500' : 'bg-green-500'}`}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {form.injured ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      )}
                    </svg>
                  </div>
                      <div>
                    <h4 className="font-semibold text-gray-900">Stato Forma</h4>
                    <p className={`text-sm ${form.injured ? 'text-red-600' : 'text-gray-600'}`}>
                      {form.injured 
                        ? 'Infortunato - Non disponibile per la competizione' 
                        : 'Ottimo - Pronto per la competizione'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${form.injured ? 'bg-red-500' : 'bg-green-500'} ${form.injured ? 'animate-bounce' : 'animate-pulse'}`}></div>
                  <span className={`text-sm font-medium ${form.injured ? 'text-red-700' : 'text-green-700'}`}>
                    {form.injured ? 'Infortunato' : 'Attivo'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Modalità modifica - mostra le sezioni normali
          <>
            {/* Categorie */}
            <div className="border-t pt-6">
              <h3 className="text-md font-medium text-gray-900 mb-4">Categorie</h3>
              <div className="grid grid-cols-3 gap-2">
                        {categories.map((category) => (
                  <label key={category.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={form.player_categories.includes(category.id)}
                              onChange={(e) => {
                        if (e.target.checked) {
                          handleInputChange('player_categories', [...form.player_categories, category.id])
                        } else {
                          handleInputChange('player_categories', form.player_categories.filter(id => id !== category.id))
                        }
                      }}
                      disabled={isFieldDisabled()}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{category.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  
            {/* Ruoli in Campo */}
            <div className="border-t pt-6">
              <h3 className="text-md font-medium text-gray-900 mb-4">Ruoli in Campo</h3>
              <div className="grid grid-cols-3 gap-2">
                {playerPositions.map((position) => (
                  <label key={position.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={form.player_positions.includes(position.id)}
                              onChange={(e) => {
                        if (e.target.checked) {
                          handleInputChange('player_positions', [...form.player_positions, position.id])
                        } else {
                          handleInputChange('player_positions', form.player_positions.filter(id => id !== position.id))
                        }
                      }}
                      disabled={isFieldDisabled()}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">{position.name}</span>
                    </label>
                        ))}
                      </div>
                  </div>
                  
          </>
                  )}
                </div>
    )
  }

  // Pannelli delle tab - sempre montati per evitare remount
  const TabPanels: Record<string, React.ReactNode> = {
    personal: (
      <PersonalInfoTab
        form={form}
        handleInputChange={handleInputChange}
        isFieldDisabled={isFieldDisabled}
      />
    ),
    player: renderPlayerTab(),
    staff: renderStaffTab(),
    documents: (
      <DocumentsTab
        form={form}
        handleInputChange={handleInputChange}
        isFieldDisabled={isFieldDisabled}
      />
    ),
    notes: renderNotesTab(),
    injuries: (
      <MemoInjuriesTab
        personId={editId || ''}
        canEdit={Boolean(editId && form.is_player)}
        onNoteAdded={loadNotes}
        onAddInjury={() => openInjuryModal(null)}
        onOpenInjuryModal={openInjuryModal}
        onOpenDeleteModal={openDeleteModal}
        onOpenActivityForm={openActivityForm}
        onOpenDeleteActivityModal={openDeleteActivityModal}
        onOpenEditActivityForm={openEditActivityForm}
        refreshTrigger={injuryRefreshTrigger}
        onInjuryCreated={async () => {
          // Controlla se ci sono infortuni aperti per questo giocatore
          if (editId) {
            try {
              const { data: openInjuries } = await supabase
                .from('injuries')
                .select('id')
                .eq('person_id', editId)
                .eq('is_closed', false)
              
              const hasOpenInjuries = openInjuries && openInjuries.length > 0
              
              // Aggiorna lo stato injured basato sulla presenza di infortuni aperti
              setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
              await saveInjuredStatus(editId, hasOpenInjuries)
            } catch (error) {
              // Fallback: se i campi is_closed non esistono ancora, usa current_status
              console.warn('Campi is_closed non disponibili, uso current_status come fallback')
              const { data: injuries } = await supabase
                .from('injuries')
                .select('id, current_status')
                .eq('person_id', editId)
              
              const hasOpenInjuries = injuries && injuries.some(injury => injury.current_status === 'In corso')
              setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
              await saveInjuredStatus(editId, hasOpenInjuries)
            }
          }
        }}
      />
    ),
    tutor: (
      <TutorTab
        athleteId={editId || ''}
        athleteName={form.full_name || 'Atleta'}
        isMinor={isMinor}
        onTutorAdded={handleTutorAdded}
      />
    ),
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Caricamento...</p>
                        </div>
                      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Anagrafica" 
        showBack={true}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
                      <div>
                    </div>
                </div>
              </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.filter(t => !t.hidden).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    // Se l'atleta è minorenne, non ha tutor e si sta cercando di cambiare tab, mostra avviso
                    if (isMinor && !hasTutors && tab.id !== 'tutor' && tab.id !== 'personal') {
                      setShowTutorWarning(true)
                      return
                    }
                    setActiveTab(tab.id)
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                  {tab.badge && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
                        </div>
                  
          {/* Tab Content */}
          <div className="p-6">
            {/* Personal Info Tab */}
            <div className={activeTab === 'personal' ? 'block' : 'hidden'}>
              {TabPanels.personal}
                      </div>
            
            {/* Player Tab */}
            <div className={activeTab === 'player' ? 'block' : 'hidden'}>
              {TabPanels.player}
                    </div>
            
            {/* Tutor Tab */}
            <div className={activeTab === 'tutor' ? 'block' : 'hidden'}>
              {TabPanels.tutor}
                </div>
            
            {/* Staff Tab */}
            <div className={activeTab === 'staff' ? 'block' : 'hidden'}>
              {TabPanels.staff}
                </div>
            
            {/* Documents Tab */}
            <div className={activeTab === 'documents' ? 'block' : 'hidden'}>
              {TabPanels.documents}
              </div>

            {/* Notes Tab */}
            <div className={activeTab === 'notes' ? 'block' : 'hidden'}>
              {TabPanels.notes}
            </div>
            
            {/* Injuries Tab */}
            <div className={activeTab === 'injuries' ? 'block' : 'hidden'}>
              {TabPanels.injuries}
                </div>
              </div>

          {/* Bottom Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {activeTab === 'notes' && (
                <>
                <button
                  type="button"
                    onClick={() => setShowAddNoteForm(true)}
                    className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-blue-700 shadow-lg"
                    title="Aggiungi nota"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
                  
                  {/* Contatore note */}
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {getFilteredAndSortedNotes().length} di {notes.length} {notes.length === 1 ? 'nota' : 'note'}
                  </span>
                </>
              )}
              
              </div>

            <div className="flex items-center space-x-3">
                <button
                  type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                Indietro
                </button>
              
              {/* Nascondi i pulsanti Modifica/Aggiorna quando siamo nel tab infortuni */}
              {activeTab !== 'injuries' && (
                <>
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={handleSave}
                  disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                      {loading ? 'Salvataggio...' : 'Aggiorna'}
                </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Modifica
                    </button>
                  )}
                </>
              )}
            </div>
              </div>
            </form>
          </div>

      {/* Popup di conferma eliminazione nota */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
        </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Elimina Nota</h3>
                <p className="text-sm text-gray-500">Questa azione non può essere annullata</p>
      </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700">
                Sei sicuro di voler eliminare questa nota? L'azione non può essere annullata.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={cancelDeleteNote}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmDeleteNote}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup di avviso per atleti minorenni senza tutor */}
      <MinorTutorWarning
        isOpen={showTutorWarning}
        onClose={() => setShowTutorWarning(false)}
        onGoToTutor={handleGoToTutor}
        athleteName={form.full_name || 'Atleta'}
      />

      {/* Modal per infortuni */}
      <InjuryEditModal
        isOpen={showInjuryModal}
        onClose={closeInjuryModal}
        injury={editingInjury}
        onSave={handleInjurySaved}
        personId={editId || ''}
      />

      {/* Modal di conferma eliminazione infortuni */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteInjury}
        title="Conferma Eliminazione"
        message="Sei sicuro di voler eliminare questo infortunio"
        itemName={injuryToDelete?.injury_type}
        loading={deleting}
      />

      {/* Form per aggiungere attività */}
      {showActivityForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {isEditingActivity ? 'Modifica Attività' : 'Aggiungi Attività'}
              </h3>
              <button
                onClick={closeActivityForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipo di attività */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo di Attività *
                            </label>
                  <select
                    value={activityForm.activity_type}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, activity_type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="medical_visit">🏥 Visita Medica</option>
                    <option value="physiotherapy">💪 Fisioterapia</option>
                    <option value="test">🔬 Test/Esame</option>
                    <option value="note">📝 Annotazione</option>
                    <option value="insurance_refund">💰 Rimborso Assicurativo</option>
                    <option value="equipment_purchase">🛒 Acquisto Attrezzatura</option>
                    <option value="expenses">💸 Spese Sostenute</option>
                    <option value="other">📋 Altro</option>
                  </select>
                        </div>
                  
                {/* Data */}
                      <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data *
                  </label>
                              <input
                    type="date"
                    value={activityForm.activity_date}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, activity_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                      </div>

                {/* Tipo di esame (solo per test) */}
                {activityForm.activity_type === 'test' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo di Esame *
                            </label>
                    <select
                      value={activityForm.test_type}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, test_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Seleziona tipo di esame</option>
                      <option value="Radiografia (RX)">📷 Radiografia (RX)</option>
                      <option value="Risonanza Magnetica (RMN)">🧲 Risonanza Magnetica (RMN)</option>
                      <option value="TAC (Tomografia Computerizzata)">🖥️ TAC (Tomografia Computerizzata)</option>
                      <option value="Ecografia">📡 Ecografia</option>
                      <option value="Scintigrafia">⚛️ Scintigrafia</option>
                      <option value="Artroscopia">🔍 Artroscopia</option>
                      <option value="Biopsia">🔬 Biopsia</option>
                      <option value="Esami del sangue">🩸 Esami del sangue</option>
                      <option value="Test funzionali">🏃 Test funzionali</option>
                      <option value="Valutazione posturale">📐 Valutazione posturale</option>
                      <option value="Test di forza">💪 Test di forza</option>
                      <option value="Test di equilibrio">⚖️ Test di equilibrio</option>
                      <option value="Test di flessibilità">🤸 Test di flessibilità</option>
                      <option value="Test cardiopolmonare">❤️ Test cardiopolmonare</option>
                      <option value="Test di coordinazione">🎯 Test di coordinazione</option>
                      <option value="Valutazione neurologica">🧠 Valutazione neurologica</option>
                      <option value="Test di propriocezione">👁️ Test di propriocezione</option>
                      <option value="Altro esame">📋 Altro esame</option>
                    </select>
                        </div>
                )}

                {/* Operatore/Medico (solo per visite mediche) */}
                {activityForm.activity_type === 'medical_visit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Operatore/Medico *
                    </label>
                    <select
                      value={activityForm.operator_name}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, operator_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Seleziona operatore</option>
                      {medicalStaff.map(staff => (
                        <option key={staff.id} value={staff.full_name}>
                          {staff.full_name} ({staff.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Descrizione per Visita Medica */}
                {activityForm.activity_type === 'medical_visit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrizione *
                    </label>
                    <select
                      value={activityForm.description}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Seleziona tipo di visita</option>
                      <option value="PRIMA VISITA">🆕 PRIMA VISITA</option>
                      <option value="VISITA DI CONTROLLO">🔄 VISITA DI CONTROLLO</option>
                      <option value="VISITA DI CHIUSURA">✅ VISITA DI CHIUSURA</option>
                    </select>
                  </div>
                )}

                {/* Autorizzazioni e Previsioni (solo per visite mediche) */}
                {activityForm.activity_type === 'medical_visit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Autorizzazioni e Previsioni
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={activityForm.can_play_field}
                            onChange={(e) => setActivityForm(prev => ({ ...prev, can_play_field: e.target.checked }))}
                            className="mr-2"
                          />
                          <span>⚽ Campo</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={activityForm.can_play_gym}
                            onChange={(e) => setActivityForm(prev => ({ ...prev, can_play_gym: e.target.checked }))}
                            className="mr-2"
                          />
                          <span>🏋️ Palestra</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Previsione Stop (Giorni)
                        </label>
                        <input
                          type="number"
                          value={activityForm.expected_stop_days}
                          onChange={(e) => setActivityForm(prev => ({ ...prev, expected_stop_days: e.target.value }))}
                          placeholder="0"
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Checkbox per Fisioterapia */}
                {activityForm.activity_type === 'physiotherapy' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trattamenti *
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={activityForm.massaggio}
                          onChange={(e) => setActivityForm(prev => ({ ...prev, massaggio: e.target.checked }))}
                          className="mr-2"
                        />
                        <span>💆‍♂️ Massaggio</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={activityForm.tecar}
                          onChange={(e) => setActivityForm(prev => ({ ...prev, tecar: e.target.checked }))}
                          className="mr-2"
                        />
                        <span>⚡ Tecar</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={activityForm.laser}
                          onChange={(e) => setActivityForm(prev => ({ ...prev, laser: e.target.checked }))}
                          className="mr-2"
                        />
                        <span>🔴 Laser</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Costo (solo per tipi con costi/entrate) */}
                {(activityForm.activity_type === 'test' ||
                  activityForm.activity_type === 'insurance_refund' || 
                  activityForm.activity_type === 'equipment_purchase' || 
                  activityForm.activity_type === 'expenses') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {activityForm.activity_type === 'insurance_refund' ? 'Importo Rimborso' : 'Costo'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={activityForm.amount}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <select
                        value={activityForm.currency}
                        onChange={(e) => setActivityForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Durata (solo per fisioterapia) */}
                {activityForm.activity_type === 'physiotherapy' && (
                      <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Durata (minuti)
                    </label>
                              <input
                      type="number"
                      value={activityForm.duration_minutes}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, duration_minutes: e.target.value }))}
                      placeholder="30"
                      step="15"
                      min="15"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                </div>



              {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note Aggiuntive
                  </label>
                  <textarea
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Note dettagliate sull'attività..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
              </div>

              {/* Pulsanti e campo ricontrollo */}
              <div className="flex justify-between items-center pt-4">
                {/* Campo Ricontrollo - nascosto per VISITA DI CHIUSURA */}
                {activityForm.description !== 'VISITA DI CHIUSURA' && (
                  <div className="flex items-center space-x-3">
                    <label className="text-sm font-medium text-gray-700">
                      Ricontrollo:
                    </label>
                    <input
                      type="date"
                      value={activityForm.ricontrollo}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, ricontrollo: e.target.value }))}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Pulsanti */}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={closeActivityForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={saveActivity}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {isEditingActivity ? 'Salva Modifiche' : 'Salva Attività'}
                  </button>
                </div>
              </div>
          </div>
        </div>
      </div>
      )}

      {/* Modal di conferma eliminazione attività */}
      <DeleteConfirmModal
        isOpen={showDeleteActivityModal}
        onClose={closeDeleteActivityModal}
        onConfirm={confirmDeleteActivity}
        title="Conferma Eliminazione"
        message="Sei sicuro di voler eliminare questa attività"
        itemName={activityToDelete?.type ? getActivityTypeName(activityToDelete.type) : undefined}
        loading={deletingActivity}
      />

      {/* Popup di conferma ricontrollo */}
      {showRicontrolloModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Fissare Ricontrollo?
              </h3>
              <button
                onClick={() => setShowRicontrolloModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">
                Vuoi fissare una visita di controllo o un ulteriore trattamento per questa attività?
              </p>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleRicontrolloNo}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  No, salva senza ricontrollo
                </button>
                <button
                  type="button"
                  onClick={handleRicontrolloYes}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Sì, fissa ricontrollo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup selezione data ricontrollo */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Seleziona Data Ricontrollo
              </h3>
              <button
                onClick={handleCancelDate}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data del ricontrollo:
                </label>
                <input
                  type="date"
                  value={selectedRicontrolloDate}
                  onChange={(e) => setSelectedRicontrolloDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleCancelDate}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDate}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Conferma e Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreatePersonView
