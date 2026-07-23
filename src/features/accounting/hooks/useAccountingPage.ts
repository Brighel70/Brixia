import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  assignPendingAccount,
  cancelManualMovement,
  createManualTransfer,
  createManualMovement,
  fetchAccounts,
  fetchCategoriesIncludingInactiveWithMeta,
  fetchFiscalYears,
  fetchAllMovementsForExport,
  fetchMovementDetail,
  fetchMovementSummaryRows,
  fetchMovements,
  fetchPendingReviewCount,
  fetchReceivables,
  fetchResidualCreditsCents,
  mapSupabaseError,
  pickDefaultFiscalYear,
  processPendingSync,
  reconcileFeesPreview,
  reverseManualMovement,
  postManualMovement,
  updateManualMovement,
  updateManualTransfer
} from '../api/accounting.api'
import {
  closeFiscalYear,
  fetchFiscalYearClosingChecklist,
  openFiscalYear,
  reopenFiscalYear,
  startClosingFiscalYear
} from '../api/fiscalYear.api'
import {
  createOperationalDeadline,
  fetchAccountingAuditLog,
  fetchOperationalDeadlines,
  setOperationalDeadlineStatus,
  verifyManualMovement
} from '../api/fiscalProfile.api'
import { supabase } from '@/lib/supabaseClient'
import {
  approveBudget,
  archiveBudgetAndOpenNewDraft,
  createBudget,
  createBudgetLine,
  deleteBudgetLine,
  fetchActiveBudget,
  fetchBudgetLines,
  fetchFeesBudgetAggregate,
  fetchLatestBudgetVersion,
  fetchMovementCategoryActualRows,
  updateBudgetLine,
  updateBudgetNotes
} from '../api/budget.api'
import { fetchConsuntivoMovements } from '../api/consuntivo.api'
import {
  addReconciliationLine,
  cancelReconciliationSession,
  completeReconciliationSession,
  createReconciliationSession,
  excludeReconciliationLine,
  fetchBankStatementLines,
  fetchReconciliationCandidateMovements,
  fetchReconciliationSessions,
  fetchReconciliationSummary,
  importReconciliationCsv,
  matchReconciliationLine,
  unmatchReconciliationLine
} from '../api/reconciliation.api'
import {
  calculateVatPeriod,
  cancelCommercialDocument,
  countToClassifyMovements,
  createCommercialDocumentDraft,
  fetchCommercialDocuments,
  fetchCounterparties,
  fetchFiscalParams,
  fetchVatPeriods,
  issueCommercialDocument,
  linkCommercialMovement,
  markVatPeriodPaid,
  registerCommercialPayment,
  updateCommercialDocumentDraft,
  verifyVatPeriod
} from '../api/commercial.api'
import {
  confirmSponsorshipContract,
  createSponsorshipContract,
  fetchSponsorshipContractById,
  fetchSponsorshipContracts,
  reopenSponsorshipContractDraft,
  setCommercialDocumentPdfPath,
  setSponsorshipContractPdfPath,
  updateSponsorshipContractDraft
} from '../api/sponsorshipContracts.api'
import {
  commercialDocPdfStoragePath,
  contractPdfStoragePath,
  getAccountingDocSignedUrl,
  uploadAccountingPdf
} from '../api/accountingDocsStorage'
import {
  buildCommercialInvoiceBody,
  buildDocContext,
  buildSponsorshipContractBody,
  generateTextPdfBlob,
  reservePdfPreviewWindow
} from '../utils/documentTemplates'
import { computeAccountingSummary } from '../utils/summaryCalculations'
import { previewMovementsPdf } from '../utils/accountingReportsPdf'
import {
  buildBudgetComparison,
  computeActualCentsByCategory,
  computeBudgetOverviewTotals,
  findQuoteCategory,
  isQuoteCategoryId
} from '../utils/budgetCalculations'
import type {
  AccountingAccountRef,
  AccountingBudget,
  AccountingBudgetLine,
  AccountingCategoryRef,
  AccountingFiscalYear,
  AccountingMovement,
  AccountingMovementDetail,
  AccountingReceivable,
  AccountingSummary,
  AccountingTabId,
  AccountingBankStatementLine,
  AccountingReconciliationSession,
  AccountingReconciliationSummary,
  BudgetComparisonRow,
  BudgetOverviewTotals,
  ConsuntivoFilterState,
  ConsuntivoMovementRow,
  FeesBudgetAggregate,
  MovementsFilterState,
  ReceivablesFilterState,
  ReconcileFeesPreview,
  ReconciliationCandidateMovement,
  AccountingCounterpartyRef,
  AccountingCounterparty,
  AccountingFiscalParamRow,
  AccountingOperationalDeadline,
  AccountingAuditLogRow,
  CommercialDocument,
  CommercialVatOverview,
  DeadlineStatus,
  DeadlineType,
  FiscalYearClosingChecklist,
  SponsorshipContract,
  VatPeriod
} from '../types'
import { movementToFormValues, movementFormToPayload, type MovementFormValues } from '../utils/movementValidation'
import {
  transferMovementToFormValues,
  type TransferFormValues
} from '../components/TransferFormModal'
import type { MovementLifecycleRequest } from '../utils/movementLifecycle'
import type { BudgetLineFormValues } from '../components/BudgetLineFormModal'
import type { CommercialDocumentFormValues } from '../components/CommercialDocumentFormModal'
import type { SponsorshipContractFormValues } from '../components/SponsorshipContractFormModal'
import {
  archiveCounterparty,
  createCounterparty,
  fetchCounterpartiesFull,
  reactivateCounterparty,
  updateCounterparty,
  type CounterpartyWriteInput
} from '../api/counterparties.api'
import { ACCOUNTING_PAGE_SIZE } from '../constants'
import {
  buildCommercialVatOverview,
  computeGrossCents,
  computeVatAmountCents,
  percentToBasisPoints,
  quartersNeedingVatRecalc,
  resolveFiscalParamAtDate,
  VAT_PARAM_KEYS,
  vatPeriodFromDocumentDate
} from '../utils/vatCalculations'

async function attachCommercialPdf(
  documentId: string,
  fiscalYearId: string,
  bodyText: string,
  title: string
): Promise<void> {
  const blob = await generateTextPdfBlob(title || 'Documento commerciale', bodyText)
  const path = commercialDocPdfStoragePath(fiscalYearId, documentId)
  await uploadAccountingPdf(path, blob)
  await setCommercialDocumentPdfPath(documentId, path)
}

async function attachContractPdf(
  contractId: string,
  fiscalYearId: string,
  bodyText: string,
  title: string
): Promise<void> {
  const { parseContractBodyParts } = await import('../utils/sponsorshipContractTemplate')
  const parts = parseContractBodyParts(bodyText)
  const html = parts
    ? `${parts.contractHtml}<hr/>${parts.annexAHtml}<hr/>${parts.annexBCHtml}`
    : bodyText
  const blob = await generateTextPdfBlob(title || 'Contratto sponsor', html)
  const path = contractPdfStoragePath(fiscalYearId, contractId)
  await uploadAccountingPdf(path, blob)
  await setSponsorshipContractPdfPath(contractId, path)
}

const DEFAULT_MOVEMENT_FILTERS: MovementsFilterState = {
  search: '',
  dateFrom: '',
  dateTo: '',
  direction: 'all',
  status: 'all',
  accountId: 'all'
}

const DEFAULT_RECEIVABLE_FILTERS: ReceivablesFilterState = {
  search: '',
  status: 'all',
  dueFilter: 'all'
}

const DEFAULT_CONSUNTIVO_FILTERS: ConsuntivoFilterState = {
  dateFrom: '',
  dateTo: '',
  accountId: 'all',
  categoryId: 'all',
  nature: 'all',
  direction: 'all',
  status: 'all'
}

export function useAccountingPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const [fiscalYears, setFiscalYears] = useState<AccountingFiscalYear[]>([])
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<AccountingAccountRef[]>([])
  const [categories, setCategories] = useState<AccountingCategoryRef[]>([])

  const [activeTab, setActiveTab] = useState<AccountingTabId>('overview')
  const [summary, setSummary] = useState<AccountingSummary | null>(null)
  const [syncPreview, setSyncPreview] = useState<ReconcileFeesPreview | null>(null)
  const [syncPreviewAvailable, setSyncPreviewAvailable] = useState(false)

  const [movementFilters, setMovementFilters] =
    useState<MovementsFilterState>(DEFAULT_MOVEMENT_FILTERS)
  const [movements, setMovements] = useState<AccountingMovement[]>([])
  const [movementsTotal, setMovementsTotal] = useState(0)
  const [movementsPage, setMovementsPage] = useState(1)
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [movementsError, setMovementsError] = useState<string | null>(null)

  const [receivableFilters, setReceivableFilters] =
    useState<ReceivablesFilterState>(DEFAULT_RECEIVABLE_FILTERS)
  const [receivables, setReceivables] = useState<AccountingReceivable[]>([])
  const [receivablesTotal, setReceivablesTotal] = useState(0)
  const [receivablesPage, setReceivablesPage] = useState(1)
  const [receivablesLoading, setReceivablesLoading] = useState(false)
  const [receivablesError, setReceivablesError] = useState<string | null>(null)

  const [syncLoading, setSyncLoading] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [retryLoading, setRetryLoading] = useState(false)

  const [movementFormOpen, setMovementFormOpen] = useState(false)
  const [movementFormMode, setMovementFormMode] = useState<'create' | 'edit'>('create')
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null)
  const [movementFormInitial, setMovementFormInitial] = useState<Partial<MovementFormValues>>()
  const [movementSaving, setMovementSaving] = useState(false)
  const [movementsPdfGenerating, setMovementsPdfGenerating] = useState(false)

  const [transferFormOpen, setTransferFormOpen] = useState(false)
  const [transferFormMode, setTransferFormMode] = useState<'create' | 'edit'>('create')
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null)
  const [transferFormInitial, setTransferFormInitial] = useState<Partial<TransferFormValues>>()
  const [transferSaving, setTransferSaving] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailMovementId, setDetailMovementId] = useState<string | null>(null)
  const [detailMovement, setDetailMovement] = useState<AccountingMovementDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [lifecycleSaving, setLifecycleSaving] = useState(false)

  const [budget, setBudget] = useState<AccountingBudget | null>(null)
  const [budgetLines, setBudgetLines] = useState<AccountingBudgetLine[]>([])
  const [budgetComparison, setBudgetComparison] = useState<BudgetComparisonRow[]>([])
  const [budgetTotals, setBudgetTotals] = useState<BudgetOverviewTotals | null>(null)
  const [budgetLoading, setBudgetLoading] = useState(false)
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const [budgetSaving, setBudgetSaving] = useState(false)

  const [consuntivoFilters, setConsuntivoFilters] =
    useState<ConsuntivoFilterState>(DEFAULT_CONSUNTIVO_FILTERS)
  const [consuntivoMovements, setConsuntivoMovements] = useState<ConsuntivoMovementRow[]>([])
  const [consuntivoBudgetLines, setConsuntivoBudgetLines] = useState<AccountingBudgetLine[]>([])
  const [consuntivoHasActiveBudget, setConsuntivoHasActiveBudget] = useState(false)
  const [consuntivoFees, setConsuntivoFees] = useState<FeesBudgetAggregate | null>(null)
  const [consuntivoLoading, setConsuntivoLoading] = useState(false)
  const [consuntivoError, setConsuntivoError] = useState<string | null>(null)

  const [reconciliationSessions, setReconciliationSessions] = useState<
    AccountingReconciliationSession[]
  >([])
  const [selectedReconciliationSessionId, setSelectedReconciliationSessionId] = useState<
    string | null
  >(null)
  const [reconciliationLines, setReconciliationLines] = useState<AccountingBankStatementLine[]>(
    []
  )
  const [reconciliationSummary, setReconciliationSummary] =
    useState<AccountingReconciliationSummary | null>(null)
  const [reconciliationCandidates, setReconciliationCandidates] = useState<
    ReconciliationCandidateMovement[]
  >([])
  const [reconciliationLoading, setReconciliationLoading] = useState(false)
  const [reconciliationSaving, setReconciliationSaving] = useState(false)
  const [reconciliationError, setReconciliationError] = useState<string | null>(null)
  const selectedReconciliationSessionIdRef = useRef<string | null>(null)
  selectedReconciliationSessionIdRef.current = selectedReconciliationSessionId

  const [vatDocuments, setVatDocuments] = useState<CommercialDocument[]>([])
  const [vatPeriods, setVatPeriods] = useState<VatPeriod[]>([])
  const [vatCounterparties, setVatCounterparties] = useState<AccountingCounterpartyRef[]>([])
  const [vatFiscalParams, setVatFiscalParams] = useState<AccountingFiscalParamRow[]>([])
  const [vatOverview, setVatOverview] = useState<CommercialVatOverview | null>(null)
  const [vatLoading, setVatLoading] = useState(false)
  const [vatError, setVatError] = useState<string | null>(null)
  const [vatSaving, setVatSaving] = useState(false)
  const [sponsorshipContracts, setSponsorshipContracts] = useState<SponsorshipContract[]>([])

  const [counterpartiesRows, setCounterpartiesRows] = useState<AccountingCounterparty[]>([])
  const [counterpartiesLoading, setCounterpartiesLoading] = useState(false)
  const [counterpartiesError, setCounterpartiesError] = useState<string | null>(null)
  const [counterpartiesSaving, setCounterpartiesSaving] = useState(false)

  const [closingChecklist, setClosingChecklist] = useState<FiscalYearClosingChecklist | null>(null)
  const [closingChecklistLoading, setClosingChecklistLoading] = useState(false)

  const [deadlines, setDeadlines] = useState<AccountingOperationalDeadline[]>([])
  const [deadlinesLoading, setDeadlinesLoading] = useState(false)

  const [auditRows, setAuditRows] = useState<AccountingAuditLogRow[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)

  const [movementApprovalMode, setMovementApprovalMode] = useState<
    'simple' | 'verify_then_post'
  >('simple')

  const selectedFiscalYear = useMemo(
    () => fiscalYears.find((y) => y.id === selectedFiscalYearId) ?? null,
    [fiscalYears, selectedFiscalYearId]
  )

  const loadCoreData = useCallback(async (fiscalYearId: string) => {
    const [movementRows, residualCreditsCents, pendingReviewCount, preview] = await Promise.all([
      fetchMovementSummaryRows(fiscalYearId),
      fetchResidualCreditsCents(fiscalYearId),
      fetchPendingReviewCount(fiscalYearId),
      reconcileFeesPreview().catch(() => null)
    ])

    setSummary(
      computeAccountingSummary(movementRows, residualCreditsCents, pendingReviewCount)
    )
    setSyncPreview(preview)
    setSyncPreviewAvailable(preview !== null)
    setLastUpdatedAt(new Date())
  }, [])

  const loadMovements = useCallback(async () => {
    if (!selectedFiscalYearId) return
    setMovementsLoading(true)
    setMovementsError(null)
    try {
      const result = await fetchMovements({
        fiscalYearId: selectedFiscalYearId,
        ...movementFilters,
        page: movementsPage,
        pageSize: ACCOUNTING_PAGE_SIZE
      })
      setMovements(result.rows)
      setMovementsTotal(result.total)
    } catch (err) {
      setMovementsError(err instanceof Error ? err.message : 'Errore caricamento movimenti')
    } finally {
      setMovementsLoading(false)
    }
  }, [selectedFiscalYearId, movementFilters, movementsPage])

  const generateMovementsPdfAction = useCallback(async () => {
    if (!selectedFiscalYearId || !selectedFiscalYear) {
      throw new Error('Seleziona un esercizio contabile prima di generare il PDF.')
    }
    const previewWindow = reservePdfPreviewWindow()
    setMovementsPdfGenerating(true)
    try {
      const rows = await fetchAllMovementsForExport({
        fiscalYearId: selectedFiscalYearId,
        ...movementFilters
      })
      await previewMovementsPdf({
        fiscalYear: selectedFiscalYear,
        filters: movementFilters,
        movements: rows,
        summary,
        previewWindow
      })
    } catch (err) {
      if (previewWindow && !previewWindow.closed) previewWindow.close()
      throw err
    } finally {
      setMovementsPdfGenerating(false)
    }
  }, [selectedFiscalYear, selectedFiscalYearId, movementFilters, summary])

  const loadReceivables = useCallback(async () => {
    if (!selectedFiscalYearId) return
    setReceivablesLoading(true)
    setReceivablesError(null)
    try {
      const result = await fetchReceivables({
        fiscalYearId: selectedFiscalYearId,
        ...receivableFilters,
        page: receivablesPage,
        pageSize: ACCOUNTING_PAGE_SIZE
      })
      setReceivables(result.rows)
      setReceivablesTotal(result.total)
    } catch (err) {
      setReceivablesError(
        err instanceof Error ? err.message : 'Errore caricamento crediti'
      )
    } finally {
      setReceivablesLoading(false)
    }
  }, [selectedFiscalYearId, receivableFilters, receivablesPage])

  const loadBudget = useCallback(async () => {
    if (!selectedFiscalYearId) return
    setBudgetLoading(true)
    setBudgetError(null)
    try {
      const [active, fees, actualRows, movementRows] = await Promise.all([
        fetchActiveBudget(selectedFiscalYearId),
        fetchFeesBudgetAggregate(selectedFiscalYearId, categories),
        fetchMovementCategoryActualRows(selectedFiscalYearId),
        fetchMovementSummaryRows(selectedFiscalYearId)
      ])

      let lines: AccountingBudgetLine[] = []
      if (active) {
        lines = await fetchBudgetLines(active.id)
      }

      const { byCategory: actualsByCategory, unattributedReversalCents } =
        computeActualCentsByCategory(actualRows)
      const quoteCategory = findQuoteCategory(categories)
      const comparison = buildBudgetComparison({
        lines,
        fees,
        quoteCategory,
        actualsByCategory,
        categories
      })
      const summaryLike = computeAccountingSummary(movementRows, 0, 0)
      const totals = computeBudgetOverviewTotals({
        comparisonRows: comparison,
        actualIncomeCents: summaryLike.incomeCents,
        actualExpenseCents: summaryLike.expenseCents,
        actualReversalCents: summaryLike.reversalCents,
        actualBalanceCents: summaryLike.balanceCents,
        unattributedReversalCents
      })

      setBudget(active)
      setBudgetLines(lines)
      setBudgetComparison(comparison)
      setBudgetTotals(totals)
    } catch (err) {
      setBudgetError(mapSupabaseError(err))
      setBudget(null)
      setBudgetLines([])
      setBudgetComparison([])
      setBudgetTotals(null)
    } finally {
      setBudgetLoading(false)
    }
  }, [selectedFiscalYearId, categories])

  const loadConsuntivo = useCallback(async () => {
    if (!selectedFiscalYearId) return
    setConsuntivoLoading(true)
    setConsuntivoError(null)
    try {
      const [movementRows, activeBudget, fees] = await Promise.all([
        fetchConsuntivoMovements(selectedFiscalYearId),
        fetchActiveBudget(selectedFiscalYearId),
        fetchFeesBudgetAggregate(selectedFiscalYearId, categories)
      ])

      let lines: AccountingBudgetLine[] = []
      if (activeBudget) {
        lines = await fetchBudgetLines(activeBudget.id)
      }

      setConsuntivoMovements(movementRows)
      setConsuntivoHasActiveBudget(!!activeBudget)
      setConsuntivoBudgetLines(lines)
      setConsuntivoFees(fees)
    } catch (err) {
      setConsuntivoError(mapSupabaseError(err))
      setConsuntivoMovements([])
      setConsuntivoHasActiveBudget(false)
      setConsuntivoBudgetLines([])
      setConsuntivoFees(null)
    } finally {
      setConsuntivoLoading(false)
    }
  }, [selectedFiscalYearId, categories])

  const loadReconciliationSessionDetail = useCallback(async (session: AccountingReconciliationSession) => {
    const [lines, summary] = await Promise.all([
      fetchBankStatementLines(session.id),
      fetchReconciliationSummary(session.id)
    ])
    const matchedIds = lines
      .map((l) => l.matched_movement_id)
      .filter((id): id is string => !!id)
    const candidates = await fetchReconciliationCandidateMovements({
      fiscalYearId: session.fiscal_year_id,
      accountId: session.account_id,
      periodStart: session.period_start,
      periodEnd: session.period_end,
      excludeMovementIds: matchedIds
    })
    setReconciliationLines(lines)
    setReconciliationSummary(summary)
    setReconciliationCandidates(candidates)
  }, [])

  const loadReconciliation = useCallback(async () => {
    if (!selectedFiscalYearId) return
    setReconciliationLoading(true)
    setReconciliationError(null)
    try {
      const sessions = await fetchReconciliationSessions(selectedFiscalYearId)
      setReconciliationSessions(sessions)

      const currentId = selectedReconciliationSessionIdRef.current
      const stillSelected = currentId
        ? sessions.find((s) => s.id === currentId) ?? null
        : null

      if (!stillSelected) {
        setSelectedReconciliationSessionId(null)
        setReconciliationLines([])
        setReconciliationSummary(null)
        setReconciliationCandidates([])
      } else {
        await loadReconciliationSessionDetail(stillSelected)
      }
    } catch (err) {
      setReconciliationError(mapSupabaseError(err))
      setReconciliationSessions([])
      setReconciliationLines([])
      setReconciliationSummary(null)
      setReconciliationCandidates([])
    } finally {
      setReconciliationLoading(false)
    }
  }, [selectedFiscalYearId, loadReconciliationSessionDetail])

  const selectReconciliationSession = useCallback(
    async (sessionId: string | null) => {
      setSelectedReconciliationSessionId(sessionId)
      if (!sessionId) {
        setReconciliationLines([])
        setReconciliationSummary(null)
        setReconciliationCandidates([])
        return
      }
      const session = reconciliationSessions.find((s) => s.id === sessionId)
      if (!session) return
      setReconciliationLoading(true)
      setReconciliationError(null)
      try {
        await loadReconciliationSessionDetail(session)
      } catch (err) {
        setReconciliationError(mapSupabaseError(err))
        setReconciliationLines([])
        setReconciliationSummary(null)
        setReconciliationCandidates([])
      } finally {
        setReconciliationLoading(false)
      }
    },
    [reconciliationSessions, loadReconciliationSessionDetail]
  )

  const refreshSelectedReconciliationDetail = useCallback(async () => {
    if (!selectedReconciliationSessionId) return
    const session =
      reconciliationSessions.find((s) => s.id === selectedReconciliationSessionId) ??
      (await fetchReconciliationSessions(selectedFiscalYearId!)).find(
        (s) => s.id === selectedReconciliationSessionId
      )
    if (!session) return
    await loadReconciliationSessionDetail(session)
  }, [
    selectedReconciliationSessionId,
    reconciliationSessions,
    selectedFiscalYearId,
    loadReconciliationSessionDetail
  ])

  const createReconciliationSessionAction = useCallback(
    async (input: {
      accountId: string
      periodStart: string
      periodEnd: string
      openingBalanceCents: number
      closingBalanceStatementCents: number
      notes: string | null
    }) => {
      if (!selectedFiscalYearId) throw new Error('Seleziona un esercizio')
      setReconciliationSaving(true)
      setReconciliationError(null)
      try {
        const id = await createReconciliationSession({
          fiscalYearId: selectedFiscalYearId,
          accountId: input.accountId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          openingBalanceCents: input.openingBalanceCents,
          closingBalanceStatementCents: input.closingBalanceStatementCents,
          notes: input.notes
        })
        const sessions = await fetchReconciliationSessions(selectedFiscalYearId)
        setReconciliationSessions(sessions)
        setSelectedReconciliationSessionId(id)
        const created = sessions.find((s) => s.id === id)
        if (created) await loadReconciliationSessionDetail(created)
      } catch (err) {
        setReconciliationError(mapSupabaseError(err))
        throw err
      } finally {
        setReconciliationSaving(false)
      }
    },
    [selectedFiscalYearId, loadReconciliationSessionDetail]
  )

  const addReconciliationLineAction = useCallback(
    async (input: {
      lineDate: string
      amountCents: number
      description: string
      reference: string | null
      externalId: string | null
    }) => {
      if (!selectedReconciliationSessionId) throw new Error('Nessuna sessione selezionata')
      setReconciliationSaving(true)
      setReconciliationError(null)
      try {
        await addReconciliationLine({
          sessionId: selectedReconciliationSessionId,
          lineDate: input.lineDate,
          amountCents: input.amountCents,
          description: input.description,
          reference: input.reference,
          externalId: input.externalId
        })
        await loadReconciliation()
      } catch (err) {
        setReconciliationError(mapSupabaseError(err))
        throw err
      } finally {
        setReconciliationSaving(false)
      }
    },
    [selectedReconciliationSessionId, loadReconciliation]
  )

  const importReconciliationCsvAction = useCallback(
    async (csv: string) => {
      if (!selectedReconciliationSessionId) throw new Error('Nessuna sessione selezionata')
      setReconciliationSaving(true)
      setReconciliationError(null)
      try {
        const result = await importReconciliationCsv(selectedReconciliationSessionId, csv)
        await loadReconciliation()
        return result
      } catch (err) {
        setReconciliationError(mapSupabaseError(err))
        throw err
      } finally {
        setReconciliationSaving(false)
      }
    },
    [selectedReconciliationSessionId, loadReconciliation]
  )

  const matchReconciliationLineAction = useCallback(
    async (lineId: string, movementId: string) => {
      setReconciliationSaving(true)
      setReconciliationError(null)
      try {
        await matchReconciliationLine(lineId, movementId)
        await refreshSelectedReconciliationDetail()
        if (selectedFiscalYearId) {
          const sessions = await fetchReconciliationSessions(selectedFiscalYearId)
          setReconciliationSessions(sessions)
        }
      } catch (err) {
        setReconciliationError(mapSupabaseError(err))
        throw err
      } finally {
        setReconciliationSaving(false)
      }
    },
    [refreshSelectedReconciliationDetail, selectedFiscalYearId]
  )

  const unmatchReconciliationLineAction = useCallback(
    async (lineId: string) => {
      setReconciliationSaving(true)
      setReconciliationError(null)
      try {
        await unmatchReconciliationLine(lineId)
        await refreshSelectedReconciliationDetail()
      } catch (err) {
        setReconciliationError(mapSupabaseError(err))
        throw err
      } finally {
        setReconciliationSaving(false)
      }
    },
    [refreshSelectedReconciliationDetail]
  )

  const excludeReconciliationLineAction = useCallback(
    async (lineId: string, reason: string) => {
      setReconciliationSaving(true)
      setReconciliationError(null)
      try {
        await excludeReconciliationLine(lineId, reason)
        await refreshSelectedReconciliationDetail()
      } catch (err) {
        setReconciliationError(mapSupabaseError(err))
        throw err
      } finally {
        setReconciliationSaving(false)
      }
    },
    [refreshSelectedReconciliationDetail]
  )

  const completeReconciliationSessionAction = useCallback(async () => {
    if (!selectedReconciliationSessionId) throw new Error('Nessuna sessione selezionata')
    setReconciliationSaving(true)
    setReconciliationError(null)
    try {
      await completeReconciliationSession(selectedReconciliationSessionId)
      await loadReconciliation()
    } catch (err) {
      setReconciliationError(mapSupabaseError(err))
      throw err
    } finally {
      setReconciliationSaving(false)
    }
  }, [selectedReconciliationSessionId, loadReconciliation])

  const cancelReconciliationSessionAction = useCallback(
    async (reason: string | null) => {
      if (!selectedReconciliationSessionId) throw new Error('Nessuna sessione selezionata')
      setReconciliationSaving(true)
      setReconciliationError(null)
      try {
        await cancelReconciliationSession(selectedReconciliationSessionId, reason)
        await loadReconciliation()
      } catch (err) {
        setReconciliationError(mapSupabaseError(err))
        throw err
      } finally {
        setReconciliationSaving(false)
      }
    },
    [selectedReconciliationSessionId, loadReconciliation]
  )

  const loadVatSponsor = useCallback(async () => {
    if (!selectedFiscalYearId) return
    setVatLoading(true)
    setVatError(null)
    try {
      let [docs, periods, counterparties, params, toClassifyMovements, contracts] =
        await Promise.all([
          fetchCommercialDocuments(selectedFiscalYearId),
          fetchVatPeriods(selectedFiscalYearId),
          fetchCounterparties(),
          fetchFiscalParams(),
          countToClassifyMovements(selectedFiscalYearId),
          fetchSponsorshipContracts(selectedFiscalYearId).catch(() => [] as SponsorshipContract[])
        ])

      // Se i documenti emessi non coincidono col trimestre salvato (es. emesso dopo un
      // "Calcola" a zero), riallinea automaticamente i periodi open/calculated.
      const stale = quartersNeedingVatRecalc(docs, periods)
      if (stale.length > 0) {
        for (const { year, quarter } of stale) {
          try {
            await calculateVatPeriod({
              fiscalYearId: selectedFiscalYearId,
              year,
              quarter
            })
          } catch (calcErr) {
            console.warn('Riallineamento trimestre IVA non riuscito', { year, quarter, calcErr })
          }
        }
        periods = await fetchVatPeriods(selectedFiscalYearId)
      }

      const fy = fiscalYears.find((y) => y.id === selectedFiscalYearId)
      const asOf = fy?.ends_on ?? new Date().toISOString().slice(0, 10)
      setVatDocuments(docs)
      setVatPeriods(periods)
      setVatCounterparties(counterparties)
      setSponsorshipContracts(contracts)
      setVatFiscalParams(params)
      setVatOverview(
        buildCommercialVatOverview({
          documents: docs,
          fiscalParams: params,
          asOfDate: asOf,
          toClassifyMovements
        })
      )
    } catch (err) {
      setVatError(mapSupabaseError(err))
      setVatDocuments([])
      setVatPeriods([])
      setSponsorshipContracts([])
      setVatOverview(null)
    } finally {
      setVatLoading(false)
    }
  }, [selectedFiscalYearId, fiscalYears])

  const loadCounterparties = useCallback(async () => {
    setCounterpartiesLoading(true)
    setCounterpartiesError(null)
    try {
      const rows = await fetchCounterpartiesFull({ includeArchived: true })
      setCounterpartiesRows(rows)
    } catch (err) {
      setCounterpartiesError(mapSupabaseError(err))
      setCounterpartiesRows([])
    } finally {
      setCounterpartiesLoading(false)
    }
  }, [])

  const loadClosingChecklist = useCallback(async () => {
    if (!selectedFiscalYearId) {
      setClosingChecklist(null)
      return
    }
    setClosingChecklistLoading(true)
    try {
      const checklist = await fetchFiscalYearClosingChecklist(selectedFiscalYearId)
      setClosingChecklist(checklist)
    } catch (err) {
      console.warn('Checklist chiusura esercizio non disponibile', err)
      setClosingChecklist(null)
    } finally {
      setClosingChecklistLoading(false)
    }
  }, [selectedFiscalYearId])

  const loadDeadlines = useCallback(async () => {
    if (!selectedFiscalYearId) {
      setDeadlines([])
      return
    }
    setDeadlinesLoading(true)
    try {
      const rows = await fetchOperationalDeadlines(selectedFiscalYearId)
      setDeadlines(rows)
    } catch (err) {
      console.warn('Scadenze operative non disponibili', err)
      setDeadlines([])
    } finally {
      setDeadlinesLoading(false)
    }
  }, [selectedFiscalYearId])

  const loadAudit = useCallback(async () => {
    setAuditLoading(true)
    setAuditError(null)
    try {
      const rows = await fetchAccountingAuditLog({ limit: 100 })
      setAuditRows(rows as AccountingAuditLogRow[])
    } catch (err) {
      setAuditError(mapSupabaseError(err))
      setAuditRows([])
    } finally {
      setAuditLoading(false)
    }
  }, [])

  const loadMovementApprovalMode = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data, error } = await db
        .from('accounting_settings')
        .select('movement_approval_mode')
        .eq('singleton_guard', true)
        .maybeSingle()
      if (error) throw error
      const mode = data?.movement_approval_mode
      if (mode === 'simple' || mode === 'verify_then_post') {
        setMovementApprovalMode(mode)
      }
    } catch {
      // optional: keep default simple
    }
  }, [])

  const refreshFiscalYears = useCallback(async () => {
    const years = await fetchFiscalYears()
    setFiscalYears(years)
    return years
  }, [])

  const openFiscalYearAction = useCallback(async () => {
    if (!selectedFiscalYearId) throw new Error('Seleziona un esercizio')
    await openFiscalYear(selectedFiscalYearId)
    await refreshFiscalYears()
    await loadClosingChecklist()
    await loadCoreData(selectedFiscalYearId)
  }, [selectedFiscalYearId, refreshFiscalYears, loadClosingChecklist, loadCoreData])

  const startClosingAction = useCallback(async () => {
    if (!selectedFiscalYearId) throw new Error('Seleziona un esercizio')
    const checklist = await startClosingFiscalYear(selectedFiscalYearId)
    setClosingChecklist(checklist)
    await refreshFiscalYears()
  }, [selectedFiscalYearId, refreshFiscalYears])

  const closeFiscalYearAction = useCallback(async () => {
    if (!selectedFiscalYearId) throw new Error('Seleziona un esercizio')
    await closeFiscalYear(selectedFiscalYearId)
    await refreshFiscalYears()
    await loadClosingChecklist()
  }, [selectedFiscalYearId, refreshFiscalYears, loadClosingChecklist])

  const reopenFiscalYearAction = useCallback(
    async (reason: string) => {
      if (!selectedFiscalYearId) throw new Error('Seleziona un esercizio')
      await reopenFiscalYear(selectedFiscalYearId, reason)
      await refreshFiscalYears()
      await loadClosingChecklist()
      await loadCoreData(selectedFiscalYearId)
    },
    [selectedFiscalYearId, refreshFiscalYears, loadClosingChecklist, loadCoreData]
  )

  const createDeadlineAction = useCallback(
    async (input: {
      title: string
      dueOn: string
      deadlineType: DeadlineType
      notes: string | null
    }) => {
      if (!selectedFiscalYearId) throw new Error('Seleziona un esercizio')
      await createOperationalDeadline({
        title: input.title,
        dueOn: input.dueOn,
        deadlineType: input.deadlineType,
        fiscalYearId: selectedFiscalYearId,
        notes: input.notes
      })
      await loadDeadlines()
    },
    [selectedFiscalYearId, loadDeadlines]
  )

  const setDeadlineStatusAction = useCallback(
    async (id: string, status: DeadlineStatus) => {
      await setOperationalDeadlineStatus(id, status)
      await loadDeadlines()
    },
    [loadDeadlines]
  )

  const init = useCallback(async () => {
    setLoading(true)
    setError(null)
    setCategoriesError(null)
    try {
      // Anni e conti: non devono dipendere dallo schema categorie (019).
      const [years, accountRows] = await Promise.all([fetchFiscalYears(), fetchAccounts()])
      setFiscalYears(years)
      setAccounts(accountRows)

      try {
        const { rows: categoryRows, usedLegacySchema } =
          await fetchCategoriesIncludingInactiveWithMeta()
        setCategories(categoryRows)
        if (usedLegacySchema) {
          setCategoriesError(
            'Impostazioni categorie non disponibili: manca la migration 019_accounting_category_settings (colonne group_id / available_in_*). Contabilità usabile in modalità ridotta; applicare 019 per sbloccare gruppi e filtri.'
          )
        } else {
          setCategoriesError(null)
        }
      } catch (catErr) {
        setCategories([])
        setCategoriesError(
          mapSupabaseError(catErr) ||
            'Errore caricamento categorie. Gli esercizi restano disponibili.'
        )
      }

      const defaultYear = pickDefaultFiscalYear(years)
      if (!defaultYear) {
        setSelectedFiscalYearId(null)
        setSummary(null)
        setSyncPreview(null)
        setSyncPreviewAvailable(false)
        setLastUpdatedAt(new Date())
        return
      }
      setSelectedFiscalYearId(defaultYear.id)
      try {
        await loadCoreData(defaultYear.id)
      } catch (coreErr) {
        setError(mapSupabaseError(coreErr) || 'Errore caricamento riepilogo Contabilità')
      }
    } catch (err) {
      // Solo errori su fiscal years / accounts bloccano l’header.
      setError(mapSupabaseError(err) || 'Errore caricamento esercizi Contabilità')
    } finally {
      setLoading(false)
    }
  }, [loadCoreData])

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    if (!selectedFiscalYearId || activeTab !== 'movements') return
    void loadMovements()
  }, [selectedFiscalYearId, activeTab, movementFilters, movementsPage, loadMovements])

  useEffect(() => {
    if (!selectedFiscalYearId || activeTab !== 'receivables') return
    void loadReceivables()
  }, [selectedFiscalYearId, activeTab, receivableFilters, receivablesPage, loadReceivables])

  useEffect(() => {
    if (!selectedFiscalYearId || activeTab !== 'budget') return
    void loadBudget()
  }, [selectedFiscalYearId, activeTab, loadBudget])

  useEffect(() => {
    if (!selectedFiscalYearId || activeTab !== 'consuntivo') return
    void loadConsuntivo()
  }, [selectedFiscalYearId, activeTab, loadConsuntivo])

  useEffect(() => {
    if (!selectedFiscalYearId || activeTab !== 'reconciliation') return
    void loadReconciliation()
  }, [selectedFiscalYearId, activeTab, loadReconciliation])

  useEffect(() => {
    if (!selectedFiscalYearId || activeTab !== 'vat_sponsor') return
    void loadVatSponsor()
  }, [selectedFiscalYearId, activeTab, loadVatSponsor])

  useEffect(() => {
    if (activeTab !== 'counterparties') return
    void loadCounterparties()
  }, [activeTab, loadCounterparties])

  useEffect(() => {
    if (!selectedFiscalYearId) {
      setClosingChecklist(null)
      return
    }
    void loadClosingChecklist()
  }, [selectedFiscalYearId, loadClosingChecklist])

  useEffect(() => {
    if (!selectedFiscalYearId || activeTab !== 'deadlines') return
    void loadDeadlines()
  }, [selectedFiscalYearId, activeTab, loadDeadlines])

  useEffect(() => {
    if (activeTab !== 'audit') return
    void loadAudit()
  }, [activeTab, loadAudit])

  useEffect(() => {
    void loadMovementApprovalMode()
  }, [loadMovementApprovalMode])

  const refresh = useCallback(async () => {
    if (!selectedFiscalYearId) return
    setRefreshing(true)
    setError(null)
    try {
      await loadCoreData(selectedFiscalYearId)
      if (activeTab === 'movements') await loadMovements()
      if (activeTab === 'receivables') await loadReceivables()
      if (activeTab === 'budget') await loadBudget()
      if (activeTab === 'consuntivo') await loadConsuntivo()
      if (activeTab === 'reconciliation') await loadReconciliation()
      if (activeTab === 'vat_sponsor') await loadVatSponsor()
      if (activeTab === 'counterparties') await loadCounterparties()
      if (activeTab === 'deadlines') await loadDeadlines()
      if (activeTab === 'audit') await loadAudit()
      await loadClosingChecklist()
      if (activeTab === 'sync') {
        const preview = await reconcileFeesPreview()
        setSyncPreview(preview)
        setSyncPreviewAvailable(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornamento')
    } finally {
      setRefreshing(false)
    }
  }, [
    selectedFiscalYearId,
    activeTab,
    loadCoreData,
    loadMovements,
    loadReceivables,
    loadBudget,
    loadConsuntivo,
    loadReconciliation,
    loadVatSponsor,
    loadCounterparties,
    loadDeadlines,
    loadAudit,
    loadClosingChecklist
  ])

  const changeFiscalYear = useCallback(
    async (fiscalYearId: string) => {
      setSelectedFiscalYearId(fiscalYearId)
      setMovementsPage(1)
      setReceivablesPage(1)
      setConsuntivoFilters(DEFAULT_CONSUNTIVO_FILTERS)
      setRefreshing(true)
      setError(null)
      try {
        await loadCoreData(fiscalYearId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore cambio esercizio')
      } finally {
        setRefreshing(false)
      }
    },
    [loadCoreData]
  )

  const loadSyncPreview = useCallback(async () => {
    setSyncLoading(true)
    setSyncError(null)
    try {
      const preview = await reconcileFeesPreview()
      setSyncPreview(preview)
      setSyncPreviewAvailable(true)
    } catch (err) {
      setSyncPreview(null)
      setSyncPreviewAvailable(false)
      setSyncError(err instanceof Error ? err.message : 'Errore verifica sincronizzazione')
    } finally {
      setSyncLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'sync' && !syncPreview && !syncLoading) {
      void loadSyncPreview()
    }
  }, [activeTab, syncPreview, syncLoading, loadSyncPreview])

  const retrySync = useCallback(async () => {
    setRetryLoading(true)
    setSyncError(null)
    try {
      const result = await processPendingSync(200)
      const preview = await reconcileFeesPreview()
      setSyncPreview(preview)
      setSyncPreviewAvailable(true)
      if (selectedFiscalYearId) {
        await loadCoreData(selectedFiscalYearId)
      }
      return result
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Errore riprova sincronizzazione')
      throw err
    } finally {
      setRetryLoading(false)
    }
  }, [selectedFiscalYearId, loadCoreData])

  const reloadAfterMovementChange = useCallback(async () => {
    if (!selectedFiscalYearId) return
    await loadCoreData(selectedFiscalYearId)
    if (activeTab === 'movements') await loadMovements()
  }, [selectedFiscalYearId, activeTab, loadCoreData, loadMovements])

  const openCreateMovement = useCallback(() => {
    setMovementFormMode('create')
    setEditingMovementId(null)
    setMovementFormInitial(undefined)
    setMovementFormOpen(true)
  }, [])

  const openEditMovement = useCallback(async (movementId: string) => {
    setDetailOpen(false)
    setMovementFormMode('edit')
    setEditingMovementId(movementId)
    setMovementSaving(false)
    try {
      const detail = await fetchMovementDetail(movementId)
      setMovementFormInitial(movementToFormValues(detail))
      setMovementFormOpen(true)
    } catch (err) {
      setMovementsError(mapSupabaseError(err))
    }
  }, [])

  const closeMovementForm = useCallback(() => {
    if (movementSaving) return
    setMovementFormOpen(false)
    setEditingMovementId(null)
    setMovementFormInitial(undefined)
  }, [movementSaving])

  const openCreateTransfer = useCallback(() => {
    setTransferFormMode('create')
    setEditingTransferId(null)
    setTransferFormInitial(undefined)
    setTransferFormOpen(true)
  }, [])

  const openEditTransfer = useCallback(async (movementId: string) => {
    setDetailOpen(false)
    setTransferFormMode('edit')
    setEditingTransferId(movementId)
    setTransferSaving(false)
    try {
      const detail = await fetchMovementDetail(movementId)
      if (detail.direction !== 'transfer' || detail.origin !== 'manual') {
        throw new Error('Il movimento selezionato non e un giroconto manuale.')
      }
      setTransferFormInitial(transferMovementToFormValues(detail))
      setTransferFormOpen(true)
    } catch (err) {
      setMovementsError(mapSupabaseError(err))
    }
  }, [])

  const closeTransferForm = useCallback(() => {
    if (transferSaving) return
    setTransferFormOpen(false)
    setEditingTransferId(null)
    setTransferFormInitial(undefined)
  }, [transferSaving])

  const saveMovementForm = useCallback(
    async (values: MovementFormValues, amountCents: number) => {
      if (!selectedFiscalYearId) return
      setMovementSaving(true)
      try {
        const docPayload = movementFormToPayload(values, accounts)
        const payload = {
          type: values.type,
          movementDate: values.movementDate,
          settlementDate: values.settlementDate || null,
          amountCents,
          accountId: values.accountId,
          categoryId: values.categoryId,
          description: values.description,
          paymentMethod: docPayload.paymentMethod ?? '',
          documentType: docPayload.documentType,
          documentNumber: docPayload.documentNumber,
          documentDate: docPayload.documentDate,
          reference: docPayload.reference,
          notes: values.notes || null
        }

        if (movementFormMode === 'create') {
          await createManualMovement({
            fiscalYearId: selectedFiscalYearId,
            ...payload
          })
        } else if (editingMovementId) {
          await updateManualMovement(editingMovementId, payload)
        }

        setMovementFormOpen(false)
        setEditingMovementId(null)
        setMovementFormInitial(undefined)
        await reloadAfterMovementChange()
      } catch (err) {
        throw new Error(mapSupabaseError(err))
      } finally {
        setMovementSaving(false)
      }
    },
    [
      selectedFiscalYearId,
      movementFormMode,
      editingMovementId,
      reloadAfterMovementChange,
      accounts
    ]
  )

  const saveTransferForm = useCallback(
    async (values: TransferFormValues, amountCents: number) => {
      if (!selectedFiscalYearId) return
      setTransferSaving(true)
      try {
        const payload = {
          movementDate: values.movementDate,
          settlementDate: values.settlementDate || null,
          amountCents,
          sourceAccountId: values.sourceAccountId,
          destinationAccountId: values.destinationAccountId,
          description: values.description,
          notes: values.notes || null
        }

        if (transferFormMode === 'create') {
          await createManualTransfer({ fiscalYearId: selectedFiscalYearId, ...payload })
        } else if (editingTransferId) {
          await updateManualTransfer(editingTransferId, payload)
        }

        setTransferFormOpen(false)
        setEditingTransferId(null)
        setTransferFormInitial(undefined)
        await reloadAfterMovementChange()
      } catch (err) {
        throw new Error(mapSupabaseError(err))
      } finally {
        setTransferSaving(false)
      }
    },
    [selectedFiscalYearId, transferFormMode, editingTransferId, reloadAfterMovementChange]
  )

  const openMovementDetail = useCallback(async (movement: AccountingMovement) => {
    setDetailOpen(true)
    setDetailMovementId(movement.id)
    setDetailMovement(null)
    setDetailLoading(true)
    setDetailError(null)
    try {
      const detail = await fetchMovementDetail(movement.id)
      setDetailMovement(detail)
    } catch (err) {
      setDetailError(mapSupabaseError(err))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const closeMovementDetail = useCallback(() => {
    setDetailOpen(false)
    setDetailMovementId(null)
    setDetailMovement(null)
    setDetailError(null)
  }, [])

  const runMovementLifecycleAction = useCallback(
    async (request: MovementLifecycleRequest) => {
      setLifecycleSaving(true)
      try {
        if (request.action === 'post') {
          await postManualMovement(request.movementId, request.overrideReason ?? null)
        } else if (request.action === 'verify') {
          await verifyManualMovement(request.movementId, request.reason ?? null)
        } else if (request.action === 'cancel') {
          await cancelManualMovement(request.movementId, request.reason ?? null)
        } else if (request.action === 'reverse') {
          await reverseManualMovement(
            request.movementId,
            request.movementDate ?? '',
            request.reason ?? ''
          )
        } else if (request.action === 'assign_account') {
          await assignPendingAccount(request.movementId, request.accountId ?? '')
        }

        closeMovementDetail()
        await reloadAfterMovementChange()
      } catch (err) {
        throw new Error(mapSupabaseError(err))
      } finally {
        setLifecycleSaving(false)
      }
    },
    [closeMovementDetail, reloadAfterMovementChange]
  )

  const verifyManualMovementAction = useCallback(
    async (movementId: string, note?: string | null) => {
      await runMovementLifecycleAction({
        action: 'verify',
        movementId,
        reason: note ?? undefined
      })
    },
    [runMovementLifecycleAction]
  )

  const resetMovementFilters = useCallback(() => {
    setMovementFilters(DEFAULT_MOVEMENT_FILTERS)
    setMovementsPage(1)
  }, [])

  const resetReceivableFilters = useCallback(() => {
    setReceivableFilters(DEFAULT_RECEIVABLE_FILTERS)
    setReceivablesPage(1)
  }, [])

  const resetConsuntivoFilters = useCallback(() => {
    setConsuntivoFilters(DEFAULT_CONSUNTIVO_FILTERS)
  }, [])

  const createCommercialDocumentAction = useCallback(
    async (values: CommercialDocumentFormValues, taxableCents: number) => {
      if (!selectedFiscalYearId) return
      setVatSaving(true)
      setVatError(null)
      try {
        const asOf = selectedFiscalYear?.ends_on ?? values.documentDate
        const rounding =
          resolveFiscalParamAtDate(vatFiscalParams, VAT_PARAM_KEYS.rounding, asOf)
            ?.value_json ?? 'half_up_cent'
        const roundingMethod =
          typeof rounding === 'string' ? rounding.replace(/^"|"$/g, '') : 'half_up_cent'
        const ratePct = Number(String(values.vatRatePercent).replace(',', '.'))
        const rateBp = percentToBasisPoints(ratePct)
        const cp = vatCounterparties.find((c) => c.id === values.counterpartyId)
        const body =
          values.draftBodyText?.trim() ||
          buildCommercialInvoiceBody(
            buildDocContext({
              counterparty: cp,
              documentNumber: values.documentNumber,
              documentDate: values.documentDate,
              description: values.description,
              taxableCents,
              vatRateBp: rateBp,
              grossCents: computeGrossCents(
                taxableCents,
                computeVatAmountCents(taxableCents, rateBp)
              )
            })
          )
        const created = await createCommercialDocumentDraft({
          fiscalYearId: selectedFiscalYearId,
          counterpartyId: values.counterpartyId,
          documentType: values.documentType,
          documentNumber: values.documentNumber || null,
          documentDate: values.documentDate,
          description: values.description,
          commercialKind: values.commercialKind,
          taxableAmountCents: taxableCents,
          vatRateBasisPoints: rateBp,
          includeIn398Limit: values.includeIn398Limit,
          notes: values.notes || null,
          roundingMethod,
          draftBodyText: body,
          sponsorshipContractId: values.sponsorshipContractId || null
        })
        if (values.markCollected && values.accountId) {
          await issueCommercialDocument(created.id)
          await attachCommercialPdf(created.id, selectedFiscalYearId, body, values.description)
          await registerCommercialPayment({
            documentId: created.id,
            accountId: values.accountId,
            allocatedAmountCents: created.gross_amount_cents,
            movementDate: values.documentDate
          })
          const { year, quarter } = vatPeriodFromDocumentDate(values.documentDate)
          try {
            await calculateVatPeriod({
              fiscalYearId: selectedFiscalYearId,
              year,
              quarter
            })
          } catch (calcErr) {
            console.warn('Ricalcolo trimestre IVA dopo emissione non riuscito', calcErr)
          }
        }
        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [selectedFiscalYearId, selectedFiscalYear, vatFiscalParams, vatCounterparties, loadVatSponsor]
  )

  const updateCommercialDocumentAction = useCallback(
    async (id: string, values: CommercialDocumentFormValues, taxableCents: number) => {
      setVatSaving(true)
      setVatError(null)
      try {
        const asOf = selectedFiscalYear?.ends_on ?? values.documentDate
        const rounding =
          resolveFiscalParamAtDate(vatFiscalParams, VAT_PARAM_KEYS.rounding, asOf)
            ?.value_json ?? 'half_up_cent'
        const roundingMethod =
          typeof rounding === 'string' ? rounding.replace(/^"|"$/g, '') : 'half_up_cent'
        const ratePct = Number(String(values.vatRatePercent).replace(',', '.'))
        await updateCommercialDocumentDraft(id, {
          counterpartyId: values.counterpartyId,
          documentType: values.documentType,
          documentNumber: values.documentNumber || null,
          documentDate: values.documentDate,
          description: values.description,
          commercialKind: values.commercialKind,
          taxableAmountCents: taxableCents,
          vatRateBasisPoints: percentToBasisPoints(ratePct),
          includeIn398Limit: values.includeIn398Limit,
          notes: values.notes || null,
          roundingMethod,
          draftBodyText: values.draftBodyText || null,
          sponsorshipContractId: values.sponsorshipContractId || null
        })
        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [selectedFiscalYear, vatFiscalParams, loadVatSponsor]
  )

  const issueCommercialDocumentAction = useCallback(
    async (id: string) => {
      setVatSaving(true)
      setVatError(null)
      try {
        const doc = vatDocuments.find((d) => d.id === id)
        await issueCommercialDocument(id)

        if (doc && selectedFiscalYearId) {
          const body =
            doc.draft_body_text?.trim() ||
            buildCommercialInvoiceBody(
              buildDocContext({
                counterparty: doc.counterparty,
                documentNumber: doc.document_number,
                documentDate: doc.document_date,
                description: doc.description,
                taxableCents: doc.taxable_amount_cents,
                vatRateBp: doc.vat_rate_basis_points,
                grossCents: doc.gross_amount_cents
              })
            )
          try {
            await attachCommercialPdf(
              id,
              selectedFiscalYearId,
              body,
              doc.description || 'Fattura'
            )
          } catch (pdfErr) {
            console.warn('PDF fattura non caricato dopo emissione', pdfErr)
          }
        }

        // Aggiorna subito la liquidazione del trimestre di competenza (document_date).
        if (doc?.document_date && selectedFiscalYearId) {
          const { year, quarter } = vatPeriodFromDocumentDate(doc.document_date)
          try {
            await calculateVatPeriod({
              fiscalYearId: selectedFiscalYearId,
              year,
              quarter
            })
          } catch (calcErr) {
            // Emissione ok: non bloccare se il ricalcolo fallisce (es. permessi view-only).
            console.warn('Ricalcolo trimestre IVA dopo emissione non riuscito', calcErr)
          }
        }

        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [loadVatSponsor, vatDocuments, selectedFiscalYearId]
  )

  const cancelCommercialDocumentAction = useCallback(
    async (id: string) => {
      setVatSaving(true)
      setVatError(null)
      try {
        const doc = vatDocuments.find((d) => d.id === id)
        await cancelCommercialDocument(id)

        if (doc?.document_date && selectedFiscalYearId && doc.status !== 'draft') {
          const { year, quarter } = vatPeriodFromDocumentDate(doc.document_date)
          try {
            await calculateVatPeriod({
              fiscalYearId: selectedFiscalYearId,
              year,
              quarter
            })
          } catch (calcErr) {
            console.warn('Ricalcolo trimestre IVA dopo annullamento non riuscito', calcErr)
          }
        }

        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [loadVatSponsor, vatDocuments, selectedFiscalYearId]
  )

  const collectCommercialDocumentAction = useCallback(
    async (id: string, accountId: string, allocatedAmountCents: number) => {
      setVatSaving(true)
      setVatError(null)
      try {
        await registerCommercialPayment({
          documentId: id,
          accountId,
          allocatedAmountCents
        })
        await loadVatSponsor()
        if (selectedFiscalYearId) await loadCoreData(selectedFiscalYearId)
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [loadVatSponsor, loadCoreData, selectedFiscalYearId]
  )

  const linkCommercialMovementAction = useCallback(
    async (documentId: string, movementId: string, allocatedAmountCents: number) => {
      setVatSaving(true)
      setVatError(null)
      try {
        await linkCommercialMovement({
          documentId,
          movementId,
          allocatedAmountCents
        })
        await loadVatSponsor()
        if (selectedFiscalYearId) await loadCoreData(selectedFiscalYearId)
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [loadVatSponsor, loadCoreData, selectedFiscalYearId]
  )

  const calculateVatPeriodAction = useCallback(
    async (year: number, quarter: number) => {
      if (!selectedFiscalYearId) return
      setVatSaving(true)
      setVatError(null)
      try {
        await calculateVatPeriod({
          fiscalYearId: selectedFiscalYearId,
          year,
          quarter
        })
        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [selectedFiscalYearId, loadVatSponsor]
  )

  const verifyVatPeriodAction = useCallback(
    async (id: string) => {
      setVatSaving(true)
      setVatError(null)
      try {
        await verifyVatPeriod(id)
        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [loadVatSponsor]
  )

  const markVatPeriodPaidAction = useCallback(
    async (id: string, paidAt: string, paymentReference: string) => {
      setVatSaving(true)
      setVatError(null)
      try {
        await markVatPeriodPaid({ id, paidAt, paymentReference })
        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [loadVatSponsor]
  )

  const createCounterpartyAction = useCallback(
    async (input: CounterpartyWriteInput) => {
      setCounterpartiesSaving(true)
      setCounterpartiesError(null)
      try {
        const created = await createCounterparty(input)
        await loadCounterparties()
        // Aggiorna anche il dropdown IVA se già caricato.
        if (activeTab === 'vat_sponsor' || vatCounterparties.length > 0) {
          await loadVatSponsor()
        }
        return created
      } catch (err) {
        setCounterpartiesError(mapSupabaseError(err))
        throw err
      } finally {
        setCounterpartiesSaving(false)
      }
    },
    [loadCounterparties, loadVatSponsor, activeTab, vatCounterparties.length]
  )

  const updateCounterpartyAction = useCallback(
    async (id: string, input: CounterpartyWriteInput) => {
      setCounterpartiesSaving(true)
      setCounterpartiesError(null)
      try {
        const updated = await updateCounterparty(id, input)
        await loadCounterparties()
        if (activeTab === 'vat_sponsor' || vatCounterparties.length > 0) {
          await loadVatSponsor()
        }
        return updated
      } catch (err) {
        setCounterpartiesError(mapSupabaseError(err))
        throw err
      } finally {
        setCounterpartiesSaving(false)
      }
    },
    [loadCounterparties, loadVatSponsor, activeTab, vatCounterparties.length]
  )

  const archiveCounterpartyAction = useCallback(
    async (id: string) => {
      setCounterpartiesSaving(true)
      setCounterpartiesError(null)
      try {
        await archiveCounterparty(id)
        await loadCounterparties()
        if (activeTab === 'vat_sponsor' || vatCounterparties.length > 0) {
          await loadVatSponsor()
        }
      } catch (err) {
        setCounterpartiesError(mapSupabaseError(err))
        throw err
      } finally {
        setCounterpartiesSaving(false)
      }
    },
    [loadCounterparties, loadVatSponsor, activeTab, vatCounterparties.length]
  )

  const reactivateCounterpartyAction = useCallback(
    async (id: string) => {
      setCounterpartiesSaving(true)
      setCounterpartiesError(null)
      try {
        await reactivateCounterparty(id)
        await loadCounterparties()
        if (activeTab === 'vat_sponsor' || vatCounterparties.length > 0) {
          await loadVatSponsor()
        }
      } catch (err) {
        setCounterpartiesError(mapSupabaseError(err))
        throw err
      } finally {
        setCounterpartiesSaving(false)
      }
    },
    [loadCounterparties, loadVatSponsor, activeTab, vatCounterparties.length]
  )

  const createSponsorshipContractAction = useCallback(
    async (values: SponsorshipContractFormValues, taxableCents: number) => {
      if (!selectedFiscalYearId) return
      setVatSaving(true)
      setVatError(null)
      try {
        const ratePct = Number(String(values.vatRatePercent).replace(',', '.'))
        const rateBp = percentToBasisPoints(ratePct)
        const cp = vatCounterparties.find((c) => c.id === values.counterpartyId)
        const body =
          values.bodyText.trim() ||
          buildSponsorshipContractBody(
            buildDocContext({
              counterparty: cp,
              title: values.title,
              startsOn: values.startsOn,
              endsOn: values.endsOn || null,
              taxableCents,
              vatRateBp: rateBp,
              grossCents: computeGrossCents(taxableCents, computeVatAmountCents(taxableCents, rateBp))
            })
          )
        await createSponsorshipContract({
          fiscalYearId: selectedFiscalYearId,
          counterpartyId: values.counterpartyId,
          title: values.title,
          startsOn: values.startsOn,
          endsOn: values.endsOn || null,
          taxableAmountCents: taxableCents,
          vatRateBasisPoints: rateBp,
          bodyText: body,
          notes: values.notes || null
        })
        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [selectedFiscalYearId, vatCounterparties, loadVatSponsor]
  )

  const updateSponsorshipContractAction = useCallback(
    async (id: string, values: SponsorshipContractFormValues, taxableCents: number) => {
      setVatSaving(true)
      setVatError(null)
      try {
        const ratePct = Number(String(values.vatRatePercent).replace(',', '.'))
        await updateSponsorshipContractDraft(id, {
          title: values.title,
          startsOn: values.startsOn,
          endsOn: values.endsOn || null,
          taxableAmountCents: taxableCents,
          vatRateBasisPoints: percentToBasisPoints(ratePct),
          bodyText: values.bodyText,
          notes: values.notes || null,
          counterpartyId: values.counterpartyId
        })
        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [loadVatSponsor]
  )

  const confirmSponsorshipContractAction = useCallback(
    async (id: string) => {
      if (!selectedFiscalYearId) return
      setVatSaving(true)
      setVatError(null)
      try {
        await confirmSponsorshipContract(id)
        const fresh = await fetchSponsorshipContractById(id)
        if (fresh) {
          try {
            await attachContractPdf(
              id,
              selectedFiscalYearId,
              fresh.body_text,
              fresh.title
            )
          } catch (pdfErr) {
            console.warn('PDF contratto non caricato dopo conferma', pdfErr)
            setVatError(
              mapSupabaseError(pdfErr) ||
                'Contratto confermato ma PDF non caricato (controlla bucket accounting-docs).'
            )
          }
        }
        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [selectedFiscalYearId, loadVatSponsor]
  )

  const regenerateSponsorshipContractPdfAction = useCallback(
    async (id: string) => {
      if (!selectedFiscalYearId) return
      setVatSaving(true)
      setVatError(null)
      try {
        const fresh = await fetchSponsorshipContractById(id)
        if (!fresh) throw new Error('Contratto non trovato')
        if (fresh.status !== 'confirmed') {
          throw new Error('Il PDF si genera solo per contratti confermati.')
        }
        await attachContractPdf(
          id,
          selectedFiscalYearId,
          fresh.body_text,
          fresh.title
        )
        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [selectedFiscalYearId, loadVatSponsor]
  )

  const reopenSponsorshipContractAction = useCallback(
    async (id: string) => {
      setVatSaving(true)
      setVatError(null)
      try {
        await reopenSponsorshipContractDraft(id)
        await loadVatSponsor()
      } catch (err) {
        setVatError(mapSupabaseError(err))
        throw err
      } finally {
        setVatSaving(false)
      }
    },
    [loadVatSponsor]
  )

  const openAccountingPdfAction = useCallback(async (pdfPath: string) => {
    const url = await getAccountingDocSignedUrl(pdfPath)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const createBudgetForYear = useCallback(async () => {
    if (!selectedFiscalYearId || !selectedFiscalYear) return
    setBudgetSaving(true)
    setBudgetError(null)
    try {
      const latest = await fetchLatestBudgetVersion(selectedFiscalYearId)
      await createBudget({
        fiscalYearId: selectedFiscalYearId,
        name: `Preventivo ${selectedFiscalYear.code}`,
        version: latest + 1
      })
      await loadBudget()
    } catch (err) {
      setBudgetError(mapSupabaseError(err))
      throw err
    } finally {
      setBudgetSaving(false)
    }
  }, [selectedFiscalYearId, selectedFiscalYear, loadBudget])

  const saveBudgetNotes = useCallback(
    async (notes: string) => {
      if (!budget) return
      setBudgetSaving(true)
      setBudgetError(null)
      try {
        await updateBudgetNotes(budget.id, notes)
        await loadBudget()
      } catch (err) {
        setBudgetError(mapSupabaseError(err))
        throw err
      } finally {
        setBudgetSaving(false)
      }
    },
    [budget, loadBudget]
  )

  const approveBudgetAction = useCallback(async () => {
    if (!budget) return
    setBudgetSaving(true)
    setBudgetError(null)
    try {
      await approveBudget(budget.id)
      await loadBudget()
    } catch (err) {
      setBudgetError(mapSupabaseError(err))
      throw err
    } finally {
      setBudgetSaving(false)
    }
  }, [budget, loadBudget])

  const archiveBudgetAction = useCallback(async () => {
    if (!budget) return
    setBudgetSaving(true)
    setBudgetError(null)
    try {
      await archiveBudgetAndOpenNewDraft(budget)
      await loadBudget()
    } catch (err) {
      setBudgetError(mapSupabaseError(err))
      throw err
    } finally {
      setBudgetSaving(false)
    }
  }, [budget, loadBudget])

  const createBudgetLineAction = useCallback(
    async (values: BudgetLineFormValues, amountCents: number) => {
      if (!budget) return
      if (isQuoteCategoryId(values.categoryId, categories)) {
        throw new Error('La categoria Quote è automatica: non creare voci manuali QUOTE.')
      }
      setBudgetSaving(true)
      setBudgetError(null)
      try {
        await createBudgetLine({
          budgetId: budget.id,
          categoryId: values.categoryId,
          direction: values.direction,
          description: values.description,
          plannedAmountCents: amountCents,
          notes: values.notes || null
        })
        await loadBudget()
      } catch (err) {
        setBudgetError(mapSupabaseError(err))
        throw err
      } finally {
        setBudgetSaving(false)
      }
    },
    [budget, categories, loadBudget]
  )

  const updateBudgetLineAction = useCallback(
    async (lineId: string, values: BudgetLineFormValues, amountCents: number) => {
      if (isQuoteCategoryId(values.categoryId, categories)) {
        throw new Error('La categoria Quote è automatica: non creare voci manuali QUOTE.')
      }
      setBudgetSaving(true)
      setBudgetError(null)
      try {
        await updateBudgetLine(lineId, {
          categoryId: values.categoryId,
          direction: values.direction,
          description: values.description,
          plannedAmountCents: amountCents,
          notes: values.notes || null
        })
        await loadBudget()
      } catch (err) {
        setBudgetError(mapSupabaseError(err))
        throw err
      } finally {
        setBudgetSaving(false)
      }
    },
    [categories, loadBudget]
  )

  const deleteBudgetLineAction = useCallback(
    async (lineId: string) => {
      setBudgetSaving(true)
      setBudgetError(null)
      try {
        await deleteBudgetLine(lineId)
        await loadBudget()
      } catch (err) {
        setBudgetError(mapSupabaseError(err))
        throw err
      } finally {
        setBudgetSaving(false)
      }
    },
    [loadBudget]
  )

  return {
    loading,
    refreshing,
    error,
    categoriesError,
    lastUpdatedAt,
    fiscalYears,
    selectedFiscalYear,
    selectedFiscalYearId,
    setSelectedFiscalYearId: changeFiscalYear,
    accounts,
    categories,
    activeTab,
    setActiveTab,
    summary,
    syncPreview,
    syncPreviewAvailable,
    movementFilters,
    setMovementFilters,
    resetMovementFilters,
    movements,
    movementsTotal,
    movementsPage,
    setMovementsPage,
    movementsLoading,
    movementsError,
    receivableFilters,
    setReceivableFilters,
    resetReceivableFilters,
    receivables,
    receivablesTotal,
    receivablesPage,
    setReceivablesPage,
    receivablesLoading,
    receivablesError,
    syncLoading,
    syncError,
    retryLoading,
    refresh,
    loadSyncPreview,
    retrySync,
    pageSize: ACCOUNTING_PAGE_SIZE,
    movementFormOpen,
    movementFormMode,
    movementFormInitial,
    movementSaving,
    movementsPdfGenerating,
    openCreateMovement,
    openEditMovement,
    closeMovementForm,
    saveMovementForm,
    generateMovementsPdfAction,
    transferFormOpen,
    transferFormMode,
    transferFormInitial,
    transferSaving,
    openCreateTransfer,
    openEditTransfer,
    closeTransferForm,
    saveTransferForm,
    detailOpen,
    detailMovement,
    detailLoading,
    detailError,
    openMovementDetail,
    closeMovementDetail,
    lifecycleSaving,
    runMovementLifecycleAction,
    budget,
    budgetLines,
    budgetComparison,
    budgetTotals,
    budgetLoading,
    budgetError,
    budgetSaving,
    createBudgetForYear,
    saveBudgetNotes,
    approveBudgetAction,
    archiveBudgetAction,
    createBudgetLineAction,
    updateBudgetLineAction,
    deleteBudgetLineAction,
    consuntivoFilters,
    setConsuntivoFilters,
    resetConsuntivoFilters,
    consuntivoMovements,
    consuntivoBudgetLines,
    consuntivoHasActiveBudget,
    consuntivoFees,
    consuntivoLoading,
    consuntivoError,
    reconciliationSessions,
    selectedReconciliationSessionId,
    reconciliationLines,
    reconciliationSummary,
    reconciliationCandidates,
    reconciliationLoading,
    reconciliationSaving,
    reconciliationError,
    loadReconciliation,
    selectReconciliationSession,
    createReconciliationSessionAction,
    addReconciliationLineAction,
    importReconciliationCsvAction,
    matchReconciliationLineAction,
    unmatchReconciliationLineAction,
    excludeReconciliationLineAction,
    completeReconciliationSessionAction,
    cancelReconciliationSessionAction,
    vatDocuments,
    vatPeriods,
    vatCounterparties,
    sponsorshipContracts,
    vatFiscalParams,
    vatOverview,
    vatLoading,
    vatError,
    vatSaving,
    createCommercialDocumentAction,
    updateCommercialDocumentAction,
    issueCommercialDocumentAction,
    cancelCommercialDocumentAction,
    collectCommercialDocumentAction,
    linkCommercialMovementAction,
    calculateVatPeriodAction,
    verifyVatPeriodAction,
    markVatPeriodPaidAction,
    createSponsorshipContractAction,
    updateSponsorshipContractAction,
    confirmSponsorshipContractAction,
    regenerateSponsorshipContractPdfAction,
    reopenSponsorshipContractAction,
    openAccountingPdfAction,
    counterpartiesRows,
    counterpartiesLoading,
    counterpartiesError,
    counterpartiesSaving,
    createCounterpartyAction,
    updateCounterpartyAction,
    archiveCounterpartyAction,
    reactivateCounterpartyAction,
    closingChecklist,
    closingChecklistLoading,
    loadClosingChecklist,
    openFiscalYearAction,
    startClosingAction,
    closeFiscalYearAction,
    reopenFiscalYearAction,
    deadlines,
    deadlinesLoading,
    loadDeadlines,
    createDeadlineAction,
    setDeadlineStatusAction,
    auditRows,
    auditLoading,
    auditError,
    loadAudit,
    movementApprovalMode,
    verifyManualMovementAction
  }
}
