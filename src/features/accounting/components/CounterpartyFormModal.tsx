import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  GOLEE,
  goleeInputClass,
  goleeInputStyle,
  goleeLabelClass
} from '@/config/goleeTheme'
import type { AccountingCounterparty, CounterpartyKind } from '../types'
import type { CounterpartyWriteInput } from '../api/counterparties.api'
import {
  ALL_COUNTERPARTY_KINDS,
  COUNTERPARTY_KIND_LABELS,
  COUNTERPARTY_KINDS_PAYABLE,
  COUNTERPARTY_KINDS_RECEIVABLE
} from '../utils/counterpartyLabels'

export interface CounterpartyFormValues {
  kind: CounterpartyKind
  displayName: string
  givenName: string
  familyName: string
  companyName: string
  taxCode: string
  vatNumber: string
  email: string
  phone: string
  pec: string
  recipientCode: string
  addressStreet: string
  addressCity: string
  addressZip: string
  addressProvince: string
  addressCountry: string
  iban: string
  notes: string
  isActive: boolean
}

interface CounterpartyFormModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  initialValues?: Partial<CounterpartyFormValues>
  /** Preferenza iniziale sul tipo (create). */
  defaultKind?: CounterpartyKind
  saving: boolean
  onClose: () => void
  onSubmit: (values: CounterpartyWriteInput) => Promise<void>
}

const EMPTY: CounterpartyFormValues = {
  kind: 'sponsor',
  displayName: '',
  givenName: '',
  familyName: '',
  companyName: '',
  taxCode: '',
  vatNumber: '',
  email: '',
  phone: '',
  pec: '',
  recipientCode: '',
  addressStreet: '',
  addressCity: '',
  addressZip: '',
  addressProvince: '',
  addressCountry: 'IT',
  iban: '',
  notes: '',
  isActive: true
}

export function counterpartyToFormValues(row: AccountingCounterparty): CounterpartyFormValues {
  return {
    kind: row.kind,
    displayName: row.display_name,
    givenName: row.given_name ?? '',
    familyName: row.family_name ?? '',
    companyName: row.company_name ?? '',
    taxCode: row.tax_code ?? '',
    vatNumber: row.vat_number ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    pec: row.pec ?? '',
    recipientCode: row.recipient_code ?? '',
    addressStreet: row.address_street ?? '',
    addressCity: row.address_city ?? '',
    addressZip: row.address_zip ?? '',
    addressProvince: row.address_province ?? '',
    addressCountry: row.address_country || 'IT',
    iban: row.iban ?? '',
    notes: row.notes ?? '',
    isActive: row.is_active
  }
}

export function formValuesToWriteInput(values: CounterpartyFormValues): CounterpartyWriteInput {
  return {
    kind: values.kind,
    displayName: values.displayName,
    givenName: values.givenName || null,
    familyName: values.familyName || null,
    companyName: values.companyName || null,
    taxCode: values.taxCode || null,
    vatNumber: values.vatNumber || null,
    email: values.email || null,
    phone: values.phone || null,
    pec: values.pec || null,
    recipientCode: values.recipientCode || null,
    addressStreet: values.addressStreet || null,
    addressCity: values.addressCity || null,
    addressZip: values.addressZip || null,
    addressProvince: values.addressProvince || null,
    addressCountry: values.addressCountry || 'IT',
    iban: values.iban || null,
    notes: values.notes || null,
    isActive: values.isActive
  }
}

export function CounterpartyFormModal({
  isOpen,
  mode,
  initialValues,
  defaultKind = 'sponsor',
  saving,
  onClose,
  onSubmit
}: CounterpartyFormModalProps) {
  const [values, setValues] = useState<CounterpartyFormValues>(EMPTY)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setFormError(null)
    setValues({
      ...EMPTY,
      kind: defaultKind,
      ...initialValues
    })
  }, [isOpen, initialValues, defaultKind])

  if (!isOpen || typeof document === 'undefined') return null

  const patch = (p: Partial<CounterpartyFormValues>) => {
    setValues((prev) => ({ ...prev, ...p }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!values.displayName.trim()) {
      setFormError('Nome visualizzato obbligatorio.')
      return
    }
    try {
      await onSubmit(formValuesToWriteInput(values))
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
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        style={{ color: GOLEE.text }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? 'Nuova controparte' : 'Modifica controparte'}
          </h3>
          <button type="button" onClick={() => !saving && onClose()} className="p-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Anagrafica contabile autonoma (non è l&apos;anagrafica Quote). Usa{' '}
            <strong>Sponsor / Cliente</strong> per chi riceve fatture;{' '}
            <strong>Fornitore</strong> per chi paghi.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={goleeLabelClass}>Tipo</label>
              <select
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.kind}
                onChange={(e) => patch({ kind: e.target.value as CounterpartyKind })}
              >
                <optgroup label="A cui emettiamo">
                  {COUNTERPARTY_KINDS_RECEIVABLE.map((k) => (
                    <option key={`r-${k}`} value={k}>
                      {COUNTERPARTY_KIND_LABELS[k]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="A cui paghiamo">
                  {COUNTERPARTY_KINDS_PAYABLE.filter((k) => !COUNTERPARTY_KINDS_RECEIVABLE.includes(k)).map(
                    (k) => (
                      <option key={`p-${k}`} value={k}>
                        {COUNTERPARTY_KIND_LABELS[k]}
                      </option>
                    )
                  )}
                </optgroup>
                <optgroup label="Altri">
                  {ALL_COUNTERPARTY_KINDS.filter(
                    (k) =>
                      !COUNTERPARTY_KINDS_RECEIVABLE.includes(k) &&
                      !COUNTERPARTY_KINDS_PAYABLE.includes(k)
                  ).map((k) => (
                    <option key={`o-${k}`} value={k}>
                      {COUNTERPARTY_KIND_LABELS[k]}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={goleeLabelClass}>Nome visualizzato *</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.displayName}
                onChange={(e) => patch({ displayName: e.target.value })}
                placeholder="Es. Sponsor Demo SRL"
                required
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Ragione sociale</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.companyName}
                onChange={(e) => patch({ companyName: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Nome</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.givenName}
                onChange={(e) => patch({ givenName: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Cognome</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.familyName}
                onChange={(e) => patch({ familyName: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>P. IVA</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.vatNumber}
                onChange={(e) => patch({ vatNumber: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Codice fiscale</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.taxCode}
                onChange={(e) => patch({ taxCode: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Email</label>
              <input
                type="email"
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Telefono</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.phone}
                onChange={(e) => patch({ phone: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>PEC</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.pec}
                onChange={(e) => patch({ pec: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Codice SDI</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.recipientCode}
                onChange={(e) => patch({ recipientCode: e.target.value })}
                maxLength={7}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={goleeLabelClass}>Indirizzo</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.addressStreet}
                onChange={(e) => patch({ addressStreet: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Città</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.addressCity}
                onChange={(e) => patch({ addressCity: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>CAP</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.addressZip}
                onChange={(e) => patch({ addressZip: e.target.value })}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Provincia</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.addressProvince}
                onChange={(e) => patch({ addressProvince: e.target.value })}
                maxLength={2}
              />
            </div>
            <div>
              <label className={goleeLabelClass}>Paese</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.addressCountry}
                onChange={(e) => patch({ addressCountry: e.target.value })}
                maxLength={2}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={goleeLabelClass}>IBAN</label>
              <input
                className={goleeInputClass}
                style={goleeInputStyle}
                value={values.iban}
                onChange={(e) => patch({ iban: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={goleeLabelClass}>Note</label>
              <textarea
                className={goleeInputClass}
                style={goleeInputStyle}
                rows={2}
                value={values.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={values.isActive}
                  onChange={(e) => patch({ isActive: e.target.checked })}
                />
                Attiva (visibile nei menu di selezione)
              </label>
            </div>
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
              onClick={() => onClose()}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Salvataggio…' : mode === 'create' ? 'Crea' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
