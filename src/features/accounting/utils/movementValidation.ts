import { toCents } from '@/lib/fees/paymentsCore'
import type {
  AccountingAccountRef,
  AccountingCategoryRef,
  AccountingDocumentType,
  AccountingFiscalYear
} from '../types'
import {
  defaultPaymentMethodForAccount,
  fromDbDocumentType,
  isPaymentMethodValidForAccount,
  resolveDocumentFields,
  toDbDocumentType,
  type DocumentType
} from './movementFormOptions'

export type ManualMovementType = 'income' | 'expense'

export interface MovementFormValues {
  type: ManualMovementType
  movementDate: string
  settlementDate: string
  amountEuros: string
  accountId: string
  categoryId: string
  description: string
  paymentMethod: string
  documentType: DocumentType
  documentNumber: string
  documentDate: string
  /** Riferimento pagamento (CRO/TRN, POS, assegno…) — colonna `reference`. */
  reference: string
  notes: string
}

export interface MovementFormPayload {
  paymentMethod: string | null
  reference: string | null
  documentType: AccountingDocumentType | null
  documentNumber: string | null
  documentDate: string | null
}

/** Valori pronti per INSERT/UPDATE Supabase (colonne dedicate documento). */
export function movementFormToPayload(
  values: MovementFormValues,
  accounts: AccountingAccountRef[]
): MovementFormPayload {
  const account = accounts.find((a) => a.id === values.accountId) ?? null
  let paymentMethod = values.paymentMethod.trim()
  if (!paymentMethod && account) {
    paymentMethod = defaultPaymentMethodForAccount(account)
  }

  const documentType = toDbDocumentType(values.documentType)
  const documentNumber = values.documentNumber.trim() || null
  const documentDate = values.documentDate.trim() || null

  return {
    paymentMethod: paymentMethod || null,
    reference: values.reference.trim() || null,
    documentType,
    documentNumber: documentType ? documentNumber : null,
    documentDate: documentType ? documentDate : null
  }
}

export function parseAmountEurosToCents(value: string): number | null {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return toCents(parsed)
}

export function formatCentsToEuroInput(amountCents: number): string {
  return (amountCents / 100).toFixed(2).replace('.', ',')
}

export function isFiscalYearOpenForEditing(fy: AccountingFiscalYear | null): boolean {
  return fy?.status === 'open'
}

export function validateMovementForm(
  values: MovementFormValues,
  fiscalYear: AccountingFiscalYear | null,
  accounts: AccountingAccountRef[],
  categories: AccountingCategoryRef[]
): string | null {
  if (!fiscalYear) return 'Seleziona un esercizio contabile.'
  if (!isFiscalYearOpenForEditing(fiscalYear)) {
    return 'Solo gli esercizi aperti consentono creazione o modifica movimenti.'
  }

  if (!values.movementDate) return 'La data movimento è obbligatoria.'
  if (values.movementDate < fiscalYear.starts_on || values.movementDate > fiscalYear.ends_on) {
    return `La data movimento deve essere compresa nell'esercizio ${fiscalYear.code}.`
  }

  if (values.settlementDate) {
    if (
      values.settlementDate < fiscalYear.starts_on ||
      values.settlementDate > fiscalYear.ends_on
    ) {
      return `La data pagamento deve essere compresa nell'esercizio ${fiscalYear.code}.`
    }
  }

  const amountCents = parseAmountEurosToCents(values.amountEuros)
  if (amountCents === null) return 'Inserisci un importo positivo valido.'

  if (!values.accountId) return 'Seleziona un conto Cassa/Banca.'
  const account = accounts.find((a) => a.id === values.accountId)
  if (!account) return 'Il conto selezionato non è attivo o non è disponibile.'

  if (!values.categoryId) return 'Seleziona una categoria.'
  const category = categories.find((c) => c.id === values.categoryId)
  if (!category) return 'La categoria selezionata non è attiva o non è disponibile.'

  if (!values.description.trim()) return 'La descrizione è obbligatoria.'

  let paymentMethod = values.paymentMethod.trim()
  if (!paymentMethod && account) {
    paymentMethod = defaultPaymentMethodForAccount(account)
  }

  if (account && !isPaymentMethodValidForAccount(account, paymentMethod)) {
    if (getAccountKindFromCode(account.code) === 'banca') {
      return 'Seleziona come hai pagato tramite banca (bonifico, bancomat, carta, …).'
    }
    return 'Seleziona il metodo di pagamento.'
  }

  if (values.documentType === 'invoice' && !values.documentNumber.trim()) {
    return 'Inserisci il numero fattura.'
  }

  return null
}

function getAccountKindFromCode(code: string): 'cassa' | 'banca' | 'other' {
  const upper = code.toUpperCase()
  if (upper === 'CASSA') return 'cassa'
  if (upper === 'BANCA') return 'banca'
  return 'other'
}

export function filterCategoriesForType(
  categories: AccountingCategoryRef[],
  type: ManualMovementType,
  options?: { retainIds?: string[] }
): AccountingCategoryRef[] {
  const retain = new Set(options?.retainIds ?? [])
  return categories.filter((c) => {
    const keepInactive = retain.has(c.id)
    if (!keepInactive) {
      if (c.archived_at) return false
      if (c.is_active === false) return false
      if (c.available_in_movements === false) return false
    }
    return c.direction === 'both' || c.direction === type
  })
}

export function filterCategoriesForBudget(
  categories: AccountingCategoryRef[],
  type: ManualMovementType
): AccountingCategoryRef[] {
  return categories.filter((c) => {
    if (c.archived_at) return false
    if (c.is_active === false) return false
    if (c.available_in_budget === false) return false
    if (c.code?.toUpperCase() === 'QUOTE') return false
    return c.direction === 'both' || c.direction === type
  })
}

export function movementToFormValues(movement: {
  direction: string
  movement_date: string
  settlement_date?: string | null
  amount_cents: number
  account: { id: string } | null
  category: { id: string } | null
  description: string
  payment_method_raw: string | null
  document_type?: string | null
  document_number?: string | null
  document_date?: string | null
  reference: string | null
  notes?: string | null
}): MovementFormValues {
  const resolved = resolveDocumentFields(movement)
  const hasDbDocument = fromDbDocumentType(movement.document_type) !== 'none'

  // Legacy in reference: mostra in campi documento, non come rif. pagamento.
  let paymentReference = movement.reference ?? ''
  if (!hasDbDocument && resolved.isLegacyFallback) {
    paymentReference = ''
  }

  return {
    type: movement.direction === 'expense' ? 'expense' : 'income',
    movementDate: movement.movement_date,
    settlementDate: movement.settlement_date ?? '',
    amountEuros: formatCentsToEuroInput(movement.amount_cents),
    accountId: movement.account?.id ?? '',
    categoryId: movement.category?.id ?? '',
    description: movement.description,
    paymentMethod: movement.payment_method_raw ?? '',
    documentType: resolved.documentType,
    documentNumber: resolved.documentNumber,
    documentDate: movement.document_date ?? '',
    reference: paymentReference,
    notes: movement.notes ?? ''
  }
}
