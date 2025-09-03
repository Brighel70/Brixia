import { clsx } from 'clsx'
import { useState, useRef, useEffect } from 'react'

const statusDescriptions: { [key: string]: string } = {
  'P': 'Presente - Il giocatore è presente all\'allenamento',
  'A': 'Assente - Il giocatore non è presente',
  'INF': 'Infortunato - Il giocatore è infortunato',
  'M': 'Malato - Il giocatore è malato'
}

export default function StatusPill({ label, active, onClick }:{ label: string; active?: boolean; onClick?: () => void }){
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setTooltipPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        })
        setShowTooltip(true)
      }
    }, 1500) // 1.5 secondi di delay
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setShowTooltip(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={onClick} 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={clsx('pill border', active ? 'bg-sky text-white border-sky' : 'bg-white text-navy border-navy/20')}
      >
        {label}
      </button>
      
      {showTooltip && (
        <div 
          className="fixed z-50 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          {statusDescriptions[label]}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </>
  )
}