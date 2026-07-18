import type { RicevutaTemplateData } from '../types'
import { getBrandConfig } from '@/config/brand'

/** Dati demo per anteprima PDF (valori finti) */
export function getDemoRicevutaData(): RicevutaTemplateData {
  const brand = getBrandConfig()
  return {
    numero_ricevuta: '001',
    anno: new Date().getFullYear().toString(),
    nome_pagante: 'Mario Rossi',
    cf_pagante: 'RSSMRA80A01H501Z',
    indirizzo_pagante: 'Via Roma 1, 25100 Brescia',
    importo: '300,00',
    importo_lettere: 'trecentonovanta/00',
    nome_figlio: 'Luca Rossi',
    cf_figlio: 'RSSLCU10B02H501A',
    rata_descrizione: '€ 50 – tesseramento',
    data: new Date().toLocaleDateString('it-IT'),
    luogo: 'Brescia',
    nome_associazione: brand?.clubName || 'Associazione Sportiva',
    sede_legale: brand?.contact?.address || 'Sede legale',
    cf_associazione: '12345678901',
    piva_associazione: '12345678901',
    affiliazione_fir: '12345'
  }
}
