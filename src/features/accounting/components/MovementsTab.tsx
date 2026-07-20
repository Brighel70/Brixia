import { Plus, RotateCcw } from 'lucide-react'
import { formatFeeAmount } from '@/utils/feeUtils'
import type {
  AccountingAccountRef,
  AccountingMovement,
  MovementsFilterState,
  MovementDirection,
  MovementStatus
} from '../types'
import {
  formatDocumentLabel,
  formatPaymentReferenceLabel,
  paymentMethodLabel
} from '../utils/movementFormOptions'
import {
  movementDirectionBadgeClass,
  movementDirectionLabel,
  movementOriginLabel,
  movementStatusBadgeClass,
  movementStatusLabel
} from '../utils/labels'
import { isSystemMovementOrigin } from '../utils/movementHelpers'

interface MovementsTabProps {
  accounts: AccountingAccountRef[]
  filters: MovementsFilterState
  onFiltersChange: (patch: Partial<MovementsFilterState>) => void
  onResetFilters: () => void
  movements: AccountingMovement[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  loading: boolean
  error: string | null
  canCreate: boolean
  fiscalYearOpen: boolean
  onCreateClick: () => void
  onMovementClick: (movement: AccountingMovement) => void
}

function MovementRow({
  movement,
  onClick
}: {
  movement: AccountingMovement
  onClick: () => void
}) {
  const system = isSystemMovementOrigin(movement.origin)
  return (
    <tr
      className="cursor-pointer hover:bg-slate-50"
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
        {new Date(movement.movement_date).toLocaleDateString('it-IT')}
      </td>
      <td className="px-4 py-3 text-sm text-slate-900">{movement.description}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${movementDirectionBadgeClass(movement.direction)}`}
        >
          {movementDirectionLabel(movement.direction)}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
        {formatFeeAmount(movement.amount_cents)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {movement.account ? `${movement.account.code} — ${movement.account.name}` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {movement.category ? `${movement.category.code} — ${movement.category.name}` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1">
          {movementOriginLabel(movement.origin)}
          {system && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
              Sync
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${movementStatusBadgeClass(movement.status)}`}
        >
          {movementStatusLabel(movement.status)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {paymentMethodLabel(movement.payment_method_raw)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{formatDocumentLabel(movement)}</td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {formatPaymentReferenceLabel(movement)}
      </td>
    </tr>
  )
}

function MovementCard({
  movement,
  onClick
}: {
  movement: AccountingMovement
  onClick: () => void
}) {
  const system = isSystemMovementOrigin(movement.origin)
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brixia-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{movement.description}</p>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(movement.movement_date).toLocaleDateString('it-IT')}
          </p>
        </div>
        <p className="text-lg font-bold text-slate-900">{formatFeeAmount(movement.amount_cents)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${movementDirectionBadgeClass(movement.direction)}`}
        >
          {movementDirectionLabel(movement.direction)}
        </span>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${movementStatusBadgeClass(movement.status)}`}
        >
          {movementStatusLabel(movement.status)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-1 text-sm text-slate-600">
        <div>
          <span className="text-slate-500">Conto: </span>
          {movement.account ? `${movement.account.code} — ${movement.account.name}` : '—'}
        </div>
        <div>
          <span className="text-slate-500">Categoria: </span>
          {movement.category ? `${movement.category.code} — ${movement.category.name}` : '—'}
        </div>
        <div>
          <span className="text-slate-500">Origine: </span>
          {movementOriginLabel(movement.origin)}
          {system && ' · Sync'}
        </div>
        <div>
          <span className="text-slate-500">Metodo: </span>
          {paymentMethodLabel(movement.payment_method_raw)}
        </div>
        <div>
          <span className="text-slate-500">Documento: </span>
          {formatDocumentLabel(movement)}
        </div>
        <div>
          <span className="text-slate-500">Rif. pagamento: </span>
          {formatPaymentReferenceLabel(movement)}
        </div>
      </dl>
    </button>
  )
}

export function MovementsTab({
  accounts,
  filters,
  onFiltersChange,
  onResetFilters,
  movements,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  error,
  canCreate,
  fiscalYearOpen,
  onCreateClick,
  onMovementClick
}: MovementsTabProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters =
    filters.search ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.direction !== 'all' ||
    filters.status !== 'all' ||
    filters.accountId !== 'all'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div />
        {canCreate && (
          <button
            type="button"
            onClick={onCreateClick}
            disabled={!fiscalYearOpen}
            title={
              fiscalYearOpen
                ? 'Crea nuova bozza'
                : 'Disponibile solo con esercizio aperto'
            }
            className="inline-flex items-center gap-2 rounded-lg bg-brixia-primary px-4 py-2 text-sm font-medium text-white hover:bg-brixia-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Nuovo movimento
          </button>
        )}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Cerca</label>
            <input
              type="search"
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              placeholder="Descrizione, riferimento, metodo..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Da</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onFiltersChange({ dateFrom: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">A</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFiltersChange({ dateTo: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Direzione</label>
            <select
              value={filters.direction}
              onChange={(e) =>
                onFiltersChange({ direction: e.target.value as MovementDirection | 'all' })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Tutte</option>
              <option value="income">Entrata</option>
              <option value="expense">Uscita</option>
              <option value="reversal">Storno</option>
              <option value="transfer">Giroconto</option>
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
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Conto</label>
            <select
              value={filters.accountId}
              onChange={(e) => onFiltersChange({ accountId: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm min-w-[140px]"
            >
              <option value="all">Tutti</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} — {acc.name}
                </option>
              ))}
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
          Caricamento movimenti...
        </div>
      ) : movements.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-slate-700 font-medium">Nessun movimento trovato</p>
          <p className="mt-1 text-sm text-slate-500">
            Crea un movimento manuale o attendi la sincronizzazione dalle quote.
          </p>
          {canCreate && fiscalYearOpen && (
            <button
              type="button"
              onClick={onCreateClick}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brixia-primary px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Nuovo movimento
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      'Data',
                      'Descrizione',
                      'Direzione',
                      'Importo',
                      'Conto',
                      'Categoria',
                      'Origine',
                      'Stato',
                      'Metodo',
                      'Documento',
                      'Rif. pagamento'
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
                  {movements.map((m) => (
                    <MovementRow key={m.id} movement={m} onClick={() => onMovementClick(m)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:hidden">
            {movements.map((m) => (
              <MovementCard key={m.id} movement={m} onClick={() => onMovementClick(m)} />
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-slate-600">
              {total} movimenti · pagina {page} di {totalPages}
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
