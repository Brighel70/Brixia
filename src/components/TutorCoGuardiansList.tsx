import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type CoGuardianRow = {
  tutorId: string
  tutorName: string
  phone?: string
  athleteId: string
  athleteName: string
  relationship: string
}

interface TutorCoGuardiansListProps {
  athleteIds: string[]
  excludeTutorId?: string | null
  athleteNamesById?: Record<string, string>
}

function formatPhone(phone?: string | null): string {
  if (!phone) return '—'
  const cleaned = phone.replace(/\D/g, '')
  const withoutCountryCode = cleaned.startsWith('39') ? cleaned.slice(2) : cleaned
  if (!withoutCountryCode) return phone
  let formatted = withoutCountryCode
  if (formatted.length >= 3) {
    formatted = `${formatted.substring(0, 3)} ${formatted.substring(3)}`
  }
  return `+39 ${formatted}`
}

function personName(p: { family_name?: string; given_name?: string; full_name?: string }): string {
  return [p.family_name, p.given_name].filter(Boolean).join(' ')
    || p.full_name
    || [p.given_name, p.family_name].filter(Boolean).join(' ')
    || '—'
}

export default function TutorCoGuardiansList({
  athleteIds,
  excludeTutorId,
  athleteNamesById = {},
}: TutorCoGuardiansListProps) {
  const [rows, setRows] = useState<CoGuardianRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ids = athleteIds.filter(Boolean)
    if (ids.length === 0) {
      setRows([])
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        let relQuery = supabase
          .from('tutor_athlete_relations')
          .select('tutor_id, athlete_id, relationship')
          .in('athlete_id', ids)

        if (excludeTutorId) {
          relQuery = relQuery.neq('tutor_id', excludeTutorId)
        }

        const { data: relations, error: relError } = await relQuery
        if (relError) throw relError
        if (!relations?.length) {
          if (!cancelled) setRows([])
          return
        }

        const tutorIds = [...new Set(relations.map((r) => r.tutor_id).filter(Boolean))]
        const athleteIdSet = new Set(ids)
        const missingAthleteIds = [...new Set(relations.map((r) => r.athlete_id).filter((id) => id && !athleteNamesById[id]))]

        // Fetch tutor data
        const { data: tutorData } = await supabase
          .from('people')
          .select('id, given_name, family_name, full_name, phone')
          .in('id', tutorIds)

        // Fetch missing athlete data if needed
        let athleteData: any[] = []
        if (missingAthleteIds.length > 0) {
          const { data } = await supabase
            .from('people')
            .select('id, given_name, family_name, full_name')
            .in('id', missingAthleteIds)
          athleteData = data || []
        }

        if (cancelled) return

        const tutorMap = new Map<string, { name: string; phone?: string }>()
        for (const p of tutorData || []) {
          tutorMap.set(p.id, { name: personName(p), phone: p.phone || undefined })
        }

        const athleteMap = new Map<string, string>(Object.entries(athleteNamesById))
        for (const p of athleteData) {
          athleteMap.set(p.id, personName(p))
        }

        const nextRows: CoGuardianRow[] = relations
          .filter((r) => athleteIdSet.has(r.athlete_id))
          .map((r) => {
            const tutor = tutorMap.get(r.tutor_id)
            return {
              tutorId: r.tutor_id,
              tutorName: tutor?.name || 'Contatto collegato',
              phone: tutor?.phone,
              athleteId: r.athlete_id,
              athleteName: athleteMap.get(r.athlete_id) || 'Giocatore',
              relationship: r.relationship || '—',
            }
          })
          .sort((a, b) =>
            a.tutorName.localeCompare(b.tutorName, 'it')
            || a.athleteName.localeCompare(b.athleteName, 'it'),
          )

        setRows(nextRows)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [athleteIds.join(','), excludeTutorId, Object.values(athleteNamesById).join('|')])

  return (
    <div className="mt-2 border-t border-gray-200 pt-4">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#334D70]">
          Altri contatti sullo stesso giocatore
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Persone che hanno collegato gli stessi giocatori di questo tutor, con il rispettivo rapporto di parentela.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Caricamento contatti collegati…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-400">
          Nessun altro contatto collegato agli stessi giocatori.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_5.5rem_minmax(0,1fr)] items-center gap-x-3 border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#334D70]">
            <span>Contatto</span>
            <span>Giocatore</span>
            <span>Relazione</span>
            <span>Telefono</span>
          </div>
          <ul className="divide-y divide-slate-200">
            {rows.map((row) => (
              <li
                key={`${row.tutorId}-${row.athleteId}`}
                className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_5.5rem_minmax(0,1fr)] items-center gap-x-3 px-3 py-2"
              >
                <a
                  href={`/create-person?edit=${row.tutorId}&tab=personal`}
                  className="min-w-0 truncate text-sm font-bold text-emerald-900 hover:underline"
                  title={row.tutorName}
                >
                  {row.tutorName}
                </a>
                <span className="min-w-0 truncate text-sm font-medium text-slate-800" title={row.athleteName}>
                  {row.athleteName}
                </span>
                <span className="truncate text-sm font-semibold text-blue-900">{row.relationship}</span>
                <span className="min-w-0 truncate text-sm font-medium text-slate-800" title={formatPhone(row.phone)}>
                  {formatPhone(row.phone)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
