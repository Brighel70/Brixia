import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { TUTOR_RELATIONSHIP_OPTIONS } from '@/components/FlowmeTab'

export type AthleteTutorRelation = { tutor_id: string; relationship: string }

export type LinkedContactOption = {
  id: string
  name: string
  phone?: string
  email?: string
}

interface PlayerLinkedContactsPickerProps {
  relations: AthleteTutorRelation[]
  optionsById: LinkedContactOption[]
  onAdd: (option: LinkedContactOption) => void
  onRemove: (tutorId: string) => void
  onRelationshipChange: (tutorId: string, relationship: string) => void
  disabled?: boolean
  excludePersonId?: string | null
  invalidRelationIds?: string[]
}

const MIN_CHARS = 2
const inputClass =
  'w-full px-3 py-2.5 pr-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 text-blue-900 shadow-sm transition-all duration-200'

function personName(p: { id?: string; family_name?: string; given_name?: string; full_name?: string }): string {
  return [p.family_name, p.given_name].filter(Boolean).join(' ')
    || p.full_name
    || [p.given_name, p.family_name].filter(Boolean).join(' ')
    || p.id
    || ''
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

async function searchContactsForLinking(
  query: string,
  excludeIds: Set<string>,
  limit = 40,
): Promise<LinkedContactOption[]> {
  const trimmed = query.trim()
  if (trimmed.length < MIN_CHARS) return []

  const { data: peopleData, error } = await supabase
    .from('people')
    .select('id, given_name, family_name, full_name, phone, email')
    .or(`given_name.ilike.%${trimmed}%,family_name.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
    .order('family_name', { ascending: true })
    .limit(limit)

  if (error) throw error

  return (peopleData || [])
    .filter((p) => !excludeIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: personName(p),
      phone: p.phone || undefined,
      email: p.email || undefined,
    }))
}

export default function PlayerLinkedContactsPicker({
  relations,
  optionsById,
  onAdd,
  onRemove,
  onRelationshipChange,
  disabled = false,
  excludePersonId,
  invalidRelationIds = [],
}: PlayerLinkedContactsPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedSetRef = useRef<Set<string>>(new Set())

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<LinkedContactOption[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)

  const selectedIds = useMemo(() => relations.map((r) => r.tutor_id), [relations])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  useEffect(() => {
    selectedSetRef.current = selectedSet
  }, [selectedSet])

  const labelForId = (id: string): LinkedContactOption => {
    const opt = optionsById.find((o) => o.id === id)
    return opt || { id, name: 'Contatto collegato' }
  }

  const runSearch = async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < MIN_CHARS) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const exclude = new Set(selectedSetRef.current)
      if (excludePersonId) exclude.add(excludePersonId)
      const rows = await searchContactsForLinking(trimmed, exclude)
      setResults(rows)
      setActiveIndex(rows.length > 0 ? 0 : -1)
    } catch {
      setResults([])
      setActiveIndex(-1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!open || query.trim().length < MIN_CHARS) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    searchTimer.current = setTimeout(() => {
      void runSearch(query)
    }, 200)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [query, open, excludePersonId])

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return
      setOpen(false)
      setActiveIndex(-1)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const pickOption = (opt: LinkedContactOption) => {
    onAdd(opt)
    setQuery('')
    setResults([])
    setActiveIndex(-1)
    setOpen(true)
    requestAnimationFrame(() => {
      containerRef.current?.querySelector('input')?.focus()
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((prev) =>
        results.length === 0 ? -1 : prev < 0 ? 0 : Math.min(prev + 1, results.length - 1),
      )
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) =>
        results.length === 0 ? -1 : prev < 0 ? results.length - 1 : Math.max(prev - 1, 0),
      )
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < results.length) {
        pickOption(results[activeIndex])
      } else if (results.length === 1) {
        pickOption(results[0])
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
      setResults([])
      setActiveIndex(-1)
    }
  }

  const qLen = query.trim().length
  const showDropdown = open && !disabled
  const gridCols = disabled
    ? 'grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]'
    : 'grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_5.5rem_3.75rem]'

  return (
    <div>
      {!disabled && (
      <div ref={containerRef} className="relative">
        <input
          value={query}
          disabled={disabled}
          placeholder="Cerca persona da collegare (tutor, genitore, ecc.)…"
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center text-slate-400">
          <Search className="h-4 w-4" />
        </div>

        {showDropdown && (
          <div className="absolute bottom-full left-0 right-0 z-[100] mb-1 max-h-60 overflow-y-auto rounded-xl border-2 border-slate-200 bg-white shadow-[0_-8px_25px_rgba(0,0,0,0.12)]">
            {qLen < MIN_CHARS ? (
              <div className="px-4 py-3 text-sm text-slate-500">Digita almeno {MIN_CHARS} caratteri per cercare…</div>
            ) : loading ? (
              <div className="px-4 py-3 text-sm text-slate-500">Ricerca in corso…</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">Nessuna persona trovata</div>
            ) : (
              results.map((opt, idx) => {
                const active = idx === activeIndex
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pickOption(opt)
                    }}
                    className={`flex w-full flex-col items-start border-b border-slate-100 px-4 py-3 text-left last:border-b-0 ${
                      active ? 'border-l-4 border-l-blue-800 bg-[#334D70] text-white' : 'border-l-4 border-l-transparent text-[#334D70]'
                    }`}
                  >
                    <span className={`text-[15px] ${active ? 'font-semibold' : 'font-normal'}`}>{opt.name}</span>
                    {(opt.phone || opt.email) && (
                      <span className={`mt-0.5 text-xs ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                        {[formatPhone(opt.phone), opt.email].filter((v) => v && v !== '—').join(' · ')}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
      )}

      {relations.length > 0 ? (
        <div className={`${disabled ? 'mt-0' : 'mt-3'} overflow-hidden rounded-xl border border-slate-300 bg-white`}>
          <div className={`grid ${gridCols} items-center gap-x-3 border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#334D70]`}>
            <span>Contatto</span>
            <span>Telefono</span>
            <span>Relazione</span>
            {!disabled && <span className="text-right">Azioni</span>}
          </div>
          <ul className="divide-y divide-slate-200">
            {relations.map((rel) => {
              const contact = labelForId(rel.tutor_id)
              const isInvalid = invalidRelationIds.includes(rel.tutor_id)
              return (
                <li
                  key={rel.tutor_id}
                  className={`grid ${gridCols} items-center gap-x-3 px-3 py-2`}
                >
                  <a
                    href={`/create-person?edit=${rel.tutor_id}&tab=personal`}
                    className="min-w-0 truncate text-sm font-bold text-emerald-900 hover:underline"
                    title={contact.name}
                  >
                    {contact.name}
                  </a>
                  <span className="min-w-0 truncate text-sm font-medium text-slate-800" title={formatPhone(contact.phone)}>
                    {formatPhone(contact.phone)}
                  </span>
                  {disabled ? (
                    <span className={`truncate text-sm font-semibold ${rel.relationship ? 'text-blue-900' : 'text-red-600'}`}>
                      {rel.relationship || 'Da impostare'}
                    </span>
                  ) : (
                  <select
                    value={rel.relationship}
                    onChange={(e) => onRelationshipChange(rel.tutor_id, e.target.value)}
                    className={`w-full rounded-lg border bg-white px-1.5 py-1 text-xs font-semibold text-blue-800 focus:outline-none focus:ring-2 ${
                      isInvalid
                        ? 'border-red-500 bg-red-50 ring-2 ring-red-200 focus:ring-red-300'
                        : 'border-slate-200 focus:ring-blue-400/40'
                    }`}
                  >
                    <option value="">Seleziona relazione</option>
                    {TUTOR_RELATIONSHIP_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  )}
                  {!disabled && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRemove(rel.tutor_id)}
                      className="whitespace-nowrap text-xs font-semibold text-slate-500 transition-colors hover:text-red-600"
                    >
                      Rimuovi
                    </button>
                  </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">
          {disabled
            ? 'Nessun contatto collegato a questo giocatore.'
            : 'Nessun contatto collegato. Cerca e collega tutor, genitori o altri riferimenti per questo giocatore.'}
        </p>
      )}
    </div>
  )
}
