import type { TemplateName } from '../types'

const BASE_STYLE = 'font-family: Inter, Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #1a1a1a;'
const HEADER_STYLE = 'font-size: 14px; font-weight: bold; margin-bottom: 8px;'
const TITLE_STYLE = 'font-size: 16px; font-weight: bold; margin: 16px 0 12px 0; text-align: center;'
const FOOTER_STYLE = 'margin-top: 24px; font-size: 11px; color: #555;'

const COMMON_HEADER = `
<div style="${BASE_STYLE} max-width: 100%; width: 100%; margin: 0 auto; padding: 12px 8px;">
  <div style="border-bottom: 1px solid #ddd; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
    <div style="flex: 1; min-width: 0;">
      <div style="${HEADER_STYLE}">{{nome_associazione}}</div>
      <div>Sede Legale: {{sede_legale}}</div>
      <div>C.F. {{cf_associazione}} &nbsp; P.IVA {{piva_associazione}}</div>
      <div>Affiliata FIR n. {{affiliazione_fir}}</div>
    </div>
    <div style="flex-shrink: 0;">{{letterhead_logo_img}}</div>
  </div>
`

/** Template 1 — Soluzione Unica (testo ufficiale) */
const SOLUZIONE_UNICA_BODY = `
  <h1 style="${TITLE_STYLE}">RICEVUTA DI PAGAMENTO N. {{numero_ricevuta}}/{{anno}}</h1>
  <p style="margin: 12px 0;">Ricevuta di avvenuto pagamento della quota di iscrizione annuale ad attività sportive dilettantistiche per ragazzi di età compresa tra 5 e 18 anni – art. 15, comma 1, lett. i-quinquies T.U.I.R. e relativo decreto attuativo.</p>
  <p style="margin: 12px 0;">Si certifica che il/la Sig./Sig.ra <strong>{{nome_pagante}}</strong> residente a {{indirizzo_pagante}} C.F. {{cf_pagante}}</p>
  <p style="margin: 12px 0;">ha versato la somma di Euro <strong>{{importo}}</strong> (Euro {{importo_lettere}}) in soluzione unica</p>
  <p style="margin: 12px 0;">per la partecipazione al corso di rugby del figlio/a <strong>{{nome_figlio}}</strong></p>
  <p style="margin: 12px 0;">C.F.: {{cf_figlio}}</p>
  <p style="margin: 16px 0 8px 0; font-size: 11px;">Le somme versate per attività sportive dilettantistiche sono detraibili fiscalmente secondo la normativa vigente.</p>
  <div style="${FOOTER_STYLE}">
    Luogo {{luogo}}, Data {{data}}<br/><br/>
    Firma _______________________<br/>
    {{nome_associazione}}
  </div>
</div>
`

/** Template 2 — Rateizzata (testo ufficiale) */
const RATEIZZATA_BODY = `
  <h1 style="${TITLE_STYLE}">RICEVUTA DI PAGAMENTO PARZIALE N. {{numero_ricevuta}}/{{anno}}</h1>
  <p style="margin: 12px 0;">Ricevuta di avvenuto pagamento della quota di iscrizione annuale ad attività sportive dilettantistiche per ragazzi di età compresa tra 5 e 18 anni – art. 15, comma 1, lett. i-quinquies T.U.I.R. e relativo decreto attuativo.</p>
  <p style="margin: 12px 0;">Si certifica che il/la Sig./Sig.ra <strong>{{nome_pagante}}</strong> residente a {{indirizzo_pagante}} C.F. {{cf_pagante}}</p>
  <p style="margin: 12px 0;">ha versato la somma di Euro <strong>{{importo}}</strong> (Euro {{importo_lettere}})</p>
  <p style="margin: 12px 0;">quale pagamento della seguente rata relativa alla quota del corso di rugby del figlio/a <strong>{{nome_figlio}}</strong></p>
  <p style="margin: 12px 0;">C.F.: {{cf_figlio}}</p>
  <p style="margin: 12px 0;"><strong>Rata versata: {{rata_descrizione}}</strong></p>
  <p style="margin: 8px 0 4px 0;">Piano rate previsto:</p>
  <ul style="margin: 4px 0 12px 20px;">
    <li>€ 50 al momento del tesseramento / ritesseramento</li>
    <li>€ 100 entro fine settembre</li>
    <li>€ 150 entro il 15 dicembre</li>
  </ul>
  <p style="margin: 16px 0 8px 0; font-size: 11px;">Le somme versate per attività sportive dilettantistiche sono detraibili fiscalmente secondo la normativa vigente. Documento esente bollo ai sensi dell'art. 5 DPR 642/1972.</p>
  <div style="${FOOTER_STYLE}">
    Luogo {{luogo}}, Data {{data}}<br/><br/>
    Firma _______________________<br/>
    {{nome_associazione}}
  </div>
</div>
`

export const DEFAULT_TEMPLATES: Record<TemplateName, string> = {
  ricevuta_soluzione_unica: COMMON_HEADER + SOLUZIONE_UNICA_BODY,
  ricevuta_rateizzata: COMMON_HEADER + RATEIZZATA_BODY
}
