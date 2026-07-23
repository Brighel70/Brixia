import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRightLeft, Landmark, X } from 'lucide-react'
import { GOLEE, goleeInputClass, goleeInputStyle, goleeLabelClass } from '@/config/goleeTheme'
import type { AccountingAccountRef, AccountingFiscalYear } from '../types'
import {
  formatCentsToEuroInput,
  isFiscalYearOpenForEditing,
  parseAmountEurosToCents
} from '../utils/movementValidation'

export interface TransferFormValues {
  movementDate: string
  settlementDate: string
  amountEuros: string
  sourceAccountId: string
  destinationAccountId: string
  description: string
  notes: string
}

interface TransferFormModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  fiscalYear: AccountingFiscalYear | null
  accounts: AccountingAccountRef[]
  initialValues?: Partial<TransferFormValues>
  saving: boolean
  onClose: () => void
  onSubmit: (values: TransferFormValues, amountCents: number) => Promise<void>
}

const EMPTY_VALUES: TransferFormValues = {
  movementDate: '',
  settlementDate: '',
  amountEuros: '',
  sourceAccountId: '',
  destinationAccountId: '',
  description: '',
  notes: ''
}

export function transferMovementToFormValues(movement: {
  movement_date: string
  settlement_date?: string | null
  amount_cents: number
  account: { id: string } | null
  transfer_account?: { id: string } | null
  description: string
  notes?: string | null
}): TransferFormValues {
  return {
    movementDate: movement.movement_date,
    settlementDate: movement.settlement_date ?? '',
    amountEuros: formatCentsToEuroInput(movement.amount_cents),
    sourceAccountId: movement.account?.id ?? '',
    destinationAccountId: movement.transfer_account?.id ?? '',
    description: movement.description,
    notes: movement.notes ?? ''
  }
}

function validateTransfer(
  values: TransferFormValues,
  fiscalYear: AccountingFiscalYear | null,
  accounts: AccountingAccountRef[]
): string | null {
  if (!fiscalYear || !isFiscalYearOpenForEditing(fiscalYear)) {
    return 'I giroconti sono disponibili solo in un esercizio aperto.'
  }
  if (!values.movementDate) return 'La data del giroconto e obbligatoria.'
  if (values.movementDate < fiscalYear.starts_on || values.movementDate > fiscalYear.ends_on) {
    return `La data deve essere compresa nell'esercizio ${fiscalYear.code}.`
  }
  if (
    values.settlementDate &&
    (values.settlementDate < fiscalYear.starts_on || values.settlementDate > fiscalYear.ends_on)
  ) {
    return `La data di esecuzione deve essere compresa nell'esercizio ${fiscalYear.code}.`
  }
  if (parseAmountEurosToCents(values.amountEuros) === null) {
    return 'Inserisci un importo positivo valido.'
  }
  if (!accounts.some((account) => account.id === values.sourceAccountId)) {
    return 'Seleziona il conto di partenza.'
  }
  if (!accounts.some((account) => account.id === values.destinationAccountId)) {
    return 'Seleziona il conto di destinazione.'
  }
  if (values.sourceAccountId === values.destinationAccountId) {
    return 'Il conto di destinazione deve essere diverso da quello di partenza.'
  }
  if (!values.description.trim()) return 'La descrizione e obbligatoria.'
  return null
}

export function TransferFormModal({
  isOpen,
  mode,
  fiscalYear,
  accounts,
  initialValues,
  saving,
  onClose,
  onSubmit
}: TransferFormModalProps) {
  const [values, setValues] = useState<TransferFormValues>(EMPTY_VALUES)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setFormError(null)
    setValues({
      ...EMPTY_VALUES,
      movementDate: fiscalYear ? new Date().toISOString().slice(0, 10) : '',
      ...initialValues
    })
  }, [isOpen, initialValues, fiscalYear])

  if (!isOpen || typeof document === 'undefined') return null

  const patch = (next: Partial<TransferFormValues>) => {
    setValues((current) => ({ ...current, ...next }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const validationError = validateTransfer(values, fiscalYear, accounts)
    if (validationError) {
      setFormError(validationError)
      return
    }
    const amountCents = parseAmountEurosToCents(values.amountEuros)
    if (amountCents === null) return
    setFormError(null)
    await onSubmit(values, amountCents)
  }

  return createPortal(
    <div className="fixed inset-0 z-[225] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#0B1220]/55 backdrop-blur-[10px]" onClick={saving ? undefined : onClose} />
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border shadow-[0_28px_90px_rgba(11,18,32,0.32)]"
        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border, color: GOLEE.text }}
      >
        <div className="relative overflow-hidden bg-[#15213A] px-6 py-4 sm:px-8">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[#3B82F6]" />
          <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full bg-[#00C48C]/15" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3B82F6]/20 text-[#9CC5FF]">
                <ArrowRightLeft className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {mode === 'create' ? 'Nuovo giroconto' : 'Modifica giroconto'}
                </h2>
                <p className="mt-0.5 text-sm text-slate-300">Sposta denaro tra due conti senza creare un ricavo o un costo.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-slate-200 transition hover:bg-white/20 disabled:opacity-50"
              aria-label="Chiudi"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={(event) => void submit(event)} className="min-h-0 flex-1 overflow-y-auto bg-[#F6F8FB] p-6 sm:p-8">
          {formError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</div>}

          <section className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: GOLEE.border }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={goleeLabelClass}>Data giroconto *</label>
                <input type="date" value={values.movementDate} onChange={(event) => patch({ movementDate: event.target.value })} className={goleeInputClass} style={goleeInputStyle} />
              </div>
              <div>
                <label className={goleeLabelClass}>Data esecuzione</label>
                <input type="date" value={values.settlementDate} onChange={(event) => patch({ settlementDate: event.target.value })} className={goleeInputClass} style={goleeInputStyle} />
              </div>
              <div className="sm:col-span-2">
                <label className={goleeLabelClass}>Importo (EUR) *</label>
                <input type="text" inputMode="decimal" placeholder="0,00" value={values.amountEuros} onChange={(event) => patch({ amountEuros: event.target.value })} className={goleeInputClass} style={goleeInputStyle} />
              </div>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: GOLEE.border }}>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-lg p-2" style={{ backgroundColor: GOLEE.infoSoft, color: GOLEE.info }}><Landmark className="h-4 w-4" /></span>
              <p className="text-sm font-semibold" style={{ color: GOLEE.text }}>Da quale conto a quale conto</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={goleeLabelClass}>Conto di partenza *</label>
                <select value={values.sourceAccountId} onChange={(event) => patch({ sourceAccountId: event.target.value })} className={goleeInputClass} style={goleeInputStyle}>
                  <option value="">Seleziona conto</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                </select>
              </div>
              <div>
                <label className={goleeLabelClass}>Conto di destinazione *</label>
                <select value={values.destinationAccountId} onChange={(event) => patch({ destinationAccountId: event.target.value })} className={goleeInputClass} style={goleeInputStyle}>
                  <option value="">Seleziona conto</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: GOLEE.border }}>
            <label className={goleeLabelClass}>Descrizione *</label>
            <input type="text" value={values.description} onChange={(event) => patch({ description: event.target.value })} placeholder="es. Versamento contanti in banca" className={goleeInputClass} style={goleeInputStyle} />
            <label className={`mt-4 ${goleeLabelClass}`}>Note</label>
            <textarea rows={3} value={values.notes} onChange={(event) => patch({ notes: event.target.value })} className={goleeInputClass} style={goleeInputStyle} />
          </section>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end" style={{ borderColor: GOLEE.border }}>
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border bg-white px-5 py-3 text-sm font-semibold disabled:opacity-50" style={{ borderColor: GOLEE.border, color: GOLEE.text }}>Annulla</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-[#1677FF] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:opacity-50">{saving ? 'Salvataggio...' : mode === 'create' ? 'Salva bozza giroconto' : 'Salva modifiche'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
