import Header from '@/components/Header'
import AttendanceRow from '@/components/AttendanceRow'
import { useEffect, useState } from 'react'
import { useData } from '@/store/data'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

export default function AttendanceBoard(){
  const [searchParams] = useSearchParams()
  const { currentCategory, currentSession, loadPlayers, players, pickCategory, startSession, setCurrentSession } = useData()
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const sessionId = searchParams.get('session')
    if (sessionId) {
      loadSessionAndCategory(sessionId)
    } else {
      setLoading(false)
    }
  }, [searchParams])

  const loadSessionAndCategory = async (sessionId: string) => {
    try {
      // Carica la sessione con la categoria
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          id,
          session_date,
          location,
          away_place,
          categories!inner(id, code, name)
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        console.error('Errore nel caricamento sessione:', sessionError)
        setLoading(false)
        return
      }

      // Imposta la categoria e la sessione nello store
      pickCategory(sessionData.categories)
      setCurrentSession(sessionData)

      // Carica i giocatori della categoria
      await loadPlayers(sessionData.categories.id)
    } catch (error) {
      console.error('Errore nel caricamento:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Presenze" />
        <div className="p-4 text-center">
          <div className="text-lg">Caricamento giocatori...</div>
        </div>
      </div>
    )
  }

  if (!currentSession || !currentCategory) {
    return (
      <div>
        <Header title="Presenze" />
        <div className="p-4 text-center">
          <div className="text-lg text-red-600 mb-4">Sessione non trovata</div>
          <p className="text-gray-600">La sessione richiesta non esiste o non è accessibile</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title={`Presenze – ${currentCategory.code}`} />
      <div className="p-2">
        <div className="card p-0 overflow-hidden">
          <div className="max-h-[70vh] overflow-auto divide-y divide-white/50">
            {players.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-2xl mb-2">👥</div>
                <p>Nessun giocatore trovato per questa categoria</p>
              </div>
            ) : (
              players.map(p => <AttendanceRow key={p.id} player={p as any} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}