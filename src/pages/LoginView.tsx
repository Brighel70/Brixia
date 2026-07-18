import { useAuth } from '@/store/auth'
import { useState } from 'react'
import { getBrandConfig } from '@/config/brand'
import logoBrixiaLogin from '@/assets/logo-brixia-login.png'

/** Logo della società: sempre l’immagine ufficiale da public/logo bianco e celeste.png */
function BrixiaLogoInline({ className = 'w-48 h-48' }: { className?: string }) {
  return (
    <img
      src={logoBrixiaLogin}
      alt="Logo Brixia Rugby"
      className={className}
    />
  )
}

export default function LoginView() {
  const { signInWithTeamFlowCode, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [showError, setShowError] = useState(false)
  const brandConfig = getBrandConfig()

  const isFormValid = email.trim() !== '' && code.trim() !== ''

  const handleLogin = async () => {
    if (!isFormValid) return
    setError('')
    setShowError(false)
    try {
      await signInWithTeamFlowCode(email, code)
    } catch (error: any) {
      console.error('Errore durante il login:', error)
      let errorMessage = 'Errore durante il login'
      if (error?.message) {
        if (error.message.includes('Invalid login credentials') || error.message.includes('non corretti')) {
          errorMessage = error.message.includes('codice TeamFlow') ? error.message : '❌ Email o codice TeamFlow non corretti'
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
    if (e.key === 'Enter' && isFormValid) handleLogin()
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left: brand + logo (desktop) */}
      <div className="hidden md:flex md:w-[44%] min-h-screen bg-gradient-to-br from-brixia-primary via-brixia-primary to-brixia-secondary/90 flex-col justify-center items-center p-12 text-white">
        <div className="max-w-sm w-full text-center">
          <div className="w-48 h-48 mx-auto flex items-center justify-center shrink-0 drop-shadow-2xl">
            <BrixiaLogoInline className="w-full h-full object-contain" />
          </div>
          <p className="mt-8 text-white/90 text-lg">
            La piattaforma per gestire la tua società: atleti, eventi, quote e attività in un unico strumento
          </p>
          <p className="mt-6 text-white/70 text-sm">
            Stagione {brandConfig.season}
          </p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 min-h-screen flex flex-col justify-center md:justify-center bg-gray-50/95 md:bg-white p-6 md:p-12">
        {/* Logo solo su mobile */}
        <div className="md:hidden flex flex-col items-center mb-8">
          <BrixiaLogoInline className="w-28 h-28 object-contain" />
        </div>

        <div className="max-w-md w-full mx-auto">
          <div className="md:mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Benvenuto
            </h2>
            <p className="mt-1 text-gray-500">
              Inserisci email e codice per accedere
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email
              </label>
              <input
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brixia-primary/30 focus:border-brixia-primary transition-all"
                placeholder="email@esempio.it"
                value={email}
                onChange={e => setEmail(e.target.value.toLowerCase())}
                onKeyDown={handleKeyPress}
                type="email"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Codice TeamFlow
              </label>
              <input
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brixia-primary/30 focus:border-brixia-primary transition-all font-mono text-base"
                type="text"
                placeholder="Incolla il codice dalla scheda persona"
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={handleKeyPress}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Dalla sezione «Codice accesso TeamFlow» (tab TeamFlow/Flowme), non il Codice Flowme.
              </p>
            </div>

            <button
              disabled={loading || !isFormValid}
              onClick={handleLogin}
              className={`w-full py-3.5 rounded-xl font-semibold text-white text-base transition-all duration-200 ${
                isFormValid
                  ? 'bg-brixia-primary hover:bg-brixia-primary/90 shadow-lg hover:shadow-xl cursor-pointer'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-gray-400">
            {brandConfig.clubDescription} · Stagione {brandConfig.season}
          </p>
        </div>
      </div>

      {/* Modal errore */}
      {showError && error && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowError(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-2xl mb-4">
              ⚠️
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Errore di accesso
            </h3>
            <p className="text-gray-600 text-sm mb-6 whitespace-pre-line">
              {error}
            </p>
            <button
              onClick={() => setShowError(false)}
              className="w-full py-3 rounded-xl bg-brixia-primary text-white font-semibold hover:bg-brixia-primary/90"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
