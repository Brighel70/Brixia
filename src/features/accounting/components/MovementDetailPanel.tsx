import { createPortal } from 'react-dom'
import { ArrowRightLeft, CheckCircle2, FileText, Landmark, Pencil, Trash2, X } from 'lucide-react'
import { GOLEE } from '@/config/goleeTheme'
import { formatFeeAmount } from '@/utils/feeUtils'
import type { AccountingMovementDetail } from '../types'
import { isManualDraftEditable, isSystemMovementOrigin } from '../utils/movementHelpers'
import {
  isManualDraft,
  isManualPosted,
  needsAccountAssignment,
  type MovementLifecycleAction
} from '../utils/movementLifecycle'
import {
  formatDocumentLabel,
  formatPaymentReferenceLabel,
  paymentMethodLabel
} from '../utils/movementFormOptions'
import {
  movementDirectionLabel,
  movementOriginLabel,
  movementStatusBadgeClass,
  movementStatusLabel
} from '../utils/labels'

interface MovementDetailPanelProps {
  open: boolean
  loading: boolean
  error: string | null
  movement: AccountingMovementDetail | null
  canEdit: boolean
  canPost: boolean
  canVerify?: boolean
  onClose: () => void
  onEdit: () => void
  onEditTransfer: () => void
  onLifecycleAction: (action: MovementLifecycleAction) => void
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <dt
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: GOLEE.textMuted }}
      >
        {label}
      </dt>
      <dd className="mt-1 text-sm" style={{ color: GOLEE.text }}>
        {value}
      </dd>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b py-3 last:border-0" style={{ borderColor: GOLEE.border }}>
      <DetailField label={label} value={value} />
    </div>
  )
}

function DetailRowGroup({
  children,
  cols = 2
}: {
  children: React.ReactNode
  cols?: 2 | 3
}) {
  return (
    <div
      className={`grid gap-3 border-b py-3 last:border-0 ${
        cols === 3 ? 'grid-cols-3' : 'grid-cols-2'
      }`}
      style={{ borderColor: GOLEE.border }}
    >
      {children}
    </div>
  )
}

export function MovementDetailPanel({
  open,
  loading,
  error,
  movement,
  canEdit,
  canPost,
  canVerify = false,
  onClose,
  onEdit,
  onEditTransfer,
  onLifecycleAction
}: MovementDetailPanelProps) {
  if (!open || typeof document === 'undefined') return null

  const editable =
    movement && canEdit && isManualDraftEditable(movement.origin, movement.status)
  const systemOrigin = movement ? isSystemMovementOrigin(movement.origin) : false
  const canPostMovement = !!movement && canPost && isManualDraft(movement.origin, movement.status)
  const canVerifyMovement =
    !!movement &&
    canVerify &&
    isManualDraft(movement.origin, movement.status) &&
    !movement.verified_at
  const canCancelMovement = !!movement && canEdit && isManualDraft(movement.origin, movement.status)
  const canReverseMovement = !!movement && canPost && isManualPosted(movement.origin, movement.status)
  const canAssignAccount = !!movement && canPost && needsAccountAssignment(movement.origin, movement.status)

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[#0B1220]/45 backdrop-blur-[6px]" />

      <aside
        className="relative flex h-full w-full max-w-lg flex-col border-l shadow-[-16px_0_48px_rgba(15,23,42,0.18)]"
        style={{ backgroundColor: GOLEE.surface, borderColor: GOLEE.border, color: GOLEE.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{
            background: `linear-gradient(90deg, ${GOLEE.accent} 0%, ${GOLEE.info} 100%)`
          }}
        />

        <div
          className="flex items-start justify-between border-b px-5 py-5 pt-6"
          style={{ borderColor: GOLEE.border, backgroundColor: GOLEE.surfaceMuted }}
        >
          <div className="flex items-start gap-3 pr-8">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: GOLEE.infoSoft, color: GOLEE.info }}
            >
              <FileText className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight" style={{ color: GOLEE.text }}>
                Dettaglio movimento
                {movement &&
                  (movement.direction === 'income' || movement.direction === 'expense') && (
                    <>
                      {' '}
                      (
                      <span
                        className={
                          movement.direction === 'income'
                            ? 'font-bold text-emerald-600'
                            : 'font-bold text-rose-600'
                        }
                      >
                        {movementDirectionLabel(movement.direction)}
                      </span>
                      )
                    </>
                  )}
              </h2>
              {movement && (
                <p className="mt-0.5 text-sm" style={{ color: GOLEE.textMuted }}>
                  {movement.description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 transition-colors hover:bg-white/80"
            style={{ color: GOLEE.textMuted }}
            aria-label="Chiudi dettaglio"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="text-sm" style={{ color: GOLEE.textMuted }}>
              Caricamento dettaglio...
            </p>
          )}
          {error && (
            <div
              className="rounded-2xl border px-3 py-2 text-sm"
              style={{
                borderColor: '#FECACA',
                backgroundColor: GOLEE.dangerSoft,
                color: '#991B1B'
              }}
            >
              {error}
            </div>
          )}
          {movement && !loading && (
            <>
              {systemOrigin && (
                <div
                  className="mb-4 rounded-2xl border px-3 py-2.5 text-sm"
                  style={{
                    borderColor: '#BFDBFE',
                    backgroundColor: GOLEE.infoSoft,
                    color: '#1D4ED8'
                  }}
                >
                  Movimento generato automaticamente ({movementOriginLabel(movement.origin)}).
                  Non modificabile manualmente.
                </div>
              )}

              <dl>
                <DetailRowGroup>
                  <DetailField
                    label="Data movimento"
                    value={new Date(movement.movement_date).toLocaleDateString('it-IT')}
                  />
                  <DetailField
                    label="Data pagamento"
                    value={
                      movement.settlement_date
                        ? new Date(movement.settlement_date).toLocaleDateString('it-IT')
                        : '—'
                    }
                  />
                </DetailRowGroup>
                <DetailRowGroup>
                  <DetailField
                    label="Importo"
                    value={formatFeeAmount(movement.amount_cents)}
                  />
                  <DetailField
                    label="Conto"
                    value={movement.account ? movement.account.name : '—'}
                  />
                </DetailRowGroup>
                {movement.direction === 'transfer' && (
                  <DetailRow
                    label="Conto di destinazione"
                    value={movement.transfer_account ? movement.transfer_account.name : '—'}
                  />
                )}
                <DetailRowGroup>
                  <DetailField
                    label="Categoria"
                    value={movement.category?.code ?? '—'}
                  />
                  <DetailField
                    label="Sottocategoria"
                    value={movement.category?.name ?? '—'}
                  />
                </DetailRowGroup>
                <DetailRowGroup>
                  <DetailField
                    label="Stato"
                    value={
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${movementStatusBadgeClass(movement.status)}`}
                          title={`Stato tecnico: ${movement.status}`}
                          translate="no"
                        >
                          {movementStatusLabel(movement.status)}
                        </span>
                        {movement.verified_at && (
                          <span
                            className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800"
                            title={
                              movement.verification_note
                                ? movement.verification_note
                                : `Verificato il ${new Date(movement.verified_at).toLocaleString('it-IT')}`
                            }
                          >
                            Verificato
                          </span>
                        )}
                      </span>
                    }
                  />
                  <DetailField
                    label="Metodo pagamento"
                    value={paymentMethodLabel(movement.payment_method_raw)}
                  />
                </DetailRowGroup>
                <DetailRowGroup>
                  <DetailField
                    label="Documento"
                    value={formatDocumentLabel(movement)}
                  />
                  <DetailField
                    label="Data documento"
                    value={
                      movement.document_date
                        ? new Date(movement.document_date).toLocaleDateString('it-IT')
                        : '—'
                    }
                  />
                </DetailRowGroup>
                <DetailRow
                  label="Riferimento pagamento"
                  value={formatPaymentReferenceLabel(movement)}
                />
                <DetailRow label="Note" value={movement.notes?.trim() || '—'} />
                <DetailRow
                  label="Credito collegato"
                  value={
                    movement.receivable ? (
                      <span>
                        {movement.receivable.description}
                        <span
                          className="mt-0.5 block text-xs"
                          style={{ color: GOLEE.textMuted }}
                        >
                          Residuo {formatFeeAmount(movement.receivable.residual_amount_cents)} ·{' '}
                          {movement.receivable.status}
                        </span>
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRow
                  label="Movimento originale (storno)"
                  value={
                    movement.reverses_movement ? (
                      <span>
                        {movement.reverses_movement.description} ·{' '}
                        {formatFeeAmount(movement.reverses_movement.amount_cents)}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRow
                  label="Storno collegato"
                  value={
                    movement.reversed_by_movement ? (
                      <span>
                        {movement.reversed_by_movement.description} ·{' '}
                        {formatFeeAmount(movement.reversed_by_movement.amount_cents)}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRowGroup>
                  <DetailField
                    label="Creato il"
                    value={
                      movement.created_at
                        ? new Date(movement.created_at).toLocaleString('it-IT')
                        : '—'
                    }
                  />
                  <DetailField
                    label="Aggiornato il"
                    value={
                      movement.updated_at
                        ? new Date(movement.updated_at).toLocaleString('it-IT')
                        : '—'
                    }
                  />
                </DetailRowGroup>
              </dl>
            </>
          )}
        </div>

        {movement && !loading && (
          <div className="border-t px-5 py-4" style={{ borderColor: GOLEE.border }}>
            <div className="grid grid-cols-2 gap-2">
              {editable && (
                <button
                  type="button"
                  onClick={movement.direction === 'transfer' ? onEditTransfer : onEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold"
                  style={{
                    color: GOLEE.text,
                    backgroundColor: GOLEE.surfaceMuted
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  {movement.direction === 'transfer' ? 'Modifica giroconto' : 'Modifica bozza'}
                </button>
              )}
              {canVerifyMovement && (
                <button
                  type="button"
                  onClick={() => onLifecycleAction('verify')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-800/35 bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(2,132,199,0.25)]"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Verifica
                </button>
              )}
              {canPostMovement && (
                <button
                  type="button"
                  onClick={() => onLifecycleAction('post')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-700/40 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,196,140,0.3)]"
                  style={{ backgroundColor: GOLEE.accent }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Contabilizza
                </button>
              )}
              {canAssignAccount && (
                <button
                  type="button"
                  onClick={() => onLifecycleAction('assign_account')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-800/35 bg-[#1677FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(22,119,255,0.25)]"
                >
                  <Landmark className="h-4 w-4" />
                  Assegna conto
                </button>
              )}
              {canReverseMovement && (
                <button
                  type="button"
                  onClick={() => onLifecycleAction('reverse')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-800/35 bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(234,88,12,0.22)]"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Storna movimento
                </button>
              )}
              {canCancelMovement && (
                <button
                  type="button"
                  onClick={() => onLifecycleAction('cancel')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Annulla bozza
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                style={{ backgroundColor: GOLEE.surface }}
              >
                <X className="h-4 w-4" />
                Chiudi
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body
  )
}
