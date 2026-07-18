import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import SortableAgendaCard from './SortableAgendaCard'

export interface AgendaItem {
  id: string
  activity_date: string
  activity_time?: string | null
  activity_type: string
  activity_description?: string | null
  person_name?: string | null
  person_id?: string
  category_label?: string | null
  injury_id?: string
  duration_minutes?: number | null
  notes?: string | null
  confirmation_status?: string | null
  sourceActivityId?: string
  operator_name?: string | null
}

function getEndTime(startTime: string | null | undefined, durationMinutes: number | null | undefined): string | null {
  if (!startTime || !durationMinutes || durationMinutes <= 0) return null
  const [h, m] = String(startTime).substring(0, 5).split(':').map(Number)
  const totalMins = h * 60 + m + durationMinutes
  const endH = Math.floor(totalMins / 60) % 24
  const endM = totalMins % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

function abbreviateCategoryLabel(label: string): string {
  if (!label?.trim()) return '—'
  const parts = label.split(',').map((p) => p.trim()).filter(Boolean)
  const abbrev: string[] = []
  for (const p of parts) {
    if (/^Under\s+14$/i.test(p)) abbrev.push('u14')
    else if (/^Under\s+16$/i.test(p)) abbrev.push('u16')
    else if (/^Under\s+18$/i.test(p)) abbrev.push('u18')
    else if (/^Serie\s+C$/i.test(p)) abbrev.push('C')
    else if (/^Serie\s+B$/i.test(p)) abbrev.push('B')
  }
  return abbrev.length ? abbrev.join(', ') : '—'
}

function getBadgeClass(abbrev: string): string {
  if (abbrev.includes('B')) return 'bg-blue-500'
  if (abbrev.includes('C')) return 'bg-green-500'
  if (abbrev.includes('u18')) return 'bg-red-500'
  if (abbrev.includes('u16')) return 'bg-yellow-500'
  if (abbrev.includes('u14')) return 'bg-purple-500'
  return 'bg-gray-400'
}

function getActivityDisplayTitle(type: string, desc: string | null | undefined): string {
  const d = (desc || '').trim()
  if (type === 'visit_list') return d || 'Visita in lista'
  if (type === 'medical_visit') return d || 'Visita medica'
  if (type === 'physiotherapy') return d ? `Fisioterapia: ${d.toLowerCase()}` : 'Fisioterapia'
  return d || type || '—'
}

function getActivityStyle(type: string): { bg: string; border: string } {
  const styles: Record<string, { bg: string; border: string }> = {
    visit_list: { bg: 'bg-cyan-50', border: 'border-cyan-200' },
    medical_visit: { bg: 'bg-blue-50', border: 'border-blue-200' },
    physiotherapy: { bg: 'bg-green-50', border: 'border-green-200' },
  }
  return styles[type] ?? { bg: 'bg-gray-50', border: 'border-gray-200' }
}

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekDaysFromToday(date: Date): { date: Date; key: string; label: string; dayNum: string; monthName: string }[] {
  const WEEKDAY_LABELS: Record<number, string> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Gio', 5: 'Ven', 6: 'Sab' }
  const days: { date: Date; key: string; label: string; dayNum: string; monthName: string }[] = []
  let d = new Date(date)
  d.setHours(0, 0, 0, 0)
  let added = 0
  while (added < 6) {
    if (d.getDay() !== 0) {
      days.push({
        date: new Date(d),
        key: toDateKey(d),
        label: WEEKDAY_LABELS[d.getDay()],
        dayNum: String(d.getDate()),
        monthName: d.toLocaleDateString('it-IT', { month: 'long' }),
      })
      added++
    }
    d.setDate(d.getDate() + 1)
  }
  return days
}

interface WeeklyCalendarViewProps {
  items: AgendaItem[]
  onItemClick?: (item: AgendaItem) => void
  onDeleteRequest?: (item: AgendaItem) => void | Promise<void>
  onReorder?: (dayKey: string, orderedItems: AgendaItem[]) => void | Promise<void>
  /** Se true, la tabella è integrata nella pagina senza contenitore/card bianca */
  embedded?: boolean
  /** Classe aggiuntiva per il contenitore (es. h-full min-h-0 quando embedded con altezza vincolata) */
  className?: string
}

export default function WeeklyCalendarView({ items, onItemClick, onDeleteRequest, onReorder, embedded, className }: WeeklyCalendarViewProps) {
  const [viewDate, setViewDate] = useState(new Date())
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    setIsMobile(mq.matches)
    const handler = () => setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const weekDays = useMemo(() => getWeekDaysFromToday(viewDate), [viewDate])
  const currentDayKey = isMobile ? toDateKey(viewDate) : null

  const itemsByDay = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {}
    const allKeys = isMobile && currentDayKey ? [currentDayKey] : weekDays.map((d) => d.key)
    allKeys.forEach((key) => { map[key] = [] })
    items.forEach((item) => {
      const key = item.activity_date?.split('T')[0] ?? ''
      if (map[key]) map[key].push(item)
    })
    allKeys.forEach((key) => {
      (map[key] || []).sort((a, b) => {
        const ta = (a.activity_time || '00:00').substring(0, 5)
        const tb = (b.activity_time || '00:00').substring(0, 5)
        return ta.localeCompare(tb)
      })
    })
    return map
  }, [items, weekDays, isMobile, currentDayKey])

  const prevDay = useCallback(() => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() - 1)
    setViewDate(d)
  }, [viewDate])

  const nextDay = useCallback(() => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + 1)
    setViewDate(d)
  }, [viewDate])

  const prevWeek = () => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() - 7)
    setViewDate(d)
  }

  const nextWeek = () => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + 7)
    setViewDate(d)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !onReorder) return
      const activeId = String(active.id)
      const overId = String(over.id)
      const dayKey = Object.keys(itemsByDay).find((k) =>
        (itemsByDay[k] ?? []).some((i) => i.id === activeId)
      )
      if (!dayKey) return
      const dayItems = itemsByDay[dayKey] ?? []
      const medicalItems = dayItems.filter((i) => i.activity_type !== 'physiotherapy')
      const oldIndex = medicalItems.findIndex((i) => i.id === activeId)
      const newIndex = medicalItems.findIndex((i) => i.id === overId)
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = [...medicalItems]
      const [removed] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, removed)
      onReorder(dayKey, reordered)
    },
    [itemsByDay, onReorder]
  )

  const todayKey = toDateKey(new Date())
  const displayDays = isMobile ? [currentDayKey!] : weekDays.map((d) => d.key)

  const renderDayHeader = (key: string) => {
    const dayInfo = weekDays.find((d) => d.key === key) ?? {
      date: new Date(key),
      key,
      label: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][new Date(key).getDay()],
      dayNum: key.split('-')[2],
      monthName: new Date(key).toLocaleDateString('it-IT', { month: 'long' }),
    }
    const isToday = key === todayKey
    const isSaturday = dayInfo.label === 'Sab'
    const dayItems = itemsByDay[key] ?? []
    return (
      <div
        key={key}
        className={`py-3 px-3 shrink-0 flex flex-col items-center border-r border-gray-500 flex-1 min-w-0 ${isSaturday ? 'bg-red-50' : 'bg-white'}`}
      >
        <div className={`flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg w-full ${isSaturday ? 'bg-red-100' : 'bg-slate-100'} ${isToday ? 'text-blue-700 font-semibold' : 'text-slate-800'}`}>
          <span className="text-xs font-medium uppercase tracking-wide w-9 lg:w-auto">{dayInfo.label}</span>
          <span className="text-base font-semibold">{dayInfo.dayNum}<span className="hidden lg:inline"> {dayInfo.monthName}</span></span>
          {dayItems.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
              {dayItems.length}
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderCard = (item: AgendaItem, showSortable: boolean) => {
    const style = getActivityStyle(item.activity_type)
    const startStr = item.activity_time ? String(item.activity_time).substring(0, 5) : '—'
    const endStr = getEndTime(item.activity_time, item.duration_minutes)
    const abbrev = abbreviateCategoryLabel(item.category_label || '')
    const badgeClass = getBadgeClass(abbrev)
    const cardContent = (
      <div className={`flex items-stretch rounded-xl overflow-hidden border-2 ${style.bg} ${style.border}`}>
        <button
          type="button"
          onClick={() => onItemClick?.(item)}
          className="flex-1 min-w-0 text-left px-4 py-3 transition-colors hover:opacity-90 flex items-center gap-3"
        >
          {abbrev !== '—' && (
            <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${badgeClass}`}>
              <span className="text-white font-bold text-xs">{abbrev.split(',')[0]?.trim() || '—'}</span>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 break-words">
              {startStr} · {item.person_name ?? '—'}
            </p>
            <p className="text-sm text-gray-600 truncate">
              {endStr ?? '—'} · {getActivityDisplayTitle(item.activity_type, item.activity_description)}
              {item.operator_name && item.operator_name !== '—' && ` · ${item.operator_name}`}
            </p>
          </div>
        </button>
        {onDeleteRequest && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(item) }}
            className="flex items-center justify-center shrink-0 px-4 text-red-500 hover:bg-red-50/50"
            aria-label="Elimina"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
    )
    if (showSortable && onReorder) {
      return (
        <SortableAgendaCard key={item.id} id={item.id}>
          <div className={`flex items-stretch rounded-xl overflow-hidden border-2 ${style.bg} ${style.border}`}>
            <button
              type="button"
              onClick={() => onItemClick?.(item)}
              className="flex-1 min-w-0 text-left px-4 py-3 transition-colors hover:opacity-90 flex items-center gap-3"
            >
              {abbrev !== '—' && (
                <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${badgeClass}`}>
                  <span className="text-white font-bold text-xs">{abbrev.split(',')[0]?.trim() || '—'}</span>
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 break-words">
                  {startStr} · {item.person_name ?? '—'}
                </p>
                <p className="text-sm text-gray-600 truncate">
                  {endStr ?? '—'} · {getActivityDisplayTitle(item.activity_type, item.activity_description)}
                  {item.operator_name && item.operator_name !== '—' && ` · ${item.operator_name}`}
                </p>
              </div>
            </button>
            {onDeleteRequest && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteRequest(item) }}
                className="flex items-center justify-center shrink-0 px-4 text-red-500 hover:bg-red-50/50"
                aria-label="Elimina"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </SortableAgendaCard>
      )
    }
    return <div key={item.id}>{cardContent}</div>
  }

  const renderDayColumn = (key: string) => {
    const dayItems = itemsByDay[key] ?? []
    const medicalItems = dayItems.filter((i) => i.activity_type !== 'physiotherapy')
    const physioItems = dayItems.filter((i) => i.activity_type === 'physiotherapy')
    const dayLabel = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][new Date(key).getDay()]
    const isSaturday = dayLabel === 'Sab'

    return (
      <div
        key={key}
        className={`py-3 px-3 shrink-0 flex flex-col items-center border-r border-gray-500 flex-1 min-w-0 ${isSaturday ? 'bg-red-50' : 'bg-white'}`}
      >
        {dayItems.length === 0 ? (
          <p className="text-sm text-gray-500 text-center w-full">Nessun appuntamento</p>
        ) : (
          <div className="space-y-4 w-full">
            {medicalItems.length > 0 && (
              <SortableContext items={medicalItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div>
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5 text-center">Visite mediche</p>
                  <div className="space-y-2">
                    {medicalItems.map((item) => renderCard(item, true))}
                  </div>
                </div>
              </SortableContext>
            )}
            {physioItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5 text-center">Fisioterapie</p>
                <div className="space-y-2">
                  {physioItems.map((item) => renderCard(item, false))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className={`flex flex-col min-h-0 min-w-0 relative ${className ?? ''}`}>
        {/* Scroll unico: header sticky + colonne, stessa struttura = allineamento perfetto */}
        <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white scrollbar-hide border border-gray-500 ${isMobile ? 'touch-pan-y' : ''}`}>
          <div className="flex flex-row shrink-0 sticky top-0 z-10 bg-white">
            <button
              type="button"
              onClick={isMobile ? prevDay : prevWeek}
              className="shrink-0 flex items-center justify-center p-2 lg:px-3 hover:bg-slate-100 transition-colors"
              aria-label={isMobile ? 'Giorno precedente' : 'Settimana precedente'}
            >
              <ChevronLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div className="flex flex-row flex-1 min-w-0">
              {displayDays.map((key) => renderDayHeader(key))}
            </div>
            <button
              type="button"
              onClick={isMobile ? nextDay : nextWeek}
              className="shrink-0 flex items-center justify-center p-2 lg:px-3 hover:bg-slate-100 transition-colors"
              aria-label={isMobile ? 'Giorno successivo' : 'Settimana successiva'}
            >
              <ChevronRight className="w-6 h-6 text-slate-600" />
            </button>
          </div>
          <div className="flex flex-row">
            <div className="shrink-0 flex items-center justify-center p-2 lg:px-3 invisible" aria-hidden>
              <ChevronLeft className="w-6 h-6" />
            </div>
            <div className="flex flex-row flex-1 min-w-0">
              {displayDays.map((key) => renderDayColumn(key))}
            </div>
            <div className="shrink-0 flex items-center justify-center p-2 lg:px-3 invisible" aria-hidden>
              <ChevronRight className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  )
}
