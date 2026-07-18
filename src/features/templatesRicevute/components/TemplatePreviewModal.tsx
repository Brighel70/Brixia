import React, { useState, useEffect } from 'react'
import { renderTemplate, templateDataToRecord } from '../utils/renderTemplate'
import { getDemoRicevutaData } from '../utils/demoData'
import { generateRicevutaPDF, openPdfPreview } from '../utils/pdf'
import { toast } from 'sonner'
import { FileDown } from 'lucide-react'

interface TemplatePreviewModalProps {
  isOpen: boolean
  html: string
  onClose: () => void
}

export function TemplatePreviewModal({ isOpen, html, onClose }: TemplatePreviewModalProps) {
  const [renderedHtml, setRenderedHtml] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (isOpen && html) {
      const data = getDemoRicevutaData()
      const record = templateDataToRecord(data)
      setRenderedHtml(renderTemplate(html, record))
    }
  }, [isOpen, html])

  const handleGeneratePdf = async () => {
    setGenerating(true)
    try {
      const demoData = getDemoRicevutaData()
      const blob = await generateRicevutaPDF(html, demoData)
      openPdfPreview(blob)
      toast.success('Anteprima PDF aperta')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore generazione PDF')
    } finally {
      setGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Anteprima ricevuta</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              {generating ? 'Generazione...' : 'Genera PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Chiudi
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div
            className="mx-auto max-w-[600px] rounded border border-gray-200 bg-white p-6 shadow-sm"
            style={{ fontFamily: 'Inter, Arial, sans-serif', fontSize: 12 }}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      </div>
    </div>
  )
}
