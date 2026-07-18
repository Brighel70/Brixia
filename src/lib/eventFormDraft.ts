const STORAGE_KEY = 'teamflow_event_form_draft'

export interface EventFormDraft {
  newEvent: Record<string, unknown>
  showCreateForm: boolean
  editingEvent: Record<string, unknown> | null
  newTeamNameInput: string
  opponentCount: number
}

export function saveEventFormDraft(draft: EventFormDraft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // ignore quota errors
  }
}

export function loadEventFormDraft(): EventFormDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as EventFormDraft
  } catch {
    return null
  }
}

export function clearEventFormDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function hasEventFormDraft(): boolean {
  return !!sessionStorage.getItem(STORAGE_KEY)
}
