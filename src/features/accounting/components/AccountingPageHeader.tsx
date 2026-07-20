import { RefreshCw } from 'lucide-react'
import type { AccountingFiscalYear } from '../types'
import { fiscalYearStatusBadgeClass, fiscalYearStatusLabel } from '../utils/labels'

interface AccountingPageHeaderProps {
  fiscalYears: AccountingFiscalYear[]
  selectedFiscalYear: AccountingFiscalYear | null
  onFiscalYearChange: (id: string) => void
  refreshing: boolean
  lastUpdatedAt: Date | null
  onRefresh: () => void
}

export function AccountingPageHeader({
  fiscalYears,
  selectedFiscalYear,
  onFiscalYearChange,
  refreshing,
  lastUpdatedAt,
  onRefresh
}: AccountingPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white">Contabilità</h1>
        <p className="mt-1 text-sm text-white/70">
          Prima nota, crediti da quote e stato sincronizzazione
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="accounting-fy" className="text-sm text-white/70 shrink-0">
            Esercizio
          </label>
          <select
            id="accounting-fy"
            value={selectedFiscalYear?.id ?? ''}
            onChange={(e) => onFiscalYearChange(e.target.value)}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white min-w-[140px]"
            disabled={fiscalYears.length === 0}
          >
            {fiscalYears.length === 0 ? (
              <option value="">Nessun esercizio</option>
            ) : (
              fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id} className="text-slate-900">
                  {fy.code}
                </option>
              ))
            )}
          </select>
          {selectedFiscalYear && (
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${fiscalYearStatusBadgeClass(selectedFiscalYear.status)}`}
            >
              {fiscalYearStatusLabel(selectedFiscalYear.status)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brixia-primary px-4 py-2 text-sm font-medium text-white hover:bg-brixia-primary/90 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Aggiorna
        </button>

        {lastUpdatedAt && (
          <p className="text-xs text-white/60 sm:w-full lg:w-auto lg:text-right">
            Ultimo aggiornamento:{' '}
            {lastUpdatedAt.toLocaleString('it-IT', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        )}
      </div>
    </div>
  )
}
