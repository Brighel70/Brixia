export type ActivityCardStyle = {
  gradient: string
  bg: string
  icon: string
  color: string
  border: string
}

export type ActivityAmountFields = {
  activity_type: string
  cost?: number | string | null
  amount?: number | null
  cost_currency?: string | null
  currency?: string | null
}

export const isPurchaseActivityType = (type: string) => {
  const t = (type || '').toLowerCase()
  return t === 'acquisto_tutore' || t === 'equipment_purchase'
}

export const getActivityAmountValue = (activity: ActivityAmountFields) => {
  const raw = activity.cost ?? activity.amount
  if (raw == null || raw === '') return 0
  const value = typeof raw === 'string' ? parseFloat(raw) : raw
  return Number.isNaN(value) ? 0 : value
}

export const getActivityCostDisplay = (activity: ActivityAmountFields) => {
  const raw = activity.cost ?? activity.amount
  if (raw == null || raw === '') return null
  const value = typeof raw === 'string' ? parseFloat(raw) : raw
  if (Number.isNaN(value)) return null
  return { value, currency: activity.cost_currency || activity.currency || 'EUR' }
}

const isTestCostActivityType = (type: string) => {
  const t = (type || '').toLowerCase()
  return t === 'test' || t === 'spesa_esami_diagnostici'
}

const isEquipmentCostActivityType = (type: string) => {
  const t = (type || '').toLowerCase()
  return t === 'equipment_purchase' || t === 'acquisto_tutore'
}

export { isTestCostActivityType, isEquipmentCostActivityType }

const isCostRelatedActivityType = (type: string) => {
  const t = (type || '').toLowerCase()
  return t === 'physiotherapy' || isTestCostActivityType(t) || isEquipmentCostActivityType(t) || t === 'expenses'
}

export const getActivityCardStyleIcon = (type: string) => {
  const t = (type || '').toLowerCase()
  const icons: Record<string, string> = {
    medical_visit: '🏥',
    physiotherapy: '💪',
    test: '🔬',
    spesa_esami_diagnostici: '🔬',
    note: '📝',
    insurance_refund: '💰',
    insurance_communication: '📋',
    equipment_purchase: '🛒',
    acquisto_tutore: '🦴',
    expenses: '💸',
    other: '📋',
  }
  return icons[t] || '📋'
}

export const getActivityCardStyle = (
  type: string,
  activity?: ActivityAmountFields
): ActivityCardStyle => {
  const t = (type || '').toLowerCase()
  if (t === 'insurance_communication') {
    return {
      gradient: 'from-gray-500 to-gray-600',
      bg: 'bg-gray-50',
      icon: '📋',
      color: 'text-gray-700',
      border: 'border-gray-200',
    }
  }
  if (t === 'insurance_refund') {
    return {
      gradient: 'from-green-500 to-green-600',
      bg: 'bg-green-50',
      icon: '💰',
      color: 'text-green-700',
      border: 'border-green-200',
    }
  }
  if (isCostRelatedActivityType(t) || (activity && getActivityAmountValue(activity) > 0)) {
    return {
      gradient: 'from-red-500 to-red-600',
      bg: 'bg-red-50',
      icon: getActivityCardStyleIcon(t),
      color: 'text-red-700',
      border: 'border-red-200',
    }
  }
  switch (t) {
    case 'medical_visit':
    case 'visita_medica':
    case 'visita_specialistica':
      return {
        gradient: 'from-blue-500 to-blue-600',
        bg: 'bg-blue-50',
        icon: '🏥',
        color: 'text-blue-700',
        border: 'border-blue-200',
      }
    case 'note':
    case 'annotazione':
    case 'other':
    case 'altro':
      return {
        gradient: 'from-gray-500 to-gray-600',
        bg: 'bg-gray-50',
        icon: '📝',
        color: 'text-gray-700',
        border: 'border-gray-200',
      }
    default:
      return {
        gradient: 'from-gray-500 to-gray-600',
        bg: 'bg-gray-50',
        icon: getActivityCardStyleIcon(t),
        color: 'text-gray-700',
        border: 'border-gray-200',
      }
  }
}
