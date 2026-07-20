import { supabase } from '@/lib/supabaseClient'
import type { SponsorshipContract } from '../types'
import { computeGrossCents, computeVatAmountCents } from '../utils/vatCalculations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const CONTRACT_SELECT = `
  id, fiscal_year_id, counterparty_id, title, starts_on, ends_on,
  taxable_amount_cents, vat_rate_basis_points, gross_amount_cents,
  status, body_text, pdf_path, notes, confirmed_at, confirmed_by,
  cancelled_at, created_at, updated_at,
  counterparty:accounting_counterparties(id, display_name, kind, is_active)
`

export async function fetchSponsorshipContracts(
  fiscalYearId: string
): Promise<SponsorshipContract[]> {
  const { data, error } = await db
    .from('accounting_sponsorship_contracts')
    .select(CONTRACT_SELECT)
    .eq('fiscal_year_id', fiscalYearId)
    .order('starts_on', { ascending: false })

  if (error) throw error
  return (data ?? []) as SponsorshipContract[]
}

export async function fetchSponsorshipContractById(
  id: string
): Promise<SponsorshipContract | null> {
  const { data, error } = await db
    .from('accounting_sponsorship_contracts')
    .select(CONTRACT_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return (data as SponsorshipContract | null) ?? null
}

export async function hasConfirmedSponsorshipContract(input: {
  fiscalYearId: string
  counterpartyId: string
}): Promise<boolean> {
  const { count, error } = await db
    .from('accounting_sponsorship_contracts')
    .select('id', { count: 'exact', head: true })
    .eq('fiscal_year_id', input.fiscalYearId)
    .eq('counterparty_id', input.counterpartyId)
    .eq('status', 'confirmed')

  if (error) throw error
  return (count ?? 0) > 0
}

export async function createSponsorshipContract(input: {
  fiscalYearId: string
  counterpartyId: string
  title: string
  startsOn: string
  endsOn?: string | null
  taxableAmountCents: number
  vatRateBasisPoints: number
  bodyText: string
  notes?: string | null
}): Promise<SponsorshipContract> {
  const vat = computeVatAmountCents(input.taxableAmountCents, input.vatRateBasisPoints)
  const gross = computeGrossCents(input.taxableAmountCents, vat)

  const { data, error } = await db
    .from('accounting_sponsorship_contracts')
    .insert({
      fiscal_year_id: input.fiscalYearId,
      counterparty_id: input.counterpartyId,
      title: input.title.trim(),
      starts_on: input.startsOn,
      ends_on: input.endsOn || null,
      taxable_amount_cents: input.taxableAmountCents,
      vat_rate_basis_points: input.vatRateBasisPoints,
      gross_amount_cents: gross,
      status: 'draft',
      body_text: input.bodyText,
      notes: input.notes?.trim() || null
    })
    .select(CONTRACT_SELECT)
    .single()

  if (error) throw error
  return data as SponsorshipContract
}

export async function updateSponsorshipContractDraft(
  id: string,
  input: {
    title: string
    startsOn: string
    endsOn?: string | null
    taxableAmountCents: number
    vatRateBasisPoints: number
    bodyText: string
    notes?: string | null
    counterpartyId?: string
  }
): Promise<SponsorshipContract> {
  const vat = computeVatAmountCents(input.taxableAmountCents, input.vatRateBasisPoints)
  const gross = computeGrossCents(input.taxableAmountCents, vat)

  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    starts_on: input.startsOn,
    ends_on: input.endsOn || null,
    taxable_amount_cents: input.taxableAmountCents,
    vat_rate_basis_points: input.vatRateBasisPoints,
    gross_amount_cents: gross,
    body_text: input.bodyText,
    notes: input.notes?.trim() || null
  }
  if (input.counterpartyId) patch.counterparty_id = input.counterpartyId

  const { data, error } = await db
    .from('accounting_sponsorship_contracts')
    .update(patch)
    .eq('id', id)
    .eq('status', 'draft')
    .select(CONTRACT_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Contratto non modificabile (solo bozza).')
  return data as SponsorshipContract
}

export async function confirmSponsorshipContract(id: string): Promise<void> {
  const { error } = await db.rpc('accounting_sponsorship_contract_confirm', { p_id: id })
  if (error) throw error
}

export async function reopenSponsorshipContractDraft(id: string): Promise<void> {
  const { error } = await db.rpc('accounting_sponsorship_contract_reopen_draft', { p_id: id })
  if (error) throw error
}

export async function setSponsorshipContractPdfPath(id: string, pdfPath: string): Promise<void> {
  const { error } = await db.rpc('accounting_sponsorship_contract_set_pdf_path', {
    p_id: id,
    p_pdf_path: pdfPath
  })
  if (error) throw error
}

export async function setCommercialDocumentPdfPath(id: string, pdfPath: string): Promise<void> {
  const { error } = await db.rpc('accounting_commercial_doc_set_pdf_path', {
    p_id: id,
    p_pdf_path: pdfPath
  })
  if (error) throw error
}
