import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/store/auth'

export type Category = { id: string; code: 'U6'|'U8'|'U10'|'U12'|'U14'|'U16'|'U18'|'SERIE_C'|'SERIE_B'|'SENIORES'|'PODEROSA'|'GUSSAGOLD'|'BRIXIAOLD'|'LEONESSE' }
export type Player = { id: string; given_name: string; family_name: string; first_name?: string; last_name?: string; birth_date?: string|null; injured: boolean }
export type Session = { id: string; session_date: string; category_id: string; location: string; away_place?: string|null; created_at?: string; completed_at?: string; categories?: { id: string; code: string; name: string }[] }
export type Status = 'PRESENTE'|'ASSENTE'|'INFORTUNATO'|'MALATO'|'PERMESSO'
export type InjuredPlace = 'CASA'|'PALESTRA'

interface DataState {
  myCategories: Category[]
  currentCategory: Category | null
  currentSession: Session | null
  players: Player[]
  attendance: Record<string, { status: Status; injured_place?: InjuredPlace }>
  loadMyCategories: () => Promise<void>
  pickCategory: (c: Category) => void
  startSession: (p: { date: string; category_id: string; location: Session['location']; away_place?: string }) => Promise<void>
  loadPlayers: (categoryId: string, sessionId?: string) => Promise<void>
  setAttendance: (sessionId: string, playerId: string, status: Status, injured_place?: InjuredPlace) => Promise<void>
  removeAttendance: (sessionId: string, playerId: string) => Promise<void>
  setCurrentSession: (session: Session | null) => void
  setCurrentCategory: (category: Category | null) => void
}

export const useData = create<DataState>((set, get) => ({
  myCategories: [],
  currentCategory: null,
  currentSession: null,
  players: [],
  attendance: {},

  async loadMyCategories() {
    const profile = useAuth.getState().profile
    if (profile?.is_super_admin || profile?.role === 'Admin') {
      const { data, error } = await supabase
        .from('categories')
        .select('id, code, active')
        .eq('active', true)
      if (error) throw error
      set({ myCategories: (data ?? []) as Category[] })
      return
    }
    const { data, error } = await supabase
      .from('staff_categories')
      .select('categories(id, code, active)')
      .eq('categories.active', true)
    if (error) throw error
    const cats = (data ?? []).map((r: any) => r.categories)
    set({ myCategories: cats })
  },

  pickCategory(c) { set({ currentCategory: c }) },

  async startSession({ date, category_id, location, away_place }) {
    const { data, error } = await supabase.from('sessions').insert({ session_date: date, category_id, location, away_place }).select('*').single()
    if (error) throw error
    set({ currentSession: data as Session })
  },

  async loadPlayers(categoryId, sessionId?: string) {
    let sessionDateOnly: string | null = null
    if (sessionId) {
      const { data: sessionData } = await supabase.from('sessions').select('session_date').eq('id', sessionId).single()
      sessionDateOnly = sessionData?.session_date ? new Date(sessionData.session_date).toISOString().split('T')[0] : null
    }

    // Carica tutti i giocatori dalla tabella people
    const { data: allPlayers, error } = await supabase
      .from('people')
      .select('*')
      .order('family_name', { ascending: true })

    if (error) {
      console.error('❌ Errore nel caricamento giocatori:', error)
      set({ players: [] })
      return
    }

    // Filtra i giocatori per categoria usando player_categories
    let players = (allPlayers || []).filter((player: any) => {
      if (!player.player_categories) return false
      
      // player_categories è un array di ID categorie (UUID)
      let categories: any[]
      if (Array.isArray(player.player_categories)) {
        categories = player.player_categories
      } else if (typeof player.player_categories === 'string') {
        try {
          categories = JSON.parse(player.player_categories)
        } catch (e) {
          console.error('❌ Errore parsing player_categories per giocatore:', player.id, player.player_categories)
          return false
        }
      } else {
        return false
      }
      
      if (!categories.includes(categoryId)) return false
      if (sessionDateOnly && player.created_at) {
        try {
          const playerCreated = new Date(player.created_at).toISOString().split('T')[0]
          if (playerCreated > sessionDateOnly) return false
        } catch (_) {}
      }
      return true
    })

    // Se Seniores, includi anche i giocatori U18 che sono aggregati (CADETTA o PRIMA)
    if (categoryId === '9a44ff5b-db15-4328-9752-2d8de549e588') { // ID di Seniores
      const u18CategoryId = 'd9c82f91-8087-47f5-9b90-9b729572f0e8' // U18
      
      // Carica le categorie per verificare i codici
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, code')
      
      const categoryCodeMap = new Map((categoriesData || []).map((c: any) => [c.id, c.code]))
      const aggregatedCodes = new Set(['CADETTA', 'PRIMA'])
      
      const u18AggregatedPlayers = (allPlayers || []).filter((player: any) => {
        if (!player.player_categories) return false
        const categories = Array.isArray(player.player_categories) 
          ? player.player_categories 
          : JSON.parse(player.player_categories || '[]')
        const hasU18 = categories.includes(u18CategoryId)
        const hasAggregatedCategory = categories.some((catId: string) => {
          const code = categoryCodeMap.get(catId)
          return code && aggregatedCodes.has(code)
        })
        if (!hasU18 || !hasAggregatedCategory) return false
        if (sessionDateOnly && player.created_at) {
          try {
            const playerCreated = new Date(player.created_at).toISOString().split('T')[0]
            if (playerCreated > sessionDateOnly) return false
          } catch (_) {}
        }
        return true
      })
      
      // Rimuovi duplicati
      const existingIds = players.map(p => p.id)
      const newPlayers = u18AggregatedPlayers.filter(p => !existingIds.includes(p.id))
      players = [...players, ...newPlayers]
    }
    
    set({ players })

    // Se è stata fornita una sessionId, carica anche gli status salvati
    if (sessionId) {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('player_id, status, injured_place')
        .eq('session_id', sessionId)

      if (attendanceError) {
        console.error('❌ Errore nel caricamento status salvati:', attendanceError)
        return
      }

      // Crea la mappa degli status usando session_id-player_id come chiave
      const attendanceMap = (attendanceData || []).reduce((acc, record) => {
        acc[`${sessionId}-${record.player_id}`] = { 
          status: record.status as Status, 
          injured_place: record.injured_place as InjuredPlace 
        }
        return acc
      }, {} as Record<string, { status: Status; injured_place?: InjuredPlace }>)

      set({ attendance: attendanceMap })
    }
  },

  async setAttendance(sessionId, player_id, status, injured_place) {
    if (!sessionId) {
      console.error('❌ Session ID mancante:', sessionId)
      throw new Error('Session ID mancante')
    }
    if (!player_id) {
      console.error('❌ Player ID mancante:', player_id)
      throw new Error('Player ID mancante')
    }
    if (status === 'INFORTUNATO' && !injured_place) throw new Error('Se infortunato, serve Casa/Palestra')

    // Controlla se la sessione è modificabile (entro 7 giorni dal completamento)
    const { data: session } = await supabase
      .from('sessions')
      .select('completed_at')
      .eq('id', sessionId)
      .single()

    if (session?.completed_at) {
      const completedDate = new Date(session.completed_at)
      const now = new Date()
      const daysSinceCompletion = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysSinceCompletion > 7) {
        const errorMsg = `Sessione completata ${daysSinceCompletion} giorni fa. Le modifiche sono consentite solo entro 7 giorni dal completamento.`
        alert(errorMsg)
        throw new Error(errorMsg)
      }
    }

    const payload: any = { session_id: sessionId, player_id, status }
    if (status === 'INFORTUNATO') payload.injured_place = injured_place



    // Prima verifica che il player_id esista nella tabella people
    const { data: playerExists, error: playerCheckError } = await supabase
      .from('people')
      .select('id')
      .eq('id', player_id)
      .single()

    if (playerCheckError || !playerExists) {
      console.error('❌ Player ID non trovato nella tabella people:', {
        player_id,
        error: playerCheckError,
        exists: playerExists
      })
      throw new Error(`Player ID ${player_id} non trovato nel database`)
    }

    // Poi elimina eventuali record esistenti per questo giocatore e sessione
    const { error: deleteError } = await supabase
      .from('attendance')
      .delete()
      .eq('session_id', sessionId)
      .eq('player_id', player_id)

    if (deleteError) {
      console.error('❌ Errore nella cancellazione record esistenti:', deleteError)
    }

    // Poi inserisci il nuovo record
    const { data: insertData, error } = await supabase.from('attendance').insert(payload).select()
    if (error) {
      console.error('❌ Errore nell\'inserimento nuovo record:', error)
      throw error
    }



    // Aggiorna lo stato locale
    set(state => ({
      attendance: {
        ...state.attendance,
        [`${sessionId}-${player_id}`]: { status, injured_place }
      }
    }))

    // Controlla se la sessione è ora completa e aggiorna completed_at
    try {
      const state = get()
      const currentSession = state.currentSession
      
      if (currentSession && currentSession.id === sessionId && !currentSession.completed_at) {
        // Conta quanti giocatori hanno uno status
        const markedCount = Object.keys(state.attendance).filter(key => key.startsWith(`${sessionId}-`)).length
        const totalPlayers = state.players.length

        if (markedCount >= totalPlayers && totalPlayers > 0) {
          await supabase
            .from('sessions')
            .update({ completed_at: new Date().toISOString() })
            .eq('id', sessionId)

          console.log(`✅ Sessione completata! Modificabile per 7 giorni.`)
        }
      }
    } catch (error) {
      console.error('Errore nel controllo completamento:', error)
    }

    // Trigger per aggiornare lo status della sessione (se siamo in Activities)
    if (typeof window !== 'undefined' && (window as any).updateSessionStatus) {

      ;(window as any).updateSessionStatus(sessionId)
    }
  },

  setCurrentSession(session) {
    set({ currentSession: session })
  },

  setCurrentCategory(category) {
    set({ currentCategory: category })
  },

  async removeAttendance(sessionId, playerId) {
    // Controlla se la sessione è modificabile (entro 7 giorni dal completamento)
    const { data: session } = await supabase
      .from('sessions')
      .select('completed_at')
      .eq('id', sessionId)
      .single()

    if (session?.completed_at) {
      const completedDate = new Date(session.completed_at)
      const now = new Date()
      const daysSinceCompletion = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysSinceCompletion > 7) {
        const errorMsg = `Sessione completata ${daysSinceCompletion} giorni fa. Le modifiche sono consentite solo entro 7 giorni dal completamento.`
        alert(errorMsg)
        throw new Error(errorMsg)
      }
    }

    // Rimuovi subito dallo stato locale per feedback immediato
    set(state => {
      const newAttendance = { ...state.attendance }
      delete newAttendance[`${sessionId}-${playerId}`]
      return { attendance: newAttendance }
    })

    // Cancella dal database
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('session_id', sessionId)
      .eq('player_id', playerId)

    if (error) {
      console.error('❌ Errore nella rimozione attendance:', error)
      throw error
    }
    
    // Trigger per aggiornare lo status della sessione (se siamo in Activities)
    if (typeof window !== 'undefined' && (window as any).updateSessionStatus) {
      ;(window as any).updateSessionStatus(sessionId)
    }
  }
}))
