import React from 'react'
import type { TemplateName } from '../types'
import type { TemplateDocumentoRow } from '../types'
import { TEMPLATE_LABELS } from '../constants'
import { FileText, Edit3, RotateCcw } from 'lucide-react'

interface TemplateRicevutaCardProps {
  nome: TemplateName
  template: TemplateDocumentoRow | null
  isDefault: boolean
  onModifica: () => void
  onAnteprima: () => void
  onRipristina: () => void
  loading?: boolean
  saving?: boolean
}

export function TemplateRicevutaCard({
  nome,
  template,
  isDefault,
  onModifica,
  onAnteprima,
  onRipristina,
  loading,
  saving
}: TemplateRicevutaCardProps) {
  const label = TEMPLATE_LABELS[nome]
  const busy = loading || saving

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <FileText className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{label}</h3>
          <span className={`text-sm ${isDefault ? 'text-green-600' : 'text-amber-600'}`}>
            {isDefault ? 'Default' : 'Modificato'}
          </span>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onModifica}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <Edit3 className="h-4 w-4" />
          Modifica Template
        </button>
        <button
          type="button"
          onClick={onAnteprima}
          disabled={busy || !template?.contenuto_html}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          Anteprima PDF
        </button>
        <button
          type="button"
          onClick={onRipristina}
          disabled={busy || isDefault}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Ripristina Default
        </button>
      </div>
    </div>
  )
}
