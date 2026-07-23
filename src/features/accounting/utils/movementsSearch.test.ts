import { describe, expect, it } from 'vitest'
import {
  buildMovementsSearchOrClause,
  escapeIlikePattern,
  parseSearchAmountCents,
  parseSearchDateIso
} from './movementsSearch'

describe('movementsSearch', () => {
  it('escapeIlikePattern rimuove virgolette e escape wildcard', () => {
    expect(escapeIlikePattern('a%b_c"d')).toBe('a\\%b\\_cd')
  })

  it('parseSearchAmountCents legge euro IT', () => {
    expect(parseSearchAmountCents('€ 10.000,00')).toBe(1_000_000)
    expect(parseSearchAmountCents('100')).toBe(10_000)
    expect(parseSearchAmountCents('abc')).toBeNull()
  })

  it('parseSearchDateIso accetta IT e ISO', () => {
    expect(parseSearchDateIso('20/07/2026')).toBe('2026-07-20')
    expect(parseSearchDateIso('2026-07-20')).toBe('2026-07-20')
    expect(parseSearchDateIso('32/01/2026')).toBeNull()
  })

  it('buildMovementsSearchOrClause include testo, label e id correlati', () => {
    const clause = buildMovementsSearchOrClause('bonifico', ['acc-1'], ['cat-1'])
    expect(clause).toContain('description.ilike."%bonifico%"')
    expect(clause).toContain('payment_method_raw.eq.bonifico')
    expect(clause).toContain('account_id.in.(acc-1)')
    expect(clause).toContain('category_id.in.(cat-1)')
  })

  it('buildMovementsSearchOrClause mappa label IT su codici', () => {
    const clause = buildMovementsSearchOrClause('Contabilizzato', [], [])
    expect(clause).toContain('status.eq.posted')
  })
})
