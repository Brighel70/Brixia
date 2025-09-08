import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Injury {
  id: string
  person_id: string
  injury_date: string
  injury_type: string
  severity: 'Lieve' | 'Moderato' | 'Grave'
  body_part: string
  cause: string
  current_status: 'In corso' | 'Guarito' | 'Ricaduta'
  expected_weeks_off?: number
  is_closed?: boolean
  injury_closed_date?: string
}

interface InjuryEditModalProps {
  isOpen: boolean
  onClose: () => void
  injury: Injury | null
  onSave: () => void
  personId: string
}

const InjuryEditModal: React.FC<InjuryEditModalProps> = ({ isOpen, onClose, injury, onSave, personId }) => {
  const [formData, setFormData] = useState({
    injury_type: '',
    severity: 'Lieve' as const,
    body_part: '',
    cause: '',
    current_status: 'In corso' as const,
    expected_weeks_off: '',
    injury_date: new Date().toISOString().split('T')[0] // Data di oggi come default
  })
  const [loading, setLoading] = useState(false)

  // Popola il form quando si apre
  useEffect(() => {
    if (injury) {
      setFormData({
        injury_type: injury.injury_type || '',
        severity: injury.severity || 'Lieve',
        body_part: injury.body_part || '',
        cause: injury.cause || '',
        current_status: injury.current_status || 'In corso',
        expected_weeks_off: injury.expected_weeks_off?.toString() || '',
        injury_date: injury.injury_date ? injury.injury_date.split('T')[0] : new Date().toISOString().split('T')[0]
      })
    } else {
      // Reset per nuovo infortunio
      setFormData({
        injury_type: '',
        severity: 'Lieve',
        body_part: '',
        cause: '',
        current_status: 'In corso',
        expected_weeks_off: '',
        injury_date: new Date().toISOString().split('T')[0]
      })
    }
  }, [injury, isOpen])

  const handleSave = async () => {
    if (!formData.injury_type || !formData.body_part || !formData.cause) {
      alert('Compila i campi obbligatori')
      return
    }

    // Verifica che personId sia valido
    if (!personId || personId === '') {
      alert('Errore: ID persona non valido. Salva prima la persona.')
      return
    }

    // Verifica che la persona esista nel database
    try {
      const { data: personExists, error: personError } = await supabase
        .from('people')
        .select('id')
        .eq('id', personId)
        .single()

      if (personError || !personExists) {
        alert('Errore: Persona non trovata nel database. Salva prima la persona.')
        return
      }
    } catch (error) {
      console.error('Errore nella verifica persona:', error)
      alert('Errore nella verifica persona. Riprova.')
      return
    }

    try {
      setLoading(true)
      

      if (injury) {
        // MODIFICA infortunio esistente
        
        const updateData = {
          injury_type: formData.injury_type,
          severity: formData.severity,
          body_part: formData.body_part,
          cause: formData.cause,
          current_status: formData.current_status,
          expected_weeks_off: formData.expected_weeks_off ? parseInt(formData.expected_weeks_off) : null,
          injury_date: formData.injury_date,
          updated_at: new Date().toISOString()
        }
        
        
        const { error } = await supabase
          .from('injuries')
          .update(updateData)
          .eq('id', injury.id)

        if (error) {
          console.error('❌ Errore Supabase:', error)
          throw error
        }
      } else {
        // CREA nuovo infortunio
        
        const insertData = {
          person_id: personId,
          injury_type: formData.injury_type,
          severity: formData.severity,
          body_part: formData.body_part,
          cause: formData.cause,
          current_status: formData.current_status,
          expected_weeks_off: formData.expected_weeks_off ? parseInt(formData.expected_weeks_off) : null,
          injury_date: formData.injury_date,
          is_closed: false,
          injury_closed_date: null
        }
        
        
        const { error } = await supabase
          .from('injuries')
          .insert(insertData)

        if (error) {
          console.error('❌ Errore Supabase:', error)
          throw error
        }
      }

      onSave()
      onClose()
    } catch (err) {
      console.error('❌ Errore nel salvataggio:', err)
      alert('Errore nel salvataggio: ' + (err as any)?.message || 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {injury ? 'Modifica Infortunio' : 'Nuovo Infortunio'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipologia Infortunio *</label>
            <input
              type="text"
              value={formData.injury_type}
              onChange={(e) => setFormData({ ...formData, injury_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Es. Distorsione, Frattura, Strappo..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gravità</label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Lieve">Lieve</option>
              <option value="Moderato">Moderato</option>
              <option value="Grave">Grave</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parte del Corpo *</label>
            <input
              type="text"
              value={formData.body_part}
              onChange={(e) => setFormData({ ...formData, body_part: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Es. Ginocchio DX, Spalla SX..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Causa *</label>
            <select
              value={formData.cause}
              onChange={(e) => setFormData({ ...formData, cause: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleziona causa</option>
              <option value="Allenamento">Allenamento</option>
              <option value="Partita">Partita</option>
              <option value="Infortunio precedente">Infortunio precedente</option>
              <option value="Altro">Altro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stato Attuale</label>
            <select
              value={formData.current_status}
              onChange={(e) => setFormData({ ...formData, current_status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="In corso">In corso</option>
              <option value="Guarito">Guarito</option>
              <option value="Ricaduta">Ricaduta</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Infortunio</label>
            <input
              type="date"
              value={formData.injury_date}
              onChange={(e) => setFormData({ ...formData, injury_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Previsione Stop (Giorni)</label>
            <input
              type="number"
              value={formData.expected_weeks_off}
              onChange={(e) => setFormData({ ...formData, expected_weeks_off: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Es. 28 (4 settimane)"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvataggio...' : injury ? 'Aggiorna' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default InjuryEditModal
