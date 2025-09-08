import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Injury {
  id: string
  person_id: string
  injury_date: string
  injury_type: string
  severity: 'Lieve' | 'Moderato' | 'Grave'
  body_part: string
  body_part_description?: string
  cause: string
  treating_doctor?: string
  current_status: 'In corso' | 'Guarito' | 'Ricaduta'
  expected_weeks_off?: number
  is_closed?: boolean
  injury_closed_date?: string
}

interface InjuryActivity {
  id: string
  injury_id: string
  activity_type: 'medical_visit' | 'physiotherapy' | 'test' | 'note' | 'insurance_refund' | 'equipment_purchase' | 'expenses' | 'other'
  activity_date: string
  operator_name?: string
  duration_minutes?: number
  activity_description?: string
  notes?: string
  amount?: number
  currency?: string
  ricontrollo?: string
  massaggio?: boolean
  tecar?: boolean
  laser?: boolean
  created_at: string
}

interface InjuriesTabProps {
  personId: string
  canEdit?: boolean
  onNoteAdded?: () => void
  onInjuryCreated?: () => void
  onAddInjury?: () => void
  onOpenInjuryModal?: (injury: any) => void
  onOpenDeleteModal?: (injury: any) => void
  onOpenActivityForm?: (injuryId: string) => void
  onOpenDeleteActivityModal?: (activityId: string, injuryId: string, activityType: string) => void
  onOpenEditActivityForm?: (activity: InjuryActivity) => void
  refreshTrigger?: number // Aggiungiamo un trigger per forzare il refresh
}

const InjuriesTab: React.FC<InjuriesTabProps> = ({ personId, canEdit = false, onNoteAdded, onInjuryCreated, onAddInjury, onOpenInjuryModal, onOpenDeleteModal, onOpenActivityForm, onOpenDeleteActivityModal, onOpenEditActivityForm, refreshTrigger }) => {
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedInjury, setExpandedInjury] = useState<string | null>(null)
  const [activities, setActivities] = useState<Record<string, InjuryActivity[]>>({})
  const [filteredActivityTypes, setFilteredActivityTypes] = useState<Record<string, string[]>>({})

  // Carica infortuni
  const loadInjuries = async () => {
    if (!personId) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('injuries')
        .select('*')
        .eq('person_id', personId)
        .order('injury_date', { ascending: false })

      if (error) throw error
      setInjuries(data || [])
    } catch (error) {
      console.error('Errore nel caricamento degli infortuni:', error)
    } finally {
      setLoading(false)
    }
  }

  // Carica attività per un infortunio specifico
  const loadActivities = async (injuryId: string) => {
    try {
      const { data, error } = await supabase
        .from('injury_activities')
        .select('*')
        .eq('injury_id', injuryId)
        .order('activity_date', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      setActivities(prev => ({
        ...prev,
        [injuryId]: data || []
      }))
    } catch (error) {
      console.error('Errore nel caricamento delle attività:', error)
    }
  }

  // Funzione per aprire il modal di eliminazione attività (delegata al parent)
  const handleDeleteActivity = (activityId: string, injuryId: string, activityType: string) => {
    if (onOpenDeleteActivityModal) {
      onOpenDeleteActivityModal(activityId, injuryId, activityType)
    }
  }

  // Modifica un'attività (apre il form di modifica)
  const editActivity = (activity: InjuryActivity) => {
    if (onOpenEditActivityForm) {
      onOpenEditActivityForm(activity)
    }
  }

  // Gestisce l'espansione/contrazione dell'accordion
  const toggleInjuryExpansion = (injuryId: string) => {
    if (expandedInjury === injuryId) {
      setExpandedInjury(null)
    } else {
      setExpandedInjury(injuryId)
      // Carica le attività se non sono già state caricate
      if (!activities[injuryId]) {
        loadActivities(injuryId)
      }
    }
  }

  // Gestisce i filtri delle attività
  const handleActivityFilterChange = (injuryId: string, activityType: string, isChecked: boolean) => {
    setFilteredActivityTypes(prev => {
      const currentFilters = prev[injuryId] || []
      
      if (isChecked) {
        // Aggiungi il tipo ai filtri
        return {
          ...prev,
          [injuryId]: [...currentFilters, activityType]
        }
      } else {
        // Rimuovi il tipo dai filtri
        return {
          ...prev,
          [injuryId]: currentFilters.filter(type => type !== activityType)
        }
      }
    })
  }


  // Funzioni helper per i tag delle attività
  const getActivityTypeName = (type: string) => {
    const types = {
      medical_visit: 'Visita Medica',
      physiotherapy: 'Fisioterapia',
      test: 'Test/Esame',
      note: 'Annotazione',
      insurance_refund: 'Rimborso Assicurativo',
      equipment_purchase: 'Acquisto Attrezzatura',
      expenses: 'Spese Sostenute',
      other: 'Altro'
    }
    return types[type as keyof typeof types] || type
  }

  const getActivityTypeColor = (type: string) => {
    const colors = {
      medical_visit: 'bg-blue-100 text-blue-800',
      physiotherapy: 'bg-green-100 text-green-800',
      test: 'bg-purple-100 text-purple-800',
      note: 'bg-gray-100 text-gray-800',
      insurance_refund: 'bg-yellow-100 text-yellow-800',
      equipment_purchase: 'bg-indigo-100 text-indigo-800',
      expenses: 'bg-red-100 text-red-800',
      other: 'bg-orange-100 text-orange-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getActivityTypeIcon = (type: string) => {
    const icons = {
      medical_visit: '🏥',
      physiotherapy: '💪',
      test: '🔬',
      note: '📝',
      insurance_refund: '💰',
      equipment_purchase: '🛒',
      expenses: '💸',
      other: '📋'
    }
    return icons[type as keyof typeof icons] || '📋'
  }

  // Carica infortuni quando cambia personId o refreshTrigger
  useEffect(() => {
    if (personId) loadInjuries()
  }, [personId, refreshTrigger])

  // Apri modal per nuovo infortunio
  const openAddInjury = () => {
    onOpenInjuryModal?.(null)
  }

  // Apri modal per modifica infortunio
  const openEditInjury = (injury: Injury) => {
    onOpenInjuryModal?.(injury)
  }

  // Elimina infortunio
  const handleDeleteInjury = (injury: Injury) => {
    onOpenDeleteModal?.(injury)
  }

  // Calcola giorni trascorsi tra data infortunio e data chiusura (o oggi se ancora in corso)
  const calculateDaysPassed = (injury: Injury) => {
    const injuryDate = new Date(injury.injury_date)
    
    // Verifica se esiste ancora un'attività "VISITA DI CHIUSURA"
    const injuryActivities = activities[injury.id] || []
    const hasClosingVisit = injuryActivities.some(a => 
      a.activity_type === 'medical_visit' && 
      a.activity_description === 'VISITA DI CHIUSURA'
    )
    
    // Se l'infortunio è marcato come chiuso E esiste ancora la visita di chiusura
    if (injury.is_closed && hasClosingVisit) {
      const closingVisit = injuryActivities
        .filter(activity => 
          activity.activity_type === 'medical_visit' && 
          activity.activity_description === 'VISITA DI CHIUSURA'
        )
        .sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime())[0]
      
      if (closingVisit) {
        const closedDate = new Date(closingVisit.activity_date)
        const diffTime = closedDate.getTime() - injuryDate.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        return diffDays + 1 // +1 per includere entrambi i giorni (inizio e fine)
      }
    }
    
    // Se è ancora in corso, usa la data di oggi
    const today = new Date()
    const diffTime = today.getTime() - injuryDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays + 1 // +1 per includere entrambi i giorni (inizio e fine)
  }

  if (!personId) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <p className="text-gray-500">⚠️ Nessun ID persona</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Infortuni</h2>
          <p className="text-gray-500">Gestione infortuni del giocatore</p>
        </div>
        <button
          type="button"
          onClick={() => onAddInjury && onAddInjury()}
          className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center hover:bg-blue-700 shadow-lg transition-all duration-200"
          title="Aggiungi infortunio"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Lista Infortuni */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Caricamento...</p>
        </div>
      ) : injuries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Nessun infortunio registrato</p>
        </div>
      ) : (
        <div className="space-y-4 w-full">
          {injuries.map((injury) => (
            <div key={injury.id} className={`rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 w-full ${
              injury.current_status === 'In corso' 
                ? 'bg-red-50/50 border border-red-200/50' 
                : injury.current_status === 'Guarito'
                ? expandedInjury === injury.id 
                  ? 'bg-green-50/50 border border-green-200/50'
                  : 'bg-white border border-green-200/50'
                : 'bg-white border border-gray-200/50'
            }`}>
              {/* Fascia principale dell'infortunio - cliccabile per accordion */}
              <div 
                className={`p-4 cursor-pointer transition-all duration-200 w-full ${
                  injury.current_status === 'In corso' 
                    ? 'hover:bg-red-100/50' 
                    : injury.current_status === 'Guarito'
                    ? 'hover:bg-green-100/50'
                    : 'hover:bg-gray-50/50'
                }`}
                onClick={() => toggleInjuryExpansion(injury.id)}
              >
                <div className="flex justify-between items-start w-full">
                  <div className="flex-1 w-full">
                    {/* Header compatto con icona e info principali */}
                    <div className="flex items-center gap-3 mb-3">
                      {/* Icona compatta per tipo di infortunio */}
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                        injury.injury_type.toLowerCase().includes('contrattura') ? 'from-orange-500 to-orange-600' :
                        injury.injury_type.toLowerCase().includes('distorsione') ? 'from-red-500 to-red-600' :
                        injury.injury_type.toLowerCase().includes('frattura') ? 'from-purple-500 to-purple-600' :
                        injury.injury_type.toLowerCase().includes('stiramento') ? 'from-yellow-500 to-yellow-600' :
                        injury.injury_type.toLowerCase().includes('test') ? 'from-blue-500 to-blue-600' :
                        'from-gray-500 to-gray-600'
                      } flex items-center justify-center text-white text-lg shadow-lg`}>
                        {injury.injury_type.toLowerCase().includes('contrattura') ? '💪' :
                         injury.injury_type.toLowerCase().includes('distorsione') ? '🦵' :
                         injury.injury_type.toLowerCase().includes('frattura') ? '🦴' :
                         injury.injury_type.toLowerCase().includes('stiramento') ? '⚡' :
                         injury.injury_type.toLowerCase().includes('test') ? '🔬' :
                         '🏥'}
                      </div>
                      
                      {/* Info principali compatte */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500 bg-white/60 px-2 py-1 rounded-lg">
                            📅 {new Date(injury.injury_date).toLocaleDateString('it-IT')}
                      </span>
                          <h3 className="font-bold text-gray-900 text-base">{injury.injury_type}</h3>
                          <span className="text-xs text-gray-600">📍 {injury.body_part}</span>
                    </div>
                    
                        {/* Tag gravità e stato compatti */}
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold shadow-sm ${
                            injury.severity === 'Grave' ? 'bg-red-100 text-red-800 border border-red-200' :
                            injury.severity === 'Moderato' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                            'bg-green-100 text-green-800 border border-green-200'
                          }`}>
                            {injury.severity === 'Grave' ? '🔴' : injury.severity === 'Moderato' ? '🟡' : '🟢'} {injury.severity}
                      </span>
                      
                          <span className={`px-2 py-1 rounded-full text-xs font-bold shadow-sm ${
                            injury.current_status === 'In corso' ? 'bg-red-100 text-red-800 border border-red-200' :
                            injury.current_status === 'Guarito' ? 'bg-green-100 text-green-800 border border-green-200' :
                            'bg-orange-100 text-orange-800 border border-orange-200'
                          }`}>
                            {injury.current_status === 'In corso' ? '⏳' : injury.current_status === 'Guarito' ? '✅' : '🔄'} {injury.current_status}
                      </span>
                        </div>
                      </div>
                    </div>

                    {/* Griglia informazioni compatte */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {/* Giorni trascorsi */}
                      <div className="bg-white rounded-xl p-3 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-sm">📊</span>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Giorni</span>
                        </div>
                        <div className="text-lg font-bold text-gray-800">{calculateDaysPassed(injury)}</div>
                      </div>
                      
                      {/* Previsione */}
                      {injury.expected_weeks_off && (
                        <div className="bg-white rounded-xl p-3 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-sm">⏰</span>
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Previsione</span>
                          </div>
                          <div className="text-lg font-bold text-gray-800">{injury.expected_weeks_off} giorni</div>
                        </div>
                      )}
                      
                      {/* Causa */}
                      {injury.cause && (
                        <div className="bg-white rounded-xl p-3 border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-sm">🎯</span>
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Causa</span>
                          </div>
                          <div className="text-sm font-bold text-gray-800 truncate">{injury.cause}</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Dettagli aggiuntivi compatti */}
                    <div className="space-y-1">
                      {(() => {
                        // Verifica se esiste ancora un'attività "VISITA DI CHIUSURA"
                        const injuryActivities = activities[injury.id] || []
                        const hasClosingVisit = injuryActivities.some(a => 
                          a.activity_type === 'medical_visit' && 
                          a.activity_description === 'VISITA DI CHIUSURA'
                        )
                        
                        return injury.is_closed && injury.injury_closed_date && hasClosingVisit && (
                          <div className="flex items-center gap-2 text-xs bg-white rounded-xl p-3 border border-gray-200/50 shadow-sm">
                            <span className="text-gray-500">🏁</span>
                            <span className="font-medium text-gray-700">Chiusura:</span>
                            <span className="text-gray-600">{new Date(injury.injury_closed_date).toLocaleDateString('it-IT')}</span>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Sezioni espandibili - solo se l'infortunio è espanso */}
                    {expandedInjury === injury.id && (
                      <>
                        {/* Riepilogo Attività Mediche */}
                        {(() => {
                      const injuryActivities = activities[injury.id] || []
                      
                      // Attività mediche
                      const medicalVisits = injuryActivities.filter(a => a.activity_type === 'medical_visit')
                      const physiotherapySessions = injuryActivities.filter(a => a.activity_type === 'physiotherapy')
                      const exams = injuryActivities.filter(a => a.activity_type === 'test')
                      
                      // Conteggi fisioterapia
                      const totalPhysioMinutes = physiotherapySessions.reduce((sum, a) => {
                        const duration = typeof a.duration_minutes === 'string' ? parseInt(a.duration_minutes) : (a.duration_minutes || 0)
                        return sum + duration
                      }, 0)
                      
                      const totalPhysioHours = Math.floor(totalPhysioMinutes / 60)
                      const remainingMinutes = totalPhysioMinutes % 60
                      const physioTimeDisplay = totalPhysioHours > 0 
                        ? `${totalPhysioHours}h ${remainingMinutes}m`
                        : `${remainingMinutes}m`
                      
                      const totalMassaggi = physiotherapySessions.filter(a => a.massaggio).length
                      const totalLaser = physiotherapySessions.filter(a => a.laser).length
                      const totalTecar = physiotherapySessions.filter(a => a.tecar).length
                      
                      if (medicalVisits.length > 0 || physiotherapySessions.length > 0 || exams.length > 0) {
                        return (
                          <div className="mt-3 p-4 bg-white rounded-2xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-300">
                            {/* Header Attività Mediche */}
                            <div className="text-center mb-2">
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">🏥 Attività Mediche</span>
                            </div>
                            
                            {/* Layout a griglia con allineamento perfetto */}
            <div className="grid grid-cols-4 gap-2 gap-y-4 text-xs">
              {/* Prima riga */}
              {/* Visite Mediche */}
              <div className="text-center p-2 bg-blue-50/30 rounded-xl border border-blue-200/30 hover:bg-blue-50/50 transition-all duration-200">
                {medicalVisits.length > 0 ? (
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-blue-600 text-xl">🏥</span>
                    <span className="text-gray-600 text-base">Visite</span>
                    <span className="font-bold text-blue-600 text-xl">{medicalVisits.length}</span>
                  </div>
                ) : (
                  <div className="h-8"></div>
                )}
              </div>

              {/* Fisioterapia */}
              <div className="text-center p-2 bg-green-50/30 rounded-xl border border-green-200/30 hover:bg-green-50/50 transition-all duration-200">
                {physiotherapySessions.length > 0 ? (
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-green-600 text-xl">💪</span>
                    <span className="text-gray-600 text-base">Fisio</span>
                    <span className="font-bold text-green-600 text-xl">{physiotherapySessions.length}</span>
                  </div>
                ) : (
                  <div className="h-8"></div>
                )}
              </div>

              {/* Ore Fisioterapia */}
              <div className="text-center p-2 bg-green-50/30 rounded-xl border border-green-200/30 hover:bg-green-50/50 transition-all duration-200">
                {totalPhysioMinutes > 0 ? (
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-green-600 text-xl">⏱️</span>
                    <span className="text-gray-600 text-base">Ore</span>
                    <span className="font-bold text-green-600 text-xl">{physioTimeDisplay}</span>
                  </div>
                ) : (
                  <div className="h-8"></div>
                )}
              </div>

              {/* Esami */}
              <div className="text-center p-2 bg-purple-50/30 rounded-xl border border-purple-200/30 hover:bg-purple-50/50 transition-all duration-200">
                {exams.length > 0 ? (
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-purple-600 text-xl">🔬</span>
                    <span className="text-gray-600 text-base">Esami</span>
                    <span className="font-bold text-purple-600 text-xl">{exams.length}</span>
                  </div>
                ) : (
                  <div className="h-8"></div>
                )}
              </div>

              {/* Seconda riga - allineata esattamente sotto da sinistra verso destra */}
              {/* Tecar - sotto Visite (prima colonna) */}
              <div className="text-center p-2 bg-yellow-50/30 rounded-xl border border-yellow-200/30 hover:bg-yellow-50/50 transition-all duration-200">
                {totalTecar > 0 ? (
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-yellow-600 text-xl">⚡</span>
                    <span className="text-gray-600 text-base">Tecar</span>
                    <span className="font-bold text-yellow-600 text-xl">{totalTecar}</span>
                  </div>
                ) : (
                  <div className="h-8"></div>
                )}
              </div>

              {/* Massaggi - sotto Fisio (seconda colonna) */}
              <div className="text-center p-2 bg-orange-50/30 rounded-xl border border-orange-200/30 hover:bg-orange-50/50 transition-all duration-200">
                {totalMassaggi > 0 ? (
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-orange-600 text-xl">💆‍♂️</span>
                    <span className="text-gray-600 text-base">Massaggi</span>
                    <span className="font-bold text-orange-600 text-xl">{totalMassaggi}</span>
                  </div>
                ) : (
                  <div className="h-8"></div>
                )}
              </div>

              {/* Laser - sotto Ore (terza colonna) */}
              <div className="text-center p-2 bg-red-50/30 rounded-xl border border-red-200/30 hover:bg-red-50/50 transition-all duration-200">
                {totalLaser > 0 ? (
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-red-600 text-xl">🔴</span>
                    <span className="text-gray-600 text-base">Laser</span>
                    <span className="font-bold text-red-600 text-xl">{totalLaser}</span>
                  </div>
                ) : (
                  <div className="h-8"></div>
                )}
              </div>

              {/* Colonna vuota - sotto Esami (quarta colonna) */}
              <div className="text-center p-1">
                <div className="h-8"></div>
              </div>
            </div>
                          </div>
                        )
                      }
                      return null
                    })()}

                    {/* Riepilogo Finanziario */}
                    {(() => {
                      const injuryActivities = activities[injury.id] || []
                      
                      // Costi e rimborsi
                      const testCosts = injuryActivities.filter(a => a.activity_type === 'test' && a.amount)
                      const equipmentCosts = injuryActivities.filter(a => a.activity_type === 'equipment_purchase')
                      const expenses = injuryActivities.filter(a => a.activity_type === 'expenses')
                      const refunds = injuryActivities.filter(a => a.activity_type === 'insurance_refund')
                      
                      const totalTestCosts = testCosts.reduce((sum, a) => {
                        const amount = typeof a.amount === 'string' ? parseFloat(a.amount) : (a.amount || 0)
                        return sum + amount
                      }, 0)
                      const totalEquipmentCosts = equipmentCosts.reduce((sum, a) => {
                        const amount = typeof a.amount === 'string' ? parseFloat(a.amount) : (a.amount || 0)
                        return sum + amount
                      }, 0)
                      const totalExpenses = expenses.reduce((sum, a) => {
                        const amount = typeof a.amount === 'string' ? parseFloat(a.amount) : (a.amount || 0)
                        return sum + amount
                      }, 0)
                      const totalRefunds = refunds.reduce((sum, a) => {
                        const amount = typeof a.amount === 'string' ? parseFloat(a.amount) : (a.amount || 0)
                        return sum + amount
                      }, 0)
                      
                      const totalCosts = totalTestCosts + totalEquipmentCosts + totalExpenses
                      
                      if (totalCosts > 0 || totalRefunds > 0) {
                        return (
                          <div className="mt-2 p-4 bg-white rounded-2xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-300">
                            {/* Header Finanziario */}
                            <div className="text-center mb-2">
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">💰 Riepilogo Finanziario</span>
                            </div>
                            
                            {/* Riga: Costi e Rimborsi - layout espanso */}
                            <div className="flex items-center justify-between gap-3 text-xs">
                              {/* Costi Test */}
                              {totalTestCosts > 0 && (
                                <div className="flex items-center gap-1">
                                  <span>🧪</span>
                                  <span className="text-gray-600">Esami:</span>
                                  <span className="font-bold text-orange-600">{totalTestCosts.toFixed(2)}€</span>
                                </div>
                              )}
                              
                              {/* Spese */}
                              {totalExpenses > 0 && (
                                <div className="flex items-center gap-1">
                                  <span>💸</span>
                                  <span className="text-gray-600">Spese:</span>
                                  <span className="font-bold text-red-600">{totalExpenses.toFixed(2)}€</span>
                                </div>
                              )}
                              
                              {/* Attrezzature */}
                              {totalEquipmentCosts > 0 && (
                                <div className="flex items-center gap-1">
                                  <span>🛒</span>
                                  <span className="text-gray-600">Attrez.:</span>
                                  <span className="font-bold text-purple-600">{totalEquipmentCosts.toFixed(2)}€</span>
                                </div>
                              )}
                              
                              {/* Rimborsi */}
                              {totalRefunds > 0 && (
                                <div className="flex items-center gap-1">
                                  <span>💰</span>
                                  <span className="text-gray-600">Rimb.:</span>
                                  <span className="font-bold text-green-600">{totalRefunds.toFixed(2)}€</span>
                                </div>
                              )}
                              
                              {/* Bilancio Netto */}
                              <div className="flex items-center gap-1">
                                <span>⚖️</span>
                                <span className="text-gray-600">Bilancio:</span>
                                <span className={`font-bold ${
                                  (totalRefunds - totalCosts) >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {(totalRefunds - totalCosts).toFixed(2)}€
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                        })()}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Icona + per aggiungere attività - nascosta se l'infortunio è guarito */}
                    {injury.current_status !== 'Guarito' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenActivityForm?.(injury.id)
                      }}
                      className="p-1.5 rounded-lg bg-emerald-50/80 hover:bg-emerald-100/80 transition-all duration-200 text-emerald-600 hover:text-emerald-700 border border-emerald-200/50 hover:border-emerald-300/50"
                      title="Aggiungi attività"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditInjury(injury)
                      }}
                      className="p-1.5 rounded-lg bg-blue-50/80 hover:bg-blue-100/80 transition-all duration-200 text-blue-600 hover:text-blue-700 border border-blue-200/50 hover:border-blue-300/50"
                      title="Modifica"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteInjury(injury)
                      }}
                      className="p-1.5 rounded-lg bg-rose-50/80 hover:bg-rose-100/80 transition-all duration-200 text-rose-600 hover:text-rose-700 border border-rose-200/50 hover:border-rose-300/50"
                      title="Elimina"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Accordion per le attività */}
              {expandedInjury === injury.id && (
                <div className="border-t border-white/20 bg-gradient-to-br from-white/30 to-white/10 p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm shadow-lg">
                        📋
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">
                        Attività e Annotazioni
                      </h3>
                      <span className="px-3 py-1 bg-white/60 rounded-full text-xs font-bold text-gray-600 border border-white/40">
                      {activities[injury.id]?.length || 0} attività
                    </span>
                    </div>
                    
                    {/* Checkbox di Filtro - solo se ci sono almeno 2 tipi diversi */}
                    {(() => {
                      const injuryActivities = activities[injury.id] || []
                      const activityTypes = [...new Set(injuryActivities.map(a => a.activity_type))]
                      
                      if (activityTypes.length >= 2) {
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600 mr-2">Filtra:</span>
                            {activityTypes.map(type => {
                              const count = injuryActivities.filter(a => a.activity_type === type).length
                              const isChecked = !filteredActivityTypes[injury.id] || filteredActivityTypes[injury.id].includes(type)
                              
                              return (
                                <label key={type} className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => handleActivityFilterChange(injury.id, type, e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                  />
                                  <span className="text-xs font-medium text-gray-700">
                                    {type === 'medical_visit' ? '🏥 Visita' :
                                     type === 'physiotherapy' ? '💪 Fisio' :
                                     type === 'test' ? '🔬 Test' :
                                     type === 'insurance_refund' ? '💰 Rimborso' :
                                     type === 'equipment_purchase' ? '🛒 Attrez.' :
                                     type === 'expenses' ? '💸 Spese' : type} ({count})
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                  
                  {activities[injury.id]?.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-2xl">
                        📝
                      </div>
                      <p className="text-gray-600 font-medium mb-1">Nessuna attività registrata</p>
                      <p className="text-sm text-gray-500">Clicca su + per aggiungere la prima attività</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const injuryActivities = activities[injury.id] || []
                        const currentFilters = filteredActivityTypes[injury.id] || []
                        
                        // Se non ci sono filtri attivi, mostra tutte le attività
                        if (currentFilters.length === 0) {
                          return injuryActivities.map((activity) => {
                        // Colori e icone per tipo di attività
                        const getActivityStyle = (type: string) => {
                          switch (type) {
                            case 'medical_visit':
                              return {
                                gradient: 'from-blue-500 to-blue-600',
                                bg: 'bg-blue-50',
                                icon: '🏥',
                                color: 'text-blue-700',
                                border: 'border-blue-200'
                              }
                            case 'physiotherapy':
                              return {
                                gradient: 'from-yellow-500 to-yellow-600',
                                bg: 'bg-yellow-50',
                                icon: '💪',
                                color: 'text-yellow-700',
                                border: 'border-yellow-200'
                              }
                            case 'test':
                              return {
                                gradient: 'from-purple-500 to-purple-600',
                                bg: 'bg-purple-50',
                                icon: '🔬',
                                color: 'text-purple-700',
                                border: 'border-purple-200'
                              }
                            case 'note':
                              return {
                                gradient: 'from-gray-500 to-gray-600',
                                bg: 'bg-gray-50',
                                icon: '📝',
                                color: 'text-gray-700',
                                border: 'border-gray-200'
                              }
                            case 'insurance_refund':
                              return {
                                gradient: 'from-cyan-500 to-cyan-600',
                                bg: 'bg-cyan-50',
                                icon: '💰',
                                color: 'text-cyan-700',
                                border: 'border-cyan-200'
                              }
                            case 'equipment_purchase':
                              return {
                                gradient: 'from-orange-500 to-orange-600',
                                bg: 'bg-orange-50',
                                icon: '🛒',
                                color: 'text-orange-700',
                                border: 'border-orange-200'
                              }
                            case 'expenses':
                              return {
                                gradient: 'from-orange-500 to-orange-600',
                                bg: 'bg-orange-50',
                                icon: '💸',
                                color: 'text-orange-700',
                                border: 'border-orange-200'
                              }
                            default:
                              return {
                                gradient: 'from-orange-500 to-orange-600',
                                bg: 'bg-orange-50',
                                icon: '📋',
                                color: 'text-orange-700',
                                border: 'border-orange-200'
                              }
                          }
                        }

                        const style = getActivityStyle(activity.activity_type)

                        return (
                          <div key={activity.id} className={`${style.bg} rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border ${style.border} backdrop-blur-sm`}>
                            {/* Header con icona e azioni */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white text-xl shadow-lg`}>
                                  {style.icon}
                                </div>
                                <div>
                                  <h3 className={`font-semibold ${style.color} text-lg`}>{getActivityTypeName(activity.activity_type)}</h3>
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span>📅 {new Date(activity.activity_date).toLocaleDateString('it-IT')}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Azioni */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => editActivity(activity)}
                                  className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 shadow-md hover:shadow-lg text-blue-600 hover:text-blue-700"
                                  title="Modifica"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteActivity(activity.id, injury.id, activity.activity_type)}
                                  className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 shadow-md hover:shadow-lg text-red-600 hover:text-red-700"
                                  title="Elimina"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Contenuto principale */}
                            <div className="space-y-3">
                              {/* Operatore */}
                              {activity.operator_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">👨‍⚕️</span>
                                  <span className="font-medium text-gray-700">Operatore:</span>
                                  <span className="text-gray-600">{activity.operator_name}</span>
                                </div>
                              )}
                              
                              {/* Durata */}
                              {activity.duration_minutes && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">⏱️</span>
                                  <span className="font-medium text-gray-700">Durata:</span>
                                  <span className="text-gray-600">{activity.duration_minutes} minuti</span>
                                </div>
                              )}
                              
                              {/* Descrizione */}
                              {activity.activity_description && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">📋</span>
                                  <span className="font-medium text-gray-700">Descrizione:</span>
                                  <span className="text-gray-600">{activity.activity_description}</span>
                                </div>
                              )}

                              {/* Trattamenti fisioterapia */}
                              {activity.activity_type === 'physiotherapy' && (activity.massaggio || activity.tecar || activity.laser) && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">💆‍♂️</span>
                                  <span className="font-medium text-gray-700">Trattamenti:</span>
                                  <div className="flex gap-1">
                                    {activity.massaggio && <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Massaggio</span>}
                                    {activity.tecar && <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Tecar</span>}
                                    {activity.laser && <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Laser</span>}
                                  </div>
                                </div>
                              )}

                              {/* Ricontrollo */}
                              {activity.ricontrollo && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">📅</span>
                                  <span className="font-medium text-gray-700">Ricontrollo:</span>
                                  <span className="text-gray-600">{new Date(activity.ricontrollo).toLocaleDateString('it-IT')}</span>
                                </div>
                              )}
                              

                              {/* Note */}
                              {activity.notes && (
                                <div className="mt-4 p-4 bg-white/60 rounded-xl border border-white/40">
                                  <div className="flex items-start gap-2">
                                    <span className="text-gray-500 mt-0.5">💬</span>
                                    <p className="text-sm text-gray-700 italic leading-relaxed">{activity.notes}</p>
                                  </div>
                                </div>
                              )}

                              {/* Costo/Entrata (solo per tipi specifici) */}
                              {activity.amount && (
                                activity.activity_type === 'test' ||
                                activity.activity_type === 'insurance_refund' || 
                                activity.activity_type === 'equipment_purchase' || 
                                activity.activity_type === 'expenses'
                              ) && (
                                <div className="mt-4 p-4 bg-white/60 rounded-xl border border-white/40">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-500">
                                      {activity.activity_type === 'test' ? '🔬' :
                                       activity.activity_type === 'insurance_refund' ? '💰' : 
                                       activity.activity_type === 'equipment_purchase' ? '🛒' : '💸'}
                                    </span>
                                    <span className="font-medium text-gray-700">
                                      {activity.activity_type === 'test' ? 'Costo Esame:' :
                                       activity.activity_type === 'insurance_refund' ? 'Rimborso:' : 
                                       activity.activity_type === 'equipment_purchase' ? 'Costo Attrezzatura:' : 'Spese:'}
                                    </span>
                                    <span className={`text-lg font-bold ${
                                      activity.activity_type === 'insurance_refund' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {activity.amount} {activity.currency || 'EUR'}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Tag speciali per visite mediche */}
                              {activity.activity_type === 'medical_visit' && activity.activity_description && (
                                <div className="mt-3">
                                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                                    activity.activity_description === 'PRIMA VISITA' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                    activity.activity_description === 'VISITA DI CONTROLLO' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                    activity.activity_description === 'VISITA DI CHIUSURA' ? 'bg-green-100 text-green-800 border border-green-200' :
                                    'bg-gray-100 text-gray-800 border border-gray-200'
                                  }`}>
                                    {activity.activity_description === 'PRIMA VISITA' && '🆕'}
                                    {activity.activity_description === 'VISITA DI CONTROLLO' && '🔄'}
                                    {activity.activity_description === 'VISITA DI CHIUSURA' && '✅'}
                                    <span className="ml-1">{activity.activity_description}</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                        } else {
                          // Filtra le attività in base ai checkbox selezionati
                          return injuryActivities
                            .filter(activity => currentFilters.includes(activity.activity_type))
                            .map((activity) => {
                              // Colori e icone per tipo di attività
                              const getActivityStyle = (type: string) => {
                                switch (type) {
                                  case 'medical_visit':
                                    return {
                                      gradient: 'from-blue-500 to-blue-600',
                                      bg: 'bg-blue-50',
                                      icon: '🏥',
                                      color: 'text-blue-700',
                                      border: 'border-blue-200'
                                    }
                                  case 'physiotherapy':
                                    return {
                                      gradient: 'from-yellow-500 to-yellow-600',
                                      bg: 'bg-yellow-50',
                                      icon: '💪',
                                      color: 'text-yellow-700',
                                      border: 'border-yellow-200'
                                    }
                                  case 'test':
                                    return {
                                      gradient: 'from-purple-500 to-purple-600',
                                      bg: 'bg-purple-50',
                                      icon: '🔬',
                                      color: 'text-purple-700',
                                      border: 'border-purple-200'
                                    }
                                  case 'note':
                                    return {
                                      gradient: 'from-gray-500 to-gray-600',
                                      bg: 'bg-gray-50',
                                      icon: '📝',
                                      color: 'text-gray-700',
                                      border: 'border-gray-200'
                                    }
                                  case 'insurance_refund':
                                    return {
                                      gradient: 'from-cyan-500 to-cyan-600',
                                      bg: 'bg-cyan-50',
                                      icon: '💰',
                                      color: 'text-cyan-700',
                                      border: 'border-cyan-200'
                                    }
                                  case 'equipment_purchase':
                                    return {
                                      gradient: 'from-orange-500 to-orange-600',
                                      bg: 'bg-orange-50',
                                      icon: '🛒',
                                      color: 'text-orange-700',
                                      border: 'border-orange-200'
                                    }
                                  case 'expenses':
                                    return {
                                      gradient: 'from-orange-500 to-orange-600',
                                      bg: 'bg-orange-50',
                                      icon: '💸',
                                      color: 'text-orange-700',
                                      border: 'border-orange-200'
                                    }
                                  default:
                                    return {
                                      gradient: 'from-orange-500 to-orange-600',
                                      bg: 'bg-orange-50',
                                      icon: '📋',
                                      color: 'text-orange-700',
                                      border: 'border-orange-200'
                                    }
                                }
                              }

                              const style = getActivityStyle(activity.activity_type)

                              return (
                                <div key={activity.id} className={`${style.bg} rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border ${style.border} backdrop-blur-sm`}>
                                  {/* Header con icona e azioni */}
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white text-xl shadow-lg`}>
                                        {style.icon}
                                      </div>
                                      <div>
                                        <h3 className={`font-semibold ${style.color} text-lg`}>{getActivityTypeName(activity.activity_type)}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                          <span>📅 {new Date(activity.activity_date).toLocaleDateString('it-IT')}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Azioni */}
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => editActivity(activity)}
                                        className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 shadow-md hover:shadow-lg text-blue-600 hover:text-blue-700"
                                        title="Modifica"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteActivity(activity.id, injury.id, activity.activity_type)}
                                        className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 shadow-md hover:shadow-lg text-red-600 hover:text-red-700"
                                        title="Elimina"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Contenuto principale */}
                                  <div className="space-y-3">
                                    {/* Operatore */}
                                    {activity.operator_name && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500">👨‍⚕️</span>
                                        <span className="font-medium text-gray-700">Operatore:</span>
                                        <span className="text-gray-600">{activity.operator_name}</span>
                                      </div>
                                    )}
                                    
                                    {/* Durata */}
                                    {activity.duration_minutes && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500">⏱️</span>
                                        <span className="font-medium text-gray-700">Durata:</span>
                                        <span className="text-gray-600">{activity.duration_minutes} minuti</span>
                                      </div>
                                    )}
                                    
                                    {/* Descrizione */}
                                    {activity.activity_description && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500">📋</span>
                                        <span className="font-medium text-gray-700">Descrizione:</span>
                                        <span className="text-gray-600">{activity.activity_description}</span>
                                      </div>
                                    )}

                                    {/* Trattamenti fisioterapia */}
                                    {activity.activity_type === 'physiotherapy' && (activity.massaggio || activity.tecar || activity.laser) && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500">💆‍♂️</span>
                                        <span className="font-medium text-gray-700">Trattamenti:</span>
                                        <div className="flex gap-1">
                                          {activity.massaggio && <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Massaggio</span>}
                                          {activity.tecar && <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Tecar</span>}
                                          {activity.laser && <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Laser</span>}
                                        </div>
                                      </div>
                                    )}

                                    {/* Ricontrollo */}
                                    {activity.ricontrollo && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500">📅</span>
                                        <span className="font-medium text-gray-700">Ricontrollo:</span>
                                        <span className="text-gray-600">{new Date(activity.ricontrollo).toLocaleDateString('it-IT')}</span>
                                      </div>
                                    )}
                                    

                                    {/* Note */}
                                    {activity.notes && (
                                      <div className="mt-4 p-4 bg-white/60 rounded-xl border border-white/40">
                                        <div className="flex items-start gap-2">
                                          <span className="text-gray-500 mt-0.5">💬</span>
                                          <p className="text-sm text-gray-700 italic leading-relaxed">{activity.notes}</p>
                                        </div>
                                      </div>
                                    )}

                                    {/* Costo/Entrata (solo per tipi specifici) */}
                                    {activity.amount && (
                                      activity.activity_type === 'test' ||
                                      activity.activity_type === 'insurance_refund' || 
                                      activity.activity_type === 'equipment_purchase' || 
                                      activity.activity_type === 'expenses'
                                    ) && (
                                      <div className="mt-4 p-4 bg-white/60 rounded-xl border border-white/40">
                                        <div className="flex items-center gap-2">
                                          <span className="text-gray-500">
                                            {activity.activity_type === 'test' ? '🔬' :
                                             activity.activity_type === 'insurance_refund' ? '💰' : 
                                             activity.activity_type === 'equipment_purchase' ? '🛒' : '💸'}
                                          </span>
                                          <span className="font-medium text-gray-700">
                                            {activity.activity_type === 'test' ? 'Costo Esame:' :
                                             activity.activity_type === 'insurance_refund' ? 'Rimborso:' : 
                                             activity.activity_type === 'equipment_purchase' ? 'Costo Attrezzatura:' : 'Spese:'}
                                          </span>
                                          <span className={`text-lg font-bold ${
                                            activity.activity_type === 'insurance_refund' ? 'text-green-600' : 'text-red-600'
                                          }`}>
                                            {activity.amount} {activity.currency || 'EUR'}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Tag speciali per visite mediche */}
                                    {activity.activity_type === 'medical_visit' && activity.activity_description && (
                                      <div className="mt-3">
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                                          activity.activity_description === 'PRIMA VISITA' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                          activity.activity_description === 'VISITA DI CONTROLLO' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                          activity.activity_description === 'VISITA DI CHIUSURA' ? 'bg-green-100 text-green-800 border border-green-200' :
                                          'bg-gray-100 text-gray-800 border border-gray-200'
                                        }`}>
                                          {activity.activity_description === 'PRIMA VISITA' && '🆕'}
                                          {activity.activity_description === 'VISITA DI CONTROLLO' && '🔄'}
                                          {activity.activity_description === 'VISITA DI CHIUSURA' && '✅'}
                                          <span className="ml-1">{activity.activity_description}</span>
                                        </span>
                                      </div>
                                    )}
                          </div>
                        </div>
                              )
                            })
                        }
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}


    </div>
  )
}

export default InjuriesTab