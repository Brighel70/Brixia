/** Nomi dei template ricevute (chiavi DB) */
export type TemplateName = 'ricevuta_soluzione_unica' | 'ricevuta_rateizzata'

/** Riga tabella Supabase templates_documenti */
export interface TemplateDocumentoRow {
  id: string
  nome: string
  contenuto_html: string
  created_at: string
  updated_at: string
}

/** Riga tabella receipt_header_settings (dati intestazione ricevuta) */
export interface ReceiptHeaderSettings {
  id: string
  nome_associazione: string | null
  sede_legale: string | null
  cf_associazione: string | null
  piva_associazione: string | null
  affiliazione_fir: string | null
  luogo: string | null
  created_at?: string
  updated_at?: string
}

/** Payload per aggiornare i dati intestazione (tutti opzionali) */
export type ReceiptHeaderSettingsUpdate = Partial<Omit<ReceiptHeaderSettings, 'id' | 'created_at' | 'updated_at'>>

/** Dati per sostituire i placeholder nelle ricevute */
export interface RicevutaTemplateData {
  numero_ricevuta?: string
  anno?: string
  nome_pagante?: string
  cf_pagante?: string
  indirizzo_pagante?: string
  importo?: string
  importo_lettere?: string
  nome_figlio?: string
  cf_figlio?: string
  rata_descrizione?: string
  data?: string
  luogo?: string
  nome_associazione?: string
  sede_legale?: string
  cf_associazione?: string
  piva_associazione?: string
  affiliazione_fir?: string
}
