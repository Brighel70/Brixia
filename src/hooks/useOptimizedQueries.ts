import { useState, useEffect, useCallback } from 'react'
import { queryOptimizer, optimizedQueries } from '@/lib/queryOptimizer'

interface QueryOptions {
  useCache?: boolean
  ttl?: number
  limit?: number
  offset?: number
  orderBy?: { column: string; ascending?: boolean }
  filters?: Record<string, any>
}

interface QueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Hook per query ottimizzate con stato
export const useOptimizedQuery = <T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  options: QueryOptions = {}
): QueryState<T> => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const executeQuery = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await queryFn()
      setData(result)
    } catch (err: any) {
      setError(err.message)
      console.error(`Errore nella query ${queryKey}:`, err)
    } finally {
      setLoading(false)
    }
  }, [queryKey, queryFn])

  useEffect(() => {
    executeQuery()
  }, [executeQuery])

  return {
    data,
    loading,
    error,
    refetch: executeQuery
  }
}

// Hook specifico per giocatori
export const usePlayers = (options: QueryOptions = {}) => {
  return useOptimizedQuery(
    'players',
    () => optimizedQueries.getPlayers(options),
    options
  )
}

// Hook specifico per sessioni
export const useSessions = (categoryId: string, options: QueryOptions = {}) => {
  return useOptimizedQuery(
    `sessions_${categoryId}`,
    () => optimizedQueries.getSessions(categoryId, options),
    options
  )
}

// Hook specifico per eventi
export const useEvents = (options: QueryOptions = {}) => {
  return useOptimizedQuery(
    'events',
    () => optimizedQueries.getEvents(options),
    options
  )
}

// Hook specifico per staff
export const useStaff = (options: QueryOptions = {}) => {
  return useOptimizedQuery(
    'staff',
    () => optimizedQueries.getStaff(options),
    options
  )
}

// Hook specifico per categorie
export const useCategories = (options: QueryOptions = {}) => {
  return useOptimizedQuery(
    'categories',
    () => optimizedQueries.getCategories(options),
    options
  )
}

// Hook specifico per statistiche
export const useStats = (categoryId?: string) => {
  return useOptimizedQuery(
    `stats_${categoryId || 'all'}`,
    () => optimizedQueries.getStats(categoryId),
    { ttl: 30000 } // 30 secondi per le statistiche
  )
}

// Hook per query multiple in parallelo
export const useMultipleQueries = <T extends Record<string, any>>(
  queries: Record<keyof T, () => Promise<any>>
): Record<keyof T, QueryState<any>> => {
  const [results, setResults] = useState<Record<keyof T, QueryState<any>>>({} as any)

  useEffect(() => {
    const executeQueries = async () => {
      const queryKeys = Object.keys(queries) as (keyof T)[]
      
      // Inizializza tutti gli stati come loading
      const initialResults = queryKeys.reduce((acc, key) => {
        acc[key] = { data: null, loading: true, error: null, refetch: async () => {} }
        return acc
      }, {} as Record<keyof T, QueryState<any>>)
      
      setResults(initialResults)

      // Esegui tutte le query in parallelo
      const promises = queryKeys.map(async (key) => {
        try {
          const data = await queries[key]()
          return { key, data, error: null }
        } catch (error: any) {
          return { key, data: null, error: error.message }
        }
      })

      const results = await Promise.all(promises)
      
      // Aggiorna gli stati con i risultati
      const updatedResults = queryKeys.reduce((acc, key) => {
        const result = results.find(r => r.key === key)
        acc[key] = {
          data: result?.data || null,
          loading: false,
          error: result?.error || null,
          refetch: async () => {
            try {
              const data = await queries[key]()
              setResults(prev => ({
                ...prev,
                [key]: { ...prev[key], data, error: null }
              }))
            } catch (error: any) {
              setResults(prev => ({
                ...prev,
                [key]: { ...prev[key], error: error.message }
              }))
            }
          }
        }
        return acc
      }, {} as Record<keyof T, QueryState<any>>)

      setResults(updatedResults)
    }

    executeQueries()
  }, [queries])

  return results
}

// Hook per paginazione
export const usePaginatedQuery = <T>(
  queryKey: string,
  queryFn: (offset: number, limit: number) => Promise<T[]>,
  initialLimit: number = 20
) => {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [limit] = useState(initialLimit)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return

    try {
      setLoading(true)
      setError(null)
      
      const newData = await queryFn(offset, limit)
      
      if (newData.length < limit) {
        setHasMore(false)
      }
      
      setData(prev => [...prev, ...newData])
      setOffset(prev => prev + limit)
    } catch (err: any) {
      setError(err.message)
      console.error(`Errore nella query paginata ${queryKey}:`, err)
    } finally {
      setLoading(false)
    }
  }, [queryKey, queryFn, offset, limit, loading, hasMore])

  const reset = useCallback(() => {
    setData([])
    setOffset(0)
    setHasMore(true)
    setError(null)
  }, [])

  useEffect(() => {
    reset()
    loadMore()
  }, [reset, loadMore])

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    reset
  }
}

// Hook per ricerca con debounce
export const useSearchQuery = <T>(
  queryKey: string,
  queryFn: (searchTerm: string) => Promise<T[]>,
  debounceMs: number = 300
) => {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

  // Debounce del termine di ricerca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [searchTerm, debounceMs])

  // Esegui query quando cambia il termine debounced
  useEffect(() => {
    if (!debouncedSearchTerm.trim()) {
      setData([])
      return
    }

    const executeSearch = async () => {
      try {
        setLoading(true)
        setError(null)
        const results = await queryFn(debouncedSearchTerm)
        setData(results)
      } catch (err: any) {
        setError(err.message)
        console.error(`Errore nella ricerca ${queryKey}:`, err)
      } finally {
        setLoading(false)
      }
    }

    executeSearch()
  }, [debouncedSearchTerm, queryKey, queryFn])

  return {
    data,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm
  }
}

// Hook per invalidazione cache
export const useCacheInvalidation = () => {
  const invalidateTable = useCallback((table: string) => {
    queryOptimizer.invalidateCache(table)
  }, [])

  const clearAllCache = useCallback(() => {
    queryOptimizer.clearCache()
  }, [])

  const getCacheStats = useCallback(() => {
    return queryOptimizer.getCacheStats()
  }, [])

  return {
    invalidateTable,
    clearAllCache,
    getCacheStats
  }
}

export default {
  usePlayers,
  useSessions,
  useEvents,
  useStaff,
  useCategories,
  useStats,
  useMultipleQueries,
  usePaginatedQuery,
  useSearchQuery,
  useCacheInvalidation
}

