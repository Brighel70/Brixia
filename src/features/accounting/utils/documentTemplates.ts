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
export async function generateTextPdfBlob(title: string, bodyTextOrHtml: string): Promise<Blob> {
  const looksHtml = /<[a-z][\s\S]*>/i.test(bodyTextOrHtml)
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  // Larghezza A4 a ~96dpi: con scale 2 → ~300 dpi effettivi
  container.style.width = '794px'
  container.style.padding = '56px 64px'
  container.style.background = 'white'
  container.style.color = '#0f172a'
  container.style.fontFamily = 'Georgia, "Times New Roman", Times, serif'
  container.style.fontSize = '13px'
  container.style.lineHeight = '1.55'
  container.style.boxSizing = 'border-box'
  container.style.WebkitFontSmoothing = 'antialiased'
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
    </style>
  `

  if (looksHtml) {
    container.innerHTML = `
      ${printCss}
      <div class="pdf-root">
        <div class="pdf-title">${escapeHtml(title)}</div>
        <div class="pdf-body">${bodyTextOrHtml}</div>
      </div>
    `
  } else {
    container.innerHTML = `
      ${printCss}
      <div class="pdf-root">
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
    let blob = await canvasToPagedPdf(canvas, { format: 'PNG', quality: 1, imageCompress: 'MEDIUM' })
    if (blob.size > 14 * 1024 * 1024) {
      blob = await canvasToPagedPdf(canvas, { format: 'JPEG', quality: 0.9, imageCompress: 'MEDIUM' })
    }
    if (blob.size > 18 * 1024 * 1024) {
      blob = await canvasToPagedPdf(canvas, { format: 'JPEG', quality: 0.78, imageCompress: 'FAST' })
    }
    return blob
  } finally {
    document.body.removeChild(container)
  }
}

async function canvasToPagedPdf(
  canvas: HTMLCanvasElement,
  opts: { format: 'PNG' | 'JPEG'; quality: number; imageCompress: 'NONE' | 'FAST' | 'MEDIUM' | 'SLOW' }
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
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

export function openPdfPreview(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
