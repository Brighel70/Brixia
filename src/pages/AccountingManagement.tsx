import { useState } from 'react'
import Header from '@/components/Header'
import { PERMISSIONS } from '@/config/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { toast } from 'sonner'
import { AccountingKpiCards } from '@/features/accounting/components/AccountingKpiCards'
import { AccountingPageHeader } from '@/features/accounting/components/AccountingPageHeader'
import { MovementDetailPanel } from '@/features/accounting/components/MovementDetailPanel'
import { MovementFormModal } from '@/features/accounting/components/MovementFormModal'
import { MovementLifecycleModal } from '@/features/accounting/components/MovementLifecycleModal'
import { MovementsTab } from '@/features/accounting/components/MovementsTab'
import { TransferFormModal } from '@/features/accounting/components/TransferFormModal'
import { OverviewTab } from '@/features/accounting/components/OverviewTab'
import { ReceivablesTab } from '@/features/accounting/components/ReceivablesTab'
import { SyncTab } from '@/features/accounting/components/SyncTab'
import { BudgetTab } from '@/features/accounting/components/BudgetTab'
import { ConsuntivoTab } from '@/features/accounting/components/ConsuntivoTab'
import { VatSponsorTab } from '@/features/accounting/components/VatSponsorTab'
import { CounterpartiesTab } from '@/features/accounting/components/CounterpartiesTab'
import { ReconciliationTab } from '@/features/accounting/components/ReconciliationTab'
import { FiscalYearCloseWizard } from '@/features/accounting/components/FiscalYearCloseWizard'
import { DeadlinesTab } from '@/features/accounting/components/DeadlinesTab'
import { AuditTab } from '@/features/accounting/components/AuditTab'
import { ACCOUNTING_TABS } from '@/features/accounting/constants'
import { useAccountingPage } from '@/features/accounting/hooks/useAccountingPage'
import type { AccountingTabId } from '@/features/accounting/types'
import { isFiscalYearOpenForEditing } from '@/features/accounting/utils/movementValidation'
import type { MovementLifecycleAction } from '@/features/accounting/utils/movementLifecycle'

interface AccountingManagementProps {
  embedInLayout?: boolean
}

export default function AccountingManagement({ embedInLayout = false }: AccountingManagementProps) {
  const [lifecycleAction, setLifecycleAction] = useState<MovementLifecycleAction | null>(null)
  const { hasPermission, isAdmin } = usePermissions()
  const canVerify = isAdmin() || hasPermission(PERMISSIONS.ACCOUNTING.VERIFY)
  const canCreate = isAdmin() || hasPermission(PERMISSIONS.ACCOUNTING.CREATE)
  const canEditDraft = isAdmin() || hasPermission(PERMISSIONS.ACCOUNTING.EDIT_DRAFT)
  const canApprove = isAdmin() || hasPermission(PERMISSIONS.ACCOUNTING.POST)
  const canExport = isAdmin() || hasPermission(PERMISSIONS.ACCOUNTING.EXPORT)
  const canManageSettings = isAdmin() || hasPermission(PERMISSIONS.ACCOUNTING.MANAGE_SETTINGS)
  const canClosePeriod = isAdmin() || hasPermission(PERMISSIONS.ACCOUNTING.CLOSE_PERIOD)
  const canAuditView = isAdmin() || hasPermission(PERMISSIONS.ACCOUNTING.AUDIT_VIEW)

  const {
    loading,
    refreshing,
    error,
    categoriesError,
    lastUpdatedAt,
    fiscalYears,
    selectedFiscalYear,
    setSelectedFiscalYearId,
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
    pageSize,
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
    sponsorshipContracts,
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
    loadAudit
  } = useAccountingPage()

  const fiscalYearOpen = isFiscalYearOpenForEditing(selectedFiscalYear)

  const handleMovementFiltersChange = (patch: Partial<typeof movementFilters>) => {
    setMovementFilters((prev) => ({ ...prev, ...patch }))
    setMovementsPage(1)
  }

  const handleReceivableFiltersChange = (patch: Partial<typeof receivableFilters>) => {
    setReceivableFilters((prev) => ({ ...prev, ...patch }))
    setReceivablesPage(1)
  }

  const handleConsuntivoFiltersChange = (patch: Partial<typeof consuntivoFilters>) => {
    setConsuntivoFilters((prev) => ({ ...prev, ...patch }))
  }

  const handleSaveMovement = async (
    values: Parameters<typeof saveMovementForm>[0],
    amountCents: number
  ) => {
    try {
      await saveMovementForm(values, amountCents)
      toast.success(
        movementFormMode === 'create' ? 'Bozza movimento creata' : 'Bozza movimento aggiornata'
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Salvataggio non riuscito')
      throw err
    }
  }

  const content = (
    <>
      <AccountingPageHeader
        fiscalYears={fiscalYears}
        selectedFiscalYear={selectedFiscalYear}
        onFiscalYearChange={setSelectedFiscalYearId}
        refreshing={refreshing}
        lastUpdatedAt={lastUpdatedAt}
        onRefresh={() => void refresh()}
      />

      {canClosePeriod && (
        <div className="mb-4">
          <FiscalYearCloseWizard
            fiscalYear={selectedFiscalYear}
            checklist={closingChecklist}
            loading={closingChecklistLoading}
            canClose={canClosePeriod}
            canReopen={isAdmin()}
            onRefreshChecklist={async () => {
              await loadClosingChecklist()
            }}
            onOpen={openFiscalYearAction}
            onStartClosing={startClosingAction}
            onClose={closeFiscalYearAction}
            onReopen={reopenFiscalYearAction}
          />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {categoriesError && (
        <div className="mb-4 rounded-lg border border-amber-300/50 bg-amber-500/15 px-4 py-3 text-sm text-amber-50">
          <p className="font-medium">Categorie / impostazioni</p>
          <p className="mt-1 opacity-95">{categoriesError}</p>
        </div>
      )}

      <AccountingKpiCards
        summary={summary}
        syncPreview={syncPreview}
        syncPreviewAvailable={syncPreviewAvailable}
      />

      <div className="mb-4">
        <div className="border-b border-white/20">
          <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-2">
            {ACCOUNTING_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as AccountingTabId)}
                className={`border-b-2 py-2 px-1 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-secondary text-white'
                    : 'border-transparent text-white/60 hover:text-white/90'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow-sm">
          Caricamento Contabilità...
        </div>
      ) : (
        <div className="text-slate-900">
          {activeTab === 'overview' && (
            <OverviewTab
              summary={summary}
              syncPreview={syncPreview}
              syncPreviewAvailable={syncPreviewAvailable}
            />
          )}
          {activeTab === 'movements' && (
            <MovementsTab
              accounts={accounts}
              filters={movementFilters}
              onFiltersChange={handleMovementFiltersChange}
              onResetFilters={resetMovementFilters}
              movements={movements}
              total={movementsTotal}
              page={movementsPage}
              pageSize={pageSize}
              onPageChange={setMovementsPage}
              loading={movementsLoading}
              error={movementsError}
              canCreate={canCreate}
              canExport={canExport}
              fiscalYearOpen={fiscalYearOpen}
              onCreateClick={openCreateMovement}
              onCreateTransferClick={openCreateTransfer}
              pdfGenerating={movementsPdfGenerating}
              onGeneratePdf={async () => {
                try {
                  await generateMovementsPdfAction()
                  toast.success('PDF della Prima nota generato')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Generazione PDF non riuscita')
                }
              }}
              onMovementClick={(m) => void openMovementDetail(m)}
            />
          )}
          {activeTab === 'receivables' && (
            <ReceivablesTab
              filters={receivableFilters}
              onFiltersChange={handleReceivableFiltersChange}
              onResetFilters={resetReceivableFilters}
              receivables={receivables}
              total={receivablesTotal}
              page={receivablesPage}
              pageSize={pageSize}
              onPageChange={setReceivablesPage}
              loading={receivablesLoading}
              error={receivablesError}
            />
          )}
          {activeTab === 'budget' && (
            <BudgetTab
              fiscalYear={selectedFiscalYear}
              budget={budget}
              lines={budgetLines}
              comparisonRows={budgetComparison}
              totals={budgetTotals}
              categories={categories}
              loading={budgetLoading}
              error={budgetError}
              saving={budgetSaving}
              canCreate={canCreate}
              canEditDraft={canEditDraft}
              canApprove={canApprove}
              canExport={canExport}
              onCreateBudget={async () => {
                try {
                  await createBudgetForYear()
                  toast.success('Preventivo creato')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Creazione non riuscita')
                }
              }}
              onSaveNotes={async (notes) => {
                try {
                  await saveBudgetNotes(notes)
                  toast.success('Note salvate')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Salvataggio note non riuscito')
                  throw err
                }
              }}
              onApprove={async () => {
                try {
                  await approveBudgetAction()
                  toast.success('Preventivo approvato')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Approvazione non riuscita')
                }
              }}
              onArchive={async () => {
                if (
                  !window.confirm(
                    'Archiviare questo preventivo approvato e aprire subito una nuova bozza (stesse voci) per aggiungere/modificare righe?'
                  )
                ) {
                  return
                }
                try {
                  await archiveBudgetAction()
                  toast.success('Nuova versione in bozza: puoi aggiungere voci')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Archiviazione non riuscita')
                }
              }}
              onCreateLine={async (values, amountCents) => {
                try {
                  await createBudgetLineAction(values, amountCents)
                  toast.success('Voce aggiunta')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Inserimento non riuscito')
                  throw err
                }
              }}
              onUpdateLine={async (lineId, values, amountCents) => {
                try {
                  await updateBudgetLineAction(lineId, values, amountCents)
                  toast.success('Voce aggiornata')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Modifica non riuscita')
                  throw err
                }
              }}
              onDeleteLine={async (lineId) => {
                try {
                  await deleteBudgetLineAction(lineId)
                  toast.success('Voce eliminata')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Eliminazione non riuscita')
                }
              }}
            />
          )}
          {activeTab === 'consuntivo' && (
            <ConsuntivoTab
              fiscalYear={selectedFiscalYear}
              movements={consuntivoMovements}
              accounts={accounts}
              categories={categories}
              budgetLines={consuntivoBudgetLines}
              hasActiveBudget={consuntivoHasActiveBudget}
              fees={consuntivoFees}
              filters={consuntivoFilters}
              onFiltersChange={handleConsuntivoFiltersChange}
              onResetFilters={resetConsuntivoFilters}
              loading={consuntivoLoading}
              error={consuntivoError}
              canExport={canExport}
              onOpenReconciliation={() => setActiveTab('reconciliation')}
            />
          )}
          {activeTab === 'reconciliation' && (
            <ReconciliationTab
              fiscalYear={selectedFiscalYear}
              accounts={accounts}
              sessions={reconciliationSessions}
              selectedSessionId={selectedReconciliationSessionId}
              lines={reconciliationLines}
              summary={reconciliationSummary}
              candidates={reconciliationCandidates}
              loading={reconciliationLoading}
              saving={reconciliationSaving}
              error={reconciliationError}
              canVerify={canVerify}
              onSelectSession={(id) => void selectReconciliationSession(id)}
              onRefresh={() => void loadReconciliation()}
              onCreateSession={createReconciliationSessionAction}
              onAddLine={addReconciliationLineAction}
              onImportCsv={importReconciliationCsvAction}
              onMatch={matchReconciliationLineAction}
              onUnmatch={unmatchReconciliationLineAction}
              onExclude={excludeReconciliationLineAction}
              onComplete={completeReconciliationSessionAction}
              onCancel={cancelReconciliationSessionAction}
            />
          )}
          {activeTab === 'deadlines' && (
            <DeadlinesTab
              fiscalYear={selectedFiscalYear}
              deadlines={deadlines}
              loading={deadlinesLoading}
              canManage={canCreate || canManageSettings}
              onRefresh={() => void loadDeadlines()}
              onCreate={async (input) => {
                await createDeadlineAction(input)
              }}
              onSetStatus={async (id, status) => {
                await setDeadlineStatusAction(id, status)
              }}
            />
          )}
          {activeTab === 'audit' && (
            <AuditTab
              rows={auditRows}
              loading={auditLoading}
              error={auditError}
              canView={canAuditView}
              onRefresh={() => void loadAudit()}
            />
          )}
          {activeTab === 'vat_sponsor' && (
            <VatSponsorTab
              fiscalYear={selectedFiscalYear}
              documents={vatDocuments}
              periods={vatPeriods}
              counterparties={vatCounterparties}
              accounts={accounts}
              fiscalParams={vatFiscalParams}
              overview={vatOverview}
              loading={vatLoading}
              error={vatError}
              saving={vatSaving}
              canCreate={canCreate}
              canEditDraft={canEditDraft}
              canVerify={canVerify}
              canPost={canApprove}
              canManageSettings={canManageSettings}
              onCreateDocument={async (values, taxableCents) => {
                try {
                  await createCommercialDocumentAction(values, taxableCents)
                  toast.success('Documento commerciale salvato')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Salvataggio non riuscito')
                  throw err
                }
              }}
              onUpdateDocument={async (id, values, taxableCents) => {
                try {
                  await updateCommercialDocumentAction(id, values, taxableCents)
                  toast.success('Bozza aggiornata')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Modifica non riuscita')
                  throw err
                }
              }}
              onIssue={async (id) => {
                try {
                  await issueCommercialDocumentAction(id)
                  toast.success('Documento emesso')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Emissione non riuscita')
                }
              }}
              onCancel={async (id) => {
                try {
                  await cancelCommercialDocumentAction(id)
                  toast.success('Documento annullato')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Annullamento non riuscito')
                }
              }}
              onRegisterPayment={async (id, accountId, allocatedAmountCents) => {
                try {
                  await collectCommercialDocumentAction(id, accountId, allocatedAmountCents)
                  toast.success('Pagamento registrato in Prima nota')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Pagamento non riuscito')
                }
              }}
              onLinkMovement={async (documentId, movementId, allocatedAmountCents) => {
                try {
                  await linkCommercialMovementAction(
                    documentId,
                    movementId,
                    allocatedAmountCents
                  )
                  toast.success('Movimento collegato al documento')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Collegamento non riuscito')
                }
              }}
              onCalculateQuarter={async (year, quarter) => {
                try {
                  await calculateVatPeriodAction(year, quarter)
                  toast.success(`Liquidazione T${quarter} aggiornata`)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Calcolo non riuscito')
                }
              }}
              onVerifyPeriod={async (id) => {
                try {
                  await verifyVatPeriodAction(id)
                  toast.success('Liquidazione verificata')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Verifica non riuscita')
                }
              }}
              onMarkPaid={async (id, paidAt, reference) => {
                try {
                  await markVatPeriodPaidAction(id, paidAt, reference)
                  toast.success('Pagamento registrato')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Registrazione non riuscita')
                }
              }}
              onCreateCounterparty={async (input) => {
                try {
                  const created = await createCounterpartyAction(input)
                  toast.success('Controparte creata')
                  return created
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Creazione non riuscita')
                  throw err
                }
              }}
              sponsorshipContracts={sponsorshipContracts}
              onCreateContract={async (values, taxableCents) => {
                try {
                  await createSponsorshipContractAction(values, taxableCents)
                  toast.success('Contratto salvato in bozza')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Salvataggio non riuscito')
                  throw err
                }
              }}
              onUpdateContract={async (id, values, taxableCents) => {
                try {
                  await updateSponsorshipContractAction(id, values, taxableCents)
                  toast.success('Contratto aggiornato')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Modifica non riuscita')
                  throw err
                }
              }}
              onConfirmContract={async (id) => {
                try {
                  await confirmSponsorshipContractAction(id)
                  toast.success('Contratto confermato')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Conferma non riuscita')
                }
              }}
              onRegenerateContractPdf={async (id) => {
                try {
                  await regenerateSponsorshipContractPdfAction(id)
                  toast.success('PDF generato')
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : 'PDF non generato (controlla bucket accounting-docs)'
                  )
                }
              }}
              onReopenContractDraft={async (id) => {
                try {
                  await reopenSponsorshipContractAction(id)
                  toast.success('Contratto riaperto in bozza')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Riapertura non riuscita')
                }
              }}
              onOpenPdf={async (path) => {
                try {
                  await openAccountingPdfAction(path)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Apertura PDF non riuscita')
                }
              }}
            />
          )}
          {activeTab === 'counterparties' && (
            <CounterpartiesTab
              rows={counterpartiesRows}
              loading={counterpartiesLoading}
              error={counterpartiesError}
              saving={counterpartiesSaving}
              canCreate={canCreate}
              canEdit={canEditDraft || canManageSettings}
              onCreate={async (input) => {
                try {
                  const created = await createCounterpartyAction(input)
                  toast.success('Controparte creata')
                  return created
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Creazione non riuscita')
                  throw err
                }
              }}
              onUpdate={async (id, input) => {
                try {
                  const updated = await updateCounterpartyAction(id, input)
                  toast.success('Controparte aggiornata')
                  return updated
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Modifica non riuscita')
                  throw err
                }
              }}
              onArchive={async (id) => {
                try {
                  await archiveCounterpartyAction(id)
                  toast.success('Controparte archiviata')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Archiviazione non riuscita')
                  throw err
                }
              }}
              onReactivate={async (id) => {
                try {
                  await reactivateCounterpartyAction(id)
                  toast.success('Controparte riattivata')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Riattivazione non riuscita')
                  throw err
                }
              }}
            />
          )}
          {activeTab === 'sync' && (
            <SyncTab
              preview={syncPreview}
              loading={syncLoading}
              error={syncError}
              canVerify={canVerify}
              retryLoading={retryLoading}
              onRefresh={() => void loadSyncPreview()}
              onRetry={retrySync}
            />
          )}
        </div>
      )}

      <MovementFormModal
        isOpen={movementFormOpen}
        mode={movementFormMode}
        fiscalYear={selectedFiscalYear}
        accounts={accounts}
        categories={categories}
        initialValues={movementFormInitial}
        saving={movementSaving}
        onClose={closeMovementForm}
        onSubmit={handleSaveMovement}
      />

      <TransferFormModal
        isOpen={transferFormOpen}
        mode={transferFormMode}
        fiscalYear={selectedFiscalYear}
        accounts={accounts}
        initialValues={transferFormInitial}
        saving={transferSaving}
        onClose={closeTransferForm}
        onSubmit={async (values, amountCents) => {
          try {
            await saveTransferForm(values, amountCents)
            toast.success(transferFormMode === 'create' ? 'Bozza giroconto salvata' : 'Giroconto aggiornato')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Salvataggio giroconto non riuscito')
            throw err
          }
        }}
      />

      <MovementDetailPanel
        open={detailOpen}
        loading={detailLoading}
        error={detailError}
        movement={detailMovement}
        canEdit={canEditDraft}
        canPost={canApprove}
        canVerify={canVerify}
        onClose={closeMovementDetail}
        onEdit={() => {
          if (detailMovement) void openEditMovement(detailMovement.id)
        }}
        onEditTransfer={() => {
          if (detailMovement) void openEditTransfer(detailMovement.id)
        }}
        onLifecycleAction={(action) => setLifecycleAction(action)}
      />

      <MovementLifecycleModal
        action={lifecycleAction}
        movement={detailMovement}
        fiscalYear={selectedFiscalYear}
        accounts={accounts}
        saving={lifecycleSaving}
        onClose={() => {
          if (!lifecycleSaving) setLifecycleAction(null)
        }}
        onConfirm={async (request) => {
          try {
            await runMovementLifecycleAction(request)
            const messages: Record<MovementLifecycleAction, string> = {
              post: 'Movimento contabilizzato',
              cancel: 'Bozza annullata',
              reverse: 'Storno creato correttamente',
              assign_account: 'Conto assegnato e movimento contabilizzato',
              verify: 'Movimento verificato'
            }
            toast.success(messages[request.action])
            setLifecycleAction(null)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Operazione non riuscita')
            throw err
          }
        }}
      />
    </>
  )

  return (
    <div className={embedInLayout ? 'min-h-full bg-slate-900' : ''}>
      {!embedInLayout && <Header title="Contabilità" showBack hideCenterLogo />}
      <div className={embedInLayout ? 'px-4 pb-6 pt-2 md:px-6' : 'px-6 pb-6 pt-2'}>
        {content}
      </div>
    </div>
  )
}
