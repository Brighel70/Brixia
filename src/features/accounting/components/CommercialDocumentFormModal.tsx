import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileText, Plus, X } from 'lucide-react'
import {
  GOLEE,
  goleeInputClass,
  goleeInputStyle,
  goleeLabelClass
} from '@/config/goleeTheme'
import type {
  AccountingCounterparty,
  AccountingCounterpartyRef,
  AccountingDocumentType,
  CommercialDocument,
  CommercialKind,
  SponsorshipContract
} from '../types'
import type { CounterpartyWriteInput } from '../api/counterparties.api'
import {
  basisPointsToPercent,
  computeGrossCents,
  computeVatAmountCents,
  percentToBasisPoints
} from '../utils/vatCalculations'
import { parseAmountEurosToCents } from '../utils/movementValidation'
import {
  buildCommercialInvoiceBody,
  buildDocContext,
  downloadTextAsDocx
} from '../utils/documentTemplates'
import { CounterpartyFormModal } from './CounterpartyFormModal'

export interface CommercialDocumentFormValues {
  counterpartyId: string
  documentType: AccountingDocumentType
  documentNumber: string
  documentDate: string
  description: string
  commercialKind: CommercialKind
  taxableEuros: string
  vatRatePercent: string
  includeIn398Limit: boolean
  notes: string
  markCollected: boolean
  accountId: string
  draftBodyText: string
  sponsorshipContractId: string
}

interface CommercialDocumentFormModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  initialValues?: Partial<CommercialDocumentFormValues>
  counterparties: AccountingCounterpartyRef[]
  accounts: { id: string; code: string; name: string }[]
  proposedVatRatePercent: number | null
  canOverrideVatRate: boolean
  canCreateCounterparty?: boolean
  confirmedContracts?: SponsorshipContract[]
  saving: boolean
  onClose: () => void
  onSubmit: (values: CommercialDocumentFormValues, taxableCents: number) => Promise<void>
  onCreateCounterparty?: (input: CounterpartyWriteInput) => Promise<AccountingCounterparty>
  onRequestCreateContract?: () => void
}

const EMPTY: CommercialDocumentFormValues = {
  counterpartyId: '',
  documentType: 'invoice',
  documentNumber: '',
  documentDate: '',
  description: '',
  commercialKind: 'sponsorship',
  taxableEuros: '',
  vatRatePercent: '',
  includeIn398Limit: true,
  notes: '',
  markCollected: false,
  accountId: '',
  draftBodyText: '',
  sponsorshipContractId: ''
}

export function commercialDocToFormValues(doc: CommercialDocument): CommercialDocumentFormValues {
  return {
    counterpartyId: doc.counterparty_id,
    documentType: doc.document_type,
    documentNumber: doc.document_number ?? '',
    documentDate: doc.document_date,
    description: doc.description,
    commercialKind: doc.commercial_kind,
    taxableEuros: (doc.taxable_amount_cents / 100).toFixed(2).replace('.', ','),
    vatRatePercent: String(basisPointsToPercent(doc.vat_rate_basis_points)),
    includeIn398Limit: doc.include_in_398_limit,
    notes: doc.notes ?? '',
    markCollected: false,
    accountId: '',
    draftBodyText: doc.draft_body_text ?? '',
    sponsorshipContractId: doc.sponsorship_contract_id ?? ''
  }
}

export function CommercialDocumentFormModal({
  isOpen,
  mode,
  initialValues,
  counterparties,
  accounts,
  proposedVatRatePercent,
  canOverrideVatRate,
  canCreateCounterparty = false,
  confirmedContracts = [],
  saving,
  onClose,
  onSubmit,
  onCreateCounterparty,
  onRequestCreateContract
}: CommercialDocumentFormModalProps) {
  const [values, setValues] = useState<CommercialDocumentFormValues>(EMPTY)
  const [formError, setFormError] = useState<string | null>(null)
  const [cpFormOpen, setCpFormOpen] = useState(false)
  const [cpSaving, setCpSaving] = useState(false)
  const [localCounterparties, setLocalCounterparties] =
    useState<AccountingCounterpartyRef[]>(counterparties)

  useEffect(() => {
    if (!isOpen) return
    setFormError(null)
    setCpFormOpen(false)
    setLocalCounterparties(counterparties)
    setValues({
      ...EMPTY,
      vatRatePercent:
        proposedVatRatePercent !== null && proposedVatRatePercent !== undefined
          ? String(proposedVatRatePercent)
          : '',
      documentDate: new Date().toISOString().slice(0, 10),
      ...initialValues
    })
  }, [isOpen, initialValues, proposedVatRatePercent, counterparties])

  const taxableCents = useMemo(
    () => parseAmountEurosToCents(values.taxableEuros) ?? 0,
    [values.taxableEuros]
  )
  const ratePct = Number(String(values.vatRatePercent).replace(',', '.'))
  const rateBp = Number.isFinite(ratePct) ? percentToBasisPoints(ratePct) : 0
  const vatCents = computeVatAmountCents(taxableCents, rateBp)
  const grossCents = computeGrossCents(taxableCents, vatCents)

  const contractsForCounterparty = useMemo(
    () =>
      confirmedContracts.filter(
        (c) =>
          c.status === 'confirmed' &&
          (!values.counterpartyId || c.counterparty_id === values.counterpartyId)
      ),
    [confirmedContracts, values.counterpartyId]
  )

  const sponsorshipBlocked =
    values.commercialKind === 'sponsorship' && contractsForCounterparty.length === 0

  const regenerateInvoiceBody = () => {
    const cp = counterparties.find((c) => c.id === values.counterpartyId)
    const ctx = buildDocContext({
      counterparty: cp,
      documentNumber: values.documentNumber,
      documentDate: values.documentDate,
      description: values.description,
      taxableCents,
      vatRateBp: rateBp,
      grossCents
    })
    setValues((v) => ({ ...v, draftBodyText: buildCommercialInvoiceBody(ctx) }))
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!values.counterpartyId) {
      setFormError('Seleziona la controparte / sponsor.')
      return
    }
    if (!values.description.trim()) {
      setFormError('Descrizione obbligatoria.')
      return
    }
    if (!values.documentDate) {
      setFormError('Data documento obbligatoria.')
      return
    }
    const cents = parseAmountEurosToCents(values.taxableEuros)
    if (cents === null || cents < 0) {
      setFormError('Imponibile non valido.')
      return
    }
    if (!Number.isFinite(ratePct) || ratePct < 0) {
      setFormError('Aliquota IVA non valida.')
      return
    }
    if (
      !canOverrideVatRate &&
      proposedVatRatePercent !== null &&
      Math.abs(ratePct - proposedVatRatePercent) > 0.0001
    ) {
      setFormError('Modifica aliquota non autorizzata (serve accounting.manage_settings).')
      return
    }
    if (values.markCollected && !values.accountId) {
      setFormError('Per registrare l’incasso seleziona un conto.')
      return
    }
    if (values.commercialKind === 'sponsorship' && contractsForCounterparty.length === 0) {
      setFormError(
        'Per una sponsorizzazione serve prima un contratto confermato con questa controparte.'
      )
      return
    }
    let body = values.draftBodyText.trim()
    if (!body) {
      const cp = counterparties.find((c) => c.id === values.counterpartyId)
      body = buildCommercialInvoiceBody(
        buildDocContext({
          counterparty: cp,
          documentNumber: values.documentNumber,
          documentDate: values.documentDate,
          description: values.description,
          taxableCents: cents,
          vatRateBp: rateBp,
          grossCents: computeGrossCents(cents, computeVatAmountCents(cents, rateBp))
        })
      )
    }
    try {
      await onSubmit({ ...values, draftBodyText: body }, cents)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Salvataggio non riuscito')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Chiudi"
        onClick={() => !saving && onClose()}
      />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        style={{ color: GOLEE.text }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? 'Nuovo documento commerciale' : 'Modifica bozza'}
          </h3>
          <button type="button" onClick={() => !saving && onClose()} className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Valori da verificare con il commercialista. Nessun invio SDI/F24.
          </p>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className={goleeLabelClass}>Sponsor / controparte</label>
              {canCreateCounterparty && onCreateCounterparty && (
                <button
                  type="button"
                  disabled={saving || cpSaving}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brixia-primary hover:underline disabled:opacity-40"
                  onClick={() => setCpFormOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Nuova controparte
                </button>
              )}
            </div>
            <select
              className={goleeInputClass}
              style={goleeInputStyle}
              value={values.counterpartyId}
              onChange={(e) => setValues((v) => ({ ...v, counterpartyId: e.target.value }))}
            >
              <option value="">Seleziona…</option>
              {localCounterparties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name} ({c.kind})
                </option>
              ))}
            </select>
            {localCounterparties.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                Nessuna controparte attiva. Creane una oppure vai al tab Anagrafica.
              </p>
            )}
          </div>
          {values.commercialKind === 'sponsorship' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {sponsorshipBlocked ? (
                <p>
                  Serve un <strong>contratto di sponsorizzazione confermato</strong> con questa
                  controparte prima di salvare/emettere.{' '}
                  {onRequestCreateContract && (
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => onRequestCreateContract()}
                    >
                      Crea contratto
                    </button>
                  )}
                </p>
              ) : (
                <div>
                  <label className={goleeLabelClass}>Contratto collegato (opz.)</label>
                  <select
                    className={goleeInputClass}
                    style={goleeInputStyle}
                    value={values.sponsorshipContractId}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, sponsorshipContractId: e.target.value }))
                    }
                  >
                    <option value="">Auto (primo confirmed per controparte)</option>
                    {contractsForCounterparty.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} · {c.starts_on}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={goleeLabelClass}>Tipo attività</label>
              <select
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.commercialKind}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    commercialKind: e.target.value as CommercialKind
                  }))
                }
              >
                <option value="sponsorship">Sponsorizzazione</option>
                <option value="advertising">Pubblicità</option>
                <option value="ticketing">Biglietteria</option>
                <option value="merchandising">Merchandising</option>
                <option value="services">Servizi</option>
                <option value="other">Altro</option>
              </select>
            </div>
            <div>
              <label className={goleeLabelClass}>Tipo documento</label>
              <select
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.documentType}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    documentType: e.target.value as AccountingDocumentType
                  }))
                }
              >
                <option value="invoice">Fattura</option>
                <option value="receipt">Ricevuta</option>
                <option value="fiscal_receipt">Scontrino</option>
                <option value="other">Altro</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={goleeLabelClass}>Numero</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.documentNumber}
                onChange={(e) => setValues((v) => ({ ...v, documentNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Data</label>
              <input
                type="date"
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.documentDate}
                onChange={(e) => setValues((v) => ({ ...v, documentDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className={goleeLabelClass}>Descrizione</label>
            <input
              className={goleeInputClass}
              style={goleeInputStyle}
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={goleeLabelClass}>Imponibile (€)</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.taxableEuros}
                onChange={(e) => setValues((v) => ({ ...v, taxableEuros: e.target.value }))}
                placeholder="10000,00"
              />
            </div>
            <div>
              <label className={goleeLabelClass}>
                Aliquota IVA %
                {proposedVatRatePercent !== null && (
                  <span className="ml-1 font-normal text-slate-500">
                    (param: {proposedVatRatePercent})
                  </span>
                )}
              </label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.vatRatePercent}
                readOnly={!canOverrideVatRate}
                onChange={(e) => setValues((v) => ({ ...v, vatRatePercent: e.target.value }))}
              />
              {!canOverrideVatRate && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Aliquota proposta dai parametri; override con manage_settings.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div>
              IVA calcolata:{' '}
              <strong>{(vatCents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })} €</strong>
            </div>
            <div>
              Lordo:{' '}
              <strong>
                {(grossCents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })} €
              </strong>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.includeIn398Limit}
              onChange={(e) => setValues((v) => ({ ...v, includeIn398Limit: e.target.checked }))}
            />
            Includi nel limite commerciale 398
          </label>
          {mode === 'create' && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.markCollected}
                  onChange={(e) => setValues((v) => ({ ...v, markCollected: e.target.checked }))}
                />
                Già incassato (dopo emissione crea/collega movimento di cassa)
              </label>
              {values.markCollected && (
                <select
                  className={goleeInputClass}
                  style={goleeInputStyle}
                  value={values.accountId}
                  onChange={(e) => setValues((v) => ({ ...v, accountId: e.target.value }))}
                >
                  <option value="">Conto incasso…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-slate-500">
                Documento emesso non incassato: non aumenta le entrate di cassa del consuntivo;
                compare comunque nel prospetto IVA.
              </p>
            </div>
          )}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className={goleeLabelClass}>Testo documento (bozza)</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:underline"
                  onClick={regenerateInvoiceBody}
                >
                  <FileText className="h-3 w-3" />
                  Rigenera da dati
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:underline disabled:opacity-40"
                  disabled={!values.draftBodyText.trim()}
                  onClick={() =>
                    void downloadTextAsDocx(
                      `fattura-${values.documentNumber || values.documentDate || 'bozza'}`,
                      values.draftBodyText
                    )
                  }
                >
                  <Download className="h-3 w-3" />
                  Scarica Word
                </button>
              </div>
            </div>
            <textarea
              className={`${goleeInputClass} min-h-[160px] font-mono text-xs`}
              style={goleeInputStyle}
              value={values.draftBodyText}
              onChange={(e) => setValues((v) => ({ ...v, draftBodyText: e.target.value }))}
              placeholder="Testo fattura editabile. PDF solo dopo emissione."
            />
          </div>
          <div>
            <label className={goleeLabelClass}>Note</label>
            <textarea
              className={goleeInputClass}
              style={goleeInputStyle}
              rows={2}
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            />
          </div>
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-2 pb-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brixia-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Salvataggio…' : 'Salva bozza'}
            </button>
          </div>
        </form>
      </div>
      <CounterpartyFormModal
        isOpen={cpFormOpen}
        mode="create"
        defaultKind="sponsor"
        saving={cpSaving}
        onClose={() => setCpFormOpen(false)}
        onSubmit={async (input) => {
          if (!onCreateCounterparty) return
          setCpSaving(true)
          try {
            const created = await onCreateCounterparty(input)
            const ref: AccountingCounterpartyRef = {
              id: created.id,
              display_name: created.display_name,
              kind: created.kind,
              is_active: created.is_active
            }
            setLocalCounterparties((prev) =>
              prev.some((c) => c.id === ref.id)
                ? prev
                : [...prev, ref].sort((a, b) => a.display_name.localeCompare(b.display_name))
            )
            setValues((v) => ({ ...v, counterpartyId: created.id }))
            setCpFormOpen(false)
          } finally {
            setCpSaving(false)
          }
        }}
      />
    </div>,
    document.body
  )
}
