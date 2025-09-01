import StatusPill from './StatusPill'
import { useData, type InjuredPlace } from '@/store/data'

const statuses = [
  { key: 'PRESENTE', short: 'P' },
  { key: 'ASSENTE', short: 'A' },
  { key: 'INFORTUNATO', short: 'INF' },
  { key: 'PERMESSO', short: 'PR' },
  { key: 'MALATO', short: 'M' },
] as const

export default function AttendanceRow({ player }:{ player: { id:string; first_name:string; last_name:string; injured:boolean }}){
  const { attendance, setAttendance } = useData()
  const current = attendance[player.id]

  return (
    <div className="grid grid-cols-[auto,1fr,auto] items-center gap-2 py-1 px-2 border-b border-white/50">
      <div className="w-8 h-8 rounded-full bg-white/60 grid place-items-center font-semibold text-navy">{player.last_name[0]}</div>
      <div className="truncate leading-tight">
        <div className="font-semibold text-navy">{player.last_name} {player.first_name}</div>
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
                // toggle rapido: first click = PALESTRA, second = CASA
                const next: InjuredPlace = current?.injured_place === 'PALESTRA' ? 'CASA' : 'PALESTRA'
                setAttendance(player.id, 'INFORTUNATO', next)
              } else {
                setAttendance(player.id, s.key as any)
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}