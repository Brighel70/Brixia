import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  generateRicevutaPDF,
  DATI_ANTEPRIMA,
  type DatiRicevuta
} from '@/lib/ricevutaPdfGenerator'
import { getDefaultTemplateHtml } from '@/lib/ricevutaTemplateDefaults'
import { FileText, Eye, RotateCcw, Pencil } from 'lucide-react'

const TEMPLATE_CONFIG = [
  { nome: 'ricevuta_soluzione_unica', label: 'Ricevuta - Soluzione Unica' },
  { nome: 'ricevuta_rateizzata', label: 'Ricevuta - Pagamento Rateizzato' }
] as const

interface TemplateRecord {
  id: string
  nome: string
  contenuto_html: string
  created_at?: string
  updated_at?: string
}

export default function TemplateRicevuteSection() {
  const [templates, setTemplates] = useState<Record<string, TemplateRecord>>({})
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingNome, setEditingNome] = useState<string | null>(null)
  const [editHtml, setEditHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('templates_documenti')
        .select('id, nome, contenuto_html, created_at, updated_at')
        .in('nome', TEMPLATE_CONFIG.map(t => t.nome))

      if (error) throw error
      const byName: Record<string, TemplateRecord> = {}
      ;(data || []).forEach((row: TemplateRecord) => {
        byName[row.nome] = row
      })
      setTemplates(byName)
    } catch (e) {
      console.error('Errore caricamento template ricevute:', e)
      setMessage('Errore nel caricamento dei template.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const openEdit = (nome: string) => {
    const rec = templates[nome]
    setEditingNome(nome)
    setEditHtml(rec?.contenuto_html?.trim() || getDefaultTemplateHtml(nome) || '')
    setEditModalOpen(true)
    setMessage('')
  }

  const closeEdit = () => {
    setEditModalOpen(false)
    setEditingNome(null)
    setEditHtml('')
  }

  const handleSave = async () => {
    if (!editingNome) return
    setSaving(true)
    setMessage('')
    try {
      const { error } = await supabase
        .from('templates_documenti')
        .update({ contenuto_html: editHtml, updated_at: new Date().toISOString() })
        .eq('nome', editingNome)

      if (error) throw error
      setMessage('Template salvato con successo.')
      await loadTemplates()
      setTimeout(() => {
        closeEdit()
        setMessage('')
      }, 800)
    } catch (e) {
      console.error('Errore salvataggio template:', e)
      setMessage('Errore nel salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  const handleAnteprima = async (nome: string) => {
    setPreviewLoading(nome)
    setMessage('')
    try {
      const blob = await generateRicevutaPDF(nome, DATI_ANTEPRIMA)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      console.error('Errore generazione PDF:', e)
      setMessage('Errore durante l\'anteprima PDF.')
    } finally {
      setPreviewLoading(null)
    }
  }

  const handleRipristinaDefault = async (nome: string) => {
    if (!confirm('Ripristinare il template predefinito? Il contenuto attuale verrà sostituito.')) return
    setRestoreLoading(nome)
    setMessage('')
    try {
      const defaultHtml = getDefaultTemplateHtml(nome)
      if (!defaultHtml) {
        setMessage('Nessun default disponibile per questo template.')
        return
      }
      const { error } = await supabase
        .from('templates_documenti')
        .update({ contenuto_html: defaultHtml, updated_at: new Date().toISOString() })
        .eq('nome', nome)

      if (error) throw error
      setMessage('Template ripristinato al default.')
      await loadTemplates()
    } catch (e) {
      console.error('Errore ripristino template:', e)
      setMessage('Errore nel ripristino.')
    } finally {
      setRestoreLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <p className="text-gray-500">Caricamento template...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-navy mb-2">Template Ricevute</h2>
        <p className="text-gray-600 mb-6">
          Configura i template HTML per le ricevute di pagamento (soluzione unica e rateizzata). Usa i placeholder per i dati dinamici.
        </p>
        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.includes('Errore') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            {message}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {TEMPLATE_CONFIG.map(({ nome, label }) => (
            <div
              key={nome}
              className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(nome)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Modifica Template
                </button>
                <button
                  type="button"
                  onClick={() => handleAnteprima(nome)}
                  disabled={!!previewLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  {previewLoading === nome ? 'Generazione...' : 'Anteprima PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRipristinaDefault(nome)}
                  disabled={!!restoreLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  {restoreLoading === nome ? 'Ripristino...' : 'Ripristina Default'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal modifica template */}
      {editModalOpen && editingNome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Modifica template: {TEMPLATE_CONFIG.find(t => t.nome === editingNome)?.label || editingNome}
              </h3>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Contenuto HTML</label>
              <textarea
                value={editHtml}
                onChange={(e) => setEditHtml(e.target.value)}
                className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm text-gray-900 bg-white resize-y"
                placeholder="HTML con placeholder {{nome_pagante}}, {{importo}}, ecc."
                spellCheck={false}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEdit}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
