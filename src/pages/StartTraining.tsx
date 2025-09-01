import Header from '@/components/Header'
import { useState, useEffect } from 'react'
import { useData } from '@/store/data'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BRIXIA_CATEGORIES } from '@/config/categories'
import { supabase } from '@/lib/supabaseClient'

interface Category {
  id: string
  code: string
  name: string
}

export default function StartTraining(){
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { startSession, pickCategory } = useData()
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10))
  const [location, setLocation] = useState<'Brescia'|'Gussago'|'Ospitaletto'|'Trasferta'>('Brescia')
  const [away, setAway] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const categoryCode = searchParams.get('category')
    if (categoryCode) {
      loadCategory(categoryCode)
    } else {
      setLoading(false)
    }
  }, [searchParams])

  const loadCategory = async (categoryCode: string) => {
    try {
      // Trova la categoria dalla configurazione invece che dal database
      const foundCategory = BRIXIA_CATEGORIES.find(cat => cat.code === categoryCode)
      
      if (!foundCategory) {
        throw new Error(`Categoria ${categoryCode} non trovata`)
      }

      // Crea un oggetto categoria compatibile
      const categoryData = {
        id: categoryCode, // Usa il codice come ID temporaneo
        code: foundCategory.code as any,
        name: foundCategory.name
      }

      setCategory(categoryData)
      // Imposta la categoria nello store
      pickCategory(categoryData)
    } catch (error) {
      console.error('Errore nel caricamento categoria:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-lg">Caricamento categoria...</div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="p-4 text-center">
        <div className="text-lg text-red-600 mb-4">Nessuna categoria selezionata.</div>
        <button 
          onClick={() => navigate('/activities')}
          className="btn bg-sky text-white px-6 py-3"
        >
          Torna alle Attività
        </button>
      </div>
    )
  }

  const handleStartSession = async () => {
    try {
      // Prima trova l'ID UUID della categoria dal database
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('code', category.code)
        .single()

      if (categoryError) {
        console.error('Errore nel trovare categoria:', categoryError)
        alert('Errore nel trovare la categoria')
        return
      }

      // Salva la sessione nel database con l'ID UUID corretto
      const { data, error } = await supabase
        .from('sessions')
        .insert([
          {
            category_id: categoryData.id,
            session_date: date,
            location: location,
            away_place: location === 'Trasferta' ? away : null
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Errore nel salvataggio sessione:', error)
        alert('Errore nel salvataggio della sessione')
        return
      }

      // Sessione creata con successo
      
      // Naviga al board presenze con l'ID della sessione
      navigate(`/board?session=${data.id}`)
    } catch (error) {
      console.error('Errore nell\'avvio sessione:', error)
      alert('Errore nell\'avvio della sessione')
    }
  }

  return (
    <div>
      <Header title={`Nuova sessione – ${category.code}`} showBack={true} />
      <div className="p-4">
        <div className="card p-6 grid gap-4">
          <div className="text-center mb-4">
            <h2 className="text-3xl font-bold text-navy">Inizia Nuova Sessione</h2>
            <p className="text-gray-600">Categoria: {category.code} - {category.name}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value as any)}
              className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="Brescia">Brescia</option>
              <option value="Gussago">Gussago</option>
              <option value="Ospitaletto">Ospitaletto</option>
              <option value="Trasferta">Trasferta</option>
            </select>
          </div>

          {location === 'Trasferta' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Luogo Trasferta</label>
              <input
                type="text"
                value={away}
                onChange={(e) => setAway(e.target.value)}
                placeholder="Es: Stadio Comunale Milano"
                className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          )}

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => navigate('/activities')}
              className="flex-1 btn bg-gray-500 text-white px-6 py-3"
            >
              Annulla
            </button>
            <button
              onClick={handleStartSession}
              className="flex-1 btn bg-sky text-white px-6 py-3"
            >
              Avvia Sessione
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}