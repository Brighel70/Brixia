import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { formatFeeAmount } from '@/utils/feeUtils'
import type { AccountingCounterparty, AccountingCounterpartyRef, SponsorshipContract } from '../types'
import {
  buildEqualInstallments,
  buildSponsorshipContractParts,
  contractPartsToPlainText,
  parseContractBodyParts,
  serializeContractBodyParts,
  type ContractBodyParts,
  type PaymentInstallment,
  type PaymentPlan
} from '../utils/sponsorshipContractTemplate'
import { downloadTextAsDocx } from '../utils/documentTemplates'
import {
  computeGrossCents,
  computeVatAmountCents,
  percentToBasisPoints
} from '../utils/vatCalculations'
import { parseAmountEurosToCents } from '../utils/movementValidation'
import { WordLikeEditor } from './WordLikeEditor'
import type { SponsorshipContractFormValues } from './SponsorshipContractFormModal'

type EditorTab = 'contract' | 'annexA' | 'annexBC'

interface SponsorshipContractEditorProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  counterparties: AccountingCounterpartyRef[]
  counterpartiesFull?: AccountingCounterparty[]
  initialContract?: SponsorshipContract | null
  prefillCounterpartyId?: string
  proposedVatRatePercent: number | null
  saving: boolean
  onClose: () => void
  onSave: (values: SponsorshipContractFormValues, taxableCents: number) => Promise<void>
  onConfirmAndPdf?: (values: SponsorshipContractFormValues, taxableCents: number) => Promise<void>
  showConfirm?: boolean
}

function defaultPlan(startsOn: string, endsOn: string, taxableCents: number): PaymentPlan {
  return {
    mode: 'single',
    method: 'Bonifico bancario',
    installments: [{ dueOn: '', taxableCents: Math.max(0, taxableCents) }]
  }
}

export function SponsorshipContractEditor({
  isOpen,
  mode,
  counterparties,
  counterpartiesFull = [],
  initialContract = null,
  prefillCounterpartyId,
  proposedVatRatePercent,
  saving,
  onClose,
  onSave,
  onConfirmAndPdf,
  showConfirm = false
}: SponsorshipContractEditorProps) {
  const [tab, setTab] = useState<EditorTab>('contract')
  const [counterpartyId, setCounterpartyId] = useState('')
  const [title, setTitle] = useState('Contratto di sponsorizzazione')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [taxableEuros, setTaxableEuros] = useState('')
  const [vatRatePercent, setVatRatePercent] = useState('22')
  const [notes, setNotes] = useState('')
  const [parts, setParts] = useState<ContractBodyParts | null>(null)
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan | null>(null)
  const [installmentCount, setInstallmentCount] = useState(2)
  const [bodyDirty, setBodyDirty] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [seeded, setSeeded] = useState(false)

  const taxableCents = useMemo(
    () => parseAmountEurosToCents(taxableEuros) ?? 0,
    [taxableEuros]
  )
  const ratePct = Number(String(vatRatePercent).replace(',', '.'))
  const rateBp = Number.isFinite(ratePct) ? percentToBasisPoints(ratePct) : 2200
  const vatCents = computeVatAmountCents(taxableCents, rateBp)
  const grossCents = computeGrossCents(taxableCents, vatCents)

  const selectedFull = useMemo(() => {
    return (
      counterpartiesFull.find((c) => c.id === counterpartyId) ??
      counterparties.find((c) => c.id === counterpartyId) ??
      null
    )
  }, [counterpartiesFull, counterparties, counterpartyId])

  const rebuildParts = (plan: PaymentPlan | null) =>
    buildSponsorshipContractParts({
      counterparty: selectedFull,
      title,
      startsOn,
      endsOn: endsOn || null,
      taxableCents,
      vatRateBp: rateBp,
      grossCents,
      paymentPlan: plan
    })

  useEffect(() => {
    if (!isOpen) {
      setSeeded(false)
      return
    }
    setFormError(null)
    setTab('contract')
    setBodyDirty(false)
    const today = new Date().toISOString().slice(0, 10)
    if (mode === 'edit' && initialContract) {
      setCounterpartyId(initialContract.counterparty_id)
      setTitle(initialContract.title)
      setStartsOn(initialContract.starts_on)
      setEndsOn(initialContract.ends_on ?? '')
      setTaxableEuros((initialContract.taxable_amount_cents / 100).toFixed(2).replace('.', ','))
      setVatRatePercent(String(initialContract.vat_rate_basis_points / 100))
      setNotes(initialContract.notes ?? '')
      const parsed = parseContractBodyParts(initialContract.body_text)
      const plan =
        parsed?.paymentPlan ??
        defaultPlan(
          initialContract.starts_on,
          initialContract.ends_on ?? '',
          initialContract.taxable_amount_cents
        )
      setPaymentPlan(plan)
      setInstallmentCount(Math.max(2, plan.installments.length || 2))
      setParts(
        parsed ??
          buildSponsorshipContractParts({
            counterparty: initialContract.counterparty,
            title: initialContract.title,
            startsOn: initialContract.starts_on,
            endsOn: initialContract.ends_on,
            taxableCents: initialContract.taxable_amount_cents,
            vatRateBp: initialContract.vat_rate_basis_points,
            grossCents: initialContract.gross_amount_cents,
            paymentPlan: plan
          })
      )
      setSeeded(true)
    } else if (!seeded) {
      setCounterpartyId(prefillCounterpartyId ?? '')
      setTitle('Contratto di sponsorizzazione')
      setStartsOn(today)
      setEndsOn('')
      setTaxableEuros('')
      setVatRatePercent(
        proposedVatRatePercent !== null && proposedVatRatePercent !== undefined
          ? String(proposedVatRatePercent)
          : '22'
      )
      setNotes('')
      setParts(null)
      setPaymentPlan(defaultPlan(today, '', 0))
      setInstallmentCount(2)
      setSeeded(true)
    }
  }, [isOpen, mode, initialContract, proposedVatRatePercent, seeded, prefillCounterpartyId])

  // Allinea solo gli importi del piano; le scadenze restano quelle scelte dall’utente
  useEffect(() => {
    if (!isOpen || !seeded || !paymentPlan) return
    setPaymentPlan((prev) => {
      if (!prev) return prev
      if (prev.mode === 'single') {
        const cur = prev.installments[0]
        if (cur && cur.taxableCents === taxableCents) return prev
        return {
          ...prev,
          installments: [
            {
              dueOn: cur?.dueOn || '',
              taxableCents
            }
          ]
        }
      }
      const split = buildEqualInstallments({
        taxableCents,
        count: Math.max(2, prev.installments.length),
        firstDueOn: prev.installments[0]?.dueOn || startsOn || new Date().toISOString().slice(0, 10),
        lastDueOn: prev.installments[prev.installments.length - 1]?.dueOn || endsOn || null
      })
      const next = split.map((r, i) => ({
        dueOn: prev.installments[i]?.dueOn || r.dueOn,
        taxableCents: r.taxableCents
      }))
      const same =
        next.length === prev.installments.length &&
        next.every(
          (r, i) =>
            r.dueOn === prev.installments[i]?.dueOn &&
            r.taxableCents === prev.installments[i]?.taxableCents
        )
      if (same) return prev
      return { ...prev, installments: next }
    })
  }, [isOpen, seeded, taxableCents, paymentPlan?.mode, paymentPlan?.installments.length])

  // Sync automatico dati intestazione + piano pagamenti → documento
  useEffect(() => {
    if (!isOpen || !seeded || !counterpartyId || bodyDirty) return
    if (!startsOn && taxableCents <= 0) return
    const plan = paymentPlan ?? defaultPlan(startsOn, endsOn, taxableCents)
    const next = rebuildParts(plan)
    setParts((prev) => {
      if (
        prev &&
        prev.contractHtml === next.contractHtml &&
        prev.annexAHtml === next.annexAHtml &&
        prev.annexBCHtml === next.annexBCHtml
      ) {
        return prev
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuildParts usa state corrente
  }, [
    isOpen,
    seeded,
    counterpartyId,
    title,
    startsOn,
    endsOn,
    taxableCents,
    rateBp,
    paymentPlan,
    bodyDirty,
    selectedFull
  ])

  const applyPaymentMode = (modeNext: 'single' | 'installments') => {
    setBodyDirty(false)
    if (modeNext === 'single') {
      const existingDue = paymentPlan?.installments[0]?.dueOn || ''
      setPaymentPlan({
        mode: 'single',
        method: paymentPlan?.method || 'Bonifico bancario',
        installments: [
          {
            dueOn: existingDue,
            taxableCents
          }
        ]
      })
      return
    }
    const rows = buildEqualInstallments({
      taxableCents,
      count: installmentCount,
      firstDueOn: paymentPlan?.installments[0]?.dueOn || startsOn || new Date().toISOString().slice(0, 10),
      lastDueOn: endsOn || null
    })
    setPaymentPlan({
      mode: 'installments',
      method: paymentPlan?.method || 'Bonifico bancario',
      installments: rows
    })
  }

  const redistributeInstallments = (count: number) => {
    setInstallmentCount(count)
    setBodyDirty(false)
    setPaymentPlan({
      mode: 'installments',
      method: paymentPlan?.method || 'Bonifico bancario',
      installments: buildEqualInstallments({
        taxableCents,
        count,
        firstDueOn: startsOn || new Date().toISOString().slice(0, 10),
        lastDueOn: endsOn || null
      })
    })
  }

  const updateInstallment = (index: number, patch: Partial<PaymentInstallment>) => {
    if (!paymentPlan) return
    setBodyDirty(false)
    const next = paymentPlan.installments.map((row, i) =>
      i === index ? { ...row, ...patch } : row
    )
    setPaymentPlan({ ...paymentPlan, installments: next })
  }

  const updateInstallmentEuros = (index: number, euros: string) => {
    const cents = parseAmountEurosToCents(euros)
    if (cents === null) return
    updateInstallment(index, { taxableCents: cents })
  }

  const addInstallment = () => {
    if (!paymentPlan) return
    setBodyDirty(false)
    setPaymentPlan({
      ...paymentPlan,
      mode: 'installments',
      installments: [
        ...paymentPlan.installments,
        {
          dueOn: endsOn || startsOn || new Date().toISOString().slice(0, 10),
          taxableCents: 0
        }
      ]
    })
    setInstallmentCount(paymentPlan.installments.length + 1)
  }

  const removeInstallment = (index: number) => {
    if (!paymentPlan || paymentPlan.installments.length <= 1) return
    setBodyDirty(false)
    const next = paymentPlan.installments.filter((_, i) => i !== index)
    setPaymentPlan({
      ...paymentPlan,
      mode: next.length === 1 ? 'single' : 'installments',
      installments: next
    })
    setInstallmentCount(Math.max(2, next.length))
  }

  const regenerateTemplate = () => {
    if (!counterpartyId) {
      setFormError('Seleziona prima lo sponsor.')
      return
    }
    setFormError(null)
    setBodyDirty(false)
    const plan = paymentPlan ?? defaultPlan(startsOn, endsOn, taxableCents)
    setParts(rebuildParts(plan))
  }

  if (!isOpen || typeof document === 'undefined') return null

  const activeHtml =
    tab === 'contract'
      ? parts?.contractHtml ?? ''
      : tab === 'annexA'
        ? parts?.annexAHtml ?? ''
        : parts?.annexBCHtml ?? ''

  const setActiveHtml = (html: string) => {
    setBodyDirty(true)
    setParts((prev) => {
      const base =
        prev ??
        rebuildParts(paymentPlan ?? defaultPlan(startsOn, endsOn, taxableCents))
      if (tab === 'contract') return { ...base, contractHtml: html, paymentPlan: paymentPlan ?? undefined }
      if (tab === 'annexA') return { ...base, annexAHtml: html, paymentPlan: paymentPlan ?? undefined }
      return { ...base, annexBCHtml: html, paymentPlan: paymentPlan ?? undefined }
    })
  }

  const buildValues = (): SponsorshipContractFormValues | null => {
    if (!counterpartyId) {
      setFormError('Seleziona lo sponsor.')
      return null
    }
    if (!title.trim()) {
      setFormError('Titolo obbligatorio.')
      return null
    }
    if (!startsOn) {
      setFormError('Data inizio obbligatoria.')
      return null
    }
    if (parseAmountEurosToCents(taxableEuros) === null) {
      setFormError('Imponibile non valido.')
      return null
    }
    const plan = paymentPlan ?? defaultPlan(startsOn, endsOn, taxableCents)
    if (!plan.installments.length || plan.installments.some((r) => !r.dueOn)) {
      setFormError(
        plan.mode === 'single'
          ? 'Indica la data entro cui deve avvenire il pagamento (unico versamento).'
          : 'Indica la scadenza di ogni rata.'
      )
      return null
    }
    const bodyParts = bodyDirty && parts
      ? { ...parts, paymentPlan: plan }
      : { ...rebuildParts(plan), paymentPlan: plan }
    if (!bodyDirty) setParts(bodyParts)
    return {
      counterpartyId,
      title,
      startsOn,
      endsOn,
      taxableEuros,
      vatRatePercent,
      bodyText: serializeContractBodyParts(bodyParts),
      notes
    }
  }

  const handleSave = async () => {
    setFormError(null)
    const values = buildValues()
    if (!values) return
    try {
      await onSave(values, taxableCents)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Salvataggio non riuscito')
    }
  }

  const handleConfirm = async () => {
    if (!onConfirmAndPdf) return
    setFormError(null)
    const values = buildValues()
    if (!values) return
    try {
      await onConfirmAndPdf(values, taxableCents)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Conferma non riuscita')
    }
  }

  const tabBtn = (id: EditorTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
        tab === id
          ? 'bg-white text-slate-900 shadow-sm'
          : 'bg-slate-200/80 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )

  const planMode = paymentPlan?.mode ?? 'single'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-800">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3 text-white">
        <div>
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? 'Nuovo contratto sponsor' : 'Modifica bozza contratto'}
          </h2>
          <p className="text-xs text-white/70">
            I dati in alto e il piano pagamenti aggiornano automaticamente Contratto e Allegato B.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg p-2 hover:bg-white/10"
          onClick={() => !saving && onClose()}
          aria-label="Chiudi"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="shrink-0 max-h-[42vh] overflow-y-auto border-b border-slate-300 bg-white px-4 py-3">
        <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-slate-500">Sponsor</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={counterpartyId}
              disabled={mode === 'edit'}
              onChange={(e) => setCounterpartyId(e.target.value)}
            >
              <option value="">Seleziona…</option>
              {counterparties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-slate-500">Titolo</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Inizio</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Fine (scadenza contratto)</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Imponibile €</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={taxableEuros}
              onChange={(e) => setTaxableEuros(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">IVA %</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={vatRatePercent}
              onChange={(e) => setVatRatePercent(e.target.value)}
            />
          </div>
        </div>

        <div className="mx-auto mt-3 max-w-6xl rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Piano pagamenti (Allegato B)</p>
            <span className="text-xs text-slate-500">Lordo stimato: {formatFeeAmount(grossCents)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                planMode === 'single'
                  ? 'bg-brand-primary text-white'
                  : 'border border-slate-300 bg-white text-slate-700'
              }`}
              onClick={() => applyPaymentMode('single')}
            >
              Unico versamento
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                planMode === 'installments'
                  ? 'bg-brand-primary text-white'
                  : 'border border-slate-300 bg-white text-slate-700'
              }`}
              onClick={() => applyPaymentMode('installments')}
            >
              Rate
            </button>
            {planMode === 'installments' && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                N. rate
                <input
                  type="number"
                  min={2}
                  max={24}
                  className="w-16 rounded border border-slate-300 px-2 py-1"
                  value={installmentCount}
                  onChange={(e) => redistributeInstallments(Number(e.target.value) || 2)}
                />
              </label>
            )}
            <input
              className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="Modalità (es. Bonifico bancario)"
              value={paymentPlan?.method ?? ''}
              onChange={(e) => {
                setBodyDirty(false)
                setPaymentPlan((prev) => ({
                  mode: prev?.mode ?? 'single',
                  method: e.target.value,
                  installments: prev?.installments ?? [
                    { dueOn: '', taxableCents }
                  ]
                }))
              }}
            />
          </div>

          {planMode === 'single' && paymentPlan && (
            <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Scadenza pagamento <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={paymentPlan.installments[0]?.dueOn ?? ''}
                  onChange={(e) => updateInstallment(0, { dueOn: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Data entro cui deve avvenire l’unico versamento.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Importo (imponibile)</label>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatFeeAmount(taxableCents)}
                  <span className="ml-2 font-normal text-slate-500">
                    · lordo {formatFeeAmount(grossCents)}
                  </span>
                </p>
              </div>
            </div>
          )}

          {planMode === 'installments' && paymentPlan && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-1">N.</th>
                    <th className="px-2 py-1">Scadenza *</th>
                    <th className="px-2 py-1">Imponibile €</th>
                    <th className="px-2 py-1">IVA</th>
                    <th className="px-2 py-1">Totale</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {paymentPlan.installments.map((row, idx) => {
                    const rowVat = computeVatAmountCents(row.taxableCents, rateBp)
                    const rowGross = row.taxableCents + rowVat
                    return (
                      <tr key={idx} className="border-t border-slate-200">
                        <td className="px-2 py-1">{idx + 1}</td>
                        <td className="px-2 py-1">
                          <input
                            type="date"
                            required
                            className="rounded border border-slate-300 px-2 py-1"
                            value={row.dueOn}
                            onChange={(e) => updateInstallment(idx, { dueOn: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            className="w-28 rounded border border-slate-300 px-2 py-1"
                            defaultValue={(row.taxableCents / 100).toFixed(2).replace('.', ',')}
                            key={`${idx}-${row.taxableCents}-${paymentPlan.mode}-${installmentCount}`}
                            onBlur={(e) => updateInstallmentEuros(idx, e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1 text-slate-600">{formatFeeAmount(rowVat)}</td>
                        <td className="px-2 py-1 font-medium">{formatFeeAmount(rowGross)}</td>
                        <td className="px-2 py-1">
                          {paymentPlan.installments.length > 1 && (
                            <button
                              type="button"
                              className="rounded p-1 text-slate-500 hover:bg-slate-200"
                              onClick={() => removeInstallment(idx)}
                              title="Rimuovi rata"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                onClick={addInstallment}
              >
                <Plus className="h-3 w-3" />
                Aggiungi rata
              </button>
            </div>
          )}
        </div>

        <div className="mx-auto mt-2 flex max-w-6xl flex-wrap items-center gap-2 text-xs text-slate-600">
          {bodyDirty ? (
            <span className="rounded bg-amber-50 px-2 py-1 text-amber-800">
              Hai modificato il testo a mano. Clicca «Rigenera testo da dati» per riallineare date/importi/rate.
            </span>
          ) : (
            <span>Testo allineato ai dati in alto.</span>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
            onClick={regenerateTemplate}
          >
            <RefreshCw className="h-3 w-3" />
            Rigenera testo da dati
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
            disabled={!parts}
            onClick={() => {
              if (!parts) return
              void downloadTextAsDocx(
                `contratto-sponsor-${startsOn || 'bozza'}`,
                contractPartsToPlainText(parts)
              )
            }}
          >
            <Download className="h-3 w-3" />
            Scarica Word
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-200 px-2 pt-2 md:px-4">
        <div className="mx-auto flex w-full max-w-6xl shrink-0 gap-1">
          {tabBtn('contract', 'Contratto')}
          {tabBtn('annexA', 'Allegato A')}
          {tabBtn('annexBC', 'Allegato B / C')}
        </div>
        <div className="mx-auto min-h-0 w-full max-w-6xl flex-1 overflow-hidden pb-2">
          {parts ? (
            <WordLikeEditor
              key={tab}
              content={activeHtml}
              onChange={setActiveHtml}
              editable
              minHeightClass="min-h-[320px]"
            />
          ) : (
            <div className="flex h-full min-h-[50vh] items-center justify-center rounded-lg border border-dashed border-slate-400 bg-white text-sm text-slate-500">
              Seleziona lo sponsor e l’imponibile: il documento si compila da solo.
            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-300 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {formError ? (
            <p className="text-sm text-red-700">{formError}</p>
          ) : (
            <p className="text-xs text-slate-500">
              Dopo «Salva» lo ritrovi in Contabilità → IVA / Sponsor → Contratti di sponsorizzazione.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
            {showConfirm && onConfirmAndPdf && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleConfirm()}
                className="rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-50"
              >
                Conferma + PDF
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>,
    document.body
  )
}
