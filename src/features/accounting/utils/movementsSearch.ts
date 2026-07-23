import {
  BANCA_PAYMENT_METHODS,
  CASSA_PAYMENT_METHODS,
  DOCUMENT_TYPE_OPTIONS
} from './movementFormOptions'

const DIRECTION_LABELS: Record<string, string> = {
  income: 'Entrata',
  expense: 'Uscita',
  transfer: 'Giroconto',
  adjustment: 'Rettifica',
  opening: 'Apertura',
  closing: 'Chiusura',
  reversal: 'Storno'
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bozza',
  pending_account: 'Conto da assegnare',
  posted: 'Contabilizzato',
  reversed: 'Stornato',
  cancelled: 'Annullato'
}

const ORIGIN_LABELS: Record<string, string> = {
  manual: 'Manuale',
  fee_sync: 'Sync quote',
  backfill: 'Backfill',
  reversal: 'Storno',
  refund: 'Rimborso',
  adjustment: 'Rettifica'
}

/** Escape caratteri speciali LIKE/ILIKE e virgolette per filtri PostgREST. */
export function escapeIlikePattern(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/"/g, '')
}

function codesMatchingLabel(term: string, labels: Record<string, string>): string[] {
  const t = term.trim().toLowerCase()
  if (!t) return []
  return Object.entries(labels)
    .filter(([code, label]) => label.toLowerCase().includes(t) || code.toLowerCase().includes(t))
    .map(([code]) => code)
}

/** Interpreta importi digitati come euro (es. 10.000,00 → 1000000 centesimi). */
export function parseSearchAmountCents(term: string): number | null {
  const raw = term.trim().replace(/€/g, '').replace(/\s/g, '')
  if (!raw) return null

  let normalized = raw
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '')
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const euros = Number(normalized)
  if (!Number.isFinite(euros)) return null
  return Math.round(euros * 100)
}

/** Accetta gg/mm/aaaa o aaaa-mm-gg. */
export function parseSearchDateIso(term: string): string | null {
  const t = term.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const it = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  if (!it) return null
  const day = it[1].padStart(2, '0')
  const month = it[2].padStart(2, '0')
  const year = it[3]
  const d = new Date(`${year}-${month}-${day}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  if (d.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return null
  return `${year}-${month}-${day}`
}

export function matchPaymentMethodValues(term: string): string[] {
  const t = term.trim().toLowerCase()
  if (!t) return []
  const all = [...CASSA_PAYMENT_METHODS, ...BANCA_PAYMENT_METHODS]
  return all
    .filter((m) => m.label.toLowerCase().includes(t) || m.value.toLowerCase().includes(t))
    .map((m) => m.value)
}

export function matchDocumentTypeValues(term: string): string[] {
  const t = term.trim().toLowerCase()
  if (!t) return []
  return DOCUMENT_TYPE_OPTIONS.filter(
    (o) =>
      o.value !== 'none' &&
      (o.label.toLowerCase().includes(t) || o.value.toLowerCase().includes(t))
  ).map((o) => o.value)
}

/**
 * Clausola `or` PostgREST sulle colonne visibili in Prima nota
 * (+ lookup account/categoria già risolti in ID).
 */
export function buildMovementsSearchOrClause(
  term: string,
  accountIds: string[],
  categoryIds: string[]
): string {
  const trimmed = term.trim()
  const pattern = escapeIlikePattern(trimmed)
  const parts: string[] = [
    `description.ilike."%${pattern}%"`,
    `payment_method_raw.ilike."%${pattern}%"`,
    `document_number.ilike."%${pattern}%"`,
    `document_type.ilike."%${pattern}%"`,
    `reference.ilike."%${pattern}%"`,
    `notes.ilike."%${pattern}%"`
  ]

  for (const code of codesMatchingLabel(trimmed, DIRECTION_LABELS)) {
    parts.push(`direction.eq.${code}`)
  }
  for (const code of codesMatchingLabel(trimmed, STATUS_LABELS)) {
    parts.push(`status.eq.${code}`)
  }
  for (const code of codesMatchingLabel(trimmed, ORIGIN_LABELS)) {
    parts.push(`origin.eq.${code}`)
  }
  for (const value of matchPaymentMethodValues(trimmed)) {
    parts.push(`payment_method_raw.eq.${value}`)
  }
  for (const value of matchDocumentTypeValues(trimmed)) {
    parts.push(`document_type.eq.${value}`)
  }

  const amountCents = parseSearchAmountCents(trimmed)
  if (amountCents != null) {
    parts.push(`amount_cents.eq.${amountCents}`)
  }

  const dateIso = parseSearchDateIso(trimmed)
  if (dateIso) {
    parts.push(`movement_date.eq.${dateIso}`)
  }

  if (accountIds.length > 0) {
    parts.push(`account_id.in.(${accountIds.join(',')})`)
  }
  if (categoryIds.length > 0) {
    parts.push(`category_id.in.(${categoryIds.join(',')})`)
  }

  return parts.join(',')
}
