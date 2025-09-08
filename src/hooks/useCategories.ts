import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Category {
  id: string
  code: string
  name: string
  active: boolean
  sort: number
  created_at: string
  updated_at: string
  player_count?: number
  staff_count?: number
}

interface TrainingLocation {
  id: string
  category_id: string
  location: string
  weekday: string
  start_time: string
  end_time: string
}

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [trainingLocations, setTrainingLocations] = useState<Record<string, TrainingLocation[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCategories = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('categories')
        .select(`
          *,
          player_categories(count),
          staff_categories(count)
        `)
        .order('sort')

      if (error) throw error

      const categoriesWithCounts = data?.map(cat => ({
        ...cat,
        player_count: cat.player_categories?.[0]?.count || 0,
        staff_count: cat.staff_categories?.[0]?.count || 0
      })) || []

      setCategories(categoriesWithCounts)
    } catch (err: any) {
      console.error('Errore nel caricamento categorie:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTrainingLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('training_locations')
        .select('*')
        .order('category_id, weekday, start_time')

      if (error) throw error

      const locationsByCategory = data?.reduce((acc, location) => {
        if (!acc[location.category_id]) {
          acc[location.category_id] = []
        }
        acc[location.category_id].push(location)
        return acc
      }, {} as Record<string, TrainingLocation[]>) || {}

      setTrainingLocations(locationsByCategory)
    } catch (err: any) {
      console.error('Errore nel caricamento sedi allenamento:', err)
      setError(err.message)
    }
  }

  const createCategory = async (categoryData: {
    code: string
    name: string
    sort: number
  }) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('categories')
        .insert({
          code: categoryData.code.toUpperCase(),
          name: categoryData.name.trim(),
          sort: categoryData.sort,
          active: true
        })
        .select()

      if (error) throw error

      await loadCategories()
      return data[0]
    } catch (err: any) {
      console.error('Errore nella creazione categoria:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const updateCategory = async (categoryId: string, updates: {
    code?: string
    name?: string
    sort?: number
    active?: boolean
  }) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', categoryId)

      if (error) throw error

      await loadCategories()
    } catch (err: any) {
      console.error('Errore nell\'aggiornamento categoria:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const deleteCategory = async (categoryId: string) => {
    try {
      setLoading(true)
      setError(null)

      // Prima rimuovi le associazioni
      await supabase
        .from('player_categories')
        .delete()
        .eq('category_id', categoryId)

      await supabase
        .from('staff_categories')
        .delete()
        .eq('category_id', categoryId)

      await supabase
        .from('training_locations')
        .delete()
        .eq('category_id', categoryId)

      // Poi elimina la categoria
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error

      await loadCategories()
    } catch (err: any) {
      console.error('Errore nell\'eliminazione categoria:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const toggleCategoryActive = async (categoryId: string, currentActive: boolean) => {
    return updateCategory(categoryId, { active: !currentActive })
  }

  const getActiveCategories = () => {
    return categories.filter(cat => cat.active)
  }

  const getCategoryById = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId)
  }

  const getCategoryByCode = (code: string) => {
    return categories.find(cat => cat.code === code)
  }

  const validateCategoryCode = (code: string, excludeId?: string) => {
    const normalizedCode = code.toUpperCase()
    const existingCategory = categories.find(cat => 
      cat.code === normalizedCode && cat.id !== excludeId
    )
    return !existingCategory
  }

  const getNextSortValue = () => {
    const maxSort = Math.max(...categories.map(cat => cat.sort), 0)
    return maxSort + 1
  }

  useEffect(() => {
    loadCategories()
    loadTrainingLocations()
  }, [])

  return {
    categories,
    trainingLocations,
    loading,
    error,
    loadCategories,
    loadTrainingLocations,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryActive,
    getActiveCategories,
    getCategoryById,
    getCategoryByCode,
    validateCategoryCode,
    getNextSortValue
  }
}

