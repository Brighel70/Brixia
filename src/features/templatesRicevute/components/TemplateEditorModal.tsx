import React, { useState, useEffect } from 'react'
import { RICEVUTA_PLACEHOLDERS, placeholderTag } from '../utils/placeholders'
import type { PlaceholderKey } from '../utils/placeholders'
import type { TemplateName } from '../types'
import { TEMPLATE_LABELS } from '../constants'
import { toast } from 'sonner'

interface TemplateEditorModalProps {
  isOpen: boolean
  nome: TemplateName | null
  initialHtml: string
  onSave: (html: string) => Promise<void>
  onClose: () => void
}

export function TemplateEditorModal({
  isOpen,
  nome,
  initialHtml,
  onSave,
  onClose
}: TemplateEditorModalProps) {
  const [html, setHtml] = useState(initialHtml)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) setHtml(initialHtml)
  }, [isOpen, initialHtml])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(html)
      toast.success('Template salvato')
      onClose()
    } catch {
      toast.error('Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const copyPlaceholder = (key: PlaceholderKey) => {
    const tag = placeholderTag(key)
    navigator.clipboard.writeText(tag)
    toast.success(`Copiato: ${tag}`)
  }

  if (!isOpen) return null

  const label = nome ? TEMPLATE_LABELS[nome] : 'Template'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Modifica template – {label}</h2>
          <p className="mt-1 text-sm text-gray-500">Placeholder disponibili (clicca per copiare):</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {RICEVUTA_PLACEHOLDERS.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => copyPlaceholder(key)}
                className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-700 hover:bg-gray-200"
              >
                {`{{${key}}}`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <textarea
            value={html}
            onChange={e => setHtml(e.target.value)}
            className="h-full w-full resize-none border-0 p-4 font-mono text-sm text-gray-900 focus:ring-0"
            rows={18}
            spellCheck={false}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}
