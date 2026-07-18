/** Palette Goleee – condivisa tra pagine del gestionale */
export const GOLEE = {
  surface: '#FFFFFF',
  surfaceMuted: '#F4F6F8',
  pageBg: '#EEF1F5',
  border: '#E8ECF0',
  text: '#1A2332',
  textMuted: '#6B7280',
  accent: '#00C48C',
  accentSoft: '#E6FAF3',
  accentHover: '#00A876',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  success: '#10B981',
  successSoft: '#ECFDF5',
} as const

export const goleeCardClass = 'rounded-2xl border shadow-sm bg-white overflow-hidden'

export const goleeLabelClass = 'block text-xs font-semibold uppercase tracking-wide mb-1.5'

export const goleeInputClass =
  'w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#00C48C33]'

export const goleeInputStyle = {
  backgroundColor: GOLEE.surface,
  borderColor: GOLEE.border,
  color: GOLEE.text,
} as const
