import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'
import RugbyClubAutocomplete from '@/components/RugbyClubAutocomplete'
import { saveEventFormDraft, loadEventFormDraft, clearEventFormDraft } from '@/lib/eventFormDraft'
import { Calendar, MapPin, Users, Trophy, FileText, FileDown, X, Pencil, Trash2, Handshake, GripVertical, Check, Search, Loader2, CalendarDays, LayoutList, ChevronLeft, ChevronRight } from 'lucide-react'
import { generateCouncilResocontoPdf } from '@/lib/councilResocontoPdf'
import { generateEventPresentationPdf } from '@/lib/eventPresentationPdf'
import { sortCouncilBySurnameWithPresidentFirst, sortCouncilParticipantNames, sortNamesBySurname, formatCouncilMemberLabel } from '@/lib/sortNames'
import {
  addOdgPoint,
  getOdgRegularPoints,
  isOdgClosurePoint,
  normalizeOrdineDelGiorno,
  removeOdgPointAt,
  reorderOdgPoints,
  updateOdgPointAt,
} from '@/lib/councilOrdineDelGiorno'
import {
  ALLEGATI_ACCEPT,
  allegatoOriginalBasename,
  buildAllegatoStorageFilename,
  getVerbaleStorageFiles,
  isAllowedAllegatoFile,
  nextVerbaleLabel,
  parseVerbaleDoc,
  parseVerbaleDocs,
  serializeVerbaleDocs,
  type VerbaleDoc,
} from '@/lib/verbaleDocuments'
import {
  buildStaffMeetingPeople,
  buildStaffMeetingSelectionSections,
  filterStaffMeetingByGroup,
  formatStaffMeetingChipLabel,
  staffMeetingInviteBelongsToPerson,
  staffMeetingInvitedLabelsForPerson,
  STAFF_MEETING_GROUPS,
  type StaffMeetingGroup,
  type StaffMeetingPerson,
} from '@/lib/staffMeetingPeople'
import { getBrandConfig, DEFAULT_BRAND_CONFIG } from '@/config/brand'
import AdaptiveLogo from '@/components/AdaptiveLogo'
import MatchListModal from '@/components/MatchListModal'
import GoleeAlertModal, { type GoleeAlertVariant } from '@/components/GoleeAlertModal'
import GoleeConfirmModal from '@/components/GoleeConfirmModal'
import GoleeRenameFileModal from '@/components/GoleeRenameFileModal'
import { getMatchListDisplayRole, getPlayerProfileRoleLabel } from '@/utils/personUtils'
import { formatDisplayPersonName } from '@/lib/formatPersonName'
import { resolveMatchListCreatedBy } from '@/lib/resolveMatchListCreatedBy'
import { useAuth } from '@/store/auth'
import { usePermissions } from '@/hooks/usePermissions'
import { useEventTypes } from '@/hooks/useEventTypes'
import { useTrainingVenues } from '@/hooks/useTrainingVenues'
import TrainingVenueSelect from '@/components/TrainingVenueSelect'
import {
  DEFAULT_EVENT_TYPES,
  getEventTypeBadgeLabel,
} from '@/config/eventTypes'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { snapCenterToCursor } from '@dnd-kit/modifiers'

const SWIPE_ZONE = 72
const SWIPE_THRESHOLD = 40

/** Palette gestionale sobria – stile Golee */
const GOLEE = {
  surface: '#FFFFFF',
  surfaceMuted: '#F7F8FA',
  border: '#E8EBF0',
  text: '#1F2933',
  textMuted: '#8A94A6',
  accent: '#27B36A',
  accentSoft: '#E8F8EF',
  accentHover: '#1F9A58',
  info: '#2477A8',
  infoSoft: '#E9F5FB',
} as const

const filterInputClass =
  'w-full min-w-0 rounded-md px-2.5 py-1.5 text-[13px] border bg-white text-gray-900 focus:ring-1 focus:ring-[#27B36A]/40 focus:outline-none focus:border-[#27B36A]/50'
const filterInputStyle = { borderColor: GOLEE.border, backgroundColor: '#FFFFFF', color: GOLEE.text }

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] as const

function eventOccursOnDate(event: Event, dateStr: string): boolean {
  if (!event.event_date) return false
  const start = event.event_date.slice(0, 10)
  const end = (event.event_end_date || event.event_date).slice(0, 10)
  return dateStr >= start && dateStr <= end
}

/** Data fine effettiva: per eventi plurigiorno usa event_end_date, altrimenti event_date. */
function getEventEffectiveEndDate(event: Pick<Event, 'event_date' | 'event_end_date'>): Date {
  const raw = (event.event_end_date || event.event_date || '').slice(0, 10)
  const d = new Date(raw)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * L'evento è concluso (va in Archiviate) dal giorno successivo alla data di fine.
 * Il giorno di fine incluso resta ancora in Eventi.
 */
function isEventConcluded(event: Pick<Event, 'event_date' | 'event_end_date' | 'archived'>, today = new Date()): boolean {
  if (event.archived === true) return true
  const end = getEventEffectiveEndDate(event)
  const day = new Date(today)
  day.setHours(0, 0, 0, 0)
  return end < day
}

/** Giorni di durata (inclusi inizio e fine). */
function getEventDateRangeDays(event: Pick<Event, 'event_date' | 'event_end_date'>): number {
  const start = (event.event_date || '').slice(0, 10)
  const end = (event.event_end_date || event.event_date || '').slice(0, 10)
  if (!start) return 1
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1)
}

/**
 * Data di raggruppamento in timeline:
 * - se l'evento è in corso → oggi
 * - altrimenti → data di inizio
 */
function getEventListAnchorDate(event: Pick<Event, 'event_date' | 'event_end_date'>, today = new Date()): string {
  const start = (event.event_date || '').slice(0, 10)
  const end = (event.event_end_date || event.event_date || '').slice(0, 10)
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const todayStr = `${y}-${m}-${d}`
  if (start && end && todayStr >= start && todayStr <= end) return todayStr
  return start
}

type EventCellTone = 'default' | 'win' | 'loss' | 'draw' | 'info' | 'gold' | 'muted'

type EventCellValue = {
  text: string
  tone?: EventCellTone
  title?: string
}

function formatEventListDateShort(dateString: string): string {
  if (!dateString) return '—'
  return new Date(`${dateString.slice(0, 10)}T00:00:00`).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
  })
}

function buildMonthCells(month: Date): Array<{ date: string | null; day: number | null }> {
  const year = month.getFullYear()
  const m = month.getMonth()
  const startOffset = (new Date(year, m, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const cells: Array<{ date: string | null; day: number | null }> = []
  for (let i = 0; i < startOffset; i++) cells.push({ date: null, day: null })
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      day: d,
    })
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null })
  return cells
}

function getEventCalendarLabel(event: Event): string {
  const time = event.start_time?.substring(0, 5) || event.event_time?.substring(0, 5) || ''
  const title =
    event.event_type === 'partita'
      ? (event.opponent?.trim() || getEventRowTitle(event))
      : getEventRowTitle(event)
  return time ? `${time} · ${title}` : title
}

function SortableOdgItem({
  id,
  point,
  index,
  onRemove,
  onStartEdit,
  isEditing,
  editValue,
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
  dark,
  isClosurePoint = false,
}: {
  id: string
  point: string
  index: number
  onRemove: () => void
  onStartEdit: () => void
  isEditing: boolean
  editValue: string
  onEditValueChange: (v: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  dark: boolean
  isClosurePoint?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isClosurePoint,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-1 p-2 rounded-lg min-w-0 ${dark ? 'bg-amber-500/20' : 'bg-amber-50'}`}
    >
      {isClosurePoint ? (
        <span className="flex w-6 shrink-0 items-center justify-center p-1" aria-hidden="true" />
      ) : (
        <button
          type="button"
          className="flex items-center justify-center p-1 shrink-0 cursor-grab active:cursor-grabbing touch-none rounded hover:bg-amber-400/30 transition-colors"
          aria-label="Trascina per riordinare"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5 text-amber-600" />
        </button>
      )}
      {isEditing ? (
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <input
            type="text"
            value={editValue}
            onChange={e => onEditValueChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSaveEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            className={`w-full px-2 py-1.5 rounded border text-sm ${dark ? 'bg-amber-900/30 border-amber-400/50 text-amber-100' : 'bg-white border-amber-300 text-gray-900'}`}
            autoFocus
          />
          <div className="flex gap-1">
            <button type="button" onClick={onSaveEdit} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${dark ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'}`}>
              <Check className="w-3.5 h-3.5" /> Salva
            </button>
            <button type="button" onClick={onCancelEdit} className={`px-2 py-1 rounded text-xs font-medium ${dark ? 'text-amber-300 hover:bg-amber-500/20' : 'text-gray-600 hover:bg-amber-100'}`}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <>
          <span
            className={`font-medium flex-1 min-w-0 text-base truncate ${isClosurePoint ? 'italic opacity-90' : `cursor-pointer ${dark ? 'text-amber-200 hover:text-amber-100' : 'text-amber-900 hover:text-amber-800'}`}`}
            onClick={isClosurePoint ? undefined : onStartEdit}
            title={isClosurePoint ? 'Punto fisso in chiusura' : 'Clicca per modificare'}
          >
            {index + 1}. {point}
          </span>
          {!isClosurePoint && (
            <>
              <button
                type="button"
                onClick={onStartEdit}
                className={`shrink-0 p-1 rounded ${dark ? 'text-amber-400 hover:bg-amber-500/30' : 'text-amber-600 hover:bg-amber-100'}`}
                title="Modifica"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                className={`shrink-0 text-sm leading-none ${dark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-800'}`}
                title="Elimina"
              >
                ✕
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

function SortableModalOdgItem({
  id,
  point,
  index,
  onRemove,
  onStartEdit,
  isEditing,
  editValue,
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
  saving,
  isClosurePoint = false,
}: {
  id: string
  point: string
  index: number
  onRemove: () => void
  onStartEdit: () => void
  isEditing: boolean
  editValue: string
  onEditValueChange: (v: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  saving: boolean
  isClosurePoint?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isClosurePoint,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-3 py-3 shadow-sm sm:px-4 ${isClosurePoint ? 'border-amber-300/80' : ''}`}
    >
      {isClosurePoint ? (
        <span className="h-8 w-8 shrink-0" aria-hidden="true" />
      ) : (
        <button
          type="button"
          disabled={saving || isEditing}
          className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-amber-600 opacity-40 transition-opacity hover:bg-amber-200/50 active:cursor-grabbing group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30 touch-none"
          aria-label="Trascina per riordinare"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
        {index + 1}
      </span>
      {isEditing ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            disabled={saving}
            className="min-w-0 flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-[17px] font-medium text-[#071226] focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:opacity-60"
            autoFocus
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={saving || !editValue.trim()}
              className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={saving}
              className="rounded-xl px-3 py-2 text-sm font-medium text-[#667085] hover:bg-amber-100 disabled:opacity-60"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className={`min-w-0 flex-1 text-[19px] font-medium leading-snug text-[#071226] ${isClosurePoint ? 'italic' : ''}`}>{point}</span>
          {!isClosurePoint && (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
              <button
                type="button"
                onClick={onStartEdit}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-amber-700 transition-colors hover:bg-amber-200/60 disabled:opacity-40"
                title="Modifica"
                aria-label="Modifica punto"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                title="Elimina"
                aria-label="Elimina punto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </li>
  )
}

function SortableParticipantItem({
  id,
  name,
  displayLabel,
  onRemoveToAbsent,
}: {
  id: string
  name: string
  displayLabel?: string
  onRemoveToAbsent: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-1 p-2 bg-blue-50 rounded-lg min-w-0"
    >
      <button
        type="button"
        className="flex items-center justify-center p-1 shrink-0 cursor-grab active:cursor-grabbing touch-none rounded hover:bg-blue-200/50 transition-colors"
        aria-label="Trascina per riordinare"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5 text-blue-600" />
      </button>
      <span className="text-blue-800 flex-1 min-w-0 text-base font-medium truncate">{displayLabel ?? name}</span>
      <button
        type="button"
        onClick={onRemoveToAbsent}
        className="text-red-600 hover:text-red-800 shrink-0 text-sm leading-none"
        title="Sposta in Assenti"
      >
        ✕
      </button>
    </div>
  )
}

/** Logo squadra: dopo 1s di hover ingrandimento 5× (Vista gironi / squadre) */
function HoverZoomTeamLogo({
  src,
  alt,
  className = 'h-8 w-8 shrink-0 rounded-lg p-0.5 ring-1 ring-slate-200',
}: {
  src: string
  alt: string
  className?: string
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [zoom, setZoom] = useState<{ top: number; left: number; size: number } | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleMouseEnter = () => {
    clearTimer()
    timerRef.current = setTimeout(() => {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setZoom({
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width / 2,
        size: rect.width * 5,
      })
    }, 1000)
  }

  const handleMouseLeave = () => {
    clearTimer()
    setZoom(null)
  }

  useEffect(() => () => clearTimer(), [])

  return (
    <>
      <div
        ref={anchorRef}
        className={`shrink-0 ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <AdaptiveLogo
          src={src}
          alt={alt}
          surface="light"
          className="h-full w-full"
          imgClassName="max-h-full max-w-full object-contain"
        />
      </div>
      {zoom && createPortal(
        <div
          className="pointer-events-none fixed z-[300] -translate-x-1/2 -translate-y-1/2"
          style={{ top: zoom.top, left: zoom.left }}
        >
          <div
            className="flex items-center justify-center rounded-xl bg-white p-2 shadow-2xl ring-2 ring-slate-300"
            style={{ width: zoom.size, height: zoom.size }}
          >
            <AdaptiveLogo
              src={src}
              alt={alt}
              surface="light"
              className="h-full w-full"
              imgClassName="max-h-full max-w-full object-contain"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

/** Anteprima compatta durante il trascinamento */
function TeamDragPreview({ teamName }: { teamName: string }) {
  return (
    <div className="flex w-44 items-center gap-2 rounded-xl bg-[#2A60A6] px-3 py-2 text-sm font-medium text-white shadow-lg min-h-[2.5rem] cursor-grabbing">
      <GripVertical className="h-4 w-4 shrink-0 opacity-80" />
      <span className="min-w-0 flex-1 truncate">{teamName}</span>
    </div>
  )
}

/** Card squadra trascinabile dalla riga "non assegnate" */
function DraggableTeamCard({
  id,
  teamName,
  source,
  onRemove
}: {
  id: string
  teamName: string
  source: string
  onRemove?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { teamName, source }
  })
  const draggableReturn = useDraggable({ id, data: { teamName, source } }) as any
  const transition = draggableReturn.transition
  const style = {
    // Con DragOverlay non spostare l'originale: resta al posto e si nasconde
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-full min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#2A60A6] text-white text-sm font-medium cursor-grab active:cursor-grabbing min-h-[2.5rem]"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-4 h-4 opacity-80 shrink-0" />
      <span className="flex-1 min-w-0 truncate">{teamName || '—'}</span>
      {onRemove && !isDragging && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onRemove()
          }}
          className="shrink-0 p-0.5 rounded opacity-70 hover:opacity-100 hover:bg-white/20 transition-opacity"
          title="Elimina squadra"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

/** Squadra sortable dentro un girone (trascinabile e riordinabile); occupa tutta la larghezza della cella. X per rimuovere dal girone. */
function SortableTeamInGirone({
  id,
  teamName,
  source,
  onRemove
}: {
  id: string
  teamName: string
  source: string
  onRemove?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { teamName, source }
  })
  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-full min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#2A60A6] text-white text-sm font-medium cursor-grab active:cursor-grabbing min-h-[2.5rem]"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-4 h-4 opacity-80 shrink-0" />
      <span className="flex-1 min-w-0 truncate">{teamName}</span>
      {onRemove && !isDragging && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onRemove()
          }}
          className="shrink-0 p-0.5 rounded opacity-70 hover:opacity-100 hover:bg-white/20 transition-opacity"
          title="Rimuovi dal girone (in attesa)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

/** Zona droppable per squadre non assegnate. */
function UnassignedDropZone({
  unassignedTeams,
  hasGironi,
  onRemoveTeam
}: {
  unassignedTeams: string[]
  hasGironi: boolean
  onRemoveTeam?: (teamName: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-unassigned' })
  const isEmpty = unassignedTeams.length === 0
  return (
    <div
      ref={setNodeRef}
      className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 items-center rounded-xl transition-colors border-2 border-dashed p-2 ${isEmpty ? 'min-h-[2.5rem]' : 'min-h-[5rem]'} ${isOver ? 'ring-2 ring-blue-400 bg-blue-50/50 border-blue-400' : 'border-blue-200/60 dark:border-blue-700/50'}`}
    >
      {unassignedTeams.length === 0 ? (
        <span className="col-span-full text-sm text-gray-500 dark:text-gray-400 text-center py-2">
          {hasGironi
            ? 'Trascina qui una squadra da un girone per rimetterla in riga'
            : 'Nessuna squadra inserita – aggiungine una sotto'}
        </span>
      ) : null}
      {unassignedTeams.map((teamName, index) => (
        <DraggableTeamCard
          key={`u-${teamName}-${index}`}
          id={`t-u-${index}`}
          teamName={teamName}
          source="unassigned"
          onRemove={onRemoveTeam ? () => onRemoveTeam(teamName) : undefined}
        />
      ))}
    </div>
  )
}

/**
 * Preferisci il box sotto il puntatore (non il centro geometrico più vicino).
 * Con closestCenter, trascinando sullo spazio vuoto del Girone 1 spesso vinceva il Girone 2.
 */
const gironiCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  const teamHit = pointerHits.find(
    (c) => String(c.id).startsWith('t-g-') || String(c.id).startsWith('t-u-')
  )
  if (teamHit) return [teamHit]
  const containerHit = pointerHits.find(
    (c) => String(c.id).startsWith('drop-girone-') || String(c.id) === 'drop-unassigned'
  )
  if (containerHit) return [containerHit]
  return closestCenter(args)
}

/** Box girone droppable con titolo, contatore, X e squadre sortable. Colonne in base a gironiCount: 3 gironi → max 2 squadre/riga, 4+ → 1/riga. */
function GironeDropBox({
  girone,
  gironiCount,
  editingGironeId,
  setEditingGironeId,
  onRename,
  onRemove,
  onRemoveTeam
}: {
  girone: { id: string; name: string; teams: string[] }
  gironiCount: number
  editingGironeId: string | null
  setEditingGironeId: (id: string | null) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
  onRemoveTeam?: (teamName: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop-girone-${girone.id}` })
  const sortableIds = girone.teams.map((_, i) => `t-g-${girone.id}-${i}`)
  const gridCols = gironiCount >= 4 ? 'grid-cols-1' : gironiCount === 3 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 border-blue-200 bg-blue-50/80 dark:bg-blue-900/20 dark:border-blue-700 p-4 min-h-[140px] flex flex-col transition-colors min-w-0 flex-1 ${isOver ? 'ring-2 ring-blue-400 bg-blue-100/80' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        {editingGironeId === girone.id ? (
          <input
            type="text"
            value={girone.name}
            onChange={(e) => onRename(girone.id, e.target.value)}
            onBlur={() => setEditingGironeId(null)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingGironeId(null)}
            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-blue-300 text-sm font-medium"
            autoFocus
          />
        ) : (
          <span
            className="font-medium text-blue-900 dark:text-blue-100 cursor-pointer truncate min-w-0"
            onClick={() => setEditingGironeId(girone.id)}
            title="Clicca per rinominare"
          >
            {girone.name}
          </span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">({girone.teams.length} squadre)</span>
          <button
            type="button"
            onClick={() => onRemove(girone.id)}
            className="p-1 rounded-lg text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
            title="Elimina girone"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        <div className={`flex-1 min-h-[72px] grid ${gridCols} gap-2 auto-rows-min items-start content-start`}>
          {girone.teams.map((t, i) => (
            <div key={`${girone.id}-${i}`} className="min-w-0 w-full">
              <SortableTeamInGirone
                id={`t-g-${girone.id}-${i}`}
                teamName={t}
                source={girone.id}
                onRemove={onRemoveTeam ? () => onRemoveTeam(t) : undefined}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

function renderEventRowTypeBadge(event: Event, typeLabel?: string) {
  const label = typeLabel?.trim() || ''
  const pillClass =
    'inline-flex items-center h-7 px-2 rounded-md text-[13px] font-semibold whitespace-nowrap bg-[#F4F6F8] text-[#465061] border border-[#E8EBF0]'
  if (event.event_type === 'partita') {
    if (event.is_championship) {
      return <span className={pillClass}>🏆 Campionato</span>
    }
    if (event.is_friendly) {
      return <span className={pillClass}>🤝 Amichevole</span>
    }
    return <span className={pillClass}>Partita</span>
  }
  if (event.event_type === 'torneo') {
    return <span className={pillClass}>🏆 {label || 'Torneo'}</span>
  }
  if (event.event_type === 'festa_del_rugby') {
    return <span className={pillClass}>🎉 {label || 'Festa del Rugby'}</span>
  }
  if (event.event_type === 'consiglio') {
    return <span className={pillClass}>{label || 'Consiglio'}</span>
  }
  if (label) {
    const isParty = /festa/i.test(label)
    return (
      <span className={pillClass}>
        {isParty ? `🎉 ${label}` : label}
      </span>
    )
  }
  return <span className={pillClass}>Evento</span>
}

function eventCellToneClass(tone: EventCellTone = 'default'): string {
  switch (tone) {
    case 'win':
      return 'text-[#087F5B] font-semibold'
    case 'loss':
      return 'text-[#C92A2A] font-semibold'
    case 'draw':
      return 'text-[#9B6900] font-semibold'
    case 'info':
      return 'text-[#1F6D99]'
    case 'gold':
      return 'text-[#9B6900] font-semibold'
    case 'muted':
      return 'text-[#8A94A6]'
    default:
      return 'text-[#155B83]'
  }
}

function getEventRowTitle(event: Event) {
  if (event.event_type === 'festa_del_rugby') {
    return event.title?.trim() || event.categories?.name?.trim() || 'Festa del Rugby'
  }
  return event.title?.trim() || '—'
}

const GIRONE_ACCENT_COLORS = ['#2F6DF6', '#10B7A6', '#F4B740', '#D14F83', '#8B5CF6', '#42C8FF', '#19B36B', '#E67E22']

type EventModalTab = 'overview' | 'groups' | 'teams' | 'formation' | 'agenda'

interface EventMatchList {
  id: string
  name: string
  type: 'match' | 'friendly' | 'training'
  category_id: string
  selected_players: { player_id: string; number: number }[]
  event_id: string | null
  created_by: string | null
  created_at: string
}

interface FormationPlayerDetail {
  player_id: string
  number: number
  name: string
  role: string
}

const RUGBY_MATCH_ROLES: Record<number, string> = {
  1: 'Pilone SX',
  2: 'Tallonatore',
  3: 'Pilone DX',
  4: '2^ Linea',
  5: '2^ Linea',
  6: 'Flanker',
  7: 'Flanker',
  8: 'Terza Centro',
  9: 'Mediano',
  10: 'Apertura',
  11: 'Ala',
  12: '1° Centro',
  13: '2° Centro',
  14: 'Ala',
  15: 'Estremo',
}

function getGironeAccentColor(index: number) {
  return GIRONE_ACCENT_COLORS[index % GIRONE_ACCENT_COLORS.length]
}

function getEventBadgeLabel(eventType: string) {
  return getEventTypeBadgeLabel(DEFAULT_EVENT_TYPES, eventType)
}

function formatEventHeaderDate(dateString: string) {
  const date = new Date(dateString)
  const weekday = date.toLocaleDateString('it-IT', { weekday: 'short' })
  const day = date.getDate()
  const month = date.toLocaleDateString('it-IT', { month: 'long' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} ${month}`
}

function getAllTeamsWithGirone(gironi: { id: string; name: string; teams: string[] }[]) {
  const items: { team: string; gironeId: string; gironeName: string }[] = []
  gironi.forEach(girone => {
    girone.teams.forEach(team => {
      items.push({ team, gironeId: girone.id, gironeName: girone.name })
    })
  })
  return items.sort((a, b) => a.team.localeCompare(b.team, 'it'))
}

function getClubLogoUrl(): string {
  const logo = getBrandConfig().assets.logo?.trim()
  return logo || DEFAULT_BRAND_CONFIG.assets.logo
}

function normalizeTeamName(name: string) {
  return name.trim().toUpperCase()
}

interface Event {
  id: string
  title: string
  event_date: string
  event_end_date?: string
  event_time?: string
  start_time?: string
  end_time?: string
  event_type: string
  category_id: string
  location: string
  away_location?: string
  is_home: boolean
  opponent?: string
  opponents?: string[]
  gironi?: { id: string; name: string; teams: string[] }[]
  description?: string
  participants?: string[]
  invited?: string[]
  ordine_del_giorno?: string[]
  verbale_pdf?: string
  verbale_pdfs?: string[]
  archived?: boolean
  match_result?: string
  tournament_winner?: string | null
  expects_tournament_winner?: boolean
  is_championship?: boolean
  is_friendly?: boolean
  created_at: string
  categories?: {
    code: string
    name: string
    abbreviation?: string | null
    sort?: number
  }
}

interface Category {
  id: string
  code: string
  name: string
  abbreviation?: string | null
}

interface CouncilMember {
  id: string
  name: string
  role: 'president' | 'vice_president' | 'counselor'
}

interface EventsProps {
  embedInLayout?: boolean
}

export type EventsHeaderStats = {
  totalEvents: number
  partite: number
  tornei: number
  consigli: number
}

export const EVENTS_STATS_UPDATED = 'events-stats-updated'
export const EVENTS_STATS_CLEARED = 'events-stats-cleared'

function getEventTimeRange(event: Event) {
  if (event.event_end_date && event.event_end_date !== event.event_date) {
    const start = new Date(event.event_date).toLocaleDateString('it-IT')
    const end = new Date(event.event_end_date).toLocaleDateString('it-IT')
    return `${start} – ${end}`
  }
  if (event.event_end_date) {
    return new Date(event.event_date).toLocaleDateString('it-IT')
  }
  if (event.start_time && event.end_time) {
    return `${event.start_time.substring(0, 5)} - ${event.end_time.substring(0, 5)}`
  }
  if (event.event_time) return event.event_time.substring(0, 5)
  return '—'
}

function getMultiTeamEventStats(event: Event) {
  const gironi = event.gironi ?? []
  const gironiCount = gironi.length
  let teamCount = 0
  if (event.opponents?.length) {
    teamCount = event.opponents.filter(opp => opp.trim() !== '').length
  } else if (gironi.length > 0) {
    teamCount = gironi.reduce((sum, girone) => sum + girone.teams.length, 0)
  }
  const teamsPerGirone =
    gironi.length > 0
      ? gironi[0]?.teams.length ?? Math.max(1, Math.round(teamCount / gironi.length) || 0)
      : 0
  return { gironi, gironiCount, teamCount, teamsPerGirone }
}

function getEventModalHeaderBadge(event: Event) {
  if (event.event_type === 'partita') {
    if (event.is_championship) return 'PARTITA · CAMPIONATO'
    if (event.is_friendly) return 'PARTITA · AMICHEVOLE'
    return 'PARTITA'
  }
  return getEventBadgeLabel(event.event_type)
}

function parseMatchResultScores(matchResult: string | undefined, isHome: boolean) {
  if (!matchResult?.trim()) return { ourScore: '', opponentScore: '' }

  const scorePattern = /^(\d+)\s*[-–]\s*(\d+)$/
  const match = matchResult.trim().match(scorePattern)
  if (!match) return { ourScore: '', opponentScore: '' }

  if (isHome) {
    return { ourScore: match[1], opponentScore: match[2] }
  }
  return { ourScore: match[2], opponentScore: match[1] }
}

function buildMatchResultFromScores(ourScore: string, opponentScore: string, isHome: boolean) {
  const our = ourScore.trim()
  const opponent = opponentScore.trim()
  if (!our && !opponent) return null
  if (!/^\d+$/.test(our) || !/^\d+$/.test(opponent)) return null
  return isHome ? `${our} - ${opponent}` : `${opponent} - ${our}`
}

function analyzeMatchResult(matchResult: string, isHome: boolean) {
  if (!matchResult || matchResult.trim() === '') {
    return { status: 'unknown' as const, ourScore: 0, opponentScore: 0, display: matchResult }
  }

  const parsed = parseMatchResultScores(matchResult, isHome)
  if (!parsed.ourScore || !parsed.opponentScore) {
    return { status: 'unknown' as const, ourScore: 0, opponentScore: 0, display: matchResult }
  }

  const ourScore = parseInt(parsed.ourScore, 10)
  const opponentScore = parseInt(parsed.opponentScore, 10)

  let status: 'win' | 'loss' | 'draw' | 'unknown'
  if (ourScore > opponentScore) status = 'win'
  else if (ourScore < opponentScore) status = 'loss'
  else status = 'draw'

  const display = matchResult.trim().replace(/\s*[-–]\s*/, ' - ')
  return { status, ourScore, opponentScore, display }
}

function getMatchResultStatusLabel(status: 'win' | 'loss' | 'draw' | 'unknown') {
  if (status === 'win') return 'Vittoria'
  if (status === 'loss') return 'Sconfitta'
  if (status === 'draw') return 'Pareggio'
  return ''
}

function getPartitaCategoryLabel(
  category: Pick<Category, 'abbreviation' | 'code' | 'name'> | Event['categories'] | null | undefined
) {
  return category?.abbreviation?.trim() || category?.code?.trim() || category?.name?.trim() || ''
}

function computeEventsHeaderStats(eventsList: Event[]): EventsHeaderStats {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcoming = eventsList.filter((event) => !isEventConcluded(event, today))

  return {
    totalEvents: upcoming.length,
    partite: upcoming.filter((e) => e.event_type === 'partita').length,
    tornei: upcoming.filter((e) => e.event_type === 'torneo').length,
    consigli: upcoming.filter((e) => e.event_type === 'consiglio').length,
  }
}

function getPartitaCategoryName(event: Event) {
  return getPartitaCategoryLabel(event.categories)
}

function stripOpponentCategorySuffix(
  opponentRaw: string,
  category: Pick<Category, 'abbreviation' | 'code' | 'name'> | Event['categories'] | null | undefined
) {
  let opponentBase = opponentRaw.trim()
  const suffixLabels = [
    category?.abbreviation?.trim(),
    category?.name?.trim(),
    category?.code?.trim(),
  ].filter((label): label is string => Boolean(label))

  for (const label of suffixLabels) {
    const suffix = ` – ${label}`
    if (opponentBase.endsWith(suffix)) {
      opponentBase = opponentBase.slice(0, -suffix.length).trim()
      break
    }
  }

  return opponentBase
}

function getOurPartitaTeamDisplayName(clubName: string, categoryName: string) {
  const club = clubName.trim()
  const category = categoryName.trim()
  if (club && category) return `${club} ${category}`
  return club || category || 'La nostra squadra'
}

function getOpponentPartitaTeamDisplayName(opponentName: string, categoryName: string) {
  const opponent = opponentName.trim()
  const category = categoryName.trim()
  if (opponent && category) return `${opponent} ${category}`
  return opponent
}

function getPartitaEventDisplayTitle(
  event: Pick<Event, 'opponent' | 'is_home' | 'categories'>,
  clubName: string
) {
  const categoryLabel = getPartitaCategoryLabel(event.categories)
  const opponentRaw = event.opponent?.trim() || ''
  if (!categoryLabel || !opponentRaw) return ''

  const opponentBase = stripOpponentCategorySuffix(opponentRaw, event.categories)

  const ourName = getOurPartitaTeamDisplayName(clubName, categoryLabel)
  const opponentName = getOpponentPartitaTeamDisplayName(opponentBase, categoryLabel)

  return event.is_home ? `${ourName} vs ${opponentName}` : `${opponentName} vs ${ourName}`
}

function PartitaResultBand({
  homeTeamName,
  awayTeamName,
  homeLogo,
  awayLogo,
  homeScore = '',
  awayScore = '',
  analysis = null,
  editable = false,
  onHomeScoreChange,
  onAwayScoreChange,
}: {
  homeTeamName: string
  awayTeamName: string
  homeLogo: string | null
  awayLogo: string | null
  homeScore?: string
  awayScore?: string
  analysis?: { status: 'win' | 'loss' | 'draw' | 'unknown'; display: string } | null
  editable?: boolean
  onHomeScoreChange?: (value: string) => void
  onAwayScoreChange?: (value: string) => void
}) {
  const hasCompleteResult = Boolean(homeScore.trim() && awayScore.trim())

  const resultBoxSizeClass = 'h-11 w-11 sm:h-[3.25rem] sm:w-[3.25rem]'
  const scoreBoxClass = hasCompleteResult
    ? 'bg-[#071226] text-white'
    : 'bg-[#E8EDF3] text-[#071226]'

  const middleLabel =
    hasCompleteResult && analysis && analysis.status !== 'unknown'
      ? getMatchResultStatusLabel(analysis.status).toUpperCase()
      : '-'

  const middleClass =
    hasCompleteResult && analysis?.status === 'win'
      ? 'text-emerald-600'
      : hasCompleteResult && analysis?.status === 'loss'
        ? 'text-red-600'
        : hasCompleteResult && analysis?.status === 'draw'
          ? 'text-gray-700'
          : 'text-[#94A3B8]'

  const renderLogo = (logo: string | null, teamName: string) =>
    logo ? (
      <AdaptiveLogo
        src={logo}
        alt={`Logo ${teamName}`}
        surface="light"
        className={`${resultBoxSizeClass} shrink-0 rounded-xl p-1.5 ring-1 ring-slate-200`}
      />
    ) : (
      <div className={`flex ${resultBoxSizeClass} shrink-0 items-center justify-center rounded-xl bg-[#071226] text-xs font-bold text-white sm:text-sm`}>
        {teamName.slice(0, 2).toUpperCase()}
      </div>
    )

  const renderScoreBox = (
    value: string,
    onChange: ((next: string) => void) | undefined,
    ariaLabel: string
  ) => {
    const sharedClass = `flex ${resultBoxSizeClass} items-center justify-center rounded-xl text-center text-2xl font-extrabold tabular-nums sm:text-3xl ${scoreBoxClass}`

    if (editable && onChange) {
      return (
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={e => {
            const next = e.target.value
            if (/^\d*$/.test(next)) onChange(next)
          }}
          className={`${sharedClass} focus:outline-none focus:ring-2 focus:ring-[#2F6DF6]/30`}
          aria-label={ariaLabel}
        />
      )
    }

    return <span className={sharedClass}>{value}</span>
  }

  const teamNameClass =
    'text-center text-[24px] font-semibold uppercase leading-tight tracking-tight text-[#071226] sm:text-[26px]'

  return (
    <div className="flex items-center rounded-2xl border border-[#DBE5F0] bg-white px-3 py-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center">
        {renderLogo(homeLogo, homeTeamName)}
        <div className="flex min-h-11 min-w-0 flex-1 items-center justify-center px-2 sm:min-h-[3.25rem] sm:px-3">
          <p className={teamNameClass}>{homeTeamName}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center justify-center px-2 sm:px-3">
        <div className="flex items-center gap-2 sm:gap-2.5">
          {renderScoreBox(homeScore, onHomeScoreChange, `Punteggio ${homeTeamName}`)}
          <span className={`min-w-[4.5rem] text-center text-xs font-bold uppercase tracking-[0.12em] sm:min-w-[5.5rem] sm:text-sm ${middleClass}`}>
            {middleLabel}
          </span>
          {renderScoreBox(awayScore, onAwayScoreChange, `Punteggio ${awayTeamName}`)}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center">
        <div className="flex min-h-11 min-w-0 flex-1 items-center justify-center px-2 sm:min-h-[3.25rem] sm:px-3">
          <p className={teamNameClass}>{awayTeamName}</p>
        </div>
        {renderLogo(awayLogo, awayTeamName)}
      </div>
    </div>
  )
}

export default function Events({ embedInLayout = false }: EventsProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile } = useAuth()
  const { isAdmin, isAllenatore, isTeamManager } = usePermissions()
  const canManageFormation = isAdmin() || isAllenatore() || isTeamManager()
  const {
    activeEventTypes,
    getLabel: getEventTypeLabel,
    getFormFields,
    isMultiTeam,
    getByCode,
    isClubParty,
  } = useEventTypes()
  const { requiresAwayDetail, isHomeVenue } = useTrainingVenues()
  const [events, setEvents] = useState<Event[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rugbyClubs, setRugbyClubs] = useState<{ id: string; name: string; logo_url?: string | null }[]>([])
  const [councilMembers, setCouncilMembers] = useState<CouncilMember[]>([])
  const [staffMeetingPeople, setStaffMeetingPeople] = useState<StaffMeetingPerson[]>([])
  const [staffMeetingGroups, setStaffMeetingGroups] = useState<StaffMeetingGroup[]>([])
  const [loadingStaffMeetingPeople, setLoadingStaffMeetingPeople] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_date: '',
    event_end_date: '',
    event_time: '',
    start_time: '',
    end_time: '',
    event_type: '',
    category_id: '',
    location: '',
    away_location: '',
    is_home: false,
    opponent: '',
    opponents: [] as string[],
    gironi: [] as { id: string; name: string; teams: string[] }[],
    description: '',
    participants: [] as string[],
    invited: [] as string[],
    ordine_del_giorno: [] as string[],
    verbale_pdf: '',
    verbale_pdfs: [] as string[],
    match_result: '',
    is_championship: false,
    is_friendly: true,
    expects_tournament_winner: false,
  })
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showDeleteEventDialog, setShowDeleteEventDialog] = useState(false)
  const [pendingSimpleDeleteEventId, setPendingSimpleDeleteEventId] = useState<string | null>(null)
  const [formAlert, setFormAlert] = useState<{
    title: string
    message: string
    variant: GoleeAlertVariant
  } | null>(null)
  const [staffSaveConfirm, setStaffSaveConfirm] = useState<'create' | 'update' | null>(null)
  const [allegatoRenameQueue, setAllegatoRenameQueue] = useState<{
    files: File[]
    index: number
    label: string
  } | null>(null)
  const [allegatoUploading, setAllegatoUploading] = useState(false)
  const [editingVerbaleFile, setEditingVerbaleFile] = useState<string | null>(null)
  const [editingVerbaleLabel, setEditingVerbaleLabel] = useState('')
  const [savingVerbaleLabel, setSavingVerbaleLabel] = useState(false)
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<string | null>(null)
  const [deletingEvent, setDeletingEvent] = useState(false)
  const [pendingEventType, setPendingEventType] = useState('')
  const [opponentCount, setOpponentCount] = useState(1)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventModalEditMode, setEventModalEditMode] = useState(false)
  const [eventModalEntered, setEventModalEntered] = useState(false)
  const eventModalCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const EVENT_MODAL_SLIDE_MS = 480
  const EVENT_MODAL_SLIDE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
  const [eventModalTab, setEventModalTab] = useState<EventModalTab>('overview')
  const [eventModalSearch, setEventModalSearch] = useState('')
  const [highlightedGironeId, setHighlightedGironeId] = useState<string | null>(null)
  const [modalMatchScoreOur, setModalMatchScoreOur] = useState('')
  const [modalMatchScoreOpponent, setModalMatchScoreOpponent] = useState('')
  const [savingModalMatchResult, setSavingModalMatchResult] = useState(false)
  const [tournamentWinnerDraft, setTournamentWinnerDraft] = useState('')
  const [savingTournamentWinner, setSavingTournamentWinner] = useState(false)
  const [modalEditingOdgIndex, setModalEditingOdgIndex] = useState<number | null>(null)
  const [modalEditingOdgValue, setModalEditingOdgValue] = useState('')
  const [savingModalOdg, setSavingModalOdg] = useState(false)
  const [showModalNewOdgInput, setShowModalNewOdgInput] = useState(false)
  const [modalNewOdgValue, setModalNewOdgValue] = useState('')
  const modalNewOdgInputRef = useRef<HTMLInputElement>(null)
  const [eventMatchList, setEventMatchList] = useState<EventMatchList | null>(null)
  const [eventFormationPlayers, setEventFormationPlayers] = useState<FormationPlayerDetail[]>([])
  const [loadingEventFormation, setLoadingEventFormation] = useState(false)
  const [showEventMatchListModal, setShowEventMatchListModal] = useState(false)
  const [editingEventMatchList, setEditingEventMatchList] = useState<EventMatchList | null>(null)
  const [showInvitedModal, setShowInvitedModal] = useState(false)
  const [tempInvited, setTempInvited] = useState<string[]>([])
  const [editingOpponentIndex, setEditingOpponentIndex] = useState<number | null>(null)
  const [editingGironeId, setEditingGironeId] = useState<string | null>(null)
  const [newTeamNameInput, setNewTeamNameInput] = useState('')
  const [activeTeamDrag, setActiveTeamDrag] = useState<string | null>(null)
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false)
  const [eventSwipeOffsets, setEventSwipeOffsets] = useState<Record<string, number>>({})
  const touchStartRef = useRef<{ eventId: string; x: number; baseOffset: number; lastOffset: number } | null>(null)
  
  // Tab Eventi / Archivio
  const [eventsTab, setEventsTab] = useState<'eventi' | 'archivio'>('eventi')
  const [eventsViewMode, setEventsViewMode] = useState<'list' | 'calendar'>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [filterDate, setFilterDate] = useState('')
  const [filterEventType, setFilterEventType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterKeyword, setFilterKeyword] = useState('')

  useEffect(() => {
    const check = () => setIsMobileOrTablet(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    loadEvents()
    loadCategories()
    loadCouncilMembers()
    loadRugbyClubs()
    loadStaffMeetingPeople()
  }, [])

  useEffect(() => {
    if (newEvent.event_type === 'incontro_staff' && staffMeetingPeople.length === 0) {
      void loadStaffMeetingPeople()
    }
    if (newEvent.event_type !== 'incontro_staff') {
      setStaffMeetingGroups([])
    }
  }, [newEvent.event_type])

  const [, setBrandRefresh] = useState(0)
  useEffect(() => {
    const onBrandUpdated = () => setBrandRefresh(t => t + 1)
    window.addEventListener('brand-config-updated', onBrandUpdated)
    return () => window.removeEventListener('brand-config-updated', onBrandUpdated)
  }, [])

  useEffect(() => {
    if (!selectedEvent || selectedEvent.event_type !== 'partita') {
      setModalMatchScoreOur('')
      setModalMatchScoreOpponent('')
      return
    }
    const parsed = parseMatchResultScores(selectedEvent.match_result, selectedEvent.is_home)
    setModalMatchScoreOur(parsed.ourScore)
    setModalMatchScoreOpponent(parsed.opponentScore)
  }, [selectedEvent?.id, selectedEvent?.match_result, selectedEvent?.is_home, selectedEvent?.event_type])

  useEffect(() => {
    if (!selectedEvent || selectedEvent.event_type !== 'partita') {
      setModalMatchScoreOur('')
      setModalMatchScoreOpponent('')
      return
    }
    const parsed = parseMatchResultScores(selectedEvent.match_result, selectedEvent.is_home)
    setModalMatchScoreOur(parsed.ourScore)
    setModalMatchScoreOpponent(parsed.opponentScore)
  }, [selectedEvent?.id, selectedEvent?.match_result, selectedEvent?.is_home, selectedEvent?.event_type])

  const loadEventFormation = useCallback(async (event: Event) => {
    if (event.event_type !== 'partita') {
      setEventMatchList(null)
      setEventFormationPlayers([])
      return
    }

    setLoadingEventFormation(true)
    try {
      const { data: list, error } = await supabase
        .from('match_lists')
        .select('*')
        .eq('event_id', event.id)
        .maybeSingle()

      if (error) throw error

      if (!list?.selected_players?.length) {
        setEventMatchList(list ?? null)
        setEventFormationPlayers([])
        return
      }

      const playerIds = list.selected_players.map((player: { player_id: string }) => player.player_id)

      const { data: positionsData } = await supabase
        .from('player_positions')
        .select('id, name')
        .order('position_order')
      const positionsMap = Object.fromEntries(
        (positionsData || []).map((position: { id: string; name: string }) => [position.id, position.name])
      )

      const { data: playersData, error: playersError } = await supabase
        .from('people')
        .select('id, full_name, player_positions')
        .in('id', playerIds)

      if (playersError) throw playersError

      const playersDetails = list.selected_players
        .map((selectedPlayer: { player_id: string; number: number }) => {
          const player = playersData?.find(p => p.id === selectedPlayer.player_id)
          const profileRole = getPlayerProfileRoleLabel(player?.player_positions, positionsMap)
          return {
            player_id: selectedPlayer.player_id,
            number: selectedPlayer.number,
            name: player?.full_name || 'Giocatore non trovato',
            role: getMatchListDisplayRole(selectedPlayer.number, profileRole, RUGBY_MATCH_ROLES),
          }
        })
        .sort((a: FormationPlayerDetail, b: FormationPlayerDetail) => a.number - b.number)

      setEventMatchList(list)
      setEventFormationPlayers(playersDetails)
    } catch (error) {
      console.error('Errore nel caricamento formazione:', error)
      setEventMatchList(null)
      setEventFormationPlayers([])
    } finally {
      setLoadingEventFormation(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedEvent || selectedEvent.event_type !== 'partita') {
      setEventMatchList(null)
      setEventFormationPlayers([])
      return
    }
    void loadEventFormation(selectedEvent)
  }, [selectedEvent?.id, selectedEvent?.event_type, loadEventFormation])

  useEffect(() => {
    setTournamentWinnerDraft(selectedEvent?.tournament_winner?.trim() || '')
  }, [selectedEvent?.id, selectedEvent?.tournament_winner])

  useEffect(() => {
    setModalEditingOdgIndex(null)
    setModalEditingOdgValue('')
    setShowModalNewOdgInput(false)
    setModalNewOdgValue('')
  }, [selectedEvent?.id])

  const goToManageRugbyClubs = () => {
    saveEventFormDraft({
      newEvent: { ...newEvent },
      showCreateForm,
      editingEvent: editingEvent ? { ...editingEvent } : null,
      newTeamNameInput,
      opponentCount,
    })
    navigate('/clubs', { state: { fromEvents: true } })
  }

  useEffect(() => {
    if (searchParams.get('restoreDraft') !== '1') return
    const draft = loadEventFormDraft()
    if (!draft) {
      setSearchParams({}, { replace: true })
      return
    }
    setNewEvent(draft.newEvent as typeof newEvent)
    setShowCreateForm(draft.showCreateForm)
    setEditingEvent(draft.editingEvent as unknown as Event | null)
    setNewTeamNameInput(draft.newTeamNameInput)
    setOpponentCount(draft.opponentCount)
    clearEventFormDraft()
    loadRugbyClubs()
    setSearchParams({}, { replace: true })
    setTimeout(() => {
      document.getElementById('event-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [searchParams])

  useEffect(() => {
    const eventId = searchParams.get('eventId')
    if (!eventId || loading || showEventModal || showCreateForm) return

    const eventToOpen = events.find((event) => event.id === eventId)
    if (!eventToOpen) return

    setSelectedEvent(
      eventToOpen.event_type === 'consiglio'
        ? { ...eventToOpen, ordine_del_giorno: normalizeOrdineDelGiorno(eventToOpen.ordine_del_giorno) }
        : eventToOpen,
    )
    setEventModalTab('overview')
    setEventModalSearch('')
    setHighlightedGironeId(null)
    setEventModalEditMode(false)
    setEventModalEntered(false)
    setShowEventModal(true)
  }, [events, loading, searchParams, showCreateForm, showEventModal])

  // Ascolta l'evento dal pulsante + nell'header ( quando embedInLayout )
  useEffect(() => {
    const handler = () => setShowCreateForm(true)
    window.addEventListener('open-create-event', handler)
    return () => window.removeEventListener('open-create-event', handler)
  }, [])

  // Segnala al layout se il form è aperto (per mostrare icona indietro in header)
  const formOpen = showCreateForm || !!editingEvent
  const eventsHeaderStats = useMemo(() => computeEventsHeaderStats(events), [events])
  useEffect(() => {
    if (formOpen) window.dispatchEvent(new CustomEvent('events-form-opened'))
    else window.dispatchEvent(new CustomEvent('events-form-closed'))
  }, [formOpen])
  useEffect(() => {
    if (!embedInLayout) return
    if (formOpen) {
      window.dispatchEvent(new CustomEvent(EVENTS_STATS_CLEARED))
      return
    }
    window.dispatchEvent(new CustomEvent(EVENTS_STATS_UPDATED, { detail: eventsHeaderStats }))
  }, [embedInLayout, formOpen, eventsHeaderStats])
  useEffect(() => {
    if (!embedInLayout) return
    return () => {
      window.dispatchEvent(new CustomEvent(EVENTS_STATS_CLEARED))
    }
  }, [embedInLayout])
  useEffect(() => {
    const handler = () => handleCancelEdit()
    window.addEventListener('events-close-form', handler)
    return () => window.removeEventListener('events-close-form', handler)
  }, [])

  // Aggiorna automaticamente il titolo quando cambiano i campi necessari per le partite
  useEffect(() => {
    if (newEvent.event_type === 'partita') {
      const autoTitle = generateEventTitle()
      if (autoTitle && autoTitle !== newEvent.title) {
        setNewEvent(prev => ({...prev, title: autoTitle}))
      }
    }
  }, [newEvent.event_type, newEvent.category_id, newEvent.opponent, newEvent.is_home, newEvent.location])

  const loadEvents = async () => {
    try {
      console.log('🔄 Caricamento eventi dal database...')
      
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          categories(id, code, name, abbreviation, sort)
        `)
        .order('event_date', { ascending: false })
        .limit(20)

      if (error) {
        console.error('❌ Errore nel caricamento eventi:', error)
        throw error
      }

      console.log('📊 Eventi caricati dal database:', data?.length || 0, 'eventi')
      console.log('📋 Lista eventi:', data)
      
      // Ordina gli eventi: futuri in ordine crescente, passati in ordine decrescente
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const sortedEvents = (data || []).sort((a, b) => {
        // Normalizza le date a mezzanotte per confrontare solo la parte della data
        const dateA = new Date(a.event_date)
        dateA.setHours(0, 0, 0, 0)
        const dateB = new Date(b.event_date)
        dateB.setHours(0, 0, 0, 0)
        
        // Concluso = dal giorno dopo la data di fine (event_end_date se presente)
        const isAPast = isEventConcluded(a, today)
        const isBPast = isEventConcluded(b, today)
        
        // Se uno è passato e l'altro futuro, i futuri vengono prima
        if (isAPast !== isBPast) {
          return isAPast ? 1 : -1
        }
        
        // Se entrambi sono futuri/in corso, ordine crescente (dal più prossimo)
        if (!isAPast && !isBPast) {
          // Prima confronta le date
          const dateDiff = dateA.getTime() - dateB.getTime()
          if (dateDiff !== 0) {
            return dateDiff
          }
          
          // Se la data è la stessa, ordina per orario di inizio
          const timeA = a.start_time || a.event_time || '00:00'
          const timeB = b.start_time || b.event_time || '00:00'
          const timeDiff = timeA.localeCompare(timeB)
          
          if (timeDiff !== 0) {
            return timeDiff
          }
          
          // Se anche l'orario è lo stesso, ordina per categoria (inferiore a salire)
          const sortA = a.categories?.sort ?? 999
          const sortB = b.categories?.sort ?? 999
          return sortA - sortB
        }
        
        // Se entrambi sono passati, ordine decrescente (dal più recente = data fine più recente)
        if (isAPast && isBPast) {
          const endA = getEventEffectiveEndDate(a).getTime()
          const endB = getEventEffectiveEndDate(b).getTime()
          const dateDiff = endB - endA
          if (dateDiff !== 0) {
            return dateDiff
          }
          
          // Se la data è la stessa, ordina per orario di inizio (decrescente per i passati)
          const timeA = a.start_time || a.event_time || '00:00'
          const timeB = b.start_time || b.event_time || '00:00'
          return timeB.localeCompare(timeA)
        }
        
        return 0
      })
      
      console.log('📝 Aggiorno lo stato con:', sortedEvents.length, 'eventi')
      setEvents(sortedEvents)
      console.log('✅ Stato aggiornato!')
    } catch (error) {
      console.error('❌ Errore nel caricamento eventi:', error)
    } finally {
      setLoading(false)
    }
  }

  // Funzione per filtrare gli eventi
  const filterEvents = (eventsList: Event[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return eventsList.filter(event => {
      // Tab Eventi: ancora in corso o futuri (fino al giorno di fine incluso) | Archivio: conclusi dal giorno dopo la fine, o flag archived
      const concluded = isEventConcluded(event, today)
      if (eventsTab === 'eventi' && concluded) return false
      if (eventsTab === 'archivio' && !concluded) return false

      if (filterDate) {
        // Include eventi plurigiorno se la data filtrata cade nell'intervallo inizio–fine
        if (!eventOccursOnDate(event, filterDate)) return false
      }
      if (filterEventType && event.event_type !== filterEventType) return false
      if (filterCategory && event.category_id !== filterCategory) return false
      if (filterKeyword) {
        const keyword = filterKeyword.toLowerCase().trim()
        const typeLabel = getEventTypeLabel(event.event_type)
        const typeBadgeExtras = [
          typeLabel,
          event.event_type?.replace(/_/g, ' '),
          getEventIcon(event),
          // Campionato / Amichevole solo per partite (come in pill), altrimenti falsi positivi
          event.event_type === 'partita' && event.is_championship ? 'Campionato' : '',
          event.event_type === 'partita' && event.is_friendly ? 'Amichevole' : '',
        ]
        const searchableText = [
          event.title,
          event.description,
          event.location,
          event.away_location,
          event.opponent,
          event.opponents?.join(' '),
          event.participants?.join(' '),
          event.invited?.join(' '),
          event.ordine_del_giorno?.join(' '),
          event.match_result,
          event.categories?.name,
          event.categories?.code,
          event.categories?.abbreviation,
          ...typeBadgeExtras,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!searchableText.includes(keyword)) return false
      }

      return true
    })
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('sort', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const loadRugbyClubs = async () => {
    try {
      const { data, error } = await supabase
        .from('origin_clubs')
        .select('id, name, logo_url')
        .order('name', { ascending: true })

      if (error) throw error
      const sorted = (data || []).sort((a, b) =>
        a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })
      )
      setRugbyClubs(sorted)
    } catch (error) {
      console.error('Errore nel caricamento società di rugby:', error)
    }
  }

  const loadCouncilMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('council_members')
        .select('*')
        .order('role', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      setCouncilMembers(data || [])
    } catch (error) {
      console.error('Errore nel caricamento membri consiglio:', error)
    }
  }

  const loadStaffMeetingPeople = async () => {
    try {
      setLoadingStaffMeetingPeople(true)
      const [
        { data: rolesData },
        { data: peopleData, error: peopleError },
        { data: catsData },
      ] = await Promise.all([
        supabase.from('user_roles').select('id, name').order('name'),
        supabase
          .from('people')
          .select('id, given_name, family_name, full_name, staff_roles, staff_categories, app_role, additional_roles')
          .not('full_name', 'is', null)
          .order('family_name', { ascending: true }),
        supabase.from('categories').select('id, name, abbreviation, code, sort').order('sort', { ascending: true }),
      ])
      if (peopleError) throw peopleError
      const cats =
        (catsData as {
          id: string
          name: string
          abbreviation?: string | null
          code?: string | null
          sort?: number | null
        }[] | null) ||
        categories.map((c) => ({
          id: c.id,
          name: c.name,
          abbreviation: (c as { abbreviation?: string | null }).abbreviation,
          code: c.code,
          sort: (c as { sort?: number | null }).sort,
        }))
      const built = buildStaffMeetingPeople(peopleData || [], rolesData || [], cats)
      setStaffMeetingPeople(built)
    } catch (error) {
      console.error('Errore nel caricamento staff per incontro:', error)
      setStaffMeetingPeople([])
    } finally {
      setLoadingStaffMeetingPeople(false)
    }
  }

  const buildFestaDelRugbyTitle = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId)
    return category ? `Festa del Rugby - ${category.name}` : 'Festa del Rugby'
  }

  const handleGenerateFormEventPdf = () => {
    if (newEvent.event_type === 'consiglio' || isClubParty(newEvent.event_type)) return
    const title =
      newEvent.event_type === 'festa_del_rugby'
        ? buildFestaDelRugbyTitle(newEvent.category_id)
        : newEvent.title
    const category = categories.find((c) => c.id === newEvent.category_id)
    const staffPresenti =
      newEvent.event_type === 'incontro_staff'
        ? sortNamesBySurname((newEvent.participants || []).filter((n) => n.trim()))
        : undefined
    const staffAssenti =
      newEvent.event_type === 'incontro_staff' && (staffPresenti?.length ?? 0) > 0
        ? sortNamesBySurname(
            (newEvent.invited || []).filter(
              (n) => n.trim() && !(newEvent.participants || []).includes(n),
            ),
          )
        : undefined
    generateEventPresentationPdf({
      title,
      event_date: newEvent.event_date,
      start_time: newEvent.start_time,
      end_time: newEvent.end_time,
      event_time: newEvent.event_time,
      event_type: newEvent.event_type,
      location: newEvent.location,
      away_location: newEvent.away_location,
      is_home: newEvent.is_home,
      opponent: newEvent.opponent,
      opponents:
        newEvent.event_type === 'partita' && newEvent.opponent
          ? [newEvent.opponent]
          : (newEvent.opponents ?? []).filter((t) => t?.trim()),
      gironi: newEvent.gironi,
      categories: category
        ? {
            name: category.name,
            code: category.code,
            abbreviation: category.abbreviation,
          }
        : undefined,
      is_championship: newEvent.is_championship,
      is_friendly: newEvent.is_friendly,
      description: newEvent.description,
      presenti: staffPresenti,
      assenti: staffAssenti,
      ordine_del_giorno:
        newEvent.event_type === 'incontro_staff'
          ? normalizeOrdineDelGiorno(newEvent.ordine_del_giorno)
          : undefined,
      allegati:
        newEvent.event_type === 'incontro_staff'
          ? parseVerbaleDocs(newEvent.verbale_pdfs).map((d) => d.label)
          : undefined,
      tuttiPresenti:
        newEvent.event_type === 'incontro_staff'
          ? (() => {
              const invited = (newEvent.invited || []).filter((n) => n.trim())
              const present = (newEvent.participants || []).filter((n) => n.trim())
              if (invited.length === 0 || present.length === 0) return false
              const presentSet = new Set(present)
              return invited.every((n) => presentSet.has(n))
            })()
          : undefined,
    })
  }

  const showFormAlert = (
    message: string,
    title = 'Attenzione',
    variant: GoleeAlertVariant = 'warning',
  ) => {
    setFormAlert({ title, message, variant })
  }

  const validateRequiredCategory = () => {
    const typeCfg = getByCode(newEvent.event_type)
    if (typeCfg?.form_fields.requiresCategory && !newEvent.category_id) {
      showFormAlert(`Seleziona la categoria per "${typeCfg.name}".`)
      return false
    }
    return true
  }

  const validateCouncilOrdineDelGiorno = () => {
    if (newEvent.event_type !== 'consiglio') return true
    if (getOdgRegularPoints(newEvent.ordine_del_giorno).length === 0) {
      showFormAlert(
        "Inserisci almeno un punto nell'ordine del giorno. È obbligatorio per il consiglio.",
        'Ordine del giorno richiesto',
      )
      setOdgEmptyHint(true)
      odgInputRef.current?.focus()
      return false
    }
    return true
  }

  /** Validazione Incontro Staff al Salva. Restituisce 'ok' | 'blocked' | 'confirm'. */
  const checkStaffMeetingSave = (): 'ok' | 'blocked' | 'confirm' => {
    if (newEvent.event_type !== 'incontro_staff') return 'ok'
    const hasDescription = Boolean(newEvent.description?.trim())
    const hasOdg = getOdgRegularPoints(newEvent.ordine_del_giorno).length > 0
    if (!hasDescription && !hasOdg) {
      showFormAlert(
        'Inserisci una descrizione oppure almeno un punto nell’ordine del giorno.',
        'Contenuto richiesto',
      )
      return 'blocked'
    }
    if (hasDescription && !hasOdg) return 'confirm'
    return 'ok'
  }

  const buildStaffOrCouncilOdgField = () => {
    if (newEvent.event_type === 'consiglio' || newEvent.event_type === 'incontro_staff') {
      const normalized = normalizeOrdineDelGiorno(newEvent.ordine_del_giorno)
      return normalized.length > 0 ? normalized : null
    }
    return null
  }

  const buildStaffOrCouncilVerbalePdfs = () => {
    if (newEvent.event_type === 'consiglio' || newEvent.event_type === 'incontro_staff') {
      return newEvent.verbale_pdfs?.length ? newEvent.verbale_pdfs : null
    }
    return null
  }

  const buildTournamentWinnerFields = (
    eventType: string,
    expectsWinner: boolean,
    existingWinner?: string | null,
  ) => {
    const allows = getFormFields(eventType).allowsTournamentWinner
    const active = allows && expectsWinner
    return {
      expects_tournament_winner: active,
      tournament_winner: active ? (existingWinner?.trim() || null) : null,
    }
  }

  const handleCreateEvent = async (e?: React.FormEvent, skipStaffConfirm = false) => {
    e?.preventDefault()

    if (!newEvent.event_type) {
      showFormAlert('Seleziona un tipo evento.')
      return
    }
    
    // Validazione: per le partite, deve essere selezionato almeno Campionato o Amichevole
    if (newEvent.event_type === 'partita' && !newEvent.is_championship && !newEvent.is_friendly) {
      showFormAlert('Per le partite devi selezionare almeno "Campionato" o "Amichevole".')
      return
    }

    if (!validateRequiredCategory()) return
    if (!validateCouncilOrdineDelGiorno()) return

    if (!skipStaffConfirm) {
      const staffCheck = checkStaffMeetingSave()
      if (staffCheck === 'blocked') return
      if (staffCheck === 'confirm') {
        setStaffSaveConfirm('create')
        return
      }
    }

    const fields = getFormFields(newEvent.event_type)
    if (fields.isClubParty) {
      if (!newEvent.event_end_date) {
        showFormAlert('Inserisci la data di fine festa.')
        return
      }
      if (newEvent.event_end_date < newEvent.event_date) {
        showFormAlert('La data di fine festa non può essere precedente alla data di inizio.')
        return
      }
    }

    try {
      const festaTitle = newEvent.event_type === 'festa_del_rugby'
        ? buildFestaDelRugbyTitle(newEvent.category_id)
        : newEvent.title

      const { match_result: _ignoredResult, ...newEventFields } = newEvent

      // Prepara i dati per l'inserimento
      const eventData = {
        ...newEventFields,
        title: festaTitle,
        opponent: isMultiTeam(newEvent.event_type) ? null : newEvent.opponent,
        opponents: isMultiTeam(newEvent.event_type) ? newEvent.opponents : null,
        gironi: isMultiTeam(newEvent.event_type) ? (newEvent.gironi ?? null) : null,
        start_time: fields.isClubParty ? null : (newEvent.start_time || null),
        end_time: fields.isClubParty ? null : (newEvent.end_time || null),
        event_time: fields.isClubParty ? null : (newEvent.event_time || null),
        event_end_date: fields.isClubParty ? (newEvent.event_end_date || null) : null,
        // Per consiglio e incontro staff: participants / invited
        participants:
          newEvent.event_type === 'consiglio' || newEvent.event_type === 'incontro_staff'
            ? newEvent.participants
            : null,
        invited:
          newEvent.event_type === 'consiglio' || newEvent.event_type === 'incontro_staff'
            ? newEvent.invited
            : null,
        ordine_del_giorno: buildStaffOrCouncilOdgField(),
        verbale_pdf: newEvent.event_type === 'consiglio' ? newEvent.verbale_pdf : null,
        verbale_pdfs: buildStaffOrCouncilVerbalePdfs(),
        // Archivia automaticamente quando si carica almeno un PDF verbale
        archived: newEvent.event_type === 'consiglio' && (newEvent.verbale_pdf || (newEvent.verbale_pdfs?.length ?? 0) > 0),
        // Il risultato partita si inserisce altrove (panoramica evento, statistiche, ecc.)
        match_result: null,
        // Gestisci category_id per eventi che non richiedono categoria
        category_id: newEvent.category_id || null,
        // Campionato / Amichevole solo per partite
        is_championship: newEvent.event_type === 'partita' ? !!newEvent.is_championship : false,
        is_friendly: newEvent.event_type === 'partita' ? !!newEvent.is_friendly : false,
        ...buildTournamentWinnerFields(newEvent.event_type, newEvent.expects_tournament_winner),
      }
      
      // I campi is_championship e is_friendly vengono salvati nel database
      
      console.log('🔍 Dati da creare:', eventData)
      console.log('🔍 Data evento:', eventData.event_date)
      
      const { error } = await supabase
        .from('events')
        .insert([eventData])

      if (error) throw error

      setShowCreateForm(false)
      resetForm()
      loadEvents()
    } catch (error) {
      console.error('Errore nella creazione evento:', error)
    }
  }

  const handleEditEvent = (event: Event, options: { insideEventModal?: boolean } = {}) => {
    setEditingEvent(event)
    
    // Per i consigli e le feste del rugby, genera il titolo automaticamente
    let title = event.title
    if (event.event_type === 'consiglio' && event.event_date) {
      title = `Consiglio del ${new Date(event.event_date).toLocaleDateString('it-IT')}`
    } else if (event.event_type === 'festa_del_rugby' && event.category_id) {
      const category = categories.find(cat => cat.id === event.category_id)
      title = category ? `Festa del Rugby - ${category.name}` : 'Festa del Rugby'
    }
    
    setNewEvent({
      title: title,
      event_date: event.event_date,
      event_end_date: event.event_end_date || '',
      event_time: event.event_time || '',
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      event_type: event.event_type,
      category_id: event.category_id,
      location: event.location,
      away_location: event.away_location || '',
      is_home: event.is_home,
      opponent: event.opponent || '',
      opponents: event.opponents || [],
      gironi: event.gironi || [],
      description: event.description || '',
      participants:
        event.event_type === 'consiglio'
          ? sortCouncilParticipantNames(event.participants || [], councilMembers)
          : (event.participants || []),
      invited:
        event.event_type === 'incontro_staff'
          ? Array.from(
              new Set([
                ...(event.invited || []),
                ...(event.participants || []),
              ].filter((n) => n.trim())),
            )
          : (event.invited || []),
      ordine_del_giorno:
        event.event_type === 'consiglio' || event.event_type === 'incontro_staff'
          ? normalizeOrdineDelGiorno(event.ordine_del_giorno || [])
          : (event.ordine_del_giorno || []),
      verbale_pdf: event.verbale_pdf || '',
      verbale_pdfs: event.verbale_pdfs || [],
      match_result: event.match_result || '',
      is_championship: event.event_type === 'partita' ? (event.is_championship || false) : false,
      is_friendly: event.event_type === 'partita' ? (event.is_friendly || false) : false,
      expects_tournament_winner: event.expects_tournament_winner ?? false,
    })
    setOpponentCount(event.opponents?.length || 1)
    setEventModalEditMode(!!options.insideEventModal)
    setShowCreateForm(true)
    
    // Scroll al form dopo un breve delay per permettere il rendering
    setTimeout(() => {
      const formElement = document.getElementById('event-form')
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const handleUpdateEvent = async (e?: React.FormEvent, skipStaffConfirm = false) => {
    e?.preventDefault()
    
    if (!editingEvent) return
    
    // Validazione: per le partite, deve essere selezionato almeno Campionato o Amichevole
    if (newEvent.event_type === 'partita' && !newEvent.is_championship && !newEvent.is_friendly) {
      showFormAlert('Per le partite devi selezionare almeno "Campionato" o "Amichevole".')
      return
    }

    if (!validateRequiredCategory()) return
    if (!validateCouncilOrdineDelGiorno()) return

    if (!skipStaffConfirm) {
      const staffCheck = checkStaffMeetingSave()
      if (staffCheck === 'blocked') return
      if (staffCheck === 'confirm') {
        setStaffSaveConfirm('update')
        return
      }
    }

    const fields = getFormFields(newEvent.event_type)
    if (fields.isClubParty) {
      if (!newEvent.event_end_date) {
        showFormAlert('Inserisci la data di fine festa.')
        return
      }
      if (newEvent.event_end_date < newEvent.event_date) {
        showFormAlert('La data di fine festa non può essere precedente alla data di inizio.')
        return
      }
    }
    
    try {
      const festaTitle = newEvent.event_type === 'festa_del_rugby'
        ? buildFestaDelRugbyTitle(newEvent.category_id)
        : newEvent.title

      const { match_result: _ignoredResult, ...newEventFields } = newEvent

      // Prepara i dati per l'aggiornamento (match_result escluso: si gestisce altrove)
      const eventData = {
        ...newEventFields,
        title: festaTitle,
        opponent: isMultiTeam(newEvent.event_type) ? null : newEvent.opponent,
        opponents: isMultiTeam(newEvent.event_type) ? newEvent.opponents : null,
        gironi: isMultiTeam(newEvent.event_type) ? (newEvent.gironi ?? null) : null,
        start_time: fields.isClubParty ? null : (newEvent.start_time || null),
        end_time: fields.isClubParty ? null : (newEvent.end_time || null),
        event_time: fields.isClubParty ? null : (newEvent.event_time || null),
        event_end_date: fields.isClubParty ? (newEvent.event_end_date || null) : null,
        // Per consiglio e incontro staff: participants / invited
        participants:
          newEvent.event_type === 'consiglio' || newEvent.event_type === 'incontro_staff'
            ? newEvent.participants
            : null,
        invited:
          newEvent.event_type === 'consiglio' || newEvent.event_type === 'incontro_staff'
            ? newEvent.invited
            : null,
        ordine_del_giorno: buildStaffOrCouncilOdgField(),
        verbale_pdf: newEvent.event_type === 'consiglio' ? newEvent.verbale_pdf : null,
        verbale_pdfs: buildStaffOrCouncilVerbalePdfs(),
        // Archivia automaticamente quando si carica almeno un PDF verbale
        archived: newEvent.event_type === 'consiglio' && (newEvent.verbale_pdf || (newEvent.verbale_pdfs?.length ?? 0) > 0),
        // Gestisci category_id per eventi che non richiedono categoria
        category_id: newEvent.category_id || null,
        // Campionato / Amichevole solo per partite
        is_championship: newEvent.event_type === 'partita' ? !!newEvent.is_championship : false,
        is_friendly: newEvent.event_type === 'partita' ? !!newEvent.is_friendly : false,
        ...buildTournamentWinnerFields(
          newEvent.event_type,
          newEvent.expects_tournament_winner,
          editingEvent.tournament_winner,
        ),
      }
      
      // I campi is_championship e is_friendly vengono salvati nel database
      

      
      const { error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', editingEvent.id)

      if (error) throw error

      const shouldReturnToOrigin = eventModalEditMode
      setShowCreateForm(false)
      setEditingEvent(null)
      setEventModalEditMode(false)
      resetForm()
      loadEvents()
      if (shouldReturnToOrigin) returnToEventOrigin()
    } catch (error) {
      console.error('Errore nell\'aggiornamento evento:', error)
    }
  }

  const handleCancelEdit = () => {
    const shouldReturnToOrigin = eventModalEditMode
    setShowCreateForm(false)
    setEditingEvent(null)
    setEventModalEditMode(false)
    resetForm()
    if (shouldReturnToOrigin) returnToEventOrigin()
  }

  const resetForm = () => {
    setNewEvent({
      title: '',
      event_date: '',
      event_end_date: '',
      event_time: '',
      start_time: '',
      end_time: '',
      event_type: '',
      category_id: '',
      location: '',
      away_location: '',
      is_home: false,
      opponent: '',
      opponents: [],
      gironi: [],
      description: '',
      participants: [],
      invited: [],
      ordine_del_giorno: [],
      verbale_pdf: '',
      verbale_pdfs: [],
      match_result: '',
      is_championship: false,
      is_friendly: true,
      expects_tournament_winner: false,
    })
    setOpponentCount(1)
    setNewOdgPoint('')
  }

  const deleteMatchListForEvent = async (eventId: string) => {
    const { error } = await supabase
      .from('match_lists')
      .delete()
      .eq('event_id', eventId)

    if (error) throw error
  }

  const eventHasMatchList = async (eventId: string, eventType?: string) => {
    if (eventType !== 'partita') return false

    if (selectedEvent?.id === eventId) {
      if (eventMatchList) return true
      if (eventFormationPlayers.length > 0) return true
    }

    const { data, error } = await supabase
      .from('match_lists')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle()

    if (error) throw error
    return !!data
  }

  const performDeleteEvent = async (eventId: string, deleteMatchList = false) => {
    try {
      setDeletingEvent(true)
      console.log('🗑️ Inizio eliminazione evento:', eventId)

      const eventToDelete = events.find(event => event.id === eventId) || (selectedEvent?.id === eventId ? selectedEvent : null)
      console.log('🔍 Evento da eliminare:', eventToDelete)

      if (deleteMatchList) {
        await deleteMatchListForEvent(eventId)
      }

      const { error, count } = await supabase
        .from('events')
        .delete({ count: 'exact' })
        .eq('id', eventId)

      if (error) {
        console.error('❌ Errore Supabase:', error)
        throw error
      }

      console.log('✅ Evento eliminato dal database - Righe eliminate:', count)

      if (count === 0) {
        console.warn('⚠️ ATTENZIONE: Nessuna riga eliminata! L\'evento potrebbe non esistere o non avere i permessi')
        showFormAlert(
          'L\'evento non è stato eliminato. Controlla i permessi del database.',
          'Eliminazione non riuscita',
          'error',
        )
        return
      }

      const pdfFiles = getVerbaleStorageFiles(eventToDelete?.verbale_pdf, eventToDelete?.verbale_pdfs)

      if (pdfFiles.length > 0) {
        try {
          const filePaths = pdfFiles.map(filename => `events/${filename}`)
          const { error: storageError } = await supabase.storage
            .from('docs')
            .remove(filePaths)

          if (storageError) {
            console.warn('Errore nell\'eliminazione dei file PDF da Supabase Storage:', storageError)
          } else {
            console.log('File PDF eliminati da Supabase Storage:', pdfFiles)
          }

          pdfFiles.forEach(filename => {
            localStorage.removeItem(`pdf_${filename}`)
          })
        } catch (fileError) {
          console.warn('Errore nell\'eliminazione dei file PDF:', fileError)
        }
      }

      if (selectedEvent?.id === eventId) {
        handleCloseEventModal()
      }

      console.log('🔄 Ricarico la lista eventi...')
      await loadEvents()
      console.log('✅ Lista eventi ricaricata')

      showFormAlert('Evento eliminato con successo.', 'Eliminazione completata', 'success')
    } catch (error) {
      console.error('❌ Errore nell\'eliminazione evento:', error)
      showFormAlert(
        `Errore nell'eliminazione dell'evento: ${(error as Error).message}`,
        'Eliminazione non riuscita',
        'error',
      )
    } finally {
      setDeletingEvent(false)
    }
  }

  const handleRequestDeleteEvent = async (eventId: string) => {
    const eventToDelete = events.find(event => event.id === eventId) || (selectedEvent?.id === eventId ? selectedEvent : null)
    if (!eventToDelete) return

    try {
      const hasMatchList = await eventHasMatchList(eventId, eventToDelete.event_type)
      if (eventToDelete.event_type === 'partita' && hasMatchList) {
        setPendingDeleteEventId(eventId)
        setShowDeleteEventDialog(true)
        return
      }
    } catch (error) {
      console.error('Errore nel controllo lista gara:', error)
      showFormAlert(
        `Errore nel controllo della lista gara: ${(error as Error).message}`,
        'Controllo non riuscito',
        'error',
      )
      return
    }

    setPendingSimpleDeleteEventId(eventId)
  }

  const confirmSimpleDeleteEvent = async () => {
    if (!pendingSimpleDeleteEventId) return
    const id = pendingSimpleDeleteEventId
    setPendingSimpleDeleteEventId(null)
    await performDeleteEvent(id, false)
  }

  const confirmDeleteEventWithMatchList = async () => {
    if (!pendingDeleteEventId) return
    await performDeleteEvent(pendingDeleteEventId, true)
    setShowDeleteEventDialog(false)
    setPendingDeleteEventId(null)
  }

  const cancelDeleteEventDialog = () => {
    setShowDeleteEventDialog(false)
    setPendingDeleteEventId(null)
  }

  const handleDeleteEvent = handleRequestDeleteEvent

  const generateEventTitle = () => {
    if (newEvent.event_type !== 'partita') return ''

    const category = categories.find((cat) => cat.id === newEvent.category_id)
    const categoryLabel = getPartitaCategoryLabel(category)
    if (!categoryLabel || !newEvent.opponent) return ''

    const clubTeamName = getBrandConfig().clubName?.trim() || getBrandConfig().clubShortName?.trim() || ''
    return getPartitaEventDisplayTitle(
      {
        opponent: newEvent.opponent,
        is_home: newEvent.is_home,
        categories: category,
      },
      clubTeamName
    )
  }

  const getEventFormHeaderTitle = () => {
    if (newEvent.event_type === 'consiglio' && newEvent.event_date) {
      return `Consiglio del ${new Date(newEvent.event_date).toLocaleDateString('it-IT')}`
    }
    if (newEvent.event_type === 'festa_del_rugby' && newEvent.category_id) {
      return buildFestaDelRugbyTitle(newEvent.category_id)
    }
    if (newEvent.event_type === 'partita') {
      const matchLabel = newEvent.is_friendly
        ? 'amichevole'
        : newEvent.is_championship
          ? 'campionato'
          : null
      const category = categories.find((cat) => cat.id === newEvent.category_id)
      const categoryName = category?.name?.trim() || ''
      const prefixParts = ['Partita']
      if (matchLabel) prefixParts.push(matchLabel)
      if (categoryName) prefixParts.push(categoryName)
      const prefix = prefixParts.join(' ')
      const rawTitle = newEvent.title?.trim() || generateEventTitle()
      if (rawTitle) {
        const baseTitle = rawTitle.replace(/^Partita\s+(amichevole|campionato)(?:\s+[^:]+)?(?::\s*)/i, '')
        return `${prefix}:\t${baseTitle}`
      }
      return prefix
    }
    if (newEvent.title?.trim()) return newEvent.title
    return editingEvent ? 'Modifica Evento' : 'Crea Nuovo Evento'
  }

  const handleEventTypeChange = (eventType: string) => {
    // Controlla se ci sono dati inseriti
    const hasData = newEvent.title || newEvent.category_id || newEvent.opponent || 
                   newEvent.event_date || newEvent.location || newEvent.description ||
                   newEvent.opponents.some(opp => opp.trim() !== '')
    
    if (hasData && eventType !== newEvent.event_type) {
      // Mostra popup di conferma
      setPendingEventType(eventType)
      setShowConfirmDialog(true)
    } else {
      // Cambia direttamente il tipo
      changeEventType(eventType)
    }
  }

  const changeEventType = (eventType: string) => {
    setEditingOpponentIndex(null)
    setEditingGironeId(null)
    setNewTeamNameInput('')
    setStaffMeetingGroups([])

    setNewEvent(prev => {
      const isPartita = eventType === 'partita'
      const keepStaffOrCouncil = eventType === 'consiglio' || eventType === 'incontro_staff'
      const next = {
        ...prev,
        event_type: eventType,
        is_championship: isPartita ? prev.is_championship : false,
        is_friendly: isPartita ? (prev.is_championship ? false : true) : false,
        participants: keepStaffOrCouncil ? prev.participants : [],
        invited: keepStaffOrCouncil ? prev.invited : [],
        ordine_del_giorno:
          eventType === 'consiglio' || eventType === 'incontro_staff' ? prev.ordine_del_giorno : [],
        verbale_pdf: eventType === 'consiglio' ? prev.verbale_pdf : '',
        verbale_pdfs:
          eventType === 'consiglio' || eventType === 'incontro_staff' ? prev.verbale_pdfs : [],
      }
      if (isMultiTeam(eventType)) {
        return {
          ...next,
          opponent: '',
          opponents: [],
          gironi: [],
          expects_tournament_winner: false,
          title: eventType === 'festa_del_rugby' ? '' : prev.title,
        }
      }
      return {
        ...next,
        opponent: '',
        opponents: [],
        gironi: [],
        expects_tournament_winner: false,
      }
    })
    setOpponentCount(0)
    
    // Il titolo verrà generato automaticamente dal useEffect quando i campi necessari saranno compilati
    
    // Se è un consiglio, genera automaticamente il titolo
    if (eventType === 'consiglio' && newEvent.event_date) {
      const councilTitle = `Consiglio del ${new Date(newEvent.event_date).toLocaleDateString('it-IT')}`
      setNewEvent(prev => ({...prev, title: councilTitle}))
    }
  }

  const confirmEventTypeChange = () => {
    changeEventType(pendingEventType)
    setShowConfirmDialog(false)
    setPendingEventType('')
  }

  const cancelEventTypeChange = () => {
    setShowConfirmDialog(false)
    setPendingEventType('')
  }

  const handleCategoryChange = (categoryId: string) => {
    setNewEvent({...newEvent, category_id: categoryId})
  }

  const handleOpponentChange = (opponent: string) => {
    setNewEvent({...newEvent, opponent})
  }

  const handleHomeAwayChange = (isHome: boolean) => {
    setNewEvent(prev => {
      const { ourScore, opponentScore } = parseMatchResultScores(prev.match_result, prev.is_home)
      const match_result = buildMatchResultFromScores(ourScore, opponentScore, isHome) ?? ''
      return { ...prev, is_home: isHome, match_result }
    })
  }

  const handleLocationChange = (location: string) => {
    setNewEvent({...newEvent, location, away_location: ''})
    
    // Controlla se la location è una sede di casa
    const isHomeLocation = isHomeVenue(location)
    
    // Se la location è una sede di casa, seleziona automaticamente il checkbox
    if (isHomeLocation && !newEvent.is_home) {
      setNewEvent(prev => {
        const { ourScore, opponentScore } = parseMatchResultScores(prev.match_result, prev.is_home)
        const match_result = buildMatchResultFromScores(ourScore, opponentScore, true) ?? ''
        return { ...prev, is_home: true, match_result }
      })
    }
    
    // Se la location NON è una sede di casa, deseleziona automaticamente il checkbox
    if (!isHomeLocation && newEvent.is_home) {
      setNewEvent(prev => {
        const { ourScore, opponentScore } = parseMatchResultScores(prev.match_result, prev.is_home)
        const match_result = buildMatchResultFromScores(ourScore, opponentScore, false) ?? ''
        return { ...prev, is_home: false, match_result }
      })
    }
  }

  const handleChampionshipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChampionship = e.target.checked
    setNewEvent(prev => ({ 
      ...prev, 
      is_championship: isChampionship,
      is_friendly: !isChampionship // Se campionato è selezionato, amichevole diventa false
    }))
  }

  const handleFriendlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isFriendly = e.target.checked
    setNewEvent(prev => ({ 
      ...prev, 
      is_friendly: isFriendly,
      is_championship: !isFriendly // Se amichevole è selezionato, campionato diventa false
    }))
  }

  const toTitleCase = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

  const addTeamByName = (rawName?: string) => {
    const source = typeof rawName === 'string' ? rawName : newTeamNameInput
    const name = source.trim().toUpperCase()
    if (!name) return
    if ((newEvent.opponents ?? []).some(t => t.toLowerCase() === name.toLowerCase())) {
      setNewTeamNameInput('')
      return
    }
    setNewEvent(prev => ({ ...prev, opponents: [...(prev.opponents ?? []), name] }))
    setOpponentCount(prev => prev + 1)
    setNewTeamNameInput('')
  }

  const removeTeamFromOpponents = (teamName: string) => {
    setNewEvent(prev => ({
      ...prev,
      opponents: (prev.opponents ?? []).filter(t => t !== teamName),
      gironi: (prev.gironi ?? []).map(g => ({
        ...g,
        teams: g.teams.filter(t => t !== teamName)
      }))
    }))
    setOpponentCount(prev => Math.max(0, prev - 1))
  }

  const removeTeamFromGirone = (teamName: string) => {
    setNewEvent(prev => ({
      ...prev,
      gironi: (prev.gironi ?? []).map(g => ({
        ...g,
        teams: g.teams.filter(t => t !== teamName)
      }))
    }))
  }

  const addOpponent = () => {
    const newIndex = newEvent.opponents.length
    setNewEvent(prev => ({
      ...prev,
      opponents: [...prev.opponents, '']
    }))
    setOpponentCount(prev => prev + 1)
    setEditingOpponentIndex(newIndex)
  }

  const addGirone = () => {
    const gironi = newEvent.gironi ?? []
    if (gironi.length === 0) {
      setNewEvent(prev => ({
        ...prev,
        gironi: [
          { id: crypto.randomUUID(), name: 'Girone 1', teams: [] },
          { id: crypto.randomUUID(), name: 'Girone 2', teams: [] }
        ]
      }))
    } else {
      setNewEvent(prev => ({
        ...prev,
        gironi: [
          ...(prev.gironi ?? []),
          { id: crypto.randomUUID(), name: `Girone ${(prev.gironi?.length ?? 0) + 1}`, teams: [] }
        ]
      }))
    }
  }

  const removeGirone = (gironeId: string) => {
    setNewEvent(prev => {
      const next = (prev.gironi ?? []).filter(g => g.id !== gironeId)
      return { ...prev, gironi: next }
    })
  }

  const renameGirone = (gironeId: string, name: string) => {
    setNewEvent(prev => ({
      ...prev,
      gironi: (prev.gironi ?? []).map(g => g.id === gironeId ? { ...g, name } : g)
    }))
  }

  /** Squadre non assegnate a nessun girone (derivato da opponents e gironi) */
  const unassignedTeams = (() => {
    const inGironi = new Set((newEvent.gironi ?? []).flatMap(g => g.teams))
    return (newEvent.opponents ?? []).filter(t => t.trim() !== '' && !inGironi.has(t))
  })()

  const moveTeamToGirone = (teamName: string, fromSource: 'unassigned' | string, toTarget: 'unassigned' | string) => {
    if (fromSource === toTarget) return
    setNewEvent(prev => {
      const gironi = (prev.gironi ?? []).map(g => {
        if (g.id === fromSource) return { ...g, teams: g.teams.filter(t => t !== teamName) }
        if (g.id === toTarget) return { ...g, teams: [...g.teams, teamName] }
        return g
      })
      return { ...prev, gironi }
    })
  }

  const reorderTeamsInGirone = (gironeId: string, teams: string[]) => {
    setNewEvent(prev => ({
      ...prev,
      gironi: (prev.gironi ?? []).map(g => g.id === gironeId ? { ...g, teams } : g)
    }))
  }

  const handleGironiDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over?.id) return
    const data = active.data.current as { teamName?: string; source?: string } | undefined
    const teamName = data?.teamName
    const source = data?.source
    if (teamName == null || source == null) return
    const overId = String(over.id)
    if (overId === 'drop-unassigned') {
      moveTeamToGirone(teamName, source, 'unassigned')
      return
    }
    if (overId.startsWith('drop-girone-')) {
      moveTeamToGirone(teamName, source, overId.slice(12))
      return
    }
    if (overId.startsWith('t-g-')) {
      const rest = overId.slice(4)
      const lastDash = rest.lastIndexOf('-')
      const targetGironeId = rest.slice(0, lastDash)
      const targetIndex = parseInt(rest.slice(lastDash + 1), 10)
      if (source === targetGironeId) {
        const girone = (newEvent.gironi ?? []).find(g => g.id === source)
        if (girone) {
          const fromIndex = girone.teams.indexOf(teamName)
          if (fromIndex >= 0 && !isNaN(targetIndex)) {
            const reordered = arrayMove(girone.teams, fromIndex, targetIndex)
            reorderTeamsInGirone(source, reordered)
          }
        }
      } else {
        moveTeamToGirone(teamName, source, targetGironeId)
      }
    }
  }

  const handleGironiDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { teamName?: string } | undefined
    if (data?.teamName) setActiveTeamDrag(data.teamName)
  }

  const handleGironiDragEndWithOverlay = (event: DragEndEvent) => {
    handleGironiDragEnd(event)
    setActiveTeamDrag(null)
  }

  const removeOpponent = (index: number) => {
    setEditingOpponentIndex(null)
    setNewEvent(prev => ({
      ...prev,
      opponents: prev.opponents.filter((_, i) => i !== index)
    }))
    setOpponentCount(prev => Math.max(0, prev - 1))
  }

  const updateOpponent = (index: number, value: string) => {
    setNewEvent(prev => ({
      ...prev,
      opponents: prev.opponents.map((opp, i) => i === index ? value : opp)
    }))
  }

  const normalizeOpponentOnBlur = (index: number) => {
    const value = newEvent.opponents[index] ?? ''
    const normalized = toTitleCase(value)
    if (normalized !== value) {
      setNewEvent(prev => ({
        ...prev,
        opponents: prev.opponents.map((opp, i) => i === index ? normalized : opp)
      }))
    }
  }

  const addParticipant = (memberId: string) => {
    const member = councilMembers.find(m => m.id === memberId)
    if (member && !newEvent.participants.includes(member.name)) {
      setNewEvent(prev => ({
        ...prev,
        participants: sortCouncilParticipantNames([...prev.participants, member.name], councilMembers),
      }))
    }
  }

  const removeParticipant = (participantName: string) => {
    setNewEvent(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p !== participantName)
    }))
  }

  const getAvailableCouncilMembers = () => {
    return sortCouncilBySurnameWithPresidentFirst(
      councilMembers.filter(member => !newEvent.participants.includes(member.name))
    )
  }

  const sortedCouncilParticipants = sortCouncilParticipantNames(newEvent.participants, councilMembers)
  const sortedInvited = sortNamesBySurname(newEvent.invited.filter((name) => name.trim() !== ''))

  const staffMeetingPool = useMemo(
    () => filterStaffMeetingByGroup(staffMeetingPeople, staffMeetingGroups),
    [staffMeetingPeople, staffMeetingGroups],
  )

  const staffMeetingSections = useMemo(
    () => buildStaffMeetingSelectionSections(staffMeetingPeople, staffMeetingGroups),
    [staffMeetingPeople, staffMeetingGroups],
  )

  const toggleStaffMeetingInvite = (person: StaffMeetingPerson, categoryLabel: string) => {
    const chipLabel = formatStaffMeetingChipLabel(person, categoryLabel)
    setNewEvent((prev) => {
      const existingForPerson = staffMeetingInvitedLabelsForPerson(prev.invited, person)
      const alreadyThisCategory = existingForPerson.includes(chipLabel)

      if (alreadyThisCategory) {
        // Deseleziona: torna disponibile in tutte le categorie
        return {
          ...prev,
          invited: prev.invited.filter((n) => !staffMeetingInviteBelongsToPerson(n, person)),
          participants: prev.participants.filter((n) => !staffMeetingInviteBelongsToPerson(n, person)),
        }
      }

      // Seleziona da questa categoria: rimuovi eventuali altre categorie della stessa persona
      const invitedWithoutPerson = prev.invited.filter((n) => !staffMeetingInviteBelongsToPerson(n, person))
      const participantsWithoutPerson = prev.participants.filter(
        (n) => !staffMeetingInviteBelongsToPerson(n, person),
      )
      return {
        ...prev,
        invited: [...invitedWithoutPerson, chipLabel],
        participants: [...participantsWithoutPerson, chipLabel],
      }
    })
  }

  const moveStaffMeetingToAbsent = (label: string) => {
    setNewEvent((prev) => ({
      ...prev,
      participants: prev.participants.filter((n) => n !== label),
      invited: prev.invited.includes(label) ? prev.invited : [...prev.invited, label],
    }))
  }

  const moveStaffMeetingToPresent = (label: string) => {
    setNewEvent((prev) => ({
      ...prev,
      invited: prev.invited.includes(label) ? prev.invited : [...prev.invited, label],
      participants: prev.participants.includes(label)
        ? prev.participants
        : [...prev.participants, label],
    }))
  }

  const staffMeetingPresenti = useMemo(
    () =>
      sortNamesBySurname(
        newEvent.participants.filter((n) => n.trim() && newEvent.invited.includes(n)),
      ),
    [newEvent.participants, newEvent.invited],
  )

  const staffMeetingAssenti = useMemo(
    () =>
      sortNamesBySurname(
        newEvent.invited.filter((n) => n.trim() && !newEvent.participants.includes(n)),
      ),
    [newEvent.participants, newEvent.invited],
  )

  const openInvitedModal = () => {
    setTempInvited([...newEvent.invited, '']) // Aggiungi un campo vuoto
    setShowInvitedModal(true)
  }

  const addInvitedField = () => {
    if (tempInvited.length < 50) {
      setTempInvited([...tempInvited, ''])
    }
  }

  const updateInvitedField = (index: number, value: string) => {
    const updated = [...tempInvited]
    updated[index] = value
    setTempInvited(updated)
  }

  const removeInvitedField = (index: number) => {
    const updated = tempInvited.filter((_, i) => i !== index)
    setTempInvited(updated)
  }

  const saveInvited = () => {
    // Filtra i campi vuoti e rimuovi duplicati
    const validInvited = tempInvited
      .filter(name => name.trim() !== '')
      .map(name => name.trim())
      .filter((name, index, array) => array.indexOf(name) === index) // Rimuovi duplicati
    
    setNewEvent(prev => ({
      ...prev,
      invited: validInvited
    }))
    setShowInvitedModal(false)
  }

  const cancelInvitedModal = () => {
    setShowInvitedModal(false)
    setTempInvited([])
  }

  const removeInvited = (invitedName: string) => {
    setNewEvent(prev => ({
      ...prev,
      invited: prev.invited.filter(name => name !== invitedName)
    }))
  }

  const [newOdgPoint, setNewOdgPoint] = useState('')
  const odgInputRef = useRef<HTMLInputElement>(null)
  const [odgEmptyHint, setOdgEmptyHint] = useState(false)
  const addOrdineDelGiorno = (e?: React.MouseEvent) => {
    e?.preventDefault()
    const point = newOdgPoint.trim()
    if (!point) {
      setOdgEmptyHint(true)
      odgInputRef.current?.focus()
      setTimeout(() => setOdgEmptyHint(false), 2000)
      return
    }
    if (isOdgClosurePoint(point)) {
      showFormAlert(
        '«Varie ed eventuali» viene aggiunto automaticamente come ultimo punto.',
        'Punto già previsto',
        'info',
      )
      setNewOdgPoint('')
      return
    }
    setNewEvent(prev => ({
      ...prev,
      ordine_del_giorno: addOdgPoint(prev.ordine_del_giorno, point),
    }))
    setNewOdgPoint('')
    setOdgEmptyHint(false)
  }
  const removeOrdineDelGiorno = (index: number) => {
    setNewEvent(prev => ({
      ...prev,
      ordine_del_giorno: removeOdgPointAt(prev.ordine_del_giorno, index),
    }))
    if (editingOdgIndex === index) setEditingOdgIndex(null)
    else if (editingOdgIndex !== null && editingOdgIndex > index) setEditingOdgIndex(editingOdgIndex - 1)
  }

  const updateOrdineDelGiorno = (index: number, newText: string) => {
    const trimmed = newText.trim()
    if (!trimmed) return
    setNewEvent(prev => ({
      ...prev,
      ordine_del_giorno: updateOdgPointAt(prev.ordine_del_giorno, index, trimmed),
    }))
    setEditingOdgIndex(null)
  }

  const [editingOdgIndex, setEditingOdgIndex] = useState<number | null>(null)
  const [editingOdgValue, setEditingOdgValue] = useState('')

  const handleOdgDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setNewEvent(prev => {
      const odg = prev.ordine_del_giorno || []
      const ids = odg.map((_, i) => `odg-${i}`)
      const oldIndex = ids.indexOf(String(active.id))
      const newIndex = ids.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev
      return { ...prev, ordine_del_giorno: reorderOdgPoints(odg, oldIndex, newIndex) }
    })
  }, [])

  const handleParticipantsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setNewEvent(prev => {
      const parts = prev.participants || []
      const ids = parts.map((_, i) => `part-${i}`)
      const oldIndex = ids.indexOf(String(active.id))
      const newIndex = ids.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev
      const reordered = arrayMove(parts, oldIndex, newIndex)
      return {
        ...prev,
        participants: sortCouncilParticipantNames(reordered, councilMembers),
      }
    })
  }, [councilMembers])

  const odgSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )
  const participantSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )
  const gironiSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const getEventTypeFields = () => getFormFields(newEvent.event_type)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  }

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getClubPartyDateLabel = (event: Event) => {
    const start = formatDateShort(event.event_date)
    if (event.event_end_date) {
      const end = formatDateShort(event.event_end_date)
      if (end !== start) return `${start} – ${end}`
    }
    return start
  }

  // Etichette brevi per badge categoria (come in agenda: U14, B, C)
  const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
    SERIE_B: 'B',
    SERIE_C: 'C',
    U6: 'U6',
    U8: 'U8',
    U10: 'U10',
    U12: 'U12',
    U14: 'U14',
    U16: 'U16',
    U18: 'U18',
    SENIORES: 'S',
    PODEROSA: 'P',
    GUSSAGOLD: 'G',
    BRIXIAOLD: 'O',
    LEONESSE: 'L'
  }

  // Colori fissi per categoria nelle fasce (e utilizzi futuri) – non modificare
  const CATEGORY_COLORS: Record<string, string> = {
    U14: '#3366FF',
    U16: '#19B36B',
    U18: '#FFCC00',
    SERIE_C: '#8A2BE2',
    SERIE_B: '#FF3333'
  }
  const getCategoryColor = (event: Event) => {
    if (event.event_type === 'consiglio') return 'rgba(218, 165, 32, 0.45)' // oro trasparente
    return (event.categories?.code && CATEGORY_COLORS[event.categories.code]) ? CATEGORY_COLORS[event.categories.code] : '#3366FF'
  }

  const getEventIcon = (event: Event) => {
    const typeCfg = getByCode(event.event_type)
    const stripIcon = typeCfg?.form_fields.stripIcon
    if (stripIcon?.trim()) return stripIcon.trim()

    if (typeCfg?.form_fields.isClubParty) return 'FDC'

    if (event.categories?.code) {
      return CATEGORY_DISPLAY_LABELS[event.categories.code] || event.categories.code
    }

    const code = event.event_type?.replace(/_/g, ' ').trim()
    if (!code) return '?'
    return code.length <= 4 ? code.toUpperCase() : code.slice(0, 3).toUpperCase()
  }

  const EVENT_ROW_GRID_STYLE: CSSProperties = {
    // cat | tipo | spaziatura (2 tab) | titolo | luogo | data | orario | esito | info
    gridTemplateColumns: '72px 10.5rem 4rem minmax(180px, 1.5fr) minmax(100px, 0.7fr) 118px 88px 120px 100px',
  }

  const EVENT_ROW_GRID_CLASS =
    'grid w-full min-w-[980px] items-center gap-x-2 text-[14px] leading-tight'

  const getEventOutcome = (event: Event): EventCellValue => {
    const clubParty = isClubParty(event.event_type)
    const fields = getFormFields(event.event_type)

    if (event.event_type === 'partita') {
      if (event.match_result?.trim()) {
        const result = analyzeMatchResult(event.match_result, event.is_home)
        const tone: EventCellTone =
          result.status === 'win' ? 'win' : result.status === 'loss' ? 'loss' : result.status === 'draw' ? 'draw' : 'default'
        return { text: result.display, tone }
      }
      return { text: 'Da giocare', tone: 'muted' }
    }

    if (fields.allowsTournamentWinner || event.expects_tournament_winner) {
      const winner = event.tournament_winner?.trim()
      if (winner) return { text: `Vinc. ${winner}`, tone: 'gold', title: winner }
      return { text: 'Da definire', tone: 'muted' }
    }

    if (event.event_type === 'consiglio') {
      const count = event.participants?.filter((p) => p.trim() !== '').length ?? 0
      return { text: count > 0 ? `${count} partecipanti` : '—', tone: count > 0 ? 'info' : 'muted' }
    }

    if (clubParty || getEventDateRangeDays(event) > 1) {
      const days = getEventDateRangeDays(event)
      return { text: `${days} giorn${days === 1 ? 'o' : 'i'}`, tone: 'info' }
    }

    return { text: '—', tone: 'muted' }
  }

  const getEventInfo = (event: Event): EventCellValue => {
    const clubParty = isClubParty(event.event_type)

    if (event.event_type === 'partita' && event.match_result?.trim()) {
      const result = analyzeMatchResult(event.match_result, event.is_home)
      if (result.status === 'win') return { text: 'Vittoria', tone: 'win' }
      if (result.status === 'loss') return { text: 'Sconfitta', tone: 'loss' }
      if (result.status === 'draw') return { text: 'Pareggio', tone: 'draw' }
    }

    if (event.event_type === 'consiglio') {
      const inv = event.invited?.filter((p) => p.trim() !== '').length ?? 0
      return inv > 0 ? { text: `${inv} inv.`, tone: 'info' } : { text: '—', tone: 'muted' }
    }

    if (isMultiTeam(event.event_type)) {
      const teams =
        event.opponents?.filter((o) => o.trim() !== '').length ||
        event.gironi?.reduce((acc, g) => acc + (g.teams?.length ?? 0), 0) ||
        0
      return teams > 0 ? { text: `${teams} sq.`, tone: 'info' } : { text: '—', tone: 'muted' }
    }

    if (clubParty) return { text: 'club', tone: 'muted' }

    return { text: '—', tone: 'muted' }
  }

  const renderEventCategoryStripCell = (event: Event) => {
    const categoryBg = getCategoryColor(event)
    const categoryTextDark = event.event_type === 'consiglio' || categoryBg === '#FFCC00'
    const label = getEventIcon(event)
    return (
      <div
        className={`flex h-full min-h-[46px] w-[72px] items-center justify-center rounded-l-xl text-[15px] font-black leading-none tracking-wide ${
          categoryTextDark ? 'text-gray-900' : 'text-white'
        }`}
        style={{ backgroundColor: categoryBg }}
        title={event.categories?.name || getEventTypeLabel(event.event_type)}
      >
        {label}
      </div>
    )
  }

  const renderTabularEventRow = (event: Event) => {
    const clubParty = isClubParty(event.event_type)
    const isConsiglio = event.event_type === 'consiglio'
    const cellClass = 'min-w-0 truncate px-1 py-0'
    const outcome = getEventOutcome(event)
    const info = getEventInfo(event)
    const title = clubParty
      ? (event.title?.trim() || '—')
      : isConsiglio
        ? (event.title?.trim() || '—')
        : getEventRowTitle(event)
    const location = isConsiglio
      ? (getSedeConsiglio(event) || '—')
      : (getEventLocationName(event) || '—')
    const dateLabel = clubParty || (event.event_end_date && event.event_end_date !== event.event_date)
      ? `${formatEventListDateShort(event.event_date)}${event.event_end_date && event.event_end_date !== event.event_date ? ` – ${formatEventListDateShort(event.event_end_date)}` : ''}`
      : formatEventListDateShort(event.event_date)

    const formatRowTime = () => {
      if (clubParty) return '—'
      if (event.start_time && event.end_time) {
        return `${event.start_time.substring(0, 5)}–${event.end_time.substring(0, 5)}`
      }
      if (event.start_time) return event.start_time.substring(0, 5)
      if (event.event_time) return event.event_time.substring(0, 5)
      return '—'
    }

    return (
      <div className={EVENT_ROW_GRID_CLASS} style={{ ...EVENT_ROW_GRID_STYLE, color: GOLEE.text }}>
        {renderEventCategoryStripCell(event)}
        <div className="flex min-w-0 items-center px-1 py-1.5">
          {renderEventRowTypeBadge(event, getEventTypeLabel(event.event_type))}
        </div>
        <div aria-hidden="true" />
        <div className="min-w-0 truncate text-left text-[15px] font-semibold text-[#083B5D]" title={title}>
          {title}
        </div>
        <div className={`${cellClass} ${eventCellToneClass('default')}`} title={location}>
          {location}
        </div>
        <div className={`${cellClass} ${eventCellToneClass('default')}`} title={dateLabel}>
          {dateLabel}
        </div>
        <div className={`${cellClass} text-center tabular-nums ${eventCellToneClass(formatRowTime() === '—' ? 'muted' : 'default')}`}>
          {formatRowTime()}
        </div>
        <div className={`${cellClass} ${eventCellToneClass(outcome.tone)}`} title={outcome.title || outcome.text}>
          {outcome.text}
        </div>
        <div className={`${cellClass} ${eventCellToneClass(info.tone)}`} title={info.text}>
          {info.text}
        </div>
      </div>
    )
  }

  const renderEventCategoryStrip = (event: Event, options?: { className?: string }) => (
    <div className={`shrink-0 self-stretch w-[72px] min-w-[72px] ${options?.className ?? ''}`}>
      {renderEventCategoryStripCell(event)}
    </div>
  )

  const getEventDisplayTitle = (event: Event) => {
    if (event.event_type === 'consiglio') return event.title
    if (event.event_type === 'festa_del_rugby') {
      return event.categories?.name
        ? `Festa del Rugby: ${event.categories.name}`
        : (event.title || 'Festa del Rugby')
    }
    return `${getEventTypeLabel(event.event_type)}: ${event.title}`
  }

  const getEventDetails = (event: Event) => {
    if (isClubParty(event.event_type)) {
      return getClubPartyDateLabel(event)
    }

    const details = []
    
    // Data
    details.push(formatDate(event.event_date))
    
    // Orari
    if (event.start_time && event.end_time) {
      details.push(`Inizio: ${event.start_time.substring(0, 5)}`)
      details.push(`Fine: ${event.end_time.substring(0, 5)}`)
    } else if (event.event_time) {
      details.push(`Ora: ${event.event_time.substring(0, 5)}`)
    }
    
    // Location e (Casa/Trasferta) sono mostrati sull'ultima riga dopo l'avversario
    return details.join(' • ')
  }

  /** Solo nome luogo (senza "Casa"/"Trasferta"), per mostrarlo in seconda riga prima della data */
  const getEventLocationName = (event: Event) => {
    const loc = requiresAwayDetail(event.location) ? event.away_location : event.location
    return loc?.trim() || null
  }

  const getEventLocationLine = (event: Event) => {
    const location = requiresAwayDetail(event.location) ? event.away_location : event.location
    if (!location?.trim()) return null
    if (isClubParty(event.event_type) || event.event_type === 'consiglio') {
      return location.trim()
    }
    const casaTrasferta = event.is_home ? '(Casa)' : '(Trasferta)'
    return `${location} ${casaTrasferta}`
  }

  const getSedeConsiglio = (event: Event) => {
    if (event.event_type !== 'consiglio') return null
    const sede = requiresAwayDetail(event.location) ? event.away_location : event.location
    return sede?.trim() || null
  }

  const getEventParticipants = (event: Event) => {
    if (isMultiTeam(event.event_type) && event.opponents && event.opponents.length > 0) {
      const validOpponents = event.opponents.filter(opp => opp.trim() !== '')
      if (validOpponents.length > 0) {
        return {
          participants: validOpponents.join(', '),
          count: validOpponents.length
        }
      }
    } else if (event.event_type === 'partita' && event.opponent) {
      return {
        participants: event.opponent,
        count: 1
      }
    } else if (event.event_type === 'consiglio' && event.participants?.length > 0) {
      const sorted = sortCouncilParticipantNames(event.participants, councilMembers)
      return {
        participants: sorted.map((n) => formatCouncilMemberLabel(n, councilMembers)).join(', '),
        count: sorted.length
      }
    } else if (event.event_type === 'incontro_staff' && event.participants?.length > 0) {
      const sorted = sortNamesBySurname(event.participants.filter((n) => n.trim()))
      return {
        participants: sorted.join(', '),
        count: sorted.length,
      }
    }
    
    return null
  }

  const getAbsentCouncilMembers = (event: Event) => {
    if (event.event_type === 'consiglio') {
      const allCouncilMembers = councilMembers.map(member => member.name)
      const presentMembers = event.participants || []
      const absent = allCouncilMembers.filter(member => !presentMembers.includes(member))
      const uniqueAbsent = Array.from(new Set(absent))
      return uniqueAbsent.length > 0 ? uniqueAbsent : null
    }
    if (event.event_type === 'incontro_staff') {
      const invited = (event.invited || []).filter((n) => n.trim())
      const present = (event.participants || []).filter((n) => n.trim())
      // Finché non si segna almeno un presente, nessuno è ancora “assente”
      if (present.length === 0) return null
      const presentSet = new Set(present)
      const absent = invited.filter((n) => !presentSet.has(n))
      return absent.length > 0 ? sortNamesBySurname(absent) : null
    }
    return null
  }

  const getEventInvited = (event: Event) => {
    if (event.event_type === 'incontro_staff') {
      const invitedList = (event.invited || []).filter((n) => n.trim())
      const presentList = (event.participants || []).filter((n) => n.trim())
      // Mostra Invitati solo finché non si è segnato alcun presente
      if (invitedList.length === 0 || presentList.length > 0) return null
      const sorted = sortNamesBySurname(invitedList)
      return { invited: sorted.join(', '), count: sorted.length }
    }
    if (event.event_type === 'consiglio' && event.invited?.length > 0) {
      const sorted = sortNamesBySurname(event.invited)
      return {
        invited: sorted.join(', '),
        count: sorted.length
      }
    }
    return null
  }

  const isStaffMeetingAllPresent = (event: Event) => {
    if (event.event_type !== 'incontro_staff') return false
    const invited = (event.invited || []).filter((n) => n.trim())
    const present = (event.participants || []).filter((n) => n.trim())
    if (invited.length === 0 || present.length === 0) return false
    const presentSet = new Set(present)
    return invited.every((n) => presentSet.has(n))
  }

  // Controlla se un evento è passato (dal giorno successivo alla data di fine)
  const isEventPast = (event: Event) => isEventConcluded(event)

  // Analizza il risultato della partita e determina vittoria/sconfitta/pareggio
  const persistModalMatchResult = async (ourScore: string, opponentScore: string) => {
    if (!selectedEvent || selectedEvent.event_type !== 'partita') return

    const built = buildMatchResultFromScores(ourScore, opponentScore, selectedEvent.is_home)
    const nextResult = built ?? ''
    const currentResult = selectedEvent.match_result?.trim() ?? ''
    if (nextResult === currentResult) return
    if (ourScore.trim() && opponentScore.trim() && !built) return

    setSavingModalMatchResult(true)
    try {
      const { error } = await supabase
        .from('events')
        .update({ match_result: nextResult || null })
        .eq('id', selectedEvent.id)

      if (error) throw error

      const updatedEvent = { ...selectedEvent, match_result: nextResult }
      setSelectedEvent(updatedEvent)
      setEvents(prev => prev.map(event => (event.id === selectedEvent.id ? updatedEvent : event)))
    } catch (error) {
      console.error('Errore nel salvataggio risultato partita:', error)
      alert('Errore nel salvataggio del risultato')
    } finally {
      setSavingModalMatchResult(false)
    }
  }

  const persistTournamentWinner = async (winner: string | null) => {
    if (!selectedEvent) return

    setSavingTournamentWinner(true)
    try {
      const value = winner?.trim() || null
      const { error } = await supabase
        .from('events')
        .update({ tournament_winner: value })
        .eq('id', selectedEvent.id)

      if (error) throw error

      const updatedEvent: Event = {
        ...selectedEvent,
        tournament_winner: value,
      }
      setSelectedEvent(updatedEvent)
      setEvents(prev => prev.map(event => (event.id === selectedEvent.id ? updatedEvent : event)))
      setTournamentWinnerDraft(value ?? '')
    } catch (error) {
      console.error('Errore nel salvataggio vincitore torneo:', error)
      alert('Errore nel salvataggio del vincitore. Verifica che la colonna tournament_winner esista nel database.')
    } finally {
      setSavingTournamentWinner(false)
    }
  }

  const persistModalOrdineDelGiorno = async (odg: string[]) => {
    if (!selectedEvent) return

    const normalized = normalizeOrdineDelGiorno(odg)
    setSavingModalOdg(true)
    try {
      const { error } = await supabase
        .from('events')
        .update({ ordine_del_giorno: normalized.length > 0 ? normalized : null })
        .eq('id', selectedEvent.id)

      if (error) throw error

      const updatedEvent: Event = {
        ...selectedEvent,
        ordine_del_giorno: normalized,
      }
      setSelectedEvent(updatedEvent)
      setEvents(prev => prev.map(event => (event.id === selectedEvent.id ? updatedEvent : event)))
    } catch (error) {
      console.error('Errore nel salvataggio ordine del giorno:', error)
      alert('Errore nel salvataggio dell\'ordine del giorno.')
    } finally {
      setSavingModalOdg(false)
    }
  }

  const removeModalOrdineDelGiorno = async (index: number) => {
    if (!selectedEvent?.ordine_del_giorno) return
    const odg = removeOdgPointAt(selectedEvent.ordine_del_giorno, index)
    if (modalEditingOdgIndex === index) {
      setModalEditingOdgIndex(null)
      setModalEditingOdgValue('')
    } else if (modalEditingOdgIndex !== null && modalEditingOdgIndex > index) {
      setModalEditingOdgIndex(modalEditingOdgIndex - 1)
    }
    await persistModalOrdineDelGiorno(odg)
  }

  const saveModalOrdineDelGiornoEdit = async (index: number) => {
    const trimmed = modalEditingOdgValue.trim()
    if (!trimmed || !selectedEvent?.ordine_del_giorno) return
    const odg = updateOdgPointAt(selectedEvent.ordine_del_giorno, index, trimmed)
    setModalEditingOdgIndex(null)
    setModalEditingOdgValue('')
    await persistModalOrdineDelGiorno(odg)
  }

  const openModalNewOdgInput = () => {
    setShowModalNewOdgInput(true)
    setModalNewOdgValue('')
    setModalEditingOdgIndex(null)
    setModalEditingOdgValue('')
    setTimeout(() => modalNewOdgInputRef.current?.focus(), 0)
  }

  const cancelModalNewOdgInput = () => {
    setShowModalNewOdgInput(false)
    setModalNewOdgValue('')
  }

  const addModalOrdineDelGiorno = async () => {
    const trimmed = modalNewOdgValue.trim()
    if (!trimmed || !selectedEvent) return
    if (isOdgClosurePoint(trimmed)) {
      showFormAlert(
        '«Varie ed eventuali» viene aggiunto automaticamente come ultimo punto.',
        'Punto già previsto',
        'info',
      )
      setModalNewOdgValue('')
      return
    }
    const odg = addOdgPoint(selectedEvent.ordine_del_giorno, trimmed)
    setShowModalNewOdgInput(false)
    setModalNewOdgValue('')
    await persistModalOrdineDelGiorno(odg)
  }

  const handleModalOdgDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !selectedEvent?.ordine_del_giorno) return

    const odg = selectedEvent.ordine_del_giorno
    const ids = odg.map((_, i) => `modal-odg-${i}`)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    void persistModalOrdineDelGiorno(reorderOdgPoints(odg, oldIndex, newIndex))
  }

  const handleModalMatchScoreChange = (side: 'our' | 'opponent', value: string) => {
    if (!/^\d*$/.test(value)) return
    const nextOur = side === 'our' ? value : modalMatchScoreOur
    const nextOpponent = side === 'opponent' ? value : modalMatchScoreOpponent
    if (side === 'our') setModalMatchScoreOur(value)
    else setModalMatchScoreOpponent(value)

    if (!nextOur.trim() && !nextOpponent.trim()) {
      void persistModalMatchResult('', '')
      return
    }
    if (nextOur.trim() && nextOpponent.trim()) {
      void persistModalMatchResult(nextOur, nextOpponent)
    }
  }

  const handleEventClick = (event: Event) => {
    if (eventModalCloseTimeoutRef.current) {
      clearTimeout(eventModalCloseTimeoutRef.current)
      eventModalCloseTimeoutRef.current = null
    }
    setSelectedEvent(
      event.event_type === 'consiglio'
        ? { ...event, ordine_del_giorno: normalizeOrdineDelGiorno(event.ordine_del_giorno) }
        : event
    )
    setEventModalTab('overview')
    setEventModalSearch('')
    setHighlightedGironeId(null)
    setEventModalEditMode(false)
    setEventModalEntered(false)
    setShowEventModal(true)
  }

  useEffect(() => {
    if (!showEventModal || !selectedEvent) {
      setEventModalEntered(false)
      return
    }

    setEventModalEntered(false)
    const frameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEventModalEntered(true))
    })

    return () => cancelAnimationFrame(frameId)
  }, [showEventModal, selectedEvent?.id])

  useEffect(() => () => {
    if (eventModalCloseTimeoutRef.current) {
      clearTimeout(eventModalCloseTimeoutRef.current)
    }
  }, [])

  const handleEventMatchListConfirm = async (
    selectedPlayers: { player_id: string; number: number }[],
    listName: string,
    listType: 'match' | 'friendly' | 'training',
    eventId?: string
  ) => {
    if (!selectedEvent || selectedEvent.event_type !== 'partita') return

    try {
      const isSuperAdmin = profile?.is_super_admin === true
      const createdBy = isSuperAdmin ? null : await resolveMatchListCreatedBy(profile)
      if (!createdBy && !isSuperAdmin) {
        showFormAlert(
          'Questo account non è ancora associato a un profilo operativo della società. Un Super Admin globale deve invece essere abilitato come tale, senza richiedere una scheda persona.',
          'Lista gara non creata',
          'warning',
        )
        return
      }

      if (editingEventMatchList) {
        const { error } = await supabase
          .from('match_lists')
          .update({
            name: listName,
            type: listType,
            selected_players: selectedPlayers,
            event_id: eventId ?? selectedEvent.id,
          })
          .eq('id', editingEventMatchList.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('match_lists')
          .insert({
            name: listName,
            type: listType,
            category_id: selectedEvent.category_id,
            selected_players: selectedPlayers,
            event_id: eventId ?? selectedEvent.id,
            created_by: createdBy,
            created_by_profile_id: profile?.id ?? null,
          })

        if (error) throw error
      }

      setShowEventMatchListModal(false)
      setEditingEventMatchList(null)
      await loadEventFormation(selectedEvent)
    } catch (error) {
      console.error('Errore nella gestione formazione:', error)
      const msg = error instanceof Error ? error.message : String(error)
      if (/fetch|network|failed to load|name_not_resolved/i.test(msg)) {
        showFormAlert(
          'Verifica la connessione e riprova tra qualche istante.',
          'Salvataggio non riuscito',
          'error',
        )
      } else {
        showFormAlert(
          msg || 'Non è stato possibile salvare la lista gara.',
          'Salvataggio non riuscito',
          'error',
        )
      }
    }
  }

  const returnToEventOrigin = () => {
    const returnTo = searchParams.get('returnTo')
    if (returnTo && returnTo.startsWith('/')) {
      navigate(returnTo)
    }
  }

  const finalizeCloseEventModal = () => {
    setShowEventModal(false)
    setSelectedEvent(null)
    setEventModalTab('overview')
    setEventModalSearch('')
    setHighlightedGironeId(null)
    setEventMatchList(null)
    setEventFormationPlayers([])
    setShowEventMatchListModal(false)
    setEditingEventMatchList(null)
    setEventModalEditMode(false)
    setEventModalEntered(false)
  }

  const handleCloseEventModal = (afterClose?: () => void, returnToOrigin = true) => {
    if (!showEventModal) {
      afterClose?.()
      return
    }

    setEventModalEntered(false)
    if (eventModalCloseTimeoutRef.current) {
      clearTimeout(eventModalCloseTimeoutRef.current)
    }
    eventModalCloseTimeoutRef.current = setTimeout(() => {
      eventModalCloseTimeoutRef.current = null
      finalizeCloseEventModal()
      afterClose?.()
      if (returnToOrigin) returnToEventOrigin()
    }, EVENT_MODAL_SLIDE_MS)
  }

  const focusGironeInModal = (gironeId: string) => {
    setEventModalTab('groups')
    setHighlightedGironeId(gironeId)
  }

  const handleOpenPDF = async (rawOrFilename: string) => {
    const filename = parseVerbaleDoc(rawOrFilename).file || rawOrFilename
    try {
      const { data: fileList, error: listError } = await supabase.storage
        .from('docs')
        .list('events', {
          search: filename
        })
      
      if (listError) {
        console.error('Errore nel controllo esistenza file:', listError)
        throw listError
      }
      
      if (!fileList || fileList.length === 0) {
        console.warn(`File ${filename} non trovato, rimuovo il riferimento dal database`)
        
        if (selectedEvent) {
          const updatedVerbalePdfs = serializeVerbaleDocs(
            parseVerbaleDocs(selectedEvent.verbale_pdfs).filter((d) => d.file !== filename),
          )
          const updatedVerbalePdf =
            parseVerbaleDoc(selectedEvent.verbale_pdf || '').file === filename
              ? ''
              : selectedEvent.verbale_pdf
          
          setSelectedEvent(prev => prev ? {
            ...prev,
            verbale_pdf: updatedVerbalePdf,
            verbale_pdfs: updatedVerbalePdfs
          } : null)
          
          const { error: updateError } = await supabase
            .from('events')
            .update({
              verbale_pdf: updatedVerbalePdf || null,
              verbale_pdfs: updatedVerbalePdfs.length > 0 ? updatedVerbalePdfs : null
            })
            .eq('id', selectedEvent.id)
          
          if (updateError) {
            console.error('Errore nell\'aggiornamento del database:', updateError)
          } else {
            setEvents(prevEvents => prevEvents.map(event => {
              if (event.id === selectedEvent.id) {
                return {
                  ...event,
                  verbale_pdf: updatedVerbalePdf,
                  verbale_pdfs: updatedVerbalePdfs
                }
              }
              return event
            }))
          }
        }
        
        showFormAlert(
          'Il file PDF non è più disponibile ed è stato rimosso dalla lista.',
          'File non disponibile',
          'warning',
        )
        return
      }
      
      const { data, error } = await supabase.storage
        .from('docs')
        .createSignedUrl(`events/${filename}`, 60 * 60)
      
      if (error) throw error
      
      window.open(data.signedUrl, '_blank')
    } catch (error) {
      console.error('Errore nell\'apertura del PDF:', error)
      showFormAlert(
        'Errore nell\'apertura del PDF. Il file potrebbe non essere più disponibile.',
        'Apertura non riuscita',
        'error',
      )
    }
  }

  const handleAllegatiFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    event.target.value = ''
    if (!files || files.length === 0) return

    const valid: File[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      if (!isAllowedAllegatoFile(file)) {
        showFormAlert(
          `Il file «${file.name}» non è un formato supportato (PDF, Word, Excel, immagini).`,
          'Formato non valido',
          'warning',
        )
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        showFormAlert(
          `Il file «${file.name}» è troppo grande (max 10MB).`,
          'File troppo grande',
          'warning',
        )
        continue
      }
      valid.push(file)
    }
    if (valid.length === 0) return
    setAllegatoRenameQueue({
      files: valid,
      index: 0,
      label: allegatoOriginalBasename(valid[0]!),
    })
  }

  const cancelAllegatoRename = () => {
    if (allegatoUploading) return
    setAllegatoRenameQueue((prev) => {
      if (!prev) return null
      const nextIndex = prev.index + 1
      if (nextIndex >= prev.files.length) return null
      return {
        files: prev.files,
        index: nextIndex,
        label: allegatoOriginalBasename(prev.files[nextIndex]!),
      }
    })
  }

  const confirmAllegatoRename = async () => {
    if (!allegatoRenameQueue) return
    const { files, index, label } = allegatoRenameQueue
    const file = files[index]
    if (!file) {
      setAllegatoRenameQueue(null)
      return
    }
    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      showFormAlert('Inserisci un nome per l’allegato.', 'Nome richiesto')
      return
    }

    setAllegatoUploading(true)
    try {
      const filename = buildAllegatoStorageFilename(file.name)
      const { error } = await supabase.storage.from('docs').upload(`events/${filename}`, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })
      if (error) throw error

      setNewEvent((prev) => ({
        ...prev,
        verbale_pdfs: [
          ...serializeVerbaleDocs(parseVerbaleDocs(prev.verbale_pdfs)),
          ...serializeVerbaleDocs([{ file: filename, label: trimmedLabel }]),
        ],
      }))

      const nextIndex = index + 1
      if (nextIndex >= files.length) {
        setAllegatoRenameQueue(null)
        showFormAlert(
          files.length === 1
            ? '1 allegato caricato con successo.'
            : `${files.length} allegati caricati con successo.`,
          'Caricamento completato',
          'success',
        )
      } else {
        setAllegatoRenameQueue({
          files,
          index: nextIndex,
          label: allegatoOriginalBasename(files[nextIndex]!),
        })
      }
    } catch (uploadError) {
      console.error(`Errore nel caricamento di ${file.name}:`, uploadError)
      const detail =
        uploadError &&
        typeof uploadError === 'object' &&
        'message' in uploadError &&
        typeof (uploadError as { message?: unknown }).message === 'string'
          ? String((uploadError as { message: string }).message)
          : ''
      const isRls =
        detail.toLowerCase().includes('row-level security') ||
        detail.toLowerCase().includes('violates row-level security')
      showFormAlert(
        isRls
          ? `Errore nel caricamento di «${file.name}».\n\nManca l’autorizzazione storage per i verbali eventi (path docs/events/). Applica la migration 046_allow_events_docs_storage.sql su Supabase, poi riprova.`
          : `Errore nel caricamento di «${file.name}».`,
        'Caricamento non riuscito',
        'error',
      )
    } finally {
      setAllegatoUploading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    try {
      const uploadedDocs: VerbaleDoc[] = []
      const existingLabels = parseVerbaleDocs(newEvent.verbale_pdfs).map((d) => d.label)
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        if (file.type !== 'application/pdf') {
          showFormAlert(
            `Il file «${file.name}» non è un PDF.`,
            'Formato non valido',
            'warning',
          )
          continue
        }
        
        if (file.size > 10 * 1024 * 1024) {
          showFormAlert(
            `Il file «${file.name}» è troppo grande (max 10MB).`,
            'File troppo grande',
            'warning',
          )
          continue
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const randomId = Math.random().toString(36).substr(2, 9)
        const filename = `verbale_${timestamp}_${randomId}.pdf`
        
        try {
          const { error } = await supabase.storage
            .from('docs')
            .upload(`events/${filename}`, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'application/pdf',
            })
          
          if (error) throw error

          const labelPool = [...existingLabels, ...uploadedDocs.map((d) => d.label)]
          const label = nextVerbaleLabel(labelPool, new Date())
          uploadedDocs.push({ file: filename, label })
        } catch (uploadError) {
          console.error(`Errore nel caricamento di ${file.name}:`, uploadError)
          const detail =
            uploadError &&
            typeof uploadError === 'object' &&
            'message' in uploadError &&
            typeof (uploadError as { message?: unknown }).message === 'string'
              ? String((uploadError as { message: string }).message)
              : ''
          const isRls =
            detail.toLowerCase().includes('row-level security') ||
            detail.toLowerCase().includes('violates row-level security')
          showFormAlert(
            isRls
              ? `Errore nel caricamento di «${file.name}».\n\nManca l’autorizzazione storage per i verbali eventi (path docs/events/). Applica la migration 046_allow_events_docs_storage.sql su Supabase, poi riprova.`
              : `Errore nel caricamento di «${file.name}».`,
            'Caricamento non riuscito',
            'error',
          )
        }
      }

      if (uploadedDocs.length > 0) {
        setNewEvent(prev => ({
          ...prev,
          verbale_pdfs: [
            ...serializeVerbaleDocs(parseVerbaleDocs(prev.verbale_pdfs)),
            ...serializeVerbaleDocs(uploadedDocs),
          ],
        }))
        
        const count = uploadedDocs.length
        showFormAlert(
          count === 1
            ? '1 file PDF caricato con successo.'
            : `${count} file PDF caricati con successo.`,
          'Caricamento completato',
          'success',
        )
      }
      
    } catch (error) {
      console.error('Errore upload:', error)
      showFormAlert('Errore nel caricamento dei file.', 'Caricamento non riuscito', 'error')
    } finally {
      event.target.value = ''
    }
  }

  const startEditVerbaleLabel = (doc: VerbaleDoc) => {
    setEditingVerbaleFile(doc.file)
    setEditingVerbaleLabel(doc.label)
  }

  const cancelEditVerbaleLabel = () => {
    setEditingVerbaleFile(null)
    setEditingVerbaleLabel('')
  }

  const saveVerbaleLabel = async (storageFile: string, persistEventId?: string | null) => {
    const trimmed = editingVerbaleLabel.trim()
    if (!trimmed) {
      showFormAlert('Inserisci un nome per il verbale.', 'Nome mancante', 'warning')
      return
    }
    setSavingVerbaleLabel(true)
    try {
      const updateDocs = (raw: string[] | undefined) =>
        serializeVerbaleDocs(
          parseVerbaleDocs(raw).map((d) =>
            d.file === storageFile ? { ...d, label: trimmed } : d,
          ),
        )

      const formSerialized = updateDocs(newEvent.verbale_pdfs)
      setNewEvent((prev) => ({ ...prev, verbale_pdfs: updateDocs(prev.verbale_pdfs) }))

      const eventId = persistEventId ?? (showCreateForm ? editingEvent?.id : selectedEvent?.id) ?? null
      if (eventId) {
        const sourceRaw =
          selectedEvent?.id === eventId
            ? selectedEvent.verbale_pdfs
            : formSerialized
        const serialized = updateDocs(sourceRaw)

        if (selectedEvent?.id === eventId) {
          setSelectedEvent((prev) => (prev ? { ...prev, verbale_pdfs: serialized } : null))
        }
        setEvents((prev) =>
          prev.map((ev) => (ev.id === eventId ? { ...ev, verbale_pdfs: serialized } : ev)),
        )
        if (editingEvent?.id === eventId) {
          setNewEvent((prev) => ({ ...prev, verbale_pdfs: serialized }))
        }

        const { error } = await supabase
          .from('events')
          .update({ verbale_pdfs: serialized })
          .eq('id', eventId)
        if (error) throw error
      }

      cancelEditVerbaleLabel()
    } catch (error) {
      console.error('Errore salvataggio nome verbale:', error)
      showFormAlert('Errore nel salvataggio del nome.', 'Salvataggio non riuscito', 'error')
    } finally {
      setSavingVerbaleLabel(false)
    }
  }

  const removePDF = async (rawOrFilename: string) => {
    const filename = parseVerbaleDoc(rawOrFilename).file || rawOrFilename
    const previousDocs = parseVerbaleDocs(newEvent.verbale_pdfs)
    const removedDoc = previousDocs.find((d) => d.file === filename)
    const remainingSerialized = serializeVerbaleDocs(previousDocs.filter((d) => d.file !== filename))
    const updatedVerbalePdf =
      parseVerbaleDoc(newEvent.verbale_pdf || '').file === filename ? '' : newEvent.verbale_pdf

    try {
      setNewEvent((prev) => ({
        ...prev,
        verbale_pdfs: serializeVerbaleDocs(
          parseVerbaleDocs(prev.verbale_pdfs).filter((d) => d.file !== filename),
        ),
        verbale_pdf:
          parseVerbaleDoc(prev.verbale_pdf || '').file === filename ? '' : prev.verbale_pdf,
      }))
      
      const { error } = await supabase.storage
        .from('docs')
        .remove([`events/${filename}`])
      
      if (error) {
        console.error('Errore nella rimozione del file da Storage:', error)
        if (removedDoc) {
          setNewEvent((prev) => ({
            ...prev,
            verbale_pdfs: serializeVerbaleDocs([
              ...parseVerbaleDocs(prev.verbale_pdfs),
              removedDoc,
            ]),
          }))
        }
        showFormAlert(
          'Errore nella rimozione del file da Storage.',
          'Rimozione non riuscita',
          'error',
        )
        return
      }
      
      localStorage.removeItem(`pdf_${filename}`)
      
      if (editingEvent) {
        const { error: updateError } = await supabase
          .from('events')
          .update({
            verbale_pdf: updatedVerbalePdf || null,
            verbale_pdfs: remainingSerialized.length > 0 ? remainingSerialized : null,
          })
          .eq('id', editingEvent.id)
        
        if (updateError) {
          console.error('Errore nell\'aggiornamento del database:', updateError)
        } else if (selectedEvent && selectedEvent.id === editingEvent.id) {
          setSelectedEvent((prev) =>
            prev
              ? {
                  ...prev,
                  verbale_pdf: updatedVerbalePdf,
                  verbale_pdfs: remainingSerialized,
                }
              : null,
          )
        }
      }
      
      setEvents((prevEvents) =>
        prevEvents.map((event) => {
          const docs = parseVerbaleDocs(event.verbale_pdfs).filter((d) => d.file !== filename)
          const single =
            parseVerbaleDoc(event.verbale_pdf || '').file === filename ? '' : event.verbale_pdf
          if (
            single === event.verbale_pdf &&
            docs.length === parseVerbaleDocs(event.verbale_pdfs).length
          ) {
            return event
          }
          return {
            ...event,
            verbale_pdf: single,
            verbale_pdfs: serializeVerbaleDocs(docs),
          }
        }),
      )
    } catch (error) {
      console.error('Errore nella rimozione del PDF:', error)
      showFormAlert('Errore nella rimozione del PDF.', 'Rimozione non riuscita', 'error')
    }
  }

  const embedLight = embedInLayout
  const dark = false
  const brandConfig = getBrandConfig()

  return (
    <div
      className={embedLight ? 'min-h-full text-gray-900' : 'min-h-screen bg-gray-50 text-gray-900'}
      style={embedLight ? { backgroundColor: GOLEE.surfaceMuted } : undefined}
    >
      {!embedInLayout && (
        <Header 
          title="Gestione Eventi" 
          showBack={true}
          hideCenterLogo={true}
        />
      )}
      
      <div className={`w-full min-w-0 px-6 lg:px-8 py-6 ${embedLight ? '' : ''}`}>
        {/* Form creazione/modifica evento - a pagina intera tra sidebar e header */}
        {showCreateForm && (
          <>
          {eventModalEditMode && <div className="fixed inset-0 z-[55] bg-slate-950/45 backdrop-blur-[2px]" />}
          <div
            className={`${eventModalEditMode
              ? 'fixed inset-y-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-[1380px] -translate-x-1/2 overflow-y-auto rounded-[28px] border border-slate-200 bg-[#F5F8FC] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:p-8'
              : 'p-6 mb-8 rounded-lg'} ${
              dark
                ? 'bg-white/5 border border-white/10 [&_label]:text-gray-300 [&_input]:bg-white/10 [&_input]:text-white [&_input]:border-white/20 [&_select]:bg-white [&_select]:text-gray-900 [&_select]:border-white/20 [&_option]:bg-white [&_option]:text-gray-900 [&_textarea]:bg-white/10 [&_textarea]:text-white [&_textarea]:border-white/20'
                : 'card text-gray-900 [&_input]:bg-white [&_input]:text-gray-900 [&_select]:bg-white [&_select]:text-gray-900 [&_option]:bg-white [&_option]:text-gray-900 [&_textarea]:bg-white [&_textarea]:text-gray-900'
            }`}
            id="event-form"
          >
            {eventModalEditMode && (
              <div className="mb-5 flex items-center justify-between border-b border-[#DBE5F0] pb-4">
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.14em] text-[#667085]">MODIFICA EVENTO</div>
                  <p className="mt-1 text-sm text-[#667085]">Aggiorna i dati senza uscire dalla scheda dell&apos;evento.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  aria-label="Chiudi modifica evento"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#667085] transition-colors hover:bg-white hover:text-[#071226]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <h2 className={`text-2xl font-bold mb-4 ${dark ? 'text-white' : 'text-navy'} ${newEvent.event_type === 'partita' ? 'whitespace-pre' : ''}`}>
              {getEventFormHeaderTitle()}
            </h2>
            <form onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent} className="space-y-4">
              {(() => {
                const fields = getEventTypeFields()
                const showTitleField =
                  !!newEvent.event_type &&
                  newEvent.event_type !== 'festa_del_rugby' &&
                  newEvent.event_type !== 'consiglio' &&
                  newEvent.event_type !== 'partita'
                const isConsiglioForm = newEvent.event_type === 'consiglio'
                const isStaffMeetingForm = !!fields.isStaffMeeting || newEvent.event_type === 'incontro_staff'
                const eventTypeField = (inRow = false) => (
                  <div className={inRow ? 'w-[11rem] shrink-0' : 'min-w-[140px] flex-1 max-w-md'}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo Evento *
                    </label>
                    <select
                      required
                      value={newEvent.event_type}
                      onChange={(e) => handleEventTypeChange(e.target.value)}
                      className="w-full p-3 rounded-2xl border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    >
                      <option value="" className="bg-white text-gray-900">Seleziona un evento</option>
                      {activeEventTypes.map((type) => (
                        <option key={type.code} value={type.code} className="bg-white text-gray-900">{type.name}</option>
                      ))}
                    </select>
                  </div>
                )
                return (
                  <>
                    {!newEvent.event_type && eventTypeField()}
                {newEvent.event_type && (
                  <>
                    {/* PRIMA RIGA: Tipo, Avversario/Titolo, Categoria, tag */}
                    {!isConsiglioForm && (
                    <div className="flex flex-nowrap items-end gap-3 overflow-visible pb-1">
                {eventTypeField(true)}
                {fields.showOpponent && (
                  <div className="min-w-0 flex-1 basis-[120px]">
                    <div className="mb-2 flex min-w-0 w-full items-start justify-between gap-2">
                      <label className="shrink-0 pt-0.5 text-sm font-medium text-gray-700">Avversario</label>
                      <button
                        type="button"
                        onClick={goToManageRugbyClubs}
                        className={`min-w-0 max-w-[65%] shrink text-right text-xs leading-snug underline ${dark ? 'text-sky-300 hover:text-sky-200' : 'text-teal-700 hover:text-teal-900'}`}
                      >
                        Gestisci elenco società di rugby
                      </button>
                    </div>
                    <RugbyClubAutocomplete
                      value={newEvent.opponent}
                      onChange={handleOpponentChange}
                      clubs={rugbyClubs}
                      placeholder="Cerca società dall'elenco..."
                      inputClassName="p-3"
                      dark={dark}
                    />
                  </div>
                )}
                {showTitleField && (
                <div className="min-w-[10rem] flex-1 shrink">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titolo Evento *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Es. Torneo Due Laghi"
                  />
                </div>
                )}
                {isStaffMeetingForm && (
                  <div className="shrink-0">
                    <label className="mb-2 block text-sm font-medium text-gray-700 invisible select-none" aria-hidden="true">
                      Staff
                    </label>
                    <div className="flex min-h-[3rem] flex-wrap items-center gap-2">
                      {STAFF_MEETING_GROUPS.map((g) => {
                        const active = staffMeetingGroups.includes(g.id)
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() =>
                              setStaffMeetingGroups((prev) =>
                                prev.includes(g.id)
                                  ? prev.filter((id) => id !== g.id)
                                  : [...prev, g.id],
                              )
                            }
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                              active
                                ? g.id === 'coach'
                                  ? 'bg-blue-600 text-white'
                                  : g.id === 'medical'
                                    ? 'bg-rose-500 text-white'
                                    : g.id === 'atletica'
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-violet-600 text-white'
                                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {g.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {fields.showCategory && (
                  <div className="w-[16rem] shrink-0">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoria{newEvent.event_type === 'festa_del_rugby' ? ' *' : ''}
                    </label>
                    <select
                      required={newEvent.event_type === 'festa_del_rugby'}
                      value={newEvent.category_id}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    >
                      <option value="">Seleziona categoria</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Tag: Evento in casa, Campionato/Amichevole oppure vincitore torneo */}
                {(fields.showHomeAway || fields.showChampionship || fields.allowsTournamentWinner) && (
                  <div className="shrink-0">
                    <label className="mb-2 block text-sm font-medium text-gray-700 invisible select-none" aria-hidden="true">
                      Categoria
                    </label>
                    <div className="flex min-h-[3rem] items-center gap-2">
                    {fields.showHomeAway && !requiresAwayDetail(newEvent.location) && (
                      <button
                        type="button"
                        onClick={() => handleHomeAwayChange(!newEvent.is_home)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${newEvent.is_home
                          ? 'bg-violet-500 text-white'
                          : dark ? 'bg-white/10 text-white border border-white/30 hover:bg-white/20' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
                      >
                        Evento in casa
                      </button>
                    )}
                    {fields.showChampionship && !fields.allowsTournamentWinner && (
                      <>
                        <button
                          type="button"
                          onClick={() => setNewEvent(prev => ({ ...prev, is_championship: true, is_friendly: false }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${newEvent.is_championship
                            ? 'bg-amber-500 text-white'
                            : dark ? 'bg-white/10 text-white border border-white/30 hover:bg-white/20' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
                        >
                          Campionato
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewEvent(prev => ({ ...prev, is_friendly: true, is_championship: false }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${newEvent.is_friendly
                            ? 'bg-emerald-500 text-white'
                            : dark ? 'bg-white/10 text-white border border-white/30 hover:bg-white/20' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
                        >
                          Amichevole
                        </button>
                      </>
                    )}
                    {fields.allowsTournamentWinner && (
                      <label className={`flex shrink-0 items-center gap-2 text-sm whitespace-nowrap ${dark ? 'text-gray-200' : 'text-gray-700'}`}>
                        <input
                          type="checkbox"
                          checked={newEvent.expects_tournament_winner}
                          onChange={(e) => setNewEvent((prev) => ({
                            ...prev,
                            expects_tournament_winner: e.target.checked,
                          }))}
                          className="rounded border-gray-300"
                        />
                        Previsto un vincitore per questo evento
                      </label>
                    )}
                    </div>
                  </div>
                )}
              </div>
                    )}

              {isStaffMeetingForm && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {staffMeetingGroups.length > 0
                        ? `Seleziona: ${STAFF_MEETING_GROUPS.filter((g) => staffMeetingGroups.includes(g.id))
                            .map((g) => g.label)
                            .join(', ')}`
                        : 'Scegli uno o più tag sopra per vedere i nomi'}
                    </p>
                    {staffMeetingGroups.length > 0 && (
                      <p className="mb-2 text-xs text-slate-500">
                        Colonne da <span className="font-medium">Categorie Staff</span> in anagrafica (non dal tab Giocatore).
                      </p>
                    )}
                    {loadingStaffMeetingPeople ? (
                      <p className="text-sm text-gray-500">Caricamento staff...</p>
                    ) : staffMeetingGroups.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Clicca Coach, Area medica, Atletica o Assistenti (anche più di uno) per filtrare le persone.
                      </p>
                    ) : staffMeetingPool.length === 0 ? (
                      <p className="text-sm text-gray-500">Nessuna persona in questo gruppo.</p>
                    ) : (
                      <div className="space-y-4">
                        {staffMeetingSections.map((section) => {
                          const isMedicalHorizontal = section.groupId === 'medical'
                          return (
                          <div key={section.groupId} className="space-y-3">
                            {staffMeetingGroups.length > 1 && (
                              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
                                {section.groupLabel}
                              </p>
                            )}
                            {isMedicalHorizontal ? (
                              <div className="space-y-3">
                                {section.categories.map((bucket) => {
                                  const visiblePeople = bucket.people.filter((person) => {
                                    const chipLabel = formatStaffMeetingChipLabel(person, bucket.label)
                                    const invitedForPerson = staffMeetingInvitedLabelsForPerson(
                                      newEvent.invited,
                                      person,
                                    )
                                    const selected = invitedForPerson.includes(chipLabel)
                                    return invitedForPerson.length === 0 || selected
                                  })
                                  if (visiblePeople.length === 0) return null
                                  return (
                                  <div key={`${section.groupId}-${bucket.key}`} className="space-y-1.5">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                      {bucket.label}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                                      {visiblePeople.map((person) => {
                                        const chipLabel = formatStaffMeetingChipLabel(person, bucket.label)
                                        const selected = staffMeetingInvitedLabelsForPerson(
                                          newEvent.invited,
                                          person,
                                        ).includes(chipLabel)
                                        return (
                                          <button
                                            key={`${section.groupId}-${bucket.key}-${person.id}`}
                                            type="button"
                                            onClick={() => toggleStaffMeetingInvite(person, bucket.label)}
                                            className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors ${
                                              selected
                                                ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-white'
                                            }`}
                                            title={selected ? 'Rimuovi dall\'invito' : 'Invita (parte come presente)'}
                                          >
                                            {chipLabel}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  )
                                })}
                              </div>
                            ) : (
                            <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
                              {section.categories.map((bucket) => {
                                const visiblePeople = bucket.people.filter((person) => {
                                  const chipLabel = formatStaffMeetingChipLabel(person, bucket.label)
                                  const invitedForPerson = staffMeetingInvitedLabelsForPerson(
                                    newEvent.invited,
                                    person,
                                  )
                                  const selected = invitedForPerson.includes(chipLabel)
                                  return invitedForPerson.length === 0 || selected
                                })
                                if (visiblePeople.length === 0) return null
                                return (
                                <div
                                  key={`${section.groupId}-${bucket.key}`}
                                  className="min-w-[9.5rem] max-w-[16rem] flex-1 space-y-1.5"
                                >
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    {bucket.label}
                                  </p>
                                  <div className="flex flex-col gap-2">
                                    {visiblePeople.map((person) => {
                                      const chipLabel = formatStaffMeetingChipLabel(person, bucket.label)
                                      const selected = staffMeetingInvitedLabelsForPerson(
                                        newEvent.invited,
                                        person,
                                      ).includes(chipLabel)
                                      return (
                                        <button
                                          key={`${section.groupId}-${bucket.key}-${person.id}`}
                                          type="button"
                                          onClick={() => toggleStaffMeetingInvite(person, bucket.label)}
                                          className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors ${
                                            selected
                                              ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                                              : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-white'
                                          }`}
                                          title={selected ? 'Rimuovi dall\'invito' : 'Invita (parte come presente)'}
                                        >
                                          {chipLabel}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                                )
                              })}
                            </div>
                            )}
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {(staffMeetingPresenti.length > 0 || staffMeetingAssenti.length > 0) && (
                    <div className="space-y-4 border-t border-slate-200 pt-4">
                      {staffMeetingPresenti.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-blue-700">
                            Presenti ({staffMeetingPresenti.length})
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {staffMeetingPresenti.map((label) => (
                              <div
                                key={`present-${label}`}
                                className="flex min-w-0 items-center justify-between gap-1 rounded-lg border border-blue-100 bg-white p-2"
                              >
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-blue-900">
                                  {label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => moveStaffMeetingToAbsent(label)}
                                  className="shrink-0 rounded p-0.5 text-red-500 hover:bg-red-50"
                                  title="Sposta in Assenti"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {staffMeetingAssenti.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-red-700">
                            Assenti ({staffMeetingAssenti.length})
                          </p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {staffMeetingAssenti.map((label) => (
                              <div
                                key={`absent-${label}`}
                                className="flex min-w-0 items-center justify-between gap-1 rounded-lg border border-red-100 bg-red-50 p-2"
                              >
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-red-800">
                                  {label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => moveStaffMeetingToPresent(label)}
                                  className="shrink-0 rounded px-1 text-lg font-bold leading-none text-green-700 hover:bg-green-50"
                                  title="Riporta in Presenti"
                                >
                                  +
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Data, Location, orari o date festa - allineati in basso sulla stessa riga */}
              <div className={`flex items-end gap-4 ${isConsiglioForm ? 'flex-nowrap overflow-x-auto' : 'flex-wrap'}`}>
                {isConsiglioForm && eventTypeField(true)}
                <div className="min-w-[120px] flex-1">
                  <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {fields.isClubParty ? 'Data inizio festa *' : 'Data Evento *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={newEvent.event_date}
                    onChange={(e) => {
                      const newDate = e.target.value
                      setNewEvent(prev => {
                        const updated = {...prev, event_date: newDate}
                        if (prev.event_type === 'consiglio' && newDate) {
                          updated.title = `Consiglio del ${new Date(newDate).toLocaleDateString('it-IT')}`
                        }
                        return updated
                      })
                    }}
                    className={`w-full p-3 rounded-2xl border focus:ring-2 focus:ring-sky-500 ${dark ? 'bg-white/10 border-white/20 text-white' : 'border-gray-300'}`}
                  />
                </div>
                {fields.isClubParty && (
                  <div className="min-w-[120px] flex-1">
                    <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Data fine festa *
                    </label>
                    <input
                      type="date"
                      required
                      min={newEvent.event_date || undefined}
                      value={newEvent.event_end_date}
                      onChange={(e) => setNewEvent({ ...newEvent, event_end_date: e.target.value })}
                      className={`w-full p-3 rounded-2xl border focus:ring-2 focus:ring-sky-500 ${dark ? 'bg-white/10 border-white/20 text-white' : 'border-gray-300'}`}
                    />
                  </div>
                )}
                <div className="min-w-[120px] flex-1">
                  <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Location
                  </label>
                  <TrainingVenueSelect
                    value={newEvent.location}
                    onChange={handleLocationChange}
                    homeOnly={fields.isClubParty}
                    className={`w-full p-3 rounded-2xl border focus:ring-2 focus:ring-sky-500 ${dark ? 'bg-white/10 border-white/20 text-white' : 'border-gray-300'}`}
                  />
                </div>
                {requiresAwayDetail(newEvent.location) && (
                  <div className="min-w-[140px] flex-1">
                    <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Dove</label>
                    <input
                      type="text"
                      value={newEvent.away_location}
                      onChange={(e) => setNewEvent({...newEvent, away_location: e.target.value})}
                      className={`w-full p-3 rounded-2xl border focus:ring-2 focus:ring-sky-500 ${dark ? 'bg-white/10 border-white/20 text-white' : 'border-gray-300'}`}
                      placeholder="Trasferta"
                      required
                    />
                  </div>
                )}
                {fields.showTimeFields && (fields.timeFieldType === 'start_end' ? (
                  <>
                    <div className="min-w-[100px] flex-1">
                      <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Ora Inizio</label>
                      <input
                        type="time"
                        value={newEvent.start_time}
                        onChange={(e) => setNewEvent({...newEvent, start_time: e.target.value})}
                        className={`w-full p-3 rounded-2xl border focus:ring-2 focus:ring-sky-500 ${dark ? 'bg-white/10 border-white/20 text-white' : 'border-gray-300'}`}
                      />
                    </div>
                    <div className="min-w-[100px] flex-1">
                      <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Ora Fine</label>
                      <input
                        type="time"
                        value={newEvent.end_time}
                        onChange={(e) => setNewEvent({...newEvent, end_time: e.target.value})}
                        className={`w-full p-3 rounded-2xl border focus:ring-2 focus:ring-sky-500 ${dark ? 'bg-white/10 border-white/20 text-white' : 'border-gray-300'}`}
                      />
                    </div>
                  </>
                ) : (
                  <div className="min-w-[100px] flex-1">
                    <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Ora Evento</label>
                    <input
                      type="time"
                      value={newEvent.event_time}
                      onChange={(e) => setNewEvent({...newEvent, event_time: e.target.value})}
                      className={`w-full p-3 rounded-2xl border focus:ring-2 focus:ring-sky-500 ${dark ? 'bg-white/10 border-white/20 text-white' : 'border-gray-300'}`}
                    />
                  </div>
                ))}
              </div>

              {/* TERZA RIGA: Avversari per tornei */}
              {fields.showOpponents && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Squadre (tornei, feste del rugby, ecc.)
                  </label>
                  <p className={`text-xs mb-2 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Seleziona le società dall&apos;elenco gestito in Impostazioni → Aggiungi Società di Rugby.
                  </p>
                  <DndContext
                    sensors={gironiSensors}
                    collisionDetection={gironiCollisionDetection}
                    onDragStart={handleGironiDragStart}
                    onDragEnd={handleGironiDragEndWithOverlay}
                    onDragCancel={() => setActiveTeamDrag(null)}
                  >
                    <UnassignedDropZone
                      unassignedTeams={unassignedTeams}
                      hasGironi={(newEvent.gironi?.length ?? 0) > 0}
                      onRemoveTeam={removeTeamFromOpponents}
                    />
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => addTeamByName()}
                          className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 shrink-0"
                        >
                          ➕ Aggiungi Squadra
                        </button>
                        <div className="w-full max-w-xs shrink-0">
                          <RugbyClubAutocomplete
                            value={newTeamNameInput}
                            onChange={setNewTeamNameInput}
                            clubs={rugbyClubs}
                            placeholder="Cerca società dall'elenco..."
                            normalizeUppercase
                            onEnter={addTeamByName}
                            dark={dark}
                            excludeNames={(newEvent.opponents ?? []).filter((t) => t.trim() !== '')}
                            inputClassName="h-10 px-3 py-2 rounded-xl text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={addGirone}
                          className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-blue-900 text-white text-sm font-medium hover:bg-blue-800 shrink-0 ml-auto"
                        >
                          ➕ {(newEvent.gironi?.length ?? 0) === 0 ? 'Aggiungi Gironi' : 'Aggiungi Girone'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={goToManageRugbyClubs}
                        className={`inline-block text-xs underline ${dark ? 'text-sky-300 hover:text-sky-200' : 'text-teal-700 hover:text-teal-900'}`}
                      >
                        Gestisci elenco società di rugby
                      </button>
                    </div>
                    {(newEvent.gironi?.length ?? 0) > 0 && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Gironi
                        </label>
                        <div
                          className="grid w-full gap-4"
                          style={{
                            gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, (newEvent.gironi ?? []).length))}, minmax(0, 1fr))`
                          }}
                        >
                          {(newEvent.gironi ?? []).map((girone) => (
                            <GironeDropBox
                              key={girone.id}
                              girone={girone}
                              gironiCount={(newEvent.gironi ?? []).length}
                              editingGironeId={editingGironeId}
                              setEditingGironeId={setEditingGironeId}
                              onRename={renameGirone}
                              onRemove={removeGirone}
                              onRemoveTeam={removeTeamFromGirone}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
                      {activeTeamDrag ? <TeamDragPreview teamName={activeTeamDrag} /> : null}
                    </DragOverlay>
                  </DndContext>
                </div>
              )}

              {/* Partecipanti Consiglio */}
              {fields.showParticipants && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Partecipanti
                  </label>
                  
                  {/* Dropdown per selezionare membri del consiglio */}
                  {getAvailableCouncilMembers().length > 0 && (
                    <div className="mb-3 flex items-stretch gap-2">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addParticipant(e.target.value)
                            e.target.value = ''
                          }
                        }}
                        className="w-[calc((100%-2.5rem)/6*1.15)] min-w-0 p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      >
                        <option value="">Seleziona un membro del consiglio</option>
                        {getAvailableCouncilMembers().map(member => (
                          <option key={member.id} value={member.id}>
                            {member.name} ({member.role === 'president' ? 'Presidente' : 
                                           member.role === 'vice_president' ? 'Vice Presidente' : 'Consigliere'})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (getAvailableCouncilMembers().length > 0) {
                            const firstMember = getAvailableCouncilMembers()[0]
                            addParticipant(firstMember.id)
                          }
                        }}
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-500 text-white text-xl font-bold leading-none hover:bg-green-600"
                        title="Aggiungi primo membro disponibile"
                      >
                        +
                      </button>
                    </div>
                  )}
                  
                  {/* Presenti: lista trascinabile; X = sposta in Assenti */}
                  {sortedCouncilParticipants.length > 0 && (
                    <div className="mb-4">
                      <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${dark ? 'text-blue-200' : 'text-gray-500'}`}>Presenti</p>
                      <DndContext sensors={participantSensors} collisionDetection={closestCenter} onDragEnd={handleParticipantsDragEnd}>
                        <SortableContext
                          items={sortedCouncilParticipants.map((_, i) => `part-${i}`)}
                          strategy={rectSortingStrategy}
                        >
                          <div className="grid grid-cols-6 gap-2">
                            {sortedCouncilParticipants.map((participant, index) => (
                              <SortableParticipantItem
                                key={`part-${index}`}
                                id={`part-${index}`}
                                name={participant}
                                displayLabel={formatCouncilMemberLabel(participant, councilMembers)}
                                onRemoveToAbsent={() => removeParticipant(participant)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}

                  {/* Assenti: X = riporta in Presenti (un nome = una riga, niente duplicati) */}
                  {(() => {
                    const absentList = councilMembers.filter(m => !newEvent.participants.includes(m.name))
                    const absentByName = sortCouncilBySurnameWithPresidentFirst(
                      Array.from(new Map(absentList.map(m => [m.name, m])).values())
                    )
                    return absentByName.length > 0 && (
                      <div>
                        <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${dark ? 'text-red-200' : 'text-gray-500'}`}>Assenti</p>
                        <div className="grid grid-cols-6 gap-2">
                          {absentByName.map(member => (
                            <div key={member.id} className={`flex items-center justify-between gap-1 p-2 rounded-lg min-w-0 ${dark ? 'bg-red-900/40 border border-red-500/30' : 'bg-red-50'}`}>
                              <span className={`min-w-0 flex-1 truncate text-base ${dark ? 'text-red-200' : 'text-red-800'}`}>{formatCouncilMemberLabel(member.name, councilMembers)}</span>
                              <button
                                type="button"
                                onClick={() => addParticipant(member.id)}
                                className={`shrink-0 text-lg font-bold leading-none ${dark ? 'text-green-300 hover:text-white' : 'text-green-700 hover:text-green-900'}`}
                                title="Aggiungi al consiglio"
                              >
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  
                  {councilMembers.length === 0 && (
                    <p className="text-gray-500 text-sm">Nessun membro del consiglio configurato. Vai in Settings → Sistema → Gestione Consiglio per aggiungere i membri.</p>
                  )}
                </div>
              )}

              {/* QUINTA RIGA: Invitati */}
              {fields.showInvited && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invitati
                  </label>
                  
                  <div className="mb-3 grid grid-cols-6 gap-2 items-stretch">
                    <button
                      type="button"
                      onClick={openInvitedModal}
                      className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 font-medium text-sm min-h-[3rem]"
                    >
                      ➕ Gestisci Invitati ({newEvent.invited.length})
                    </button>
                  </div>
                  
                  {sortedInvited.length > 0 && (
                    <div className="grid grid-cols-6 gap-2">
                      {sortedInvited.map((invited, index) => (
                        <div key={`${invited}-${index}`} className="flex items-center justify-between gap-1 p-2 bg-green-50 rounded-lg min-w-0">
                          <span className="text-green-800 flex-1 min-w-0 text-base truncate">{invited}</span>
                          <button
                            type="button"
                            onClick={() => removeInvited(invited)}
                            className="text-red-600 hover:text-red-800 shrink-0 text-sm leading-none"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Ordine del giorno (consiglio / incontro staff) */}
              {fields.showOrdineDelGiorno && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ordine del giorno{newEvent.event_type === 'consiglio' ? ' *' : ''}
                  </label>
                  <p className={`mb-2 text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    «Varie ed eventuali» viene aggiunto automaticamente come ultimo punto.
                  </p>
                  {/* Input per aggiungere punto */}
                  <div className="flex items-stretch gap-2 mb-3">
                    <input
                      ref={odgInputRef}
                      type="text"
                      value={newOdgPoint}
                      onChange={(e) => {
                        setNewOdgPoint(e.target.value)
                        setOdgEmptyHint(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addOrdineDelGiorno()
                        }
                      }}
                      placeholder="Scrivi un punto (es. Approvazione verbale precedente)..."
                      className={`flex-1 min-w-0 p-3 rounded-2xl border focus:ring-2 focus:ring-sky-500 focus:border-transparent ${dark ? 'bg-white/10 text-white border-white/20 placeholder:text-gray-400' : 'border-gray-300'} ${odgEmptyHint ? 'ring-2 ring-amber-500 animate-pulse' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={(e) => addOrdineDelGiorno(e)}
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-500 text-white text-xl font-bold leading-none hover:bg-green-600"
                      title="Aggiungi punto"
                    >
                      +
                    </button>
                  </div>
                  {odgEmptyHint && (
                    <p className={`text-sm mb-2 ${dark ? 'text-amber-400' : 'text-amber-600'}`}>Scrivi un punto nel campo sopra e premi Aggiungi</p>
                  )}
                  
                  {/* Lista punti - 3 per fila con drag & drop */}
                  {newEvent.ordine_del_giorno && newEvent.ordine_del_giorno.length > 0 && (
                    <DndContext sensors={odgSensors} collisionDetection={closestCenter} onDragEnd={handleOdgDragEnd}>
                      <SortableContext
                        items={newEvent.ordine_del_giorno.map((_, i) => `odg-${i}`)}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid grid-cols-6 gap-2">
                          {newEvent.ordine_del_giorno.map((point, index) => (
                            <SortableOdgItem
                              key={`odg-${index}`}
                              id={`odg-${index}`}
                              point={point}
                              index={index}
                              onRemove={() => removeOrdineDelGiorno(index)}
                              onStartEdit={() => {
                                setEditingOdgIndex(index)
                                setEditingOdgValue(point)
                              }}
                              isEditing={editingOdgIndex === index}
                              editValue={editingOdgIndex === index ? editingOdgValue : ''}
                              onEditValueChange={setEditingOdgValue}
                              onSaveEdit={() => updateOrdineDelGiorno(index, editingOdgValue)}
                              onCancelEdit={() => setEditingOdgIndex(null)}
                              dark={dark}
                              isClosurePoint={isOdgClosurePoint(point)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              )}

              {/* SESTA RIGA: PDF Verbali (consiglio) */}
              {fields.showVerbalePdf && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verbale PDF
                  </label>
                  
                  {/* Upload Button */}
                  <div className="mb-3">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label
                      htmlFor="pdf-upload"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Carica PDF
                    </label>
                    <span className="ml-3 text-sm text-gray-500">
                      Puoi caricare più file PDF (max 10MB ciascuno)
                    </span>
                  </div>

                  {/* Lista PDF caricati */}
                  {parseVerbaleDocs(newEvent.verbale_pdfs).length > 0 && (
                    <div className="space-y-2">
                      {parseVerbaleDocs(newEvent.verbale_pdfs).map((doc) => (
                        <div
                          key={doc.file}
                          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-red-600" />
                          {editingVerbaleFile === doc.file ? (
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <input
                                type="text"
                                value={editingVerbaleLabel}
                                onChange={(e) => setEditingVerbaleLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    void saveVerbaleLabel(doc.file, editingEvent?.id)
                                  }
                                  if (e.key === 'Escape') cancelEditVerbaleLabel()
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                                autoFocus
                              />
                              <button
                                type="button"
                                disabled={savingVerbaleLabel}
                                onClick={() => { void saveVerbaleLabel(doc.file, editingEvent?.id) }}
                                className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                              >
                                Salva
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditVerbaleLabel}
                                className="rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-200"
                              >
                                Annulla
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenPDF(doc.file)}
                                className="min-w-0 flex-1 truncate text-left text-sm font-medium text-gray-800 hover:text-blue-700"
                                title={doc.label}
                              >
                                {doc.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditVerbaleLabel(doc)}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-white hover:text-[#2F6DF6]"
                                title="Modifica nome"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => { void removePDF(doc.file) }}
                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                title="Rimuovi PDF"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Allegati (incontro staff) */}
              {fields.showAllegati && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Allegati
                  </label>
                  <div className="mb-3">
                    <input
                      type="file"
                      accept={ALLEGATI_ACCEPT}
                      multiple
                      onChange={handleAllegatiFileSelect}
                      className="hidden"
                      id="allegati-upload"
                    />
                    <label
                      htmlFor="allegati-upload"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Carica allegati
                    </label>
                    <span className="ml-3 text-sm text-gray-500">
                      PDF, Word, Excel, immagini (max 10MB)
                    </span>
                  </div>

                  {parseVerbaleDocs(newEvent.verbale_pdfs).length > 0 && (
                    <div className="space-y-2">
                      {parseVerbaleDocs(newEvent.verbale_pdfs).map((doc) => (
                        <div
                          key={doc.file}
                          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                          {editingVerbaleFile === doc.file ? (
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <input
                                type="text"
                                value={editingVerbaleLabel}
                                onChange={(e) => setEditingVerbaleLabel(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    void saveVerbaleLabel(doc.file, editingEvent?.id)
                                  }
                                  if (e.key === 'Escape') cancelEditVerbaleLabel()
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                                autoFocus
                              />
                              <button
                                type="button"
                                disabled={savingVerbaleLabel}
                                onClick={() => { void saveVerbaleLabel(doc.file, editingEvent?.id) }}
                                className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                              >
                                Salva
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditVerbaleLabel}
                                className="rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-200"
                              >
                                Annulla
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenPDF(doc.file)}
                                className="min-w-0 flex-1 truncate text-left text-sm font-medium text-gray-800 hover:text-blue-700"
                                title={doc.label}
                              >
                                {doc.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditVerbaleLabel(doc)}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-white hover:text-[#2F6DF6]"
                                title="Modifica nome"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => { void removePDF(doc.file) }}
                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                title="Rimuovi allegato"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SETTIMA RIGA: Descrizione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrizione
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  rows={3}
                  className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Descrizione dell'evento..."
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="btn bg-sky text-white px-6 py-3"
                >
                  {editingEvent ? 'Aggiorna Evento' : 'Crea Evento'}
                </button>
                {editingEvent && newEvent.event_type !== 'consiglio' && !fields.isClubParty && (
                  <button
                    type="button"
                    onClick={handleGenerateFormEventPdf}
                    className="btn bg-green-600 text-white px-6 py-3 flex items-center gap-2 hover:bg-green-700"
                  >
                    <FileDown className="w-4 h-4 shrink-0" />
                    PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn bg-gray-500 text-white px-6 py-3"
                >
                  Annulla
                </button>
              </div>
                  </>
                )}
                {!newEvent.event_type && (
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="btn bg-gray-500 text-white px-6 py-3"
                    >
                      Annulla
                    </button>
                  </div>
                )}
                  </>
                )
              })()}
            </form>
          </div>
          </>
        )}

        {/* Popup di conferma per cambio tipo evento */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Conferma Cambio Tipo Evento
              </h3>
              <p className="text-gray-600 mb-6">
                Sei sicuro di voler cambiare il tipo di evento? Tutti i dati inseriti andranno persi.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelEventTypeChange}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmEventTypeChange}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        )}

        <GoleeAlertModal
          open={formAlert != null}
          title={formAlert?.title ?? ''}
          message={formAlert?.message ?? ''}
          variant={formAlert?.variant ?? 'warning'}
          onClose={() => setFormAlert(null)}
        />

        <GoleeConfirmModal
          open={staffSaveConfirm != null}
          title="Conferma salvataggio"
          message="Confermi chiusura solo con descrizione, senza punti ODG?"
          confirmLabel="Conferma e salva"
          cancelLabel="Annulla"
          onCancel={() => setStaffSaveConfirm(null)}
          onConfirm={() => {
            const mode = staffSaveConfirm
            setStaffSaveConfirm(null)
            if (mode === 'create') void handleCreateEvent(undefined, true)
            if (mode === 'update') void handleUpdateEvent(undefined, true)
          }}
        />

        <GoleeConfirmModal
          open={pendingSimpleDeleteEventId != null}
          title="Eliminare evento?"
          message="Sei sicuro di voler eliminare questo evento? L'operazione non può essere annullata."
          confirmLabel="Elimina"
          cancelLabel="Annulla"
          variant="danger"
          confirming={deletingEvent}
          onCancel={() => {
            if (!deletingEvent) setPendingSimpleDeleteEventId(null)
          }}
          onConfirm={() => { void confirmSimpleDeleteEvent() }}
        />

        <GoleeConfirmModal
          open={showDeleteEventDialog}
          title="Eliminare evento e lista gara?"
          message="Questa partita ha una lista gara associata. Se confermi, verranno eliminati sia l'evento sia la lista gara con tutti i convocati."
          confirmLabel="Elimina evento e lista gara"
          cancelLabel="Annulla"
          variant="danger"
          confirming={deletingEvent}
          onCancel={cancelDeleteEventDialog}
          onConfirm={() => { void confirmDeleteEventWithMatchList() }}
        />

        <GoleeRenameFileModal
          open={allegatoRenameQueue != null}
          originalName={
            allegatoRenameQueue
              ? allegatoOriginalBasename(allegatoRenameQueue.files[allegatoRenameQueue.index]!)
              : ''
          }
          value={allegatoRenameQueue?.label ?? ''}
          onChange={(value) =>
            setAllegatoRenameQueue((prev) => (prev ? { ...prev, label: value } : null))
          }
          onConfirm={() => { void confirmAllegatoRename() }}
          onCancel={cancelAllegatoRename}
          confirming={allegatoUploading}
        />

        {/* Modal dettagli evento - vista premium larga */}
        {showEventModal && selectedEvent && (() => {
          const isMultiTeamEvent = isMultiTeam(selectedEvent.event_type)
          const { gironi, gironiCount, teamCount, teamsPerGirone } = getMultiTeamEventStats(selectedEvent)
          const allTeams = getAllTeamsWithGirone(gironi)
          const locationName = requiresAwayDetail(selectedEvent.location) ? selectedEvent.away_location : selectedEvent.location
          const isClubPartyEvent = isClubParty(selectedEvent.event_type)
          const homeAwayLabel =
            selectedEvent.event_type === 'consiglio' || isClubPartyEvent
              ? ''
              : (selectedEvent.is_home ? 'Casa' : 'Trasferta')
          const startTimeDisplay = selectedEvent.start_time?.substring(0, 5) ?? '—'
          const endTimeDisplay = selectedEvent.end_time?.substring(0, 5) ?? '—'
          const searchQuery = eventModalSearch.trim().toLowerCase()
          const matchingTeams = searchQuery
            ? allTeams.filter(item => item.team.toLowerCase().includes(searchQuery))
            : []
          const matchingGironi = searchQuery
            ? gironi.filter(girone => girone.name.toLowerCase().includes(searchQuery))
            : []
          const participants = getEventParticipants(selectedEvent)
          const invited = getEventInvited(selectedEvent)
          const absentMembers = getAbsentCouncilMembers(selectedEvent)
          const teamLogoMap = new Map<string, string | null>()
          for (const club of rugbyClubs) {
            if (club.name?.trim()) {
              teamLogoMap.set(normalizeTeamName(club.name), club.logo_url?.trim() || null)
            }
          }
          const logoForTeam = (name: string) => teamLogoMap.get(normalizeTeamName(name)) ?? null
          const isPartita = selectedEvent.event_type === 'partita'
          const isConsiglioEvent = selectedEvent.event_type === 'consiglio'
          const clubPartyEndDate = selectedEvent.event_end_date || selectedEvent.event_date
          const consiglioPresenti = isConsiglioEvent
            ? sortCouncilParticipantNames(selectedEvent.participants || [], councilMembers)
            : []
          const consiglioInvitati = isConsiglioEvent
            ? sortNamesBySurname((selectedEvent.invited || []).filter((name) => name.trim() !== ''))
            : []
          const consiglioAssenti = isConsiglioEvent && absentMembers
            ? sortCouncilBySurnameWithPresidentFirst(
                absentMembers.map((name) => ({
                  name,
                  role: councilMembers.find((member) => member.name === name)?.role,
                }))
              ).map((member) => formatCouncilMemberLabel(member.name, councilMembers))
            : []
          const consiglioOrario =
            selectedEvent.start_time && selectedEvent.end_time
              ? `${selectedEvent.start_time.substring(0, 5)} – ${selectedEvent.end_time.substring(0, 5)}`
              : selectedEvent.start_time
                ? selectedEvent.start_time.substring(0, 5)
                : selectedEvent.event_time
                  ? selectedEvent.event_time.substring(0, 5)
                  : '—'
          const tournamentTeams = Array.from(
            new Set([
              ...(selectedEvent.opponents || []).filter((team) => team.trim() !== ''),
              ...gironi.flatMap((girone) => girone.teams.filter((team) => team.trim() !== '')),
            ])
          ).sort((a, b) => a.localeCompare(b, 'it'))
          const tournamentWinnerLabel =
            selectedEvent.event_type === 'torneo' ? 'Vincitore del torneo' : 'Vincitore'
          const currentTournamentWinner = selectedEvent.tournament_winner?.trim() || ''
          const consiglioOdgCount = selectedEvent.ordine_del_giorno?.length ?? 0
          const consiglioHasVerbale =
            getVerbaleStorageFiles(selectedEvent.verbale_pdf, selectedEvent.verbale_pdfs).length > 0
          const consiglioAgendaLabel = consiglioHasVerbale
            ? 'Ordine del Giorno / Verbale'
            : 'Ordine del giorno'
          const opponentName = selectedEvent.opponent?.trim() || (isPartita ? participants?.participants : '') || ''
          const partitaCategoryName = getPartitaCategoryName(selectedEvent)
          const clubTeamName = brandConfig.clubName?.trim() || brandConfig.clubShortName?.trim() || ''
          const ourTeamName = isPartita
            ? getOurPartitaTeamDisplayName(clubTeamName, partitaCategoryName)
            : selectedEvent.categories?.name?.trim() ||
              brandConfig.clubShortName ||
              brandConfig.clubName ||
              'La nostra squadra'
          const opponentTeamName = isPartita
            ? getOpponentPartitaTeamDisplayName(opponentName, partitaCategoryName)
            : opponentName
          const eventModalTitle = isPartita
            ? getPartitaEventDisplayTitle(selectedEvent, clubTeamName) || selectedEvent.title
            : selectedEvent.title
          const viewTitle =
            eventModalTab === 'overview'
              ? eventModalTitle
              : eventModalTab === 'groups'
                ? 'Vista gironi'
                : eventModalTab === 'formation'
                  ? 'Lista gara'
                  : eventModalTab === 'agenda'
                    ? consiglioAgendaLabel
                    : 'Vista squadre'

          const formationCount = eventFormationPlayers.length
          const navTabs: { id: EventModalTab; label: string; rightLabel: string }[] = [
            { id: 'overview', label: 'Panoramica', rightLabel: 'evento' },
            ...(isConsiglioEvent
              ? [{ id: 'agenda' as EventModalTab, label: consiglioAgendaLabel, rightLabel: String(consiglioOdgCount) }]
              : []),
            ...(isPartita
              ? [{ id: 'formation' as EventModalTab, label: 'Lista gara', rightLabel: String(formationCount) }]
              : []),
            ...(!isPartita && !isClubPartyEvent && !isConsiglioEvent ? [{ id: 'groups' as EventModalTab, label: 'Gironi', rightLabel: String(gironiCount) }] : []),
            ...(!isPartita && !isClubPartyEvent && !isConsiglioEvent ? [{ id: 'teams' as EventModalTab, label: 'Squadre', rightLabel: String(teamCount) }] : []),
          ]
          const modalBuiltMatchResult = buildMatchResultFromScores(
            modalMatchScoreOur,
            modalMatchScoreOpponent,
            selectedEvent.is_home
          )
          const modalMatchAnalysis = modalBuiltMatchResult
            ? analyzeMatchResult(modalBuiltMatchResult, selectedEvent.is_home)
            : null
          const homeTeamName = selectedEvent.is_home ? ourTeamName : opponentTeamName
          const awayTeamName = selectedEvent.is_home ? opponentTeamName : ourTeamName
          const homeTeamLogo = selectedEvent.is_home ? getClubLogoUrl() : logoForTeam(opponentName)
          const awayTeamLogo = selectedEvent.is_home ? logoForTeam(opponentName) : getClubLogoUrl()
          const modalHomeScore = selectedEvent.is_home ? modalMatchScoreOur : modalMatchScoreOpponent
          const modalAwayScore = selectedEvent.is_home ? modalMatchScoreOpponent : modalMatchScoreOur

          return (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
              <div
                className={`fixed inset-y-0 right-0 flex flex-col overflow-hidden shadow-2xl will-change-transform ${
                  eventModalEntered ? 'translate-x-0' : 'translate-x-full'
                }`}
                style={{
                  width: 'min(1380px, 100vw)',
                  borderTopLeftRadius: 28,
                  borderBottomLeftRadius: 28,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  background: '#F5F8FC',
                  transition: `transform ${EVENT_MODAL_SLIDE_MS}ms ${EVENT_MODAL_SLIDE_EASING}`,
                }}
              >
                {/* Header navy */}
                <div
                  className="shrink-0 px-5 sm:px-7 py-4 sm:py-5"
                  style={{ background: 'linear-gradient(135deg, #071226 0%, #102451 58%, #183A78 100%)' }}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-white/90">
                        {getEventModalHeaderBadge(selectedEvent)}
                      </span>
                      <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white truncate">
                        {eventModalTitle}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-stretch gap-2 sm:gap-3">
                      <div className="min-w-[108px] rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                        <div className="text-[10px] font-semibold tracking-[0.14em] text-white/55">DATA</div>
                        <div className="mt-0.5 text-sm font-semibold text-white">{formatEventHeaderDate(selectedEvent.event_date)}</div>
                        <div className="text-xs text-white/70">{getEventTimeRange(selectedEvent)}</div>
                      </div>
                      <div className="min-w-[108px] rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                        <div className="text-[10px] font-semibold tracking-[0.14em] text-white/55">
                          {selectedEvent.event_type === 'consiglio' ? 'SEDE' : 'LUOGO'}
                        </div>
                        <div className="mt-0.5 text-sm font-semibold text-white truncate max-w-[140px]">{locationName || '—'}</div>
                        {homeAwayLabel && <div className="text-xs text-white/70">{homeAwayLabel}</div>}
                      </div>
                      {!isPartita && !isClubPartyEvent && (
                        <div className="min-w-[108px] rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                          <div className="text-[10px] font-semibold tracking-[0.14em] text-white/55">FORMATO</div>
                          <div className="mt-0.5 text-sm font-semibold text-white">
                            {isMultiTeamEvent
                              ? `${teamCount} Squadre`
                              : participants
                                ? `${participants.count} Partecipanti`
                                : '—'}
                          </div>
                          {isMultiTeamEvent && gironiCount > 0 && (
                            <div className="text-xs text-white/70">{teamsPerGirone} /Teams per {gironiCount} gironi</div>
                          )}
                        </div>
                      )}
                      <AdaptiveLogo
                        src={getClubLogoUrl()}
                        alt={brandConfig.assets.logoAlt?.trim() || DEFAULT_BRAND_CONFIG.assets.logoAlt}
                        surface="dark"
                        className="h-[72px] w-[72px] shrink-0 rounded-2xl p-2"
                        onError={e => {
                          const img = e.currentTarget
                          if (img.src !== DEFAULT_BRAND_CONFIG.assets.logo) {
                            img.src = DEFAULT_BRAND_CONFIG.assets.logo
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Corpo */}
                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                  {/* Sidebar */}
                  <aside className="w-full shrink-0 border-b border-[#DBE5F0] bg-white/70 p-4 lg:w-[300px] lg:border-b-0 lg:border-r lg:overflow-y-auto">
                    <div className="text-[11px] font-semibold tracking-[0.14em] text-[#667085]">NAVIGAZIONE</div>
                    <div className="mt-2 space-y-2">
                      {navTabs.map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setEventModalTab(tab.id)}
                          className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-all ${
                            eventModalTab === tab.id
                              ? 'bg-[#071226] text-white shadow-md'
                              : 'bg-white text-[#071226] shadow-sm hover:shadow-md'
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className={eventModalTab === tab.id ? 'text-white/70 text-xs font-medium' : 'text-[#667085] text-xs font-medium'}>
                            {tab.rightLabel}
                          </span>
                        </button>
                      ))}
                    </div>

                    {isMultiTeamEvent && !isClubPartyEvent && (
                      <>
                        <div className="mt-6 text-[11px] font-semibold tracking-[0.14em] text-[#667085]">RICERCA RAPIDA</div>
                        <div className="relative mt-2">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
                          <input
                            type="text"
                            value={eventModalSearch}
                            onChange={e => setEventModalSearch(e.target.value)}
                            placeholder="Cerca squadra o girone..."
                            className="w-full rounded-2xl border border-[#DBE5F0] bg-white py-2.5 pl-10 pr-3 text-sm text-[#071226] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#2F6DF6]/30"
                          />
                        </div>

                        <div className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-[#667085]">SQUADRE TROVATE</div>
                        <div className="mt-2 space-y-2">
                          {!searchQuery && (
                            <p className="text-sm text-[#667085]">Digita per cercare una societa o un girone.</p>
                          )}
                          {searchQuery && matchingGironi.map(girone => (
                            <button
                              key={`girone-${girone.id}`}
                              type="button"
                              onClick={() => focusGironeInModal(girone.id)}
                              className="flex w-full items-center justify-between rounded-xl bg-[#F5F8FC] px-3 py-2 text-left text-sm hover:bg-[#EEF4FB]"
                            >
                              <span className="font-semibold text-[#071226]">{girone.name}</span>
                              <span className="text-xs text-[#667085]">{girone.teams.length} squadre</span>
                            </button>
                          ))}
                          {searchQuery && matchingTeams.map(item => (
                            <button
                              key={`${item.gironeId}-${item.team}`}
                              type="button"
                              onClick={() => focusGironeInModal(item.gironeId)}
                              className="flex w-full items-center justify-between rounded-xl bg-[#F5F8FC] px-3 py-2 text-left text-sm hover:bg-[#EEF4FB]"
                            >
                              <span className="font-bold uppercase text-[#071226]">{item.team}</span>
                              <span className="text-xs text-[#667085]">{item.gironeName}</span>
                            </button>
                          ))}
                          {searchQuery && matchingGironi.length === 0 && matchingTeams.length === 0 && (
                            <p className="text-sm text-[#667085]">Nessun risultato.</p>
                          )}
                        </div>
                      </>
                    )}
                  </aside>

                  {/* Contenuto principale */}
                  <main className={`min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5 ${isConsiglioEvent ? 'pt-7 sm:pt-8' : 'pt-4 sm:pt-5'}`}>
                    {eventModalTab !== 'formation' && (
                      <div className={`flex items-center justify-between gap-3 ${isConsiglioEvent ? 'mb-5' : 'mb-3'}`}>
                        <h3 className="text-lg sm:text-xl font-bold text-[#071226]">{viewTitle}</h3>
                        <div className="flex shrink-0 items-center gap-2">
                          {isMultiTeamEvent && !isClubPartyEvent && (eventModalTab === 'overview' || eventModalTab === 'teams') && (
                            <span className="rounded-full bg-[#D9EBFF] px-3 py-1 text-xs font-semibold text-[#2F6DF6]">
                              {`${teamCount} squadre`}
                            </span>
                          )}
                          {eventModalTab === 'agenda' && isConsiglioEvent && (
                            <button
                              type="button"
                              onClick={openModalNewOdgInput}
                              disabled={savingModalOdg}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2F6DF6] text-2xl font-bold leading-none text-white shadow-sm transition-colors hover:bg-[#255fe0] disabled:opacity-60"
                              title="Aggiungi punto all'ordine del giorno"
                              aria-label="Aggiungi punto all'ordine del giorno"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {eventModalTab === 'overview' && isMultiTeamEvent && !isClubPartyEvent && (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          {[
                            { time: '09:30', label: 'Accoglienza squadre e briefing staff' },
                            { time: startTimeDisplay, label: 'Inizio attivita in campo' },
                            { time: endTimeDisplay, label: 'Fine attivita' },
                          ].map(item => (
                            <div key={item.label} className="flex items-start gap-4">
                              <span className="w-12 shrink-0 text-sm font-bold text-[#071226]">{item.time}</span>
                              <span className="text-sm text-[#667085]">{item.label}</span>
                            </div>
                          ))}
                        </div>

                        {gironi.length > 0 && (
                          <div>
                            <h4 className="mb-3 text-sm font-semibold text-[#071226]">Anteprima gironi</h4>
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                              {gironi.map((girone, index) => {
                                const accent = getGironeAccentColor(index)
                                return (
                                  <button
                                    key={girone.id}
                                    type="button"
                                    onClick={() => focusGironeInModal(girone.id)}
                                    className="rounded-2xl bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                                    style={{ borderLeft: `4px solid ${accent}` }}
                                  >
                                    <div className="font-semibold text-[#071226]">{girone.name}</div>
                                    <div className="mt-1 text-sm text-[#667085]">{girone.teams.length} squadre</div>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {selectedEvent.expects_tournament_winner && tournamentTeams.length > 0 && (
                          currentTournamentWinner ? (
                            <div className="flex justify-center py-2">
                              <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-300/50 bg-gradient-to-b from-amber-100/90 via-white to-amber-50 shadow-[0_8px_32px_rgba(245,158,11,0.18)]">
                                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
                                <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />
                                <div className="pointer-events-none absolute -bottom-10 -right-6 h-36 w-36 rounded-full bg-yellow-200/30 blur-2xl" />

                                <button
                                  type="button"
                                  disabled={savingTournamentWinner}
                                  onClick={() => { void persistTournamentWinner(null) }}
                                  className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#94A3B8] shadow-sm ring-1 ring-amber-200/80 backdrop-blur-sm transition-all hover:scale-105 hover:bg-red-50 hover:text-red-600 hover:ring-red-200 disabled:opacity-60"
                                  title="Rimuovi vincitore"
                                  aria-label="Rimuovi vincitore"
                                >
                                  <X className="h-4 w-4" />
                                </button>

                                <div className="relative flex flex-col items-center px-8 pb-8 pt-7 text-center">
                                  <div className="mb-5 flex items-center gap-2">
                                    <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-400/70" />
                                    <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
                                    <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-800">
                                      {tournamentWinnerLabel}
                                    </span>
                                    <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
                                    <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-400/70" />
                                  </div>

                                  <div className="relative mb-5">
                                    <div className="absolute inset-0 scale-125 rounded-full bg-amber-300/25 blur-xl" />
                                    <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-lg ring-2 ring-amber-300/60">
                                      {logoForTeam(currentTournamentWinner) ? (
                                        <HoverZoomTeamLogo
                                          src={logoForTeam(currentTournamentWinner)!}
                                          alt={`Logo ${currentTournamentWinner}`}
                                          className="h-14 w-14 rounded-lg"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600">
                                          <Trophy className="h-9 w-9" />
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-600/90">
                                    Campione
                                  </p>
                                  <h3 className="mt-1 max-w-full truncate text-2xl font-extrabold uppercase tracking-wide text-[#071226]">
                                    {currentTournamentWinner}
                                  </h3>
                                  <div className="mt-4 h-0.5 w-20 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                                </div>
                              </div>
                            </div>
                          ) : (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
                            <div className="flex items-center gap-2">
                              <Trophy className="h-5 w-5 shrink-0 text-amber-600" />
                              <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-900">
                                {tournamentWinnerLabel}
                              </h4>
                            </div>
                            <p className="mt-1 text-sm text-[#667085]">Seleziona la squadra vincitrice.</p>
                            <div className="mt-4 flex flex-wrap items-stretch justify-center gap-2 sm:justify-start">
                              <select
                                value={tournamentWinnerDraft}
                                onChange={(e) => setTournamentWinnerDraft(e.target.value)}
                                className="min-w-[200px] flex-1 rounded-xl border border-[#DBE5F0] bg-white px-3 py-2.5 text-sm font-medium text-[#071226] focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                              >
                                <option value="">Seleziona squadra vincitrice</option>
                                {tournamentTeams.map((team) => (
                                  <option key={team} value={team}>{team}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!tournamentWinnerDraft.trim() || savingTournamentWinner}
                                onClick={() => { void persistTournamentWinner(tournamentWinnerDraft) }}
                                className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                              >
                                {savingTournamentWinner ? 'Salvataggio...' : 'Aggiungi'}
                              </button>
                            </div>
                          </div>
                          )
                        )}
                      </div>
                    )}

                    {eventModalTab === 'overview' && isPartita && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-start gap-4">
                            <span className="w-12 shrink-0 text-sm font-bold text-[#071226]">{startTimeDisplay}</span>
                            <span className="text-sm text-[#667085]">Inizio partita</span>
                          </div>
                          <div className="flex items-start gap-4">
                            <span className="w-12 shrink-0 text-sm font-bold text-[#071226]">{endTimeDisplay}</span>
                            <span className="text-sm text-[#667085]">Fine partita</span>
                          </div>
                        </div>

                        <PartitaResultBand
                          analysis={modalMatchAnalysis}
                          homeTeamName={homeTeamName}
                          awayTeamName={awayTeamName}
                          homeLogo={homeTeamLogo}
                          awayLogo={awayTeamLogo}
                          homeScore={modalHomeScore}
                          awayScore={modalAwayScore}
                          editable
                          onHomeScoreChange={value =>
                            handleModalMatchScoreChange(selectedEvent.is_home ? 'our' : 'opponent', value)
                          }
                          onAwayScoreChange={value =>
                            handleModalMatchScoreChange(selectedEvent.is_home ? 'opponent' : 'our', value)
                          }
                        />

                        {savingModalMatchResult && (
                          <p className="text-center text-sm text-[#667085]">Salvataggio risultato...</p>
                        )}

                        {selectedEvent.description && (
                          <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                            <h4 className="text-sm font-semibold text-[#071226]">Descrizione</h4>
                            <p className="mt-1 text-sm text-[#667085]">{selectedEvent.description}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {eventModalTab === 'formation' && isPartita && (
                      <div className="space-y-4">
                        {loadingEventFormation ? (
                          <p className="text-sm text-[#667085]">Caricamento lista gara...</p>
                        ) : eventFormationPlayers.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[#DBE5F0] bg-white p-8 text-center">
                            <Users className="mx-auto mb-3 h-10 w-10 text-[#94A3B8]" />
                            <h4 className="text-base font-semibold text-[#071226]">Nessun convocato</h4>
                            <p className="mt-2 text-sm text-[#667085]">
                              {canManageFormation
                                ? 'Crea la lista gara per questa partita per inserire i convocati.'
                                : 'La lista gara non è ancora stata pubblicata per questa partita.'}
                            </p>
                            {canManageFormation && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingEventMatchList(eventMatchList)
                                  setShowEventMatchListModal(true)
                                }}
                                className="mt-4 rounded-2xl bg-[#071226] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#102451]"
                              >
                                Crea
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#DBE5F0] bg-white px-4 py-3">
                              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                                  Lista gara
                                </span>
                                {eventMatchList?.name && (
                                  <span className="truncate text-sm font-semibold text-[#071226]">
                                    {eventMatchList.name}
                                  </span>
                                )}
                              </div>
                              {canManageFormation && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEventMatchList(eventMatchList)
                                    setShowEventMatchListModal(true)
                                  }}
                                  className="shrink-0 rounded-2xl bg-[#071226] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#102451]"
                                >
                                  Modifica
                                </button>
                              )}
                            </div>

                            {(() => {
                              const formationStarters = eventFormationPlayers.filter(player => player.number <= 15)
                              const formationBench = eventFormationPlayers.filter(player => player.number > 15)

                              const renderPlayerCard = (player: FormationPlayerDetail) => (
                                <div
                                  key={player.player_id}
                                  className="flex items-center gap-3 rounded-2xl border border-[#DBE5F0] bg-white p-4 shadow-sm"
                                >
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#071226] text-sm font-bold text-white">
                                    {player.number}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-[#071226]">{formatDisplayPersonName(player.name)}</div>
                                    <div className="text-sm text-[#667085]">{player.role}</div>
                                  </div>
                                </div>
                              )

                              return (
                                <>
                                  {formationStarters.length > 0 && (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                      {formationStarters.map(renderPlayerCard)}
                                    </div>
                                  )}

                                  {formationStarters.length > 0 && formationBench.length > 0 && (
                                    <div className="flex justify-start py-1">
                                      <span className="text-sm font-semibold uppercase tracking-[0.12em] text-[#667085]">
                                        A disposizione
                                      </span>
                                    </div>
                                  )}

                                  {formationBench.length > 0 && (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                      {formationBench.map(renderPlayerCard)}
                                    </div>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {eventModalTab === 'overview' && isClubPartyEvent && (
                      <div className="space-y-6">
                        <div className="overflow-hidden rounded-3xl border border-[#DBE5F0] bg-white shadow-sm">
                          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                            <div className="border-b border-[#DBE5F0] p-6 sm:border-b-0 sm:border-r sm:p-8">
                              <div className="text-[11px] font-semibold tracking-[0.16em] text-[#071226]">DATA INIZIO FESTA</div>
                              <div className="mt-3 text-2xl font-bold text-[#071226] sm:text-3xl">
                                {formatEventHeaderDate(selectedEvent.event_date)}
                              </div>
                              <div className="mt-2 text-base font-medium text-[#071226]">
                                {formatDate(selectedEvent.event_date)}
                              </div>
                            </div>
                            <div className="p-6 sm:p-8">
                              <div className="text-[11px] font-semibold tracking-[0.16em] text-[#071226]">DATA FINE FESTA</div>
                              <div className="mt-3 text-2xl font-bold text-[#071226] sm:text-3xl">
                                {formatEventHeaderDate(clubPartyEndDate)}
                              </div>
                              <div className="mt-2 text-base font-medium text-[#071226]">
                                {formatDate(clubPartyEndDate)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {locationName && (
                          <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                            <h4 className="text-sm font-semibold text-[#071226]">Luogo</h4>
                            <p className="mt-1 text-base font-medium text-[#667085]">
                              {locationName}
                              {homeAwayLabel ? ` · ${homeAwayLabel}` : ''}
                            </p>
                          </div>
                        )}

                        {selectedEvent.description && (
                          <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                            <h4 className="text-sm font-semibold text-[#071226]">Descrizione</h4>
                            <p className="mt-1 text-sm text-[#667085]">{selectedEvent.description}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {eventModalTab === 'overview' && isConsiglioEvent && (
                      <div className="space-y-6">
                        <div className="overflow-hidden rounded-3xl border border-[#DBE5F0] bg-white shadow-sm">
                          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                            <div className="border-b border-[#DBE5F0] p-6 sm:border-b-0 sm:border-r sm:p-8">
                              <div className="text-[11px] font-semibold tracking-[0.16em] text-[#071226]">DATA CONSIGLIO</div>
                              <div className="mt-3 text-2xl font-bold text-[#071226] sm:text-3xl">
                                {formatEventHeaderDate(selectedEvent.event_date)}
                              </div>
                              <div className="mt-2 text-base font-medium text-[#071226]">
                                {formatDate(selectedEvent.event_date)}
                              </div>
                            </div>
                            <div className="p-6 sm:p-8">
                              <div className="text-[11px] font-semibold tracking-[0.16em] text-[#071226]">ORARIO</div>
                              <div className="mt-3 text-2xl font-bold text-[#071226] tabular-nums sm:text-3xl">
                                {consiglioOrario}
                              </div>
                              {locationName && (
                                <div className="mt-2 text-base font-medium text-[#071226]">
                                  Sede: {locationName}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {consiglioPresenti.length > 0 && (
                          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5">
                            <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-900">
                              Partecipanti ({consiglioPresenti.length})
                            </h4>
                            <div className="mt-3 grid grid-cols-4 gap-2">
                              {consiglioPresenti.map((name) => (
                                <div
                                  key={name}
                                  className="truncate rounded-xl border border-blue-100 bg-white px-3 py-2 text-center text-[19px] font-medium text-blue-900 shadow-sm"
                                  title={formatCouncilMemberLabel(name, councilMembers)}
                                >
                                  {formatCouncilMemberLabel(name, councilMembers)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {consiglioInvitati.length > 0 && (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
                            <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-900">
                              Invitati ({consiglioInvitati.length})
                            </h4>
                            <div className="mt-3 grid grid-cols-4 gap-2">
                              {consiglioInvitati.map((name) => (
                                <div
                                  key={name}
                                  className="truncate rounded-xl border border-emerald-100 bg-white px-3 py-2 text-center text-[19px] font-medium text-emerald-900 shadow-sm"
                                  title={name}
                                >
                                  {name}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {consiglioAssenti.length > 0 && (
                          <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 sm:p-5">
                            <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-red-900">
                              Assenti ({consiglioAssenti.length})
                            </h4>
                            <div className="mt-3 grid grid-cols-4 gap-2">
                              {consiglioAssenti.map((name) => (
                                <div
                                  key={name}
                                  className="truncate rounded-xl border border-red-100 bg-white px-3 py-2 text-center text-[19px] font-medium text-red-800 shadow-sm"
                                  title={name}
                                >
                                  {name}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedEvent.description && (
                          <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                            <h4 className="text-sm font-semibold text-[#071226]">Descrizione</h4>
                            <p className="mt-1 text-sm text-[#667085]">{selectedEvent.description}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {eventModalTab === 'agenda' && isConsiglioEvent && (
                      <div className="space-y-6">
                        {showModalNewOdgInput && (
                          <div className="flex items-stretch gap-2">
                            <input
                              ref={modalNewOdgInputRef}
                              type="text"
                              value={modalNewOdgValue}
                              onChange={(e) => setModalNewOdgValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void addModalOrdineDelGiorno()
                                }
                                if (e.key === 'Escape') cancelModalNewOdgInput()
                              }}
                              disabled={savingModalOdg}
                              placeholder="Scrivi un nuovo punto ordine del giorno..."
                              className="min-w-0 flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-[17px] font-medium text-[#071226] focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:opacity-60"
                            />
                            <button
                              type="button"
                              onClick={() => { void addModalOrdineDelGiorno() }}
                              disabled={savingModalOdg || !modalNewOdgValue.trim()}
                              className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                            >
                              {savingModalOdg ? 'Salvataggio...' : 'Aggiungi'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelModalNewOdgInput}
                              disabled={savingModalOdg}
                              className="rounded-xl px-3 py-2.5 text-sm font-medium text-[#667085] hover:bg-amber-100 disabled:opacity-60"
                            >
                              Annulla
                            </button>
                          </div>
                        )}
                        {selectedEvent.ordine_del_giorno && selectedEvent.ordine_del_giorno.length > 0 ? (
                          <DndContext sensors={odgSensors} collisionDetection={closestCenter} onDragEnd={handleModalOdgDragEnd}>
                            <SortableContext
                              items={selectedEvent.ordine_del_giorno.map((_, i) => `modal-odg-${i}`)}
                              strategy={rectSortingStrategy}
                            >
                              <ol className="space-y-2">
                                {selectedEvent.ordine_del_giorno.map((point, index) => (
                                  <SortableModalOdgItem
                                    key={`modal-odg-${index}`}
                                    id={`modal-odg-${index}`}
                                    point={point}
                                    index={index}
                                    saving={savingModalOdg}
                                    onRemove={() => { void removeModalOrdineDelGiorno(index) }}
                                    onStartEdit={() => {
                                      setModalEditingOdgIndex(index)
                                      setModalEditingOdgValue(point)
                                    }}
                                    isEditing={modalEditingOdgIndex === index}
                                    editValue={modalEditingOdgIndex === index ? modalEditingOdgValue : ''}
                                    onEditValueChange={setModalEditingOdgValue}
                                    onSaveEdit={() => { void saveModalOrdineDelGiornoEdit(index) }}
                                    onCancelEdit={() => {
                                      setModalEditingOdgIndex(null)
                                      setModalEditingOdgValue('')
                                    }}
                                    isClosurePoint={isOdgClosurePoint(point)}
                                  />
                                ))}
                              </ol>
                            </SortableContext>
                          </DndContext>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 p-8 text-center">
                            <p className="text-sm font-medium text-amber-900">Nessun punto nell&apos;ordine del giorno.</p>
                          </div>
                        )}

                        {(() => {
                          const verbaleDocs = parseVerbaleDocs(selectedEvent.verbale_pdfs)
                          if (selectedEvent.verbale_pdf?.trim()) {
                            const single = parseVerbaleDoc(selectedEvent.verbale_pdf)
                            if (single.file && !verbaleDocs.some((d) => d.file === single.file)) {
                              verbaleDocs.unshift(single)
                            }
                          }
                          return (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 shadow-sm">
                              <div className="flex items-center gap-3 border-b border-slate-200/80 px-5 py-4">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0b1f4d] text-white shadow-sm">
                                  <FileText className="h-5 w-5" strokeWidth={2} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm font-bold uppercase tracking-[0.12em] text-[#0b1f4d]">
                                    Verbale
                                  </h4>
                                  <p className="mt-0.5 text-xs text-[#667085]">
                                    {verbaleDocs.length === 0
                                      ? 'Nessun documento caricato'
                                      : verbaleDocs.length === 1
                                        ? '1 documento disponibile'
                                        : `${verbaleDocs.length} documenti disponibili`}
                                  </p>
                                </div>
                              </div>
                              <div className="p-4 sm:p-5">
                                {verbaleDocs.length > 0 ? (
                                  <div className="space-y-2.5">
                                    {verbaleDocs.map((doc) => (
                                      <div
                                        key={doc.file}
                                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                                      >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E9F0FF] text-[#2F6DF6]">
                                          <FileText className="h-5 w-5" strokeWidth={2} />
                                        </div>
                                        {editingVerbaleFile === doc.file ? (
                                          <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <input
                                              type="text"
                                              value={editingVerbaleLabel}
                                              onChange={(e) => setEditingVerbaleLabel(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault()
                                                  void saveVerbaleLabel(doc.file, selectedEvent.id)
                                                }
                                                if (e.key === 'Escape') cancelEditVerbaleLabel()
                                              }}
                                              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-[#071226] focus:outline-none focus:ring-2 focus:ring-[#2F6DF6]/30"
                                              autoFocus
                                            />
                                            <button
                                              type="button"
                                              disabled={savingVerbaleLabel}
                                              onClick={() => { void saveVerbaleLabel(doc.file, selectedEvent.id) }}
                                              className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                                            >
                                              Salva
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelEditVerbaleLabel}
                                              className="rounded-lg px-2 py-1.5 text-xs font-medium text-[#667085] hover:bg-slate-100"
                                            >
                                              Annulla
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenPDF(doc.file)}
                                              className="min-w-0 flex-1 text-left"
                                            >
                                              <p className="truncate text-sm font-semibold text-[#071226]">
                                                {doc.label}
                                              </p>
                                              <p className="truncate text-xs text-[#94A3B8]">PDF del consiglio</p>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => startEditVerbaleLabel(doc)}
                                              className="rounded-lg p-2 text-[#667085] hover:bg-slate-100 hover:text-[#2F6DF6]"
                                              title="Modifica nome"
                                            >
                                              <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenPDF(doc.file)}
                                              className="shrink-0 rounded-lg bg-[#0b1f4d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#132a5c]"
                                            >
                                              Apri
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center">
                                    <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" strokeWidth={1.5} />
                                    <p className="text-sm font-medium text-[#667085]">
                                      Nessun verbale caricato per questo consiglio
                                    </p>
                                    <p className="mt-1 text-xs text-[#94A3B8]">
                                      Caricalo dalla modifica dell&apos;evento
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {eventModalTab === 'overview' && !isMultiTeamEvent && !isPartita && !isClubPartyEvent && !isConsiglioEvent && (
                      <div className="space-y-4">
                        {participants && (
                          <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                            <h4 className="text-sm font-semibold text-[#071226]">
                              {selectedEvent.event_type === 'incontro_staff'
                                ? (isStaffMeetingAllPresent(selectedEvent)
                                    ? 'Tutti Presenti'
                                    : `Presenti (${participants.count})`)
                                : `Partecipanti (${participants.count})`}
                            </h4>
                            <p className="mt-1 text-sm text-[#667085]">{participants.participants}</p>
                          </div>
                        )}
                        {invited && (
                          <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                            <h4 className="text-sm font-semibold text-[#071226]">Invitati ({invited.count})</h4>
                            <p className="mt-1 text-sm text-[#667085]">{invited.invited}</p>
                          </div>
                        )}
                        {selectedEvent.event_type === 'consiglio' && selectedEvent.ordine_del_giorno && selectedEvent.ordine_del_giorno.length > 0 && (
                          <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                            <h4 className="text-sm font-semibold text-[#071226]">Ordine del giorno</h4>
                            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#667085]">
                              {selectedEvent.ordine_del_giorno.map((point, index) => (
                                <li key={index}>{point}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {selectedEvent.event_type === 'incontro_staff' &&
                          selectedEvent.ordine_del_giorno &&
                          selectedEvent.ordine_del_giorno.length > 0 && (
                          <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                            <h4 className="text-sm font-semibold text-[#071226]">Ordine del giorno</h4>
                            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#667085]">
                              {selectedEvent.ordine_del_giorno.map((point, index) => (
                                <li key={index}>{point}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {absentMembers && (
                          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                            <h4 className="text-sm font-semibold text-red-800">Assenti</h4>
                            <p className="mt-1 text-sm text-red-700">{absentMembers.join(', ')}</p>
                          </div>
                        )}
                        {selectedEvent.event_type === 'consiglio' && (() => {
                          const verbaleDocs = parseVerbaleDocs(selectedEvent.verbale_pdfs)
                          if (selectedEvent.verbale_pdf?.trim()) {
                            const single = parseVerbaleDoc(selectedEvent.verbale_pdf)
                            if (single.file && !verbaleDocs.some((d) => d.file === single.file)) {
                              verbaleDocs.unshift(single)
                            }
                          }
                          if (verbaleDocs.length === 0) return null
                          return (
                            <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                              <h4 className="text-sm font-semibold text-[#071226]">Verbale</h4>
                              <div className="mt-2 space-y-2">
                                {verbaleDocs.map((doc) => (
                                  <button
                                    key={doc.file}
                                    type="button"
                                    onClick={() => handleOpenPDF(doc.file)}
                                    className="flex w-full items-center gap-2 text-left text-sm font-medium text-[#2F6DF6] hover:underline"
                                  >
                                    <FileText className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{doc.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                        {selectedEvent.event_type === 'incontro_staff' && (() => {
                          const allegatiDocs = parseVerbaleDocs(selectedEvent.verbale_pdfs)
                          if (allegatiDocs.length === 0) return null
                          return (
                            <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                              <h4 className="text-sm font-semibold text-[#071226]">Allegati</h4>
                              <div className="mt-2 space-y-2">
                                {allegatiDocs.map((doc) => (
                                  <button
                                    key={doc.file}
                                    type="button"
                                    onClick={() => handleOpenPDF(doc.file)}
                                    className="flex w-full items-center gap-2 text-left text-sm font-medium text-[#2F6DF6] hover:underline"
                                  >
                                    <FileText className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{doc.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                        {selectedEvent.description && (
                          <div className="rounded-2xl border border-[#DBE5F0] bg-white p-4">
                            <h4 className="text-sm font-semibold text-[#071226]">Descrizione</h4>
                            <p className="mt-1 text-sm text-[#667085]">{selectedEvent.description}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {eventModalTab === 'groups' && !isPartita && (
                      <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
                        {gironi.map((girone, index) => {
                          const accent = getGironeAccentColor(index)
                          const isHighlighted = highlightedGironeId === girone.id
                          return (
                            <div
                              key={girone.id}
                              className="overflow-hidden rounded-2xl bg-white shadow-sm"
                              style={{
                                border: `2px solid ${accent}`,
                                boxShadow: isHighlighted ? `0 0 0 2px #F5F8FC, 0 0 0 4px ${accent}` : undefined,
                              }}
                            >
                              <div className="flex items-center justify-between bg-[#071226] px-4 py-2.5">
                                <span className="text-sm font-semibold text-white">{girone.name}</span>
                                <span className="text-xs text-white/70">{girone.teams.length} squadre</span>
                              </div>
                              <div style={{ height: 4, backgroundColor: accent }} />
                              <div className="space-y-2 p-3">
                                {girone.teams.map(team => {
                                  const teamLogo = logoForTeam(team)
                                  return (
                                    <div key={team} className="flex h-12 items-center justify-between gap-2 rounded-xl bg-[#F5F8FC] px-3">
                                      <span className="min-w-0 flex-1 text-sm font-bold uppercase text-[#071226]">{team}</span>
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                                        {teamLogo && (
                                          <HoverZoomTeamLogo
                                            src={teamLogo}
                                            alt={`Logo ${team}`}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                                {girone.teams.length === 0 && (
                                  <p className="px-1 text-sm text-[#667085]">Nessuna squadra</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {gironi.length === 0 && (
                          <p className="text-sm text-[#667085]">Nessun girone configurato.</p>
                        )}
                      </div>
                    )}

                    {eventModalTab === 'teams' && !isPartita && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {allTeams.map(item => {
                          const gironeIndex = gironi.findIndex(g => g.id === item.gironeId)
                          const accent = getGironeAccentColor(gironeIndex >= 0 ? gironeIndex : 0)
                          const teamLogo = logoForTeam(item.team)
                          return (
                            <button
                              key={`${item.gironeId}-${item.team}`}
                              type="button"
                              onClick={() => focusGironeInModal(item.gironeId)}
                              className="rounded-2xl border border-[#DBE5F0] bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                            >
                              <div className="flex min-h-[5.5rem] items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold uppercase text-[#071226]">{item.team}</div>
                                  <span
                                    className="mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: `${accent}22`, color: accent }}
                                  >
                                    {item.gironeName}
                                  </span>
                                </div>
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                                  {teamLogo && (
                                    <HoverZoomTeamLogo
                                      src={teamLogo}
                                      alt={`Logo ${item.team}`}
                                      className="h-12 w-12 shrink-0 rounded-lg p-0.5 ring-1 ring-slate-200"
                                    />
                                  )}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                        {allTeams.length === 0 && (
                          <p className="text-sm text-[#667085]">Nessuna squadra configurata.</p>
                        )}
                      </div>
                    )}
                  </main>
                </div>

                {/* Footer azioni */}
                <div className="shrink-0 border-t border-[#DBE5F0] bg-white px-4 py-3 sm:px-5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                    {selectedEvent.event_type !== 'consiglio' && !isClubPartyEvent && (
                      <button
                        type="button"
                        onClick={() => {
                          const staffPresenti =
                            selectedEvent.event_type === 'incontro_staff'
                              ? sortNamesBySurname(
                                  (selectedEvent.participants || []).filter((n) => n.trim()),
                                )
                              : undefined
                          const staffAssenti =
                            selectedEvent.event_type === 'incontro_staff'
                              ? getAbsentCouncilMembers(selectedEvent) ?? undefined
                              : undefined
                          generateEventPresentationPdf({
                            title: selectedEvent.title,
                            event_date: selectedEvent.event_date,
                            start_time: selectedEvent.start_time,
                            end_time: selectedEvent.end_time,
                            event_time: selectedEvent.event_time,
                            event_type: selectedEvent.event_type,
                            location: selectedEvent.location,
                            away_location: selectedEvent.away_location,
                            is_home: selectedEvent.is_home,
                            opponent: selectedEvent.opponent,
                            opponents: selectedEvent.event_type === 'partita' && selectedEvent.opponent
                              ? [selectedEvent.opponent]
                              : selectedEvent.opponents,
                            gironi: selectedEvent.gironi,
                            categories: selectedEvent.categories,
                            event_id: selectedEvent.id,
                            is_championship: selectedEvent.is_championship,
                            is_friendly: selectedEvent.is_friendly,
                            matchList: eventFormationPlayers.length > 0
                              ? {
                                  name: eventMatchList?.name ?? null,
                                  players: eventFormationPlayers.map(player => ({
                                    number: player.number,
                                    name: player.name,
                                    role: player.role,
                                  })),
                                }
                              : undefined,
                            description: selectedEvent.description,
                            presenti: staffPresenti,
                            assenti: staffAssenti,
                            ordine_del_giorno:
                              selectedEvent.event_type === 'incontro_staff'
                                ? selectedEvent.ordine_del_giorno
                                : undefined,
                            allegati:
                              selectedEvent.event_type === 'incontro_staff'
                                ? parseVerbaleDocs(selectedEvent.verbale_pdfs).map((d) => d.label)
                                : undefined,
                            tuttiPresenti:
                              selectedEvent.event_type === 'incontro_staff'
                                ? isStaffMeetingAllPresent(selectedEvent)
                                : undefined,
                          })
                        }}
                        className="flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#10B7A6] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0ea697]"
                      >
                        <FileDown className="h-4 w-4 shrink-0" /> PDF
                      </button>
                    )}
                    {selectedEvent.event_type === 'consiglio' && (
                      <button
                        type="button"
                        onClick={() => {
                          generateCouncilResocontoPdf({
                            title: selectedEvent.title,
                            event_date: selectedEvent.event_date,
                            start_time: selectedEvent.start_time,
                            end_time: selectedEvent.end_time,
                            location: selectedEvent.location,
                            away_location: selectedEvent.away_location,
                            participants: selectedEvent.participants,
                            invited: selectedEvent.invited,
                            absent: getAbsentCouncilMembers(selectedEvent) ?? undefined,
                            ordine_del_giorno: selectedEvent.ordine_del_giorno,
                            councilMembers,
                          })
                        }}
                        className="flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#10B7A6] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0ea697]"
                      >
                        <FileDown className="h-4 w-4 shrink-0" /> PDF
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const eventToEdit = selectedEvent
                        handleCloseEventModal(() => {
                          if (eventToEdit) handleEditEvent(eventToEdit, { insideEventModal: true })
                        }, false)
                      }}
                      className="flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#2F6DF6] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#255fe0]"
                    >
                      <Pencil className="h-4 w-4 shrink-0" /> Modifica
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleRequestDeleteEvent(selectedEvent.id) }}
                      className="flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#8B1E3F] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#761a36]"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" /> Elimina
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCloseEventModal()}
                      className="flex min-w-0 items-center justify-center gap-2 rounded-2xl border-2 border-[#071226] bg-white px-4 py-3 text-sm font-semibold text-[#071226] transition-colors hover:bg-[#071226]/5"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}


        {/* Tag Eventi / Archiviate + filtri + elenco: nascosti durante creazione o modifica evento */}
        {!showCreateForm && !editingEvent && (
        <>
        <div
          className="mb-3 overflow-hidden rounded-xl border"
          style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
        >
          <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b" style={{ borderColor: GOLEE.border }}>
            <div className="inline-flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
              <button
                onClick={() => setEventsTab('eventi')}
                className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors focus:outline-none ${
                  eventsTab === 'eventi'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-[#8A94A6] hover:text-[#1F2933]'
                }`}
              >
                Eventi
              </button>
              <button
                onClick={() => setEventsTab('archivio')}
                className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors focus:outline-none ${
                  eventsTab === 'archivio'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-[#8A94A6] hover:text-[#1F2933]'
                }`}
              >
                Archiviate
              </button>
            </div>

            <div className="ml-auto inline-flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}>
              <button
                type="button"
                onClick={() => setEventsViewMode('list')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                  eventsViewMode === 'list'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-[#8A94A6]'
                }`}
                title="Vista Timeline"
              >
                <LayoutList className={`w-4 h-4 ${eventsViewMode === 'list' ? 'text-white' : ''}`} />
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setEventsViewMode('calendar')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                  eventsViewMode === 'calendar'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-[#8A94A6]'
                }`}
                title="Vista Mese"
              >
                <CalendarDays className={`w-4 h-4 ${eventsViewMode === 'calendar' ? 'text-white' : ''}`} />
                Mese
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 px-3 py-2.5">
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: GOLEE.textMuted }}>Data</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={filterInputClass}
                style={filterInputStyle}
              />
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: GOLEE.textMuted }}>Tipo</label>
              <select
                value={filterEventType}
                onChange={(e) => setFilterEventType(e.target.value)}
                className={filterInputClass}
                style={filterInputStyle}
              >
                <option value="">Tutti</option>
                {activeEventTypes.map((type) => (
                  <option key={type.code} value={type.code}>{type.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: GOLEE.textMuted }}>Categoria</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={filterInputClass}
                style={filterInputStyle}
              >
                <option value="">Tutte</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px] flex-[1.4]">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: GOLEE.textMuted }}>Cerca</label>
              <input
                type="text"
                placeholder="Parola chiave..."
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                className={filterInputClass}
                style={filterInputStyle}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setFilterDate('')
                setFilterEventType('')
                setFilterCategory('')
                setFilterKeyword('')
              }}
              className={`mb-[1px] h-[34px] shrink-0 rounded-md px-3 text-[12px] font-semibold transition-colors ${
                filterDate || filterEventType || filterCategory || filterKeyword.trim()
                  ? 'bg-brand-primary text-white hover:opacity-90'
                  : ''
              }`}
              style={
                filterDate || filterEventType || filterCategory || filterKeyword.trim()
                  ? undefined
                  : { color: GOLEE.textMuted, backgroundColor: GOLEE.surfaceMuted }
              }
              title={
                filterDate || filterEventType || filterCategory || filterKeyword.trim()
                  ? 'Filtri attivi — clicca per azzerare'
                  : 'Nessun filtro attivo'
              }
            >
              Reset
            </button>
          </div>
        </div>

        {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLEE.accent }} />
              <p className="text-sm" style={{ color: GOLEE.textMuted }}>Caricamento eventi...</p>
            </div>
        ) : events.length === 0 ? (
            <div
              className="rounded-xl border py-14 text-center"
              style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
            >
              <CalendarDays className="w-9 h-9 mx-auto mb-2" style={{ color: GOLEE.textMuted }} />
              <p className="font-medium text-sm" style={{ color: GOLEE.text }}>Nessun evento</p>
              <p className="text-xs mt-1" style={{ color: GOLEE.textMuted }}>Crea il primo evento per iniziare</p>
            </div>
        ) : filterEvents(events).length === 0 ? (
            <div
              className="rounded-xl border py-14 text-center"
              style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
            >
              <Search className="w-9 h-9 mx-auto mb-2" style={{ color: GOLEE.textMuted }} />
              <p className="font-medium text-sm" style={{ color: GOLEE.text }}>
                {eventsTab === 'eventi' ? 'Nessun evento da disputare' : 'Nessun evento in archivio'}
              </p>
              <p className="text-xs mt-1" style={{ color: GOLEE.textMuted }}>Prova a modificare i filtri o cambia tab</p>
            </div>
          ) : eventsViewMode === 'calendar' ? (
            (() => {
              const filtered = filterEvents(events)
              const cells = buildMonthCells(calendarMonth)
              const monthLabel = calendarMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
              const todayStr = new Date().toISOString().slice(0, 10)
              return (
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
                >
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-3 border-b"
                    style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
                  >
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      className="p-1.5 rounded-md transition-colors hover:bg-white"
                      style={{ color: GOLEE.textMuted }}
                      aria-label="Mese precedente"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="text-center min-w-0">
                      <h3 className="text-sm font-bold capitalize truncate" style={{ color: GOLEE.text }}>
                        {monthLabel}
                      </h3>
                      <p className="text-[11px] mt-0.5" style={{ color: GOLEE.textMuted }}>
                        {filtered.length} eventi in {eventsTab === 'eventi' ? 'programma' : 'archivio'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const t = new Date()
                          t.setDate(1)
                          t.setHours(0, 0, 0, 0)
                          setCalendarMonth(t)
                        }}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors"
                        style={{ backgroundColor: GOLEE.accentSoft, color: GOLEE.accent }}
                      >
                        Oggi
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                        className="p-1.5 rounded-md transition-colors hover:bg-white"
                        style={{ color: GOLEE.textMuted }}
                        aria-label="Mese successivo"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 border-b" style={{ borderColor: GOLEE.border }}>
                    {WEEKDAY_LABELS.map((label) => (
                      <div
                        key={label}
                        className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: GOLEE.textMuted, backgroundColor: GOLEE.surfaceMuted }}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {cells.map((cell, idx) => {
                      if (!cell.date) {
                        return (
                          <div
                            key={`empty-${idx}`}
                            className="min-h-[104px] border-b border-r"
                            style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
                          />
                        )
                      }
                      const dayEvents = filtered.filter((ev) => eventOccursOnDate(ev, cell.date!))
                      const isToday = cell.date === todayStr
                      return (
                        <div
                          key={cell.date}
                          className="min-h-[104px] border-b border-r p-1.5"
                          style={{
                            borderColor: GOLEE.border,
                            backgroundColor: isToday ? GOLEE.accentSoft : GOLEE.surface,
                          }}
                        >
                          <div
                            className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                              isToday ? 'bg-[#27B36A] text-white' : ''
                            }`}
                            style={{ color: isToday ? undefined : GOLEE.text }}
                          >
                            {cell.day}
                          </div>
                          <div className="space-y-1">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <button
                                key={`${ev.id}-${cell.date}`}
                                type="button"
                                onClick={() => handleEventClick(ev)}
                                className="block w-full truncate rounded px-1.5 py-1 text-left text-[10px] font-semibold"
                                style={{
                                  backgroundColor: `${getCategoryColor(ev)}22`,
                                  color: GOLEE.text,
                                  borderLeft: `3px solid ${getCategoryColor(ev)}`,
                                }}
                                title={getEventCalendarLabel(ev)}
                              >
                                {getEventCalendarLabel(ev)}
                              </button>
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[10px] px-1" style={{ color: GOLEE.textMuted }}>
                                +{dayEvents.length - 3} altri
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()
          ) : (
            <div
              className="overflow-x-auto rounded-xl border"
              style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
            >
            {(() => {
                const filtered = filterEvents(events)
                type Row = { type: 'date'; date: string } | { type: 'event'; event: Event }
                let rows: Row[]
                if (eventsTab === 'eventi') {
                  const byDate: Record<string, Event[]> = {}
                  for (const e of filtered) {
                    const anchor = filterDate || getEventListAnchorDate(e)
                    if (!byDate[anchor]) byDate[anchor] = []
                    byDate[anchor].push(e)
                  }
                  const sortedDates = Object.keys(byDate).sort()
                  rows = sortedDates.flatMap((date) => [
                    { type: 'date' as const, date },
                    ...byDate[date].map((event) => ({ type: 'event' as const, event }))
                  ])
                } else {
                  rows = filtered.map((event) => ({ type: 'event' as const, event }))
                }

                const tableHead = (
                  <div
                    className={`${EVENT_ROW_GRID_CLASS} border-b px-0 text-[10px] font-extrabold uppercase tracking-[0.06em]`}
                    style={{ ...EVENT_ROW_GRID_STYLE, color: GOLEE.textMuted, borderColor: GOLEE.border, backgroundColor: GOLEE.surface }}
                  >
                    <div className="px-3 py-2.5" />
                    <div className="px-1 py-2.5">Tipo</div>
                    <div aria-hidden="true" />
                    <div className="px-1 py-2.5 text-left">Evento</div>
                    <div className="px-1 py-2.5">Luogo</div>
                    <div className="px-1 py-2.5">Data</div>
                    <div className="px-1 py-2.5 text-center">Orario</div>
                    <div className="px-1 py-2.5">Esito</div>
                    <div className="px-1 py-2.5">Info</div>
                  </div>
                )

                return (
                  <>
                    {tableHead}
                    {rows.map((row, rowIndex) => {
                  if (row.type === 'date') {
                    return (
                      <div
                        key={`date-${row.date}`}
                        className={`flex h-8 items-center gap-2 border-b px-3 text-[11px] font-extrabold uppercase tracking-[0.05em] ${rowIndex > 0 ? 'mt-3' : ''}`}
                        style={{ color: '#596275', borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
                      >
                        <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: GOLEE.accent }} />
                        {formatDate(row.date)}
                      </div>
                    )
                  }
                  const event = row.event
                  const isPast = isEventPast(event)
                  const swipeOffset = eventSwipeOffsets[event.id] ?? 0
                  const hasPdf = event.event_type === 'consiglio' && (event.verbale_pdf || (event.verbale_pdfs?.length ?? 0) > 0)
                  const firstPdfFilename = getVerbaleStorageFiles(event.verbale_pdf, event.verbale_pdfs)[0]
                  const handleTouchStart = (e: React.TouchEvent) => {
                    const base = eventSwipeOffsets[event.id] ?? 0
                    touchStartRef.current = { eventId: event.id, x: e.touches[0].clientX, baseOffset: base, lastOffset: base }
                  }
                  const handleTouchMove = (e: React.TouchEvent) => {
                    if (!touchStartRef.current || touchStartRef.current.eventId !== event.id) return
                    const delta = e.touches[0].clientX - touchStartRef.current.x
                    const next = Math.max(-SWIPE_ZONE, Math.min(SWIPE_ZONE, touchStartRef.current.baseOffset + delta))
                    touchStartRef.current.lastOffset = next
                    setEventSwipeOffsets(prev => ({ ...prev, [event.id]: next }))
                  }
                  const handleTouchEnd = () => {
                    if (!touchStartRef.current || touchStartRef.current.eventId !== event.id) return
                    const current = touchStartRef.current.lastOffset
                    let snap = 0
                    if (current > SWIPE_THRESHOLD) snap = hasPdf ? SWIPE_ZONE : 0
                    else if (current < -SWIPE_THRESHOLD) snap = -SWIPE_ZONE
                    setEventSwipeOffsets(prev => ({ ...prev, [event.id]: snap }))
                    touchStartRef.current = null
                  }

                  const previewContent = renderTabularEventRow(event)

                  if (isMobileOrTablet) {
                    return (
                      <div key={event.id} className="relative overflow-hidden w-full border-b" style={{ borderColor: GOLEE.border }}>
                        {hasPdf && (
                          <div
                            className="absolute left-0 top-0 bottom-0 flex items-center justify-center z-0 bg-blue-200"
                            style={{ width: SWIPE_ZONE }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (firstPdfFilename) handleOpenPDF(firstPdfFilename)
                            }}
                          >
                            <div className="flex flex-col items-center gap-1 text-blue-700">
                              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                              <span className="text-xs font-medium">PDF</span>
                            </div>
                          </div>
                        )}
                        <div
                          className="absolute right-0 top-0 bottom-0 flex items-center justify-center z-0 bg-red-200"
                          style={{ width: SWIPE_ZONE }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id) }}
                        >
                          <div className="flex flex-col items-center gap-1 text-red-700">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                            <span className="text-xs font-medium">Archivia</span>
                          </div>
                        </div>
                        <div
                          className={`relative z-10 w-full min-w-0 cursor-pointer transition-all duration-200 ease-out hover:bg-[#FFF8F8] ${
                            isPast ? 'opacity-90' : ''
                          }`}
                          style={{ backgroundColor: GOLEE.surface, transform: `translateX(${swipeOffset}px)` }}
                          onClick={() => {
                            setEventSwipeOffsets(prev => ({ ...prev, [event.id]: 0 }))
                            handleEventClick(event)
                          }}
                          onTouchStart={handleTouchStart}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                        >
                          {previewContent}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={event.id}
                      className={`w-full min-w-0 cursor-pointer border-b transition-colors hover:bg-[#FFF8F8] ${isPast ? 'opacity-90' : ''}`}
                      style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
                      onClick={() => handleEventClick(event)}
                    >
                      {previewContent}
                    </div>
                  )
                    })}
                  </>
                )
              })()}
            </div>
          )}
        </>
        )}

      {/* Modal per gestire invitati */}
      {showInvitedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                🎫 Gestisci Invitati ({tempInvited.filter(name => name.trim() !== '').length}/50)
              </h3>
              <button
                onClick={cancelInvitedModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {tempInvited.map((invited, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={invited}
                      onChange={(e) => updateInvitedField(index, e.target.value)}
                      placeholder={`Nome invitato ${index + 1}`}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-500 bg-white"
                    />
                  </div>
                  
                  {/* Pulsante per aggiungere nuovo campo */}
                  {index === tempInvited.length - 1 && tempInvited.length < 50 && (
                    <button
                      type="button"
                      onClick={addInvitedField}
                      className="p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                      title="Aggiungi altro invitato"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Pulsante per rimuovere campo */}
                  {tempInvited.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInvitedField(index)}
                      className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                      title="Rimuovi invitato"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Messaggio informativo */}
            <div className="bg-blue-50 p-4 rounded-xl mb-6">
              <p className="text-blue-800 text-sm">
                💡 <strong>Suggerimento:</strong> Puoi aggiungere fino a 50 invitati. 
                I nomi duplicati e i campi vuoti verranno automaticamente rimossi.
              </p>
            </div>

            {/* Pulsanti di azione */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelInvitedModal}
                className="px-6 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={saveInvited}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium transition-colors"
              >
                Salva Invitati
              </button>
            </div>
          </div>
        </div>
      )}

      {showEventMatchListModal && selectedEvent?.event_type === 'partita' && (
        <MatchListModal
          isOpen={showEventMatchListModal}
          onClose={() => {
            setShowEventMatchListModal(false)
            setEditingEventMatchList(null)
          }}
          onConfirm={handleEventMatchListConfirm}
          categoryId={selectedEvent.category_id}
          editingList={editingEventMatchList}
          initialEventId={selectedEvent.id}
          isChampionship={selectedEvent.is_championship === true}
          matchTitle={
            getPartitaEventDisplayTitle(
              selectedEvent,
              brandConfig.clubName?.trim() || brandConfig.clubShortName?.trim() || ''
            ) || selectedEvent.title
          }
          matchDate={selectedEvent.event_date}
        />
      )}
      </div>
    </div>
  )
}
