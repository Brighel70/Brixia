import { createPortal } from 'react-dom'
import { FileText, Layers3, ListTree, X } from 'lucide-react'
import { useState } from 'react'
import { GOLEE } from '@/config/goleeTheme'
import type { AccountingPdfDetailLevel } from '../utils/accountingReportsPdf'

interface AccountingPdfOptionsModalProps {
  open: boolean
  title: string
  generating: boolean
  onClose: () => void
  onGenerate: (detailLevel: AccountingPdfDetailLevel) => Promise<void>
}

export function AccountingPdfOptionsModal({
  open,
  title,
  generating,
  onClose,
  onGenerate
}: AccountingPdfOptionsModalProps) {
  const [detailLevel, setDetailLevel] = useState<AccountingPdfDetailLevel>('macro')

  if (!open || typeof document === 'undefined') return null

  const choiceClass = (selected: boolean) =>
    `flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
      selected
        ? 'border-[#12A594] bg-[#EAF9F6] shadow-[0_0_0_3px_rgba(18,165,148,0.10)]'
        : 'border-[#DCE5EF] bg-white hover:border-[#9BB4CC]'
    }`

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0B1220]/45 backdrop-blur-sm" onClick={generating ? undefined : onClose} />
      <section
        className="relative w-full max-w-[480px] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.24)]"
        aria-modal="true"
        role="dialog"
        aria-labelledby="accounting-pdf-options-title"
      >
        <div className="bg-[#14213D] px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#9DDCFF]">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9DDCFF]">Documento PDF</p>
                <h2 id="accounting-pdf-options-title" className="mt-1 text-lg font-bold">
                  {title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              aria-label="Chiudi"
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm leading-6 text-[#60758B]">
            Scegli il livello di dettaglio prima di generare e aprire il documento.
          </p>
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => setDetailLevel('macro')}
              className={choiceClass(detailLevel === 'macro')}
              aria-pressed={detailLevel === 'macro'}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF9F6] text-[#0A897C]">
                <Layers3 className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-[#162B44]">Solo macro-categorie</span>
                <span className="mt-1 block text-xs leading-5 text-[#60758B]">
                  Una sintesi pulita, con una riga per ciascun gruppo contabile.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDetailLevel('detail')}
              className={choiceClass(detailLevel === 'detail')}
              aria-pressed={detailLevel === 'detail'}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#2D69D7]">
                <ListTree className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-[#162B44]">Macro e sotto-categorie</span>
                <span className="mt-1 block text-xs leading-5 text-[#60758B]">
                  Il dettaglio completo delle voci comprese in ogni macro-categoria.
                </span>
              </span>
            </button>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-[#E5ECF3] pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="rounded-xl border border-[#D7E1EB] px-4 py-2.5 text-sm font-semibold text-[#5D7186] hover:bg-[#F7FAFC] disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => void onGenerate(detailLevel)}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
              style={{ backgroundColor: GOLEE.accent }}
            >
              <FileText className="h-4 w-4" />
              {generating ? 'Generazione...' : 'Genera e apri PDF'}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}
