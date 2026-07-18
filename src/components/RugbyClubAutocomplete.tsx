import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

export interface RugbyClubOption {
  id: string
  name: string
}

interface RugbyClubAutocompleteProps {
  value: string
  onChange: (value: string) => void
  clubs: RugbyClubOption[]
  placeholder?: string
  className?: string
  inputClassName?: string
  disabled?: boolean
  normalizeUppercase?: boolean
  onEnter?: (selectedName?: string) => void
  showManageLink?: boolean
  onManageLinkClick?: () => void
  dark?: boolean
  /** Nomi già selezionati: non compaiono nei suggerimenti */
  excludeNames?: string[]
  /** Mostra il menu solo dopo almeno N caratteri digitati (default 1) */
  minQueryLength?: number
}

function normalizeClubName(name: string) {
  return name.trim().toUpperCase()
}

export default function RugbyClubAutocomplete({
  value,
  onChange,
  clubs,
  placeholder = 'Cerca società...',
  className = '',
  inputClassName = '',
  disabled = false,
  normalizeUppercase = false,
  onEnter,
  showManageLink = false,
  onManageLinkClick,
  dark = false,
  excludeNames = [],
  minQueryLength = 1,
}: RugbyClubAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const q = value.trim()
  const excluded = new Set(excludeNames.map(normalizeClubName))
  const matchingInCatalog = clubs.filter(
    (c) => q.length >= minQueryLength && c.name.toLowerCase().includes(q.toLowerCase())
  )
  const filtered = matchingInCatalog
    .filter((c) => !excluded.has(normalizeClubName(c.name)))
    .slice(0, 12)
  const hasExcludedMatches = matchingInCatalog.some((c) => excluded.has(normalizeClubName(c.name)))
  const hasDirectExcludedMatch = excludeNames.some(
    (name) => q.length >= minQueryLength && normalizeClubName(name).includes(normalizeClubName(q))
  )
  const alreadyInserted = hasExcludedMatches || hasDirectExcludedMatch

  const safeIndex = Math.min(Math.max(0, highlightedIndex), Math.max(0, filtered.length - 1))
  const showDropdown = open && !disabled && q.length >= minQueryLength

  const updateMenuPosition = () => {
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 180),
    })
  }

  useLayoutEffect(() => {
    if (!showDropdown) {
      setMenuPos(null)
      return
    }
    updateMenuPosition()
  }, [showDropdown, value, filtered.length])

  useEffect(() => {
    if (!showDropdown) return
    const onReposition = () => updateMenuPosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [showDropdown])

  const applyValue = (name: string) => {
    onChange(normalizeUppercase ? name.toUpperCase() : name)
    setOpen(false)
    setHighlightedIndex(0)
  }

  const defaultInputClass = dark
    ? 'bg-white/10 border-white/20 text-white placeholder:text-gray-400'
    : 'border-gray-300 text-gray-900 bg-white placeholder:text-gray-500'

  const emptyMessage = alreadyInserted
    ? 'Società già inserita'
    : clubs.length === 0
      ? 'Nessuna società in elenco — usa “Gestisci elenco società”'
      : 'Nessuna società trovata'

  const dropdown = showDropdown && menuPos
    ? createPortal(
        <ul
          ref={menuRef}
          className={`fixed z-[9999] max-h-56 overflow-auto rounded-xl border shadow-lg py-1 ${
            dark ? 'border-white/20 bg-gray-900' : 'border-gray-200 bg-white'
          }`}
          style={{
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
          }}
          role="listbox"
        >
          {filtered.map((club, idx) => (
            <li key={club.id} role="option" aria-selected={idx === safeIndex}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2.5 text-sm focus:outline-none truncate ${
                  idx === safeIndex
                    ? dark
                      ? 'bg-sky-500/30 text-white'
                      : 'bg-blue-100 text-gray-900'
                    : dark
                      ? 'text-white hover:bg-white/10'
                      : 'text-gray-900 hover:bg-blue-50'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  applyValue(club.name)
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
              >
                {club.name}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className={`px-3 py-2.5 text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              {emptyMessage}
            </li>
          )}
        </ul>,
        document.body
      )
    : null

  return (
    <div className={className}>
      <div ref={containerRef} className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full rounded-2xl border focus:ring-2 focus:ring-sky-500 focus:border-transparent ${defaultInputClass} ${inputClassName}`}
          onChange={(e) => {
            const next = e.target.value
            onChange(next)
            setHighlightedIndex(0)
            setOpen(next.trim().length >= minQueryLength)
          }}
          onFocus={() => {
            if (q.length >= minQueryLength) setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!showDropdown || filtered.length === 0) {
              if (e.key === 'Enter' && onEnter && !alreadyInserted) {
                e.preventDefault()
                const submitted = normalizeUppercase ? value.trim().toUpperCase() : value.trim()
                if (submitted) onEnter(submitted)
              }
              if (e.key === 'Escape') setOpen(false)
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1))
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlightedIndex((i) => Math.max(0, i - 1))
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              const club = filtered[safeIndex]
              if (club) {
                const submitted = normalizeUppercase ? club.name.toUpperCase() : club.name
                applyValue(club.name)
                onEnter?.(submitted)
              } else if (onEnter && !alreadyInserted) {
                const submitted = normalizeUppercase ? value.trim().toUpperCase() : value.trim()
                if (submitted) onEnter(submitted)
              }
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
            }
          }}
        />
        {dropdown}
      </div>
      {showManageLink && (
        onManageLinkClick ? (
          <button
            type="button"
            onClick={onManageLinkClick}
            className={`inline-block mt-1.5 text-xs underline ${dark ? 'text-sky-300 hover:text-sky-200' : 'text-teal-700 hover:text-teal-900'}`}
          >
            Gestisci elenco società di rugby
          </button>
        ) : (
          <Link
            to="/clubs"
            className={`inline-block mt-1.5 text-xs underline ${dark ? 'text-sky-300 hover:text-sky-200' : 'text-teal-700 hover:text-teal-900'}`}
          >
            Gestisci elenco società di rugby
          </Link>
        )
      )}
    </div>
  )
}
