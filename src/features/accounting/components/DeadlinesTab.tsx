import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type {
  AccountingFiscalYear,
  AccountingOperationalDeadline,
  DeadlineStatus,
  DeadlineType
} from '../types'

const DEADLINE_TYPES: { id: DeadlineType; label: string }[] = [
  { id: 'vat_reminder', label: 'Promemoria IVA' },
  { id: 'f24_reminder', label: 'Promemoria F24' },
  { id: 'rasd', label: 'RASD' },
  { id: 'rendiconto', label: 'Rendiconto' },
  { id: 'document', label: 'Documento' },
  { id: 'internal_review', label: 'Verifica interna' },
  { id: 'renewal', label: 'Rinnovo' },
  { id: 'other', label: 'Altro' }
]

interface DeadlinesTabProps {
  fiscalYear: AccountingFiscalYear | null
  deadlines: AccountingOperationalDeadline[]
  loading: boolean
  canManage: boolean
  onRefresh: () => void
  onCreate: (input: {
    title: string
    dueOn: string
    deadlineType: DeadlineType
    notes: string | null
  }) => Promise<void>
  onSetStatus: (id: string, status: DeadlineStatus) => Promise<void>
}

export function DeadlinesTab({
  fiscalYear,
  deadlines,
  loading,
  canManage,
  onRefresh,
  onCreate,
  onSetStatus
}: DeadlinesTabProps) {
  const [title, setTitle] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [deadlineType, setDeadlineType] = useState<DeadlineType>('other')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!title.trim() || !dueOn) {
      toast.error('Titolo e data obbligatori')
      return
    }
    setSaving(true)
    try {
      await onCreate({
        title: title.trim(),
        dueOn,
        deadlineType,
        notes: notes.trim() || null
      })
      setTitle('')
      setNotes('')
      toast.success('Scadenza creata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Creazione non riuscita')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Scadenze operative</h2>
          <p className="mt-1 text-sm text-slate-500">
            Promemoria gestionali interni. Non generano invii SDI, F24 o dichiarazioni automatiche.
            {fiscalYear ? ` Contesto esercizio ${fiscalYear.code}.` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Aggiorna
        </button>
      </div>

      {canManage && (
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Nuova scadenza</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titolo"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={deadlineType}
              onChange={(e) => setDeadlineType(e.target.value as DeadlineType)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {DEADLINE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleCreate()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Aggiungi
            </button>
          </div>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note (opzionale)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Scadenza</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Stato</th>
              <th className="px-3 py-2">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deadlines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Nessuna scadenza registrata.
                </td>
              </tr>
            ) : (
              deadlines.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{d.title}</div>
                    {d.notes && <div className="text-xs text-slate-500">{d.notes}</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {DEADLINE_TYPES.find((t) => t.id === d.deadline_type)?.label ?? d.deadline_type}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{d.due_on}</td>
                  <td className="px-3 py-2">{d.status}</td>
                  <td className="px-3 py-2">
                    {canManage && d.status === 'open' && (
                      <button
                        type="button"
                        className="text-xs font-medium text-brand-primary hover:underline"
                        onClick={() =>
                          void onSetStatus(d.id, 'done').then(() => toast.success('Segnata come fatta'))
                        }
                      >
                        Completa
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
