import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/store/auth'
import { formatCurrency } from '@/utils/feeUtils'
import {
  getActivityAmountValue,
  getActivityCardStyle,
  getActivityCostDisplay,
  isEquipmentCostActivityType,
  isPurchaseActivityType,
  isTestCostActivityType,
} from '@/utils/injuryActivityDisplay'

interface Injury {
  id: string
  person_id: string
  injury_date: string
  injury_type: string
  severity: 'Lieve' | 'Moderato' | 'Grave'
  body_part: string
  body_part_description?: string
  cause: string
  treating_doctor?: string
  current_status: 'In corso' | 'Guarito' | 'Ricaduta'
  expected_weeks_off?: number
  is_closed?: boolean
  injury_closed_date?: string
  in_chiusura?: boolean
}

interface InjuryActivity {
  id: string
  injury_id: string
  activity_type: 'medical_visit' | 'physiotherapy' | 'test' | 'note' | 'insurance_refund' | 'equipment_purchase' | 'expenses' | 'insurance_communication' | 'other'
  activity_date: string
  operator_name?: string
  duration_minutes?: number
  activity_description?: string
  notes?: string
  amount?: number
  currency?: string
  ricontrollo?: string
  ricontrollo_time?: string
  massaggio?: boolean
  tecar?: boolean
  laser?: boolean
  can_play_field?: boolean
  can_play_gym?: boolean
  expected_stop_days?: number
  created_at: string
  // Campi sezione Assicurazione (primo evento)
  csen_sent_date?: string | null
  claim_opening_date?: string | null
  adjuster?: string | null
  claim_number_1?: string | null
  claim_number_2?: string | null
}

type DocumentAssignee = 'assicurazione' | 'csen' | 'atleta'

interface InjuryReminder {
  id: string
  injury_id: string
  content: string
  reminder_at: string | null
  created_at: string
  updated_at: string
  is_public?: boolean
  created_by?: string | null
  creator_name?: string | null
}

interface InjuryDocumentTypeWithAssignees {
  id: string
  name: string
  sort_order: number
  active: boolean
  assignees: DocumentAssignee[]
}

interface InjuryDocument {
  id: string
  injury_id: string
  name: string
  file_path: string
  category: DocumentAssignee | 'altro'
  file_size?: number
  file_type?: string
  created_at: string
}

interface InjuriesTabProps {
  personId: string
  canEdit?: boolean
  onNoteAdded?: () => void
  onInjuryCreated?: () => void
  onAddInjury?: () => void
  onOpenInjuryModal?: (injury: any) => void
  onOpenDeleteModal?: (injury: any) => void
  onOpenActivityForm?: (injuryId: string) => void
  onOpenActivityFormWithType?: (injuryId: string, activityType: string) => void
  onOpenDeleteActivityModal?: (activityId: string, injuryId: string, activityType: string) => void
  onOpenEditActivityForm?: (activity: InjuryActivity) => void
  refreshTrigger?: number // Aggiungiamo un trigger per forzare il refresh
  /** Nome giocatore, numero tessera CSEN e data emissione (dalla sezione Giocatore) */
  playerDisplayName?: string
  csenCard?: string
  csenCardIssuedAt?: string
  /** Se true (es. tab Infortuni appena selezionato), espande automaticamente il primo accordion infortunio */
  isTabActive?: boolean
}

// Fallback se la tabella insurance_event_types non è ancora presente
const INSURANCE_EVENT_TYPES_FALLBACK = [
  'documentazione inviata allo Csen',
  'Documentazione integrativa inviata',
  'Richiesta rimborso',
  'Comunicazione con liquidatore',
  'Chiusura pratica',
  'Altro'
]

const ASSIGNEE_LABELS: Record<DocumentAssignee | 'altro', string> = { assicurazione: 'Assicurazione', csen: 'Csen', atleta: 'Atleta', altro: 'Altro' }

const SPESA_TICKET_LABEL = 'Spesa Ticket'

const sanitizeInjuryDocFilename = (s: string) => s.replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '') || 'documento'

const isMobileDevice = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true
  return navigator.maxTouchPoints > 0 && window.matchMedia('(max-width: 768px)').matches
}

const getInjuryDocumentFilename = (doc: InjuryDocument) => {
  const ext = doc.file_path.split('.').pop() || (doc.file_type?.includes('pdf') ? 'pdf' : 'bin')
  return `${sanitizeInjuryDocFilename(doc.name)}.${ext}`
}

function InjuryDocumentsSection({
  injuryId,
  documents,
  documentTypes,
  uploading,
  onUpload,
  onPreview,
  onSave,
  onDelete
}: {
  injuryId: string
  documents: InjuryDocument[]
  documentTypes: InjuryDocumentTypeWithAssignees[]
  uploading: boolean
  onUpload: (injuryId: string, file: File, typeName: string, assignee: DocumentAssignee) => void
  onPreview: (doc: InjuryDocument) => void
  onSave: (doc: InjuryDocument) => void
  onDelete: (doc: InjuryDocument) => void
}) {
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [selectedAssignee, setSelectedAssignee] = useState<DocumentAssignee | ''>('')
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [spesaTicketModalOpen, setSpesaTicketModalOpen] = useState(false)
  const [spesaTicketSuffix, setSpesaTicketSuffix] = useState('')

  const selectedType = documentTypes.find(t => t.id === selectedTypeId)
  const assigneeOptions = selectedType?.assignees || []
  const isSpesaTicket = selectedType?.name === SPESA_TICKET_LABEL

  const resetUploadForm = () => {
    setFile(null)
    setSelectedTypeId('')
    setSelectedAssignee('')
    setSpesaTicketModalOpen(false)
    setSpesaTicketSuffix('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const startUpload = (selectedFile: File, typeName: string) => {
    if (!selectedType || !selectedAssignee) return
    onUpload(injuryId, selectedFile, typeName, selectedAssignee as DocumentAssignee)
    resetUploadForm()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (selectedType && selectedAssignee) {
      if (isSpesaTicket) {
        setSpesaTicketModalOpen(true)
      } else {
        startUpload(f, selectedType.name)
      }
    }
  }

  const doUpload = (typeName: string) => {
    if (!file || !selectedType || !selectedAssignee) return
    startUpload(file, typeName)
  }

  const handleUploadClick = () => {
    if (!selectedType || !selectedAssignee) {
      alert('Seleziona tipo di documento e destinatario.')
      return
    }
    if (!file) {
      fileInputRef.current?.click()
      return
    }
    if (isSpesaTicket) {
      setSpesaTicketModalOpen(true)
      return
    }
    doUpload(selectedType.name)
  }

  const confirmSpesaTicketUpload = () => {
    const suffix = spesaTicketSuffix.trim()
    const typeName = suffix ? `${SPESA_TICKET_LABEL} ${suffix}` : SPESA_TICKET_LABEL
    doUpload(typeName)
  }

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />
      <div className="flex flex-wrap items-end gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Tipo documento</label>
          <select
            value={selectedTypeId}
            onChange={(e) => { setSelectedTypeId(e.target.value); setSelectedAssignee('') }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-48 min-w-0 text-gray-900 bg-white"
          >
            <option value="">Seleziona tipo</option>
            {documentTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Destinatario</label>
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value as DocumentAssignee | '')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-40 min-w-0 text-gray-900 bg-white"
            disabled={!selectedTypeId}
          >
            <option value="">Seleziona</option>
            {assigneeOptions.map(a => (
              <option key={a} value={a}>{ASSIGNEE_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[12rem] flex-1">
          <label className="text-xs font-medium text-gray-600">File</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-left min-w-0"
          >
            <svg className="w-4 h-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className={`truncate ${file ? 'text-gray-900 font-medium' : 'text-gray-500 italic'}`}>
              {file ? file.name : 'Nessun file selezionato'}
            </span>
          </button>
        </div>
        <div className="flex items-end gap-1">
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={!selectedType || !selectedAssignee || uploading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            title={!file ? 'Apre la finestra per scegliere il file' : 'Carica il documento'}
          >
            {uploading ? 'Caricamento...' : file ? 'Carica' : 'Scegli file'}
          </button>
          {(file || selectedTypeId || selectedAssignee) && (
            <button
              type="button"
              onClick={resetUploadForm}
              disabled={uploading}
              className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-red-50 hover:border-red-200 text-gray-500 hover:text-red-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-gray-500"
              title="Annulla caricamento"
              aria-label="Annulla caricamento"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <ul className="space-y-2">
        {documents.length === 0 ? (
          <li className="text-sm text-gray-500 py-2">Nessun documento caricato.</li>
        ) : (
          documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
              <div>
                <span className="font-medium text-gray-900">{doc.name}</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{ASSIGNEE_LABELS[doc.category as DocumentAssignee | 'altro']}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPreview(doc)}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  title="Anteprima"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button type="button" onClick={() => onSave(doc)} className="text-blue-600 hover:text-blue-800 text-sm">Scarica</button>
                <button type="button" onClick={() => onDelete(doc)} className="text-red-600 hover:text-red-800 text-sm">Elimina</button>
              </div>
            </li>
          ))
        )}
      </ul>

      {spesaTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSpesaTicketModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-lg p-4 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-gray-700 mb-2">Aggiungi dettaglio al titolo (es. Risonanza)</p>
            <input
              type="text"
              value={spesaTicketSuffix}
              onChange={e => setSpesaTicketSuffix(e.target.value)}
              placeholder="es. Risonanza"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4 text-gray-900 bg-white"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') confirmSpesaTicketUpload(); if (e.key === 'Escape') setSpesaTicketModalOpen(false) }}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSpesaTicketModalOpen(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button>
              <button type="button" onClick={confirmSpesaTicketUpload} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const InjuriesTab: React.FC<InjuriesTabProps> = ({ personId, canEdit = false, onNoteAdded, onInjuryCreated, onAddInjury, onOpenInjuryModal, onOpenDeleteModal, onOpenActivityForm, onOpenActivityFormWithType, onOpenDeleteActivityModal, onOpenEditActivityForm, refreshTrigger, playerDisplayName, csenCard, csenCardIssuedAt, isTabActive = false }) => {
  const { userId } = useAuth()
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedInjury, setExpandedInjury] = useState<string | null>(null)
  const prevTabActiveRef = useRef(false)
  const prevInjuriesLengthRef = useRef(0)
  const [injuryTabByInjuryId, setInjuryTabByInjuryId] = useState<Record<string, 'documentazione' | 'infortuni' | 'assicurazione' | 'promemoria'>>({})
  const [injuryReminders, setInjuryReminders] = useState<Record<string, InjuryReminder[]>>({})
  const [reminderModal, setReminderModal] = useState<{ open: boolean; injuryId: string; reminder: InjuryReminder | null }>({ open: false, injuryId: '', reminder: null })
  const [reminderForm, setReminderForm] = useState({ content: '', reminderDate: '', reminderTime: '', isPublic: true })
  const [injuryDocuments, setInjuryDocuments] = useState<Record<string, InjuryDocument[]>>({})
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [injuryDocumentTypes, setInjuryDocumentTypes] = useState<InjuryDocumentTypeWithAssignees[]>([])
  const [activities, setActivities] = useState<Record<string, InjuryActivity[]>>({})
  const [filteredActivityTypes, setFilteredActivityTypes] = useState<Record<string, string[]>>({})
  // Tipi di evento assicurazione caricati da DB (Impostazioni > Infortuni/Assicurazione)
  const [insuranceEventTypes, setInsuranceEventTypes] = useState<string[]>([])
  // Tipi di attività (menu "Tipo di Attività" nel modal Aggiungi Attività) - per etichette e ordine
  const [injuryActivityTypes, setInjuryActivityTypes] = useState<Array<{ id: string; name: string; code: string; sort_order: number }>>([])
  // Modal nuovo evento assicurazione (quando esiste già il primo evento)
  const [newInsuranceEventModal, setNewInsuranceEventModal] = useState<{ open: boolean; injuryId: string | null }>({ open: false, injuryId: null })
  const [newInsuranceEventDate, setNewInsuranceEventDate] = useState(() => new Date().toISOString().split('T')[0])
  const [newInsuranceEventType, setNewInsuranceEventType] = useState('')
  const [savingNewInsuranceEvent, setSavingNewInsuranceEvent] = useState(false)
  const [sendEmailModal, setSendEmailModal] = useState<{ open: boolean; injuryId: string | null }>({ open: false, injuryId: null })
  const [sendEmailTo, setSendEmailTo] = useState('')
  const [sendEmailSending, setSendEmailSending] = useState(false)

  const effectiveEventTypes = insuranceEventTypes.length > 0 ? insuranceEventTypes : INSURANCE_EVENT_TYPES_FALLBACK

  // Carica infortuni
  const loadInjuries = async () => {
    if (!personId) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('injuries')
        .select('*')
        .eq('person_id', personId)
        .order('injury_date', { ascending: false })

      if (error) throw error
      setInjuries(data || [])
    } catch (error) {
      console.error('Errore nel caricamento degli infortuni:', error)
    } finally {
      setLoading(false)
    }
  }

  // Carica attività per un infortunio specifico
  const loadActivities = async (injuryId: string) => {
    try {
      console.log('🔍 Loading activities for injury:', injuryId)
      const { data, error } = await supabase
        .from('injury_activities')
        .select('*')
        .eq('injury_id', injuryId)
        .order('activity_date', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Error loading activities:', error)
        throw error
      }
      
      console.log('✅ Activities loaded:', data)
      console.log('🔍 First activity COMPLETE object:', data?.[0])
      console.log('🔍 First activity details:', data?.[0] ? {
        can_play_field: data[0].can_play_field,
        can_play_gym: data[0].can_play_gym,
        activity_type: data[0].activity_type,
        operator_name: data[0].operator_name,
        activity_description: data[0].activity_description
      } : 'No activities')
      setActivities(prev => ({
        ...prev,
        [injuryId]: data || []
      }))
    } catch (error) {
      console.error('Errore nel caricamento delle attività:', error)
    }
  }

  const loadInjuryDocuments = async (injuryId: string) => {
    try {
      const { data, error } = await supabase
        .from('injury_documents')
        .select('*')
        .eq('injury_id', injuryId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setInjuryDocuments(prev => ({ ...prev, [injuryId]: (data as InjuryDocument[]) || [] }))
    } catch (e) {
      console.error('Errore caricamento documenti infortunio:', e)
      setInjuryDocuments(prev => ({ ...prev, [injuryId]: [] }))
    }
  }

  const loadInjuryReminders = async (injuryId: string) => {
    try {
      const { data, error } = await supabase
        .from('injury_reminders')
        .select('*')
        .eq('injury_id', injuryId)
        .order('reminder_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const reminders = (data || []) as InjuryReminder[]
      const creatorIds = [...new Set(reminders.map(r => r.created_by).filter(Boolean))] as string[]
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds)
        const creatorMap: Record<string, string> = Object.fromEntries((profs || []).map(p => [p.id, p.full_name || 'Utente']))
        reminders.forEach(r => { r.creator_name = r.created_by ? creatorMap[r.created_by] : null })
      }
      setInjuryReminders(prev => ({ ...prev, [injuryId]: reminders }))
    } catch (e) {
      console.error('Errore caricamento promemoria:', e)
      setInjuryReminders(prev => ({ ...prev, [injuryId]: [] }))
    }
  }

  const assigneeLabel = (a: DocumentAssignee) => a === 'assicurazione' ? 'Assicurazione' : a === 'csen' ? 'Csen' : 'Atleta'

  const uploadInjuryDocument = async (injuryId: string, file: File, typeName: string, assignee: DocumentAssignee) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowed.includes(file.type)) {
      alert('Tipo file non supportato. Usa PDF, JPG o PNG.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('File troppo grande. Massimo 50MB per documento.')
      return
    }
    setUploadingDoc(injuryId)
    try {
      const ext = file.name.split('.').pop() || 'bin'
      const label = assigneeLabel(assignee)
      const base = `${sanitizeInjuryDocFilename(typeName)}-${sanitizeInjuryDocFilename(label)}`
      const filename = `${base}-${Date.now()}.${ext}`
      const filePath = `${injuryId}/${filename}`
      const { error: upErr } = await supabase.storage.from('injury-docs').upload(filePath, file, { contentType: file.type, upsert: false })
      if (upErr) throw upErr
      const { error: dbErr } = await supabase.from('injury_documents').insert({
        injury_id: injuryId,
        name: typeName,
        file_path: filePath,
        category: assignee,
        file_size: file.size,
        file_type: file.type
      })
      if (dbErr) throw dbErr
      await loadInjuryDocuments(injuryId)
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Errore nel caricamento del documento.')
    } finally {
      setUploadingDoc(null)
    }
  }

  const fetchInjuryDocumentBlob = async (doc: InjuryDocument) => {
    const { data, error } = await supabase.storage.from('injury-docs').download(doc.file_path)
    if (error) throw error
    if (!data) throw new Error('Documento non trovato.')
    return data
  }

  const previewInjuryDocument = async (doc: InjuryDocument) => {
    try {
      const blob = await fetchInjuryDocumentBlob(doc)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e: any) {
      alert(e?.message || 'Errore nell\'anteprima del documento.')
    }
  }

  const saveInjuryDocument = async (doc: InjuryDocument) => {
    try {
      const blob = await fetchInjuryDocumentBlob(doc)
      const filename = getInjuryDocumentFilename(doc)

      if (isMobileDevice()) {
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
      }

      const ext = filename.split('.').pop()?.toLowerCase() || 'bin'
      const mimeType = doc.file_type || blob.type || 'application/octet-stream'
      const savePicker = (window as Window & { showSaveFilePicker?: (options: {
        suggestedName?: string
        types?: Array<{ description: string; accept: Record<string, string[]> }>
      }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker

      if (savePicker) {
        try {
          const handle = await savePicker({
            suggestedName: filename,
            types: [{ description: 'Documento', accept: { [mimeType]: [`.${ext}`] } }],
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          return
        } catch (e: any) {
          if (e?.name === 'AbortError') return
        }
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e?.message || 'Errore nel salvataggio del documento.')
    }
  }

  const deleteInjuryDocument = async (doc: InjuryDocument) => {
    if (!confirm('Eliminare questo documento?')) return
    try {
      await supabase.storage.from('injury-docs').remove([doc.file_path])
      await supabase.from('injury_documents').delete().eq('id', doc.id)
      await loadInjuryDocuments(doc.injury_id)
    } catch (e: any) {
      alert(e?.message || 'Errore nell\'eliminazione.')
    }
  }

  const openNewReminderModal = (injuryId: string) => {
    setReminderForm({ content: '', reminderDate: '', reminderTime: '', isPublic: true })
    setReminderModal({ open: true, injuryId, reminder: null })
  }
  const openEditReminderModal = (injuryId: string, r: InjuryReminder) => {
    let reminderDate = ''
    let reminderTime = ''
    if (r.reminder_at) {
      const d = new Date(r.reminder_at)
      reminderDate = d.toISOString().slice(0, 10)
      reminderTime = d.toTimeString().slice(0, 5)
    }
    setReminderForm({ content: r.content, reminderDate, reminderTime, isPublic: r.is_public !== false })
    setReminderModal({ open: true, injuryId, reminder: r })
  }
  const saveReminder = async () => {
    const { injuryId, reminder } = reminderModal
    const content = reminderForm.content.trim()
    if (!content) {
      alert('Inserisci il testo del promemoria.')
      return
    }
    const date = reminderForm.reminderDate.trim()
    const time = reminderForm.reminderTime.trim()
    const reminderAt = (date && time) ? new Date(`${date}T${time}`).toISOString() : (date ? new Date(`${date}T12:00`).toISOString() : null)
    try {
      if (reminder) {
        const { error } = await supabase.from('injury_reminders').update({ content, reminder_at: reminderAt, is_public: reminderForm.isPublic, updated_at: new Date().toISOString() }).eq('id', reminder.id)
        if (error) throw error
        try {
          const stored = JSON.parse(localStorage.getItem('injury_reminder_notified') || '{}')
          delete stored[reminder.id]
          localStorage.setItem('injury_reminder_notified', JSON.stringify(stored))
        } catch {}
      } else {
        const payload: Record<string, unknown> = { injury_id: injuryId, content, reminder_at: reminderAt, is_public: reminderForm.isPublic }
        if (userId) payload.created_by = userId
        const { error } = await supabase.from('injury_reminders').insert(payload)
        if (error) throw error
      }
      await loadInjuryReminders(injuryId)
      setReminderModal({ open: false, injuryId: '', reminder: null })
    } catch (e: any) {
      alert(e?.message || 'Errore nel salvataggio.')
    }
  }
  const deleteReminder = async (r: InjuryReminder) => {
    if (!confirm('Eliminare questo promemoria?')) return
    try {
      await supabase.from('injury_reminders').delete().eq('id', r.id)
      await loadInjuryReminders(r.injury_id)
    } catch (e: any) {
      alert(e?.message || 'Errore nell\'eliminazione.')
    }
  }

  // Funzione per aprire il modal di eliminazione attività (delegata al parent)
  const handleDeleteActivity = (activityId: string, injuryId: string, activityType: string) => {
    if (onOpenDeleteActivityModal) {
      onOpenDeleteActivityModal(activityId, injuryId, activityType)
    }
  }

  // Attività "assicurazione" per un infortunio (tipo insurance_communication)
  const insuranceActivities = (injuryId: string): InjuryActivity[] =>
    (activities[injuryId] || []).filter(a => a.activity_type === 'insurance_communication')

  // Aggiorna campi del primo evento assicurazione (Data invio CSEN, Apertura sinistro, Liquidatore)
  const updateInsuranceFirstEventFields = async (
    activityId: string,
    injuryId: string,
    updates: { csen_sent_date?: string | null; claim_opening_date?: string | null; adjuster?: string | null; claim_number_1?: string | null; claim_number_2?: string | null }
  ) => {
    try {
      const { error } = await supabase
        .from('injury_activities')
        .update(updates)
        .eq('id', activityId)
      if (error) throw error
      await loadActivities(injuryId)
    } catch (e) {
      console.error('Errore aggiornamento campi assicurazione:', e)
      alert('Impossibile salvare. Riprova.')
    }
  }

  const isInvioPrivacyType = (desc: string) => {
    const d = (desc || '').trim().toLowerCase()
    return d === 'invio privacy' || d === 'invio privancy' || (d.startsWith('invio') && d.includes('privac'))
  }
  const isAperturaSinistroOption = (opt: string) => {
    const d = (opt || '').trim().toLowerCase()
    return (d.includes('apertura') && d.includes('sinistro')) || d === 'apertura sinistro'
  }
  const getAperturaSinistroIndex = () => {
    const i = effectiveEventTypes.findIndex(opt => isAperturaSinistroOption(opt))
    return i >= 0 ? i : -1
  }
  const isCorrispondenzaOption = (opt: string) => {
    const d = (opt || '').trim().toLowerCase()
    return d.includes('corrispondenza')
  }
  const isPrivacyRelatedOption = (opt: string) => {
    const d = (opt || '').trim().toLowerCase()
    const ricezioneAtleta = (d.includes('ricezione') && d.includes('privac') && d.includes('atleta')) || d === 'ricezione privacy atleta'
    const ricezioneBrixia = (d.includes('ricezione') && d.includes('privac') && d.includes('brixia')) || d === 'ricezione privacy brixia'
    const invio = d === 'invio privacy' || d === 'invio privancy' || (d.startsWith('invio') && d.includes('privac'))
    return ricezioneAtleta || ricezioneBrixia || invio
  }
  const hasAperturaSinistroForInjury = (injuryId: string) => {
    const list = (activities[injuryId] || []).filter(a => a.activity_type === 'insurance_communication')
    return list.some(a => {
      const d = (a.activity_description || '').trim().toLowerCase()
      return (d.includes('apertura') && d.includes('sinistro')) || d === 'apertura sinistro'
    })
  }
  const hasRicezioneBrixiaForInjury = (injuryId: string) => {
    const list = (activities[injuryId] || []).filter(a => a.activity_type === 'insurance_communication')
    return list.some(a => {
      const d = (a.activity_description || '').trim().toLowerCase()
      return (d.includes('ricezione') && d.includes('privac') && d.includes('brixia')) || d === 'ricezione privacy brixia'
    })
  }
  const getAllowedEventTypesForInjury = (injuryId: string) => {
    const hasApertura = hasAperturaSinistroForInjury(injuryId)
    const aperturaIndex = getAperturaSinistroIndex()
    const allowed = effectiveEventTypes.filter((opt, index) => {
      if (isCorrispondenzaOption(opt)) return true
      if (!hasApertura && aperturaIndex >= 0 && index > aperturaIndex) return false
      if (isPrivacyRelatedOption(opt) && !hasApertura) return false
      const d = opt.trim().toLowerCase()
      const isInvio = d === 'invio privacy' || d === 'invio privancy' || (d.startsWith('invio') && d.includes('privac'))
      if (isInvio && !hasRicezioneBrixiaForInjury(injuryId)) return false
      return true
    })
    return allowed
  }
  const isOptionAfterAperturaSinistro = (opt: string) => {
    const aperturaIndex = getAperturaSinistroIndex()
    if (aperturaIndex < 0) return false
    const index = effectiveEventTypes.indexOf(opt)
    return index > aperturaIndex
  }

  // Apri modal per nuovo evento assicurazione (quando esiste già il primo)
  const openNewInsuranceEventModal = (injuryId: string) => {
    setNewInsuranceEventDate(new Date().toISOString().split('T')[0])
    const allowed = getAllowedEventTypesForInjury(injuryId)
    setNewInsuranceEventType(allowed[0] || effectiveEventTypes[0] || '')
    setNewInsuranceEventModal({ open: true, injuryId })
  }

  const closeNewInsuranceEventModal = () => {
    setNewInsuranceEventModal({ open: false, injuryId: null })
  }

  const sendInjuryEmail = async () => {
    const injuryId = sendEmailModal.injuryId
    if (!injuryId) return
    const email = sendEmailTo.trim()
    if (!email) {
      alert('Inserisci l\'indirizzo email del destinatario.')
      return
    }
    setSendEmailSending(true)
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-injury-email`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ injuryId, recipientEmail: email, templateDestinatario: 'assicurazione' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = body?.error || res.statusText || 'Invio fallito'
        throw new Error(msg)
      }
      setSendEmailModal({ open: false, injuryId: null })
      setSendEmailTo('')
      alert('Email inviata.')
    } catch (e: any) {
      console.error('Invio email:', e)
      alert(e?.message || 'Errore nell\'invio. Verifica che l\'Edge Function e Resend siano configurati.')
    } finally {
      setSendEmailSending(false)
    }
  }

  const saveNewInsuranceEvent = async () => {
    const injuryId = newInsuranceEventModal.injuryId
    if (!injuryId) return
    if (!hasAperturaSinistroForInjury(injuryId) && !isCorrispondenzaOption(newInsuranceEventType) && (isPrivacyRelatedOption(newInsuranceEventType) || isOptionAfterAperturaSinistro(newInsuranceEventType))) {
      alert('Deve esistere prima un evento "Apertura Sinistro" prima di poter aggiungere questo tipo di evento.')
      return
    }
    if (isInvioPrivacyType(newInsuranceEventType) && !hasRicezioneBrixiaForInjury(injuryId)) {
      alert('Aggiungi prima l\'evento "Ricezione Privacy Brixia" prima di poter inserire "Invio Privacy".')
      return
    }
    setSavingNewInsuranceEvent(true)
    try {
      const { error } = await supabase
        .from('injury_activities')
        .insert({
          injury_id: injuryId,
          activity_type: 'insurance_communication',
          activity_date: newInsuranceEventDate,
          activity_description: newInsuranceEventType,
          notes: null
        })
      if (error) throw error
      await loadActivities(injuryId)
      closeNewInsuranceEventModal()

      // Se è "Apertura Sinistro", apri modal per inviare email con template e allegati (via server)
      const isAperturaSinistro = /apertura\s+sinistro/i.test((newInsuranceEventType || '').trim())
      if (isAperturaSinistro) {
        setSendEmailTo('')
        setSendEmailModal({ open: true, injuryId })
      }
    } catch (e) {
      console.error('Errore creazione evento assicurazione:', e)
      alert('Impossibile creare l\'evento. Riprova.')
    } finally {
      setSavingNewInsuranceEvent(false)
    }
  }

  // Aggiungi prima comunicazione assicurazione: crea evento "inizio cronologia"; altrimenti apri modal
  const handleAddInsuranceCommunication = async (injuryId: string) => {
    const list = insuranceActivities(injuryId)
    if (list.length > 0) {
      openNewInsuranceEventModal(injuryId)
      return
    }
    try {
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase
        .from('injury_activities')
        .insert({
          injury_id: injuryId,
          activity_type: 'insurance_communication',
          activity_date: today,
          activity_description: "documentazione inviata allo Csen",
          notes: null,
          csen_sent_date: today
        })
      if (error) throw error
      await loadActivities(injuryId)
    } catch (e) {
      console.error('Errore creazione evento inizio cronologia assicurazione:', e)
      alert('Impossibile creare l\'evento. Verifica i permessi o riprova.')
    }
  }

  // Modifica un'attività (apre il form di modifica)
  const editActivity = (activity: InjuryActivity) => {
    if (onOpenEditActivityForm) {
      onOpenEditActivityForm(activity)
    }
  }

  // Gestisce l'espansione/contrazione dell'accordion
  const toggleInjuryExpansion = (injuryId: string) => {
    console.log('🔍 Toggling injury expansion for:', injuryId)
    console.log('🔍 Current expanded injury:', expandedInjury)
    console.log('🔍 Activities for this injury:', activities[injuryId])
    
    if (expandedInjury === injuryId) {
      setExpandedInjury(null)
    } else {
      setExpandedInjury(injuryId)
      loadActivities(injuryId)
    }
  }

  // Gestisce i filtri delle attività
  const handleActivityFilterChange = (injuryId: string, activityType: string, isChecked: boolean) => {
    setFilteredActivityTypes(prev => {
      const currentFilters = prev[injuryId] || []
      
      if (isChecked) {
        // Aggiungi il tipo ai filtri
        return {
          ...prev,
          [injuryId]: [...currentFilters, activityType]
        }
      } else {
        // Rimuovi il tipo dai filtri
        return {
          ...prev,
          [injuryId]: currentFilters.filter(type => type !== activityType)
        }
      }
    })
  }


  // Funzioni helper per i tag delle attività (etichette da DB se disponibili, altrimenti fallback)
  const getActivityTypeName = (type: string) => {
    if (injuryActivityTypes.length > 0) {
      const found = injuryActivityTypes.find(t => t.code === type)
      if (found) return found.name
    }
    const types: Record<string, string> = {
      medical_visit: 'Visita Medica',
      physiotherapy: 'Fisioterapia',
      test: 'Test/Esame',
      note: 'Annotazione',
      insurance_refund: 'Rimborso Assicurativo',
      insurance_communication: 'Comunicazione assicurazione',
      equipment_purchase: 'Acquisto Attrezzatura',
      acquisto_tutore: 'Acquisto Tutore',
      expenses: 'Spese Sostenute',
      other: 'Altro'
    }
    return types[type] || type
  }

  const getActivityTypeColor = (type: string) => {
    const colors = {
      medical_visit: 'bg-blue-100 text-blue-800',
      physiotherapy: 'bg-red-100 text-red-800',
      test: 'bg-red-100 text-red-800',
      note: 'bg-gray-100 text-gray-800',
      insurance_refund: 'bg-green-100 text-green-800',
      insurance_communication: 'bg-gray-100 text-gray-800',
      equipment_purchase: 'bg-red-100 text-red-800',
      acquisto_tutore: 'bg-red-100 text-red-800',
      expenses: 'bg-red-100 text-red-800',
      other: 'bg-gray-100 text-gray-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getActivityTypeIcon = (type: string) => {
    const icons = {
      medical_visit: '🏥',
      physiotherapy: '💪',
      test: '🔬',
      note: '📝',
      insurance_refund: '💰',
      insurance_communication: '📋',
      equipment_purchase: '🛒',
      acquisto_tutore: '🦴',
      expenses: '💸',
      other: '📋'
    }
    return icons[type as keyof typeof icons] || '📋'
  }

  const renderPurchaseActivityCard = (
    activity: InjuryActivity & { cost?: number | string | null; cost_currency?: string | null },
    injuryId: string,
    style: { gradient: string; bg: string; icon: string; color: string; border: string }
  ) => {
    const costInfo = getActivityCostDisplay(activity)
    return (
      <div key={activity.id} className={`${style.bg} rounded-2xl py-3 px-3 shadow-lg hover:shadow-xl transition-all border-2 ${style.border} w-full`}>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white text-lg shrink-0`}>
              {style.icon}
            </div>
            <h3 className={`font-semibold ${style.color} text-base truncate`}>{getActivityTypeName(activity.activity_type)}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => editActivity(activity)}
              className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all shadow-md text-blue-600 hover:text-blue-700"
              title="Modifica"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => handleDeleteActivity(activity.id, injuryId, activity.activity_type)}
              className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all shadow-md text-red-600 hover:text-red-700"
              title="Elimina"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/60 px-3 py-2">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-600">👨‍⚕️ Operatore</div>
            <div className="mt-0.5 text-sm font-semibold text-gray-800 truncate">{activity.operator_name || '—'}</div>
          </div>
          <div className="rounded-xl bg-white/60 px-3 py-2">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-600">📅 Data</div>
            <div className="mt-0.5 text-sm font-semibold text-gray-800">{new Date(activity.activity_date).toLocaleDateString('it-IT')}</div>
          </div>
          <div className="rounded-xl bg-white/60 px-3 py-2">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-600">🛒 Costo</div>
            <div className="mt-0.5 text-sm font-semibold text-red-600">{costInfo ? `${costInfo.value} ${costInfo.currency}` : '—'}</div>
          </div>
        </div>

        {activity.notes && (
          <div className="mt-3 rounded-xl bg-white/60 px-3 py-2">
            <p className="text-sm text-gray-700 italic leading-relaxed">💬 {activity.notes}</p>
          </div>
        )}
      </div>
    )
  }

  const renderInsuranceRefundCard = (
    activity: InjuryActivity & { cost?: number | string | null; cost_currency?: string | null },
    injuryId: string,
  ) => {
    const costInfo = getActivityCostDisplay(activity)
    return (
      <div key={activity.id} className="bg-green-50 rounded-2xl py-3 px-3 shadow-lg hover:shadow-xl transition-all border-2 border-green-200 w-full">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-lg shrink-0">
              💰
            </div>
            <h3 className="font-semibold text-green-800 text-base truncate">Rimborso Assicurativo</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => editActivity(activity)}
              className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all shadow-md text-blue-600 hover:text-blue-700"
              title="Modifica"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => handleDeleteActivity(activity.id, injuryId, activity.activity_type)}
              className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all shadow-md text-red-600 hover:text-red-700"
              title="Elimina"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/60 px-3 py-2">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-600">👨‍⚕️ Operatore</div>
            <div className="mt-0.5 text-sm font-semibold text-gray-800 truncate">{activity.operator_name || '—'}</div>
          </div>
          <div className="rounded-xl bg-white/60 px-3 py-2">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-600">📅 Data</div>
            <div className="mt-0.5 text-sm font-semibold text-gray-800">{new Date(activity.activity_date).toLocaleDateString('it-IT')}</div>
          </div>
          <div className="rounded-xl bg-white/60 px-3 py-2">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-600">💰 Rimborso</div>
            <div className="mt-0.5 text-sm font-semibold text-green-600">{costInfo ? formatCurrency(costInfo.value) : '—'}</div>
          </div>
        </div>

        {activity.notes && (
          <div className="mt-3 rounded-xl bg-white/60 px-3 py-2">
            <p className="text-sm text-gray-700 italic leading-relaxed">💬 {activity.notes}</p>
          </div>
        )}
      </div>
    )
  }

  // Carica tipi di evento assicurazione (menu "Tipo evento" nel modal) da Impostazioni > Infortuni/Assicurazione
  const loadInsuranceEventTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('insurance_event_types')
        .select('name')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (!error && data?.length) {
        setInsuranceEventTypes(data.map((r: { name: string }) => r.name))
      }
    } catch {
      // Tabella assente o errore: si usa il fallback
    }
  }

  const loadInjuryActivityTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('injury_activity_types')
        .select('id, name, code, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (!error && data?.length) {
        setInjuryActivityTypes(data as Array<{ id: string; name: string; code: string; sort_order: number }>)
      }
    } catch {
      // Tabella assente: getActivityTypeName userà il fallback
    }
  }

  useEffect(() => {
    loadInsuranceEventTypes()
    loadInjuryDocumentTypes()
    loadInjuryActivityTypes()
  }, [])

  const loadInjuryDocumentTypes = async () => {
    try {
      const { data: typesData, error: e1 } = await supabase
        .from('injury_document_types')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (e1 || !typesData?.length) {
        setInjuryDocumentTypes([])
        return
      }
      const { data: assigneesData, error: e2 } = await supabase
        .from('injury_document_type_assignees')
        .select('document_type_id, assignee')
      const assigneesByType: Record<string, DocumentAssignee[]> = {}
      ;(assigneesData || []).forEach((r: { document_type_id: string; assignee: DocumentAssignee }) => {
        if (!assigneesByType[r.document_type_id]) assigneesByType[r.document_type_id] = []
        assigneesByType[r.document_type_id].push(r.assignee)
      })
      setInjuryDocumentTypes((typesData as any[]).map(t => ({
        ...t,
        assignees: assigneesByType[t.id] || []
      })))
    } catch {
      setInjuryDocumentTypes([])
    }
  }

  // Carica infortuni quando cambia personId o refreshTrigger; dopo delete attività ricarica anche le attività
  useEffect(() => {
    if (personId) {
      loadInjuries()
    }
  }, [personId, refreshTrigger])

  // Quando refreshTrigger cambia (es. dopo eliminazione attività), ricarica le attività per ogni infortunio in lista
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0 && injuries.length > 0) {
      injuries.forEach(inj => loadActivities(inj.id))
    }
  }, [refreshTrigger])

  // Quando si apre il tab Infortuni, espandi automaticamente il primo accordion (dettaglio infortunio + attività)
  useEffect(() => {
    const justActivated = isTabActive && !prevTabActiveRef.current
    prevTabActiveRef.current = isTabActive
    const hasInjuries = injuries.length > 0
    const hadInjuriesBefore = prevInjuriesLengthRef.current > 0
    prevInjuriesLengthRef.current = injuries.length
    const shouldExpand = isTabActive && hasInjuries && (justActivated || !hadInjuriesBefore)
    if (shouldExpand) {
      const firstId = injuries[0].id
      setExpandedInjury(firstId)
      loadActivities(firstId)
    }
  }, [isTabActive, injuries])

  // Apri modal per nuovo infortunio
  const openAddInjury = () => {
    onOpenInjuryModal?.(null)
  }

  // Apri modal per modifica infortunio
  const openEditInjury = (injury: Injury) => {
    onOpenInjuryModal?.(injury)
  }

  // Elimina infortunio
  const handleDeleteInjury = (injury: Injury) => {
    onOpenDeleteModal?.(injury)
  }

  // Calcola giorni trascorsi tra data infortunio e data chiusura (o oggi se ancora in corso)
  const calculateDaysPassed = (injury: Injury) => {
    const injuryDate = new Date(injury.injury_date)
    
    // Verifica se esiste ancora un'attività "VISITA DI CHIUSURA"
    const injuryActivities = activities[injury.id] || []
    const hasClosingVisit = injuryActivities.some(a => 
      a.activity_type === 'medical_visit' && 
      a.activity_description === 'VISITA DI CHIUSURA'
    )
    
    // Se l'infortunio è marcato come chiuso E esiste ancora la visita di chiusura
    if (injury.is_closed && hasClosingVisit) {
      const closingVisit = injuryActivities
        .filter(activity => 
          activity.activity_type === 'medical_visit' && 
          activity.activity_description === 'VISITA DI CHIUSURA'
        )
        .sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime())[0]
      
      if (closingVisit) {
        const closedDate = new Date(closingVisit.activity_date)
        const diffTime = closedDate.getTime() - injuryDate.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        return diffDays + 1 // +1 per includere entrambi i giorni (inizio e fine)
      }
    }
    
    // Se è ancora in corso, usa la data di oggi
    const today = new Date()
    const diffTime = today.getTime() - injuryDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays + 1 // +1 per includere entrambi i giorni (inizio e fine)
  }

  if (!personId) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <p className="text-gray-500">⚠️ Nessun ID persona</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Infermeria</h2>
          <p className="text-gray-500">Gestione infortuni del giocatore</p>
        </div>
        <button
          type="button"
          onClick={() => onAddInjury && onAddInjury()}
          className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center hover:bg-blue-700 shadow-lg transition-all duration-200"
          title="Aggiungi infortunio"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Caricamento...</p>
        </div>
      ) : injuries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Nessun infortunio registrato</p>
        </div>
      ) : (
        <div className="space-y-6 w-full">
          {injuries.map((injury) => {
            const currentTab = injuryTabByInjuryId[injury.id] // undefined = nessun sub-tab selezionato
            return (
            <div key={injury.id} className="space-y-0">
            <div className={`rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 w-full border-2 ${
              injury.current_status === 'In corso' 
                ? 'bg-red-50/70 border-red-300 shadow-red-100/50' 
                : injury.current_status === 'Guarito'
                ? expandedInjury === injury.id 
                  ? 'bg-green-50/70 border-green-300 shadow-green-100/50'
                  : 'bg-white border-green-300 shadow-green-100/30'
                : 'bg-white border-gray-300 shadow-gray-100/50'
            }`}>
              {/* Header comune: icona, data, titolo infortunio, pulsanti - sempre visibile */}
              <div className="relative flex justify-between items-center w-full p-4 pb-0 gap-3 min-h-[2.75rem] border-b border-gray-200/80">
                <div className="flex items-center gap-3 shrink-0">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                    injury.injury_type.toLowerCase().includes('contrattura') ? 'from-orange-500 to-orange-600' :
                    injury.injury_type.toLowerCase().includes('distorsione') ? 'from-red-500 to-red-600' :
                    injury.injury_type.toLowerCase().includes('frattura') ? 'from-purple-500 to-purple-600' :
                    injury.injury_type.toLowerCase().includes('stiramento') ? 'from-yellow-500 to-yellow-600' :
                    injury.injury_type.toLowerCase().includes('test') ? 'from-blue-500 to-blue-600' :
                    'from-gray-500 to-gray-600'
                  } flex items-center justify-center text-white text-lg shadow-lg`}>
                    {injury.injury_type.toLowerCase().includes('contrattura') ? '💪' :
                     injury.injury_type.toLowerCase().includes('distorsione') ? '🦵' :
                     injury.injury_type.toLowerCase().includes('frattura') ? '🦴' :
                     injury.injury_type.toLowerCase().includes('stiramento') ? '⚡' :
                     injury.injury_type.toLowerCase().includes('test') ? '🔬' :
                     '🏥'}
                  </div>
                  <span className="text-base font-bold text-gray-800 bg-white/90 px-3 py-1.5 rounded-lg shadow-sm">
                    📅 {new Date(injury.injury_date).toLocaleDateString('it-IT')}
                  </span>
                </div>
                <h2 className="absolute left-0 right-0 text-center text-xl font-bold text-gray-900 pointer-events-none truncate px-2">
                  {injury.injury_type}{injury.body_part ? ` · ${injury.body_part}` : ''}
                </h2>
                <div className="flex items-center gap-1 shrink-0 relative z-10">
                  {injury.current_status !== 'Guarito' && (
                    <button
                      type="button"
                      onClick={() => onOpenActivityForm?.(injury.id)}
                      className="p-1.5 rounded-lg bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-600 border border-emerald-200/50"
                      title="Aggiungi attività"
                    >
                      <svg className="w-[1.48rem] h-[1.48rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditInjury(injury)}
                    className="p-1.5 rounded-lg bg-blue-50/80 hover:bg-blue-100/80 text-blue-600 border border-blue-200/50"
                    title="Modifica"
                  >
                    <svg className="w-[1.48rem] h-[1.48rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteInjury(injury)}
                    className="p-1.5 rounded-lg bg-rose-50/80 hover:bg-rose-100/80 text-rose-600 border border-rose-200/50"
                    title="Elimina"
                  >
                    <svg className="w-[1.48rem] h-[1.48rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Tab Infortuni | Assicurazione | Documentazione - dentro la card, per questo infortunio */}
              <div className="flex gap-0 border-b border-gray-200 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setInjuryTabByInjuryId(prev => ({ ...prev, [injury.id]: 'infortuni' }))}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    currentTab === 'infortuni'
                      ? 'border-blue-600 text-blue-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Infortunio
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInjuryTabByInjuryId(prev => ({ ...prev, [injury.id]: 'assicurazione' }))
                    loadActivities(injury.id)
                  }}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    currentTab === 'assicurazione'
                      ? 'border-blue-600 text-blue-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Assicurazione
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInjuryTabByInjuryId(prev => ({ ...prev, [injury.id]: 'documentazione' }))
                    loadInjuryDocuments(injury.id)
                  }}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    currentTab === 'documentazione'
                      ? 'border-blue-600 text-blue-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Documentazione
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInjuryTabByInjuryId(prev => ({ ...prev, [injury.id]: 'promemoria' }))
                    loadInjuryReminders(injury.id)
                  }}
                  className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    currentTab === 'promemoria'
                      ? 'border-blue-600 text-blue-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Promemoria
                </button>
              </div>

              {currentTab === undefined ? (
                <>
                  {/* Fascia 6 card visibile subito, nessun sub-tag selezionato */}
                  <div className="p-4 w-full">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3 w-full">
                      <div className="bg-white rounded-xl p-3 border-2 border-gray-200 shadow-md text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">📍</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Tipo</span>
                        </div>
                        <div className="text-sm font-bold text-gray-800">
                          <span>{injury.injury_type}</span>
                          {injury.body_part && <span className="text-gray-600"> · {injury.body_part}</span>}
                        </div>
                      </div>
                      <div className={`rounded-xl p-3 border-2 shadow-md text-center flex flex-col items-center justify-center ${
                        injury.severity === 'Grave' ? 'bg-red-50 border-red-200' :
                        injury.severity === 'Moderato' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-green-50 border-green-200'
                      }`}>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">{injury.severity === 'Grave' ? '🔴' : injury.severity === 'Moderato' ? '🟡' : '🟢'}</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Gravità</span>
                        </div>
                        <div className="text-sm font-bold text-gray-800">{injury.severity}</div>
                      </div>
                      <div className={`rounded-xl p-3 border-2 shadow-md text-center flex flex-col items-center justify-center ${
                        injury.current_status === 'In corso' ? 'bg-red-50 border-red-200' :
                        injury.current_status === 'Guarito' ? 'bg-green-50 border-green-200' :
                        'bg-orange-50 border-orange-200'
                      }`}>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">{injury.current_status === 'In corso' ? '⏳' : injury.current_status === 'Guarito' ? '✅' : '🔄'}</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Stato</span>
                        </div>
                        <div className="text-sm font-bold text-gray-800">{injury.current_status}</div>
                        {injury.in_chiusura && (
                          <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">In chiusura</span>
                        )}
                      </div>
                      <div className="bg-white rounded-xl p-3 border-2 border-gray-200 shadow-md text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">📊</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Giorni</span>
                        </div>
                        <div className="text-lg font-bold text-gray-800">{calculateDaysPassed(injury)}</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border-2 border-gray-200 shadow-md text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">⏰</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Previsione</span>
                        </div>
                        <div className="text-lg font-bold text-gray-800">{injury.expected_weeks_off ? `${injury.expected_weeks_off} giorni` : '—'}</div>
                      </div>
                      <div className="bg-white rounded-xl p-3 border-2 border-gray-200 shadow-md text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">🎯</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Causa</span>
                        </div>
                        <div className="text-sm font-bold text-gray-800 truncate">{injury.cause || '—'}</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(() => {
                        const injuryActivities = activities[injury.id] || []
                        const hasClosingVisit = injuryActivities.some(a =>
                          a.activity_type === 'medical_visit' &&
                          a.activity_description === 'VISITA DI CHIUSURA'
                        )
                        return injury.is_closed && injury.injury_closed_date && hasClosingVisit && (
                          <div className="flex items-center gap-2 text-xs bg-white rounded-xl p-3 border-2 border-gray-200 shadow-md">
                            <span className="text-gray-500">🏁</span>
                            <span className="font-medium text-gray-700">Chiusura:</span>
                            <span className="text-gray-600">{new Date(injury.injury_closed_date).toLocaleDateString('it-IT')}</span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="p-4 pt-0 text-center">
                    <p className="text-sm text-gray-500">Seleziona una voce sopra: Infortunio, Assicurazione, Documentazione o Promemoria.</p>
                  </div>
                </>
              ) : currentTab === 'documentazione' ? (
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-3">Documenti da inviare a CSEN, assicurazione e altre controparti.</p>
                  <InjuryDocumentsSection
                    injuryId={injury.id}
                    documents={injuryDocuments[injury.id] || []}
                    documentTypes={injuryDocumentTypes}
                    uploading={uploadingDoc === injury.id}
                    onUpload={uploadInjuryDocument}
                    onPreview={previewInjuryDocument}
                    onSave={saveInjuryDocument}
                    onDelete={deleteInjuryDocument}
                  />
                </div>
              ) : currentTab === 'assicurazione' ? (
                <div className="p-4 relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-700">
                      {playerDisplayName != null || csenCard != null || csenCardIssuedAt != null
                        ? (() => {
                            const dateStr = csenCardIssuedAt?.trim()
                            const formattedDate = dateStr ? (() => { const d = new Date(dateStr); return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('it-IT'); })() : dateStr
                            return [playerDisplayName?.trim(), csenCard?.trim(), formattedDate].filter(Boolean).join(' – ')
                          })()
                        : "Rendiconto comunicazioni con l'assicurazione"}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {onOpenActivityFormWithType && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpenActivityFormWithType(injury.id, 'insurance_refund') }}
                          className="px-3 py-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap"
                          title="Registra l'importo del rimborso assicurativo ricevuto"
                        >
                          💰 Rimborso €
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAddInsuranceCommunication(injury.id); }}
                        className="shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow transition-colors"
                        title="Aggiungi comunicazione / Inizio cronologia"
                      >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    </div>
                  </div>
                  {(() => {
                    const list = insuranceActivities(injury.id)
                    if (list.length === 0) {
                      return (
                        <div className="p-6 bg-white/50 rounded-2xl border-2 border-gray-200 border-dashed">
                          <p className="text-center text-gray-500">Nessuna comunicazione registrata. Clicca + per creare l&apos;evento di inizio cronologia (prima documentazione inviata all&apos;assicurazione).</p>
                        </div>
                      )
                    }
                    const firstEvent = list[0]
                    const norm = (s: string) => (s || '').trim().toLowerCase()
                    const hasRicezionePrivacyAtleta = list.some(a => {
                      const d = norm(a.activity_description || '')
                      return (d.includes('ricezione') && d.includes('privac') && d.includes('atleta')) || d === 'ricezione privacy atleta'
                    })
                    const hasRicezionePrivacyBrixia = list.some(a => {
                      const d = norm(a.activity_description || '')
                      return (d.includes('ricezione') && d.includes('privac') && d.includes('brixia')) || d === 'ricezione privacy brixia'
                    })
                    const hasInvioPrivacy = list.some(a => {
                      const d = norm(a.activity_description || '')
                      return d === 'invio privacy' || d === 'invio privancy' || (d.startsWith('invio') && d.includes('privac'))
                    })
                    return (
                      <div className="space-y-4">
                        {/* Campi editabili per il primo evento + stato Privacy (solo lettura); Liquidatore, Polizza Base, Integrsativa B più larghi */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_2fr_2fr_auto] gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 w-full">
                          <label className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-medium text-gray-600">Data invio CSEN</span>
                            <input
                              type="date"
                              value={firstEvent.csen_sent_date || ''}
                              onChange={(e) => {
                                const v = e.target.value || null
                                updateInsuranceFirstEventFields(firstEvent.id, injury.id, { csen_sent_date: v })
                              }}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full min-w-0 text-gray-900 bg-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-medium text-gray-600">Apertura sinistro</span>
                            <input
                              type="date"
                              value={firstEvent.claim_opening_date || ''}
                              onChange={(e) => {
                                const v = e.target.value || null
                                updateInsuranceFirstEventFields(firstEvent.id, injury.id, { claim_opening_date: v })
                              }}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full min-w-0 text-gray-900 bg-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-medium text-gray-600">Liquidatore</span>
                            <input
                              key={`adjuster-${firstEvent.id}-${firstEvent.adjuster ?? ''}`}
                              type="text"
                              defaultValue={firstEvent.adjuster ?? ''}
                              onBlur={(e) => {
                                const v = e.target.value.trim() || null
                                if (v !== (firstEvent.adjuster ?? '')) {
                                  updateInsuranceFirstEventFields(firstEvent.id, injury.id, { adjuster: v })
                                }
                              }}
                              placeholder="Nome liquidatore"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full min-w-0 text-gray-900 bg-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-medium text-gray-600">Polizza Base</span>
                            <input
                              key={`claim1-${firstEvent.id}-${firstEvent.claim_number_1 ?? ''}`}
                              type="text"
                              defaultValue={firstEvent.claim_number_1 ?? ''}
                              onBlur={(e) => {
                                const v = e.target.value.trim() || null
                                if (v !== (firstEvent.claim_number_1 ?? '')) {
                                  updateInsuranceFirstEventFields(firstEvent.id, injury.id, { claim_number_1: v })
                                }
                              }}
                              placeholder="Polizza Base"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full min-w-0 text-gray-900 bg-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-medium text-gray-600">Integrsativa B</span>
                            <input
                              key={`claim2-${firstEvent.id}-${firstEvent.claim_number_2 ?? ''}`}
                              type="text"
                              defaultValue={firstEvent.claim_number_2 ?? ''}
                              onBlur={(e) => {
                                const v = e.target.value.trim() || null
                                if (v !== (firstEvent.claim_number_2 ?? '')) {
                                  updateInsuranceFirstEventFields(firstEvent.id, injury.id, { claim_number_2: v })
                                }
                              }}
                              placeholder="Integrsativa B"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full min-w-0 text-gray-900 bg-white"
                            />
                          </label>
                          <div className="flex flex-col gap-1 min-w-[7.5rem]">
                            <span className="text-xs font-medium text-gray-600">Privacy</span>
                            <div className="rounded-lg border border-gray-200 bg-gray-100 px-2 py-1.5 text-[11px] leading-snug" title="Stato automatico in base agli eventi assicurazione registrati">
                              <div className="flex justify-between gap-2">
                                <span className="text-gray-600">Ricez. Atleta</span>
                                <span className={hasRicezionePrivacyAtleta ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{hasRicezionePrivacyAtleta ? 'Sì' : 'No'}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-gray-600">Ricez. Brixia</span>
                                <span className={hasRicezionePrivacyBrixia ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{hasRicezionePrivacyBrixia ? 'Sì' : 'No'}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-gray-600">Invio Privacy</span>
                                <span className={hasInvioPrivacy ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{hasInvioPrivacy ? 'Sì' : 'No'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      <ul className="space-y-3">
                        {list.map((a) => (
                          <li key={a.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                            <span className="text-gray-600 shrink-0">📋</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900">
                                {new Date(a.activity_date).toLocaleDateString('it-IT')} - {a.activity_description?.includes('Inizio cronologia') ? 'documentazione inviata allo Csen' : (a.activity_description || 'Comunicazione assicurazione')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => editActivity(a)}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/50"
                                title="Modifica"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteActivity(a.id, injury.id, a.activity_type)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50"
                                title="Elimina"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      </div>
                    )
                  })()}
                </div>
              ) : currentTab === 'promemoria' ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-600">Promemoria per questo infortunio. Opzionale: imposta data e ora per ricevere un avviso nell’app e sul PC.</p>
                    <button
                      type="button"
                      onClick={() => openNewReminderModal(injury.id)}
                      className="shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow transition-colors"
                      title="Aggiungi promemoria"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {(injuryReminders[injury.id] || []).length === 0 ? (
                      <li className="text-sm text-gray-500 py-2">Nessun promemoria. Clicca + per aggiungerne uno.</li>
                    ) : (
                      (injuryReminders[injury.id] || []).map((r) => {
                        const canEditReminder = r.is_public !== false || r.created_by === userId
                        return (
                        <li key={r.id} className="flex items-start justify-between gap-2 p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-900">{r.content}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${r.is_public !== false ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                {r.is_public !== false ? 'Pubblico' : 'Privato'}
                              </span>
                            </div>
                            {r.reminder_at && (
                              <p className="text-xs text-gray-500 mt-1">
                                🔔 {new Date(r.reminder_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                              </p>
                            )}
                            {r.is_public !== false && r.creator_name && (
                              <p className="text-xs text-gray-400 mt-1">Creato da {r.creator_name}</p>
                            )}
                          </div>
                          {canEditReminder && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => openEditReminderModal(injury.id, r)} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/50" title="Modifica">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button type="button" onClick={() => deleteReminder(r)} className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50" title="Elimina">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          )}
                        </li>
                      )})
                    )}
                  </ul>
                </div>
              ) : (
              <>
              {/* Contenuto sezione Infortuni: grid + dettagli, cliccabile per accordion */}
              <div 
                className={`p-4 cursor-pointer transition-all duration-200 w-full ${
                  injury.current_status === 'In corso' 
                    ? 'hover:bg-red-100/50' 
                    : injury.current_status === 'Guarito'
                    ? 'hover:bg-green-100/50'
                    : 'hover:bg-gray-50/50'
                }`}
                onClick={() => toggleInjuryExpansion(injury.id)}
              >
                {/* Card a tutta larghezza: stessa distanza da margine sinistro e destro */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3 w-full">
                      {/* Tipo e località */}
                      <div className="bg-white rounded-xl p-3 border-2 border-gray-200 shadow-md hover:shadow-lg transition-all duration-200 text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">📍</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Tipo</span>
                        </div>
                        <div className="text-sm font-bold text-gray-800">
                          <span>{injury.injury_type}</span>
                          {injury.body_part && <span className="text-gray-600"> · {injury.body_part}</span>}
                        </div>
                      </div>

                      {/* Gravità */}
                      <div className={`rounded-xl p-3 border-2 shadow-md hover:shadow-lg transition-all duration-200 text-center flex flex-col items-center justify-center ${
                        injury.severity === 'Grave' ? 'bg-red-50 border-red-200' :
                        injury.severity === 'Moderato' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-green-50 border-green-200'
                      }`}>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">{injury.severity === 'Grave' ? '🔴' : injury.severity === 'Moderato' ? '🟡' : '🟢'}</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Gravità</span>
                        </div>
                        <div className="text-sm font-bold text-gray-800">{injury.severity}</div>
                      </div>

                      {/* Stato */}
                      <div className={`rounded-xl p-3 border-2 shadow-md hover:shadow-lg transition-all duration-200 text-center flex flex-col items-center justify-center ${
                        injury.current_status === 'In corso' ? 'bg-red-50 border-red-200' :
                        injury.current_status === 'Guarito' ? 'bg-green-50 border-green-200' :
                        'bg-orange-50 border-orange-200'
                      }`}>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">{injury.current_status === 'In corso' ? '⏳' : injury.current_status === 'Guarito' ? '✅' : '🔄'}</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Stato</span>
                        </div>
                        <div className="text-sm font-bold text-gray-800">{injury.current_status}</div>
                        {injury.in_chiusura && (
                          <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">In chiusura</span>
                        )}
                      </div>

                      {/* Giorni trascorsi */}
                      <div className="bg-white rounded-xl p-3 border-2 border-gray-200 shadow-md hover:shadow-lg transition-all duration-200 text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">📊</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Giorni</span>
                        </div>
                        <div className="text-lg font-bold text-gray-800">{calculateDaysPassed(injury)}</div>
                      </div>

                      {/* Previsione */}
                      <div className="bg-white rounded-xl p-3 border-2 border-gray-200 shadow-md hover:shadow-lg transition-all duration-200 text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">⏰</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Previsione</span>
                        </div>
                        <div className="text-lg font-bold text-gray-800">{injury.expected_weeks_off ? `${injury.expected_weeks_off} giorni` : '—'}</div>
                      </div>

                      {/* Causa */}
                      <div className="bg-white rounded-xl p-3 border-2 border-gray-200 shadow-md hover:shadow-lg transition-all duration-200 text-center flex flex-col items-center justify-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-sm">🎯</span>
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Causa</span>
                        </div>
                        <div className="text-sm font-bold text-gray-800 truncate">{injury.cause || '—'}</div>
                      </div>
                    </div>
                    
                    {/* Dettagli aggiuntivi compatti */}
                    <div className="space-y-1">
                      {(() => {
                        // Verifica se esiste ancora un'attività "VISITA DI CHIUSURA"
                        const injuryActivities = activities[injury.id] || []
                        const hasClosingVisit = injuryActivities.some(a => 
                          a.activity_type === 'medical_visit' && 
                          a.activity_description === 'VISITA DI CHIUSURA'
                        )
                        
                        return injury.is_closed && injury.injury_closed_date && hasClosingVisit && (
                          <div className="flex items-center gap-2 text-xs bg-white rounded-xl p-3 border-2 border-gray-200 shadow-md">
                            <span className="text-gray-500">🏁</span>
                            <span className="font-medium text-gray-700">Chiusura:</span>
                            <span className="text-gray-600">{new Date(injury.injury_closed_date).toLocaleDateString('it-IT')}</span>
                          </div>
                        )
                      })()}
                    </div>
                    
                    {/* Sezioni espandibili - solo se l'infortunio è espanso */}
                    {expandedInjury === injury.id && (
                      <>
                        {/* Riepilogo Attività Mediche */}
                        {(() => {
                      const injuryActivities = activities[injury.id] || []
                      
                      // Attività mediche
                      const medicalVisits = injuryActivities.filter(a => a.activity_type === 'medical_visit')
                      const physiotherapySessions = injuryActivities.filter(a => a.activity_type === 'physiotherapy')
                      const exams = injuryActivities.filter(a => a.activity_type === 'test')
                      
                      // Conteggi fisioterapia
                      const totalPhysioMinutes = physiotherapySessions.reduce((sum, a) => {
                        const duration = typeof a.duration_minutes === 'string' ? parseInt(a.duration_minutes) : (a.duration_minutes || 0)
                        return sum + duration
                      }, 0)
                      
                      const totalPhysioHours = Math.floor(totalPhysioMinutes / 60)
                      const remainingMinutes = totalPhysioMinutes % 60
                      const physioTimeDisplay = totalPhysioHours > 0 
                        ? `${totalPhysioHours}h ${remainingMinutes}m`
                        : `${remainingMinutes}m`
                      
                      const totalMassaggi = physiotherapySessions.filter(a => a.massaggio).length
                      const totalLaser = physiotherapySessions.filter(a => a.laser).length
                      const totalTecar = physiotherapySessions.filter(a => a.tecar).length
                      
                      // Mostra sempre la griglia Attività Mediche (con etichette); card senza numero: sfondo grigio e testo schiarito
                      return (
                          <div className="mt-3 p-4 bg-white rounded-2xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all duration-300">
                            {/* Header Attività Mediche */}
                            <div className="text-center mb-2">
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">🏥 Attività Mediche</span>
                            </div>
                            
                            {/* Layout a griglia con allineamento perfetto */}
            <div className="grid grid-cols-4 gap-2 gap-y-4 text-xs">
              {/* Prima riga: Visite, Esami, Fisio */}
              <div className={`text-center p-2 rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md ${medicalVisits.length > 0 ? 'bg-blue-50/30 border-blue-200/50 hover:bg-blue-50/50' : 'bg-gray-100 border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  <span className={medicalVisits.length > 0 ? 'text-blue-600 text-xl' : 'text-gray-400 text-xl'}>🏥</span>
                  <span className={medicalVisits.length > 0 ? 'text-gray-600 text-base' : 'text-gray-500 text-base'}>Visite</span>
                  {medicalVisits.length > 0 && <span className="font-bold text-blue-600 text-xl">{medicalVisits.length}</span>}
                </div>
              </div>

              <div className={`text-center p-2 rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md ${exams.length > 0 ? 'bg-purple-50/30 border-purple-200/50 hover:bg-purple-50/50' : 'bg-gray-100 border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  <span className={exams.length > 0 ? 'text-purple-600 text-xl' : 'text-gray-400 text-xl'}>🔬</span>
                  <span className={exams.length > 0 ? 'text-gray-600 text-base' : 'text-gray-500 text-base'}>Esami</span>
                  {exams.length > 0 && <span className="font-bold text-purple-600 text-xl">{exams.length}</span>}
                </div>
              </div>

              <div className={`text-center p-2 rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md ${physiotherapySessions.length > 0 ? 'bg-red-50/30 border-red-200/50 hover:bg-red-50/50' : 'bg-gray-100 border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  <span className={physiotherapySessions.length > 0 ? 'text-red-600 text-xl' : 'text-gray-400 text-xl'}>💪</span>
                  <span className={physiotherapySessions.length > 0 ? 'text-gray-600 text-base' : 'text-gray-500 text-base'}>Fisio</span>
                  {physiotherapySessions.length > 0 && <span className="font-bold text-red-600 text-xl">{physiotherapySessions.length}</span>}
                </div>
              </div>

              <div className="text-center p-1">
                <div className="h-8" />
              </div>

              {/* Seconda riga: Tecar, Massaggi, Laser, Ore */}
              <div className={`text-center p-2 rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md ${totalTecar > 0 ? 'bg-yellow-50/30 border-yellow-200/50 hover:bg-yellow-50/50' : 'bg-gray-100 border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  <span className={totalTecar > 0 ? 'text-yellow-600 text-xl' : 'text-gray-400 text-xl'}>⚡</span>
                  <span className={totalTecar > 0 ? 'text-gray-600 text-base' : 'text-gray-500 text-base'}>Tecar</span>
                  {totalTecar > 0 && <span className="font-bold text-yellow-600 text-xl">{totalTecar}</span>}
                </div>
              </div>

              <div className={`text-center p-2 rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md ${totalMassaggi > 0 ? 'bg-orange-50/30 border-orange-200/50 hover:bg-orange-50/50' : 'bg-gray-100 border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  <span className={totalMassaggi > 0 ? 'text-orange-600 text-xl' : 'text-gray-400 text-xl'}>💆‍♂️</span>
                  <span className={totalMassaggi > 0 ? 'text-gray-600 text-base' : 'text-gray-500 text-base'}>Massaggi</span>
                  {totalMassaggi > 0 && <span className="font-bold text-orange-600 text-xl">{totalMassaggi}</span>}
                </div>
              </div>

              <div className={`text-center p-2 rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md ${totalLaser > 0 ? 'bg-red-50/30 border-red-200/50 hover:bg-red-50/50' : 'bg-gray-100 border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  <span className={totalLaser > 0 ? 'text-red-600 text-xl' : 'text-gray-400 text-xl'}>🔴</span>
                  <span className={totalLaser > 0 ? 'text-gray-600 text-base' : 'text-gray-500 text-base'}>Laser</span>
                  {totalLaser > 0 && <span className="font-bold text-red-600 text-xl">{totalLaser}</span>}
                </div>
              </div>

              <div className={`text-center p-2 rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md ${totalPhysioMinutes > 0 ? 'bg-red-50/30 border-red-200/50 hover:bg-red-50/50' : 'bg-gray-100 border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-center gap-1 flex-wrap">
                  <span className={totalPhysioMinutes > 0 ? 'text-red-600 text-xl' : 'text-gray-400 text-xl'}>⏱️</span>
                  <span className={totalPhysioMinutes > 0 ? 'text-gray-600 text-base' : 'text-gray-500 text-base'}>Ore</span>
                  {totalPhysioMinutes > 0 && <span className="font-bold text-red-600 text-xl">{physioTimeDisplay}</span>}
                </div>
              </div>
            </div>
                          </div>
                        )
                    })()}

                    {/* Riepilogo Finanziario */}
                    {(() => {
                      const injuryActivities = activities[injury.id] || []
                      
                      const testCosts = injuryActivities.filter(a => isTestCostActivityType(a.activity_type) && getActivityAmountValue(a) > 0)
                      const equipmentCosts = injuryActivities.filter(a => isEquipmentCostActivityType(a.activity_type) && getActivityAmountValue(a) > 0)
                      const expenses = injuryActivities.filter(a => a.activity_type === 'expenses' && getActivityAmountValue(a) > 0)
                      const refunds = injuryActivities.filter(a => a.activity_type === 'insurance_refund' && getActivityAmountValue(a) > 0)
                      
                      const totalTestCosts = testCosts.reduce((sum, a) => sum + getActivityAmountValue(a), 0)
                      const totalEquipmentCosts = equipmentCosts.reduce((sum, a) => sum + getActivityAmountValue(a), 0)
                      const totalExpenses = expenses.reduce((sum, a) => sum + getActivityAmountValue(a), 0)
                      const totalRefunds = refunds.reduce((sum, a) => sum + getActivityAmountValue(a), 0)
                      
                      const totalCosts = totalTestCosts + totalEquipmentCosts + totalExpenses
                      
                      if (totalCosts > 0 || totalRefunds > 0) {
                        return (
                          <div className="mt-2 px-3 py-2 bg-white/80 rounded-xl border border-gray-200">
                            <div className="grid grid-cols-3 items-center gap-3 text-base">
                              <div className="flex items-center gap-4 min-w-0">
                                <span className="font-semibold text-gray-500 uppercase tracking-wide shrink-0">💰 Riepilogo</span>
                                {totalCosts > 0 && (
                                  <span className="text-gray-600 whitespace-nowrap">
                                    Spese: <strong className="text-red-600">{formatCurrency(totalCosts)}</strong>
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-600 text-center whitespace-nowrap">
                                Bilancio: <strong className={(totalRefunds - totalCosts) >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(totalRefunds - totalCosts)}</strong>
                              </div>
                              <div className="text-gray-600 text-right whitespace-nowrap">
                                Rimborsi: <strong className="text-green-600">{formatCurrency(totalRefunds)}</strong>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                        })()}
                      </>
                    )}
              </div>

              {/* Accordion per le attività */}
              {expandedInjury === injury.id && (
                <div className="border-t border-white/20 bg-gradient-to-br from-white/30 to-white/10 p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm shadow-lg">
                        📋
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">
                        Attività e Annotazioni
                      </h3>
                      <span className="px-3 py-1 bg-white/60 rounded-full text-xs font-bold text-gray-600 border border-white/40">
                      {(() => {
                        const activityCount = activities[injury.id]?.length || 0
                        console.log('🔍 Activity count for injury', injury.id, ':', activityCount)
                        console.log('🔍 Activities data:', activities[injury.id])
                        return `${activityCount} attività`
                      })()}
                    </span>
                    </div>
                    
                    {/* Checkbox di Filtro - solo se ci sono almeno 2 tipi diversi */}
                    {(() => {
                      const injuryActivities = activities[injury.id] || []
                      const activityTypes = [...new Set(injuryActivities.map(a => a.activity_type))]
                      
                      if (activityTypes.length >= 2) {
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600 mr-2">Filtra:</span>
                            {activityTypes.map(type => {
                              const count = injuryActivities.filter(a => a.activity_type === type).length
                              const isChecked = !filteredActivityTypes[injury.id] || filteredActivityTypes[injury.id].includes(type)
                              
                              return (
                                <label key={type} className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => handleActivityFilterChange(injury.id, type, e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                  />
                                  <span className="text-xs font-medium text-gray-700">
                                    {type === 'medical_visit' ? '🏥 Visita' :
                                     type === 'physiotherapy' ? '💪 Fisio' :
                                     type === 'test' ? '🔬 Test' :
                                     type === 'insurance_refund' ? '💰 Rimborso' :
                                     type === 'equipment_purchase' ? '🛒 Attrez.' :
                                     type === 'expenses' ? '💸 Spese' : type} ({count})
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                  
                  {activities[injury.id]?.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-2xl">
                        📝
                      </div>
                      <p className="text-gray-600 font-medium mb-1">Nessuna attività registrata</p>
                      <p className="text-sm text-gray-500">Clicca su + per aggiungere la prima attività</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const injuryActivities = activities[injury.id] || []
                        const currentFilters = filteredActivityTypes[injury.id] || []
                        
                        // Se non ci sono filtri attivi, mostra tutte le attività
                        if (currentFilters.length === 0) {
                          return injuryActivities.map((activity) => {
                        const style = getActivityCardStyle(activity.activity_type, activity)

                        if (isPurchaseActivityType(activity.activity_type)) {
                          return renderPurchaseActivityCard(activity, injury.id, style)
                        }

                        if (activity.activity_type === 'insurance_refund') {
                          return renderInsuranceRefundCard(activity, injury.id)
                        }

                        return (
                          <div key={activity.id} className={`${style.bg} rounded-2xl py-4 px-2 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border-2 ${style.border} backdrop-blur-sm relative w-full`}>
                            {/* Data esattamente al centro orizzontale della card (posizionamento assoluto) */}
                            <div className="absolute left-1/2 -translate-x-1/2 top-4 flex items-center justify-center pointer-events-none">
                              <span className="text-base font-medium text-gray-600 whitespace-nowrap">📅 {new Date(activity.activity_date).toLocaleDateString('it-IT')}</span>
                            </div>
                            {/* Header: icona + titolo/badge a sinistra, azioni a destra */}
                            <div className="flex items-center justify-between mb-3 gap-2 px-1">
                              <div className="flex items-center gap-3 shrink-0">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white text-xl shadow-lg shrink-0`}>
                                  {style.icon}
                                </div>
                                <div>
                                  {/* Titolo e badge tipologia (nascondi "Visita Medica" per le visite mediche) */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {activity.activity_type !== 'medical_visit' && (
                                      <h3 className={`font-semibold ${style.color} text-lg`}>{getActivityTypeName(activity.activity_type)}</h3>
                                    )}
                                    {activity.activity_type === 'medical_visit' && activity.activity_description && (
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm shrink-0 ${
                                        activity.activity_description === 'PRIMA VISITA' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                        activity.activity_description === 'VISITA DI CONTROLLO' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                        activity.activity_description === 'VISITA DI CHIUSURA' ? 'bg-green-100 text-green-800 border border-green-200' :
                                        'bg-blue-100 text-blue-800 border border-blue-200'
                                      }`}>
                                        {activity.activity_description === 'PRIMA VISITA' && '🆕'}
                                        {activity.activity_description === 'VISITA DI CONTROLLO' && '🔄'}
                                        {activity.activity_description === 'VISITA DI CHIUSURA' && '✅'}
                                        <span className="ml-1">{activity.activity_description}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* Azioni */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => editActivity(activity)}
                                  className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 shadow-md hover:shadow-lg text-blue-600 hover:text-blue-700"
                                  title="Modifica"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteActivity(activity.id, injury.id, activity.activity_type)}
                                  className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 shadow-md hover:shadow-lg text-red-600 hover:text-red-700"
                                  title="Elimina"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Contenuto principale - dati distribuiti su tutta la larghezza, Ricontrollo/Prossimo sempre ultimo a destra */}
                            <div className="space-y-2 w-full">
                              <div className="flex flex-wrap gap-x-2 gap-y-2 w-full">
                                {/* Operatore */}
                                {activity.operator_name && (
                                  <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                      <span>👨‍⚕️</span>
                                      <span>Operatore</span>
                                    </div>
                                    <span className="text-base text-gray-700 mt-0.5">{activity.operator_name}</span>
                                  </div>
                                )}
                                {/* Durata */}
                                {activity.duration_minutes && (
                                  <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                      <span>⏱️</span>
                                      <span>Durata</span>
                                    </div>
                                    <span className="text-base text-gray-700 mt-0.5">{activity.duration_minutes} min</span>
                                  </div>
                                )}
                                {/* Trattamenti fisioterapia */}
                                {activity.activity_type === 'physiotherapy' && (activity.massaggio || activity.tecar || activity.laser) && (
                                  <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                      <span>💆‍♂️</span>
                                      <span>Trattamenti</span>
                                    </div>
                                    <div className="flex gap-1 mt-0.5 flex-wrap justify-center">
                                      {activity.massaggio && <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">Massaggio</span>}
                                      {activity.tecar && <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">Tecar</span>}
                                      {activity.laser && <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">Laser</span>}
                                    </div>
                                  </div>
                                )}
                                {/* Previsione Stop */}
                                {activity.expected_stop_days && (
                                  <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                      <span>⏸️</span>
                                      <span>Stop previsto</span>
                                    </div>
                                    <span className="text-base text-gray-700 mt-0.5">{activity.expected_stop_days} {activity.expected_stop_days === 1 ? 'giorno' : 'giorni'}</span>
                                  </div>
                                )}
                                {/* Autorizzazioni Campo/Palestra: se nessuna scelta, label "Nessuna attività", ma Campo e Palestra sempre visibili (grigi e barrati se non selezionati) */}
                                {(activity.activity_type === 'medical_visit' || activity.activity_type === 'physiotherapy') && (
                                  <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                      <span>⚡</span>
                                      <span>{!(activity.can_play_field || activity.can_play_gym) ? 'Nessuna attività' : 'Autorizzato'}</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 mt-0.5 flex-wrap">
                                      {activity.can_play_field ? (
                                        <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-sm font-medium">✓ Campo</span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-sm line-through">✗ Campo</span>
                                      )}
                                      {activity.can_play_gym ? (
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">✓ Palestra</span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-sm line-through">✗ Palestra</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {/* Ricontrollo / Prossimo sempre ultima voce a destra */}
                                {activity.ricontrollo && (
                                  <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                      <span>📅</span>
                                      <span>{activity.activity_type === 'physiotherapy' ? 'Prossimo' : 'Ricontrollo'}</span>
                                    </div>
                                    <span className="text-base text-gray-700 mt-0.5">
                                    {new Date(activity.ricontrollo).toLocaleDateString('it-IT')}
                                    {activity.ricontrollo_time && (
                                      <span className="ml-1 text-gray-600">{String(activity.ricontrollo_time).slice(0, 5)}</span>
                                    )}
                                  </span>
                                  </div>
                                )}
                              </div>

                              {/* Note - a capo se presenti, da bordo a bordo */}
                              {activity.notes && (
                                <div className="pt-2 mt-2 border-t border-white/60 -mx-2">
                                  <div className="flex items-start gap-2 py-2.5 px-3 bg-white/60 rounded-lg w-full min-w-0">
                                    <span className="text-gray-500 mt-0.5 shrink-0">💬</span>
                                    <p className="text-sm text-gray-700 italic leading-relaxed min-w-0 flex-1">{activity.notes}</p>
                                  </div>
                                </div>
                              )}

                              {/* Costo/Entrata - a capo se presenti, da bordo a bordo */}
                              {activity.amount && (
                                activity.activity_type === 'test' ||
                                activity.activity_type === 'insurance_refund' || 
                                activity.activity_type === 'equipment_purchase' || 
                                activity.activity_type === 'expenses'
                              ) && (
                                <div className="pt-2 mt-2 border-t border-white/60 -mx-2">
                                  <div className="flex items-center gap-2 py-2.5 px-3 bg-white/60 rounded-lg w-full">
                                    <span className="text-gray-500">
                                      {activity.activity_type === 'test' ? '🔬' :
                                       activity.activity_type === 'insurance_refund' ? '💰' : 
                                       activity.activity_type === 'equipment_purchase' ? '🛒' : '💸'}
                                    </span>
                                    <span className="font-medium text-gray-700">
                                      {activity.activity_type === 'test' ? 'Costo Esame:' :
                                       activity.activity_type === 'insurance_refund' ? 'Rimborso:' : 
                                       activity.activity_type === 'equipment_purchase' ? 'Costo Attrezzatura:' : 'Spese:'}
                                    </span>
                                    <span className={`text-lg font-bold ${
                                      activity.activity_type === 'insurance_refund' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {activity.amount} {activity.currency || 'EUR'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                        } else {
                          // Filtra le attività in base ai checkbox selezionati
                          return injuryActivities
                            .filter(activity => currentFilters.includes(activity.activity_type))
                            .map((activity) => {
                              const style = getActivityCardStyle(activity.activity_type, activity)

                              if (isPurchaseActivityType(activity.activity_type)) {
                                return renderPurchaseActivityCard(activity, injury.id, style)
                              }

                              if (activity.activity_type === 'insurance_refund') {
                                return renderInsuranceRefundCard(activity, injury.id)
                              }

                              return (
                                <div key={activity.id} className={`${style.bg} rounded-2xl py-4 px-2 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border-2 ${style.border} backdrop-blur-sm relative w-full`}>
                                  {/* Data esattamente al centro orizzontale della card (posizionamento assoluto) */}
                                  <div className="absolute left-1/2 -translate-x-1/2 top-4 flex items-center justify-center pointer-events-none">
                                    <span className="text-base font-medium text-gray-600 whitespace-nowrap">📅 {new Date(activity.activity_date).toLocaleDateString('it-IT')}</span>
                                  </div>
                                  {/* Header: icona + titolo/badge a sinistra, azioni a destra */}
                                  <div className="flex items-center justify-between mb-3 gap-2 px-1">
                                    <div className="flex items-center gap-3 shrink-0">
                                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white text-xl shadow-lg shrink-0`}>
                                        {style.icon}
                                      </div>
                                      <div>
                                        {/* Titolo e badge tipologia (nascondi "Visita Medica" per le visite mediche) */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {activity.activity_type !== 'medical_visit' && (
                                            <h3 className={`font-semibold ${style.color} text-lg`}>{getActivityTypeName(activity.activity_type)}</h3>
                                          )}
                                          {activity.activity_type === 'medical_visit' && activity.activity_description && (
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm shrink-0 ${
                                              activity.activity_description === 'PRIMA VISITA' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                              activity.activity_description === 'VISITA DI CONTROLLO' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                              activity.activity_description === 'VISITA DI CHIUSURA' ? 'bg-green-100 text-green-800 border border-green-200' :
                                              'bg-blue-100 text-blue-800 border border-blue-200'
                                            }`}>
                                              {activity.activity_description === 'PRIMA VISITA' && '🆕'}
                                              {activity.activity_description === 'VISITA DI CONTROLLO' && '🔄'}
                                              {activity.activity_description === 'VISITA DI CHIUSURA' && '✅'}
                                              <span className="ml-1">{activity.activity_description}</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {/* Azioni */}
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => editActivity(activity)}
                                        className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 shadow-md hover:shadow-lg text-blue-600 hover:text-blue-700"
                                        title="Modifica"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteActivity(activity.id, injury.id, activity.activity_type)}
                                        className="p-2 rounded-xl bg-white/80 hover:bg-white transition-all duration-200 shadow-md hover:shadow-lg text-red-600 hover:text-red-700"
                                        title="Elimina"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Contenuto principale - dati distribuiti su tutta la larghezza, Ricontrollo/Prossimo sempre ultimo a destra */}
                                  <div className="space-y-2 w-full">
                                    <div className="flex flex-wrap gap-x-2 gap-y-2 w-full">
                                      {/* Operatore */}
                                      {activity.operator_name && (
                                        <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                            <span>👨‍⚕️</span>
                                            <span>Operatore</span>
                                          </div>
                                          <span className="text-base text-gray-700 mt-0.5">{activity.operator_name}</span>
                                        </div>
                                      )}
                                      {/* Durata */}
                                      {activity.duration_minutes && (
                                        <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                            <span>⏱️</span>
                                            <span>Durata</span>
                                          </div>
                                          <span className="text-base text-gray-700 mt-0.5">{activity.duration_minutes} min</span>
                                        </div>
                                      )}
                                      {/* Trattamenti fisioterapia */}
                                      {activity.activity_type === 'physiotherapy' && (activity.massaggio || activity.tecar || activity.laser) && (
                                        <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                            <span>💆‍♂️</span>
                                            <span>Trattamenti</span>
                                          </div>
                                          <div className="flex gap-1 mt-0.5 flex-wrap justify-center">
                                            {activity.massaggio && <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">Massaggio</span>}
                                            {activity.tecar && <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">Tecar</span>}
                                            {activity.laser && <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">Laser</span>}
                                          </div>
                                        </div>
                                      )}
                                      {/* Previsione Stop */}
                                      {activity.expected_stop_days && (
                                        <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                            <span>⏸️</span>
                                            <span>Stop previsto</span>
                                          </div>
                                          <span className="text-base text-gray-700 mt-0.5">{activity.expected_stop_days} {activity.expected_stop_days === 1 ? 'giorno' : 'giorni'}</span>
                                        </div>
                                      )}
                                      {/* Autorizzazioni Campo/Palestra: se nessuna scelta, label "Nessuna attività", ma Campo e Palestra sempre visibili (grigi e barrati se non selezionati) */}
                                      {(activity.activity_type === 'medical_visit' || activity.activity_type === 'physiotherapy') && (
                                        <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                            <span>⚡</span>
                                            <span>{!(activity.can_play_field || activity.can_play_gym) ? 'Nessuna attività' : 'Autorizzato'}</span>
                                          </div>
                                          <div className="flex items-center justify-center gap-2 mt-0.5 flex-wrap">
                                            {activity.can_play_field ? (
                                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-sm font-medium">✓ Campo</span>
                                            ) : (
                                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-sm line-through">✗ Campo</span>
                                            )}
                                            {activity.can_play_gym ? (
                                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">✓ Palestra</span>
                                            ) : (
                                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-sm line-through">✗ Palestra</span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {/* Ricontrollo / Prossimo sempre ultima voce a destra */}
                                      {activity.ricontrollo && (
                                        <div className="flex flex-col flex-1 min-w-[4rem] items-center justify-center text-center">
                                          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                            <span>📅</span>
                                            <span>{activity.activity_type === 'physiotherapy' ? 'Prossimo' : 'Ricontrollo'}</span>
                                          </div>
                                          <span className="text-base text-gray-700 mt-0.5">
                                            {new Date(activity.ricontrollo).toLocaleDateString('it-IT')}
                                            {activity.ricontrollo_time && (
                                              <span className="ml-1 text-gray-600">{String(activity.ricontrollo_time).slice(0, 5)}</span>
                                            )}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Note - a capo se presenti, da bordo a bordo */}
                                    {activity.notes && (
                                      <div className="pt-2 mt-2 border-t border-white/60 -mx-2">
                                        <div className="flex items-start gap-2 py-2.5 px-3 bg-white/60 rounded-lg w-full min-w-0">
                                          <span className="text-gray-500 mt-0.5 shrink-0">💬</span>
                                          <p className="text-sm text-gray-700 italic leading-relaxed min-w-0 flex-1">{activity.notes}</p>
                                        </div>
                                      </div>
                                    )}

                                    {/* Costo/Entrata - a capo se presenti, da bordo a bordo */}
                                    {activity.amount && (
                                      activity.activity_type === 'test' ||
                                      activity.activity_type === 'insurance_refund' || 
                                      activity.activity_type === 'equipment_purchase' || 
                                      activity.activity_type === 'expenses'
                                    ) && (
                                      <div className="pt-2 mt-2 border-t border-white/60 -mx-2">
                                        <div className="flex items-center gap-2 py-2.5 px-3 bg-white/60 rounded-lg w-full">
                                          <span className="text-gray-500">
                                            {activity.activity_type === 'test' ? '🔬' :
                                             activity.activity_type === 'insurance_refund' ? '💰' : 
                                             activity.activity_type === 'equipment_purchase' ? '🛒' : '💸'}
                                          </span>
                                          <span className="font-medium text-gray-700">
                                            {activity.activity_type === 'test' ? 'Costo Esame:' :
                                             activity.activity_type === 'insurance_refund' ? 'Rimborso:' : 
                                             activity.activity_type === 'equipment_purchase' ? 'Costo Attrezzatura:' : 'Spese:'}
                                          </span>
                                          <span className={`text-lg font-bold ${
                                            activity.activity_type === 'insurance_refund' ? 'text-green-600' : 'text-red-600'
                                          }`}>
                                            {activity.amount} {activity.currency || 'EUR'}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                        }
                      })()}
                    </div>
                  )}
                </div>
              )}
              </>
              )}
            </div>
            </div>
          ); })}
        </div>
      )}

      {/* Modal nuovo evento assicurazione */}
      {newInsuranceEventModal.open && newInsuranceEventModal.injuryId && (() => {
        const injuryId = newInsuranceEventModal.injuryId!
        const hasAperturaSinistroForModal = hasAperturaSinistroForInjury(injuryId)
        const hasRicezioneBrixiaForModal = hasRicezioneBrixiaForInjury(injuryId)
        const allowedEventTypes = getAllowedEventTypesForInjury(injuryId)
        const selectValue = allowedEventTypes.includes(newInsuranceEventType) ? newInsuranceEventType : (allowedEventTypes[0] || '')
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeNewInsuranceEventModal}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-3">
              <h3 className="text-lg font-semibold text-gray-900">Nuovo evento assicurazione</h3>
            </div>
            <div className="px-6 overflow-y-auto flex-1 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Data</span>
                <input
                  type="date"
                  value={newInsuranceEventDate}
                  onChange={(e) => setNewInsuranceEventDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
                />
              </label>
              <div>
                <span className="text-sm font-medium text-gray-700">Tipo evento</span>
                {selectValue && (
                  <p className="mt-1 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    Selezionato: {selectValue}
                  </p>
                )}
                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-gray-300 bg-white divide-y divide-gray-100">
                  {effectiveEventTypes.map((opt) => {
                    const isCorrispondenza = isCorrispondenzaOption(opt)
                    const isPrivacy = isPrivacyRelatedOption(opt)
                    const isAfterApertura = isOptionAfterAperturaSinistro(opt)
                    const disabledByApertura = !isCorrispondenza && (isPrivacy || isAfterApertura) && !hasAperturaSinistroForModal
                    const disabledByRicezioneBrixia = !hasRicezioneBrixiaForModal && isInvioPrivacyType(opt)
                    const disabled = disabledByApertura || disabledByRicezioneBrixia
                    const hint = disabledByApertura ? 'Prima aggiungi Apertura Sinistro' : disabledByRicezioneBrixia ? 'Prima aggiungi Ricezione Privacy Brixia' : ''
                    const selected = selectValue === opt
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={disabled}
                        onClick={() => setNewInsuranceEventType(opt)}
                        className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                          selected ? 'bg-blue-600 text-white' : disabled ? 'text-gray-400 cursor-not-allowed bg-gray-50' : 'text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <span>{opt}</span>
                        {hint && (
                          <span className={`block text-xs mt-0.5 ${selected ? 'text-blue-100' : 'text-gray-500'}`}>
                            {hint}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={closeNewInsuranceEventModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={saveNewInsuranceEvent}
                disabled={savingNewInsuranceEvent || !selectValue}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingNewInsuranceEvent ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      );
      })()}

      {/* Modal Invia email con allegati (dopo Apertura Sinistro) */}
      {sendEmailModal.open && sendEmailModal.injuryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Invia email con template e allegati</h3>
            <p className="text-sm text-gray-600">
              Verranno inviati il corpo del template Assicurazione e i documenti caricati per questo infortunio (se presenti tra quelli selezionati nel template).
            </p>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email destinatario <span className="text-red-500">*</span></span>
              <input
                type="email"
                value={sendEmailTo}
                onChange={(e) => setSendEmailTo(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
                placeholder="es. assicurazioni@compagnia.it"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSendEmailModal({ open: false, injuryId: null })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={sendInjuryEmail}
                disabled={sendEmailSending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sendEmailSending ? 'Invio in corso...' : 'Invia email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aggiungi/Modifica promemoria */}
      {reminderModal.open && reminderModal.injuryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setReminderModal(prev => ({ ...prev, open: false }))}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">{reminderModal.reminder ? 'Modifica promemoria' : 'Nuovo promemoria'}</h3>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Testo <span className="text-red-500">*</span></span>
              <textarea
                value={reminderForm.content}
                onChange={(e) => setReminderForm(prev => ({ ...prev, content: e.target.value }))}
                rows={3}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
                placeholder="es. Ricontrollo risonanza"
              />
            </label>
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Data e ora avviso (opzionale)</span>
              <div className="flex gap-2 flex-wrap">
                <label className="flex-1 min-w-[140px]">
                  <span className="sr-only">Data</span>
                  <input
                    type="date"
                    value={reminderForm.reminderDate}
                    onChange={(e) => setReminderForm(prev => ({ ...prev, reminderDate: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
                  />
                </label>
                <label className="flex-1 min-w-[100px]">
                  <span className="sr-only">Ora</span>
                  <input
                    type="time"
                    value={reminderForm.reminderTime}
                    onChange={(e) => setReminderForm(prev => ({ ...prev, reminderTime: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">Riceverai un avviso nell’app e una notifica sul PC a questa data e ora.</p>
            </div>
            <div className="space-y-3">
              <span className="text-sm font-medium text-gray-700">Visibilità</span>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <input
                  type="radio"
                  name="reminderVisibility"
                  checked={reminderForm.isPublic}
                  onChange={() => setReminderForm(prev => ({ ...prev, isPublic: true }))}
                  className="mt-1 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Pubblico</span>
                  <p className="text-xs text-gray-500 mt-0.5">Tutti possono vedere, modificare ed eliminare questo promemoria.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <input
                  type="radio"
                  name="reminderVisibility"
                  checked={!reminderForm.isPublic}
                  onChange={() => setReminderForm(prev => ({ ...prev, isPublic: false }))}
                  className="mt-1 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Privato</span>
                  <p className="text-xs text-gray-500 mt-0.5">Solo tu lo vedrai e potrai modificarlo o eliminarlo.</p>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setReminderModal(prev => ({ ...prev, open: false }))} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Annulla</button>
              <button type="button" onClick={saveReminder} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Salva</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default InjuriesTab