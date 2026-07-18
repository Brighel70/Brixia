import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { validateMatchEventMinute, getLatestMatchEventMinute } from '@/lib/matchStatsChronology'

const statsFormFieldClass =
  'px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light]'

interface OpponentStatsModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
  opponentName: string
  matchListId: string
  eventId?: string | null
  existingStats?: any
}

export default function OpponentStatsModal({
  isOpen,
  onClose,
  onUpdate,
  opponentName,
  matchListId,
  eventId,
  existingStats
}: OpponentStatsModalProps) {
  const [stats, setStats] = useState({
    tries: 0,
    try_minutes: [] as number[],
    conversions: 0,
    conversion_minutes: [] as number[],
    drop_goals: 0,
    drop_goal_minutes: [] as number[],
    yellow_cards: 0,
    yellow_card_minutes: [] as number[],
    red_cards: 0,
    red_card_minutes: [] as number[]
  })
  const [showMinuteInput, setShowMinuteInput] = useState<{
    type: 'try' | 'conversion' | 'drop_goal' | 'yellow_card' | 'red_card' | null
  }>({ type: null })
  const [minuteValue, setMinuteValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (existingStats) {
      setStats({
        tries: existingStats.tries || 0,
        try_minutes: existingStats.try_minutes || [],
        conversions: existingStats.conversions || 0,
        conversion_minutes: existingStats.conversion_minutes || [],
        drop_goals: existingStats.drop_goals || 0,
        drop_goal_minutes: existingStats.drop_goal_minutes || [],
        yellow_cards: existingStats.yellow_cards || 0,
        yellow_card_minutes: existingStats.yellow_card_minutes || [],
        red_cards: existingStats.red_cards || 0,
        red_card_minutes: existingStats.red_card_minutes || []
      })
    } else {
      setStats({
        tries: 0,
        try_minutes: [],
        conversions: 0,
        conversion_minutes: [],
        drop_goals: 0,
        drop_goal_minutes: [],
        yellow_cards: 0,
        yellow_card_minutes: [],
        red_cards: 0,
        red_card_minutes: []
      })
    }
  }, [existingStats])

  const handleAddStat = (type: 'try' | 'conversion' | 'drop_goal' | 'yellow_card' | 'red_card') => {
    setShowMinuteInput({ type })
    setMinuteValue('')
  }

  const handleMinuteSubmit = () => {
    if (!minuteValue || isNaN(Number(minuteValue))) {
      alert('Inserisci un minuto valido')
      return
    }

    const minuteNum = parseInt(minuteValue)
    if (minuteNum < 0 || minuteNum > 120) {
      alert('Il minuto deve essere tra 0 e 120')
      return
    }

    const chronologyError = validateMatchEventMinute(stats, minuteNum)
    if (chronologyError) {
      alert(chronologyError)
      return
    }

    const type = showMinuteInput.type
    if (!type) return

    const newStats = { ...stats }
    const minutesArray = newStats[`${type}_minutes` as keyof typeof newStats] as number[]
    
    if (!minutesArray.includes(minuteNum)) {
      minutesArray.push(minuteNum)
      minutesArray.sort((a, b) => a - b)
      newStats[`${type}_minutes` as keyof typeof newStats] = minutesArray as any
      newStats[type as keyof typeof newStats] = (newStats[type as keyof typeof newStats] as number) + 1 as any
    }

    setStats(newStats)
    setShowMinuteInput({ type: null })
    setMinuteValue('')
  }

  const handleRemoveStat = (type: 'try' | 'conversion' | 'drop_goal' | 'yellow_card' | 'red_card', index: number) => {
    const newStats = { ...stats }
    const minutesArray = newStats[`${type}_minutes` as keyof typeof newStats] as number[]
    minutesArray.splice(index, 1)
    newStats[`${type}_minutes` as keyof typeof newStats] = minutesArray as any
    newStats[type as keyof typeof newStats] = Math.max(0, (newStats[type as keyof typeof newStats] as number) - 1) as any
    setStats(newStats)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Sincronizza i conteggi con la lunghezza degli array
      const statsData = {
        match_list_id: matchListId,
        player_id: null, // null per identificare l'avversario
        event_id: eventId || null,
        tries: stats.try_minutes?.length || stats.tries || 0,
        try_minutes: stats.try_minutes || [],
        conversions: stats.conversion_minutes?.length || stats.conversions || 0,
        conversion_minutes: stats.conversion_minutes || [],
        drop_goals: stats.drop_goal_minutes?.length || stats.drop_goals || 0,
        drop_goal_minutes: stats.drop_goal_minutes || [],
        yellow_cards: stats.yellow_card_minutes?.length || stats.yellow_cards || 0,
        yellow_card_minutes: stats.yellow_card_minutes || [],
        red_cards: stats.red_card_minutes?.length || stats.red_cards || 0,
        red_card_minutes: stats.red_card_minutes || [],
        minutes_played: 0
      }

      console.log('💾 Salvataggio statistiche avversario:', statsData)

      if (existingStats?.id) {
        // Update
        console.log('🔄 Aggiornamento statistiche esistenti, ID:', existingStats.id)
        const { data, error } = await supabase
          .from('match_statistics')
          .update(statsData)
          .eq('id', existingStats.id)
          .select()

        if (error) {
          console.error('❌ Errore update:', error)
          throw error
        }
        console.log('✅ Statistiche aggiornate:', data)
      } else {
        // Insert
        console.log('➕ Inserimento nuove statistiche')
        const { data, error } = await supabase
          .from('match_statistics')
          .insert([statsData])
          .select()

        if (error) {
          console.error('❌ Errore insert:', error)
          throw error
        }
        console.log('✅ Statistiche inserite:', data)
      }

      console.log('🔄 Chiamata onUpdate per ricaricare statistiche')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('❌ Errore nel salvataggio statistiche avversario:', error)
      alert(`Errore nel salvataggio delle statistiche: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const latestEventMinute = getLatestMatchEventMinute(stats)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden [color-scheme:light]">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">⚔️ Statistiche Avversario</h2>
              <p className="text-red-100 mt-1">{opponentName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
          <div className="space-y-4">
            {/* Mete Fatte */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">🏉 Mete Fatte</h3>
                <button
                  onClick={() => handleAddStat('try')}
                  className="w-10 h-10 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xl font-bold transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-2xl font-bold text-gray-900">{stats.tries}</div>
                {stats.try_minutes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {stats.try_minutes.map((minute, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                      >
                        {minute}'
                        <button
                          onClick={() => handleRemoveStat('try', index)}
                          className="ml-2 text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Trasformazioni Fatte */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">⚡ Trasf. Fatte</h3>
                <button
                  onClick={() => handleAddStat('conversion')}
                  className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xl font-bold transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-2xl font-bold text-gray-900">{stats.conversions}</div>
                {stats.conversion_minutes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {stats.conversion_minutes.map((minute, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                      >
                        {minute}'
                        <button
                          onClick={() => handleRemoveStat('conversion', index)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Piazzati Fatti */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">🎯 Piazzati Fatti</h3>
                <button
                  onClick={() => handleAddStat('drop_goal')}
                  className="w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xl font-bold transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-2xl font-bold text-gray-900">{stats.drop_goals}</div>
                {stats.drop_goal_minutes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {stats.drop_goal_minutes.map((minute, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                      >
                        {minute}'
                        <button
                          onClick={() => handleRemoveStat('drop_goal', index)}
                          className="ml-2 text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cartellini */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">🟨 Cartellino Giallo</h3>
                  <button
                    onClick={() => handleAddStat('yellow_card')}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    + Aggiungi
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-2xl font-bold text-gray-900">{stats.yellow_cards}</div>
                  {stats.yellow_card_minutes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {stats.yellow_card_minutes.map((minute, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                        >
                          {minute}'
                          <button
                            onClick={() => handleRemoveStat('yellow_card', index)}
                            className="ml-1 text-yellow-600 hover:text-yellow-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">🟥 Cartellino Rosso</h3>
                  <button
                    onClick={() => handleAddStat('red_card')}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    + Aggiungi
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-2xl font-bold text-gray-900">{stats.red_cards}</div>
                  {stats.red_card_minutes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {stats.red_card_minutes.map((minute, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                        >
                          {minute}'
                          <button
                            onClick={() => handleRemoveStat('red_card', index)}
                            className="ml-1 text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Input Minuto */}
          {showMinuteInput.type && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              {latestEventMinute !== null && (
                <p className="text-sm text-gray-600 mb-3">
                  Ultimo evento registrato al {latestEventMinute}&apos;. Inserisci un minuto uguale o successivo.
                </p>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={latestEventMinute ?? 0}
                  max="120"
                  value={minuteValue}
                  onChange={(e) => setMinuteValue(e.target.value)}
                  placeholder={latestEventMinute !== null ? `Minimo ${latestEventMinute}'` : 'Minuto'}
                  className={statsFormFieldClass}
                  autoFocus
                />
                <button
                  onClick={handleMinuteSubmit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Conferma
                </button>
                <button
                  onClick={() => setShowMinuteInput({ type: null })}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
