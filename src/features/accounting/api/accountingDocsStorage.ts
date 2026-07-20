import { supabase } from '@/lib/supabaseClient'

export const ACCOUNTING_DOCS_BUCKET = 'accounting-docs'

export async function uploadAccountingPdf(path: string, blob: Blob): Promise<string> {
  const maxBytes = 18 * 1024 * 1024
  if (blob.size > maxBytes) {
    throw new Error(
      `PDF troppo grande (${(blob.size / (1024 * 1024)).toFixed(1)} MB). Riprova o riduci il contenuto del contratto.`
    )
  }

  const { error } = await supabase.storage
    .from(ACCOUNTING_DOCS_BUCKET)
    .upload(path, blob, { contentType: 'application/pdf', upsert: true })

  if (error) {
    const msg = error.message || 'Upload PDF non riuscito'
    const lower = msg.toLowerCase()
    if (lower.includes('exceeded the maximum allowed size') || lower.includes('maximum allowed size')) {
      throw new Error(
        `PDF troppo grande per lo storage (${(blob.size / (1024 * 1024)).toFixed(1)} MB). Aumenta file_size_limit del bucket accounting-docs oppure riesegui Genera PDF dopo l’ottimizzazione.`
      )
    }
    if (lower.includes('bucket') || lower.includes('not found')) {
      throw new Error(
        `${msg}. Crea il bucket "accounting-docs" (vedi database/setup_storage_accounting_docs.sql).`
      )
    }
    throw new Error(msg)
  }
  return path
}

export async function getAccountingDocSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ACCOUNTING_DOCS_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  if (!data?.signedUrl) throw new Error('URL firmato non disponibile')
  return data.signedUrl
}

export function contractPdfStoragePath(fiscalYearId: string, contractId: string): string {
  return `contracts/${fiscalYearId}/${contractId}.pdf`
}

export function commercialDocPdfStoragePath(fiscalYearId: string, documentId: string): string {
  return `invoices/${fiscalYearId}/${documentId}.pdf`
}
