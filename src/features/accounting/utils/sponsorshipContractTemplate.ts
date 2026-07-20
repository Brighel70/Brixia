import { getBrandConfig } from '@/config/brand'
import { formatFeeAmount } from '@/utils/feeUtils'
import type { AccountingCounterparty, AccountingCounterpartyRef } from '../types'
import { basisPointsToPercent, computeVatAmountCents } from './vatCalculations'

export interface ContractBodyParts {
  contractHtml: string
  annexAHtml: string
  annexBCHtml: string
  paymentPlan?: PaymentPlan
}

export interface PaymentInstallment {
  dueOn: string
  taxableCents: number
}

export interface PaymentPlan {
  mode: 'single' | 'installments'
  /** Es. Bonifico bancario */
  method: string
  installments: PaymentInstallment[]
}

export interface SponsorshipTemplateInput {
  counterparty?: AccountingCounterparty | AccountingCounterpartyRef | null
  /** Dati anagrafici estesi (se disponibili). */
  vatNumber?: string | null
  taxCode?: string | null
  address?: string | null
  pec?: string | null
  email?: string | null
  phone?: string | null
  companyName?: string | null
  title: string
  startsOn: string
  endsOn: string | null
  taxableCents: number
  vatRateBp: number
  grossCents: number
  paymentPlan?: PaymentPlan | null
}

const FILL = '<span class="tf-fill" contenteditable="true">[ da compilare ]</span>'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function filled(value: string | null | undefined, fallback = FILL): string {
  const v = (value ?? '').trim()
  if (!v) return fallback
  return `<strong>${esc(v)}</strong>`
}

function fmtDatePlain(iso: string | null | undefined): string {
  if (!iso) return '[ da compilare ]'
  try {
    return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('it-IT')
  } catch {
    return '[ da compilare ]'
  }
}

function fmtDateIt(iso: string | null | undefined): string {
  if (!iso) return FILL
  return `<strong>${esc(fmtDatePlain(iso))}</strong>`
}

function amountWords(cents: number): string {
  // Placeholder letterale: non implementiamo conversione completa numeri→lettere in v1
  return filled(formatFeeAmount(cents).replace('€', '').trim() + ' /00')
}

function isFullCp(
  c: AccountingCounterparty | AccountingCounterpartyRef | null | undefined
): c is AccountingCounterparty | AccountingCounterpartyRef {
  return !!c && ('vat_number' in c || 'address_street' in c || 'display_name' in c)
}

export function parseContractBodyParts(raw: string | null | undefined): ContractBodyParts | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as ContractBodyParts
    if (parsed?.contractHtml && parsed?.annexAHtml && parsed?.annexBCHtml) return parsed
  } catch {
    // legacy plain text → wrap
    return {
      contractHtml: `<pre>${esc(raw)}</pre>`,
      annexAHtml: `<p>${FILL}</p>`,
      annexBCHtml: `<p>${FILL}</p>`
    }
  }
  return null
}

export function serializeContractBodyParts(parts: ContractBodyParts): string {
  return JSON.stringify(parts)
}

/** Genera le 3 parti HTML dal modello ASD, precompilando brand + sponsor + importi. */
export function buildSponsorshipContractParts(input: SponsorshipTemplateInput): ContractBodyParts {
  const brand = getBrandConfig()
  const club = brand.clubName || 'ASD'
  const clubAddr = brand.contact?.address || ''
  const clubEmail = brand.contact?.email || ''
  const clubPhone = brand.contact?.phone || ''
  const clubDesc = brand.clubDescription || 'Associazione Sportiva Dilettantistica'

  const cp = input.counterparty
  const full = isFullCp(cp) ? cp : null
  const sponsorName = cp?.display_name || input.companyName || ''
  const sponsorVat = input.vatNumber ?? full?.vat_number ?? null
  const sponsorCf = input.taxCode ?? full?.tax_code ?? null
  const sponsorAddr =
    input.address ??
    ([full?.address_street, full?.address_zip, full?.address_city, full?.address_province]
      .filter(Boolean)
      .join(', ') ||
      null)
  const sponsorPec = input.pec ?? full?.pec ?? null
  const sponsorEmail = input.email ?? full?.email ?? null
  const sponsorPhone = input.phone ?? full?.phone ?? null

  const taxable = formatFeeAmount(input.taxableCents)
  const gross = formatFeeAmount(input.grossCents)
  const vatPct = `${basisPointsToPercent(input.vatRateBp)}%`
  const plan = input.paymentPlan
  const methodLabel =
    plan?.method?.trim() ||
    (plan?.mode === 'single'
      ? 'unico versamento'
      : plan?.mode === 'installments'
        ? 'rate'
        : '')
  const paymentMethodFilled = methodLabel ? filled(methodLabel) : FILL

  const installmentRows =
    plan && plan.installments.length > 0
      ? plan.installments
          .map((row, idx) => {
            const rowVat = computeVatAmountCents(row.taxableCents, input.vatRateBp)
            const rowGross = row.taxableCents + rowVat
            return `<tr>
  <td>${idx + 1}</td>
  <td>${esc(fmtDatePlain(row.dueOn))}</td>
  <td>${esc(formatFeeAmount(row.taxableCents))}</td>
  <td>${esc(formatFeeAmount(rowVat))}</td>
  <td><strong>${esc(formatFeeAmount(rowGross))}</strong></td>
</tr>`
          })
          .join('\n')
      : `<tr>
  <td>1</td>
  <td>${esc('[ da compilare ]')}</td>
  <td>${esc('[ da compilare ]')}</td>
  <td>${esc('[ da compilare ]')}</td>
  <td>${esc('[ da compilare ]')}</td>
</tr>`

  const paymentScheduleTable = `
<table class="tf-doc-table">
  <tbody>
    <tr>
      <th>N.</th>
      <th>Scadenza</th>
      <th>Imponibile</th>
      <th>IVA</th>
      <th>Totale</th>
    </tr>
    ${installmentRows}
  </tbody>
</table>`.trim()

  const contractHtml = `
<h1 style="text-align:center">CONTRATTO DI SPONSORIZZAZIONE</h1>
<p style="text-align:center"><em>Modello per Associazione Sportiva Dilettantistica</em></p>
<p><strong>Titolo accordo:</strong> ${filled(input.title)}</p>
<hr/>
<h2>ASSOCIAZIONE SPORTIVA DILETTANTISTICA</h2>
<p><strong>Denominazione:</strong> ${filled(club)}</p>
<p><strong>Descrizione:</strong> ${filled(clubDesc)}</p>
<p><strong>Sede:</strong> ${filled(clubAddr)}</p>
<p><strong>Email / Tel:</strong> ${filled([clubEmail, clubPhone].filter(Boolean).join(' · '))}</p>
<p><strong>C.F./P. IVA:</strong> ${FILL}</p>
<p><strong>Legale rappresentante:</strong> ${FILL}</p>
<hr/>
<h2>SPONSOR</h2>
<p><strong>Denominazione/Ragione sociale:</strong> ${filled(sponsorName)}</p>
<p><strong>Sede:</strong> ${filled(sponsorAddr)}</p>
<p><strong>C.F./P. IVA:</strong> ${filled([sponsorCf, sponsorVat].filter(Boolean).join(' / '))}</p>
<p><strong>Email / Tel / PEC:</strong> ${filled([sponsorEmail, sponsorPhone, sponsorPec].filter(Boolean).join(' · '))}</p>
<p><strong>Legale rappresentante:</strong> ${FILL}</p>
<hr/>
<h3>Premesso che</h3>
<p>l’ASD svolge attività sportiva dilettantistica e iniziative connesse alla promozione dello sport e dei propri valori associativi;</p>
<p>lo Sponsor intende sostenere l’attività dell’ASD ottenendo, quale controprestazione, visibilità promozionale secondo quanto stabilito nel presente contratto e nell’Allegato A;</p>
<p>le Parti intendono disciplinare con il presente accordo contenuti, durata, corrispettivo, modalità di utilizzo dei rispettivi segni distintivi e responsabilità.</p>
<p><strong>Tutto ciò premesso</strong>, che costituisce parte integrante del presente contratto, le Parti convengono quanto segue.</p>
<h3>Art. 1 – Oggetto</h3>
<p>Lo Sponsor si impegna a corrispondere all’ASD il corrispettivo indicato all’art. 5. In cambio, l’ASD assicura allo Sponsor le attività di comunicazione e visibilità elencate nell’Allegato A, nei limiti delle autorizzazioni disponibili, dei regolamenti sportivi applicabili e delle caratteristiche degli impianti, degli eventi e dei canali utilizzati.</p>
<p>Il presente accordo non attribuisce allo Sponsor poteri di gestione dell’ASD, né costituisce rapporto associativo, mandato, agenzia, società, lavoro subordinato o rappresentanza tra le Parti.</p>
<h3>Art. 2 – Durata</h3>
<p>Il contratto decorre dal ${fmtDateIt(input.startsOn)} e termina il ${fmtDateIt(input.endsOn)}, senza rinnovo automatico, salvo diverso accordo scritto.</p>
<p>Eventuali attività successive alla scadenza dovranno essere concordate per iscritto. La scadenza non pregiudica gli obblighi che, per loro natura, devono continuare a produrre effetti, inclusi pagamenti già maturati, riservatezza, tutela dei marchi e responsabilità.</p>
<h3>Art. 3 – Prestazioni dell’ASD</h3>
<p>L’ASD realizzerà le prestazioni indicate nell’Allegato A con diligenza e secondo il calendario sportivo effettivo. Qualora una singola prestazione non possa essere realizzata per ragioni organizzative, regolamentari, tecniche o di forza maggiore, le Parti valuteranno una prestazione sostitutiva di valore promozionale ragionevolmente equivalente.</p>
<p>L’ASD non garantisce risultati sportivi, audience, numero di presenze, ritorni economici o commerciali, salvo eventuali indicatori espressamente qualificati come garantiti nell’Allegato A.</p>
<h3>Art. 4 – Obblighi dello Sponsor</h3>
<p>Lo Sponsor fornirà nei tempi concordati loghi, file grafici, linee guida del marchio e materiali conformi alla legge, ai regolamenti federali e al buon costume. Lo Sponsor garantisce di possedere i diritti necessari sui materiali consegnati e manleva l’ASD da pretese di terzi derivanti dal loro utilizzo conforme al contratto.</p>
<p>Lo Sponsor non potrà utilizzare denominazione, stemma, immagini, divise, atleti, tecnici o altri segni dell’ASD al di fuori delle modalità approvate per iscritto.</p>
<h3>Art. 5 – Corrispettivo, IVA e pagamenti</h3>
<p>Il corrispettivo imponibile della sponsorizzazione è stabilito in euro ${filled(taxable)} (euro ${amountWords(input.taxableCents)}), oltre IVA se dovuta nella misura vigente (<strong>${esc(vatPct)}</strong>) e risultante dal documento fiscale emesso. Totale lordo stimato: ${filled(gross)}.</p>
<p>Il pagamento avverrà secondo il piano riportato nell’Allegato B, mediante ${paymentMethodFilled} sul conto indicato dall’ASD. Ciascun pagamento si considera eseguito alla data dell’effettivo accredito.</p>
<p>In caso di ritardo, l’ASD potrà richiedere per iscritto l’adempimento entro un termine congruo e, decorso inutilmente tale termine, sospendere le prestazioni promozionali o risolvere il contratto, fatto salvo il diritto alle somme già maturate e all’eventuale maggior danno.</p>
<h3>Art. 6 – Marchi, loghi e materiali</h3>
<p>Ciascuna Parte resta titolare dei propri marchi, denominazioni, loghi, contenuti e materiali. Ogni autorizzazione d’uso è temporanea, non esclusiva, non trasferibile e limitata alle finalità del presente contratto, salvo quanto diversamente indicato nell’Allegato A.</p>
<p>Bozze e materiali che associano i segni delle Parti dovranno essere preventivamente approvati per iscritto, anche tramite e-mail. Alla cessazione del contratto, le Parti interromperanno i nuovi utilizzi e rimuoveranno i materiali nei tempi tecnicamente ragionevoli, salvo obblighi di archivio e rendicontazione.</p>
<h3>Art. 7 – Immagini di atleti, tecnici e tesserati</h3>
<p>L’eventuale utilizzo di immagini o riprese riconoscibili di persone è consentito esclusivamente nei limiti delle liberatorie, delle basi giuridiche e delle autorizzazioni disponibili. La presenza del logo dello Sponsor su materiali generali dell’ASD non attribuisce allo Sponsor un autonomo diritto di sfruttamento dell’immagine dei singoli soggetti.</p>
<p>Ogni campagna dedicata che utilizzi in modo individuale nome o immagine di atleti, tecnici, volontari o minori richiede una preventiva verifica e, ove necessario, specifica autorizzazione.</p>
<h3>Art. 8 – Esclusiva merceologica</h3>
<p>L’esclusiva merceologica è: ${FILL} (non prevista / prevista). Se prevista, riguarda esclusivamente il settore ${FILL} e opera nei limiti indicati nell’Allegato A.</p>
<p>Salvo espressa previsione, l’ASD resta libera di concludere accordi con altri partner. Sono in ogni caso fatti salvi sponsor, fornitori, partner istituzionali e accordi già esistenti indicati qui: ${FILL}.</p>
<h3>Art. 9 – Conformità, reputazione ed etica</h3>
<p>Le Parti si impegnano a rispettare la normativa applicabile, i regolamenti sportivi, i principi di lealtà, correttezza, inclusione e tutela dei minori. Nessuna Parte utilizzerà l’accordo per comunicazioni ingannevoli, discriminatorie o lesive della reputazione dell’altra.</p>
<p>In presenza di fatti di particolare gravità idonei a compromettere l’immagine dell’altra Parte, quest’ultima potrà sospendere cautelativamente l’uso dei propri segni e richiedere un confronto immediato, ferma la possibilità di risoluzione nei casi previsti dall’art. 13.</p>
<h3>Art. 10 – Eventi annullati o modificati</h3>
<p>Modifiche di calendario, indisponibilità degli impianti, provvedimenti delle autorità o degli organismi sportivi, eventi meteorologici, emergenze sanitarie e altre cause non ragionevolmente controllabili non costituiscono automaticamente inadempimento.</p>
<p>Le Parti collaboreranno per rimodulare tempi e prestazioni. Qualora la parte essenziale della sponsorizzazione divenga definitivamente impossibile, definiranno in buona fede una riduzione proporzionale, una prestazione sostitutiva o la cessazione anticipata, tenendo conto delle attività già eseguite.</p>
<h3>Art. 11 – Riservatezza</h3>
<p>Le informazioni non pubbliche di natura economica, commerciale, organizzativa o tecnica ricevute in esecuzione del contratto saranno utilizzate soltanto per le finalità dell’accordo e non saranno divulgate senza autorizzazione, salvo obblighi di legge o richieste delle autorità competenti.</p>
<h3>Art. 12 – Protezione dei dati personali</h3>
<p>Ciascuna Parte tratta i dati personali dei referenti dell’altra Parte quale autonomo titolare, limitatamente alla gestione del rapporto contrattuale, agli adempimenti amministrativi, contabili e legali e alla tutela dei propri diritti, fornendo le informazioni richieste dalla normativa applicabile.</p>
<p>Se le attività concordate comportano trattamenti ulteriori, campagne rivolte a persone fisiche, condivisione di elenchi o altre operazioni non necessarie alla semplice esecuzione del contratto, le Parti definiranno preventivamente ruoli, basi giuridiche, informative, misure di sicurezza ed eventuali accordi specifici.</p>
<h3>Art. 13 – Risoluzione e recesso</h3>
<p>In caso di grave inadempimento, la Parte non inadempiente potrà intimare per iscritto di porvi rimedio entro <strong>15</strong> giorni, salvo i casi che per natura non consentano rimedio. Decorso inutilmente il termine, il contratto potrà essere risolto mediante comunicazione scritta.</p>
<p>Costituiscono, a titolo esemplificativo, gravi inadempimenti: mancato pagamento; uso non autorizzato dei marchi o delle immagini; violazioni di legge o regolamenti che incidano sull’accordo; condotte gravemente lesive della reputazione; cessione del contratto senza consenso.</p>
<p>È previsto il recesso libero anticipato: ${FILL}. In caso di recesso, restano dovuti i corrispettivi relativi alle attività già eseguite e agli impegni non revocabili assunti dall’ASD.</p>
<h3>Art. 14 – Responsabilità</h3>
<p>Ciascuna Parte risponde dei danni direttamente imputabili alla violazione dei propri obblighi. Restano esclusi risultati commerciali attesi, mancati guadagni o danni indiretti non specificamente assunti, nei limiti consentiti dalla legge.</p>
<p>L’eventuale partecipazione dello Sponsor a eventi o iniziative dell’ASD sarà disciplinata anche dalle regole di accesso, sicurezza e utilizzo degli impianti applicabili.</p>
<h3>Art. 15 – Cessione e subappalto</h3>
<p>Il contratto non può essere ceduto senza il consenso scritto dell’altra Parte. L’ASD può avvalersi di fornitori per attività tecniche e organizzative, restando responsabile del coordinamento delle prestazioni contrattuali.</p>
<h3>Art. 16 – Comunicazioni</h3>
<p>Le comunicazioni operative saranno inviate ai seguenti recapiti: ASD ${filled([clubEmail, clubPhone].filter(Boolean).join(' · '))}; Sponsor ${filled([sponsorEmail, sponsorPhone].filter(Boolean).join(' · '))}.</p>
<p>Diffide, recesso, risoluzione e contestazioni formali saranno inviati tramite PEC o altro mezzo idoneo a provarne ricezione e contenuto: PEC ASD ${FILL}; PEC Sponsor ${filled(sponsorPec)}.</p>
<h3>Art. 17 – Legge applicabile e controversie</h3>
<p>Il contratto è regolato dalla legge italiana. Prima di avviare un giudizio, le Parti tenteranno in buona fede una composizione amichevole entro <strong>30</strong> giorni dalla contestazione scritta, salvo urgenze e provvedimenti cautelari.</p>
<p>Per ogni controversia sarà competente il Foro di ${FILL}, salvo competenze inderogabili previste dalla legge. Le Parti potranno concordare il ricorso a mediazione o negoziazione assistita.</p>
<h3>Art. 18 – Disposizioni finali</h3>
<p>Il contratto, comprese premesse e allegati, contiene l’intero accordo tra le Parti. Modifiche e integrazioni devono risultare per iscritto. L’eventuale invalidità di una clausola non pregiudica le altre disposizioni, che resteranno efficaci per quanto possibile.</p>
<p>Gli allegati costituiscono parte integrante: Allegato A – Piano di sponsorizzazione e visibilità; Allegato B – Corrispettivo e piano pagamenti; Allegato C – Marchi, referenti e approvazioni (facoltativo).</p>
<p><strong>Luogo e data:</strong> ${FILL}, ${fmtDateIt(input.startsOn)}</p>
<p><strong>PER L’ASD</strong> — Nome e qualifica: ${FILL} — Firma: ${FILL}</p>
<p><strong>PER LO SPONSOR</strong> — Nome e qualifica: ${FILL} — Firma: ${FILL}</p>
`.trim()

  const annexAHtml = `
<h1>ALLEGATO A — Piano di sponsorizzazione e visibilità</h1>
<p>Selezionare e descrivere esclusivamente le prestazioni effettivamente concordate. Segnare “Sì” / “No” e dettagli.</p>
<table class="tf-doc-table">
  <tbody>
    <tr><th>Prestazione</th><th>Specifiche concordate</th><th>Inclusa</th></tr>
    <tr><td>Logo su divisa gara</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Logo su abbigliamento staff</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Cartellonistica impianto</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Backdrop/interviste</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Sito internet</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Social media</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Newsletter</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Eventi e hospitality</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Naming/title sponsorship</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Speaker/annunci</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Materiali promozionali</td><td>${FILL}</td><td>${FILL}</td></tr>
    <tr><td>Altra prestazione</td><td>${FILL}</td><td>${FILL}</td></tr>
  </tbody>
</table>
<p><strong>Territorio/canali interessati:</strong> ${FILL}</p>
<p><strong>Eventuale esclusiva e concorrenti esclusi:</strong> ${FILL}</p>
<p><strong>Materiali forniti dallo Sponsor entro il:</strong> ${FILL}</p>
<p><strong>Referente approvazioni ASD:</strong> ${FILL}</p>
<p><strong>Referente approvazioni Sponsor:</strong> ${FILL}</p>
<p><strong>Indicatori eventualmente garantiti:</strong> ${FILL}</p>
`.trim()

  const annexBCHtml = `
<h1>ALLEGATO B — Corrispettivo e piano dei pagamenti</h1>
<p><strong>Corrispettivo imponibile:</strong> ${filled(taxable)}</p>
<p><strong>IVA, se dovuta:</strong> ${filled(vatPct)}</p>
<p><strong>Totale complessivo (lordo stimato):</strong> ${filled(gross)}</p>
<p><strong>Modalità di pagamento:</strong> ${paymentMethodFilled}${
    plan?.mode === 'single'
      ? ' (unico versamento)'
      : plan?.mode === 'installments'
        ? ` (${plan.installments.length} rate)`
        : ''
  }</p>
<p><strong>Piano rate:</strong></p>
${paymentScheduleTable}
<p><strong>Intestatario conto:</strong> ${filled(club)}</p>
<p><strong>IBAN:</strong> ${FILL}</p>
<p><strong>Causale:</strong> ${FILL}</p>
<p><strong>Note:</strong> ${FILL}</p>
<hr/>
<h1>ALLEGATO C — Marchi, referenti e approvazioni (facoltativo)</h1>
<p><strong>Denominazione esatta dello Sponsor da utilizzare:</strong> ${filled(sponsorName)}</p>
<p><strong>Marchio/logo consegnato in data:</strong> ${FILL}</p>
<p><strong>Linee guida del marchio allegate:</strong> ${FILL}</p>
<p><strong>Formati file disponibili:</strong> ${FILL}</p>
<p><strong>Colori/versioni autorizzate:</strong> ${FILL}</p>
<p><strong>Referente operativo Sponsor:</strong> ${FILL} — ${filled([sponsorEmail, sponsorPhone].filter(Boolean).join(' · '))}</p>
<p><strong>Referente operativo ASD:</strong> ${FILL} — ${filled([clubEmail, clubPhone].filter(Boolean).join(' · '))}</p>
<p><strong>Tempi ordinari di approvazione delle bozze:</strong> ${FILL}</p>
<p><em>Nota: modello generale. Prima della firma personalizzare e far verificare da un professionista.</em></p>
`.trim()

  return { contractHtml, annexAHtml, annexBCHtml, paymentPlan: plan ?? undefined }
}

/** Suddivide l’imponibile in N rate (resto sulla prima). */
export function buildEqualInstallments(input: {
  taxableCents: number
  count: number
  firstDueOn: string
  lastDueOn?: string | null
}): PaymentInstallment[] {
  const n = Math.max(1, Math.min(24, Math.floor(input.count) || 1))
  if (input.taxableCents <= 0) {
    return Array.from({ length: n }, (_, i) => ({
      dueOn: input.firstDueOn || '',
      taxableCents: 0
    })).map((row, i) => ({
      ...row,
      dueOn: interpolateDueDate(input.firstDueOn, input.lastDueOn, i, n)
    }))
  }
  const base = Math.floor(input.taxableCents / n)
  const remainder = input.taxableCents - base * n
  return Array.from({ length: n }, (_, i) => ({
    dueOn: interpolateDueDate(input.firstDueOn, input.lastDueOn, i, n),
    taxableCents: base + (i === 0 ? remainder : 0)
  }))
}

function interpolateDueDate(
  first: string,
  last: string | null | undefined,
  index: number,
  total: number
): string {
  if (!first) return ''
  if (total <= 1 || !last || last <= first) return first
  try {
    const a = new Date(first + 'T12:00:00').getTime()
    const b = new Date(last + 'T12:00:00').getTime()
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return first
    const t = a + ((b - a) * index) / (total - 1)
    return new Date(t).toISOString().slice(0, 10)
  } catch {
    return first
  }
}

export function paymentPlanLabel(plan: PaymentPlan | null | undefined): string {
  if (!plan) return ''
  if (plan.mode === 'single') return plan.method || 'Unico versamento'
  return `${plan.method || 'Rate'} (${plan.installments.length})`
}

export function contractPartsToPlainText(parts: ContractBodyParts): string {
  const strip = (html: string) =>
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  return [
    strip(parts.contractHtml),
    '',
    '——— ALLEGATO A ———',
    '',
    strip(parts.annexAHtml),
    '',
    '——— ALLEGATO B/C ———',
    '',
    strip(parts.annexBCHtml)
  ].join('\n')
}
