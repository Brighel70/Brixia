import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { getBrandConfig, getBrandClasses } from '@/config/brand'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function HomeView() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [brandConfig, setBrandConfig] = useState(getBrandConfig())
  const [brandClasses, setBrandClasses] = useState(getBrandClasses())
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)

  // Carica gli eventi prossimi
  useEffect(() => {
    loadUpcomingEvents()
  }, [])

  // Aggiorna la configurazione quando cambia
  useEffect(() => {
    const updateConfig = () => {
      setBrandConfig(getBrandConfig())
      setBrandClasses(getBrandClasses())
    }

    // Ascolta i cambiamenti nel localStorage
    window.addEventListener('storage', updateConfig)
    
    // Controlla periodicamente per cambiamenti
    const interval = setInterval(updateConfig, 1000)
    
    return () => {
      window.removeEventListener('storage', updateConfig)
      clearInterval(interval)
    }
  }, [])

  const loadUpcomingEvents = async () => {
    try {
      setLoadingEvents(true)
      
      // Carica i prossimi 5 eventi ordinati per data
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          categories (
            name
          )
        `)
        .gte('event_date', new Date().toISOString().split('T')[0]) // Solo eventi da oggi in poi
        .order('event_date', { ascending: true })
        .limit(5)

      if (error) {
        console.error('Errore nel caricamento eventi:', error)
        return
      }

      setUpcomingEvents(data || [])
    } catch (error) {
      console.error('Errore nel caricamento eventi:', error)
    } finally {
      setLoadingEvents(false)
    }
  }

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    }
    return date.toLocaleDateString('it-IT', options)
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buongiorno'
    if (hour < 18) return 'Buon pomeriggio'
    return 'Buonasera'
  }

  // Card di navigazione principali
  const navigationCards = [
    {
      title: "Giocatori",
      description: "Gestione anagrafica e categorie",
      icon: "🏉",
      route: "/players",
      color: "bg-gradient-to-r from-blue-500 to-blue-600 border-l-4 border-blue-400"
    },
    {
      title: "Staff",
      description: "Allenatori, dirigenti e medici",
      icon: "👥",
      route: "/staff",
      color: "bg-gradient-to-r from-orange-500 to-orange-600 border-l-4 border-orange-400"
    },
    {
      title: "Attività",
      description: "Presenze e sessioni allenamento",
      icon: "📊",
      route: "/activities",
      color: "bg-gradient-to-r from-green-500 to-green-600 border-l-4 border-green-400"
    },
    {
      title: "Nuovo Giocatore",
      description: "Registra nuovo atleta",
      icon: "➕",
      route: "/create-player",
      color: "bg-gradient-to-r from-teal-500 to-teal-600 border-l-4 border-teal-400"
    },
    {
      title: "Nuovo Staff",
      description: "Crea account utente",
      icon: "👤",
      route: "/create-user",
      color: "bg-gradient-to-r from-purple-500 to-purple-600 border-l-4 border-purple-400"
    },
    {
      title: "Impostazioni",
      description: "Configurazioni e personalizzazione",
      icon: "⚙️",
      route: "/settings",
      color: "bg-gradient-to-r from-gray-500 to-gray-600 border-l-4 border-gray-400"
    }
  ]

  return (
    <div className="min-h-screen relative">
      {/* Sfondo gradiente */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: `linear-gradient(to bottom right, ${brandConfig.colors.accent}, white)`
        }}
      />

      {/* Contenuto */}
      <div className="relative z-10">
        {/* Header con logo e brand - NOME CLUB CENTRATO DAL CAMPO CONFIGURAZIONI */}
        <header 
          className="p-6 shadow-brixia"
          style={{
            background: `linear-gradient(to right, ${brandConfig.colors.primary}, ${brandConfig.colors.secondary})`
          }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between text-white">
            {/* Lato sinistro - SOLO LOGO INGRANDITO 3X (senza pulsante back) */}
            <div className="flex items-center">
              <img 
                src={brandConfig.assets.logo} 
                alt={brandConfig.assets.logoAlt}
                className="w-60 h-auto object-contain" // LOGO INGRANDITO 3X - 240px di larghezza
              />
            </div>
            
            {/* Centro - NOME CLUB DAL CAMPO CONFIGURAZIONI - FONT PIÙ GRANDE E GRASSO */}
            <div className="flex-1 text-center">
              <h1 className="text-4xl font-black">{brandConfig.clubName}</h1>
              <p className="text-white/90 text-sm">{brandConfig.clubDescription}</p>
              <p className="text-white/80 text-xs">Stagione {brandConfig.season}</p>
            </div>
            
            {/* Lato destro - Informazioni utente e logout */}
            <div className="text-right">
              <p className="text-white/90 text-sm">{getGreeting()}</p>
              <p className="font-semibold">{profile?.full_name || 'Utente'}</p>
              <button
                onClick={handleLogout}
                className="mt-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Contenuto principale */}
        <main className="max-w-6xl mx-auto p-6">
          {/* Messaggio di benvenuto */}
          <div className="text-center mb-8">
            <h2 
              className="text-2xl font-bold mb-2"
              style={{color: brandConfig.colors.primary}}
            >
              Benvenuto nella gestione {brandConfig.clubShortName}
            </h2>
            <p className="text-gray-600">
              Dashboard principale per la gestione completa della società sportiva
            </p>
          </div>

          {/* Quick Actions - Card di navigazione principali */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {navigationCards.map((card, index) => (
              <div 
                key={index}
                className={`card p-6 ${card.color} cursor-pointer transition-all duration-200 hover:scale-105 shadow-lg`}
                onClick={() => navigate(card.route)}
              >
                <div className="flex items-center">
                  <div className="text-3xl mr-4">{card.icon}</div>
                  <div>
                    <div className="text-2xl font-bold text-white">{card.title}</div>
                    <div className="text-sm text-white/80">{card.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sezione informazioni rapide */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Prossimi eventi */}
            <div className={`${brandClasses.card} p-6`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl">📅</div>
                <h3 className="text-lg font-semibold">Prossimi Eventi</h3>
              </div>
              <div className="space-y-3">
                {loadingEvents ? (
                  <div className="text-center py-4">
                    <div className="text-gray-500">Caricamento eventi...</div>
                  </div>
                ) : upcomingEvents.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-gray-500">Nessun evento programmato</div>
                  </div>
                ) : (
                  upcomingEvents.map((event, index) => (
                    <div 
                      key={event.id}
                      className={`p-3 rounded-lg ${
                        event.is_home 
                          ? 'bg-blue-50' 
                          : 'bg-green-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className={`font-medium ${
                          event.is_home 
                            ? 'text-blue-900' 
                            : 'text-green-900'
                        }`}>
                          {event.title}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded ${
                          event.is_home 
                            ? 'bg-blue-200 text-blue-800' 
                            : 'bg-green-200 text-green-800'
                        }`}>
                          {event.is_home ? 'Casa' : 'Trasferta'}
                        </div>
                      </div>
                      <div className={`text-sm ${
                        event.is_home 
                          ? 'text-blue-600' 
                          : 'text-green-600'
                      }`}>
                        {formatEventDate(event.event_date)}
                        {event.event_time && ` • ${event.event_time.substring(0, 5)}`}
                      </div>
                      {event.description && (
                        <div className={`text-xs mt-1 ${
                          event.is_home 
                            ? 'text-blue-500' 
                            : 'text-green-500'
                        }`}>
                          {event.description}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Comunicazioni recenti */}
            <div className={`${brandClasses.card} p-6`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl">📢</div>
                <h3 className="text-lg font-semibold">Comunicazioni</h3>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="font-medium text-yellow-900">Nuovo allenatore U16</div>
                  <div className="text-sm text-yellow-600">Benvenuto Marco Rossi</div>
                  <div className="text-xs text-yellow-500 mt-1">2 ore fa</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="font-medium text-purple-900">Cambio orario allenamenti</div>
                  <div className="text-sm text-purple-600">U12: Martedì 17:00-18:30</div>
                  <div className="text-xs text-purple-500 mt-1">1 giorno fa</div>
                </div>
              </div>
            </div>

            {/* Statistiche rapide */}
            <div className={`${brandClasses.card} p-6`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl">📈</div>
                <h3 className="text-lg font-semibold">Statistiche</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Giocatori Totali</span>
                  <span className="font-bold text-blue-600">156</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Staff Attivo</span>
                  <span className="font-bold text-green-600">23</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Sessioni Oggi</span>
                  <span className="font-bold text-orange-600">8</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Presenze Media</span>
                  <span className="font-bold text-purple-600">85%</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
