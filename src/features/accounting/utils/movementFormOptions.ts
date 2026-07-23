import type { AccountingAccountRef, AccountingDocumentType } from '../types'

export type AccountKind = 'cassa' | 'banca' | 'other'

/** Valori form: `none` → NULL in DB. Altri allineati a CHECK SQL. */
export type DocumentType = 'none' | AccountingDocumentType

export type { AccountingDocumentType }

export interface PaymentMethodOption {
  value: string
  label: string
}

export const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'none', label: 'Nessuno' },
  { value: 'fiscal_receipt', label: 'Scontrino' },
  { value: 'receipt', label: 'Ricevuta' },
  { value: 'invoice', label: 'Fattura' },
  { value: 'other', label: 'Altro' }
]

export const CASSA_PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: 'contanti', label: 'Contanti' }
]

export const BANCA_PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: 'bonifico', label: 'Bonifico' },
  { value: 'bancomat', label: 'Bancomat' },
  { value: 'carta', label: 'Carta' },
  { value: 'assegno', label: 'Assegno' },
  { value: 'rid', label: 'RID / Addebito' }
]

export function getAccountKind(
  account: AccountingAccountRef | null | undefined
): AccountKind {
  if (!account) return 'other'
  const code = account.code.toUpperCase()
  if (code === 'CASSA') return 'cassa'
  if (code === 'BANCA') return 'banca'
  return 'other'
}

export function getPaymentMethodsForAccount(
  account: AccountingAccountRef | null | undefined
): PaymentMethodOption[] {
  const kind = getAccountKind(account)
  if (kind === 'cassa') return CASSA_PAYMENT_METHODS
  if (kind === 'banca') return BANCA_PAYMENT_METHODS
  return [...CASSA_PAYMENT_METHODS, ...BANCA_PAYMENT_METHODS]
}

export function defaultPaymentMethodForAccount(
  account: AccountingAccountRef | null | undefined
): string {
  const kind = getAccountKind(account)
  if (kind === 'cassa') return 'contanti'
  return ''
}

export function isPaymentMethodValidForAccount(
  account: AccountingAccountRef | null | undefined,
  paymentMethod: string
): boolean {
  const methods = getPaymentMethodsForAccount(account)
  if (methods.length === 1) return paymentMethod === methods[0].value
  if (!paymentMethod.trim()) return false
  return methods.some((m) => m.value === paymentMethod)
}

export function toDbDocumentType(
  documentType: DocumentType
): AccountingDocumentType | null {
  if (documentType === 'none') return null
  return documentType
}

export function fromDbDocumentType(
  documentType: string | null | undefined
): DocumentType {
  if (
    documentType === 'invoice' ||
    documentType === 'receipt' ||
    documentType === 'fiscal_receipt' ||
    documentType === 'other'
  ) {
    return documentType
  }
  return 'none'
}

/**
 * Compatibilità temporanea: interpreta vecchi valori codificati in `reference`
 * (FATTURA:/RICEVUTA:/SCONTRINO:/ALTRO:) solo per visualizzazione / hydrate form.
 * Non usare per nuovi salvataggi.
 */
export function parseLegacyDocumentReference(reference: string | null | undefined): {
  documentType: DocumentType
  documentNumber: string
  isLegacyEncoded: boolean
} {
  const raw = reference?.trim() ?? ''
  if (!raw) return { documentType: 'none', documentNumber: '', isLegacyEncoded: false }

  const fattura = /^FATTURA:(.+)$/i.exec(raw)
  if (fattura) {
    return {
      documentType: 'invoice',
      documentNumber: fattura[1].trim(),
      isLegacyEncoded: true
    }
  }

  const scontrino = /^SCONTRINO(?::(.+))?$/i.exec(raw)
  if (scontrino) {
    return {
      documentType: 'fiscal_receipt',
      documentNumber: (scontrino[1] ?? '').trim(),
      isLegacyEncoded: true
    }
  }

  const ricevuta = /^RICEVUTA(?::(.+))?$/i.exec(raw)
  if (ricevuta) {
    return {
      documentType: 'receipt',
      documentNumber: (ricevuta[1] ?? '').trim(),
      isLegacyEncoded: true
    }
  }

  const altro = /^ALTRO:(.+)$/i.exec(raw)
  if (altro) {
    return {
      documentType: 'other',
      documentNumber: altro[1].trim(),
      isLegacyEncoded: true
    }
  }

  return { documentType: 'none', documentNumber: '', isLegacyEncoded: false }
}

export function resolveDocumentFields(movement: {
  document_type?: string | null
  document_number?: string | null
  reference?: string | null
}): { documentType: DocumentType; documentNumber: string; isLegacyFallback: boolean } {
  const fromDb = fromDbDocumentType(movement.document_type)
  if (fromDb !== 'none') {
    return {
      documentType: fromDb,
      documentNumber: movement.document_number?.trim() ?? '',
      isLegacyFallback: false
    }
  }

  const legacy = parseLegacyDocumentReference(movement.reference)
  if (legacy.isLegacyEncoded) {
    return {
      documentType: legacy.documentType,
      documentNumber: legacy.documentNumber,
      isLegacyFallback: true
    }
  }

  return { documentType: 'none', documentNumber: '', isLegacyFallback: false }
}

export function formatDocumentLabel(movement: {
  document_type?: string | null
  document_number?: string | null
  reference?: string | null
}): string {
  const { documentType, documentNumber } = resolveDocumentFields(movement)
  if (documentType === 'none') return '—'

  const typeLabel =
    DOCUMENT_TYPE_OPTIONS.find((o) => o.value === documentType)?.label ?? documentType

  if (documentType === 'invoice' && documentNumber) return `Fattura n. ${documentNumber}`
  if (documentNumber) return `${typeLabel} · ${documentNumber}`
  return typeLabel
}

/** Riferimento pagamento: nasconde encoding legacy documento se ancora in `reference`. */
export function formatPaymentReferenceLabel(movement: {
  document_type?: string | null
  reference?: string | null
}): string {
  const raw = movement.reference?.trim() ?? ''
  if (!raw) return '—'

  if (!movement.document_type) {
    const legacy = parseLegacyDocumentReference(raw)
    if (legacy.isLegacyEncoded) return '—'
  }

  return raw
}

export function paymentMethodLabel(value: string | null | undefined): string {
  if (!value) return '—'
  const all = [...CASSA_PAYMENT_METHODS, ...BANCA_PAYMENT_METHODS]
  return all.find((m) => m.value === value)?.label ?? value
}
