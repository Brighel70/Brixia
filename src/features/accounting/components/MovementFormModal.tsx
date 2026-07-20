import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownLeft, ArrowUpRight, Receipt, X } from 'lucide-react'
import {
  GOLEE,
  goleeInputClass,
  goleeInputStyle,
  goleeLabelClass
} from '@/config/goleeTheme'
import type { AccountingAccountRef, AccountingCategoryRef, AccountingFiscalYear } from '../types'
import { movementToFormValues, type MovementFormValues, validateMovementForm, filterCategoriesForType, parseAmountEurosToCents } from '../utils/movementValidation'
import {
  defaultPaymentMethodForAccount,
  DOCUMENT_TYPE_OPTIONS,
  getPaymentMethodsForAccount,
  type DocumentType
} from '../utils/movementFormOptions'

interface MovementFormModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  fiscalYear: AccountingFiscalYear | null
  accounts: AccountingAccountRef[]
  categories: AccountingCategoryRef[]
  initialValues?: Partial<MovementFormValues>
  saving: boolean
  onClose: () => void
  onSubmit: (values: MovementFormValues, amountCents: number) => Promise<void>
}

const EMPTY_VALUES: MovementFormValues = {
  type: 'income',
  movementDate: '',
  settlementDate: '',
  amountEuros: '',
  accountId: '',
  categoryId: '',
  description: '',
  paymentMethod: '',
  documentType: 'none',
  documentNumber: '',
  documentDate: '',
  reference: '',
  notes: ''
}

const inputClass = `${goleeInputClass} disabled:opacity-60`

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>
      {children}
    </label>
  )
}

export function MovementFormModal({
  isOpen,
  mode,
  fiscalYear,
  accounts,
  categories,
  initialValues,
  saving,
  onClose,
  onSubmit
}: MovementFormModalProps) {
  const [values, setValues] = useState<MovementFormValues>(EMPTY_VALUES)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setFormError(null)
    const merged: MovementFormValues = {
      ...EMPTY_VALUES,
      movementDate: fiscalYear ? new Date().toISOString().slice(0, 10) : '',
      ...initialValues
    }
    if (merged.accountId && !merged.paymentMethod) {
      const account = accounts.find((a) => a.id === merged.accountId) ?? null
      merged.paymentMethod = defaultPaymentMethodForAccount(account)
    }
    setValues(merged)
  }, [isOpen, initialValues, fiscalYear, accounts])

  const filteredCategories = useMemo(
    () =>
      filterCategoriesForType(categories, values.type, {
        retainIds: values.categoryId ? [values.categoryId] : undefined
      }),
    [categories, values.type, values.categoryId]
  )

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === values.accountId) ?? null,
    [accounts, values.accountId]
  )

  const paymentMethodOptions = useMemo(
    () => getPaymentMethodsForAccount(selectedAccount),
    [selectedAccount]
  )

  const showDocumentFields = values.documentType !== 'none'

  if (!isOpen || typeof document === 'undefined') return null

  const patch = (patchValues: Partial<MovementFormValues>) => {
    setValues((prev) => {
      const next = { ...prev, ...patchValues }
      if (patchValues.type && patchValues.type !== prev.type) {
        const stillValid = filterCategoriesForType(categories, patchValues.type).some(
          (c) => c.id === next.categoryId
        )
        if (!stillValid) next.categoryId = ''
      }
      if (patchValues.accountId !== undefined && patchValues.accountId !== prev.accountId) {
        const account = accounts.find((a) => a.id === patchValues.accountId) ?? null
        next.paymentMethod = defaultPaymentMethodForAccount(account)
      }
      if (patchValues.documentType !== undefined && patchValues.documentType !== prev.documentType) {
        if (patchValues.documentType === 'none') {
          next.documentNumber = ''
          next.documentDate = ''
        }
      }
      return next
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const validationError = validateMovementForm(values, fiscalYear, accounts, categories)
    if (validationError) {
      setFormError(validationError)
      return
    }
    const amountCents = parseAmountEurosToCents(values.amountEuros)
    if (amountCents === null) {
      setFormError('Importo non valido.')
      return
    }
    setFormError(null)
    await onSubmit(values, amountCents)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="movement-form-title"
    >
      <div
        className="absolute inset-0 bg-[#0B1220]/50 backdrop-blur-[8px]"
        onClick={saving ? undefined : onClose}
      />

      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border, color: GOLEE.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute inset-x-0 top-0 h-1.5 shrink-0"
          style={{
            background: `linear-gradient(90deg, ${GOLEE.accent} 0%, ${GOLEE.info} 55%, #6366F1 100%)`
          }}
        />

        <div
          className="relative shrink-0 border-b px-6 pb-5 pt-7 sm:px-8"
          style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="absolute right-4 top-4 rounded-xl p-1.5 transition-colors hover:bg-white/80 disabled:opacity-50"
            style={{ color: GOLEE.textMuted }}
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>

          <div className="flex items-start gap-4 pr-10">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-[0_0_0_8px_rgba(0,196,140,0.12)]"
              style={{ backgroundColor: GOLEE.accentSoft, color: GOLEE.accent }}
            >
              <Receipt className="h-7 w-7" strokeWidth={2} />
            </div>
            <div>
              <h2
                id="movement-form-title"
                className="text-[1.35rem] font-bold tracking-tight"
                style={{ color: GOLEE.text }}
              >
                {mode === 'create' ? 'Nuovo movimento' : 'Modifica bozza'}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed" style={{ color: GOLEE.textMuted }}>
                Il movimento verrà salvato come <strong style={{ color: GOLEE.text }}>bozza</strong>.
                Non è possibile creare movimenti già contabilizzati da questa schermata.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8"
          style={{ color: GOLEE.text }}
        >
          {formError && (
            <div
              className="mb-5 rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: '#FECACA',
                backgroundColor: GOLEE.dangerSoft,
                color: '#991B1B'
              }}
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Tipo *</FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      type: 'income' as const,
                      label: 'Entrata',
                      icon: ArrowDownLeft,
                      activeBg: GOLEE.accentSoft,
                      activeBorder: GOLEE.accent,
                      activeText: '#047857'
                    },
                    {
                      type: 'expense' as const,
                      label: 'Uscita',
                      icon: ArrowUpRight,
                      activeBg: GOLEE.dangerSoft,
                      activeBorder: GOLEE.danger,
                      activeText: '#B91C1C'
                    }
                  ] as const
                ).map(({ type, label, icon: Icon, activeBg, activeBorder, activeText }) => {
                  const selected = values.type === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => patch({ type })}
                      className="flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition-all"
                      style={{
                        backgroundColor: selected ? activeBg : GOLEE.surfaceMuted,
                        borderColor: selected ? activeBorder : GOLEE.border,
                        color: selected ? activeText : GOLEE.textMuted,
                        boxShadow: selected ? `0 4px 14px ${activeBorder}22` : 'none'
                      }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.5} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <FieldLabel>Data movimento *</FieldLabel>
              <input
                type="date"
                required
                value={values.movementDate}
                onChange={(e) => patch({ movementDate: e.target.value })}
                className={inputClass}
                style={goleeInputStyle}
              />
            </div>

            <div>
              <FieldLabel>Data pagamento</FieldLabel>
              <input
                type="date"
                value={values.settlementDate}
                onChange={(e) => patch({ settlementDate: e.target.value })}
                className={inputClass}
                style={goleeInputStyle}
              />
            </div>

            <div>
              <FieldLabel>Importo (EUR) *</FieldLabel>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="0,00"
                value={values.amountEuros}
                onChange={(e) => patch({ amountEuros: e.target.value })}
                className={inputClass}
                style={goleeInputStyle}
              />
            </div>

            <div>
              <FieldLabel>Conto *</FieldLabel>
              <select
                required
                value={values.accountId}
                onChange={(e) => patch({ accountId: e.target.value })}
                className={inputClass}
                style={goleeInputStyle}
              >
                <option value="">Seleziona conto</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} — {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Categoria *</FieldLabel>
              <select
                required
                value={values.categoryId}
                onChange={(e) => patch({ categoryId: e.target.value })}
                className={inputClass}
                style={goleeInputStyle}
              >
                <option value="">Seleziona categoria</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.code} — {cat.name}
                    {cat.is_active === false ? ' (non attiva)' : ''}
                    {cat.group ? ` · ${cat.group.name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Descrizione *</FieldLabel>
              <input
                type="text"
                required
                value={values.description}
                onChange={(e) => patch({ description: e.target.value })}
                className={inputClass}
                style={goleeInputStyle}
              />
            </div>

            <div>
              <FieldLabel>Metodo pagamento *</FieldLabel>
              {paymentMethodOptions.length === 1 ? (
                <input
                  type="text"
                  readOnly
                  value={paymentMethodOptions[0].label}
                  className={`${inputClass} bg-[#F4F6F8]`}
                  style={goleeInputStyle}
                />
              ) : (
                <select
                  required={!!values.accountId}
                  value={values.paymentMethod}
                  onChange={(e) => patch({ paymentMethod: e.target.value })}
                  disabled={!values.accountId}
                  className={inputClass}
                  style={goleeInputStyle}
                >
                  <option value="">
                    {values.accountId ? 'Seleziona metodo' : 'Seleziona prima il conto'}
                  </option>
                  {paymentMethodOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <FieldLabel>Tipo documento</FieldLabel>
              <select
                value={values.documentType}
                onChange={(e) =>
                  patch({ documentType: e.target.value as DocumentType })
                }
                className={inputClass}
                style={goleeInputStyle}
              >
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {showDocumentFields && (
              <>
                <div>
                  <FieldLabel>
                    {values.documentType === 'invoice' ? 'Numero fattura *' : 'Numero documento'}
                  </FieldLabel>
                  <input
                    type="text"
                    required={values.documentType === 'invoice'}
                    value={values.documentNumber}
                    onChange={(e) => patch({ documentNumber: e.target.value })}
                    placeholder={
                      values.documentType === 'invoice'
                        ? 'es. 1256/2026'
                        : values.documentType === 'fiscal_receipt'
                          ? 'es. scontrino POS'
                          : values.documentType === 'receipt'
                            ? 'es. prot. 42'
                            : 'Opzionale'
                    }
                    className={inputClass}
                    style={goleeInputStyle}
                  />
                </div>

                <div>
                  <FieldLabel>Data documento</FieldLabel>
                  <input
                    type="date"
                    value={values.documentDate}
                    onChange={(e) => patch({ documentDate: e.target.value })}
                    className={inputClass}
                    style={goleeInputStyle}
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <FieldLabel>Riferimento pagamento</FieldLabel>
              <input
                type="text"
                value={values.reference}
                onChange={(e) => patch({ reference: e.target.value })}
                placeholder="es. CRO/TRN, rif. POS, n. assegno"
                className={inputClass}
                style={goleeInputStyle}
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Note</FieldLabel>
              <textarea
                rows={3}
                value={values.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                className={inputClass}
                style={goleeInputStyle}
              />
            </div>
          </div>

          <div
            className="mt-8 flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end"
            style={{ borderColor: GOLEE.border }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-50"
              style={{
                borderColor: GOLEE.border,
                color: GOLEE.textMuted,
                backgroundColor: GOLEE.surface
              }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,196,140,0.35)] transition-colors disabled:opacity-60"
              style={{ backgroundColor: GOLEE.accent }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = GOLEE.accentHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = GOLEE.accent
              }}
            >
              {saving ? 'Salvataggio...' : mode === 'create' ? 'Salva bozza' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
