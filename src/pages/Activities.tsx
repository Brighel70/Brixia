import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '@/store/data'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'

interface Session {
  id: string
  category_id: string
  session_date: string
  location: string
  created_at: string
  categories: any
}

export default function Activities() {
  const navigate = useNavigate()
  const { currentCategory, pickCategory } = useData()
  const [sessions, setSessions] = useState<Session[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Statistiche per il dashboard
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    completedSessions: 0,
    categoriesCount: 0
  })

  useEffect(() => {
    loadSessions()
    loadAllCategories()
  }, [])

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          category_id,
          session_date,
          location,
          created_at,
          categories!inner(id, code, name)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      setSessions(data || [])
      
      // Calcola statistiche
      const totalSessions = data?.length || 0
      const activeSessions = 0 // Non abbiamo status, quindi 0 per ora
      const completedSessions = totalSessions // Tutte le sessioni sono considerate completate
      
      setStats({
        totalSessions,
        activeSessions,
        completedSessions,
        categoriesCount: categories.length
      })
    } catch (error) {
      console.error('Errore nel caricamento sessioni:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true) // Solo categorie attive
        .order('sort', { ascending: true })

      if (error) throw error

      // Filtra e ordina usando BRIXIA_CATEGORIES
      const brixiaCategories = [
        { code: 'U6', name: 'Under 6', sort: 1 },
        { code: 'U8', name: 'Under 8', sort: 2 },
        { code: 'U10', name: 'Under 10', sort: 3 },
        { code: 'U12', name: 'Under 12', sort: 4 },
        { code: 'U14', name: 'Under 14', sort: 5 },
        { code: 'U16', name: 'Under 16', sort: 6 },
        { code: 'U18', name: 'Under 18', sort: 7 },
        { code: 'CADETTA', name: 'Cadetta', sort: 8 },
        { code: 'PRIMA', name: 'Prima Squadra', sort: 9 },
        { code: 'SENIORES', name: 'Seniores', sort: 10 },
        { code: 'PODEROSA', name: 'Poderosa', sort: 11 },
        { code: 'GUSSAGOLD', name: 'GussagOld', sort: 12 },
        { code: 'BRIXIAOLD', name: 'Brixia Old', sort: 13 },
        { code: 'LEONESSE', name: 'Leonesse', sort: 14 }
      ]

      // Filtra solo le categorie attive e valide
      const filteredCategories = (data || [])
        .filter(cat => cat.active === true) // Solo categorie attive
        .filter(cat => brixiaCategories.some(bc => bc.code === cat.code)) // Solo categorie valide
        .sort((a, b) => {
          const aSort = brixiaCategories.find(bc => bc.code === a.code)?.sort || 999
          const bSort = brixiaCategories.find(bc => bc.code === b.code)?.sort || 999
          return aSort - bSort
        })

      setCategories(filteredCategories)
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const handleCategoryClick = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId)
    if (category) {
      navigate(`/category-activities?category=${category.code}`)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Funzione per ottenere l'abbreviazione della categoria
  const getCategoryAbbreviation = (code: string) => {
    // Mappatura per codici
    const codeAbbreviations: { [key: string]: string } = {
      'U6': 'U6',
      'U8': 'U8', 
      'U10': 'U10',
      'U12': 'U12',
      'U14': 'U14',
      'U16': 'U16',
      'U18': 'U18',
      'CADETTA': 'CAD',
      'SENIORES': 'PRI',
      'PODEROSA': 'POD',
      'GUSSAGOLD': 'GUS',
      'BRIXIAOLD': 'BRI',
      'LEONESSE': 'LEO'
    }
    
    // Mappatura per nomi completi (nel caso arrivino i nomi invece dei codici)
    const nameAbbreviations: { [key: string]: string } = {
      'Under 6': 'U6',
      'Under 8': 'U8',
      'Under 10': 'U10',
      'Under 12': 'U12',
      'Under 14': 'U14',
      'Under 16': 'U16',
      'Under 18': 'U18',
      'Cadetta': 'CAD',
      'Prima Squadra': 'PRI',
      'Seniores': 'PRI',
      'Poderosa': 'POD',
      'GussagOld': 'GUS',
      'Brixia Old': 'BRI',
      'Leonesse': 'LEO'
    }
    
    // Prova prima con i codici, poi con i nomi
    return codeAbbreviations[code] || nameAbbreviations[code] || code
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Gestione Attività" showBack={true} />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Dashboard interno con statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card p-6 bg-gradient-to-r from-green-500 to-green-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">📊</div>
              <div>
                <div className="text-2xl font-bold">{stats.totalSessions}</div>
                <div className="text-sm text-green-100">Sessioni Totali</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🟢</div>
              <div>
                <div className="text-2xl font-bold">{stats.activeSessions}</div>
                <div className="text-sm text-blue-100">Sessioni Attive</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">✅</div>
              <div>
                <div className="text-2xl font-bold">{stats.completedSessions}</div>
                <div className="text-sm text-purple-100">Sessioni Completate</div>
              </div>
            </div>
          </div>
          
          <div className="card p-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <div className="flex items-center">
              <div className="text-3xl mr-4">🏈</div>
              <div>
                <div className="text-2xl font-bold">{stats.categoriesCount}</div>
                <div className="text-sm text-orange-100">Categorie</div>
              </div>
            </div>
          </div>
        </div>

        {/* Header per azioni rapide */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestione Attività</h1>
            <p className="text-gray-600 mt-2">
              Gestisci sessioni di allenamento e registra presenze
            </p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <button
              onClick={() => navigate('/events')}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              📅 Gestione Eventi
            </button>
          </div>
        </div>

        {/* Sezione categorie per visualizzazione attività */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Categorie</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className="card p-4 text-center cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white"
              >
                <div className="font-semibold text-white text-lg">{category.name}</div>
                <div className="text-xs text-blue-200 mt-2">Clicca per visualizzare attività</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sezione sessioni recenti */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Sessioni Recenti</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2">⏳</div>
              <p className="text-gray-500">Caricamento sessioni...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2 text-gray-400">📊</div>
              <p className="text-gray-600">Nessuna sessione trovata</p>
              <p className="text-gray-500 text-sm mt-2">Avvia una nuova sessione per iniziare</p>
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
                          {session.categories?.name || session.categories?.code || 'Categoria'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Data: {formatDate(session.session_date)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Location: {session.location}
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
