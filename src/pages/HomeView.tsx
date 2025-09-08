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
  
  // Nuovi stati per il sistema people
  const [peopleStats, setPeopleStats] = useState({
    totalPeople: 0,
    minors: 0,
    guardians: 0,
    consentsSigned: 0,
    validCertificates: 0,
    documentsUploaded: 0
  })
  const [alerts, setAlerts] = useState({
    expiredConsents: 0,
    expiringCertificates: 0,
    minorsWithoutGuardian: 0,
    missingDocuments: 0
  })
  const [loadingStats, setLoadingStats] = useState(true)

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

  const loadPeopleStats = async () => {
    try {
      setLoadingStats(true)
      
      // Carica statistiche del sistema people
      const [
        { count: totalPeople },
        { count: minors },
        { count: guardians },
        { count: consentsSigned },
        { count: validCertificates },
        { count: documentsUploaded },
        { count: expiredConsents },
        { count: expiringCertificates },
        { count: minorsWithoutGuardian },
        { count: missingDocuments }
      ] = await Promise.all([
        // Totale persone
        supabase.from('people').select('*', { count: 'exact', head: true }),
        
        // Minorenni
        supabase.from('people').select('*', { count: 'exact', head: true }).eq('is_minor', true),
        
        // Tutori
        supabase.from('guardians').select('*', { count: 'exact', head: true }),
        
        // Consensi firmati
        supabase.from('person_consents').select('*', { count: 'exact', head: true }),
        
        // Certificati validi
        supabase.from('medical_certificates').select('*', { count: 'exact', head: true }).eq('status', 'valid'),
        
        // Documenti caricati
        supabase.from('documents').select('*', { count: 'exact', head: true }),
        
        // Consensi scaduti (placeholder - da implementare)
        Promise.resolve({ count: 0 }),
        
        // Certificati in scadenza (placeholder - da implementare)
        Promise.resolve({ count: 0 }),
        
        // Minorenni senza tutore (placeholder - da implementare)
        Promise.resolve({ count: 0 }),
        
        // Documenti mancanti (placeholder - da implementare)
        Promise.resolve({ count: 0 })
      ])

      setPeopleStats({
        totalPeople: totalPeople || 0,
        minors: minors || 0,
        guardians: guardians || 0,
        consentsSigned: consentsSigned || 0,
        validCertificates: validCertificates || 0,
        documentsUploaded: documentsUploaded || 0
      })

      setAlerts({
        expiredConsents: expiredConsents || 0,
        expiringCertificates: expiringCertificates || 0,
        minorsWithoutGuardian: minorsWithoutGuardian || 0,
        missingDocuments: missingDocuments || 0
      })

    } catch (error) {
      console.error('Errore nel caricamento statistiche:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  // Carica gli eventi prossimi e statistiche
  useEffect(() => {
    loadUpcomingEvents()
    loadPeopleStats()
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

  // Card di navigazione principali (aggiornate con sistema people)
  const navigationCards = [
    {
      title: "Attività",
      description: "Presenze e sessioni allenamento",
      icon: "📊",
      route: "/activities",
      color: "bg-gradient-to-r from-green-500 to-green-600 border-l-4 border-green-400",
      quickActions: [
        { label: "➕ Nuova Sessione", action: () => navigate("/start") },
        { label: "📋 Presenze", action: () => navigate("/board") }
      ]
    },
    {
      title: "Staff",
      description: "Allenatori, dirigenti e medici",
      icon: "👥",
      route: "/staff",
      color: "bg-gradient-to-r from-orange-500 to-orange-600 border-l-4 border-orange-400",
      quickActions: [
        { label: "➕ Nuovo Staff", action: () => navigate("/create-user") },
        { label: "🔐 Gestione Permessi", action: () => navigate("/staff") }
      ]
    },
    {
      title: "Giocatori",
      description: "Gestione anagrafica e categorie",
      icon: "🏉",
      route: "/players",
      color: "bg-gradient-to-r from-blue-500 to-blue-600 border-l-4 border-blue-400",
      quickActions: [
        { label: "➕ Nuovo Giocatore", action: () => navigate("/create-player") },
        { label: "👥 Gestione Anagrafica", action: () => navigate("/players") }
      ]
    },
    {
      title: "Anagrafica",
      description: "Gestione unificata di tutte le persone",
      icon: "👥",
      route: "/people",
      color: "bg-gradient-to-r from-indigo-500 to-indigo-600 border-l-4 border-indigo-400",
      quickActions: [
        { label: "➕ Nuova Persona", action: () => navigate("/create-person") },
        { label: "🔍 Gestione Persone", action: () => navigate("/people") }
      ]
    },
    {
      title: "Consensi",
      description: "Gestione consensi e firme digitali",
      icon: "📝",
      route: "/consents",
      color: "bg-gradient-to-r from-yellow-500 to-yellow-600 border-l-4 border-yellow-400",
      quickActions: [
        { label: "✍️ Firma Consensi", action: () => navigate("/consents") },
        { label: "📋 Gestione Privacy", action: () => navigate("/consents") }
      ],
      badge: alerts.expiredConsents > 0 ? `${alerts.expiredConsents} scaduti` : null
    },
    {
      title: "Documenti",
      description: "Certificati e documenti anagrafici",
      icon: "📄",
      route: "/documents",
      color: "bg-gradient-to-r from-purple-500 to-purple-600 border-l-4 border-purple-400",
      quickActions: [
        { label: "📤 Carica Documenti", action: () => navigate("/documents") },
        { label: "🏥 Certificati Medici", action: () => navigate("/documents") }
      ],
      badge: alerts.expiringCertificates > 0 ? `${alerts.expiringCertificates} in scadenza` : null
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
            
            {/* Lato destro - Informazioni utente, settings e logout */}
            <div className="text-right">
              <p className="text-white/90 text-sm">{getGreeting()}</p>
              <p className="font-semibold">{profile?.full_name || 'Utente'}</p>
              <div className="mt-2 flex items-center gap-2 justify-end">
                {/* Settings icon */}
                <button
                  onClick={() => navigate('/settings')}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors text-xl"
                  title="Impostazioni"
                >
                  ⚙️
                </button>
                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
                >
                  Logout
                </button>
              </div>
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
                className={`card p-6 ${card.color} cursor-pointer transition-all duration-200 hover:scale-105 shadow-lg relative`}
                onClick={() => navigate(card.route)}
              >
                {/* Badge per alert */}
                {card.badge && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                    {card.badge}
                  </div>
                )}
                
                <div className="flex items-center mb-4">
                  <div className="text-3xl mr-4">{card.icon}</div>
                  <div>
                    <div className="text-2xl font-bold text-white">{card.title}</div>
                    <div className="text-sm text-white/80">{card.description}</div>
                  </div>
                </div>
                
                {/* Quick Actions */}
                {card.quickActions && (
                  <div className="space-y-2">
                    {card.quickActions.map((action, actionIndex) => (
                      <button
                        key={actionIndex}
                        onClick={(e) => {
                          e.stopPropagation()
                          action.action()
                        }}
                        className="w-full text-left px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm text-white/90 hover:text-white"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
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
                {alerts.expiredConsents > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <div className="font-medium text-red-900">Consensi scaduti</div>
                    <div className="text-sm text-red-600">{alerts.expiredConsents} consensi da rinnovare</div>
                    <div className="text-xs text-red-500 mt-1">Urgente</div>
                  </div>
                )}
                {alerts.expiringCertificates > 0 && (
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="font-medium text-orange-900">Certificati in scadenza</div>
                    <div className="text-sm text-orange-600">{alerts.expiringCertificates} certificati medici</div>
                    <div className="text-xs text-orange-500 mt-1">Prossima scadenza</div>
                  </div>
                )}
                {alerts.minorsWithoutGuardian > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <div className="font-medium text-red-900">Minorenni senza tutore</div>
                    <div className="text-sm text-red-600">{alerts.minorsWithoutGuardian} atleti minorenni</div>
                    <div className="text-xs text-red-500 mt-1">Azione richiesta</div>
                  </div>
                )}
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
                {loadingStats ? (
                  <div className="text-center py-4">
                    <div className="text-gray-500">Caricamento statistiche...</div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Persone Totali</span>
                      <span className="font-bold text-blue-600">{peopleStats.totalPeople}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Minorenni</span>
                      <span className="font-bold text-green-600">{peopleStats.minors}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Tutori Attivi</span>
                      <span className="font-bold text-orange-600">{peopleStats.guardians}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Consensi Firmati</span>
                      <span className="font-bold text-purple-600">{peopleStats.consentsSigned}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Certificati Validi</span>
                      <span className="font-bold text-teal-600">{peopleStats.validCertificates}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Documenti Caricati</span>
                      <span className="font-bold text-indigo-600">{peopleStats.documentsUploaded}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Alert Bar - Notifiche urgenti */}
          {(alerts.expiredConsents > 0 || alerts.expiringCertificates > 0 || alerts.minorsWithoutGuardian > 0 || alerts.missingDocuments > 0) && (
            <div className="mt-8 p-4 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-400 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-2xl">🚨</div>
                <h3 className="text-lg font-semibold text-red-800">Alert & Notifiche</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {alerts.expiredConsents > 0 && (
                  <div className="flex items-center gap-2 text-red-700">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    <span>{alerts.expiredConsents} consensi scaduti</span>
                  </div>
                )}
                {alerts.expiringCertificates > 0 && (
                  <div className="flex items-center gap-2 text-orange-700">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    <span>{alerts.expiringCertificates} certificati in scadenza</span>
                  </div>
                )}
                {alerts.minorsWithoutGuardian > 0 && (
                  <div className="flex items-center gap-2 text-red-700">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    <span>{alerts.minorsWithoutGuardian} minorenni senza tutore</span>
                  </div>
                )}
                {alerts.missingDocuments > 0 && (
                  <div className="flex items-center gap-2 text-yellow-700">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    <span>{alerts.missingDocuments} documenti mancanti</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
