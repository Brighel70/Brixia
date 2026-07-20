import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createManualMovement,
  fetchAccounts,
  fetchCategoriesIncludingInactiveWithMeta,
  fetchFiscalYears,
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
  updateManualMovement
} from '../api/accounting.api'
import {
  approveBudget,
  archiveBudgetAndOpenNewDraft,
  createBudget,
  createBudgetLine,
  deleteBudgetLine,
  fetchActiveBudget,
  fetchApprovedBudget,
  fetchBudgetLines,
  fetchFeesBudgetAggregate,
  fetchLatestBudgetVersion,
  fetchMovementCategoryActualRows,
  updateBudgetLine,
  updateBudgetNotes
} from '../api/budget.api'
import { fetchConsuntivoMovements } from '../api/consuntivo.api'
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
  generateTextPdfBlob
} from '../utils/documentTemplates'
import { computeAccountingSummary } from '../utils/summaryCalculations'
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
  BudgetComparisonRow,
  BudgetOverviewTotals,
  ConsuntivoFilterState,
  ConsuntivoMovementRow,
  FeesBudgetAggregate,
  MovementsFilterState,
  ReceivablesFilterState,
  ReconcileFeesPreview,
  AccountingCounterpartyRef,
  AccountingCounterparty,
  AccountingFiscalParamRow,
  CommercialDocument,
  CommercialVatOverview,
  SponsorshipContract,
  VatPeriod
} from '../types'
import { movementToFormValues, movementFormToPayload, type MovementFormValues } from '../utils/movementValidation'
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

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailMovementId, setDetailMovementId] = useState<string | null>(null)
  const [detailMovement, setDetailMovement] = useState<AccountingMovementDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

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
  const [consuntivoHasApprovedBudget, setConsuntivoHasApprovedBudget] = useState(false)
  const [consuntivoFees, setConsuntivoFees] = useState<FeesBudgetAggregate | null>(null)
  const [consuntivoLoading, setConsuntivoLoading] = useState(false)
  const [consuntivoError, setConsuntivoError] = useState<string | null>(null)

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
      const [movementRows, approved, fees] = await Promise.all([
        fetchConsuntivoMovements(selectedFiscalYearId),
        fetchApprovedBudget(selectedFiscalYearId),
        fetchFeesBudgetAggregate(selectedFiscalYearId, categories)
      ])

      let lines: AccountingBudgetLine[] = []
      if (approved) {
        lines = await fetchBudgetLines(approved.id)
      }

      setConsuntivoMovements(movementRows)
      setConsuntivoHasApprovedBudget(!!approved)
      setConsuntivoBudgetLines(lines)
      setConsuntivoFees(fees)
    } catch (err) {
      setConsuntivoError(mapSupabaseError(err))
      setConsuntivoMovements([])
      setConsuntivoHasApprovedBudget(false)
      setConsuntivoBudgetLines([])
      setConsuntivoFees(null)
    } finally {
      setConsuntivoLoading(false)
    }
  }, [selectedFiscalYearId, categories])

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
    if (!selectedFiscalYearId || activeTab !== 'vat_sponsor') return
    void loadVatSponsor()
  }, [selectedFiscalYearId, activeTab, loadVatSponsor])

  useEffect(() => {
    if (activeTab !== 'counterparties') return
    void loadCounterparties()
  }, [activeTab, loadCounterparties])

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
      if (activeTab === 'vat_sponsor') await loadVatSponsor()
      if (activeTab === 'counterparties') await loadCounterparties()
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
    loadVatSponsor,
    loadCounterparties
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
    openCreateMovement,
    openEditMovement,
    closeMovementForm,
    saveMovementForm,
    detailOpen,
    detailMovement,
    detailLoading,
    detailError,
    openMovementDetail,
    closeMovementDetail,
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
    consuntivoHasApprovedBudget,
    consuntivoFees,
    consuntivoLoading,
    consuntivoError,
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
    reactivateCounterpartyAction
  }
}
