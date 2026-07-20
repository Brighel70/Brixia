import StatusPill from './StatusPill'
import { useData, type InjuredPlace } from '@/store/data'
import { useState } from 'react'
import { formatDisplayPersonName } from '@/lib/formatPersonName'

const statuses = [
  { key: 'PRESENTE', short: 'P' },
  { key: 'ASSENTE', short: 'A' },
  { key: 'INFORTUNATO', short: 'INF' },
  { key: 'MALATO', short: 'M' },
  { key: 'PERMESSO', short: 'G' },
] as const

export default function AttendanceRowEnhanced({ 
  player, 
  sessionId,
  onExpandPopup, 
  onCollapsePopup,
  attendanceData
}: {
  player: { id: string; first_name: string; last_name: string; injured: boolean }
  sessionId: string
  onExpandPopup?: () => void
  onCollapsePopup?: () => void
  attendanceData?: {
    status: string
    injured_place?: string
    scanned_at?: string
    created_at?: string
  }
}) {
  const { attendance, setAttendance } = useData()
  const current = attendance[`${sessionId}-${player.id}`]
  const [showInfMenu, setShowInfMenu] = useState(false)

  // Determina se la presenza è stata registrata via QR
  const isQRScanned = attendanceData?.scanned_at
  const isManualEntry = !isQRScanned && (current?.status || attendanceData?.status)

  return (
    <div className="relative grid grid-cols-[auto,1fr,auto] items-center gap-2 py-1 px-2 border-b border-white/50">
      <div className="w-8 h-8 rounded-full bg-white/60 grid place-items-center font-semibold text-navy relative">
        {player.last_name[0]}
        {/* Indicatore QR */}
        {isQRScanned && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-xs text-white">📱</span>
          </div>
        )}
      </div>
      
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
          {formatDisplayPersonName(player.last_name)} {formatDisplayPersonName(player.first_name)}
        </div>
        
        {/* Informazioni aggiuntive */}
        <div className="flex items-center gap-2 text-xs opacity-70">
          {current?.status === 'INFORTUNATO' && (
            <span>{current.injured_place === 'PALESTRA' ? 'Palestra' : 'Casa'}</span>
          )}
          
          {/* Indicatore metodo di registrazione */}
          {isQRScanned && (
            <span className="text-green-600 font-medium">📱 QR</span>
          )}
          {isManualEntry && (
            <span className="text-blue-600 font-medium">✋ Manuale</span>
          )}
          
          {/* Timestamp */}
          {attendanceData?.created_at && (
            <span className="text-gray-500">
              {new Date(attendanceData.created_at).toLocaleTimeString('it-IT', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex gap-1">
        {statuses.map(s => (
          <StatusPill key={s.key}
            label={s.short}
            active={current?.status === s.key}
            onClick={() => {
              if (s.key === 'INFORTUNATO') {
                setShowInfMenu(true)
                onExpandPopup?.()
              } else {
                setAttendance(sessionId, player.id, s.key as any)
                setShowInfMenu(false)
                onCollapsePopup?.()
              }
            }}
          />
        ))}
      </div>
      
      {/* Menu di selezione per INFORTUNATO */}
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
                    setAttendance(sessionId, player.id, 'INFORTUNATO', 'PALESTRA')
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
                    setAttendance(sessionId, player.id, 'INFORTUNATO', 'CASA')
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
                  className="w-full px-3 py-2 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition-colors"
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

