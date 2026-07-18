import React from 'react'
import { PersonForm } from '@/hooks/usePersonForm'

interface CreatePersonHeaderProps {
  form: PersonForm
  isEditing: boolean
  isEditMode: boolean
  isTutor: boolean
  isStaff: boolean
  categories: Array<{ id: string; name: string }>
  playerPositions: Array<{ id: string; name: string }>
  getHeaderTitle: () => string
  getHeaderSubtitle: () => string | undefined
  getHeaderBadges: () => JSX.Element | undefined
}

const CreatePersonHeader: React.FC<CreatePersonHeaderProps> = ({
  form,
  isEditing,
  isEditMode,
  isTutor,
  isStaff,
  categories,
  playerPositions,
  getHeaderTitle,
  getHeaderSubtitle,
  getHeaderBadges
}) => {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="px-6 py-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Titolo principale */}
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {getHeaderTitle()}
              </h1>
              
              {/* Badges per ruoli e categorie */}
              {getHeaderBadges()}
            </div>
            
            {/* Sottotitolo */}
            {getHeaderSubtitle() && (
              <p className="text-gray-600 text-sm">
                {getHeaderSubtitle()}
              </p>
            )}
            
            {/* ID Persona (solo in modalità modifica) */}
            {isEditing && form.id && (
              <div className="mt-3 text-xs text-gray-500">
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  ID: {form.id}
                </span>
              </div>
            )}
          </div>
          
          {/* Indicatori di stato */}
          <div className="flex items-center gap-2">
            {isEditing && !isEditMode && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Visualizzazione
              </span>
            )}
            
            {isEditing && isEditMode && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Modifica
              </span>
            )}
            
            {!isEditing && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Nuovo
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreatePersonHeader







