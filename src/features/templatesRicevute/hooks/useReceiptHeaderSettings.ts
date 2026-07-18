import { useState, useEffect, useCallback } from 'react'
import { getReceiptHeaderSettings, updateReceiptHeaderSettings } from '../api/receiptHeader.api'
import type { ReceiptHeaderSettings, ReceiptHeaderSettingsUpdate } from '../types'

export function useReceiptHeaderSettings() {
  const [settings, setSettings] = useState<ReceiptHeaderSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getReceiptHeaderSettings()
      setSettings(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento dati intestazione')
      setSettings(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(async (payload: ReceiptHeaderSettingsUpdate) => {
    setSaving(true)
    setError(null)
    try {
      await updateReceiptHeaderSettings(payload)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore salvataggio')
      throw e
    } finally {
      setSaving(false)
    }
  }, [load])

  return { settings, loading, error, saving, reload: load, save }
}
