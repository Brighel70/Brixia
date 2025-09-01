import Header from '@/components/Header'
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

interface Session {
  id: string
  category_id: string
  session_date: string
  location: string
  created_at: string
  away_place?: string
  categories: {
    id: string
    code: string
    name: string
  }
}

export default function CategoryActivities() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryName, setCategoryName] = useState('')

  useEffect(() => {
    const categoryCode = searchParams.get('category')
    if (categoryCode) {
      loadCategorySessions(categoryCode)
    } else {
      setLoading(false)
    }
  }, [searchParams])

  const loadCategorySessions = async (categoryCode: string) => {
    try {
      // Prima trova l'ID della categoria
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('code', categoryCode)
        .single()

      if (categoryError) {
        console.error('Errore nel trovare categoria:', categoryError)
        return
      }

      setCategoryName(categoryData.name)

      // Poi carica le sessioni di quella categoria
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          category_id,
          session_date,
          location,
          created_at,
          away_place,
          categories!inner(id, code, name)
        `)
        .eq('category_id', categoryData.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Errore nel caricamento sessioni:', error)
        return
      }

      setSessions(data || [])
    } catch (error) {
      console.error('Errore generale:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getCategoryAbbreviation = (code: string) => {
    const abbreviations: { [key: string]: string } = {
      'U6': 'U6', 'U8': 'U8', 'U10': 'U10', 'U12': 'U12', 'U14': 'U14', 'U16': 'U16', 'U18': 'U18',
      'CADETTA': 'CAD', 'SENIORES': 'PRI', 'PODEROSA': 'POD', 'GUSSAGOLD': 'GUS', 'BRIXIAOLD': 'BRI', 'LEONESSE': 'LEO'
    }
    return abbreviations[code] || code
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-lg">Caricamento attività...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={`Attività - ${categoryName}`} showBack={true} />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Attività {categoryName}</h1>
          <p className="text-gray-600 mt-2">
            Sessioni e allenamenti della categoria {categoryName}
          </p>
        </div>

        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">📊</div>
              <div>
                <div className="text-2xl font-bold">{sessions.length}</div>
                <div className="text-sm text-blue-100">Sessioni Totali</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-green-500 to-green-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">📅</div>
              <div>
                <div className="text-2xl font-bold">
                  {sessions.length > 0 ? formatDate(sessions[0].session_date) : 'N/A'}
                </div>
                <div className="text-sm text-green-100">Ultima Sessione</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🏉</div>
              <div>
                <div className="text-2xl font-bold">{getCategoryAbbreviation(searchParams.get('category') || '')}</div>
                <div className="text-sm text-purple-100">Categoria</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista sessioni */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Sessioni Recenti</h2>
            <button
              onClick={() => navigate(`/start?category=${searchParams.get('category')}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🚀 Nuova Sessione
            </button>
          </div>
          
          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2 text-gray-400">📊</div>
              <p className="text-gray-600">Nessuna sessione trovata per questa categoria</p>
              <p className="text-gray-500 text-sm mt-2">Crea la prima sessione per iniziare</p>
              <button
                onClick={() => navigate(`/start?category=${searchParams.get('category')}`)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                🚀 Crea Prima Sessione
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => (
                <div key={session.id} className="card p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl font-bold text-blue-600 bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center">
                        {getCategoryAbbreviation(session.categories?.code || '')}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {session.categories?.name || 'Sessione'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Data: {formatDate(session.session_date)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Location: {session.location}
                          {session.away_place && ` - ${session.away_place}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => navigate(`/board?session=${session.id}`)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        📝 Registra Presenze
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

