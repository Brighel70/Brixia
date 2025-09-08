import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface NotesTabProps {
  personId: string
  onNoteAdded?: () => void
}

interface Note {
  id: string
  content: string
  created_at: string
  updated_at: string
  created_by: string
  author_name?: string
}

const NotesTab: React.FC<NotesTabProps> = ({ personId, onNoteAdded }) => {
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    if (personId) {
      loadNotes()
    }
  }, [personId])

  const loadNotes = async () => {
    if (!personId) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('notes')
        .select(`
          *,
          profiles!notes_created_by_fkey (
            first_name,
            last_name
          )
        `)
        .eq('person_id', personId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedNotes = data?.map(note => ({
        ...note,
        author_name: note.profiles 
          ? `${note.profiles.first_name || ''} ${note.profiles.last_name || ''}`.trim()
          : 'Utente sconosciuto'
      })) || []

      setNotes(formattedNotes)
    } catch (error) {
      console.error('Errore nel caricamento note:', error)
      setMessage('Errore nel caricamento delle note')
    } finally {
      setLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !personId) return

    try {
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('notes')
        .insert({
          person_id: personId,
          content: newNote.trim(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        })

      if (error) throw error

      setNewNote('')
      setMessage('✅ Nota aggiunta con successo!')
      loadNotes()
      onNoteAdded?.()
    } catch (error: any) {
      console.error('Errore nell\'aggiunta nota:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEditNote = (note: Note) => {
    setEditingNote(note.id)
    setEditContent(note.content)
  }

  const handleSaveEdit = async (noteId: string) => {
    if (!editContent.trim()) return

    try {
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('notes')
        .update({
          content: editContent.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId)

      if (error) throw error

      setEditingNote(null)
      setEditContent('')
      setMessage('✅ Nota aggiornata con successo!')
      loadNotes()
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento nota:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa nota?')) return

    try {
      setSaving(true)
      setMessage('')

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error

      setMessage('✅ Nota eliminata con successo!')
      loadNotes()
    } catch (error: any) {
      console.error('Errore nell\'eliminazione nota:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingNote(null)
    setEditContent('')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Caricamento note...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">📝 Note Personali</h3>
        <p className="text-sm text-yellow-700">
          Aggiungi e gestisci note personali per questa persona. Le note sono visibili solo agli utenti autorizzati.
        </p>
      </div>

      {/* Aggiungi Nuova Nota */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-md font-semibold text-gray-800 mb-3">Aggiungi Nuova Nota</h4>
        
        <div className="space-y-3">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Scrivi una nota per questa persona..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
          />
          
          <div className="flex justify-end">
            <button
              onClick={handleAddNote}
              disabled={saving || !newNote.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Aggiunta...
                </>
              ) : (
                '➕ Aggiungi Nota'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Lista Note */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-800">
          Note Esistenti ({notes.length})
        </h4>

        {notes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📝</div>
            <p>Nessuna nota presente</p>
            <p className="text-sm">Aggiungi la prima nota usando il modulo sopra</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map(note => (
              <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-4">
                {editingNote === note.id ? (
                  // Modalità modifica
                  <div className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleSaveEdit(note.id)}
                        disabled={saving || !editContent.trim()}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        💾 Salva
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                      >
                        ❌ Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  // Modalità visualizzazione
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">{note.author_name}</span>
                        <span className="mx-2">•</span>
                        <span>{formatDate(note.created_at)}</span>
                        {note.updated_at !== note.created_at && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="text-blue-600">Modificata</span>
                          </>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditNote(note)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          title="Modifica nota"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                          title="Elimina nota"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="text-gray-800 whitespace-pre-wrap">
                      {note.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messaggio */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.startsWith('✅') 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}

export default NotesTab


