import { RefreshCw } from 'lucide-react'
import type { AccountingAuditLogRow } from '../types'

interface AuditTabProps {
  rows: AccountingAuditLogRow[]
  loading: boolean
  error: string | null
  canView: boolean
  onRefresh: () => void
}

export function AuditTab({ rows, loading, error, canView, onRefresh }: AuditTabProps) {
  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Serve il permesso accounting.audit_view per consultare l&apos;audit.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Audit Contabilità</h2>
          <p className="mt-1 text-sm text-slate-500">
            Chi ha fatto cosa, quando e perché. Vista sui log esistenti — nessun duplicato.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Aggiorna
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">Chi</th>
              <th className="px-3 py-2">Azione</th>
              <th className="px-3 py-2">Entità</th>
              <th className="px-3 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Nessun evento audit.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                    {new Date(row.occurred_at).toLocaleString('it-IT')}
                  </td>
                  <td className="px-3 py-2">{row.actor_display_name ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{row.action_label}</div>
                    <div className="text-xs text-slate-400">{row.action}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {row.entity_type}
                    <div className="font-mono text-[11px] text-slate-400">{row.entity_id}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.reason ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
