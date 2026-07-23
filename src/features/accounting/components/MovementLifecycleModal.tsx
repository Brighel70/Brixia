import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Landmark, ShieldCheck, X } from 'lucide-react'
import { GOLEE, goleeInputClass, goleeInputStyle, goleeLabelClass } from '@/config/goleeTheme'
import { formatFeeAmount } from '@/utils/feeUtils'
import type { AccountingAccountRef, AccountingFiscalYear, AccountingMovementDetail } from '../types'
import type { MovementLifecycleAction, MovementLifecycleRequest } from '../utils/movementLifecycle'

interface MovementLifecycleModalProps {
  action: MovementLifecycleAction | null
  movement: AccountingMovementDetail | null
  fiscalYear: AccountingFiscalYear | null
  accounts: AccountingAccountRef[]
  saving: boolean
  onClose: () => void
  onConfirm: (request: MovementLifecycleRequest) => Promise<void>
}

const CONTENT: Record<
  MovementLifecycleAction,
  { title: string; description: string; confirm: string; tone: 'green' | 'orange' | 'slate' | 'blue' | 'sky' }
> = {
  post: {
    title: 'Contabilizza movimento',
    description: 'Il movimento diventera ufficiale e sara incluso nei riepiloghi e nei report.',
    confirm: 'Contabilizza',
    tone: 'green'
  },
  cancel: {
    title: 'Annulla bozza',
    description: 'La bozza restera nello storico come annullata ma non sara conteggiata.',
    confirm: 'Annulla bozza',
    tone: 'slate'
  },
  reverse: {
    title: 'Storna movimento',
    description: 'Viene creato uno storno tracciato. Il movimento originale non verra cancellato.',
    confirm: 'Crea storno',
    tone: 'orange'
  },
  assign_account: {
    title: 'Assegna conto e contabilizza',
    description: 'Scegli il conto corretto per completare l incasso automatico e renderlo ufficiale.',
    confirm: 'Assegna e contabilizza',
    tone: 'blue'
  },
  verify: {
    title: 'Verifica movimento',
    description: 'Conferma la verifica della bozza prima della contabilizzazione (workflow a due livelli).',
    confirm: 'Conferma verifica',
    tone: 'sky'
  }
}

function toneStyle(tone: 'green' | 'orange' | 'slate' | 'blue' | 'sky') {
  if (tone === 'orange') return { backgroundColor: '#EA580C', boxShadow: '0 8px 24px rgba(234,88,12,0.25)' }
  if (tone === 'blue') return { backgroundColor: '#1677FF', boxShadow: '0 8px 24px rgba(22,119,255,0.25)' }
  if (tone === 'sky') return { backgroundColor: '#0284C7', boxShadow: '0 8px 24px rgba(2,132,199,0.25)' }
  if (tone === 'slate') return { backgroundColor: '#334155', boxShadow: '0 8px 24px rgba(51,65,85,0.2)' }
  return { backgroundColor: GOLEE.accent, boxShadow: '0 8px 24px rgba(0,196,140,0.25)' }
}

export function MovementLifecycleModal({
  action,
  movement,
  fiscalYear,
  accounts,
  saving,
  onClose,
  onConfirm
}: MovementLifecycleModalProps) {
  const [reason, setReason] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [movementDate, setMovementDate] = useState('')
  const [accountId, setAccountId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!action) return
    setReason('')
    setOverrideReason('')
    setFormError(null)
    setAccountId('')
    setMovementDate(movement?.movement_date ?? new Date().toISOString().slice(0, 10))
  }, [action, movement?.id, movement?.movement_date])

  const content = action ? CONTENT[action] : null
  const icon = useMemo(() => {
    if (action === 'reverse') return <ArrowRightLeft className="h-5 w-5" />
    if (action === 'assign_account') return <Landmark className="h-5 w-5" />
    if (action === 'cancel') return <AlertTriangle className="h-5 w-5" />
    if (action === 'verify') return <ShieldCheck className="h-5 w-5" />
    return <CheckCircle2 className="h-5 w-5" />
  }, [action])

  if (!action || !movement || !content || typeof document === 'undefined') return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (action === 'reverse' && !reason.trim()) {
      setFormError('Indica il motivo dello storno.')
      return
    }
    if (action === 'reverse' && (!movementDate || (fiscalYear && (movementDate < fiscalYear.starts_on || movementDate > fiscalYear.ends_on)))) {
      setFormError('Scegli una data dello storno compresa nell esercizio aperto.')
      return
    }
    if (action === 'assign_account' && !accountId) {
      setFormError('Seleziona il conto su cui registrare l incasso.')
      return
    }
    setFormError(null)
    await onConfirm({
      action,
      movementId: movement.id,
      reason,
      overrideReason: overrideReason.trim() || undefined,
      movementDate,
      accountId
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#0B1220]/55 backdrop-blur-[8px]" onClick={saving ? undefined : onClose} />
      <form onSubmit={(event) => void submit(event)} className="relative w-full max-w-lg overflow-hidden rounded-[22px] border bg-white shadow-[0_28px_90px_rgba(11,18,32,0.32)]" style={{ borderColor: GOLEE.border }}>
        <div className="relative overflow-hidden bg-[#15213A] px-6 py-5">
          <div className="absolute inset-x-0 top-0 h-1.5" style={toneStyle(content.tone)} />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">{icon}</span>
              <div>
                <h2 className="text-lg font-semibold text-white">{content.title}</h2>
                <p className="mt-1 text-sm leading-5 text-slate-300">{content.description}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-50" aria-label="Chiudi"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="bg-[#F6F8FB] p-6">
          <div className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: GOLEE.border }}>
            <p className="text-sm font-semibold" style={{ color: GOLEE.text }}>{movement.description}</p>
            <div className="mt-1 flex items-center justify-between gap-3 text-sm" style={{ color: GOLEE.textMuted }}>
              <span>{new Date(movement.movement_date).toLocaleDateString('it-IT')}</span>
              <strong style={{ color: GOLEE.text }}>{formatFeeAmount(movement.amount_cents)}</strong>
            </div>
          </div>

          {action === 'reverse' && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={goleeLabelClass}>Data dello storno *</label>
                <input type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} className={goleeInputClass} style={goleeInputStyle} />
              </div>
              <div>
                <label className={goleeLabelClass}>Motivo *</label>
                <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="es. Pagamento duplicato" className={goleeInputClass} style={goleeInputStyle} />
              </div>
            </div>
          )}

          {action === 'cancel' && (
            <div className="mt-4">
              <label className={goleeLabelClass}>Motivo annullamento</label>
              <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Facoltativo" className={goleeInputClass} style={goleeInputStyle} />
            </div>
          )}

          {action === 'verify' && (
            <div className="mt-4">
              <label className={goleeLabelClass}>Nota verifica</label>
              <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Facoltativo" className={goleeInputClass} style={goleeInputStyle} />
            </div>
          )}

          {action === 'post' && (
            <div className="mt-4">
              <label className={goleeLabelClass}>Motivo override (facoltativo)</label>
              <input
                type="text"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="Solo se serve forzare senza verifica"
                className={goleeInputClass}
                style={goleeInputStyle}
              />
            </div>
          )}

          {action === 'assign_account' && (
            <div className="mt-4">
              <label className={goleeLabelClass}>Conto su cui registrare l incasso *</label>
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className={goleeInputClass} style={goleeInputStyle}>
                <option value="">Seleziona conto</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
              </select>
            </div>
          )}

          {formError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: GOLEE.border, color: GOLEE.text }}>Indietro</button>
            <button type="submit" disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={toneStyle(content.tone)}>{saving ? 'Operazione in corso...' : content.confirm}</button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  )
}
