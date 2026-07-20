import { supabase } from '@/lib/supabaseClient'
import type {
  AccountingCounterpartyRef,
  AccountingFiscalParamRow,
  CommercialDocument,
  CommercialDocumentPayment,
  VatPeriod
} from '../types'
import { computeDocumentCollection, computeGrossCents, computeVatAmountCents } from '../utils/vatCalculations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const DOC_SELECT = `
  id, fiscal_year_id, counterparty_id, document_type, document_number, document_date,
  description, commercial_kind, taxable_amount_cents, vat_rate_basis_points,
  vat_amount_cents, gross_amount_cents, status, movement_id, include_in_398_limit,
  notes, draft_body_text, pdf_path, sponsorship_contract_id,
  issued_at, collected_at, cancelled_at, created_at, updated_at,
  counterparty:accounting_counterparties(id, display_name, kind, is_active)
`

const PAYMENT_SELECT = `
  id, document_id, movement_id, allocated_amount_cents, notes, created_at,
  movement:accounting_movements(id, movement_date, amount_cents, status, description)
`

export async function fetchFiscalParams(): Promise<AccountingFiscalParamRow[]> {
  const { data, error } = await db
    .from('accounting_fiscal_params')
    .select(
      'id, param_key, value_type, value_json, valid_from, valid_to, source, verification_status, verification_note'
    )
    .order('param_key')
    .order('valid_from', { ascending: false })

  if (error) throw error
  return (data ?? []) as AccountingFiscalParamRow[]
}

export async function fetchCounterparties(): Promise<AccountingCounterpartyRef[]> {
  const { data, error } = await db
    .from('accounting_counterparties')
    .select(
      'id, display_name, kind, is_active, vat_number, tax_code, company_name, email, phone, pec, address_street, address_city, address_zip, address_province, iban'
    )
    .is('archived_at', null)
    .eq('is_active', true)
    .order('display_name')

  if (error) throw error
  return (data ?? []) as AccountingCounterpartyRef[]
}

export async function fetchDocumentPayments(
  documentIds: string[]
): Promise<CommercialDocumentPayment[]> {
  if (documentIds.length === 0) return []
  const { data, error } = await db
    .from('accounting_commercial_document_payments')
    .select(PAYMENT_SELECT)
    .in('document_id', documentIds)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as CommercialDocumentPayment[]
}

export async function fetchCommercialDocuments(
  fiscalYearId: string
): Promise<CommercialDocument[]> {
  let data: CommercialDocument[] | null = null
  let error: { message?: string; code?: string } | null = null

  {
    const res = await db
      .from('accounting_commercial_documents')
      .select(DOC_SELECT)
      .eq('fiscal_year_id', fiscalYearId)
      .order('document_date', { ascending: false })
    data = res.data as CommercialDocument[] | null
    error = res.error
  }

  // Fallback se migration 020 non applicata (colonne draft_body_text / pdf_path assenti).
  if (error && /draft_body_text|pdf_path|sponsorship_contract_id/i.test(error.message ?? '')) {
    const legacySelect = `
      id, fiscal_year_id, counterparty_id, document_type, document_number, document_date,
      description, commercial_kind, taxable_amount_cents, vat_rate_basis_points,
      vat_amount_cents, gross_amount_cents, status, movement_id, include_in_398_limit,
      notes, issued_at, collected_at, cancelled_at, created_at, updated_at,
      counterparty:accounting_counterparties(id, display_name, kind, is_active)
    `
    const res = await db
      .from('accounting_commercial_documents')
      .select(legacySelect)
      .eq('fiscal_year_id', fiscalYearId)
      .order('document_date', { ascending: false })
    if (res.error) throw res.error
    data = res.data as CommercialDocument[] | null
    error = null
  }

  if (error) throw error
  const docs = (data ?? []) as CommercialDocument[]
  const payments = await fetchDocumentPayments(docs.map((d) => d.id))
  const byDoc = new Map<string, CommercialDocumentPayment[]>()
  for (const p of payments) {
    const list = byDoc.get(p.document_id) ?? []
    list.push(p)
    byDoc.set(p.document_id, list)
  }
  return docs.map((d) => {
    const docPayments = byDoc.get(d.id) ?? []
    const { collectedCents, residualCents, needsReconciliation } = computeDocumentCollection({
      gross_amount_cents: d.gross_amount_cents,
      payments: docPayments
    })
    return {
      ...d,
      payments: docPayments,
      collected_amount_cents: collectedCents,
      residual_amount_cents: residualCents,
      needs_reconciliation: needsReconciliation
    }
  })
}

export async function fetchVatPeriods(fiscalYearId: string): Promise<VatPeriod[]> {
  const { data, error } = await db
    .from('accounting_vat_periods')
    .select(
      `
      id, fiscal_year_id, year, quarter, status,
      commercial_taxable_cents, output_vat_cents, forfait_deduction_cents,
      estimated_vat_due_cents, indicative_due_on,
      verified_at, verified_by, paid_at, payment_reference,
      param_snapshot, created_at, updated_at
    `
    )
    .eq('fiscal_year_id', fiscalYearId)
    .order('quarter', { ascending: true })

  if (error) throw error
  return (data ?? []) as VatPeriod[]
}

export async function countToClassifyMovements(fiscalYearId: string): Promise<number> {
  const { data: cats, error: catErr } = await db
    .from('accounting_categories')
    .select('id')
    .eq('default_nature', 'to_classify')
    .eq('is_active', true)

  if (catErr) throw catErr
  const ids = (cats ?? []).map((c: { id: string }) => c.id)
  if (ids.length === 0) return 0

  const { count, error } = await db
    .from('accounting_movements')
    .select('id', { count: 'exact', head: true })
    .eq('fiscal_year_id', fiscalYearId)
    .in('category_id', ids)
    .neq('status', 'cancelled')

  if (error) throw error
  return count ?? 0
}

export interface CreateCommercialDocumentInput {
  fiscalYearId: string
  counterpartyId: string
  documentType: CommercialDocument['document_type']
  documentNumber: string | null
  documentDate: string
  description: string
  commercialKind: CommercialDocument['commercial_kind']
  taxableAmountCents: number
  vatRateBasisPoints: number
  includeIn398Limit: boolean
  notes: string | null
  roundingMethod?: string | null
  draftBodyText?: string | null
  sponsorshipContractId?: string | null
}

export async function createCommercialDocumentDraft(
  input: CreateCommercialDocumentInput
): Promise<CommercialDocument> {
  const vat = computeVatAmountCents(
    input.taxableAmountCents,
    input.vatRateBasisPoints,
    input.roundingMethod ?? 'half_up_cent'
  )
  const gross = computeGrossCents(input.taxableAmountCents, vat)

  const { data, error } = await db
    .from('accounting_commercial_documents')
    .insert({
      fiscal_year_id: input.fiscalYearId,
      counterparty_id: input.counterpartyId,
      document_type: input.documentType,
      document_number: input.documentNumber?.trim() || null,
      document_date: input.documentDate,
      description: input.description.trim(),
      commercial_kind: input.commercialKind,
      taxable_amount_cents: input.taxableAmountCents,
      vat_rate_basis_points: input.vatRateBasisPoints,
      vat_amount_cents: vat,
      gross_amount_cents: gross,
      status: 'draft',
      include_in_398_limit: input.includeIn398Limit,
      notes: input.notes?.trim() || null,
      draft_body_text: input.draftBodyText?.trim() || null,
      sponsorship_contract_id: input.sponsorshipContractId || null
    })
    .select(DOC_SELECT)
    .single()

  if (error) throw error
  return data as CommercialDocument
}

export async function updateCommercialDocumentDraft(
  id: string,
  input: Omit<CreateCommercialDocumentInput, 'fiscalYearId'>
): Promise<CommercialDocument> {
  const vat = computeVatAmountCents(
    input.taxableAmountCents,
    input.vatRateBasisPoints,
    input.roundingMethod ?? 'half_up_cent'
  )
  const gross = computeGrossCents(input.taxableAmountCents, vat)

  const { data, error } = await db
    .from('accounting_commercial_documents')
    .update({
      counterparty_id: input.counterpartyId,
      document_type: input.documentType,
      document_number: input.documentNumber?.trim() || null,
      document_date: input.documentDate,
      description: input.description.trim(),
      commercial_kind: input.commercialKind,
      taxable_amount_cents: input.taxableAmountCents,
      vat_rate_basis_points: input.vatRateBasisPoints,
      vat_amount_cents: vat,
      gross_amount_cents: gross,
      include_in_398_limit: input.includeIn398Limit,
      notes: input.notes?.trim() || null,
      draft_body_text: input.draftBodyText?.trim() || null,
      sponsorship_contract_id: input.sponsorshipContractId || null
    })
    .eq('id', id)
    .eq('status', 'draft')
    .select(DOC_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Documento non modificabile (solo bozza).')
  return data as CommercialDocument
}

export async function updateCommercialDocumentDraftBody(
  id: string,
  draftBodyText: string
): Promise<void> {
  const { data, error } = await db
    .from('accounting_commercial_documents')
    .update({ draft_body_text: draftBodyText })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Bozza testo non modificabile (solo documenti in bozza).')
}

export async function issueCommercialDocument(id: string): Promise<void> {
  const { error } = await db.rpc('accounting_commercial_doc_issue', { p_id: id })
  if (error) throw error
}

export async function cancelCommercialDocument(id: string): Promise<void> {
  const { error } = await db.rpc('accounting_commercial_doc_cancel', { p_id: id })
  if (error) throw error
}

export async function registerCommercialPayment(input: {
  documentId: string
  accountId: string
  allocatedAmountCents: number
  movementDate?: string | null
}): Promise<unknown> {
  const { data, error } = await db.rpc('accounting_commercial_doc_register_payment', {
    p_document_id: input.documentId,
    p_account_id: input.accountId,
    p_allocated_amount_cents: input.allocatedAmountCents,
    p_movement_date: input.movementDate || null
  })
  if (error) throw error
  return data
}

export async function linkCommercialMovement(input: {
  documentId: string
  movementId: string
  allocatedAmountCents: number
}): Promise<unknown> {
  const { data, error } = await db.rpc('accounting_commercial_doc_link_movement', {
    p_document_id: input.documentId,
    p_movement_id: input.movementId,
    p_allocated_amount_cents: input.allocatedAmountCents
  })
  if (error) throw error
  return data
}

export async function calculateVatPeriod(input: {
  fiscalYearId: string
  year: number
  quarter: number
}): Promise<unknown> {
  const { data, error } = await db.rpc('accounting_vat_period_calculate', {
    p_fiscal_year_id: input.fiscalYearId,
    p_year: input.year,
    p_quarter: input.quarter
  })
  if (error) throw error
  return data
}

export async function verifyVatPeriod(id: string): Promise<void> {
  const { error } = await db.rpc('accounting_vat_period_verify', { p_id: id })
  if (error) throw error
}

export async function markVatPeriodPaid(input: {
  id: string
  paidAt: string
  paymentReference: string
}): Promise<void> {
  const { error } = await db.rpc('accounting_vat_period_mark_paid', {
    p_id: input.id,
    p_paid_at: input.paidAt,
    p_payment_reference: input.paymentReference
  })
  if (error) throw error
}
