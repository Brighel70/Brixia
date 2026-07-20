import { describe, expect, it } from 'vitest'
import {
  ALL_FLOWME_SECTIONS,
  RLS_READINESS,
  ROLE_ACCESS_MATRIX,
  getRoleAccessRule,
} from './accessModel'

describe('accessModel', () => {
  it('covers every TeamFlow role with a unique rule', () => {
    const roles = ROLE_ACCESS_MATRIX.map((r) => r.teamflowRole)
    expect(new Set(roles).size).toBe(roles.length)
    expect(roles).toContain('Admin')
    expect(roles).toContain('Famiglia')
    expect(roles).toContain('Allenatore')
  })

  it('resolves role names with aliases', () => {
    expect(getRoleAccessRule('Admin')?.dataScope).toBe('all')
    expect(getRoleAccessRule('allenatore')?.dataScope).toBe('assigned_categories')
    expect(getRoleAccessRule('player')?.teamflowRole).toBe('Giocatore')
    expect(getRoleAccessRule('family')?.dataScope).toBe('linked_children')
    expect(getRoleAccessRule('fisio')?.teamflowRole).toBe('Fisioterapista')
    expect(getRoleAccessRule(null)).toBeNull()
    expect(getRoleAccessRule('RuoloInesistente')).toBeNull()
  })

  it('keeps default FlowMe sections inside the allowed set', () => {
    for (const rule of ROLE_ACCESS_MATRIX) {
      for (const section of rule.defaultFlowmeSections) {
        expect(ALL_FLOWME_SECTIONS).toContain(section)
      }
    }
  })

  it('marks FlowMe Auth identity ready (RLS policies still separate)', () => {
    expect(RLS_READINESS.flowmeHasDbIdentity).toBe(true)
    expect(RLS_READINESS.teamflowUsesSupabaseAuth).toBe(true)
    expect(RLS_READINESS.categoryScopeCentralized).toBe(true)
    expect(RLS_READINESS.paymentsLedgerCentralized).toBe(true)
  })
})
