import { useState, useEffect, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Cake, PartyPopper, CalendarDays, Loader2, Gift, X, Search, LayoutGrid, Table2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { getBirthdayMessage } from '@/lib/birthdayMessage'
import { getBrandConfig } from '@/config/brand'
import Header from '@/components/Header'
import WhatsAppOpenModal from '@/components/WhatsAppOpenModal'

/** Palette ispirata al gestionale Goleee: superfici chiare, verde smeraldo, tipografia pulita */
const GOLEE = {
  surface: '#FFFFFF',
  surfaceMuted: '#F4F6F8',
  border: '#E8ECF0',
  text: '#1A2332',
  textMuted: '#6B7280',
  accent: '#00C48C',
  accentSoft: '#E6FAF3',
  accentHover: '#00A876',
  today: '#FF6B35',
  todaySoft: '#FFF0EB',
  tomorrow: '#F59E0B',
  tomorrowSoft: '#FEF3C7',
  week: '#3B82F6',
  weekSoft: '#EFF6FF',
  later: '#8B5CF6',
  laterSoft: '#F3E8FF',
} as const

const AIRTABLE = {
  border: '#E8ECF0',
  headerBg: '#FAFBFC',
  headerText: '#6B7280',
  rowBg: '#FFFFFF',
  rowHover: '#F4F6F8',
  icon: '#9CA3AF',
  iconHover: '#374151',
} as const

const BIRTHDAY_TABLE_COLS = ['Nome', 'Data', 'Età', 'Ruolo', 'Stato', 'Azione'] as const

interface UserRole {
  id: string
  name: string
}

interface PersonRoleSource {
  is_player?: boolean | null
  app_role?: string | null
  staff_roles?: string[] | null
  additional_roles?: string[] | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ROLE_ALIASES: Record<string, string> = {
  player: 'Giocatore',
  giocatore: 'Giocatore',
  fisio: 'Fisioterapista',
  fisioterapista: 'Fisioterapista',
  'team-manager': 'Team Manager',
  'team manager': 'Team Manager',
  tutor: 'Tutor',
  medico: 'Medico',
  allenatore: 'Allenatore',
  dirigente: 'Dirigente',
  segreteria: 'Segreteria',
  admin: 'Admin',
  persona: 'Persona',
}

const normalizeRoleName = (role: string): string => {
  const trimmed = role.trim()
  if (!trimmed) return trimmed
  const key = trimmed.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  return ROLE_ALIASES[key] ?? ROLE_ALIASES[key.replace(/ /g, '-')] ?? trimmed
}

const roleDedupKey = (role: string) => normalizeRoleName(role).toLowerCase()

const resolveRoleId = (roleId: string, userRoles: UserRole[]): string | null => {
  if (roleId === 'tutor') return 'Tutor'
  if (UUID_RE.test(roleId)) {
    const name = userRoles.find((r) => r.id === roleId)?.name
    return name ? normalizeRoleName(name) : null
  }
  const roleStr = String(roleId).toLowerCase()
  const roleStrNorm = roleStr.replace(/-/g, ' ')
  if (ROLE_ALIASES[roleStr] || ROLE_ALIASES[roleStrNorm]) {
    return normalizeRoleName(roleStrNorm)
  }
  const matched = userRoles.find((r) => {
    const nameLower = r.name.toLowerCase()
    return (
      nameLower === roleStr
      || nameLower === roleStrNorm
      || (roleStr === 'fisio' && (r.name === 'Fisioterapista' || r.name === 'Fisio'))
      || (roleStr === 'fisioterapista' && (r.name === 'Fisio' || r.name === 'Fisioterapista'))
      || (roleStr === 'team-manager' && nameLower === 'team manager')
      || (roleStr === 'player' && (nameLower === 'player' || nameLower === 'giocatore'))
    )
  })
  return matched ? normalizeRoleName(matched.name) : normalizeRoleName(roleId)
}

const buildPersonRoleLabel = (
  person: PersonRoleSource,
  userRoles: UserRole[],
  tutorRelationship?: string | null,
): string => {
  const roles: string[] = []
  let mainAppRole: string | null = null

  const addRole = (name: string | null | undefined) => {
    if (!name) return
    const normalized = normalizeRoleName(name)
    if (!roles.some((r) => roleDedupKey(r) === roleDedupKey(normalized))) {
      roles.push(normalized)
    }
  }

  if (person.is_player) addRole('Giocatore')

  if (person.app_role) {
    let appRoleName = person.app_role
    if (UUID_RE.test(person.app_role)) {
      appRoleName = userRoles.find((r) => r.id === person.app_role)?.name ?? person.app_role
    } else {
      const resolved = resolveRoleId(person.app_role, userRoles)
      if (resolved) appRoleName = resolved
    }
    mainAppRole = normalizeRoleName(appRoleName)
  }

  if (person.staff_roles?.length) {
    person.staff_roles.forEach((roleId) => {
      const name = resolveRoleId(roleId, userRoles)
      if (!name) return
      if (mainAppRole && roleDedupKey(name) === roleDedupKey(mainAppRole)) return
      addRole(name)
    })
  }

  if (mainAppRole) addRole(mainAppRole)

  if (person.additional_roles?.length) {
    person.additional_roles.forEach((roleId) => {
      addRole(resolveRoleId(roleId, userRoles))
    })
  }

  if (roles.length === 0) roles.push('Persona')

  const rel = (tutorRelationship || '').trim()
  const formatted = roles.map((role) => {
    if (role.toLowerCase() === 'tutor' && rel) {
      return rel.toLowerCase().startsWith('tutor') ? rel : `Tutor ${rel}`
    }
    return role
  })

  return [...new Set(formatted)].join(' · ')
}

interface BirthdayPerson {
  id: string
  full_name: string
  given_name?: string | null
  family_name?: string | null
  date_of_birth: string
  phone?: string | null
  emergency_contact_phone?: string | null
  birthdayDate: Date
  daysUntilBirthday: number
  age: number
  roleLabel: string
}

interface BirthdaysPageProps {
  embedInLayout?: boolean
}

export default function BirthdaysPage({ embedInLayout = false }: BirthdaysPageProps) {
  const navigate = useNavigate()
  const brand = getBrandConfig()
  const accentColor = GOLEE.accent
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [whatsAppModal, setWhatsAppModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' })
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'week'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [listViewMode, setListViewMode] = useState<'cards' | 'table'>('cards')

  useEffect(() => {
    loadUpcomingBirthdays()
  }, [])

  const loadUpcomingBirthdays = async () => {
    try {
      setLoading(true)
      
      const [peopleResult, rolesResult, tutorRelResult] = await Promise.all([
        supabase
        .from('people')
        .select(`
          id,
          full_name,
          given_name,
          family_name,
          date_of_birth,
          phone,
            emergency_contact_phone,
            is_player,
            app_role,
            staff_roles,
            additional_roles
          `)
          .not('date_of_birth', 'is', null),
        supabase.from('user_roles').select('id, name'),
        supabase.from('tutor_athlete_relations').select('tutor_id, relationship'),
      ])

      const { data, error } = peopleResult
      const userRoles = (rolesResult.data || []) as UserRole[]
      const tutorRelationsData = tutorRelResult.error ? [] : (tutorRelResult.data || [])
      const tutorRelationshipByPerson = new Map<string, string>()
      for (const rel of tutorRelationsData || []) {
        if (!rel.tutor_id || !rel.relationship) continue
        if (!tutorRelationshipByPerson.has(rel.tutor_id)) {
          tutorRelationshipByPerson.set(rel.tutor_id, rel.relationship)
        }
      }

      if (error) {
        console.error('Errore nel caricamento compleanni:', error)
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(today.getDate() + 30)
      thirtyDaysFromNow.setHours(0, 0, 0, 0)

      const upcomingBirthdaysList = (data || [])
        .filter(person => {
          if (!person.date_of_birth) return false
          
          const birthDate = new Date(person.date_of_birth)
          const currentYear = today.getFullYear()
          const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate())
          
          if (birthdayThisYear < today) {
            birthdayThisYear.setFullYear(currentYear + 1)
          }
          
          return birthdayThisYear >= today && birthdayThisYear <= thirtyDaysFromNow
        })
        .map(person => {
          const birthDate = new Date(person.date_of_birth)
          const currentYear = today.getFullYear()
          const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate())
          
          if (birthdayThisYear < today) {
            birthdayThisYear.setFullYear(currentYear + 1)
          }
          
          const daysUntilBirthday = Math.ceil((birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          return {
            ...person,
            birthdayDate: birthdayThisYear,
            daysUntilBirthday,
            age: currentYear - birthDate.getFullYear() + (birthdayThisYear.getFullYear() - currentYear),
            roleLabel: buildPersonRoleLabel(person, userRoles, tutorRelationshipByPerson.get(person.id)),
          }
        })
        .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday)

      setUpcomingBirthdays(upcomingBirthdaysList)
    } catch (error) {
      console.error('Errore nel caricamento compleanni:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusStyle = (daysUntilBirthday: number) => {
    if (daysUntilBirthday === 0) {
      return { bg: GOLEE.todaySoft, text: GOLEE.today, border: '#FFD4C4', label: 'Oggi!' }
    }
    if (daysUntilBirthday === 1) {
      return { bg: GOLEE.tomorrowSoft, text: GOLEE.tomorrow, border: '#FDE68A', label: 'Domani' }
    }
    if (daysUntilBirthday <= 7) {
      return { bg: GOLEE.weekSoft, text: GOLEE.week, border: '#BFDBFE', label: `Tra ${daysUntilBirthday} giorni` }
    }
    return { bg: GOLEE.laterSoft, text: GOLEE.later, border: '#DDD6FE', label: `Tra ${daysUntilBirthday} giorni` }
  }

  const getRowAccent = (daysUntilBirthday: number) => {
    if (daysUntilBirthday === 0) return GOLEE.today
    if (daysUntilBirthday === 1) return GOLEE.tomorrow
    if (daysUntilBirthday <= 7) return GOLEE.week
    return GOLEE.later
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    })
  }

  const getDisplayName = (p: BirthdayPerson) =>
    (p.full_name || '').trim() || [p.given_name, p.family_name].filter(Boolean).join(' ').trim() || ''

  const getFirstNameForMessage = (p: BirthdayPerson) => {
    const gn = (p.given_name || '').trim()
    if (gn) return gn
    const full = (p.full_name || '').trim()
    if (full) return full.split(/\s+/)[0] || full
    return [p.given_name, p.family_name].filter(Boolean)[0]?.trim() || ''
  }

  const getPhoneForWhatsApp = (p: BirthdayPerson) => {
    const main = (p.phone || '').trim()
    if (main) return main
    return (p.emergency_contact_phone || '').trim()
  }

  const handleBirthdaySend = async (person?: BirthdayPerson) => {
    const target = person ?? upcomingBirthdays.filter(p => p.daysUntilBirthday === 0)[0]
    if (!target) return
    const firstName = getFirstNameForMessage(target)
    const message = getBirthdayMessage(firstName)
    const phoneToUse = getPhoneForWhatsApp(target)

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('person_id', target.id)
        .limit(1)
        .maybeSingle()
      await supabase.from('notifications').insert({
        ...(profile?.id ? { user_id: profile.id } : {}),
        person_id: target.id,
        title: 'Auguri di compleanno! 🎂',
        body: message,
        type: 'birthday_wishes',
        metadata: { person_id: target.id }
      })
    } catch (err) {
      console.warn('Errore invio notifica app mobile:', err)
    }

    if (phoneToUse) {
      const digits = String(phoneToUse).replace(/\D/g, '')
      const whatsappNumber = digits.startsWith('39') ? digits : (digits.startsWith('0') ? '39' + digits.slice(1) : '39' + digits)
      const url = `whatsapp://send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}`
      setWhatsAppModal({ open: true, url })
    }
  }

  const matchesSearch = (p: BirthdayPerson) => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return true
    const name = getDisplayName(p).toLowerCase()
    const given = (p.given_name || '').toLowerCase()
    const family = (p.family_name || '').toLowerCase()
    return name.includes(term) || given.includes(term) || family.includes(term)
  }

  const searchFiltered = upcomingBirthdays.filter(matchesSearch)

  const todayCount = searchFiltered.filter(p => p.daysUntilBirthday === 0).length
  const weekCount = searchFiltered.filter(p => p.daysUntilBirthday <= 7).length

  const filteredBirthdays = searchFiltered.filter(p => {
    if (activeFilter === 'today') return p.daysUntilBirthday === 0
    if (activeFilter === 'week') return p.daysUntilBirthday <= 7
    return true
  })

  const filterLabel = searchTerm.trim()
    ? `Risultati per "${searchTerm.trim()}"`
    : activeFilter === 'today'
      ? 'Compleanni di oggi'
      : activeFilter === 'week'
        ? 'Compleanni di questa settimana'
        : ''

  const pageBg = embedInLayout
    ? 'min-h-full'
    : 'min-h-screen'
  const contentBg = embedInLayout
    ? { backgroundColor: GOLEE.surfaceMuted }
    : { background: `linear-gradient(180deg, ${GOLEE.surfaceMuted} 0%, #EEF1F5 100%)` }

  const StatCard = ({
    icon: Icon,
    label,
    value,
    sublabel,
    iconBg,
    iconColor,
    action,
    onClick,
    active,
    activeColor,
  }: {
    icon: ElementType
    label: string
    value: number | string
    sublabel: string
    iconBg: string
    iconColor: string
    action?: React.ReactNode
    onClick?: () => void
    active?: boolean
    activeColor?: string
  }) => (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`rounded-2xl p-5 border shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'hover:shadow-md'}`}
      style={{
        backgroundColor: GOLEE.surface,
        borderColor: active && activeColor ? activeColor : GOLEE.border,
        borderWidth: active ? '2px' : '1px',
        boxShadow: active && activeColor ? `0 0 0 3px ${activeColor}22` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconBg }}
          >
            <Icon className="w-5 h-5" style={{ color: iconColor }} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLEE.textMuted }}>
              {label}
            </p>
            <p className="text-3xl font-bold leading-tight mt-0.5" style={{ color: GOLEE.text }}>
              {value}
            </p>
            <p className="text-sm mt-0.5" style={{ color: GOLEE.textMuted }}>
              {sublabel}
            </p>
          </div>
        </div>
        {action}
      </div>
    </div>
  )

  const BirthdayCardsGrid = ({ people }: { people: BirthdayPerson[] }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {people.map((person) => {
        const status = getStatusStyle(person.daysUntilBirthday)
        const rowAccent = getRowAccent(person.daysUntilBirthday)
        return (
          <div
            key={person.id}
            className="group flex flex-col rounded-xl border p-4 transition-all hover:shadow-md"
            style={{
              backgroundColor: GOLEE.surface,
              borderColor: GOLEE.border,
              borderTopWidth: '3px',
              borderTopColor: rowAccent,
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm"
                style={{ backgroundColor: GOLEE.accentSoft, color: accentColor }}
              >
                {(getDisplayName(person).charAt(0) || '?').toUpperCase()}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                  style={{
                    backgroundColor: status.bg,
                    color: status.text,
                    border: `1px solid ${status.border}`,
                  }}
                >
                  {status.label}
                </span>
                {person.daysUntilBirthday === 0 && (
                  <button
                    type="button"
                    onClick={() => handleBirthdaySend(person)}
                    title={
                      getPhoneForWhatsApp(person).length > 0
                        ? 'Invia auguri WhatsApp + notifica app'
                        : "Invia auguri nell'app mobile"
                    }
                    className="p-1.5 rounded-lg text-white transition-all hover:scale-105"
                    style={{ backgroundColor: accentColor }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = GOLEE.accentHover }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = accentColor }}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/create-person?edit=${person.id}&from=/birthdays`)}
              className="font-semibold text-left truncate w-full hover:underline mb-1"
              style={{ color: GOLEE.text }}
            >
              {getDisplayName(person)}
            </button>
            <p className="text-sm capitalize line-clamp-2 mt-auto" style={{ color: GOLEE.textMuted }}>
              {formatDate(person.birthdayDate)}
            </p>
            <div className="flex items-center justify-between gap-2 mt-1 min-w-0">
              <p className="text-xs truncate" style={{ color: GOLEE.textMuted }}>
                Compirà {person.age} anni
              </p>
              <span
                className="text-[10px] font-semibold uppercase tracking-wide shrink-0 text-right max-w-[55%] truncate"
                style={{ color: GOLEE.textMuted }}
                title={person.roleLabel}
              >
                {person.roleLabel}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )

  const BirthdayAirtable = ({ people }: { people: BirthdayPerson[] }) => (
    <div className="px-4 pb-4 pt-2">
      <div
        className="overflow-hidden rounded-lg"
        style={{
          border: `1px solid ${AIRTABLE.border}`,
          backgroundColor: AIRTABLE.rowBg,
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]" style={{ tableLayout: 'fixed', minWidth: '720px' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: AIRTABLE.headerBg }}>
                {BIRTHDAY_TABLE_COLS.map((label) => (
                  <th
                    key={label}
                    className={`px-4 py-2.5 text-xs font-medium ${
                      label === 'Età' || label === 'Stato' || label === 'Azione' ? 'text-center' : 'text-left'
                    }`}
                    style={{
                      color: AIRTABLE.headerText,
                      borderBottom: `1px solid ${AIRTABLE.border}`,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const status = getStatusStyle(person.daysUntilBirthday)
                const name = getDisplayName(person)
                return (
                  <tr
                    key={person.id}
                    className="transition-colors duration-100"
                    style={{ backgroundColor: AIRTABLE.rowBg }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = AIRTABLE.rowHover }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = AIRTABLE.rowBg }}
                  >
                    <td
                      className="px-4 py-3 truncate text-left"
                      style={{ color: GOLEE.text, borderBottom: `1px solid ${AIRTABLE.border}` }}
                      title={name}
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/create-person?edit=${person.id}&from=/birthdays`)}
                        className="font-medium hover:underline truncate max-w-full text-left"
                        style={{ color: GOLEE.text }}
                      >
                        {name}
                      </button>
                    </td>
                    <td
                      className="px-4 py-3 capitalize text-left"
                      style={{ color: GOLEE.textMuted, borderBottom: `1px solid ${AIRTABLE.border}` }}
                    >
                      {formatDate(person.birthdayDate)}
                    </td>
                    <td
                      className="px-4 py-3 text-center tabular-nums"
                      style={{ color: GOLEE.text, borderBottom: `1px solid ${AIRTABLE.border}` }}
                    >
                      {person.age}
                    </td>
                    <td
                      className="px-4 py-3 text-left truncate"
                      style={{ color: GOLEE.textMuted, borderBottom: `1px solid ${AIRTABLE.border}` }}
                      title={person.roleLabel}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wide">
                        {person.roleLabel}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-center"
                      style={{ borderBottom: `1px solid ${AIRTABLE.border}` }}
                    >
                      <span
                        className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{
                          backgroundColor: status.bg,
                          color: status.text,
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td
                      className="px-3 py-3 text-center"
                      style={{ borderBottom: `1px solid ${AIRTABLE.border}` }}
                    >
                      {person.daysUntilBirthday === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleBirthdaySend(person)}
                          title={
                            getPhoneForWhatsApp(person).length > 0
                              ? 'Invia auguri WhatsApp + notifica app'
                              : "Invia auguri nell'app mobile"
                          }
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-100 text-white"
                          style={{ backgroundColor: accentColor }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = GOLEE.accentHover }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = accentColor }}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/create-person?edit=${person.id}&from=/birthdays`)}
                          title="Apri profilo"
                          aria-label="Apri profilo"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-100"
                          style={{ color: AIRTABLE.icon }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = AIRTABLE.iconHover
                            e.currentTarget.style.backgroundColor = AIRTABLE.rowHover
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = AIRTABLE.icon
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <Cake className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  return (
    <div className={pageBg} style={contentBg}>
      {!embedInLayout && (
        <Header 
          title="Prossimi Compleanni" 
          showBack={true}
          showSettings={false}
          hideCenterLogo
          hideRightLogo
        />
      )}
      
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Intestazione + KPI — larghezza contenuta */}
        <div className="max-w-6xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: GOLEE.accentSoft }}
              >
                <Cake className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: GOLEE.text }}>
                  Prossimi Compleanni
                </h2>
                <p className="text-sm" style={{ color: GOLEE.textMuted }}>
                  {brand.clubShortName} · monitoraggio automatico nei prossimi 30 giorni
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-72 shrink-0">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: GOLEE.textMuted }}
              />
              <input
                type="text"
                placeholder="Cerca per nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: GOLEE.surface,
                  borderColor: searchTerm.trim() ? accentColor : GOLEE.border,
                  color: GOLEE.text,
                  boxShadow: searchTerm.trim() ? `0 0 0 3px ${accentColor}22` : undefined,
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-lg"
                  style={{ color: GOLEE.textMuted }}
                  title="Cancella ricerca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
              </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-8">
          <StatCard
            icon={Gift}
            label="Compleanni totali"
            value={loading ? '—' : searchFiltered.length}
            sublabel="Nei prossimi 30 giorni"
            iconBg={GOLEE.accentSoft}
            iconColor={accentColor}
            onClick={() => setActiveFilter('all')}
            active={activeFilter === 'all'}
            activeColor={accentColor}
          />
          <StatCard
            icon={PartyPopper}
            label="Oggi"
            value={loading ? '—' : todayCount}
            sublabel="Compleanni oggi"
            iconBg={GOLEE.todaySoft}
            iconColor={GOLEE.today}
            onClick={() => setActiveFilter(prev => (prev === 'today' ? 'all' : 'today'))}
            active={activeFilter === 'today'}
            activeColor={GOLEE.today}
            action={
              todayCount >= 1 ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleBirthdaySend() }}
                  title="Invia auguri"
                  className="p-2.5 rounded-xl text-white transition-all hover:scale-105 shrink-0"
                  style={{ backgroundColor: accentColor }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = GOLEE.accentHover }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = accentColor }}
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : undefined
            }
          />
          <StatCard
            icon={CalendarDays}
            label="Questa settimana"
            value={loading ? '—' : weekCount}
            sublabel="Nei prossimi 7 giorni"
            iconBg={GOLEE.weekSoft}
            iconColor={GOLEE.week}
            onClick={() => setActiveFilter(prev => (prev === 'week' ? 'all' : 'week'))}
            active={activeFilter === 'week'}
            activeColor={GOLEE.week}
          />
          </div>
        </div>

        {/* Elenco compleanni — larghezza piena, 4 card per riga */}
        <div className="w-full">
          <div
            className="rounded-2xl border shadow-sm overflow-hidden"
            style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border }}
          >
            <div
              className="px-5 sm:px-6 py-4 border-b flex items-center justify-between"
              style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
            >
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-semibold" style={{ color: GOLEE.text }}>
                    Elenco compleanni
                  </h3>
                  {filterLabel && (
                    <p className="text-sm" style={{ color: GOLEE.textMuted }}>
                      {filterLabel}
                    </p>
                  )}
              </div>
                {activeFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
                    style={{ backgroundColor: GOLEE.accentSoft, color: accentColor }}
                  >
                    <X className="w-3 h-3" /> Rimuovi filtro
                  </button>
                )}
                        </div>
              {!loading && filteredBirthdays.length > 0 && (
                        <button
                          type="button"
                  onClick={() => setListViewMode((mode) => (mode === 'cards' ? 'table' : 'cards'))}
                  title={listViewMode === 'cards' ? 'Vista tabella' : 'Vista card'}
                  aria-label={listViewMode === 'cards' ? 'Passa alla vista tabella' : 'Passa alla vista card'}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors"
                  style={{
                    backgroundColor: listViewMode === 'table' ? GOLEE.accentSoft : GOLEE.surface,
                    borderColor: listViewMode === 'table' ? accentColor : GOLEE.border,
                    color: listViewMode === 'table' ? accentColor : GOLEE.textMuted,
                  }}
                >
                  {listViewMode === 'cards' ? (
                    <Table2 className="w-4 h-4" />
                  ) : (
                    <LayoutGrid className="w-4 h-4" />
                  )}
                        </button>
                      )}
                    </div>
                    
            <div className={listViewMode === 'table' ? 'p-0' : 'p-4 sm:p-5'}>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
                  <p className="text-sm font-medium" style={{ color: GOLEE.textMuted }}>
                    Caricamento compleanni...
                  </p>
                      </div>
              ) : filteredBirthdays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: GOLEE.accentSoft }}
                  >
                    <Cake className="w-7 h-7" style={{ color: accentColor }} />
                  </div>
                  <h3 className="text-lg font-semibold" style={{ color: GOLEE.text }}>
                    {searchTerm.trim()
                      ? 'Nessun risultato per questo nome'
                      : activeFilter === 'today'
                        ? 'Nessun compleanno oggi'
                        : activeFilter === 'week'
                          ? 'Nessun compleanno questa settimana'
                          : 'Nessun compleanno nei prossimi 30 giorni'}
                  </h3>
                  <p className="text-sm text-center max-w-sm" style={{ color: GOLEE.textMuted }}>
                    {searchTerm.trim()
                      ? 'Prova con un altro nome o cancella la ricerca.'
                      : activeFilter === 'all'
                        ? 'Tutti i compleanni sono già passati o sono più avanti nel tempo.'
                        : 'Prova a rimuovere il filtro per vedere tutti i compleanni.'}
                  </p>
              </div>
              ) : listViewMode === 'table' ? (
                <BirthdayAirtable people={filteredBirthdays} />
              ) : (
                <BirthdayCardsGrid people={filteredBirthdays} />
            )}
            </div>
          </div>
        </div>
      </main>

      <WhatsAppOpenModal
        isOpen={whatsAppModal.open}
        url={whatsAppModal.url}
        onClose={() => setWhatsAppModal({ open: false, url: '' })}
      />
    </div>
  )
}
