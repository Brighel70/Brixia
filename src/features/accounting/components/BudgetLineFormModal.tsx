import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  GOLEE,
  goleeInputClass,
  goleeInputStyle,
  goleeLabelClass
} from '@/config/goleeTheme'
import type { AccountingCategoryRef, BudgetLineDirection } from '../types'
import { filterCategoriesForBudget, parseAmountEurosToCents } from '../utils/movementValidation'
import { isQuoteCategoryId } from '../utils/budgetCalculations'
import { formatCentsToEuroInput } from '../utils/movementValidation'

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

const inputClass = `${goleeInputClass} disabled:opacity-60`

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
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setFormError(null)
    setValues({ ...EMPTY, ...initialValues })
  }, [isOpen, initialValues])

  const filteredCategories = useMemo(
    () => filterCategoriesForBudget(categories, values.direction),
    [categories, values.direction]
  )

  if (!isOpen || typeof document === 'undefined') return null

  const patch = (p: Partial<BudgetLineFormValues>) => {
    setValues((prev) => {
      const next = { ...prev, ...p }
      if (p.direction && p.direction !== prev.direction) {
        const stillValid = filterCategoriesForBudget(categories, p.direction).some(
          (c) => c.id === next.categoryId
        )
        if (!stillValid) next.categoryId = ''
      }
      return next
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!values.description.trim()) {
      setFormError('La descrizione è obbligatoria.')
      return
    }
    if (!values.categoryId) {
      setFormError('Seleziona una categoria (Quote sono automatiche).')
      return
    }
    if (isQuoteCategoryId(values.categoryId, categories)) {
      setFormError('La categoria Quote è calcolata automaticamente: non aggiungere voci manuali.')
      return
    }
    const amountCents = parseAmountEurosToCents(values.amountEuros)
    if (amountCents === null) {
      setFormError('Inserisci un importo positivo valido.')
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
        className="absolute inset-0 bg-[#0B1220]/50 backdrop-blur-[8px]"
        onClick={saving ? undefined : onClose}
      />
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border, color: GOLEE.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background: `linear-gradient(90deg, ${GOLEE.accent} 0%, ${GOLEE.info} 55%, #6366F1 100%)`
          }}
        />
        <div
          className="relative shrink-0 border-b px-6 pb-5 pt-7"
          style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="absolute right-4 top-4 rounded-full p-2 hover:bg-black/5 disabled:opacity-50"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" style={{ color: GOLEE.textMuted }} />
          </button>
          <h2 id="budget-line-form-title" className="text-lg font-semibold">
            {mode === 'create' ? 'Aggiungi voce preventivo' : 'Modifica voce'}
          </h2>
          <p className="mt-1 text-sm" style={{ color: GOLEE.textMuted }}>
            Solo voci manuali. Le Quote assegnate restano automatiche.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="overflow-y-auto px-6 py-5">
          {formError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Direzione *</FieldLabel>
              <select
                value={values.direction}
                onChange={(e) => patch({ direction: e.target.value as BudgetLineDirection })}
                className={inputClass}
                style={goleeInputStyle}
              >
                <option value="income">Entrata</option>
                <option value="expense">Uscita</option>
              </select>
            </div>
            <div>
              <FieldLabel>Categoria *</FieldLabel>
              <select
                required
                value={values.categoryId}
                onChange={(e) => patch({ categoryId: e.target.value })}
                className={inputClass}
                style={goleeInputStyle}
              >
                <option value="">Seleziona</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
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
              <FieldLabel>Importo previsto (€) *</FieldLabel>
              <input
                type="text"
                required
                inputMode="decimal"
                value={values.amountEuros}
                onChange={(e) => patch({ amountEuros: e.target.value })}
                placeholder="es. 1.250,00"
                className={inputClass}
                style={goleeInputStyle}
              />
            </div>
            <div>
              <FieldLabel>Note</FieldLabel>
              <input
                type="text"
                value={values.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                className={inputClass}
                style={goleeInputStyle}
              />
            </div>
          </div>

          <div
            className="mt-6 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"
            style={{ borderColor: GOLEE.border }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
              style={{ borderColor: GOLEE.border, color: GOLEE.text }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: GOLEE.accent }}
            >
              {saving ? 'Salvataggio…' : mode === 'create' ? 'Aggiungi' : 'Salva'}
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
