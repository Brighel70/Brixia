import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { GOLEE } from '@/config/goleeTheme'

export type GoleeAlertVariant = 'warning' | 'error' | 'info' | 'success'

export type GoleeAlertModalProps = {
  open: boolean
  title: string
  message: string
  variant?: GoleeAlertVariant
  confirmLabel?: string
  onClose: () => void
}

const VARIANT = {
  warning: {
    icon: AlertTriangle,
    iconBg: '#FFF7ED',
    iconColor: '#EA580C',
    glow: '0 0 0 8px #FFEDD5',
  },
  error: {
    icon: XCircle,
    iconBg: GOLEE.dangerSoft,
    iconColor: GOLEE.danger,
    glow: '0 0 0 8px #FECACA',
  },
  info: {
    icon: Info,
    iconBg: GOLEE.infoSoft,
    iconColor: GOLEE.info,
    glow: '0 0 0 8px #DBEAFE',
  },
  success: {
    icon: CheckCircle2,
    iconBg: GOLEE.successSoft,
    iconColor: GOLEE.success,
    glow: '0 0 0 8px #A7F3D0',
  },
} as const

export default function GoleeAlertModal({
  open,
  title,
  message,
  variant = 'warning',
  confirmLabel = 'Continua',
  onClose,
}: GoleeAlertModalProps) {
  if (!open || typeof document === 'undefined') return null

  const style = VARIANT[variant]
  const Icon = style.icon

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="golee-alert-title"
      aria-describedby="golee-alert-message"
    >
      <div
        className="absolute inset-0 bg-[#0B1220]/45 backdrop-blur-[6px]"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-[24px] border shadow-[0_24px_64px_rgba(15,23,42,0.22)]"
        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: `linear-gradient(90deg, ${GOLEE.accent} 0%, ${style.iconColor} 100%)` }}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-xl p-1.5 transition-colors hover:bg-[#F4F6F8]"
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
            id="golee-alert-title"
            className="mb-2 text-[1.25rem] font-bold tracking-tight"
            style={{ color: GOLEE.text }}
          >
            {title}
          </h3>
          <p
            id="golee-alert-message"
            className="mx-auto mb-7 max-w-[34ch] text-[15px] leading-relaxed"
            style={{ color: GOLEE.textMuted }}
          >
            {message}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors"
            style={{ backgroundColor: GOLEE.accent }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = GOLEE.accentHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = GOLEE.accent
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
