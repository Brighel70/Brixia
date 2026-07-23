import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeEuro,
  Check,
  FileText,
  Layers3,
  Pencil,
  Plus,
  StickyNote,
  X
} from 'lucide-react'
import {
  GOLEE,
  goleeInputClass,
  goleeInputStyle,
  goleeLabelClass
} from '@/config/goleeTheme'
import type { AccountingCategoryRef, BudgetLineDirection } from '../types'
import {
  deriveBudgetGroupOptions,
  filterBudgetCategoriesByGroup,
  formatCentsToEuroInput,
  parseAmountEurosToCents,
  resolveBudgetGroupId
} from '../utils/movementValidation'
import { isQuoteCategoryId } from '../utils/budgetCalculations'
import { fetchBudgetCategoryCatalog } from '../api/categorySettings.api'

export interface BudgetLineFormValues {
  direction: BudgetLineDirection
  categoryId: string
  description: string
  amountEuros: string
  notes: string
}

interface BudgetLineFormModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  categories: AccountingCategoryRef[]
  initialValues?: Partial<BudgetLineFormValues>
  saving: boolean
  onClose: () => void
  onSubmit: (values: BudgetLineFormValues, amountCents: number) => Promise<void>
}

const EMPTY: BudgetLineFormValues = {
  direction: 'expense',
  categoryId: '',
  description: '',
  amountEuros: '',
  notes: ''
}

const inputClass = `${goleeInputClass} disabled:cursor-not-allowed disabled:opacity-60 text-black font-semibold`
const valueInputStyle = { ...goleeInputStyle, color: '#000000' } as const

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className={goleeLabelClass} style={{ color: GOLEE.textMuted }}>
      {children}
    </label>
  )
}

export function BudgetLineFormModal({
  isOpen,
  mode,
  categories,
  initialValues,
  saving,
  onClose,
  onSubmit
}: BudgetLineFormModalProps) {
  const [values, setValues] = useState<BudgetLineFormValues>(EMPTY)
  const [groupId, setGroupId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<AccountingCategoryRef[]>(categories)
  const [catalogLoading, setCatalogLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setFormError(null)
    const merged = { ...EMPTY, ...initialValues }
    setValues(merged)
    setGroupId(resolveBudgetGroupId(merged.categoryId, categories))
  }, [isOpen, initialValues, categories])

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
        // Il catalogo passato dalla pagina e' un fallback temporaneo se la rete
        // non e' disponibile; non cambia la logica di selezione.
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
      deriveBudgetGroupOptions(catalog, values.direction, {
        retainCategoryIds: values.categoryId ? [values.categoryId] : undefined
      }),
    [catalog, values.direction, values.categoryId]
  )

  const subcategoryOptions = useMemo(
    () =>
      groupId
        ? filterBudgetCategoriesByGroup(catalog, values.direction, groupId, {
            retainCategoryIds: values.categoryId ? [values.categoryId] : undefined
          })
        : [],
    [catalog, values.direction, groupId, values.categoryId]
  )

  const selectedCategory = subcategoryOptions.find((category) => category.id === values.categoryId)
  const directionIsIncome = values.direction === 'income'

  if (!isOpen || typeof document === 'undefined') return null

  const patch = (p: Partial<BudgetLineFormValues>) => {
    setValues((prev) => {
      if (p.direction && p.direction !== prev.direction) {
        setGroupId('')
        return { ...prev, ...p, categoryId: '' }
      }
      return { ...prev, ...p }
    })
  }

  const handleGroupChange = (nextGroupId: string) => {
    setGroupId(nextGroupId)
    setValues((prev) => ({ ...prev, categoryId: '' }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!values.description.trim()) {
      setFormError('Inserisci una descrizione per la voce di preventivo.')
      return
    }
    if (!groupId) {
      setFormError('Seleziona una macro-categoria.')
      return
    }
    if (!values.categoryId) {
      setFormError('Seleziona una sottocategoria disponibile.')
      return
    }
    if (isQuoteCategoryId(values.categoryId, catalog)) {
      setFormError('Le Quote assegnate sono automatiche e non possono essere aggiunte manualmente.')
      return
    }
    const amountCents = parseAmountEurosToCents(values.amountEuros)
    if (amountCents === null) {
      setFormError('Inserisci un importo previsto valido e maggiore di zero.')
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
      aria-labelledby="budget-line-form-title"
    >
      <div
        className="absolute inset-0 bg-[#0B1220]/55 backdrop-blur-[10px]"
        onClick={saving ? undefined : onClose}
      />
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border shadow-[0_28px_90px_rgba(11,18,32,0.32)]"
        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border, color: GOLEE.text }}
        onClick={(event) => event.stopPropagation()}
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
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                ) : (
                  <Pencil className="h-5 w-5" strokeWidth={2.5} />
                )}
              </div>
              <h2 id="budget-line-form-title" className="text-xl font-semibold text-white">
                {mode === 'create' ? 'Nuova voce di preventivo' : 'Modifica voce di preventivo'}
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

        <form onSubmit={(event) => void handleSubmit(event)} className="overflow-y-auto bg-[#F6F8FB] px-6 pb-6 pt-3 sm:px-8">
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
                onClick={() => patch({ direction: 'income' })}
                className="flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left transition"
                style={{
                  borderColor: directionIsIncome ? GOLEE.accent : GOLEE.border,
                  backgroundColor: directionIsIncome ? GOLEE.accentSoft : GOLEE.surface,
                  color: directionIsIncome ? '#08795B' : GOLEE.text
                }}
              >
                <span className="rounded-lg bg-white/80 p-2 shadow-sm"><ArrowDownLeft className="h-4 w-4" /></span>
                <span className="text-sm font-semibold">Entrata</span>
              </button>
              <button
                type="button"
                aria-pressed={!directionIsIncome}
                onClick={() => patch({ direction: 'expense' })}
                className="flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left transition"
                style={{
                  borderColor: !directionIsIncome ? '#FB7185' : GOLEE.border,
                  backgroundColor: !directionIsIncome ? '#FFF1F2' : GOLEE.surface,
                  color: !directionIsIncome ? '#C42647' : GOLEE.text
                }}
              >
                <span className="rounded-lg bg-white/80 p-2 shadow-sm"><ArrowUpRight className="h-4 w-4" /></span>
                <span className="text-sm font-semibold">Uscita</span>
              </button>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4" style={{ borderColor: GOLEE.border }}>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-lg p-2" style={{ backgroundColor: GOLEE.infoSoft, color: GOLEE.info }}><Layers3 className="h-4 w-4" /></span>
              <p className="text-sm font-semibold" style={{ color: GOLEE.text }}>Classificazione contabile</p>
            </div>

            <div>
              <FieldLabel>Macro-categoria *</FieldLabel>
              <select
                required
                value={groupId}
                onChange={(event) => handleGroupChange(event.target.value)}
                disabled={catalogLoading}
                className={inputClass}
                style={valueInputStyle}
              >
                <option value="">Seleziona una macro-categoria</option>
                {groupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.activeCategoryCount})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <FieldLabel>Sottocategoria *</FieldLabel>
                {groupId && (
                  <span className="text-xs font-medium" style={{ color: GOLEE.textMuted }}>
                    {subcategoryOptions.length} disponibili
                  </span>
                )}
              </div>
              {catalogLoading ? (
                <div className="rounded-xl border border-dashed px-4 py-5 text-sm" style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}>
                  Aggiornamento del catalogo contabile...
                </div>
              ) : !groupId ? (
                <div className="rounded-xl border border-dashed px-4 py-5 text-sm" style={{ borderColor: GOLEE.border, color: GOLEE.textMuted }}>
                  Seleziona prima una macro-categoria.
                </div>
              ) : subcategoryOptions.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
                  Nessuna sottocategoria attiva per questa macro-categoria.
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
                          backgroundColor: selected ? GOLEE.accentSoft : GOLEE.surface,
                          color: selected ? '#000000' : '#000000'
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
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="mt-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-5" style={{ borderColor: GOLEE.border }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel>Descrizione *</FieldLabel>
                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4" style={{ color: GOLEE.textMuted }} />
                  <input
                    type="text"
                    required
                    value={values.description}
                    onChange={(event) => patch({ description: event.target.value })}
                    placeholder={selectedCategory?.name ?? 'Descrivi la voce prevista'}
                    className={`${inputClass} pl-9`}
                    style={valueInputStyle}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Importo previsto (EUR) *</FieldLabel>
                <div className="relative">
                  <BadgeEuro className="pointer-events-none absolute left-3 top-3 h-4 w-4" style={{ color: GOLEE.textMuted }} />
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    value={values.amountEuros}
                    onChange={(event) => patch({ amountEuros: event.target.value })}
                    placeholder="es. 1.250,00"
                    className={`${inputClass} pl-9`}
                    style={valueInputStyle}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Note</FieldLabel>
                <div className="relative">
                  <StickyNote className="pointer-events-none absolute left-3 top-3 h-4 w-4" style={{ color: GOLEE.textMuted }} />
                  <input
                    type="text"
                    value={values.notes}
                    onChange={(event) => patch({ notes: event.target.value })}
                    placeholder="Facoltative"
                    className={`${inputClass} pl-9`}
                    style={valueInputStyle}
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end" style={{ borderColor: GOLEE.border }}>
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
              {saving ? 'Salvataggio...' : mode === 'create' ? 'Aggiungi al preventivo' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export function budgetLineToFormValues(line: {
  direction: BudgetLineDirection
  category_id: string
  description: string
  planned_amount_cents: number
  notes: string | null
}): BudgetLineFormValues {
  return {
    direction: line.direction,
    categoryId: line.category_id,
    description: line.description,
    amountEuros: formatCentsToEuroInput(line.planned_amount_cents),
    notes: line.notes ?? ''
  }
}
