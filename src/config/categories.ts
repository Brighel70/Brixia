// Configurazione categorie BRIXIA Rugby - Aggiornata con nuove categorie
export const BRIXIA_CATEGORIES = [
  { code: 'U6', name: 'Under 6', sort: 1, description: 'Categoria Under 6 anni' },
  { code: 'U8', name: 'Under 8', sort: 2, description: 'Categoria Under 8 anni' },
  { code: 'U10', name: 'Under 10', sort: 3, description: 'Categoria Under 10 anni' },
  { code: 'U12', name: 'Under 12', sort: 4, description: 'Categoria Under 12 anni' },
  { code: 'U14', name: 'Under 14', sort: 5, description: 'Categoria Under 14 anni' },
  { code: 'U16', name: 'Under 16', sort: 6, description: 'Categoria Under 16 anni' },
  { code: 'U18', name: 'Under 18', sort: 7, description: 'Categoria Under 18 anni' },
  { code: 'SERIE_C', name: 'Serie C', sort: 8, description: 'Categoria Serie C' },
  { code: 'SERIE_B', name: 'Serie B', sort: 9, description: 'Categoria Serie B' },
  { code: 'SENIORES', name: 'Seniores', sort: 10, description: 'Categoria Seniores' },
  { code: 'PODEROSA', name: 'Poderosa', sort: 11, description: 'Categoria Poderosa' },
  { code: 'GUSSAGOLD', name: 'GussagOld', sort: 12, description: 'Categoria GussagOld' },
  { code: 'BRIXIAOLD', name: 'Brixia Old', sort: 13, description: 'Categoria Brixia Old' },
  { code: 'LEONESSE', name: 'Leonesse', sort: 14, description: 'Categoria Leonesse' }
] as const

export type CategoryCode = typeof BRIXIA_CATEGORIES[number]['code']

export const getCategoryByCode = (code: string) => {
  return BRIXIA_CATEGORIES.find(cat => cat.code === code)
}

export const getCategorySortOrder = (code: string) => {
  const category = getCategoryByCode(code)
  return category?.sort || 999
}

export const isValidCategoryCode = (code: string): code is CategoryCode => {
  return BRIXIA_CATEGORIES.some(cat => cat.code === code)
}
