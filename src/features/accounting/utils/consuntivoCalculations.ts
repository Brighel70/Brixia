import { safePercent } from './budgetCalculations'
import type {
  AccountingAccountRef,
  AccountingBudgetLine,
  AccountingCategoryRef,
  ConsuntivoAccountRow,
  ConsuntivoBudgetCompareRow,
  ConsuntivoCategoryRow,
  ConsuntivoCategoryGroupRow,
  ConsuntivoCompleteness,
  ConsuntivoFilterState,
  ConsuntivoKpis,
  ConsuntivoMovementRow,
  ConsuntivoReport,
  FeesBudgetAggregate,
  ReceivableNature
} from '../types'

export function isMovementDocumented(m: {
  document_type?: string | null
  document_number?: string | null
  reference?: string | null
}): boolean {
  return !!(
    m.document_type?.trim() ||
    m.document_number?.trim() ||
    m.reference?.trim()
  )
}

/** Quote automatiche: non contano come anomalia documentale. */
export function requiresDocumentCheck(m: { origin: string }): boolean {
  return m.origin !== 'fee_sync'
}

export function movementPassesConsuntivoFilters(
  m: ConsuntivoMovementRow,
  filters: ConsuntivoFilterState,
  categoryById: Map<string, AccountingCategoryRef>,
  originalById: Map<string, ConsuntivoMovementRow>
): boolean {
  if (filters.dateFrom && m.movement_date < filters.dateFrom) return false
  if (filters.dateTo && m.movement_date > filters.dateTo) return false
  if (filters.accountId !== 'all' && m.account_id !== filters.accountId) return false
  if (filters.status !== 'all' && m.status !== filters.status) return false

  if (filters.categoryId !== 'all') {
    if (m.direction === 'reversal') {
      const orig = m.reverses_movement_id
        ? originalById.get(m.reverses_movement_id)
        : undefined
      if (!orig || orig.category_id !== filters.categoryId) return false
    } else if (m.category_id !== filters.categoryId) {
      return false
    }
  }

  if (filters.nature !== 'all') {
    const catId =
      m.direction === 'reversal'
        ? originalById.get(m.reverses_movement_id ?? '')?.category_id
        : m.category_id
    const nature = catId ? categoryById.get(catId)?.default_nature : undefined
    if (nature !== filters.nature) return false
  }

  if (filters.direction !== 'all') {
    if (m.direction === 'reversal') {
      const orig = m.reverses_movement_id
        ? originalById.get(m.reverses_movement_id)
        : undefined
      if (!orig || orig.direction !== filters.direction) return false
    } else if (m.direction !== filters.direction) {
      return false
    }
  }

  return true
}

/**
 * Effettivi per categoria con filtri.
 * Gli originali restano in lookup anche se fuori filtro; non sommano se non filtrati.
 * Riusa la stessa regola storni del preventivo.
 */
export function computeFilteredCategoryActuals(
  allRows: ConsuntivoMovementRow[],
  filteredIds: Set<string>
): {
  byCategory: Map<string, { incomeCents: number; expenseCents: number }>
  unattributedReversalCents: number
} {
  const byId = new Map(allRows.map((r) => [r.id, r]))
  const byCategory = new Map<string, { incomeCents: number; expenseCents: number }>()
  let unattributedReversalCents = 0

  const touch = (categoryId: string | null) => {
    const key = categoryId ?? '__none__'
    let e = byCategory.get(key)
    if (!e) {
      e = { incomeCents: 0, expenseCents: 0 }
      byCategory.set(key, e)
    }
    return e
  }

  for (const row of allRows) {
    if (!filteredIds.has(row.id)) continue
    if (row.status === 'draft' || row.status === 'cancelled' || row.status === 'reversed') {
      continue
    }

    if (row.direction === 'income' && row.status === 'posted') {
      touch(row.category_id).incomeCents += row.amount_cents
      continue
    }
    if (row.direction === 'expense' && row.status === 'posted') {
      touch(row.category_id).expenseCents += row.amount_cents
      continue
    }

    if (
      row.direction === 'reversal' &&
      (row.status === 'posted' || row.status === 'pending_account')
    ) {
      const original = row.reverses_movement_id
        ? byId.get(row.reverses_movement_id)
        : undefined
      if (!original) {
        unattributedReversalCents += row.amount_cents
        continue
      }
      if (original.status === 'reversed') {
        continue
      }
      const entry = touch(original.category_id)
      if (original.direction === 'income') {
        entry.incomeCents = Math.max(0, entry.incomeCents - row.amount_cents)
      } else if (original.direction === 'expense') {
        entry.expenseCents = Math.max(0, entry.expenseCents - row.amount_cents)
      } else {
        unattributedReversalCents += row.amount_cents
      }
    }
  }

  return { byCategory, unattributedReversalCents }
}

/**
 * Effettivi per conto (criterio cassa).
 * Storno entrata → − sul conto dell'originale; storno uscita → +.
 */
export function computeAccountNets(
  allRows: ConsuntivoMovementRow[],
  filteredIds: Set<string>
): {
  byAccount: Map<
    string,
    { netPostedCents: number; pendingCents: number; postedCount: number; pendingCount: number }
  >
  unattributedReversalCents: number
} {
  const byId = new Map(allRows.map((r) => [r.id, r]))
  const byAccount = new Map<
    string,
    { netPostedCents: number; pendingCents: number; postedCount: number; pendingCount: number }
  >()
  let unattributedReversalCents = 0

  const touch = (accountId: string | null) => {
    const key = accountId ?? '__none__'
    let e = byAccount.get(key)
    if (!e) {
      e = { netPostedCents: 0, pendingCents: 0, postedCount: 0, pendingCount: 0 }
      byAccount.set(key, e)
    }
    return e
  }

  for (const row of allRows) {
    if (!filteredIds.has(row.id)) continue
    if (row.status === 'draft' || row.status === 'cancelled' || row.status === 'reversed') {
      continue
    }

    if (row.direction === 'income' && row.status === 'posted') {
      const e = touch(row.account_id)
      e.netPostedCents += row.amount_cents
      e.postedCount += 1
      continue
    }
    if (row.direction === 'expense' && row.status === 'posted') {
      const e = touch(row.account_id)
      e.netPostedCents -= row.amount_cents
      e.postedCount += 1
      continue
    }

    if (
      row.status === 'pending_account' &&
      (row.direction === 'income' || row.direction === 'expense')
    ) {
      const e = touch(row.account_id)
      e.pendingCents += row.direction === 'income' ? row.amount_cents : -row.amount_cents
      e.pendingCount += 1
      continue
    }

    if (
      row.direction === 'reversal' &&
      (row.status === 'posted' || row.status === 'pending_account')
    ) {
      const orig = row.reverses_movement_id ? byId.get(row.reverses_movement_id) : undefined
      if (!orig) {
        unattributedReversalCents += row.amount_cents
        continue
      }
      if (orig.status === 'reversed') {
        continue
      }
      const e = touch(orig.account_id)
      if (orig.direction === 'income') {
        e.netPostedCents -= row.amount_cents
        e.postedCount += 1
      } else if (orig.direction === 'expense') {
        e.netPostedCents += row.amount_cents
        e.postedCount += 1
      } else {
        unattributedReversalCents += row.amount_cents
      }
    }
  }

  return { byAccount, unattributedReversalCents }
}

function countMovementsPerCategory(
  allRows: ConsuntivoMovementRow[],
  filteredIds: Set<string>
): Map<string, number> {
  const byId = new Map(allRows.map((r) => [r.id, r]))
  const counts = new Map<string, number>()

  const bump = (categoryId: string | null) => {
    const key = categoryId ?? '__none__'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  for (const row of allRows) {
    if (!filteredIds.has(row.id)) continue
    if (row.status === 'draft' || row.status === 'cancelled' || row.status === 'reversed') continue

    if (
      (row.direction === 'income' || row.direction === 'expense') &&
      row.status === 'posted'
    ) {
      bump(row.category_id)
      continue
    }

    if (
      row.direction === 'reversal' &&
      (row.status === 'posted' || row.status === 'pending_account')
    ) {
      const orig = row.reverses_movement_id ? byId.get(row.reverses_movement_id) : undefined
      if (orig && orig.status !== 'reversed' && (orig.direction === 'income' || orig.direction === 'expense')) {
        bump(orig.category_id)
      }
    }
  }

  return counts
}

export function buildConsuntivoBudgetCompare(params: {
  budgetLines: AccountingBudgetLine[]
  fees: FeesBudgetAggregate | null
  quoteCategory: AccountingCategoryRef | null
  actualByCategory: Map<string, { incomeCents: number; expenseCents: number }>
  actualIncomeCents: number
  actualExpenseCents: number
}): ConsuntivoBudgetCompareRow[] {
  const rows: ConsuntivoBudgetCompareRow[] = []
  let plannedIncome = 0
  let plannedExpense = 0

  if (params.fees && (params.fees.expectedCents > 0 || params.quoteCategory)) {
    const quoteId = params.quoteCategory?.id ?? params.fees.quoteCategoryId
    const actual = quoteId ? params.actualByCategory.get(quoteId)?.incomeCents ?? 0 : 0
    plannedIncome += params.fees.expectedCents
    rows.push({
      key: 'fees_live',
      label: 'Quote assegnate (auto)',
      categoryId: quoteId,
      direction: 'income',
      plannedCents: params.fees.expectedCents,
      actualCents: actual,
      varianceCents: actual - params.fees.expectedCents,
      realizationPercent: safePercent(actual, params.fees.expectedCents)
    })
  }

  for (const line of params.budgetLines) {
    const actualEntry = params.actualByCategory.get(line.category_id)
    const actual =
      line.direction === 'income'
        ? actualEntry?.incomeCents ?? 0
        : actualEntry?.expenseCents ?? 0
    if (line.direction === 'income') plannedIncome += line.planned_amount_cents
    else plannedExpense += line.planned_amount_cents

    rows.push({
      key: `line:${line.id}`,
      label: line.description || line.category?.name || 'Voce',
      categoryId: line.category_id,
      direction: line.direction,
      plannedCents: line.planned_amount_cents,
      actualCents: actual,
      varianceCents: actual - line.planned_amount_cents,
      realizationPercent: safePercent(actual, line.planned_amount_cents)
    })
  }

  const plannedSurplus = plannedIncome - plannedExpense
  const actualSurplus = params.actualIncomeCents - params.actualExpenseCents
  rows.push({
    key: 'total',
    label: 'Totale generale (avanzo)',
    categoryId: null,
    direction: 'total',
    plannedCents: plannedSurplus,
    actualCents: actualSurplus,
    varianceCents: actualSurplus - plannedSurplus,
    realizationPercent: safePercent(actualSurplus, plannedSurplus)
  })

  return rows
}

export function computeConsuntivoReport(params: {
  movements: ConsuntivoMovementRow[]
  filters: ConsuntivoFilterState
  categories: AccountingCategoryRef[]
  accounts: AccountingAccountRef[]
  budgetLines: AccountingBudgetLine[]
  hasActiveBudget: boolean
  fees: FeesBudgetAggregate | null
  quoteCategory: AccountingCategoryRef | null
}): ConsuntivoReport {
  const categoryById = new Map(params.categories.map((c) => [c.id, c]))
  const accountById = new Map(params.accounts.map((a) => [a.id, a]))
  const originalById = new Map(params.movements.map((m) => [m.id, m]))

  const filtered = params.movements.filter((m) =>
    movementPassesConsuntivoFilters(m, params.filters, categoryById, originalById)
  )
  const filteredIds = new Set(filtered.map((m) => m.id))

  const effectiveCategory = computeFilteredCategoryActuals(params.movements, filteredIds)

  let incomeCents = 0
  let expenseCents = 0
  for (const v of effectiveCategory.byCategory.values()) {
    incomeCents += v.incomeCents
    expenseCents += v.expenseCents
  }

  const movementCounts = countMovementsPerCategory(params.movements, filteredIds)

  const categories: ConsuntivoCategoryRow[] = []
  for (const [catKey, amounts] of effectiveCategory.byCategory) {
    if (amounts.incomeCents === 0 && amounts.expenseCents === 0) continue
    const cat = catKey === '__none__' ? null : categoryById.get(catKey) ?? null
    const anomalies: string[] = []
    if (catKey === '__none__') anomalies.push('Senza categoria')
    if (cat?.default_nature === 'to_classify') anomalies.push('Natura da classificare')

    categories.push({
      categoryId: cat?.id ?? null,
      categoryCode: cat?.code ?? '—',
      categoryName: cat?.name ?? 'Senza categoria',
      groupId: cat?.group?.id ?? null,
      groupCode: cat?.group?.code ?? null,
      groupName: cat?.group?.name ?? null,
      isArchived: !!cat?.archived_at,
      isInactive: cat?.is_active === false,
      nature: (cat?.default_nature ?? 'unknown') as ReceivableNature | 'unknown',
      incomeCents: amounts.incomeCents,
      expenseCents: amounts.expenseCents,
      balanceCents: amounts.incomeCents - amounts.expenseCents,
      movementCount: movementCounts.get(catKey) ?? 0,
      anomalies
    })
  }
  categories.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode, 'it'))

  const categoryGroupsByKey = new Map<string, ConsuntivoCategoryGroupRow>()
  for (const category of categories) {
    const key = category.groupId ?? '__legacy__'
    let group = categoryGroupsByKey.get(key)
    if (!group) {
      group = {
        groupId: category.groupId,
        groupCode: category.groupCode ?? 'SENZA_MACRO',
        groupName: category.groupName ?? 'Categorie legacy senza macro-categoria',
        isLegacy: !category.groupId,
        incomeCents: 0,
        expenseCents: 0,
        balanceCents: 0,
        movementCount: 0,
        categories: []
      }
      categoryGroupsByKey.set(key, group)
    }
    group.incomeCents += category.incomeCents
    group.expenseCents += category.expenseCents
    group.balanceCents += category.balanceCents
    group.movementCount += category.movementCount
    group.categories.push(category)
  }
  const categoryGroups = [...categoryGroupsByKey.values()]
  categoryGroups.sort((a, b) => {
    if (a.isLegacy !== b.isLegacy) return a.isLegacy ? 1 : -1
    return a.groupName.localeCompare(b.groupName, 'it')
  })

  const accountNets = computeAccountNets(params.movements, filteredIds)
  const accounts: ConsuntivoAccountRow[] = []
  for (const [accKey, v] of accountNets.byAccount) {
    if (v.netPostedCents === 0 && v.pendingCents === 0) continue
    const acc = accKey === '__none__' ? null : accountById.get(accKey) ?? null
    accounts.push({
      accountId: acc?.id ?? null,
      accountCode: acc?.code ?? '—',
      accountName: acc?.name ?? 'Senza conto',
      netPostedCents: v.netPostedCents,
      pendingAccountCents: v.pendingCents,
      movementCountPosted: v.postedCount,
      movementCountPending: v.pendingCount
    })
  }
  accounts.sort((a, b) => a.accountCode.localeCompare(b.accountCode, 'it'))

  let withoutCategory = 0
  let withoutAccount = 0
  let withoutDocument = 0
  let drafts = 0
  let pendingAccount = 0
  let documentedCount = 0
  let documentableCount = 0
  const toClassifyCategoryIds = new Set(
    params.categories.filter((c) => c.default_nature === 'to_classify').map((c) => c.id)
  )
  let toClassifyHit = 0
  let unattributedCount = 0

  for (const m of filtered) {
    if (m.status === 'draft') drafts += 1
    if (m.status === 'pending_account') pendingAccount += 1
    if (
      m.direction === 'reversal' &&
      (m.status === 'posted' || m.status === 'pending_account') &&
      (!m.reverses_movement_id || !originalById.has(m.reverses_movement_id))
    ) {
      unattributedCount += 1
    }
    if (
      (m.status === 'posted' || m.status === 'pending_account') &&
      m.direction !== 'reversal'
    ) {
      if (!m.category_id) withoutCategory += 1
      if (!m.account_id) withoutAccount += 1
      if (m.category_id && toClassifyCategoryIds.has(m.category_id)) toClassifyHit += 1
      if (requiresDocumentCheck(m)) {
        documentableCount += 1
        if (isMovementDocumented(m)) documentedCount += 1
        else withoutDocument += 1
      }
    }
  }

  const completeness: ConsuntivoCompleteness = {
    withoutCategory,
    withoutAccount,
    withoutDocument,
    drafts,
    pendingAccount,
    unattributedReversals: unattributedCount,
    toClassifyCategories: toClassifyHit,
    documentedCount,
    documentableCount,
    documentationPercent: safePercent(documentedCount, documentableCount)
  }

  const toVerifyCount =
    drafts + pendingAccount + unattributedCount + withoutCategory + withoutAccount

  const kpis: ConsuntivoKpis = {
    incomeCents,
    expenseCents,
    surplusCents: incomeCents - expenseCents,
    quoteResidualCents: params.fees?.residualCents ?? 0,
    toVerifyCount,
    documentationPercent: completeness.documentationPercent
  }

  const budgetCompare = params.hasActiveBudget
    ? buildConsuntivoBudgetCompare({
        budgetLines: params.budgetLines,
        fees: params.fees,
        quoteCategory: params.quoteCategory,
        actualByCategory: effectiveCategory.byCategory,
        actualIncomeCents: incomeCents,
        actualExpenseCents: expenseCents
      })
    : []

  return {
    kpis,
    categories,
    categoryGroups,
    budgetCompare,
    hasActiveBudget: params.hasActiveBudget,
    accounts,
    completeness
  }
}

export function consuntivoReportToCsv(report: ConsuntivoReport, fiscalYearCode: string): string {
  const lines: string[] = []
  const esc = (v: string | number) => {
    const s = String(v)
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  lines.push('Rendiconto gestionale provvisorio — non ancora chiuso')
  lines.push(`Esercizio;${esc(fiscalYearCode)}`)
  lines.push('')
  lines.push('KPI')
  lines.push('Voce;Centesimi')
  lines.push(`Entrate;${report.kpis.incomeCents}`)
  lines.push(`Uscite;${report.kpis.expenseCents}`)
  lines.push(`Avanzo/disavanzo;${report.kpis.surplusCents}`)
  lines.push(`Crediti Quote da incassare;${report.kpis.quoteResidualCents}`)
  lines.push(`Movimenti da verificare;${report.kpis.toVerifyCount}`)
  lines.push(
    `Completezza documentale %;${
      report.kpis.documentationPercent === null
        ? ''
        : report.kpis.documentationPercent.toFixed(1)
    }`
  )
  lines.push('')
  lines.push('Rendiconto per macro-categoria e categoria')
  lines.push('Livello;Codice;Nome;Natura;Entrate;Uscite;Saldo;N.movimenti;Anomalie')
  for (const group of report.categoryGroups) {
    lines.push(
      [
        'Macro-categoria',
        group.groupCode,
        group.groupName,
        group.isLegacy ? 'legacy' : '',
        group.incomeCents,
        group.expenseCents,
        group.balanceCents,
        group.movementCount,
        group.isLegacy ? 'Storico senza macro-categoria' : ''
      ]
        .map(esc)
        .join(';')
    )
    for (const r of group.categories) {
      lines.push(
        [
          'Categoria',
          r.categoryCode,
          r.categoryName,
          r.nature,
          r.incomeCents,
          r.expenseCents,
          r.balanceCents,
          r.movementCount,
          [
            ...r.anomalies,
            r.isInactive ? 'Categoria non attiva' : null,
            r.isArchived ? 'Categoria archiviata' : null
          ]
            .filter(Boolean)
            .join(' | ')
        ]
          .map(esc)
          .join(';')
      )
    }
  }
  lines.push('')
  lines.push('Confronto preventivo')
  if (!report.hasActiveBudget) {
    lines.push('Nessun preventivo approvato')
  } else {
    lines.push('Voce;Direzione;Previsto;Consuntivo;Scostamento;% realizzazione')
    for (const r of report.budgetCompare) {
      lines.push(
        [
          r.label,
          r.direction,
          r.plannedCents,
          r.actualCents,
          r.varianceCents,
          r.realizationPercent === null ? '' : r.realizationPercent.toFixed(1)
        ]
          .map(esc)
          .join(';')
      )
    }
  }
  lines.push('')
  lines.push('Situazione per conto (movimenti netti — non saldo bancario riconciliato)')
  lines.push('Conto;Nome;Netto posted;Pending account;N.posted;N.pending')
  for (const a of report.accounts) {
    lines.push(
      [
        a.accountCode,
        a.accountName,
        a.netPostedCents,
        a.pendingAccountCents,
        a.movementCountPosted,
        a.movementCountPending
      ]
        .map(esc)
        .join(';')
    )
  }
  lines.push('')
  lines.push('Controlli completezza')
  lines.push('Controllo;Valore')
  lines.push(`Senza categoria;${report.completeness.withoutCategory}`)
  lines.push(`Senza conto;${report.completeness.withoutAccount}`)
  lines.push(`Senza documento;${report.completeness.withoutDocument}`)
  lines.push(`Bozze;${report.completeness.drafts}`)
  lines.push(`Pending account;${report.completeness.pendingAccount}`)
  lines.push(`Storni senza originale;${report.completeness.unattributedReversals}`)
  lines.push(`Categorie to_classify;${report.completeness.toClassifyCategories}`)

  return lines.join('\n')
}

export function downloadConsuntivoCsv(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
