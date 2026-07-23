import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import TutorLinkedPlayersPicker, { type LinkedPlayerOption, type TutorAthleteRelation } from '@/components/TutorLinkedPlayersPicker'
import PlayerLinkedContactsPicker, { type AthleteTutorRelation, type LinkedContactOption } from '@/components/PlayerLinkedContactsPicker'
import TutorCoGuardiansList from '@/components/TutorCoGuardiansList'

interface PersonalInfoTabProps {
  form: any
  handleInputChange: (field: string, value: unknown) => void
  isFieldDisabled: () => boolean
  availableRoles?: any[]
  isTutor?: boolean
  isPlayer?: boolean
  personId?: string | null
  linkRelationErrorIds?: string[]
  onClearLinkRelationError?: (id: string) => void
  onPlayerSelection?: (selectedPlayerIds: string[]) => void
  onBirthDateBlur?: (birthDate: string) => void
  onEmailBlur?: (email: string) => void
}

const inputClass =
  'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-blue-900 text-blue-900 shadow-sm transition-all duration-200'

const labelClass = 'block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1'

const PersonalInfoTab: React.FC<PersonalInfoTabProps> = ({
  form,
  handleInputChange,
  isFieldDisabled,
  availableRoles = [],
  isTutor = false,
  isPlayer = false,
  personId = null,
  linkRelationErrorIds = [],
  onClearLinkRelationError,
  onBirthDateBlur,
  onEmailBlur,
}) => {
  const capitalizeText = (text: string) => {
    if (!text) return ''
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return ''
    const cleaned = phone.replace(/\D/g, '')
    const withoutCountryCode = cleaned.startsWith('39') ? cleaned.slice(2) : cleaned
    if (!withoutCountryCode) return ''
    let formatted = withoutCountryCode
    if (formatted.length >= 3) {
      formatted = formatted.substring(0, 3) + ' ' + formatted.substring(3)
    }
    return `+39 ${formatted}`
  }

  const handlePhoneChange = (value: string) => {
    handleInputChange('emergency_contact_phone', formatPhoneNumber(value))
  }

  const handleMainPhoneChange = (value: string) => {
    handleInputChange('phone', formatPhoneNumber(value))
  }

  const handleTextChange = (field: string, value: string) => {
    if (field === 'given_name' || field === 'family_name') {
      handleInputChange(field, value.toUpperCase())
      return
    }
    handleInputChange(field, capitalizeText(value))
  }

  const tutorRelations: TutorAthleteRelation[] = useMemo(
    () => (form.tutor_athlete_relations?.length
      ? form.tutor_athlete_relations
      : (form.tutor_athlete_ids || []).map((aid: string) => ({
          athlete_id: aid,
          relationship: '',
        }))) as TutorAthleteRelation[],
    [form.tutor_athlete_relations, form.tutor_athlete_ids],
  )

  const [linkedPlayerOptions, setLinkedPlayerOptions] = useState<LinkedPlayerOption[]>([])

  useEffect(() => {
    if (!isTutor) return
    const ids = tutorRelations.map((r) => r.athlete_id).filter(Boolean)
    if (ids.length === 0) {
      setLinkedPlayerOptions([])
      return
    }
    let cancelled = false
    ;(async () => {
      const [{ data: categoriesData }, { data: peopleData }] = await Promise.all([
        supabase.from('categories').select('id, name, code'),
        supabase
          .from('people')
          .select('id, given_name, family_name, full_name, player_categories, date_of_birth')
          .in('id', ids),
      ])
      if (cancelled) return
      const catMap = new Map<string, string>()
      for (const cat of categoriesData || []) {
        catMap.set(cat.id, cat.code || cat.name || cat.id)
      }
      setLinkedPlayerOptions((peopleData || []).map((p) => {
        const categoryLabel = (p.player_categories || [])
          .map((id: string) => catMap.get(id))
          .filter(Boolean)
          .join(', ')
        const birth = p.date_of_birth
        const age = birth ? (() => {
          const today = new Date()
          const b = new Date(birth)
          let a = today.getFullYear() - b.getFullYear()
          if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) a -= 1
          return a
        })() : null
        return {
          id: p.id,
          name: [p.family_name, p.given_name].filter(Boolean).join(' ')
            || p.full_name
            || [p.given_name, p.family_name].filter(Boolean).join(' ')
            || p.id,
          categoryLabel: categoryLabel || undefined,
          age,
        }
      }))
    })()
    return () => { cancelled = true }
  }, [isTutor, tutorRelations.map((r) => r.athlete_id).join(',')])

  const playerContactRelations: AthleteTutorRelation[] = useMemo(
    () => (form.athlete_tutor_relations || []) as AthleteTutorRelation[],
    [form.athlete_tutor_relations],
  )

  const [linkedContactOptions, setLinkedContactOptions] = useState<LinkedContactOption[]>([])

  useEffect(() => {
    if (!isPlayer) return
    const ids = playerContactRelations.map((r) => r.tutor_id).filter(Boolean)
    if (ids.length === 0) {
      setLinkedContactOptions([])
      return
    }
    let cancelled = false
    ;(async () => {
      const { data: peopleData } = await supabase
        .from('people')
        .select('id, given_name, family_name, full_name, phone, email')
        .in('id', ids)
      if (cancelled) return
      setLinkedContactOptions((peopleData || []).map((p) => ({
        id: p.id,
        name: [p.family_name, p.given_name].filter(Boolean).join(' ')
          || p.full_name
          || [p.given_name, p.family_name].filter(Boolean).join(' ')
          || p.id,
        phone: p.phone || undefined,
        email: p.email || undefined,
      })))
    })()
    return () => { cancelled = true }
  }, [isPlayer, playerContactRelations.map((r) => r.tutor_id).join(',')])

  const updatePlayerContactRelations = (next: AthleteTutorRelation[]) => {
    handleInputChange('athlete_tutor_relations', next)
  }

  const handleAddLinkedContact = (option: LinkedContactOption) => {
    if (playerContactRelations.some((r) => r.tutor_id === option.id)) return
    updatePlayerContactRelations([...playerContactRelations, { tutor_id: option.id, relationship: '' }])
    setLinkedContactOptions((prev) => {
      if (prev.some((p) => p.id === option.id)) return prev
      return [...prev, option]
    })
  }

  const handleRemoveLinkedContact = (tutorId: string) => {
    updatePlayerContactRelations(playerContactRelations.filter((r) => r.tutor_id !== tutorId))
  }

  const handleLinkedContactRelationshipChange = (tutorId: string, relationship: string) => {
    if (relationship.trim()) onClearLinkRelationError?.(tutorId)
    updatePlayerContactRelations(
      playerContactRelations.map((r) => (r.tutor_id === tutorId ? { ...r, relationship } : r)),
    )
  }

  const updateTutorRelations = (next: TutorAthleteRelation[]) => {
    handleInputChange('tutor_athlete_relations', next)
    handleInputChange('tutor_athlete_ids', next.map((r) => r.athlete_id))
  }

  const handleAddLinkedPlayer = (option: LinkedPlayerOption) => {
    if (tutorRelations.some((r) => r.athlete_id === option.id)) return
    const next = [...tutorRelations, { athlete_id: option.id, relationship: '' }]
    updateTutorRelations(next)
    setLinkedPlayerOptions((prev) => {
      if (prev.some((p) => p.id === option.id)) return prev
      return [...prev, option]
    })
  }

  const handleRemoveLinkedPlayer = (athleteId: string) => {
    updateTutorRelations(tutorRelations.filter((r) => r.athlete_id !== athleteId))
  }

  const handleLinkedPlayerRelationshipChange = (athleteId: string, relationship: string) => {
    if (relationship.trim()) onClearLinkRelationError?.(athleteId)
    updateTutorRelations(
      tutorRelations.map((r) => (r.athlete_id === athleteId ? { ...r, relationship } : r)),
    )
  }

  const linkedAthleteIds = useMemo(
    () => tutorRelations.map((r) => r.athlete_id).filter(Boolean),
    [tutorRelations],
  )

  const linkedAthleteNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of linkedPlayerOptions) {
      map[p.id] = p.name
    }
    return map
  }, [linkedPlayerOptions])

  const canLinkPeople = !isFieldDisabled()

  return (
    <div className="grid w-full grid-cols-1 gap-0 px-2 lg:grid-cols-[1fr_1px_1fr] lg:items-stretch">
      {/* Colonna sinistra — Anagrafica */}
      <div className="flex flex-col gap-3 lg:pr-[5%]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#334D70]">Anagrafica</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.given_name ?? ''}
                onChange={(e) => handleTextChange('given_name', e.target.value)}
                disabled={isFieldDisabled()}
                className={`${inputClass} uppercase`}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label className={labelClass}>
                Cognome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.family_name ?? ''}
                onChange={(e) => handleTextChange('family_name', e.target.value)}
                disabled={isFieldDisabled()}
                className={`${inputClass} uppercase`}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-2">
              <label className={labelClass}>
                Data di Nascita <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.date_of_birth ? String(form.date_of_birth).slice(0, 10) : ''}
                onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                onBlur={(e) => onBirthDateBlur?.(e.target.value)}
                disabled={isFieldDisabled()}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                Sesso <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                disabled={isFieldDisabled()}
                className={inputClass}
              >
                <option value="">-</option>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="X">X</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Nazionalità</label>
              <input
                type="text"
                value={form.nationality}
                onChange={(e) => {
                  const value = e.target.value
                  const formattedValue = value
                    .toLowerCase()
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                  handleInputChange('nationality', formattedValue)
                }}
                disabled={isFieldDisabled()}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Status <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                disabled={isFieldDisabled()}
                className={inputClass}
              >
                <option value="active">Attivo</option>
                <option value="inactive">Inattivo</option>
                <option value="pending">In attesa</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Numero Tessera</label>
              <input
                type="text"
                value={form.membership_number}
                onChange={(e) => handleInputChange('membership_number', e.target.value)}
                disabled={isFieldDisabled()}
                className={inputClass}
                placeholder="25000201"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Codice Fiscale <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={16}
              value={form.fiscal_code}
              onChange={(e) => handleInputChange('fiscal_code', e.target.value.toUpperCase())}
              disabled={isFieldDisabled()}
              className={inputClass}
            />
          </div>

          {isPlayer && (canLinkPeople || playerContactRelations.length > 0) && (
          <div className="mt-2 border-t border-gray-200 pt-4">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#334D70]">Contatti collegati</p>
              <p className="mt-1 text-xs text-slate-500">
                Tutor, genitori o altri riferimenti collegati a questo giocatore.
              </p>
            </div>
            <PlayerLinkedContactsPicker
              relations={playerContactRelations}
              optionsById={linkedContactOptions}
              onAdd={handleAddLinkedContact}
              onRemove={handleRemoveLinkedContact}
              onRelationshipChange={handleLinkedContactRelationshipChange}
              disabled={!canLinkPeople}
              excludePersonId={personId}
              invalidRelationIds={linkRelationErrorIds}
            />
          </div>
          )}

          {isTutor && (canLinkPeople || tutorRelations.length > 0) && (
          <div className="mt-2 border-t border-gray-200 pt-4">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#334D70]">Giocatori collegati</p>
              <p className="mt-1 text-xs text-slate-500">
                Collega questo tutor a uno o più giocatori.
              </p>
            </div>
            <TutorLinkedPlayersPicker
              relations={tutorRelations}
              optionsById={linkedPlayerOptions}
              onAdd={handleAddLinkedPlayer}
              onRemove={handleRemoveLinkedPlayer}
              onRelationshipChange={handleLinkedPlayerRelationshipChange}
              disabled={!canLinkPeople}
              excludePersonId={personId}
              invalidRelationIds={linkRelationErrorIds}
            />
          </div>
          )}
        </div>

        <div className="hidden bg-slate-400 lg:block" aria-hidden="true" />

        <div className="mt-6 flex flex-col gap-3 lg:mt-0 lg:pl-[5%]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#334D70]">Contatti e residenza</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Email</label>
              <input
                id="person-email"
                type="email"
                value={form.email?.toLowerCase() || ''}
                onChange={(e) => handleTextChange('email', e.target.value.toLowerCase())}
                onBlur={(e) => onEmailBlur?.(e.target.value)}
                disabled={isFieldDisabled()}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Telefono</label>
              <input
                type="tel"
                value={formatPhoneNumber(form.phone)}
                onChange={(e) => handleMainPhoneChange(e.target.value)}
                disabled={isFieldDisabled()}
                className={inputClass}
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Indirizzo</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_4.75rem_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label className={labelClass}>Via/Indirizzo</label>
                <input
                  type="text"
                  value={form.address_street}
                  onChange={(e) => handleTextChange('address_street', e.target.value)}
                  onBlur={(e) => {
                    const v = e.target.value
                    if (v && v !== capitalizeText(v)) handleInputChange('address_street', capitalizeText(v))
                  }}
                  disabled={isFieldDisabled()}
                  className={inputClass}
                  placeholder="Via, numero civico..."
                />
              </div>
              <div>
                <label className={labelClass}>CAP</label>
                <input
                  type="text"
                  value={form.address_zip}
                  onChange={(e) => handleInputChange('address_zip', e.target.value)}
                  disabled={isFieldDisabled()}
                  className={`${inputClass} px-2 text-center tracking-wide`}
                  placeholder="25010"
                  maxLength={5}
                />
              </div>
              <div>
                <label className={labelClass}>Paese</label>
                <input
                  type="text"
                  value={form.address_country}
                  onChange={(e) => handleTextChange('address_country', e.target.value)}
                  onBlur={(e) => {
                    const v = e.target.value
                    if (v && v !== capitalizeText(v)) handleInputChange('address_country', capitalizeText(v))
                  }}
                  disabled={isFieldDisabled()}
                  className={inputClass}
                  placeholder="Italia"
                />
              </div>
              <div>
                <label className={labelClass}>Città</label>
                <input
                  type="text"
                  value={form.address_city}
                  onChange={(e) => handleTextChange('address_city', e.target.value)}
                  onBlur={(e) => {
                    const v = e.target.value
                    if (v && v !== capitalizeText(v)) handleInputChange('address_city', capitalizeText(v))
                  }}
                  disabled={isFieldDisabled()}
                  className={inputClass}
                  placeholder="Brescia"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Salute ed emergenza</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelClass}>Note Mediche</label>
                <textarea
                  value={form.medical_notes}
                  onChange={(e) => handleInputChange('medical_notes', e.target.value)}
                  disabled={isFieldDisabled()}
                  rows={4}
                  className={`${inputClass} resize-none`}
                  placeholder="Note mediche, allergie, condizioni particolari..."
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Contatto di emergenza</label>
                  <input
                    type="text"
                    value={form.emergency_contact_name}
                    onChange={(e) => handleTextChange('emergency_contact_name', e.target.value)}
                    disabled={isFieldDisabled()}
                    className={inputClass}
                    placeholder="Nome"
                  />
                </div>
                <div>
                  <label className={labelClass}>Telefono emergenza</label>
                  <input
                    type="tel"
                    value={formatPhoneNumber(form.emergency_contact_phone)}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    disabled={isFieldDisabled()}
                    className={inputClass}
                    placeholder="Numero di telefono"
                  />
                </div>
              </div>
            </div>
          </div>

          {isTutor && (
          <TutorCoGuardiansList
            athleteIds={linkedAthleteIds}
            excludeTutorId={personId}
            athleteNamesById={linkedAthleteNamesById}
          />
          )}
        </div>
      </div>
    )
}

export default PersonalInfoTab
