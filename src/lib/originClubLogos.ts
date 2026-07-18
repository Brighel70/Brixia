import { supabase } from '@/lib/supabaseClient'

/** Bucket già configurato in setup_logo_app_mobile.sql */
export const ORIGIN_CLUB_LOGOS_BUCKET = 'brand'
export const ORIGIN_CLUB_LOGOS_PREFIX = 'origin-clubs'

const LOGO_EXTENSIONS = ['png', 'svg', 'jpg', 'jpeg', 'webp'] as const

export function originClubLogoPaths(clubId: string): string[] {
  return LOGO_EXTENSIONS.map((ext) => `${ORIGIN_CLUB_LOGOS_PREFIX}/${clubId}.${ext}`)
}

export function storagePathFromLogoUrl(url: string): string | null {
  try {
    const marker = `/storage/v1/object/public/${ORIGIN_CLUB_LOGOS_BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx >= 0) return decodeURIComponent(url.slice(idx + marker.length))
  } catch {
    // ignore
  }
  return null
}

/** Ridimensiona l'immagine mantenendo la trasparenza. Gli SVG non vengono modificati. */
export async function compressImageDataUrl(dataUrl: string, maxSizePx = 512): Promise<string> {
  if (dataUrl.startsWith('data:image/svg')) return dataUrl
  return new Promise((resolve) => {
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let w = img.width
      let h = img.height
      if (w > maxSizePx || h > maxSizePx) {
        if (w > h) {
          h = Math.round((h * maxSizePx) / w)
          w = maxSizePx
        } else {
          w = Math.round((w * maxSizePx) / h)
          h = maxSizePx
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export async function uploadOriginClubLogoFromDataUrl(
  clubId: string,
  dataUrl: string
): Promise<string> {
  const isSvg = dataUrl.startsWith('data:image/svg')
  const ext = isSvg ? 'svg' : 'png'
  const path = `${ORIGIN_CLUB_LOGOS_PREFIX}/${clubId}.${ext}`
  const contentType = isSvg ? 'image/svg+xml' : 'image/png'

  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const file = new File([blob], `${clubId}.${ext}`, { type: contentType })

  await supabase.storage
    .from(ORIGIN_CLUB_LOGOS_BUCKET)
    .remove(originClubLogoPaths(clubId))
    .catch(() => {})

  const { error } = await supabase.storage
    .from(ORIGIN_CLUB_LOGOS_BUCKET)
    .upload(path, file, { upsert: true, contentType, cacheControl: '3600' })

  if (error) {
    console.error('Errore upload logo società:', error)
    if (error.message?.includes('Bucket not found') || error.message?.includes('bucket')) {
      throw new Error(
        'Bucket Storage "brand" non trovato. Crea il bucket pubblico "brand" in Supabase oppure esegui setup_logo_app_mobile.sql'
      )
    }
    throw error
  }

  const { data } = supabase.storage.from(ORIGIN_CLUB_LOGOS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteOriginClubLogo(clubId: string, logoUrl?: string | null): Promise<void> {
  const paths = new Set(originClubLogoPaths(clubId))
  if (logoUrl) {
    const fromUrl = storagePathFromLogoUrl(logoUrl)
    if (fromUrl) paths.add(fromUrl)
  }
  await supabase.storage.from(ORIGIN_CLUB_LOGOS_BUCKET).remove([...paths]).catch(() => {})
}
