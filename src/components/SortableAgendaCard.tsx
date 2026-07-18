import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface SortableAgendaCardProps {
  id: string
  children: React.ReactNode
}

export default function SortableAgendaCard({ id, children }: SortableAgendaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-stretch gap-1 group/card"
      data-sortable-card
    >
      <button
        type="button"
        className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 shrink-0 cursor-grab active:cursor-grabbing touch-none text-slate-500 hover:text-slate-700 bg-slate-100/80 rounded-lg transition-colors"
        aria-label="Trascina per riordinare"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
