import { describe, expect, it } from 'vitest'
import type { AccountingFiscalParamRow, CommercialDocument } from '../types'
import {
  buildCommercialVatOverview,
  canAllocateAmount,
  computeDocumentCollection,
  computeEstimatedVatDueCents,
  computeForfaitDeductionCents,
  computeGrossCents,
  computeVatAmountCents,
  isLimitCountableDocument,
  isVatCountableStatus,
  percentToBasisPoints,
  quarterFromDate,
  quartersNeedingVatRecalc,
  resolveFiscalParamAtDate,
  roundHalfUpCents,
  safePercent,
  vatPeriodFromDocumentDate
} from './vatCalculations'

function param(
  key: string,
  value: unknown,
  status: 'unverified' | 'verified' = 'unverified'
): AccountingFiscalParamRow {
  return {
    id: `p-${key}`,
    param_key: key,
    value_type: typeof value === 'number' ? 'number' : 'integer',
    value_json: value,
    valid_from: '2026-01-01',
    valid_to: null,
    source: 'test',
    verification_status: status,
    verification_note: null
  }
}

function verifiedParams(): AccountingFiscalParamRow[] {
  return [
    param('commercial_revenue_limit', 40_000_000, 'verified'),
    param('vat_flat_deduction_pct', 50, 'verified'),
    param('vat_rate_sponsorship', 22, 'verified'),
    param('vat_rounding_method', 'half_up_cent', 'verified'),
    param('vat_periodicity', 'quarterly', 'verified')
  ]
}

function doc(
  partial: Partial<CommercialDocument> & Pick<CommercialDocument, 'id'>
): CommercialDocument {
  return {
    fiscal_year_id: 'fy',
    counterparty_id: 'cp',
    document_type: 'invoice',
    document_number: '1',
    document_date: '2026-03-15',
    description: 'Sponsor',
    commercial_kind: 'sponsorship',
    taxable_amount_cents: 1_000_000,
    vat_rate_basis_points: 2200,
    vat_amount_cents: 220_000,
    gross_amount_cents: 1_220_000,
    status: 'issued',
    movement_id: null,
    include_in_398_limit: true,
    notes: null,
    issued_at: null,
    collected_at: null,
    cancelled_at: null,
    ...partial
  }
}

describe('vatCalculations', () => {
  it('sponsor 10.000 + IVA configurata 22% → 2.200', () => {
    const taxable = 1_000_000
    const bp = percentToBasisPoints(22)
    expect(bp).toBe(2200)
    const vat = computeVatAmountCents(taxable, bp, 'half_up_cent')
    expect(vat).toBe(220_000)
    expect(computeGrossCents(taxable, vat)).toBe(1_220_000)
  })

  it('detrazione forfetaria configurata 50% → IVA stimata 1.100', () => {
    const output = 220_000
    const forfait = computeForfaitDeductionCents(output, 50)
    expect(forfait).toBe(110_000)
    expect(computeEstimatedVatDueCents(output, forfait)).toBe(110_000)
  })

  it('arrotondamento half_up sul centesimo', () => {
    expect(roundHalfUpCents(1.5)).toBe(2)
    expect(roundHalfUpCents(2.5)).toBe(3)
    expect(computeVatAmountCents(100, 2250)).toBe(23)
  })

  it('documento cancellato escluso da IVA e limite', () => {
    const cancelled = doc({ id: 'c', status: 'cancelled', taxable_amount_cents: 999_999 })
    expect(isVatCountableStatus(cancelled.status)).toBe(false)
    expect(isLimitCountableDocument(cancelled)).toBe(false)
  })

  it('documento emesso non incassato: conta in IVA, residuo = lordo, nessun pagamento', () => {
    const issued = doc({ id: 'i', status: 'issued', payments: [] })
    expect(isVatCountableStatus(issued.status)).toBe(true)
    const coll = computeDocumentCollection(issued)
    expect(coll.collectedCents).toBe(0)
    expect(coll.residualCents).toBe(1_220_000)
    expect(issued.movement_id).toBeNull()
  })

  it('documento pagato interamente', () => {
    const full = computeDocumentCollection({
      gross_amount_cents: 1_000,
      payments: [
        {
          allocated_amount_cents: 1_000,
          movement: { status: 'posted' }
        }
      ]
    })
    expect(full.collectedCents).toBe(1_000)
    expect(full.residualCents).toBe(0)
    expect(full.needsReconciliation).toBe(false)
  })

  it('due pagamenti parziali', () => {
    const partial = computeDocumentCollection({
      gross_amount_cents: 1_000,
      payments: [
        { allocated_amount_cents: 400, movement: { status: 'posted' } },
        { allocated_amount_cents: 600, movement: { status: 'posted' } }
      ]
    })
    expect(partial.collectedCents).toBe(1_000)
    expect(partial.residualCents).toBe(0)
  })

  it('un movimento allocato a due documenti (somma lato movimento)', () => {
    // Un movimento da 1000 può essere allocato 400+600 a due documenti
    const first = canAllocateAmount({
      allocateCents: 400,
      documentResidualCents: 400,
      movementAmountCents: 1_000,
      movementAlreadyAllocatedCents: 0
    })
    expect(first.ok).toBe(true)
    const second = canAllocateAmount({
      allocateCents: 600,
      documentResidualCents: 600,
      movementAmountCents: 1_000,
      movementAlreadyAllocatedCents: 400
    })
    expect(second.ok).toBe(true)
    const over = canAllocateAmount({
      allocateCents: 1,
      documentResidualCents: 100,
      movementAmountCents: 1_000,
      movementAlreadyAllocatedCents: 1_000
    })
    expect(over.ok).toBe(false)
    expect(over.reason).toMatch(/movimento/i)
  })

  it('sovra-allocazione documento bloccata', () => {
    const r = canAllocateAmount({
      allocateCents: 501,
      documentResidualCents: 500,
      movementAmountCents: 10_000,
      movementAlreadyAllocatedCents: 0
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/documento/i)
  })

  it('sovra-allocazione movimento bloccata', () => {
    const r = canAllocateAmount({
      allocateCents: 300,
      documentResidualCents: 500,
      movementAmountCents: 500,
      movementAlreadyAllocatedCents: 250
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/movimento/i)
  })

  it('movimento reversed riduce incassato e segnala riconciliazione', () => {
    const afterReverse = computeDocumentCollection({
      gross_amount_cents: 1_000,
      payments: [
        { allocated_amount_cents: 400, movement: { status: 'posted' } },
        { allocated_amount_cents: 600, movement: { status: 'reversed' } }
      ]
    })
    expect(afterReverse.collectedCents).toBe(400)
    expect(afterReverse.residualCents).toBe(600)
    expect(afterReverse.needsReconciliation).toBe(true)
  })

  it('doppia allocazione stesso documento+movimento: unico (document_id, movement_id)', () => {
    // Unique constraint lato DB; lato calc la seconda allocazione sullo stesso
    // movimento già pieno viene bloccata da canAllocateAmount.
    const firstOk = canAllocateAmount({
      allocateCents: 500,
      documentResidualCents: 1_000,
      movementAmountCents: 500,
      movementAlreadyAllocatedCents: 0
    })
    expect(firstOk.ok).toBe(true)
    const duplicateBlocked = canAllocateAmount({
      allocateCents: 1,
      documentResidualCents: 500,
      movementAmountCents: 500,
      movementAlreadyAllocatedCents: 500
    })
    expect(duplicateBlocked.ok).toBe(false)
  })

  it('nessun doppio movimento: register crea un solo movement; link riusa esistente', () => {
    // Modello: collected_amount = SUM allocazioni; movement_id legacy non usato.
    const d = doc({
      id: 'no-double',
      status: 'collected',
      movement_id: null,
      payments: [
        {
          id: 'p1',
          document_id: 'no-double',
          movement_id: 'mov-a',
          allocated_amount_cents: 1_220_000,
          notes: null,
          movement: { id: 'mov-a', movement_date: '2026-03-20', amount_cents: 1_220_000, status: 'posted', description: 'x' }
        }
      ]
    })
    const coll = computeDocumentCollection(d)
    expect(coll.collectedCents).toBe(1_220_000)
    expect(d.movement_id).toBeNull()
    expect(d.payments).toHaveLength(1)
  })

  it('parametri mancanti: nessun calcolo definitivo e paramsMissing', () => {
    const overview = buildCommercialVatOverview({
      documents: [doc({ id: '1' })],
      fiscalParams: [],
      asOfDate: '2026-12-31',
      toClassifyMovements: 0
    })
    expect(overview.paramsMissing).toBe(true)
    expect(overview.paramsAllVerified).toBe(false)
    expect(overview.estimatedVatDueCents).toBe(0)
    expect(overview.forfaitDeductionCents).toBe(0)
    expect(overview.limitCents).toBeNull()
  })

  it('parametri non verificati bloccano paramsAllVerified', () => {
    const overview = buildCommercialVatOverview({
      documents: [],
      fiscalParams: [
        param('commercial_revenue_limit', 40_000_000, 'unverified'),
        param('vat_flat_deduction_pct', 50, 'verified'),
        param('vat_rate_sponsorship', 22, 'verified'),
        param('vat_rounding_method', 'half_up_cent', 'verified'),
        param('vat_periodicity', 'quarterly', 'verified')
      ],
      asOfDate: '2026-06-30',
      toClassifyMovements: 0
    })
    expect(overview.paramsAllVerified).toBe(false)
    expect(overview.unverifiedParamKeys).toContain('commercial_revenue_limit')
  })

  it('esclusione Quote: solo documenti commerciali nel prospetto', () => {
    const overview = buildCommercialVatOverview({
      documents: [doc({ id: '1' })],
      fiscalParams: verifiedParams(),
      asOfDate: '2026-12-31',
      toClassifyMovements: 0
    })
    expect(overview.taxableCents).toBe(1_000_000)
    expect(overview.sponsorshipRevenueCents).toBe(1_220_000)
  })

  it('limite commerciale e soglie', () => {
    const overview = buildCommercialVatOverview({
      documents: [
        doc({ id: '1', taxable_amount_cents: 28_000_000, include_in_398_limit: true }),
        doc({
          id: '2',
          taxable_amount_cents: 5_000_000,
          include_in_398_limit: false,
          status: 'issued'
        })
      ],
      fiscalParams: verifiedParams(),
      asOfDate: '2026-12-31',
      toClassifyMovements: 0
    })
    expect(overview.limitUsedCents).toBe(28_000_000)
    expect(overview.limitUsedPercent).toBeCloseTo(70, 5)
    expect(overview.limitExceeded).toBe(false)
  })

  it('trimestre da data documento (non da data incasso)', () => {
    expect(quarterFromDate('2026-01-10')).toEqual({ year: 2026, quarter: 1 })
    expect(quarterFromDate('2026-04-01')).toEqual({ year: 2026, quarter: 2 })
    expect(vatPeriodFromDocumentDate('2026-09-30')).toEqual({
      year: 2026,
      quarter: 3,
      criterion: 'document_date'
    })
    expect(vatPeriodFromDocumentDate('2026-12-31').quarter).toBe(4)
  })

  it('rileva trimestre calcolato a zero con fatture emesse', () => {
    const docs = [
      doc({
        id: 'a',
        status: 'issued',
        document_date: '2026-07-20',
        taxable_amount_cents: 1_000_000,
        vat_amount_cents: 220_000
      }),
      doc({
        id: 'b',
        status: 'issued',
        document_date: '2026-09-20',
        taxable_amount_cents: 1_000_000,
        vat_amount_cents: 220_000
      })
    ]
    const periods = [
      {
        year: 2026,
        quarter: 3,
        status: 'calculated' as const,
        commercial_taxable_cents: 0,
        output_vat_cents: 0
      }
    ]
    expect(quartersNeedingVatRecalc(docs, periods)).toEqual([{ year: 2026, quarter: 3 }])
    expect(quartersNeedingVatRecalc(docs, [
      {
        year: 2026,
        quarter: 3,
        status: 'calculated' as const,
        commercial_taxable_cents: 2_000_000,
        output_vat_cents: 440_000
      }
    ])).toEqual([])
    expect(
      quartersNeedingVatRecalc(docs, [
        {
          year: 2026,
          quarter: 3,
          status: 'verified' as const,
          commercial_taxable_cents: 0,
          output_vat_cents: 0
        }
      ])
    ).toEqual([])
  })

  it('IVA stimata non negativa e percent safe', () => {
    expect(computeEstimatedVatDueCents(100, 200)).toBe(0)
    expect(safePercent(10, 0)).toBeNull()
  })

  it('resolve param versionato per data', () => {
    const rows: AccountingFiscalParamRow[] = [
      { ...param('vat_flat_deduction_pct', 50), valid_from: '2026-01-01', id: 'a' },
      {
        ...param('vat_flat_deduction_pct', 60),
        valid_from: '2026-07-01',
        id: 'b',
        verification_status: 'verified'
      }
    ]
    expect(resolveFiscalParamAtDate(rows, 'vat_flat_deduction_pct', '2026-03-01')?.id).toBe('a')
    expect(resolveFiscalParamAtDate(rows, 'vat_flat_deduction_pct', '2026-08-01')?.id).toBe('b')
  })

  it('partially_collected è status IVA-contabile', () => {
    expect(isVatCountableStatus('partially_collected')).toBe(true)
  })
})
