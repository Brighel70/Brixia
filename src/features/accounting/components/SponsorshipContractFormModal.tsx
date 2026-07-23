import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileText, X } from 'lucide-react'
import {
  GOLEE,
  goleeInputClass,
  goleeInputStyle,
  goleeLabelClass
} from '@/config/goleeTheme'
import { formatFeeAmount } from '@/utils/feeUtils'
import type { AccountingCounterpartyRef, SponsorshipContract } from '../types'
import {
  buildDocContext,
  buildSponsorshipContractBody,
  downloadTextAsDocx
} from '../utils/documentTemplates'
import { computeGrossCents, computeVatAmountCents, percentToBasisPoints } from '../utils/vatCalculations'
import { parseAmountEurosToCents } from '../utils/movementValidation'

export interface SponsorshipContractFormValues {
  counterpartyId: string
  title: string
  startsOn: string
  endsOn: string
  taxableEuros: string
  vatRatePercent: string
  bodyText: string
  notes: string
}

interface SponsorshipContractFormModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  counterparties: AccountingCounterpartyRef[]
  initialValues?: Partial<SponsorshipContractFormValues>
  proposedVatRatePercent: number | null
  saving: boolean
  onClose: () => void
  onSubmit: (values: SponsorshipContractFormValues, taxableCents: number) => Promise<void>
}

const EMPTY: SponsorshipContractFormValues = {
  counterpartyId: '',
  title: 'Contratto di sponsorizzazione',
  startsOn: '',
  endsOn: '',
  taxableEuros: '',
  vatRatePercent: '',
  bodyText: '',
  notes: ''
}

export function contractToFormValues(c: SponsorshipContract): SponsorshipContractFormValues {
  return {
    counterpartyId: c.counterparty_id,
    title: c.title,
    startsOn: c.starts_on,
    endsOn: c.ends_on ?? '',
    taxableEuros: (c.taxable_amount_cents / 100).toFixed(2).replace('.', ','),
    vatRatePercent: String(c.vat_rate_basis_points / 100),
    bodyText: c.body_text,
    notes: c.notes ?? ''
  }
}

export function SponsorshipContractFormModal({
  isOpen,
  mode,
  counterparties,
  initialValues,
  proposedVatRatePercent,
  saving,
  onClose,
  onSubmit
}: SponsorshipContractFormModalProps) {
  const [values, setValues] = useState<SponsorshipContractFormValues>(EMPTY)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setFormError(null)
    const today = new Date().toISOString().slice(0, 10)
    setValues({
      ...EMPTY,
      startsOn: today,
      vatRatePercent:
        proposedVatRatePercent !== null && proposedVatRatePercent !== undefined
          ? String(proposedVatRatePercent)
          : '22',
      ...initialValues
    })
  }, [isOpen, initialValues, proposedVatRatePercent])

  const taxableCents = useMemo(
    () => parseAmountEurosToCents(values.taxableEuros) ?? 0,
    [values.taxableEuros]
  )
  const ratePct = Number(String(values.vatRatePercent).replace(',', '.'))
  const rateBp = Number.isFinite(ratePct) ? percentToBasisPoints(ratePct) : 0
  const vatCents = computeVatAmountCents(taxableCents, rateBp)
  const grossCents = computeGrossCents(taxableCents, vatCents)

  const regenerateBody = () => {
    const cp = counterparties.find((c) => c.id === values.counterpartyId)
    const ctx = buildDocContext({
      counterparty: cp,
      title: values.title,
      startsOn: values.startsOn,
      endsOn: values.endsOn || null,
      taxableCents,
      vatRateBp: rateBp,
      grossCents
    })
    setValues((v) => ({ ...v, bodyText: buildSponsorshipContractBody(ctx) }))
  }

  if (!isOpen || typeof document === 'undefined') return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!values.counterpartyId) {
      setFormError('Seleziona lo sponsor.')
      return
    }
    if (!values.title.trim()) {
      setFormError('Titolo obbligatorio.')
      return
    }
    if (!values.startsOn) {
      setFormError('Data inizio obbligatoria.')
      return
    }
    if (taxableCents < 0 || parseAmountEurosToCents(values.taxableEuros) === null) {
      setFormError('Imponibile non valido.')
      return
    }
    let body = values.bodyText.trim()
    if (!body) {
      const cp = counterparties.find((c) => c.id === values.counterpartyId)
      body = buildSponsorshipContractBody(
        buildDocContext({
          counterparty: cp,
          title: values.title,
          startsOn: values.startsOn,
          endsOn: values.endsOn || null,
          taxableCents,
          vatRateBp: rateBp,
          grossCents
        })
      )
    }
    try {
      await onSubmit({ ...values, bodyText: body }, taxableCents)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Salvataggio non riuscito')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Chiudi"
        onClick={() => !saving && onClose()}
      />
      <div
        className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        style={{ color: GOLEE.text }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? 'Nuovo contratto sponsor' : 'Modifica bozza contratto'}
          </h3>
          <button type="button" onClick={() => !saving && onClose()} className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Modifica il testo in app (fonte di verità). Puoi scaricare Word per revisione offline.
            Il PDF si genera solo alla conferma.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={goleeLabelClass}>Sponsor</label>
              <select
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.counterpartyId}
                onChange={(e) => setValues((v) => ({ ...v, counterpartyId: e.target.value }))}
              >
                <option value="">Seleziona…</option>
                {counterparties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={goleeLabelClass}>Titolo</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.title}
                onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Inizio</label>
              <input
                type="date"
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.startsOn}
                onChange={(e) => setValues((v) => ({ ...v, startsOn: e.target.value }))}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Fine (opz.)</label>
              <input
                type="date"
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.endsOn}
                onChange={(e) => setValues((v) => ({ ...v, endsOn: e.target.value }))}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Imponibile €</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.taxableEuros}
                onChange={(e) => setValues((v) => ({ ...v, taxableEuros: e.target.value }))}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Aliquota IVA %</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.vatRatePercent}
                onChange={(e) => setValues((v) => ({ ...v, vatRatePercent: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Lordo stimato: {formatFeeAmount(grossCents)} (IVA {formatFeeAmount(vatCents)})
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs"
              onClick={regenerateBody}
            >
              <FileText className="h-3 w-3" />
              Rigenera testo da dati
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs"
              disabled={!values.bodyText.trim()}
              onClick={() =>
                void downloadTextAsDocx(
                  `contratto-sponsor-${values.startsOn || 'bozza'}`,
                  values.bodyText
                )
              }
            >
              <Download className="h-3 w-3" />
              Scarica Word
            </button>
          </div>
          <div>
            <label className={goleeLabelClass}>Testo contratto (bozza)</label>
            <textarea
              className={`${goleeInputClass} min-h-[280px] font-mono text-xs`}
              style={goleeInputStyle}
              value={values.bodyText}
              onChange={(e) => setValues((v) => ({ ...v, bodyText: e.target.value }))}
              placeholder="Clicca «Rigenera testo da dati» oppure scrivi il contratto…"
            />
          </div>
          <div>
            <label className={goleeLabelClass}>Note interne</label>
            <textarea
              className={goleeInputClass}
              style={goleeInputStyle}
              rows={2}
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            />
          </div>
          {formError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Salvataggio…' : 'Salva bozza'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
