import React from 'react'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: string
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'indigo' | 'teal' | 'yellow'
  trend?: {
    value: number
    isPositive: boolean
  }
  loading?: boolean
  onClick?: () => void
}

const colorClasses = {
  blue: {
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-900',
    subtitle: 'text-blue-600'
  },
  green: {
    bg: 'bg-gradient-to-br from-green-500 to-green-600',
    icon: 'bg-green-100 text-green-600',
    text: 'text-green-900',
    subtitle: 'text-green-600'
  },
  orange: {
    bg: 'bg-gradient-to-br from-orange-500 to-orange-600',
    icon: 'bg-orange-100 text-orange-600',
    text: 'text-orange-900',
    subtitle: 'text-orange-600'
  },
  red: {
    bg: 'bg-gradient-to-br from-red-500 to-red-600',
    icon: 'bg-red-100 text-red-600',
    text: 'text-red-900',
    subtitle: 'text-red-600'
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
    icon: 'bg-purple-100 text-purple-600',
    text: 'text-purple-900',
    subtitle: 'text-purple-600'
  },
  indigo: {
    bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
    icon: 'bg-indigo-100 text-indigo-600',
    text: 'text-indigo-900',
    subtitle: 'text-indigo-600'
  },
  teal: {
    bg: 'bg-gradient-to-br from-teal-500 to-teal-600',
    icon: 'bg-teal-100 text-teal-600',
    text: 'text-teal-900',
    subtitle: 'text-teal-600'
  },
  yellow: {
    bg: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
    icon: 'bg-yellow-100 text-yellow-600',
    text: 'text-yellow-900',
    subtitle: 'text-yellow-600'
  }
}

export default function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color, 
  trend, 
  loading = false,
  onClick 
}: StatsCardProps) {
  const colors = colorClasses[color]

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
        </div>
        <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-20"></div>
      </div>
    )
  }

  return (
    <div 
      className={`bg-white rounded-xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl hover:scale-105 ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
          {title}
        </h3>
        <div className={`p-3 rounded-full ${colors.icon}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-3xl font-bold ${colors.text} mb-1`}>
            {value}
          </div>
          {subtitle && (
            <div className={`text-sm ${colors.subtitle}`}>
              {subtitle}
            </div>
          )}
        </div>
        
        {trend && (
          <div className={`flex items-center text-sm font-medium ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            <span className="mr-1">
              {trend.isPositive ? '↗️' : '↘️'}
            </span>
            {trend.value}%
          </div>
        )}
      </div>
    </div>
  )
}

