import { clsx } from 'clsx'

export default function StatusPill({ label, active, onClick }:{ label: string; active?: boolean; onClick?: () => void }){
  return (
    <button onClick={onClick} className={clsx('pill border', active ? 'bg-sky text-white border-sky' : 'bg-white text-navy border-navy/20')}>{label}</button>
  )
}