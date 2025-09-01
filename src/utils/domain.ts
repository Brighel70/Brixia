import { type Status, type InjuredPlace } from '@/store/data'

export function validate(status: Status, place?: InjuredPlace){
  if (status === 'INFORTUNATO' && !place) return false
  return true
}

export function isLocked(sessionDate: string){
  const d = new Date(sessionDate)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / (1000*60*60*24)
  return diff > 3
}