import { supabase } from '@/lib/supabaseClient'
import type { AccountingCounterparty, CounterpartyKind } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const COUNTERPARTY_SELECT = `
  id, kind, display_name, given_name, family_name, company_name,
  tax_code, vat_number, email, phone, pec, recipient_code,
  address_street, address_city, address_zip, address_province, address_country,
  iban, people_id, is_active, notes, created_at, updated_at, archived_at
`

export interface CounterpartyWriteInput {
  kind: CounterpartyKind
  displayName: string
  givenName?: string | null
  familyName?: string | null
  companyName?: string | null
  taxCode?: string | null
  vatNumber?: string | null
  email?: string | null
  phone?: string | null
  pec?: string | null
  recipientCode?: string | null
  addressStreet?: string | null
  addressCity?: string | null
  addressZip?: string | null
  addressProvince?: string | null
  addressCountry?: string | null
  iban?: string | null
  notes?: string | null
  isActive?: boolean
}

function toRow(input: CounterpartyWriteInput) {
  const display = input.displayName.trim()
  if (!display) throw new Error('Nome visualizzato obbligatorio.')
  return {
    kind: input.kind,
    display_name: display,
    given_name: input.givenName?.trim() || null,
    family_name: input.familyName?.trim() || null,
    company_name: input.companyName?.trim() || null,
    tax_code: input.taxCode?.trim() || null,
    vat_number: input.vatNumber?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    pec: input.pec?.trim() || null,
    recipient_code: input.recipientCode?.trim() || null,
    address_street: input.addressStreet?.trim() || null,
    address_city: input.addressCity?.trim() || null,
    address_zip: input.addressZip?.trim() || null,
    address_province: input.addressProvince?.trim() || null,
    address_country: (input.addressCountry?.trim() || 'IT').slice(0, 2).toUpperCase(),
    iban: input.iban?.trim() || null,
    notes: input.notes?.trim() || null,
    is_active: input.isActive ?? true
  }
}

export async function fetchCounterpartiesFull(options?: {
  includeArchived?: boolean
}): Promise<AccountingCounterparty[]> {
  let query = db
    .from('accounting_counterparties')
    .select(COUNTERPARTY_SELECT)
    .order('display_name', { ascending: true })

  if (!options?.includeArchived) {
    query = query.is('archived_at', null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as AccountingCounterparty[]
}

export async function createCounterparty(
  input: CounterpartyWriteInput
): Promise<AccountingCounterparty> {
  const { data, error } = await db
    .from('accounting_counterparties')
    .insert(toRow(input))
    .select(COUNTERPARTY_SELECT)
    .single()

  if (error) throw error
  return data as AccountingCounterparty
}

export async function updateCounterparty(
  id: string,
  input: CounterpartyWriteInput
): Promise<AccountingCounterparty> {
  const { data, error } = await db
    .from('accounting_counterparties')
    .update(toRow(input))
    .eq('id', id)
    .is('archived_at', null)
    .select(COUNTERPARTY_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Controparte non modificabile (archiviata o assente).')
  return data as AccountingCounterparty
}

export async function archiveCounterparty(id: string): Promise<AccountingCounterparty> {
  const { data, error } = await db
    .from('accounting_counterparties')
    .update({
      archived_at: new Date().toISOString(),
      is_active: false
    })
    .eq('id', id)
    .is('archived_at', null)
    .select(COUNTERPARTY_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Archiviazione non riuscita.')
  return data as AccountingCounterparty
}

export async function reactivateCounterparty(id: string): Promise<AccountingCounterparty> {
  const { data, error } = await db
    .from('accounting_counterparties')
    .update({
      archived_at: null,
      is_active: true
    })
    .eq('id', id)
    .select(COUNTERPARTY_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Riattivazione non riuscita.')
  return data as AccountingCounterparty
}
