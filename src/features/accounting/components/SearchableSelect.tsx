import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { GOLEE, goleeInputClass, goleeInputStyle } from '@/config/goleeTheme'

export type SearchableSelectOption = {
  id: string
  label: string
  searchText?: string
  hint?: string
}

type SearchableSelectProps = {
  value: string
  options: SearchableSelectOption[]
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  emptyMessage?: string
}

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Seleziona…',
  disabled = false,
  required = false,
  emptyMessage = 'Nessun risultato'
}: SearchableSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = options.find((option) => option.id === value) ?? null

  useEffect(() => {
    if (!open) setQuery('')
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => {
      const haystack = `${option.label} ${option.searchText ?? ''} ${option.hint ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [options, query])

  const displayValue = open ? query : selected?.label ?? ''

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: GOLEE.textMuted }}
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          required={required && !value}
          value={displayValue}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            if (!disabled) setOpen(true)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            if (value) onChange('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              setQuery('')
            }
            if (event.key === 'Enter' && open && filtered.length === 1) {
              event.preventDefault()
              onChange(filtered[0]!.id)
              setOpen(false)
              setQuery('')
            }
          }}
          className={`${goleeInputClass} pl-10 pr-10 text-black font-semibold disabled:cursor-not-allowed disabled:opacity-60`}
          style={{ ...goleeInputStyle, color: '#000000' }}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Chiudi elenco' : 'Apri elenco'}
          onClick={() => {
            if (disabled) return
            setOpen((prev) => !prev)
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-50"
          style={{ color: GOLEE.textMuted }}
        >
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-56 w-full overflow-auto rounded-xl border bg-white py-1 shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
          style={{ borderColor: GOLEE.border }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-sm" style={{ color: GOLEE.textMuted }}>
              {emptyMessage}
            </p>
          ) : (
            filtered.map((option) => {
              const active = option.id === value
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition hover:bg-[#F4F8FF]"
                  style={{
                    backgroundColor: active ? GOLEE.accentSoft : undefined,
                    color: '#000000'
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.id)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span className="text-sm font-semibold text-black">{option.label}</span>
                  {option.hint ? (
                    <span className="text-xs" style={{ color: GOLEE.textMuted }}>
                      {option.hint}
                    </span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
