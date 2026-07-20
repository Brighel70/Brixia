export type FiscalYearStatus = 'draft' | 'open' | 'closing' | 'closed'

export interface AccountingFiscalYear {
  id: string
  code: string
  starts_on: string
  ends_on: string
  status: FiscalYearStatus
  currency: string
}

export type MovementDirection =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'adjustment'
  | 'opening'
  | 'closing'
  | 'reversal'

export type MovementStatus =
  | 'draft'
  | 'pending_account'
  | 'posted'
  | 'reversed'
  | 'cancelled'

export type MovementOrigin =
  | 'manual'
  | 'fee_sync'
  | 'backfill'
  | 'reversal'
  | 'refund'
  | 'adjustment'

/** Valori CHECK su accounting_movements.document_type (NULL = nessuno). */
export type AccountingDocumentType = 'invoice' | 'receipt' | 'fiscal_receipt' | 'other'

export type ReceivableNature = 'institutional' | 'commercial' | 'mixed' | 'to_classify'

export interface AccountingAccountRef {
  id: string
  code: string
  name: string
}

export interface AccountingCategoryRef {
  id: string
  code: string
  name: string
  direction?: 'income' | 'expense' | 'both'
  default_nature?: ReceivableNature
  group_id?: string | null
  is_active?: boolean
  is_system?: boolean
  available_in_movements?: boolean
  available_in_budget?: boolean
  available_in_reports?: boolean
  archived_at?: string | null
  group?: AccountingCategoryGroupRef | null
}

export interface AccountingCategoryGroupRef {
  id: string
  code: string
  name: string
  direction: 'income' | 'expense'
}

export interface AccountingCategoryGroup {
  id: string
  direction: 'income' | 'expense'
  code: string
  name: string
  description: string | null
  is_active: boolean
  is_system: boolean
  sort_order: number
  archived_at: string | null
  created_at?: string
  updated_at?: string
}

export interface AccountingCategorySettingsRow {
  id: string
  group_id: string | null
  code: string
  name: string
  direction: 'income' | 'expense' | 'both'
  default_nature: ReceivableNature
  include_in_commercial_limit: boolean
  is_system: boolean
  is_active: boolean
  recommended_active: boolean
  sort_order: number
  notes: string | null
  available_in_movements: boolean
  available_in_budget: boolean
  available_in_reports: boolean
  archived_at: string | null
  created_at?: string
  updated_at?: string
}

export interface CategoryActivationBatchPayload {
  groups: Array<{ id: string; is_active: boolean }>
  categories: Array<{
    id: string
    is_active: boolean
    available_in_movements: boolean
    available_in_budget: boolean
    available_in_reports: boolean
  }>
}

export interface AccountingMovement {
  id: string
  movement_date: string
  settlement_date?: string | null
  description: string
  direction: MovementDirection
  amount_cents: number
  origin: MovementOrigin
  status: MovementStatus
  payment_method_raw: string | null
  document_type?: AccountingDocumentType | null
  document_number?: string | null
  document_date?: string | null
  /** Riferimento pagamento (CRO/TRN, POS, assegno…), non documento. */
  reference: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
  receivable_id?: string | null
  reverses_movement_id?: string | null
  reversed_by_movement_id?: string | null
  account: AccountingAccountRef | null
  category: AccountingCategoryRef | null
}

export interface AccountingMovementDetail extends AccountingMovement {
  receivable: {
    id: string
    description: string
    status: string
    expected_amount_cents: number
    collected_amount_cents: number
    residual_amount_cents: number
  } | null
  reverses_movement: Pick<
    AccountingMovement,
    'id' | 'description' | 'amount_cents' | 'movement_date' | 'direction' | 'status'
  > | null
  reversed_by_movement: Pick<
    AccountingMovement,
    'id' | 'description' | 'amount_cents' | 'movement_date' | 'direction' | 'status'
  > | null
}

export interface CreateMovementInput {
  fiscalYearId: string
  type: 'income' | 'expense'
  movementDate: string
  settlementDate: string | null
  amountCents: number
  accountId: string
  categoryId: string
  description: string
  paymentMethod: string
  documentType: AccountingDocumentType | null
  documentNumber: string | null
  documentDate: string | null
  /** Riferimento pagamento. */
  reference: string | null
  notes: string | null
}

export interface UpdateMovementInput {
  movementDate: string
  settlementDate: string | null
  amountCents: number
  accountId: string
  categoryId: string
  description: string
  paymentMethod: string
  documentType: AccountingDocumentType | null
  documentNumber: string | null
  documentDate: string | null
  /** Riferimento pagamento. */
  reference: string | null
  notes: string | null
  type: 'income' | 'expense'
}

export type ReceivableStatus =
  | 'assigned'
  | 'partially_paid'
  | 'paid'
  | 'overpaid'
  | 'cancelled'
  | 'partially_refunded'
  | 'refunded'
  | 'to_review'

export interface AccountingPersonRef {
  id: string
  given_name: string | null
  family_name: string | null
  full_name: string | null
}

export interface AccountingReceivable {
  id: string
  description: string
  expected_amount_cents: number
  collected_amount_cents: number
  residual_amount_cents: number
  due_date: string | null
  status: ReceivableStatus
  nature: ReceivableNature
  source_system: string
  source_table: string
  source_id: string | null
  person: AccountingPersonRef | null
  category: AccountingCategoryRef | null
}

export interface MovementSummaryRow {
  direction: MovementDirection
  status: MovementStatus
  amount_cents: number
}

export interface AccountingSummary {
  incomeCents: number
  expenseCents: number
  reversalCents: number
  balanceCents: number
  residualCreditsCents: number
  pendingReviewCount: number
}

export interface ReconcileFeesPreview {
  aligned: boolean
  assignments_count?: number
  payments_count?: number
  active_assignment_links?: number
  active_payment_links?: number
  assignments_missing_active_link: number
  active_assignment_links_without_source: number
  payments_missing_active_link: number
  active_payment_links_without_source: number
  collected_mismatch_count: number
  outbox_pending: number
  outbox_failed: number
  personal_data_included?: boolean
}

export type AccountingTabId =
  | 'overview'
  | 'movements'
  | 'receivables'
  | 'budget'
  | 'consuntivo'
  | 'vat_sponsor'
  | 'counterparties'
  | 'sync'

export type CommercialKind =
  | 'sponsorship'
  | 'advertising'
  | 'ticketing'
  | 'merchandising'
  | 'services'
  | 'other'

export type CommercialDocumentStatus =
  | 'draft'
  | 'issued'
  | 'partially_collected'
  | 'collected'
  | 'cancelled'

export type VatPeriodStatus = 'open' | 'calculated' | 'verified' | 'paid'

export type CounterpartyKind =
  | 'member'
  | 'guardian'
  | 'sponsor'
  | 'customer'
  | 'supplier'
  | 'collaborator'
  | 'public_body'
  | 'federation'
  | 'sports_club'
  | 'other'

export interface AccountingCounterpartyRef {
  id: string
  display_name: string
  kind: CounterpartyKind | string
  is_active: boolean
  vat_number?: string | null
  tax_code?: string | null
  company_name?: string | null
  email?: string | null
  phone?: string | null
  pec?: string | null
  address_street?: string | null
  address_city?: string | null
  address_zip?: string | null
  address_province?: string | null
  iban?: string | null
}

/** Anagrafica contabile completa (clienti/sponsor e fornitori). */
export interface AccountingCounterparty {
  id: string
  kind: CounterpartyKind
  display_name: string
  given_name: string | null
  family_name: string | null
  company_name: string | null
  tax_code: string | null
  vat_number: string | null
  email: string | null
  phone: string | null
  pec: string | null
  recipient_code: string | null
  address_street: string | null
  address_city: string | null
  address_zip: string | null
  address_province: string | null
  address_country: string
  iban: string | null
  people_id: string | null
  is_active: boolean
  notes: string | null
  created_at?: string
  updated_at?: string
  archived_at: string | null
}

export interface AccountingFiscalParamRow {
  id: string
  param_key: string
  value_type: string
  value_json: unknown
  valid_from: string
  valid_to: string | null
  source: string | null
  verification_status: 'unverified' | 'verified'
  verification_note: string | null
}

export interface CommercialDocumentPayment {
  id: string
  document_id: string
  movement_id: string
  allocated_amount_cents: number
  notes: string | null
  created_at?: string
  movement?: {
    id: string
    movement_date: string
    amount_cents: number
    status: string
    description: string
  } | null
}

export interface CommercialDocument {
  id: string
  fiscal_year_id: string
  counterparty_id: string
  document_type: AccountingDocumentType
  document_number: string | null
  document_date: string
  description: string
  commercial_kind: CommercialKind
  taxable_amount_cents: number
  vat_rate_basis_points: number
  vat_amount_cents: number
  gross_amount_cents: number
  status: CommercialDocumentStatus
  /** Legacy — non usato dai nuovi flussi di pagamento. */
  movement_id: string | null
  include_in_398_limit: boolean
  notes: string | null
  draft_body_text?: string | null
  pdf_path?: string | null
  sponsorship_contract_id?: string | null
  issued_at: string | null
  collected_at: string | null
  cancelled_at: string | null
  created_at?: string
  updated_at?: string
  counterparty?: AccountingCounterpartyRef | null
  collected_amount_cents?: number
  residual_amount_cents?: number
  payments?: CommercialDocumentPayment[]
  needs_reconciliation?: boolean
}

export type SponsorshipContractStatus = 'draft' | 'confirmed' | 'cancelled'

export interface SponsorshipContract {
  id: string
  fiscal_year_id: string
  counterparty_id: string
  title: string
  starts_on: string
  ends_on: string | null
  taxable_amount_cents: number
  vat_rate_basis_points: number
  gross_amount_cents: number
  status: SponsorshipContractStatus
  body_text: string
  pdf_path: string | null
  notes: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  cancelled_at: string | null
  created_at?: string
  updated_at?: string
  counterparty?: AccountingCounterpartyRef | null
}

export interface VatPeriod {
  id: string
  fiscal_year_id: string
  year: number
  quarter: number
  status: VatPeriodStatus
  commercial_taxable_cents: number
  output_vat_cents: number
  forfait_deduction_cents: number
  estimated_vat_due_cents: number
  indicative_due_on: string | null
  verified_at: string | null
  verified_by: string | null
  paid_at: string | null
  payment_reference: string | null
  param_snapshot: unknown
  created_at?: string
  updated_at?: string
}

export interface CommercialVatOverview {
  commercialRevenueCents: number
  sponsorshipRevenueCents: number
  taxableCents: number
  outputVatCents: number
  forfaitDeductionCents: number
  estimatedVatDueCents: number
  limitCents: number | null
  limitUsedCents: number
  limitResidualCents: number | null
  limitUsedPercent: number | null
  limitExceeded: boolean
  paramsAllVerified: boolean
  unverifiedParamKeys: string[]
  paramsMissing: boolean
  toClassifyDocuments: number
  toClassifyMovements: number
}

export interface MovementsFilterState {
  search: string
  dateFrom: string
  dateTo: string
  direction: MovementDirection | 'all'
  status: MovementStatus | 'all'
  accountId: string | 'all'
}

export interface ReceivablesFilterState {
  search: string
  status: ReceivableStatus | 'all'
  dueFilter: 'all' | 'overdue' | 'upcoming' | 'no_date'
}

export type BudgetStatus = 'draft' | 'approved' | 'archived'

export type BudgetLineDirection = 'income' | 'expense'

export type BudgetLineSourceType = 'manual' | 'fees_live'

export interface AccountingBudget {
  id: string
  fiscal_year_id: string
  name: string
  status: BudgetStatus
  version: number
  notes: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface AccountingBudgetLine {
  id: string
  budget_id: string
  category_id: string
  direction: BudgetLineDirection
  description: string
  planned_amount_cents: number
  sort_order: number
  notes: string | null
  source_type: BudgetLineSourceType
  created_at: string
  updated_at: string
  category: AccountingCategoryRef | null
}

export interface FeesBudgetAggregate {
  expectedCents: number
  collectedCents: number
  residualCents: number
  quoteCategoryId: string | null
}

export interface MovementCategoryActualRow {
  id: string
  category_id: string | null
  direction: MovementDirection
  status: MovementStatus
  amount_cents: number
  reverses_movement_id: string | null
}

export interface CategoryActualsResult {
  byCategory: Map<string, { incomeCents: number; expenseCents: number }>
  /** Storni senza originale collegato (da verificare). */
  unattributedReversalCents: number
}

export interface BudgetComparisonRow {
  key: string
  categoryId: string | null
  categoryCode: string
  categoryName: string
  direction: BudgetLineDirection
  source: 'fees_live' | 'manual' | 'actual_only'
  description: string
  plannedCents: number
  actualCents: number
  varianceCents: number
  variancePercent: number | null
  realizationPercent: number | null
  editable: boolean
  lineId: string | null
  feesCollectedCents?: number
  feesResidualCents?: number
}

export interface BudgetOverviewTotals {
  plannedIncomeCents: number
  plannedExpenseCents: number
  plannedSurplusCents: number
  actualIncomeCents: number
  actualExpenseCents: number
  actualReversalCents: number
  actualBalanceCents: number
  surplusVarianceCents: number
  incomeRealizationPercent: number | null
  expenseRealizationPercent: number | null
  /** Storni non attribuibili a un movimento originale. */
  unattributedReversalCents: number
}

export interface ConsuntivoFilterState {
  dateFrom: string
  dateTo: string
  accountId: string | 'all'
  categoryId: string | 'all'
  nature: ReceivableNature | 'all'
  direction: 'income' | 'expense' | 'all'
  status: MovementStatus | 'all'
}

export interface ConsuntivoMovementRow {
  id: string
  movement_date: string
  direction: MovementDirection
  status: MovementStatus
  amount_cents: number
  category_id: string | null
  account_id: string | null
  origin: MovementOrigin
  reverses_movement_id: string | null
  document_type: string | null
  document_number: string | null
  reference: string | null
  description: string
}

export interface ConsuntivoCategoryRow {
  categoryId: string | null
  categoryCode: string
  categoryName: string
  nature: ReceivableNature | 'unknown'
  incomeCents: number
  expenseCents: number
  balanceCents: number
  movementCount: number
  anomalies: string[]
}

export interface ConsuntivoBudgetCompareRow {
  key: string
  label: string
  categoryId: string | null
  direction: 'income' | 'expense' | 'total'
  plannedCents: number
  actualCents: number
  varianceCents: number
  realizationPercent: number | null
}

export interface ConsuntivoAccountRow {
  accountId: string | null
  accountCode: string
  accountName: string
  netPostedCents: number
  pendingAccountCents: number
  movementCountPosted: number
  movementCountPending: number
}

export interface ConsuntivoCompleteness {
  withoutCategory: number
  withoutAccount: number
  withoutDocument: number
  drafts: number
  pendingAccount: number
  unattributedReversals: number
  toClassifyCategories: number
  documentedCount: number
  documentableCount: number
  documentationPercent: number | null
}

export interface ConsuntivoKpis {
  incomeCents: number
  expenseCents: number
  surplusCents: number
  quoteResidualCents: number
  toVerifyCount: number
  documentationPercent: number | null
}

export interface ConsuntivoReport {
  kpis: ConsuntivoKpis
  categories: ConsuntivoCategoryRow[]
  budgetCompare: ConsuntivoBudgetCompareRow[]
  hasApprovedBudget: boolean
  accounts: ConsuntivoAccountRow[]
  completeness: ConsuntivoCompleteness
}
