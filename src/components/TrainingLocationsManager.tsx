import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface TrainingLocation {
  id: string
  category_id: string
  location: string
  weekday: string
  start_time: string
  end_time: string
}

interface Category {
  id: string
  code: string
  name: string
  active: boolean
  sort: number
}

interface TrainingLocationsManagerProps {
  categoryId: string
  onClose: () => void
}

const WEEKDAYS = [
  { value: 'monday', label: 'Lunedì' },
  { value: 'tuesday', label: 'Martedì' },
  { value: 'wednesday', label: 'Mercoledì' },
  { value: 'thursday', label: 'Giovedì' },
  { value: 'friday', label: 'Venerdì' },
  { value: 'saturday', label: 'Sabato' },
  { value: 'sunday', label: 'Domenica' }
]

const LOCATIONS = [
  'Brescia',
  'Gussago',
  'Ospitaletto',
  'Trasferta',
  'Altro'
]

const TrainingLocationsManager: React.FC<TrainingLocationsManagerProps> = ({ categoryId, onClose }) => {
  const [locations, setLocations] = useState<TrainingLocation[]>([])
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState<TrainingLocation | null>(null)
  const [newLocation, setNewLocation] = useState({
    location: '',
    weekday: '',
    start_time: '',
    end_time: ''
  })

  useEffect(() => {
    if (categoryId) {
      loadData()
    }
  }, [categoryId])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadLocations(),
        loadCategory()
      ])
    } catch (error) {
      console.error('Errore nel caricamento dati:', error)
      setMessage('Errore nel caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('training_locations')
        .select('*')
        .eq('category_id', categoryId)
        .order('weekday, start_time')

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('Errore nel caricamento sedi allenamento:', error)
      throw error
    }
  }

  const loadCategory = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', categoryId)
        .single()

      if (error) throw error
      setCategory(data)
    } catch (error) {
      console.error('Errore nel caricamento categoria:', error)
      throw error
    }
  }

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLocation.location || !newLocation.weekday || !newLocation.start_time || !newLocation.end_time) {
      setMessage('❌ Tutti i campi sono obbligatori')
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('training_locations')
        .insert({
          category_id: categoryId,
          location: newLocation.location.trim(),
          weekday: newLocation.weekday,
          start_time: newLocation.start_time,
          end_time: newLocation.end_time
        })

      if (error) throw error

      setMessage('✅ Sede di allenamento aggiunta con successo!')
      setNewLocation({ location: '', weekday: '', start_time: '', end_time: '' })
      setShowAddForm(false)
      loadLocations()
    } catch (error: any) {
      console.error('Errore nell\'aggiunta sede allenamento:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEditLocation = (location: TrainingLocation) => {
    setEditingLocation(location)
    setNewLocation({
      location: location.location,
      weekday: location.weekday,
      start_time: location.start_time,
      end_time: location.end_time
    })
    setShowAddForm(true)
  }

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLocation || !newLocation.location || !newLocation.weekday || !newLocation.start_time || !newLocation.end_time) {
      setMessage('❌ Tutti i campi sono obbligatori')
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('training_locations')
        .update({
          location: newLocation.location.trim(),
          weekday: newLocation.weekday,
          start_time: newLocation.start_time,
          end_time: newLocation.end_time
        })
        .eq('id', editingLocation.id)

      if (error) throw error

      setMessage('✅ Sede di allenamento aggiornata con successo!')
      setEditingLocation(null)
      setNewLocation({ location: '', weekday: '', start_time: '', end_time: '' })
      setShowAddForm(false)
      loadLocations()
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento sede allenamento:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa sede di allenamento?')) {
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('training_locations')
        .delete()
        .eq('id', locationId)

      if (error) throw error

      setMessage('✅ Sede di allenamento eliminata con successo!')
      loadLocations()
    } catch (error: any) {
      console.error('Errore nell\'eliminazione sede allenamento:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingLocation(null)
    setNewLocation({ location: '', weekday: '', start_time: '', end_time: '' })
    setShowAddForm(false)
  }

  const getWeekdayLabel = (weekday: string) => {
    return WEEKDAYS.find(w => w.value === weekday)?.label || weekday
  }

  const groupLocationsByWeekday = () => {
    const grouped = locations.reduce((acc, location) => {
      if (!acc[location.weekday]) {
        acc[location.weekday] = []
      }
      acc[location.weekday].push(location)
      return acc
    }, {} as Record<string, TrainingLocation[]>)

    // Ordina per giorno della settimana
    const orderedWeekdays = WEEKDAYS.map(w => w.value)
    const sortedGrouped: Record<string, TrainingLocation[]> = {}
    
    orderedWeekdays.forEach(weekday => {
      if (grouped[weekday]) {
        sortedGrouped[weekday] = grouped[weekday].sort((a, b) => 
          a.start_time.localeCompare(b.start_time)
        )
      }
    })

    return sortedGrouped
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Caricamento sedi allenamento...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Sedi di Allenamento - {category?.name}
          </h2>
          <p className="text-gray-600">
            Gestisci le sedi e gli orari di allenamento per la categoria {category?.code}
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          ✕ Chiudi
        </button>
      </div>

      {/* Messaggio */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.startsWith('✅') 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* Aggiungi/Modifica Form */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingLocation ? 'Modifica Sede di Allenamento' : 'Aggiungi Sede di Allenamento'}
          </h3>
          
          <form onSubmit={editingLocation ? handleUpdateLocation : handleAddLocation}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sede *
                </label>
                <select
                  value={newLocation.location}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleziona sede</option>
                  {LOCATIONS.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Giorno della Settimana *
                </label>
                <select
                  value={newLocation.weekday}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, weekday: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleziona giorno</option>
                  {WEEKDAYS.map(weekday => (
                    <option key={weekday.value} value={weekday.value}>{weekday.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ora Inizio *
                </label>
                <input
                  type="time"
                  value={newLocation.start_time}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, start_time: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ora Fine *
                </label>
                <input
                  type="time"
                  value={newLocation.end_time}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, end_time: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : (editingLocation ? 'Aggiorna' : 'Aggiungi')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista Sedi */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Sedi Configurate ({locations.length})
          </h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
          >
            ➕ Aggiungi Sede
          </button>
        </div>

        {locations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🏟️</div>
            <p>Nessuna sede di allenamento configurata</p>
            <p className="text-sm">Clicca "Aggiungi Sede" per iniziare</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupLocationsByWeekday()).map(([weekday, weekdayLocations]) => (
              <div key={weekday} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">
                  {getWeekdayLabel(weekday)}
                </h4>
                <div className="space-y-2">
                  {weekdayLocations.map(location => (
                    <div key={location.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{location.location}</div>
                        <div className="text-sm text-gray-500">
                          {location.start_time} - {location.end_time}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditLocation(location)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Modifica"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(location.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Elimina"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TrainingLocationsManager


