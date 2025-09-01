import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'

interface Event {
  id: string
  title: string
  event_date: string
  event_time?: string
  event_type: string
  category_id: string
  location: string
  is_home: boolean
  opponent?: string
  description?: string
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

export default function Events() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_date: '',
    event_time: '',
    event_type: 'partita',
    category_id: '',
    location: '',
    is_home: false,
    opponent: '',
    description: '',
    is_championship: false,
    is_friendly: false
  })

  useEffect(() => {
    loadEvents()
    loadCategories()
  }, [])

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          categories(id, code, name)
        `)
        .order('event_date', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Errore nel caricamento eventi:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('sort', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { error } = await supabase
        .from('events')
        .insert([newEvent])

      if (error) throw error

             setShowCreateForm(false)
       setNewEvent({
         title: '',
         event_date: '',
         event_time: '',
         event_type: 'partita',
         category_id: '',
         location: '',
         is_home: false,
         opponent: '',
         description: '',
         is_championship: false,
         is_friendly: false
       })
       loadEvents()
    } catch (error) {
      console.error('Errore nella creazione evento:', error)
    }
  }

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event)
         setNewEvent({
       title: event.title,
       event_date: event.event_date,
       event_time: event.event_time || '',
       event_type: event.event_type,
       category_id: event.category_id,
       location: event.location,
       is_home: event.is_home,
       opponent: event.opponent || '',
       description: event.description || ''
     })
    setShowCreateForm(true)
  }

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingEvent) return
    
    try {
      const { error } = await supabase
        .from('events')
        .update(newEvent)
        .eq('id', editingEvent.id)

      if (error) throw error

             setShowCreateForm(false)
       setEditingEvent(null)
       setNewEvent({
         title: '',
         event_date: '',
         event_time: '',
         event_type: 'partita',
         category_id: '',
         location: '',
         is_home: false,
         opponent: '',
         description: '',
         is_championship: false,
         is_friendly: false
       })
       loadEvents()
    } catch (error) {
      console.error('Errore nell\'aggiornamento evento:', error)
    }
  }

  const handleCancelEdit = () => {
    setShowCreateForm(false)
    setEditingEvent(null)
         setNewEvent({
       title: '',
       event_date: '',
       event_time: '',
       event_type: 'partita',
       category_id: '',
       location: '',
       is_home: false,
       opponent: '',
       description: '',
       is_championship: false,
       is_friendly: false
     })
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questo evento?')) {
      try {
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId)

        if (error) throw error

        loadEvents()
      } catch (error) {
        console.error('Errore nell\'eliminazione evento:', error)
      }
    }
  }

  const generateEventTitle = () => {
    if (newEvent.event_type !== 'partita') return ''

    const category = categories.find(cat => cat.id === newEvent.category_id)
    const categoryName = category ? category.name : ''
    
    // Verifica che tutti i campi necessari siano compilati
    if (!categoryName || !newEvent.opponent) return ''
    
    // Se è in casa: "Nostra Categoria vs Avversario" (per capire che giochiamo in casa)
    // Se è in trasferta: "Avversario vs Nostra Categoria" (per capire che giochiamo fuori)
    if (newEvent.is_home) {
      return `Partita ${newEvent.opponent} vs ${categoryName}`
    } else {
      return `Partita ${categoryName} vs ${newEvent.opponent}`
    }
  }

  const handleEventTypeChange = (eventType: string) => {
    setNewEvent({...newEvent, event_type: eventType})
    
    // Se è una partita, genera automaticamente il titolo solo se tutti i campi sono compilati
    if (eventType === 'partita') {
      const autoTitle = generateEventTitle()
      if (autoTitle) {
        setNewEvent(prev => ({...prev, title: autoTitle}))
      }
    }
  }

  const handleCategoryChange = (categoryId: string) => {
    setNewEvent({...newEvent, category_id: categoryId})
    
    // Se è una partita, aggiorna il titolo automaticamente solo se tutti i campi sono compilati
    if (newEvent.event_type === 'partita') {
      const autoTitle = generateEventTitle()
      if (autoTitle) {
        setNewEvent(prev => ({...prev, title: autoTitle}))
      }
    }
  }

  const handleOpponentChange = (opponent: string) => {
    setNewEvent({...newEvent, opponent})
    
    // Se è una partita, aggiorna il titolo automaticamente solo se tutti i campi sono compilati
    if (newEvent.event_type === 'partita') {
      const autoTitle = generateEventTitle()
      if (autoTitle) {
        setNewEvent(prev => ({...prev, title: autoTitle}))
      }
    }
  }

  const handleHomeAwayChange = (isHome: boolean) => {
    setNewEvent({...newEvent, is_home: isHome})
    
    // Se è una partita, aggiorna il titolo automaticamente solo se tutti i campi sono compilati
    if (newEvent.event_type === 'partita') {
      const autoTitle = generateEventTitle()
      if (autoTitle) {
        setNewEvent(prev => ({...prev, title: autoTitle}))
      }
    }
  }

  const handleLocationChange = (location: string) => {
    setNewEvent({...newEvent, location})
    
    // Controlla se la location è una sede di casa
    const homeLocations = ['Brescia', 'Gussago', 'Ospitaletto']
    const isHomeLocation = homeLocations.some(homeLoc => 
      location.toLowerCase().includes(homeLoc.toLowerCase())
    )
    
    // Se la location è una sede di casa, seleziona automaticamente il checkbox
    if (isHomeLocation && !newEvent.is_home) {
      setNewEvent(prev => ({...prev, is_home: true}))
      
      // Se è una partita, aggiorna anche il titolo solo se tutti i campi sono compilati
      if (newEvent.event_type === 'partita') {
        const autoTitle = generateEventTitle()
        if (autoTitle) {
          setNewEvent(prev => ({...prev, title: autoTitle}))
        }
      }
    }
    
    // Se la location NON è una sede di casa, deseleziona automaticamente il checkbox
    if (!isHomeLocation && newEvent.is_home) {
      setNewEvent(prev => ({...prev, is_home: false}))
      
      // Se è una partita, aggiorna anche il titolo solo se tutti i campi sono compilati
      if (newEvent.event_type === 'partita') {
        const autoTitle = generateEventTitle()
        if (autoTitle) {
          setNewEvent(prev => ({...prev, title: autoTitle}))
        }
      }
    }
  }

  const handleChampionshipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChampionship = e.target.checked
    setNewEvent(prev => ({ 
      ...prev, 
      is_championship: isChampionship,
      is_friendly: !isChampionship // Se campionato è selezionato, amichevole diventa false
    }))
  }

  const handleFriendlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isFriendly = e.target.checked
    setNewEvent(prev => ({ 
      ...prev, 
      is_friendly: isFriendly,
      is_championship: !isFriendly // Se amichevole è selezionato, campionato diventa false
    }))
  }

  const getEventTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'partita': 'Partita',
      'torneo': 'Torneo',
      'allenamento_speciale': 'Allenamento Speciale',
      'evento_sociale': 'Evento Sociale',
      'raduno': 'Raduno',
      'altro': 'Altro'
    }
    return types[type] || type
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Gestione Eventi" showBack={true} />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestione Eventi</h1>
            <p className="text-gray-600 mt-2">
              Gestisci partite, tornei e altri eventi della società
            </p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              ➕ Nuovo Evento
            </button>
          </div>
        </div>

        {/* Form creazione/modifica evento */}
        {showCreateForm && (
          <div className="card p-6 mb-8">
            <h2 className="text-2xl font-bold text-navy mb-4">
              {editingEvent ? 'Modifica Evento' : 'Crea Nuovo Evento'}
            </h2>
            
                                       <form onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent} className="space-y-4">
               {/* PRIMA RIGA: Partita, Categoria, Avversario */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Tipo Evento *
                   </label>
                   <select
                     required
                     value={newEvent.event_type}
                     onChange={(e) => handleEventTypeChange(e.target.value)}
                     className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                   >
                     <option value="partita">Partita</option>
                     <option value="torneo">Torneo</option>
                     <option value="allenamento_speciale">Allenamento Speciale</option>
                     <option value="evento_sociale">Evento Sociale</option>
                     <option value="raduno">Raduno</option>
                     <option value="altro">Altro</option>
                   </select>
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Categoria
                   </label>
                   <select
                     value={newEvent.category_id}
                     onChange={(e) => handleCategoryChange(e.target.value)}
                     className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                   >
                     <option value="">Seleziona categoria</option>
                                           {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                   </select>
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Avversario (per partite)
                   </label>
                   <input
                     type="text"
                     value={newEvent.opponent}
                     onChange={(e) => handleOpponentChange(e.target.value)}
                     className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                     placeholder="Es. Rugby Milano"
                   />
                 </div>
               </div>

               {/* SECONDA RIGA: Data, Location, Checkbox */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Data Evento *
                   </label>
                   <input
                     type="date"
                     required
                     value={newEvent.event_date}
                     onChange={(e) => setNewEvent({...newEvent, event_date: e.target.value})}
                     className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                   />
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Location
                   </label>
                   <input
                     type="text"
                     value={newEvent.location}
                     onChange={(e) => handleLocationChange(e.target.value)}
                     className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                     placeholder="Es. Brescia, Milano"
                   />
                 </div>
                 
                 <div className="flex items-center justify-center space-x-4">
                   <label className="flex items-center">
                     <input
                       type="checkbox"
                       checked={newEvent.is_home}
                       onChange={(e) => handleHomeAwayChange(e.target.checked)}
                       className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                     />
                     <span className="ml-2 text-sm text-gray-700">Evento in casa</span>
                   </label>
                   
                   <label className="flex items-center">
                     <input
                       type="checkbox"
                       checked={newEvent.is_championship}
                       onChange={handleChampionshipChange}
                       className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                     />
                     <span className="ml-2 text-sm text-gray-700">Campionato</span>
                   </label>
                   
                   <label className="flex items-center">
                     <input
                       type="checkbox"
                       checked={newEvent.is_friendly}
                       onChange={handleFriendlyChange}
                       className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                     />
                     <span className="ml-2 text-sm text-gray-700">Amichevole</span>
                   </label>
                 </div>
               </div>

               {/* TERZA RIGA: Titolo Evento, Inizio Evento */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Titolo Evento *
                   </label>
                   <input
                     type="text"
                     required
                     value={newEvent.title}
                     onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                     className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                     placeholder="Es. Partita U14 vs Rugby Milano"
                     style={{ minWidth: '100%' }}
                   />
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Inizio Evento
                   </label>
                   <input
                     type="time"
                     value={newEvent.event_time}
                     onChange={(e) => setNewEvent({...newEvent, event_time: e.target.value})}
                     className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                   />
                 </div>
               </div>

               {/* QUARTA RIGA: Descrizione */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   Descrizione
                 </label>
                 <textarea
                   value={newEvent.description}
                   onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                   rows={3}
                   className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                   placeholder="Descrizione dell'evento..."
                 />
               </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="btn bg-sky text-white px-6 py-3"
                >
                  {editingEvent ? 'Aggiorna Evento' : 'Crea Evento'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn bg-gray-500 text-white px-6 py-3"
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista eventi */}
        <div className="card p-6">
          <h2 className="text-2xl font-bold text-navy mb-4">Eventi Programmati</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2">⏳</div>
              <p className="text-gray-500">Caricamento eventi...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-2xl mb-2 text-gray-400">📅</div>
              <p className="text-gray-600">Nessun evento programmato</p>
              <p className="text-gray-500 text-sm mt-2">Crea il primo evento per iniziare</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      event.is_home ? 'bg-blue-500' : 'bg-green-500'
                    }`}></div>
                    
                    <div>
                      <div className="font-semibold text-lg">{event.title}</div>
                                                                    <div className="text-sm text-gray-600">
                          {formatDate(event.event_date)}
                          {event.event_time && ` • ${event.event_time.substring(0, 5)}`}
                          {event.location && ` • ${event.location}`}
                          {event.is_home ? ' • (Casa)' : ' • (Trasferta)'}
                        </div>
                        {event.description && (
                          <div className="text-xs text-gray-500 mt-1">
                            {event.description}
                          </div>
                        )}
                    </div>
                  </div>
                  
                                     <div className="flex gap-2">
                     <button
                       onClick={() => handleEditEvent(event)}
                       className="btn bg-red-500 text-white px-3 py-2 text-sm hover:bg-red-600"
                     >
                       Modifica
                     </button>
                     <button
                       onClick={() => handleDeleteEvent(event.id)}
                       className="btn bg-gray-500 text-white px-3 py-2 text-sm hover:bg-gray-600"
                     >
                       Elimina
                     </button>
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
