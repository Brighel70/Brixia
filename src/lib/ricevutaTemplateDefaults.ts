/**
 * Template HTML di default per le ricevute.
 * Placeholder supportati: {{numero_ricevuta}}, {{anno}}, {{nome_pagante}}, {{cf_pagante}},
 * {{indirizzo_pagante}}, {{importo}}, {{importo_lettere}}, {{nome_figlio}}, {{cf_figlio}},
 * {{rata_descrizione}}, {{data}}, {{luogo}}, {{nome_associazione}}, {{sede_legale}},
 * {{cf_associazione}}, {{piva_associazione}}, {{affiliazione_fir}}, {{letterhead_logo_img}}
 */

export const DEFAULT_RICEVUTA_SOLUZIONE_UNICA = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #222; max-width: 600px; margin: 0 auto; padding: 20px; }
.intestazione { text-align: center; border-bottom: 2px solid #0b1f4d; padding-bottom: 12px; margin-bottom: 20px; }
.intestazione h1 { margin: 0; font-size: 16pt; color: #0b1f4d; }
.intestazione .sottotitolo { font-size: 9pt; color: #666; margin-top: 4px; }
.titolo-ricevuta { text-align: center; font-size: 14pt; font-weight: bold; margin: 24px 0 20px; }
.corpo { margin: 16px 0; }
.corpo p { margin: 8px 0; }
.detrazione { margin-top: 24px; padding: 12px; background: #f0f9ff; border-left: 4px solid #0b1f4d; font-size: 10pt; }
.firma { margin-top: 32px; }
.firma-linea { border-top: 1px solid #333; width: 200px; margin-top: 48px; padding-top: 4px; font-size: 10pt; }
</style></head>
<body>
<div class="intestazione" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; text-align: left;">
  <div style="flex: 1;">
    <h1 style="margin: 0 0 4px 0;">{{nome_associazione}}</h1>
    <p class="sottotitolo">Sede Legale: {{sede_legale}}</p>
    <p class="sottotitolo">C.F. {{cf_associazione}} &nbsp; P.IVA {{piva_associazione}}</p>
    <p class="sottotitolo">Affiliata FIR n. {{affiliazione_fir}}</p>
  </div>
  <div style="flex-shrink: 0;">{{letterhead_logo_img}}</div>
</div>
<p class="titolo-ricevuta">RICEVUTA DI PAGAMENTO N. {{numero_ricevuta}}/{{anno}}</p>
<div class="corpo">
  <p>Il sottoscritto <strong>{{nome_pagante}}</strong>, C.F. <strong>{{cf_pagante}}</strong>, residente in <strong>{{indirizzo_pagante}}</strong>,</p>
  <p>ha versato in data <strong>{{data}}</strong> a <strong>{{luogo}}</strong> la somma di <strong>€ {{importo}}</strong> ({{importo_lettere}})</p>
  <p>a titolo di <strong>quota associativa per corso di rugby</strong> per l'atleta <strong>{{nome_figlio}}</strong>, C.F. <strong>{{cf_figlio}}</strong>, stagione sportiva in corso.</p>
</div>
<div class="detrazione">
  <p><strong>Detrazione fiscale:</strong> La società è iscritta nel Registro CONI. L'importo è detraibile fiscalmente secondo la normativa vigente.</p>
</div>
<div class="firma">
  <div class="firma-linea">Il Legale Rappresentante</div>
</div>
</body>
</html>`

export const DEFAULT_RICEVUTA_RATEIZZATA = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #222; max-width: 600px; margin: 0 auto; padding: 20px; }
.intestazione { text-align: center; border-bottom: 2px solid #0b1f4d; padding-bottom: 12px; margin-bottom: 20px; }
.intestazione h1 { margin: 0; font-size: 16pt; color: #0b1f4d; }
.intestazione .sottotitolo { font-size: 9pt; color: #666; margin-top: 4px; }
.titolo-ricevuta { text-align: center; font-size: 14pt; font-weight: bold; margin: 24px 0 20px; }
.corpo { margin: 16px 0; }
.corpo p { margin: 8px 0; }
.rata-box { margin: 16px 0; padding: 12px; background: #fef3c7; border-left: 4px solid #f59e0b; }
.piano-rate { margin-top: 16px; padding: 12px; background: #f8fafc; font-size: 10pt; }
.detrazione { margin-top: 24px; padding: 12px; background: #f0f9ff; border-left: 4px solid #0b1f4d; font-size: 10pt; }
.firma { margin-top: 32px; }
.firma-linea { border-top: 1px solid #333; width: 200px; margin-top: 48px; padding-top: 4px; font-size: 10pt; }
</style></head>
<body>
<div class="intestazione" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; text-align: left;">
  <div style="flex: 1;">
    <h1 style="margin: 0 0 4px 0;">{{nome_associazione}}</h1>
    <p class="sottotitolo">Sede Legale: {{sede_legale}}</p>
    <p class="sottotitolo">C.F. {{cf_associazione}} &nbsp; P.IVA {{piva_associazione}}</p>
    <p class="sottotitolo">Affiliata FIR n. {{affiliazione_fir}}</p>
  </div>
  <div style="flex-shrink: 0;">{{letterhead_logo_img}}</div>
</div>
<p class="titolo-ricevuta">RICEVUTA DI PAGAMENTO PARZIALE N. {{numero_ricevuta}}/{{anno}}</p>
<div class="corpo">
  <p>Il sottoscritto <strong>{{nome_pagante}}</strong>, C.F. <strong>{{cf_pagante}}</strong>, residente in <strong>{{indirizzo_pagante}}</strong>,</p>
  <p>ha versato in data <strong>{{data}}</strong> a <strong>{{luogo}}</strong> la somma di <strong>€ {{importo}}</strong> ({{importo_lettere}})</p>
  <p><strong>Rata versata:</strong> {{rata_descrizione}}</p>
  <p>a titolo di quota associativa per l'atleta <strong>{{nome_figlio}}</strong>, C.F. <strong>{{cf_figlio}}</strong>.</p>
</div>
<div class="rata-box">
  <p><strong>Rata versata:</strong> {{rata_descrizione}}</p>
</div>
<div class="piano-rate">
  <p><strong>Piano rate:</strong></p>
  <ul>
    <li>€ 50 tesseramento</li>
    <li>€ 100 entro fine settembre</li>
    <li>€ 150 entro 15 dicembre</li>
  </ul>
</div>
<div class="detrazione">
  <p><strong>Detrazione fiscale:</strong> La società è iscritta nel Registro CONI. L'importo è detraibile fiscalmente secondo la normativa vigente.</p>
</div>
<div class="firma">
  <div class="firma-linea">Il Legale Rappresentante</div>
</div>
</body>
</html>`

export function getDefaultTemplateHtml(nome: string): string {
  if (nome === 'ricevuta_soluzione_unica') return DEFAULT_RICEVUTA_SOLUZIONE_UNICA
  if (nome === 'ricevuta_rateizzata') return DEFAULT_RICEVUTA_RATEIZZATA
  return ''
}
