import { formatFeeAmount } from '@/utils/feeUtils'
import type { AccountingSummary, ReconcileFeesPreview } from '../types'
import { isSyncAligned } from '../utils/summaryCalculations'

interface AccountingKpiCardsProps {
  summary: AccountingSummary | null
  syncPreview: ReconcileFeesPreview | null
  syncPreviewAvailable: boolean
}

function KpiCard({
  label,
  value,
  hint,
  tone = 'default'
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive' | 'negative' | 'warning'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-700'
      : tone === 'negative'
        ? 'text-rose-700'
        : tone === 'warning'
          ? 'text-amber-700'
          : 'text-slate-900'

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function AccountingKpiCards({
  summary,
  syncPreview,
  syncPreviewAvailable
}: AccountingKpiCardsProps) {
  const syncLabel = !syncPreviewAvailable
    ? 'Stato non disponibile'
    : isSyncAligned(syncPreview)
      ? 'Allineata'
      : 'Non allineata'

  const syncTone = !syncPreviewAvailable
    ? 'default'
    : isSyncAligned(syncPreview)
      ? 'positive'
      : 'warning'

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <KpiCard
        label="Entrate incassate"
        value={formatFeeAmount(summary?.incomeCents ?? 0)}
        hint="Movimenti income contabilizzati"
        tone="positive"
      />
      <KpiCard
        label="Uscite"
        value={formatFeeAmount(summary?.expenseCents ?? 0)}
        hint="Movimenti expense contabilizzati"
        tone="negative"
      />
      <KpiCard
        label="Saldo"
        value={formatFeeAmount(summary?.balanceCents ?? 0)}
        hint="Entrate − uscite − storni"
        tone={(summary?.balanceCents ?? 0) >= 0 ? 'positive' : 'negative'}
      />
      <KpiCard
        label="Crediti da incassare"
        value={formatFeeAmount(summary?.residualCreditsCents ?? 0)}
        hint="Residuo crediti attivi"
      />
      <KpiCard
        label="Da classificare / verificare"
        value={String(summary?.pendingReviewCount ?? 0)}
        hint="Bozze, conto mancante, to_review"
        tone={(summary?.pendingReviewCount ?? 0) > 0 ? 'warning' : 'default'}
      />
      <KpiCard
        label="Sync Quote"
        value={syncLabel}
        hint={
          syncPreviewAvailable && syncPreview
            ? `Pending ${syncPreview.outbox_pending} · Failed ${syncPreview.outbox_failed}`
            : 'Anteprima sincronizzazione non raggiungibile'
        }
        tone={syncTone}
      />
    </div>
  )
}
