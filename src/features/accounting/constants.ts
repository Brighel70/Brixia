import type { AccountingTabId } from './types'

export const ACCOUNTING_PAGE_SIZE = 25

export const ACCOUNTING_TABS: { id: AccountingTabId; label: string }[] = [
  { id: 'overview', label: 'Panoramica' },
  { id: 'movements', label: 'Prima nota' },
  { id: 'receivables', label: 'Crediti da quote' },
  { id: 'budget', label: 'Preventivo' },
  { id: 'consuntivo', label: 'Consuntivo' },
  { id: 'vat_sponsor', label: 'IVA e sponsor' },
  { id: 'counterparties', label: 'Anagrafica' },
  { id: 'sync', label: 'Sincronizzazione' }
]

/** Codice categoria Quote: previsto live dai receivable, non come riga budget. */
export const QUOTE_CATEGORY_CODE = 'QUOTE'
