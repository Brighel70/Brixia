import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Pencil, Trash2, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'

export type TemplateType = 'whatsapp' | 'email' | 'altro'

export interface MessageTemplate {
  id: string
  type: TemplateType
  name: string
  content: string
  subject: string | null
  created_at?: string
  updated_at?: string
}

const TYPE_LABELS: Record<TemplateType, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  altro: 'Altro'
}

const TYPE_ICONS: Record<TemplateType, string> = {
  whatsapp: '💬',
  email: '📧',
  altro: '📝'
}

export default function MessageTemplatesManager() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<MessageTemplate>>({
    type: 'whatsapp',
    name: '',
    content: '',
    subject: ''
  })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('type')
        .order('name')

      if (error) throw error
      setTemplates(data || [])
    } catch (err: any) {
      console.error('Errore caricamento template:', err)
      setMessage({ type: 'error', text: err?.message || 'Errore nel caricamento' })
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleSave = async () => {
    if (!form.name?.trim() || !form.content?.trim()) {
      showMsg('error', 'Nome e contenuto sono obbligatori')
      return
    }

    try {
      const payload = {
        type: form.type || 'whatsapp',
        name: form.name.trim(),
        content: form.content.trim(),
        subject: form.subject?.trim() || null,
        updated_at: new Date().toISOString()
      }

      if (editingId) {
        const { error } = await supabase
          .from('message_templates')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
        showMsg('success', 'Template aggiornato')
      } else {
        const { error } = await supabase
          .from('message_templates')
          .insert(payload)

        if (error) throw error
        showMsg('success', 'Template creato')
      }

      setEditingId(null)
      setShowForm(false)
      setForm({ type: 'whatsapp', name: '', content: '', subject: '' })
      loadTemplates()
    } catch (err: any) {
      showMsg('error', err?.message || 'Errore nel salvataggio')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo template?')) return

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id)

      if (error) throw error
      showMsg('success', 'Template eliminato')
      loadTemplates()
      if (editingId === id) {
        setEditingId(null)
        setShowForm(false)
        setForm({ type: 'whatsapp', name: '', content: '', subject: '' })
      }
    } catch (err: any) {
      showMsg('error', err?.message || 'Errore nell\'eliminazione')
    }
  }

  const handleEdit = useCallback((id: string) => {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setEditingId(id)
    setForm({
      type: t.type,
      name: t.name,
      content: t.content,
      subject: t.subject || ''
    })
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [templates])

  const handleNew = () => {
    setEditingId(null)
    setForm({ type: 'whatsapp', name: '', content: '', subject: '' })
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const copyContent = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRowClick = (id: string) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
      handleEdit(id)
      return
    }
    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null
      setExpandedId((prev) => (prev === id ? null : id))
    }, 250)
  }


  if (loading) {
    return (
      <div className="card p-6">
        <div className="text-gray-500">Caricamento template...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-bold text-gray-900">Template Messaggi</h3>
          <button
            type="button"
            onClick={handleNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuovo template
          </button>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <p className="text-sm text-gray-600 mb-6">
          Crea e gestisci template per WhatsApp, Email e altri canali.
        </p>
        {/* Form aggiungi/modifica */}
        {showForm && (
          <div ref={formRef} className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200 ring-2 ring-blue-300">
            <h4 className="font-semibold text-gray-900 mb-4">
              {editingId ? 'Modifica template' : 'Nuovo template'}
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.type || 'whatsapp'}
                    onChange={(e) => setForm({ ...form, type: e.target.value as TemplateType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="es. Promemoria allenamento"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                </div>
              </div>
              {(form.type || 'whatsapp') === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto (per email)</label>
                  <input
                    type="text"
                    value={form.subject || ''}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="es. Promemoria allenamento"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenuto *</label>
                <textarea
                  value={form.content || ''}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Testo del messaggio. Usa {nome}, {cognome}, {data}..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 resize-y"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Salva
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setForm({ type: 'whatsapp', name: '', content: '', subject: '' })
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabella template con accordion */}
        {templates.length === 0 && !showForm ? (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-4">Nessun template ancora. Clicca &quot;Nuovo template&quot; per crearne uno.</p>
            <button
              type="button"
              onClick={handleNew}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Crea il primo template
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Clicca sulla riga per espandere il contenuto. Doppio clic o icona matita per modificare.
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.map((t) => (
                  <React.Fragment key={t.id}>
                    <tr
                      key={t.id}
                      onClick={() => handleRowClick(t.id)}
                      onDoubleClick={() => {
                        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
                        clickTimeoutRef.current = null
                        handleEdit(t.id)
                      }}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-3 text-gray-500">
                        {expandedId === t.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                          {TYPE_LABELS[t.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => copyContent(e, t.content, t.id)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                            title="Copia contenuto"
                          >
                            {copiedId === t.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(t.id)
                            }}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                            title="Modifica"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(t.id)
                            }}
                            className="p-1.5 rounded hover:bg-red-50 text-red-600"
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === t.id && (
                      <tr>
                        <td colSpan={4} className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          {t.type === 'email' && t.subject && (
                            <div className="text-sm text-gray-600 mb-2">
                              <strong>Oggetto:</strong> {t.subject}
                            </div>
                          )}
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-4 rounded border border-gray-200 max-h-48 overflow-auto">
                            {t.content}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
