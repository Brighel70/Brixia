import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { useNavigate } from 'react-router-dom'
import { useEmailConfirmation } from '@/hooks/useEmailConfirmation'

interface AuthLayoutProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export default function AuthLayout({ children, requireAuth = false }: AuthLayoutProps) {
  const { userId, profile, initializeAuth } = useAuth()
  const [isInitialized, setIsInitialized] = useState(false)
  const navigate = useNavigate()
  
  // Gestisce automaticamente la conferma email e creazione profilo
  useEmailConfirmation()

  // Inizializza l'autenticazione una sola volta
  useEffect(() => {
    const init = async () => {
      await initializeAuth()
      setIsInitialized(true)
    }
    init()
  }, [initializeAuth])

  // Se richiede autenticazione e non è loggato, redirect al login
  useEffect(() => {
    if (isInitialized && requireAuth && !userId) {
      navigate('/')
    }
  }, [isInitialized, requireAuth, userId, navigate])

  // Se è loggato e sta nella pagina login, redirect alla Home
  useEffect(() => {
    if (isInitialized && userId && window.location.pathname === '/') {
      navigate('/home')
    }
  }, [isInitialized, userId, navigate])

  // Mostra loading durante l'inizializzazione
  if (!isInitialized || (requireAuth && !userId)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Caricamento...</div>
      </div>
    )
  }

  return <>{children}</>
}
