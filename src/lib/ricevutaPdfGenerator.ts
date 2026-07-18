/**
 * Genera PDF ricevute da template HTML (Supabase) con sostituzione placeholder.
 * Usa html2canvas + jsPDF già presenti nel progetto.
 */
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { supabase } from '@/lib/supabaseClient'
import { getBrandConfig, initBrandConfig } from '@/config/brand'
import { getDefaultTemplateHtml } from './ricevutaTemplateDefaults'

export interface DatiRicevuta {
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
  affiliazione_fir?: string
  [key: string]: string | undefined
}

/**
 * Recupera il template HTML da Supabase per nome.
 * Se non esiste o è vuoto, restituisce il default da codice.
 */
export async function getTemplateHtml(templateName: string): Promise<string> {
  const { data, error } = await supabase
    .from('templates_documenti')
    .select('contenuto_html')
    .eq('nome', templateName)
    .maybeSingle()

  if (error) throw error
  const html = data?.contenuto_html?.trim()
  if (html) return html
  return getDefaultTemplateHtml(templateName) || ''
}

/** Restituisce URL assoluto per logo (path relativi o data URL). */
function letterheadLogoUrl(brand: ReturnType<typeof getBrandConfig>): string {
  const raw = brand?.assets?.letterheadLogo?.trim() || brand?.assets?.logo?.trim() || ''
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw
  if (raw.startsWith('http') || raw.startsWith('blob:')) return raw
  return typeof window !== 'undefined' ? window.location.origin + (raw.startsWith('/') ? raw : '/' + raw) : raw
}

/** Converte un URL blob: in data URL così il PDF può usare il logo senza dipendere dalla sessione. */
async function resolveLogoToDataUrl(url: string): Promise<string> {
  if (!url || !url.startsWith('blob:')) return url
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

/** Costruisce il tag HTML per il logo carta intestata (sempre con data URL quando possibile). */
function buildLetterheadLogoImg(logoDataUrl: string): string {
  if (!logoDataUrl.trim()) return ''
  const src = logoDataUrl.replace(/"/g, '&quot;')
  return `<span style="display:inline-block;background:#fff;padding:6px;"><img src="${src}" alt="Logo" style="max-height: 56px; max-width: 120px; object-fit: contain;" /></span>`
}

/**
 * Sostituisce i placeholder {{chiave}} nell'HTML con i valori in dati.
 * Aggiunge club_name, affiliazione_fir e logo carta intestata da brand se non in dati.
 */
export function replacePlaceholders(html: string, dati: DatiRicevuta): string {
  const brand = getBrandConfig()
  const logoUrl = letterheadLogoUrl(brand)
  const letterheadLogoImg = logoUrl
    ? buildLetterheadLogoImg(logoUrl)
    : ''
  const merged: DatiRicevuta = {
    ...dati,
    club_name: dati.club_name ?? brand?.clubName ?? 'Associazione',
    affiliazione_fir: dati.affiliazione_fir ?? '',
    letterhead_logo_url: dati.letterhead_logo_url ?? logoUrl,
    letterhead_logo_img: dati.letterhead_logo_img ?? letterheadLogoImg
  }
  let out = html
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) continue
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    out = out.replace(placeholder, String(value))
  }
  // Se il template non aveva il placeholder del logo ma abbiamo un logo: dati a SINISTRA (un blocco), logo a DESTRA
  if (letterheadLogoImg && !out.includes(letterheadLogoImg) && /Affiliata FIR n\.\s*[^<]*/.test(out)) {
    // 1) Contenitore intestazione con flex
    out = out.replace(
      /(style=")([^"]*border-bottom[^"]*padding-bottom[^"]*)(")/i,
      (_full: string, q: string, style: string, end: string) => {
        if (/display:\s*flex/i.test(style)) return _full
        return `${q}display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; ${style}${end}`
      }
    )
    // 2) Subito dopo l'apertura del contenitore intestazione, apri un blocco unico per i dati a sinistra
    out = out.replace(
      /(<div\s+style="[^"]*border-bottom[^"]*padding-bottom[^"]*"[^>]*>)\s*/i,
      (match) => `${match}<div style="flex: 1; min-width: 0;">`
    )
    // 3) Prima della chiusura dell'intestazione: chiudi il blocco sinistra, aggiungi logo a destra
    out = out.replace(
      /(Affiliata FIR n\.\s*[^<]*)(<\/div>\s*)(<\/div>)/,
      (_, p1, p2, p3) => `${p1}${p2}</div><div style="flex-shrink: 0;">${letterheadLogoImg}</div>${p3}`
    )
  }

  // Post-elaborazione: applica le modifiche anche ai template vecchi salvati in DB
  // 1) Togli "CARTA INTESTATA " dall'header (testo già sostituito, es. "CARTA INTESTATA Brixia A.s.d.")
  out = out.replace(/CARTA INTESTATA\s+/gi, '')

  // 2) Allarga il contenuto: sostituisci max-width che limita la larghezza
  out = out.replace(/max-width:\s*600px/gi, 'max-width: 100%')
  out = out.replace(/max-width:\s*600px;/gi, 'max-width: 100%;')
  out = out.replace(/width:\s*600px/gi, 'width: 100%')

  // 3) Stacca data e firma: tra "Luogo ... Data ..." e "Firma" inserisci doppio a capo se manca
  out = out.replace(/(Luogo[^<]*Data\s+[^<]+)(<br\s*\/?>\s*)(Firma\s+_+)/gi, (_, p1, p2, p3) => {
    if (p2.includes('<br/><br/>') || p2.includes('<br><br>')) return `${p1}${p2}${p3}`
    return `${p1}<br/><br/>${p3}`
  })

  // 4) Sotto "Firma _____" aggiungi il nome associazione se manca (per template vecchi)
  const nomeAssoc = (merged.nome_associazione || merged.club_name || '').trim()
  if (nomeAssoc) {
    out = out.replace(/(Firma\s+_+)((?:(?:<br\s*\/?>\s*)[^<]*)*)\s*(<\/div>)/gi, (_m: string, p1: string, p2: string, p3: string) => {
      if (p2.includes(nomeAssoc)) return _m
      return `${p1}<br/>${nomeAssoc}${p3}`
    })
  }

  // 5) LOGO IN ENTRAMBI I TEMPLATE: se abbiamo il logo e non è già nell'HTML, lo mettiamo in alto a destra (position:absolute)
  const logoAlreadyInOutput = out.includes('alt="Logo"') || out.includes(letterheadLogoImg)
  if (letterheadLogoImg && !logoAlreadyInOutput) {
    const logoLayer = `<div style="position:absolute;top:12px;right:16px;z-index:2;">${letterheadLogoImg}</div>`
    if (out.trimStart().startsWith('<div')) {
      out = logoLayer + out
    } else if (/<body[^>]*>/i.test(out)) {
      out = out.replace(/(<body[^>]*>)/i, `$1${logoLayer}`)
    } else {
      out = logoLayer + out
    }
  }

  return out
}

/**
 * Dati di esempio per anteprima PDF (senza chiamate a Supabase per il template se passi html).
 */
export const DATI_ANTEPRIMA: DatiRicevuta = {
  numero_ricevuta: '1',
  anno: new Date().getFullYear().toString(),
  nome_pagante: 'Mario Rossi',
  cf_pagante: 'RSSMRA80A01H501Z',
  indirizzo_pagante: 'Via Roma 1, 25100 Brescia',
  importo: '300,00',
  importo_lettere: 'trecento/00',
  nome_figlio: 'Luca Rossi',
  cf_figlio: 'RSSLCU10B02H501X',
  rata_descrizione: 'Prima rata (tesseramento € 50)',
  data: new Date().toLocaleDateString('it-IT'),
  luogo: 'Brescia',
  affiliazione_fir: '12345'
}

/** Attende che tutte le immagini nel contenitore siano caricate (o in errore) prima di procedere. */
function waitForImages(container: HTMLElement): Promise<void> {
  const imgs = container.querySelectorAll<HTMLImageElement>('img')
  if (imgs.length === 0) return Promise.resolve()
  return Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
    )
  ).then(() => {})
}

/** Disegna il logo in alto a destra sul canvas (usato quando html2canvas non include l'img fuori schermo). */
function drawLogoOnCanvas(canvas: HTMLCanvasElement, logoDataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve()
      const scale = 2
      const marginRight = 24 * scale
      const marginTop = 24 * scale
      const maxW = 120 * scale
      const maxH = 56 * scale
      let w = img.width
      let h = img.height
      if (w > maxW || h > maxH) {
        const r = Math.min(maxW / w, maxH / h)
        w = Math.round(w * r)
        h = Math.round(h * r)
      }
      const x = canvas.width - marginRight - w
      const y = marginTop
      ctx.drawImage(img, x, y, w, h)
      resolve()
    }
    img.onerror = () => resolve()
    img.src = logoDataUrl
  })
}

export interface GeneratePdfOptions {
  /** Data URL del logo da disegnare in alto a destra (sempre usato se fornito, per entrambi i template). */
  logoDataUrl?: string
}

/**
 * Genera il PDF a partire da HTML già con placeholder sostituiti.
 * Crea un elemento temporaneo, lo renderizza, lo converte in canvas e poi in PDF.
 * Se logoDataUrl è fornito, il logo viene disegnato sul canvas in alto a destra (così compare sempre nel PDF).
 */
export async function generatePdfFromHtml(html: string, options?: GeneratePdfOptions): Promise<Blob> {
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '210mm'
  container.style.background = 'white'
  container.style.padding = '12px 16px'
  container.style.boxSizing = 'border-box'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    await waitForImages(container)
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })
    if (options?.logoDataUrl) {
      await drawLogoOnCanvas(canvas, options.logoDataUrl)
    }
    const imgData = canvas.toDataURL('image/png', 1.0)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const ratio = pageW / canvas.width
    const imgH = canvas.height * ratio
    let heightLeft = imgH
    let position = 0
    pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0) {
      position = heightLeft - imgH
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH)
      heightLeft -= pageH
    }
    return pdf.output('blob')
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * Funzione principale: recupera template da Supabase, sostituisce placeholder, genera PDF.
 * Usata per ENTRAMBI i template (ricevuta_soluzione_unica e ricevuta_rateizzata).
 * Aggiorna la config brand da IndexedDB prima di generare così il logo "Logo per Carta intestata" è sempre disponibile.
 */
export async function generateRicevutaPDF(
  templateName: string,
  dati: DatiRicevuta
): Promise<Blob> {
  await initBrandConfig()
  const brand = getBrandConfig()
  let logoDataUrl = letterheadLogoUrl(brand)
  if (logoDataUrl) {
    logoDataUrl = await resolveLogoToDataUrl(logoDataUrl)
    dati = { ...dati, letterhead_logo_img: buildLetterheadLogoImg(logoDataUrl) }
  }
  const html = await getTemplateHtml(templateName)
  const htmlFilled = replacePlaceholders(html, dati)
  return generatePdfFromHtml(htmlFilled, { logoDataUrl: logoDataUrl || undefined })
}
