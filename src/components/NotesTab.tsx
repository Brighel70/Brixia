import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface NoteItem {
  id: string
  date: string
  type: string
  content: string
  created_by: string
  reminder_date?: string | null
  fee_id?: string | null
  creator_name?: string
}

interface NotesTabProps {
  personId: string
  /** Se true, mostra il form di aggiunta nota */
  addFormOpen?: boolean
  /** Chiamato quando l'utente chiude il form aggiunta (Annulla) */
  onAddFormClose?: () => void
  /** Chiamato quando le note cambiano (per tab Quote e altri usi) */
  onNotesChange?: (notes: NoteItem[]) => void
  /** Chiamato quando le note filtrate cambiano (per contatore "X di Y note") */
  onFilteredNotesChange?: (filteredCount: number, totalCount: number) => void
  /** Incrementa per forzare ricaricamento note (es. da tab Infortuni) */
  refreshTrigger?: number
}

const NotesTab: React.FC<NotesTabProps> = ({
  personId,
  addFormOpen = false,
  onAddFormClose,
  onNotesChange,
  onFilteredNotesChange,
  refreshTrigger = 0,
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [newNote, setNewNote] = useState({ content: '', type: 'note' })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showDateModal, setShowDateModal] = useState(false)
  const [pendingNote, setPendingNote] = useState<{ content: string; type: string }>({ content: '', type: 'note' })
  const [reminderDate, setReminderDate] = useState('')
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')
  const [editNoteType, setEditNoteType] = useState('note')
  const [editReminderDate, setEditReminderDate] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<NoteItem | null>(null)

  const loadNotes = async () => {
    if (!personId) return
    try {
      setLoadingNotes(true)
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('person_id', personId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Errore nel caricamento delle note:', error)
        return
      }

      const notesData: NoteItem[] = (data || []).map(note => ({
        id: note.id,
        date: note.created_at,
        type: note.type,
        content: note.content,
        created_by: note.created_by,
        reminder_date: (note as { reminder_date?: string }).reminder_date ?? null,
        fee_id: (note as { fee_id?: string }).fee_id ?? null,
      }))

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const creatorIds = [...new Set(notesData.map(n => n.created_by).filter((id): id is string => !!id && uuidRegex.test(id)))]
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds)
        const creatorMap: Record<string, string> = Object.fromEntries((profs || []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || 'Utente']))
        notesData.forEach(n => {
          if (n.created_by && uuidRegex.test(n.created_by)) {
            n.creator_name = creatorMap[n.created_by] || n.created_by
          } else {
            n.creator_name = n.created_by || null
          }
        })
      }

      setNotes(notesData)
      onNotesChange?.(notesData)
    } catch (error) {
      console.error('Errore nel caricamento delle note:', error)
    } finally {
      setLoadingNotes(false)
    }
  }

  useEffect(() => {
    if (personId) loadNotes()
  }, [personId, refreshTrigger])

  useEffect(() => {
    onNotesChange?.(notes)
  }, [notes])

  const getFilteredAndSortedNotes = () => {
    let filtered = notes
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(note => {
        const creator = note.creator_name ?? note.created_by ?? ''
        return note.content.toLowerCase().includes(q) || (creator && String(creator).toLowerCase().includes(q))
      })
    }
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(note => selectedTypes.includes(note.type))
    }
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      filtered = filtered.filter(note => {
        const noteDate = new Date(note.date)
        const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate())
        switch (dateFilter) {
          case 'today': return noteDateOnly.getTime() === today.getTime()
          case 'week':
            const weekAgo = new Date(today)
            weekAgo.setDate(weekAgo.getDate() - 7)
            return noteDateOnly >= weekAgo
          case 'month':
            const monthAgo = new Date(today)
            monthAgo.setMonth(monthAgo.getMonth() - 1)
            return noteDateOnly >= monthAgo
          default: return true
        }
      })
    }
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'date': comparison = new Date(a.date).getTime() - new Date(b.date).getTime(); break
        case 'type': comparison = a.type.localeCompare(b.type); break
        case 'author':
          const authorA = a.creator_name ?? a.created_by ?? ''
          const authorB = b.creator_name ?? b.created_by ?? ''
          comparison = String(authorA).localeCompare(String(authorB))
          break
        default: comparison = 0
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })
    return sorted
  }

  const filteredNotes = useMemo(() => getFilteredAndSortedNotes(), [notes, searchQuery, selectedTypes, dateFilter, sortBy, sortOrder])
  useEffect(() => {
    onFilteredNotesChange?.(filteredNotes.length, notes.length)
  }, [filteredNotes.length, notes.length, onFilteredNotesChange])

  const handleTypeFilterChange = (type: string, checked: boolean) => {
    if (checked) setSelectedTypes(prev => [...prev, type])
    else setSelectedTypes(prev => prev.filter(t => t !== type))
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedTypes([])
    setDateFilter('all')
    setSortBy('date')
    setSortOrder('desc')
  }

  const getNoteTypeName = (type: string) => {
    switch (type) {
      case 'medical': return 'Medica'
      case 'injury': return 'Infortunio'
      case 'training': return 'Allenamento'
      case 'secretary': return 'Segreteria'
      case 'quote': return 'Quote'
      default: return 'Generale'
    }
  }

  const getNoteColor = (type: string) => {
    switch (type) {
      case 'medical': return 'border-l-red-500 bg-red-50'
      case 'injury': return 'border-l-orange-500 bg-orange-50'
      case 'training': return 'border-l-green-500 bg-green-50'
      case 'secretary': return 'border-l-purple-500 bg-purple-50'
      case 'quote': return 'border-l-amber-500 bg-amber-50'
      default: return 'border-l-blue-500 bg-blue-50'
    }
  }

  const getNoteIcon = (type: string) => {
    const iconClass = 'w-4 h-4'
    switch (type) {
      case 'medical': return <svg className={`${iconClass} text-red-500`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
      case 'injury': return <svg className={`${iconClass} text-orange-500`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
      case 'training': return <svg className={`${iconClass} text-green-500`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" /></svg>
      case 'secretary': return <svg className={`${iconClass} text-purple-500`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
      case 'quote': return <svg className={`${iconClass} text-amber-500`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
      default: return <svg className={`${iconClass} text-blue-500`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
    }
  }

  const formatReminderDate = (reminderDate: string) => {
    try {
      return new Date(reminderDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return 'Data non valida'
    }
  }

  const getReminderStatus = (reminderDate: string) => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const reminder = new Date(reminderDate)
      reminder.setHours(0, 0, 0, 0)
      const diffDays = Math.ceil((reminder.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays < 0) return { status: 'expired', text: 'Scaduto', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' }
      if (diffDays === 0) return { status: 'today', text: 'Oggi', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' }
      if (diffDays <= 7) return { status: 'soon', text: `${diffDays} giorni`, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' }
      return { status: 'future', text: `${diffDays} giorni`, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' }
    } catch {
      return { status: 'error', text: 'Errore', color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' }
    }
  }

  const handleAddNote = () => {
    if (!newNote.content.trim() || !personId) return
    setPendingNote({ ...newNote })
    setShowReminderModal(true)
  }

  const handleReminderChoice = (hasReminder: boolean) => {
    setShowReminderModal(false)
    if (hasReminder) setShowDateModal(true)
    else saveNote(pendingNote, null)
  }

  const handleDateSelection = () => {
    if (!reminderDate) return
    setShowDateModal(false)
    saveNote(pendingNote, reminderDate)
  }

  const saveNote = async (noteData: { content: string; type: string }, reminderDate: string | null) => {
    try {
      setLoadingNotes(true)
      const insertData: Record<string, unknown> = {
        person_id: personId,
        content: noteData.content.trim(),
        type: noteData.type,
        created_by: 'Sistema',
      }
      if (reminderDate) insertData.reminder_date = reminderDate
      const { error } = await supabase.from('notes').insert([insertData])
      if (error) throw error
      setNewNote({ content: '', type: 'note' })
      setPendingNote({ content: '', type: 'note' })
      setReminderDate('')
      onAddFormClose?.()
      await loadNotes()
    } catch (error) {
      console.error('Errore nel salvataggio della nota:', error)
    } finally {
      setLoadingNotes(false)
    }
  }

  const handleEditNote = (note: NoteItem) => {
    setEditingNote(note)
    setEditNoteContent(note.content)
    setEditNoteType(note.type)
    setEditReminderDate(note.reminder_date || '')
  }

  const handleSaveEdit = async () => {
    if (!editingNote || !editNoteContent.trim()) return
    try {
      setLoadingNotes(true)
      const updateData: Record<string, unknown> = {
        content: editNoteContent.trim(),
        type: editNoteType,
        updated_at: new Date().toISOString(),
        reminder_date: editReminderDate?.trim() ? editReminderDate : null,
      }
      const { error } = await supabase.from('notes').update(updateData).eq('id', editingNote.id)
      if (error) throw error
      setEditingNote(null)
      setEditNoteContent('')
      setEditNoteType('note')
      setEditReminderDate('')
      await loadNotes()
    } catch (error) {
      console.error('Errore nell\'aggiornamento della nota:', error)
    } finally {
      setLoadingNotes(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingNote(null)
    setEditNoteContent('')
    setEditNoteType('note')
    setEditReminderDate('')
  }

  const handleDeleteNote = (note: NoteItem) => {
    setNoteToDelete(note)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteToDelete.id)
      if (error) throw error
      await loadNotes()
    } catch (error) {
      console.error('Errore nell\'eliminazione della nota:', error)
    } finally {
      setShowDeleteConfirm(false)
      setNoteToDelete(null)
    }
  }

  const showAddForm = addFormOpen

  return (
    <div className="space-y-6">
      {/* Filtri e ricerca */}
      <div className="bg-gray-50 p-4 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🔍 Cerca</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca nelle note..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🏷️ Tipo</label>
            <div className="grid grid-cols-2 gap-1">
              {['note', 'medical', 'injury', 'training', 'secretary', 'quote'].map(type => (
                <label key={type} className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={(e) => handleTypeFilterChange(type, e.target.checked)}
                    className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{getNoteTypeName(type)}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">📅 Data</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">Tutte le date</option>
              <option value="today">Oggi</option>
              <option value="week">Ultima settimana</option>
              <option value="month">Ultimo mese</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">🔄 Ordina per</label>
            <div className="space-y-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="date">Data</option>
                <option value="type">Tipo</option>
                <option value="author">Autore</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="desc">Più recenti</option>
                <option value="asc">Più vecchi</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 underline">
            Pulisci filtri
          </button>
        </div>
      </div>

      {/* Form aggiungi nota */}
      {showAddForm && (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Aggiungi Nota</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo di nota</label>
              <select
                value={newNote.type || 'note'}
                onChange={(e) => setNewNote(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="note">Nota generale</option>
                <option value="medical">Nota medica</option>
                <option value="injury">Infortunio</option>
                <option value="training">Allenamento</option>
                <option value="secretary">Segreteria</option>
                <option value="quote">Quote</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contenuto della nota</label>
              <textarea
                value={newNote.content}
                onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Inserisci il contenuto della nota..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleAddNote}
                disabled={loadingNotes || !newNote.content.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingNotes ? 'Salvataggio...' : 'Aggiungi Nota'}
              </button>
              <button
                type="button"
                onClick={() => { setNewNote({ content: '', type: 'note' }); onAddFormClose?.() }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista note */}
      {loadingNotes ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500">Caricamento note...</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-2 text-gray-500">
            {notes.length === 0 ? 'Nessuna nota presente' : 'Nessuna nota corrisponde ai filtri selezionati'}
          </p>
          <p className="text-sm text-gray-400">
            {notes.length === 0 ? 'Clicca sul pulsante + per aggiungere la prima nota' : 'Prova a modificare i filtri o la ricerca'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
          {filteredNotes.map((note) => {
            const hasReminder = note.reminder_date
            const reminderStatus = hasReminder ? getReminderStatus(note.reminder_date) : null
            return (
              <div
                key={note.id}
                className={`border-l-4 ${getNoteColor(note.type)} ${hasReminder ? reminderStatus?.bgColor : 'bg-white'} border ${hasReminder ? reminderStatus?.borderColor : 'border-gray-200'} rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${hasReminder ? 'ring-2 ring-opacity-50' : ''} ${hasReminder ? `ring-${reminderStatus?.status === 'expired' ? 'red' : reminderStatus?.status === 'today' ? 'orange' : reminderStatus?.status === 'soon' ? 'yellow' : 'green'}` : ''}`}
              >
                {editingNote?.id === note.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo di nota</label>
                      <select
                        value={editNoteType}
                        onChange={(e) => setEditNoteType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="note">Nota generale</option>
                        <option value="medical">Nota medica</option>
                        <option value="injury">Infortunio</option>
                        <option value="quote">Quote</option>
                        <option value="training">Allenamento</option>
                        <option value="secretary">Segreteria</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contenuto della nota</label>
                      <textarea
                        value={editNoteContent}
                        onChange={(e) => setEditNoteContent(e.target.value)}
                        placeholder="Inserisci il contenuto della nota..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data Promemoria/Scadenza (opzionale)</label>
                      <input
                        type="date"
                        value={editReminderDate ? editReminderDate.split('T')[0] : ''}
                        onChange={(e) => setEditReminderDate(e.target.value ? `${e.target.value}T00:00:00.000Z` : '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Lascia vuoto per rimuovere il promemoria</p>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={loadingNotes || !editNoteContent.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingNotes ? 'Salvataggio...' : '💾 Salva Modifiche'}
                      </button>
                      <button type="button" onClick={handleCancelEdit} disabled={loadingNotes} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50">
                        ❌ Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => handleEditNote(note)}
                    title="Clicca per modificare la nota"
                  >
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex-shrink-0 mt-1">{getNoteIcon(note.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">{getNoteTypeName(note.type)}</span>
                          <span className="text-sm text-gray-500">
                            {new Date(note.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                          {hasReminder && (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${reminderStatus?.color} ${reminderStatus?.bgColor} border ${reminderStatus?.borderColor}`}>
                              🔔 Promemoria: {formatReminderDate(note.reminder_date!)} ({reminderStatus?.text})
                            </span>
                          )}
                        </div>
                        <p className="text-gray-900 text-sm leading-relaxed">{note.content}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className="text-xs text-gray-500">{note.creator_name ?? note.created_by ?? '—'}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteNote(note) }}
                        className="text-red-500 hover:text-red-700 p-1 transition-colors"
                        title="Elimina nota"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Promemoria */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 Promemoria per la Nota</h3>
            <p className="text-gray-600 mb-6">Vuoi impostare una data di promemoria/scadenza per questa nota?</p>
            <div className="flex space-x-3">
              <button onClick={() => handleReminderChoice(false)} className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">❌ No, solo nota</button>
              <button onClick={() => handleReminderChoice(true)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">✅ Sì, con promemoria</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Data Promemoria */}
      {showDateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 Seleziona Data Promemoria</h3>
            <p className="text-gray-600 mb-4">Quando vuoi essere ricordato di questa nota?</p>
            <div className="mb-6">
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="flex space-x-3">
              <button onClick={() => { setShowDateModal(false); setReminderDate('') }} className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">❌ Annulla</button>
              <button onClick={handleDateSelection} disabled={!reminderDate} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">✅ Salva Nota</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal conferma eliminazione */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Elimina Nota</h3>
                <p className="text-sm text-gray-500">Questa azione non può essere annullata</p>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-gray-700">Sei sicuro di voler eliminare questa nota? L'azione non può essere annullata.</p>
            </div>
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => { setShowDeleteConfirm(false); setNoteToDelete(null) }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Annulla
              </button>
              <button type="button" onClick={confirmDeleteNote} className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700">
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotesTab
