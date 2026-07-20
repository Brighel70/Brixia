import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { ReconcileFeesPreview } from '../types'
import { isSyncAligned } from '../utils/summaryCalculations'

interface SyncTabProps {
  preview: ReconcileFeesPreview | null
  loading: boolean
  error: string | null
  canVerify: boolean
  retryLoading: boolean
  onRefresh: () => void
  onRetry: () => Promise<Record<string, unknown>>
}

export function SyncTab({
  preview,
  loading,
  error,
  canVerify,
  retryLoading,
  onRefresh,
  onRetry
}: SyncTabProps) {
  const aligned = isSyncAligned(preview)

  const handleRetry = async () => {
    if (
      !window.confirm(
        'Riprocessare le voci in coda di sincronizzazione Quote → Contabilità?\n\n' +
          'Verranno elaborati gli elementi pending/failed nell\'outbox.'
      )
    ) {
      return
    }

    try {
      const result = await onRetry()
      const ok = Number(result.processed_ok ?? 0)
      const fail = Number(result.processed_failed ?? 0)
      toast.success(`Sincronizzazione completata: ${ok} ok, ${fail} errori`)
    } catch {
      toast.error('Impossibile completare la riprova sincronizzazione')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Sincronizzazione Quote</h2>
          <p className="mt-1 text-sm text-slate-500">
            Verifica allineamento tra Quote e Contabilità. Nessun dato personale o payload tecnico
            viene mostrato.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna stato
          </button>
          {canVerify && (
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={retryLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-brixia-primary px-4 py-2 text-sm font-medium text-white hover:bg-brixia-primary/90 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${retryLoading ? 'animate-spin' : ''}`} />
              Riprova sincronizzazione
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">
          Verifica sincronizzazione in corso...
        </div>
      ) : !preview ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-slate-700 font-medium">Anteprima non disponibile</p>
          <p className="mt-1 text-sm text-slate-500">
            Assicurati di avere il permesso accounting.view e riprova.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <span
              className={`inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${
                aligned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {aligned ? 'Allineata' : 'Non allineata'}
            </span>
            {!aligned && (
              <p className="text-sm text-amber-800">
                Sono presenti discrepanze o voci in coda da elaborare.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Outbox pending"
              value={preview.outbox_pending}
              warn={preview.outbox_pending > 0}
            />
            <MetricCard
              label="Outbox failed"
              value={preview.outbox_failed}
              warn={preview.outbox_failed > 0}
            />
            <MetricCard
              label="Assegnazioni senza link"
              value={preview.assignments_missing_active_link}
              warn={preview.assignments_missing_active_link > 0}
            />
            <MetricCard
              label="Link assegnazione orfani"
              value={preview.active_assignment_links_without_source}
              warn={preview.active_assignment_links_without_source > 0}
            />
            <MetricCard
              label="Pagamenti senza link"
              value={preview.payments_missing_active_link}
              warn={preview.payments_missing_active_link > 0}
            />
            <MetricCard
              label="Link pagamento orfani"
              value={preview.active_payment_links_without_source}
              warn={preview.active_payment_links_without_source > 0}
            />
            <MetricCard
              label="Incoerenze incassato"
              value={preview.collected_mismatch_count}
              warn={preview.collected_mismatch_count > 0}
            />
          </div>

          {!canVerify && (preview.outbox_pending > 0 || preview.outbox_failed > 0) && (
            <p className="mt-4 text-sm text-slate-500">
              Per riprocessare la coda serve il permesso accounting.verify.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  warn
}: {
  label: string
  value: number
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${warn ? 'text-amber-800' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}
