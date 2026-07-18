export const RICEVUTA_PLACEHOLDERS = [
  'numero_ricevuta',
  'anno',
  'nome_pagante',
  'cf_pagante',
  'indirizzo_pagante',
  'importo',
  'importo_lettere',
  'nome_figlio',
  'cf_figlio',
  'rata_descrizione',
  'data',
  'luogo',
  'nome_associazione',
  'sede_legale',
  'cf_associazione',
  'piva_associazione',
  'affiliazione_fir'
] as const

export type PlaceholderKey = (typeof RICEVUTA_PLACEHOLDERS)[number]

/** Restituisce la stringa da usare nel template, es. {{nome_pagante}} */
export function placeholderTag(key: PlaceholderKey): string {
  return `{{${key}}}`
}
