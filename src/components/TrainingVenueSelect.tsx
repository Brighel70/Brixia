import { useTrainingVenues } from '@/hooks/useTrainingVenues'

import { goleeInputClass, goleeInputStyle } from '@/config/goleeTheme'

interface TrainingVenueSelectProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  className?: string
  /** Solo sedi di casa (es. eventi festa club) */
  homeOnly?: boolean
  /** Esclude sedi con dettaglio trasferta (es. configurazione orari categoria) */
  scheduleOnly?: boolean
  disabled?: boolean
}

export default function TrainingVenueSelect({
  value,
  onChange,
  required = false,
  placeholder = 'Seleziona sede',
  className = goleeInputClass,
  homeOnly = false,
  scheduleOnly = false,
  disabled = false,
}: TrainingVenueSelectProps) {
  const { activeVenues, scheduleVenues, loading } = useTrainingVenues()

  let options = scheduleOnly ? scheduleVenues : activeVenues
  if (homeOnly) {
    options = options.filter((v) => v.is_home_venue)
  }

  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      style={goleeInputStyle}
      disabled={disabled || loading}
    >
      <option value="">{loading ? 'Caricamento...' : placeholder}</option>
      {options.map((venue) => (
        <option key={venue.id ?? venue.name} value={venue.name}>
          {venue.name}
        </option>
      ))}
    </select>
  )
}
