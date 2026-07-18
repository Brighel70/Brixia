import React, { useState, useCallback } from 'react'
import { useTemplatesRicevute } from '../hooks/useTemplatesRicevute'
import { updateTemplateRicevuta, resetTemplateRicevutaToDefault } from '../api/templatesRicevute.api'
import { TemplateRicevutaCard } from './TemplateRicevutaCard'
import { TemplateEditorModal } from './TemplateEditorModal'
import { TemplatePreviewModal } from './TemplatePreviewModal'
import type { TemplateName } from '../types'
import { TEMPLATE_NAMES, TEMPLATE_LABELS } from '../constants'
import { toast } from 'sonner'

export function TemplatesRicevuteSection() {
  const { templates, loading, error, reload, isDefault } = useTemplatesRicevute()
  const [editorNome, setEditorNome] = useState<TemplateName | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  const templateMap = React.useMemo(() => {
    const m = new Map<string, (typeof templates)[0]>()
    templates.forEach(t => m.set(t.nome, t))
    return m
  }, [templates])

  const handleModifica = useCallback((nome: TemplateName) => {
    setEditorNome(nome)
  }, [])

  const handleAnteprima = useCallback((nome: TemplateName) => {
    const t = templateMap.get(nome)
    if (t?.contenuto_html) setPreviewHtml(t.contenuto_html)
  }, [templateMap])

  const handleRipristina = useCallback(async (nome: TemplateName) => {
    if (!confirm(`Ripristinare il template "${TEMPLATE_LABELS[nome]}" al contenuto default?`)) return
    try {
      await resetTemplateRicevutaToDefault(nome)
      await reload()
      toast.success('Template ripristinato al default')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore ripristino')
    }
  }, [reload])

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm min-h-0">
        <h2 className="text-2xl font-bold text-gray-900">Template Ricevute</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configura e anteprima i template PDF per ricevuta in soluzione unica e pagamento rateizzato.
        </p>
        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {TEMPLATE_NAMES.map(nome => {
                const template = templateMap.get(nome) ?? null
                const defaultFlag = template ? isDefault(nome as TemplateName, template.contenuto_html) : true
                return (
                  <TemplateRicevutaCard
                    key={nome}
                    nome={nome as TemplateName}
                    template={template}
                    isDefault={defaultFlag}
                    onModifica={() => handleModifica(nome as TemplateName)}
                    onAnteprima={() => handleAnteprima(nome as TemplateName)}
                    onRipristina={() => handleRipristina(nome as TemplateName)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      {editorNome && (
        <TemplateEditorModal
          isOpen={!!editorNome}
          nome={editorNome}
          initialHtml={templateMap.get(editorNome)?.contenuto_html ?? ''}
          onSave={async (html) => {
            await updateTemplateRicevuta(editorNome, html)
            await reload()
          }}
          onClose={() => setEditorNome(null)}
        />
      )}

      {previewHtml !== null && (
        <TemplatePreviewModal
          isOpen={true}
          html={previewHtml}
          onClose={() => setPreviewHtml(null)}
        />
      )}
    </div>
  )
}
