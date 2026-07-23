import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownLeft, ArrowUpRight, Check, Layers3, Pencil, Receipt, X } from 'lucide-react'
import {
  GOLEE,
  goleeInputClass,
  goleeInputStyle,
  goleeLabelClass
} from '@/config/goleeTheme'
import type { AccountingAccountRef, AccountingCategoryRef, AccountingFiscalYear } from '../types'
import { fetchBudgetCategoryCatalog } from '../api/categorySettings.api'
import {
  deriveMovementGroupOptions,
  filterMovementCategoriesByGroup,
  parseAmountEurosToCents,
  resolveBudgetGroupId,
  type MovementFormValues,
  validateMovementForm
} from '../utils/movementValidation'
import {
  defaultPaymentMethodForAccount,
  DOCUMENT_TYPE_OPTIONS,
  getPaymentMethodsForAccount,
  type DocumentType
} from '../utils/movementFormOptions'
import { SearchableSelect } from './SearchableSelect'

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

const inputClass = `${goleeInputClass} disabled:opacity-60 text-black font-semibold`
const valueInputStyle = { ...goleeInputStyle, color: '#000000' } as const

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
  const [groupId, setGroupId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<AccountingCategoryRef[]>(categories)
  const [catalogLoading, setCatalogLoading] = useState(false)

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
    setGroupId(resolveBudgetGroupId(merged.categoryId, categories))
  }, [isOpen, initialValues, fiscalYear, accounts, categories])

  useEffect(() => {
    if (!isOpen) return
    let mounted = true
    setCatalogLoading(true)
    setCatalog(categories)

    void fetchBudgetCategoryCatalog()
      .then((rows) => {
        if (!mounted) return
        setCatalog(rows)
        const initialCategoryId = initialValues?.categoryId ?? ''
        if (initialCategoryId) {
          setGroupId(resolveBudgetGroupId(initialCategoryId, rows))
        }
      })
      .catch(() => {
        // Fallback: usa le categorie già caricate dalla pagina Contabilità.
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [isOpen, initialValues?.categoryId, categories])

  const groupOptions = useMemo(
    () =>
      deriveMovementGroupOptions(catalog, values.type, {
        retainCategoryIds: values.categoryId ? [values.categoryId] : undefined
      }),
    [catalog, values.type, values.categoryId]
  )

  const subcategoryOptions = useMemo(
    () =>
      groupId
        ? filterMovementCategoriesByGroup(catalog, values.type, groupId, {
            retainCategoryIds: values.categoryId ? [values.categoryId] : undefined
          })
        : [],
    [catalog, values.type, groupId, values.categoryId]
  )

  const groupSelectOptions = useMemo(
    () =>
      groupOptions.map((group) => ({
        id: group.id,
        label: `${group.name} (${group.activeCategoryCount})`,
        searchText: `${group.code} ${group.name}`
      })),
    [groupOptions]
  )

  const directionIsIncome = values.type === 'income'

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
      if (patchValues.type && patchValues.type !== prev.type) {
        setGroupId('')
        const next = { ...prev, ...patchValues, categoryId: '' }
        if (patchValues.accountId !== undefined) {
          const account = accounts.find((a) => a.id === patchValues.accountId) ?? null
          next.paymentMethod = defaultPaymentMethodForAccount(account)
        }
        if (patchValues.documentType === 'none') {
          next.documentNumber = ''
          next.documentDate = ''
        }
        return next
      }

      const next = { ...prev, ...patchValues }
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

  const handleGroupChange = (nextGroupId: string) => {
    setGroupId(nextGroupId)
    setValues((prev) => ({ ...prev, categoryId: '' }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!groupId) {
      setFormError('Seleziona una macro-categoria.')
      return
    }
    if (!values.categoryId) {
      setFormError('Seleziona almeno una sottocategoria della macro scelta.')
      return
    }
    const validationError = validateMovementForm(values, fiscalYear, accounts, catalog)
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
        className="absolute inset-0 bg-[#0B1220]/55 backdrop-blur-[10px]"
        onClick={saving ? undefined : onClose}
      />

      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border shadow-[0_28px_90px_rgba(11,18,32,0.32)]"
        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border, color: GOLEE.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative shrink-0 overflow-hidden px-6 py-4 sm:px-8"
          style={{ backgroundColor: '#15213A' }}
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[#00C48C]" />
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#3B82F6]/20" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(0,196,140,0.18)', color: '#7DFFC8' }}
              >
                {mode === 'create' ? (
                  <Receipt className="h-5 w-5" strokeWidth={2.5} />
                ) : (
                  <Pencil className="h-5 w-5" strokeWidth={2.5} />
                )}
              </div>
              <h2 id="movement-form-title" className="text-xl font-semibold text-white">
                {mode === 'create' ? 'Nuovo movimento' : 'Modifica bozza'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="relative rounded-xl border border-white/10 bg-white/10 p-2.5 text-slate-200 transition hover:bg-white/20 disabled:opacity-50"
              aria-label="Chiudi"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="min-h-0 flex-1 overflow-y-auto bg-[#F6F8FB] px-6 pb-6 pt-3 sm:px-8"
        >
          {formError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {formError}
            </div>
          )}

          <section className="rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: GOLEE.border }}>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={directionIsIncome}
                onClick={() => patch({ type: 'income' })}
                className="flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left transition"
                style={{
                  borderColor: directionIsIncome ? GOLEE.accent : GOLEE.border,
                  backgroundColor: directionIsIncome ? GOLEE.accentSoft : GOLEE.surface,
                  color: directionIsIncome ? '#08795B' : GOLEE.text
                }}
              >
                <span className="rounded-lg bg-white/80 p-2 shadow-sm">
                  <ArrowDownLeft className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">Entrata</span>
              </button>
              <button
                type="button"
                aria-pressed={!directionIsIncome}
                onClick={() => patch({ type: 'expense' })}
                className="flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left transition"
                style={{
                  borderColor: !directionIsIncome ? '#FB7185' : GOLEE.border,
                  backgroundColor: !directionIsIncome ? '#FFF1F2' : GOLEE.surface,
                  color: !directionIsIncome ? '#C42647' : GOLEE.text
                }}
              >
                <span className="rounded-lg bg-white/80 p-2 shadow-sm">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">Uscita</span>
              </button>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: GOLEE.border }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Data movimento *</FieldLabel>
                <input
                  type="date"
                  required
                  value={values.movementDate}
                  onChange={(e) => patch({ movementDate: e.target.value })}
                  className={inputClass}
                  style={valueInputStyle}
                />
              </div>
              <div>
                <FieldLabel>Data pagamento</FieldLabel>
                <input
                  type="date"
                  value={values.settlementDate}
                  onChange={(e) => patch({ settlementDate: e.target.value })}
                  className={inputClass}
                  style={valueInputStyle}
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
                  style={valueInputStyle}
                />
              </div>
              <div>
                <FieldLabel>Conto *</FieldLabel>
                <select
                  required
                  value={values.accountId}
                  onChange={(e) => patch({ accountId: e.target.value })}
                  className={inputClass}
                  style={valueInputStyle}
                >
                  <option value="">Seleziona conto</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} — {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: GOLEE.border }}>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="rounded-lg p-2"
                style={{ backgroundColor: GOLEE.infoSoft, color: GOLEE.info }}
              >
                <Layers3 className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold" style={{ color: GOLEE.text }}>
                Classificazione contabile
              </p>
            </div>

            <div>
              <FieldLabel>Macro-categoria *</FieldLabel>
              <SearchableSelect
                required
                value={groupId}
                options={groupSelectOptions}
                disabled={catalogLoading}
                placeholder={
                  catalogLoading
                    ? 'Caricamento categorie…'
                    : 'Cerca o seleziona una macro-categoria'
                }
                emptyMessage="Nessuna macro-categoria trovata"
                onChange={handleGroupChange}
              />
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <FieldLabel>Sottocategoria *</FieldLabel>
                {groupId ? (
                  <span className="text-xs font-medium" style={{ color: GOLEE.textMuted }}>
                    {subcategoryOptions.length} disponibili
                  </span>
                ) : null}
              </div>
              {catalogLoading ? (
                <div
                  className="rounded-xl border border-dashed px-4 py-5 text-sm"
                  style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}
                >
                  Aggiornamento del catalogo contabile...
                </div>
              ) : !groupId ? (
                <div
                  className="rounded-xl border border-dashed px-4 py-5 text-sm"
                  style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}
                >
                  Seleziona prima una macro-categoria.
                </div>
              ) : subcategoryOptions.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
                  Nessuna sottocategoria attiva con utilizzo “Prima nota” per questa macro.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {subcategoryOptions.map((category) => {
                    const selected = values.categoryId === category.id
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => patch({ categoryId: category.id })}
                        className="flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition"
                        style={{
                          borderColor: selected ? GOLEE.accent : GOLEE.border,
                          backgroundColor: selected ? GOLEE.accentSoft : GOLEE.surface
                        }}
                      >
                        <span className="text-sm font-semibold text-black">{category.name}</span>
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                          style={{
                            borderColor: selected ? GOLEE.accent : '#CBD5E1',
                            backgroundColor: selected ? GOLEE.accent : 'transparent',
                            color: '#FFFFFF'
                          }}
                        >
                          {selected ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: GOLEE.border }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel>Descrizione *</FieldLabel>
                <input
                  type="text"
                  required
                  value={values.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  className={inputClass}
                  style={valueInputStyle}
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
                    style={valueInputStyle}
                  />
                ) : (
                  <select
                    required={!!values.accountId}
                    value={values.paymentMethod}
                    onChange={(e) => patch({ paymentMethod: e.target.value })}
                    disabled={!values.accountId}
                    className={inputClass}
                    style={valueInputStyle}
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
                  onChange={(e) => patch({ documentType: e.target.value as DocumentType })}
                  className={inputClass}
                  style={valueInputStyle}
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
                      style={valueInputStyle}
                    />
                  </div>
                  <div>
                    <FieldLabel>Data documento</FieldLabel>
                    <input
                      type="date"
                      value={values.documentDate}
                      onChange={(e) => patch({ documentDate: e.target.value })}
                      className={inputClass}
                      style={valueInputStyle}
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
                  style={valueInputStyle}
                />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel>Note</FieldLabel>
                <textarea
                  rows={3}
                  value={values.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  className={inputClass}
                  style={valueInputStyle}
                />
              </div>
            </div>
          </section>

          <div
            className="mt-5 flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end"
            style={{ borderColor: GOLEE.border }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border bg-white px-5 py-3 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50"
              style={{ borderColor: GOLEE.border, color: GOLEE.text }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
              style={{ backgroundColor: GOLEE.accent }}
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
