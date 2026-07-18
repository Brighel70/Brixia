import { createPortal } from 'react-dom'
import { FileText, X } from 'lucide-react'
import { GOLEE } from '@/config/goleeTheme'

export type GoleeRenameFileModalProps = {
  open: boolean
  originalName: string
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
  confirming?: boolean
}

export default function GoleeRenameFileModal({
  open,
  originalName,
  value,
  onChange,
  onConfirm,
  onCancel,
  confirming = false,
}: GoleeRenameFileModalProps) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="golee-rename-title"
    >
      <div
        className="absolute inset-0 bg-[#0B1220]/45 backdrop-blur-[6px]"
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-[440px] overflow-hidden rounded-[24px] border shadow-[0_24px_64px_rgba(15,23,42,0.22)]"
        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: `linear-gradient(90deg, ${GOLEE.accent} 0%, ${GOLEE.info} 100%)` }}
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

        <div className="px-7 pb-7 pt-9">
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: GOLEE.infoSoft,
              color: GOLEE.info,
              boxShadow: '0 0 0 8px #DBEAFE',
            }}
          >
            <FileText className="h-7 w-7" strokeWidth={2} />
          </div>

          <h3
            id="golee-rename-title"
            className="mb-1 text-center text-[1.2rem] font-bold tracking-tight"
            style={{ color: GOLEE.text }}
          >
            Nome allegato
          </h3>
          <p className="mb-5 text-center text-sm" style={{ color: GOLEE.textMuted }}>
            File originale: <span className="font-medium">{originalName}</span>
          </p>

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: GOLEE.textMuted }}>
            Nome da salvare
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onConfirm()
              }
              if (e.key === 'Escape') onCancel()
            }}
            className="mb-6 w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C48C33]"
            style={{ borderColor: GOLEE.border, color: GOLEE.text, backgroundColor: GOLEE.surface }}
            autoFocus
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={confirming}
              className="rounded-2xl border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming || !value.trim()}
              className="rounded-2xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: GOLEE.accent }}
            >
              {confirming ? 'Salvataggio...' : 'Conferma'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
