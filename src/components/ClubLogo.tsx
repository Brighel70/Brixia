import { Building2 } from 'lucide-react'

interface ClubLogoProps {
  logoUrl?: string | null
  name: string
  size?: 'sm' | 'smPlus' | 'md'
  className?: string
}

const SIZE_STYLES = {
  sm: {
    box: 'h-8 w-8 rounded-lg',
    placeholderBox: 'h-5 w-5 rounded-md',
    icon: 'h-4 w-4',
    placeholderIcon: 'h-2.5 w-2.5',
    padding: 'p-1',
  },
  smPlus: {
    box: 'h-14 w-14 rounded-xl',
    placeholderBox: 'h-9 w-9 rounded-lg',
    icon: 'h-8 w-8',
    placeholderIcon: 'h-5 w-5',
    padding: 'p-1',
  },
  md: {
    box: 'h-12 w-12 rounded-2xl',
    placeholderBox: 'h-8 w-8 rounded-xl',
    icon: 'h-6 w-6',
    placeholderIcon: 'h-4 w-4',
    padding: 'p-1',
  },
} as const

export default function ClubLogo({ logoUrl, name, size = 'md', className = '' }: ClubLogoProps) {
  const styles = SIZE_STYLES[size]

  if (logoUrl) {
    return (
      <div
        className={`${styles.box} shrink-0 overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 ${className}`}
      >
        <img src={logoUrl} alt={`Logo ${name}`} className={`h-full w-full object-contain ${styles.padding}`} />
      </div>
    )
  }

  return (
    <div
      className={`${styles.box} flex shrink-0 items-center justify-center bg-slate-950 text-white shadow-sm ${className}`}
    >
      <Building2 className={styles.placeholderIcon} />
    </div>
  )
}
