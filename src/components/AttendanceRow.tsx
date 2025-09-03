import StatusPill from './StatusPill'
import { useData, type InjuredPlace } from '@/store/data'
import { useState } from 'react'

const statuses = [
  { key: 'PRESENTE', short: 'P' },
  { key: 'ASSENTE', short: 'A' },
  { key: 'INFORTUNATO', short: 'INF' },
  { key: 'PERMESSO', short: 'PR' },
  { key: 'MALATO', short: 'M' },
] as const

export default function AttendanceRow({ 
  player, 
  onExpandPopup, 
  onCollapsePopup 
}: {
  player: { id:string; first_name:string; last_name:string; injured:boolean }
  onExpandPopup?: () => void
  onCollapsePopup?: () => void
}){
  const { attendance, setAttendance } = useData()
  const current = attendance[player.id]
  const [showInfMenu, setShowInfMenu] = useState(false)

  return (
    <div className="relative grid grid-cols-[auto,1fr,auto] items-center gap-2 py-1 px-2 border-b border-white/50">
      <div className="w-8 h-8 rounded-full bg-white/60 grid place-items-center font-semibold text-navy">{player.last_name[0]}</div>
      <div className="truncate leading-tight">
        <div className={`font-semibold ${
          current?.status === 'PRESENTE' 
            ? 'text-green-600' 
            : current?.status === 'ASSENTE' || current?.status === 'MALATO' || current?.status === 'PERMESSO'
            ? 'text-red-600'
            : current?.status === 'INFORTUNATO' && current?.injured_place === 'CASA'
            ? 'text-red-600'
            : current?.status === 'INFORTUNATO' && current?.injured_place === 'PALESTRA'
            ? 'text-orange-600'
            : 'text-navy'
        }`}>
          {player.last_name} {player.first_name}
        </div>
        {current?.status === 'INFORTUNATO' && (
          <div className="text-xs opacity-70">{current.injured_place === 'PALESTRA' ? 'Palestra' : 'Casa'}</div>
        )}
      </div>
      <div className="flex gap-1">
        {statuses.map(s => (
          <StatusPill key={s.key}
            label={s.short}
            active={current?.status === s.key}
            onClick={() => {
              if (s.key === 'INFORTUNATO') {
                // Mostra il menu di selezione Campo/Casa
                setShowInfMenu(true)
                onExpandPopup?.() // Espandi il popup
              } else {
                // Per tutti gli altri status, imposta sempre il nuovo status
                setAttendance(player.id, s.key as any)
                setShowInfMenu(false) // Chiudi il menu se aperto
                onCollapsePopup?.() // Collassa il popup
              }
            }}
          />
        ))}
      </div>
      
      {/* Menu di selezione per INFORTUNATO - Popup separato */}
      {showInfMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-[60]">
          <div className="bg-white border border-gray-300 rounded-lg shadow-lg w-[200px]">
            <div className="p-3">
              <div className="text-sm text-gray-700 mb-3 text-center">
                Dove si trova?
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setAttendance(player.id, 'INFORTUNATO', 'PALESTRA')
                    setShowInfMenu(false)
                    onCollapsePopup?.()
                  }}
                  className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <span>🏟️</span>
                  Campo
                </button>
                <button
                  onClick={() => {
                    setAttendance(player.id, 'INFORTUNATO', 'CASA')
                    setShowInfMenu(false)
                    onCollapsePopup?.()
                  }}
                  className="w-full px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  <span>🏠</span>
                  Casa
                </button>
                <button
                  onClick={() => {
                    setShowInfMenu(false)
                    onCollapsePopup?.()
                  }}
                  className="w-full px-3 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}