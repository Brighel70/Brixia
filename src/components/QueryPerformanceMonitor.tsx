import React, { useState, useEffect } from 'react'
import { queryOptimizer } from '@/lib/queryOptimizer'

interface QueryStats {
  query: string
  duration: number
  timestamp: number
  success: boolean
  error?: string
}

interface CacheStats {
  size: number
  keys: string[]
  hitRate: number
}

const QueryPerformanceMonitor: React.FC = () => {
  const [queryStats, setQueryStats] = useState<QueryStats[]>([])
  const [cacheStats, setCacheStats] = useState<CacheStats>({ size: 0, keys: [], hitRate: 0 })
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(5000)

  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(() => {
        updateCacheStats()
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [isMonitoring, refreshInterval])

  const updateCacheStats = () => {
    const stats = queryOptimizer.getCacheStats()
    setCacheStats({
      ...stats,
      hitRate: calculateHitRate()
    })
  }

  const calculateHitRate = (): number => {
    // Calcola la hit rate basandosi sulle query eseguite
    const totalQueries = queryStats.length
    const successfulQueries = queryStats.filter(q => q.success).length
    return totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0
  }

  const clearQueryStats = () => {
    setQueryStats([])
  }

  const clearCache = () => {
    queryOptimizer.clearCache()
    updateCacheStats()
  }

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const getQueryStatusColor = (success: boolean): string => {
    return success ? 'text-green-600' : 'text-red-600'
  }

  const getQueryStatusIcon = (success: boolean): string => {
    return success ? '✅' : '❌'
  }

  const getPerformanceColor = (duration: number): string => {
    if (duration < 100) return 'text-green-600'
    if (duration < 500) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceIcon = (duration: number): string => {
    if (duration < 100) return '🚀'
    if (duration < 500) return '⚡'
    return '🐌'
  }

  const averageQueryTime = queryStats.length > 0 
    ? queryStats.reduce((sum, q) => sum + q.duration, 0) / queryStats.length 
    : 0

  const slowestQuery = queryStats.length > 0 
    ? queryStats.reduce((slowest, q) => q.duration > slowest.duration ? q : slowest)
    : null

  const errorCount = queryStats.filter(q => !q.success).length
  const successCount = queryStats.filter(q => q.success).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Monitor Performance Query</h2>
          <p className="text-gray-600">Monitora le performance delle query e la cache</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            className={`px-4 py-2 rounded-lg font-medium ${
              isMonitoring 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isMonitoring ? '⏸️ Stop Monitor' : '▶️ Start Monitor'}
          </button>
          <button
            onClick={clearQueryStats}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            🗑️ Clear Stats
          </button>
          <button
            onClick={clearCache}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            🧹 Clear Cache
          </button>
        </div>
      </div>

      {/* Statistiche Generali */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-2xl font-bold text-blue-600">{queryStats.length}</div>
            <div className="ml-2 text-sm text-gray-600">Query Totali</div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-2xl font-bold text-green-600">{successCount}</div>
            <div className="ml-2 text-sm text-gray-600">Query Riuscite</div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-2xl font-bold text-red-600">{errorCount}</div>
            <div className="ml-2 text-sm text-gray-600">Query Fallite</div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-2xl font-bold text-purple-600">{formatDuration(averageQueryTime)}</div>
            <div className="ml-2 text-sm text-gray-600">Tempo Medio</div>
          </div>
        </div>
      </div>

      {/* Statistiche Cache */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistiche Cache</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600">Dimensione Cache</div>
            <div className="text-2xl font-bold text-blue-600">{cacheStats.size} elementi</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Hit Rate</div>
            <div className="text-2xl font-bold text-green-600">{cacheStats.hitRate.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Chiavi Cache</div>
            <div className="text-sm text-gray-500">
              {cacheStats.keys.slice(0, 3).join(', ')}
              {cacheStats.keys.length > 3 && ` ... e altre ${cacheStats.keys.length - 3}`}
            </div>
          </div>
        </div>
      </div>

      {/* Query più lenta */}
      {slowestQuery && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Query più Lenta</h3>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-red-800">{slowestQuery.query}</div>
                <div className="text-sm text-red-600">
                  {formatTimestamp(slowestQuery.timestamp)} • {formatDuration(slowestQuery.duration)}
                </div>
              </div>
              <div className="text-2xl">{getPerformanceIcon(slowestQuery.duration)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Lista Query Recenti */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Query Recenti</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {queryStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <p>Nessuna query registrata</p>
              <p className="text-sm">Avvia il monitor per vedere le query</p>
            </div>
          ) : (
            queryStats
              .slice()
              .reverse()
              .slice(0, 50)
              .map((query, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className={getQueryStatusColor(query.success)}>
                        {getQueryStatusIcon(query.success)}
                      </span>
                      <span className="font-medium text-gray-900">{query.query}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatTimestamp(query.timestamp)} • {formatDuration(query.duration)}
                    </div>
                    {query.error && (
                      <div className="text-sm text-red-600 mt-1">{query.error}</div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={getPerformanceColor(query.duration)}>
                      {getPerformanceIcon(query.duration)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDuration(query.duration)}
                    </span>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Configurazioni */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurazioni</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Intervallo di Aggiornamento (ms)
            </label>
            <input
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 5000)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1000"
              max="60000"
              step="1000"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={updateCacheStats}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              🔄 Aggiorna Cache Stats
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QueryPerformanceMonitor


