import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

/** Colori per le categorie nei dropdown */
const CATEGORY_COLORS: Record<string, string> = {
  U6: 'bg-blue-100',
  U8: 'bg-blue-200',
  U10: 'bg-green-100',
  U12: 'bg-green-200',
  U14: 'bg-yellow-100',
  U16: 'bg-yellow-200',
  U18: 'bg-yellow-100',
  SERIE_C: 'bg-orange-200',
  SERIE_B: 'bg-red-100',
  SENIORES: 'bg-red-200',
  PODEROSA: 'bg-purple-100',
  GUSSAGOLD: 'bg-purple-200',
  BRIXIAOLD: 'bg-indigo-100',
  LEONESSE: 'bg-pink-100'
}

export interface CategoryOption {
  value: string
  label: string
  color: string
}

/**
 * Hook per ottenere solo le categorie attivate nell'app, nel formato adatto ai dropdown.
 * Usa il campo active della tabella categories.
 */
export function useActiveCategoriesForSelect() {
  const [categories, setCategories] = useState<CategoryOption[]>([
    { value: 'all', label: 'Tutte le categorie', color: 'bg-gray-100' }
  ])

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('code, name, sort')
        .eq('active', true)
        .order('sort', { ascending: true })

      if (error) {
        console.error('Errore caricamento categorie attive:', error)
        return
      }

      const options: CategoryOption[] = [
        { value: 'all', label: 'Tutte le categorie', color: 'bg-gray-100' },
        ...(data || [])
          .filter(cat => cat.code !== 'SENIOR' && cat.name !== 'Senior')
          .map(cat => ({
          value: cat.code,
          label: cat.name,
          color: CATEGORY_COLORS[cat.code] || 'bg-gray-100'
        }))
      ]
      setCategories(options)
    }
    load()
  }, [])

  return categories
}
