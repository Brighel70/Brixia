import { describe, expect, it } from 'vitest'
import {
  defaultPaymentMethodForAccount,
  formatDocumentLabel,
  formatPaymentReferenceLabel,
  getPaymentMethodsForAccount,
  isPaymentMethodValidForAccount,
  parseLegacyDocumentReference,
  paymentMethodLabel,
  resolveDocumentFields,
  toDbDocumentType
} from './movementFormOptions'
import type { AccountingAccountRef } from '../types'

const cassa: AccountingAccountRef = { id: '1', code: 'CASSA', name: 'Cassa' }
const banca: AccountingAccountRef = { id: '2', code: 'BANCA', name: 'Banca' }

describe('movementFormOptions', () => {
  it('offre solo contanti per Cassa', () => {
    expect(getPaymentMethodsForAccount(cassa).map((m) => m.value)).toEqual(['contanti'])
    expect(defaultPaymentMethodForAccount(cassa)).toBe('contanti')
    expect(isPaymentMethodValidForAccount(cassa, 'contanti')).toBe(true)
    expect(isPaymentMethodValidForAccount(cassa, 'bonifico')).toBe(false)
  })

  it('offre metodi banca per conto Banca', () => {
    const values = getPaymentMethodsForAccount(banca).map((m) => m.value)
    expect(values).toContain('bonifico')
    expect(values).toContain('bancomat')
    expect(isPaymentMethodValidForAccount(banca, '')).toBe(false)
    expect(isPaymentMethodValidForAccount(banca, 'bonifico')).toBe(true)
  })

  it('mappa form documentType verso DB', () => {
    expect(toDbDocumentType('none')).toBeNull()
    expect(toDbDocumentType('invoice')).toBe('invoice')
    expect(toDbDocumentType('fiscal_receipt')).toBe('fiscal_receipt')
  })

  it('parsa solo encoding legacy in reference (display)', () => {
    expect(parseLegacyDocumentReference('FATTURA:1256')).toEqual({
      documentType: 'invoice',
      documentNumber: '1256',
      isLegacyEncoded: true
    })
    expect(parseLegacyDocumentReference('SCONTRINO')).toEqual({
      documentType: 'fiscal_receipt',
      documentNumber: '',
      isLegacyEncoded: true
    })
    expect(parseLegacyDocumentReference('CRO-998877')).toEqual({
      documentType: 'none',
      documentNumber: '',
      isLegacyEncoded: false
    })
  })

  it('preferisce colonne documento alle legacy in reference', () => {
    expect(
      resolveDocumentFields({
        document_type: 'receipt',
        document_number: '42',
        reference: 'FATTURA:999'
      })
    ).toEqual({
      documentType: 'receipt',
      documentNumber: '42',
      isLegacyFallback: false
    })

    expect(
      resolveDocumentFields({
        document_type: null,
        document_number: null,
        reference: 'RICEVUTA:7'
      })
    ).toEqual({
      documentType: 'receipt',
      documentNumber: '7',
      isLegacyFallback: true
    })
  })

  it('formatta etichette documento e riferimento pagamento', () => {
    expect(
      formatDocumentLabel({
        document_type: 'invoice',
        document_number: '1256',
        reference: null
      })
    ).toBe('Fattura n. 1256')

    expect(
      formatDocumentLabel({
        document_type: null,
        document_number: null,
        reference: 'FATTURA:88'
      })
    ).toBe('Fattura n. 88')

    expect(
      formatPaymentReferenceLabel({
        document_type: null,
        reference: 'FATTURA:88'
      })
    ).toBe('—')

    expect(
      formatPaymentReferenceLabel({
        document_type: 'invoice',
        reference: 'CRO-123'
      })
    ).toBe('CRO-123')

    expect(paymentMethodLabel('bonifico')).toBe('Bonifico')
    expect(paymentMethodLabel(null)).toBe('—')
  })
})
