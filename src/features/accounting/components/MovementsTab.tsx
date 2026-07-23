import { ArrowRightLeft, ChevronDown, FileText, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { formatFeeAmount } from '@/utils/feeUtils'
import type {
  AccountingAccountRef,
  AccountingMovement,
  MovementsFilterState,
  MovementDirection,
  MovementStatus
} from '../types'
import { formatDocumentLabel, paymentMethodLabel } from '../utils/movementFormOptions'
import {
  movementDirectionBadgeClass,
  movementDirectionLabel,
  movementStatusBadgeClass,
  movementStatusLabel
} from '../utils/labels'

const COL_CATEGORIA = 'min-w-[16rem] w-[22%] px-4 py-3 text-sm text-slate-600'

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
  canExport: boolean
  fiscalYearOpen: boolean
  onCreateClick: () => void
  onCreateTransferClick: () => void
  pdfGenerating: boolean
  onGeneratePdf: () => Promise<void>
  onMovementClick: (movement: AccountingMovement) => void
}

function MovementRow({
  movement,
  onClick
}: {
  movement: AccountingMovement
  onClick: () => void
}) {
  const accountLabel =
    movement.direction === 'transfer' && movement.transfer_account
      ? `${movement.account?.name ?? '—'} -> ${movement.transfer_account.name}`
      : movement.account?.name ?? '—'

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
        {accountLabel}
      </td>
      <td className={COL_CATEGORIA}>
        {movement.category ? `${movement.category.code} — ${movement.category.name}` : '—'}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${movementStatusBadgeClass(movement.status)}`}
          title={`Stato tecnico: ${movement.status}`}
          translate="no"
        >
          {movementStatusLabel(movement.status)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {paymentMethodLabel(movement.payment_method_raw)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {formatDocumentLabel(movement)}
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
  const accountLabel =
    movement.direction === 'transfer' && movement.transfer_account
      ? `${movement.account?.name ?? '—'} -> ${movement.transfer_account.name}`
      : movement.account?.name ?? '—'

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-primary/40"
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
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${movementStatusBadgeClass(movement.status)}`}
          title={`Stato tecnico: ${movement.status}`}
          translate="no"
        >
          {movementStatusLabel(movement.status)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-1 text-sm text-slate-600">
        <div>
          <span className="text-slate-500">Conto: </span>
          {accountLabel}
        </div>
        <div>
          <span className="text-slate-500">Categoria: </span>
          {movement.category ? `${movement.category.code} — ${movement.category.name}` : '—'}
        </div>
        <div>
          <span className="text-slate-500">Metodo: </span>
          {paymentMethodLabel(movement.payment_method_raw)}
        </div>
        <div>
          <span className="text-slate-500">Documento: </span>
          {formatDocumentLabel(movement)}
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
  canExport,
  fiscalYearOpen,
  onCreateClick,
  onCreateTransferClick,
  pdfGenerating,
  onGeneratePdf,
  onMovementClick
}: MovementsTabProps) {
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
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
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <button
              type="button"
              onClick={() => void onGeneratePdf()}
              disabled={pdfGenerating || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {pdfGenerating ? 'Generazione PDF...' : 'Genera PDF'}
            </button>
          )}
          {canCreate && (
            <div className="relative">
            <button
              type="button"
              onClick={() => setCreateMenuOpen((open) => !open)}
              disabled={!fiscalYearOpen}
              title={fiscalYearOpen ? 'Crea una nuova bozza' : 'Disponibile solo con esercizio aperto'}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Nuova registrazione
              <ChevronDown className="h-4 w-4" />
            </button>
            {createMenuOpen && fiscalYearOpen && (
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    onCreateClick()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4 text-emerald-600" />
                  Entrata o uscita
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    onCreateTransferClick()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-blue-50"
                >
                  <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                  Giroconto tra conti
                </button>
              </div>
            )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block whitespace-nowrap text-xs font-medium text-slate-600" translate="no">
              Cerca
            </label>
            <input
              type="search"
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              placeholder="Cerca in tutte le colonne..."
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
            <label className="mb-1 block text-xs font-medium text-slate-600">Al</label>
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
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white"
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
                      'Stato',
                      'Metodo',
                      'Documento'
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500${
                          h === 'Categoria' ? ' min-w-[16rem] w-[22%]' : ''
                        }`}
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
