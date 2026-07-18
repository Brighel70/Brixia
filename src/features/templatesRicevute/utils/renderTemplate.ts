import type { RicevutaTemplateData } from '../types'

/**
 * Sostituisce i placeholder {{key}} con i valori in data.
 * Se un valore manca, lascia {{key}} per debug.
 */
export function renderTemplate(html: string, data: Record<string, string | undefined>): string {
  let result = html
  for (const [key, value] of Object.entries(data)) {
    const tag = `{{${key}}}`
    result = result.split(tag).join(value !== undefined && value !== null ? String(value) : tag)
  }
  return result
}

/** Converte RicevutaTemplateData in Record per renderTemplate */
export function templateDataToRecord(data: RicevutaTemplateData): Record<string, string | undefined> {
  return {
    numero_ricevuta: data.numero_ricevuta,
    anno: data.anno,
    nome_pagante: data.nome_pagante,
    cf_pagante: data.cf_pagante,
    indirizzo_pagante: data.indirizzo_pagante,
    importo: data.importo,
    importo_lettere: data.importo_lettere,
    nome_figlio: data.nome_figlio,
    cf_figlio: data.cf_figlio,
    rata_descrizione: data.rata_descrizione,
    data: data.data,
    luogo: data.luogo,
    nome_associazione: data.nome_associazione,
    sede_legale: data.sede_legale,
    cf_associazione: data.cf_associazione,
    piva_associazione: data.piva_associazione,
    affiliazione_fir: data.affiliazione_fir
  }
}
