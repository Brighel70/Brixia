import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { getBrandConfig } from '@/config/brand'

interface HeaderProps {
  title: string
  subtitle?: string
  badges?: React.ReactNode
  showBack?: boolean
  showSettings?: boolean
  rightButton?: React.ReactNode
  /** Nasconde il logo centrale (es. nella scheda persona) */
  hideCenterLogo?: boolean
  /** Nasconde il logo a destra (società) */
  hideRightLogo?: boolean
}

export default function Header({ title, subtitle, badges, showBack = false, showSettings = false, rightButton, hideCenterLogo = false, hideRightLogo = false }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut, profile } = useAuth()
  const firstName = profile?.first_name || (profile?.full_name?.trim().split(/\s+/)[0] || '')
  const [, setTick] = useState(0)
  const brandConfig = getBrandConfig()

  // Rileggi la config quando viene salvata da Personalizzazione Brand
  useEffect(() => {
    const onBrandUpdated = () => setTick((t) => t + 1)
    window.addEventListener('brand-config-updated', onBrandUpdated)
    return () => window.removeEventListener('brand-config-updated', onBrandUpdated)
  }, [])

  const handleLogout = async () => {
    if (!window.confirm('Sei sicuro di voler uscire?')) return
    await signOut()
    navigate('/')
  }

  const handleBack = () => {
    // Leggi il parametro "from" dall'URL corrente
    const urlParams = new URLSearchParams(window.location.search)
    const fromParam = urlParams.get('from')
    
    // Se viene dalla pagina assegnazioni, torna lì con il tab corretto
    if (fromParam === 'assignments') {
      window.location.href = '/fees#assignments'
      return
    }
    
    // Controlla se la pagina precedente era un tutor
    const referrer = document.referrer
    const isFromTutor = referrer.includes('tutor=true') || referrer.includes('tab=tutor')
    
    // Se viene dal tutor, vai alla homepage delle persone
    if (isFromTutor) {
      navigate('/people')
    } else if (window.history.length > 1) {
      // Altrimenti vai indietro normalmente
      navigate(-1)
    } else {
      // Se non c'è cronologia, vai alla home
      navigate('/home')
    }
  }

  const handleLogoClick = () => {
    navigate('/home')
  }

  // Mostra il pulsante Logout solo nella dashboard e home
  const showLogout = location.pathname === '/dashboard' || location.pathname === '/home'
  const isHome = location.pathname === '/home'

  const logoImg = (
    <img 
      src={brandConfig.assets.logo} 
      alt={brandConfig.assets.logoAlt}
      className={`h-auto object-contain cursor-pointer hover:opacity-80 transition-opacity ${rightButton ? 'w-20' : 'w-32'}`}
      onClick={handleLogoClick}
      title="Torna alla Home"
    />
  )

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 bg-brand-primary text-white shadow-brand">
      <div className="max-w-6xl mx-auto p-4 flex items-center justify-between">
        {/* Left side - Logo (solo home) e Pulsante Indietro */}
        <div className="flex items-center gap-3">
          {isHome && logoImg}
          {showBack && (
            <button 
              onClick={handleBack} 
              className="p-2.5 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors"
              title="Indietro"
            >
              <ChevronLeft className="w-6 h-6" strokeWidth={2} />
            </button>
          )}
        </div>
        
        {/* Center - Titolo (logo TeamFlow rimosso) */}
        <div className="flex-1 flex justify-center items-center">
          <div className="text-center flex flex-col items-center justify-center">
            {title && (
              <>
                <h1 className="text-6xl font-bold leading-none">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-white/90 mt-1">{subtitle}</p>
                )}
                {badges && (
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {badges}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Right side - Settings, Logout, Ciao Nome e Logo */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            {/* Settings icon - solo se showSettings è true */}
            {showSettings && (
              <button 
                onClick={() => navigate('/settings')}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors text-xl"
                title="Impostazioni"
              >
                ⚙️
              </button>
            )}
            
            {/* Right Button - sempre visibile se fornito */}
            {rightButton}
            
            {/* Logout button - solo se non c'è rightButton */}
            {!rightButton && showLogout && (
              <button 
                onClick={handleLogout}
                className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
                title="Logout"
              >
                Logout
              </button>
            )}
            {/* Logo società a destra */}
            {!hideRightLogo && (
              <img
                src={brandConfig.assets.logo}
                alt={brandConfig.assets.logoAlt}
                className="h-12 w-auto object-contain opacity-95"
              />
            )}
          </div>
          {/* Ciao [nome] - mostrato solo nell'header della dashboard */}
        </div>
      </div>
    </header>
    {/* Spacer per evitare che il contenuto finisca sotto l'header fisso */}
    <div className="h-32 shrink-0" aria-hidden="true" />
    </>
  )
}
