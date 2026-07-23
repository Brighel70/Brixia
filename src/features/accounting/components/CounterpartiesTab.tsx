import { useMemo, useState } from 'react'
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react'
import type { AccountingCounterparty, CounterpartyKind } from '../types'
import type { CounterpartyWriteInput } from '../api/counterparties.api'
import {
  ALL_COUNTERPARTY_KINDS,
  COUNTERPARTY_KIND_LABELS,
  counterpartyKindGroup,
  counterpartyKindLabel
} from '../utils/counterpartyLabels'
import {
  CounterpartyFormModal,
  counterpartyToFormValues,
  type CounterpartyFormValues
} from './CounterpartyFormModal'

interface CounterpartiesTabProps {
  rows: AccountingCounterparty[]
  loading: boolean
  error: string | null
  saving: boolean
  canCreate: boolean
  canEdit: boolean
  onCreate: (input: CounterpartyWriteInput) => Promise<AccountingCounterparty>
  onUpdate: (id: string, input: CounterpartyWriteInput) => Promise<AccountingCounterparty>
  onArchive: (id: string) => Promise<void>
  onReactivate: (id: string) => Promise<void>
}

type StatusFilter = 'active' | 'archived' | 'all'
type RoleFilter = 'all' | 'receivable' | 'payable'

export function CounterpartiesTab({
  rows,
  loading,
  error,
  saving,
  canCreate,
  canEdit,
  onCreate,
  onUpdate,
  onArchive,
  onReactivate
}: CounterpartiesTabProps) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<CounterpartyKind | ''>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formInitial, setFormInitial] = useState<Partial<CounterpartyFormValues>>()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const archived = !!r.archived_at
      if (statusFilter === 'active' && archived) return false
      if (statusFilter === 'archived' && !archived) return false
      if (kindFilter && r.kind !== kindFilter) return false
      if (roleFilter !== 'all') {
        const group = counterpartyKindGroup(r.kind)
        if (roleFilter === 'receivable' && group === 'payable') return false
        if (roleFilter === 'payable' && group === 'receivable') return false
        if (roleFilter === 'receivable' && group === 'other') {
          // enti/federazioni restano visibili in entrambe le viste “ampie”
        }
        if (roleFilter === 'payable' && group === 'other') {
          // same
        }
      }
      if (!q) return true
      const hay = [
        r.display_name,
        r.company_name,
        r.given_name,
        r.family_name,
        r.vat_number,
        r.tax_code,
        r.email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search, kindFilter, statusFilter, roleFilter])

  const openCreate = () => {
    setFormMode('create')
    setEditingId(null)
    setFormInitial({ kind: 'sponsor' })
    setFormOpen(true)
  }

  const openEdit = (row: AccountingCounterparty) => {
    setFormMode('edit')
    setEditingId(row.id)
    setFormInitial(counterpartyToFormValues(row))
    setFormOpen(true)
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow-sm">
        Caricamento anagrafica…
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

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Anagrafica controparti</h2>
            <p className="mt-1 text-sm text-slate-500">
              Soggetti a cui emetti fatture/ricevute (sponsor, clienti) e soggetti a cui paghi
              (fornitori, collaboratori). Separata dall&apos;anagrafica Quote.
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              disabled={saving}
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Nuova controparte
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Cerca nome, P.IVA, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          >
            <option value="all">Tutti i ruoli</option>
            <option value="receivable">A cui emettiamo</option>
            <option value="payable">A cui paghiamo</option>
          </select>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as CounterpartyKind | '')}
          >
            <option value="">Tutti i tipi</option>
            {ALL_COUNTERPARTY_KINDS.map((k) => (
              <option key={k} value={k}>
                {COUNTERPARTY_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="active">Attive</option>
            <option value="archived">Archiviate</option>
            <option value="all">Tutte</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">P. IVA / CF</th>
                <th className="px-4 py-3 font-medium">Contatti</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Nessuna controparte. Crea sponsor, clienti o fornitori per usarli nei documenti.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const archived = !!r.archived_at
                  return (
                    <tr key={r.id} className={archived ? 'bg-slate-50/80 text-slate-500' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{r.display_name}</div>
                        {r.company_name && r.company_name !== r.display_name ? (
                          <div className="text-xs text-slate-500">{r.company_name}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{counterpartyKindLabel(r.kind)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {r.vat_number || r.tax_code || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.email || r.phone || r.pec || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {archived ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                            Archiviata
                          </span>
                        ) : r.is_active ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Attiva
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Inattiva
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canEdit && !archived && (
                            <button
                              type="button"
                              disabled={saving}
                              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil className="h-3 w-3" />
                              Modifica
                            </button>
                          )}
                          {canEdit && !archived && (
                            <button
                              type="button"
                              disabled={saving}
                              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 disabled:opacity-40"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Archiviare «${r.display_name}»? Non comparirà più nei menu di selezione.`
                                  )
                                ) {
                                  void onArchive(r.id)
                                }
                              }}
                            >
                              <Archive className="h-3 w-3" />
                              Archivia
                            </button>
                          )}
                          {canEdit && archived && (
                            <button
                              type="button"
                              disabled={saving}
                              className="inline-flex items-center gap-1 rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-800 disabled:opacity-40"
                              onClick={() => void onReactivate(r.id)}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Riattiva
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <CounterpartyFormModal
        isOpen={formOpen}
        mode={formMode}
        initialValues={formInitial}
        saving={saving}
        onClose={() => {
          setFormOpen(false)
          setEditingId(null)
        }}
        onSubmit={async (input) => {
          if (formMode === 'create') {
            await onCreate(input)
          } else if (editingId) {
            await onUpdate(editingId, input)
          }
          setFormOpen(false)
          setEditingId(null)
        }}
      />
    </div>
  )
}
