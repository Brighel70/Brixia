import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Header from '@/components/Header'
import PersonalInfoTab from '@/components/PersonalInfoTab'
import FlowmeTab from '@/components/FlowmeTab'
import { TUTOR_RELATIONSHIP_OPTIONS } from '@/components/FlowmeTab'
import DocumentsTab from '@/components/DocumentsTab'
// import PlayerTab from '@/components/PlayerTab'
import NotesTab from '@/components/NotesTab'
import InjuriesTab from '@/components/InjuriesTab'
import InjuryEditModal from '@/components/InjuryEditModal'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import TutorTab from '@/components/TutorTab'
import GuardiansTab from '@/components/GuardiansTab'
import PlayerSelectionModal from '@/components/PlayerSelectionModal'
import RelationshipAssignmentModal from '@/components/RelationshipAssignmentModal'
import MinorTutorWarning from '@/components/MinorTutorWarning'
import FeesTab from '@/components/CreatePerson/FeesTab'
import CorrespondenceTab from '@/components/CorrespondenceTab'
import { usePersonForm } from '@/hooks/usePersonForm'
import GoleeAlertModal from '@/components/GoleeAlertModal'
import DuplicateEmailModal, { type DuplicateEmailPerson } from '@/components/DuplicateEmailModal'
import { checkAllExpiredDisqualifications } from '@/utils/disqualificationChecker'
import { checkOverlap, formatOverlapHardError, type OverlapActivity } from '@teamflow/shared'
import { getUserIdByOperatorName, sendActivityUpdatedNotificationToUser, formatDateIt, type ActivityUpdatedPayload } from '@/lib/operatorNotifications'
import { toDateOnly } from '@/lib/dateUtils'
import { getBrandConfig } from '@/config/brand'
import { useSetPageTitle } from '@/context/PageTitleContext'
import { useCreatePersonNav } from '@/context/CreatePersonNavContext'
import { getPeopleNavIds } from '@/lib/peopleNavStorage'
import { getPositionDisplayName } from '@/utils/personUtils'
import { FileText } from 'lucide-react'
import { generateAnagraficaPdf, loadCompletePdfData, generateCompletePdf, loadPlayerStatsForView, type PlayerStatsView } from '@/lib/personPdfGenerator'

// Memo sul componente evita render inutili senza causare remount
const MemoInjuriesTab = React.memo(InjuriesTab)

/** Normalizza id/slug/nome ruolo per confronti (allenatore ↔ Allenatore ↔ team-manager). */
function normStaffRoleKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function staffRoleRefMatches(
  stored: string,
  role: { id: string; name: string },
): boolean {
  const s = String(stored || '')
  if (!s) return false
  if (s === role.id) return true
  const ns = normStaffRoleKey(s)
  const nn = normStaffRoleKey(role.name)
  return ns === nn || ns === normStaffRoleKey(role.id)
}

function findStaffRoleByRef(
  stored: string,
  roles: Array<{ id: string; name: string }>,
): { id: string; name: string } | undefined {
  return roles.find((r) => staffRoleRefMatches(stored, r))
}

function isStaffRoleSelected(
  selected: string[] | null | undefined,
  role: { id: string; name: string },
): boolean {
  return (selected || []).some((ref) => staffRoleRefMatches(ref, role))
}

/** Aggiunge/rimuove un ruolo scrivendo sempre l'UUID canonico e togliendo slug/duplicati. */
function toggleStaffRoleSelection(
  selected: string[],
  role: { id: string; name: string },
  checked: boolean,
): string[] {
  const without = selected.filter((ref) => !staffRoleRefMatches(ref, role))
  if (!checked) return without
  return [...without, role.id]
}

interface CreatePersonViewProps {
  embedInLayout?: boolean
}

const CreatePersonView: React.FC<CreatePersonViewProps> = ({ embedInLayout = false }) => {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  
  // Ã°Å¸â€Â§ FIX: Leggi direttamente da window.location per evitare problemi di cache di React Router
  const urlParams = new URLSearchParams(window.location.search)
  const editId = urlParams.get('edit')
  const isTutorFromUrl = urlParams.get('tutor') === 'true'
  const isStaff = urlParams.get('staff') === 'true'
  const athleteId = urlParams.get('athleteId')
  const tabParam = urlParams.get('tab')
  const threadParam = urlParams.get('thread')
  const fromAthlete = urlParams.get('fromAthlete')  // Ritorno alla scheda giocatore dopo modifica tutor
  const returnTab = urlParams.get('returnTab') || 'tutor'
  const isEditing = !!editId
  
  // Stato per isTutor che puÃƒÂ² essere aggiornato quando form viene caricato
  const [isTutor, setIsTutor] = useState(isTutorFromUrl)

  // Log ridotto per evitare spam in console
  const navigate = useNavigate()
  
  // Stato locale per l'editId che si aggiorna quando cambia l'URL
  const [currentEditId, setCurrentEditId] = useState(editId)
  
  // Sincronizza currentEditId con editId quando cambia l'URL
  useEffect(() => {
    setCurrentEditId(editId)
  }, [editId])

  // Sincronizza activeTab con il parametro tab dell'URL
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const setPageTitle = useSetPageTitle()
  const { setCreatePersonNav } = useCreatePersonNav()

  const {
    form,
    setForm,
    isEditMode,
    loading,
    saveValidationError,
    categories,
    playerPositions,
    availableRoles,
    handleInputChange: originalHandleInputChange,
    handleSubmit,
    handleSaveWithId,
    isFieldDisabled,
    handleEdit,
    exitEditMode,
    handleSave,
    handleCancel,
    linkRelationErrorIds,
    clearLinkRelationError,
    validateLinkRelations,
    feedbackAlert,
    clearFeedbackAlert,
  } = usePersonForm({
    onSaveSuccess: fromAthlete
      ? () => navigate(`/create-person?edit=${fromAthlete}&tab=${returnTab}`, { replace: true })
      : undefined
  })

  // Aggiorna il titolo dell'header quando si visualizza/modifica una persona esistente
  useEffect(() => {
    if (isEditing && (form.given_name || form.family_name || form.full_name)) {
      const name = `${form.given_name || ''} ${form.family_name || ''}`.trim() || form.full_name || null
      setPageTitle(name || 'Modifica Persona')
    } else if (location.pathname === '/create-person') {
      setPageTitle(null) // Ripristina "Nuova Persona" quando si crea
    }
    return () => setPageTitle(null)
  }, [isEditing, form.given_name, form.family_name, form.full_name, location.pathname, setPageTitle])

  // Navigazione avanti/indietro: usa l'ordine della tabella Anagrafiche (con filtri se si viene da lì)
  useEffect(() => {
    if (!currentEditId) {
      setCreatePersonNav(null, null)
      return
    }
    const storedIds = getPeopleNavIds()
    if (storedIds && storedIds.length > 0 && storedIds.includes(currentEditId)) {
      const idx = storedIds.indexOf(currentEditId)
      const nextId = idx < storedIds.length - 1 ? storedIds[idx + 1] : null
      const prevId = idx > 0 ? storedIds[idx - 1] : null
      setCreatePersonNav(nextId, prevId)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('people')
        .select('id')
        .order('family_name', { ascending: true })
      if (cancelled || error) return
      const ids = (data ?? []).map((r: { id: string }) => r.id)
      const idx = ids.indexOf(currentEditId)
      const nextId = idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null
      const prevId = idx > 0 ? ids[idx - 1] : null
      if (!cancelled) setCreatePersonNav(nextId, prevId)
    })()
    return () => { cancelled = true }
  }, [currentEditId, setCreatePersonNav])

  // Errore validazione Tessera CSEN (blocco uscita da tab Giocatore)
  const [csenTabError, setCsenTabError] = useState<string | null>(null)
  const [duplicateEmailCheck, setDuplicateEmailCheck] = useState<{
    email: string
    people: DuplicateEmailPerson[]
  } | null>(null)
  const lastCheckedEmailRef = useRef('')

  // Stato per il modal degli infortuni
  const [showInjuryModal, setShowInjuryModal] = useState(false)
  const [editingInjury, setEditingInjury] = useState<any>(null)
  const [injuryRefreshTrigger, setInjuryRefreshTrigger] = useState(0)
  
  // Stato per il modal di eliminazione infortuni
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [injuryToDelete, setInjuryToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Stato per il form delle attivitÃƒÂ  infortuni (solo type picker; il modulo "Nuova attivitÃƒÂ " ÃƒÂ¨ in /infortuni)
  const [showActivityTypePicker, setShowActivityTypePicker] = useState(false)
  const [selectedInjuryId, setSelectedInjuryId] = useState<string | null>(null)
  const [medicalStaff, setMedicalStaff] = useState<Array<{ id: string; full_name: string; roles: string[] }>>([])
  const [customOperator, setCustomOperator] = useState('')
  const [injuryActivityTypes, setInjuryActivityTypes] = useState<Array<{ id: string; name: string; code: string; sort_order: number; active: boolean }>>([])
  
  // Stato per i ruoli staff
  const [staffRoles, setStaffRoles] = useState<Array<{id: string, name: string, position_order: number}>>([])
  
  // Stato per il modal PDF scheda persona
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // Ascolta l'evento dal pulsante nell'header DashboardLayout (quando embedInLayout)
  useEffect(() => {
    const handler = () => setShowPdfModal(true)
    window.addEventListener('open-person-pdf-modal', handler)
    return () => window.removeEventListener('open-person-pdf-modal', handler)
  }, [])
  
  // Stati per il modal di conferma eliminazione attivitÃƒÂ 
  const [showDeleteActivityModal, setShowDeleteActivityModal] = useState(false)
  const [activityToDelete, setActivityToDelete] = useState<{id: string, injuryId: string, type: string} | null>(null)
  const [deletingActivity, setDeletingActivity] = useState(false)
  
  // Stati per il popup di conferma ricontrollo
  const [showRicontrolloModal, setShowRicontrolloModal] = useState(false)
  const [pendingActivityData, setPendingActivityData] = useState<any>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedRicontrolloDate, setSelectedRicontrolloDate] = useState('')
  
  // Stati per la modifica delle attivitÃƒÂ 
  const [editingActivity, setEditingActivity] = useState<any>(null)
  const [isEditingActivity, setIsEditingActivity] = useState(false)
  // Planning fisioterapista: modal con impegni e pulsante Aggiungi per prossima terapia
  const [showFisioPlanningModal, setShowFisioPlanningModal] = useState(false)
  const [planningOperatorName, setPlanningOperatorName] = useState('')
  const [planningAppointments, setPlanningAppointments] = useState<Array<{ id: string; date: string; ricontrollo_time: string | null; duration_minutes: number | null; massaggio: boolean; tecar: boolean; laser: boolean; playerName: string; operatorName: string; activityType: string; activity_description?: string | null }>>([])
  const [loadingPlanning, setLoadingPlanning] = useState(false)
  const [addNewFisioInPlanning, setAddNewFisioInPlanning] = useState(false)
  const [newFisioForm, setNewFisioForm] = useState({ date: '', time: '', duration_minutes: '', operator_name: '', activity_type: 'physiotherapy' as 'physiotherapy' | 'medical_visit', massaggio: false, tecar: false, laser: false })
  const [planningInjuryId, setPlanningInjuryId] = useState<string | null>(null)
  const [planningPlayerName, setPlanningPlayerName] = useState('')
  const [savingNewFisio, setSavingNewFisio] = useState(false)
  const [showPlanningDeleteModal, setShowPlanningDeleteModal] = useState(false)
  const [planningToDelete, setPlanningToDelete] = useState<{ id: string; label: string } | null>(null)
  const [deletingPlanning, setDeletingPlanning] = useState(false)
  
  const [overlapConfirmModal, setOverlapConfirmModal] = useState<{ message: string } | null>(null)
  const [pendingOverlapActivityData, setPendingOverlapActivityData] = useState<any>(null)

  // Società di origine (per autocomplete)
  const [originClubsList, setOriginClubsList] = useState<Array<{ id: string; name: string }>>([])
  const [originClubDropdownOpen, setOriginClubDropdownOpen] = useState(false)
  const [originClubHighlightedIndex, setOriginClubHighlightedIndex] = useState(0)
  const [showAddOriginClubModal, setShowAddOriginClubModal] = useState(false)
  const [newOriginClubName, setNewOriginClubName] = useState('')
  const [addOriginClubLoading, setAddOriginClubLoading] = useState(false)
  const originClubDropdownRef = useRef<HTMLDivElement>(null)
  const loadOriginClubs = useCallback(async () => {
    const { data, error } = await supabase
      .from('origin_clubs')
      .select('id, name')
      .order('name', { ascending: true })
    if (!error) {
      const sorted = (data || []).sort((a, b) =>
        a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })
      )
      setOriginClubsList(sorted)
    }
  }, [])
  useEffect(() => {
    loadOriginClubs()
  }, [loadOriginClubs])
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (originClubDropdownRef.current && !originClubDropdownRef.current.contains(e.target as Node)) {
        setOriginClubDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Popup invio notifica dopo modifica attivitÃƒÂ  (come in AgendaView)
  const [notificationChoiceModal, setNotificationChoiceModal] = useState<{
    operatorName: string
    playerName: string
    payload: ActivityUpdatedPayload
  } | null>(null)
  const [sendingNotification, setSendingNotification] = useState(false)
  
  // Stati per il tab Giocatore quando si crea un tutor (uno o piÃƒÂ¹ atleti collegati)
  const [athleteData, setAthleteData] = useState<any>(null)
  const [athletesDataList, setAthletesDataList] = useState<any[]>([])
  const [loadingAthlete, setLoadingAthlete] = useState(false)
  
  const [showTutorMinorsModal, setShowTutorMinorsModal] = useState(false)

  // Statistiche giocatore (card reali quando in sola lettura)
  const [playerStats, setPlayerStats] = useState<PlayerStatsView | null>(null)
  const [lastInjury, setLastInjury] = useState<{ injury_date: string; is_closed?: boolean } | null>(null)
  const [lastTrainingDaysAgo, setLastTrainingDaysAgo] = useState<number | null>(null)
  const [loadingPlayerStats, setLoadingPlayerStats] = useState(false)
  
  
  // Stato per il tab attivo - usa il parametro URL se presente, altrimenti default 'personal'
  const [activeTab, setActiveTab] = useState(tabParam || 'personal')

  // Determina se la persona Ã¨ un tutor: preferisce Ruolo nell'App e Ruoli aggiuntivi (tab Flowme).
  // CosÃ¬ se l'utente imposta Team Manager (e toglie Tutor), il tab mostra "Staff" e non "Tutor".
  const appRoleName = form.app_role ? (staffRoles.find(r => r.id === form.app_role)?.name ?? '') : ''
  const hasTutorInAppRole = form.app_role === 'tutor' || appRoleName === 'Tutor'
  const hasTutorInAdditional = (form.additional_roles || []).some((rid: string) => rid === 'tutor' || staffRoles.find(r => r.id === rid)?.name === 'Tutor')
  const hasTutorInStaffRoles = form.staff_roles && (form.staff_roles.includes('tutor') || form.staff_roles.some((rid: string) => staffRoles.find(r => r.id === rid)?.name === 'Tutor'))
  const hasAppRoleSet = (form.app_role != null && form.app_role !== '')
  const hasTutorRole = hasTutorInAppRole || hasTutorInAdditional || (!hasAppRoleSet && !!hasTutorInStaffRoles)
  const isPersonTutor = isTutor || !!hasTutorRole
  const hasFamiliareInStaffRoles = form.staff_roles && form.staff_roles.some((rid: string) => rid === 'familiare' || staffRoles.find(r => r.id === rid)?.name === 'Familiare')
  const isPersonFamiliare = form.app_role === 'familiare' || appRoleName === 'Familiare' || !!hasFamiliareInStaffRoles

  // Controlla automaticamente le squalifiche scadute al caricamento del componente
  useEffect(() => {
    const checkExpiredDisqualifications = async () => {
      try {
        console.log('Ã°Å¸â€Â Controllo automatico squalifiche scadute...')
        const updatedCount = await checkAllExpiredDisqualifications()
        if (updatedCount > 0) {
          console.log(`Ã¢Å“â€¦ ${updatedCount} squalifiche scadute aggiornate automaticamente`)
        }
      } catch (error) {
        console.error('Ã¢ÂÅ’ Errore nel controllo automatico squalifiche:', error)
      }
    }
    
    checkExpiredDisqualifications()
  }, []) // Esegui solo una volta al caricamento del componente

  // Carica statistiche giocatore reali per le card (solo in visualizzazione, con categoria)
  useEffect(() => {
    if (!currentEditId || !isEditing || isEditMode) {
      setPlayerStats(null)
      setLastInjury(null)
      setLastTrainingDaysAgo(null)
      return
    }
    const categoryIds = form.player_categories || []
    if (!categoryIds.length) {
      setPlayerStats(null)
      setLastInjury(null)
      setLastTrainingDaysAgo(null)
      return
    }
    let cancelled = false
    setLoadingPlayerStats(true)
    ;(async () => {
      try {
        const [stats, injuryRes, lastPresenceRes] = await Promise.all([
          loadPlayerStatsForView(currentEditId, categoryIds),
          supabase.from('injuries').select('injury_date, is_closed').eq('person_id', currentEditId).order('injury_date', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('attendance').select('session_id').eq('player_id', currentEditId).eq('status', 'PRESENTE')
        ])
        if (cancelled) return
        setPlayerStats(stats || null)
        setLastInjury(injuryRes.data ? { injury_date: injuryRes.data.injury_date, is_closed: injuryRes.data.is_closed } : null)
        if (lastPresenceRes.data && lastPresenceRes.data.length > 0) {
          const sessionIds = lastPresenceRes.data.map((a: { session_id: string }) => a.session_id)
          const { data: sessions } = await supabase.from('sessions').select('session_date').in('id', sessionIds)
          const dates = (sessions || []).map((s: { session_date: string }) => new Date(s.session_date).getTime())
          const maxDate = dates.length ? Math.max(...dates) : 0
          if (maxDate) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const diff = Math.floor((today.getTime() - maxDate) / (1000 * 60 * 60 * 24))
            setLastTrainingDaysAgo(diff)
          } else setLastTrainingDaysAgo(null)
        } else setLastTrainingDaysAgo(null)
      } catch {
        if (!cancelled) setPlayerStats(null)
      } finally {
        if (!cancelled) setLoadingPlayerStats(false)
      }
    })()
    return () => { cancelled = true }
  }, [currentEditId, isEditing, isEditMode, form.player_categories])

  // Carica dati dell'atleta quando si crea un tutor o si visualizza un tutor esistente
  useEffect(() => {
    if (isTutor && athleteId) {
      // Caso 1: Creazione nuovo tutor
      loadAthleteData()
    } else if (isPersonTutor && currentEditId) {
      // Caso 2: Visualizzazione tutor esistente - carica minorenni collegati (per tab Giocatore e tab Tutor)
      loadAthleteDataForExistingTutor()
    }
  }, [isTutor, athleteId, isPersonTutor, currentEditId])

  // Carica nomi giocatori per tutor_athlete_ids dal form (es. dopo selezione dal modal) - mostra nome e cognome invece di UUID
  useEffect(() => {
    if (!isPersonTutor) return
    const ids = (form.tutor_athlete_relations?.length ? form.tutor_athlete_relations.map((r: { athlete_id: string }) => r.athlete_id) : form.tutor_athlete_ids || []).filter(Boolean)
    if (ids.length === 0) return
    const missingIds = ids.filter((id: string) => !athletesDataList.some((a: { id: string }) => a.id === id))
    if (missingIds.length === 0) return
    let cancelled = false
    supabase.from('people').select('id, full_name, given_name, family_name').in('id', missingIds)
      .then(({ data }) => {
        if (!cancelled && data?.length) setAthletesDataList(prev => [...prev.filter((a: { id: string }) => !missingIds.includes(a.id)), ...data])
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPersonTutor, form.tutor_athlete_ids?.join(','), form.tutor_athlete_relations?.map((r: { athlete_id: string }) => r.athlete_id).join(',')])

  // Aggiorna isTutor al caricamento: solo se Ruolo nell'App (o staff_roles se app_role non impostato) contiene Tutor
  useEffect(() => {
    const tutorInApp = form.app_role === 'tutor' || staffRoles.find(r => r.id === form.app_role)?.name === 'Tutor'
    const tutorInAdditional = (form.additional_roles || []).some((rid: string) => rid === 'tutor' || staffRoles.find(r => r.id === rid)?.name === 'Tutor')
    const tutorInStaffOnly = !form.app_role && form.staff_roles && (form.staff_roles.includes('tutor') || form.staff_roles.some((rid: string) => staffRoles.find(r => r.id === rid)?.name === 'Tutor'))
    if (tutorInApp || tutorInAdditional || tutorInStaffOnly) setIsTutor(true)
    else if (form.app_role != null && form.app_role !== '') setIsTutor(false)
  }, [form.app_role, form.additional_roles, form.staff_roles, staffRoles])

  // Assicura che il tab attivo sia "staff" quando si crea un tutor
  useEffect(() => {
    if (isTutor && !isEditing) {
      console.log('Ã°Å¸â€Â§ APRI TAB STAFF: isTutor=true, isEditing=false')
      setActiveTab('staff')
    }
  }, [isTutor, isEditing])

  const loadAthleteData = async () => {
    if (!athleteId) return
    
    try {
      setLoadingAthlete(true)
      const { data, error } = await supabase
        .from('people')
        .select(`
          id,
          full_name,
          given_name,
          family_name,
          date_of_birth,
          player_categories,
          player_positions
        `)
        .eq('id', athleteId)
        .single()

      if (error) throw error
      setAthleteData(data)
    } catch (error) {
      console.error('Errore nel caricamento dati atleta:', error)
    } finally {
      setLoadingAthlete(false)
    }
  }

  const loadAthleteDataForExistingTutor = async () => {
    if (!currentEditId) return
    
    try {
      setLoadingAthlete(true)
      const { data: relations, error: relationError } = await supabase
        .from('tutor_athlete_relations')
        .select('athlete_id')
        .eq('tutor_id', currentEditId)

      if (relationError) throw relationError
      const athleteIds = (relations || []).map((r: { athlete_id: string }) => r.athlete_id).filter(Boolean)
      if (athleteIds.length === 0) {
        setAthleteData(null)
        setAthletesDataList([])
        return
      }

      const { data: peopleList, error } = await supabase
        .from('people')
        .select('id, full_name, given_name, family_name, date_of_birth, player_categories, player_positions')
        .in('id', athleteIds)

      if (error) throw error
      const list = peopleList || []
      setAthletesDataList(list)
      setAthleteData(list.length === 1 ? list[0] : null)
    } catch (error) {
      console.error('Errore nel caricamento dati atleta per tutor esistente:', error)
      setAthleteData(null)
      setAthletesDataList([])
    } finally {
      setLoadingAthlete(false)
    }
  }

  // Funzioni per gestire il modal degli infortuni
  const openInjuryModal = (injury: any = null) => {
    setEditingInjury(injury)
    setShowInjuryModal(true)
  }

  // Funzioni per gestire il modal di eliminazione attivitÃƒÂ 
  const openDeleteActivityModal = (activityId: string, injuryId: string, activityType: string) => {
    setActivityToDelete({ id: activityId, injuryId, type: activityType })
    setShowDeleteActivityModal(true)
  }

  // Modifica attivitÃƒÂ : apri il modulo in overlay sulla stessa pagina (scheda giocatore), senza andare a /infortuni
  const openEditActivityForm = (activity: { id: string }) => {
    setEmbedEditActivityId(activity.id)
    setEmbedInjuryId(null)
    setEmbedActivityType('')
    setShowEmbedActivityModal(true)
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

      // Ricarica le attivitÃƒÂ  per aggiornare la lista
      setInjuryRefreshTrigger(prev => prev + 1)
      console.log('Ã¢Å“â€¦ AttivitÃƒÂ  eliminata con successo')
      closeDeleteActivityModal()
    } catch (error) {
      console.error('Ã¢ÂÅ’ Errore nell\'eliminazione dell\'attivitÃƒÂ :', error)
      alert('Errore nell\'eliminazione dell\'attivitÃƒÂ : ' + (error as any)?.message || 'Errore sconosciuto')
    } finally {
      setDeletingActivity(false)
    }
  }

  // Funzione helper per i nomi dei tipi di attivitÃƒÂ 
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
    if (currentEditId) {
      try {
        const { data: openInjuries } = await supabase
          .from('injuries')
          .select('id')
          .eq('person_id', currentEditId)
          .eq('is_closed', false)
        
        const hasOpenInjuries = openInjuries && openInjuries.length > 0
        
        // Aggiorna lo stato injured basato sulla presenza di infortuni aperti
        setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
        await saveInjuredStatus(currentEditId, hasOpenInjuries)
      } catch (error) {
        // Fallback: se i campi is_closed non esistono ancora, usa current_status
        console.warn('Campi is_closed non disponibili, uso current_status come fallback')
        const { data: injuries } = await supabase
          .from('injuries')
          .select('id, current_status')
          .eq('person_id', currentEditId)
        
        const hasOpenInjuries = injuries && injuries.some(injury => injury.current_status === 'In corso')
        setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
        await saveInjuredStatus(currentEditId, hasOpenInjuries)
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
        console.error('Ã¢ÂÅ’ Errore Supabase:', error)
        throw error
      }
      
      console.log('Ã¢Å“â€¦ Infortunio eliminato con successo')
      setInjuryRefreshTrigger(prev => prev + 1) // Refresh la lista
      
      // Controlla se ci sono ancora infortuni aperti dopo l'eliminazione
      if (currentEditId) {
        try {
          const { data: openInjuries } = await supabase
            .from('injuries')
            .select('id')
            .eq('person_id', currentEditId)
            .eq('is_closed', false)
          
          const hasOpenInjuries = openInjuries && openInjuries.length > 0
          
          // Aggiorna lo stato injured basato sulla presenza di infortuni aperti
          setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
          await saveInjuredStatus(currentEditId, hasOpenInjuries)
        } catch (error) {
          // Fallback: se i campi is_closed non esistono ancora, usa current_status
          console.warn('Campi is_closed non disponibili, uso current_status come fallback')
          const { data: injuries } = await supabase
            .from('injuries')
            .select('id, current_status')
            .eq('person_id', currentEditId)
          
          const hasOpenInjuries = injuries && injuries.some(injury => injury.current_status === 'In corso')
          setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
          await saveInjuredStatus(currentEditId, hasOpenInjuries)
        }
      }
      
      closeDeleteModal()
    } catch (error) {
      console.error('Ã¢ÂÅ’ Errore nell\'eliminazione:', error)
      alert('Errore nell\'eliminazione: ' + (error as any)?.message || 'Errore sconosciuto')
    } finally {
      setDeleting(false)
    }
  }

  // Carica il personale medico dal database
  const loadMedicalStaff = async () => {
    try {
      console.log('Ã°Å¸â€Â Caricamento staff medico...')
      
      // Prima carica i ruoli: Medico, Fisio e Fisioterapista (entrambi i nomi per i fisioterapisti)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, name')
        .in('name', ['Medico', 'Fisio', 'Fisioterapista'])

      if (rolesError) throw rolesError
      
      console.log('Ã°Å¸â€Â Ruoli medici/fisio trovati:', rolesData)

      const medicalRoleIds = rolesData?.map(role => role.id) || []
      const medicoRoleId = rolesData?.find(r => r.name === 'Medico')?.id
      const fisioRoleIds = rolesData?.filter(r => r.name === 'Fisio' || r.name === 'Fisioterapista').map(r => r.id) || []
      
      console.log('Ã°Å¸â€Â ID ruoli medici:', medicalRoleIds)

      if (medicalRoleIds.length === 0) {
        console.log('Ã¢Å¡Â Ã¯Â¸Â Nessun ruolo medico trovato')
        setMedicalStaff([])
        return
      }

      // Poi carica le persone che hanno questi ruoli in staff_roles, app_role O additional_roles
      const { data, error } = await supabase
        .from('people')
        .select('id, full_name, staff_roles, app_role, additional_roles')
        .not('full_name', 'is', null)
        .order('full_name')

      if (error) throw error
      
      console.log('Ã°Å¸â€Â Tutte le persone caricate:', data)

      const hasMedicalRole = (p: { staff_roles?: unknown; app_role?: unknown; additional_roles?: unknown }) => {
        const staffArr = toRoleArray(p.staff_roles)
        if (staffArr.some((x: string) => medicalRoleIds.includes(x) || ['medico', 'fisio', 'fisioterapista'].includes(String(x).toLowerCase()))) return true
        if (p.app_role != null && p.app_role !== '' && (medicalRoleIds.includes(String(p.app_role)) || ['medico', 'fisio', 'fisioterapista'].includes(String(p.app_role).toLowerCase()))) return true
        const addArr = toRoleArray(p.additional_roles)
        if (addArr.some((x: string) => medicalRoleIds.includes(x) || ['medico', 'fisio', 'fisioterapista'].includes(String(x).toLowerCase()))) return true
        return false
      }

      const medicalRoleNames = ['Medico', 'Fisio', 'Fisioterapista']
      const findRoleByIdOrName = (idOrName: string): { id: string; name: string } | null => {
        if (medicalRoleIds.includes(idOrName)) return rolesData?.find((r: { id: string }) => r.id === idOrName) || null
        const lower = String(idOrName).toLowerCase()
        if (lower === 'medico') return rolesData?.find((r: { name: string }) => r.name === 'Medico') || null
        if (lower === 'fisio' || lower === 'fisioterapista') return rolesData?.find((r: { name: string }) => r.name === 'Fisioterapista') || rolesData?.find((r: { name: string }) => r.name === 'Fisio') || null
        const byName = rolesData?.find((r: { name: string }) => r.name === idOrName || String(idOrName).toLowerCase() === r.name.toLowerCase())
        return byName || null
      }
      const toRoleArray = (val: unknown): string[] => {
        if (Array.isArray(val)) return val.map(String)
        if (val == null || val === '') return []
        if (typeof val === 'string') {
          const trimmed = String(val).trim()
          if (trimmed.startsWith('[')) {
            try { return (JSON.parse(trimmed) as any[]).map(String) } catch { return [trimmed] }
          }
          return [trimmed]
        }
        return [String(val)]
      }

      // Filtra solo le persone che hanno ruoli "Medico" o "Fisio" in staff_roles, app_role O additional_roles
      const filteredStaff = (data || []).filter(hasMedicalRole).map(person => {
        let personMedicalRoles: Array<{ id: string; name: string }> = []
        const staffArr = toRoleArray(person.staff_roles)
        staffArr.forEach((roleIdOrName: string) => {
          const r = findRoleByIdOrName(roleIdOrName)
          if (r && medicalRoleNames.includes(r.name) && !personMedicalRoles.find(m => m.id === r.id)) personMedicalRoles.push(r)
        })

        if (person.app_role) {
          const appRoleCheck = findRoleByIdOrName(String(person.app_role))
          if (appRoleCheck && !personMedicalRoles.find(r => r.id === appRoleCheck.id)) personMedicalRoles.push(appRoleCheck)
        }

        const addArr = toRoleArray(person.additional_roles)
        addArr.forEach((roleIdOrName: string) => {
          const r = findRoleByIdOrName(roleIdOrName)
          if (r && medicalRoleNames.includes(r.name) && !personMedicalRoles.find(m => m.id === r.id)) personMedicalRoles.push(r)
        })
        
        const roles: string[] = []
        personMedicalRoles.forEach(role => {
          if (role?.name === 'Medico' && !roles.includes('Medico')) roles.push('Medico')
          if (role && (role.name === 'Fisio' || role.name === 'Fisioterapista') && !roles.includes('Fisioterapista')) roles.push('Fisioterapista')
        })
        return {
          id: person.id,
          full_name: person.full_name,
          roles
        }
      })

      console.log('Ã°Å¸â€Â Staff medico filtrato:', filteredStaff)
      setMedicalStaff(filteredStaff)
      console.log('Ã¢Å“â€¦ Staff medico caricato:', filteredStaff)
    } catch (error) {
      console.error('Errore nel caricamento del personale medico:', error)
    }
  }

  // Filtra il personale in base al tipo (usato da altri componenti se necessario)
  const getFilteredMedicalStaff = (activityType?: string) => {
    if (activityType === 'physiotherapy') {
      return medicalStaff.filter(staff => staff.roles.includes('Fisioterapista'))
    }
    if (activityType === 'medical_visit') {
      return medicalStaff.filter(staff => staff.roles.includes('Medico'))
    }
    return medicalStaff
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
        console.error('Ã¢ÂÅ’ Errore Supabase nel caricamento ruoli staff:', error)
        throw error
      }

      setStaffRoles(data || [])
    } catch (error) {
      console.error('Ã¢ÂÅ’ Errore nel caricamento dei ruoli staff:', error)
    }
  }

  // Carica i ruoli staff esistenti per questa persona
  const loadExistingStaffRoles = async () => {
    if (!currentEditId) return

    try {
      // I ruoli staff sono ora caricati direttamente dal form tramite usePersonForm
      // Non serve piÃƒÂ¹ caricare separatamente
      // Ruoli staff caricati dal form
    } catch (error) {
      console.error('Ã¢ÂÅ’ Errore nel caricamento ruoli staff esistenti:', error)
    }
  }

  // Determina se i ruoli staff selezionati richiedono categorie
  const hasStaffRolesRequiringCategories = () => {
    // Se è selezionato solo "Tutor", non richiede categorie
    const onlyTutor =
      form.staff_roles.length > 0 &&
      form.staff_roles.every(
        (roleId) =>
          roleId === 'tutor' ||
          staffRoles.find((r) => staffRoleRefMatches(roleId, r))?.name === 'Tutor',
      )
    if (onlyTutor) return false

    const rolesRequiringCategories = [
      'Allenatore',
      'Team Manager',
      'Accompagnatore',
      'Preparatore',
      'Direttore Tecnico',
      'Direttore Sportivo',
    ]

    return form.staff_roles.some((roleId) => {
      if (roleId === 'tutor') return false
      const role = findStaffRoleByRef(roleId, staffRoles)
      return role ? rolesRequiringCategories.includes(role.name) : false
    })
  }

  // Funzioni per gestire il form delle attivitÃƒÂ 
  const openActivityForm = (injuryId: string) => {
    setSelectedInjuryId(injuryId)
    setShowActivityTypePicker(true)
  }

  // Modal Nuova/Modifica attivitÃƒÂ  in overlay sulla stessa pagina (iframe con /infortuni?embed=1)
  const [showEmbedActivityModal, setShowEmbedActivityModal] = useState(false)
  const [embedInjuryId, setEmbedInjuryId] = useState<string | null>(null)
  const [embedActivityType, setEmbedActivityType] = useState<string>('')
  const [embedEditActivityId, setEmbedEditActivityId] = useState<string | null>(null)

  const chooseActivityTypeAndOpenForm = (code: string) => {
    if (!selectedInjuryId) return
    const injuryId = selectedInjuryId
    setShowActivityTypePicker(false)
    setSelectedInjuryId(null)
    // Apri il modulo "Nuova attivitÃƒÂ " sulla stessa pagina (scheda giocatore), senza andare a /infortuni
    setEmbedInjuryId(injuryId)
    setEmbedActivityType(code)
    setShowEmbedActivityModal(true)
  }

  const openActivityFormWithType = (injuryId: string, code: string) => {
    setEmbedEditActivityId(null)
    setEmbedInjuryId(injuryId)
    setEmbedActivityType(code)
    setShowEmbedActivityModal(true)
  }

  const closeActivityTypePicker = () => {
    setShowActivityTypePicker(false)
    setSelectedInjuryId(null)
  }

  // Ascolta chiusura/salvataggio del modal aperto in iframe (restiamo sulla pagina giocatore)
  useEffect(() => {
    if (!showEmbedActivityModal) return
    const handler = (event: MessageEvent) => {
      const t = event.data?.type
      if (t === 'injury-activity-modal-close' || t === 'injury-activity-modal-saved') {
        setShowEmbedActivityModal(false)
        setEmbedInjuryId(null)
        setEmbedActivityType('')
        setEmbedEditActivityId(null)
        if (t === 'injury-activity-modal-saved') setInjuryRefreshTrigger(prev => prev + 1)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [showEmbedActivityModal])

  const performSaveActivity = async (activityData: any, overrideOverlap = false) => {
    const payload = {
      ...activityData,
      buffer_minuti: 4,
      override_overlap: overrideOverlap
    }
    try {
      let error
      if (isEditingActivity && editingActivity) {
        // Modifica attivitÃƒÂ  esistente
        const { error: updateError } = await supabase
          .from('injury_activities')
          .update(payload)
          .eq('id', editingActivity!.id)
        error = updateError
        console.log('Ã¢Å“â€¦ AttivitÃƒÂ  modificata con successo')
        // Per fisioterapia/visita medica con operatore: mostra popup "A chi inviare notifica?"
        if (!updateError && (activityData.activity_type === 'physiotherapy' || activityData.activity_type === 'medical_visit') && activityData.operator_name) {
          let playerName = ''
          if (selectedInjuryId) {
            const { data: inj } = await supabase.from('injuries').select('person_id').eq('id', selectedInjuryId).maybeSingle()
            if (inj?.person_id) {
              const { data: person } = await supabase.from('people').select('full_name').eq('id', inj.person_id).maybeSingle()
              playerName = person?.full_name ?? ''
            }
          }
          const operatorName = String(activityData.operator_name || '').trim()
          if (operatorName) {
            setNotificationChoiceModal({
              operatorName,
              playerName: playerName || '—',
              payload: {
                activity_id: editingActivity.id,
                player_name: playerName || undefined,
                date: activityData.ricontrollo || activityData.activity_date || '',
                time: activityData.ricontrollo_time ?? undefined,
                activity_type: activityData.activity_type
              }
            })
          }
        }
      } else {
        // Crea nuova attivitÃƒÂ 
        const { error: insertError } = await supabase
          .from('injury_activities')
          .insert(payload)
        error = insertError
        console.log('Ã¢Å“â€¦ AttivitÃƒÂ  salvata con successo')
      }

      if (error) throw error

      // Se ÃƒÂ¨ una VISITA DI CHIUSURA, chiudi l'infortunio e aggiorna lo stato del giocatore
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
          if (currentEditId) {
            const { error: personError } = await supabase
              .from('people')
              .update({ injured: false })
              .eq('id', currentEditId)

            if (personError) throw personError
            
            // Aggiorna immediatamente lo stato locale del form
            setForm(prev => ({ ...prev, injured: false }))
          }

          console.log('Ã¢Å“â€¦ Infortunio chiuso e giocatore aggiornato')
        } catch (error) {
          console.error('Ã¢ÂÅ’ Errore nella chiusura infortunio:', error)
          // Non bloccare il salvataggio dell'attivitÃƒÂ  se fallisce la chiusura
        }
      }

      // Ricarica le attivitÃƒÂ  per aggiornare la lista
      setInjuryRefreshTrigger(prev => prev + 1)
    } catch (error) {
      console.error('Ã¢ÂÅ’ Errore nel salvataggio dell\'attivitÃƒÂ :', error)
      toast.error('Errore nel salvataggio dell\'attivitÃƒÂ : ' + ((error as any)?.message || 'Errore sconosciuto'))
    }
  }

  const handleOverlapConfirm = async () => {
    if (!pendingOverlapActivityData) return
    const data = pendingOverlapActivityData
    setOverlapConfirmModal(null)
    setPendingOverlapActivityData(null)
    await performSaveActivity(data, true)
  }

  const handleSendNotification = async (to: 'operator' | 'player' | 'both') => {
    if (!notificationChoiceModal) return
    try {
      setSendingNotification(true)
      const { operatorName, playerName, payload } = notificationChoiceModal
      const operatorUserId = await getUserIdByOperatorName(operatorName)
      const playerUserId = playerName && playerName !== '—' ? await getUserIdByOperatorName(playerName) : null
      const sent = new Set<string>()
      if (to === 'operator' || to === 'both') {
        if (operatorUserId && !sent.has(operatorUserId)) {
          await sendActivityUpdatedNotificationToUser(operatorUserId, payload, { forPlayer: false })
          sent.add(operatorUserId)
        }
        const dateFormatted = formatDateIt(payload.date)
        const timeStr = payload.time ? String(payload.time).slice(0, 5).replace(':', '.') : ''
        const changesSummary = timeStr ? `${dateFormatted}, ore ${timeStr}` : dateFormatted
        try {
          await supabase.from('activity_modification_notifications').insert({
            activity_id: payload.activity_id,
            operator_name: operatorName,
            player_name: playerName !== '—' ? playerName : null,
            changes_summary: changesSummary || 'Modifica effettuata'
          })
        } catch (e) {
          console.warn('activity_modification_notifications insert (FlowMe):', e)
        }
      }
      if (to === 'player' || to === 'both') {
        if (playerUserId && !sent.has(playerUserId)) {
          await sendActivityUpdatedNotificationToUser(playerUserId, payload, { forPlayer: true })
          sent.add(playerUserId)
        }
      }
      setNotificationChoiceModal(null)
    } catch (e) {
      console.error('Errore invio notifica:', e)
      alert('Errore durante l\'invio della notifica: ' + (e as Error)?.message)
    } finally {
      setSendingNotification(false)
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

  // Stesso flusso di "Prossima terapia": salva attivitÃƒÂ  senza ricontrollo e vai alla scheda Agenda per fissare operatore, data, orario, durata
  const handleRicontrolloGoToAgenda = async () => {
    setShowRicontrolloModal(false)
    setShowDatePicker(false)
    const injuryId = selectedInjuryId
    await performSaveActivity(pendingActivityData)
    setPendingActivityData(null)
    if (injuryId) navigate(`/infortuni/nuovo?injuryId=${injuryId}`)
  }

  const handleRicontrolloWithDate = async (date: string) => {
    setShowRicontrolloModal(false)
    setShowDatePicker(false)
    // Solo data: salva la data di ricontrollo ma senza orario Ã¢â€ â€™ andranno in "AttivitÃƒÂ  da confermare" dove il responsabile fisserÃƒÂ  l'orario
    const updatedData = { ...pendingActivityData, ricontrollo: date, ricontrollo_time: null }
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

  // Funzione per calcolare l'etÃƒÂ  e controllare se ÃƒÂ¨ minorenne
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
        console.error('Ã¢ÂÅ’ Errore Supabase:', error)
        throw error
      }
      
      console.log('Ã¢Å“â€¦ Stato infortunio salvato:', injured ? 'Infortunato' : 'In buone condizioni')
    } catch (error) {
      console.error('Ã¢ÂÅ’ Errore nel salvataggio stato infortunio:', error)
    }
  }


  // Wrapper per handleInputChange che gestisce il cambio di tab
  const handleInputChange = (field: string, value: any) => {
    originalHandleInputChange(field, value)
    
    // Se deseleziona "ÃƒË† un giocatore" e siamo nel tab Giocatore o Quote, torna al tab Personal
    // (Infortuni: resta se form.injured ÃƒÂ¨ true, altrimenti torna a personal)
    if (field === 'is_player' && !value && (activeTab === 'player' || activeTab === 'fees' || (activeTab === 'injuries' && !form.injured))) {
      setActiveTab('personal')
    }
    
    // Se deseleziona "ÃƒË† staff" e siamo nel tab Staff, torna al tab Personal
    if (field === 'is_staff' && !value && activeTab === 'staff') {
      setActiveTab('personal')
    }
    
    // Se cambia la data di nascita, controlla se ÃƒÂ¨ minorenne
    if (field === 'date_of_birth') {
      const minor = checkIfMinor(value)
      setIsMinor(minor)
    }

    // Se cambia il ruolo staff, il tab si aggiornerÃƒÂ  automaticamente
    if (field === 'staff_roles') {
      console.log('Ã°Å¸â€â€ž Ruoli staff cambiati:', value)
      
      // Se seleziona "familiare", salva prima la persona e poi apri il popup
      if (value && value.includes('familiare')) {
        originalHandleInputChange('app_role', 'familiare')
      console.log('Ã°Å¸â€Â FAMILIARE SELEZIONATO:', { currentEditId, value, })
      // Il listener dell'evento "familiareSelected" si occuperÃƒÂ  di portare al tab Famigliare
      }
    }

    // Se cambia lo stato di infortunio, salva automaticamente
    if (field === 'injured' && currentEditId) {
      saveInjuredStatus(currentEditId, value)
    }
  }

  const handleEmailBlur = useCallback(async (value: string) => {
    const email = value.trim().toLowerCase()
    if (!email || email === lastCheckedEmailRef.current) return
    lastCheckedEmailRef.current = email
    const emailPattern = email.replace(/[\\%_]/g, '\\$&')

    let query = supabase
      .from('people')
      .select('id, given_name, family_name, full_name, email, is_player, is_staff')
      .ilike('email', emailPattern)

    if (currentEditId) query = query.neq('id', currentEditId)

    const { data, error } = await query
    if (error) {
      console.warn('Controllo email duplicata non disponibile:', error)
      return
    }

    if (data?.length) {
      setDuplicateEmailCheck({ email, people: data as DuplicateEmailPerson[] })
    }
  }, [currentEditId])

  // Note: logica in NotesTab; qui solo state per tab Quote e bottom bar
  const [notesForFees, setNotesForFees] = useState<any[]>([])
  const [filteredNotesCount, setFilteredNotesCount] = useState(0)
  const [totalNotesCount, setTotalNotesCount] = useState(0)
  const [showAddNoteForm, setShowAddNoteForm] = useState(false)
  const [notesRefreshTrigger, setNotesRefreshTrigger] = useState(0)

  // Tab Fisio: appuntamenti fisioterapia dove questa persona ÃƒÂ¨ operatore
  const [fisioAppointments, setFisioAppointments] = useState<Array<{ id: string; activity_date: string; ricontrollo: string | null; ricontrollo_time: string | null; injury_id: string; playerName: string; date: string }>>([])
  const [loadingFisioAppointments, setLoadingFisioAppointments] = useState(false)

  // Persona ÃƒÂ¨ fisioterapista se Ruolo nell'App o Ruoli Aggiuntivi includono Fisio/Fisioterapista (definito qui per uso in useEffect e tabs)
  const isFisioterapista = form.app_role === 'fisio' ||
    (Array.isArray(form.additional_roles) && form.additional_roles.some((r: string) => r === 'fisio' || String(r).toLowerCase() === 'fisioterapista'))
  
  // Stati per il sistema Tutor
  const [isMinor, setIsMinor] = useState(false)
  const [showTutorWarning, setShowTutorWarning] = useState(false) // Ã¢Å“â€¦ FIX: Inizia sempre false
  const [hasTutors, setHasTutors] = useState(false)
  const [tutorsCheckComplete, setTutorsCheckComplete] = useState(false)
  
  // Stub variables for disabled reminder modals (wrapped in {false && ...})
  const [reminderDate, setReminderDate] = useState('')
  const [showDateModal, setShowDateModal] = useState(false)
  const handleReminderChoice = (_choice: boolean) => {}
  const handleDateSelection = () => {}

  // Stati per il sistema Familiare
  const [showPlayerSelectionModal, setShowPlayerSelectionModal] = useState(false)
  const [showRelationshipAssignmentModal, setShowRelationshipAssignmentModal] = useState(false)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [guardianRelationships, setGuardianRelationships] = useState<any[]>([])
  const [hasConnectedPlayers, setHasConnectedPlayers] = useState(false)
  const [waitingForIdToNavigate, setWaitingForIdToNavigate] = useState(false)

  // Listener per l'evento "familiareSelected" dal hook
  useEffect(() => {
    const handleFamiliareSelected = async (event: any) => {
      console.log('Ã°Å¸Å½Â¯ EVENTO FAMILIARE RICEVUTO:', event.detail)
      
      // Se non abbiamo un ID, salva prima la persona
      if (!currentEditId) {
        console.log('Ã°Å¸â€™Â¾ SALVATAGGIO PERSONA PRIMA DI PORTARE AL TAB FAMIGLIARE...')
        try {
          // Segna che stiamo aspettando l'ID per navigare
          setWaitingForIdToNavigate(true)
          // Usa handleSubmit direttamente per salvare
          await handleSubmit(new Event('submit') as any)
          console.log('Ã¢Å“â€¦ PERSONA SALVATA - In attesa che currentEditId sia disponibile')
        } catch (error) {
          console.error('Ã¢ÂÅ’ ERRORE SALVATAGGIO:', error)
          setWaitingForIdToNavigate(false)
        }
      } else {
        // Se abbiamo giÃƒÂ  un ID, porta direttamente al tab
        console.log('Ã°Å¸â€â€ž PORTANDO AL TAB FAMIGLIARE...')
        setActiveTab('staff')
      }
    }

    window.addEventListener('familiareSelected', handleFamiliareSelected)
    
    return () => {
      window.removeEventListener('familiareSelected', handleFamiliareSelected)
    }
  }, [currentEditId, handleSubmit])

  // Naviga al tab Famigliare quando currentEditId diventa disponibile dopo il salvataggio
  useEffect(() => {
    if (waitingForIdToNavigate && currentEditId) {
      console.log('Ã°Å¸â€â€ž CURRENT_EDIT_ID DISPONIBILE - PORTANDO AL TAB FAMIGLIARE:', currentEditId)
      setActiveTab('staff')
      setWaitingForIdToNavigate(false)
    }
  }, [waitingForIdToNavigate, currentEditId])

  // Controlla se ci sono relazioni esistenti quando cambia currentEditId (FIX 1: app_role)
  useEffect(() => {
    if (currentEditId && isPersonFamiliare) {
      // Carica le relazioni esistenti per verificare se ci sono giocatori collegati
      const loadExistingRelationships = async () => {
        try {
          const { data: relationships, error } = await supabase
            .from('player_guardian_relationships')
            .select(`
              *,
              player:people!player_person_id(
                given_name,
                family_name,
                date_of_birth
              )
            `)
            .eq('guardian_person_id', currentEditId)

          if (error) {
            console.error('Ã¢ÂÅ’ Errore nel caricamento relazioni:', error)
            return
          }

          if (relationships && relationships.length > 0) {
            setHasConnectedPlayers(true)
            setGuardianRelationships(relationships)
          }
        } catch (error) {
          console.error('Ã¢ÂÅ’ Errore nel caricamento relazioni esistenti:', error)
        }
      }

      loadExistingRelationships()
    }
  }, [currentEditId, isPersonFamiliare])

  // Funzioni per gestire la selezione dei giocatori familiari
  const handlePlayerSelectionConfirm = (playerIds: string[]) => {
    setSelectedPlayerIds(playerIds)
    setShowPlayerSelectionModal(false)
    setShowRelationshipAssignmentModal(true)
  }

  const handlePlayerSelectionClose = () => {
    setShowPlayerSelectionModal(false)
    setSelectedPlayerIds([])
    // Se chiude senza selezionare, rimuovi "familiare" (FIX 1: app_role)
    if (isPersonFamiliare) {
      handleInputChange('app_role', '')
      const updatedRoles = (form.staff_roles || []).filter(role => role !== 'familiare')
      handleInputChange('staff_roles', updatedRoles)
    }
  }

  const handleRelationshipAssignmentConfirm = async (assignments: any[]) => {
    try {
      console.log('Ã°Å¸â€â€” CONFERMA RELAZIONI:', { assignments, currentEditId })
      
      // FIX 2: usa ID reale - se create mode, salva prima e ottieni l'ID
      let guardianId = currentEditId
      if (!guardianId) {
        const savedId = await handleSaveWithId()
        if (!savedId) {
          console.error('ERRORE: Salvataggio persona fallito')
          throw new Error('Nessun ID persona disponibile per salvare le relazioni')
        }
        guardianId = savedId
        setCurrentEditId(savedId)
      }

      console.log('Ã°Å¸â€™Â¾ SALVATAGGIO RELAZIONI NEL DATABASE:', { guardianId, assignments })

      // Salva le relazioni (FIX 3: upsert anti-duplicati)
      const relationshipsToInsert = assignments.map(assignment => ({
        player_person_id: assignment.playerId,
        guardian_person_id: guardianId,
        relationship_type: assignment.relationshipType
      }))

      const { error } = await supabase
        .from('player_guardian_relationships')
        .upsert(relationshipsToInsert, {
          onConflict: 'player_person_id,guardian_person_id',
          ignoreDuplicates: false
        })

      if (error) {
        console.error('Ã¢ÂÅ’ ERRORE DATABASE:', error)
        throw error
      }

      console.log('Ã¢Å“â€¦ RELAZIONI SALVATE NEL DATABASE')

      // Aggiorna lo stato locale per mostrare immediatamente i giocatori
      setGuardianRelationships(prev => {
        const newRelationships = [...prev, ...assignments]
        console.log('Ã°Å¸â€â€ž AGGIORNAMENTO STATO LOCALE:', { prev, newRelationships })
        return newRelationships
      })
      
      // Aggiorna lo stato per indicare che ci sono giocatori collegati
      setHasConnectedPlayers(true)
      
      setShowRelationshipAssignmentModal(false)
      setSelectedPlayerIds([])
    } catch (err) {
      console.error('Ã¢ÂÅ’ ERRORE NEL SALVATAGGIO DELLE RELAZIONI:', err)
    }
  }

  const handleRelationshipAssignmentClose = () => {
    setShowRelationshipAssignmentModal(false)
    setSelectedPlayerIds([])
  }

  // Funzione per salvare la persona con validazione familiare
  const handleSaveWithValidation = async () => {
    try {
      // Validazione: se ÃƒÂ¨ un familiare, deve avere almeno un giocatore collegato (FIX 1: app_role)
      if (isPersonFamiliare && !hasConnectedPlayers && guardianRelationships.length === 0) {
        toast.error('Ã¢Å¡Â Ã¯Â¸Â Un familiare deve avere almeno un giocatore collegato! Vai al tab "Famigliare" e clicca "Nuovo collegamento".')
        setActiveTab('staff') // Porta al tab Famigliare
        return null
      }

      const appRoleName = availableRoles.find((r: { id: string; name: string }) => r.id === form.app_role)?.name || ''
      const teamflowRoleName = availableRoles.find((r: { id: string; name: string }) => r.id === form.teamflow_app_role)?.name || ''
      const flowmeNeedsCategory = (appRoleName === 'Team Manager' || appRoleName === 'Allenatore') && categories.length > 0 && (form.staff_categories || []).length === 0
      if (flowmeNeedsCategory) {
        toast.error(appRoleName === 'Allenatore'
          ? 'Seleziona almeno una categoria (squadra) a cui abbinare l\'Allenatore nel tab Flowme.'
          : 'Seleziona almeno una categoria (squadra) a cui abbinare il Team Manager nel tab Flowme.')
        setActiveTab('flowme')
        return null
      }
      const teamflowNeedsCategory = (teamflowRoleName === 'Team Manager' || teamflowRoleName === 'Allenatore') && categories.length > 0 && (form.teamflow_staff_categories || []).length === 0
      if (teamflowNeedsCategory) {
        toast.error(teamflowRoleName === 'Allenatore'
          ? 'Seleziona almeno una categoria (squadra) a cui abbinare l\'Allenatore nel tab Flowme (sezione TeamFlow).'
          : 'Seleziona almeno una categoria (squadra) a cui abbinare il Team Manager nel tab Flowme (sezione TeamFlow).')
        setActiveTab('flowme')
        return null
      }

      // Chiama la funzione di salvataggio del hook
      if (!validateLinkRelations()) {
        toast.error('Non puoi salvare finché non imposti la relazione per ogni contatto collegato inserito.')
        setActiveTab('personal')
        return null
      }

      const result = await handleSubmit(new Event('submit') as any)
      if (result !== null) {
        exitEditMode()
      }
      return result
    } catch (error) {
      console.error('Errore nel salvataggio:', error)
      toast.error('Errore nel salvataggio della persona')
      return null
    }
  }
  
  // Stato del form infortuni nel parent per sopravvivere ai remount
  const [showInjuryForm, setShowInjuryForm] = useState(false)
  // Carica sempre i ruoli staff all'avvio
  const loadInjuryActivityTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('injury_activity_types')
        .select('id, name, code, sort_order, active')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (!error && data?.length) {
        setInjuryActivityTypes(data as Array<{ id: string; name: string; code: string; sort_order: number; active: boolean }>)
      }
    } catch {
      // Tabella assente: lascia array vuoto, useremo fallback
    }
  }

  const getActivityTypeIcon = (code: string) => {
    const icons: Record<string, string> = {
      medical_visit: '🏥',
      visita_medica: '🏥',
      visita_specialistica: '🩺',
      physiotherapy: '💪',
      test: '🔬',
      spesa_esami_diagnostici: '🔬',
      note: '📝',
      annotazione: '📝',
      insurance_refund: '💰',
      insurance_communication: '📋',
      equipment_purchase: '🛒',
      acquisto_tutore: '🦴',
      expenses: '💸',
      other: '📋',
      altro: '📋',
    }
    return icons[code] || '📋'
  }

  const getActivityTypeAccent = (code: string) => {
    const c = (code || '').trim().toLowerCase()
    if (c === 'insurance_refund') return 'bg-green-50 text-green-700 border-green-200'
    if (c === 'insurance_communication' || c === 'note' || c === 'annotazione' || c === 'other' || c === 'altro') {
      return 'bg-gray-50 text-gray-700 border-gray-200'
    }
    if (
      c === 'physiotherapy' ||
      c === 'test' ||
      c === 'spesa_esami_diagnostici' ||
      c === 'equipment_purchase' ||
      c === 'acquisto_tutore' ||
      c === 'expenses'
    ) {
      return 'bg-red-50 text-red-700 border-red-200'
    }
    if (c === 'medical_visit' || c === 'visita_medica' || c === 'visita_specialistica') {
      return 'bg-sky-50 text-sky-700 border-sky-200'
    }
    return 'bg-gray-50 text-gray-700 border-gray-200'
  }

  useEffect(() => {
    loadStaffRoles()
    loadInjuryActivityTypes()
  }, [])

  // Imposta automaticamente il form come staff se il parametro staff=true ÃƒÂ¨ presente
  useEffect(() => {
    if (isStaff && !isEditing) {
      setForm(prev => ({
        ...prev,
        is_player: false,
        is_staff: true,
        player_categories: []
      }))
      // Imposta automaticamente il tab attivo su "staff"
      setActiveTab('staff')
    }
  }, [isStaff, isEditing, setForm])

  // Funzione per gestire il blur della data di nascita
  const handleBirthDateBlur = (birthDate: string) => {
    if (!birthDate) return
    
    const age = calculateAge(birthDate)
    const isMinorNow = age < 18
    
    console.log('Ã°Å¸Å½â€š Data nascita inserita:', { birthDate, age, isMinorNow })
    
    // Aggiorna stato isMinor
    setIsMinor(isMinorNow)
    
    // Mostra modal solo se:
    // 1. ÃƒË† minorenne
    // 2. Non ÃƒÂ¨ in modalitÃƒÂ  tutor
    // 3. Non ÃƒÂ¨ giÃƒÂ  un atleta esistente
    if (isMinorNow && !isTutor && !athleteId) {
      console.log('Ã°Å¸Å¡Â¨ Mostro modal tutor per minorenne')
      setShowTutorWarning(true)
    }
  }

  // Carica i ruoli staff esistenti quando si carica una persona
  useEffect(() => {
    if (currentEditId && !loading) {
      loadExistingStaffRoles()
    }
  }, [currentEditId, loading])

  // Controlla se ÃƒÂ¨ minorenne al caricamento e quando cambia la data di nascita
  // MA NON quando si crea un tutor
  useEffect(() => {
    // Se ÃƒÂ¨ in modalitÃƒÂ  creazione tutor, NON considerare minorenne
    if (isTutor || athleteId) {
      setIsMinor(false)
      return
    }
    
    if (form.date_of_birth) {
      const age = calculateAge(form.date_of_birth)
      const minor = age < 18
      
      // FORZA isMinor = false se l'etÃƒÂ  ÃƒÂ¨ chiaramente > 18
      const finalMinor = age >= 18 ? false : minor
      setIsMinor(finalMinor)
      
      // DEBUG: Log per verificare il calcolo
      console.log('Ã°Å¸â€Â DEBUG MINOR:', {
        date_of_birth: form.date_of_birth,
        calculated_age: age,
        is_minor: minor,
        final_minor: finalMinor,
        person_id: currentEditId
      })
    }
  }, [form.date_of_birth, isTutor, athleteId])

  // Controlla se ha tutor quando si carica la pagina
  useEffect(() => {
    if (currentEditId && !loading) {
      checkTutors()
    }
  }, [currentEditId, loading])

  // Popup automatico per atleti minorenni senza tutor - MA NON quando si crea un tutor
  useEffect(() => {
    // PRIORITÃƒâ‚¬ ASSOLUTA: Se ÃƒÂ¨ in modalitÃƒÂ  creazione tutor, NON mostrare mai il popup
    if (isTutor || athleteId) {
      setShowTutorWarning(false)
      return
    }
    
    // CONTROLLO ETA': Se l'etÃƒÂ  ÃƒÂ¨ >= 18, NON mostrare mai il popup
    if (form.date_of_birth) {
      const age = calculateAge(form.date_of_birth)
      if (age >= 18) {
        console.log('Ã°Å¸Å¡Â« POPUP DISABILITATO: Persona adulta (etÃƒÂ :', age, ')')
        setShowTutorWarning(false)
        return
      }
    }
    
    // Mostra popup SOLO se:
    // 1. ÃƒË† un atleta minorenne (etÃƒÂ  < 18)
    // 2. ÃƒË† in modalitÃƒÂ  modifica (editId presente) 
    // 3. NON ÃƒÂ¨ in modalitÃƒÂ  creazione tutor (isTutor = false)
    // 4. NON ha athleteId (non sta creando un tutor per un atleta)
    // 5. editId NON ÃƒÂ¨ uguale ad athleteId (per evitare confusione quando si caricano dati atleta per tutor)
    if (isMinor && editId && !loading && tutorsCheckComplete && !isTutor && !athleteId && editId !== athleteId) {
      if (hasTutors === false) {
        console.log('Ã¢Å“â€¦ POPUP ABILITATO: Minorenne senza tutor')
        setShowTutorWarning(true)
      } else if (hasTutors === true) {
        console.log('Ã°Å¸Å¡Â« POPUP DISABILITATO: Minorenne con tutor')
        setShowTutorWarning(false)
      }
    }
  }, [isMinor, editId, loading, tutorsCheckComplete, hasTutors, isTutor, athleteId, form.date_of_birth])

  // FORZA la disabilitazione del popup quando si crea un tutor
  useEffect(() => {
    if (isTutor || athleteId) {
      setShowTutorWarning(false)
    }
  }, [isTutor, athleteId])

  // Funzione per controllare se ha tutor
  const checkTutors = async () => {
    try {
      const { data, error } = await supabase
        .from('tutor_athlete_relations')
        .select('id')
        .eq('athlete_id', currentEditId)
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

  // Carica gli appuntamenti fisioterapia dove questa persona ÃƒÂ¨ operatore (per tab Fisio)
  const loadFisioAppointments = async () => {
    const fullName = `${form.given_name || ''} ${form.family_name || ''}`.trim()
    if (!fullName) {
      setFisioAppointments([])
      return
    }
    try {
      setLoadingFisioAppointments(true)
      const { data: activities, error: actError } = await supabase
        .from('injury_activities')
        .select('id, activity_date, ricontrollo, ricontrollo_time, injury_id')
        .eq('activity_type', 'physiotherapy')
        .eq('operator_name', fullName)
        .order('ricontrollo', { ascending: true, nullsFirst: false })
        .order('activity_date', { ascending: true })

      if (actError) throw actError
      if (!activities?.length) {
        setFisioAppointments([])
        setLoadingFisioAppointments(false)
        return
      }

      const injuryIds = [...new Set(activities.map((a: { injury_id: string }) => a.injury_id))]
      const { data: injuries, error: injError } = await supabase
        .from('injuries')
        .select('id, person_id')
        .in('id', injuryIds)
      if (injError) throw injError

      const personIds = [...new Set((injuries || []).map((i: { person_id: string }) => i.person_id))]
      const { data: people, error: peopleError } = await supabase
        .from('people')
        .select('id, full_name')
        .in('id', personIds)
      if (peopleError) throw peopleError

      const personMap = Object.fromEntries((people || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]))
      const injuryToPerson = Object.fromEntries((injuries || []).map((i: { id: string; person_id: string }) => [i.id, i.person_id]))

      const list = activities.map((a: { id: string; activity_date: string; ricontrollo: string | null; ricontrollo_time?: string | null; injury_id: string }) => ({
        ...a,
        ricontrollo_time: a.ricontrollo_time || null,
        playerName: personMap[injuryToPerson[a.injury_id]] || '—',
        date: a.ricontrollo || a.activity_date
      }))
      setFisioAppointments(list)
    } catch (error) {
      console.error('Errore nel caricamento appuntamenti Fisio:', error)
      setFisioAppointments([])
    } finally {
      setLoadingFisioAppointments(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'fisio' && isFisioterapista) loadFisioAppointments()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadFisioAppointments usa form da closure
  }, [activeTab, isFisioterapista, form.given_name, form.family_name])

  // Carica tutti gli impegni (fisioterapia e visite mediche) di tutti i medici/fisioterapisti
  const loadPlanningAppointments = async () => {
    try {
      setLoadingPlanning(true)
      const { data: activities, error: actError } = await supabase
        .from('injury_activities')
        .select('id, activity_date, ricontrollo, ricontrollo_time, duration_minutes, massaggio, tecar, laser, operator_name, activity_type, activity_description, injury_id')
        .in('activity_type', ['physiotherapy', 'medical_visit'])
        .not('ricontrollo', 'is', null)
        .order('ricontrollo', { ascending: true })
        .order('activity_date', { ascending: true })
      if (actError) throw actError
      if (!activities?.length) {
        setPlanningAppointments([])
        setLoadingPlanning(false)
        return
      }
      const injuryIds = [...new Set(activities.map((a: { injury_id: string }) => a.injury_id))]
      const { data: injuries, error: injError } = await supabase.from('injuries').select('id, person_id').in('id', injuryIds)
      if (injError) throw injError
      const personIds = [...new Set((injuries || []).map((i: { person_id: string }) => i.person_id))]
      const { data: people, error: peopleError } = await supabase.from('people').select('id, full_name').in('id', personIds)
      if (peopleError) throw peopleError
      const personMap = Object.fromEntries((people || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]))
      const injuryToPerson = Object.fromEntries((injuries || []).map((i: { id: string; person_id: string }) => [i.id, i.person_id]))
      const list = activities.map((a: { id: string; ricontrollo: string | null; ricontrollo_time?: string | null; duration_minutes?: number | null; massaggio?: boolean; tecar?: boolean; laser?: boolean; operator_name?: string | null; activity_type: string; activity_description?: string | null; injury_id: string }) => ({
        id: a.id,
        date: a.ricontrollo || '',
        ricontrollo_time: a.ricontrollo_time || null,
        duration_minutes: a.duration_minutes ?? null,
        massaggio: a.massaggio ?? false,
        tecar: a.tecar ?? false,
        laser: a.laser ?? false,
        playerName: personMap[injuryToPerson[a.injury_id]] || '—',
        operatorName: a.operator_name || '—',
        activityType: a.activity_type === 'medical_visit' ? 'Visita medica' : 'Fisioterapia',
        activity_description: a.activity_description ?? null
      }))
      setPlanningAppointments(list)
    } catch (e) {
      console.error('Errore caricamento planning:', e)
      setPlanningAppointments([])
    } finally {
      setLoadingPlanning(false)
    }
  }

  const openFisioPlanningModal = async () => {
    if (!selectedInjuryId) return
    setPlanningInjuryId(selectedInjuryId)
    setAddNewFisioInPlanning(false)
    setNewFisioForm({ date: '', time: '', duration_minutes: '', operator_name: '', activity_type: 'physiotherapy', massaggio: false, tecar: false, laser: false })
    try {
      const { data: injury } = await supabase.from('injuries').select('person_id').eq('id', selectedInjuryId).single()
      if (injury?.person_id) {
        const { data: person } = await supabase.from('people').select('full_name').eq('id', injury.person_id).single()
        setPlanningPlayerName(person?.full_name || '—')
      } else {
        setPlanningPlayerName('—')
      }
    } catch {
      setPlanningPlayerName('—')
    }
    setShowFisioPlanningModal(true)
    loadMedicalStaff()
    loadPlanningAppointments()
  }

  const closeFisioPlanningModal = () => {
    setShowFisioPlanningModal(false)
    setAddNewFisioInPlanning(false)
    setPlanningInjuryId(null)
    setPlanningPlayerName('')
    setPlanningAppointments([])
    setShowPlanningDeleteModal(false)
    setPlanningToDelete(null)
  }

  const deletePlanningAppointment = (apt: { id: string; activityType: string; playerName: string; date: string }) => {
    setPlanningToDelete({
      id: apt.id,
      label: `${apt.activityType} – ${apt.playerName} (${new Date(apt.date).toLocaleDateString('it-IT')})`
    })
    setShowPlanningDeleteModal(true)
  }

  const confirmDeletePlanningAppointment = async () => {
    if (!planningToDelete) return
    try {
      setDeletingPlanning(true)
      const { error } = await supabase.from('injury_activities').delete().eq('id', planningToDelete.id)
      if (error) throw error
      setShowPlanningDeleteModal(false)
      setPlanningToDelete(null)
      await loadPlanningAppointments()
      if (activeTab === 'fisio' && isFisioterapista) loadFisioAppointments()
      setInjuryRefreshTrigger(prev => prev + 1)
    } catch (e) {
      console.error('Errore eliminazione appuntamento:', e)
      alert('Errore durante l\'eliminazione: ' + (e as Error)?.message)
    } finally {
      setDeletingPlanning(false)
    }
  }

  const saveNewFisioFromPlanning = async () => {
    const operatorName = newFisioForm.operator_name?.trim()
    if (!planningInjuryId || !operatorName || !newFisioForm.date.trim()) {
      if (!operatorName) alert('Seleziona il fisioterapista o il medico.')
      return
    }
    if (!newFisioForm.time?.trim() || !/^\d{1,2}:\d{2}/.test(newFisioForm.time)) {
      alert('Inserisci l\'orario dell\'appuntamento.')
      return
    }
    const timeVal = newFisioForm.time.trim() || null
    const isPhysio = newFisioForm.activity_type === 'physiotherapy'
    if (isPhysio && !(newFisioForm.massaggio || newFisioForm.tecar || newFisioForm.laser)) {
      alert('Seleziona almeno un tipo di trattamento (Massaggio, Tecar o Laser).')
      return
    }
    const duration = newFisioForm.duration_minutes ? parseInt(newFisioForm.duration_minutes, 10) : null
    if (!duration || duration < 1) {
      alert('Inserisci il tempo di intervento (durata in minuti) per capire quale slot occupa l\'appuntamento.')
      return
    }
    try {
      setSavingNewFisio(true)
      let activity_description: string
      if (isPhysio) {
        const tipi = [newFisioForm.massaggio && 'Massaggio', newFisioForm.tecar && 'Tecar', newFisioForm.laser && 'Laser'].filter(Boolean) as string[]
        activity_description = tipi.length ? `Fisioterapia: ${tipi.join(', ')}` : 'Fisioterapia'
      } else {
        activity_description = 'Visita medica / Ricontrollo'
      }
      const row: Record<string, unknown> = {
        injury_id: planningInjuryId,
        activity_type: newFisioForm.activity_type,
        activity_description,
        activity_date: newFisioForm.date,
        ricontrollo: newFisioForm.date,
        ricontrollo_time: timeVal,
        duration_minutes: duration,
        operator_name: operatorName,
        massaggio: isPhysio ? newFisioForm.massaggio : false,
        tecar: isPhysio ? newFisioForm.tecar : false,
        laser: isPhysio ? newFisioForm.laser : false
      }
      const { error } = await supabase.from('injury_activities').insert(row)
      if (error) throw error
      setNewFisioForm({ date: '', time: '', duration_minutes: '', operator_name: '', activity_type: 'physiotherapy', massaggio: false, tecar: false, laser: false })
      setAddNewFisioInPlanning(false)
      await loadPlanningAppointments()
      if (activeTab === 'fisio' && isFisioterapista) loadFisioAppointments()
      setInjuryRefreshTrigger(prev => prev + 1)
    } catch (e) {
      console.error('Errore salvataggio nuova fisioterapia:', e)
      alert('Errore nel salvataggio: ' + (e as Error)?.message)
    } finally {
      setSavingNewFisio(false)
    }
  }

  // Minorenne calcolato da data di nascita (non dallo stato) cosÃ¬ i tab sono corretti anche al primo render
  const isMinorFromBirth = form.date_of_birth ? (calculateAge(form.date_of_birth) < 18) : false
  // Tab "Tutor" in scheda giocatore: mostralo per giocatori fino a 19 anni compresi (come da abbinamento tutor)
  const isPlayerUpTo19 = form.is_player && form.date_of_birth ? (calculateAge(form.date_of_birth) <= 19) : false
  const showTutorTabForPlayer = isPlayerUpTo19

  const tabs = [
    { id: 'personal', name: 'Informazioni Personali', icon: '👤' },
    // visibile solo se is_player = true
    { id: 'player', name: form.disqualified ? 'Giocatore 🔥' : 'Giocatore', icon: '⚽', hidden: !form.is_player },
    // Tab QUOTA: visibile solo se ÃƒÂ¨ un giocatore
    ...(form.is_player ? [{ id: 'fees', name: 'QUOTA', icon: '💰' }] : []),
    // Tutor solo se minorenne: SOLO card dei tutor/familiari di questo giocatore (TutorTab)
    ...(showTutorTabForPlayer ? [{ id: 'tutor', name: 'Tutor', icon: '👨‍👩‍👦‍👦' }] : []),
    // Tab Staff: NASCOSTO per minorenni (in scheda giocatore c'ÃƒÂ¨ solo il tab Tutor con le card dei SUOI tutor)
    { 
      id: 'staff', 
      name: isPersonFamiliare ? 'Famigliare' : (isPersonTutor ? 'Tutor' : 'Staff'), 
      icon: isPersonFamiliare ? '👨‍👩‍👦‍👦' : '👔', 
      hidden: (!form.is_staff && !isPersonTutor && !isPersonFamiliare) || isMinorFromBirth 
    },
    { id: 'documents', name: 'Documenti', icon: '📄' },
    { id: 'notes', name: 'Note', icon: '📝' },
    // Tab Fisio: impegni / prossime fisioterapie dove questa persona ÃƒÂ¨ operatore (solo se ruolo Fisioterapista)
    ...(isFisioterapista ? [{ id: 'fisio', name: 'Fisio', icon: '💪' }] : []),
    // Infortuni: visibile se ÃƒÂ¨ un giocatore OPPURE ha infortuni aperti (cosÃƒÂ¬ si vedono sempre gli infortuni)
    ...(form.is_player || form.injured ? [{
      id: 'injuries',
      name: 'Infermeria',
      icon: '🩹',
      badge: form.injured ? 'INFORTUNATO' : null
    }] : []),
    // FlowMe: accesso app, codice invito, sezioni visibili
    { id: 'flowme', name: 'TeamFlow / Flowme', icon: '📱' },
    // Corrispondenza: ultima sezione — chat a thread con la persona
    { id: 'correspondence', name: 'Corrispondenza', icon: '💬' }
  ]

  // Se l'utente ÃƒÂ¨ su una tab che diventa "hidden", riportalo su personal
  useEffect(() => {
    const current = tabs.find(t => t.id === activeTab)
    if (current?.hidden) setActiveTab('personal')

    // Se non ÃƒÂ¨ piÃƒÂ¹ fisioterapista e siamo nel tab Fisio, torna al tab personal
    if (activeTab === 'fisio' && !isFisioterapista) setActiveTab('personal')
    
    // Se non ÃƒÂ¨ piÃƒÂ¹ un giocatore e siamo nel tab infortuni o quote, torna al tab personal
    // MA solo se NON c'ÃƒÂ¨ un parametro tab nell'URL (in quel caso rispettiamo la richiesta)
    if (!form.is_player && !form.injured && activeTab === 'injuries' && !tabParam) {
      setActiveTab('personal')
    }
    if (!form.is_player && activeTab === 'fees' && !tabParam) {
      setActiveTab('personal')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.is_player, form.injured, isFisioterapista])

  // Funzione per renderizzare il tab Staff/Famigliare
  const renderStaffTab = () => {
    // Se la persona ÃƒÂ¨ minorenne (da data di nascita) mostra SOLO le card dei tutor collegati a questo giocatore. Mai "Giocatori minorenni" / "Dati Tutor"
    if (isMinorFromBirth) {
      return (
        <TutorTab
          athleteId={currentEditId || ''}
          athleteName={`${form.given_name || ''} ${form.family_name || ''}`.trim() || 'Atleta'}
          isMinor={true}
          onTutorAdded={handleTutorAdded}
          onOpenCreatePerson={(isTutor, athleteId) => {
            if (isTutor && athleteId) window.open(`/create-person?tutor=true&athleteId=${athleteId}`, '_blank')
          }}
          onEditTutor={(tutorId) => navigate(`/create-person?edit=${tutorId}&fromAthlete=${currentEditId}&returnTab=tutor`)}
        />
      )
    }
    // Se è un familiare, mostra i giocatori collegati
    if (isPersonFamiliare) {
      console.log('Ã°Å¸â€Â RENDERIZZAZIONE TAB FAMIGLIARE:', { currentEditId, guardianRelationships })
      
      return (
        <div className="space-y-6">
          {/* Componente GuardiansTab per mostrare i giocatori collegati */}
                {currentEditId || guardianRelationships.length > 0 ? (
                  <>
                    {console.log('Ã°Å¸â€Â RENDERING GUARDIANS TAB:', { currentEditId, guardianRelationships: guardianRelationships.length })}
                    <GuardiansTab
                      guardianId={currentEditId || ''}
                      isEditing={true}
                      initialRelationships={guardianRelationships}
                      onRelationshipsChange={(relationships) => {
                        setGuardianRelationships(relationships)
                        setHasConnectedPlayers(relationships.length > 0)
                      }}
                    />
                  </>
                ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <p className="text-amber-900 font-medium mb-2">
                Collegamento a uno o più giocatori
              </p>
              <p className="text-sm text-amber-800">
                Salva prima la scheda (pulsante Modifica/Salva in basso). Poi in questa scheda comparirà «Nuovo collegamento» per scegliere i giocatori da associare.
              </p>
            </div>
          )}
        </div>
      )
    }

    // Se è un tutor, stesso stile del tab Famigliare: tabella Giocatori Collegati
    if (isPersonTutor) {
      const tutorRelations = (form.tutor_athlete_relations?.length ? form.tutor_athlete_relations : (form.tutor_athlete_ids || []).map((aid: string) => ({ athlete_id: aid, relationship: 'Tutore' }))) as { athlete_id: string; relationship: string }[]
      const tutorMinorsList = tutorRelations.map((rel) => {
        const person = athletesDataList.find((a: { id: string }) => a.id === rel.athlete_id)
        const categoryIds = person?.player_categories || []
        const categoryLabels = categoryIds.map((id: string) => categories.find((c: { id: string }) => c.id === id)?.code || categories.find((c: { id: string }) => c.id === id)?.name || id).join(', ')
        const birth = person?.date_of_birth
        const age = birth ? (() => {
          const today = new Date()
          const b = new Date(birth)
          let a = today.getFullYear() - b.getFullYear()
          if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) a--
          return a
        })() : null
        return {
          athlete_id: rel.athlete_id,
          relationship: rel.relationship || 'Tutore',
          name: person ? (person.given_name && person.family_name ? `${person.family_name} ${person.given_name}` : (person.full_name || [person.given_name, person.family_name].filter(Boolean).join(' '))) : rel.athlete_id,
          categoryLabels: categoryLabels || '-',
          age
        }
      })
      return (
        <div className="space-y-6">
          {/* Giocatori collegati - stesso stile del tab Famigliare */}
          <div className="mb-6">
            <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Giocatori Collegati</h2>
              <button
                type="button"
                onClick={() => setShowTutorMinorsModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Nuovo collegamento
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Persone di cui questa persona è tutor o riferimento (giocatori fino a 19 anni compresi).</p>
            {tutorMinorsList.length > 0 ? (
              <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NOME</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PARENTELA</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CATEGORIA</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ETÀ</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">AZIONI</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tutorMinorsList.map((item) => (
                      <tr key={item.athlete_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={item.relationship}
                            onChange={(e) => {
                              const next = tutorRelations.map((r) =>
                                r.athlete_id === item.athlete_id ? { athlete_id: r.athlete_id, relationship: e.target.value } : { athlete_id: r.athlete_id, relationship: r.relationship }
                              )
                              handleInputChange('tutor_athlete_relations', next)
                              handleInputChange('tutor_athlete_ids', next.map((x: { athlete_id: string }) => x.athlete_id))
                            }}
                            className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border-0 cursor-pointer focus:ring-2 focus:ring-blue-500"
                          >
                            {TUTOR_RELATIONSHIP_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{item.categoryLabels}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{item.age != null ? `${item.age} anni` : '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            type="button"
                            onClick={() => navigate(`/create-person?edit=${item.athlete_id}&tab=personal`, { replace: false })}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Vai al Giocatore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="mt-2 text-gray-500">Nessun giocatore collegato</p>
                  <p className="text-sm text-gray-400">Clicca su &quot;Nuovo collegamento&quot; per aggiungere un giocatore</p>
                </div>
              </div>
            )}
          </div>

          {/* Dati Professionali (sezione secondaria) */}
          <details className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <summary className="px-6 py-4 cursor-pointer text-lg font-semibold text-gray-900 hover:bg-gray-50">Dati Tutor (professione, contatti)</summary>
          <div className="px-6 pb-6 pt-2 border-t border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dati Professionali</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Professione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Professione
                </label>
                <input
                  type="text"
                  value={form.profession || ''}
                  onChange={(e) => handleInputChange('profession', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Inserisci la professione"
                />
              </div>

              {/* Categoria Professionale */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria Professionale
                </label>
                <select
                  value={form.professional_category || ''}
                  onChange={(e) => handleInputChange('professional_category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona categoria</option>
                  <option value="imprenditore">Imprenditore</option>
                  <option value="dirigente">Dirigente</option>
                  <option value="quadro">Quadro</option>
                  <option value="impiegato">Impiegato</option>
                  <option value="operaio">Operaio</option>
                  <option value="libero_professionista">Libero Professionista</option>
                  <option value="pensionato">Pensionato</option>
                  <option value="disoccupato">Disoccupato</option>
                  <option value="studente">Studente</option>
                  <option value="altro">Altro</option>
                </select>
              </div>

              {/* Azienda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Azienda
                </label>
                <input
                  type="text"
                  value={form.company || ''}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome dell'azienda"
                />
              </div>

              {/* Posizione/Ruolo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Posizione/Ruolo
                </label>
                <input
                  type="text"
                  value={form.position || ''}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Posizione ricoperta"
                />
              </div>
            </div>
          </div>

          {/* Contatti */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contatti</h3>
            <div className="space-y-4">
              {/* Contatto Principale */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="primary_contact"
                  checked={form.primary_contact || false}
                  onChange={(e) => handleInputChange('primary_contact', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="primary_contact" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Contatto Principale
                </label>
              </div>
            </div>
          </div>

          {/* Potenziale Commerciale */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Potenziale Commerciale</h3>
            <div className="space-y-4">
              {/* Possibile Sponsor */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="possible_sponsor"
                  checked={form.possible_sponsor || false}
                  onChange={(e) => handleInputChange('possible_sponsor', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="possible_sponsor" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Possibile Sponsor
                </label>
              </div>

              {/* Utile al Club */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="useful_to_club"
                  checked={form.useful_to_club || false}
                  onChange={(e) => handleInputChange('useful_to_club', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="useful_to_club" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Utile al Club
                </label>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Note</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note aggiuntive
              </label>
              <textarea
                value={form.tutor_notes || ''}
                onChange={(e) => handleInputChange('tutor_notes', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Note aggiuntive sul tutor..."
              />
            </div>
          </div>
          </details>
        </div>
      )
    }

    // Se non ÃƒÂ¨ un tutor, mostra il tab staff normale
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Ruoli Staff</h2>
        </div>

        {/* Ruoli e Categorie selezionati - Mostra in evidenza */}
        {form.staff_roles.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex flex-wrap gap-3">
              {/* Ruoli selezionati */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-700">Ruolo:</span>
                {(() => {
                  const seen = new Set<string>()
                  const chips: { key: string; name: string }[] = []
                  for (const role of form.staff_roles) {
                    if (role === 'tutor' || findStaffRoleByRef(role, staffRoles)?.name === 'Tutor') {
                      if (seen.has('tutor')) continue
                      seen.add('tutor')
                      chips.push({ key: 'tutor', name: 'Tutor' })
                      continue
                    }
                    const found = findStaffRoleByRef(role, staffRoles)
                    const key = found?.id || role
                    const name = found?.name || role
                    if (seen.has(key) || seen.has(normStaffRoleKey(name))) continue
                    seen.add(key)
                    seen.add(normStaffRoleKey(name))
                    chips.push({ key, name })
                  }
                  return chips.map((chip) => (
                    <div
                      key={chip.key}
                      className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm"
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {chip.name}
                    </div>
                  ))
                })()}
              </div>
              
              {/* Categorie selezionate - Non mostrare per Tutor */}
              {form.staff_categories.length > 0 && !hasTutorRole && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-green-700">Categoria:</span>
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
              )}
            </div>
          </div>
        )}

        {/* Ruoli Staff - Mostra checkbox solo in modalitÃƒÂ  modifica */}
        {isEditMode && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Ruolo Tutor (stringa) - unica checkbox Tutor, escludiamo Tutor da staffRoles per evitare duplicati */}
              <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  id="staff-role-tutor"
                  checked={form.staff_roles.includes('tutor') || form.staff_roles.some((rid: string) => staffRoles.find(r => r.id === rid)?.name === 'Tutor')}
                  onChange={(e) => {
                    const otherRoles = form.staff_roles.filter((rid: string) => rid !== 'tutor' && staffRoles.find(r => r.id === rid)?.name !== 'Tutor')
                    if (e.target.checked) {
                      handleInputChange('staff_roles', [...otherRoles, 'tutor'])
                    } else {
                      handleInputChange('staff_roles', otherRoles)
                    }
                  }}
                  disabled={isTutor} // Disabilita se si sta creando un tutor
                  className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${isTutor ? 'cursor-default' : 'cursor-pointer'}`}
                />
                <label 
                  htmlFor="staff-role-tutor"
                  className={`flex-1 text-sm font-medium text-gray-700 ${isTutor ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  Tutor
                </label>
              </div>
              
              {/* Altri ruoli staff (con ID) - escludi Tutor per evitare duplicato con checkbox dedicata sopra */}
              {staffRoles.filter(r => r.name !== 'Tutor' && r.id !== 'tutor').map((role) => (
                <div key={role.id} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    id={`staff-role-${role.id}`}
                    checked={isStaffRoleSelected(form.staff_roles, role)}
                    onChange={(e) => {
                      handleInputChange(
                        'staff_roles',
                        toggleStaffRoleSelection(form.staff_roles, role, e.target.checked),
                      )
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
        )}
                  
        {/* Messaggio se nessun ruolo selezionato - Solo in modalitÃƒÂ  modifica */}
        {form.staff_roles.length === 0 && isEditMode && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p>Seleziona i ruoli staff per questa persona</p>
          </div>
        )}


        {/* Categorie Staff - Mostra solo se ci sono ruoli staff che richiedono categorie E si ÃƒÂ¨ in modalitÃƒÂ  modifica */}
        {form.staff_roles.length > 0 && hasStaffRolesRequiringCategories() && isEditMode && (
          <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Categorie Staff</h3>
            <p className="text-sm text-gray-600 mb-4">
              Squadre dove opera come staff (allenatore, TM, …). Sono queste che compaiono nelle colonne di Incontro Staff — non le categorie del tab Giocatore.
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
            
          </div>
        )}
      </div>
    )
  }

  // Tab Note: usa NotesTab (logica spostata in componente)
  const renderNotesTabContent = () => (
      <NotesTab
        personId={currentEditId || ''}
        addFormOpen={showAddNoteForm}
        onAddFormClose={() => setShowAddNoteForm(false)}
        onNotesChange={setNotesForFees}
        onFilteredNotesChange={(filteredCount, totalCount) => {
          setFilteredNotesCount(filteredCount)
          setTotalNotesCount(totalCount)
        }}
        refreshTrigger={notesRefreshTrigger}
      />
  )

  // Tab Fisio: elenco appuntamenti (prossime fisioterapie) dove questa persona ÃƒÂ¨ operatore
  const renderFisioTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ã°Å¸â€™Âª Impegni Fisioterapia</h3>
          <p className="text-sm text-gray-500 mb-4">
            Appuntamenti fissati con i giocatori (prossime sedute). Controlla gli spazi occupati per evitare accavallamenti.
          </p>
          {loadingFisioAppointments ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500" />
            </div>
          ) : fisioAppointments.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <span className="text-4xl">Ã°Å¸â€œâ€¦</span>
              <p className="mt-2 font-medium">Nessun appuntamento</p>
              <p className="text-sm">Le prossime fisioterapie dove sei indicato come operatore appariranno qui.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Giocatore</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {fisioAppointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-pink-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {new Date(apt.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {apt.ricontrollo_time && (
                          <span className="ml-1 text-gray-600">
                            {String(apt.ricontrollo_time).slice(0, 5)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{apt.playerName}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                          Prossima fisioterapia
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  const getCategoryDisplayName = (cat: { name?: string; code?: string }) => {
    const raw = cat?.name ?? cat?.code ?? ''
    return (typeof raw === 'string' && raw.toUpperCase() === 'SENIOR') ? 'Seniores' : raw
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
                    {getCategoryDisplayName(category)}
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
                    {getPositionDisplayName(role.name)}
                  </div>
                ) : null
              })}
              
              {/* Card Squalificato */}
              {form.disqualified && (
                <div className="inline-flex items-center bg-red-100 text-red-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  SQUALIFICATO
                </div>
              )}
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
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900 transition-colors"
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
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900 transition-colors"
                    />
                  </div>

                  {/* Infortunato e Squalificato sulla stessa riga */}
                  <div className="md:col-span-5 flex flex-wrap items-end gap-6">
                    {/* Stato Infortunio (primo) */}
                    <div>
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
                    {/* Squalificato (secondo) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Squalificato
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={form.disqualified || false}
                          onChange={(e) => handleInputChange('disqualified', e.target.checked)}
                          disabled={isFieldDisabled()}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">Giocatore squalificato</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Data Scadenza Squalifica - Visibile solo se squalificato */}
                  {form.disqualified && (
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data Scadenza Squalifica
                      </label>
                      <input
                        type="date"
                        value={form.disqualification_end_date || ''}
                        onChange={(e) => handleInputChange('disqualification_end_date', e.target.value)}
                        disabled={isFieldDisabled()}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500 transition-colors"
                      />
                    </div>
                  )}
                  
                  {/* Note Squalifica - Visibile solo se squalificato */}
                  {form.disqualified && (
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Note Squalifica</label>
                      <input
                        type="text"
                        value={form.disqualification_notes || ''}
                        onChange={(e) => handleInputChange('disqualification_notes', e.target.value)}
                        disabled={isFieldDisabled()}
                        placeholder="Motivo squalifica..."
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500 transition-colors"
                      />
                    </div>
                  )}
                  
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
                  <span>Squadra: {form.player_categories?.length && categories.length ? (categories.find(c => c.id === form.player_categories[0])?.name ?? '—') : '—'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{lastTrainingDaysAgo != null ? (lastTrainingDaysAgo === 0 ? 'Ultimo allenamento: oggi' : lastTrainingDaysAgo === 1 ? 'Ultimo allenamento: 1 giorno fa' : `Ultimo allenamento: ${lastTrainingDaysAgo} giorni fa`) : '—'}</span>
                </div>
              </div>
            </div>

            {/* Grid delle statistiche migliorato - dati reali */}
            {loadingPlayerStats ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-gray-100 p-4 rounded-xl animate-pulse h-32" />
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Partite */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-blue-700 mb-1">{playerStats != null ? playerStats.partite : '—'}</div>
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
                </div>
                <div className="text-3xl font-bold text-green-700 mb-1">{playerStats != null ? playerStats.minuti.toLocaleString('it-IT') : '—'}</div>
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
                </div>
                <div className="text-3xl font-bold text-yellow-700 mb-1">{playerStats != null ? playerStats.mete : '—'}</div>
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
                </div>
                <div className="text-3xl font-bold text-purple-700 mb-1">{playerStats != null ? playerStats.punti : '—'}</div>
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
                  {playerStats && playerStats.sessioniTotali > 0 && (
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-200 px-2 py-1 rounded-full">
                      {Math.round((playerStats.presenze / playerStats.sessioniTotali) * 100)}% presenza
                    </span>
                  )}
                </div>
                <div className="text-3xl font-bold text-indigo-700 mb-1">
                  {playerStats != null ? `${playerStats.presenze}/${playerStats.sessioniTotali || 0}` : '—'}
                </div>
                <div className="text-sm font-medium text-indigo-600">Presenze</div>
              </div>

              {/* Infermeria */}
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-red-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-red-500 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  {lastInjury && (
                    <span className="text-xs font-medium text-red-600 bg-red-200 px-2 py-1 rounded-full">
                      Stato: {lastInjury.is_closed ? 'Recuperato' : 'In corso'}
                    </span>
                  )}
                </div>
                <div className="text-3xl font-bold text-red-700 mb-1">{playerStats != null ? playerStats.infortuni : '—'}</div>
                <div className="text-sm font-medium text-red-600">Infermeria</div>
                {lastInjury?.injury_date && (() => {
                  const months = Math.floor((Date.now() - new Date(lastInjury.injury_date).getTime()) / (1000 * 60 * 60 * 24 * 30))
                  return <div className="text-xs text-red-500 mt-1 font-medium">Ultimo: {months === 0 ? 'questo mese' : months === 1 ? '1 mese fa' : `${months} mesi fa`}</div>
                })()}
              </div>
            </div>
            )}
            
            {/* Card Stato forma + Società di origine sulla stessa riga */}
            <div className="mt-6 flex flex-col md:flex-row gap-4">
              {/* Card Stato forma */}
              <div className="flex-1 min-w-0 p-4 rounded-xl border bg-gradient-to-r from-green-50 to-blue-50 border-green-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${form.injured ? 'bg-red-500' : 'bg-green-500'}`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {form.injured ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        )}
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-gray-900">Stato Forma</h4>
                      <p className={`text-sm truncate ${form.injured ? 'text-red-600' : 'text-gray-600'}`}>
                        {form.injured 
                          ? 'Infortunato - Non disponibile per la competizione' 
                          : 'Ottimo - Pronto per la competizione'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`w-3 h-3 rounded-full ${form.injured ? 'bg-red-500' : 'bg-green-500'} ${form.injured ? 'animate-bounce' : 'animate-pulse'}`}></div>
                    <span className={`text-sm font-medium ${form.injured ? 'text-red-700' : 'text-green-700'}`}>
                      {form.injured ? 'Infortunato' : 'Attivo'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Società di origine */}
              <div className="flex-1 min-w-0 p-4 rounded-xl border bg-gradient-to-r from-slate-50 to-blue-50/50 border-blue-200/60 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shrink-0 bg-blue-500/10 border border-blue-200/80">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900">Società di origine</h4>
                    <p className="text-sm text-gray-700 font-medium truncate">
                      {form.origin_club?.trim() ? form.origin_club.trim() : '—'}
                    </p>
                  </div>
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
                    <span className="text-sm text-gray-700">{getCategoryDisplayName(category)}</span>
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
                    <span className="text-sm text-gray-700">{getPositionDisplayName(position.name)}</span>
                    </label>
                        ))}
                      </div>
                    </div>

            {/* Società di rugby - autocomplete da tabella origin_clubs */}
            <div className="border-t pt-6">
              <h3 className="text-md font-medium text-gray-900 mb-2">Società di Rugby</h3>
              <div className="flex items-center gap-2">
                <div ref={originClubDropdownRef} className="relative max-w-xs flex-1">
                  <input
                  type="text"
                  value={form.origin_club || ''}
                  onChange={(e) => {
                    handleInputChange('origin_club', e.target.value)
                    setOriginClubDropdownOpen(true)
                    setOriginClubHighlightedIndex(0)
                  }}
                  onFocus={() => {
                    setOriginClubDropdownOpen(true)
                    setOriginClubHighlightedIndex(0)
                  }}
                  onBlur={() => setTimeout(() => setOriginClubDropdownOpen(false), 150)}
                  onKeyDown={(e) => {
                    const q = (form.origin_club || '').trim()
                    const filtered = originClubsList
                      .filter((c) => (q ? c.name.toLowerCase().includes(q.toLowerCase()) : true))
                      .slice(0, 20)
                    if (!originClubDropdownOpen || filtered.length === 0) {
                      if (e.key === 'Escape') setOriginClubDropdownOpen(false)
                      return
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setOriginClubHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1))
                      return
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setOriginClubHighlightedIndex((i) => Math.max(0, i - 1))
                      return
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const club = filtered[originClubHighlightedIndex]
                      if (club) {
                        handleInputChange('origin_club', club.name)
                        setOriginClubDropdownOpen(false)
                        setOriginClubHighlightedIndex(0)
                      }
                      return
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setOriginClubDropdownOpen(false)
                    }
                  }}
                  disabled={isFieldDisabled()}
                  placeholder="Cerca società..."
                  className="w-full max-w-xs px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
                  />
                  {originClubDropdownOpen && !isFieldDisabled() && (() => {
                  const q = (form.origin_club || '').trim()
                  const filtered = originClubsList
                    .filter((c) => (q ? c.name.toLowerCase().includes(q.toLowerCase()) : true))
                    .slice(0, 20)
                  const safeIndex = Math.min(Math.max(0, originClubHighlightedIndex), Math.max(0, filtered.length - 1))
                  return (
                    <ul className="absolute z-50 mt-1 w-full max-w-xs max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                      {filtered.map((club, idx) => (
                        <li key={club.id}>
                          <button
                            type="button"
                            ref={(el) => { if (idx === safeIndex && el) el.scrollIntoView({ block: 'nearest' }) }}
                            className={`w-full text-left px-3 py-2 text-sm focus:outline-none ${idx === safeIndex ? 'bg-blue-100 text-gray-900' : 'text-gray-900 hover:bg-blue-50'}`}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleInputChange('origin_club', club.name)
                              setOriginClubDropdownOpen(false)
                              setOriginClubHighlightedIndex(0)
                            }}
                          >
                            {club.name}
                          </button>
                        </li>
                      ))}
                      {filtered.length === 0 && (
                        <li className="px-3 py-2 text-sm text-gray-500">Nessuna società trovata</li>
                      )}
                    </ul>
                  )
                })()}
                </div>
                {!isFieldDisabled() && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewOriginClubName('')
                      setShowAddOriginClubModal(true)
                    }}
                    className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border-2 border-teal-500 text-teal-600 hover:bg-teal-50 transition-colors"
                    title="Aggiungi nuova società di origine"
                  >
                    +
                  </button>
                )}
              </div>
            </div>

            {/* Modal aggiungi società di origine */}
            {showAddOriginClubModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !addOriginClubLoading && setShowAddOriginClubModal(false)}>
                <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Nuova società di origine</h3>
                  <input
                    type="text"
                    value={newOriginClubName}
                    onChange={e => setNewOriginClubName(e.target.value)}
                    placeholder="Nome società"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 mb-4 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.preventDefault()
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => !addOriginClubLoading && setShowAddOriginClubModal(false)}
                      className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      disabled={addOriginClubLoading || !newOriginClubName.trim()}
                      onClick={async () => {
                        const name = newOriginClubName.trim()
                        if (!name) return
                        if (
                          originClubsList.some(
                            (c) => c.name.localeCompare(name, 'it', { sensitivity: 'base' }) === 0
                          )
                        ) {
                          toast.error('Esiste già una società con questo nome')
                          return
                        }
                        setAddOriginClubLoading(true)
                        try {
                          const { data, error } = await supabase
                            .from('origin_clubs')
                            .insert({ name, sort_order: originClubsList.length + 1 })
                            .select('id, name')
                            .single()
                          if (error) throw error
                          await loadOriginClubs()
                          handleInputChange('origin_club', data.name)
                          setShowAddOriginClubModal(false)
                          setNewOriginClubName('')
                          toast.success('Società aggiunta')
                        } catch (err: any) {
                          if (err?.code === '23505') toast.error('Questa società è già presente')
                          else toast.error(err?.message || 'Errore nel salvataggio')
                        } finally {
                          setAddOriginClubLoading(false)
                        }
                      }}
                      className="flex-1 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addOriginClubLoading ? 'Salvataggio...' : 'Aggiungi'}
                    </button>
                  </div>
                </div>
              </div>
            )}
                  
          </>
                  )}
                </div>
    )
  }

  // In edit: hasPersonData serve per key del PersonalInfoTab (evita campi vuoti dopo caricamento)
  const hasPersonDataForKey = !!(form.given_name || form.family_name || form.full_name)
  // Pannelli delle tab - sempre montati per evitare remount
  const TabPanels: Record<string, React.ReactNode> = {
    personal: (
      <PersonalInfoTab
        key={currentEditId ? `person-${currentEditId}-${hasPersonDataForKey}` : 'new-person'}
        form={form}
        handleInputChange={handleInputChange}
        isFieldDisabled={isFieldDisabled}
        isTutor={isPersonTutor}
        isPlayer={!!form.is_player}
        personId={currentEditId}
        availableRoles={availableRoles}
        onBirthDateBlur={handleBirthDateBlur}
        onEmailBlur={handleEmailBlur}
        linkRelationErrorIds={linkRelationErrorIds}
        onClearLinkRelationError={clearLinkRelationError}
      />
    ),
    player: renderPlayerTab(),
    staff: renderStaffTab(),
    documents: (
      <DocumentsTab
        form={form}
        handleInputChange={handleInputChange}
        isFieldDisabled={isFieldDisabled}
        personId={currentEditId}
      />
    ),
    notes: renderNotesTabContent(),
    fisio: renderFisioTab(),
    flowme: (
      <FlowmeTab
        form={form}
        handleInputChange={handleInputChange}
        isFieldDisabled={isFieldDisabled}
        availableRoles={availableRoles}
        allCategories={categories}
        onGoToTutorTab={() => setActiveTab('staff')}
      />
    ),
    correspondence: (
      <CorrespondenceTab
        personId={currentEditId || form.id}
        personName={`${form.given_name || ''} ${form.family_name || ''}`.trim() || form.full_name || ''}
        initialThreadId={threadParam}
      />
    ),
    injuries: (
      <MemoInjuriesTab
        personId={currentEditId || ''}
        canEdit={Boolean(currentEditId && (form.is_player || form.injured))}
        onNoteAdded={() => setNotesRefreshTrigger(prev => prev + 1)}
        onAddInjury={() => openInjuryModal(null)}
        onOpenInjuryModal={openInjuryModal}
        onOpenDeleteModal={openDeleteModal}
        onOpenActivityForm={openActivityForm}
        onOpenActivityFormWithType={openActivityFormWithType}
        onOpenDeleteActivityModal={openDeleteActivityModal}
        onOpenEditActivityForm={openEditActivityForm}
        refreshTrigger={injuryRefreshTrigger}
        playerDisplayName={[form.given_name, form.family_name].filter(Boolean).join(' ').trim() || undefined}
        csenCard={form.csen_card?.trim() || undefined}
        csenCardIssuedAt={form.csen_card_issued_at?.trim() || undefined}
        isTabActive={activeTab === 'injuries'}
        onInjuryCreated={async () => {
          // Controlla se ci sono infortuni aperti per questo giocatore
          if (currentEditId) {
            try {
              const { data: openInjuries } = await supabase
                .from('injuries')
                .select('id')
                .eq('person_id', currentEditId)
                .eq('is_closed', false)
              
              const hasOpenInjuries = openInjuries && openInjuries.length > 0
              
              // Aggiorna lo stato injured basato sulla presenza di infortuni aperti
              setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
              await saveInjuredStatus(currentEditId, hasOpenInjuries)
            } catch (error) {
              // Fallback: se i campi is_closed non esistono ancora, usa current_status
              console.warn('Campi is_closed non disponibili, uso current_status come fallback')
              const { data: injuries } = await supabase
                .from('injuries')
                .select('id, current_status')
                .eq('person_id', currentEditId)
              
              const hasOpenInjuries = injuries && injuries.some(injury => injury.current_status === 'In corso')
              setForm(prev => ({ ...prev, injured: hasOpenInjuries }))
              await saveInjuredStatus(currentEditId, hasOpenInjuries)
            }
          }
        }}
      />
    ),
    tutor: (
      <TutorTab
        athleteId={currentEditId || ''}
        athleteName={`${form.given_name || ''} ${form.family_name || ''}`.trim() || 'Atleta'}
        isMinor={isMinor}
        onTutorAdded={handleTutorAdded}
        onOpenCreatePerson={(isTutor, athleteId) => {
          console.log('Ã°Å¸â€Â onOpenCreatePerson chiamato:', { isTutor, athleteId })
          if (isTutor && athleteId) {
            // Apri una nuova scheda per il form di creazione tutor
            console.log('Ã°Å¸â€Â NUOVA SCHEDA TUTOR - Aprendo finestra:', `/create-person?tutor=true&athleteId=${athleteId}`)
            window.open(`/create-person?tutor=true&athleteId=${athleteId}`, '_blank')
          }
        }}
        onEditTutor={(tutorId) => {
          // Apri la scheda completa del tutor; dopo salvataggio/Indietro si torna al giocatore
          navigate(`/create-person?edit=${tutorId}&fromAthlete=${currentEditId}&returnTab=tutor`)
        }}
      />
    ),
    fees: currentEditId ? (
      <FeesTab
        personId={currentEditId}
        playerCategories={form.player_categories || []}
        categories={categories}
        notesForFees={notesForFees}
        isPlayer={!!form.is_player}
        onFormUpdate={(patch) => setForm(prev => ({ ...prev, ...patch }))}
      />
    ) : (
      <div className="text-gray-500 py-8">Salva la persona per gestire le quote.</div>
    ),
  }

  // In edit: mostra loading finchÃƒÂ© non abbiamo Nome o Cognome (evita form vuoto)
  const hasPersonData = !!(form.given_name || form.family_name || form.full_name)
  const showForm = !loading && (!isEditing || hasPersonData)
  if (!showForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  const isInactive = (form.status || '').toLowerCase() === 'inactive' || (form.status || '').toLowerCase() === 'inattivo'
  return (
    <div className={embedInLayout ? `min-h-full ${isInactive ? 'bg-red-50' : 'bg-gray-50'}` : `min-h-screen ${isInactive ? 'bg-red-50' : 'bg-gray-50'}`}>
      {!embedInLayout && (
      <Header 
        title={
          isEditing ? `${form.given_name} ${form.family_name}`.trim() || form.full_name || "Modifica Persona" :
          isTutor ? "Nuovo Tutor" : 
          isStaff || form.is_staff ? "Nuovo Staff" : 
          form.is_player ? "Nuovo Giocatore" : 
          "Anagrafica"
        } 
        hideCenterLogo={true}
        badges={isEditing ? (
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            {/* Ruoli Staff */}
            {form.staff_roles && form.staff_roles.length > 0 && (
              <div className="flex items-center gap-2">
                {/* Mostra "Staff:" solo se non ÃƒÂ¨ solo Tutor */}
                {!(form.staff_roles.length === 1 && form.staff_roles.includes('tutor')) && (
                  <span className="text-white/80 font-medium">Staff:</span>
                )}
                {form.staff_roles.map(role => {
                  let roleName = ''
                  if (role === 'tutor') {
                    roleName = 'Tutor'
                  } else {
                    const foundRole = staffRoles.find(r => r.id === role)
                    roleName = foundRole ? foundRole.name : role
                  }
                  return (
                    <span key={role} className="text-white font-semibold">
                      {roleName}
                    </span>
                  )
                })}
              </div>
            )}
            
            {/* Categorie Staff - Non mostrare per Tutor */}
            {form.staff_categories && form.staff_categories.length > 0 && !hasTutorRole && (
              <div className="flex items-center gap-2">
                <span className="text-white/80 font-medium">Categorie:</span>
                {form.staff_categories.map(categoryId => {
                  const category = categories.find(c => c.id === categoryId)
                  return category ? (
                    <span key={categoryId} className="text-white font-semibold">
                      {category.code}
                    </span>
                  ) : null
                })}
              </div>
            )}
            
            {/* Separatore se ci sono sia dati staff che giocatore */}
            {((form.staff_roles && form.staff_roles.length > 0) || (form.staff_categories && form.staff_categories.length > 0 && !hasTutorRole)) && 
             ((form.player_categories && form.player_categories.length > 0) || (form.player_positions && form.player_positions.length > 0)) && (
              <span className="text-white/40 text-sm">•</span>
            )}
            
            {/* Categorie Giocatore */}
            {form.player_categories && form.player_categories.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-white/80 font-medium">Giocatore:</span>
                {form.player_categories.map(categoryId => {
                  const category = categories.find(c => c.id === categoryId)
                  return category ? (
                    <span key={categoryId} className="text-white font-semibold">
                      {getCategoryDisplayName(category)}
                    </span>
                  ) : null
                })}
              </div>
            )}
            
            {/* Posizioni Giocatore */}
            {form.player_positions && form.player_positions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-white/80 font-medium">Posizioni:</span>
                {form.player_positions.map(positionId => {
                  const position = playerPositions.find(p => p.id === positionId)
                  return position ? (
                    <span key={positionId} className="text-white font-semibold">
                      {getPositionDisplayName(position.name)}
                    </span>
                  ) : null
                })}
              </div>
            )}
          </div>
        ) : undefined}
        showBack={true}
        rightButton={isEditing ? (
          <button
            onClick={() => setShowPdfModal(true)}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            title="Genera scheda PDF"
          >
            <FileText className="w-5 h-5" />
          </button>
        ) : undefined}
      />
      )}
      
      <div className="w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-2 pb-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className={`shadow rounded-lg ${isInactive ? 'bg-red-50' : 'bg-white'}`}>
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.filter(t => !t.hidden).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    // Se l'atleta ÃƒÂ¨ minorenne, non ha tutor e si sta cercando di cambiare tab, mostra avviso
                    if (isMinor && !hasTutors && tab.id !== 'tutor' && tab.id !== 'personal') {
                      setShowTutorWarning(true)
                      return
                    }
                    // Se siamo nel tab Giocatore e si cambia tab: blocca se Tessera CSEN compilata a metÃƒÂ 
                    if (activeTab === 'player' && tab.id !== 'player') {
                      const csenCard = (form.csen_card || '').trim()
                      const csenDate = (form.csen_card_issued_at || '').trim()
                      const csenOneFilled = csenCard.length > 0
                      const csenOtherFilled = csenDate.length > 0
                      if (csenOneFilled !== csenOtherFilled) {
                        setCsenTabError('Compila entrambi i campi Tessera CSEN e Data emissione tessera, oppure lasciali entrambi vuoti.')
                        return
                      }
                    }
                    setCsenTabError(null)
                    setActiveTab(tab.id)
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? (tab.id === 'player' && form.disqualified 
                          ? 'border-red-500 text-red-600 bg-red-50' 
                          : 'border-blue-500 text-blue-600')
                      : (tab.id === 'player' && form.disqualified
                          ? 'border-transparent text-red-500 bg-red-50 hover:text-red-700 hover:border-red-300'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
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
          <div className="px-6 pt-4 pb-6">
            {/* Personal Info Tab */}
            <div className={activeTab === 'personal' ? 'block' : 'hidden'}>
              {TabPanels.personal}
                      </div>
            
            {/* Player Tab */}
            <div className={activeTab === 'player' ? 'block' : 'hidden'}>
              {TabPanels.player}
                    </div>
            
            {/* Fees Tab */}
            <div className={activeTab === 'fees' ? 'block' : 'hidden'}>
              {TabPanels.fees}
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

            {/* Flowme Tab */}
            <div className={activeTab === 'flowme' ? 'block' : 'hidden'}>
              {TabPanels.flowme}
            </div>

            {/* Corrispondenza */}
            <div className={activeTab === 'correspondence' ? 'block' : 'hidden'}>
              {TabPanels.correspondence}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className={`px-6 py-4 border-t border-gray-200 flex justify-between items-center ${isInactive ? 'bg-red-100/80' : 'bg-gray-50'}`}>
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
                    {filteredNotesCount} di {totalNotesCount} {totalNotesCount === 1 ? 'nota' : 'note'}
                  </span>
                </>
              )}
              
              </div>

            <div className="flex items-center space-x-3">
                <button
                  type="button"
                onClick={() => {
                  if (isEditMode && !validateLinkRelations()) {
                    toast.error('Non puoi chiudere la scheda finché non imposti la relazione per ogni contatto collegato inserito.')
                    setActiveTab('personal')
                    return
                  }
                  if (fromAthlete) {
                    navigate(`/create-person?edit=${fromAthlete}&tab=${returnTab}`, { replace: true })
                  } else {
                    handleCancel()
                  }
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                {fromAthlete ? 'Torna al giocatore' : 'Indietro'}
                </button>
              
              {/* Nascondi Modifica/Aggiorna su tab infortuni e corrispondenza */}
              {activeTab !== 'injuries' && activeTab !== 'correspondence' && (
                <>
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={handleSaveWithValidation}
                  disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                      {loading ? 'Salvataggio...' : (isEditing ? 'Aggiorna' : 'Salva')}
                </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleEdit()
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      {isEditing || isTutor || isStaff || form.is_staff
                        ? 'Modifica' 
                        : (form.is_player ? 'Crea Giocatore' : 'Crea Persona')
                      }
                    </button>
                  )}
                </>
              )}
            </div>
              </div>
            </form>
          </div>

      {/* Popup di avviso per atleti minorenni senza tutor */}
      <MinorTutorWarning
        isOpen={showTutorWarning}
        onClose={() => setShowTutorWarning(false)}
        onGoToTutor={handleGoToTutor}
        athleteName={`${form.given_name || ''} ${form.family_name || ''}`.trim() || 'Atleta'}
      />

      {/* Modal per infortuni - key forza il remount con i dati corretti quando si passa da nuovo a modifica */}
      <InjuryEditModal
        key={showInjuryModal ? `injury-${editingInjury?.id ?? 'new'}` : 'injury-closed'}
        isOpen={showInjuryModal}
        onClose={closeInjuryModal}
        injury={editingInjury}
        onSave={handleInjurySaved}
        personId={currentEditId || ''}
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

      {/* Modal scelta tipo PDF scheda persona */}
      {showPdfModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => !generatingPdf && setShowPdfModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Genera scheda PDF
            </h2>
            <p className="text-sm text-gray-600 mb-4">Scegli il tipo di scheda da generare:</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  setGeneratingPdf(true)
                  try {
                    await generateAnagraficaPdf(form)
                    toast.success('Scheda anagrafica generata')
                    setShowPdfModal(false)
                  } catch (e) {
                    console.error(e)
                    toast.error('Errore nella generazione del PDF')
                  } finally {
                    setGeneratingPdf(false)
                  }
                }}
                disabled={generatingPdf}
                className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Scheda anagrafica
                <span className="text-xs opacity-90">(solo Informazioni personali)</span>
              </button>
              <button
                onClick={async () => {
                  if (!currentEditId) {
                    toast.error('Salva prima la persona per generare la scheda completa')
                    return
                  }
                  setGeneratingPdf(true)
                  try {
                    const data = await loadCompletePdfData(currentEditId, form, categories, playerPositions, staffRoles)
                    await generateCompletePdf(data)
                    toast.success('Scheda completa generata')
                    setShowPdfModal(false)
                  } catch (e) {
                    console.error(e)
                    toast.error('Errore nella generazione del PDF')
                  } finally {
                    setGeneratingPdf(false)
                  }
                }}
                disabled={generatingPdf}
                className="w-full px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Scheda completa
                <span className="text-xs opacity-90">(tutte le sezioni con dati)</span>
              </button>
            </div>
            <button
              onClick={() => !generatingPdf && setShowPdfModal(false)}
              className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Popup scelta tipo di attività (fasce dalla tabella Tipi di attività) */}
      {showActivityTypePicker && (() => {
        const brand = getBrandConfig()
        const typesList = injuryActivityTypes.length > 0 ? injuryActivityTypes : [
          { id: '1', name: 'Visita Medica', code: 'medical_visit', sort_order: 1 },
          { id: '2', name: 'Fisioterapia', code: 'physiotherapy', sort_order: 2 },
          { id: '3', name: 'Test/Esame', code: 'test', sort_order: 3 },
          { id: '4', name: 'Annotazione', code: 'note', sort_order: 4 },
          { id: '5', name: 'Rimborso Assicurativo', code: 'insurance_refund', sort_order: 5 },
          { id: '6', name: 'Acquisto Attrezzatura', code: 'equipment_purchase', sort_order: 6 },
          { id: '7', name: 'Spese Sostenute', code: 'expenses', sort_order: 7 },
          { id: '8', name: 'Altro', code: 'other', sort_order: 8 }
        ]
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200/80">
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{ backgroundColor: brand.colors.primary, color: '#fff' }}
              >
                <h3 className="text-lg font-semibold tracking-tight">Scegli tipo di attività</h3>
                <button
                  type="button"
                  onClick={closeActivityTypePicker}
                  className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                  aria-label="Chiudi"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-50/50">
                {typesList.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => chooseActivityTypeAndOpenForm(t.code)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] ${getActivityTypeAccent(t.code)} hover:border-opacity-80`}
                  >
                    <span
                      className="flex items-center justify-center w-12 h-12 rounded-xl text-2xl shrink-0 border bg-white/80"
                      aria-hidden
                    >
                      {getActivityTypeIcon(t.code)}
                    </span>
                    <span className="font-semibold text-slate-800">{t.name}</span>
                    <span className="ml-auto text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal Nuova/Modifica attività in overlay: restiamo sulla pagina giocatore */}
      {showEmbedActivityModal && (embedInjuryId || embedEditActivityId) && (
        <div className="fixed inset-0 z-[100] bg-black/50">
          <button
            type="button"
            onClick={() => { setShowEmbedActivityModal(false); setEmbedInjuryId(null); setEmbedActivityType(''); setEmbedEditActivityId(null); setInjuryRefreshTrigger(prev => prev + 1) }}
            className="absolute top-4 right-4 z-[101] p-2 rounded-full bg-white/90 text-slate-700 hover:bg-white shadow-lg transition-colors"
            title="Chiudi"
            aria-label="Chiudi"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <iframe
            title={embedEditActivityId ? 'Modifica attività' : 'Nuova attività'}
            src={`${typeof window !== 'undefined' ? window.location.origin : ''}/infortuni?tab=attivita${embedEditActivityId ? `&editActivity=${embedEditActivityId}` : `&add=1&injuryId=${embedInjuryId}&type=${encodeURIComponent(embedActivityType)}`}&embed=1`}
            className="absolute inset-0 w-full h-full border-0 bg-transparent"
            allow="fullscreen"
          />
        </div>
      )}

      {/* Modal Planning fisioterapista: impegni + Aggiungi prossima terapia */}
      {showFisioPlanningModal && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-gray-100">
          {/* Header tipo pagina */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">Infermeria – medici e fisioterapisti</h1>
            <button
              type="button"
              onClick={closeFisioPlanningModal}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Chiudi"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {/* Contenuto principale tipo pagina */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm text-gray-600 mb-6">Tutti gli impegni fissati da medici e fisioterapisti: per capire se ci sono giÃƒÂ  altri impegni per il giocatore o se macchinari/laboratorio sono occupati. Lo slot ÃƒÂ¨ calcolato da ora e durata. Usa &quot;Aggiungi&quot; per fissare una nuova fisioterapia o visita e scegli chi sarÃƒÂ  l&apos;operatore.</p>
              {loadingPlanning ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500" />
                </div>
              ) : (
                <>
                  {/* Sezione Impegni */}
                  <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                    <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200 bg-gray-50">
                      <h2 className="text-base font-semibold text-gray-900">Impegni</h2>
                      {!addNewFisioInPlanning && (
                        <button
                          type="button"
                          onClick={() => setAddNewFisioInPlanning(true)}
                          className="px-4 py-2 text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 rounded-lg shadow-sm"
                        >
                          Aggiungi
                        </button>
                      )}
                    </div>
                    <div className="p-5">
                      {planningAppointments.length === 0 && !addNewFisioInPlanning && (
                        <p className="text-sm text-gray-500 py-8 text-center">Nessun impegno in Infermeria.</p>
                      )}
                      {planningAppointments.length > 0 && (
                        <div className="overflow-x-auto -mx-1">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Data</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Giorno</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Ora</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">AttivitÃƒÂ </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Tipologia</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Durata</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Slot occupato</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Operatore</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Giocatore</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide sticky right-0 bg-gray-50 shadow-[-4px_0_8px_rgba(0,0,0,0.06)] min-w-[4.5rem]">Azioni</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {planningAppointments.map((apt) => {
                                const start = apt.ricontrollo_time ? String(apt.ricontrollo_time).slice(0, 5) : '—'
                                const dur = apt.duration_minutes ?? 0
                                let slotText = start
                                if (start !== '—' && dur > 0) {
                                  const [h, m] = start.split(':').map(Number)
                                  const endMin = h * 60 + m + dur
                                  const endH = Math.floor(endMin / 60) % 24
                                  const endM = endMin % 60
                                  slotText = `${start} – ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
                                } else if (dur > 0) {
                                  slotText = `${dur} min`
                                }
                                return (
                                  <tr key={apt.id} className="hover:bg-pink-50/50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{new Date(apt.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 capitalize">{new Date(apt.date).toLocaleDateString('it-IT', { weekday: 'long' })}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{start}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{apt.activityType}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                      {apt.activityType === 'Fisioterapia'
                                        ? ([apt.massaggio && 'Massaggio', apt.tecar && 'Tecar', apt.laser && 'Laser'].filter(Boolean) as string[]).join(', ') || '—'
                                        : (() => {
                                            const d = (apt.activity_description || '').trim()
                                            if (!d) return '—'
                                            if (d.toUpperCase().includes('CHIUSURA')) return 'Chiusura'
                                            if (d.toUpperCase().includes('PRIMA VISITA')) return 'Prima visita'
                                            if (d.toUpperCase().includes('CONTROLLO') || d.toUpperCase().includes('RICONTROLLO')) return 'Ricontrollo'
                                            if (d === 'Visita medica / Ricontrollo') return 'Ricontrollo'
                                            return d
                                          })()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{dur ? `${dur} min` : '—'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{slotText}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{apt.operatorName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{apt.playerName}</td>
                                    <td className="px-4 py-3 text-sm sticky right-0 bg-white hover:bg-pink-50/50 shadow-[-4px_0_8px_rgba(0,0,0,0.06)]">
                                      <button
                                        type="button"
                                        onClick={() => deletePlanningAppointment(apt)}
                                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                        title="Elimina appuntamento"
                                        aria-label="Elimina appuntamento"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </section>
                  {/* Form Nuova fisioterapia */}
                  {addNewFisioInPlanning && (
                    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="text-base font-semibold text-gray-900">Nuova fisioterapia o visita</h2>
                      </div>
                      <div className="p-5 space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Giocatore</label>
                          <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">{planningPlayerName}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo <span className="text-red-500">*</span></label>
                          <select
                            value={newFisioForm.activity_type}
                            onChange={(e) => {
                              const newType = e.target.value as 'physiotherapy' | 'medical_visit'
                              const newFiltered = newType === 'medical_visit'
                                ? medicalStaff.filter(s => s.roles.includes('Medico'))
                                : medicalStaff.filter(s => s.roles.includes('Fisioterapista'))
                              const stillValid = newFisioForm.operator_name && newFiltered.some(s => s.full_name === newFisioForm.operator_name)
                              setNewFisioForm(prev => ({ ...prev, activity_type: newType, operator_name: stillValid ? prev.operator_name : '' }))
                            }}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                          >
                            <option value="physiotherapy">Fisioterapia</option>
                            <option value="medical_visit">Visita medica</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fisioterapista / Medico <span className="text-red-500">*</span></label>
                          <select
                            value={newFisioForm.operator_name}
                            onChange={(e) => setNewFisioForm(prev => ({ ...prev, operator_name: e.target.value }))}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                          >
                            <option value="">Seleziona operatore</option>
                            {(newFisioForm.activity_type === 'medical_visit'
                              ? medicalStaff.filter(s => s.roles.includes('Medico'))
                              : medicalStaff.filter(s => s.roles.includes('Fisioterapista'))
                            ).map((s) => (
                              <option key={s.id} value={s.full_name}>{s.full_name} ({newFisioForm.activity_type === 'medical_visit' ? 'Medico' : 'Fisioterapista'})</option>
                            ))}
                          </select>
                        </div>
                        {newFisioForm.activity_type === 'physiotherapy' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo fisioterapia <span className="text-red-500">*</span></label>
                          <div className="flex flex-wrap gap-6">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={newFisioForm.massaggio} onChange={(e) => setNewFisioForm(prev => ({ ...prev, massaggio: e.target.checked }))} className="rounded border-gray-300 text-pink-600 focus:ring-pink-500" />
                              <span className="text-sm">Massaggio</span>
                            </label>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={newFisioForm.tecar} onChange={(e) => setNewFisioForm(prev => ({ ...prev, tecar: e.target.checked }))} className="rounded border-gray-300 text-pink-600 focus:ring-pink-500" />
                              <span className="text-sm">Tecar</span>
                            </label>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={newFisioForm.laser} onChange={(e) => setNewFisioForm(prev => ({ ...prev, laser: e.target.checked }))} className="rounded border-gray-300 text-pink-600 focus:ring-pink-500" />
                              <span className="text-sm">Laser</span>
                            </label>
                          </div>
                        </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data <span className="text-red-500">*</span></label>
                            <input
                              type="date"
                              value={toDateOnly(newFisioForm.date)}
                              onChange={(e) => setNewFisioForm(prev => ({ ...prev, date: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Orario <span className="text-red-500">*</span></label>
                            <input
                              type="time"
                              value={newFisioForm.time}
                              onChange={(e) => setNewFisioForm(prev => ({ ...prev, time: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Intervento (min) <span className="text-red-500">*</span></label>
                            <input
                              type="number"
                              min={1}
                              max={240}
                              placeholder="es. 45"
                              value={newFisioForm.duration_minutes}
                              onChange={(e) => setNewFisioForm(prev => ({ ...prev, duration_minutes: e.target.value }))}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                            />
                            <p className="mt-1 text-xs text-gray-500">Serve per sapere quale slot occupare e non fissare altri appuntamenti in quell&apos;orario.</p>
                          </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => { setAddNewFisioInPlanning(false); setNewFisioForm({ date: '', time: '', duration_minutes: '', operator_name: '', activity_type: 'physiotherapy', massaggio: false, tecar: false, laser: false }); }}
                            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            Annulla
                          </button>
                          <button
                            type="button"
                            onClick={saveNewFisioFromPlanning}
                            disabled={savingNewFisio || !newFisioForm.date || !newFisioForm.operator_name.trim()}
                            className="px-4 py-2.5 text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 rounded-lg disabled:opacity-50"
                          >
                            {savingNewFisio ? 'Salvataggio...' : 'Salva'}
                          </button>
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal conferma eliminazione appuntamento (agenda) */}
      <DeleteConfirmModal
        isOpen={showPlanningDeleteModal}
        onClose={() => { setShowPlanningDeleteModal(false); setPlanningToDelete(null); }}
        onConfirm={confirmDeletePlanningAppointment}
        title="Elimina appuntamento"
        message="Sei sicuro di voler eliminare questo appuntamento da Infermeria?"
        itemName={planningToDelete?.label}
        loading={deletingPlanning}
      />

      {/* Modal di conferma eliminazione attivitÃƒÂ  */}
      <DeleteConfirmModal
        isOpen={showDeleteActivityModal}
        onClose={closeDeleteActivityModal}
        onConfirm={confirmDeleteActivity}
        title="Conferma Eliminazione"
        message="Sei sicuro di voler eliminare questa attivitÃƒÂ "
        itemName={activityToDelete?.type ? getActivityTypeName(activityToDelete.type) : undefined}
        loading={deletingActivity}
      />

      {/* Modal: a chi inviare notifica della modifica attivitÃƒÂ  (come in AgendaView) */}
      {notificationChoiceModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => !sendingNotification && setNotificationChoiceModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Invia notifica della modifica?</h2>
            <p className="text-sm text-gray-600 mb-4">Vuoi avvisare qualcuno della variazione? Scegli a chi inviare la notifica sull&apos;app mobile.</p>
            <ul className="text-sm text-gray-700 mb-5 space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
              <li><span className="font-medium">Operatore:</span> {notificationChoiceModal.operatorName}</li>
              <li><span className="font-medium">Giocatore:</span> {notificationChoiceModal.playerName}</li>
            </ul>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => handleSendNotification('operator')} disabled={sendingNotification} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-brand-secondary rounded-lg hover:opacity-90 disabled:opacity-50">
                {sendingNotification ? 'Invio...' : 'Solo all\'operatore'}
              </button>
              <button type="button" onClick={() => handleSendNotification('player')} disabled={sendingNotification} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-brand-secondary rounded-lg hover:opacity-90 disabled:opacity-50">
                {sendingNotification ? 'Invio...' : 'Solo al giocatore'}
              </button>
              <button type="button" onClick={() => handleSendNotification('both')} disabled={sendingNotification} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-brand-primary rounded-lg hover:opacity-90 disabled:opacity-50">
                {sendingNotification ? 'Invio...' : 'A entrambi'}
              </button>
              <button type="button" onClick={() => setNotificationChoiceModal(null)} disabled={sendingNotification} className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                No, chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup di conferma ricontrollo */}
      {overlapConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <p className="text-gray-800 mb-6">{overlapConfirmModal.message}</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setOverlapConfirmModal(null); setPendingOverlapActivityData(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annulla</button>
              <button type="button" onClick={handleOverlapConfirm} className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700">Procedi comunque</button>
            </div>
          </div>
        </div>
      )}

      {showRicontrolloModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {pendingActivityData?.activity_type === 'physiotherapy' ? 'Fissare Prossima Fisioterapia?' : 'Fissare Ricontrollo?'}
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
                {pendingActivityData?.activity_type === 'physiotherapy'
                  ? 'Vuoi fissare la prossima seduta di fisioterapia? Verrai portato a Infermeria per scegliere operatore, data, orario e durata (come per un nuovo appuntamento).'
                  : 'Vuoi fissare una visita di controllo? Verrai portato a Infermeria per scegliere medico, data, orario e durata (come per un nuovo appuntamento).'}
              </p>

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleRicontrolloNo}
                  className="flex-1 min-w-0 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  NO
                </button>
                <button
                  type="button"
                  onClick={handleRicontrolloGoToAgenda}
                  className="flex-1 min-w-0 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  SÃƒÂ¬, data e ora
                </button>
                <button
                  type="button"
                  onClick={handleRicontrolloYes}
                  className="flex-1 min-w-0 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  SÃƒÂ¬, solo data
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
                {pendingActivityData?.activity_type === 'physiotherapy' ? 'Seleziona Data Prossima Fisioterapia' : 'Seleziona Data Ricontrollo'}
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
                  {pendingActivityData?.activity_type === 'physiotherapy' ? 'Data prossima fisioterapia:' : 'Data del ricontrollo:'}
                </label>
                <input
                  type="date"
                  value={toDateOnly(selectedRicontrolloDate)}
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

      {/* Popup avviso tutor per minorenni */}
      <MinorTutorWarning
        isOpen={showTutorWarning}
        onClose={() => setShowTutorWarning(false)}
        onGoToTutor={handleGoToTutor}
        athleteName={`${form.given_name || ''} ${form.family_name || ''}`.trim() || 'Atleta'}
      />

      {/* Modal Promemoria */}
      {false && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Ã°Å¸â€œâ€¦ Promemoria per la Nota
            </h3>
            <p className="text-gray-600 mb-6">
              Vuoi impostare una data di promemoria/scadenza per questa nota?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => handleReminderChoice(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Ã¢ÂÅ’ No, solo nota
              </button>
              <button
                onClick={() => handleReminderChoice(true)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Ã¢Å“â€¦ SÃƒÂ¬, con promemoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Data Promemoria */}
      {false && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Ã°Å¸â€œâ€¦ Seleziona Data Promemoria
            </h3>
            <p className="text-gray-600 mb-4">
              Quando vuoi essere ricordato di questa nota?
            </p>
            <div className="mb-6">
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDateModal(false)
                  setReminderDate('')
                }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Ã¢ÂÅ’ Annulla
              </button>
              <button
                onClick={handleDateSelection}
                disabled={!reminderDate}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ã¢Å“â€¦ Salva Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modali per la gestione dei familiari */}
      {showPlayerSelectionModal && (
        <PlayerSelectionModal
          isOpen={showPlayerSelectionModal}
          onClose={handlePlayerSelectionClose}
          onConfirm={handlePlayerSelectionConfirm}
          excludePlayerIds={[]}
        />
      )}

      {showRelationshipAssignmentModal && (
        <RelationshipAssignmentModal
          isOpen={showRelationshipAssignmentModal}
          onClose={handleRelationshipAssignmentClose}
          onConfirm={handleRelationshipAssignmentConfirm}
          selectedPlayerIds={selectedPlayerIds}
        />
      )}

      {/* Modal per abbinare/ modificare minorenni nel tab Tutor (scheda tutor) */}
      <PlayerSelectionModal
        isOpen={showTutorMinorsModal}
        onClose={() => setShowTutorMinorsModal(false)}
        onConfirm={(selectedPlayerIds) => {
          const current = form.tutor_athlete_relations?.length ? form.tutor_athlete_relations : (form.tutor_athlete_ids || []).map((aid: string) => ({ athlete_id: aid, relationship: 'Tutore' }))
          const newRelations = selectedPlayerIds.map((id) => {
            const existing = current.find((r: { athlete_id: string }) => r.athlete_id === id)
            return { athlete_id: id, relationship: existing ? existing.relationship : 'Padre' }
          })
          handleInputChange('tutor_athlete_relations', newRelations)
          handleInputChange('tutor_athlete_ids', newRelations.map((r) => r.athlete_id))
          setShowTutorMinorsModal(false)
        }}
        minorsOnly
        initialSelectedIds={form.tutor_athlete_ids || form.tutor_athlete_relations?.map((r: { athlete_id: string }) => r.athlete_id) || []}
        title="Abbina tutor a giocatori (fino a 19 anni)"
        description="Seleziona uno o più giocatori fino a 19 anni compresi a cui questa persona è tutor. Poi indica il rapporto (Padre, Mamma, ecc.) nell'elenco del tab Tutor."
      />

      <GoleeAlertModal
        open={feedbackAlert != null}
        title={feedbackAlert?.title ?? ''}
        message={feedbackAlert?.message ?? ''}
        variant={feedbackAlert?.variant ?? 'success'}
        confirmLabel={feedbackAlert?.confirmLabel ?? 'Ok'}
        onClose={clearFeedbackAlert}
      />

      <DuplicateEmailModal
        open={duplicateEmailCheck != null}
        email={duplicateEmailCheck?.email ?? ''}
        people={duplicateEmailCheck?.people ?? []}
        onClose={() => setDuplicateEmailCheck(null)}
        onKeepEmail={() => setDuplicateEmailCheck(null)}
        onChangeEmail={() => {
          setDuplicateEmailCheck(null)
          requestAnimationFrame(() => document.getElementById('person-email')?.focus())
        }}
      />

    </div>
  )
}

export default CreatePersonView
