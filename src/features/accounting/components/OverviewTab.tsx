import { formatFeeAmount } from '@/utils/feeUtils'
import type { AccountingSummary, ReconcileFeesPreview } from '../types'
import { isSyncAligned } from '../utils/summaryCalculations'

interface OverviewTabProps {
  summary: AccountingSummary | null
  syncPreview: ReconcileFeesPreview | null
  syncPreviewAvailable: boolean
}

export function OverviewTab({ summary, syncPreview, syncPreviewAvailable }: OverviewTabProps) {
  const aligned = syncPreviewAvailable && isSyncAligned(syncPreview)

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Riepilogo esercizio</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calcoli da movimenti e crediti reali. Gli storni non vengono conteggiati due volte:
          l&apos;originale in stato <code className="text-xs">reversed</code> è escluso e il
          movimento <code className="text-xs">reversal</code> riduce il saldo.
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-4">
            <dt className="text-sm text-slate-500">Entrate (posted)</dt>
            <dd className="mt-1 text-xl font-bold text-emerald-700">
              {formatFeeAmount(summary?.incomeCents ?? 0)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <dt className="text-sm text-slate-500">Uscite (posted)</dt>
            <dd className="mt-1 text-xl font-bold text-rose-700">
              {formatFeeAmount(summary?.expenseCents ?? 0)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <dt className="text-sm text-slate-500">Storni (posted / pending conto)</dt>
            <dd className="mt-1 text-xl font-bold text-orange-700">
              {formatFeeAmount(summary?.reversalCents ?? 0)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <dt className="text-sm text-slate-500">Saldo netto</dt>
            <dd className="mt-1 text-xl font-bold text-slate-900">
              {formatFeeAmount(summary?.balanceCents ?? 0)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <dt className="text-sm text-slate-500">Crediti residui</dt>
            <dd className="mt-1 text-xl font-bold text-slate-900">
              {formatFeeAmount(summary?.residualCreditsCents ?? 0)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <dt className="text-sm text-slate-500">Elementi da verificare</dt>
            <dd className="mt-1 text-xl font-bold text-amber-700">
              {summary?.pendingReviewCount ?? 0}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sincronizzazione Quote</h2>
        {syncPreviewAvailable && syncPreview ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                  aligned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {aligned ? 'Allineata' : 'Non allineata'}
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <li>Assegnazioni senza link attivo: {syncPreview.assignments_missing_active_link}</li>
              <li>Link assegnazione orfani: {syncPreview.active_assignment_links_without_source}</li>
              <li>Pagamenti senza link attivo: {syncPreview.payments_missing_active_link}</li>
              <li>Link pagamento orfani: {syncPreview.active_payment_links_without_source}</li>
              <li>Incoerenze incassato: {syncPreview.collected_mismatch_count}</li>
              <li>Outbox pending: {syncPreview.outbox_pending}</li>
              <li>Outbox failed: {syncPreview.outbox_failed}</li>
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Stato non disponibile.</p>
        )}
      </div>
    </div>
  )
}
