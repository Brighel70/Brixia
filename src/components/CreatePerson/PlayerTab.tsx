import React from 'react'
import { PersonForm } from '@/hooks/usePersonForm'

interface PlayerTabProps {
  form: PersonForm
  handleInputChange: (field: string, value: any) => void
  isFieldDisabled: () => boolean
  isEditing: boolean
  isEditMode: boolean
  categories: Array<{ id: string; name: string }>
  playerPositions: Array<{ id: string; name: string }>
}

const PlayerTab: React.FC<PlayerTabProps> = ({
  form,
  handleInputChange,
  isFieldDisabled,
  isEditing,
  isEditMode,
  categories,
  playerPositions
}) => {
  return (
    <div className={`space-y-6 ${form.injured ? 'bg-red-50 rounded-lg p-4' : ''}`}>
      {/* Header con titolo e badge - Layout migliorato */}
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Giocatore</h2>
        
        {/* Card per categoria e ruoli in modalità sola lettura */}
        {isEditing && !isEditMode && (
          <div className="flex flex-wrap gap-2 ml-2">
            {/* Card Categoria */}
            {form.player_categories.length > 0 && form.player_categories.map(categoryId => {
              const category = categories.find(cat => cat.id === categoryId)
              return category ? (
                <div key={categoryId} className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {category.name}
                </div>
              ) : null
            })}
            
            {/* Card Ruoli */}
            {form.player_positions.length > 0 && form.player_positions.map(roleId => {
              const role = playerPositions.find(r => r.id === roleId)
              return role ? (
                <div key={roleId} className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {role.name}
                </div>
              ) : null
            })}

            {/* Card Squalificato */}
            {form.disqualified && (
              <div className="inline-flex items-center bg-red-100 text-red-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                SQUALIFICATO
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Informazioni di base - Layout migliorato */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Codice FIR - 4 colonne */}
        <div className="md:col-span-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Codice FIR
            </div>
          </label>
          <input
            type="text"
            value={form.fir_code}
            onChange={(e) => handleInputChange('fir_code', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900 transition-colors"
          />
        </div>
        
        {/* Squalificato */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Squalificato
          </label>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={form.disqualified || false}
              onChange={(e) => handleInputChange('disqualified', e.target.checked)}
              disabled={isFieldDisabled()}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label className="ml-2 text-sm text-gray-700">
              Giocatore squalificato
            </label>
          </div>
        </div>

        {/* Data Scadenza Squalifica - Visibile solo se squalificato */}
        {form.disqualified && (
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Data Scadenza Squalifica
              </div>
            </label>
            <input
              type="date"
              value={form.disqualification_end_date || ''}
              onChange={(e) => handleInputChange('disqualification_end_date', e.target.value)}
              disabled={isFieldDisabled()}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500 transition-colors"
            />
          </div>
        )}

        {/* Note Squalifica - Visibile solo se squalificato */}
        {form.disqualified && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Note
              </div>
            </label>
            <input
              type="text"
              value={form.disqualification_notes || ''}
              onChange={(e) => handleInputChange('disqualification_notes', e.target.value)}
              disabled={isFieldDisabled()}
              placeholder="Motivo squalifica..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500 transition-colors"
            />
          </div>
        )}
      </div>

      {/* TODO: Aggiungere qui il resto del contenuto del PlayerTab quando sarà estratto dal file principale */}
    </div>
  )
}

export default PlayerTab







