import { useMemo, useState } from 'react'
import { Download, Printer, RotateCcw } from 'lucide-react'
import { formatFeeAmount } from '@/utils/feeUtils'
import type {
  AccountingAccountRef,
  AccountingBudgetLine,
  AccountingCategoryRef,
  AccountingFiscalYear,
  ConsuntivoFilterState,
  ConsuntivoMovementRow,
  FeesBudgetAggregate,
  MovementStatus,
  ReceivableNature
} from '../types'
import {
  computeConsuntivoReport,
  consuntivoReportToCsv,
  downloadConsuntivoCsv
} from '../utils/consuntivoCalculations'
import { findQuoteCategory } from '../utils/budgetCalculations'
import {
  movementDirectionLabel,
  movementStatusLabel,
  receivableNatureLabel
} from '../utils/labels'

interface ConsuntivoTabProps {
  fiscalYear: AccountingFiscalYear | null
  movements: ConsuntivoMovementRow[]
  accounts: AccountingAccountRef[]
  categories: AccountingCategoryRef[]
  budgetLines: AccountingBudgetLine[]
  hasApprovedBudget: boolean
  fees: FeesBudgetAggregate | null
  filters: ConsuntivoFilterState
  onFiltersChange: (patch: Partial<ConsuntivoFilterState>) => void
  onResetFilters: () => void
  loading: boolean
  error: string | null
  canExport: boolean
}

function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(1)}%`
}

function formatSignedCents(cents: number): string {
  const formatted = formatFeeAmount(Math.abs(cents))
  if (cents > 0) return `+${formatted}`
  if (cents < 0) return `−${formatted}`
  return formatted
}

function natureLabel(nature: ReceivableNature | 'unknown'): string {
  if (nature === 'unknown') return '—'
  return receivableNatureLabel(nature)
}

type PeriodMode = 'year' | 'custom'

export function ConsuntivoTab({
  fiscalYear,
  movements,
  accounts,
  categories,
  budgetLines,
  hasApprovedBudget,
  fees,
  filters,
  onFiltersChange,
  onResetFilters,
  loading,
  error,
  canExport
}: ConsuntivoTabProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>(
    filters.dateFrom || filters.dateTo ? 'custom' : 'year'
  )

  const quoteCategory = useMemo(() => findQuoteCategory(categories), [categories])

  const report = useMemo(
    () =>
      computeConsuntivoReport({
        movements,
        filters,
        categories,
        accounts,
        budgetLines,
        hasApprovedBudget,
        fees,
        quoteCategory
      }),
    [
      movements,
      filters,
      categories,
      accounts,
      budgetLines,
      hasApprovedBudget,
      fees,
      quoteCategory
    ]
  )

  const handlePeriodMode = (mode: PeriodMode) => {
    setPeriodMode(mode)
    if (mode === 'year') {
      onFiltersChange({ dateFrom: '', dateTo: '' })
    }
  }

  const handleExportCsv = () => {
    if (!fiscalYear || !canExport) return
    const csv = consuntivoReportToCsv(report, fiscalYear.code)
    downloadConsuntivoCsv(csv, `consuntivo-${fiscalYear.code}.csv`)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow-sm">
        Caricamento consuntivo...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!fiscalYear) {
    return (
      <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">
        Seleziona un esercizio contabile.
      </div>
    )
  }

  const { kpis, completeness } = report

  return (
    <div className="consuntivo-print-root space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .consuntivo-print-root, .consuntivo-print-root * { visibility: visible !important; }
          .consuntivo-print-root {
            position: absolute; left: 0; top: 0; width: 100%;
            color: #0f172a !important;
            background: white !important;
          }
          .consuntivo-no-print { display: none !important; }
          .consuntivo-print-only { display: block !important; }
        }
        .consuntivo-print-only { display: none; }
      `}</style>

      <div className="consuntivo-print-only mb-4 border-b border-slate-300 pb-3">
        <p className="text-sm font-semibold text-slate-900">
          Rendiconto gestionale provvisorio — non ancora chiuso
        </p>
        <p className="text-xs text-slate-600">Esercizio {fiscalYear.code}</p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Consuntivo — esercizio {fiscalYear.code}
            </h2>
            <p className="mt-1 text-sm font-medium text-amber-800">
              Rendiconto gestionale provvisorio — non ancora chiuso
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Criterio di cassa sui movimenti contabilizzati. Solo lettura.
            </p>
          </div>
          <div className="consuntivo-no-print flex flex-wrap gap-2">
            {canExport && (
              <>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Esporta CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4" />
                  Stampa / PDF
                </button>
              </>
            )}
          </div>
        </div>

        <div className="consuntivo-no-print mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filtri
            </p>
            <button
              type="button"
              onClick={() => {
                setPeriodMode('year')
                onResetFilters()
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reimposta
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Periodo</label>
              <select
                value={periodMode}
                onChange={(e) => handlePeriodMode(e.target.value as PeriodMode)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="year">Intero esercizio</option>
                <option value="custom">Intervallo personalizzato</option>
              </select>
            </div>
            {periodMode === 'custom' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Da</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    min={fiscalYear.starts_on}
                    max={fiscalYear.ends_on}
                    onChange={(e) => onFiltersChange({ dateFrom: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">A</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    min={fiscalYear.starts_on}
                    max={fiscalYear.ends_on}
                    onChange={(e) => onFiltersChange({ dateTo: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Conto</label>
              <select
                value={filters.accountId}
                onChange={(e) => onFiltersChange({ accountId: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">Tutti</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Categoria</label>
              <select
                value={filters.categoryId}
                onChange={(e) => onFiltersChange({ categoryId: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">Tutte</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Natura</label>
              <select
                value={filters.nature}
                onChange={(e) =>
                  onFiltersChange({ nature: e.target.value as ReceivableNature | 'all' })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">Tutte</option>
                <option value="institutional">Istituzionale</option>
                <option value="commercial">Commerciale</option>
                <option value="mixed">Misto</option>
                <option value="to_classify">Da classificare</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Entrata / Uscita
              </label>
              <select
                value={filters.direction}
                onChange={(e) =>
                  onFiltersChange({
                    direction: e.target.value as 'income' | 'expense' | 'all'
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">Tutte</option>
                <option value="income">Entrata</option>
                <option value="expense">Uscita</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Stato</label>
              <select
                value={filters.status}
                onChange={(e) =>
                  onFiltersChange({ status: e.target.value as MovementStatus | 'all' })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">Tutti</option>
                <option value="posted">Contabilizzato</option>
                <option value="pending_account">Conto da assegnare</option>
                <option value="draft">Bozza</option>
                <option value="reversed">Stornato</option>
                <option value="cancelled">Annullato</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: 'Totale entrate', value: formatFeeAmount(kpis.incomeCents) },
          { label: 'Totale uscite', value: formatFeeAmount(kpis.expenseCents) },
          {
            label: 'Avanzo / disavanzo',
            value: formatSignedCents(kpis.surplusCents),
            tone: kpis.surplusCents >= 0 ? 'text-emerald-700' : 'text-rose-700'
          },
          {
            label: 'Crediti Quote da incassare',
            value: formatFeeAmount(kpis.quoteResidualCents),
            hint: 'Non conteggiati nelle entrate effettive'
          },
          { label: 'Movimenti da verificare', value: String(kpis.toVerifyCount) },
          {
            label: 'Completezza documentale',
            value: formatPercent(kpis.documentationPercent),
            hint: 'Documento e/o riferimento pagamento'
          }
        ].map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold text-slate-900 ${card.tone ?? ''}`}>
              {card.value}
            </p>
            {card.hint && <p className="mt-1 text-xs text-slate-500">{card.hint}</p>}
          </div>
        ))}
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Rendiconto per categoria</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Natura</th>
                <th className="px-3 py-2 text-right">Entrate</th>
                <th className="px-3 py-2 text-right">Uscite</th>
                <th className="px-3 py-2 text-right">Saldo</th>
                <th className="px-3 py-2 text-right">N.</th>
                <th className="px-3 py-2">Anomalie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Nessun movimento effettivo nel filtro corrente.
                  </td>
                </tr>
              ) : (
                report.categories.map((row) => {
                  const cat = categories.find((c) => c.id === row.categoryId)
                  const groupLabel = cat?.group
                    ? `${cat.group.code} · `
                    : ''
                  const inactiveBadge =
                    cat && cat.is_active === false ? (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                        Categoria non attiva
                      </span>
                    ) : null
                  return (
                  <tr key={row.categoryId ?? 'none'}>
                    <td className="px-3 py-2 text-slate-900">
                      <span className="text-xs text-slate-500">{groupLabel}</span>
                      <span className="font-medium">{row.categoryCode}</span>
                      <span className="text-slate-500"> — {row.categoryName}</span>
                      {inactiveBadge}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{natureLabel(row.nature)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                      {formatFeeAmount(row.incomeCents)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                      {formatFeeAmount(row.expenseCents)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                      {formatSignedCents(row.balanceCents)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{row.movementCount}</td>
                    <td className="px-3 py-2 text-xs text-amber-700">
                      {row.anomalies.length ? row.anomalies.join(' · ') : '—'}
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Confronto con preventivo approvato
        </h3>
        {!hasApprovedBudget ? (
          <p className="mt-3 text-sm text-slate-600">Nessun preventivo approvato</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Voce</th>
                  <th className="px-3 py-2">Dir.</th>
                  <th className="px-3 py-2 text-right">Previsto</th>
                  <th className="px-3 py-2 text-right">Consuntivo</th>
                  <th className="px-3 py-2 text-right">Scostamento</th>
                  <th className="px-3 py-2 text-right">% realizz.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.budgetCompare.map((row) => (
                  <tr
                    key={row.key}
                    className={row.key === 'total' ? 'bg-slate-50 font-semibold' : undefined}
                  >
                    <td className="px-3 py-2 text-slate-900">{row.label}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {row.direction === 'total'
                        ? '—'
                        : movementDirectionLabel(row.direction)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatFeeAmount(row.plannedCents)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatFeeAmount(row.actualCents)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatSignedCents(row.varianceCents)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPercent(row.realizationPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Situazione finanziaria per conto
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Totale movimenti netti per conto (criterio di cassa). Non è un saldo bancario
          riconciliato con estratto conto.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Conto</th>
                <th className="px-3 py-2 text-right">Netto contabilizzato</th>
                <th className="px-3 py-2 text-right">Pending account</th>
                <th className="px-3 py-2 text-right">N. posted</th>
                <th className="px-3 py-2 text-right">N. pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Nessun movimento per conto nel filtro corrente.
                  </td>
                </tr>
              ) : (
                report.accounts.map((a) => (
                  <tr key={a.accountId ?? 'none'}>
                    <td className="px-3 py-2 text-slate-900">
                      <span className="font-medium">{a.accountCode}</span>
                      <span className="text-slate-500"> — {a.accountName}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatSignedCents(a.netPostedCents)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-800">
                      {formatSignedCents(a.pendingAccountCents)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {a.movementCountPosted}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {a.movementCountPending}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Controlli di completezza</h3>
        <p className="mt-1 text-xs text-slate-500">
          Documento = document_type / document_number; Riferimento pagamento = reference.
          I movimenti automatici Quote (fee_sync) non sono segnalati come anomalia documentale.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Senza categoria', completeness.withoutCategory],
            ['Senza conto', completeness.withoutAccount],
            ['Senza documento', completeness.withoutDocument],
            ['Bozze', completeness.drafts],
            ['Pending account', completeness.pendingAccount],
            ['Storni senza originale', completeness.unattributedReversals],
            ['Categorie to_classify', completeness.toClassifyCategories],
            [
              'Documentati / documentabili',
              `${completeness.documentedCount} / ${completeness.documentableCount}`
            ]
          ].map(([label, value]) => (
            <li
              key={String(label)}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="text-slate-600">{label}</span>
              <span className="font-semibold tabular-nums text-slate-900">{value}</span>
            </li>
          ))}
        </ul>
        {!canExport && (
          <p className="consuntivo-no-print mt-4 text-xs text-slate-500">
            Esportazione CSV/PDF richiede il permesso{' '}
            <code className="text-[11px]">accounting.export</code>.
          </p>
        )}
      </section>
    </div>
  )
}
