/**
 * Utility functions for fee management
 */

// Determine installment status
export const getInstallmentStatus = (dueDate: string): 'pending' | 'overdue' => {
  const today = new Date()
  const due = new Date(dueDate)
  return today > due ? 'overdue' : 'pending'
}

// Calculate days late
export const calculateDaysLate = (dueDate: string, paidAt: string): number => {
  const due = new Date(dueDate)
  const paid = new Date(paidAt)
  const diffTime = paid.getTime() - due.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// Calculate fee totals
export const calculateFeeTotals = (feeId: string, assignments: any[]) => {
  const feeAssignments = assignments.filter(a => a.fee_id === feeId)
  
  if (feeAssignments.length === 0) {
    return {
      total: 0,
      paid: 0,
      pending: 0,
      installments: []
    }
  }

  const fee = feeAssignments[0]?.fees
  if (!fee) return { total: 0, paid: 0, pending: 0, installments: [] }

  const total = fee.amount
  const paid = feeAssignments
    .filter(a => a.status === 'paid')
    .reduce((sum, a) => sum + a.amount, 0)
  const pending = total - paid

  return {
    total: total / 100, // Converti da centesimi
    paid: paid / 100,
    pending: pending / 100,
    installments: fee.installments || []
  }
}

// Formattazione importi: € 1.234.567,89 (punto migliaia, virgola decimali, sempre 2 decimali)
export const formatCurrency = (amount: number): string => {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '€ 0,00'
  const fixed = Math.abs(n).toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sign = n < 0 ? '- ' : ''
  return `€ ${sign}${withDots},${decPart}`
}

// Format fee amount (amount in centesimi)
export const formatFeeAmount = (amount: number): string => {
  return formatCurrency(amount / 100)
}

// Get payment status color
export const getPaymentStatusColor = (status: string): string => {
  switch (status) {
    case 'paid':
    case 'pagato':
      return 'bg-green-100 text-green-800'
    case 'pending':
    case 'in_attesa':
      return 'bg-yellow-100 text-yellow-800'
    case 'overdue':
    case 'scaduto':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

// Get installment status color
export const getInstallmentStatusColor = (status: string, dueDate: string): string => {
  if (status === 'paid') {
    return 'bg-blue-50 border-blue-200'
  }
  
  const installmentStatus = getInstallmentStatus(dueDate)
  return installmentStatus === 'overdue' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
}

// Check if fee is mandatory
export const isMandatoryFee = (fee: any): boolean => {
  return fee.is_mandatory === true
}

// Get fee category display name
export const getFeeCategoryDisplayName = (category: string): string => {
  const categoryMap: Record<string, string> = {
    'all': 'Tutte',
    'U6': 'Under 6',
    'U8': 'Under 8',
    'U10': 'Under 10',
    'U12': 'Under 12',
    'U14': 'Under 14',
    'U16': 'Under 16',
    'U18': 'Under 18',
    'SERIE_C': 'Serie C',
    'SERIE_B': 'Serie B',
    'SENIORES': 'Seniores',
    'SENIOR': 'Senior',
    'PODEROSA': 'Poderosa',
    'GUSSAGOLD': 'Gussagold',
    'BRIXIAOLD': 'Brixia Old',
    'LEONESSE': 'Leonesse'
  }
  
  return categoryMap[category] || category
}

export interface FeeForCategoryMatch {
  name: string
  description?: string | null
  category?: string | null
  applicable_categories?: string[] | null
}

/** Termini di ricerca per match testuale su nome/descrizione quota */
export const getCategorySearchTerms = (categoryCode: string, categoryLabel?: string): string[] => {
  const terms = new Set<string>()
  const code = (categoryCode || '').trim()
  const label = (categoryLabel || getFeeCategoryDisplayName(code)).trim()

  if (label) terms.add(label)
  if (code) {
    terms.add(code)
    terms.add(code.replace(/_/g, ' '))
    const underMatch = code.match(/^U(\d+)$/i)
    if (underMatch) {
      terms.add(`Under ${underMatch[1]}`)
    }
  }

  return Array.from(terms).filter(Boolean)
}

const normalizeCategoryToken = (value: string): string =>
  (value || '').trim().toUpperCase().replace(/\s+/g, '_')

export interface CategoryOptionForMatch {
  value: string
  label: string
}

/** Token categoria mostrati in tabella (stessa logica della colonna Categoria) */
export const getFeeDisplayedCategoryTokens = (fee: FeeForCategoryMatch): string[] => {
  if (fee.applicable_categories && fee.applicable_categories.length > 0) {
    return fee.applicable_categories
  }
  if (fee.category) {
    return [fee.category]
  }
  return []
}

const resolveCategoryCode = (
  stored: string,
  categoryOptions?: CategoryOptionForMatch[]
): string => {
  const norm = normalizeCategoryToken(stored)
  if (categoryOptions) {
    const byValue = categoryOptions.find(o => normalizeCategoryToken(o.value) === norm)
    if (byValue) return byValue.value
    const byLabel = categoryOptions.find(o => normalizeCategoryToken(o.label) === norm)
    if (byLabel) return byLabel.value
  }
  const upper = (stored || '').trim().toUpperCase()
  if (/^U\d+$/.test(upper) || getFeeCategoryDisplayName(upper) !== upper) {
    return upper
  }
  return stored
}

/** La categoria del filtro compare tra i badge della colonna Categoria */
export const feeHasSelectedCategory = (
  fee: FeeForCategoryMatch,
  categoryCode: string,
  categoryOptions?: CategoryOptionForMatch[]
): boolean => {
  const filterLabel = categoryOptions?.find(c => c.value === categoryCode)?.label
    || getFeeCategoryDisplayName(categoryCode)
  const normalizedFilterCode = normalizeCategoryToken(categoryCode)
  const normalizedFilterLabel = normalizeCategoryToken(filterLabel)

  return getFeeDisplayedCategoryTokens(fee).some(token => {
    const normalizedToken = normalizeCategoryToken(token)
    if (normalizedToken === 'ALL') return false

    const resolvedCode = resolveCategoryCode(token, categoryOptions)
    const normalizedResolvedCode = normalizeCategoryToken(resolvedCode)
    const displayLabel = categoryOptions?.find(c => c.value === resolvedCode)?.label
      || categoryOptions?.find(c => normalizeCategoryToken(c.label) === normalizedToken)?.label
      || getFeeCategoryDisplayName(resolvedCode)
      || token
    const normalizedDisplayLabel = normalizeCategoryToken(displayLabel)

    return (
      normalizedToken === normalizedFilterCode ||
      normalizedToken === normalizedFilterLabel ||
      normalizedResolvedCode === normalizedFilterCode ||
      normalizedDisplayLabel === normalizedFilterLabel
    )
  })
}

/**
 * Verifica se una quota corrisponde al filtro categoria:
 * - la categoria del filtro è tra quelle mostrate in colonna Categoria
 * - oppure il nome della quota contiene il testo della categoria (es. "Under 18")
 *
 * Le quote "Tutte le categorie" non matchano un filtro specifico, salvo se
 * includeAllCategoryFees è true (es. modal assegnazione).
 */
export const feeMatchesCategoryFilter = (
  fee: FeeForCategoryMatch,
  categoryCode: string,
  categoryLabel?: string,
  options?: { includeAllCategoryFees?: boolean; categoryOptions?: CategoryOptionForMatch[] }
): boolean => {
  if (!categoryCode || categoryCode === 'all') return true

  const includeAll = options?.includeAllCategoryFees ?? false
  const categoryOptions = options?.categoryOptions

  const tokens = getFeeDisplayedCategoryTokens(fee)
  if (tokens.length > 0) {
    const normalizedTokens = tokens.map(t => normalizeCategoryToken(t))
    if (includeAll && normalizedTokens.includes('ALL')) return true
    if (feeHasSelectedCategory(fee, categoryCode, categoryOptions)) return true
  } else if (includeAll) {
    return false
  }

  const label = categoryLabel || getFeeCategoryDisplayName(categoryCode)
  const nameHaystack = (fee.name || '').toLowerCase()
  return getCategorySearchTerms(categoryCode, label).some(term =>
    term.length > 0 && nameHaystack.includes(term.toLowerCase())
  )
}

export interface DbCategory {
  id: string
  name: string
  code: string
}

/** Codici categoria del giocatore (da UUID, codice o nome) */
export const getPersonCategoryCodes = (
  person: { player_categories?: unknown[] } | null | undefined,
  categoryOptions?: CategoryOptionForMatch[],
  dbCategories?: DbCategory[]
): string[] => {
  if (!person?.player_categories?.length) return []

  const codes = new Set<string>()

  for (const raw of person.player_categories) {
    if (typeof raw === 'string') {
      const fromDb = dbCategories?.find(c => c.id === raw)
      if (fromDb?.code) {
        codes.add(fromDb.code)
        continue
      }
      if (categoryOptions?.some(c => c.value === raw)) {
        codes.add(raw)
        continue
      }
      if (!raw.includes('-')) {
        codes.add(raw)
      }
      continue
    }

    if (raw && typeof raw === 'object') {
      const obj = raw as {
        code?: string
        name?: string
        categories?: { code?: string; name?: string }
      }
      const nestedCode = obj.categories?.code ?? obj.code
      if (nestedCode) {
        codes.add(nestedCode)
        continue
      }
      const nestedName = obj.categories?.name ?? obj.name
      if (nestedName) {
        const fromDb = dbCategories?.find(c => c.name === nestedName)
        if (fromDb?.code) {
          codes.add(fromDb.code)
          continue
        }
        const fromOpt = categoryOptions?.find(c => c.label === nestedName)
        if (fromOpt) {
          codes.add(fromOpt.value)
        }
      }
    }
  }

  return Array.from(codes)
}

/** Il giocatore appartiene alla categoria selezionata nel filtro */
export const personMatchesCategoryFilter = (
  person: { player_categories?: unknown[] } | null | undefined,
  categoryCode: string,
  options?: { categoryOptions?: CategoryOptionForMatch[]; dbCategories?: DbCategory[] }
): boolean => {
  if (!categoryCode || categoryCode === 'all') return true

  const filterLabel = options?.categoryOptions?.find(c => c.value === categoryCode)?.label
    || getFeeCategoryDisplayName(categoryCode)
  const normalizedFilterCode = normalizeCategoryToken(categoryCode)
  const normalizedFilterLabel = normalizeCategoryToken(filterLabel)

  return getPersonCategoryCodes(person, options?.categoryOptions, options?.dbCategories).some(code => {
    const normalizedCode = normalizeCategoryToken(code)
    const displayLabel = options?.categoryOptions?.find(c => c.value === code)?.label
      || options?.dbCategories?.find(c => c.code === code)?.name
      || getFeeCategoryDisplayName(code)
    const normalizedDisplayLabel = normalizeCategoryToken(displayLabel)
    return (
      normalizedCode === normalizedFilterCode ||
      normalizedCode === normalizedFilterLabel ||
      normalizedDisplayLabel === normalizedFilterLabel
    )
  })
}

/** Etichetta categoria da mostrare per un giocatore */
export const getPersonCategoryLabel = (
  person: { player_categories?: unknown[] } | null | undefined,
  categoryOptions?: CategoryOptionForMatch[],
  dbCategories?: DbCategory[]
): string => {
  const codes = getPersonCategoryCodes(person, categoryOptions, dbCategories)
  if (codes.length === 0) return 'N/A'
  const code = codes[0]
  return (
    categoryOptions?.find(c => c.value === code)?.label
    || dbCategories?.find(c => c.code === code)?.name
    || getFeeCategoryDisplayName(code)
    || code
  )
}

// Validate fee amount
export const isValidFeeAmount = (amount: number): boolean => {
  return amount > 0 && Number.isFinite(amount)
}

// Calculate total fees for person
export const calculatePersonTotalFees = (assignments: any[]): number => {
  return assignments.reduce((total, assignment) => {
    return total + (assignment.amount || 0)
  }, 0)
}

// Calculate paid fees for person
export const calculatePersonPaidFees = (assignments: any[]): number => {
  return assignments
    .filter(assignment => assignment.status === 'paid')
    .reduce((total, assignment) => {
      return total + (assignment.amount || 0)
    }, 0)
}

// Calculate pending fees for person
export const calculatePersonPendingFees = (assignments: any[]): number => {
  return assignments
    .filter(assignment => assignment.status !== 'paid')
    .reduce((total, assignment) => {
      return total + (assignment.amount || 0)
    }, 0)
}







