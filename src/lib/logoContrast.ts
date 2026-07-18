export type LogoSurface = 'light' | 'dark'
export type LogoBackdrop = 'none' | 'light' | 'dark'

/** Analizza i pixel visibili del logo e decide se serve uno sfondo contrastato. */
export function analyzeLogoBackdrop(src: string, surface: LogoSurface): Promise<LogoBackdrop> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const sampleSize = Math.max(1, Math.min(img.naturalWidth || 64, img.naturalHeight || 64, 96))
        const canvas = document.createElement('canvas')
        canvas.width = sampleSize
        canvas.height = sampleSize
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve('none')
          return
        }

        ctx.drawImage(img, 0, 0, sampleSize, sampleSize)
        const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize)

        let totalLuminance = 0
        let visiblePixels = 0
        let lightPixels = 0
        let darkPixels = 0

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3]
          if (alpha < 48) continue

          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b

          totalLuminance += luminance
          visiblePixels += 1
          if (luminance >= 205) lightPixels += 1
          if (luminance <= 95) darkPixels += 1
        }

        if (visiblePixels === 0) {
          resolve('none')
          return
        }

        const averageLuminance = totalLuminance / visiblePixels
        const lightRatio = lightPixels / visiblePixels
        const darkRatio = darkPixels / visiblePixels

        if (surface === 'light') {
          resolve(averageLuminance >= 175 || lightRatio >= 0.42 ? 'dark' : 'none')
          return
        }

        resolve(averageLuminance <= 125 || darkRatio >= 0.42 ? 'light' : 'none')
      } catch {
        resolve(surface === 'light' ? 'dark' : 'light')
      }
    }
    img.onerror = () => resolve(surface === 'light' ? 'dark' : 'none')
    img.src = src
  })
}

export function logoBackdropClass(backdrop: LogoBackdrop): string {
  if (backdrop === 'dark') return 'bg-[#071226]'
  if (backdrop === 'light') return 'bg-white'
  return 'bg-transparent'
}
