import { supabase } from './supabaseClient'

// Cache per query frequenti
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

// TTL per diversi tipi di query (in millisecondi)
const CACHE_TTL = {
  CATEGORIES: 5 * 60 * 1000, // 5 minuti
  PLAYERS: 2 * 60 * 1000, // 2 minuti
  SESSIONS: 1 * 60 * 1000, // 1 minuto
  EVENTS: 2 * 60 * 1000, // 2 minuti
  STAFF: 5 * 60 * 1000, // 5 minuti
  STATS: 30 * 1000, // 30 secondi
  DEFAULT: 60 * 1000 // 1 minuto
}

interface QueryOptions {
  useCache?: boolean
  ttl?: number
  limit?: number
  offset?: number
  orderBy?: { column: string; ascending?: boolean }
  filters?: Record<string, any>
}

class QueryOptimizer {
  private static instance: QueryOptimizer
  private cache = queryCache

  static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer()
    }
    return QueryOptimizer.instance
  }

  private getCacheKey(table: string, options: QueryOptions = {}): string {
    const { filters = {}, orderBy, limit, offset } = options
    return `${table}:${JSON.stringify({ filters, orderBy, limit, offset })}`
  }

  private isCacheValid(key: string, ttl: number): boolean {
    const cached = this.cache.get(key)
    if (!cached) return false
    
    const now = Date.now()
    return (now - cached.timestamp) < ttl
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key)
    return cached ? cached.data : null
  }

  // Query ottimizzata per giocatori con categorie
  async getPlayersWithCategories(options: QueryOptions = {}) {
    const { useCache = true, ttl = CACHE_TTL.PLAYERS, limit = 100, offset = 0, orderBy = { column: 'last_name', ascending: true } } = options
    
    const cacheKey = this.getCacheKey('players_with_categories', options)
    
    if (useCache && this.isCacheValid(cacheKey, ttl)) {
      return this.getCachedData(cacheKey)
    }

    try {
      // Query ottimizzata con join
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          first_name,
          last_name,
          birth_date,
          fir_code,
          role_on_field,
          injured,
          aggregated_seniores,
          created_at,
          player_categories (
            category_id,
            categories (
              id,
              code,
              name,
              active
            )
          )
        `)
        .order(orderBy.column, { ascending: orderBy.ascending })
        .range(offset, offset + limit - 1)

      if (error) throw error

      // Trasforma i dati per facilitare l'uso
      const transformedData = data?.map(player => ({
        ...player,
        categories: player.player_categories
          ?.filter((pc: any) => pc.categories?.active)
          ?.map((pc: any) => pc.categories) || []
      })) || []

      if (useCache) {
        this.setCache(cacheKey, transformedData, ttl)
      }

      return transformedData
    } catch (error) {
      console.error('Errore nella query ottimizzata giocatori:', error)
      throw error
    }
  }

  // Query ottimizzata per sessioni con statistiche
  async getSessionsWithStats(categoryId: string, options: QueryOptions = {}) {
    const { useCache = true, ttl = CACHE_TTL.SESSIONS, limit = 50, offset = 0 } = options
    
    const cacheKey = this.getCacheKey(`sessions_stats_${categoryId}`, options)
    
    if (useCache && this.isCacheValid(cacheKey, ttl)) {
      return this.getCachedData(cacheKey)
    }

    try {
      // Query ottimizzata con aggregazioni
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          session_date,
          location,
          away_place,
          created_at,
          categories!inner (
            id,
            code,
            name
          ),
          attendance (
            id,
            status,
            players!inner (
              id,
              first_name,
              last_name
            )
          )
        `)
        .eq('category_id', categoryId)
        .order('session_date', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      // Calcola statistiche per ogni sessione
      const sessionsWithStats = data?.map(session => {
        const attendance = session.attendance || []
        const totalPlayers = attendance.length
        const presentCount = attendance.filter((a: any) => a.status === 'present').length
        const absentCount = attendance.filter((a: any) => a.status === 'absent').length
        const injuredCount = attendance.filter((a: any) => a.status === 'injured').length

        return {
          ...session,
          stats: {
            totalPlayers,
            presentCount,
            absentCount,
            injuredCount,
            attendanceRate: totalPlayers > 0 ? (presentCount / totalPlayers) * 100 : 0
          }
        }
      }) || []

      if (useCache) {
        this.setCache(cacheKey, sessionsWithStats, ttl)
      }

      return sessionsWithStats
    } catch (error) {
      console.error('Errore nella query ottimizzata sessioni:', error)
      throw error
    }
  }

  // Query ottimizzata per eventi
  async getEventsWithDetails(options: QueryOptions = {}) {
    const { useCache = true, ttl = CACHE_TTL.EVENTS, limit = 50, offset = 0, filters = {} } = options
    
    const cacheKey = this.getCacheKey('events_with_details', options)
    
    if (useCache && this.isCacheValid(cacheKey, ttl)) {
      return this.getCachedData(cacheKey)
    }

    try {
      let query = supabase
        .from('events')
        .select(`
          id,
          title,
          event_date,
          event_time,
          start_time,
          end_time,
          event_type,
          location,
          away_location,
          is_home,
          opponent,
          is_championship,
          is_friendly,
          description,
          created_at,
          categories (
            id,
            code,
            name
          )
        `)
        .order('event_date', { ascending: true })
        .range(offset, offset + limit - 1)

      // Applica filtri
      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id)
      }
      if (filters.event_type) {
        query = query.eq('event_type', filters.event_type)
      }
      if (filters.start_date) {
        query = query.gte('event_date', filters.start_date)
      }
      if (filters.end_date) {
        query = query.lte('event_date', filters.end_date)
      }

      const { data, error } = await query

      if (error) throw error

      if (useCache) {
        this.setCache(cacheKey, data, ttl)
      }

      return data || []
    } catch (error) {
      console.error('Errore nella query ottimizzata eventi:', error)
      throw error
    }
  }

  // Query ottimizzata per staff con categorie
  async getStaffWithCategories(options: QueryOptions = {}) {
    const { useCache = true, ttl = CACHE_TTL.STAFF, limit = 100, offset = 0 } = options
    
    const cacheKey = this.getCacheKey('staff_with_categories', options)
    
    if (useCache && this.isCacheValid(cacheKey, ttl)) {
      return this.getCachedData(cacheKey)
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          fir_code,
          role,
          created_at,
          staff_categories (
            category_id,
            categories (
              id,
              code,
              name,
              active
            )
          )
        `)
        .not('first_name', 'is', null)
        .neq('first_name', '')
        .order('last_name', { ascending: true })
        .range(offset, offset + limit - 1)

      if (error) throw error

      const transformedData = data?.map(staff => ({
        ...staff,
        categories: staff.staff_categories
          ?.filter((sc: any) => sc.categories?.active)
          ?.map((sc: any) => sc.categories) || []
      })) || []

      if (useCache) {
        this.setCache(cacheKey, transformedData, ttl)
      }

      return transformedData
    } catch (error) {
      console.error('Errore nella query ottimizzata staff:', error)
      throw error
    }
  }

  // Query ottimizzata per statistiche dashboard
  async getDashboardStats(categoryId?: string) {
    const cacheKey = `dashboard_stats_${categoryId || 'all'}`
    
    if (this.isCacheValid(cacheKey, CACHE_TTL.STATS)) {
      return this.getCachedData(cacheKey)
    }

    try {
      const queries = [
        // Conteggio giocatori
        supabase
          .from('players')
          .select('id', { count: 'exact', head: true })
          .then(({ count }) => ({ totalPlayers: count || 0 })),
        
        // Conteggio giocatori infortunati
        supabase
          .from('players')
          .select('id', { count: 'exact', head: true })
          .eq('injured', true)
          .then(({ count }) => ({ injuredPlayers: count || 0 })),
        
        // Conteggio sessioni
        supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .then(({ count }) => ({ totalSessions: count || 0 })),
        
        // Conteggio eventi
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .then(({ count }) => ({ totalEvents: count || 0 })),
        
        // Conteggio staff
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .not('first_name', 'is', null)
          .then(({ count }) => ({ totalStaff: count || 0 }))
      ]

      if (categoryId) {
        queries.push(
          // Statistiche per categoria specifica
          supabase
            .from('sessions')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', categoryId)
            .then(({ count }) => ({ categorySessions: count || 0 }))
        )
      }

      const results = await Promise.all(queries)
      const stats = results.reduce((acc, curr) => ({ ...acc, ...curr }), {})

      this.setCache(cacheKey, stats, CACHE_TTL.STATS)
      return stats
    } catch (error) {
      console.error('Errore nella query ottimizzata statistiche:', error)
      throw error
    }
  }

  // Query ottimizzata per categorie
  async getCategoriesWithCounts(options: QueryOptions = {}) {
    const { useCache = true, ttl = CACHE_TTL.CATEGORIES } = options
    
    const cacheKey = this.getCacheKey('categories_with_counts', options)
    
    if (useCache && this.isCacheValid(cacheKey, ttl)) {
      return this.getCachedData(cacheKey)
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .select(`
          id,
          code,
          name,
          active,
          sort,
          created_at,
          player_categories (count),
          staff_categories (count)
        `)
        .order('sort')

      if (error) throw error

      const categoriesWithCounts = data?.map(cat => ({
        ...cat,
        player_count: cat.player_categories?.[0]?.count || 0,
        staff_count: cat.staff_categories?.[0]?.count || 0
      })) || []

      if (useCache) {
        this.setCache(cacheKey, categoriesWithCounts, ttl)
      }

      return categoriesWithCounts
    } catch (error) {
      console.error('Errore nella query ottimizzata categorie:', error)
      throw error
    }
  }

  // Invalida cache per una tabella specifica
  invalidateCache(table: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(table))
    keysToDelete.forEach(key => this.cache.delete(key))
  }

  // Invalida tutta la cache
  clearCache(): void {
    this.cache.clear()
  }

  // Ottieni statistiche cache
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

export const queryOptimizer = QueryOptimizer.getInstance()

// Funzioni di utilità per query comuni
export const optimizedQueries = {
  // Giocatori
  getPlayers: (options?: QueryOptions) => queryOptimizer.getPlayersWithCategories(options),
  
  // Sessioni
  getSessions: (categoryId: string, options?: QueryOptions) => 
    queryOptimizer.getSessionsWithStats(categoryId, options),
  
  // Eventi
  getEvents: (options?: QueryOptions) => queryOptimizer.getEventsWithDetails(options),
  
  // Staff
  getStaff: (options?: QueryOptions) => queryOptimizer.getStaffWithCategories(options),
  
  // Categorie
  getCategories: (options?: QueryOptions) => queryOptimizer.getCategoriesWithCounts(options),
  
  // Statistiche
  getStats: (categoryId?: string) => queryOptimizer.getDashboardStats(categoryId)
}

export default queryOptimizer

