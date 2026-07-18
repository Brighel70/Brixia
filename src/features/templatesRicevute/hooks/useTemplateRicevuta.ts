import { useState, useCallback } from 'react'
import {
  fetchTemplateRicevuta,
  updateTemplateRicevuta,
  resetTemplateRicevutaToDefault
} from '../api/templatesRicevute.api'
import type { TemplateName } from '../types'
import type { TemplateDocumentoRow } from '../types'

export function useTemplateRicevuta(nome: TemplateName | null) {
  const [template, setTemplate] = useState<TemplateDocumentoRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!nome) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTemplateRicevuta(nome)
      setTemplate(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento')
      setTemplate(null)
    } finally {
      setLoading(false)
    }
  }, [nome])

  const update = useCallback(async (contenuto_html: string) => {
    if (!nome) return
    setSaving(true)
    setError(null)
    try {
      await updateTemplateRicevuta(nome, contenuto_html)
      setTemplate(prev => (prev ? { ...prev, contenuto_html } : null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore salvataggio')
      throw e
    } finally {
      setSaving(false)
    }
  }, [nome])

  const resetToDefault = useCallback(async () => {
    if (!nome) return
    setSaving(true)
    setError(null)
    try {
      await resetTemplateRicevutaToDefault(nome)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore ripristino')
      throw e
    } finally {
      setSaving(false)
    }
  }, [nome, load])

  return { template, loading, saving, error, load, update, resetToDefault }
}
