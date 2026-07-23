import { useMemo, useState } from 'react'
import { CheckCircle2, Plus, RefreshCw, Upload, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { formatFeeAmount } from '@/utils/feeUtils'
import type {
  AccountingAccountRef,
  AccountingBankStatementLine,
  AccountingFiscalYear,
  AccountingReconciliationSession,
  AccountingReconciliationSummary,
  ReconciliationCandidateMovement,
  ReconciliationCsvImportResult
} from '../types'
import { movementDirectionLabel } from '../utils/labels'

interface CreateSessionValues {
  accountId: string
  periodStart: string
  periodEnd: string
  openingBalanceEuros: string
  closingBalanceEuros: string
  notes: string
}

interface AddLineValues {
  lineDate: string
  amountEuros: string
  description: string
  reference: string
  externalId: string
}

interface ReconciliationTabProps {
  fiscalYear: AccountingFiscalYear | null
  accounts: AccountingAccountRef[]
  sessions: AccountingReconciliationSession[]
  selectedSessionId: string | null
  lines: AccountingBankStatementLine[]
  summary: AccountingReconciliationSummary | null
  candidates: ReconciliationCandidateMovement[]
  loading: boolean
  saving: boolean
  error: string | null
  canVerify: boolean
  onSelectSession: (sessionId: string | null) => void
  onRefresh: () => void
  onCreateSession: (input: {
    accountId: string
    periodStart: string
    periodEnd: string
    openingBalanceCents: number
    closingBalanceStatementCents: number
    notes: string | null
  }) => Promise<void>
  onAddLine: (input: {
    lineDate: string
    amountCents: number
    description: string
    reference: string | null
    externalId: string | null
  }) => Promise<void>
  onImportCsv: (csv: string) => Promise<ReconciliationCsvImportResult>
  onMatch: (lineId: string, movementId: string) => Promise<void>
  onUnmatch: (lineId: string) => Promise<void>
  onExclude: (lineId: string, reason: string) => Promise<void>
  onComplete: () => Promise<void>
  onCancel: (reason: string | null) => Promise<void>
}

function parseSignedEurosToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100)
}

function formatSignedCents(cents: number): string {
  const formatted = formatFeeAmount(Math.abs(cents))
  if (cents > 0) return `+${formatted}`
  if (cents < 0) return `−${formatted}`
  return formatted
}

function sessionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Bozza',
    in_progress: 'In corso',
    completed: 'Completata',
    cancelled: 'Annullata'
  }
  return map[status] ?? status
}

function sessionStatusClass(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-amber-100 text-amber-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-gray-200 text-gray-600'
  }
  return map[status] ?? 'bg-slate-100 text-slate-700'
}

function matchStatusLabel(status: string): string {
  const map: Record<string, string> = {
    unmatched: 'Da abbinare',
    matched: 'Abbinata',
    excluded: 'Esclusa'
  }
  return map[status] ?? status
}

function accountKindLabel(kind: string | undefined): string {
  if (kind === 'cash') return 'Cassa'
  if (kind === 'bank') return 'Banca'
  return kind ?? '—'
}

export function ReconciliationTab({
  fiscalYear,
  accounts,
  sessions,
  selectedSessionId,
  lines,
  summary,
  candidates,
  loading,
  saving,
  error,
  canVerify,
  onSelectSession,
  onRefresh,
  onCreateSession,
  onAddLine,
  onImportCsv,
  onMatch,
  onUnmatch,
  onExclude,
  onComplete,
  onCancel
}: ReconciliationTabProps) {
  const cashBankAccounts = useMemo(
    () => accounts.filter((a) => a.kind === 'cash' || a.kind === 'bank'),
    [accounts]
  )

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  const sessionEditable =
    !!selectedSession &&
    (selectedSession.status === 'draft' || selectedSession.status === 'in_progress')

  const [createForm, setCreateForm] = useState<CreateSessionValues>(() => ({
    accountId: '',
    periodStart: fiscalYear?.starts_on ?? '',
    periodEnd: fiscalYear?.ends_on ?? '',
    openingBalanceEuros: '0,00',
    closingBalanceEuros: '0,00',
    notes: ''
  }))
  const [showCreate, setShowCreate] = useState(false)

  const [lineForm, setLineForm] = useState<AddLineValues>({
    lineDate: '',
    amountEuros: '',
    description: '',
    reference: '',
    externalId: ''
  })
  const [csvText, setCsvText] = useState('')
  const [matchMovementByLine, setMatchMovementByLine] = useState<Record<string, string>>({})

  const handleCreate = async () => {
    if (!createForm.accountId) {
      toast.error('Seleziona un conto cassa o banca')
      return
    }
    if (!createForm.periodStart || !createForm.periodEnd) {
      toast.error('Periodo obbligatorio')
      return
    }
    if (createForm.periodEnd < createForm.periodStart) {
      toast.error('La data fine deve essere successiva o uguale alla data inizio')
      return
    }
    const opening = parseSignedEurosToCents(createForm.openingBalanceEuros)
    const closing = parseSignedEurosToCents(createForm.closingBalanceEuros)
    if (opening === null || closing === null) {
      toast.error('Saldi non validi (usa formato italiano, es. 1.234,56)')
      return
    }
    try {
      await onCreateSession({
        accountId: createForm.accountId,
        periodStart: createForm.periodStart,
        periodEnd: createForm.periodEnd,
        openingBalanceCents: opening,
        closingBalanceStatementCents: closing,
        notes: createForm.notes.trim() || null
      })
      toast.success('Sessione di riconciliazione creata')
      setShowCreate(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Creazione non riuscita')
    }
  }

  const handleAddLine = async () => {
    const amountCents = parseSignedEurosToCents(lineForm.amountEuros)
    if (!lineForm.lineDate) {
      toast.error('Data riga obbligatoria')
      return
    }
    if (amountCents === null || amountCents === 0) {
      toast.error('Importo obbligatorio e diverso da zero')
      return
    }
    try {
      await onAddLine({
        lineDate: lineForm.lineDate,
        amountCents,
        description: lineForm.description.trim(),
        reference: lineForm.reference.trim() || null,
        externalId: lineForm.externalId.trim() || null
      })
      toast.success('Riga estratto aggiunta')
      setLineForm({
        lineDate: '',
        amountEuros: '',
        description: '',
        reference: '',
        externalId: ''
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Inserimento non riuscito')
    }
  }

  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      toast.error('Incolla il CSV da importare')
      return
    }
    try {
      const result = await onImportCsv(csvText)
      toast.success(
        `Import CSV: ${result.imported} importate, ${result.skipped} saltate` +
          (result.errors?.length ? `, ${result.errors.length} errori` : '')
      )
      setCsvText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import non riuscito')
    }
  }

  const handleMatch = async (lineId: string) => {
    const movementId = matchMovementByLine[lineId]
    if (!movementId) {
      toast.error('Seleziona un movimento candidato')
      return
    }
    try {
      await onMatch(lineId, movementId)
      toast.success('Riga abbinata')
      setMatchMovementByLine((prev) => {
        const next = { ...prev }
        delete next[lineId]
        return next
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Abbinamento non riuscito')
    }
  }

  const handleExclude = async (lineId: string) => {
    const reason = window.prompt('Motivazione esclusione (obbligatoria):')
    if (reason === null) return
    if (!reason.trim()) {
      toast.error('Motivazione obbligatoria')
      return
    }
    try {
      await onExclude(lineId, reason.trim())
      toast.success('Riga esclusa')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Esclusione non riuscita')
    }
  }

  const handleComplete = async () => {
    if (
      !window.confirm(
        'Completare la riconciliazione?\n\nTutte le righe devono essere abbinate o escluse.'
      )
    ) {
      return
    }
    try {
      await onComplete()
      toast.success('Sessione completata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Completamento non riuscito')
    }
  }

  const handleCancel = async () => {
    const reason = window.prompt('Motivazione annullamento (opzionale):')
    if (reason === null) return
    if (!window.confirm('Annullare questa sessione di riconciliazione?')) return
    try {
      await onCancel(reason.trim() || null)
      toast.success('Sessione annullata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Annullamento non riuscito')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Riconciliazione banca / cassa</h2>
          <p className="mt-1 text-sm text-slate-500">
            Confronta l&apos;estratto conto o cassa con i movimenti TeamFlow. Il saldo gestionale
            non è un saldo bancario riconciliato finché la sessione non è completata.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </button>
          {canVerify && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90"
            >
              <Plus className="h-4 w-4" />
              Nuova sessione
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Il saldo gestionale (prima nota / consuntivo) non coincide necessariamente con il saldo
        bancario riconciliato. Usa questa scheda per allineare estratto e movimenti.
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!canVerify && (
        <p className="text-sm text-slate-500">
          Per creare sessioni, importare righe e abbinare movimenti serve il permesso
          accounting.verify.
        </p>
      )}

      {showCreate && canVerify && (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Nuova sessione</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Conto (cassa / banca)</span>
              <select
                value={createForm.accountId}
                onChange={(e) => setCreateForm((f) => ({ ...f, accountId: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Seleziona…</option>
                {cashBankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name} ({accountKindLabel(a.kind)})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Periodo dal</span>
              <input
                type="date"
                value={createForm.periodStart}
                onChange={(e) => setCreateForm((f) => ({ ...f, periodStart: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Periodo al</span>
              <input
                type="date"
                value={createForm.periodEnd}
                onChange={(e) => setCreateForm((f) => ({ ...f, periodEnd: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Saldo apertura (€)</span>
              <input
                value={createForm.openingBalanceEuros}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, openingBalanceEuros: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                placeholder="0,00"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Saldo chiusura estratto (€)
              </span>
              <input
                value={createForm.closingBalanceEuros}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, closingBalanceEuros: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                placeholder="0,00"
              />
            </label>
            <label className="block text-sm sm:col-span-2 lg:col-span-1">
              <span className="mb-1 block font-medium text-slate-700">Note</span>
              <input
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
            >
              Crea sessione
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Annulla
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Sessioni</h3>
        {loading && sessions.length === 0 ? (
          <p className="mt-4 text-center text-slate-500">Caricamento sessioni…</p>
        ) : sessions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Nessuna sessione per l&apos;esercizio selezionato.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Conto</th>
                  <th className="px-3 py-2">Periodo</th>
                  <th className="px-3 py-2">Stato</th>
                  <th className="px-3 py-2 text-right">Apertura</th>
                  <th className="px-3 py-2 text-right">Chiusura estratto</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => {
                  const acc = s.account
                  const selected = s.id === selectedSessionId
                  return (
                    <tr
                      key={s.id}
                      className={selected ? 'bg-brand-primary/5' : undefined}
                    >
                      <td className="px-3 py-2 text-slate-900">
                        <span className="font-medium">{acc?.code ?? '—'}</span>
                        <span className="text-slate-500">
                          {' '}
                          — {acc?.name ?? s.account_id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {s.period_start} → {s.period_end}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${sessionStatusClass(s.status)}`}
                        >
                          {sessionStatusLabel(s.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatSignedCents(s.opening_balance_cents)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatSignedCents(s.closing_balance_statement_cents)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectSession(selected ? null : s.id)}
                          className="text-sm font-medium text-brand-primary hover:underline"
                        >
                          {selected ? 'Chiudi' : 'Apri'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedSession && (
        <>
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Riepilogo sessione
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedSession.account?.code} — {selectedSession.account?.name} ·{' '}
                  {selectedSession.period_start} → {selectedSession.period_end}
                </p>
              </div>
              {canVerify && sessionEditable && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleComplete()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Completa
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCancel()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Annulla sessione
                  </button>
                </div>
              )}
            </div>

            {summary ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Saldo apertura"
                  value={formatSignedCents(summary.opening_balance_cents)}
                />
                <MetricCard
                  label="Chiusura estratto"
                  value={formatSignedCents(summary.closing_balance_statement_cents)}
                />
                <MetricCard
                  label="Netto gestionale periodo"
                  value={formatSignedCents(summary.managed_net_cents)}
                />
                <MetricCard
                  label="Differenza (estratto − gestionale)"
                  value={formatSignedCents(summary.difference_cents)}
                  warn={summary.difference_cents !== 0}
                />
                <MetricCard
                  label="Righe abbinate"
                  value={String(summary.lines_matched)}
                />
                <MetricCard
                  label="Da abbinare"
                  value={String(summary.lines_unmatched)}
                  warn={summary.lines_unmatched > 0}
                />
                <MetricCard
                  label="Escluse"
                  value={String(summary.lines_excluded)}
                />
                <MetricCard
                  label="Chiusura gestionale stimata"
                  value={formatSignedCents(summary.managed_closing_cents)}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Riepilogo non disponibile.</p>
            )}
            {summary?.note && (
              <p className="mt-3 text-xs text-slate-500">{summary.note}</p>
            )}
          </section>

          {canVerify && sessionEditable && (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Aggiungi riga manuale</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Importo positivo = accredito, negativo = addebito.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Data</span>
                    <input
                      type="date"
                      value={lineForm.lineDate}
                      onChange={(e) =>
                        setLineForm((f) => ({ ...f, lineDate: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Importo (€)</span>
                    <input
                      value={lineForm.amountEuros}
                      onChange={(e) =>
                        setLineForm((f) => ({ ...f, amountEuros: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                      placeholder="-12,50"
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block font-medium text-slate-700">Descrizione</span>
                    <input
                      value={lineForm.description}
                      onChange={(e) =>
                        setLineForm((f) => ({ ...f, description: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Riferimento</span>
                    <input
                      value={lineForm.reference}
                      onChange={(e) =>
                        setLineForm((f) => ({ ...f, reference: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">ID esterno</span>
                    <input
                      value={lineForm.externalId}
                      onChange={(e) =>
                        setLineForm((f) => ({ ...f, externalId: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddLine()}
                  disabled={saving}
                  className="mt-4 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
                >
                  Aggiungi riga
                </button>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Import CSV</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Formato TeamFlow: date;amount;description;reference;external_id (separatore
                  punto e virgola). Importi in euro.
                </p>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={8}
                  className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  placeholder={'date;amount;description;reference;external_id\n2026-01-15;100,00;Bonifico;CRO123;ext-1'}
                />
                <button
                  type="button"
                  onClick={() => void handleImportCsv()}
                  disabled={saving}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  Importa CSV
                </button>
              </div>
            </section>
          )}

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Righe estratto</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Descrizione</th>
                    <th className="px-3 py-2 text-right">Importo</th>
                    <th className="px-3 py-2">Stato</th>
                    <th className="px-3 py-2">Abbinamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                        Nessuna riga estratto. Aggiungi manualmente o importa un CSV.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2 tabular-nums text-slate-700">
                          {line.line_date}
                        </td>
                        <td className="px-3 py-2 text-slate-900">
                          <div>{line.description || '—'}</div>
                          {(line.reference || line.external_id) && (
                            <div className="text-xs text-slate-500">
                              {line.reference ? `Rif. ${line.reference}` : ''}
                              {line.reference && line.external_id ? ' · ' : ''}
                              {line.external_id ? `Ext ${line.external_id}` : ''}
                            </div>
                          )}
                          {line.exclude_reason && (
                            <div className="text-xs text-amber-800">
                              Esclusa: {line.exclude_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatSignedCents(line.amount_cents)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-medium text-slate-700">
                            {matchStatusLabel(line.match_status)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {canVerify && sessionEditable && line.match_status === 'unmatched' ? (
                            <div className="flex min-w-[220px] flex-col gap-2">
                              <select
                                value={matchMovementByLine[line.id] ?? ''}
                                onChange={(e) =>
                                  setMatchMovementByLine((prev) => ({
                                    ...prev,
                                    [line.id]: e.target.value
                                  }))
                                }
                                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                              >
                                <option value="">Movimento candidato…</option>
                                {candidates.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.settlement_date || m.movement_date} ·{' '}
                                    {movementDirectionLabel(m.direction)} ·{' '}
                                    {formatFeeAmount(m.amount_cents)} ·{' '}
                                    {m.description.slice(0, 40)}
                                  </option>
                                ))}
                              </select>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleMatch(line.id)}
                                  disabled={saving}
                                  className="rounded-md bg-brand-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
                                >
                                  Abbina
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleExclude(line.id)}
                                  disabled={saving}
                                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                >
                                  Escludi
                                </button>
                              </div>
                            </div>
                          ) : line.match_status === 'matched' ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-slate-500">
                                Mov. {line.matched_movement_id?.slice(0, 8)}…
                              </span>
                              {canVerify && sessionEditable && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void onUnmatch(line.id).then(
                                      () => toast.success('Abbinamento rimosso'),
                                      (err) =>
                                        toast.error(
                                          err instanceof Error
                                            ? err.message
                                            : 'Rimozione non riuscita'
                                        )
                                    )
                                  }
                                  disabled={saving}
                                  className="self-start text-xs font-medium text-brand-primary hover:underline disabled:opacity-60"
                                >
                                  Scollega
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {sessionEditable && (
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">
                Movimenti candidati ({candidates.length})
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Movimenti contabilizzati sul conto nel periodo (già abbinati esclusi).
              </p>
              {candidates.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Nessun candidato disponibile.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Data cassa</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Descrizione</th>
                        <th className="px-3 py-2 text-right">Importo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidates.map((m) => (
                        <tr key={m.id}>
                          <td className="px-3 py-2 tabular-nums text-slate-700">
                            {m.settlement_date || m.movement_date}
                          </td>
                          <td className="px-3 py-2">
                            {movementDirectionLabel(m.direction)}
                          </td>
                          <td className="px-3 py-2 text-slate-900">
                            {m.description}
                            {m.reference && (
                              <div className="text-xs text-slate-500">Rif. {m.reference}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatFeeAmount(m.amount_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  warn
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-2 text-lg font-bold tabular-nums ${
          warn ? 'text-amber-800' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
