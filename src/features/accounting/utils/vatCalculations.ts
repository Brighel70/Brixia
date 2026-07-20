import type {
  AccountingFiscalParamRow,
  CommercialDocument,
  CommercialDocumentStatus,
  CommercialVatOverview,
  VatPeriod
} from '../types'

/** Chiavi parametri usate dallo step 5A (mai hardcode percentuali in UI). */
export const VAT_PARAM_KEYS = {
  commercialLimit: 'commercial_revenue_limit',
  forfaitPct: 'vat_flat_deduction_pct',
  periodicity: 'vat_periodicity',
  rateSponsorship: 'vat_rate_sponsorship',
  rounding: 'vat_rounding_method'
} as const

export function roundHalfUpCents(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.sign(value) * Math.round(Math.abs(value))
}

export function percentToBasisPoints(percent: number): number {
  return roundHalfUpCents(percent * 100)
}

export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / 100
}

/**
 * IVA da imponibile.
 * basis points: 2200 = 22%. Metodo di default half_up_cent (da parametri).
 */
export function computeVatAmountCents(
  taxableCents: number,
  vatRateBasisPoints: number,
  roundingMethod: string | null = 'half_up_cent'
): number {
  if (taxableCents < 0 || vatRateBasisPoints < 0) return 0
  const raw = (taxableCents * vatRateBasisPoints) / 10000
  if (roundingMethod === 'half_up_cent' || !roundingMethod) {
    return roundHalfUpCents(raw)
  }
  // Fallback esplicito: stesso half_up finché non esistono altri metodi verificati.
  return roundHalfUpCents(raw)
}

export function computeGrossCents(taxableCents: number, vatCents: number): number {
  return taxableCents + vatCents
}

export function computeForfaitDeductionCents(
  outputVatCents: number,
  forfaitPercent: number
): number {
  if (outputVatCents < 0 || forfaitPercent < 0) return 0
  return roundHalfUpCents((outputVatCents * forfaitPercent) / 100)
}

/** IVA stimata da versare: mai negativa senza regola esplicita (floor a 0). */
export function computeEstimatedVatDueCents(
  outputVatCents: number,
  forfaitDeductionCents: number
): number {
  return Math.max(0, outputVatCents - forfaitDeductionCents)
}

export function parseParamNumeric(valueJson: unknown): number | null {
  if (typeof valueJson === 'number' && Number.isFinite(valueJson)) return valueJson
  if (typeof valueJson === 'string' && valueJson.trim() !== '') {
    const n = Number(valueJson)
    return Number.isFinite(n) ? n : null
  }
  if (valueJson && typeof valueJson === 'object' && !Array.isArray(valueJson)) {
    // jsonb scalare a volte arriva già decoificato
    return null
  }
  // jsonb number serializzato come primitiva già gestito; stringhe JSON pure:
  if (typeof valueJson === 'boolean') return null
  try {
    if (typeof valueJson === 'string') {
      const parsed = JSON.parse(valueJson)
      return parseParamNumeric(parsed)
    }
  } catch {
    /* ignore */
  }
  return null
}

export function resolveFiscalParamAtDate(
  rows: AccountingFiscalParamRow[],
  paramKey: string,
  onDate: string
): AccountingFiscalParamRow | null {
  const candidates = rows
    .filter((r) => r.param_key === paramKey)
    .filter((r) => r.valid_from <= onDate && (r.valid_to == null || r.valid_to >= onDate))
    .sort((a, b) => (a.valid_from < b.valid_from ? 1 : a.valid_from > b.valid_from ? -1 : 0))
  return candidates[0] ?? null
}

export function quarterFromDate(isoDate: string): { year: number; quarter: number } {
  const [y, m] = isoDate.split('-').map(Number)
  const month = m || 1
  const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4
  return { year: y, quarter }
}

export function indicativeVatDueOn(year: number, quarter: number): string {
  if (quarter === 1) return `${year}-05-16`
  if (quarter === 2) return `${year}-08-20`
  if (quarter === 3) return `${year}-11-16`
  return `${year + 1}-02-16`
}

export function isVatCountableStatus(status: CommercialDocumentStatus): boolean {
  return (
    status === 'issued' ||
    status === 'partially_collected' ||
    status === 'collected'
  )
}

/** Movimento che conta come incasso effettivo (allineato alla RPC). */
export function isPaymentMovementEffective(status: string | undefined | null): boolean {
  return status === 'posted'
}

export function sumEffectiveAllocatedCents(
  payments: Array<{ allocated_amount_cents: number; movement?: { status?: string } | null }>
): number {
  return payments.reduce((sum, p) => {
    if (!isPaymentMovementEffective(p.movement?.status)) return sum
    return sum + p.allocated_amount_cents
  }, 0)
}

export function computeDocumentCollection(doc: {
  gross_amount_cents: number
  payments?: Array<{ allocated_amount_cents: number; movement?: { status?: string } | null }>
}): {
  collectedCents: number
  residualCents: number
  needsReconciliation: boolean
} {
  const payments = doc.payments ?? []
  const collectedCents = sumEffectiveAllocatedCents(payments)
  const residualCents = Math.max(0, doc.gross_amount_cents - collectedCents)
  const needsReconciliation = payments.some(
    (p) => p.movement?.status && !isPaymentMovementEffective(p.movement.status)
  )
  return { collectedCents, residualCents, needsReconciliation }
}

export function canAllocateAmount(params: {
  allocateCents: number
  documentResidualCents: number
  movementAmountCents: number
  movementAlreadyAllocatedCents: number
}): { ok: boolean; reason?: string } {
  if (params.allocateCents <= 0) return { ok: false, reason: 'Importo deve essere > 0' }
  if (params.allocateCents > params.documentResidualCents) {
    return { ok: false, reason: 'Sovra-allocazione documento' }
  }
  const movResidual = params.movementAmountCents - params.movementAlreadyAllocatedCents
  if (params.allocateCents > movResidual) {
    return { ok: false, reason: 'Sovra-allocazione movimento' }
  }
  return { ok: true }
}

/**
 * Trimestre IVA: usa document_date (criterio gestionale).
 * Il momento impositivo fiscale deve essere confermato dal commercialista.
 */
export function vatPeriodFromDocumentDate(documentDate: string): {
  year: number
  quarter: number
  criterion: 'document_date'
} {
  const { year, quarter } = quarterFromDate(documentDate)
  return { year, quarter, criterion: 'document_date' }
}

/**
 * Totali live (imponibile / IVA) per trimestre da documenti emessi.
 * Allineato a accounting_vat_period_calculate (document_date + status countable).
 */
export function liveVatTotalsByQuarter(
  documents: Pick<
    CommercialDocument,
    'document_date' | 'status' | 'taxable_amount_cents' | 'vat_amount_cents'
  >[]
): Map<string, { year: number; quarter: number; taxableCents: number; outputVatCents: number }> {
  const map = new Map<
    string,
    { year: number; quarter: number; taxableCents: number; outputVatCents: number }
  >()
  for (const doc of documents) {
    if (!isVatCountableStatus(doc.status) || !doc.document_date) continue
    const { year, quarter } = quarterFromDate(doc.document_date)
    const key = `${year}-${quarter}`
    const prev = map.get(key) ?? { year, quarter, taxableCents: 0, outputVatCents: 0 }
    prev.taxableCents += doc.taxable_amount_cents
    prev.outputVatCents += doc.vat_amount_cents
    map.set(key, prev)
  }
  return map
}

/**
 * Trimestri open/calculated (o assenti) non allineati ai documenti emessi.
 * verified/paid non rientrano: non vanno sovrascritti.
 */
export function quartersNeedingVatRecalc(
  documents: Pick<
    CommercialDocument,
    'document_date' | 'status' | 'taxable_amount_cents' | 'vat_amount_cents'
  >[],
  periods: Pick<VatPeriod, 'year' | 'quarter' | 'status' | 'commercial_taxable_cents' | 'output_vat_cents'>[]
): Array<{ year: number; quarter: number }> {
  const live = liveVatTotalsByQuarter(documents)
  const out: Array<{ year: number; quarter: number }> = []
  const seen = new Set<string>()

  for (const [key, totals] of live) {
    const period = periods.find((p) => p.year === totals.year && p.quarter === totals.quarter)
    if (period?.status === 'verified' || period?.status === 'paid') continue
    const storedTaxable = period?.commercial_taxable_cents ?? 0
    const storedVat = period?.output_vat_cents ?? 0
    if (storedTaxable !== totals.taxableCents || storedVat !== totals.outputVatCents) {
      out.push({ year: totals.year, quarter: totals.quarter })
      seen.add(key)
    }
  }

  // Periodo calcolato con importi > 0 ma senza più documenti in quel trimestre.
  for (const period of periods) {
    if (period.status === 'verified' || period.status === 'paid') continue
    const key = `${period.year}-${period.quarter}`
    if (seen.has(key)) continue
    if (!live.has(key) && (period.commercial_taxable_cents !== 0 || period.output_vat_cents !== 0)) {
      out.push({ year: period.year, quarter: period.quarter })
    }
  }

  return out
}

export function isLimitCountableDocument(doc: Pick<
  CommercialDocument,
  'include_in_398_limit' | 'status'
>): boolean {
  return doc.include_in_398_limit && doc.status !== 'cancelled'
}

export function safePercent(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null
  }
  return (numerator / denominator) * 100
}

export function limitThresholdLevel(
  usedPercent: number | null
): 'ok' | 'warn70' | 'warn85' | 'over100' | 'unknown' {
  if (usedPercent === null) return 'unknown'
  if (usedPercent >= 100) return 'over100'
  if (usedPercent >= 85) return 'warn85'
  if (usedPercent >= 70) return 'warn70'
  return 'ok'
}

export function buildCommercialVatOverview(params: {
  documents: CommercialDocument[]
  fiscalParams: AccountingFiscalParamRow[]
  asOfDate: string
  toClassifyMovements: number
}): CommercialVatOverview {
  const { documents, fiscalParams, asOfDate, toClassifyMovements } = params

  const limitParam = resolveFiscalParamAtDate(
    fiscalParams,
    VAT_PARAM_KEYS.commercialLimit,
    asOfDate
  )
  const forfaitParam = resolveFiscalParamAtDate(
    fiscalParams,
    VAT_PARAM_KEYS.forfaitPct,
    asOfDate
  )
  const rateParam = resolveFiscalParamAtDate(
    fiscalParams,
    VAT_PARAM_KEYS.rateSponsorship,
    asOfDate
  )
  const roundingParam = resolveFiscalParamAtDate(
    fiscalParams,
    VAT_PARAM_KEYS.rounding,
    asOfDate
  )
  const periodicityParam = resolveFiscalParamAtDate(
    fiscalParams,
    VAT_PARAM_KEYS.periodicity,
    asOfDate
  )

  const relevant = [limitParam, forfaitParam, rateParam, roundingParam, periodicityParam].filter(
    Boolean
  ) as AccountingFiscalParamRow[]
  const unverifiedParamKeys = relevant
    .filter((p) => p.verification_status !== 'verified')
    .map((p) => p.param_key)
  // Parametri mancanti = da confermare
  for (const key of Object.values(VAT_PARAM_KEYS)) {
    if (!resolveFiscalParamAtDate(fiscalParams, key, asOfDate)) {
      unverifiedParamKeys.push(`${key} (assente)`)
    }
  }

  const vatDocs = documents.filter((d) => isVatCountableStatus(d.status))
  const commercialRevenueCents = vatDocs.reduce((s, d) => s + d.gross_amount_cents, 0)
  const sponsorshipRevenueCents = vatDocs
    .filter((d) => d.commercial_kind === 'sponsorship')
    .reduce((s, d) => s + d.gross_amount_cents, 0)
  const taxableCents = vatDocs.reduce((s, d) => s + d.taxable_amount_cents, 0)
  const outputVatCents = vatDocs.reduce((s, d) => s + d.vat_amount_cents, 0)

  const forfaitPct = forfaitParam ? parseParamNumeric(forfaitParam.value_json) : null
  const ratePct = rateParam ? parseParamNumeric(rateParam.value_json) : null
  const limitRaw = limitParam ? parseParamNumeric(limitParam.value_json) : null
  const paramsMissing =
    !forfaitParam ||
    forfaitPct === null ||
    !rateParam ||
    ratePct === null ||
    !limitParam ||
    limitRaw === null ||
    !roundingParam ||
    !periodicityParam

  // Nessun fallback fiscale silenzioso: senza parametri → importi IVA stimati a 0 e flag.
  const forfaitDeductionCents =
    paramsMissing || forfaitPct === null
      ? 0
      : computeForfaitDeductionCents(outputVatCents, forfaitPct)
  const estimatedVatDueCents = paramsMissing
    ? 0
    : computeEstimatedVatDueCents(outputVatCents, forfaitDeductionCents)

  const limitCents = paramsMissing || limitRaw === null ? null : limitRaw
  const limitUsedCents = documents
    .filter(isLimitCountableDocument)
    .reduce((s, d) => s + d.taxable_amount_cents, 0)
  const limitResidualCents =
    limitCents === null ? null : Math.max(0, limitCents - limitUsedCents)
  const limitUsedPercent =
    limitCents === null ? null : safePercent(limitUsedCents, limitCents)
  const limitExceeded = limitCents !== null && limitUsedCents > limitCents

  const toClassifyDocuments = documents.filter(
    (d) =>
      d.status !== 'cancelled' &&
      (d.commercial_kind === 'other' || !d.counterparty_id)
  ).length

  return {
    commercialRevenueCents,
    sponsorshipRevenueCents,
    taxableCents,
    outputVatCents,
    forfaitDeductionCents,
    estimatedVatDueCents,
    limitCents,
    limitUsedCents,
    limitResidualCents,
    limitUsedPercent,
    limitExceeded,
    paramsAllVerified: unverifiedParamKeys.length === 0 && !paramsMissing,
    unverifiedParamKeys: [...new Set(unverifiedParamKeys)],
    paramsMissing,
    toClassifyDocuments,
    toClassifyMovements
  }
}
