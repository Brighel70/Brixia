import { supabase } from '@/lib/supabaseClient'
import type { ReceiptHeaderSettings, ReceiptHeaderSettingsUpdate } from '../types'

const TABLE = 'receipt_header_settings'

/** Recupera l'unica riga di configurazione intestazione ricevute. Restituisce null se la tabella non esiste (404) o in caso di errore. */
export async function getReceiptHeaderSettings(): Promise<ReceiptHeaderSettings | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, nome_associazione, sede_legale, cf_associazione, piva_associazione, affiliazione_fir, luogo, created_at, updated_at')
    .limit(1)
    .maybeSingle()

  if (error) {
    const code = (error as { code?: string }).code
    const status = (error as { status?: number }).status
    if (status === 404 || code === '42P01' || code === 'PGRST116' || String(error.message || '').includes('exist')) {
      return null
    }
    throw error
  }
  return data as ReceiptHeaderSettings | null
}

/** Aggiorna i dati intestazione (singola riga). Se la tabella non esiste, lancia un errore con istruzioni. */
export async function updateReceiptHeaderSettings(payload: ReceiptHeaderSettingsUpdate): Promise<void> {
  const { data: existing, error: selectError } = await supabase.from(TABLE).select('id').limit(1).maybeSingle()
  const err = selectError as { code?: string; status?: number; message?: string } | undefined
  if (selectError && (err?.status === 404 || err?.code === '42P01' || err?.code === 'PGRST116')) {
    throw new Error('Tabella receipt_header_settings non presente. Esegui lo script create_receipt_header_settings.sql in Supabase (SQL Editor) e riprova.')
  }
  if (selectError) throw selectError

  const toUpdate = { ...payload, updated_at: new Date().toISOString() }

  if (existing?.id) {
    const { error } = await supabase.from(TABLE).update(toUpdate).eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from(TABLE).insert({
      nome_associazione: payload.nome_associazione ?? '',
      sede_legale: payload.sede_legale ?? '',
      cf_associazione: payload.cf_associazione ?? '',
      piva_associazione: payload.piva_associazione ?? '',
      affiliazione_fir: payload.affiliazione_fir ?? '',
      luogo: payload.luogo ?? ''
    })
    if (error) throw error
  }
}
