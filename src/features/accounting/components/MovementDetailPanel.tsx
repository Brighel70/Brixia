import { createPortal } from 'react-dom'
import { FileText, Pencil, X } from 'lucide-react'
import { GOLEE } from '@/config/goleeTheme'
import { formatFeeAmount } from '@/utils/feeUtils'
import type { AccountingMovementDetail } from '../types'
import { isManualDraftEditable, isSystemMovementOrigin } from '../utils/movementHelpers'
import {
  formatDocumentLabel,
  formatPaymentReferenceLabel,
  paymentMethodLabel
} from '../utils/movementFormOptions'
import {
  movementDirectionBadgeClass,
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
  onClose: () => void
  onEdit: () => void
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-3 border-b last:border-0" style={{ borderColor: GOLEE.border }}>
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

export function MovementDetailPanel({
  open,
  loading,
  error,
  movement,
  canEdit,
  onClose,
  onEdit
}: MovementDetailPanelProps) {
  if (!open || typeof document === 'undefined') return null

  const editable =
    movement && canEdit && isManualDraftEditable(movement.origin, movement.status)
  const systemOrigin = movement ? isSystemMovementOrigin(movement.origin) : false

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
                <DetailRow
                  label="Data movimento"
                  value={new Date(movement.movement_date).toLocaleDateString('it-IT')}
                />
                <DetailRow
                  label="Data pagamento"
                  value={
                    movement.settlement_date
                      ? new Date(movement.settlement_date).toLocaleDateString('it-IT')
                      : '—'
                  }
                />
                <DetailRow
                  label="Direzione"
                  value={
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${movementDirectionBadgeClass(movement.direction)}`}
                    >
                      {movementDirectionLabel(movement.direction)}
                    </span>
                  }
                />
                <DetailRow label="Importo" value={formatFeeAmount(movement.amount_cents)} />
                <DetailRow
                  label="Conto"
                  value={
                    movement.account
                      ? `${movement.account.code} — ${movement.account.name}`
                      : '—'
                  }
                />
                <DetailRow
                  label="Categoria"
                  value={
                    movement.category
                      ? `${movement.category.code} — ${movement.category.name}`
                      : '—'
                  }
                />
                <DetailRow label="Origine" value={movementOriginLabel(movement.origin)} />
                <DetailRow
                  label="Stato"
                  value={
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${movementStatusBadgeClass(movement.status)}`}
                    >
                      {movementStatusLabel(movement.status)}
                    </span>
                  }
                />
                <DetailRow
                  label="Metodo pagamento"
                  value={paymentMethodLabel(movement.payment_method_raw)}
                />
                <DetailRow label="Documento" value={formatDocumentLabel(movement)} />
                <DetailRow
                  label="Data documento"
                  value={
                    movement.document_date
                      ? new Date(movement.document_date).toLocaleDateString('it-IT')
                      : '—'
                  }
                />
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
                <DetailRow
                  label="Creato il"
                  value={
                    movement.created_at
                      ? new Date(movement.created_at).toLocaleString('it-IT')
                      : '—'
                  }
                />
                <DetailRow
                  label="Aggiornato il"
                  value={
                    movement.updated_at
                      ? new Date(movement.updated_at).toLocaleString('it-IT')
                      : '—'
                  }
                />
              </dl>
            </>
          )}
        </div>

        {editable && (
          <div className="border-t px-5 py-4" style={{ borderColor: GOLEE.border }}>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,196,140,0.3)]"
              style={{ backgroundColor: GOLEE.accent }}
            >
              <Pencil className="h-4 w-4" />
              Modifica bozza
            </button>
          </div>
        )}
      </aside>
    </div>,
    document.body
  )
}
