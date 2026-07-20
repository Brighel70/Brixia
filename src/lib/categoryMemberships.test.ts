import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => {
  return { supabase: { from: vi.fn() } }
})

import {
  expandCategoryFilterIds,
  personHasAnyCategory,
  personHasCategory,
  readCategoryIds,
} from './categoryMemberships'

describe('categoryMemberships helpers', () => {
  it('normalizes category id fields from array / json string', () => {
    expect(readCategoryIds(['a', 'b', '', 3 as unknown as string])).toEqual(['a', 'b'])
    expect(readCategoryIds('["x","y"]')).toEqual(['x', 'y'])
    expect(readCategoryIds('not-json')).toEqual([])
    expect(readCategoryIds(null)).toEqual([])
  })

  it('checks category membership', () => {
    expect(personHasCategory(['u14', 'u15'], 'u14')).toBe(true)
    expect(personHasCategory(['u14'], 'seniores')).toBe(false)
    expect(personHasAnyCategory(['u14', 'u16'], ['u15', 'u16'])).toBe(true)
    expect(personHasAnyCategory(['u14'], ['seniores'])).toBe(false)
  })

  it('expands Seniores filter to Serie B / Serie C when present', () => {
    const categories = [
      { id: 'sen-1', name: 'Seniores', code: 'SENIORES' },
      { id: 'b-1', name: 'Serie B', code: 'SERIE_B' },
      { id: 'c-1', name: 'Serie C', code: 'SERIE_C' },
      { id: 'u14', name: 'Under 14', code: 'U14' },
    ]
    expect(expandCategoryFilterIds('sen-1', categories)).toEqual(['sen-1', 'b-1', 'c-1'])
    expect(expandCategoryFilterIds('u14', categories)).toEqual(['u14'])
    expect(expandCategoryFilterIds('missing', categories)).toEqual(['missing'])
  })
})
