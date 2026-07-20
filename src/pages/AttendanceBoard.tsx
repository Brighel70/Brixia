import Header from '@/components/Header'
import AttendanceRow from '@/components/AttendanceRow'
import AttendanceRowEnhanced from '@/components/AttendanceRowEnhanced'
import QRCodeGenerator from '@/components/QRCodeGenerator'
import AttendanceOverview from '@/pages/AttendanceOverview'
import { useEffect, useState } from 'react'
import { useData } from '@/store/data'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

export type AttendanceBoardVariant = 'classic' | 'hybrid'

interface AttendanceBoardProps {
  variant?: AttendanceBoardVariant
  embedInLayout?: boolean
}

export default function AttendanceBoard({ variant = 'classic', embedInLayout = false }: AttendanceBoardProps) {
  const [searchParams] = useSearchParams()
  const { currentCategory, currentSession, loadPlayers, players, pickCategory, setCurrentSession } = useData()
  const [loading, setLoading] = useState(true)
  const [attendanceData, setAttendanceData] = useState<Record<string, any>>({})
  const [showQRGenerator, setShowQRGenerator] = useState(false)
  const [qrActive, setQrActive] = useState(false)
  const [attendanceStats, setAttendanceStats] = useState({
    total: 0,
    present: 0,
    qrScanned: 0,
    manual: 0
  })

  const isHybrid = variant === 'hybrid'

  useEffect(() => {
    const sessionId = searchParams.get('session')
    if (sessionId) {
      loadSessionAndCategory(sessionId)
    } else {
      setLoading(false)
    }
  }, [searchParams])

  const loadAttendanceData = async (sessionId: string) => {
    try {
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select(`
          *,
          players!inner(id, first_name, last_name)
        `)
        .eq('session_id', sessionId)

      if (error) {
        console.error('Errore nel caricamento presenze:', error)
        return
      }

      const attendanceMap: Record<string, any> = {}
      let total = 0
      let present = 0
      let qrScanned = 0
      let manual = 0

      attendance?.forEach(att => {
        attendanceMap[att.players.id] = att
        total++
        if (att.status === 'PRESENTE') present++
        if (att.scanned_at) qrScanned++
        if (!att.scanned_at) manual++
      })

      setAttendanceData(attendanceMap)
      setAttendanceStats({ total, present, qrScanned, manual })
    } catch (error) {
      console.error('Errore nel caricamento presenze:', error)
    }
  }

  const loadSessionAndCategory = async (sessionId: string) => {
    try {
      const selectFields = isHybrid
        ? `id, session_date, location, away_place, qr_active, categories!inner(id, code, name)`
        : `id, session_date, location, away_place, categories!inner(id, code, name)`

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(selectFields)
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        console.error('Errore nel caricamento sessione:', sessionError)
        setLoading(false)
        return
      }

      // Type cast sessionData to include categories array
      const sessionWithCategories = sessionData as any
      const categoryArray = sessionWithCategories.categories as { id: string; code: string; name: string }[]
      const category = Array.isArray(categoryArray) ? categoryArray[0] : categoryArray
      pickCategory(category as any)
      setCurrentSession(sessionWithCategories)
      if (isHybrid) {
        setQrActive(sessionWithCategories.qr_active || false)
      }

      await loadPlayers(category.id)
      if (isHybrid) {
        await loadAttendanceData(sessionId)
      }
    } catch (error) {
      console.error('Errore nel caricamento:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleQRActive = async () => {
    if (!currentSession) return
    try {
      const newQRActive = !qrActive
      const { error } = await supabase
        .from('sessions')
        .update({ qr_active: newQRActive })
        .eq('id', currentSession.id)
      if (error) {
        console.error('Errore nel toggle QR:', error)
        return
      }
      setQrActive(newQRActive)
      if (newQRActive) setShowQRGenerator(true)
    } catch (error) {
      console.error('Errore nel toggle QR:', error)
    }
  }

  if (loading) {
    return (
      <div className={embedInLayout ? 'min-h-full' : ''}>
        {!embedInLayout && <Header title="Presenze" />}
        <div className="p-4 text-center">
          <div className="text-lg">Caricamento giocatori...</div>
        </div>
      </div>
    )
  }

  const sessionId = searchParams.get('session')
  if (!sessionId) {
    return <AttendanceOverview embedInLayout={embedInLayout} />
  }
  if (!currentSession || !currentCategory) {
    return (
      <div className={embedInLayout ? 'min-h-full' : ''}>
        {!embedInLayout && <Header title="Presenze" />}
        <div className="p-4 text-center">
          <div className="text-lg text-red-600 mb-4">Sessione non trovata</div>
          <p className="text-gray-600">La sessione richiesta non esiste o non è accessibile</p>
        </div>
      </div>
    )
  }

  if (isHybrid) {
    return (
      <div className={embedInLayout ? 'min-h-full' : ''}>
        {!embedInLayout && <Header title={`Presenze – ${currentCategory.code}`} />}
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{attendanceStats.total}</div>
              <div className="text-sm text-gray-600">Totali</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{attendanceStats.present}</div>
              <div className="text-sm text-gray-600">Presenti</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{attendanceStats.qrScanned}</div>
              <div className="text-sm text-gray-600">QR Scansioni</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{attendanceStats.manual}</div>
              <div className="text-sm text-gray-600">Manuali</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleQRActive}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  qrActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {qrActive ? '🛑 Disattiva QR' : '📱 Attiva QR'}
              </button>
              {qrActive && (
                <button
                  onClick={() => setShowQRGenerator(true)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                >
                  📱 Mostra QR Code
                </button>
              )}
            </div>
            <div className="text-sm text-gray-600">
              {qrActive ? <span className="text-green-600 font-medium">✅ QR Attivo</span> : <span className="text-gray-500">❌ QR Disattivo</span>}
            </div>
          </div>
        </div>
        <div className="p-2">
          <div className="card p-0 overflow-hidden">
            <div className="max-h-[60vh] overflow-auto divide-y divide-white/50">
              {players.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-2xl mb-2">👥</div>
                  <p>Nessun giocatore trovato per questa categoria</p>
                </div>
              ) : (
                players.map(player => (
                  <AttendanceRowEnhanced
                    key={player.id}
                    player={player as any}
                    sessionId={currentSession.id}
                    attendanceData={attendanceData[player.id]}
                  />
                ))
              )}
            </div>
          </div>
        </div>
        {showQRGenerator && currentSession && (
          <QRCodeGenerator
            sessionId={currentSession.id}
            categoryName={(currentCategory as any).name || currentCategory.code}
            onClose={() => setShowQRGenerator(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className={embedInLayout ? 'min-h-full' : ''}>
      {!embedInLayout && <Header title={`Presenze – ${currentCategory.code}`} />}
      <div className="p-2">
        <div className="card p-0 overflow-hidden">
          <div className="max-h-[70vh] overflow-auto divide-y divide-white/50">
            {players.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-2xl mb-2">👥</div>
                <p>Nessun giocatore trovato per questa categoria</p>
              </div>
            ) : (
              players.map(p => <AttendanceRow key={p.id} player={p as any} sessionId={currentSession.id} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
