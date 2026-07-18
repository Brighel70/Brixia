import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface QRCodeGeneratorProps {
  sessionId: string
  categoryName: string
  onClose: () => void
}

export default function QRCodeGenerator({ sessionId, categoryName, onClose }: QRCodeGeneratorProps) {
  const [qrData, setQrData] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [attendanceCount, setAttendanceCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // Genera i dati QR per la sessione
  useEffect(() => {
    const generateQRData = () => {
      const data = {
        sessionId,
        timestamp: new Date().toISOString(),
        type: 'attendance',
        category: categoryName
      }
      return JSON.stringify(data)
    }

    setQrData(generateQRData())
  }, [sessionId, categoryName])

  // Attiva/disattiva la sessione QR
  const toggleSession = async () => {
    setLoading(true)
    try {
      if (isActive) {
        // Disattiva la sessione
        await supabase
          .from('sessions')
          .update({ qr_active: false })
          .eq('id', sessionId)
        setIsActive(false)
      } else {
        // Attiva la sessione
        await supabase
          .from('sessions')
          .update({ qr_active: true })
          .eq('id', sessionId)
        setIsActive(true)
      }
    } catch (error) {
      console.error('Errore nel toggle sessione:', error)
    } finally {
      setLoading(false)
    }
  }

  // Carica il conteggio presenze in tempo reale
  useEffect(() => {
    if (!isActive) return

    const loadAttendanceCount = async () => {
      try {
        const { count } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId)
          .eq('status', 'present')

        setAttendanceCount(count || 0)
      } catch (error) {
        console.error('Errore nel caricamento presenze:', error)
      }
    }

    // Carica inizialmente
    loadAttendanceCount()

    // Aggiorna ogni 5 secondi
    const interval = setInterval(loadAttendanceCount, 5000)

    return () => clearInterval(interval)
  }, [sessionId, isActive])

  // Genera QR Code usando una libreria semplice (senza dipendenze esterne)
  const generateQRCode = (text: string) => {
    // Per ora usiamo un placeholder - in produzione useremo una libreria QR
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="white"/>
        <text x="100" y="100" text-anchor="middle" font-family="monospace" font-size="12" fill="black">
          QR Code
        </text>
        <text x="100" y="120" text-anchor="middle" font-family="monospace" font-size="8" fill="black">
          ${text.substring(0, 20)}...
        </text>
      </svg>
    `)}`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">QR Code Presenze</h3>
            <p className="text-sm text-gray-600">{categoryName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        <div className="text-center mb-6">
          <div className="inline-block p-4 bg-gray-50 rounded-lg">
            <img 
              src={generateQRCode(qrData)} 
              alt="QR Code"
              className="w-48 h-48 mx-auto"
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            I giocatori scansionano questo QR per segnare la presenza
          </p>
        </div>

        {/* Controlli sessione */}
        <div className="space-y-4">
          <button
            onClick={toggleSession}
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isActive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Caricamento...' : isActive ? '🛑 Disattiva Sessione' : '▶️ Attiva Sessione'}
          </button>

          {/* Statistiche in tempo reale */}
          {isActive && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">Presenze registrate:</span>
                <span className="text-2xl font-bold text-blue-600">{attendanceCount}</span>
              </div>
              <div className="mt-2 text-xs text-blue-700">
                Aggiornamento automatico ogni 5 secondi
              </div>
            </div>
          )}

          {/* Istruzioni */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Come funziona:</h4>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. Clicca "Attiva Sessione"</li>
              <li>2. I giocatori scansionano il QR con il telefono</li>
              <li>3. Le presenze si registrano automaticamente</li>
              <li>4. Monitora il conteggio in tempo reale</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

