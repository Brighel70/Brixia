import type {
  FiscalYearStatus,
  MovementDirection,
  MovementOrigin,
  MovementStatus,
  ReceivableNature,
  ReceivableStatus
} from '../types'

export function fiscalYearStatusLabel(status: FiscalYearStatus): string {
  const map: Record<FiscalYearStatus, string> = {
    draft: 'Bozza',
    open: 'Aperto',
    closing: 'In chiusura',
    closed: 'Chiuso'
  }
  return map[status] ?? status
}

export function fiscalYearStatusBadgeClass(status: FiscalYearStatus): string {
  const map: Record<FiscalYearStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    open: 'bg-emerald-100 text-emerald-800',
    closing: 'bg-amber-100 text-amber-800',
    closed: 'bg-gray-200 text-gray-700'
  }
  return map[status] ?? 'bg-slate-100 text-slate-700'
}

export function movementDirectionLabel(direction: MovementDirection): string {
  const map: Record<MovementDirection, string> = {
    income: 'Entrata',
    expense: 'Uscita',
    transfer: 'Giroconto',
    adjustment: 'Rettifica',
    opening: 'Apertura',
    closing: 'Chiusura',
    reversal: 'Storno'
  }
  return map[direction] ?? direction
}

export function movementDirectionBadgeClass(direction: MovementDirection): string {
  const map: Record<MovementDirection, string> = {
    income: 'bg-emerald-100 text-emerald-800',
    expense: 'bg-rose-100 text-rose-800',
    transfer: 'bg-blue-100 text-blue-800',
    adjustment: 'bg-purple-100 text-purple-800',
    opening: 'bg-slate-100 text-slate-700',
    closing: 'bg-slate-100 text-slate-700',
    reversal: 'bg-orange-100 text-orange-800'
  }
  return map[direction] ?? 'bg-slate-100 text-slate-700'
}

export function movementStatusLabel(status: MovementStatus | string): string {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
  const map: Record<string, string> = {
    draft: 'Bozza',
    pending_account: 'Conto da assegnare',
    posted: 'Contabilizzato',
    reversed: 'Stornato',
    cancelled: 'Annullato'
  }
  return map[normalized] ?? (normalized ? `Stato: ${normalized}` : 'Senza stato')
}

export function movementStatusBadgeClass(status: MovementStatus | string): string {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
  const map: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-900',
    pending_account: 'bg-amber-100 text-amber-800',
    posted: 'bg-emerald-100 text-emerald-800',
    reversed: 'bg-orange-100 text-orange-800',
    cancelled: 'bg-gray-200 text-gray-600'
  }
  return map[normalized] ?? 'bg-slate-100 text-slate-700'
}

export function movementOriginLabel(origin: MovementOrigin): string {
  const map: Record<MovementOrigin, string> = {
    manual: 'Manuale',
    fee_sync: 'Sync quote',
    backfill: 'Backfill',
    reversal: 'Storno',
    refund: 'Rimborso',
    adjustment: 'Rettifica'
  }
  return map[origin] ?? origin
}

export function receivableStatusLabel(status: ReceivableStatus): string {
  const map: Record<ReceivableStatus, string> = {
    assigned: 'Assegnato',
    partially_paid: 'Parziale',
    paid: 'Pagato',
    overpaid: 'Eccedenza',
    cancelled: 'Annullato',
    partially_refunded: 'Parz. rimborsato',
    refunded: 'Rimborsato',
    to_review: 'Da verificare'
  }
  return map[status] ?? status
}

export function receivableStatusBadgeClass(status: ReceivableStatus): string {
  const map: Record<ReceivableStatus, string> = {
    assigned: 'bg-blue-100 text-blue-800',
    partially_paid: 'bg-amber-100 text-amber-800',
    paid: 'bg-emerald-100 text-emerald-800',
    overpaid: 'bg-purple-100 text-purple-800',
    cancelled: 'bg-gray-200 text-gray-600',
    partially_refunded: 'bg-orange-100 text-orange-800',
    refunded: 'bg-slate-100 text-slate-700',
    to_review: 'bg-red-100 text-red-800'
  }
  return map[status] ?? 'bg-slate-100 text-slate-700'
}

export function receivableNatureLabel(nature: ReceivableNature): string {
  const map: Record<ReceivableNature, string> = {
    institutional: 'Istituzionale',
    commercial: 'Commerciale',
    mixed: 'Misto',
    to_classify: 'Da classificare'
  }
  return map[nature] ?? nature
}

export function receivableOriginLabel(sourceSystem: string, sourceTable: string): string {
  if (sourceSystem === 'fees' && sourceTable === 'fee_assignments') return 'Quota'
  return `${sourceSystem}/${sourceTable}`
}
