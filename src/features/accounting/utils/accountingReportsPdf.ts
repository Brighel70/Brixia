import { formatFeeAmount } from '@/utils/feeUtils'
import { getBrandConfig } from '@/config/brand'
import type {
  AccountingBudget,
  AccountingCategoryRef,
  AccountingFiscalYear,
  AccountingMovement,
  AccountingSummary,
  BudgetComparisonRow,
  BudgetOverviewTotals,
  ConsuntivoBudgetCompareRow,
  ConsuntivoReport,
  MovementsFilterState
} from '../types'
import { movementDirectionLabel, movementStatusLabel } from './labels'
import { generateTextPdfBlob, openPdfPreview } from './documentTemplates'

export type AccountingPdfDetailLevel = 'macro' | 'detail'

type ReportCell = { value: string | number | null | undefined; amount?: boolean }
type ReportGroup = { label: string; meta: string; rows: ReportCell[][] }
type ComparisonReportGroup = {
  label: string
  plannedCents: number
  actualCents: number
  rows: ReportCell[][]
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function signedAmount(cents: number): string {
  if (cents > 0) return `+${formatFeeAmount(cents)}`
  if (cents < 0) return `-${formatFeeAmount(Math.abs(cents))}`
  return formatFeeAmount(0)
}

function amountWithTrailingEuro(cents: number): string {
  const numericPart = formatFeeAmount(Math.abs(cents)).replace(/^[^0-9]+/, '')
  return `${numericPart} €`
}

function signedAmountWithTrailingEuro(cents: number): string {
  if (cents > 0) return `+${amountWithTrailingEuro(cents)}`
  if (cents < 0) return `-${amountWithTrailingEuro(cents)}`
  return amountWithTrailingEuro(0)
}

function reportTable(
  headers: string[],
  rows: ReportCell[][],
  rightAlignedHeaderIndexes: number[] = []
): string {
  if (rows.length === 0) {
    return '<p class="report-note">Nessuna voce in questa sezione.</p>'
  }

  return `
    <table class="report-table">
      <thead><tr>${headers
        .map(
          (header, index) =>
            `<th${rightAlignedHeaderIndexes.includes(index) ? ' class="amount-header"' : ''}>${escapeHtml(header)}</th>`
        )
        .join('')}</tr></thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell) =>
                    `<td${cell.amount ? ' class="amount"' : ''}>${escapeHtml(cell.value)}</td>`
                )
                .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
  `
}

function reportGroupedTable(
  headers: string[],
  groups: ReportGroup[],
  rightAlignedHeaderIndexes: number[] = []
): string {
  if (groups.length === 0) {
    return '<p class="report-note">Nessuna voce in questa sezione.</p>'
  }

  return `
    <table class="report-table report-grouped-table">
      <thead><tr>${headers
        .map(
          (header, index) =>
            `<th${rightAlignedHeaderIndexes.includes(index) ? ' class="amount-header"' : ''}>${escapeHtml(header)}</th>`
        )
        .join('')}</tr></thead>
      <tbody>
        ${groups
          .map(
            (group) => `
              <tr class="report-group-row">
                <td colspan="${headers.length}">
                  <span>${escapeHtml(group.label)}</span>
                  <small>${escapeHtml(group.meta)}</small>
                </td>
              </tr>
              ${group.rows
                .map(
                  (row) =>
                    `<tr>${row
                      .map(
                        (cell) =>
                          `<td${cell.amount ? ' class="amount"' : ''}>${escapeHtml(cell.value)}</td>`
                      )
                      .join('')}</tr>`
                )
                .join('')}`
          )
          .join('')}
      </tbody>
    </table>
  `
}

function reportHeader(title: string, subtitle: string, eyebrow: string): string {
  return `
    <div class="report-header">
      <p class="report-eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </div>
  `
}

function reportKpis(items: Array<{ label: string; value: string }>): string {
  return `<div class="report-grid">${items
    .map(
      (item) => `
        <div class="report-kpi">
          <div class="report-kpi-label">${escapeHtml(item.label)}</div>
          <div class="report-kpi-value">${escapeHtml(item.value)}</div>
        </div>`
    )
    .join('')}</div>`
}

function reportSection(title: string, content: string, expense = false): string {
  return `
    <section class="report-section">
      <h2 class="report-section-title${expense ? ' expense' : ''}">${escapeHtml(title)}</h2>
      ${content}
    </section>
  `
}

async function previewPdf(
  title: string,
  body: string,
  options: { orientation?: 'portrait' | 'landscape'; previewWindow?: Window | null } = {}
): Promise<void> {
  const blob = await generateTextPdfBlob(title, body, {
    orientation: options.orientation,
    report: true
  })
  openPdfPreview(blob, options.previewWindow)
}

function categoryGroupLabel(
  row: BudgetComparisonRow,
  categoryById: Map<string, AccountingCategoryRef>
): string {
  const category = row.categoryId ? categoryById.get(row.categoryId) : undefined
  return category?.group?.name ?? (row.direction === 'income' ? 'Entrate senza macro-categoria' : 'Uscite senza macro-categoria')
}

function budgetRowsForLevel(
  rows: BudgetComparisonRow[],
  categoryById: Map<string, AccountingCategoryRef>,
  direction: 'income' | 'expense',
  detailLevel: AccountingPdfDetailLevel
): ReportCell[][] {
  const selected = rows.filter((row) => row.direction === direction)
  if (detailLevel === 'detail') {
    return selected.map((row) => [
      { value: categoryGroupLabel(row, categoryById) },
      { value: `${row.categoryCode} - ${row.description}` },
      { value: formatFeeAmount(row.plannedCents), amount: true }
    ])
  }

  const totals = new Map<string, number>()
  for (const row of selected) {
    const key = categoryGroupLabel(row, categoryById)
    totals.set(key, (totals.get(key) ?? 0) + row.plannedCents)
  }

  return [...totals.entries()].map(([group, total]) => [
    { value: group },
    { value: formatFeeAmount(total), amount: true }
  ])
}

function budgetGroupsForDetail(
  rows: BudgetComparisonRow[],
  categoryById: Map<string, AccountingCategoryRef>,
  direction: 'income' | 'expense'
): ReportGroup[] {
  const groups = new Map<string, { totalCents: number; rows: ReportCell[][] }>()
  for (const row of rows.filter((item) => item.direction === direction)) {
    const label = categoryGroupLabel(row, categoryById)
    const current = groups.get(label) ?? { totalCents: 0, rows: [] }
    current.totalCents += row.plannedCents
    current.rows.push([
      { value: row.description },
      { value: formatFeeAmount(row.plannedCents), amount: true }
    ])
    groups.set(label, current)
  }

  return [...groups.entries()].map(([label, group]) => ({
    label,
    meta: `Totale previsto ${formatFeeAmount(group.totalCents)}`,
    rows: group.rows
  }))
}

export async function previewBudgetPdf(input: {
  fiscalYear: AccountingFiscalYear
  budget: AccountingBudget
  rows: BudgetComparisonRow[]
  totals: BudgetOverviewTotals | null
  categories: AccountingCategoryRef[]
  detailLevel: AccountingPdfDetailLevel
  previewWindow?: Window | null
}): Promise<void> {
  const { fiscalYear, budget, rows, totals, categories, detailLevel } = input
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const isDetail = detailLevel === 'detail'
  const incomeRows = budgetRowsForLevel(rows, categoryById, 'income', detailLevel)
  const expenseRows = budgetRowsForLevel(rows, categoryById, 'expense', detailLevel)
  const headers = isDetail
    ? ['Macro-categoria', 'Sotto-categoria / voce', 'Importo previsto']
    : ['Macro-categoria', 'Importo previsto']
  const clubName = getBrandConfig().clubName || 'Associazione sportiva'

  const body = `
    ${reportHeader(
      'Bilancio preventivo',
      `${clubName} - esercizio ${fiscalYear.code} - versione ${budget.version} - ${budget.status === 'approved' ? 'Approvato' : 'Bozza'}`,
      isDetail ? 'Piano economico-finanziario: macro e sotto-categorie' : 'Piano economico-finanziario: sintesi per macro-categorie'
    )}
    ${
      totals
        ? reportKpis([
            { label: 'Entrate previste', value: amountWithTrailingEuro(totals.plannedIncomeCents) },
            { label: 'Uscite previste', value: amountWithTrailingEuro(totals.plannedExpenseCents) },
            { label: 'Avanzo previsto', value: signedAmountWithTrailingEuro(totals.plannedSurplusCents) }
          ])
        : ''
    }
    ${reportSection(
      'Entrate previste',
      isDetail
        ? reportGroupedTable(
            ['Sotto-categoria / voce', 'Importo previsto'],
            budgetGroupsForDetail(rows, categoryById, 'income')
          )
        : reportTable(headers, incomeRows)
    )}
    ${reportSection(
      'Uscite previste',
      isDetail
        ? reportGroupedTable(
            ['Sotto-categoria / voce', 'Importo previsto'],
            budgetGroupsForDetail(rows, categoryById, 'expense')
          )
        : reportTable(headers, expenseRows),
      true
    )}
    <p class="report-note">Documento previsionale: non include gli importi effettivamente incassati o pagati.</p>
    ${budget.notes ? `<p class="report-note"><strong>Note:</strong> ${escapeHtml(budget.notes)}</p>` : ''}
  `

  await previewPdf(`Bilancio preventivo ${fiscalYear.code}`, body, {
    previewWindow: input.previewWindow
  })
}

function filtersDescription(filters: MovementsFilterState): string {
  const parts: string[] = []
  if (filters.dateFrom) parts.push(`dal ${formatDate(filters.dateFrom)}`)
  if (filters.dateTo) parts.push(`al ${formatDate(filters.dateTo)}`)
  if (filters.direction !== 'all') parts.push(movementDirectionLabel(filters.direction))
  if (filters.status !== 'all') parts.push(movementStatusLabel(filters.status))
  if (filters.search.trim()) parts.push(`ricerca: ${filters.search.trim()}`)
  return parts.length > 0 ? parts.join(' - ') : 'Nessun filtro applicato'
}

export async function previewMovementsPdf(input: {
  fiscalYear: AccountingFiscalYear
  filters: MovementsFilterState
  movements: AccountingMovement[]
  summary: AccountingSummary | null
  previewWindow?: Window | null
}): Promise<void> {
  const { fiscalYear, filters, movements, summary } = input
  const clubName = getBrandConfig().clubName || 'Associazione sportiva'
  const body = `
    ${reportHeader('Prima nota', `${clubName} - esercizio ${fiscalYear.code} - ${movements.length} movimenti inclusi`, 'Registro cronologico di cassa e banca')}
    ${
      summary
        ? reportKpis([
            { label: 'Entrate incassate', value: amountWithTrailingEuro(summary.incomeCents) },
            { label: 'Uscite contabilizzate', value: amountWithTrailingEuro(summary.expenseCents) },
            { label: 'Saldo esercizio', value: signedAmountWithTrailingEuro(summary.balanceCents) },
            { label: 'Crediti da incassare', value: amountWithTrailingEuro(summary.residualCreditsCents) },
            { label: 'Da verificare', value: String(summary.pendingReviewCount) }
          ])
        : ''
    }
    <p class="report-note"><strong>Filtri applicati:</strong> ${escapeHtml(filtersDescription(filters))}</p>
    ${reportSection(
      'Movimenti',
      reportTable(
        ['Data', 'Documento', 'Descrizione / causale', 'Conto', 'Entrate', 'Uscite', 'Storno / giroconto', 'Stato'],
        movements.map((movement) => [
          { value: formatDate(movement.movement_date) },
          { value: movement.document_number || movement.reference || '-' },
          { value: `${movement.description}${movement.category ? ` - ${movement.category.name}` : ''}` },
          {
            value:
              movement.direction === 'transfer' && movement.transfer_account
                ? `${movement.account?.name ?? '-'} -> ${movement.transfer_account.name}`
                : movement.account?.name
          },
          { value: movement.direction === 'income' ? formatFeeAmount(movement.amount_cents) : '-', amount: true },
          { value: movement.direction === 'expense' ? formatFeeAmount(movement.amount_cents) : '-', amount: true },
          {
            value:
              movement.direction === 'reversal' || movement.direction === 'transfer'
                ? `${movementDirectionLabel(movement.direction)} ${formatFeeAmount(movement.amount_cents)}`
                : '-',
            amount: true
          },
          { value: movementStatusLabel(movement.status) },
        ])
      )
    )}
    <p class="report-note">Il riepilogo include i movimenti contabilizzati dell'esercizio. Le righe in bozza, annullate o stornate restano visibili nel registro con il relativo stato.</p>
  `

  await previewPdf(`Prima nota ${fiscalYear.code}`, body, {
    orientation: 'landscape',
    previewWindow: input.previewWindow
  })
}

function consuntivoRowsForLevel(
  report: ConsuntivoReport,
  detailLevel: AccountingPdfDetailLevel,
  direction: 'income' | 'expense'
): ReportCell[][] {
  if (detailLevel === 'macro') {
    return report.categoryGroups
      .filter((group) => (direction === 'income' ? group.incomeCents : group.expenseCents) !== 0)
      .map((group) => [
        { value: group.groupName },
        {
          value: formatFeeAmount(direction === 'income' ? group.incomeCents : group.expenseCents),
          amount: true
        }
      ])
  }

  return report.categoryGroups.flatMap((group) =>
    group.categories
      .filter((category) => (direction === 'income' ? category.incomeCents : category.expenseCents) !== 0)
      .map((category) => [
        { value: group.groupName },
        { value: `${category.categoryCode} - ${category.categoryName}` },
        {
          value: formatFeeAmount(direction === 'income' ? category.incomeCents : category.expenseCents),
          amount: true
        }
      ])
  )
}

function consuntivoGroupsForDetail(
  report: ConsuntivoReport,
  direction: 'income' | 'expense'
): ReportGroup[] {
  return report.categoryGroups
    .map((group) => {
      const rows = group.categories
        .filter((category) => (direction === 'income' ? category.incomeCents : category.expenseCents) !== 0)
        .map((category) => [
          { value: category.categoryName },
          {
            value: formatFeeAmount(direction === 'income' ? category.incomeCents : category.expenseCents),
            amount: true
          }
        ])
      const totalCents = direction === 'income' ? group.incomeCents : group.expenseCents
      return {
        label: group.groupName,
        meta: `Totale effettivo ${formatFeeAmount(totalCents)}`,
        rows
      }
    })
    .filter((group) => group.rows.length > 0)
}

export async function previewConsuntivoPdf(input: {
  fiscalYear: AccountingFiscalYear
  report: ConsuntivoReport
  detailLevel: AccountingPdfDetailLevel
  previewWindow?: Window | null
}): Promise<void> {
  const { fiscalYear, report, detailLevel } = input
  const isDetail = detailLevel === 'detail'
  const headers = isDetail
    ? ['Macro-categoria', 'Sotto-categoria', 'Importo']
    : ['Macro-categoria', 'Importo']
  const clubName = getBrandConfig().clubName || 'Associazione sportiva'
  const body = `
    ${reportHeader(
      'Rendiconto gestionale',
      `${clubName} - esercizio ${fiscalYear.code} - dati provvisori sui movimenti contabilizzati`,
      isDetail ? 'Rendiconto per cassa: macro e sotto-categorie' : 'Rendiconto per cassa: sintesi per macro-categorie'
    )}
    ${reportKpis([
      { label: 'Entrate', value: amountWithTrailingEuro(report.kpis.incomeCents) },
      { label: 'Uscite', value: amountWithTrailingEuro(report.kpis.expenseCents) },
      { label: 'Saldo', value: signedAmountWithTrailingEuro(report.kpis.surplusCents) },
      { label: 'Crediti quote', value: amountWithTrailingEuro(report.kpis.quoteResidualCents) }
    ])}
    ${reportSection(
      'Entrate della gestione',
      isDetail
        ? reportGroupedTable(
            ['Sotto-categoria', 'Importo'],
            consuntivoGroupsForDetail(report, 'income')
          )
        : reportTable(headers, consuntivoRowsForLevel(report, detailLevel, 'income'))
    )}
    ${reportSection(
      'Uscite della gestione',
      isDetail
        ? reportGroupedTable(
            ['Sotto-categoria', 'Importo'],
            consuntivoGroupsForDetail(report, 'expense')
          )
        : reportTable(headers, consuntivoRowsForLevel(report, detailLevel, 'expense')),
      true
    )}
    ${reportSection(
      'Risultato della gestione',
      reportTable(['Totale entrate', 'Totale uscite', 'Avanzo / disavanzo'], [[
        { value: formatFeeAmount(report.kpis.incomeCents), amount: true },
        { value: formatFeeAmount(report.kpis.expenseCents), amount: true },
        { value: signedAmount(report.kpis.surplusCents), amount: true }
      ]])
    )}
    ${reportSection(
      'Situazione per conto',
      reportTable(
        ['Conto', 'Netto contabilizzato', 'Da assegnare', 'Movimenti contabilizzati'],
        report.accounts.map((account) => [
          { value: `${account.accountCode} - ${account.accountName}` },
          { value: signedAmount(account.netPostedCents), amount: true },
          { value: formatFeeAmount(account.pendingAccountCents), amount: true },
          { value: account.movementCountPosted, amount: true }
        ])
      )
    )}
  `

  await previewPdf(`Consuntivo ${fiscalYear.code}`, body, {
    previewWindow: input.previewWindow
  })
}

function comparisonGroupLabel(
  row: ConsuntivoBudgetCompareRow,
  categoryById: Map<string, AccountingCategoryRef>
): string {
  if (row.key === 'fees_live') return 'Quote associative e sportive'
  const category = row.categoryId ? categoryById.get(row.categoryId) : undefined
  return category?.group?.name ?? 'Voci senza macro-categoria'
}

function comparisonRowsForLevel(
  rows: ConsuntivoBudgetCompareRow[],
  categories: AccountingCategoryRef[],
  direction: 'income' | 'expense',
  detailLevel: AccountingPdfDetailLevel
): ReportCell[][] {
  const selected = rows.filter((row) => row.direction === direction)
  if (detailLevel === 'detail') {
    const categoryById = new Map(categories.map((category) => [category.id, category]))
    return selected.map((row) => [
      { value: comparisonGroupLabel(row, categoryById) },
      { value: row.label },
      { value: formatFeeAmount(row.plannedCents), amount: true },
      { value: formatFeeAmount(row.actualCents), amount: true },
      { value: signedAmount(row.varianceCents), amount: true },
      {
        value: row.realizationPercent === null ? '-' : `${row.realizationPercent.toFixed(1)}%`,
        amount: true
      }
    ])
  }

  const totals = new Map<string, { plannedCents: number; actualCents: number }>()
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  for (const row of selected) {
    const group = comparisonGroupLabel(row, categoryById)
    const current = totals.get(group) ?? { plannedCents: 0, actualCents: 0 }
    current.plannedCents += row.plannedCents
    current.actualCents += row.actualCents
    totals.set(group, current)
  }

  return [...totals.entries()].map(([group, total]) => {
    const variance = total.actualCents - total.plannedCents
    const realization =
      total.plannedCents === 0 ? null : (total.actualCents / total.plannedCents) * 100
    return [
      { value: group },
      { value: formatFeeAmount(total.plannedCents), amount: true },
      { value: formatFeeAmount(total.actualCents), amount: true },
      { value: signedAmount(variance), amount: true },
      { value: realization === null ? '-' : `${realization.toFixed(1)}%`, amount: true }
    ]
  })
}

function comparisonGroupsForDetail(
  rows: ConsuntivoBudgetCompareRow[],
  categories: AccountingCategoryRef[],
  direction: 'income' | 'expense'
): ComparisonReportGroup[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const groups = new Map<string, { plannedCents: number; actualCents: number; rows: ReportCell[][] }>()
  for (const row of rows.filter((item) => item.direction === direction)) {
    const label = comparisonGroupLabel(row, categoryById)
    const current = groups.get(label) ?? { plannedCents: 0, actualCents: 0, rows: [] }
    current.plannedCents += row.plannedCents
    current.actualCents += row.actualCents
    current.rows.push([
      { value: row.label },
      { value: formatFeeAmount(row.plannedCents), amount: true },
      { value: formatFeeAmount(row.actualCents), amount: true },
      { value: signedAmount(row.varianceCents), amount: true },
      {
        value: row.realizationPercent === null ? '-' : `${row.realizationPercent.toFixed(1)}%`,
        amount: true
      }
    ])
    groups.set(label, current)
  }

  return [...groups.entries()].map(([label, group]) => ({
    label,
    plannedCents: group.plannedCents,
    actualCents: group.actualCents,
    rows: group.rows
  }))
}

function reportComparisonOverview(input: {
  plannedIncome: number
  actualIncome: number
  plannedExpense: number
  actualExpense: number
  plannedResult: number
  actualResult: number
}): string {
  const cards = [
    {
      label: 'Entrate',
      planned: input.plannedIncome,
      actual: input.actualIncome,
      tone: 'income'
    },
    {
      label: 'Uscite',
      planned: input.plannedExpense,
      actual: input.actualExpense,
      tone: 'expense'
    },
    {
      label: 'Risultato',
      planned: input.plannedResult,
      actual: input.actualResult,
      tone: 'result'
    }
  ]

  return `<div class="report-comparison-overview">${cards
    .map((card) => {
      const variance = card.actual - card.planned
      return `
        <section class="report-comparison-card ${card.tone}">
          <p>${escapeHtml(card.label)}</p>
          <div class="report-comparison-card-values">
            <span><small>Previsto</small><strong>${escapeHtml(amountWithTrailingEuro(card.planned))}</strong></span>
            <span><small>Effettivo</small><strong>${escapeHtml(amountWithTrailingEuro(card.actual))}</strong></span>
            <span><small>Differenza</small><strong>${escapeHtml(signedAmountWithTrailingEuro(variance))}</strong></span>
          </div>
        </section>`
    })
    .join('')}</div>`
}

function reportComparisonGroupsTable(groups: ComparisonReportGroup[]): string {
  if (groups.length === 0) {
    return '<p class="report-note">Nessuna voce in questa sezione.</p>'
  }

  return `<div class="report-comparison-groups">
    ${groups
      .map((group) => {
        const variance = group.actualCents - group.plannedCents
        const realization =
          group.plannedCents === 0 ? null : (group.actualCents / group.plannedCents) * 100
        return `
          <section class="report-comparison-group">
            <div class="report-comparison-group-heading">
              <div>
                <p>Macro-categoria</p>
                <h3>${escapeHtml(group.label)}</h3>
              </div>
              <div class="report-comparison-group-totals">
                <span><small>Previsto</small><strong>${escapeHtml(formatFeeAmount(group.plannedCents))}</strong></span>
                <span><small>Effettivo</small><strong>${escapeHtml(formatFeeAmount(group.actualCents))}</strong></span>
                <span><small>Scostamento</small><strong>${escapeHtml(signedAmount(variance))}</strong></span>
                <span><small>Realizzazione</small><strong>${realization === null ? '-' : `${realization.toFixed(1)}%`}</strong></span>
              </div>
            </div>
            ${reportTable(
              ['Sotto-categoria / voce', 'Previsto', 'Effettivo', 'Scostamento', '% realizzazione'],
              group.rows,
              [1, 2, 3, 4]
            )}
          </section>`
      })
      .join('')}
  </div>`
}

export async function previewBudgetComparisonPdf(input: {
  fiscalYear: AccountingFiscalYear
  report: ConsuntivoReport
  categories: AccountingCategoryRef[]
  detailLevel: AccountingPdfDetailLevel
  previewWindow?: Window | null
}): Promise<void> {
  const { fiscalYear, report, categories, detailLevel } = input
  const isDetail = detailLevel === 'detail'
  const incomeRows = comparisonRowsForLevel(
    report.budgetCompare,
    categories,
    'income',
    detailLevel
  )
  const expenseRows = comparisonRowsForLevel(
    report.budgetCompare,
    categories,
    'expense',
    detailLevel
  )
  const total = report.budgetCompare.find((row) => row.key === 'total')
  const plannedIncome = report.budgetCompare
    .filter((row) => row.direction === 'income')
    .reduce((sum, row) => sum + row.plannedCents, 0)
  const actualIncome = report.budgetCompare
    .filter((row) => row.direction === 'income')
    .reduce((sum, row) => sum + row.actualCents, 0)
  const plannedExpense = report.budgetCompare
    .filter((row) => row.direction === 'expense')
    .reduce((sum, row) => sum + row.plannedCents, 0)
  const actualExpense = report.budgetCompare
    .filter((row) => row.direction === 'expense')
    .reduce((sum, row) => sum + row.actualCents, 0)
  const headers = ['Macro-categoria', 'Previsto', 'Effettivo', 'Scostamento', '% realizzazione']
  const clubName = getBrandConfig().clubName || 'Associazione sportiva'

  const body = `
    ${reportHeader(
      'Confronto preventivo e consuntivo',
      `${clubName} - esercizio ${fiscalYear.code} - confronto sul preventivo corrente`,
      isDetail ? 'Report di controllo: macro-categorie e relative voci' : 'Report di controllo: sintesi per macro-categorie'
    )}
    ${reportComparisonOverview({
      plannedIncome,
      actualIncome,
      plannedExpense,
      actualExpense,
      plannedResult: total?.plannedCents ?? 0,
      actualResult: total?.actualCents ?? 0
    })}
    ${reportSection(
      'Entrate',
      isDetail
        ? reportComparisonGroupsTable(comparisonGroupsForDetail(report.budgetCompare, categories, 'income'))
        : reportTable(headers, incomeRows, [1, 2, 3, 4])
    )}
    ${reportSection(
      'Uscite',
      isDetail
        ? reportComparisonGroupsTable(comparisonGroupsForDetail(report.budgetCompare, categories, 'expense'))
        : reportTable(headers, expenseRows, [1, 2, 3, 4]),
      true
    )}
    ${reportSection(
      'Risultato della gestione',
      reportTable(
        ['Risultato previsto', 'Risultato effettivo', 'Scostamento', '% realizzazione'],
        [[
          { value: signedAmount(total?.plannedCents ?? 0), amount: true },
          { value: signedAmount(total?.actualCents ?? 0), amount: true },
          { value: signedAmount(total?.varianceCents ?? 0), amount: true },
          {
            value:
              total?.realizationPercent === null || total?.realizationPercent === undefined
                ? '-'
                : `${total.realizationPercent.toFixed(1)}%`,
            amount: true
          }
        ]],
        [0, 1, 2, 3]
      )
    )}
    <p class="report-note">Lo scostamento indica la differenza tra l'importo effettivo e quello preventivato. Un valore positivo non è automaticamente favorevole: per le entrate indica più incassi, per le uscite indica più costi.</p>
    <p class="report-note">Il confronto usa il preventivo attivo dell'esercizio. Se il preventivo è ancora in bozza, il documento ha valore gestionale provvisorio.</p>
  `

  await previewPdf(`Confronto preventivo-consuntivo ${fiscalYear.code}`, body, {
    orientation: 'landscape',
    previewWindow: input.previewWindow
  })
}
