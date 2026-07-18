import React from 'react'

interface SimpleChartProps {
  title: string
  data: Array<{
    label: string
    value: number
    color: string
  }>
  type: 'bar' | 'line' | 'donut'
  height?: number
  loading?: boolean
}

export default function SimpleChart({ 
  title, 
  data, 
  type, 
  height = 200, 
  loading = false 
}: SimpleChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
        <div className="h-40 bg-gray-200 rounded"></div>
      </div>
    )
  }

  // Filtra e valida i dati prima di usarli
  const validData = data.filter(d => {
    if (!d || d.value === null || d.value === undefined) return false
    const numValue = Number(d.value)
    return !isNaN(numValue) && isFinite(numValue) && numValue >= 0
  }).map(d => ({
    ...d,
    value: Number(d.value)
  }))
  
  const maxValue = validData.length > 0 ? Math.max(...validData.map(d => d.value)) : 1
  const totalValue = validData.reduce((sum, d) => sum + d.value, 0)

  const renderBarChart = () => (
    <div className="space-y-3">
      {validData.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{item.label}</span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: item.color
              }}
            />
          </div>
        </div>
      ))}
      {validData.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          Nessun dato disponibile
        </div>
      )}
    </div>
  )

  const renderLineChart = () => {
    // Validazione extra per prevenire NaN
    if (validData.length === 0 || maxValue <= 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          Nessun dato disponibile per il grafico
        </div>
      )
    }

    return (
      <div className="relative" style={{ height: `${height}px` }}>
        <svg width="100%" height="100%" className="overflow-visible">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={validData[0]?.color || '#3B82F6'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={validData[0]?.color || '#3B82F6'} stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Linea */}
          <polyline
            fill="none"
            stroke={validData[0]?.color || '#3B82F6'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={validData.map((item, index) => {
              const x = validData.length > 1 ? (index / (validData.length - 1)) * 100 : 50
              const y = 100 - (item.value / maxValue) * 80
              // Validazione extra per prevenire NaN
              const safeX = isNaN(x) ? 50 : x
              const safeY = isNaN(y) ? 100 : y
              return `${safeX},${safeY}`
            }).join(' ')}
          />
          
          {/* Area sotto la linea */}
          <polygon
            fill="url(#gradient)"
            points={`0,100 ${validData.map((item, index) => {
              const x = validData.length > 1 ? (index / (validData.length - 1)) * 100 : 50
              const y = 100 - (item.value / maxValue) * 80
              // Validazione extra per prevenire NaN
              const safeX = isNaN(x) ? 50 : x
              const safeY = isNaN(y) ? 100 : y
              return `${safeX},${safeY}`
            }).join(' ')} 100,100`}
          />
          
          {/* Punti */}
          {validData.map((item, index) => {
            const x = validData.length > 1 ? (index / (validData.length - 1)) * 100 : 50
            const y = 100 - (item.value / maxValue) * 80
            // Validazione extra per prevenire NaN
            const safeX = isNaN(x) ? 50 : x
            const safeY = isNaN(y) ? 100 : y
            
            return (
              <circle
                key={index}
                cx={safeX}
                cy={safeY}
                r="4"
                fill={item.color}
                className="hover:r-6 transition-all duration-200"
              />
            )
          })}
        </svg>
      </div>
    )
  }

  const renderDonutChart = () => {
    // Validazione extra per prevenire NaN
    if (validData.length === 0 || totalValue <= 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          Nessun dato disponibile per il grafico
        </div>
      )
    }

    const radius = 60
    const circumference = 2 * Math.PI * radius
    let currentOffset = 0

    return (
      <div className="flex items-center justify-center">
        <div className="relative">
          <svg width="140" height="140" className="transform -rotate-90">
            {validData.map((item, index) => {
              const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0
              const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
              const strokeDashoffset = -currentOffset
              
              currentOffset += (percentage / 100) * circumference
              
              // Validazione extra per prevenire NaN
              const safePercentage = isNaN(percentage) ? 0 : percentage
              const safeStrokeDasharray = isNaN(strokeDasharray.split(' ')[0]) ? '0' : strokeDasharray.split(' ')[0]
              const safeStrokeDashoffset = isNaN(strokeDashoffset) ? 0 : strokeDashoffset
              
              return (
                <circle
                  key={index}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="20"
                  strokeDasharray={`${safeStrokeDasharray} ${circumference}`}
                  strokeDashoffset={safeStrokeDashoffset}
                  className="transition-all duration-1000 ease-out"
                  style={{
                    strokeDasharray: `${safeStrokeDasharray} ${circumference}`,
                    strokeDashoffset: safeStrokeDashoffset
                  }}
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{totalValue}</div>
              <div className="text-sm text-gray-500">Totale</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      {type === 'bar' && renderBarChart()}
      {type === 'line' && renderLineChart()}
      {type === 'donut' && renderDonutChart()}
      
      {type === 'donut' && (
        <div className="mt-4 space-y-2">
          {validData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-600">{item.label}</span>
              </div>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
          {validData.length === 0 && (
            <div className="text-center text-gray-500 py-2">
              Nessun dato disponibile
            </div>
          )}
        </div>
      )}
    </div>
  )
}
