import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Pencil, Trash2, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import { getPositionDisplayName } from '@/utils/personUtils'
import { formatDisplayPersonName } from '@/lib/formatPersonName'
import { setPeopleNavIds } from '@/lib/peopleNavStorage'

const PEOPLE_VIEW_SCROLL_KEY = 'people-view-scroll'
function getScrollContainer () {
  return typeof document !== 'undefined' ? document.getElementById('main-content-scroll') : null
}
function saveScrollPosition () {
  const el = getScrollContainer()
  if (el) try { sessionStorage.setItem(PEOPLE_VIEW_SCROLL_KEY, String(el.scrollTop)) } catch (_) {}
}
function restoreScrollPosition (position: number) {
  const el = getScrollContainer()
  if (el && position >= 0) requestAnimationFrame(() => { el.scrollTop = position })
}

interface Person {
  id: string
  full_name: string
  given_name: string
  family_name: string
  date_of_birth: string
  is_minor: boolean
  gender: string
  fiscal_code: string
  email: string
  phone: string
  status: string
  membership_number: string
  created_at: string
  disqualified?: boolean
  disqualification_end_date?: string
  injured?: boolean
  injury_date?: string
  injury_duration_days?: number
  invite_code?: string | null
  player_positions?: string[] | null
  // Dati aggiuntivi per la visualizzazione
  age: number
  role: string
  categories: string[]
  playerCategories: string[]
  staffCategories: string[]
}

interface PeopleViewProps {
  embedInLayout?: boolean
}

export default function PeopleView({ embedInLayout = false }: PeopleViewProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isMobileView = searchParams.get('mobile') === '1'
  const deviceType = (searchParams.get('device') || 'phone') as 'tablet' | 'phone'
  const isReadOnly = isMobileView && deviceType === 'phone'
  const isMobileTablet = isMobileView && deviceType === 'tablet'

  const FILTERS_STORAGE_KEY = 'people-view-filters'
  const loadFiltersFromStorage = () => {
    try {
      const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          searchTerm: parsed.searchTerm ?? '',
          roleFilter: parsed.roleFilter ?? 'all',
          categoryFilter: parsed.categoryFilter ?? 'all',
          birthYearFilter: parsed.birthYearFilter ?? '',
          activeFilter: parsed.activeFilter ?? null,
          statusFilter: parsed.statusFilter ?? 'all'
        }
      }
    } catch (_) {}
    return { searchTerm: '', roleFilter: 'all', categoryFilter: 'all', birthYearFilter: '', activeFilter: null, statusFilter: 'all' }
  }
  const saveFiltersToStorage = (f: { searchTerm: string; roleFilter: string; categoryFilter: string; birthYearFilter: string; activeFilter: string | null; statusFilter: string }) => {
    try {
      sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(f))
    } catch (_) {}
  }

  const storedFilters = loadFiltersFromStorage()
  const [people, setPeople] = useState<Person[]>([])
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(storedFilters.searchTerm)
  const [roleFilter, setRoleFilter] = useState(storedFilters.roleFilter)
  const [categoryFilter, setCategoryFilter] = useState(storedFilters.categoryFilter)
  const [birthYearFilter, setBirthYearFilter] = useState(storedFilters.birthYearFilter)
  const [statusFilter, setStatusFilter] = useState(storedFilters.statusFilter)
  const [activeFilter, setActiveFilter] = useState<string | null>(storedFilters.activeFilter)
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [allCategoriesData, setAllCategoriesData] = useState<any[]>([])
  const [playerPositions, setPlayerPositions] = useState<any[]>([])
  const [personIdsVisiteSaltate, setPersonIdsVisiteSaltate] = useState<string[]>([])
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteModalPerson, setDeleteModalPerson] = useState<{ id: string; name: string } | null>(null)
  const [deleteInProgress, setDeleteInProgress] = useState(false)
  const scrollRestoreAfterDeleteRef = useRef<number | null>(null)
  const [restoreScrollTrigger, setRestoreScrollTrigger] = useState(0)

  // Funzione per mappare gli ID delle posizioni ai nomi
  const getPositionNames = (positionIds: string[]): string[] => {
    if (!positionIds || !Array.isArray(positionIds) || positionIds.length === 0) return []
    if (!playerPositions || playerPositions.length === 0) return positionIds // Fallback agli ID se non abbiamo i dati
    
    return positionIds.map(id => {
      const position = playerPositions.find(p => p.id === id)
      return position ? position.name : id
    }).filter(name => name) // Rimuovi eventuali valori undefined
  }

  // Funzione per calcolare i giorni rimanenti alla scadenza della squalifica
  const getDaysUntilDisqualificationExpiry = (endDate: string): number => {
    const today = new Date()
    const end = new Date(endDate)
    const diffTime = end.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Funzione per formattare il testo dei giorni rimanenti
  const formatDaysRemaining = (days: number): string => {
    if (days <= 0) {
      return '(scaduta)'
    } else if (days === 1) {
      return '(1 giorno)'
    } else {
      return `(${days} giorni)`
    }
  }

  // Funzione per calcolare i giorni rimanenti all'infortunio
  const getDaysUntilInjuryEnd = (injuryDate: string, durationDays: number): number => {
    const startDate = new Date(injuryDate)
    const endDate = new Date(startDate.getTime() + (durationDays * 24 * 60 * 60 * 1000))
    const today = new Date()
    const diffTime = endDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    
    return diffDays
  }

  // Funzione per formattare il testo dei giorni rimanenti all'infortunio
  const formatInjuryDaysRemaining = (days: number): string => {
    if (days <= 0) {
      return '(guarito)'
    } else if (days === 1) {
      return '(1 giorno)'
    } else {
      return `(${days} giorni)`
    }
  }

  // Carica le persone e i ruoli
  useEffect(() => {
    loadPeople()
    loadRoles()
  }, [])

  // Filtro da URL (es. /people?filter=lista-nera o ?filter=visite-saltate)
  useEffect(() => {
    const filter = searchParams.get('filter')
    if (filter === 'lista-nera') setActiveFilter('lista-nera')
    else if (filter === 'visite-saltate') setActiveFilter('visite-saltate')
    else if (filter === 'flowme') setActiveFilter('flowme')
  }, [searchParams])

  // Persistenza filtri in sessionStorage (restano attivi quando si esce e si torna)
  useEffect(() => {
    saveFiltersToStorage({ searchTerm, roleFilter, categoryFilter, birthYearFilter, activeFilter, statusFilter })
  }, [searchTerm, roleFilter, categoryFilter, birthYearFilter, statusFilter, activeFilter])

  // Ripristino scroll al ritorno dalla scheda modifica (navigazione indietro)
  useEffect(() => {
    if (loading || people.length === 0) return
    const raw = sessionStorage.getItem(PEOPLE_VIEW_SCROLL_KEY)
    if (raw == null) return
    sessionStorage.removeItem(PEOPLE_VIEW_SCROLL_KEY)
    const pos = parseInt(raw, 10)
    if (!Number.isNaN(pos)) restoreScrollPosition(pos)
  }, [loading, people.length])

  // Ripristino scroll dopo eliminazione di una riga
  useEffect(() => {
    if (loading || restoreScrollTrigger === 0) return
    const pos = scrollRestoreAfterDeleteRef.current
    scrollRestoreAfterDeleteRef.current = null
    setRestoreScrollTrigger(0)
    if (pos != null) restoreScrollPosition(pos)
  }, [loading, restoreScrollTrigger])

  // Carica person_id con almeno un'attività "assente" (visita saltata) per conteggio e filtro
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: activities } = await supabase
        .from('injury_activities')
        .select('injury_id')
        .eq('confirmation_status', 'assente')
      if (cancelled || !activities?.length) {
        if (!cancelled) setPersonIdsVisiteSaltate([])
        return
      }
      const injuryIds = [...new Set(activities.map((a: { injury_id: string }) => a.injury_id))]
      const { data: injuries } = await supabase
        .from('injuries')
        .select('person_id')
        .in('id', injuryIds)
      if (cancelled) return
      const ids = [...new Set((injuries || []).map((i: { person_id: string }) => i.person_id))]
      setPersonIdsVisiteSaltate(ids)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Persone da considerare per i conteggi: solo attivi (inattivi e in attesa esclusi come se non esistessero)
  const activeOnlyPeople = useMemo(
    () => people.filter(p => (p.status || '').toLowerCase() === 'active'),
    [people]
  )

  // Filtra le persone
  useEffect(() => {
    let filtered = [...people]

    // Filtro stato: di default solo attivi; inattivi e in attesa visibili solo se filtrati esplicitamente
    if (statusFilter === 'all') {
      filtered = filtered.filter(person => (person.status || '').toLowerCase() === 'active')
    } else if (statusFilter) {
      filtered = filtered.filter(person => (person.status || '').toLowerCase() === statusFilter)
    }

    // Filtro di ricerca intelligente
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(person => {
        // Cerca nei campi base
        const basicMatch = 
          person.full_name.toLowerCase().includes(searchLower) ||
          person.email?.toLowerCase().includes(searchLower) ||
          person.fiscal_code?.toLowerCase().includes(searchLower) ||
          person.membership_number?.toLowerCase().includes(searchLower) ||
          person.age?.toString().includes(searchLower)
        
        // Cerca nel ruolo (incluso ruolo in campo per i giocatori)
        const roleMatch = person.role.toLowerCase().includes(searchLower)
        
        // Cerca nelle posizioni dei giocatori (se disponibili)
        let positionMatch = false
        if (person.player_positions && person.player_positions.length > 0) {
          const positionNames = getPositionNames(person.player_positions)
          positionMatch = positionNames.some(name => 
            name.toLowerCase().includes(searchLower)
          )
        }
        
        // Cerca nelle categorie
        let categoryMatch = false
        if (person.categories && person.categories.length > 0) {
          categoryMatch = person.categories.some(cat => 
            cat.toLowerCase().includes(searchLower)
          )
        }
        
        return basicMatch || roleMatch || positionMatch || categoryMatch
      })
    }

    // Filtro per ruolo: una persona può avere più ruoli (es. "Team Manager + Tutor"); normalizza trattini/spazi per match (es. "team-manager" = "Team Manager")
    if (roleFilter !== 'all') {
      const roleNorm = roleFilter.trim().toLowerCase().replace(/-/g, ' ')
      const isFisioFilter = roleNorm === 'fisio' || roleNorm === 'fisioterapista'
      filtered = filtered.filter(person => {
        const personRoles = person.role.split(' + ').map(r => r.trim().toLowerCase().replace(/-/g, ' '))
        if (isFisioFilter) return personRoles.some(r => r.includes('fisio') || r.includes('fisioterapista'))
        return personRoles.includes(roleNorm)
      })
    }

    // Filtro per categoria
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(person => {
        const readableCategories = (person.categories || []).map(cat => {
          if (typeof cat === 'string' && !cat.includes('-')) return cat
          const c = allCategoriesData?.find(x => x.id === cat)
          return c?.name || cat
        })
        return readableCategories.some(c => String(c).trim() === categoryFilter)
      })
    }

    // Filtro per anno di nascita
    if (birthYearFilter.trim()) {
      const year = birthYearFilter.trim()
      filtered = filtered.filter(person => {
        const dob = person.date_of_birth
        if (!dob) return false
        const birthYear = String(dob).slice(0, 4)
        return birthYear === year
      })
    }

    // Filtro per card delle statistiche
    if (activeFilter) {
      switch (activeFilter) {
        case 'seniores':
          filtered = filtered.filter(p => {
            const isGiocatore = p.role.includes('Giocatore')
            const readableCategories = p.categories?.map(category => {
              if (typeof category === 'string' && !category.includes('-')) {
                return category
              }
              const categoryData = allCategoriesData?.find(c => c.id === category)
              return categoryData?.name || category
            }) || []
            const hasSenioresCategory = readableCategories.some(cat => 
              cat.includes('Seniores') || cat.includes('SENIORES') || cat.includes('Senior') || cat.includes('senior')
            )
            return isGiocatore && hasSenioresCategory
          })
          break
        case 'allenatori':
          filtered = filtered.filter(p => p.role.includes('Allenatore'))
          break
        case 'persone':
          filtered = filtered.filter(p => {
            const isAdmin = p.role.includes('Admin')
            const role = (p.role || '').toLowerCase()
            const isStaffRole = role === 'persona' ||
              role.includes('fisio') ||
              role.includes('fisioterapista') ||
              role.includes('medico') ||
              role.includes('team manager') ||
              (role.includes('preparatore atletico') || role.includes('preparatori atletici')) ||
              role.includes('dirigente') ||
              role.includes('segreteria')
            return !isAdmin && isStaffRole
          })
          break
        case 'juniores':
          filtered = filtered.filter(p => {
            const isGiocatore = p.role.includes('Giocatore')
            if (!isGiocatore) return false
            
            // Usa solo le categorie da giocatore, non quelle da staff
            const playerCategories = p.playerCategories || []
            
            // Verifica se ha una categoria Juniores (U6, U8, U10, U12, U14, U16, U18)
            const junioresCategories = ['U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Under 6', 'Under 8', 'Under 10', 'Under 12', 'Under 14', 'Under 16', 'Under 18']
            const hasJunioresCategory = playerCategories.some(cat => 
              junioresCategories.some(junioresCat => 
                cat.includes(junioresCat) || cat === junioresCat
              )
            )
            console.log(`🔍 JUNIORES FILTER: ${p.full_name} - isGiocatore=${isGiocatore}, playerCategories=`, playerCategories, 'hasJunioresCategory=', hasJunioresCategory)
            return hasJunioresCategory
          })
          break
        case 'old':
          filtered = filtered.filter(p => {
            const isGiocatore = p.role.includes('Giocatore')
            if (!isGiocatore) return false
            
            // Usa solo le categorie da giocatore, non quelle da staff
            const playerCategories = p.playerCategories || []
            
            // Verifica se ha una categoria Old (Poderosa, GussagOld, Brixia Old)
            const oldCategories = ['Poderosa', 'GussagOld', 'Brixia Old', 'GUSSAGOLD', 'BRIXIAOLD', 'PODEROSA']
            const hasOldCategory = playerCategories.some(cat => 
              oldCategories.some(oldCat => 
                cat.includes(oldCat) || cat === oldCat
              )
            )
            console.log(`🔍 OLD FILTER: ${p.full_name} - isGiocatore=${isGiocatore}, playerCategories=`, playerCategories, 'hasOldCategory=', hasOldCategory)
            return hasOldCategory
          })
          break
        case 'infortunati':
          filtered = filtered.filter(p => p.injured === true)
          break
        case 'lista-nera':
          filtered = filtered.filter(p => p.disqualified === true)
          break
        case 'visite-saltate':
          filtered = filtered.filter(p => personIdsVisiteSaltate.includes(p.id))
          break
        case 'flowme':
          filtered = filtered.filter(p => p.invite_code != null && String(p.invite_code).trim().length > 0)
          break
        case 'tutte':
          // Nessun filtro aggiuntivo
          break
      }
    }

    setFilteredPeople(filtered)
  }, [people, searchTerm, roleFilter, categoryFilter, birthYearFilter, statusFilter, activeFilter, allCategoriesData, personIdsVisiteSaltate])


  const loadPeople = async () => {
    try {
      setLoading(true)
      
      // Carica tutte le persone
      const { data: peopleData, error: peopleError } = await supabase
        .from('people')
        .select('*')
        .order('family_name', { ascending: true })

      if (peopleError) {
        console.error('Errore nel caricamento people:', peopleError)
        throw peopleError
      }

      // Carica i giocatori per determinare i ruoli
      const { data: playersData } = await supabase
        .from('players')
        .select('person_id, role_on_field')

      // Carica i ruoli staff dalla tabella people (campo staff_roles)
      // Non serve più caricare da profiles perché i ruoli sono salvati direttamente in people

      // Carica i ruoli staff per mappare gli ID ai nomi
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('id, name')

      // Carica le categorie dei giocatori
      const { data: categoriesData } = await supabase
        .from('player_categories')
        .select(`
          player_id,
          categories (id, name, code)
        `)

      // Carica tutte le categorie (con sort e active per filtro dropdown)
      const { data: allCategoriesData } = await supabase
        .from('categories')
        .select('id, name, code, sort, active')
      
      console.log('🔍 CATEGORIE CARICATE:', allCategoriesData)
      
      // Carica gli infortuni attivi per determinare lo stato injured
      // Prima controlla se la tabella injuries esiste e ha dati
      let activeInjuries: any[] = []
      
      try {
        const { data: injuriesData, error: injuriesError } = await supabase
          .from('injuries')
          .select('*')
        
        console.log('🔍 INFORTUNI ERROR:', injuriesError)
        console.log('🔍 INFORTUNI RAW DATA:', injuriesData)
        
        if (injuriesError) {
          console.warn('⚠️ Tabella injuries non accessibile:', injuriesError.message)
        } else if (injuriesData && injuriesData.length > 0) {
          // Filtra solo quelli attivi (non chiusi e in corso)
          activeInjuries = injuriesData.filter(injury => 
            injury.current_status === 'In corso' && 
            injury.is_closed !== true
          ) || []
          console.log('🔍 INFORTUNI ATTIVI FILTRATI:', activeInjuries)
        } else {
          console.log('🔍 Nessun infortunio trovato nella tabella injuries')
        }
      } catch (error) {
        console.warn('⚠️ Errore nel caricamento infortuni:', error)
      }
      
      
      // Carica le posizioni dei giocatori
      const { data: positionsData, error: positionsError } = await supabase
        .from('player_positions')
        .select('*')
        .order('position_order')

      if (positionsError) {
        console.warn('⚠️ Errore nel caricamento posizioni:', positionsError)
      }

      // Salva le categorie e posizioni nello stato per usarle nel rendering
      setAllCategoriesData(allCategoriesData || [])
      setPlayerPositions(positionsData || [])

      // Processa i dati
      const processedPeople = (peopleData || []).map(person => {
        // Calcola l'età
        const age = person.date_of_birth 
          ? Math.floor((new Date().getTime() - new Date(person.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : 0

        // Determina i ruoli (una persona può essere sia giocatore che staff)
        let roles: string[] = []
        let categories: string[] = []
        let playerCategories: string[] = []
        let staffCategories: string[] = []

        // Controlla se è un giocatore (dal campo is_player o dalla tabella players)
        const player = playersData?.find(p => p.person_id === person.id)
        if (person.is_player || player) {
          roles.push('Giocatore')
          // Carica le categorie dal campo player_categories della tabella people
          if (person.player_categories && person.player_categories.length > 0) {
            console.log(`🔍 ${person.full_name} - player_categories:`, person.player_categories)
            // Mappa sempre gli ID alle categorie (gli UUID sono sempre stringhe, ma vanno mappati)
            const playerCategoryNames = person.player_categories.map(categoryId => {
              const category = allCategoriesData?.find(c => c.id === categoryId)
              console.log(`🔍 ${person.full_name} - mappando ${categoryId} -> ${category?.name || 'NON TROVATO'}`)
              return category?.name || ''
            }).filter(Boolean)
            playerCategories = playerCategoryNames
            console.log(`🔍 ${person.full_name} - categorie mappate:`, playerCategories)
          } else {
            // Fallback: cerca nelle categorie legacy se il nuovo campo è vuoto
            const playerCategoriesLegacy = categoriesData?.filter(c => c.player_id === player?.person_id) || []
            playerCategories = playerCategoriesLegacy.map(c => (c.categories as any)?.name || '').filter(Boolean)
            console.log(`🔍 ${person.full_name} - categorie legacy:`, playerCategories)
          }
        }

        // Controlla se ha un app_role (ruolo principale nell'app) - da fare PRIMA di staff_roles
        let mainAppRole: string | null = null
        if (person.app_role) {
          // Se app_role è un UUID, cerca il ruolo corrispondente nella tabella user_roles
          // Altrimenti usa direttamente il valore (se è una stringa come "Medico", "Giocatore", ecc.)
          let appRoleName = person.app_role
          
          // Verifica se app_role è un UUID
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(person.app_role)
          
          if (isUUID) {
            // Cerca il ruolo nella tabella user_roles
            const appRoleObj = userRolesData?.find(r => r.id === person.app_role)
            appRoleName = appRoleObj ? appRoleObj.name : person.app_role
          } else {
            // app_role è una stringa (es. 'fisio', 'team-manager'): risolvi al nome in user_roles
            const appRoleStr = String(person.app_role).toLowerCase()
            const appRoleNorm = appRoleStr.replace(/-/g, ' ')
            const matched = userRolesData?.find(r => {
              const nameLower = r.name.toLowerCase()
              return nameLower === appRoleStr || nameLower === appRoleNorm ||
                (appRoleStr === 'fisio' && (r.name === 'Fisioterapista' || r.name === 'Fisio')) ||
                (appRoleStr === 'fisioterapista' && (r.name === 'Fisio' || r.name === 'Fisioterapista'))
            })
            if (matched) appRoleName = matched.name
          }
          
          // Salva il ruolo principale per confrontarlo dopo
          mainAppRole = appRoleName
        }

        // Controlla se è staff usando il campo staff_roles
        if (person.staff_roles && person.staff_roles.length > 0) {
          // Mappa tutti i ruoli staff (roleId può essere UUID o slug tipo 'team-manager')
          // Deduplica: 'tutor' (stringa) e UUID Tutor da user_roles producono entrambi "Tutor"
          const staffRoleNamesRaw = person.staff_roles.map(roleId => {
            if (roleId === 'tutor') return 'Tutor'
            let staffRole = userRolesData?.find(r => r.id === roleId)
            if (!staffRole && typeof roleId === 'string' && !/^[0-9a-f-]{36}$/i.test(roleId)) {
              const slugNorm = String(roleId).toLowerCase().replace(/-/g, ' ')
              staffRole = userRolesData?.find(r => r.name.toLowerCase().replace(/\s+/g, ' ') === slugNorm) || undefined
            }
            if (!staffRole) {
              console.log(`🔍 RUOLO NON TROVATO: ID=${roleId}, userRolesData=`, userRolesData)
            }
            const roleName = staffRole ? staffRole.name : `${roleId.substring(0, 8)}...`
            
            if (mainAppRole && roleName.toLowerCase() === mainAppRole.toLowerCase()) return null
            return roleName
          }).filter(Boolean) as string[]
          const staffRoleNames = [...new Set(staffRoleNamesRaw)]
          
          roles.push(...staffRoleNames)
          
          // Carica le categorie staff se presenti
          if (person.staff_categories && person.staff_categories.length > 0) {
            const staffCategoryNames = person.staff_categories.map(categoryId => {
              const category = allCategoriesData?.find(c => c.id === categoryId)
              console.log(`🔍 ${person.full_name} - mappando staff ${categoryId} -> ${category?.name || 'NON TROVATO'}`)
              return category?.name || ''
            }).filter(Boolean)
            staffCategories = staffCategoryNames
            console.log(`🔍 ${person.full_name} - staff categorie mappate:`, staffCategories)
          }
        }

        // Aggiungi il ruolo principale (app_role) solo se non è già presente nei ruoli
        if (mainAppRole && !roles.some(r => r.toLowerCase() === mainAppRole!.toLowerCase())) {
          roles.unshift(mainAppRole) // Aggiungi all'inizio (ruolo principale)
        }

        // Aggiungi i ruoli aggiuntivi (additional_roles): es. Giocatore + Fisioterapista
        if (person.additional_roles && Array.isArray(person.additional_roles)) {
          const additionalRoleNames = person.additional_roles.map((roleId: string) => {
            if (roleId === 'tutor') return 'Tutor'
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId)
            if (isUUID) {
              const r = userRolesData?.find(ur => ur.id === roleId)
              return r ? r.name : null
            }
            const roleStr = String(roleId).toLowerCase()
            const roleStrNorm = roleStr.replace(/-/g, ' ')
            const matched = userRolesData?.find(r => {
              const n = r.name.toLowerCase()
              return n === roleStr || n === roleStrNorm || (roleStr === 'fisio' && (r.name === 'Fisioterapista' || r.name === 'Fisio')) || (roleStr === 'fisioterapista' && (r.name === 'Fisio' || r.name === 'Fisioterapista'))
            })
            return matched ? matched.name : null
          }).filter(Boolean) as string[]
          additionalRoleNames.forEach(name => {
            if (!roles.some(r => r.toLowerCase() === name.toLowerCase())) roles.push(name)
          })
        }

        // Combina le categorie per la visualizzazione (ma mantieni separate per la logica)
        // Se la persona è Admin, non mostrare le categorie staff assegnate
        const hasAdminRole = roles.some(r => r.toLowerCase() === 'admin')
        categories = hasAdminRole ? [...playerCategories] : [...playerCategories, ...staffCategories]

        // Se non ha ruoli specifici, è una persona generica
        if (roles.length === 0) {
          roles = ['Persona']
        }

        // Combina i ruoli in una stringa
        const role = roles.join(' + ')

            // Controlla se ha infortuni attivi
            const activeInjury = activeInjuries.find(injury => injury.person_id === person.id)
        const injured = !!activeInjury
        // Usa i campi disponibili (adatta alla struttura reale della tabella)
        const injury_date = activeInjury?.injury_date || activeInjury?.created_at?.split('T')[0]
        // Usa duration_days se disponibile. expected_weeks_off in app è spesso salvato come GIORNI (es. 28); se <= 12 trattiamo come settimane (*7), altrimenti come giorni
        const raw = activeInjury?.expected_weeks_off
        const injury_duration_days = activeInjury?.duration_days ?? (raw != null ? (raw <= 12 ? raw * 7 : raw) : 7)
        
        // Debug temporaneo per verificare il calcolo
        if (activeInjury && person.full_name === 'Gabriele Bulgari') {
          console.log('🔧 GABRIELE BULGARI DEBUG:', {
            expected_weeks_off: activeInjury.expected_weeks_off,
            duration_days: activeInjury.duration_days,
            injury_duration_days,
            injury_date: activeInjury.injury_date
          })
        }

        // Debug temporaneo per Federico Viola
        if (person.full_name === 'Federico Viola') {
          console.log('🔧 FEDERICO VIOLA DEBUG:', {
            person_id: person.id,
            full_name: person.full_name,
            activeInjury: activeInjury,
            injured: injured,
            injury_date: injury_date,
            injury_duration_days: injury_duration_days,
            allActiveInjuries: activeInjuries,
            injuryFields: activeInjury ? Object.keys(activeInjury) : 'No injury'
          })
        }

        console.log(`🔍 ${person.full_name} - RISULTATO FINALE: role="${role}", categories=`, categories, 'playerCategories=', playerCategories, 'staffCategories=', staffCategories)

        return {
          ...person,
          age,
          role,
          categories,
          playerCategories,
          staffCategories,
          injured,
          injury_date,
          injury_duration_days
        }
      })

      // Rimuovi duplicati basati sull'ID e mantieni il record più completo per nome
      const uniquePeople = processedPeople.reduce((acc, person) => {
        // Controlla se esiste già una persona con lo stesso nome
        const existingPerson = acc.find(p => p.full_name === person.full_name)
        
        if (existingPerson) {
          // PRIORITÀ 1: Se la persona nuova ha un infortunio e quella esistente no, sostituisci
          if (!existingPerson.injured && person.injured) {
            const index = acc.findIndex(p => p.id === existingPerson.id)
            acc[index] = person
          }
          // PRIORITÀ 2: Se la persona esistente non ha categorie e quella nuova sì, sostituisci
          else if (existingPerson.playerCategories.length === 0 && person.playerCategories.length > 0) {
            const index = acc.findIndex(p => p.id === existingPerson.id)
            acc[index] = person
          }
          // PRIORITÀ 3: Se la persona esistente non ha staff categories e quella nuova sì, sostituisci
          else if (existingPerson.staffCategories.length === 0 && person.staffCategories.length > 0) {
            const index = acc.findIndex(p => p.id === existingPerson.id)
            acc[index] = person
          }
          // Altrimenti mantieni quella esistente
        } else {
          // Se non esiste, aggiungi la persona
          acc.push(person)
        }
        return acc
      }, [] as typeof processedPeople)
      
      console.log('🔍 PERSONE PROCESSATE:', processedPeople.length)
      console.log('🔍 PERSONE UNICHE:', uniquePeople.length)
      
      setPeople(uniquePeople)
    } catch (error) {
      console.error('Errore nel caricamento persone:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      // Carica solo i ruoli delle persone dalla tabella user_roles
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('name')
        .order('position_order')

      if (userRolesError) throw userRolesError

      // Aggiungi i ruoli delle persone + ruolo di default
      const allRoles = [
        ...(userRolesData || []).map(role => role.name),
        'Persona' // Ruolo di default per persone senza ruolo specifico
      ]

      // Rimuovi "Player" se c'è già "Giocatore" (duplicato)
      const filteredRoles = allRoles.filter(role => {
        if (role === 'Player' && allRoles.includes('Giocatore')) {
          return false // Rimuovi "Player" se c'è "Giocatore"
        }
        return true
      })

      // Ordina i ruoli
      const sortedRoles = filteredRoles.sort()
      setAvailableRoles(sortedRoles)

    } catch (error) {
      console.error('Errore nel caricamento ruoli:', error)
      // In caso di errore, usa i ruoli di default
      const fallbackRoles = ['Admin', 'Dirigente', 'Allenatore', 'Medico', 'Amministratore', 'Persona']
      setAvailableRoles(fallbackRoles)
    }
  }

  const handleDeletePerson = async (personId: string) => {
    const scrollEl = getScrollContainer()
    if (scrollEl) scrollRestoreAfterDeleteRef.current = scrollEl.scrollTop
    try {
      setDeleteInProgress(true)
      // Step 1: Trova il profilo associato a questa persona
      console.log('🔄 Step 1: Trovo il profilo associato...')
      const { data: profileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('person_id', personId)
        .single()

      if (profileFetchError && profileFetchError.code !== 'PGRST116') {
        console.warn('Avviso: Errore nel trovare il profilo:', profileFetchError)
      }

      // Step 2: Se esiste un profilo, rimuovi le foreign key che puntano a quel profilo
      if (profileData) {
        console.log('🔄 Step 2: Rimuovo foreign key da people che puntano al profilo...')
        const { error: updatePeopleError } = await supabase
          .from('people')
          .update({ invite_used_by: null })
          .eq('invite_used_by', profileData.id)

        if (updatePeopleError) {
          console.warn('Avviso: Errore nell\'aggiornamento people:', updatePeopleError)
        }
      }

      // Step 3: Elimina dalle tabelle di relazione (se esistono)
      console.log('🔄 Step 3: Elimino relazioni...')
      const { error: guardianError } = await supabase
        .from('player_guardian_relationships')
        .delete()
        .or(`player_person_id.eq.${personId},guardian_person_id.eq.${personId}`)

      if (guardianError) {
        console.warn('Avviso: Errore nell\'eliminazione relazioni guardian:', guardianError)
      }

      // Step 3b: Elimina o aggiorna match_lists che referenziano questa persona (created_by)
      try {
        const { data: matchLists } = await supabase
          .from('match_lists')
          .select('id')
          .eq('created_by', personId)
        if (matchLists && matchLists.length > 0) {
          const { error: matchListsError } = await supabase
            .from('match_lists')
            .delete()
            .eq('created_by', personId)
          if (matchListsError) {
            console.warn('Avviso: Errore eliminazione match_lists:', matchListsError)
          }
        }
      } catch (e) {
        console.warn('Avviso: match_lists non disponibile o errore:', e)
      }

      // Step 4: Elimina dalla tabella profiles (se esiste)
      console.log('🔄 Step 4: Elimino da profiles...')
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('person_id', personId)

      if (profileError) {
        console.warn('Avviso: Errore nell\'eliminazione da profiles:', profileError)
      }

      // Step 5: Elimina dalla tabella people
      console.log('🔄 Step 5: Elimino da people...')
      const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', personId)

      if (error) throw error

      // Ricarica la lista e chiudi modal
      setDeleteModalOpen(false)
      setDeleteModalPerson(null)
      await loadPeople()
      setRestoreScrollTrigger(prev => prev + 1)
    } catch (error) {
      console.error('Errore nell\'eliminazione:', error)
      alert(`❌ Errore nell'eliminazione della persona:\n${error.message}\n\n💡 La persona potrebbe essere collegata ad altri dati. Contatta l'amministratore.`)
    } finally {
      setDeleteInProgress(false)
    }
  }

  const openDeleteModal = (person: { id: string; full_name: string }) => {
    setDeleteModalPerson({ id: person.id, name: formatDisplayPersonName(person.full_name) })
    setDeleteModalOpen(true)
  }

  const getStatusColor = (status: string, dark?: boolean) => {
    if (dark) {
      switch (status) {
        case 'active': return 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
        case 'inactive': return 'bg-red-500/30 text-red-200 border border-red-400/50'
        case 'pending': return 'bg-amber-500/30 text-amber-200 border border-amber-400/50'
        default: return 'bg-slate-500/30 text-slate-200 border border-slate-400/50'
      }
    }
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleColor = (role: string, dark?: boolean) => {
    if (dark) {
      const darkMap: Record<string, string> = {
        'Giocatore': 'bg-blue-500/30 text-blue-200 border border-blue-400/50',
        'Allenatore': 'bg-orange-500/30 text-orange-200 border border-orange-400/50',
        'Dirigente': 'bg-violet-500/30 text-violet-200 border border-violet-400/50',
        'Medico': 'bg-red-500/30 text-red-200 border border-red-400/50',
        'Segreteria': 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/50',
        'Team Manager': 'bg-emerald-500/30 text-emerald-200 border-2 border-green-500',
        'Fisio': 'bg-pink-500/30 text-pink-200 border border-pink-400/50',
        'Fisioterapista': 'bg-pink-500/30 text-pink-200 border border-pink-400/50',
        'Tutor': 'bg-teal-500/30 text-teal-200 border border-teal-400/50'
      }
      return darkMap[role] || 'bg-slate-500/30 text-slate-200 border border-slate-400/50'
    }
    switch (role) {
      case 'Giocatore': return 'bg-blue-100 text-blue-800'
      case 'Allenatore': return 'bg-orange-100 text-orange-800'
      case 'Dirigente': return 'bg-purple-100 text-purple-800'
      case 'Medico': return 'bg-red-100 text-red-800'
      case 'Amministratore': return 'bg-gray-100 text-gray-800'
      case 'Admin': return 'bg-gray-100 text-gray-800'
      case 'Segreteria': return 'bg-indigo-100 text-indigo-800'
      case 'Direttore Sportivo': return 'bg-purple-100 text-purple-800'
      case 'Direttore Tecnico': return 'bg-purple-100 text-purple-800'
      case 'Team Manager': return 'bg-green-100 text-green-800 border-2 border-green-500'
      case 'Accompagnatore': return 'bg-yellow-100 text-yellow-800'
      case 'Player': return 'bg-blue-100 text-blue-800'
      case 'Preparatore': return 'bg-orange-100 text-orange-800'
      case 'Fisio': return 'bg-pink-100 text-pink-800'
      case 'Fisioterapista': return 'bg-pink-100 text-pink-800'
      case 'Famiglia': return 'bg-cyan-100 text-cyan-800'
      case 'Tutor': return 'bg-teal-100 text-teal-800'
      case 'Medicina': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Funzione per ottenere il colore della categoria (stesso stile della pagina Activities)
  const getCategoryColor = (categoryName: string, dark?: boolean) => {
    if (dark) {
      const darkMap: Record<string, string> = {
        'U6': 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50',
        'U8': 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50',
        'U10': 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50',
        'U12': 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50',
        'U14': 'bg-blue-500/30 text-blue-200 border border-blue-400/50',
        'U16': 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50',
        'U18': 'bg-yellow-500/30 text-yellow-200 border border-yellow-400/50',
        'SERIE_C': 'bg-violet-500/30 text-violet-200 border border-violet-400/50',
        'SERIE_B': 'bg-rose-500/30 text-rose-200 border border-rose-400/50',
        'SENIORES': 'bg-blue-500/30 text-blue-200 border border-blue-400/50',
        'GUSSAGOLD': 'bg-amber-500/30 text-amber-200 border border-amber-400/50',
        'PODEROSA': 'bg-amber-500/30 text-amber-200 border border-amber-400/50',
        'BRIXIAOLD': 'bg-amber-500/30 text-amber-200 border border-amber-400/50',
        'LEONESSE': 'bg-rose-500/30 text-rose-200 border border-rose-400/50'
      }
      return darkMap[categoryName] || 'bg-slate-500/30 text-slate-200 border border-slate-400/50'
    }
    const colorMap: { [key: string]: string } = {
      'U6': 'bg-emerald-100 text-emerald-700',
      'U8': 'bg-emerald-100 text-emerald-700',
      'U10': 'bg-emerald-100 text-emerald-700',
      'U12': 'bg-emerald-100 text-emerald-700',
      'U14': 'bg-blue-100 text-blue-700',
      'U16': 'bg-blue-100 text-blue-700',
      'U18': 'bg-yellow-100 text-yellow-700',
      'SERIE_C': 'bg-blue-100 text-blue-700',
      'SERIE_B': 'bg-blue-100 text-blue-700',
      'SENIORES': 'bg-blue-100 text-blue-700',
      'GUSSAGOLD': 'bg-amber-100 text-amber-700',
      'PODEROSA': 'bg-amber-100 text-amber-700',
      'BRIXIAOLD': 'bg-amber-100 text-amber-700',
      'LEONESSE': 'bg-rose-100 text-rose-700'
    }
    return colorMap[categoryName] || 'bg-gray-100 text-gray-700'
  }

  // Titolo dinamico per la card principale in base ai filtri attivi
  const getMainCardTitle = () => {
    const hasAnyFilter = searchTerm || roleFilter !== 'all' || categoryFilter !== 'all' || birthYearFilter.trim() || statusFilter !== 'all' || activeFilter
    if (!hasAnyFilter || activeFilter === 'tutte') return 'Anagrafiche Persone'
    if (activeFilter) {
      const labels: Record<string, string> = {
        'seniores': 'Seniores', 'juniores': 'Juniores', 'infortunati': 'Infortunati',
        'old': 'Old', 'allenatori': 'Allenatori', 'persone': 'Persone', 'lista-nera': 'Squalificati',
        'visite-saltate': 'Visite saltate', 'flowme': 'Flowme'
      }
      return `Anagrafiche ${labels[activeFilter] || activeFilter}`
    }
    if (categoryFilter !== 'all') return `Anagrafiche ${categoryFilter}`
    if (roleFilter !== 'all') return `Anagrafiche ${roleFilter}`
    if (birthYearFilter.trim()) return `Anagrafiche nati nel ${birthYearFilter.trim()}`
    if (searchTerm) return 'Risultati ricerca'
    return 'Anagrafiche filtrate'
  }

  // Funzione per gestire il click sulle card delle statistiche
  const handleStatsCardClick = (filterType: string) => {
    if (activeFilter === filterType) {
      // Se la card è già attiva, disattiva il filtro
      setActiveFilter(null)
    } else {
      // Attiva il filtro
      setActiveFilter(filterType)
    }
  }

  if (loading) {
    return (
      <div>
        {!embedInLayout && <Header title="Anagrafica" showBack={true} hideCenterLogo={true} />}
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">Caricamento in corso...</div>
          </div>
        </div>
      </div>
    )
  }

  const embedInGestionale = embedInLayout && !isMobileView
  const isDark = embedInGestionale

  return (
    <div className={`${isMobileView ? (deviceType === 'tablet' ? 'flowme-mobile flowme-mobile--tablet max-w-5xl mx-auto' : 'flowme-mobile flowme-mobile--phone') : ''} ${embedInGestionale ? 'min-h-full' : ''}`}>
      {!embedInLayout && <Header title="Anagrafica" showBack={true} hideCenterLogo={true} />}
      
      <div className={isMobileView ? (deviceType === 'tablet' ? 'p-4 md:p-6' : 'p-3 sm:p-4') : 'p-6'}>
        {/* Filtri */}
        <div className={`p-4 rounded-2xl shadow-lg mb-6 ${isDark ? 'bg-slate-800 border border-slate-600/80' : 'bg-slate-50 border border-slate-200'}`}>
          {/* Indicatore filtro attivo */}
          <div className="flex flex-wrap gap-4">
            {/* Ricerca */}
            <div className="relative flex-1 min-w-[140px]">
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-blue-200' : 'text-gray-700'}`}>Ricerca</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nome, email, codice fiscale, numero tessera..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full px-3 py-2 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'border border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:bg-white/15' : 'border border-slate-200 bg-white/80 focus:bg-white text-gray-900 placeholder:text-slate-400'}`}
                />
                {(searchTerm || roleFilter !== 'all' || categoryFilter !== 'all' || birthYearFilter.trim() || statusFilter !== 'all' || activeFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('')
                      setRoleFilter('all')
                      setCategoryFilter('all')
                      setBirthYearFilter('')
                      setStatusFilter('all')
                      setActiveFilter(null)
                      saveFiltersToStorage({ searchTerm: '', roleFilter: 'all', categoryFilter: 'all', birthYearFilter: '', statusFilter: 'all', activeFilter: null })
                    }}
                    title="Resetta tutti i filtri"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isDark ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-200/80'}`}
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden />
                  </button>
                )}
              </div>
            </div>

            {/* Filtro ruolo */}
            <div className="flex-1 min-w-[140px]">
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-blue-200' : 'text-gray-700'}`}>Ruolo</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px] ${isDark ? 'border border-white/20 bg-white/10 text-white' : 'border border-slate-200 bg-white/80 text-gray-900'}`}
                style={isDark ? { colorScheme: 'dark' } : { colorScheme: 'light' }}
              >
                <option value="all" className={isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-gray-900'}>Tutti i ruoli</option>
                {availableRoles                  .map((role) => (
                    <option key={role} value={role} className={isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-gray-900'}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro per categoria */}
            <div className="flex-1 min-w-[140px]">
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-blue-200' : 'text-gray-700'}`}>Filtro per categoria</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px] ${isDark ? 'border border-white/20 bg-white/10 text-white' : 'border border-slate-200 bg-white/80 text-gray-900'}`}
                style={isDark ? { colorScheme: 'dark' } : { colorScheme: 'light' }}
              >
                <option value="all" className={isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-gray-900'}>Tutte le categorie</option>
                {(allCategoriesData || [])
                  .filter(c => c.active !== false)
                  .filter(c => {
                    const n = (c.name || '').trim().toLowerCase()
                    return n !== 'seniores' && n !== 'senior'
                  })
                  .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999))
                  .map((c) => (
                    <option key={c.id} value={c.name} className={isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-gray-900'}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Filtro anno di nascita */}
            <div className="flex-1 min-w-[140px]">
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-blue-200' : 'text-gray-700'}`}>Anno di nascita</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="es. 2010"
                value={birthYearFilter}
                onChange={(e) => setBirthYearFilter(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px] ${isDark ? 'border border-white/20 bg-white/10 text-white placeholder:text-white/50' : 'border border-slate-200 bg-white/80 text-gray-900'}`}
              />
            </div>

            {/* Filtro stato (attivo / in attesa / inattivo) */}
            <div className="flex-1 min-w-[140px]">
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-blue-200' : 'text-gray-700'}`}>Stato</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px] ${isDark ? 'border border-white/20 bg-white/10 text-white' : 'border border-slate-200 bg-white/80 text-gray-900'}`}
                style={isDark ? { colorScheme: 'dark' } : { colorScheme: 'light' }}
              >
                <option value="all" className={isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-gray-900'}>Tutti gli stati</option>
                <option value="active" className={isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-gray-900'}>Attivo</option>
                <option value="pending" className={isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-gray-900'}>In attesa</option>
                <option value="inactive" className={isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-gray-900'}>Inattivo</option>
              </select>
            </div>

            {/* Pulsante Nuova Persona */}
            {!isReadOnly && !embedInLayout && (
              <div className="flex items-end flex-shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/create-person')}
                  title="Nuova Persona"
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-xl font-light"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Statistiche: 5 card sopra, 5 sotto */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div 
            className={`flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center ${
              isDark
                ? `bg-gradient-to-br from-blue-900 to-slate-800 border ${activeFilter === 'tutte' ? 'ring-2 ring-blue-400 border-blue-500/50' : 'border-white/10 hover:border-blue-500/30'}`
                : `bg-slate-50 border border-slate-200 hover:shadow-md ${activeFilter === 'tutte' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-slate-100'}`
            }`}
            onClick={() => handleStatsCardClick('tutte')}
          >
            <div className={`text-2xl font-bold ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>{filteredPeople.length}</div>
            <div className={`text-sm ${isDark ? 'text-blue-200/90' : 'text-gray-600'}`}>{getMainCardTitle()}</div>
          </div>
          <div 
            className={`flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center ${
              isDark
                ? `bg-gradient-to-br from-violet-900 to-slate-800 border ${activeFilter === 'seniores' ? 'ring-2 ring-violet-400 border-violet-500/50' : 'border-white/10 hover:border-violet-500/30'}`
                : `bg-slate-50 border border-slate-200 hover:shadow-md ${activeFilter === 'seniores' ? 'ring-2 ring-purple-500 bg-purple-50' : 'hover:bg-slate-100'}`
            }`}
            onClick={() => handleStatsCardClick('seniores')}
          >
            <div className={`text-2xl font-bold ${isDark ? 'text-violet-300' : 'text-purple-600'}`}>
              {(() => {
                const seniores = activeOnlyPeople.filter(p => {
                  const isGiocatore = p.role.includes('Giocatore')
                  
                  // Mappa le categorie da UUID a nomi leggibili per la verifica
                  const readableCategories = p.categories?.map(category => {
                    // Se la categoria è già una stringa (nome), usala direttamente
                    if (typeof category === 'string' && !category.includes('-')) {
                      return category
                    }
                    // Se è un UUID, cerca il nome corrispondente
                    const categoryData = allCategoriesData?.find(c => c.id === category)
                    return categoryData?.name || category
                  }) || []
                  
                  const hasSenioresCategory = readableCategories.some(cat => 
                    cat.includes('Seniores') || cat.includes('SENIORES') || cat.includes('Senior') || cat.includes('senior')
                  )
                  return isGiocatore && hasSenioresCategory
                })
                const injuredSeniores = seniores.filter(p => p.injured)
                return `${seniores.length}${injuredSeniores.length > 0 ? `/${injuredSeniores.length}` : ''}`
              })()}
            </div>
            <div className={`text-sm ${isDark ? 'text-violet-200/90' : 'text-gray-600'}`}>Seniores</div>
          </div>
          <div 
            className={`flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center ${
              isDark
                ? `bg-gradient-to-br from-emerald-900 to-slate-800 border ${activeFilter === 'juniores' ? 'ring-2 ring-emerald-400 border-emerald-500/50' : 'border-white/10 hover:border-emerald-500/30'}`
                : `bg-slate-50 border border-slate-200 hover:shadow-md ${activeFilter === 'juniores' ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'hover:bg-slate-100'}`
            }`}
            onClick={() => handleStatsCardClick('juniores')}
          >
            <div className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-indigo-600'}`}>
              {(() => {
                const juniores = activeOnlyPeople.filter(p => {
                  const isGiocatore = p.role.includes('Giocatore')
                  if (!isGiocatore) return false
                  
                  // Usa solo le categorie da giocatore, non quelle da staff
                  const playerCategories = p.playerCategories || []
                  
                  // Verifica se ha una categoria Juniores (U6, U8, U10, U12, U14, U16, U18)
                  const junioresCategories = ['U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Under 6', 'Under 8', 'Under 10', 'Under 12', 'Under 14', 'Under 16', 'Under 18']
                  const hasJunioresCategory = playerCategories.some(cat => 
                    junioresCategories.some(junioresCat => 
                      cat.includes(junioresCat) || cat === junioresCat
                    )
                  )
                  // Debug log rimosso per evitare loop infiniti
                  return hasJunioresCategory
                })
                const injuredJuniores = juniores.filter(p => p.injured)
                // Debug log rimosso per evitare loop infiniti
                return `${juniores.length}${injuredJuniores.length > 0 ? `/${injuredJuniores.length}` : ''}`
              })()}
            </div>
            <div className={`text-sm ${isDark ? 'text-emerald-200/90' : 'text-gray-600'}`}>Juniores</div>
          </div>
          <div 
            className={`flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center ${
              isDark
                ? `bg-gradient-to-br from-amber-900 to-slate-800 border ${activeFilter === 'old' ? 'ring-2 ring-amber-400 border-amber-500/50' : 'border-white/10 hover:border-amber-500/30'}`
                : `bg-slate-50 border border-slate-200 hover:shadow-md ${activeFilter === 'old' ? 'ring-2 ring-amber-500 bg-amber-50' : 'hover:bg-slate-100'}`
            }`}
            onClick={() => handleStatsCardClick('old')}
          >
            <div className={`text-2xl font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
              {(() => {
                const old = activeOnlyPeople.filter(p => {
                  const isGiocatore = p.role.includes('Giocatore')
                  if (!isGiocatore) return false
                  
                  // Usa solo le categorie da giocatore, non quelle da staff
                  const playerCategories = p.playerCategories || []
                  
                  // Verifica se ha una categoria Old (Poderosa, GussagOld, Brixia Old)
                  const oldCategories = ['Poderosa', 'GussagOld', 'Brixia Old', 'GUSSAGOLD', 'BRIXIAOLD', 'PODEROSA']
                  const hasOldCategory = playerCategories.some(cat => 
                    oldCategories.some(oldCat => 
                      cat.includes(oldCat) || cat === oldCat
                    )
                  )
                  // Debug log rimosso per evitare loop infiniti
                  return hasOldCategory
                })
                const injuredOld = old.filter(p => p.injured)
                // Debug log rimosso per evitare loop infiniti
                return `${old.length}${injuredOld.length > 0 ? `/${injuredOld.length}` : ''}`
              })()}
            </div>
            <div className={`text-sm ${isDark ? 'text-amber-200/90' : 'text-gray-600'}`}>Old</div>
          </div>
          <div 
            className={`flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center ${
              isDark
                ? `bg-gradient-to-br from-rose-900 to-slate-800 border ${activeFilter === 'allenatori' ? 'ring-2 ring-rose-400 border-rose-500/50' : 'border-white/10 hover:border-rose-500/30'}`
                : `bg-slate-50 border border-slate-200 hover:shadow-md ${activeFilter === 'allenatori' ? 'ring-2 ring-red-500 bg-red-50' : 'hover:bg-slate-100'}`
            }`}
            onClick={() => handleStatsCardClick('allenatori')}
          >
            <div className={`text-2xl font-bold ${isDark ? 'text-rose-300' : 'text-red-600'}`}>
              {activeOnlyPeople.filter(p => p.role.includes('Allenatore')).length}
            </div>
            <div className={`text-sm ${isDark ? 'text-rose-200/90' : 'text-gray-600'}`}>Totale Allenatori</div>
          </div>
          <div 
            className={`flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center ${
              isDark
                ? `bg-gradient-to-br from-slate-700 to-slate-800 border ${activeFilter === 'persone' ? 'ring-2 ring-slate-400 border-slate-500/50' : 'border-white/10 hover:border-slate-500/30'}`
                : `bg-slate-50 border border-slate-200 hover:shadow-md ${activeFilter === 'persone' ? 'ring-2 ring-gray-500 bg-gray-50' : 'hover:bg-slate-100'}`
            }`}
            onClick={() => handleStatsCardClick('persone')}
          >
            <div className={`text-2xl font-bold ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
              {activeOnlyPeople.filter(p => {
                const isAdmin = p.role.includes('Admin')
                const role = (p.role || '').toLowerCase()
                const isStaffRole = role === 'persona' ||
                  role.includes('fisio') ||
                  role.includes('fisioterapista') ||
                  role.includes('medico') ||
                  role.includes('team manager') ||
                  (role.includes('preparatore atletico') || role.includes('preparatori atletici')) ||
                  role.includes('dirigente') ||
                  role.includes('segreteria')
                return !isAdmin && isStaffRole
              }).length}
            </div>
            <div className={`text-sm ${isDark ? 'text-slate-200/90' : 'text-gray-600'}`}>Totale Staff</div>
          </div>
          <div 
            className={`flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center ${
              isDark
                ? `bg-gradient-to-br from-amber-800 to-slate-800 border ${activeFilter === 'infortunati' ? 'ring-2 ring-amber-400 border-amber-500/50' : 'border-white/10 hover:border-amber-500/30'}`
                : `bg-slate-50 border border-slate-200 hover:shadow-md ${activeFilter === 'infortunati' ? 'ring-2 ring-amber-500 bg-amber-50' : 'hover:bg-slate-100'}`
            }`}
            onClick={() => handleStatsCardClick('infortunati')}
          >
            <div className={`text-2xl font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
              {activeOnlyPeople.filter(p => p.injured === true).length}
            </div>
            <div className={`text-sm ${isDark ? 'text-amber-200/90' : 'text-gray-600'}`}>Infortunati</div>
          </div>
          <div 
            className={`flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center ${
              isDark
                ? `bg-gradient-to-br from-red-900 to-slate-800 border ${activeFilter === 'lista-nera' ? 'ring-2 ring-red-400 border-red-500/50' : 'border-white/10 hover:border-red-500/30'}`
                : `bg-slate-50 border border-slate-200 hover:shadow-md ${activeFilter === 'lista-nera' ? 'ring-2 ring-red-600 bg-red-50' : 'hover:bg-slate-100'}`
            }`}
            onClick={() => handleStatsCardClick('lista-nera')}
          >
            <div className={`text-2xl font-bold ${isDark ? 'text-red-300' : 'text-red-600'}`}>
              {activeOnlyPeople.filter(p => p.disqualified === true).length}
            </div>
            <div className={`text-sm ${isDark ? 'text-red-200/90' : 'text-gray-600'}`}>Squalificati</div>
          </div>
          <div 
            className={`flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center ${
              isDark
                ? `bg-gradient-to-br from-amber-700 to-slate-800 border ${activeFilter === 'visite-saltate' ? 'ring-2 ring-amber-400 border-amber-500/50' : 'border-white/10 hover:border-amber-500/30'}`
                : `bg-slate-50 border border-slate-200 hover:shadow-md ${activeFilter === 'visite-saltate' ? 'ring-2 ring-amber-500 bg-amber-50' : 'hover:bg-slate-100'}`
            }`}
            onClick={() => handleStatsCardClick('visite-saltate')}
          >
            <div className={`text-2xl font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
              {activeOnlyPeople.filter(p => personIdsVisiteSaltate.includes(p.id)).length}
            </div>
            <div className={`text-sm ${isDark ? 'text-amber-200/90' : 'text-gray-600'}`}>Visite saltate</div>
          </div>
          <div 
            className={`flex-1 min-w-[160px] p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center ${
              isDark
                ? `bg-gradient-to-br from-sky-800 to-slate-800 border ${activeFilter === 'flowme' ? 'ring-2 ring-sky-400 border-sky-500/50' : 'border-white/10 hover:border-sky-500/30'}`
                : `bg-slate-50 border border-slate-200 hover:shadow-md ${activeFilter === 'flowme' ? 'ring-2 ring-sky-500 bg-sky-50' : 'hover:bg-slate-100'}`
            }`}
            onClick={() => handleStatsCardClick('flowme')}
          >
            <div className={`text-2xl font-bold ${isDark ? 'text-sky-300' : 'text-sky-600'}`}>
              {activeOnlyPeople.filter(p => p.invite_code != null && String(p.invite_code).trim().length > 0).length}
            </div>
            <div className={`text-sm ${isDark ? 'text-sky-200/90' : 'text-gray-600'}`}>TeamFlow / Flowme</div>
          </div>
        </div>

        {/* Lista persone */}
        <div className="rounded-2xl shadow-lg overflow-hidden bg-white border border-slate-200">
          {filteredPeople.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {searchTerm || roleFilter !== 'all' || categoryFilter !== 'all' || birthYearFilter.trim() || statusFilter !== 'all' || activeFilter
                ? 'Nessuna persona trovata con i filtri selezionati'
                : 'Nessuna persona presente nel sistema'
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-wider text-slate-500">
                      Persona
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-wider text-slate-500">
                      Età
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-wider text-slate-500">
                      Ruolo
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-wider text-slate-500">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    {!isReadOnly && (
                      <th className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-wider text-slate-500">
                        Azioni
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredPeople.map((person, index) => {
                    const rowStyle = person.disqualified 
                      ? { bg: 'bg-red-50 hover:bg-red-100', stripe: 'border-l-4 border-red-400' }
                      : (() => {
                          if (person.injured && person.injury_date && person.injury_duration_days) {
                            const daysRemaining = getDaysUntilInjuryEnd(person.injury_date, person.injury_duration_days)
                            if (daysRemaining > 0) return { bg: 'bg-orange-50 hover:bg-orange-100', stripe: 'border-l-4 border-orange-400' }
                          }
                          if (person.injured) return { bg: 'bg-orange-50 hover:bg-orange-100', stripe: 'border-l-4 border-orange-400' }
                          const roleLower = (person.role || '').toLowerCase()
                          if (roleLower.includes('fisio') || roleLower.includes('fisioterapista')) return { bg: 'hover:bg-slate-50', stripe: 'border-l-4 border-pink-500' }
                          if (roleLower.includes('medico') || roleLower.includes('medicina')) return { bg: 'hover:bg-slate-50', stripe: 'border-l-4 border-red-500' }
                          if (roleLower.includes('team manager')) return { bg: 'hover:bg-slate-50', stripe: 'border-l-4 border-green-500' }
                          return { bg: `${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-slate-100`, stripe: '' }
                        })()
                    return (
                    <tr 
                      key={person.id} 
                      className={`cursor-pointer ${rowStyle.bg}`}
                      onDoubleClick={!isReadOnly ? () => { saveScrollPosition(); setPeopleNavIds(filteredPeople.map((p) => p.id)); navigate(`/create-person?edit=${person.id}`) } : undefined}
                    >
                      <td className={`px-6 py-4 whitespace-nowrap ${rowStyle.stripe}`}>
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-blue-100">
                              <span className="text-base font-semibold text-blue-700">
                                {person.given_name?.[0]}{person.family_name?.[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-base font-semibold text-slate-900">
                              {formatDisplayPersonName(person.full_name)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base text-slate-700">
                        {person.age} anni
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {person.role.split(' + ').map((rolePart, idx) => {
                            const isGiocatore = rolePart.trim() === 'Giocatore'
                            const displayText = isGiocatore
                              ? (person.player_positions && person.player_positions.length > 0
                                  ? getPositionNames(person.player_positions).map(getPositionDisplayName).join(', ')
                                  : '—')
                              : rolePart.trim()
                            return (
                              <span
                                key={idx}
                                className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${getRoleColor(isGiocatore ? 'Giocatore' : rolePart.trim(), false)}`}
                              >
                                {displayText}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base text-slate-600">
                        {person.categories && person.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {person.categories
                              .map((category) => {
                                if (typeof category === 'string' && !category.includes('-')) {
                                  return category
                                }
                                const categoryData = allCategoriesData?.find(c => c.id === category)
                                return categoryData?.name || category
                              })
                              .map((readableCategory) => {
                                // Se è staff: non mostrare mai il tag "Senior"/"Seniores" in categoria
                                const roleStr = (person.role || '').trim()
                                const hasStaffRole = roleStr !== 'Giocatore' && roleStr !== 'Persona' && roleStr !== ''
                                const isStaff = hasStaffRole || (person as { staffCategories?: string[] }).staffCategories?.length > 0
                                if (isStaff) {
                                  const s = String(readableCategory).trim()
                                  const sLower = s.toLowerCase()
                                  if (sLower === 'seniores' || sLower === 'senior') return null
                                  if (sLower.startsWith('seniores ')) return s.replace(/^Seniores\s+/i, '')
                                  if (sLower.startsWith('senior ')) return s.replace(/^Senior\s+/i, '')
                                }
                                // Se è un giocatore (e non solo staff), stessa regola: non mostrare "Seniores"/"Senior"
                                if (person.role?.includes('Giocatore')) {
                                  const s = String(readableCategory).trim()
                                  const sLower = s.toLowerCase()
                                  if (sLower === 'seniores' || sLower === 'senior') return null
                                  if (sLower.startsWith('seniores ')) return s.replace(/^Seniores\s+/i, '')
                                  if (sLower.startsWith('senior ')) return s.replace(/^Senior\s+/i, '')
                                }
                                return readableCategory
                              })
                              .filter((c): c is string => c != null && c !== '')
                              .map((readableCategory, index) => (
                                <span 
                                  key={index}
                                  className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${getCategoryColor(readableCategory, false)}`}
                                >
                                  {readableCategory}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {person.disqualified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-700 border border-red-300">
                            SQUALIFICATO
                            {person.disqualification_end_date && (
                              <span className="font-normal">
                                {formatDaysRemaining(getDaysUntilDisqualificationExpiry(person.disqualification_end_date))}
                              </span>
                            )}
                          </span>
                        ) : person.injured ? (
                          person.injury_date && person.injury_duration_days ? (
                            (() => {
                              const daysRemaining = getDaysUntilInjuryEnd(person.injury_date, person.injury_duration_days)
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-semibold rounded-full bg-orange-100 text-orange-700 border border-orange-300">
                                  INFORTUNATO {formatInjuryDaysRemaining(daysRemaining)}
                                </span>
                              )
                            })()
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-semibold rounded-full bg-orange-100 text-orange-700 border border-orange-300">
                              INFORTUNATO (in corso)
                            </span>
                          )
                        ) : (
                          <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${getStatusColor(person.status, false)}`}>
                            {person.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base font-medium">
                        {!isReadOnly && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveScrollPosition();
                                setPeopleNavIds(filteredPeople.map((p) => p.id));
                                navigate(`/create-person?edit=${person.id}`);
                              }}
                              title="Modifica"
                              className="p-2 rounded-lg transition-colors text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                            >
                              <Pencil className="w-4 h-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteModal(person);
                              }}
                              title="Elimina"
                              className="p-2 rounded-lg transition-colors text-red-600 hover:bg-red-50 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteModalPerson(null) }}
        onConfirm={() => deleteModalPerson && handleDeletePerson(deleteModalPerson.id)}
        title="Elimina persona"
        message="Sei sicuro di voler eliminare questa persona? Questa azione eliminerà anche tutti i dati correlati (profili, ruoli, ecc.) e non può essere annullata."
        itemName={deleteModalPerson?.name ?? ''}
        itemNameInMessage={false}
        loading={deleteInProgress}
        dark={isDark}
      />
    </div>
  )
}


