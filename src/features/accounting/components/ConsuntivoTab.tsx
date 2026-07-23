import { useMemo, useState } from 'react'
import { BarChart3, Download, FileText, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
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
import { previewBudgetComparisonPdf, previewConsuntivoPdf } from '../utils/accountingReportsPdf'
import { reservePdfPreviewWindow } from '../utils/documentTemplates'
import { AccountingPdfOptionsModal } from './AccountingPdfOptionsModal'
import type { AccountingPdfDetailLevel } from '../utils/accountingReportsPdf'
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
  hasActiveBudget: boolean
  fees: FeesBudgetAggregate | null
  filters: ConsuntivoFilterState
  onFiltersChange: (patch: Partial<ConsuntivoFilterState>) => void
  onResetFilters: () => void
  loading: boolean
  error: string | null
  canExport: boolean
  onOpenReconciliation?: () => void
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
type PdfKind = 'consuntivo' | 'comparison'

export function ConsuntivoTab({
  fiscalYear,
  movements,
  accounts,
  categories,
  budgetLines,
  hasActiveBudget,
  fees,
  filters,
  onFiltersChange,
  onResetFilters,
  loading,
  error,
  canExport,
  onOpenReconciliation
}: ConsuntivoTabProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>(
    filters.dateFrom || filters.dateTo ? 'custom' : 'year'
  )
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false)
  const [pdfKind, setPdfKind] = useState<PdfKind>('consuntivo')

  const quoteCategory = useMemo(() => findQuoteCategory(categories), [categories])

  const report = useMemo(
    () =>
      computeConsuntivoReport({
        movements,
        filters,
        categories,
        accounts,
        budgetLines,
        hasActiveBudget,
        fees,
        quoteCategory
      }),
    [
      movements,
      filters,
      categories,
      accounts,
      budgetLines,
      hasActiveBudget,
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

  const handleGeneratePdf = async (detailLevel: AccountingPdfDetailLevel) => {
    if (pdfGenerating) return
    if (pdfKind === 'comparison' && !report.hasActiveBudget) {
      toast.error('Per il confronto serve prima un preventivo')
      return
    }
    const previewWindow = reservePdfPreviewWindow()
    setPdfGenerating(true)
    try {
      if (pdfKind === 'comparison') {
        await previewBudgetComparisonPdf({
          fiscalYear,
          report,
          categories,
          detailLevel,
          previewWindow
        })
      } else {
        await previewConsuntivoPdf({ fiscalYear, report, detailLevel, previewWindow })
      }
      toast.success(
        pdfKind === 'comparison'
          ? 'PDF di confronto preventivo-consuntivo generato'
          : 'PDF del consuntivo generato'
      )
      setPdfOptionsOpen(false)
    } catch (err) {
      if (previewWindow && !previewWindow.closed) previewWindow.close()
      toast.error(err instanceof Error ? err.message : 'Generazione PDF non riuscita')
    } finally {
      setPdfGenerating(false)
    }
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
  const isDirectionFiltered = filters.direction !== 'all'
  const directionFilterLabel = filters.direction === 'income' ? 'solo le entrate' : 'solo le uscite'
  const totalLabelPrefix = isDirectionFiltered ? 'Nel filtro' : 'Totale'

  return (
    <div className="space-y-6">
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
          <div className="flex flex-wrap gap-2">
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
                  onClick={() => {
                    setPdfKind('consuntivo')
                    setPdfOptionsOpen(true)
                  }}
                  disabled={pdfGenerating}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  {pdfGenerating ? 'Generazione PDF...' : 'PDF consuntivo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPdfKind('comparison')
                    setPdfOptionsOpen(true)
                  }}
                  disabled={pdfGenerating || !report.hasActiveBudget}
                  title={
                    report.hasActiveBudget
                      ? 'Confronta preventivo ed effettivo'
                      : 'Serve prima un preventivo'
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <BarChart3 className="h-4 w-4" />
                  PDF confronto
                </button>
              </>
            )}
          </div>
        </div>
        {!report.hasActiveBudget && (
          <p className="mt-3 text-xs text-amber-800">
            Crea un preventivo per poter generare il confronto con il consuntivo.
          </p>
        )}

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
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
                  <label className="mb-1 block text-xs font-medium text-slate-600">Al</label>
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

      {isDirectionFiltered && (
        <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Stai visualizzando <strong>{directionFilterLabel}</strong>. I totali qui sotto non includono
            l'altra direzione.
          </p>
          <button
            type="button"
            onClick={() => onFiltersChange({ direction: 'all' })}
            className="shrink-0 font-semibold text-sky-800 underline decoration-sky-300 underline-offset-4 hover:text-sky-950"
          >
            Mostra entrate e uscite
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: `${totalLabelPrefix} entrate`, value: formatFeeAmount(kpis.incomeCents) },
          { label: `${totalLabelPrefix} uscite`, value: formatFeeAmount(kpis.expenseCents) },
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
                report.categoryGroups.flatMap((group) => [
                  <tr key={`group:${group.groupId ?? 'legacy'}`} className="bg-slate-50">
                    <td colSpan={2} className="px-3 py-2 text-slate-900">
                      <span className="font-semibold">{group.groupName}</span>
                      {group.isLegacy && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          Storico senza macro
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {formatFeeAmount(group.incomeCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {formatFeeAmount(group.expenseCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {formatSignedCents(group.balanceCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-600">
                      {group.movementCount}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">Totale macro</td>
                  </tr>,
                  ...group.categories.map((row) => (
                    <tr key={row.categoryId ?? `none:${group.groupId ?? 'legacy'}`}>
                      <td className="px-3 py-2 pl-6 text-slate-900">
                        <span className="font-normal">{row.categoryName}</span>
                        {row.isInactive && (
                          <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            Non attiva
                          </span>
                        )}
                        {row.isArchived && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            Archiviata
                          </span>
                        )}
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
                  ))
                ])
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">
          Confronto con preventivo
        </h3>
        {!hasActiveBudget ? (
          <p className="mt-3 text-sm text-slate-600">Nessun preventivo disponibile</p>
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
          {onOpenReconciliation && (
            <>
              {' '}
              <button
                type="button"
                onClick={onOpenReconciliation}
                className="font-medium text-brand-primary hover:underline"
              >
                Vai alla riconciliazione
              </button>
            </>
          )}
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
      <AccountingPdfOptionsModal
        open={pdfOptionsOpen}
        title={pdfKind === 'comparison' ? 'Confronto preventivo e consuntivo' : 'Rendiconto gestionale'}
        generating={pdfGenerating}
        onClose={() => {
          if (!pdfGenerating) setPdfOptionsOpen(false)
        }}
        onGenerate={handleGeneratePdf}
      />
    </div>
  )
}
