import Header from '@/components/Header'
import AttendanceRow from '@/components/AttendanceRow'
import { useEffect } from 'react'
import { useData } from '@/store/data'

export default function AttendanceBoard(){
  const { currentCategory, currentSession, loadPlayers, players } = useData()
  useEffect(()=>{ if (currentCategory) loadPlayers(currentCategory.id) }, [currentCategory])

  return (
    <div>
      <Header title={currentSession ? `Presenze – ${currentCategory?.code}` : 'Presenze'} />
      <div className="p-2">
        <div className="card p-0 overflow-hidden">
          <div className="max-h-[70vh] overflow-auto divide-y divide-white/50">
            {players.map(p => <AttendanceRow key={p.id} player={p as any} />)}
          </div>
        </div>
      </div>
    </div>
  )
}