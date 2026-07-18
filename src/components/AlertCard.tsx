import React from 'react'

interface AlertCardProps {
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  count?: number
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
  onDismiss?: () => void
}

const alertStyles = {
  success: {
    bg: 'bg-green-50 border-green-200',
    icon: '✅',
    title: 'text-green-800',
    message: 'text-green-600',
    button: 'bg-green-100 hover:bg-green-200 text-green-800'
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-200',
    icon: '⚠️',
    title: 'text-yellow-800',
    message: 'text-yellow-600',
    button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: '🚨',
    title: 'text-red-800',
    message: 'text-red-600',
    button: 'bg-red-100 hover:bg-red-200 text-red-800'
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'ℹ️',
    title: 'text-blue-800',
    message: 'text-blue-600',
    button: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
  }
}

export default function AlertCard({ 
  type, 
  title, 
  message, 
  count, 
  action, 
  dismissible = false,
  onDismiss 
}: AlertCardProps) {
  const styles = alertStyles[type]

  return (
    <div className={`rounded-lg border-l-4 p-4 ${styles.bg} border-l-4`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-2xl">{styles.icon}</span>
        </div>
        
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium ${styles.title}`}>
              {title}
              {count && count > 0 && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {count}
                </span>
              )}
            </h3>
            
            {dismissible && onDismiss && (
              <button
                onClick={onDismiss}
                className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="sr-only">Chiudi</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
          
          <div className={`mt-1 text-sm ${styles.message}`}>
            {message}
          </div>
          
          {action && (
            <div className="mt-3">
              <button
                onClick={action.onClick}
                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md transition-colors ${styles.button}`}
              >
                {action.label}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

