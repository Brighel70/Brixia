import { supabase } from '@/lib/supabaseClient'
import type { TemplateName } from '../types'
import type { TemplateDocumentoRow } from '../types'
import { DEFAULT_TEMPLATES } from '../utils/defaultTemplates'
import { TEMPLATE_NAMES } from '../constants'

const TABLE = 'templates_documenti'

/** Recupera entrambi i template per nome */
export async function fetchTemplatesRicevute(): Promise<TemplateDocumentoRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, nome, contenuto_html, created_at, updated_at')
    .in('nome', TEMPLATE_NAMES)
    .order('nome')

  if (error) throw error
  return (data || []) as TemplateDocumentoRow[]
}

/** Recupera un singolo template per nome */
export async function fetchTemplateRicevuta(nome: TemplateName): Promise<TemplateDocumentoRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, nome, contenuto_html, created_at, updated_at')
    .eq('nome', nome)
    .maybeSingle()

  if (error) throw error
  return data as TemplateDocumentoRow | null
}

/** Aggiorna il contenuto HTML di un template */
export async function updateTemplateRicevuta(nome: TemplateName, contenuto_html: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ contenuto_html })
    .eq('nome', nome)

  if (error) throw error
}

/** Ripristina il template al contenuto default (da codice) */
export async function resetTemplateRicevutaToDefault(nome: TemplateName): Promise<void> {
  const defaultHtml = DEFAULT_TEMPLATES[nome]
  await updateTemplateRicevuta(nome, defaultHtml)
}
