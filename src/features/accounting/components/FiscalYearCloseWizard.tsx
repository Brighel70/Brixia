import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Lock, Unlock } from 'lucide-react'
import { toast } from 'sonner'
import type { AccountingFiscalYear, FiscalYearClosingChecklist } from '../types'

interface FiscalYearCloseWizardProps {
  fiscalYear: AccountingFiscalYear | null
  checklist: FiscalYearClosingChecklist | null
  loading: boolean
  canClose: boolean
  canReopen: boolean
  onRefreshChecklist: () => Promise<void>
  onOpen: () => Promise<void>
  onStartClosing: () => Promise<void>
  onClose: () => Promise<void>
  onReopen: (reason: string) => Promise<void>
}

export function FiscalYearCloseWizard({
  fiscalYear,
  checklist,
  loading,
  canClose,
  canReopen,
  onRefreshChecklist,
  onOpen,
  onStartClosing,
  onClose,
  onReopen
}: FiscalYearCloseWizardProps) {
  const [reopenReason, setReopenReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (!fiscalYear || !canClose) return null

  const run = async (fn: () => Promise<void>, okMsg: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(okMsg)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operazione non riuscita')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl bg-white/10 p-4 text-white backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Chiusura esercizio {fiscalYear.code}</h2>
          <p className="mt-1 text-xs text-white/70">
            Procedura guidata. Snapshot gestionale al close — da validare con il commercialista.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void onRefreshChecklist()}
          className="rounded-lg border border-white/30 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-60"
        >
          Aggiorna checklist
        </button>
      </div>

      {checklist && (
        <ul className="mt-3 space-y-1 text-xs">
          {checklist.items.map((item) => (
            <li key={item.key} className="flex items-center gap-2">
              {item.blocking ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
              )}
              <span>
                {item.label}: <strong>{item.count}</strong>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {fiscalYear.status === 'draft' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(onOpen, 'Esercizio aperto')}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500 disabled:opacity-60"
          >
            <Unlock className="h-3.5 w-3.5" />
            Apri esercizio
          </button>
        )}
        {fiscalYear.status === 'open' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(onStartClosing, 'Chiusura avviata')}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-60"
          >
            Avvia chiusura
          </button>
        )}
        {fiscalYear.status === 'closing' && (
          <button
            type="button"
            disabled={busy || !!checklist?.blocking}
            onClick={() => void run(onClose, 'Esercizio chiuso')}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium hover:bg-brand-primary/90 disabled:opacity-60"
          >
            <Lock className="h-3.5 w-3.5" />
            Chiudi definitivamente
          </button>
        )}
        {canReopen && (fiscalYear.status === 'closed' || fiscalYear.status === 'closing') && (
          <div className="flex w-full flex-wrap items-center gap-2">
            <input
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Motivazione riapertura (obbligatoria)"
              className="min-w-[220px] flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white placeholder:text-white/50"
            />
            <button
              type="button"
              disabled={busy || !reopenReason.trim()}
              onClick={() =>
                void run(() => onReopen(reopenReason.trim()), 'Esercizio riaperto')
              }
              className="rounded-lg border border-rose-300/60 bg-rose-500/20 px-3 py-1.5 text-xs font-medium hover:bg-rose-500/30 disabled:opacity-60"
            >
              Riapri (Admin)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
