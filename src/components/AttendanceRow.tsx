import { clsx } from 'clsx'
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

export default function AttendanceRow({ 
  player, 
  sessionId,
  onExpandPopup, 
  onCollapsePopup,
  variant = 'light'
}: {
  player: { id:string; given_name:string; family_name:string; injured:boolean }
  sessionId: string
  onExpandPopup?: () => void
  onCollapsePopup?: () => void
  variant?: 'light' | 'dark'
}){
  const { attendance, setAttendance, removeAttendance } = useData()
  const current = attendance[`${sessionId}-${player.id}`]
  const [showInfMenu, setShowInfMenu] = useState(false)

  const dark = variant === 'dark'
  return (
    <div className={clsx('relative grid grid-cols-[auto,1fr,auto] items-center gap-3 px-4 py-2.5 transition-colors', dark ? 'hover:bg-slate-700/40' : 'hover:bg-slate-50')}>
      <div className={clsx('w-9 h-9 rounded-xl grid place-items-center text-sm font-bold shadow-sm', dark ? 'bg-slate-600 text-slate-100' : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200')}>{(player.family_name || '')[0]}</div>
      <div className="truncate leading-tight">
        <div className={clsx('text-sm font-bold', dark ? (
          current?.status === 'PRESENTE' ? 'text-green-400' : current?.status === 'ASSENTE' || current?.status === 'MALATO' || current?.status === 'PERMESSO' ? 'text-red-400' : current?.status === 'INFORTUNATO' && current?.injured_place === 'CASA' ? 'text-red-400' : current?.status === 'INFORTUNATO' && current?.injured_place === 'PALESTRA' ? 'text-orange-400' : 'text-slate-200'
        ) : (
          current?.status === 'PRESENTE' ? 'text-emerald-700' : current?.status === 'ASSENTE' || current?.status === 'MALATO' || current?.status === 'PERMESSO' ? 'text-rose-700' : current?.status === 'INFORTUNATO' && current?.injured_place === 'CASA' ? 'text-rose-700' : current?.status === 'INFORTUNATO' && current?.injured_place === 'PALESTRA' ? 'text-amber-700' : 'text-slate-900'
        ))}>
          {formatDisplayPersonName(player.family_name)} {formatDisplayPersonName(player.given_name)}
        </div>
        {current?.status === 'INFORTUNATO' && (
          <div className={clsx('text-xs font-medium opacity-75', dark ? 'text-slate-400' : 'text-slate-500')}>{current.injured_place === 'PALESTRA' ? 'Palestra' : 'Casa'}</div>
        )}
      </div>
      <div className="flex gap-1.5">
        {statuses.map(s => (
          <StatusPill key={s.key}
            label={s.short}
            active={current?.status === s.key}
            dark={dark}
            onClick={() => {
              // TOGGLE: Se clicco sullo status già selezionato, lo rimuovo
              if (current?.status === s.key) {
                if (sessionId) {
                  removeAttendance(sessionId, player.id)
                } else {
                  console.error('❌ SessionId mancante nel componente AttendanceRow')
                }
                setShowInfMenu(false)
                onCollapsePopup?.()
                return
              }
              
              if (s.key === 'INFORTUNATO') {
                // Mostra il menu di selezione Campo/Casa
                setShowInfMenu(true)
                onExpandPopup?.() // Espandi il popup
              } else {
                // Per tutti gli altri status, imposta il nuovo status
                if (sessionId) {
                  setAttendance(sessionId, player.id, s.key as any)
                } else {
                  console.error('❌ SessionId mancante nel componente AttendanceRow')
                }
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
          <div className={clsx('border rounded-lg shadow-lg w-[200px]', dark ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300')}>
            <div className="p-3">
              <div className={clsx('text-sm mb-3 text-center', dark ? 'text-slate-200' : 'text-gray-700')}>
                Dove si trova?
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (sessionId) {
                      setAttendance(sessionId, player.id, 'INFORTUNATO', 'PALESTRA')
                    } else {
                      console.error('❌ SessionId mancante nel componente AttendanceRow')
                    }
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
                    if (sessionId) {
                      setAttendance(sessionId, player.id, 'INFORTUNATO', 'CASA')
                    } else {
                      console.error('❌ SessionId mancante nel componente AttendanceRow')
                    }
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
                  className={clsx('w-full px-3 py-1 rounded text-xs transition-colors', dark ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
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
