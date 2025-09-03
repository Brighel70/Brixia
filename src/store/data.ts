import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'

export type Category = { id: string; code: 'U6'|'U8'|'U10'|'U12'|'U14'|'U16'|'U18'|'SERIE_C'|'SERIE_B'|'SENIORES'|'PODEROSA'|'GUSSAGOLD'|'BRIXIAOLD'|'LEONESSE' }
export type Player = { id: string; first_name: string; last_name: string; birth_date?: string|null; injured: boolean; aggregated_seniores: boolean }
export type Session = { id: string; session_date: string; category_id: string; location: 'Brescia'|'Gussago'|'Ospitaletto'|'Trasferta'; away_place?: string|null }
export type Status = 'PRESENTE'|'ASSENTE'|'INFORTUNATO'|'MALATO'
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
  loadPlayers: (categoryId: string) => Promise<void>
  setAttendance: (playerId: string, status: Status, injured_place?: InjuredPlace) => Promise<void>
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

    
    // SOLUZIONE TEMPORANEA: Carica tutti i giocatori e filtra per categoria basandosi sul FIR code
    const { data: allPlayers, error } = await supabase
      .from('players')
      .select('*')
      .order('last_name', { ascending: true })

    if (error) throw error

    // Trova la categoria per ottenere il codice
    let cat = get().myCategories.find(c => c.id === categoryId)


    // Se non trovata in myCategories, cerca direttamente nel database
    if (!cat) {

      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, code, name')
        .eq('id', categoryId)
        .single()
      
      if (categoryError) {
        console.error('❌ Errore nel caricamento categoria:', categoryError)
        set({ players: [] })
        return
      }
      
      cat = categoryData

    }

    // Filtra i giocatori basandosi sul codice FIR
    let players = (allPlayers ?? []).filter((player: any) => {
      if (!player.fir_code) return false
      
      const firParts = player.fir_code.split('-')
      if (firParts.length < 2) return false
      
      const categoryCode = firParts[1] // Es: FIR-U6-LR-001 -> U6
      
      // Mappa i codici alle categorie
      const categoryMapping = {
        'U6': 'U6',
        'U8': 'U8', 
        'U10': 'U10',
        'U12': 'U12',
        'U14': 'U14',
        'U16': 'U16',
        'U18': 'U18',
        'SC': 'SERIE_C',
        'SB': 'SERIE_B',
        'POD': 'PODEROSA',
        'GUS': 'GUSSAGOLD',
        'BRI': 'BRIXIAOLD',
        'LEO': 'LEONESSE'
      }
      
      const mappedCategory = categoryMapping[categoryCode]
      return mappedCategory === cat.code
    })



    // se Seniores, includi U18 aggregati
    if (cat.code === 'SENIORES') {
      const u18Players = (allPlayers ?? []).filter((player: any) => {
        if (!player.fir_code) return false
        const firParts = player.fir_code.split('-')
        if (firParts.length < 2) return false
        const categoryCode = firParts[1]
        return categoryCode === 'U18' && player.aggregated_seniores
      })
      
      players = [...players, ...u18Players].reduce((acc: any[], p: any) => {
        if (!acc.find(a => a.id === p.id)) acc.push(p); return acc
      }, [])
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

      // Crea la mappa degli status
      const attendanceMap = (attendanceData || []).reduce((acc, record) => {
        acc[record.player_id] = { 
          status: record.status as Status, 
          injured_place: record.injured_place as InjuredPlace 
        }
        return acc
      }, {} as Record<string, { status: Status; injured_place?: InjuredPlace }>)

      set({ attendance: attendanceMap })
    }
  },

  async setAttendance(player_id, status, injured_place) {
    const session = get().currentSession
    if (!session) throw new Error('Nessuna sessione attiva')
    if (status === 'INFORTUNATO' && !injured_place) throw new Error('Se infortunato, serve Casa/Palestra')



    const payload: any = { session_id: session.id, player_id, status }
    if (status === 'INFORTUNATO') payload.injured_place = injured_place



    // Prima elimina eventuali record esistenti per questo giocatore e sessione
    const { error: deleteError } = await supabase
      .from('attendance')
      .delete()
      .eq('session_id', session.id)
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
        [player_id]: { status, injured_place }
      }
    }))



    // Trigger per aggiornare lo status della sessione (se siamo in Activities)
    if (typeof window !== 'undefined' && (window as any).updateSessionStatus) {

      ;(window as any).updateSessionStatus(session.id)
    }
  },

  setCurrentSession(session) {
    set({ currentSession: session })
  },

  setCurrentCategory(category) {
    set({ currentCategory: category })
  }
}))