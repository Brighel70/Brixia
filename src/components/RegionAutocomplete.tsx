import { ITALIAN_REGIONS } from '@/lib/italianRegions'
import ListAutocomplete from '@/components/ListAutocomplete'

interface RegionAutocompleteProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  compact?: boolean
}

export default function RegionAutocomplete({ value, onChange, disabled = false, compact = false }: RegionAutocompleteProps) {
  return (
    <ListAutocomplete
      value={value}
      onChange={onChange}
      options={ITALIAN_REGIONS}
      placeholder="Cerca regione..."
      emptyLabel="Nessuna regione trovata"
      disabled={disabled}
      compact={compact}
    />
  )
}
