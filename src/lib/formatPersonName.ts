/**
 * Nomi anagrafica: in DB restano MAIUSCOLI (scheda).
 * Ovunque altrove in UI: Title Case (iniziali maiuscole).
 */

/** Una stringa nome (full_name o pezzo) → "Carlo Amadei" */
export function formatDisplayPersonName(value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      // Gestisce apostrofi: D'ANGELO → D'Angelo
      return word
        .split(/(')/)
        .map((part) => {
          if (part === "'" || !part) return part
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        })
        .join('')
    })
    .join(' ')
}

/** Nome + cognome → Title Case (fuori dalla scheda anagrafica). */
export function formatDisplayPersonParts(
  givenName?: string | null,
  familyName?: string | null,
  fullNameFallback?: string | null
): string {
  const given = formatDisplayPersonName(givenName)
  const family = formatDisplayPersonName(familyName)
  const joined = `${given} ${family}`.trim()
  if (joined) return joined
  return formatDisplayPersonName(fullNameFallback)
}
