import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface QRCodeScannerProps {
  onScanSuccess: (data: any) => void
  onClose: () => void
}

export default function QRCodeScanner({ onScanSuccess, onClose }: QRCodeScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Simula la scansione QR (in produzione useremo una libreria reale)
  const handleScan = async (qrData: string) => {
    try {
      setScanning(true)
      setError('')
      setSuccess('')

      // Parse dei dati QR
      const data = JSON.parse(qrData)
      
      // Validazione dati
      if (!data.sessionId || !data.type || data.type !== 'attendance') {
        throw new Error('QR Code non valido')
      }

      // Verifica che la sessione sia attiva
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, qr_active, categories(name)')
        .eq('id', data.sessionId)
        .single()

      if (sessionError || !session) {
        throw new Error('Sessione non trovata')
      }

      if (!session.qr_active) {
        throw new Error('Sessione non attiva')
      }

      // Ottieni l'utente corrente
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Utente non autenticato')
      }

      // Trova il profilo dell'utente
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, person_id')
        .eq('id', user.id)
        .single()

      if (!profile || !profile.person_id) {
        throw new Error('Profilo utente non trovato')
      }

      // Verifica se l'utente è un giocatore
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('person_id', profile.person_id)
        .single()

      if (!player) {
        throw new Error('Utente non è un giocatore')
      }

      // Controlla se la presenza è già stata registrata
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('session_id', data.sessionId)
        .eq('player_id', player.id)
        .single()

      if (existingAttendance) {
        throw new Error('Presenza già registrata')
      }

      // Registra la presenza
      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          session_id: data.sessionId,
          player_id: player.id,
          status: 'PRESENTE',
          created_at: new Date().toISOString()
        })

      if (attendanceError) {
        throw new Error('Errore nel registrare la presenza')
      }

      setSuccess(`Presenza registrata per ${session.categories?.name}!`)
      
      // Notifica il successo al componente padre
      onScanSuccess({
        sessionId: data.sessionId,
        playerId: player.id,
        categoryName: session.categories?.name
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setScanning(false)
    }
  }

  // Simula la scansione QR (in produzione useremo una libreria reale)
  const simulateQRScan = () => {
    // Per ora simuliamo con un input - in produzione useremo la camera
    const qrData = prompt('Incolla qui il contenuto del QR Code:')
    if (qrData) {
      handleScan(qrData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Scanner QR Code</h3>
            <p className="text-sm text-gray-600">Scansiona il QR per registrare la presenza</p>
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

        {/* Area scanner */}
        <div className="text-center mb-6">
          <div className="w-64 h-64 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-4">
            {scanning ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Scansione in corso...</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-2">📱</div>
                <p className="text-sm text-gray-600">Scanner QR Code</p>
              </div>
            )}
          </div>

          <button
            onClick={simulateQRScan}
            disabled={scanning}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {scanning ? 'Scansione...' : 'Simula Scansione QR'}
          </button>
        </div>

        {/* Messaggi di stato */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div className="text-red-500 mr-2">❌</div>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div className="text-green-500 mr-2">✅</div>
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          </div>
        )}

        {/* Istruzioni */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Come scansionare:</h4>
          <ol className="text-sm text-gray-600 space-y-1">
            <li>1. Posiziona il QR code nell'area scanner</li>
            <li>2. Attendi la conferma di scansione</li>
            <li>3. La presenza verrà registrata automaticamente</li>
            <li>4. Riceverai una conferma</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
