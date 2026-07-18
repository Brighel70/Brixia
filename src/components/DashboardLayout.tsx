import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '@/context/PageTitleContext'
import { useCreatePersonNav } from '@/context/CreatePersonNavContext'
import { motion } from 'motion/react'
import {
  Users,
  Activity,
  CreditCard,
  LayoutDashboard,
  Dumbbell,
  Calendar,
  CalendarPlus,
  UserPlus,
  BarChart2,
  StickyNote,
  Cake,
  Settings,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileText,
  Table2,
  LayoutGrid,
  Plus
} from 'lucide-react'
import { getBrandConfig } from '@/config/brand'
import { useAuth } from '@/store/auth'

const SIDEBAR_ITEMS = [
  { label: 'Dashboard', path: '/home', icon: LayoutDashboard },
  { label: 'Anagrafiche', path: '/people', icon: Users },
  { label: 'Squadre', path: '/activities', icon: Dumbbell },
  { label: 'Eventi', path: '/events', icon: Calendar },
  { label: 'Quote', path: '/fees', icon: CreditCard },
  { label: 'Infermeria', path: '/infortuni', icon: Activity },
  { label: 'Report', path: '/alerts', icon: BarChart2 },
  { label: 'Memo', path: '/memo', icon: StickyNote },
  { label: 'Compleanni', path: '/birthdays', icon: Cake }
]

const TITLE_BY_PATH: Record<string, string> = {
  '/home': 'Dashboard',
  '/activities': 'Squadre',
  '/attendance': 'Presenze',
  '/events': 'Eventi',
  '/people': 'Anagrafiche',
  '/create-person': 'Nuova Persona',
  '/category-activities': 'Attività Categoria',
  '/fees': 'Quote',
  '/infortuni': 'Infermeria',
  '/alerts': 'Alert & Notifiche',
  '/resoconto-settimanale': 'Resoconto Settimanale',
  '/memo': 'Memo',
  '/birthdays': 'Prossimi Compleanni',
  '/settings': 'Impostazioni',
  '/brand-customization': 'Personalizzazione Brand',
  '/council-management': 'Gestione Consiglio',
  '/clubs': 'Altre Società',
  '/users-management': 'Gestione Utenti'
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

const EVENTS_FORM_OPENED = 'events-form-opened'
const EVENTS_FORM_CLOSED = 'events-form-closed'
const EVENTS_CLOSE_FORM = 'events-close-form'
const EVENTS_STATS_UPDATED = 'events-stats-updated'
const EVENTS_STATS_CLEARED = 'events-stats-cleared'

type EventsHeaderStats = {
  totalEvents: number
  partite: number
  tornei: number
  consigli: number
}

function EventsHeaderKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[96px] shrink-0 rounded-xl border border-white/20 bg-white/10 px-3 py-1 text-center">
      <div className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-white/60">{label}</div>
      <div className="text-[17px] font-bold leading-tight text-white">{value}</div>
    </div>
  )
}

const FEES_VIEW_CHANGED = 'fees-view-changed'
const FEES_TAB_CHANGED = 'fees-tab-changed'
const FEES_READONLY = 'fees-readonly'
const FEES_SET_VIEW_TABLE = 'fees-set-view-table'
const FEES_SET_VIEW_CARDS = 'fees-set-view-cards'
const FEES_OPEN_CREATE_MODAL = 'fees-open-create-modal'

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { signOut, profile } = useAuth()
  const firstName = profile?.first_name || (profile?.full_name?.trim().split(/\s+/)[0] || '')
  const oggi = new Date()
  const oggiCapitalized = oggi.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())
  const isEditingPerson = location.pathname === '/create-person' && !!searchParams.get('edit')
  const brandConfig = getBrandConfig()
  const [sidebarState, setSidebarState] = useState<'full' | 'icons'>('full')
  const [eventsFormOpen, setEventsFormOpen] = useState(false)
  const [eventsHeaderStats, setEventsHeaderStats] = useState<EventsHeaderStats | null>(null)
  const [feesViewMode, setFeesViewMode] = useState<'table' | 'cards'>('table')
  const [feesReadOnly, setFeesReadOnly] = useState(false)
  const [feesQuoteTabActive, setFeesQuoteTabActive] = useState(false)

  useEffect(() => {
    if (location.pathname !== '/events') setEventsFormOpen(false)
  }, [location.pathname])
  useEffect(() => {
    if (location.pathname !== '/events') setEventsHeaderStats(null)
  }, [location.pathname])
  useEffect(() => {
    const onOpened = () => setEventsFormOpen(true)
    const onClosed = () => setEventsFormOpen(false)
    window.addEventListener(EVENTS_FORM_OPENED, onOpened)
    window.addEventListener(EVENTS_FORM_CLOSED, onClosed)
    return () => {
      window.removeEventListener(EVENTS_FORM_OPENED, onOpened)
      window.removeEventListener(EVENTS_FORM_CLOSED, onClosed)
    }
  }, [])
  useEffect(() => {
    const onStatsUpdated = (e: Event) => {
      const ev = e as CustomEvent<EventsHeaderStats>
      if (ev.detail) setEventsHeaderStats(ev.detail)
    }
    const onStatsCleared = () => setEventsHeaderStats(null)
    window.addEventListener(EVENTS_STATS_UPDATED, onStatsUpdated)
    window.addEventListener(EVENTS_STATS_CLEARED, onStatsCleared)
    return () => {
      window.removeEventListener(EVENTS_STATS_UPDATED, onStatsUpdated)
      window.removeEventListener(EVENTS_STATS_CLEARED, onStatsCleared)
    }
  }, [])
  useEffect(() => {
    if (location.pathname !== '/fees') return
    const onViewChanged = (e: Event) => {
      const ev = e as CustomEvent<{ mode: 'table' | 'cards' }>
      if (ev.detail?.mode) setFeesViewMode(ev.detail.mode)
    }
    const onReadonly = (e: Event) => {
      const ev = e as CustomEvent<{ value: boolean }>
      setFeesReadOnly(!!ev.detail?.value)
    }
    const onTabChanged = (e: Event) => {
      const ev = e as CustomEvent<{ tab: string }>
      setFeesQuoteTabActive(ev.detail?.tab === 'fees')
    }
    window.addEventListener(FEES_VIEW_CHANGED, onViewChanged)
    window.addEventListener(FEES_READONLY, onReadonly)
    window.addEventListener(FEES_TAB_CHANGED, onTabChanged)
    return () => {
      window.removeEventListener(FEES_VIEW_CHANGED, onViewChanged)
      window.removeEventListener(FEES_READONLY, onReadonly)
      window.removeEventListener(FEES_TAB_CHANGED, onTabChanged)
    }
  }, [location.pathname])

  const cycleSidebar = () => {
    setSidebarState(prev => prev === 'full' ? 'icons' : 'full')
  }

  const pageTitleOverride = usePageTitle()
  const { nextPersonId, prevPersonId } = useCreatePersonNav()
  const fromEventsClubs = location.pathname === '/clubs' && !!(location.state as { fromEvents?: boolean } | null)?.fromEvents
  const headerTitle = (pageTitleOverride && (location.pathname === '/create-person' || location.pathname === '/category-activities')) ? pageTitleOverride : (TITLE_BY_PATH[location.pathname] || 'Dashboard')

  const handleLogout = async () => {
    if (!window.confirm('Sei sicuro di voler uscire?')) return
    await signOut()
    navigate('/')
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-brixia-primary via-brixia-secondary/30 to-black text-white flex">
      {/* SIDEBAR */}
      <div
        className={`bg-white/5 backdrop-blur-2xl flex flex-col justify-between shrink-0 overflow-hidden transition-all duration-300 ${
          sidebarState === 'full' ? 'w-[230px] p-6 border-r border-white/10' : 'w-[58px] py-6 px-2 border-r border-white/10'
        }`}
      >
        <>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {sidebarState === 'full' ? (
                <>
                  <div className="mb-6 flex justify-center">
                    <img
                      src={brandConfig.assets.headerCenterLogo?.trim() || '/TeamFlow%20bubble.png'}
                      alt="TeamFlow"
                      className="h-12 w-auto object-contain cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => navigate('/home')}
                      title="Torna alla Home"
                    />
                  </div>
                  <div className="mt-8 space-y-2 text-base">
                    {SIDEBAR_ITEMS.map((item) => {
                      const Icon = item.icon
                      const isActive = location.pathname === item.path || (item.path === '/activities' && location.pathname.startsWith('/category-activities'))
                      return (
                        <motion.div
                          key={item.path}
                          whileHover={{ x: 4 }}
                          className={`flex items-center gap-3 pr-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                            isActive
                              ? 'bg-brixia-primary/60 border-l-4 border-brixia-secondary border-r-0 border-t-0 border-b-0 pl-3'
                              : 'hover:bg-white/10 border-l-4 border-transparent pl-1'
                          }`}
                          onClick={() => navigate(item.path)}
                          title={item.label}
                        >
                          {Icon && (
                            <Icon
                              className={`w-4 h-4 shrink-0 ${isActive ? 'text-brixia-secondary' : 'text-white/60'}`}
                            />
                          )}
                          <span className={isActive ? 'text-brixia-secondary font-medium' : 'text-white/80'}>
                            {item.label}
                          </span>
                        </motion.div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-2 flex flex-col items-center">
                  {SIDEBAR_ITEMS.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path || (item.path === '/activities' && location.pathname.startsWith('/category-activities'))
                    return (
                      <motion.div
                        key={item.path}
                        whileHover={{ scale: 1.1 }}
                        className={`relative p-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                          isActive ? 'bg-brixia-primary/60' : 'hover:bg-white/10'
                        }`}
                        onClick={() => navigate(item.path)}
                        title={item.label}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1 bottom-1 w-1 rounded-r bg-brixia-secondary" />
                        )}
                        {Icon && (
                          <Icon
                            className={`w-5 h-5 relative ${isActive ? 'text-brixia-secondary' : 'text-white/60'}`}
                          />
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className={`flex-shrink-0 space-y-2 ${sidebarState === 'icons' ? 'flex flex-col items-center' : ''}`}>
              <button
                onClick={() => navigate('/settings')}
                className={`w-full flex items-center rounded-lg hover:bg-brixia-secondary/20 text-base text-brixia-secondary transition ${sidebarState === 'icons' ? 'justify-center p-2' : 'gap-2 px-3 py-2'}`}
                title="Impostazioni"
              >
                <Settings className="w-4 h-4 shrink-0" />
                {sidebarState === 'full' && <span>Impostazioni</span>}
              </button>
              <button
                onClick={handleLogout}
                className={`w-full flex items-center rounded-lg hover:bg-red-600/20 text-base text-red-300 transition ${sidebarState === 'icons' ? 'justify-center p-2' : 'gap-2 px-3 py-2'}`}
                title="Logout"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {sidebarState === 'full' && <span>Logout</span>}
              </button>
            </div>
        </>
      </div>

      {/* MAIN */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden min-h-0">
        <header className="sticky top-0 z-50 shrink-0 h-16 bg-brixia-primary text-white pl-8 pr-0 flex items-stretch justify-between border-b border-white/10">
          <div className="flex items-center gap-6 py-2">
            {(location.pathname === '/create-person' || location.pathname === '/category-activities' || location.pathname === '/council-management' || location.pathname === '/brand-customization' || location.pathname === '/users-management' || location.pathname === '/attendance' || fromEventsClubs || (location.pathname === '/events' && eventsFormOpen)) && (
              <button
                onClick={() => {
                  if (fromEventsClubs) {
                    navigate('/events?restoreDraft=1')
                  } else if (location.pathname === '/events' && eventsFormOpen) {
                    window.dispatchEvent(new CustomEvent(EVENTS_CLOSE_FORM))
                  } else if (location.pathname === '/attendance') {
                    navigate('/home')
                  } else if (location.pathname === '/create-person') {
                    const fromParam = searchParams.get('from')
                    navigate(fromParam && fromParam.startsWith('/') ? fromParam : '/people')
                  } else {
                    navigate(location.pathname === '/category-activities' ? '/activities' : '/settings')
                  }
                }}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                title={fromEventsClubs ? 'Torna all\'evento' : location.pathname === '/events' ? 'Torna agli eventi' : location.pathname === '/attendance' ? 'Torna alla Dashboard' : location.pathname === '/create-person' ? 'Torna ad Anagrafiche' : location.pathname === '/category-activities' ? 'Torna a Squadre' : 'Torna a Impostazioni'}
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2} />
              </button>
            )}
            <button
              onClick={cycleSidebar}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
              title={sidebarState === 'full' ? 'Solo icone' : 'Mostra etichette'}
            >
              <Menu className="w-6 h-6" strokeWidth={2} />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{headerTitle}</h1>
              {location.pathname === '/create-person' && (prevPersonId || nextPersonId) && (
                <div className="flex items-center gap-0">
                  {prevPersonId && (
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams(location.search)
                        params.set('edit', prevPersonId)
                        navigate(`/create-person?${params.toString()}`)
                      }}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                      title="Anagrafica precedente"
                    >
                      <ChevronLeft className="w-5 h-5" strokeWidth={2} />
                    </button>
                  )}
                  {nextPersonId && (
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams(location.search)
                        params.set('edit', nextPersonId)
                        navigate(`/create-person?${params.toString()}`)
                      }}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                      title="Anagrafica successiva"
                    >
                      <ChevronRight className="w-5 h-5" strokeWidth={2} />
                    </button>
                  )}
                </div>
              )}
              {location.pathname === '/home' && (
                <p className="text-sm text-white/80">{oggiCapitalized}</p>
              )}
            </div>
          </div>
          {location.pathname === '/events' && !eventsFormOpen && eventsHeaderStats && (
            <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 px-4 lg:flex">
              <EventsHeaderKpi label="Eventi" value={eventsHeaderStats.totalEvents} />
              <EventsHeaderKpi label="Partite" value={eventsHeaderStats.partite} />
              <EventsHeaderKpi label="Tornei" value={eventsHeaderStats.tornei} />
              <EventsHeaderKpi label="Consigli" value={eventsHeaderStats.consigli} />
            </div>
          )}
          <div className="flex items-stretch items-center gap-4 pr-6">
            {location.pathname === '/home' && (
              <span className="text-lg font-medium text-white/90 flex items-center self-center">Ciao, {firstName}</span>
            )}
            <img
              src={brandConfig.assets.logo?.trim() || '/brixia-logo.svg'}
              alt={brandConfig.assets.logoAlt || 'Logo'}
              className="h-10 w-auto object-contain opacity-95 self-center"
            />
            {location.pathname === '/activities' && (
              <div className="flex items-stretch gap-px">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-new-session'))}
                  className="h-16 w-16 flex items-center justify-center rounded-none bg-brixia-secondary hover:bg-brixia-secondary/90 text-white transition-colors shrink-0"
                  title="Nuova Sessione"
                >
                  <Dumbbell className="w-8 h-8" strokeWidth={2} />
                </button>
                <button
                  onClick={() => navigate('/events')}
                  className="h-16 w-16 flex items-center justify-center rounded-none bg-brixia-secondary hover:bg-brixia-secondary/90 text-white transition-colors shrink-0"
                  title="Gestione Eventi"
                >
                  <CalendarPlus className="w-8 h-8" strokeWidth={2} />
                </button>
              </div>
            )}
            {location.pathname === '/events' && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-create-event'))}
                className="h-16 w-16 flex items-center justify-center rounded-none bg-brixia-secondary hover:bg-brixia-secondary/90 text-white transition-colors shrink-0"
                title="Nuovo Evento"
              >
                <CalendarPlus className="w-8 h-8" strokeWidth={2} />
              </button>
            )}
            {location.pathname === '/people' && (
              <button
                onClick={() => navigate('/create-person')}
                className="h-16 w-16 flex items-center justify-center rounded-none bg-brixia-secondary hover:bg-brixia-secondary/90 text-white transition-colors shrink-0"
                title="Nuova Persona"
              >
                <UserPlus className="w-8 h-8" strokeWidth={2} />
              </button>
            )}
            {isEditingPerson && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-person-pdf-modal'))}
                className="h-16 w-16 flex items-center justify-center rounded-none bg-brixia-secondary hover:bg-brixia-secondary/90 text-white transition-colors shrink-0"
                title="Genera scheda PDF"
              >
                <FileText className="w-8 h-8" strokeWidth={2} />
              </button>
            )}
            {location.pathname === '/infortuni' && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-create-activity'))}
                className="h-16 w-16 flex items-center justify-center rounded-none bg-brixia-secondary hover:bg-brixia-secondary/90 text-white transition-colors shrink-0"
                title="Nuova attività"
              >
                <CalendarPlus className="w-8 h-8" strokeWidth={2} />
              </button>
            )}
            {location.pathname === '/resoconto-settimanale' && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('export-resoconto-pdf'))}
                className="h-16 w-16 flex items-center justify-center rounded-none bg-brixia-secondary hover:bg-brixia-secondary/90 text-white transition-colors shrink-0"
                title="Esporta PDF"
              >
                <FileDown className="w-8 h-8" strokeWidth={2} />
              </button>
            )}
            {location.pathname === '/council-management' && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-add-council-member'))}
                className="h-16 w-16 flex items-center justify-center rounded-none bg-brixia-secondary hover:bg-brixia-secondary/90 text-white transition-colors shrink-0"
                title="Aggiungi dirigente"
              >
                <UserPlus className="w-8 h-8" strokeWidth={2} />
              </button>
            )}
            {location.pathname === '/users-management' && (
              <button
                onClick={() => navigate('/create-person')}
                className="h-16 w-16 flex items-center justify-center rounded-none bg-brixia-secondary hover:bg-brixia-secondary/90 text-white transition-colors shrink-0"
                title="Crea nuovo utente"
              >
                <UserPlus className="w-8 h-8" strokeWidth={2} />
              </button>
            )}
            {location.pathname === '/fees' && feesQuoteTabActive && (
              <>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent(FEES_SET_VIEW_TABLE))}
                  className={`h-16 w-16 flex items-center justify-center shrink-0 transition-colors text-white ${feesViewMode === 'table' ? 'bg-brixia-secondary hover:bg-brixia-secondary/90' : 'bg-white/10 hover:bg-white/20'}`}
                  title="Tabella"
                >
                  <Table2 className="w-8 h-8" strokeWidth={2} />
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent(FEES_SET_VIEW_CARDS))}
                  className={`h-16 w-16 flex items-center justify-center shrink-0 transition-colors text-white ${feesViewMode === 'cards' ? 'bg-brixia-secondary hover:bg-brixia-secondary/90' : 'bg-white/10 hover:bg-white/20'}`}
                  title="Card"
                >
                  <LayoutGrid className="w-8 h-8" strokeWidth={2} />
                </button>
                {!feesReadOnly && (
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent(FEES_OPEN_CREATE_MODAL))}
                    className="h-16 w-16 flex items-center justify-center rounded-none bg-brixia-secondary hover:bg-brixia-secondary/90 text-white transition-colors shrink-0"
                    title="Nuova Quota"
                  >
                    <Plus className="w-8 h-8" strokeWidth={2} />
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        <div
          id="main-content-scroll"
          className="flex-1 min-w-0 min-h-0 overflow-auto scrollbar-hide"
          style={
            location.pathname === '/home'
              ? { backgroundColor: '#E3F2FC' }
              : location.pathname === '/attendance'
                ? { backgroundColor: '#0F172A' }
                : (location.pathname === '/people' || location.pathname === '/activities')
                  ? { backgroundColor: '#E3F2FC' }
                  : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  )
}
