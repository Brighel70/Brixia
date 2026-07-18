/**
 * Utility functions for person management
 */

// Calculate age from birth date
export const calculateAge = (birthDate: string): number => {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  
  return age
}

// Format date to Italian locale
export const formatDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('it-IT')
}

// Format currency to Italian locale
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount / 100) // Convert from centesimi
}

// Get sport season
export const getSportSeason = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // getMonth() restituisce 0-11
  
  // Se siamo tra settembre e dicembre, la stagione inizia quest'anno
  if (month >= 9) {
    return `${year}/${year + 1}`
  } else {
    // Altrimenti la stagione è iniziata l'anno scorso
    return `${year - 1}/${year}`
  }
}

// Validate email
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate phone number
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

// Generate random string
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Check if person is minor
export const isMinor = (birthDate: string): boolean => {
  return calculateAge(birthDate) < 18
}

// Get person initials
export const getPersonInitials = (givenName: string, familyName: string): string => {
  return `${givenName?.charAt(0) || ''}${familyName?.charAt(0) || ''}`.toUpperCase()
}

// Format person full name
export const formatPersonName = (givenName: string, familyName: string): string => {
  return `${givenName || ''} ${familyName || ''}`.trim()
}

/** Etichette abbreviate per ruoli in campo: Mediano di Mischia → Mediano, Mediano d'Apertura → Apertura */
export const getPositionDisplayName = (name: string): string => {
  if (!name) return name
  if (/Mediano\s+di\s+Mischia/i.test(name)) return 'Mediano'
  if (/Mediano\s+d['']Apertura/i.test(name)) return 'Apertura'
  return name
}

export function getPlayerProfileRoleLabel(
  playerPositions: unknown,
  positionsMap: Record<string, string>
): string {
  const positionIds = Array.isArray(playerPositions) ? playerPositions : []
  if (positionIds.length === 0) return ''
  return positionIds
    .map((id: string) => getPositionDisplayName(positionsMap[id] || ''))
    .filter(Boolean)
    .join(', ')
}

export function getMatchListDisplayRole(
  number: number,
  profileRoleLabel: string,
  rugbyRolesByNumber: Record<number, string>
): string {
  if (number <= 15) return rugbyRolesByNumber[number] || ''
  return profileRoleLabel.trim()
}






