import React, { useState, useEffect } from 'react'

interface DisqualificationNotificationProps {
  /** Numero di squalifiche aggiornate */
  updatedCount: number
  /** Lista dei nomi dei giocatori aggiornati */
  updatedPlayers: string[]
  /** Se mostrare la notifica */
  visible: boolean
  /** Callback per chiudere la notifica */
  onClose: () => void
  /** Durata in millisecondi prima della chiusura automatica (default: 5000) */
  autoCloseDelay?: number
}

/**
 * Componente per mostrare notifiche quando le squalifiche vengono aggiornate automaticamente
 */
export const DisqualificationNotification: React.FC<DisqualificationNotificationProps> = ({
  updatedCount,
  updatedPlayers,
  visible,
  onClose,
  autoCloseDelay = 5000
}) => {
  const [isVisible, setIsVisible] = useState(visible)

  useEffect(() => {
    setIsVisible(visible)
    
    if (visible && autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onClose, 300) // Aspetta l'animazione di chiusura
      }, autoCloseDelay)
      
      return () => clearTimeout(timer)
    }
  }, [visible, autoCloseDelay, onClose])

  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className={`
        bg-green-50 border border-green-200 rounded-lg shadow-lg p-4
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-green-800">
              Squalifiche aggiornate automaticamente
            </h3>
            <div className="mt-1 text-sm text-green-700">
              <p>
                {updatedCount === 1 
                  ? '1 squalifica scaduta è stata rimossa automaticamente'
                  : `${updatedCount} squalifiche scadute sono state rimosse automaticamente`
                }
              </p>
              {updatedPlayers.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Giocatori aggiornati:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {updatedPlayers.slice(0, 5).map((player, index) => (
                      <li key={index} className="text-xs">
                        {player}
                      </li>
                    ))}
                    {updatedPlayers.length > 5 && (
                      <li className="text-xs text-green-600">
                        ... e altri {updatedPlayers.length - 5} giocatori
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={() => {
                setIsVisible(false)
                setTimeout(onClose, 300)
              }}
              className="inline-flex text-green-400 hover:text-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-green-50 rounded-md"
            >
              <span className="sr-only">Chiudi</span>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DisqualificationNotification











