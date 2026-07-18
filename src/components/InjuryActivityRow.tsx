import React from 'react'
import { formatCurrency } from '@/utils/feeUtils'
import {
  getActivityCardStyle,
  getActivityCostDisplay,
  isPurchaseActivityType,
  type ActivityAmountFields,
} from '@/utils/injuryActivityDisplay'

export type InjuryActivityRowData = ActivityAmountFields & {
  id: string
  activity_date: string
  operator_name?: string | null
  duration_minutes?: number | null
  activity_description?: string | null
  notes?: string | null
  massaggio?: boolean
  tecar?: boolean
  laser?: boolean
}

type ColumnDef = {
  label: string
  icon: string
  value: React.ReactNode
  valueClass?: string
}

function ActivityColumn({ label, icon, value, valueClass = 'text-gray-800' }: ColumnDef) {
  return (
    <div className="rounded-xl bg-white/60 px-3 py-2 text-center min-w-0">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-600 truncate">
        {icon} {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold truncate ${valueClass}`}>{value}</div>
    </div>
  )
}

function buildColumns(activity: InjuryActivityRowData): ColumnDef[] {
  const dateStr = new Date(activity.activity_date).toLocaleDateString('it-IT')
  const costInfo = getActivityCostDisplay(activity)
  const type = (activity.activity_type || '').toLowerCase()

  if (type === 'insurance_communication') {
    const desc = activity.activity_description || 'Comunicazione assicurazione'
    return [
      { label: 'Data', icon: '📅', value: dateStr },
      { label: 'Evento', icon: '📋', value: desc },
    ]
  }

  if (type === 'insurance_refund') {
    return [
      { label: 'Operatore', icon: '👨‍⚕️', value: activity.operator_name || '—' },
      { label: 'Data', icon: '📅', value: dateStr },
      {
        label: 'Rimborso',
        icon: '💰',
        value: costInfo ? formatCurrency(costInfo.value) : '—',
        valueClass: 'text-green-600',
      },
    ]
  }

  if (isPurchaseActivityType(activity.activity_type)) {
    return [
      { label: 'Operatore', icon: '👨‍⚕️', value: activity.operator_name || '—' },
      { label: 'Data', icon: '📅', value: dateStr },
      {
        label: 'Costo',
        icon: '🛒',
        value: costInfo ? `${costInfo.value} ${costInfo.currency}` : '—',
        valueClass: 'text-red-600',
      },
    ]
  }

  const columns: ColumnDef[] = []
  if (activity.operator_name) {
    columns.push({ label: 'Operatore', icon: '👨‍⚕️', value: activity.operator_name })
  }
  columns.push({ label: 'Data', icon: '📅', value: dateStr })
  if (activity.duration_minutes) {
    columns.push({ label: 'Durata', icon: '⏱️', value: `${activity.duration_minutes} min` })
  }
  if (type === 'physiotherapy' && (activity.massaggio || activity.tecar || activity.laser)) {
    const treatments = [
      activity.massaggio && 'Massaggio',
      activity.tecar && 'Tecar',
      activity.laser && 'Laser',
    ].filter(Boolean).join(', ')
    columns.push({ label: 'Trattamenti', icon: '💆‍♂️', value: treatments })
  }
  if (costInfo && costInfo.value > 0) {
    columns.push({
      label: 'Costo',
      icon: '💸',
      value: formatCurrency(costInfo.value),
      valueClass: 'text-red-600',
    })
  }
  if (type === 'note' || type === 'annotazione' || type === 'other' || type === 'altro') {
    if (activity.activity_description) {
      columns.push({ label: 'Descrizione', icon: '📝', value: activity.activity_description })
    }
  }
  return columns
}

function gridClassForColumns(count: number) {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  if (count === 3) return 'grid-cols-3'
  if (count === 4) return 'grid-cols-2 sm:grid-cols-4'
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
}

export function InjuryActivityRow({
  activity,
  typeLabel,
}: {
  activity: InjuryActivityRowData
  typeLabel: string
}) {
  const style = getActivityCardStyle(activity.activity_type, activity)
  const columns = buildColumns(activity)
  const type = (activity.activity_type || '').toLowerCase()
  const showTitle = type !== 'insurance_communication'

  return (
    <div className={`${style.bg} rounded-xl py-3 px-3 border-2 ${style.border} w-full`}>
      <div className="flex items-center gap-3 min-w-0 mb-3">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white text-lg shrink-0`}
        >
          {style.icon}
        </div>
        {showTitle && (
          <h3 className={`font-semibold ${style.color} text-base truncate`}>{typeLabel}</h3>
        )}
        {!showTitle && (
          <h3 className={`font-semibold ${style.color} text-base truncate`}>Comunicazione assicurazione</h3>
        )}
      </div>

      <div className={`grid ${gridClassForColumns(columns.length)} gap-2`}>
        {columns.map((col) => (
          <ActivityColumn key={col.label} {...col} />
        ))}
      </div>

      {activity.notes?.trim() && (
        <div className="mt-3 rounded-xl bg-white/60 px-3 py-2">
          <p className="text-sm text-gray-700 italic leading-relaxed whitespace-pre-wrap break-words">
            💬 {activity.notes}
          </p>
        </div>
      )}
    </div>
  )
}

export default InjuryActivityRow
