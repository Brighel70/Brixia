import { useMemo, useState } from 'react'
import { CheckCircle2, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatFeeAmount } from '@/utils/feeUtils'
import type {
  AccountingBudget,
  AccountingBudgetLine,
  AccountingCategoryRef,
  AccountingFiscalYear,
  BudgetComparisonRow,
  BudgetOverviewTotals
} from '../types'
import {
  BudgetLineFormModal,
  budgetLineToFormValues,
  type BudgetLineFormValues
} from './BudgetLineFormModal'

interface BudgetTabProps {
  fiscalYear: AccountingFiscalYear | null
  budget: AccountingBudget | null
  lines: AccountingBudgetLine[]
  comparisonRows: BudgetComparisonRow[]
  totals: BudgetOverviewTotals | null
  categories: AccountingCategoryRef[]
  loading: boolean
  error: string | null
  saving: boolean
  canCreate: boolean
  canEditDraft: boolean
  canApprove: boolean
  onCreateBudget: () => Promise<void>
  onSaveNotes: (notes: string) => Promise<void>
  onApprove: () => Promise<void>
  onArchive: () => Promise<void>
  onCreateLine: (values: BudgetLineFormValues, amountCents: number) => Promise<void>
  onUpdateLine: (
    lineId: string,
    values: BudgetLineFormValues,
    amountCents: number
  ) => Promise<void>
  onDeleteLine: (lineId: string) => Promise<void>
}

function statusBadge(status: AccountingBudget['status']) {
  if (status === 'draft') return 'bg-amber-100 text-amber-800'
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800'
  return 'bg-slate-100 text-slate-700'
}

function statusLabel(status: AccountingBudget['status']) {
  if (status === 'draft') return 'Bozza'
  if (status === 'approved') return 'Approvato'
  return 'Archiviato'
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

export function BudgetTab({
  fiscalYear,
  budget,
  lines,
  comparisonRows,
  totals,
  categories,
  loading,
  error,
  saving,
  canCreate,
  canEditDraft,
  canApprove,
  onCreateBudget,
  onSaveNotes,
  onApprove,
  onArchive,
  onCreateLine,
  onUpdateLine,
  onDeleteLine
}: BudgetTabProps) {
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [lineFormOpen, setLineFormOpen] = useState(false)
  const [lineFormMode, setLineFormMode] = useState<'create' | 'edit'>('create')
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [lineFormInitial, setLineFormInitial] = useState<Partial<BudgetLineFormValues>>()
  const [confirmApprove, setConfirmApprove] = useState(false)

  const notesValue = notesDraft ?? budget?.notes ?? ''
  const isDraft = budget?.status === 'draft'
  const isApproved = budget?.status === 'approved'
  const canEdit = !!isDraft && canEditDraft

  const incomeRows = useMemo(
    () => comparisonRows.filter((r) => r.direction === 'income' && r.source !== 'actual_only'),
    [comparisonRows]
  )
  const expenseRows = useMemo(
    () => comparisonRows.filter((r) => r.direction === 'expense' && r.source !== 'actual_only'),
    [comparisonRows]
  )

  const openCreateLine = () => {
    setLineFormMode('create')
    setEditingLineId(null)
    setLineFormInitial({ direction: 'expense' })
    setLineFormOpen(true)
  }

  const openEditLine = (line: AccountingBudgetLine) => {
    setLineFormMode('edit')
    setEditingLineId(line.id)
    setLineFormInitial(budgetLineToFormValues(line))
    setLineFormOpen(true)
  }

  const handleLineSubmit = async (values: BudgetLineFormValues, amountCents: number) => {
    if (lineFormMode === 'create') {
      await onCreateLine(values, amountCents)
    } else if (editingLineId) {
      await onUpdateLine(editingLineId, values, amountCents)
    }
    setLineFormOpen(false)
    setEditingLineId(null)
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow-sm">
        Caricamento preventivo...
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

  if (!budget) {
    return (
      <div className="rounded-xl bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Nessun preventivo</h2>
        <p className="mt-2 text-sm text-slate-600">
          Per l&apos;esercizio <strong>{fiscalYear.code}</strong> non esiste ancora un bilancio
          preventivo. Le Quote assegnate verranno integrate automaticamente tra le entrate
          previste.
        </p>
        {canCreate ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void onCreateBudget()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brixia-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Crea preventivo
          </button>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Serve il permesso <code className="text-xs">accounting.create</code> per creare il
            preventivo.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{budget.name}</h2>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(budget.status)}`}
              >
                {statusLabel(budget.status)}
              </span>
              <span className="text-xs text-slate-500">v{budget.version}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Esercizio {fiscalYear.code}
              {isApproved && budget.approved_at
                ? ` · Approvato il ${new Date(budget.approved_at).toLocaleDateString('it-IT')}`
                : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={openCreateLine}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-brixia-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Aggiungi voce
              </button>
            )}
            {isDraft && canApprove && (
              <button
                type="button"
                onClick={() => setConfirmApprove(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approva
              </button>
            )}
            {isApproved && canApprove && (
              <button
                type="button"
                onClick={() => void onArchive()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                <Lock className="h-4 w-4" />
                Nuova versione in bozza
              </button>
            )}
          </div>
        </div>

        {totals && (
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Entrate previste" value={formatFeeAmount(totals.plannedIncomeCents)} tone="emerald" />
            <Kpi label="Uscite previste" value={formatFeeAmount(totals.plannedExpenseCents)} tone="rose" />
            <Kpi
              label="Avanzo / disavanzo previsto"
              value={formatSignedCents(totals.plannedSurplusCents)}
              tone={totals.plannedSurplusCents >= 0 ? 'emerald' : 'rose'}
            />
            <Kpi
              label="Scostamento saldo"
              value={formatSignedCents(totals.surplusVarianceCents)}
              tone="slate"
              hint="Saldo reale − avanzo previsto"
            />
            <Kpi label="Entrate effettive" value={formatFeeAmount(totals.actualIncomeCents)} tone="slate" />
            <Kpi label="Uscite effettive" value={formatFeeAmount(totals.actualExpenseCents)} tone="slate" />
            <Kpi
              label="% realizzazione entrate"
              value={formatPercent(totals.incomeRealizationPercent)}
              tone="slate"
            />
            <Kpi
              label="% realizzazione uscite"
              value={formatPercent(totals.expenseRealizationPercent)}
              tone="slate"
            />
          </dl>
        )}

        {totals && totals.unattributedReversalCents > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Storni non attribuiti (senza movimento originale collegato):{' '}
            {formatFeeAmount(totals.unattributedReversalCents)}. Da verificare in Prima nota.
          </div>
        )}
      </div>

      <Section title="Entrate previste">
        <LinesTable
          rows={incomeRows}
          canEdit={canEdit}
          lines={lines}
          onEdit={openEditLine}
          onDelete={(id) => void onDeleteLine(id)}
          saving={saving}
        />
      </Section>

      <Section title="Uscite previste">
        <LinesTable
          rows={expenseRows}
          canEdit={canEdit}
          lines={lines}
          onEdit={openEditLine}
          onDelete={(id) => void onDeleteLine(id)}
          saving={saving}
        />
        {expenseRows.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">Nessuna uscita prevista inserita.</p>
        )}
      </Section>

      <Section title="Confronto preventivo / reale">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Categoria', 'Descrizione', 'Previsto', 'Effettivo', 'Scostamento', '% scost.', '% real.'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisonRows.map((row) => (
                <tr key={row.key} className="text-sm">
                  <td className="px-3 py-2 text-slate-700">
                    {row.categoryCode}
                    {row.source === 'fees_live' && (
                      <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
                        Auto
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.description}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {formatFeeAmount(row.plannedCents)}
                  </td>
                  <td className="px-3 py-2 text-slate-900">{formatFeeAmount(row.actualCents)}</td>
                  <td
                    className={`px-3 py-2 font-medium ${
                      row.varianceCents > 0
                        ? 'text-emerald-700'
                        : row.varianceCents < 0
                          ? 'text-rose-700'
                          : 'text-slate-700'
                    }`}
                  >
                    {formatSignedCents(row.varianceCents)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{formatPercent(row.variancePercent)}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {formatPercent(row.realizationPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-2 md:hidden">
          {comparisonRows.map((row) => (
            <div key={`m-${row.key}`} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-900">
                {row.categoryCode} · {row.description}
              </p>
              <p className="mt-1 text-slate-600">
                Previsto {formatFeeAmount(row.plannedCents)} · Effettivo{' '}
                {formatFeeAmount(row.actualCents)}
              </p>
              <p className="text-slate-600">
                Scostamento {formatSignedCents(row.varianceCents)} (
                {formatPercent(row.variancePercent)})
              </p>
            </div>
          ))}
        </div>
      </Section>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Note preventivo</h3>
        <textarea
          rows={3}
          value={notesValue}
          disabled={!canEdit || saving}
          onChange={(e) => setNotesDraft(e.target.value)}
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50"
          placeholder="Note di pianificazione…"
        />
        {canEdit && (
          <button
            type="button"
            disabled={saving || notesDraft === null}
            onClick={() => void onSaveNotes(notesValue).then(() => setNotesDraft(null))}
            className="mt-3 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Salva note
          </button>
        )}
      </div>

      {confirmApprove && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4 text-slate-900">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmApprove(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Confermare approvazione?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Dopo l&apos;approvazione il preventivo non sarà più modificabile. Le Quote
              continueranno ad aggiornarsi in sola lettura dai crediti.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                onClick={() => setConfirmApprove(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  setConfirmApprove(false)
                  void onApprove()
                }}
              >
                Approva preventivo
              </button>
            </div>
          </div>
        </div>
      )}

      <BudgetLineFormModal
        isOpen={lineFormOpen}
        mode={lineFormMode}
        categories={categories}
        initialValues={lineFormInitial}
        saving={saving}
        onClose={() => {
          if (!saving) setLineFormOpen(false)
        }}
        onSubmit={handleLineSubmit}
      />
    </div>
  )
}

function Kpi({
  label,
  value,
  tone,
  hint
}: {
  label: string
  value: string
  tone: 'emerald' | 'rose' | 'slate'
  hint?: string
}) {
  const valueClass =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'rose'
        ? 'text-rose-700'
        : 'text-slate-900'
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 text-lg font-bold ${valueClass}`}>{value}</dd>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function LinesTable({
  rows,
  canEdit,
  lines,
  onEdit,
  onDelete,
  saving
}: {
  rows: BudgetComparisonRow[]
  canEdit: boolean
  lines: AccountingBudgetLine[]
  onEdit: (line: AccountingBudgetLine) => void
  onDelete: (lineId: string) => void
  saving: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Nessuna voce.</p>
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full table-fixed divide-y divide-slate-200">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[28%]" />
            <col className="w-[12%]" />
            <col className="w-[28%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-slate-50">
            <tr>
              {['Categoria', 'Descrizione', 'Previsto', 'Dettaglio', ''].map((h) => (
                <th
                  key={h || 'actions'}
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const line = row.lineId ? lines.find((l) => l.id === row.lineId) : null
              return (
                <tr key={row.key} className="text-sm">
                  <td className="px-3 py-2 text-slate-700 break-words">
                    {row.categoryCode} — {row.categoryName}
                  </td>
                  <td className="px-3 py-2 text-slate-900 break-words">{row.description}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">
                    {formatFeeAmount(row.plannedCents)}
                  </td>
                  <td className="px-3 py-2 text-slate-500 break-words">
                    {row.source === 'fees_live' ? (
                      <span className="text-xs leading-snug">
                        Calcolata automaticamente dalle Quote · Incassato{' '}
                        {formatFeeAmount(row.feesCollectedCents ?? 0)} · Da incassare{' '}
                        {formatFeeAmount(row.feesResidualCents ?? 0)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {row.source === 'fees_live' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-700">
                        <Lock className="h-3.5 w-3.5" />
                        Auto
                      </span>
                    ) : canEdit && line ? (
                      <span className="inline-flex gap-1">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onEdit(line)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                          aria-label="Modifica"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            if (window.confirm('Eliminare questa voce di preventivo?')) {
                              onDelete(line.id)
                            }
                          }}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                          aria-label="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((row) => {
          const line = row.lineId ? lines.find((l) => l.id === row.lineId) : null
          return (
            <div key={`card-${row.key}`} className="rounded-lg border border-slate-200 p-3">
              <p className="font-medium text-slate-900">{row.description}</p>
              <p className="text-sm text-slate-500">
                {row.categoryCode} · {formatFeeAmount(row.plannedCents)}
              </p>
              {row.source === 'fees_live' && (
                <p className="mt-1 text-xs text-blue-700">
                  Calcolata automaticamente dalle Quote (non modificabile)
                </p>
              )}
              {canEdit && line && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="text-sm text-brixia-primary"
                    onClick={() => onEdit(line)}
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    className="text-sm text-rose-600"
                    onClick={() => {
                      if (window.confirm('Eliminare questa voce?')) onDelete(line.id)
                    }}
                  >
                    Elimina
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
