import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface DocumentsTabProps {
  form: any
  handleInputChange: (field: string, value: string) => void
  isFieldDisabled: () => boolean
  personId?: string | null  // ID della persona per caricare i documenti
}

interface Document {
  id: string
  title: string
  category: string
  file_path: string
  created_at: string
  file_size?: number
  file_type?: string
  expiry_date?: string
}

const DOCUMENT_CATEGORIES = [
  { value: 'id_card', label: 'Documento Identità' },
  { value: 'certificate', label: 'Visita Medica' },
  { value: 'codice_fiscale', label: 'Codice Fiscale' },
  { value: 'modello_12', label: 'Modello 12' },
  { value: 'receipt', label: 'Ricevuta Pagamento' },
  { value: 'consent', label: 'Consenso/Liberatoria' },
  { value: 'other', label: 'Altro' }
]

type UploadTypeChoice = 'documento_identita' | 'visita_medica' | 'codice_fiscale' | 'modello_12' | 'altro'

/** Stagione sportiva: 1° luglio – 30 giugno. Restituisce es. "25-26" per 2025-2026. */
function getSeasonShortLabel(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const startYear = month >= 6 ? year : year - 1
  const endYear = startYear + 1
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ 
  form, 
  handleInputChange, 
  isFieldDisabled,
  personId 
}) => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadFormData, setUploadFormData] = useState({
    title: '',
    category: 'other',
    expiryDate: '',
    file: null as File | null
  })
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [editFormData, setEditFormData] = useState({
    title: '',
    category: 'other',
    expiryDate: ''
  })

  // Modal scelta tipo documento prima dell'upload
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [selectedUploadType, setSelectedUploadType] = useState<UploadTypeChoice | null>(null)
  const [expiryForUpload, setExpiryForUpload] = useState('')
  const [customTitleForUpload, setCustomTitleForUpload] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadIntent, setUploadIntent] = useState<{ title: string; category: string; expiryDate?: string } | null>(null)

  // Carica documenti all'apertura
  useEffect(() => {
    if (personId) {
      loadDocuments()
    }
  }, [personId])

  const loadDocuments = async () => {
    if (!personId) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('person_id', personId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error: any) {
      console.error('Errore caricamento documenti:', error)
      toast.error('Errore nel caricamento dei documenti')
    } finally {
      setLoading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const validateFile = (file: File): boolean => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo file non supportato. Usa PDF, JPG o PNG')
      return false
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File troppo grande. Massimo 10MB')
      return false
    }
    return true
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0 && validateFile(files[0])) {
      setPendingFile(files[0])
      setSelectedUploadType(null)
      setExpiryForUpload('')
      setCustomTitleForUpload('')
      setShowTypeModal(true)
    }
  }

  const openTypeModal = () => {
    setPendingFile(null)
    setSelectedUploadType(null)
    setExpiryForUpload('')
    setCustomTitleForUpload('')
    setShowTypeModal(true)
  }

  const handleTypeModalContinue = () => {
    if (!selectedUploadType) {
      toast.error('Seleziona un tipo di documento')
      return
    }
    const needsExpiry = selectedUploadType === 'documento_identita' || selectedUploadType === 'visita_medica' || selectedUploadType === 'codice_fiscale'
    if (needsExpiry && !expiryForUpload) {
      toast.error('Inserisci la data di scadenza del documento')
      return
    }
    if (selectedUploadType === 'altro') {
      const t = customTitleForUpload?.trim()
      if (!t) {
        toast.error('Inserisci il titolo del documento')
        return
      }
    }

    let title: string
    let category: string
    let expiryDate: string | undefined
    switch (selectedUploadType) {
      case 'documento_identita':
        title = 'documento di identità'
        category = 'id_card'
        expiryDate = expiryForUpload
        break
      case 'visita_medica':
        title = 'Visita Medica'
        category = 'certificate'
        expiryDate = expiryForUpload
        break
      case 'codice_fiscale':
        title = 'Codice Fiscale'
        category = 'codice_fiscale'
        expiryDate = expiryForUpload
        break
      case 'modello_12':
        title = `Modello 12 (${getSeasonShortLabel()})`
        category = 'modello_12'
        break
      default:
        title = customTitleForUpload.trim()
        category = 'other'
    }

    setUploadIntent({ title, category, expiryDate })
    setShowTypeModal(false)
    setSelectedUploadType(null)
    setExpiryForUpload('')
    setCustomTitleForUpload('')

    if (pendingFile) {
      const snapshot = { title, category, expiryDate: expiryDate || '', file: pendingFile }
      setUploadFormData(snapshot)
      setPendingFile(null)
      handleUploadWithCurrentForm(snapshot)
    } else {
      // Apri il selettore file dopo che il modal è stato chiuso (così l'utente vede il modal sparire)
      setTimeout(() => {
        fileInputRef.current?.click()
      }, 0)
    }
  }

  const handleFileSelect = (file: File) => {
    if (!validateFile(file)) return
    if (uploadIntent) {
      const snapshot = {
        title: uploadIntent.title,
        category: uploadIntent.category,
        expiryDate: uploadIntent.expiryDate || '',
        file
      }
      setUploadFormData(snapshot)
      setUploadIntent(null)
      handleUploadWithCurrentForm(snapshot)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    const defaultTitle = file.name.replace(/\.[^/.]+$/, '')
    setUploadFormData({ title: defaultTitle, category: 'other', expiryDate: '', file })
    setShowUploadForm(true)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0])
    }
  }

  type UploadFormSnapshot = { title: string; category: string; expiryDate: string; file: File }

  const handleUploadWithCurrentForm = (snapshot?: UploadFormSnapshot) => {
    const data = snapshot || uploadFormData
    if (!data.file || !data.title || !personId) {
      toast.error('Compila tutti i campi')
      return
    }
    if ((data.category === 'id_card' || data.category === 'certificate' || data.category === 'codice_fiscale') && !data.expiryDate) {
      toast.error('Inserisci la data di scadenza')
      return
    }
    handleUpload(data)
  }

  const handleUpload = async (override?: UploadFormSnapshot) => {
    const data = override || uploadFormData
    if (!data.file || !data.title || !personId) return

    try {
      setUploading(true)

      if (data.category === 'modello_12') {
        const { data: existing } = await supabase
          .from('documents')
          .select('id, file_path')
          .eq('person_id', personId)
          .eq('category', 'modello_12')
        if (existing && existing.length > 0) {
          for (const doc of existing) {
            const { bucket, path } = getStorageBucketAndPath(doc.file_path)
            await supabase.storage.from(bucket).remove([path])
            await supabase.from('documents').delete().eq('id', doc.id)
          }
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const randomId = Math.random().toString(36).substr(2, 9)
      const fileExt = data.file.name.split('.').pop()
      const filename = `${timestamp}_${randomId}.${fileExt}`
      const filePath = `people/${personId}/${filename}`

      const { error: uploadError } = await supabase.storage
        .from('docs')
        .upload(filePath, data.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: data.file.type
        })

      if (uploadError) throw uploadError

      const documentData: any = {
        person_id: personId,
        title: data.title,
        category: data.category,
        file_path: filePath,
        file_size: data.file.size,
        file_type: data.file.type,
        visibility: 'staff'
      }
      if (data.expiryDate) {
        documentData.expiry_date = data.expiryDate
      }

      const { error: dbError } = await supabase.from('documents').insert(documentData)
      if (dbError) throw dbError

      toast.success('Documento caricato con successo!')
      setShowUploadForm(false)
      setUploadFormData({ title: '', category: 'other', expiryDate: '', file: null })
      setUploadIntent(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadDocuments()
    } catch (error: any) {
      console.error('Errore upload:', error)
      toast.error(error?.message || error?.hint || 'Errore nel caricamento del documento')
    } finally {
      setUploading(false)
    }
  }

  // Estrae bucket e path da file_path (gestisce path relativi e URL pubblici da FlowMe)
  const getStorageBucketAndPath = (filePath: string): { bucket: string; path: string } => {
    const defaultBucket = 'docs'
    if (!filePath) return { bucket: defaultBucket, path: filePath }
    // Se è un URL completo (es. da FlowMe), estrae bucket e path
    const urlMatch = filePath.match(/\/object\/public\/([^/]+)\/(.+)$/)
    if (urlMatch) {
      return { bucket: urlMatch[1], path: urlMatch[2] }
    }
    // Se è già un path relativo (people/... o documents/...), usa bucket docs
    return { bucket: defaultBucket, path: filePath }
  }

  const handleDownload = async (doc: Document) => {
    try {
      // Se file_path è già un URL pubblico (es. da FlowMe), apri direttamente
      if (doc.file_path.startsWith('http://') || doc.file_path.startsWith('https://')) {
        window.open(doc.file_path, '_blank')
        return
      }

      const { bucket, path } = getStorageBucketAndPath(doc.file_path)
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60) // 1 ora

      if (error) throw error

      // Apri in nuova finestra
      window.open(data.signedUrl, '_blank')
      
    } catch (error: any) {
      console.error('Errore download:', error)
      toast.error('Errore nel download del documento')
    }
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm('Sei sicuro di voler eliminare questo documento?')) return

    try {
      // AGGIORNA IMMEDIATAMENTE l'interfaccia per feedback istantaneo
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      
      // Elimina file da storage (usa bucket e path corretti per documenti da FlowMe)
      const { bucket, path } = getStorageBucketAndPath(doc.file_path)
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([path])

      if (storageError) throw storageError

      // Elimina record da database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id)

      if (dbError) throw dbError

      toast.success('Documento eliminato')

    } catch (error: any) {
      console.error('Errore eliminazione:', error)
      toast.error('Errore nell\'eliminazione del documento')
      
      // In caso di errore, ripristina il documento nella lista
      setDocuments(prev => [...prev, doc])
    }
  }

  const handleEditDocument = (doc: Document) => {
    setEditingDocument(doc)
    setEditFormData({
      title: doc.title,
      category: doc.category,
      expiryDate: doc.expiry_date ? doc.expiry_date.split('T')[0] : ''
    })
  }

  const handleSaveEdit = async () => {
    if (!editingDocument) return

    try {
      const updateData: any = {
        title: editFormData.title,
        category: editFormData.category,
        updated_at: new Date().toISOString()
      }

      if (editFormData.expiryDate) {
        updateData.expiry_date = editFormData.expiryDate
      } else {
        updateData.expiry_date = null
      }

      const { error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', editingDocument.id)

      if (error) throw error

      toast.success('Documento modificato con successo')
      setEditingDocument(null)
      loadDocuments()
    } catch (error: any) {
      console.error('Errore modifica documento:', error)
      toast.error('Errore nella modifica del documento')
    }
  }

  const handleCancelEdit = () => {
    setEditingDocument(null)
    setEditFormData({
      title: '',
      category: 'other',
      expiryDate: ''
    })
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getExpiryDateColor = (expiryDate: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset ore per confronto solo date
    
    const expiry = new Date(expiryDate)
    expiry.setHours(0, 0, 0, 0)
    
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return 'text-red-600' // Scaduta
    } else if (diffDays <= 30) {
      return 'text-orange-600' // Scade entro 30 giorni
    } else {
      return 'text-green-600' // Valida oltre 31 giorni
    }
  }

  const getCategoryLabel = (category: string) => {
    return DOCUMENT_CATEGORIES.find(c => c.value === category)?.label || category
  }

  const getFileIcon = (fileType?: string) => {
    if (fileType?.includes('pdf')) return '📄'
    if (fileType?.includes('image')) return '🖼️'
    return '📎'
  }

  return (
    <div className="space-y-6">
      {/* Modal scelta tipo documento - non si chiude cliccando fuori */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Che tipo di documento stai caricando?</h3>
            <div className="space-y-1">
              {[
                { value: 'documento_identita' as const, label: 'Documento di identità' },
                { value: 'visita_medica' as const, label: 'Visita medica' },
                { value: 'codice_fiscale' as const, label: 'Codice fiscale' },
                { value: 'modello_12' as const, label: 'Modello 12' },
                { value: 'altro' as const, label: 'Altro' }
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-100 cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                  <input
                    type="radio"
                    name="uploadType"
                    checked={selectedUploadType === value}
                    onChange={() => setSelectedUploadType(value)}
                    className="h-4 w-4 text-brixia-primary focus:ring-brixia-primary border-gray-300"
                  />
                  <span className="text-gray-900 font-medium">{label}</span>
                </label>
              ))}
            </div>
            {(selectedUploadType === 'documento_identita' || selectedUploadType === 'visita_medica' || selectedUploadType === 'codice_fiscale') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data di scadenza documento</label>
                <input
                  type="date"
                  value={expiryForUpload}
                  onChange={(e) => setExpiryForUpload(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brixia-primary focus:border-brixia-primary bg-white text-gray-900"
                />
              </div>
            )}
            {selectedUploadType === 'altro' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titolo del documento</label>
                <input
                  type="text"
                  value={customTitleForUpload}
                  onChange={(e) => setCustomTitleForUpload(e.target.value)}
                  placeholder="Scrivi il titolo"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brixia-primary focus:border-brixia-primary bg-white text-gray-900 placeholder:text-gray-500"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowTypeModal(false); setPendingFile(null); setSelectedUploadType(null) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleTypeModalContinue}
                className="flex-1 py-2.5 rounded-xl bg-brixia-primary text-white font-medium hover:bg-brixia-primary/90 transition-colors"
              >
                Continua
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Numero Tessera */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Numero Tessera
          </label>
          <input
            type="text"
            value={form.membership_number || ''}
            onChange={(e) => handleInputChange('membership_number', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-500 disabled:bg-white disabled:text-gray-900"
            placeholder="Numero tessera associativa"
          />
        </div>
        
        {/* Codice FIR */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Codice FIR
          </label>
          <input
            type="text"
            value={form.fir_code || ''}
            onChange={(e) => handleInputChange('fir_code', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-500 disabled:bg-white disabled:text-gray-900"
            placeholder="Codice identificativo FIR"
          />
        </div>
      </div>
      
      {/* Sezione Upload Documenti */}
      <div className="border-t pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Documenti</h3>
          {documents.length > 0 && (
            <span className="text-sm text-gray-500">
              {documents.length} documento{documents.length !== 1 ? 'i' : ''}
            </span>
          )}
        </div>

        {!personId ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <p className="text-sm text-yellow-800">
              Salva la persona prima di caricare documenti
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Lista documenti caricati */}
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Caricamento documenti...
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nessun documento caricato
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => handleEditDocument(doc)}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-2xl shrink-0">{getFileIcon(doc.file_type)}</span>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0 text-base text-gray-500 min-w-0 flex-1">
                        <span className="font-medium text-gray-900">{doc.title}</span>
                        <span>•</span>
                        <span>{formatDate(doc.created_at)}</span>
                        {doc.expiry_date && (
                          <>
                            <span>•</span>
                            <span className={`${getExpiryDateColor(doc.expiry_date)} font-medium`}>
                              Scadenza: {formatDate(doc.expiry_date)}
                            </span>
                          </>
                        )}
                        {doc.file_size && (
                          <>
                            <span>•</span>
                            <span>{formatFileSize(doc.file_size)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownload(doc)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Visualizza/Scarica"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(doc)
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Elimina"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Form di modifica documento */}
            {editingDocument && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-800 mb-4">
                  Modifica Documento: {editingDocument.title}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Titolo Documento
                    </label>
                    <input
                      type="text"
                      value={editFormData.title || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-500"
                      placeholder="Inserisci il titolo del documento"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoria
                    </label>
                    <select
                      value={editFormData.category || 'other'}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    >
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data di Scadenza (opzionale)
                    </label>
                    <input
                      type="date"
                      value={editFormData.expiryDate || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Salva Modifiche
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Area Upload */}
            {!showUploadForm ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={openTypeModal}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  Trascina qui i documenti o clicca per selezionare
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PDF, JPG, PNG fino a 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              // Form Upload
              <div className="border border-gray-300 rounded-lg p-4 space-y-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">Nuovo Documento</h4>
                  <button
                    onClick={() => {
                      setShowUploadForm(false)
                      setUploadFormData({ title: '', category: 'other', expiryDate: '', file: null })
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {uploadFormData.file && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white p-2 rounded">
                    <span>{getFileIcon(uploadFormData.file.type)}</span>
                    <span className="flex-1 truncate">{uploadFormData.file.name}</span>
                    <span className="text-xs text-gray-500">
                      {formatFileSize(uploadFormData.file.size)}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titolo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadFormData.title || ''}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-500"
                    placeholder="Es: Carta d'identità"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={uploadFormData.category || 'other'}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    {DOCUMENT_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Campo data di scadenza per Documento Identità e Visita Medica */}
                {(uploadFormData.category === 'id_card' || uploadFormData.category === 'certificate') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data di Scadenza <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={uploadFormData.expiryDate || ''}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !uploadFormData.title || ((uploadFormData.category === 'id_card' || uploadFormData.category === 'certificate') && !uploadFormData.expiryDate)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Caricamento...' : 'Carica Documento'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DocumentsTab




