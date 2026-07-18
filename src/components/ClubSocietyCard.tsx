import type { ReactNode } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import ClubLogo from '@/components/ClubLogo'

export interface ClubSocietyCardClub {
  id: string
  name: string
  is_italian?: boolean
  logo_url?: string | null
  contacts?: unknown[]
}

interface ClubSocietyCardProps {
  club: ClubSocietyCardClub
  onEdit: () => void
  onDelete: () => void
  meta?: ReactNode
}

export default function ClubSocietyCard({ club, onEdit, onDelete, meta }: ClubSocietyCardProps) {
  const accentClass = 'bg-gradient-to-b from-blue-500 to-indigo-600'

  const contactCount = Array.isArray(club.contacts) ? club.contacts.length : 0
  const defaultMeta =
    !meta && contactCount > 0 ? (
      <p className="text-base font-medium text-slate-500">
        {contactCount} referent{contactCount === 1 ? 'e' : 'i'}
      </p>
    ) : null

  const centerContent = meta ?? defaultMeta

  return (
    <div className="group relative flex min-h-[4.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-blue-500 hover:ring-2 hover:ring-blue-400/50 hover:shadow-md">
      <div className={`w-1.5 shrink-0 ${accentClass}`} aria-hidden />
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1.15fr)_9.5rem_1fr_auto] items-center gap-x-4 px-3 py-3">
        <p className="truncate text-lg font-bold text-slate-950">{club.name}</p>

        <div className="flex flex-col items-start justify-center gap-1">{centerContent}</div>

        <div aria-hidden className="min-w-0" />

        <div className="relative h-14 w-[4.5rem] shrink-0">
          {club.logo_url && (
            <div className="absolute inset-0 flex justify-end transition-opacity duration-200 max-sm:hidden group-hover:opacity-0 group-hover:pointer-events-none">
              <ClubLogo logoUrl={club.logo_url} name={club.name} size="smPlus" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto max-sm:opacity-100 max-sm:pointer-events-auto">
            <button
              type="button"
              onClick={onEdit}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
              title="Modifica"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              title="Elimina"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
