import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { getBrandConfig } from '@/config/brand'

interface HeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  rightButton?: React.ReactNode
}

export default function Header({ title, subtitle, showBack = false, rightButton }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()
  const brandConfig = getBrandConfig()

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  // Mostra il pulsante Logout solo nella dashboard e home
  const showLogout = location.pathname === '/dashboard' || location.pathname === '/home'

  return (
    <header className="bg-gradient-to-r from-brixia-primary to-brixia-secondary text-white shadow-brixia">
      <div className="max-w-6xl mx-auto p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
        {showBack && (
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 rounded-full hover:bg-white/20 transition"
            title="Indietro"
          >
            ←
          </button>
        )}
        <div className="flex items-center gap-3">
          <img 
            src={brandConfig.assets.logo} 
            alt={brandConfig.assets.logoAlt}
            className="w-40 h-auto object-contain"
          />
          <div>
            <h1 className="text-4xl font-bold">{title}</h1>
            {subtitle && (
              <p className="text-sm text-white/90 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      
      {rightButton ? (
        rightButton
      ) : showLogout ? (
        <button 
          onClick={handleLogout}
          className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
          title="Logout"
        >
          Logout
        </button>
      ) : null}
      </div>
    </header>
  )
}
