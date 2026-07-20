import { RotateCcw } from 'lucide-react'
import { formatDisplayPersonParts } from '@/lib/formatPersonName'
import { formatFeeAmount } from '@/utils/feeUtils'
import type { AccountingReceivable, ReceivablesFilterState, ReceivableStatus } from '../types'
import {
  receivableNatureLabel,
  receivableOriginLabel,
  receivableStatusBadgeClass,
  receivableStatusLabel
} from '../utils/labels'

interface ReceivablesTabProps {
  filters: ReceivablesFilterState
  onFiltersChange: (patch: Partial<ReceivablesFilterState>) => void
  onResetFilters: () => void
  receivables: AccountingReceivable[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  loading: boolean
  error: string | null
}

function collectedPercent(expected: number, collected: number): number {
  if (expected <= 0) return collected > 0 ? 100 : 0
  return Math.min(100, Math.round((collected / expected) * 100))
}

function personLabel(recv: AccountingReceivable): string {
  if (!recv.person) return '—'
  return (
    formatDisplayPersonParts(
      recv.person.given_name,
      recv.person.family_name,
      recv.person.full_name
    ) || '—'
  )
}

function ReceivableRow({ recv }: { recv: AccountingReceivable }) {
  const pct = collectedPercent(recv.expected_amount_cents, recv.collected_amount_cents)

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-sm text-slate-900">{recv.description}</td>
      <td className="px-4 py-3 text-sm text-slate-700">{personLabel(recv)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
        {formatFeeAmount(recv.expected_amount_cents)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
        {formatFeeAmount(recv.collected_amount_cents)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
        {formatFeeAmount(recv.residual_amount_cents)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-slate-600">{pct}%</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
        {recv.due_date ? new Date(recv.due_date).toLocaleDateString('it-IT') : '—'}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${receivableStatusBadgeClass(recv.status)}`}
        >
          {receivableStatusLabel(recv.status)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{receivableNatureLabel(recv.nature)}</td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {receivableOriginLabel(recv.source_system, recv.source_table)}
      </td>
    </tr>
  )
}

function ReceivableCard({ recv }: { recv: AccountingReceivable }) {
  const pct = collectedPercent(recv.expected_amount_cents, recv.collected_amount_cents)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{recv.description}</p>
          <p className="mt-1 text-sm text-slate-600">{personLabel(recv)}</p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${receivableStatusBadgeClass(recv.status)}`}
        >
          {receivableStatusLabel(recv.status)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-slate-500">Previsto</dt>
          <dd className="font-medium">{formatFeeAmount(recv.expected_amount_cents)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Incassato</dt>
          <dd>{formatFeeAmount(recv.collected_amount_cents)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Residuo</dt>
          <dd className="font-medium">{formatFeeAmount(recv.residual_amount_cents)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Scadenza</dt>
          <dd>
            {recv.due_date ? new Date(recv.due_date).toLocaleDateString('it-IT') : '—'}
          </dd>
        </div>
      </dl>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Incassato</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

export function ReceivablesTab({
  filters,
  onFiltersChange,
  onResetFilters,
  receivables,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  error
}: ReceivablesTabProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters =
    filters.search || filters.status !== 'all' || filters.dueFilter !== 'all'

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Cerca</label>
            <input
              type="search"
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              placeholder="Descrizione credito..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Stato</label>
            <select
              value={filters.status}
              onChange={(e) =>
                onFiltersChange({ status: e.target.value as ReceivableStatus | 'all' })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Tutti</option>
              <option value="assigned">Assegnato</option>
              <option value="partially_paid">Parziale</option>
              <option value="paid">Pagato</option>
              <option value="overpaid">Eccedenza</option>
              <option value="to_review">Da verificare</option>
              <option value="cancelled">Annullato</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Scadenza</label>
            <select
              value={filters.dueFilter}
              onChange={(e) =>
                onFiltersChange({
                  dueFilter: e.target.value as ReceivablesFilterState['dueFilter']
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Tutte</option>
              <option value="overdue">Scadute</option>
              <option value="upcoming">Future</option>
              <option value="no_date">Senza data</option>
            </select>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
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
          Caricamento crediti...
        </div>
      ) : receivables.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-slate-700 font-medium">Nessun credito da quote</p>
          <p className="mt-1 text-sm text-slate-500">
            I crediti compariranno qui quando verranno sincronizzate assegnazioni quote.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      'Descrizione',
                      'Persona',
                      'Previsto',
                      'Incassato',
                      'Residuo',
                      '%',
                      'Scadenza',
                      'Stato',
                      'Natura',
                      'Origine'
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {receivables.map((r) => (
                    <ReceivableRow key={r.id} recv={r} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {receivables.map((r) => (
              <ReceivableCard key={r.id} recv={r} />
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-slate-600">
              {total} crediti · pagina {page} di {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Precedente
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Successiva
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
