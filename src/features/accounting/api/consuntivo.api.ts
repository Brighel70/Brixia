import { supabase } from '@/lib/supabaseClient'
import type { ConsuntivoMovementRow } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function fetchConsuntivoMovements(
  fiscalYearId: string
): Promise<ConsuntivoMovementRow[]> {
  const { data, error } = await db
    .from('accounting_movements')
    .select(
      `
      id, movement_date, direction, status, amount_cents,
      category_id, account_id, origin, reverses_movement_id,
      document_type, document_number, reference, description
    `
    )
    .eq('fiscal_year_id', fiscalYearId)
    .order('movement_date', { ascending: true })

  if (error) throw error
  return (data ?? []) as ConsuntivoMovementRow[]
}
