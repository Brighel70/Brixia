/** Prima lettera maiuscola per ogni parola; preserva gli spazi durante la digitazione. */
export function toTitleCaseInput(value: string): string {
  if (!value) return ''
  return value.replace(/\S+/g, (word) => {
    const lower = word.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  })
}

/** Normalizza per salvataggio: trim e spazi multipli ridotti. */
export function toTitleCase(value: string): string {
  if (!value.trim()) return ''
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
