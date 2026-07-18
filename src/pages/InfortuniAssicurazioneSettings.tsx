import { useState, useEffect } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabaseClient'

export interface InjuryActivityType {
  id: string
  name: string
  code: string
  sort_order: number
  active: boolean
  created_at?: string
}

export interface InsuranceEventType {
  id: string
  name: string
  sort_order: number
  active: boolean
  created_at?: string
}

export type DocumentAssignee = 'assicurazione' | 'csen' | 'atleta'

export interface InjuryDocumentType {
  id: string
  name: string
  sort_order: number
  active: boolean
  created_at?: string
}

export interface InjuryDocumentTypeWithAssignees extends InjuryDocumentType {
  assignees: DocumentAssignee[]
}

function slugCode(name: string): string {
  const s = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  return s || 'type_' + Date.now()
}

export default function InfortuniAssicurazioneSettings() {
  const [activityTypes, setActivityTypes] = useState<InjuryActivityType[]>([])
  const [activityTypesLoading, setActivityTypesLoading] = useState(true)
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [activityEditingId, setActivityEditingId] = useState<string | null>(null)
  const [activityFormName, setActivityFormName] = useState('')
  const [activityFormSortOrder, setActivityFormSortOrder] = useState(0)
  const [activityFormActive, setActivityFormActive] = useState(true)
  const [activitySaving, setActivitySaving] = useState(false)
  const [activityDraggedIndex, setActivityDraggedIndex] = useState<number | null>(null)
  const [activityDragOverIndex, setActivityDragOverIndex] = useState<number | null>(null)
  const [activitySavingOrder, setActivitySavingOrder] = useState(false)

  const [types, setTypes] = useState<InsuranceEventType[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [formActive, setFormActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const [docTypes, setDocTypes] = useState<InjuryDocumentTypeWithAssignees[]>([])
  const [docTypesLoading, setDocTypesLoading] = useState(false)
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [docEditingId, setDocEditingId] = useState<string | null>(null)
  const [docFormName, setDocFormName] = useState('')
  const [docFormAssignees, setDocFormAssignees] = useState<DocumentAssignee[]>([])
  const [docSaving, setDocSaving] = useState(false)
  const [docDraggedIndex, setDocDraggedIndex] = useState<number | null>(null)
  const [docDragOverIndex, setDocDragOverIndex] = useState<number | null>(null)
  const [docSavingOrder, setDocSavingOrder] = useState(false)

  interface EmailTemplate {
    id: string
    name: string
    destinatario: DocumentAssignee
    body: string
    sort_order: number
    created_at?: string
  }
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateEditingId, setTemplateEditingId] = useState<string | null>(null)
  const [templateFormName, setTemplateFormName] = useState('')
  const [templateFormDestinatario, setTemplateFormDestinatario] = useState<DocumentAssignee>('assicurazione')
  const [templateFormBody, setTemplateFormBody] = useState('')
  const [templateFormDocumentTypeIds, setTemplateFormDocumentTypeIds] = useState<string[]>([])
  const [templateSaving, setTemplateSaving] = useState(false)

  const loadTypes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('insurance_event_types')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setTypes((data as InsuranceEventType[]) || [])
    } catch (e: any) {
      console.error(e)
      setMessage('Errore nel caricamento. Verifica che la tabella insurance_event_types esista (esegui lo script SQL).')
      setTypes([])
    } finally {
      setLoading(false)
    }
  }

  const loadActivityTypes = async () => {
    try {
      setActivityTypesLoading(true)
      const { data, error } = await supabase
        .from('injury_activity_types')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      setActivityTypes((data as InjuryActivityType[]) || [])
    } catch (e: any) {
      console.error(e)
      setMessage('Errore nel caricamento tipi di attività. Verifica che la tabella injury_activity_types esista (esegui lo script SQL).')
      setActivityTypes([])
    } finally {
      setActivityTypesLoading(false)
    }
  }

  useEffect(() => {
    loadActivityTypes()
    loadTypes()
    loadDocTypes()
    loadEmailTemplates()
  }, [])

  const loadEmailTemplates = async () => {
    try {
      setEmailTemplatesLoading(true)
      const { data, error } = await supabase
        .from('injury_email_templates')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      setEmailTemplates((data as EmailTemplate[]) || [])
    } catch (e: any) {
      console.error(e)
      setEmailTemplates([])
    } finally {
      setEmailTemplatesLoading(false)
    }
  }
  const openTemplateCreate = () => {
    setTemplateEditingId(null)
    setTemplateFormName('')
    setTemplateFormDestinatario('assicurazione')
    setTemplateFormBody('')
    setTemplateFormDocumentTypeIds([])
    setTemplateModalOpen(true)
  }
  const openTemplateEdit = async (row: EmailTemplate) => {
    setTemplateEditingId(row.id)
    setTemplateFormName(row.name)
    setTemplateFormDestinatario(row.destinatario)
    setTemplateFormBody(row.body)
    setTemplateModalOpen(true)
    try {
      const { data } = await supabase
        .from('injury_email_template_document_types')
        .select('document_type_id')
        .eq('template_id', row.id)
      setTemplateFormDocumentTypeIds((data || []).map((r: { document_type_id: string }) => r.document_type_id))
    } catch {
      setTemplateFormDocumentTypeIds([])
    }
  }
  const saveTemplate = async () => {
    const name = templateFormName.trim()
    if (!name) {
      setMessage('Inserisci il nome del template.')
      return
    }
    setTemplateSaving(true)
    setMessage('')
    try {
      let templateId: string
      if (templateEditingId) {
        templateId = templateEditingId
        await supabase.from('injury_email_templates').update({
          name,
          destinatario: templateFormDestinatario,
          body: templateFormBody
        }).eq('id', templateId)
      } else {
        const { data: ins, error: insErr } = await supabase.from('injury_email_templates').insert({
          name,
          destinatario: templateFormDestinatario,
          body: templateFormBody
        }).select('id')
        if (insErr) throw insErr
        templateId = (ins as any)?.[0]?.id
        if (!templateId) throw new Error('Creazione template fallita')
      }
      await supabase.from('injury_email_template_document_types').delete().eq('template_id', templateId)
      if (templateFormDocumentTypeIds.length > 0) {
        await supabase.from('injury_email_template_document_types').insert(
          templateFormDocumentTypeIds.map(document_type_id => ({ template_id: templateId, document_type_id }))
        )
      }
      setMessage('Template email salvato.')
      setTemplateModalOpen(false)
      loadEmailTemplates()
    } catch (e: any) {
      setMessage(e?.message || 'Errore salvataggio.')
    } finally {
      setTemplateSaving(false)
    }
  }
  const removeTemplate = async (id: string) => {
    if (!confirm('Eliminare questo template?')) return
    try {
      await supabase.from('injury_email_templates').delete().eq('id', id)
      setMessage('Template eliminato.')
      loadEmailTemplates()
    } catch (e: any) {
      setMessage(e?.message || 'Errore eliminazione.')
    }
  }
  const destLabel = (d: DocumentAssignee) => d === 'assicurazione' ? 'Assicurazione' : d === 'csen' ? 'Csen' : 'Atleta'

  const loadDocTypes = async () => {
    try {
      setDocTypesLoading(true)
      const { data: typesData, error: e1 } = await supabase
        .from('injury_document_types')
        .select('*')
        .order('sort_order', { ascending: true })
      if (e1) throw e1
      const { data: assigneesData, error: e2 } = await supabase
        .from('injury_document_type_assignees')
        .select('document_type_id, assignee')
      if (e2) throw e2
      const assigneesByType: Record<string, DocumentAssignee[]> = {}
      ;(assigneesData || []).forEach((r: { document_type_id: string; assignee: DocumentAssignee }) => {
        if (!assigneesByType[r.document_type_id]) assigneesByType[r.document_type_id] = []
        assigneesByType[r.document_type_id].push(r.assignee)
      })
      setDocTypes(((typesData || []) as InjuryDocumentType[]).map(t => ({
        ...t,
        assignees: assigneesByType[t.id] || []
      })))
    } catch (e: any) {
      console.error(e)
      setDocTypes([])
    } finally {
      setDocTypesLoading(false)
    }
  }

  const openDocCreate = () => {
    setDocEditingId(null)
    setDocFormName('')
    setDocFormAssignees([])
    setDocModalOpen(true)
  }
  const openDocEdit = (row: InjuryDocumentTypeWithAssignees) => {
    setDocEditingId(row.id)
    setDocFormName(row.name)
    setDocFormAssignees(row.assignees || [])
    setDocModalOpen(true)
  }
  const toggleDocAssignee = (a: DocumentAssignee) => {
    setDocFormAssignees(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }
  const saveDocType = async () => {
    const name = docFormName.trim()
    if (!name) {
      setMessage('Inserisci il nome del tipo di documento.')
      return
    }
    if (docFormAssignees.length === 0) {
      setMessage('Seleziona almeno un destinatario (Assicurazione, Csen, Atleta).')
      return
    }
    setDocSaving(true)
    setMessage('')
    try {
      let typeId: string
      if (docEditingId) {
        typeId = docEditingId
        await supabase.from('injury_document_types').update({ name }).eq('id', typeId)
        await supabase.from('injury_document_type_assignees').delete().eq('document_type_id', typeId)
      } else {
        const { data: ins, error: er } = await supabase.from('injury_document_types').insert([{ name }]).select()
        if (er) throw er
        const id = (ins as any)?.[0]?.id
        if (!id) throw new Error('Creazione tipo fallita')
        typeId = id
      }
      await supabase.from('injury_document_type_assignees').insert(
        docFormAssignees.map(assignee => ({ document_type_id: typeId, assignee }))
      )
      setMessage('Tipo di documento salvato.')
      setDocModalOpen(false)
      loadDocTypes()
    } catch (e: any) {
      setMessage(e?.message || 'Errore salvataggio.')
    } finally {
      setDocSaving(false)
    }
  }
  const removeDocType = async (id: string) => {
    if (!confirm('Eliminare questo tipo di documento?')) return
    try {
      await supabase.from('injury_document_type_assignees').delete().eq('document_type_id', id)
      await supabase.from('injury_document_types').delete().eq('id', id)
      setMessage('Tipo di documento eliminato.')
      loadDocTypes()
    } catch (e: any) {
      setMessage(e?.message || 'Errore eliminazione.')
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setFormName('')
    setFormSortOrder(types.length > 0 ? Math.max(...types.map(t => t.sort_order), 0) + 1 : 1)
    setFormActive(true)
    setModalOpen(true)
  }

  const openEdit = (row: InsuranceEventType) => {
    setEditingId(row.id)
    setFormName(row.name)
    setFormSortOrder(row.sort_order)
    setFormActive(row.active)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  const save = async () => {
    const name = formName.trim()
    if (!name) {
      setMessage('Inserisci il nome del tipo di evento.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      if (editingId) {
        const { error } = await supabase
          .from('insurance_event_types')
          .update({ name, sort_order: formSortOrder, active: formActive })
          .eq('id', editingId)
        if (error) throw error
        setMessage('Tipo di evento aggiornato.')
      } else {
        const { error } = await supabase
          .from('insurance_event_types')
          .insert([{ name, sort_order: formSortOrder, active: formActive }])
        if (error) throw error
        setMessage('Tipo di evento aggiunto.')
      }
      closeModal()
      loadTypes()
    } catch (e: any) {
      setMessage(e.message || 'Errore durante il salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Eliminare questo tipo di evento? Non verranno eliminati gli eventi già registrati.')) return
    try {
      const { error } = await supabase.from('insurance_event_types').delete().eq('id', id)
      if (error) throw error
      setMessage('Tipo di evento eliminato.')
      loadTypes()
    } catch (e: any) {
      setMessage(e.message || 'Errore durante l\'eliminazione.')
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.setData('text/html', (e.target as HTMLElement).innerHTML)
  }

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = async (e: React.DragEvent<HTMLTableRowElement>, toIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)
    setDraggedIndex(null)
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (fromIndex === toIndex) return
    const reordered = [...types]
    const [removed] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, removed)
    setTypes(reordered)
    setSavingOrder(true)
    setMessage('')
    try {
      await Promise.all(
        reordered.map((row, i) =>
          supabase.from('insurance_event_types').update({ sort_order: i + 1 }).eq('id', row.id)
        )
      )
      setMessage('Ordine aggiornato.')
    } catch (err: any) {
      setMessage(err.message || 'Errore nel salvataggio dell\'ordine.')
      loadTypes()
    } finally {
      setSavingOrder(false)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDocDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDocDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
  const handleDocDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDocDragOverIndex(index)
  }
  const handleDocDragLeave = () => setDocDragOverIndex(null)
  const handleDocDrop = async (e: React.DragEvent<HTMLTableRowElement>, toIndex: number) => {
    e.preventDefault()
    setDocDragOverIndex(null)
    setDocDraggedIndex(null)
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (fromIndex === toIndex) return
    const reordered = [...docTypes]
    const [removed] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, removed)
    setDocTypes(reordered)
    setDocSavingOrder(true)
    setMessage('')
    try {
      await Promise.all(
        reordered.map((row, i) =>
          supabase.from('injury_document_types').update({ sort_order: i }).eq('id', row.id)
        )
      )
      setMessage('Ordine tipi di documento aggiornato.')
    } catch (err: any) {
      setMessage(err?.message || 'Errore nel salvataggio dell\'ordine.')
      loadDocTypes()
    } finally {
      setDocSavingOrder(false)
    }
  }
  const handleDocDragEnd = () => {
    setDocDraggedIndex(null)
    setDocDragOverIndex(null)
  }

  const openActivityCreate = () => {
    setActivityEditingId(null)
    setActivityFormName('')
    setActivityFormSortOrder(activityTypes.length > 0 ? Math.max(...activityTypes.map(t => t.sort_order), 0) + 1 : 1)
    setActivityFormActive(true)
    setActivityModalOpen(true)
  }
  const openActivityEdit = (row: InjuryActivityType) => {
    setActivityEditingId(row.id)
    setActivityFormName(row.name)
    setActivityFormSortOrder(row.sort_order)
    setActivityFormActive(row.active)
    setActivityModalOpen(true)
  }
  const saveActivityType = async () => {
    const name = activityFormName.trim()
    if (!name) {
      setMessage('Inserisci il nome del tipo di attività.')
      return
    }
    setActivitySaving(true)
    setMessage('')
    try {
      if (activityEditingId) {
        await supabase
          .from('injury_activity_types')
          .update({ name, sort_order: activityFormSortOrder, active: activityFormActive })
          .eq('id', activityEditingId)
        setMessage('Tipo di attività aggiornato.')
      } else {
        let code = slugCode(name)
        const { error: insErr } = await supabase
          .from('injury_activity_types')
          .insert([{ name, code, sort_order: activityFormSortOrder, active: activityFormActive }])
        if (insErr && insErr.code === '23505') {
          code = code + '_' + Math.random().toString(36).slice(2, 9)
          const { error: retryErr } = await supabase
            .from('injury_activity_types')
            .insert([{ name, code, sort_order: activityFormSortOrder, active: activityFormActive }])
          if (retryErr) throw retryErr
        } else if (insErr) throw insErr
        setMessage('Tipo di attività aggiunto.')
      }
      setActivityModalOpen(false)
      loadActivityTypes()
    } catch (e: any) {
      setMessage(e?.message || 'Errore durante il salvataggio.')
    } finally {
      setActivitySaving(false)
    }
  }
  const removeActivityType = async (id: string) => {
    if (!confirm('Eliminare questo tipo di attività? Le attività già registrate con questo tipo non verranno eliminate.')) return
    try {
      await supabase.from('injury_activity_types').delete().eq('id', id)
      setMessage('Tipo di attività eliminato.')
      loadActivityTypes()
    } catch (e: any) {
      setMessage(e?.message || 'Errore durante l\'eliminazione.')
    }
  }
  const handleActivityDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setActivityDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
  const handleActivityDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setActivityDragOverIndex(index)
  }
  const handleActivityDragLeave = () => setActivityDragOverIndex(null)
  const handleActivityDrop = async (e: React.DragEvent<HTMLTableRowElement>, toIndex: number) => {
    e.preventDefault()
    setActivityDragOverIndex(null)
    setActivityDraggedIndex(null)
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (fromIndex === toIndex) return
    const reordered = [...activityTypes]
    const [removed] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, removed)
    setActivityTypes(reordered)
    setActivitySavingOrder(true)
    setMessage('')
    try {
      await Promise.all(
        reordered.map((row, i) =>
          supabase.from('injury_activity_types').update({ sort_order: i + 1 }).eq('id', row.id)
        )
      )
      setMessage('Ordine tipi di attività aggiornato.')
    } catch (err: any) {
      setMessage(err?.message || 'Errore nel salvataggio dell\'ordine.')
      loadActivityTypes()
    } finally {
      setActivitySavingOrder(false)
    }
  }
  const handleActivityDragEnd = () => {
    setActivityDraggedIndex(null)
    setActivityDragOverIndex(null)
  }

  return (
    <div>
      <Header title="Infermeria / Assicurazione" showBack={true} />
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tipi di attività (menu "Tipo di Attività" nel modal Aggiungi Attività) */}
        <div className="card p-4">
          <h2 className="text-base font-bold text-navy mb-1">Tipi di attività</h2>
          <p className="text-xs text-gray-600 mb-2">
            Le voci che aggiungi qui compaiono nel menu &quot;Tipo di Attività&quot; quando, nella scheda di un giocatore (Infermeria), apri il modal per creare una nuova attività. L&apos;ordine che imposti qui viene mantenuto nel popup.
          </p>
          {activityTypesLoading ? (
            <p className="text-gray-500 text-xs">Caricamento...</p>
          ) : (
            <>
              <div className="flex justify-end mb-2">
                <button type="button" onClick={openActivityCreate} className="btn bg-sky text-white px-3 py-1.5 text-xs">
                  + Aggiungi tipo
                </button>
              </div>
              {activityTypes.length === 0 ? (
                <p className="text-gray-500 py-2 text-xs">Nessun tipo. Esegui lo script SQL per creare la tabella e i tipi predefiniti.</p>
              ) : (
                <>
                  {activitySavingOrder && <p className="text-xs text-amber-600 mb-1">Salvataggio...</p>}
                  <p className="text-xs text-gray-500 mb-1">Trascina per riordinare.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="p-1.5 w-6" aria-label="Trascina" />
                          <th className="p-1.5 font-semibold text-gray-700">Nome</th>
                          <th className="p-1.5 font-semibold text-gray-700">Ord.</th>
                          <th className="p-1.5 font-semibold text-gray-700">Attivo</th>
                          <th className="p-1.5 font-semibold text-gray-700">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityTypes.map((row, index) => (
                          <tr
                            key={row.id}
                            draggable
                            onDragStart={(e) => handleActivityDragStart(e, index)}
                            onDragOver={(e) => handleActivityDragOver(e, index)}
                            onDragLeave={handleActivityDragLeave}
                            onDrop={(e) => handleActivityDrop(e, index)}
                            onDragEnd={handleActivityDragEnd}
                            className={`border-t border-gray-200 hover:bg-gray-50 select-none cursor-grab active:cursor-grabbing ${
                              activityDraggedIndex === index ? 'opacity-50 bg-gray-100' : ''
                            } ${activityDragOverIndex === index ? 'bg-amber-50 border-l-2 border-l-amber-400' : ''}`}
                          >
                            <td className="p-1.5 text-gray-400">⋮⋮</td>
                            <td className="p-1.5 text-gray-800 truncate max-w-[120px]">{row.name}</td>
                            <td className="p-1.5 text-gray-600">{row.sort_order}</td>
                            <td className="p-1.5">{row.active ? 'Sì' : 'No'}</td>
                            <td className="p-1.5 flex items-center gap-1">
                              <button type="button" onClick={() => openActivityEdit(row)} className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50" title="Modifica" aria-label="Modifica"><Pencil className="w-4 h-4" /></button>
                              <button type="button" onClick={() => removeActivityType(row.id)} className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50" title="Elimina" aria-label="Elimina"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="card p-4">
          <h2 className="text-base font-bold text-navy mb-1">Tipi di evento assicurazione</h2>
          <p className="text-xs text-gray-600 mb-2">
            I tipi che aggiungi qui compaiono nel menu &quot;Tipo evento&quot; quando, nella scheda di un giocatore (Infermeria), si apre il modal per inserire un nuovo evento assicurazione.
          </p>

          {loading ? (
            <p className="text-gray-500">Caricamento...</p>
          ) : (
            <>
              <div className="flex justify-end mb-2">
                <button type="button" onClick={openCreate} className="btn bg-sky text-white px-3 py-1.5 text-xs">
                  + Aggiungi tipo
                </button>
              </div>
              {types.length === 0 ? (
                <p className="text-gray-500 py-2 text-xs">Nessun tipo di evento.</p>
              ) : (
                <>
                  {savingOrder && <p className="text-xs text-amber-600 mb-1">Salvataggio...</p>}
                  <p className="text-xs text-gray-500 mb-1">Trascina per riordinare.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="p-1.5 w-6" aria-label="Trascina" />
                          <th className="p-1.5 font-semibold text-gray-700">Nome</th>
                          <th className="p-1.5 font-semibold text-gray-700">Ord.</th>
                          <th className="p-1.5 font-semibold text-gray-700">Attivo</th>
                          <th className="p-1.5 font-semibold text-gray-700">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {types.map((row, index) => (
                          <tr
                            key={row.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`border-t border-gray-200 hover:bg-gray-50 select-none cursor-grab active:cursor-grabbing ${
                              draggedIndex === index ? 'opacity-50 bg-gray-100' : ''
                            } ${dragOverIndex === index ? 'bg-amber-50 border-l-2 border-l-amber-400' : ''}`}
                          >
                            <td className="p-1.5 text-gray-400">⋮⋮</td>
                            <td className="p-1.5 text-gray-800 truncate max-w-[120px]">{row.name}</td>
                            <td className="p-1.5 text-gray-600">{row.sort_order}</td>
                            <td className="p-1.5">{row.active ? 'Sì' : 'No'}</td>
                            <td className="p-1.5 flex items-center gap-1">
                              <button type="button" onClick={() => openEdit(row)} className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50" title="Modifica" aria-label="Modifica"><Pencil className="w-4 h-4" /></button>
                              <button type="button" onClick={() => remove(row.id)} className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50" title="Elimina" aria-label="Elimina"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="card p-4">
          <h2 className="text-base font-bold text-navy mb-1">Tipi di documento</h2>
          <p className="text-xs text-gray-600 mb-2">
            Tipi di documento caricabili nel tab Documentazione di ogni infortunio. Per ogni tipo indica i destinatari (Assicurazione, Csen, Atleta) che compariranno nel secondo menu.
          </p>
          {docTypesLoading ? (
            <p className="text-gray-500 text-xs">Caricamento...</p>
          ) : (
            <>
              <div className="flex justify-end mb-2">
                <button type="button" onClick={openDocCreate} className="btn bg-sky text-white px-3 py-1.5 text-xs">
                  + Aggiungi tipo
                </button>
              </div>
              {docTypes.length === 0 ? (
                <p className="text-gray-500 py-2 text-xs">Nessun tipo di documento.</p>
              ) : (
                <>
                  {docSavingOrder && <p className="text-xs text-amber-600 mb-1">Salvataggio...</p>}
                  <p className="text-xs text-gray-500 mb-1">Trascina per riordinare.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 rounded text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="p-1.5 w-6" aria-label="Trascina" />
                          <th className="p-1.5 font-semibold text-gray-700">Nome tipo</th>
                          <th className="p-1.5 font-semibold text-gray-700">Destinatari</th>
                          <th className="p-1.5 font-semibold text-gray-700">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docTypes.map((row, index) => (
                          <tr
                            key={row.id}
                            draggable
                            onDragStart={(e) => handleDocDragStart(e, index)}
                            onDragOver={(e) => handleDocDragOver(e, index)}
                            onDragLeave={handleDocDragLeave}
                            onDrop={(e) => handleDocDrop(e, index)}
                            onDragEnd={handleDocDragEnd}
                            className={`border-t border-gray-200 hover:bg-gray-50 select-none cursor-grab active:cursor-grabbing ${
                              docDraggedIndex === index ? 'opacity-50 bg-gray-100' : ''
                            } ${docDragOverIndex === index ? 'bg-amber-50 border-l-2 border-l-amber-400' : ''}`}
                          >
                            <td className="p-1.5 text-gray-400">⋮⋮</td>
                            <td className="p-1.5 text-gray-800 truncate max-w-[100px]">{row.name}</td>
                            <td className="p-1.5">
                              {row.assignees.length === 0 ? (
                                <span className="text-gray-400">—</span>
                              ) : (
                                row.assignees.map(a => (
                                  <span key={a} className="mr-0.5 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                                    {a === 'assicurazione' ? 'Ass.' : a === 'csen' ? 'Csen' : 'Atleta'}
                                  </span>
                                ))
                              )}
                            </td>
                            <td className="p-1.5">
                              <button type="button" onClick={() => openDocEdit(row)} className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50" title="Modifica" aria-label="Modifica"><Pencil className="w-4 h-4" /></button>
                              <button type="button" onClick={() => removeDocType(row.id)} className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50 ml-0.5" title="Elimina" aria-label="Elimina"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        </div>

        <div className="card p-6 mt-6">
          <h2 className="text-xl font-bold text-navy mb-2">Template email</h2>
          <p className="text-sm text-gray-600 mb-4">
            Crea template di testo da incollare nel corpo dell&apos;email in base al destinatario (Assicurazione, Csen, Atleta).
          </p>
          {emailTemplatesLoading ? (
            <p className="text-gray-500">Caricamento...</p>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button type="button" onClick={openTemplateCreate} className="btn bg-sky text-white px-4 py-2 text-sm">
                  + Aggiungi template
                </button>
              </div>
              {emailTemplates.length === 0 ? (
                <p className="text-gray-500 py-4">Nessun template. Aggiungine uno per incollarlo automaticamente in base al destinatario.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="p-3 font-semibold text-gray-700">Nome</th>
                        <th className="p-3 font-semibold text-gray-700">Destinatario</th>
                        <th className="p-3 font-semibold text-gray-700">Anteprima</th>
                        <th className="p-3 font-semibold text-gray-700">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailTemplates.map((row) => (
                        <tr key={row.id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="p-3 text-gray-800 font-medium">{row.name}</td>
                          <td className="p-3">
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">{destLabel(row.destinatario)}</span>
                          </td>
                          <td className="p-3 text-gray-600 max-w-xs truncate">{row.body || '—'}</td>
                          <td className="p-3">
                            <button type="button" onClick={() => openTemplateEdit(row)} className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50" title="Modifica" aria-label="Modifica"><Pencil className="w-4 h-4" /></button>
                            <button type="button" onClick={() => removeTemplate(row.id)} className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50 ml-1" title="Elimina" aria-label="Elimina"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${message.startsWith('Errore') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Modal Tipi di attività */}
      {activityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {activityEditingId ? 'Modifica tipo di attività' : 'Aggiungi tipo di attività'}
            </h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nome <span className="text-red-500">*</span></span>
                <input
                  type="text"
                  value={activityFormName}
                  onChange={(e) => setActivityFormName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="es. Visita Medica"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Ordine</span>
                <input
                  type="number"
                  min={0}
                  value={activityFormSortOrder}
                  onChange={(e) => setActivityFormSortOrder(parseInt(e.target.value, 10) || 0)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={activityFormActive}
                  onChange={(e) => setActivityFormActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Attivo (visibile nel menu)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setActivityModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Annulla</button>
              <button type="button" onClick={saveActivityType} disabled={activitySaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">{activitySaving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aggiungi/Modifica - si chiude solo con Annulla o Salva, non cliccando fuori */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Modifica tipo di evento' : 'Aggiungi tipo di evento'}
            </h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nome <span className="text-red-500">*</span></span>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="es. Documentazione integrativa inviata"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Ordine</span>
                <input
                  type="number"
                  min={0}
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value, 10) || 0)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Attivo (visibile nel menu)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Annulla
              </button>
              <button type="button" onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tipi di documento */}
      {docModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{docEditingId ? 'Modifica tipo di documento' : 'Aggiungi tipo di documento'}</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nome tipo (primo campo in Documentazione) <span className="text-red-500">*</span></span>
                <input
                  type="text"
                  value={docFormName}
                  onChange={(e) => setDocFormName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="es. Certificato medico"
                />
              </label>
              <div>
                <span className="text-sm font-medium text-gray-700">Destinatari (secondo campo) <span className="text-red-500">*</span></span>
                <div className="mt-2 space-y-2">
                  {(['assicurazione', 'csen', 'atleta'] as DocumentAssignee[]).map(a => (
                    <label key={a} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={docFormAssignees.includes(a)}
                        onChange={() => toggleDocAssignee(a)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{a === 'assicurazione' ? 'Assicurazione' : a === 'csen' ? 'Csen' : 'Atleta'}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDocModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Annulla</button>
              <button type="button" onClick={saveDocType} disabled={docSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">{docSaving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Template email */}
      {templateModalOpen && (() => {
        const docTypesForDestinatario = docTypes.filter(dt => dt.assignees.includes(templateFormDestinatario))
        const toggleTemplateDocType = (id: string) => {
          setTemplateFormDocumentTypeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
        }
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full p-6 max-h-[90vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{templateEditingId ? 'Modifica template email' : 'Aggiungi template email'}</h3>
            <div className="flex gap-6 flex-1 min-h-0">
              <div className="flex-1 min-w-0 flex flex-col space-y-3 overflow-y-auto">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Nome <span className="text-red-500">*</span></span>
                  <input
                    type="text"
                    value={templateFormName}
                    onChange={(e) => setTemplateFormName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="es. Richiesta documenti assicurazione"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Destinatario</span>
                  <select
                    value={templateFormDestinatario}
                    onChange={(e) => setTemplateFormDestinatario(e.target.value as DocumentAssignee)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="assicurazione">Assicurazione</option>
                    <option value="csen">Csen</option>
                    <option value="atleta">Atleta</option>
                  </select>
                </label>
                <label className="block flex-1 min-h-0 flex flex-col">
                  <span className="text-sm font-medium text-gray-700">Corpo (testo da incollare nell&apos;email)</span>
                  <textarea
                    value={templateFormBody}
                    onChange={(e) => setTemplateFormBody(e.target.value)}
                    rows={16}
                    className="mt-1 block w-full flex-1 min-h-[280px] rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y"
                    placeholder="Inserisci il testo del template..."
                  />
                </label>
              </div>
              <div className="w-64 shrink-0 border-l border-gray-200 pl-4 flex flex-col overflow-y-auto">
                <span className="text-sm font-medium text-gray-700 mb-2">Tipi di documento da allegare</span>
                <p className="text-xs text-gray-500 mb-2">Se presenti per l&apos;infortunio, verranno allegati all&apos;email.</p>
                {docTypesForDestinatario.length === 0 ? (
                  <p className="text-xs text-gray-500">Nessun tipo con destinatario {destLabel(templateFormDestinatario)}.</p>
                ) : (
                  <div className="space-y-2">
                    {docTypesForDestinatario.map(dt => (
                      <label key={dt.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={templateFormDocumentTypeIds.includes(dt.id)}
                          onChange={() => toggleTemplateDocType(dt.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-800">{dt.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
              <button type="button" onClick={() => setTemplateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Annulla</button>
              <button type="button" onClick={saveTemplate} disabled={templateSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">{templateSaving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
