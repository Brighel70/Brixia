/**
 * Normalizza un valore data per input type="date" (solo YYYY-MM-DD).
 * Supabase e altri backend possono restituire "2026-02-04T00:00:00+00:00";
 * il browser accetta solo "yyyy-MM-dd".
 */
export function toDateOnly(value: string | Date | null | undefined): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    return trimmed.slice(0, 10)
  }
  try {
    return new Date(value).toISOString().split('T')[0]
  } catch {
    return ''
  }
}
