import { Document, Packer, Paragraph, TextRun } from 'docx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { getBrandConfig } from '@/config/brand'
import { formatFeeAmount } from '@/utils/feeUtils'
import type { AccountingCounterpartyRef, CommercialDocument, SponsorshipContract } from '../types'
import { basisPointsToPercent } from './vatCalculations'

export interface DocTemplateContext {
  clubName: string
  counterpartyName: string
  counterpartyVat: string
  counterpartyTaxCode: string
  counterpartyAddress: string
  title: string
  startsOn: string
  endsOn: string
  taxableLabel: string
  vatRateLabel: string
  grossLabel: string
  documentNumber: string
  documentDate: string
  description: string
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('it-IT')
  } catch {
    return iso
  }
}

export function buildDocContext(input: {
  counterparty?: AccountingCounterpartyRef | null
  vatNumber?: string | null
  taxCode?: string | null
  address?: string | null
  title?: string
  startsOn?: string | null
  endsOn?: string | null
  taxableCents?: number
  vatRateBp?: number
  grossCents?: number
  documentNumber?: string | null
  documentDate?: string | null
  description?: string
}): DocTemplateContext {
  const brand = getBrandConfig()
  return {
    clubName: brand.clubName || 'ASD',
    counterpartyName: input.counterparty?.display_name ?? '—',
    counterpartyVat: input.vatNumber?.trim() || '—',
    counterpartyTaxCode: input.taxCode?.trim() || '—',
    counterpartyAddress: input.address?.trim() || '—',
    title: input.title?.trim() || 'Documento',
    startsOn: fmtDate(input.startsOn),
    endsOn: fmtDate(input.endsOn),
    taxableLabel: formatFeeAmount(input.taxableCents ?? 0),
    vatRateLabel: `${basisPointsToPercent(input.vatRateBp ?? 0)}%`,
    grossLabel: formatFeeAmount(input.grossCents ?? 0),
    documentNumber: input.documentNumber?.trim() || 'da assegnare',
    documentDate: fmtDate(input.documentDate),
    description: input.description?.trim() || '—'
  }
}

/** Template bozza contratto sponsor (testo editabile). */
export function buildSponsorshipContractBody(ctx: DocTemplateContext): string {
  return [
    `CONTRATTO DI SPONSORIZZAZIONE`,
    ``,
    `Tra`,
    `${ctx.clubName} (di seguito “ASD”)`,
    `e`,
    `${ctx.counterpartyName} (di seguito “Sponsor”)`,
    `P.IVA ${ctx.counterpartyVat} — C.F. ${ctx.counterpartyTaxCode}`,
    `Sede: ${ctx.counterpartyAddress}`,
    ``,
    `1. Oggetto`,
    `Lo Sponsor concede all’ASD un contributo di sponsorizzazione per le attività sportive e istituzionali.`,
    `Titolo: ${ctx.title}`,
    `Periodo: dal ${ctx.startsOn} al ${ctx.endsOn}.`,
    ``,
    `2. Corrispettivo`,
    `Imponibile: ${ctx.taxableLabel}`,
    `Aliquota IVA: ${ctx.vatRateLabel}`,
    `Totale lordo: ${ctx.grossLabel}`,
    ``,
    `3. Modalità di pagamento`,
    `[Modificare: acconto / saldo / scadenze / IBAN ASD / bonifico]`,
    ``,
    `4. Obblighi delle parti`,
    `L’ASD si impegna a garantire la visibilità concordata. Lo Sponsor fornisce i materiali grafici necessari.`,
    ``,
    `5. Disposizioni finali`,
    `Per quanto non previsto si applicano le norme vigenti. Luogo e data: ____________________`,
    ``,
    `Firma ASD _________________     Firma Sponsor _________________`
  ].join('\n')
}

/** Template bozza fattura/documento commerciale. */
export function buildCommercialInvoiceBody(ctx: DocTemplateContext): string {
  return [
    `FATTURA / DOCUMENTO COMMERCIALE`,
    ``,
    `Emittente: ${ctx.clubName}`,
    `Destinatario: ${ctx.counterpartyName}`,
    `P.IVA ${ctx.counterpartyVat} — C.F. ${ctx.counterpartyTaxCode}`,
    `Indirizzo: ${ctx.counterpartyAddress}`,
    ``,
    `Numero: ${ctx.documentNumber}`,
    `Data: ${ctx.documentDate}`,
    `Descrizione: ${ctx.description}`,
    ``,
    `Imponibile: ${ctx.taxableLabel}`,
    `IVA (${ctx.vatRateLabel}): inclusa nel lordo sotto`,
    `Totale lordo: ${ctx.grossLabel}`,
    ``,
    `Modalità di pagamento: [bonifico / altro — modificare]`,
    ``,
    `Documento gestionale interno ASD. Non sostituisce l’invio SDI se obbligatorio.`,
    `Valori da verificare con il commercialista.`
  ].join('\n')
}

export function contractToDocContext(
  contract: SponsorshipContract,
  counterparty?: AccountingCounterpartyRef | null,
  extra?: { vatNumber?: string | null; taxCode?: string | null; address?: string | null }
): DocTemplateContext {
  return buildDocContext({
    counterparty: counterparty ?? contract.counterparty,
    vatNumber: extra?.vatNumber,
    taxCode: extra?.taxCode,
    address: extra?.address,
    title: contract.title,
    startsOn: contract.starts_on,
    endsOn: contract.ends_on,
    taxableCents: contract.taxable_amount_cents,
    vatRateBp: contract.vat_rate_basis_points,
    grossCents: contract.gross_amount_cents
  })
}

export function commercialDocToDocContext(
  doc: CommercialDocument,
  extra?: { vatNumber?: string | null; taxCode?: string | null; address?: string | null }
): DocTemplateContext {
  return buildDocContext({
    counterparty: doc.counterparty,
    vatNumber: extra?.vatNumber,
    taxCode: extra?.taxCode,
    address: extra?.address,
    title: doc.description,
    documentNumber: doc.document_number,
    documentDate: doc.document_date,
    description: doc.description,
    taxableCents: doc.taxable_amount_cents,
    vatRateBp: doc.vat_rate_basis_points,
    grossCents: doc.gross_amount_cents
  })
}

/** Scarica .docx dalla bozza testuale corrente. */
export async function downloadTextAsDocx(fileName: string, bodyText: string): Promise<void> {
  const paragraphs = bodyText.split('\n').map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line || ' ', size: 22 })]
      })
  )
  const doc = new Document({
    sections: [{ children: paragraphs }]
  })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Genera PDF A4 da testo o HTML (html2canvas + jsPDF, pagine ritagliate ad alta qualità). */
export type AccountingPdfOrientation = 'portrait' | 'landscape'

export async function generateTextPdfBlob(
  title: string,
  bodyTextOrHtml: string,
  options: { orientation?: AccountingPdfOrientation; report?: boolean } = {}
): Promise<Blob> {
  const orientation = options.orientation ?? 'portrait'
  const looksHtml = /<[a-z][\s\S]*>/i.test(bodyTextOrHtml)
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  // Larghezza A4 a ~96dpi: con scale 2 → ~300 dpi effettivi
  container.style.width = orientation === 'landscape' ? '1123px' : '794px'
  container.style.padding = orientation === 'landscape' ? '28px 32px' : '32px 38px'
  container.style.background = 'white'
  container.style.color = '#0f172a'
  container.style.fontFamily = 'Arial, Helvetica, sans-serif'
  container.style.fontSize = '13px'
  container.style.lineHeight = '1.45'
  container.style.boxSizing = 'border-box'
  container.style.setProperty('-webkit-font-smoothing', 'antialiased')
  container.style.textRendering = 'geometricPrecision'

  const printCss = `
    <style>
      .pdf-root, .pdf-body { color:#0f172a; }
      .pdf-body h1 { font-size:20px; margin:0 0 14px; font-family:Arial,Helvetica,sans-serif; line-height:1.25; }
      .pdf-body h2 { font-size:15px; margin:18px 0 8px; font-family:Arial,Helvetica,sans-serif; }
      .pdf-body h3 { font-size:13.5px; margin:14px 0 6px; font-family:Arial,Helvetica,sans-serif; }
      .pdf-body p { margin:0.5em 0; }
      .pdf-body table { width:100%; border-collapse:collapse; margin:12px 0 16px; font-size:12px; }
      .pdf-body th, .pdf-body td { border:1px solid #64748b; padding:8px 10px; vertical-align:middle; }
      .pdf-body th { background:#f1f5f9; font-weight:700; text-align:left; }
      .pdf-body hr { border:none; border-top:1px solid #cbd5e1; margin:18px 0; }
      .tf-fill { background:#fef3c7; border-bottom:1px dashed #d97706; padding:0 2px; }
      .pdf-title { font-size:20px; margin:0 0 16px; font-family:Arial,Helvetica,sans-serif; font-weight:700; }
      .report-header { background:#14213D; border-radius:14px; color:#fff; padding:24px 28px; margin-bottom:20px; }
      .report-eyebrow { color:#9DDCFF; font-size:10px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; margin:0 0 7px; }
      .report-header h1 { color:#fff; font-size:27px; line-height:1.15; margin:0; font-family:Arial,Helvetica,sans-serif; }
      .report-header p { color:#D9E7FF; margin:8px 0 0; font-size:12px; }
      .report-grid { display:table; width:100%; table-layout:fixed; border-spacing:8px 0; margin:0 -8px 22px; }
      .report-kpi { display:table-cell; background:#F4F8FD; border:1px solid #D9E5F2; border-radius:10px; padding:14px 16px; vertical-align:top; }
      .report-kpi-label { color:#60758B; font-size:10px; font-weight:700; letter-spacing:.75px; text-transform:uppercase; }
      .report-kpi-value { color:#0F2B4D; font-size:20px; font-weight:700; margin-top:5px; }
      .report-section { margin-top:24px; }
      .report-section-title { color:#102B4E; font-size:16px; font-weight:700; margin:0 0 9px; padding-left:10px; border-left:4px solid #12A594; }
      .report-section-title.expense { border-left-color:#E35D6A; }
      .report-table { width:100%; border-collapse:separate; border-spacing:0; margin:0; font-size:11px; overflow:hidden; border:1px solid #DDE7F0; border-radius:10px; }
      .report-table th { background:#EEF4FA; color:#486178; border:0; border-bottom:1px solid #D8E4EF; padding:9px 10px; font-size:9px; letter-spacing:.55px; text-transform:uppercase; }
      .report-table td { border:0; border-bottom:1px solid #E8EEF5; padding:9px 10px; color:#1B3046; vertical-align:top; }
      .report-table tr:nth-child(even) td { background:#FAFCFE; }
      .report-table tr:last-child td { border-bottom:0; }
      .report-table .amount { text-align:right; white-space:nowrap; font-weight:700; }
      .report-table th.amount-header { text-align:right; }
      .report-table .report-group-row td { background:#EAF4F7; border-bottom:1px solid #D6E5EA; color:#173B57; font-size:10px; font-weight:700; padding:9px 10px; }
      .report-table .report-group-row span { display:inline-block; }
      .report-table .report-group-row small { color:#587187; float:right; font-size:9px; font-weight:700; }
      .report-grouped-table tr:not(.report-group-row) td:first-child { color:#355069; padding-left:24px; }
      .report-comparison-overview { display:table; width:100%; table-layout:fixed; border-spacing:10px 0; margin:0 -10px 24px; }
      .report-comparison-card { display:table-cell; border:1px solid #DDE7F0; border-radius:12px; padding:15px 16px; vertical-align:top; }
      .report-comparison-card.income { background:#F0FBF8; border-color:#CBEDE5; }
      .report-comparison-card.expense { background:#FFF7F7; border-color:#F4D9DC; }
      .report-comparison-card.result { background:#F3F7FD; border-color:#D9E5F2; }
      .report-comparison-card > p { color:#24425C; font-size:12px; font-weight:700; margin:0 0 10px; }
      .report-comparison-card-values { display:table; width:100%; table-layout:fixed; }
      .report-comparison-card-values span { display:table-cell; vertical-align:top; }
      .report-comparison-card small, .report-comparison-group small { color:#60758B; display:block; font-size:8px; font-weight:700; letter-spacing:.45px; text-transform:uppercase; }
      .report-comparison-card strong { color:#102B4E; display:block; font-size:14px; margin-top:3px; white-space:nowrap; }
      .report-comparison-groups { display:block; }
      .report-comparison-group { border:1px solid #DDE7F0; border-radius:10px; margin:0 0 12px; overflow:hidden; }
      .report-comparison-group-heading { background:#F3F8FB; display:table; width:100%; table-layout:fixed; }
      .report-comparison-group-heading > div { display:table-cell; padding:12px 14px; vertical-align:middle; }
      .report-comparison-group-heading > div:first-child { width:33%; }
      .report-comparison-group-heading p { color:#60758B; font-size:8px; font-weight:700; letter-spacing:.45px; margin:0 0 3px; text-transform:uppercase; }
      .report-comparison-group-heading h3 { color:#173B57; font-size:13px; margin:0; }
      .report-comparison-group-totals { display:table; table-layout:fixed; width:67%; }
      .report-comparison-group-totals span { display:table-cell; text-align:right; vertical-align:middle; }
      .report-comparison-group-totals strong { color:#173B57; display:block; font-size:10px; margin-top:3px; white-space:nowrap; }
      .report-comparison-group .report-table { border:0; border-radius:0; }
      .report-comparison-group .report-table th { background:#FAFCFE; }
      .report-comparison-group .report-table tr:last-child td { border-bottom:0; }
      .report-note { color:#60758B; font-size:10px; margin:18px 0 0; }
      .pdf-report > .pdf-title { display:none; }
    </style>
  `

  if (looksHtml) {
    container.innerHTML = `
      ${printCss}
      <div class="pdf-root${options.report ? ' pdf-report' : ''}">
        <div class="pdf-title">${escapeHtml(title)}</div>
        <div class="pdf-body">${bodyTextOrHtml}</div>
      </div>
    `
  } else {
    container.innerHTML = `
      ${printCss}
      <div class="pdf-root${options.report ? ' pdf-report' : ''}">
        <div class="pdf-title">${escapeHtml(title)}</div>
        <pre class="pdf-body" style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(bodyTextOrHtml)}</pre>
      </div>
    `
  }
  document.body.appendChild(container)
  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight
    })

    // Preferisci PNG (testo nitido). Se il PDF supera ~14MB, ricomprimi in JPEG alta qualità.
    let blob = await canvasToPagedPdf(canvas, {
      format: 'PNG',
      quality: 1,
      imageCompress: 'MEDIUM',
      orientation
    })
    if (blob.size > 14 * 1024 * 1024) {
      blob = await canvasToPagedPdf(canvas, {
        format: 'JPEG',
        quality: 0.9,
        imageCompress: 'MEDIUM',
        orientation
      })
    }
    if (blob.size > 18 * 1024 * 1024) {
      blob = await canvasToPagedPdf(canvas, {
        format: 'JPEG',
        quality: 0.78,
        imageCompress: 'FAST',
        orientation
      })
    }
    return blob
  } finally {
    document.body.removeChild(container)
  }
}

async function canvasToPagedPdf(
  canvas: HTMLCanvasElement,
  opts: {
    format: 'PNG' | 'JPEG'
    quality: number
    imageCompress: 'NONE' | 'FAST' | 'MEDIUM' | 'SLOW'
    orientation: AccountingPdfOrientation
  }
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: opts.orientation, unit: 'mm', format: 'a4', compress: true })
  const pdfW = pdf.internal.pageSize.getWidth()
  const pdfH = pdf.internal.pageSize.getHeight()
  const margin = 8
  const contentW = pdfW - 2 * margin
  const contentH = pdfH - 2 * margin
  const pxPerMm = canvas.width / contentW
  const pagePxH = Math.floor(contentH * pxPerMm)
  const totalPages = Math.max(1, Math.ceil(canvas.height / pagePxH))

  const sliceCanvas = document.createElement('canvas')
  sliceCanvas.width = canvas.width
  const sliceCtx = sliceCanvas.getContext('2d')
  if (!sliceCtx) throw new Error('Canvas non disponibile per PDF')

  for (let page = 0; page < totalPages; page++) {
    const srcY = page * pagePxH
    const srcH = Math.min(pagePxH, canvas.height - srcY)
    sliceCanvas.height = srcH
    sliceCtx.fillStyle = '#ffffff'
    sliceCtx.fillRect(0, 0, sliceCanvas.width, srcH)
    sliceCtx.imageSmoothingEnabled = true
    sliceCtx.imageSmoothingQuality = 'high'
    sliceCtx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

    const imgData =
      opts.format === 'PNG'
        ? sliceCanvas.toDataURL('image/png')
        : sliceCanvas.toDataURL('image/jpeg', opts.quality)
    const sliceHmm = (srcH / canvas.width) * contentW
    if (page > 0) pdf.addPage()
    pdf.addImage(imgData, opts.format, margin, margin, contentW, sliceHmm, undefined, opts.imageCompress)
  }

  return pdf.output('blob')
}

/** Apre subito una scheda vuota per evitare il blocco popup durante la generazione asincrona. */
export function reservePdfPreviewWindow(): Window | null {
  const previewWindow = window.open('', '_blank')
  if (!previewWindow) return null

  previewWindow.opener = null
  previewWindow.document.title = 'Generazione PDF...'
  previewWindow.document.body.innerHTML = '<p style="font-family:Arial,sans-serif;padding:24px">Generazione PDF in corso...</p>'
  return previewWindow
}

export function openPdfPreview(blob: Blob, previewWindow?: Window | null): void {
  const url = URL.createObjectURL(blob)
  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.replace(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
