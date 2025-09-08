import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { getBrandConfig } from '@/config/brand'

interface HeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  showSettings?: boolean
  rightButton?: React.ReactNode
}

export default function Header({ title, subtitle, showBack = false, showSettings = false, rightButton }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()
  const brandConfig = getBrandConfig()

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  const handleBack = () => {
    // Se c'è una cronologia, vai indietro
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      // Altrimenti vai alla home
      navigate('/home')
    }
  }

  const handleLogoClick = () => {
    navigate('/home')
  }

  // Mostra il pulsante Logout solo nella dashboard e home
  const showLogout = location.pathname === '/dashboard' || location.pathname === '/home'

  return (
    <header className="bg-gradient-to-r from-brixia-primary to-brixia-secondary text-white shadow-brixia">
      <div className="max-w-6xl mx-auto p-4 flex items-center justify-between">
        {/* Left side - Back button */}
        <div className="flex items-center">
          {showBack && (
            <button 
              onClick={handleBack} 
              className="p-4 rounded-full bg-blue-200/30 hover:bg-blue-200/50 transition"
              title="Indietro"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Center - Title */}
        <div className="flex-1 flex justify-center">
          {title && (
            <div>
              <h1 className="text-4xl font-bold">{title}</h1>
              {subtitle && (
                <p className="text-sm text-white/90 mt-1">{subtitle}</p>
              )}
            </div>
          )}
        </div>
        
        {/* Right side - Logo, Settings icon and Logout */}
        <div className="flex items-center gap-3">
          {/* Logo Brixia - ridotto quando c'è rightButton */}
          <img 
            src={brandConfig.assets.logo} 
            alt={brandConfig.assets.logoAlt}
            className={`h-auto object-contain cursor-pointer hover:opacity-80 transition-opacity ${rightButton ? 'w-20' : 'w-32'}`}
            onClick={handleLogoClick}
            title="Torna alla Home"
          />
          
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
        </div>
      </div>
    </header>
  )
}
