import { describe, expect, it } from 'vitest'
import type { AccountingCategorySettingsRow } from '../types'
import {
  applyMasterGroupToggle,
  buildActivationPayload,
  groupActivationState,
  isProtectedCategory,
  normalizeCategoryCode,
  suggestCodeFromName
} from './categorySettingsCalculations'

function cat(
  partial: Partial<AccountingCategorySettingsRow> & Pick<AccountingCategorySettingsRow, 'id' | 'code'>
): AccountingCategorySettingsRow {
  return {
    group_id: 'g1',
    name: partial.code,
    direction: 'income',
    default_nature: 'institutional',
    include_in_commercial_limit: false,
    is_system: false,
    is_active: true,
    recommended_active: true,
    sort_order: 0,
    notes: null,
    available_in_movements: true,
    available_in_budget: true,
    available_in_reports: true,
    archived_at: null,
    ...partial
  }
}

describe('categorySettingsCalculations', () => {
  it('normalizza codice da nome', () => {
    expect(suggestCodeFromName('Materiale sportivo')).toBe('MATERIALE_SPORTIVO')
    expect(normalizeCategoryCode('  foo--bar  ')).toBe('FOO_BAR')
  })

  it('QUOTE è protetta', () => {
    expect(isProtectedCategory(cat({ id: '1', code: 'QUOTE', is_system: true }))).toBe(true)
  })

  it('checkbox master e indeterminate', () => {
    const rows = [
      cat({ id: 'q', code: 'QUOTE', is_system: true, is_active: true }),
      cat({ id: 'a', code: 'A', is_active: true }),
      cat({ id: 'b', code: 'B', is_active: false })
    ]
    expect(groupActivationState(rows)).toBe('indeterminate')
    expect(groupActivationState(applyMasterGroupToggle(rows, true))).toBe(true)
    const off = applyMasterGroupToggle(rows, false)
    expect(off.find((c) => c.code === 'QUOTE')?.is_active).toBe(true)
    expect(groupActivationState(off)).toBe('indeterminate')
  })

  it('batch forza QUOTE attiva', () => {
    const payload = buildActivationPayload(
      [
        {
          id: 'g1',
          direction: 'income',
          code: 'G',
          name: 'G',
          description: null,
          is_active: true,
          is_system: true,
          sort_order: 0,
          archived_at: null
        }
      ],
      [cat({ id: 'q', code: 'QUOTE', is_system: true, is_active: false })]
    )
    expect(payload.categories[0].is_active).toBe(true)
  })
})
