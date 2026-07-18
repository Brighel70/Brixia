import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'
import { sortNamesBySurname } from '@/lib/sortNames'

interface Event {
  id: string
  title: string
  event_date: string
  event_time?: string
  start_time?: string
  end_time?: string
  event_type: string
  category_id: string
  location: string
  away_location?: string
  is_home: boolean
  opponent?: string
  opponents?: string[]
  description?: string
  participants?: string[]
  invited?: string[]
  verbale_pdf?: string
  verbale_pdfs?: string[]
  match_result?: string
  created_at: string
  categories?: {
    code: string
    name: string
  }
}

interface Category {
  id: string
  code: string
  name: string
}

export default function EventsHistory() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const eventsPerPage = 30

  useEffect(() => {
    loadCategories()
    loadPastEvents()
  }, [currentPage])

  const loadPastEvents = async () => {
    try {
      setLoading(true)
      
      // Calcola offset per la paginazione
      const offset = (currentPage - 1) * eventsPerPage
      
      // Prima conta il totale degli eventi passati
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]
      
      const { count, error: countError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .lt('event_date', todayStr)

      if (countError) throw countError

      // Calcola il numero totale di pagine
      const totalEvents = count || 0
      const pages = Math.ceil(totalEvents / eventsPerPage)
      setTotalPages(pages)

      // Carica gli eventi passati con paginazione
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          categories(id, code, name)
        `)
        .lt('event_date', todayStr)
        .order('event_date', { ascending: false })
        .range(offset, offset + eventsPerPage - 1)

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Errore nel caricamento eventi passati:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const getEventIcon = (event: Event) => {
    switch (event.event_type) {
      case 'partita': return '🏉'
      case 'torneo': return '🏆'
      case 'consiglio': return '🏛️'
      case 'allenamento': return '🏃'
      case 'incontro': return '👥'
      default: return '📅'
    }
  }

  const getEventTypeLabel = (eventType: string) => {
    switch (eventType) {
      case 'partita': return 'Partita'
      case 'torneo': return 'Torneo'
      case 'consiglio': return 'Consiglio'
      case 'allenamento': return 'Allenamento'
      case 'incontro': return 'Incontro'
      default: return 'Evento'
    }
  }

  const getEventDetails = (event: Event) => {
    const date = new Date(event.event_date).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })

    const details = [date]

    if (event.start_time && event.end_time) {
      details.push(`Inizio: ${event.start_time.substring(0, 5)}`, `Fine: ${event.end_time.substring(0, 5)}`)
    } else if (event.event_time) {
      details.push(event.event_time.substring(0, 5))
    }

    if (event.location) {
      details.push(event.location)
    }

    if (event.is_home) {
      details.push('(Casa)')
    }

    return details.join(' • ')
  }

  const getEventParticipants = (event: Event) => {
    if (event.event_type === 'torneo' && event.opponents && event.opponents.length > 0) {
      const validOpponents = event.opponents.filter(opp => opp.trim() !== '')
      if (validOpponents.length > 0) {
        return {
          participants: validOpponents.join(', '),
          count: validOpponents.length
        }
      }
    } else if (event.event_type === 'consiglio' && event.participants && event.participants.length > 0) {
      const sorted = sortNamesBySurname(event.participants)
      return {
        participants: sorted.join(', '),
        count: sorted.length
      }
    } else if (event.event_type === 'partita' && event.opponent) {
      return {
        participants: event.opponent,
        count: 1
      }
    }
    return null
  }

  const getEventInvited = (event: Event) => {
    if (event.event_type === 'consiglio' && event.invited?.length > 0) {
      const sorted = sortNamesBySurname(event.invited)
      return {
        invited: sorted.join(', '),
        count: sorted.length
      }
    }
    return null
  }

  const getAbsentCouncilMembers = (event: Event) => {
    if (event.event_type === 'consiglio' && event.participants && event.participants.length > 0) {
      // Lista completa dei membri del consiglio (da implementare se necessario)
      const allCouncilMembers = ['Membro1', 'Membro2', 'Membro3'] // Esempio
      const absentMembers = allCouncilMembers.filter(member => 
        !event.participants?.includes(member)
      )
      return absentMembers.length > 0 ? absentMembers : null
    }
    return null
  }

  // Analizza il risultato della partita e determina vittoria/sconfitta/pareggio
  const analyzeMatchResult = (matchResult: string, isHome: boolean) => {
    if (!matchResult || matchResult.trim() === '') {
      return { status: 'unknown', ourScore: 0, opponentScore: 0, display: matchResult }
    }

    const scorePattern = /^(\d+)\s*[-–]\s*(\d+)$/
    const match = matchResult.trim().match(scorePattern)
    
    if (!match) {
      return { status: 'unknown', ourScore: 0, opponentScore: 0, display: matchResult }
    }

    const score1 = parseInt(match[1])
    const score2 = parseInt(match[2])
    
    let ourScore: number, opponentScore: number
    
    if (isHome) {
      ourScore = score1
      opponentScore = score2
    } else {
      ourScore = score2
      opponentScore = score1
    }

    let status: 'win' | 'loss' | 'draw' | 'unknown'
    if (ourScore > opponentScore) {
      status = 'win'
    } else if (ourScore < opponentScore) {
      status = 'loss'
    } else {
      status = 'draw'
    }

    return {
      status,
      ourScore,
      opponentScore,
      display: `${ourScore} - ${opponentScore}`
    }
  }

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null

    const pages = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    // Pulsante "Precedente"
    if (currentPage > 1) {
      pages.push(
        <button
          key="prev"
          onClick={() => handlePageChange(currentPage - 1)}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 hover:text-gray-700"
        >
          Precedente
        </button>
      )
    }

    // Prima pagina
    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => handlePageChange(1)}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700"
        >
          1
        </button>
      )
      if (startPage > 2) {
        pages.push(<span key="ellipsis1" className="px-3 py-2 text-sm text-gray-500">...</span>)
      }
    }

    // Pagine centrali
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-2 text-sm font-medium border ${
            i === currentPage
              ? 'text-blue-600 bg-blue-50 border-blue-300'
              : 'text-gray-500 bg-white border-gray-300 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          {i}
        </button>
      )
    }

    // Ultima pagina
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(<span key="ellipsis2" className="px-3 py-2 text-sm text-gray-500">...</span>)
      }
      pages.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 hover:text-gray-700"
        >
          {totalPages}
        </button>
      )
    }

    // Pulsante "Successivo"
    if (currentPage < totalPages) {
      pages.push(
        <button
          key="next"
          onClick={() => handlePageChange(currentPage + 1)}
          className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 hover:text-gray-700"
        >
          Successivo
        </button>
      )
    }

    return (
      <div className="flex items-center justify-center space-x-1 mt-6">
        {pages}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Storico Eventi" 
        showBack={true}
      />
      
      <div className="max-w-6xl mx-auto p-6">
        {/* Modal dettaglio evento */}
        {showEventModal && selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">{getEventIcon(selectedEvent)}</div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {getEventTypeLabel(selectedEvent.event_type)}
                      </h3>
                      <p className="text-gray-600">{selectedEvent.title}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEventModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-4">
                {/* Dettagli evento */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">📅 Dettagli</h4>
                  <p className="text-blue-700">{getEventDetails(selectedEvent)}</p>
                </div>

                {/* Partecipanti */}
                {(() => {
                  const participants = getEventParticipants(selectedEvent)
                  if (participants) {
                    return (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-2">
                          {selectedEvent.event_type === 'torneo' ? '🏆 Squadre' : 
                           selectedEvent.event_type === 'consiglio' ? '👥 Partecipanti' : '🏉 Avversario'} ({participants.count})
                        </h4>
                        <p className="text-blue-700">{participants.participants}</p>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Invitati (solo per consiglio) */}
                {(() => {
                  const invited = getEventInvited(selectedEvent)
                  if (invited) {
                    return (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-800 mb-2">🎫 Invitati ({invited.count})</h4>
                        <p className="text-green-700">{invited.invited}</p>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Tipo Partita (solo per partite) */}
                {selectedEvent.event_type === 'partita' && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">🏉 Tipo Partita</h4>
                    <p className="text-purple-700 font-medium text-lg">
                      {selectedEvent.is_championship ? '🏆 Campionato' : '🤝 Amichevole'}
                    </p>
                  </div>
                )}

                {/* Risultato (solo per partite) */}
                {selectedEvent.event_type === 'partita' && selectedEvent.match_result && (() => {
                  const result = analyzeMatchResult(selectedEvent.match_result, selectedEvent.is_home)
                  const getResultIcon = (status: string) => {
                    switch (status) {
                      case 'win': return '🟢'
                      case 'loss': return '🔴'
                      case 'draw': return '🟡'
                      default: return '🏉'
                    }
                  }
                  const getResultBgColor = (status: string) => {
                    switch (status) {
                      case 'win': return 'bg-green-50'
                      case 'loss': return 'bg-red-50'
                      case 'draw': return 'bg-yellow-50'
                      default: return 'bg-gray-50'
                    }
                  }
                  const getResultTextColor = (status: string) => {
                    switch (status) {
                      case 'win': return 'text-green-800'
                      case 'loss': return 'text-red-800'
                      case 'draw': return 'text-yellow-800'
                      default: return 'text-gray-800'
                    }
                  }
                  const getResultScoreColor = (status: string) => {
                    switch (status) {
                      case 'win': return 'text-green-700'
                      case 'loss': return 'text-red-700'
                      case 'draw': return 'text-yellow-700'
                      default: return 'text-gray-700'
                    }
                  }
                  return (
                    <div className={`${getResultBgColor(result.status)} p-4 rounded-lg`}>
                      <h4 className={`font-semibold ${getResultTextColor(result.status)} mb-2`}>
                        {getResultIcon(result.status)} Risultato
                      </h4>
                      <p className={`${getResultScoreColor(result.status)} font-medium text-lg`}>
                        {result.display}
                      </p>
                      {result.status !== 'unknown' && (
                        <p className={`${getResultTextColor(result.status)} text-sm mt-1`}>
                          {result.status === 'win' ? '🏆 Vittoria!' : 
                           result.status === 'loss' ? '😔 Sconfitta' : '🤝 Pareggio'}
                        </p>
                      )}
                    </div>
                  )
                })()}

                {/* Descrizione */}
                {selectedEvent.description && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 mb-2">📝 Descrizione</h4>
                    <p className="text-gray-600">{selectedEvent.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lista eventi passati */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-navy">Eventi Passati</h2>
            <div className="text-sm text-gray-500">
              Pagina {currentPage} di {totalPages}
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2">⏳</div>
              <p className="text-gray-500">Caricamento eventi...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2 text-gray-400">📅</div>
              <p className="text-gray-600">Nessun evento passato trovato</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {events.map((event) => {
                  const participants = getEventParticipants(event)
                  const invited = getEventInvited(event)
                  const absentMembers = getAbsentCouncilMembers(event)
                  
                  return (
                    <div key={event.id} className="flex items-start justify-between p-4 bg-gray-300 rounded-lg cursor-pointer hover:bg-gray-400 transition-colors" onClick={() => handleEventClick(event)}>
                      <div className="flex items-start w-full">
                        {/* Pallino colorato + Icona */}
                        <div className="flex items-center space-x-2 w-20 flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            event.is_home ? 'bg-blue-500' : 'bg-green-500'
                          }`}></div>
                          <div className="text-lg w-10 text-center flex-shrink-0" title={event.categories?.name || event.event_type}>
                            {getEventIcon(event)}
                          </div>
                        </div>
                        
                        {/* Contenuto principale */}
                        <div className="flex-1 ml-4 min-w-0">
                          {/* Titolo + Tipo Partita */}
                          <div className="font-semibold text-lg leading-tight">
                            {getEventTypeLabel(event.event_type)}: {event.title}
                            {event.event_type === 'partita' && (
                              <span className="ml-2 text-sm font-normal text-purple-600">
                                {event.is_championship ? '🏆 Campionato' : '🤝 Amichevole'}
                              </span>
                            )}
                          </div>
                          
                          {/* Dettagli evento */}
                          <div className="text-sm text-gray-600 mt-1 leading-tight">
                            {getEventDetails(event)}
                          </div>
                          
                          {/* Partecipanti */}
                          {participants && (
                            <div className="text-sm text-gray-500 mt-1 leading-tight">
                              <span className="font-medium">
                                {event.event_type === 'torneo' ? `Squadre (${participants.count}):` : 
                                 event.event_type === 'consiglio' ? `Partecipanti (${participants.count}):` : 'Avversario:'}
                              </span> {participants.participants}
                            </div>
                          )}
                          
                          {/* Invitati */}
                          {invited && (
                            <div className="text-sm text-green-600 mt-1 leading-tight">
                              <span className="font-medium">Invitati ({invited.count}):</span> {invited.invited}
                            </div>
                          )}
                          
                          {/* Risultato */}
                          {event.event_type === 'partita' && event.match_result && (() => {
                            const result = analyzeMatchResult(event.match_result, event.is_home)
                            const getResultIcon = (status: string) => {
                              switch (status) {
                                case 'win': return '🟢'
                                case 'loss': return '🔴'
                                case 'draw': return '🟡'
                                default: return '🏉'
                              }
                            }
                            const getResultColor = (status: string) => {
                              switch (status) {
                                case 'win': return 'text-green-600'
                                case 'loss': return 'text-red-600'
                                case 'draw': return 'text-yellow-600'
                                default: return 'text-gray-600'
                              }
                            }
                            return (
                              <div className={`text-sm mt-1 leading-tight ${getResultColor(result.status)}`}>
                                <span className="font-medium">
                                  {getResultIcon(result.status)} Risultato:
                                </span> {result.display}
                                {result.status !== 'unknown' && (
                                  <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">
                                    {result.status === 'win' ? 'Vittoria' : 
                                     result.status === 'loss' ? 'Sconfitta' : 'Pareggio'}
                                  </span>
                                )}
                              </div>
                            )
                          })()}

                          {/* Descrizione */}
                          {event.description && (
                            <div className="text-xs text-gray-500 mt-1 leading-tight">
                              {event.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Paginazione */}
              {renderPagination()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
