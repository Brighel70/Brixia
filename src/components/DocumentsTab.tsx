import React from 'react'

interface DocumentsTabProps {
  form: any
  handleInputChange: (field: string, value: string) => void
  isFieldDisabled: () => boolean
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ 
  form, 
  handleInputChange, 
  isFieldDisabled 
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Numero Tessera - 2 colonne */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Numero Tessera
          </label>
          <input
            type="text"
            value={form.membership_number}
            onChange={(e) => handleInputChange('membership_number', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
            placeholder="Numero tessera associativa"
          />
        </div>
        
        {/* Codice FIR - 2 colonne */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Codice FIR
          </label>
          <input
            type="text"
            value={form.fir_code}
            onChange={(e) => handleInputChange('fir_code', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-white disabled:text-gray-900"
            placeholder="Codice identificativo FIR"
          />
        </div>
      </div>
      
      {/* Sezione Upload Documenti */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Documenti</h3>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              Trascina qui i documenti o clicca per selezionare
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PDF, JPG, PNG fino a 10MB
            </p>
          </div>
          
          {/* Lista documenti caricati */}
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Nessun documento caricato</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentsTab


