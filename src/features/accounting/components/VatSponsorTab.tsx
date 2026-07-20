import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Download, FileText, LayoutGrid, Plus, Table2 } from 'lucide-react'
import { formatFeeAmount } from '@/utils/feeUtils'
import GoleeConfirmModal from '@/components/GoleeConfirmModal'
import type {
  AccountingAccountRef,
  AccountingCounterparty,
  AccountingCounterpartyRef,
  AccountingFiscalParamRow,
  AccountingFiscalYear,
  CommercialDocument,
  CommercialVatOverview,
  SponsorshipContract,
  VatPeriod
} from '../types'
import type { CounterpartyWriteInput } from '../api/counterparties.api'
import {
  basisPointsToPercent,
  indicativeVatDueOn,
  limitThresholdLevel,
  parseParamNumeric,
  resolveFiscalParamAtDate,
  VAT_PARAM_KEYS
} from '../utils/vatCalculations'
import { downloadTextAsDocx } from '../utils/documentTemplates'
import {
  CommercialDocumentFormModal,
  commercialDocToFormValues,
  type CommercialDocumentFormValues
} from './CommercialDocumentFormModal'
import { SponsorshipContractEditor } from './SponsorshipContractEditor'
import type { SponsorshipContractFormValues } from './SponsorshipContractFormModal'
import {
  contractPartsToPlainText,
  parseContractBodyParts
} from '../utils/sponsorshipContractTemplate'

interface VatSponsorTabProps {
  fiscalYear: AccountingFiscalYear | null
  documents: CommercialDocument[]
  periods: VatPeriod[]
  counterparties: AccountingCounterpartyRef[]
  accounts: AccountingAccountRef[]
  fiscalParams: AccountingFiscalParamRow[]
  overview: CommercialVatOverview | null
  loading: boolean
  error: string | null
  saving: boolean
  canCreate: boolean
  canEditDraft: boolean
  canVerify: boolean
  canPost: boolean
  canManageSettings: boolean
  onCreateDocument: (
    values: CommercialDocumentFormValues,
    taxableCents: number
  ) => Promise<void>
  onUpdateDocument: (
    id: string,
    values: CommercialDocumentFormValues,
    taxableCents: number
  ) => Promise<void>
  onIssue: (id: string) => Promise<void>
  onCancel: (id: string) => Promise<void>
  onRegisterPayment: (
    id: string,
    accountId: string,
    allocatedAmountCents: number
  ) => Promise<void>
  onLinkMovement: (
    documentId: string,
    movementId: string,
    allocatedAmountCents: number
  ) => Promise<void>
  onCalculateQuarter: (year: number, quarter: number) => Promise<void>
  onVerifyPeriod: (id: string) => Promise<void>
  onMarkPaid: (id: string, paidAt: string, reference: string) => Promise<void>
  onCreateCounterparty?: (input: CounterpartyWriteInput) => Promise<AccountingCounterparty>
  sponsorshipContracts: SponsorshipContract[]
  onCreateContract: (
    values: SponsorshipContractFormValues,
    taxableCents: number
  ) => Promise<void>
  onUpdateContract: (
    id: string,
    values: SponsorshipContractFormValues,
    taxableCents: number
  ) => Promise<void>
  onConfirmContract: (id: string) => Promise<void>
  onRegenerateContractPdf: (id: string) => Promise<void>
  onReopenContractDraft: (id: string) => Promise<void>
  onOpenPdf: (pdfPath: string) => Promise<void>
}

function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(1)}%`
}

const KIND_LABEL: Record<string, string> = {
  sponsorship: 'Sponsorizzazione',
  advertising: 'Pubblicità',
  ticketing: 'Biglietteria',
  merchandising: 'Merchandising',
  services: 'Servizi',
  other: 'Altro'
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Bozza',
  issued: 'Emesso',
  partially_collected: 'Parzialmente incassato',
  collected: 'Incassato',
  cancelled: 'Annullato',
  open: 'Aperto',
  calculated: 'Calcolato',
  verified: 'Verificato',
  paid: 'Pagato',
  confirmed: 'Confermato'
}

export function VatSponsorTab({
  fiscalYear,
  documents,
  periods,
  counterparties,
  accounts,
  fiscalParams,
  overview,
  loading,
  error,
  saving,
  canCreate,
  canEditDraft,
  canVerify,
  canPost,
  canManageSettings,
  onCreateDocument,
  onUpdateDocument,
  onIssue,
  onCancel,
  onRegisterPayment,
  onLinkMovement,
  onCalculateQuarter,
  onVerifyPeriod,
  onMarkPaid,
  onCreateCounterparty,
  sponsorshipContracts,
  onCreateContract,
  onUpdateContract,
  onConfirmContract,
  onRegenerateContractPdf,
  onReopenContractDraft,
  onOpenPdf
}: VatSponsorTabProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formInitial, setFormInitial] = useState<Partial<CommercialDocumentFormValues>>()
  const [contractFormOpen, setContractFormOpen] = useState(false)
  const [contractFormMode, setContractFormMode] = useState<'create' | 'edit'>('create')
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [contractPrefillCpId, setContractPrefillCpId] = useState<string | undefined>()
  const [confirmContractId, setConfirmContractId] = useState<string | null>(null)
  const [reopenContractId, setReopenContractId] = useState<string | null>(null)
  const [pendingEditorConfirm, setPendingEditorConfirm] = useState<{
    values: SponsorshipContractFormValues
    taxableCents: number
  } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [collectAccountByDoc, setCollectAccountByDoc] = useState<Record<string, string>>({})
  const [payAmountByDoc, setPayAmountByDoc] = useState<Record<string, string>>({})
  const [linkMovByDoc, setLinkMovByDoc] = useState<Record<string, string>>({})
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const [paidRefByPeriod, setPaidRefByPeriod] = useState<Record<string, string>>({})
  const [periodsView, setPeriodsView] = useState<'cards' | 'table'>('cards')

  const asOf = fiscalYear?.ends_on ?? new Date().toISOString().slice(0, 10)
  const year = fiscalYear ? Number(fiscalYear.starts_on.slice(0, 4)) : new Date().getFullYear()

  const proposedRate = useMemo(() => {
    const row = resolveFiscalParamAtDate(fiscalParams, VAT_PARAM_KEYS.rateSponsorship, asOf)
    return row ? parseParamNumeric(row.value_json) : null
  }, [fiscalParams, asOf])

  const forfaitPct = useMemo(() => {
    const row = resolveFiscalParamAtDate(fiscalParams, VAT_PARAM_KEYS.forfaitPct, asOf)
    return row ? parseParamNumeric(row.value_json) : null
  }, [fiscalParams, asOf])

  const periodsByQuarter = useMemo(() => {
    const map = new Map(periods.map((p) => [p.quarter, p]))
    return [1, 2, 3, 4].map((q) => map.get(q) ?? null)
  }, [periods])

  const editingContract = useMemo(
    () =>
      editingContractId
        ? sponsorshipContracts.find((c) => c.id === editingContractId) ?? null
        : null,
    [editingContractId, sponsorshipContracts]
  )

  const limitLevel = limitThresholdLevel(overview?.limitUsedPercent ?? null)

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow-sm">
        Caricamento IVA e sponsor…
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

  if (!fiscalYear || !overview) {
    return (
      <div className="rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">
        Seleziona un esercizio contabile.
      </div>
    )
  }

  const renderPeriodActions = (period: VatPeriod | null, q: number): ReactNode => (
    <>
      <button
        type="button"
        disabled={saving || period?.status === 'verified' || period?.status === 'paid'}
        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        title="Ricalcolo manuale (di norma non serve: si aggiorna all'emissione)"
        onClick={() => void onCalculateQuarter(year, q)}
      >
        Ricalcola
      </button>
      {period && period.status === 'calculated' && canVerify && (
        <button
          type="button"
          disabled={saving || !overview.paramsAllVerified}
          title={
            overview.paramsAllVerified
              ? 'Verifica commercialista'
              : 'Parametri non verificati'
          }
          className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-800 disabled:opacity-40"
          onClick={() => void onVerifyPeriod(period.id)}
        >
          Verifica
        </button>
      )}
      {period && period.status === 'verified' && canPost && (
        <>
          <input
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            placeholder="Rif. F24"
            value={paidRefByPeriod[period.id] ?? ''}
            onChange={(e) =>
              setPaidRefByPeriod((prev) => ({
                ...prev,
                [period.id]: e.target.value
              }))
            }
          />
          <button
            type="button"
            disabled={saving || !(paidRefByPeriod[period.id] ?? '').trim()}
            className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-800 disabled:opacity-40"
            onClick={() =>
              void onMarkPaid(
                period.id,
                new Date().toISOString(),
                (paidRefByPeriod[period.id] ?? '').trim()
              )
            }
          >
            Segna pagato
          </button>
        </>
      )}
    </>
  )

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Valori da verificare con il commercialista</p>
        <p className="mt-1 text-xs">
          Strumento gestionale interno: non trasmette fatture allo SDI, non invia F24, non
          sostituisce il commercialista e non rende automatici i parametri fiscali.
        </p>
      </div>

      {!overview.paramsAllVerified && (
        <div className="rounded-xl border-2 border-orange-500 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          <p className="font-semibold">
            {overview.paramsMissing
              ? 'Parametri fiscali mancanti o incompleti'
              : 'Parametri fiscali non verificati'}
          </p>
          <p className="mt-1 text-xs">
            Nessun fallback fiscale silenzioso. Simulazione consentita; liquidazione verificata
            bloccata. Chiavi: {overview.unverifiedParamKeys.join(', ') || '—'}.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-600">
        Trimestre IVA attribuito con <strong>data documento</strong> (criterio gestionale). Il
        momento impositivo fiscale deve essere confermato dal commercialista. Il consuntivo di
        cassa considera solo i movimenti registrati, non il lordo emesso.
      </p>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              IVA e sponsor — esercizio {fiscalYear.code}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Aliquota proposta da parametri
              {proposedRate !== null ? ` (${proposedRate}%)` : ''} · detrazione forfetaria
              configurata
              {forfaitPct !== null ? ` (${forfaitPct}%)` : ' (assente)'}.
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setFormMode('create')
                setEditingId(null)
                setFormInitial({
                  vatRatePercent: proposedRate !== null ? String(proposedRate) : ''
                })
                setFormOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-brixia-primary px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Nuovo documento commerciale
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Ricavi commerciali', value: formatFeeAmount(overview.commercialRevenueCents) },
            {
              label: 'Ricavi da sponsorizzazioni',
              value: formatFeeAmount(overview.sponsorshipRevenueCents)
            },
            { label: 'Imponibile', value: formatFeeAmount(overview.taxableCents) },
            { label: 'IVA applicata', value: formatFeeAmount(overview.outputVatCents) },
            {
              label: 'Detrazione forfetaria',
              value: formatFeeAmount(overview.forfaitDeductionCents)
            },
            {
              label: 'IVA stimata da versare',
              value: formatFeeAmount(overview.estimatedVatDueCents)
            },
            {
              label: 'Limite commerciale',
              value:
                overview.limitCents === null ? '—' : formatFeeAmount(overview.limitCents)
            },
            {
              label: '% limite utilizzata',
              value: formatPercent(overview.limitUsedPercent)
            }
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-slate-200 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {c.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{c.value}</p>
            </div>
          ))}
        </div>

        {overview.limitExceeded && (
          <div className="mt-4 rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Limite commerciale superato ({formatFeeAmount(overview.limitUsedCents)} su{' '}
            {formatFeeAmount(overview.limitCents ?? 0)}). Avviso gestionale — nessun blocco
            automatico.
          </div>
        )}
        {!overview.limitExceeded && limitLevel === 'warn85' && (
          <div className="mt-4 rounded-lg border border-orange-400 bg-orange-50 px-4 py-2 text-sm text-orange-900">
            Attenzione: utilizzo limite ≥ 85%.
          </div>
        )}
        {!overview.limitExceeded && limitLevel === 'warn70' && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            Utilizzo limite ≥ 70%.
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Residuo limite:{' '}
          {overview.limitResidualCents === null
            ? '—'
            : formatFeeAmount(overview.limitResidualCents)}
          . Solo documenti con inclusione 398 e non annullati. Quote istituzionali escluse.
        </p>
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Contratti di sponsorizzazione</h3>
            <p className="mt-1 text-xs text-slate-500">
              Bozza editabile + Word opzionale. Dopo conferma: Apri PDF in Azioni (se manca: Genera
              PDF). Se sbagli: Riapri bozza → correggi → riconferma. Obbligatorio prima di emettere
              fatture sponsorship.
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
              onClick={() => {
                setContractFormMode('create')
                setEditingContractId(null)
                setContractPrefillCpId(undefined)
                setContractFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Nuovo contratto
            </button>
          )}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Titolo</th>
                <th className="px-3 py-2">Sponsor</th>
                <th className="px-3 py-2">Periodo</th>
                <th className="px-3 py-2 text-right">Lordo</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sponsorshipContracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Nessun contratto. Creane uno prima di fatturare una sponsorizzazione.
                  </td>
                </tr>
              ) : (
                sponsorshipContracts.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">{c.title}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {c.counterparty?.display_name ?? c.counterparty_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {new Date(c.starts_on).toLocaleDateString('it-IT')}
                      {c.ends_on
                        ? ` → ${new Date(c.ends_on).toLocaleDateString('it-IT')}`
                        : ''}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatFeeAmount(c.gross_amount_cents)}
                    </td>
                    <td className="px-3 py-2">
                      {STATUS_LABEL[c.status] ?? c.status}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {c.status === 'draft' && canEditDraft && (
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                            onClick={() => {
                              setContractFormMode('edit')
                              setEditingContractId(c.id)
                              setContractPrefillCpId(undefined)
                              setContractFormOpen(true)
                            }}
                          >
                            Modifica
                          </button>
                        )}
                        {c.status === 'draft' && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs"
                            onClick={() => {
                              const parts = parseContractBodyParts(c.body_text)
                              void downloadTextAsDocx(
                                `contratto-${c.id.slice(0, 8)}`,
                                parts ? contractPartsToPlainText(parts) : c.body_text
                              )
                            }}
                          >
                            <Download className="h-3 w-3" />
                            Word
                          </button>
                        )}
                        {c.status === 'draft' && (canCreate || canEditDraft || canPost) && (
                          <button
                            type="button"
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-800 disabled:opacity-40"
                            onClick={() => setConfirmContractId(c.id)}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Conferma + PDF
                          </button>
                        )}
                        {c.status === 'confirmed' && c.pdf_path && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs text-blue-800"
                            onClick={() => void onOpenPdf(c.pdf_path!)}
                          >
                            <FileText className="h-3 w-3" />
                            Apri PDF
                          </button>
                        )}
                        {c.status === 'confirmed' && !c.pdf_path && (canCreate || canEditDraft || canPost) && (
                          <button
                            type="button"
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded border border-amber-300 px-2 py-1 text-xs text-amber-900 disabled:opacity-40"
                            onClick={() => void onRegenerateContractPdf(c.id)}
                          >
                            <FileText className="h-3 w-3" />
                            Genera PDF
                          </button>
                        )}
                        {c.status === 'confirmed' && c.pdf_path && (canCreate || canEditDraft || canPost) && (
                          <button
                            type="button"
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-40"
                            onClick={() => void onRegenerateContractPdf(c.id)}
                          >
                            Rigenera PDF
                          </button>
                        )}
                        {c.status === 'confirmed' && canEditDraft && (
                          <button
                            type="button"
                            disabled={saving}
                            className="rounded border border-orange-300 px-2 py-1 text-xs text-orange-900 disabled:opacity-40"
                            onClick={() => setReopenContractId(c.id)}
                          >
                            Riapri bozza
                          </button>
                        )}
                        {c.pdf_path && c.status !== 'confirmed' && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs text-blue-800"
                            onClick={() => void onOpenPdf(c.pdf_path!)}
                          >
                            <FileText className="h-3 w-3" />
                            Apri PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Documenti commerciali</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Controparte</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Lordo</th>
                <th className="px-3 py-2 text-right">Incassato</th>
                <th className="px-3 py-2 text-right">Residuo</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    Nessun documento commerciale.
                  </td>
                </tr>
              ) : (
                documents.map((d) => {
                  const collected = d.collected_amount_cents ?? 0
                  const residual =
                    d.residual_amount_cents ??
                    Math.max(0, (d.gross_amount_cents ?? 0) - collected)
                  const canPay =
                    canPost &&
                    (d.status === 'issued' || d.status === 'partially_collected') &&
                    residual > 0
                  const payEuros = payAmountByDoc[d.id] ?? (residual / 100).toFixed(2).replace('.', ',')
                  const parsePay = () => {
                    const n = Number(String(payEuros).replace(/\./g, '').replace(',', '.'))
                    if (!Number.isFinite(n) || n <= 0) return null
                    return Math.round(n * 100)
                  }
                  const counterpartyLabel =
                    d.counterparty?.display_name ||
                    (d.counterparty_id ? `${d.counterparty_id.slice(0, 8)}…` : '— senza sponsor —')
                  const dateLabel = d.document_date
                    ? new Date(d.document_date).toLocaleDateString('it-IT')
                    : '—'
                  return (
                    <Fragment key={d.id}>
                  <tr className={d.status === 'draft' ? 'bg-amber-50/40' : undefined}>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-900">{dateLabel}</td>
                    <td className="px-3 py-2 text-slate-900">{counterpartyLabel}</td>
                    <td className="px-3 py-2 text-slate-900">
                      {KIND_LABEL[d.commercial_kind] ?? d.commercial_kind ?? '—'}
                      <div className="text-[11px] text-slate-500">
                        {basisPointsToPercent(d.vat_rate_basis_points ?? 0)}%
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                      {formatFeeAmount(d.gross_amount_cents ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                      {formatFeeAmount(collected)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                      {formatFeeAmount(residual)}
                    </td>
                    <td className="px-3 py-2 text-slate-900">
                      <span
                        className={
                          d.status === 'draft'
                            ? 'rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900'
                            : undefined
                        }
                      >
                        {STATUS_LABEL[d.status] ?? d.status}
                      </span>
                      {d.needs_reconciliation && (
                        <div className="text-[10px] font-medium text-amber-700">
                          Da riconciliare (movimento stornato)
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-0.5 text-xs"
                          onClick={() =>
                            setExpandedDoc((prev) => (prev === d.id ? null : d.id))
                          }
                        >
                          {expandedDoc === d.id ? 'Nascondi' : 'Dettaglio'}
                        </button>
                        {d.status === 'draft' && canEditDraft && (
                          <button
                            type="button"
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium"
                            onClick={() => {
                              setFormMode('edit')
                              setEditingId(d.id)
                              setFormInitial(commercialDocToFormValues(d))
                              setFormOpen(true)
                            }}
                          >
                            Modifica
                          </button>
                        )}
                        {d.status === 'draft' && (canCreate || canEditDraft) && (
                          <button
                            type="button"
                            disabled={saving}
                            className="rounded border border-emerald-300 px-2 py-0.5 text-xs text-emerald-800"
                            onClick={() => void onIssue(d.id)}
                          >
                            Emetti + PDF
                          </button>
                        )}
                        {d.pdf_path && (
                          <button
                            type="button"
                            className="rounded border border-blue-300 px-2 py-0.5 text-xs text-blue-800"
                            onClick={() => void onOpenPdf(d.pdf_path!)}
                          >
                            Apri PDF
                          </button>
                        )}
                        {d.status === 'draft' && !!d.draft_body_text && (
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-0.5 text-xs"
                            onClick={() =>
                              void downloadTextAsDocx(
                                `doc-${d.document_number || d.id.slice(0, 8)}`,
                                d.draft_body_text || ''
                              )
                            }
                          >
                            Word
                          </button>
                        )}
                        {d.status !== 'cancelled' && canEditDraft && (
                          <button
                            type="button"
                            disabled={saving}
                            className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-700"
                            onClick={() => {
                              if (window.confirm('Annullare il documento?')) void onCancel(d.id)
                            }}
                          >
                            Annulla
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedDoc === d.id && (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 px-4 py-3 text-sm">
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Pagamenti collegati
                            </p>
                            {(d.payments ?? []).length === 0 ? (
                              <p className="mt-1 text-slate-500">Nessun pagamento.</p>
                            ) : (
                              <ul className="mt-1 space-y-1">
                                {(d.payments ?? []).map((p) => (
                                  <li key={p.id} className="flex justify-between gap-2 text-xs">
                                    <span>
                                      {p.movement?.movement_date
                                        ? new Date(p.movement.movement_date).toLocaleDateString(
                                            'it-IT'
                                          )
                                        : '—'}{' '}
                                      · mov {p.movement_id.slice(0, 8)}…
                                      {p.movement?.status && p.movement.status !== 'posted'
                                        ? ` (${p.movement.status})`
                                        : ''}
                                    </span>
                                    <span className="font-medium tabular-nums">
                                      {formatFeeAmount(p.allocated_amount_cents)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {canPay && (
                            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                              <p className="text-xs font-semibold uppercase text-slate-500">
                                Registra pagamento (anche parziale)
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <input
                                  className="w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                                  value={payEuros}
                                  onChange={(e) =>
                                    setPayAmountByDoc((prev) => ({
                                      ...prev,
                                      [d.id]: e.target.value
                                    }))
                                  }
                                  placeholder="Importo €"
                                />
                                <select
                                  className="rounded border border-slate-300 text-xs"
                                  value={collectAccountByDoc[d.id] ?? ''}
                                  onChange={(e) =>
                                    setCollectAccountByDoc((prev) => ({
                                      ...prev,
                                      [d.id]: e.target.value
                                    }))
                                  }
                                >
                                  <option value="">Conto…</option>
                                  {accounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.code}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={
                                    saving ||
                                    !collectAccountByDoc[d.id] ||
                                    parsePay() === null ||
                                    (parsePay() ?? 0) > residual
                                  }
                                  className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-800 disabled:opacity-40"
                                  onClick={() => {
                                    const cents = parsePay()
                                    if (cents == null || cents > residual) return
                                    void onRegisterPayment(
                                      d.id,
                                      collectAccountByDoc[d.id],
                                      cents
                                    )
                                  }}
                                >
                                  Registra pagamento
                                </button>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Max residuo {formatFeeAmount(residual)}. Sovra-allocazione
                                bloccata.
                              </p>
                              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                                <input
                                  className="min-w-[180px] flex-1 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                                  placeholder="UUID movimento esistente"
                                  value={linkMovByDoc[d.id] ?? ''}
                                  onChange={(e) =>
                                    setLinkMovByDoc((prev) => ({
                                      ...prev,
                                      [d.id]: e.target.value.trim()
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  disabled={
                                    saving ||
                                    !(linkMovByDoc[d.id] ?? '') ||
                                    parsePay() === null ||
                                    (parsePay() ?? 0) > residual
                                  }
                                  className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                                  onClick={() => {
                                    const cents = parsePay()
                                    const movId = linkMovByDoc[d.id]
                                    if (!cents || !movId || cents > residual) return
                                    void onLinkMovement(d.id, movId, cents)
                                  }}
                                >
                                  Collega movimento esistente
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Liquidazioni trimestrali</h3>
            <p className="mt-1 text-xs text-slate-500">
              Aggiornamento automatico all&apos;emissione (data documento). &quot;Ricalcola&quot;
              serve solo in casi eccezionali. L&apos;importo da versare è{' '}
              <span className="font-medium text-slate-700">IVA da versare (stima)</span>
              . Scadenze indicative; nessun F24 automatico.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            title={
              periodsView === 'cards'
                ? 'Vista tabella (una riga per trimestre)'
                : 'Vista card'
            }
            aria-label={
              periodsView === 'cards'
                ? 'Passa alla vista tabella'
                : 'Passa alla vista card'
            }
            onClick={() =>
              setPeriodsView((v) => (v === 'cards' ? 'table' : 'cards'))
            }
          >
            {periodsView === 'cards' ? (
              <Table2 className="h-4 w-4" aria-hidden />
            ) : (
              <LayoutGrid className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>

        {periodsView === 'cards' ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {periodsByQuarter.map((period, idx) => {
              const q = idx + 1
              const due = period?.indicative_due_on ?? indicativeVatDueOn(year, q)
              return (
                <div key={q} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-900">
                      T{q} {year}
                    </h4>
                    <span className="text-xs font-medium text-slate-600">
                      {STATUS_LABEL[period?.status ?? 'open']}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Imponibile</dt>
                      <dd className="font-medium text-slate-900">
                        {formatFeeAmount(period?.commercial_taxable_cents ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">IVA a debito</dt>
                      <dd className="font-medium text-slate-900">
                        {formatFeeAmount(period?.output_vat_cents ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Detrazione</dt>
                      <dd className="font-medium text-slate-900">
                        {formatFeeAmount(period?.forfait_deduction_cents ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">IVA da versare (stima)</dt>
                      <dd className="font-semibold text-slate-900">
                        {formatFeeAmount(period?.estimated_vat_due_cents ?? 0)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-slate-500">
                    Scadenza indicativa: {new Date(due).toLocaleDateString('it-IT')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {renderPeriodActions(period, q)}
                  </div>
                  {period?.payment_reference && (
                    <p className="mt-2 text-xs text-slate-600">
                      F24: {period.payment_reference}
                      {period.paid_at
                        ? ` · ${new Date(period.paid_at).toLocaleDateString('it-IT')}`
                        : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Trimestre</th>
                  <th className="px-3 py-2 font-medium">Stato</th>
                  <th className="px-3 py-2 font-medium text-right">Imponibile</th>
                  <th className="px-3 py-2 font-medium text-right">IVA a debito</th>
                  <th className="px-3 py-2 font-medium text-right">Detrazione</th>
                  <th className="px-3 py-2 font-medium text-right">IVA da versare (stima)</th>
                  <th className="px-3 py-2 font-medium">Scadenza</th>
                  <th className="px-3 py-2 font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodsByQuarter.map((period, idx) => {
                  const q = idx + 1
                  const due = period?.indicative_due_on ?? indicativeVatDueOn(year, q)
                  return (
                    <tr key={q} className="text-slate-900">
                      <td className="whitespace-nowrap px-3 py-3 font-semibold">
                        T{q} {year}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {STATUS_LABEL[period?.status ?? 'open']}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium">
                        {formatFeeAmount(period?.commercial_taxable_cents ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium">
                        {formatFeeAmount(period?.output_vat_cents ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium">
                        {formatFeeAmount(period?.forfait_deduction_cents ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                        {formatFeeAmount(period?.estimated_vat_due_cents ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {new Date(due).toLocaleDateString('it-IT')}
                        {period?.payment_reference ? (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            F24: {period.payment_reference}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderPeriodActions(period, q)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Da classificare</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          <li className="flex justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-slate-600">Documenti commerciali (kind other)</span>
            <span className="font-semibold">{overview.toClassifyDocuments}</span>
          </li>
          <li className="flex justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-slate-600">Movimenti categoria to_classify</span>
            <span className="font-semibold">{overview.toClassifyMovements}</span>
          </li>
        </ul>
      </section>

      <CommercialDocumentFormModal
        isOpen={formOpen}
        mode={formMode}
        initialValues={formInitial}
        counterparties={counterparties}
        accounts={accounts}
        proposedVatRatePercent={proposedRate}
        canOverrideVatRate={canManageSettings}
        canCreateCounterparty={canCreate}
        confirmedContracts={sponsorshipContracts.filter((c) => c.status === 'confirmed')}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onCreateCounterparty={onCreateCounterparty}
        onRequestCreateContract={() => {
          setFormOpen(false)
          setContractFormMode('create')
          setEditingContractId(null)
          setContractPrefillCpId(formInitial?.counterpartyId)
          setContractFormOpen(true)
        }}
        onSubmit={async (values, taxableCents) => {
          if (formMode === 'create') {
            await onCreateDocument(values, taxableCents)
          } else if (editingId) {
            await onUpdateDocument(editingId, values, taxableCents)
          }
          setFormOpen(false)
          setEditingId(null)
        }}
      />

      <SponsorshipContractEditor
        isOpen={contractFormOpen}
        mode={contractFormMode}
        counterparties={counterparties}
        counterpartiesFull={counterparties as AccountingCounterparty[]}
        initialContract={contractFormMode === 'edit' ? editingContract : null}
        prefillCounterpartyId={
          contractFormMode === 'create' ? contractPrefillCpId : undefined
        }
        proposedVatRatePercent={proposedRate}
        saving={saving}
        showConfirm={contractFormMode === 'edit' && editingContract?.status === 'draft'}
        onClose={() => {
          setContractFormOpen(false)
          setEditingContractId(null)
          setContractPrefillCpId(undefined)
        }}
        onSave={async (values, taxableCents) => {
          if (contractFormMode === 'create') {
            await onCreateContract(values, taxableCents)
          } else if (editingContractId) {
            await onUpdateContract(editingContractId, values, taxableCents)
          }
          setContractFormOpen(false)
          setEditingContractId(null)
          setContractPrefillCpId(undefined)
        }}
        onConfirmAndPdf={
          editingContractId
            ? async (values, taxableCents) => {
                setPendingEditorConfirm({ values, taxableCents })
              }
            : undefined
        }
      />

      <GoleeConfirmModal
        open={!!confirmContractId || !!pendingEditorConfirm}
        variant="success"
        title="Conferma contratto"
        message={
          pendingEditorConfirm
            ? 'Salvare le ultime modifiche, confermare il contratto e generare il PDF definitivo? Dopo la conferma la bozza non sarà più modificabile.'
            : 'Confermare il contratto e generare il PDF definitivo? Dopo la conferma la bozza non sarà più modificabile.'
        }
        confirmLabel="Conferma e genera PDF"
        confirmingLabel="Generazione PDF…"
        cancelLabel="Annulla"
        confirming={confirmBusy || saving}
        onCancel={() => {
          if (confirmBusy) return
          setConfirmContractId(null)
          setPendingEditorConfirm(null)
        }}
        onConfirm={() => {
          void (async () => {
            setConfirmBusy(true)
            try {
              if (pendingEditorConfirm && editingContractId) {
                const { values, taxableCents } = pendingEditorConfirm
                await onUpdateContract(editingContractId, values, taxableCents)
                await onConfirmContract(editingContractId)
                setContractFormOpen(false)
                setEditingContractId(null)
                setContractPrefillCpId(undefined)
                setPendingEditorConfirm(null)
              } else if (confirmContractId) {
                await onConfirmContract(confirmContractId)
                setConfirmContractId(null)
              }
            } finally {
              setConfirmBusy(false)
            }
          })()
        }}
      />

      <GoleeConfirmModal
        open={!!reopenContractId}
        variant="warning"
        title="Riapri bozza"
        message="Hai sbagliato qualcosa? Il contratto tornerà in bozza (modificabile). Dovrai riconfermare e rigenerare il PDF. Non possibile se già collegato a fatture emesse."
        confirmLabel="Riapri in bozza"
        confirmingLabel="Apertura…"
        cancelLabel="Annulla"
        confirming={confirmBusy || saving}
        onCancel={() => {
          if (confirmBusy) return
          setReopenContractId(null)
        }}
        onConfirm={() => {
          void (async () => {
            if (!reopenContractId) return
            setConfirmBusy(true)
            try {
              await onReopenContractDraft(reopenContractId)
              setReopenContractId(null)
            } finally {
              setConfirmBusy(false)
            }
          })()
        }}
      />
    </div>
  )
}
