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
  is_minor: boolean
  injured: boolean
  injury_date?: string
  injury_duration_days?: number
  disqualified?: boolean
  disqualification_end_date?: string
  fir_code?: string
  csen_card?: string
  csen_card_issued_at?: string
  /** Società di origine (dove ha giocato prima di entrare in under 14 nel Brixia) */
  origin_club?: string
  player_categories: string[]
  player_positions: string[]
  // Staff specific fields
  staff_roles: string[]
  staff_categories: string[]
  // Tutor specific fields
  tutor_relationship?: string
  /** Id dei giocatori minorenni a cui questa persona è assegnata come tutor (Flowme/TeamFlow) */
  tutor_athlete_ids?: string[]
  /** Per ogni minorenne abbinato: athlete_id e tipo di rapporto (Padre, Mamma, Nonno, ecc.) */
  tutor_athlete_relations?: { athlete_id: string; relationship: string }[]
  /** Per giocatore: tutor/contatti collegati (tutor_id + relazione) */
  athlete_tutor_relations?: { tutor_id: string; relationship: string }[]
  /** Relazione predefinita per nuovi contatti sul giocatore */
  player_contact_relationship?: string
  profession?: string
  professional_category?: string
  company?: string
  position?: string
  primary_contact?: boolean
  possible_sponsor?: boolean
  useful_to_club?: boolean
  tutor_notes?: string
  // App access fields
  app_role?: string
  additional_roles?: string[]
  generate_invite_code?: boolean
  invite_code?: string
  generate_invite_code_teamflow?: boolean
  invite_code_teamflow?: string
  // FlowMe app: sezioni visibili e blocco accesso
  flowme_sections?: string[]
  flowme_access_blocked?: boolean
  // TeamFlow webapp: stesso set di opzioni (ruolo, sezioni, blocco, categorie)
  teamflow_app_role?: string
  teamflow_additional_roles?: string[]
  teamflow_sections?: string[]
  teamflow_access_blocked?: boolean
  teamflow_staff_categories?: string[]
}

export type UsePersonFormOptions = {
  /** Chiamata dopo salvataggio con successo (modifica persona esistente). Utile per tornare alla scheda giocatore dopo aver modificato un tutor. */
  onSaveSuccess?: () => void
}

export const usePersonForm = (options?: UsePersonFormOptions) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Come AppBrixia: usa window.location per editId
  const urlParams = new URLSearchParams(window.location.search)
  const editId = urlParams.get('edit') || searchParams.get('edit')
  const isTutor = searchParams.get('tutor') === 'true'
  const athleteId = searchParams.get('athleteId')
  const isEditing = !!editId

  const [form, setForm] = useState<PersonForm>(() => {
    // Inizializzazione lazy per evitare re-render
    // Se stiamo creando un tutor, pre-imposta il ruolo
    const initialAppRole = isTutor && !editId ? 'tutor' : ''
    const initialIsStaff = isTutor && !editId ? true : false
    
    return {
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
      is_staff: initialIsStaff, // Se è tutor, è staff
      is_minor: false,
      injured: false,
      injury_date: '',
      injury_duration_days: undefined,
      disqualified: false,
      disqualification_end_date: '',
      fir_code: '',
      csen_card: '',
      csen_card_issued_at: '',
      origin_club: '',
      player_categories: [],
      player_positions: [],
      staff_roles: isTutor ? ['tutor'] : [], // Se è tutor, imposta il ruolo
      staff_categories: [],
      tutor_relationship: isTutor ? '' : undefined, // Campo per la relazione del tutor
      profession: '',
      professional_category: '',
      company: '',
      position: '',
      primary_contact: false,
      possible_sponsor: false,
      useful_to_club: false,
      tutor_notes: '',
      // App access fields
      app_role: initialAppRole,
      additional_roles: [],
      generate_invite_code: false,
      invite_code: '',
      generate_invite_code_teamflow: false,
      invite_code_teamflow: '',
      flowme_sections: [],
      flowme_access_blocked: false,
      teamflow_app_role: '',
      teamflow_additional_roles: [],
      teamflow_sections: [],
      teamflow_access_blocked: false,
      teamflow_staff_categories: [],
      tutor_athlete_ids: [],
      tutor_athlete_relations: [],
      athlete_tutor_relations: [],
      player_contact_relationship: 'Padre',
    }
  })

  // Persona esistente: apri in modalità visualizzazione (dati visibili), clic "Modifica" per modificare
  const [isEditMode, setIsEditMode] = useState(() => !isEditing)
  const [loading, setLoading] = useState(false)
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null)
  const [linkRelationErrorIds, setLinkRelationErrorIds] = useState<string[]>([])

  const collectMissingLinkRelationIds = (formState: PersonForm): string[] => {
    const missing: string[] = []
    for (const rel of formState.athlete_tutor_relations || []) {
      if (rel.tutor_id && !String(rel.relationship || '').trim()) {
        missing.push(rel.tutor_id)
      }
    }
    const tutorRels = formState.tutor_athlete_relations?.length
      ? formState.tutor_athlete_relations
      : (formState.tutor_athlete_ids || []).map((aid: string) => ({ athlete_id: aid, relationship: '' }))
    for (const rel of tutorRels) {
      if (rel.athlete_id && !String(rel.relationship || '').trim()) {
        missing.push(rel.athlete_id)
      }
    }
    return missing
  }

  const validateLinkRelations = (): boolean => {
    const missing = collectMissingLinkRelationIds(form)
    setLinkRelationErrorIds(missing)
    if (missing.length > 0) {
      setSaveValidationError('Impossibile procedere: imposta la relazione per ogni persona collegata.')
      return false
    }
    setSaveValidationError(null)
    setLinkRelationErrorIds([])
    return true
  }

  const clearLinkRelationError = (id: string) => {
    setLinkRelationErrorIds((prev) => prev.filter((x) => x !== id))
  }
  const [categories, setCategories] = useState<any[]>([])
  const [playerPositions, setPlayerPositions] = useState<any[]>([])
  const [availableRoles, setAvailableRoles] = useState<any[]>([])

  // Funzione per generare automaticamente il numero tessera
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
        return (lastNumber + 1).toString()
      } else {
        // Se non ci sono numeri tessera esistenti, inizia da 1
        return '1'
      }
    } catch (error) {
      console.error('Errore nel generare numero tessera:', error)
      return '1' // Fallback
    }
  }

  // Genera automaticamente il numero tessera per nuove persone
  useEffect(() => {
    if (!isEditing && !form.membership_number) {
      generateMembershipNumber().then(number => {
        setForm(prev => ({
          ...prev,
          membership_number: number
        }))
      })
    }
  }, [isEditing])

  // Imposta i valori del tutor quando isTutor=true
  useEffect(() => {
    if (isTutor && !isEditing) {
      console.log('🔧 IMPOSTA: Valori tutor nel form')
      setForm(prev => ({
        ...prev,
        is_staff: true,
        staff_roles: ['tutor'],
        tutor_relationship: ''
      }))
    }
  }, [isTutor, isEditing])

  // Carica dati persona da DB (stesso flusso di AppBrixia - funziona)
  useEffect(() => {
    if (isEditing && editId) {
      loadPersonData(editId)
    }
  }, [isEditing, editId])



  // Carica categorie, posizioni e ruoli
  useEffect(() => {
    loadCategories()
    loadPlayerPositions()
    loadAvailableRoles()
  }, [])

  // Admin: se la persona è admin e non ha squadre assegnate, assegna tutte le categorie (squadre) di default e persiste in DB
  useEffect(() => {
    if (!isEditing || !editId) return
    if (form.app_role !== 'admin') return
    const staffCats = form.staff_categories || []
    if (staffCats.length > 0) return
    if (!categories.length) return
    const allIds = categories.map((c: { id: string }) => c.id).filter(Boolean)
    if (allIds.length === 0) return
    setForm(prev => ({ ...prev, staff_categories: [...allIds] }))
    // Persiste in DB così l'admin vede subito tutte le squadre in FlowMe senza dover cliccare Salva
    supabase.from('people').update({ staff_categories: allIds }).eq('id', editId).then(({ error }) => {
      if (error) console.error('Auto-assegnazione squadre admin:', error)
    })
  }, [isEditing, editId, form.app_role, form.staff_categories, categories])

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
        // Controlla se ci sono infortuni attivi per questa persona (sempre, non solo se is_player)
        // così la scheda mostra correttamente gli infortuni anche se is_player non è impostato
        let injuryData = null
        try {
          const { data: activeInjuries } = await supabase
            .from('injuries')
            .select('injury_date, duration_days, expected_weeks_off, current_status, is_closed')
            .eq('person_id', personId)
            .eq('current_status', 'In corso')
            .eq('is_closed', false)
            .order('injury_date', { ascending: false })
            .limit(1)
          
          if (activeInjuries && activeInjuries.length > 0) {
            injuryData = activeInjuries[0]
          }
        } catch (error) {
          console.warn('Errore nel caricamento infortuni:', error)
        }

        // Se given_name/family_name sono vuoti ma c'è full_name, usa quello
        let givenName = data.given_name || ''
        let familyName = data.family_name || ''
        if ((!givenName || !familyName) && data.full_name) {
          const parts = String(data.full_name).trim().split(/\s+/)
          if (!givenName) givenName = parts[0] || ''
          if (!familyName) familyName = parts.slice(1).join(' ') || ''
        }

        console.log('🔍 [loadPersonData] Dati caricati dal database:', {
          id: data.id,
          given_name: givenName,
          family_name: familyName,
          full_name: data.full_name,
          player_categories: data.player_categories
        })

        // Normalizza date_of_birth per input type="date" (serve YYYY-MM-DD)
        const dobRaw = data.date_of_birth || ''
        const dateOfBirth = dobRaw ? String(dobRaw).slice(0, 10) : ''

        // is_player: determinato SOLO dal ruolo Giocatore nel tab Flowme/TeamFlow (non dal checkbox)
        const allRoleIds = [
          data.app_role,
          data.teamflow_app_role,
          ...(Array.isArray(data.additional_roles) ? data.additional_roles : []),
          ...(Array.isArray(data.teamflow_additional_roles) ? data.teamflow_additional_roles : [])
        ].filter(Boolean)
        let isPlayer = false
        let giocatoreRoleId: string | null = null
        const { data: giocatoreRoles } = await supabase
          .from('user_roles')
          .select('id')
          .in('name', ['Giocatore', 'Player'])
          .limit(1)
        giocatoreRoleId = giocatoreRoles?.[0]?.id ?? null
        if (allRoleIds.length > 0) {
          if (giocatoreRoleId && allRoleIds.includes(giocatoreRoleId)) isPlayer = true
          if (allRoleIds.some((r: string) => ['giocatore', 'player'].includes(String(r).toLowerCase()))) isPlayer = true
        }
        // Se ha player_categories ma non ha ruolo Giocatore in Flowme/TeamFlow, pre-imposta ruolo Giocatore così i dropdown mostrano "Giocatore"
        const hasPlayerCategories = Array.isArray(data.player_categories) && data.player_categories.length > 0
        const teamflowRoleIds = [data.teamflow_app_role, ...(Array.isArray(data.teamflow_additional_roles) ? data.teamflow_additional_roles : [])].filter(Boolean)
        const hasGiocatoreTeamflow = giocatoreRoleId && (teamflowRoleIds.includes(giocatoreRoleId) || teamflowRoleIds.some((r: string) => ['giocatore', 'player'].includes(String(r).toLowerCase())))
        const appRoleForForm = (hasPlayerCategories && !isPlayer && giocatoreRoleId) ? giocatoreRoleId : (data.app_role || '')
        const teamflowAppRoleForForm = (hasPlayerCategories && !hasGiocatoreTeamflow && giocatoreRoleId) ? giocatoreRoleId : (data.teamflow_app_role || '')
        if (hasPlayerCategories && !isPlayer && giocatoreRoleId) isPlayer = true

        // Formato indirizzo: minuscolo tranne la prima lettera di ogni parola (title case)
        const toTitleCase = (s: string) => {
          if (!s || typeof s !== 'string') return ''
          return s
            .toLowerCase()
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        }
        const rawStreet = data.address_street || ''
        const rawCity = data.address_city || ''
        const rawCountry = data.address_country || ''

        setForm({
          given_name: givenName ? String(givenName).toUpperCase() : '',
          family_name: familyName ? String(familyName).toUpperCase() : '',
          date_of_birth: dateOfBirth,
          gender: data.gender || '',
          fiscal_code: data.fiscal_code || '',
          status: data.status || 'active',
          nationality: data.nationality || '',
          email: data.email || '',
          phone: data.phone || '',
          emergency_contact_name: data.emergency_contact_name || '',
          emergency_contact_phone: data.emergency_contact_phone || '',
          medical_notes: data.medical_notes || '',
          address_street: toTitleCase(rawStreet),
          address_city: toTitleCase(rawCity),
          address_zip: data.address_zip || '',
          address_country: toTitleCase(rawCountry),
          membership_number: data.membership_number || '',
          is_player: isPlayer,
          is_staff: data.is_staff || false,
          is_minor: data.is_minor || false, // Carica is_minor dal database
          injured: !!injuryData, // Usa lo stato reale degli infortuni attivi
          injury_date: injuryData?.injury_date || '',
          injury_duration_days: injuryData?.duration_days || 
            (injuryData?.expected_weeks_off ? injuryData.expected_weeks_off * 7 : undefined),
          disqualified: data.disqualified || false,
          disqualification_end_date: data.disqualification_end_date || '',
          fir_code: data.fir_code || '',
          csen_card: data.csen_card || '',
          csen_card_issued_at: data.csen_card_issued_at || '',
          origin_club: data.origin_club || '',
          player_categories: data.player_categories || [],
          player_positions: data.player_positions || [],
          staff_roles: data.staff_roles || [],
          staff_categories: data.staff_categories || [],
          // App access fields (app_role pre-impostato a Giocatore se ha player_categories ma nessun ruolo)
          app_role: appRoleForForm,
          additional_roles: data.additional_roles || [],
          invite_code: data.invite_code || '',
          generate_invite_code: !!data.invite_code,
          invite_code_teamflow: data.invite_code_teamflow || '',
          generate_invite_code_teamflow: !!data.invite_code_teamflow,
          flowme_sections: Array.isArray(data.flowme_sections) ? data.flowme_sections : [],
          flowme_access_blocked: data.flowme_access_blocked || false,
          teamflow_app_role: teamflowAppRoleForForm,
          teamflow_additional_roles: data.teamflow_additional_roles || [],
          teamflow_sections: Array.isArray(data.teamflow_sections) ? data.teamflow_sections : [],
          teamflow_access_blocked: data.teamflow_access_blocked || false,
          teamflow_staff_categories: data.teamflow_staff_categories || [],
          // Tutor specific fields
          profession: data.profession || '',
          professional_category: data.professional_category || '',
          company: data.company || '',
          position: data.position || '',
          primary_contact: data.primary_contact || false,
          possible_sponsor: data.possible_sponsor || false,
          useful_to_club: data.useful_to_club || false,
          tutor_notes: data.tutor_notes || '',
          tutor_athlete_ids: [],
          tutor_athlete_relations: [],
          athlete_tutor_relations: [],
          player_contact_relationship: 'Padre',
        })
        if (data.id) {
          const { data: rels } = await supabase.from('tutor_athlete_relations').select('athlete_id, relationship').eq('tutor_id', data.id)
          const relations = (rels || []).map((r: { athlete_id: string; relationship?: string }) => ({ athlete_id: r.athlete_id, relationship: r.relationship || 'Tutore' }))
          if (relations.length) setForm(prev => ({ ...prev, tutor_athlete_ids: relations.map(r => r.athlete_id), tutor_athlete_relations: relations }))
          if (data.is_player) {
            const { data: playerRels } = await supabase.from('tutor_athlete_relations').select('tutor_id, relationship').eq('athlete_id', data.id)
            const playerRelations = (playerRels || []).map((r: { tutor_id: string; relationship?: string }) => ({ tutor_id: r.tutor_id, relationship: r.relationship || 'Tutore' }))
            if (playerRelations.length) setForm(prev => ({ ...prev, athlete_tutor_relations: playerRelations }))
          }
        }
      }
    } catch (error) {
      console.error('Errore nel caricamento persona:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      console.log('🔍 [usePersonForm] Caricamento categorie...')
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, code, sort, active')
        .eq('active', true)
        .order('sort')

      if (error) {
        console.error('❌ [usePersonForm] Errore query categorie:', error)
        throw error
      }
      console.log('✅ [usePersonForm] Categorie caricate:', data?.length, data)
      setCategories(data || [])
    } catch (error) {
      console.error('❌ [usePersonForm] Errore nel caricamento categorie:', error)
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

  const loadAvailableRoles = async () => {
    const FALLBACK_ROLES = [
      { id: 'admin', name: 'Admin' },
      { id: 'dirigente', name: 'Dirigente' },
      { id: 'segreteria', name: 'Segreteria' },
      { id: 'direttore-sportivo', name: 'Direttore Sportivo' },
      { id: 'direttore-tecnico', name: 'Direttore Tecnico' },
      { id: 'allenatore', name: 'Allenatore' },
      { id: 'giocatore', name: 'Giocatore' },
      { id: 'preparatore', name: 'Preparatore Atletico' },
      { id: 'team-manager', name: 'Team Manager' },
      { id: 'accompagnatore', name: 'Accompagnatore' },
      { id: 'medico', name: 'Medico' },
      { id: 'fisio', name: 'Fisioterapista' },
      { id: 'familiare', name: 'Familiare' },
      { id: 'tutor', name: 'Tutor' }
    ]
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('id, name')
        .order('name')

      if (error) throw error
      if (data && data.length > 0) {
        // Escludi duplicati inglesi: Player = Giocatore, Famiglia = Familiare
        const roles = data
          .filter((r: { name: string }) => !['Player', 'Famiglia'].includes(r.name))
          .map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))
        setAvailableRoles(roles)
        return
      }
    } catch (err) {
      console.warn('Caricamento ruoli da user_roles fallito, uso lista predefinita:', err)
    }
    setAvailableRoles(FALLBACK_ROLES)
  }

  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    setForm(prev => {
      const newForm = {
        ...prev,
        [field]: value
      }

      // Logica automatica: se Giocatore è in Flowme O TeamFlow → is_player = true
      // Controlla app_role, additional_roles, teamflow_app_role, teamflow_additional_roles
      const roleFields = ['app_role', 'additional_roles', 'teamflow_app_role', 'teamflow_additional_roles']
      if (roleFields.includes(field)) {
        const isGiocatoreRole = (roleId: string) => {
          if (!roleId) return false
          if (roleId === 'giocatore' || roleId.toLowerCase() === 'giocatore') return true
          const r = availableRoles.find((ro: { id: string; name: string }) => ro.id === roleId)
          return r ? r.name === 'Giocatore' : false
        }
        const isStaffRoleId = (roleId: string) => {
          if (!roleId) return false
          const staffSlugs = ['allenatore', 'preparatore', 'team-manager', 'accompagnatore', 'familiare', 'tutor']
          if (staffSlugs.includes(roleId)) return true
          const r = availableRoles.find((ro: { id: string; name: string }) => ro.id === roleId)
          return r ? ['Allenatore', 'Preparatore Atletico', 'Team Manager', 'Accompagnatore', 'Familiare', 'Tutor'].includes(r.name) : false
        }

        const flowmeRoles = [newForm.app_role, ...(newForm.additional_roles || [])].filter(Boolean) as string[]
        const teamflowRoles = [newForm.teamflow_app_role, ...(newForm.teamflow_additional_roles || [])].filter(Boolean) as string[]
        const allRoles = [...flowmeRoles, ...teamflowRoles]

        const hasPlayerRole = allRoles.some(isGiocatoreRole)
        const hasStaffRole = allRoles.some(isStaffRoleId)
        const staffRoles = allRoles.filter(isStaffRoleId)

        newForm.is_player = hasPlayerRole
        newForm.is_staff = hasStaffRole
        newForm.staff_roles = staffRoles

        const hadFamiliare = [form.app_role, ...(form.additional_roles || [])].some((rid: string) => {
          const r = availableRoles.find((ro: { id: string; name: string }) => ro.id === rid)
          return r?.name === 'Familiare' || rid === 'familiare'
        })
        const hasFamiliare = allRoles.some((rid: string) => {
          const r = availableRoles.find((ro: { id: string; name: string }) => ro.id === rid)
          return r?.name === 'Familiare' || rid === 'familiare'
        })
        if (hasFamiliare && !hadFamiliare) {
          window.dispatchEvent(new CustomEvent('familiareSelected', { 
            detail: { hasPlayerRole, hasStaffRole, allRoles, staffRoles } 
          }))
        }
      }

      return newForm
    })
  }

  // Funzione per gestire i dati degli infortuni
  const handleInjuryData = async (personId: string) => {
    if (!form.is_player) return // Solo per i giocatori

    try {
      // Se il giocatore è infortunato, crea o aggiorna il record infortunio
      if (form.injured && form.injury_date && form.injury_duration_days) {
        // Controlla se esiste già un infortunio attivo
        const { data: existingInjuries } = await supabase
          .from('injuries')
          .select('id')
          .eq('person_id', personId)
          .eq('current_status', 'In corso')
          .eq('is_closed', false)

        if (existingInjuries && existingInjuries.length > 0) {
          // Aggiorna infortunio esistente
          const { error } = await supabase
            .from('injuries')
            .update({
              injury_date: form.injury_date,
              duration_days: form.injury_duration_days,
              current_status: 'In corso',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingInjuries[0].id)

          if (error) throw error
        } else {
          // Crea nuovo infortunio
          const { error } = await supabase
            .from('injuries')
            .insert({
              person_id: personId,
              injury_date: form.injury_date,
              injury_type: 'Generico',
              severity: 'Lieve',
              body_part: 'Generale',
              cause: 'Non specificato',
              current_status: 'In corso',
              duration_days: form.injury_duration_days,
              expected_weeks_off: Math.ceil(form.injury_duration_days / 7),
              description: 'Infortunio registrato dal sistema',
              is_closed: false
            })

          if (error) throw error
        }
      } else if (!form.injured) {
        // Se il giocatore non è più infortunato, chiudi tutti gli infortuni attivi
        const { error } = await supabase
          .from('injuries')
          .update({ 
            current_status: 'Guarito',
            is_closed: true,
            injury_closed_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('person_id', personId)
          .eq('current_status', 'In corso')
          .eq('is_closed', false)

        if (error) throw error
      }
    } catch (error) {
      console.error('Errore nella gestione infortuni:', error)
      // Non blocchiamo il salvataggio della persona per errori negli infortuni
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<string | null> => {
    e.preventDefault()

    if (!validateLinkRelations()) {
      return null
    }

    // Validazione Tessera CSEN: entrambi i campi compilati o entrambi vuoti
    const csenCard = (form.csen_card || '').trim()
    const csenDate = (form.csen_card_issued_at || '').trim()
    const csenOneFilled = csenCard.length > 0
    const csenOtherFilled = csenDate.length > 0
    if (csenOneFilled !== csenOtherFilled) {
      setSaveValidationError('Compila entrambi i campi Tessera CSEN e Data emissione tessera, oppure lasciali entrambi vuoti.')
      return null
    }
    setSaveValidationError(null)
    
    // Il codice invito viene ora generato immediatamente nel componente PersonalInfoTab
    // e salvato direttamente nel form.invite_code
    
    // is_player: determinato solo dal ruolo Giocatore in Flowme/TeamFlow (persistiamo per query/lista)
    const roleIdsForPlayer = [form.app_role, form.teamflow_app_role, ...(form.additional_roles || []), ...(form.teamflow_additional_roles || [])].filter(Boolean)
    const isGiocatore = (rid: string) => {
      if (!rid) return false
      if (String(rid).toLowerCase() === 'giocatore' || String(rid).toLowerCase() === 'player') return true
      const r = availableRoles.find((ro: { id: string; name: string }) => ro.id === rid)
      return r ? r.name === 'Giocatore' : false
    }
    const derivedIsPlayer = roleIdsForPlayer.some(isGiocatore)

    const givenUpper = (form.given_name || '').trim().toUpperCase()
    const familyUpper = (form.family_name || '').trim().toUpperCase()
    const personData = {
      given_name: givenUpper,
      family_name: familyUpper,
      full_name: `${givenUpper} ${familyUpper}`.trim(),
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      fiscal_code: form.fiscal_code || null,
      status: form.status,
      nationality: form.nationality || null,
      email: form.email ? form.email.toLowerCase() : null,
      phone: form.phone || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      medical_notes: form.medical_notes || null,
      address_street: form.address_street || null,
      address_city: form.address_city || null,
      address_zip: form.address_zip || null,
      address_country: form.address_country || null,
      membership_number: form.membership_number || null,
      is_player: derivedIsPlayer,
      is_staff: form.is_staff,
      injured: form.injured,
      disqualified: form.disqualified || false,
      disqualification_end_date: form.disqualification_end_date || null,
      fir_code: form.fir_code || null,
      csen_card: form.csen_card?.trim() ? form.csen_card.trim().toUpperCase() : null,
      csen_card_issued_at: form.csen_card_issued_at?.trim() || null,
      origin_club: form.origin_club?.trim() || null,
      staff_roles: form.staff_roles.length > 0 ? form.staff_roles : null,
      staff_categories: form.staff_categories.length > 0 ? form.staff_categories : null,
      player_categories: form.player_categories.length > 0 ? form.player_categories : null,
      player_positions: form.player_positions.length > 0 ? form.player_positions : null,
      // App access fields
      app_role: form.app_role || null,
      additional_roles: form.additional_roles.length > 0 ? form.additional_roles : null,
      // Tutor specific fields
      profession: form.profession || null,
      professional_category: form.professional_category || null,
      company: form.company || null,
      position: form.position || null,
      primary_contact: form.primary_contact || false,
      possible_sponsor: form.possible_sponsor || false,
      useful_to_club: form.useful_to_club || false,
      tutor_notes: form.tutor_notes || null,
      // Codice invito Flowme (uno per app)
      invite_code: (form.generate_invite_code && form.invite_code) ? form.invite_code : null,
      // Codice invito TeamFlow (separato da Flowme)
      invite_code_teamflow: (form.generate_invite_code_teamflow && form.invite_code_teamflow) ? form.invite_code_teamflow : null,
      // FlowMe: sezioni visibili e blocco accesso (colonne su people)
      flowme_sections: Array.isArray(form.flowme_sections) ? form.flowme_sections : [],
      flowme_access_blocked: form.flowme_access_blocked || false,
      // TeamFlow webapp: ruolo, sezioni, blocco, categorie
      teamflow_app_role: form.teamflow_app_role || null,
      teamflow_additional_roles: (form.teamflow_additional_roles?.length ?? 0) > 0 ? form.teamflow_additional_roles : null,
      teamflow_sections: Array.isArray(form.teamflow_sections) ? form.teamflow_sections : [],
      teamflow_access_blocked: form.teamflow_access_blocked || false,
      teamflow_staff_categories: (form.teamflow_staff_categories?.length ?? 0) > 0 ? form.teamflow_staff_categories : null
    }
    
    // Debug: log dei dati che stanno per essere salvati
    console.log('🔍 [handleSubmit] Dati da salvare:', {
      generate_invite_code: form.generate_invite_code,
      invite_code: form.invite_code,
      hasInviteCode: !!(form.generate_invite_code && form.invite_code),
      personData_invite_code: personData.invite_code
    })
    
    try {
      setLoading(true)

      if (isEditing) {
        // Aggiorna persona esistente
        const { error } = await supabase
          .from('people')
          .update(personData)
          .eq('id', editId)

        if (error) throw error
        
        // Gestisci infortuni per persona esistente
        await handleInjuryData(editId)

        const hasTutorRole = form.app_role === 'tutor' || form.staff_roles?.includes('tutor') || (form.additional_roles || []).some((rid: string) => rid === 'tutor') ||
          (form.staff_roles || []).some((rid: string) => availableRoles.find((r: { id: string; name: string }) => r.id === rid)?.name === 'Tutor')
        const hasTutorRelationsToSave = (Array.isArray(form.tutor_athlete_relations) && form.tutor_athlete_relations.length > 0) || (Array.isArray(form.tutor_athlete_ids) && form.tutor_athlete_ids.length > 0)
        if ((hasTutorRole || hasTutorRelationsToSave) && editId) {
          const { error: deleteErr } = await supabase.from('tutor_athlete_relations').delete().eq('tutor_id', editId)
          if (deleteErr) {
            console.error('Errore eliminazione tutor_athlete_relations:', deleteErr)
            throw deleteErr
          }
          const relations = Array.isArray(form.tutor_athlete_relations) && form.tutor_athlete_relations.length > 0
            ? form.tutor_athlete_relations
            : (Array.isArray(form.tutor_athlete_ids) ? form.tutor_athlete_ids : []).map((aid: string) => ({ athlete_id: aid, relationship: 'Tutore' }))
          for (const rel of relations) {
            const aid = typeof rel === 'string' ? rel : rel.athlete_id
            const relationship = typeof rel === 'string' ? 'Tutore' : (rel.relationship || 'Tutore')
            if (aid) {
              const { error: insertErr } = await supabase.from('tutor_athlete_relations').insert({ tutor_id: editId, athlete_id: aid, relationship, is_primary_contact: false })
              if (insertErr) {
                console.error('Errore inserimento tutor_athlete_relations:', insertErr, { tutor_id: editId, athlete_id: aid })
                throw insertErr
              }
            }
          }
        }

        if (form.is_player && editId) {
          const { error: deletePlayerRelErr } = await supabase.from('tutor_athlete_relations').delete().eq('athlete_id', editId)
          if (deletePlayerRelErr) {
            console.error('Errore eliminazione relazioni giocatore:', deletePlayerRelErr)
            throw deletePlayerRelErr
          }
          for (const rel of form.athlete_tutor_relations || []) {
            if (rel.tutor_id) {
              const { error: insertPlayerRelErr } = await supabase.from('tutor_athlete_relations').insert({
                tutor_id: rel.tutor_id,
                athlete_id: editId,
                relationship: rel.relationship || 'Tutore',
                is_primary_contact: false,
              })
              if (insertPlayerRelErr) {
                console.error('Errore inserimento relazione giocatore:', insertPlayerRelErr, rel)
                throw insertPlayerRelErr
              }
            }
          }
        }

        options?.onSaveSuccess?.()
        return editId
      } else {
        // Crea nuova persona
        const { data: newPerson, error } = await supabase
          .from('people')
          .insert(personData)
          .select('id, invite_code')
          .single()
        
        // Il codice invito è già presente nel form, quindi viene salvato automaticamente
        if (form.generate_invite_code && form.invite_code) {
          console.log('🎫 Codice invito salvato:', form.invite_code)
          const roleText = form.app_role ? ` (Ruolo: ${form.app_role})` : ''
          alert(`✅ Persona creata con successo!${roleText}\n\n🎫 Il codice invito è stato salvato e mostrato sotto.`)
        }

        if (error) throw error
        
        const hasTutorRole = form.app_role === 'tutor' || form.staff_roles?.includes('tutor') || (form.additional_roles || []).some((rid: string) => rid === 'tutor')
        const relations = Array.isArray(form.tutor_athlete_relations) && form.tutor_athlete_relations.length > 0
          ? form.tutor_athlete_relations
          : (Array.isArray(form.tutor_athlete_ids) ? form.tutor_athlete_ids : []).map((aid: string) => ({ athlete_id: aid, relationship: form.tutor_relationship || 'Tutore' }))
        let relationsToInsert = relations
        if (isTutor && athleteId && !relations.some((r: { athlete_id: string }) => r.athlete_id === athleteId)) {
          relationsToInsert = [{ athlete_id: athleteId, relationship: form.tutor_relationship || 'Tutore' }, ...relations]
        }
        if (hasTutorRole && newPerson?.id && relationsToInsert.length) {
          for (const rel of relationsToInsert) {
            if (rel.athlete_id) await supabase.from('tutor_athlete_relations').insert({
              tutor_id: newPerson.id,
              athlete_id: rel.athlete_id,
              relationship: rel.relationship || 'Tutore',
              is_primary_contact: false
            })
          }
        }

        if (form.is_player && newPerson?.id && (form.athlete_tutor_relations || []).length) {
          for (const rel of form.athlete_tutor_relations || []) {
            if (rel.tutor_id) {
              await supabase.from('tutor_athlete_relations').insert({
                tutor_id: rel.tutor_id,
                athlete_id: newPerson.id,
                relationship: rel.relationship || form.player_contact_relationship || 'Tutore',
                is_primary_contact: false,
              })
            }
          }
        }
        
        // Gestisci infortuni per nuova persona
        if (newPerson?.id) {
          await handleInjuryData(newPerson.id)
        }
        
        // Aggiorna l'URL con l'ID della persona appena creata
        // MA SOLO se non stiamo creando un tutor
        if (newPerson?.id && !isTutor) {
          const newUrl = new URL(window.location.href)
          newUrl.searchParams.set('edit', newPerson.id)
          window.history.replaceState({}, '', newUrl.toString())
          
          // Naviga alla stessa pagina con il nuovo ID per aggiornare i parametri
          navigate(newUrl.pathname + newUrl.search, { replace: true })
        }
        
        // Se stiamo creando un tutor, rimuovi i parametri tutor e athleteId
        if (newPerson?.id && isTutor) {
          const newUrl = new URL(window.location.href)
          newUrl.searchParams.delete('tutor')
          newUrl.searchParams.delete('athleteId')
          window.history.replaceState({}, '', newUrl.toString())
        }
        return newPerson?.id ?? null
      }
    } catch (error) {
      console.error('Errore nel salvataggio:', error)
      console.error('Dati che stavano per essere salvati:', personData)
      console.error('Dettagli errore:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      
      // Se l'errore è dovuto a un numero tessera duplicato, rigenera un nuovo numero
      if (error.code === '23505' && error.message?.includes('membership_number_unique')) {
        console.log('🔄 Numero tessera duplicato, rigenero un nuovo numero...')
        const newNumber = await generateMembershipNumber()
        setForm(prev => ({
          ...prev,
          membership_number: newNumber
        }))
        alert(`Numero tessera duplicato. Generato nuovo numero: ${newNumber}. Riprova a salvare.`)
      } else {
        alert(`Errore nel salvataggio: ${error.message || 'Errore sconosciuto'}`)
      }
      return null
    } finally {
      setLoading(false)
    }
  }

  /** Salva la persona e restituisce l'ID (create) o editId (update). null se fallisce. FIX 2: per relazioni familiari. */
  const handleSaveWithId = async (): Promise<string | null> => {
    return handleSubmit(new Event('submit') as React.FormEvent)
  }

  const isFieldDisabled = () => {
    return isEditing && !isEditMode
  }

  const handleEdit = () => {
    setIsEditMode(true)
  }

  const exitEditMode = () => {
    setIsEditMode(false)
  }

  const handleSave = async () => {
    await handleSubmit(new Event('submit') as React.FormEvent)
    setIsEditMode(false)
  }

  const handleCancel = () => {
    if (isEditMode) {
      const missing = collectMissingLinkRelationIds(form)
      if (missing.length > 0) {
        setLinkRelationErrorIds(missing)
        setSaveValidationError('Impossibile procedere: imposta la relazione per ogni persona collegata.')
        alert('Non puoi chiudere la scheda finché non imposti la relazione per ogni contatto collegato inserito.')
        return
      }
    }
    const fromParam = searchParams.get('from')
    if (fromParam && fromParam.startsWith('/')) {
      navigate(fromParam)
      return
    }
    navigate('/people')
  }

  return {
    form,
    setForm,
    isEditMode,
    loading,
    saveValidationError,
    linkRelationErrorIds,
    clearLinkRelationError,
    validateLinkRelations,
    categories,
    playerPositions,
    availableRoles,
    isEditing,
    editId,
    handleInputChange,
    handleSubmit,
    handleSaveWithId,
    isFieldDisabled,
    handleEdit,
    exitEditMode,
    handleSave,
    handleCancel
  }
}

