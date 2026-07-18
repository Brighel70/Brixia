import { useEffect, useState, type ReactEventHandler } from 'react'
import { analyzeLogoBackdrop, logoBackdropClass, type LogoSurface } from '@/lib/logoContrast'

interface AdaptiveLogoProps {
  src: string
  alt: string
  surface: LogoSurface
  className?: string
  imgClassName?: string
  onError?: ReactEventHandler<HTMLImageElement>
}

export default function AdaptiveLogo({
  src,
  alt,
  surface,
  className = '',
  imgClassName = 'max-h-full max-w-full object-contain',
  onError,
}: AdaptiveLogoProps) {
  const [backdrop, setBackdrop] = useState<'none' | 'light' | 'dark'>(surface === 'light' ? 'dark' : 'none')

  useEffect(() => {
    let cancelled = false
    setBackdrop(surface === 'light' ? 'dark' : 'none')

    analyzeLogoBackdrop(src, surface).then(result => {
      if (!cancelled) setBackdrop(result)
    })

    return () => {
      cancelled = true
    }
  }, [src, surface])

  return (
    <div className={`flex items-center justify-center overflow-hidden ${logoBackdropClass(backdrop)} ${className}`}>
      <img src={src} alt={alt} className={imgClassName} onError={onError} />
    </div>
  )
}
