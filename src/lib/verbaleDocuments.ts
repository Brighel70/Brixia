/** Documento verbale: file in Storage + etichetta visualizzata. */

export type VerbaleDoc = {
  file: string
  label: string
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Formatta data come DD-MM-YYYY (locale). */
export function formatVerbaleDatePart(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date.includes('T') ? date : `${date}T12:00:00`) : date
  if (Number.isNaN(d.getTime())) {
    const now = new Date()
    return `${pad2(now.getDate())}-${pad2(now.getMonth() + 1)}-${now.getFullYear()}`
  }
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
}

/** Etichetta base: "Verbale del DD-MM-YYYY" */
export function verbaleLabelBase(date: Date | string = new Date()): string {
  return `Verbale del ${formatVerbaleDatePart(date)}`
}

/**
 * Prossima etichetta libera per la data:
 * 1° → "Verbale del 17-07-2026"
 * 2° → "Verbale del 17-07-2026 (1)"
 * 3° → "Verbale del 17-07-2026 (2)"
 */
export function nextVerbaleLabel(existingLabels: string[], date: Date | string = new Date()): string {
  const base = verbaleLabelBase(date)
  const related = existingLabels.filter((l) => l === base || l.startsWith(`${base} (`))
  if (related.length === 0) return base
  let n = 1
  while (existingLabels.includes(`${base} (${n})`)) n += 1
  return `${base} (${n})`
}

export function parseVerbaleDoc(raw: string): VerbaleDoc {
  const trimmed = (raw || '').trim()
  if (!trimmed) return { file: '', label: '' }
  if (trimmed.startsWith('{')) {
    try {
      const o = JSON.parse(trimmed) as Partial<VerbaleDoc>
      if (o?.file && typeof o.file === 'string') {
        return {
          file: o.file,
          label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : fallbackLabelFromFile(o.file),
        }
      }
    } catch {
      /* plain filename */
    }
  }
  return { file: trimmed, label: fallbackLabelFromFile(trimmed) }
}

function fallbackLabelFromFile(file: string): string {
  // verbale_2026-07-17T15-15-55-125Z_xxx.pdf → prova a ricavare la data
  const m = file.match(/verbale_(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `Verbale del ${m[3]}-${m[2]}-${m[1]}`
  return 'Verbale'
}

export function serializeVerbaleDoc(doc: VerbaleDoc): string {
  return JSON.stringify({ file: doc.file, label: doc.label.trim() || fallbackLabelFromFile(doc.file) })
}

export function parseVerbaleDocs(rawList: string[] | null | undefined): VerbaleDoc[] {
  return (rawList ?? []).map(parseVerbaleDoc).filter((d) => d.file)
}

export function serializeVerbaleDocs(docs: VerbaleDoc[]): string[] {
  return docs.map(serializeVerbaleDoc)
}

export function getVerbaleStorageFiles(
  verbalePdf: string | null | undefined,
  verbalePdfs: string[] | null | undefined,
): string[] {
  const fromArray = parseVerbaleDocs(verbalePdfs).map((d) => d.file)
  const single = verbalePdf?.trim()
  if (single && !fromArray.includes(single) && !single.startsWith('{')) {
    return [single, ...fromArray]
  }
  if (single?.startsWith('{')) {
    const doc = parseVerbaleDoc(single)
    if (doc.file && !fromArray.includes(doc.file)) return [doc.file, ...fromArray]
  }
  return fromArray
}

/** Allegati Incontro Staff: PDF / Office / immagini */
export const ALLEGATI_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,image/webp'

const ALLEGATI_EXT = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'jpg',
  'jpeg',
  'png',
  'webp',
])

export function getFileExtension(filename: string): string {
  const m = filename.trim().match(/\.([a-zA-Z0-9]+)$/)
  return m ? m[1]!.toLowerCase() : ''
}

export function isAllowedAllegatoFile(file: File): boolean {
  const ext = getFileExtension(file.name)
  if (ext && ALLEGATI_EXT.has(ext)) return true
  const t = (file.type || '').toLowerCase()
  return (
    t === 'application/pdf' ||
    t === 'application/msword' ||
    t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    t === 'application/vnd.ms-excel' ||
    t === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    t === 'image/jpeg' ||
    t === 'image/png' ||
    t === 'image/webp'
  )
}

/** Nome originale senza path (per input rinomina). */
export function allegatoOriginalBasename(file: File | string): string {
  const raw = typeof file === 'string' ? file : file.name
  return raw.replace(/^.*[\\/]/, '').trim() || 'allegato'
}

export function buildAllegatoStorageFilename(originalName: string): string {
  const ext = getFileExtension(originalName) || 'bin'
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const randomId = Math.random().toString(36).slice(2, 11)
  return `allegato_${timestamp}_${randomId}.${ext}`
}
