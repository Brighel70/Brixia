import { useState, useEffect, useCallback } from 'react'
import { fetchTemplatesRicevute } from '../api/templatesRicevute.api'
import type { TemplateDocumentoRow } from '../types'
import type { TemplateName } from '../types'
import { DEFAULT_TEMPLATES } from '../utils/defaultTemplates'

export function useTemplatesRicevute() {
  const [templates, setTemplates] = useState<TemplateDocumentoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTemplatesRicevute()
      setTemplates(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento template')
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** True se il contenuto corrente è uguale al default (per mostrare "Default" vs "Modificato") */
  function isDefault(nome: TemplateName, contenuto_html: string): boolean {
    return (DEFAULT_TEMPLATES[nome] || '').trim() === (contenuto_html || '').trim()
  }

  return { templates, loading, error, reload: load, isDefault }
}
