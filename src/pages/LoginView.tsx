import Header from '@/components/Header'
import { useAuth } from '@/store/auth'
import { useState } from 'react'
import { getBrandConfig, getBrandClasses } from '@/config/brand'

export default function LoginView(){
  const { signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showError, setShowError] = useState(false)
  const brandConfig = getBrandConfig()

  // Valida se i campi sono compilati
  const isFormValid = email.trim() !== '' && password.trim() !== ''

  const handleLogin = async () => {
    if (!isFormValid) return
    
    setError('')
    setShowError(false)
    
    try {
      await signIn(email, password)
      // Il redirect è gestito da AuthLayout
    } catch (error: any) {
      console.error('Errore durante il login:', error)
      
      // Gestione errori specifici di Supabase
      let errorMessage = 'Errore durante il login'
      
      if (error?.message) {
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = '❌ Email o password non corretti'
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = '❌ Email non confermata. Controlla la tua casella email'
        } else if (error.message.includes('Too many requests')) {
          errorMessage = '❌ Troppi tentativi. Riprova tra qualche minuto'
        } else if (error.message.includes('User not found')) {
          errorMessage = '❌ Utente non trovato'
        } else {
          errorMessage = `❌ ${error.message}`
        }
      }
      
      setError(errorMessage)
      setShowError(true)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isFormValid) {
      handleLogin()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brixia-accent to-white">
      <Header title={`${brandConfig.clubName} - Login`} />
      
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className={`${getBrandClasses().card} p-8 max-w-md w-full`}>
          {/* Logo e titolo */}
          <div className="text-center mb-8">
            <img 
              src={brandConfig.assets.logo} 
              alt={brandConfig.assets.logoAlt}
              className="w-20 h-20 mx-auto mb-4"
            />
            <h2 className="text-2xl font-bold text-brixia-primary mb-2">
              Benvenuto in {brandConfig.clubShortName}
            </h2>
            <p className="text-gray-600 text-sm">
              Accedi per gestire presenze e allenamenti
            </p>
          </div>

          {/* Form di login */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input 
                className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-brixia-secondary focus:border-transparent transition-all" 
                placeholder="La tua email" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                type="email"
                autoComplete="email"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input 
                className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-brixia-secondary focus:border-transparent transition-all" 
                type="password" 
                placeholder="La tua password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                autoComplete="current-password"
              />
            </div>
            
            <button 
              disabled={loading || !isFormValid} 
              onClick={handleLogin} 
              className={`w-full p-3 rounded-2xl font-semibold text-white transition-all duration-200 ${
                isFormValid 
                  ? 'bg-gradient-to-r from-brixia-primary to-brixia-secondary hover:from-brixia-primary/90 hover:to-brixia-secondary/90 cursor-pointer shadow-brixia' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? 'Caricamento...' : 'Accedi'}
            </button>
          </div>

          {/* Informazioni club */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              {brandConfig.clubDescription}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Stagione {brandConfig.season}
            </p>
          </div>
        </div>

        {/* Popup di Errore */}
        {showError && error && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-4">
              <div className="text-center">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Errore di Login
                </h3>
                <p className="text-gray-600 mb-6 whitespace-pre-line">
                  {error}
                </p>
                <button
                  onClick={() => setShowError(false)}
                  className="btn bg-brixia-primary text-white px-6 py-2 hover:bg-brixia-primary/90"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}