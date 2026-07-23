import { supabase } from '@/lib/supabaseClient'
import type { AccountingFiscalYearSnapshot, FiscalYearClosingChecklist } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function fetchFiscalYearClosingChecklist(
  fiscalYearId: string
): Promise<FiscalYearClosingChecklist> {
  const { data, error } = await db.rpc('accounting_fiscal_year_closing_checklist', {
    p_fiscal_year_id: fiscalYearId
  })
  if (error) throw error
  return data as FiscalYearClosingChecklist
}

export async function openFiscalYear(fiscalYearId: string): Promise<string> {
  const { data, error } = await db.rpc('accounting_fiscal_year_open', {
    p_fiscal_year_id: fiscalYearId
  })
  if (error) throw error
  return data as string
}

export async function startClosingFiscalYear(
  fiscalYearId: string
): Promise<FiscalYearClosingChecklist> {
  const { data, error } = await db.rpc('accounting_fiscal_year_start_closing', {
    p_fiscal_year_id: fiscalYearId
  })
  if (error) throw error
  return data as FiscalYearClosingChecklist
}

export async function closeFiscalYear(fiscalYearId: string): Promise<string> {
  const { data, error } = await db.rpc('accounting_fiscal_year_close', {
    p_fiscal_year_id: fiscalYearId
  })
  if (error) throw error
  return data as string
}

export async function reopenFiscalYear(fiscalYearId: string, reason: string): Promise<string> {
  const { data, error } = await db.rpc('accounting_fiscal_year_reopen', {
    p_fiscal_year_id: fiscalYearId,
    p_reason: reason.trim()
  })
  if (error) throw error
  return data as string
}

export async function fetchFiscalYearSnapshots(
  fiscalYearId: string
): Promise<AccountingFiscalYearSnapshot[]> {
  const { data, error } = await db
    .from('accounting_fiscal_year_snapshots')
    .select('id, fiscal_year_id, kind, payload, generated_at, generated_by')
    .eq('fiscal_year_id', fiscalYearId)
    .order('kind')
  if (error) throw error
  return (data ?? []) as AccountingFiscalYearSnapshot[]
}
