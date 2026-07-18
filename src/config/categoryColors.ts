/** Colore di sfondo Tailwind per ogni categoria (barre, tag, badge). */
export const CATEGORY_BG_COLORS: Record<string, string> = {
  U6: 'bg-pink-500',
  U8: 'bg-cyan-600',
  U10: 'bg-teal-600',
  U12: 'bg-green-600',
  U14: 'bg-blue-600',
  U16: 'bg-emerald-600',
  U18: 'bg-yellow-500',
  SERIE_C: 'bg-violet-600',
  SERIE_B: 'bg-red-600',
  SENIORES: 'bg-orange-600',
  PODEROSA: 'bg-fuchsia-600',
  GUSSAGOLD: 'bg-indigo-600',
  BRIXIAOLD: 'bg-slate-600',
  LEONESSE: 'bg-rose-600',
}

/** Stesso colore dei tag per i cerchi nelle tabelle. */
export const CATEGORY_CIRCLE_COLORS: Record<string, string> = {
  U6: 'bg-pink-500 text-white',
  U8: 'bg-cyan-600 text-white',
  U10: 'bg-teal-600 text-white',
  U12: 'bg-green-600 text-white',
  U14: 'bg-blue-600 text-white',
  U16: 'bg-emerald-600 text-white',
  U18: 'bg-yellow-500 text-gray-900',
  SERIE_C: 'bg-violet-600 text-white',
  SERIE_B: 'bg-red-600 text-white',
  SENIORES: 'bg-orange-600 text-white',
  PODEROSA: 'bg-fuchsia-600 text-white',
  GUSSAGOLD: 'bg-indigo-600 text-white',
  BRIXIAOLD: 'bg-slate-600 text-white',
  LEONESSE: 'bg-rose-600 text-white',
}

export function getCategoryCode(category: { code?: string | null }): string {
  return (category?.code || '').toUpperCase()
}

export function getCategoryBgClass(category: { code?: string | null }): string {
  return CATEGORY_BG_COLORS[getCategoryCode(category)] || 'bg-blue-600'
}

export function getCategoryCircleClass(category: { code?: string | null }): string {
  return CATEGORY_CIRCLE_COLORS[getCategoryCode(category)] || 'bg-blue-600 text-white'
}

export function getCategoryTextClass(category: { code?: string | null }): string {
  return getCategoryCode(category) === 'U18' ? 'text-gray-900' : 'text-white'
}
