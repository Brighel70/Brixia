import { useState } from 'react'
import { MapPin } from 'lucide-react'

interface ListAutocompleteProps {
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  compact?: boolean
}

/** Risolve il testo digitato in un'opzione valida (case-insensitive) oppure stringa vuota. */
export function resolveListOption(value: string, options: readonly string[]): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return options.find((o) => o.toLowerCase() === trimmed.toLowerCase()) ?? ''
}

/** True se il valore coincide esattamente con un'opzione dell'elenco. */
export function isValidListOption(value: string, options: readonly string[]): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return options.some((o) => o === trimmed)
}

export default function ListAutocomplete({
  value,
  onChange,
  options,
  placeholder = 'Cerca...',
  emptyLabel = 'Nessun risultato',
  disabled = false,
  compact = false,
}: ListAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const q = value.trim()
  const filtered = options
    .filter((item) => q.length >= 1 && item.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 12)
  const safeIndex = Math.min(Math.max(0, highlightedIndex), Math.max(0, filtered.length - 1))
  const showDropdown = open && !disabled && q.length >= 1
  const isInvalid = q.length > 0 && !options.some((o) => o.toLowerCase() === q.toLowerCase())

  const select = (item: string) => {
    onChange(item)
    setOpen(false)
    setHighlightedIndex(0)
  }

  const commitValue = () => {
    const resolved = resolveListOption(value, options)
    if (resolved !== value) onChange(resolved)
  }

  const inputClass = compact
    ? `w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-colors ${
        isInvalid
          ? 'border-red-300 focus:ring-red-500/30 focus:border-red-400'
          : 'border-gray-200 focus:ring-teal-500/40 focus:border-teal-400'
      }`
    : `w-full pl-10 pr-4 py-3 rounded-xl border bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-shadow shadow-sm ${
        isInvalid
          ? 'border-red-300 focus:ring-red-500/30 focus:border-red-400'
          : 'border-gray-200 focus:ring-teal-500/40 focus:border-teal-400'
      }`

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className={`absolute top-1/2 -translate-y-1/2 text-teal-500 pointer-events-none ${compact ? 'left-2.5 w-3.5 h-3.5' : 'left-3.5 w-4 h-4'}`} />
        <input
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          className={inputClass}
          onChange={(e) => {
            onChange(e.target.value)
            setHighlightedIndex(0)
            setOpen(e.target.value.trim().length >= 1)
          }}
          onFocus={() => {
            if (q.length >= 1) setOpen(true)
          }}
          onBlur={() => {
            setTimeout(() => {
              setOpen(false)
              commitValue()
            }, 150)
          }}
          onKeyDown={(e) => {
            if (!showDropdown || filtered.length === 0) {
              if (e.key === 'Escape') setOpen(false)
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlightedIndex((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const item = filtered[safeIndex]
              if (item) select(item)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
      </div>
      {showDropdown && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-52 overflow-auto rounded-xl border border-gray-100 bg-white shadow-xl shadow-teal-900/10 py-1">
          {filtered.map((item, idx) => (
            <li key={item}>
              <button
                type="button"
                className={`w-full text-left px-4 py-2.5 text-base transition-colors ${
                  idx === safeIndex ? 'bg-teal-50 text-teal-900 font-medium' : 'text-gray-800 hover:bg-gray-50'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(item)
                }}
              >
                {item}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-2.5 text-base text-gray-500">{emptyLabel}</li>
          )}
        </ul>
      )}
    </div>
  )
}
