import { createPortal } from 'react-dom'
import { Mail, Users, X } from 'lucide-react'
import { GOLEE } from '@/config/goleeTheme'

export type DuplicateEmailPerson = {
  id: string
  given_name?: string | null
  family_name?: string | null
  full_name?: string | null
  email?: string | null
  is_player?: boolean | null
  is_staff?: boolean | null
}

type DuplicateEmailModalProps = {
  open: boolean
  email: string
  people: DuplicateEmailPerson[]
  onKeepEmail: () => void
  onChangeEmail: () => void
  onClose: () => void
}

function personName(person: DuplicateEmailPerson) {
  return [person.given_name, person.family_name].filter(Boolean).join(' ')
    || person.full_name
    || 'Persona senza nome'
}

function personRole(person: DuplicateEmailPerson) {
  if (person.is_player && person.is_staff) return 'Giocatore e staff'
  if (person.is_player) return 'Giocatore'
  if (person.is_staff) return 'Staff'
  return 'Anagrafica'
}

export default function DuplicateEmailModal({
  open,
  email,
  people,
  onKeepEmail,
  onChangeEmail,
  onClose,
}: DuplicateEmailModalProps) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-email-title"
    >
      <div className="absolute inset-0 bg-[#0B1220]/45 backdrop-blur-[6px]" onClick={onClose} />
      <div
        className="relative w-full max-w-[520px] overflow-hidden rounded-[24px] border shadow-[0_24px_64px_rgba(15,23,42,0.22)]"
        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#2F6DF6]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-xl p-1.5 transition-colors hover:bg-[#F4F6F8]"
          style={{ color: GOLEE.textMuted }}
          aria-label="Chiudi"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="px-7 pb-7 pt-9">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#2F6DF6] shadow-[0_0_0_8px_#DBEAFE]">
            <Mail className="h-7 w-7" strokeWidth={2} />
          </div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-[#2F6DF6]">Controllo email</p>
          <h3 id="duplicate-email-title" className="text-xl font-bold" style={{ color: GOLEE.text }}>
            Email gia presente in anagrafica
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: GOLEE.textMuted }}>
            <strong style={{ color: GOLEE.text }}>{email}</strong> e' gia associata alle persone qui sotto. Puoi mantenerla, ad esempio per una famiglia, oppure modificarla.
          </p>

          <div className="mt-5 max-h-56 space-y-2 overflow-y-auto pr-1">
            {people.map((person) => (
              <div key={person.id} className="flex items-center gap-3 rounded-2xl border border-[#E3EAF3] bg-[#F8FAFC] px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#2F6DF6]">
                  <Users className="h-[18px] w-[18px]" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" style={{ color: GOLEE.text }}>{personName(person)}</p>
                  <p className="mt-0.5 text-xs" style={{ color: GOLEE.textMuted }}>{personRole(person)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={onChangeEmail}
              className="rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors hover:bg-[#F4F6F8]"
              style={{ borderColor: GOLEE.border, color: GOLEE.text }}
            >
              Modifica email
            </button>
            <button
              type="button"
              onClick={onKeepEmail}
              className="rounded-2xl bg-[#2F6DF6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2458D3]"
            >
              Mantieni questa email
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
