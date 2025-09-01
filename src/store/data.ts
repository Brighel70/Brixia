import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'

export type Category = { id: string; code: 'U6'|'U8'|'U10'|'U12'|'U14'|'U16'|'U18'|'SENIORES'|'PODEROSA'|'GUSSAGOLD'|'BRIXIAOLD'|'LEONESSE' }
export type Player = { id: string; first_name: string; last_name: string; birth_year?: number|null; injured: boolean; aggregated_seniores: boolean }
export type Session = { id: string; session_date: string; category_id: string; location: 'Brescia'|'Gussago'|'Ospitaletto'|'Trasferta'; away_place?: string|null }
export type Status = 'PRESENTE'|'ASSENTE'|'INFORTUNATO'|'PERMESSO'|'MALATO'
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

  async loadPlayers(categoryId) {
    // base lista categoria
    const base = await supabase
      .from('player_categories')
      .select('players(*)')
      .eq('category_id', categoryId)

    if (base.error) throw base.error
    let players = (base.data ?? []).map((r: any) => r.players)

    // se Seniores, includi U18 aggregati
    const cat = get().myCategories.find(c => c.id === categoryId)
    if (cat?.code === 'SENIORES') {
      const u18Agg = await supabase
        .from('player_categories')
        .select('players(*) , categories!inner(code)')
        .eq('categories.code', 'U18')
      if (!u18Agg.error) {
        const extra = (u18Agg.data ?? [])
          .map((r: any) => r.players)
          .filter((p: any) => p.aggregated_seniores)
        players = [...players, ...extra].reduce((acc: any[], p: any) => {
          if (!acc.find(a => a.id === p.id)) acc.push(p); return acc
        }, [])
      }
    }

    set({ players })
  },

  async setAttendance(player_id, status, injured_place) {
    const session = get().currentSession
    if (!session) throw new Error('Nessuna sessione attiva')
    if (status === 'INFORTUNATO' && !injured_place) throw new Error('Se infortunato, serve Casa/Palestra')

    const payload: any = { session_id: session.id, player_id, status }
    if (status === 'INFORTUNATO') payload.injured_place = injured_place

    const { error } = await supabase.from('attendance').upsert(payload)
    if (error) throw error

    set(state => ({
      attendance: {
        ...state.attendance,
        [player_id]: { status, injured_place }
      }
    }))
  }
}))