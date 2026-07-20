import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react'
import { GOLEE } from '@/config/goleeTheme'

export type GoleeConfirmVariant = 'warning' | 'danger' | 'success'

export type GoleeConfirmModalProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Testo sul bottone mentre conferma (default: Attendere…) */
  confirmingLabel?: string
  variant?: GoleeConfirmVariant
  confirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const VARIANT = {
  warning: {
    icon: AlertTriangle,
    iconBg: '#FFF7ED',
    iconColor: '#EA580C',
    glow: '0 0 0 8px #FFEDD5',
    barEnd: '#EA580C',
    confirmBg: GOLEE.accent,
    confirmHover: GOLEE.accentHover,
  },
  danger: {
    icon: Trash2,
    iconBg: GOLEE.dangerSoft,
    iconColor: GOLEE.danger,
    glow: '0 0 0 8px #FECACA',
    barEnd: GOLEE.danger,
    confirmBg: '#8B1E3F',
    confirmHover: '#761a36',
  },
  success: {
    icon: CheckCircle2,
    iconBg: GOLEE.accentSoft,
    iconColor: GOLEE.accent,
    glow: '0 0 0 8px #D1FAE5',
    barEnd: GOLEE.accent,
    confirmBg: GOLEE.accent,
    confirmHover: GOLEE.accentHover,
  },
} as const

export default function GoleeConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  confirmingLabel = 'Attendere…',
  variant = 'warning',
  confirming = false,
  onConfirm,
  onCancel,
}: GoleeConfirmModalProps) {
  if (!open || typeof document === 'undefined') return null

  const style = VARIANT[variant]
  const Icon = style.icon

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="golee-confirm-title"
      aria-describedby="golee-confirm-message"
    >
      <div
        className="absolute inset-0 bg-[#0B1220]/45 backdrop-blur-[6px]"
        onClick={confirming ? undefined : onCancel}
      />
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-[24px] border shadow-[0_24px_64px_rgba(15,23,42,0.22)]"
        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: `linear-gradient(90deg, ${GOLEE.accent} 0%, ${style.barEnd} 100%)` }}
        />
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="absolute right-3.5 top-3.5 rounded-xl p-1.5 transition-colors hover:bg-[#F4F6F8] disabled:opacity-50"
          style={{ color: GOLEE.textMuted }}
          aria-label="Chiudi"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="px-7 pb-7 pt-9 text-center">
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: style.iconBg,
              color: style.iconColor,
              boxShadow: style.glow,
            }}
          >
            <Icon className="h-8 w-8" strokeWidth={2} />
          </div>

          <h3
            id="golee-confirm-title"
            className="mb-2 text-[1.25rem] font-bold tracking-tight"
            style={{ color: GOLEE.text }}
          >
            {title}
          </h3>
          <p
            id="golee-confirm-message"
            className="mx-auto mb-7 max-w-[36ch] text-[15px] leading-relaxed"
            style={{ color: GOLEE.textMuted }}
          >
            {message}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onCancel}
              disabled={confirming}
              className="w-full rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-50 sm:w-auto"
              style={{ borderColor: GOLEE.border, color: GOLEE.textMuted, backgroundColor: GOLEE.surface }}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming}
              className="w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 sm:w-auto"
              style={{ backgroundColor: style.confirmBg }}
              onMouseEnter={(e) => {
                if (!confirming) e.currentTarget.style.backgroundColor = style.confirmHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = style.confirmBg
              }}
            >
              {confirming ? confirmingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
