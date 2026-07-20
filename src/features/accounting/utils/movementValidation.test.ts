import { describe, expect, it } from 'vitest'
import {
  filterCategoriesForType,
  isFiscalYearOpenForEditing,
  movementFormToPayload,
  movementToFormValues,
  parseAmountEurosToCents,
  validateMovementForm
} from './movementValidation'
import type { AccountingAccountRef, AccountingCategoryRef, AccountingFiscalYear } from '../types'

const openFy: AccountingFiscalYear = {
  id: 'fy-1',
  code: '2026',
  starts_on: '2026-01-01',
  ends_on: '2026-12-31',
  status: 'open',
  currency: 'EUR'
}

const accounts: AccountingAccountRef[] = [
  { id: 'acc-1', code: 'CASSA', name: 'Cassa' },
  { id: 'acc-2', code: 'BANCA', name: 'Banca' }
]
const categories: AccountingCategoryRef[] = [
  { id: 'cat-1', code: 'QUOTE', name: 'Quote', direction: 'income' }
]

const baseValues = {
  type: 'income' as const,
  movementDate: '2026-06-01',
  settlementDate: '',
  amountEuros: '10,00',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  description: 'Test',
  paymentMethod: 'contanti',
  documentType: 'none' as const,
  documentNumber: '',
  documentDate: '',
  reference: '',
  notes: ''
}

describe('movementValidation', () => {
  it('converte euro in centesimi senza floating point', () => {
    expect(parseAmountEurosToCents('12,34')).toBe(1234)
    expect(parseAmountEurosToCents('1.234,56')).toBe(123456)
  })

  it('rifiuta importi non positivi', () => {
    expect(parseAmountEurosToCents('0')).toBeNull()
    expect(parseAmountEurosToCents('-5')).toBeNull()
  })

  it('valida esercizio aperto e data nel range', () => {
    expect(isFiscalYearOpenForEditing(openFy)).toBe(true)
    const err = validateMovementForm(
      { ...baseValues, movementDate: '2025-12-31' },
      openFy,
      accounts,
      categories
    )
    expect(err).toMatch(/compresa nell'esercizio/)
  })

  it('richiede metodo pagamento per banca', () => {
    const err = validateMovementForm(
      { ...baseValues, accountId: 'acc-2', paymentMethod: '' },
      openFy,
      accounts,
      categories
    )
    expect(err).toMatch(/banca/)
  })

  it('richiede numero fattura', () => {
    const err = validateMovementForm(
      { ...baseValues, documentType: 'invoice', documentNumber: '' },
      openFy,
      accounts,
      categories
    )
    expect(err).toMatch(/numero fattura/)
  })

  it('non richiede numero per Altro e non codifica in reference', () => {
    expect(
      validateMovementForm(
        { ...baseValues, documentType: 'other', documentNumber: '', reference: 'CRO-1' },
        openFy,
        accounts,
        categories
      )
    ).toBeNull()

    expect(
      movementFormToPayload(
        {
          ...baseValues,
          documentType: 'other',
          documentNumber: 'nota interna',
          documentDate: '2026-03-01',
          reference: 'CRO-9988'
        },
        accounts
      )
    ).toEqual({
      paymentMethod: 'contanti',
      reference: 'CRO-9988',
      documentType: 'other',
      documentNumber: 'nota interna',
      documentDate: '2026-03-01'
    })
  })

  it('genera payload con colonne documento dedicate', () => {
    expect(
      movementFormToPayload(
        {
          ...baseValues,
          documentType: 'invoice',
          documentNumber: '1256',
          documentDate: '2026-02-10',
          reference: 'TRN-1'
        },
        accounts
      )
    ).toEqual({
      paymentMethod: 'contanti',
      reference: 'TRN-1',
      documentType: 'invoice',
      documentNumber: '1256',
      documentDate: '2026-02-10'
    })
  })

  it('hydrate form da colonne DB e da legacy reference', () => {
    expect(
      movementToFormValues({
        direction: 'income',
        movement_date: '2026-01-15',
        amount_cents: 1000,
        account: { id: 'acc-1' },
        category: { id: 'cat-1' },
        description: 'Nuovo',
        payment_method_raw: 'contanti',
        document_type: 'invoice',
        document_number: '10',
        document_date: '2026-01-14',
        reference: 'CRO-9',
        notes: null
      })
    ).toMatchObject({
      documentType: 'invoice',
      documentNumber: '10',
      documentDate: '2026-01-14',
      reference: 'CRO-9'
    })

    expect(
      movementToFormValues({
        direction: 'expense',
        movement_date: '2026-01-15',
        amount_cents: 500,
        account: { id: 'acc-1' },
        category: { id: 'cat-1' },
        description: 'Legacy',
        payment_method_raw: 'contanti',
        document_type: null,
        document_number: null,
        document_date: null,
        reference: 'FATTURA:77',
        notes: null
      })
    ).toMatchObject({
      documentType: 'invoice',
      documentNumber: '77',
      reference: ''
    })
  })

  it('filtra categorie per tipo movimento', () => {
    const cats: AccountingCategoryRef[] = [
      { id: '1', code: 'A', name: 'A', direction: 'income' },
      { id: '2', code: 'B', name: 'B', direction: 'expense' },
      { id: '3', code: 'C', name: 'C', direction: 'both' },
      { id: '4', code: 'D', name: 'D', direction: 'income', is_active: false },
      { id: '5', code: 'E', name: 'E', direction: 'income', available_in_movements: false }
    ]
    expect(filterCategoriesForType(cats, 'income').map((c) => c.id)).toEqual(['1', '3'])
    expect(
      filterCategoriesForType(cats, 'income', { retainIds: ['4'] }).map((c) => c.id)
    ).toEqual(['1', '3', '4'])
  })
})
