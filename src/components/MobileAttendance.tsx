import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import QRCodeScanner from './QRCodeScanner'

interface MobileAttendanceProps {
  onClose: () => void
}

export default function MobileAttendance({ onClose }: MobileAttendanceProps) {
  const [activeSessions, setActiveSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [selectedSession, setSelectedSession] = useState<any>(null)

  // Carica le sessioni attive
  useEffect(() => {
    loadActiveSessions()
  }, [])

  const loadActiveSessions = async () => {
    try {
      setLoading(true)
      
      const today = new Date().toISOString().split('T')[0]
      
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select(`
          id,
          session_date,
          location,
          away_place,
          qr_active,
          start_time,
          end_time,
          categories (
            id,
            name,
            code
          )
        `)
        .eq('session_date', today)
        .eq('qr_active', true)
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Errore nel caricamento sessioni:', error)
        return
      }

      setActiveSessions(sessions || [])
    } catch (error) {
      console.error('Errore nel caricamento sessioni:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleScanSuccess = (data: any) => {
    setShowScanner(false)
    setSelectedSession(null)
    // Ricarica le sessioni per aggiornare i conteggi
    loadActiveSessions()
  }

  const formatTime = (time: string) => {
    if (!time) return ''
    return time.substring(0, 5)
  }

  const getLocationIcon = (location: string) => {
    if (location === 'Trasferta') return '🚌'
    return '🏟️'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento sessioni...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-white z-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Presenze Mobile</h1>
            <p className="text-blue-100 text-sm">Scegli una sessione per scansionare</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Contenuto */}
      <div className="p-4">
        {activeSessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📱</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessuna sessione attiva</h3>
            <p className="text-gray-600 mb-4">
              Non ci sono sessioni di allenamento attive al momento
            </p>
            <button
              onClick={loadActiveSessions}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Aggiorna
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Sessioni Attive ({activeSessions.length})
            </h2>
            
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">
                      {getLocationIcon(session.location)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {session.categories?.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {session.location}
                        {session.away_place && ` • ${session.away_place}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {formatTime(session.start_time)}
                      {session.end_time && ` - ${formatTime(session.end_time)}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      Oggi
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="mr-2">📊</span>
                    <span>Sessione attiva per QR</span>
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedSession(session)
                      setShowScanner(true)
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                  >
                    📱 Scansiona QR
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scanner QR */}
      {showScanner && selectedSession && (
        <QRCodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => {
            setShowScanner(false)
            setSelectedSession(null)
          }}
        />
      )}
    </div>
  )
}

