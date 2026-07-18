import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { renderTemplate, templateDataToRecord } from './renderTemplate'
import type { TemplateName } from '../types'
import type { RicevutaTemplateData } from '../types'

/**
 * Genera PDF dalla ricevuta: recupera HTML (da parametro), sostituisce placeholder, renderizza con html2canvas + jsPDF.
 * Usa la libreria già presente nel progetto (jspdf, html2canvas).
 */
export async function generateRicevutaPDF(
  html: string,
  data: RicevutaTemplateData,
  options?: { fileName?: string }
): Promise<Blob> {
  const record = templateDataToRecord(data)
  const htmlFilled = renderTemplate(html, record)

  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '210mm'
  container.style.padding = '15mm'
  container.style.background = 'white'
  container.style.fontFamily = 'Inter, Arial, sans-serif'
  container.style.fontSize = '12px'
  container.innerHTML = htmlFilled
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })
    const imgData = canvas.toDataURL('image/png', 1.0)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pdfW = pdf.getPageWidth(0)
    const pdfH = pdf.getPageHeight(0)
    const margin = 10
    const w = pdfW - 2 * margin
    const h = (canvas.height * w) / canvas.width
    pdf.addImage(imgData, 'PNG', margin, margin, w, h)
    if (h > pdfH - 2 * margin) {
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', margin, margin - (pdfH - 2 * margin), w, h)
    }
    return pdf.output('blob')
  } finally {
    document.body.removeChild(container)
  }
}

/** Apre il blob PDF in una nuova finestra/tab per anteprima */
export function openPdfPreview(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
