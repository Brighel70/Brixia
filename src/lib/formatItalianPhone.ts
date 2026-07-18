/** Formatta un numero italiano come +39 333 1234567 (aggiunge +39 se assente). */
export function formatItalianPhone(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''

  let national = digits
  if (national.startsWith('39') && national.length > 10) {
    national = national.slice(2)
  }
  national = national.slice(0, 10)

  if (national.length <= 3) {
    return `+39 ${national}`
  }
  return `+39 ${national.slice(0, 3)} ${national.slice(3)}`
}

/** Formatta al salvataggio se il campo contiene cifre. */
export function normalizeItalianPhone(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return formatItalianPhone(trimmed)
}
