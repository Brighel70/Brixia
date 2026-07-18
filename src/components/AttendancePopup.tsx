import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { ClipboardList, Users, CalendarDays, Clock, MapPin } from 'lucide-react'
import AttendanceRow from '@/components/AttendanceRow'
import { useData, type Status } from '@/store/data'

type AttendanceStatsFilter =
  | 'ALL'
  | 'PRESENTE'
  | 'ASSENTE'
  | 'INFORTUNATO'
  | 'INFORTUNATO_CAMPO'
  | 'INFORTUNATO_CASA'
  | 'MALATO'
  | 'PERMESSO'

interface AttendancePopupProps {
  open: boolean
  onClose: () => void
  onSaveAndExit?: () => void | Promise<void>
  categoryName?: string
}

export default function AttendancePopup({ open, onClose, onSaveAndExit, categoryName }: AttendancePopupProps) {
  const { players, attendance, currentSession, currentCategory } = useData()
  const [attendanceStatsFilter, setAttendanceStatsFilter] = useState<AttendanceStatsFilter>('ALL')

  useEffect(() => {
    if (!open) setAttendanceStatsFilter('ALL')
  }, [open])

  if (!open) return null

  const displayCategory = categoryName || (currentCategory as { name?: string; code?: string } | null)?.name || currentCategory?.code || 'Categoria'
  const sessionId = currentSession?.id || ''

  const toggleAttendanceStatsFilter = (filter: Exclude<AttendanceStatsFilter, 'ALL'>) => {
    setAttendanceStatsFilter(prev => (prev === filter ? 'ALL' : filter))
  }

  const playerMatchesAttendanceFilter = (playerId: string): boolean => {
    if (attendanceStatsFilter === 'ALL' || !sessionId) return true
    const att = attendance[`${sessionId}-${playerId}`]
    switch (attendanceStatsFilter) {
      case 'PRESENTE':
        return att?.status === 'PRESENTE'
      case 'ASSENTE':
        return att?.status === 'ASSENTE'
      case 'INFORTUNATO':
        return att?.status === 'INFORTUNATO'
      case 'INFORTUNATO_CAMPO':
        return att?.status === 'INFORTUNATO' && att?.injured_place === 'PALESTRA'
      case 'INFORTUNATO_CASA':
        return att?.status === 'INFORTUNATO' && att?.injured_place === 'CASA'
      case 'MALATO':
        return att?.status === 'MALATO'
      case 'PERMESSO':
        return att?.status === 'PERMESSO'
      default:
        return true
    }
  }

  const handleSaveClick = async () => {
    await onSaveAndExit?.()
    onClose()
  }

  const stats = {
    PRESENTE: players.filter(p => attendance[`${sessionId}-${p.id}`]?.status === 'PRESENTE').length,
    ASSENTE: players.filter(p => attendance[`${sessionId}-${p.id}`]?.status === 'ASSENTE').length,
    INFORTUNATO: players.filter(p => attendance[`${sessionId}-${p.id}`]?.status === 'INFORTUNATO').length,
    MALATO: players.filter(p => attendance[`${sessionId}-${p.id}`]?.status === 'MALATO').length,
    PERMESSO: players.filter(p => (attendance[`${sessionId}-${p.id}`]?.status as Status) === 'PERMESSO').length,
  }

  const statusNames = {
    PRESENTE: 'Presente',
    ASSENTE: 'Assente',
    INFORTUNATO: 'Infortunato',
    MALATO: 'Malato',
    PERMESSO: 'Giustificato',
  }

  const injuredAtCampo = players.filter(p => {
    const att = attendance[`${sessionId}-${p.id}`]
    return att?.status === 'INFORTUNATO' && att?.injured_place === 'PALESTRA'
  }).length

  const injuredAtCasa = players.filter(p => {
    const att = attendance[`${sessionId}-${p.id}`]
    return att?.status === 'INFORTUNATO' && att?.injured_place === 'CASA'
  }).length

  const totalWithStatus = Object.values(stats).reduce((a, b) => a + b, 0)
  const statusOrder = ['PRESENTE', 'ASSENTE', 'INFORTUNATO', 'MALATO', 'PERMESSO'] as const

  const filteredPlayers = players.filter(p => playerMatchesAttendanceFilter(p.id))

  const groupedPlayers = filteredPlayers.reduce((groups, player) => {
    const status = attendance[`${sessionId}-${player.id}`]?.status
    const place = attendance[`${sessionId}-${player.id}`]?.injured_place

    let groupKey = 'Nessun Status'
    if (!status) groupKey = 'Nessun Status'
    else if (status === 'PRESENTE') groupKey = 'Presenti'
    else if (status === 'INFORTUNATO' && place === 'PALESTRA') groupKey = 'Infortunati (Campo)'
    else if (status === 'INFORTUNATO' && place === 'CASA') groupKey = 'Infortunati (Casa)'
    else if (status === 'ASSENTE') groupKey = 'Assenti'
    else if (status === 'MALATO') groupKey = 'Malati'
    else if (status === 'PERMESSO') groupKey = 'Permesso'

    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(player)
    return groups
  }, {} as Record<string, typeof players>)

  const groupOrder = [
    'Nessun Status',
    'Presenti',
    'Infortunati (Campo)',
    'Infortunati (Casa)',
    'Assenti',
    'Malati',
    'Permesso',
  ]

  const sortBySurname = (a: (typeof players)[0], b: (typeof players)[0]) =>
    (a.family_name || (a as any).last_name || '').localeCompare(b.family_name || (b as any).last_name || '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[56rem] max-h-[95vh] overflow-hidden rounded-[1.35rem] bg-white shadow-2xl ring-1 ring-white/20 flex flex-col">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-6 py-5 text-white">
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-sm sm:col-span-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-200">
                <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                Presenze
              </div>
              <p className="mt-1 truncate text-sm font-semibold leading-tight">{displayCategory}</p>
            </div>

            {currentSession && (
              <>
                <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-200">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    Data
                  </div>
                  <p className="mt-1 text-sm font-semibold capitalize leading-tight">
                    {new Date(currentSession.session_date + 'T12:00:00').toLocaleDateString('it-IT', {
                      weekday: 'long',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-200">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Orario
                  </div>
                  <p className="mt-1 text-sm font-semibold leading-tight">
                    {(currentSession as any).start_time && (currentSession as any).end_time
                      ? `${(currentSession as any).start_time.substring(0, 5)} – ${(currentSession as any).end_time.substring(0, 5)}`
                      : (currentSession as any).start_time
                        ? (currentSession as any).start_time.substring(0, 5)
                        : '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-200">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    Luogo
                  </div>
                  <p
                    className="mt-1 truncate text-sm font-semibold leading-tight"
                    title={
                      currentSession.location === 'Trasferta' && currentSession.away_place
                        ? `Trasferta – ${currentSession.away_place}`
                        : currentSession.location
                    }
                  >
                    {currentSession.location === 'Trasferta' && currentSession.away_place
                      ? currentSession.away_place
                      : currentSession.location}
                  </p>
                  {currentSession.location === 'Trasferta' && currentSession.away_place && (
                    <p className="mt-0.5 text-[10px] font-medium text-blue-200/80">Trasferta</p>
                  )}
                </div>

                <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-200">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    Giocatori
                  </div>
                  <p className="mt-1 text-sm font-semibold leading-tight">{players.length}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-100 flex">
          <div className="flex-1 p-4">
            <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="max-h-full overflow-auto divide-y divide-slate-100 relative">
                {players.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <Users className="h-6 w-6" />
                    </div>
                    <p className="font-medium">Nessun giocatore trovato per questa categoria</p>
                  </div>
                ) : filteredPlayers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-medium">Nessun giocatore per questo filtro</p>
                    <button
                      type="button"
                      onClick={() => setAttendanceStatsFilter('ALL')}
                      className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Mostra tutti
                    </button>
                  </div>
                ) : (
                  groupOrder.map(groupKey => {
                    const groupPlayers = groupedPlayers[groupKey]
                    if (!groupPlayers || groupPlayers.length === 0) return null

                    const sortedPlayers = [...groupPlayers].sort(sortBySurname)

                    return (
                      <div key={groupKey}>
                        <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                            {groupKey} ({groupPlayers.length})
                          </h3>
                        </div>
                        {sortedPlayers.map(p => (
                          <AttendanceRow
                            key={p.id}
                            player={p as any}
                            sessionId={sessionId}
                            onExpandPopup={() => {}}
                            onCollapsePopup={() => {}}
                          />
                        ))}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="w-80 min-w-[18rem] shrink-0 border-l border-slate-200 bg-white p-5 flex flex-col">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-950">Statistiche</h3>
                <p className="text-xs text-slate-500">Riepilogo live</p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-auto">
              {statusOrder.map(status => {
                const count = stats[status] || 0
                const percentage = totalWithStatus > 0 ? Math.round((count / totalWithStatus) * 100) : 0
                if (percentage === 0) return null

                const isInfortunatoCard = status === 'INFORTUNATO'
                const isStatusSelected = attendanceStatsFilter === status
                const cardClass = clsx(
                  'w-full rounded-xl border p-3 text-left shadow-sm transition-all',
                  isStatusSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/25'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                )

                if (isInfortunatoCard) {
                  return (
                    <div key={status} className={cardClass}>
                      <button
                        type="button"
                        onClick={() => toggleAttendanceStatsFilter('INFORTUNATO')}
                        className="w-full text-left"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-700">{statusNames[status]}</span>
                          <span className="shrink-0 text-base font-bold text-slate-950">{percentage}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${percentage}%` }} />
                        </div>
                      </button>
                      {count > 0 && (
                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
                            {injuredAtCampo > 0 && (
                              <div className="h-full bg-amber-500 transition-all" style={{ width: `${(injuredAtCampo / count) * 100}%` }} />
                            )}
                            {injuredAtCasa > 0 && (
                              <div className="h-full bg-rose-500 transition-all" style={{ width: `${(injuredAtCasa / count) * 100}%` }} />
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => toggleAttendanceStatsFilter('INFORTUNATO_CAMPO')}
                              className={clsx(
                                'rounded-lg border px-2.5 py-2 text-left transition-all',
                                attendanceStatsFilter === 'INFORTUNATO_CAMPO'
                                  ? 'border-amber-500 bg-amber-100 ring-2 ring-amber-500/25'
                                  : 'border-amber-200 bg-amber-50 hover:border-amber-300'
                              )}
                            >
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-800">
                                <span aria-hidden>🏟️</span>
                                <span>Al campo</span>
                              </div>
                              <div className="mt-0.5 flex items-baseline justify-between gap-1">
                                <span className="text-lg font-bold text-amber-900">{injuredAtCampo}</span>
                                <span className="text-[13px] font-medium text-amber-700">
                                  {count > 0 ? Math.round((injuredAtCampo / count) * 100) : 0}%
                                </span>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleAttendanceStatsFilter('INFORTUNATO_CASA')}
                              className={clsx(
                                'rounded-lg border px-2.5 py-2 text-left transition-all',
                                attendanceStatsFilter === 'INFORTUNATO_CASA'
                                  ? 'border-rose-500 bg-rose-100 ring-2 ring-rose-500/25'
                                  : 'border-rose-200 bg-rose-50 hover:border-rose-300'
                              )}
                            >
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-800">
                                <span aria-hidden>🏠</span>
                                <span>A casa</span>
                              </div>
                              <div className="mt-0.5 flex items-baseline justify-between gap-1">
                                <span className="text-lg font-bold text-rose-900">{injuredAtCasa}</span>
                                <span className="text-[13px] font-medium text-rose-700">
                                  {count > 0 ? Math.round((injuredAtCasa / count) * 100) : 0}%
                                </span>
                              </div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <button
                    type="button"
                    key={status}
                    onClick={() => toggleAttendanceStatsFilter(status)}
                    className={cardClass}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-700">{statusNames[status]}</span>
                      <span className="shrink-0 text-base font-bold text-slate-950">{percentage}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${percentage}%` }} />
                    </div>
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => setAttendanceStatsFilter('ALL')}
                className={clsx(
                  'flex w-full items-center justify-between rounded-xl border p-3 text-left shadow-sm transition-all',
                  attendanceStatsFilter === 'ALL'
                    ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-500/25'
                    : 'border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100'
                )}
              >
                <span className="text-sm font-bold text-blue-800">Totale</span>
                <span className="text-xl font-bold text-blue-950">{totalWithStatus}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveClick}
              className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Salva ed Esci
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
