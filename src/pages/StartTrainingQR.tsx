import Header from '@/components/Header'
import { useState, useEffect } from 'react'
import { useData } from '@/store/data'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import QRCodeGenerator from '@/components/QRCodeGenerator'
import MobileAttendance from '@/components/MobileAttendance'
import TrainingVenueSelect from '@/components/TrainingVenueSelect'
import { useTrainingVenues } from '@/hooks/useTrainingVenues'

interface Category {
  id: string
  code: string
  name: string
}

export default function StartTrainingQR() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { startSession, pickCategory } = useData()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const { requiresAwayDetail, scheduleVenues } = useTrainingVenues()
  const [location, setLocation] = useState('')
  const [away, setAway] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showQRGenerator, setShowQRGenerator] = useState(false)
  const [showMobileAttendance, setShowMobileAttendance] = useState(false)
  const [sessionCreated, setSessionCreated] = useState(false)

  useEffect(() => {
    if (!location && scheduleVenues[0]?.name) {
      setLocation(scheduleVenues[0].name)
    }
  }, [scheduleVenues, location])

  useEffect(() => {
    const categoryCode = searchParams.get('category')
    if (categoryCode) {
      loadCategory(categoryCode)
    } else {
      setLoading(false)
    }
  }, [searchParams])

  const loadCategory = async (categoryCode: string) => {
    try {
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, code, name')
        .eq('code', categoryCode)
        .single()

      if (categoryError) {
        throw new Error(`Categoria ${categoryCode} non trovata nel database`)
      }

      setCategory(categoryData)
      pickCategory(categoryData)
    } catch (error) {
      console.error('Errore nel caricamento categoria:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartSession = async () => {
    try {
      if (!category) return

      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('code', category.code)
        .single()

      if (categoryError) {
        console.error('Errore nel trovare categoria:', categoryError)
        alert('Errore nel trovare la categoria')
        return
      }

      const { data, error } = await supabase
        .from('sessions')
        .insert([
          {
            category_id: categoryData.id,
            session_date: date,
            location: location,
            away_place: location === 'Trasferta' ? away : null,
            qr_active: false // Inizialmente disattivato
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Errore nel salvataggio sessione:', error)
        alert('Errore nel salvataggio della sessione')
        return
      }

      setSessionId(data.id)
      setSessionCreated(true)
      
    } catch (error) {
      console.error('Errore nell\'avvio sessione:', error)
      alert('Errore nell\'avvio della sessione')
    }
  }

  const handleQRGenerated = () => {
    // Dopo aver generato il QR, vai alla pagina presenze
    navigate(`/board?session=${sessionId}`)
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-lg">Caricamento categoria...</div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="p-4 text-center">
        <div className="text-lg text-red-600 mb-4">Nessuna categoria selezionata.</div>
        <button 
          onClick={() => navigate('/activities')}
          className="btn bg-sky text-white px-6 py-3"
        >
          Torna alle Attività
        </button>
      </div>
    )
  }

  return (
    <div>
      <Header title={`Nuova sessione – ${category.code}`} showBack={true} />
      <div className="p-4">
        <div className="card p-6 grid gap-4">
          <div className="text-center mb-4">
            <h2 className="text-3xl font-bold text-navy">Inizia Nuova Sessione</h2>
            <p className="text-gray-600">Categoria: {category.code} - {category.name}</p>
          </div>
          
          {!sessionCreated ? (
            // Form per creare la sessione
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location <span className="text-red-500">*</span></label>
                <TrainingVenueSelect
                  value={location}
                  onChange={setLocation}
                />
              </div>

              {requiresAwayDetail(location) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Luogo Trasferta</label>
                  <input
                    type="text"
                    value={away}
                    onChange={(e) => setAway(e.target.value)}
                    placeholder="Es. Milano, Roma..."
                    className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleStartSession}
                  className="flex-1 bg-sky text-white px-6 py-3 rounded-2xl font-medium hover:bg-sky-600 transition-colors"
                >
                  Crea Sessione
                </button>
                <button
                  onClick={() => navigate('/activities')}
                  className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-2xl font-medium hover:bg-gray-600 transition-colors"
                >
                  Annulla
                </button>
              </div>
            </>
          ) : (
            // Opzioni dopo aver creato la sessione
            <div className="text-center space-y-6">
              <div className="text-green-600 text-lg font-medium">
                ✅ Sessione creata con successo!
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Opzione QR Code */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <div className="text-4xl mb-3">📱</div>
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Sistema QR Code</h3>
                  <p className="text-sm text-blue-700 mb-4">
                    Genera un QR code che i giocatori possono scansionare per registrare automaticamente la presenza
                  </p>
                  <button
                    onClick={() => setShowQRGenerator(true)}
                    className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Genera QR Code
                  </button>
                </div>

                {/* Opzione Presenze Manuali */}
                <div className="bg-green-50 rounded-lg p-6">
                  <div className="text-4xl mb-3">✋</div>
                  <h3 className="text-lg font-semibold text-green-900 mb-2">Presenze Manuali</h3>
                  <p className="text-sm text-green-700 mb-4">
                    Gestisci le presenze manualmente come sempre, con l'interfaccia tradizionale
                  </p>
                  <button
                    onClick={() => navigate(`/board?session=${sessionId}`)}
                    className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Presenze Manuali
                  </button>
                </div>
              </div>

              {/* Opzione Mobile per Giocatori */}
              <div className="bg-purple-50 rounded-lg p-6">
                <div className="text-4xl mb-3">📲</div>
                <h3 className="text-lg font-semibold text-purple-900 mb-2">Interfaccia Mobile</h3>
                <p className="text-sm text-purple-700 mb-4">
                  Apri l'interfaccia mobile per i giocatori che vogliono scansionare il QR
                </p>
                <button
                  onClick={() => setShowMobileAttendance(true)}
                  className="w-full bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
                >
                  Apri Mobile
                </button>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => {
                    setSessionCreated(false)
                    setSessionId(null)
                  }}
                  className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-2xl font-medium hover:bg-gray-600 transition-colors"
                >
                  Crea Nuova Sessione
                </button>
                <button
                  onClick={() => navigate('/activities')}
                  className="flex-1 bg-sky text-white px-6 py-3 rounded-2xl font-medium hover:bg-sky-600 transition-colors"
                >
                  Torna alle Attività
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Generator Modal */}
      {showQRGenerator && sessionId && (
        <QRCodeGenerator
          sessionId={sessionId}
          categoryName={category.name}
          onClose={() => {
            setShowQRGenerator(false)
            handleQRGenerated()
          }}
        />
      )}

      {/* Mobile Attendance Modal */}
      {showMobileAttendance && (
        <MobileAttendance
          onClose={() => setShowMobileAttendance(false)}
        />
      )}
    </div>
  )
}

