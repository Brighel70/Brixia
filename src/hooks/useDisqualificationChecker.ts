import { useEffect, useRef } from 'react'
import { checkAllExpiredDisqualifications, startDisqualificationChecker, stopDisqualificationChecker } from '@/utils/disqualificationChecker'

interface UseDisqualificationCheckerOptions {
  /** Intervallo in minuti tra i controlli automatici (default: 60) */
  intervalMinutes?: number
  /** Se abilitare il controllo automatico (default: true) */
  enabled?: boolean
  /** Callback chiamato quando vengono aggiornate delle squalifiche */
  onDisqualificationsUpdated?: (count: number) => void
}

/**
 * Hook per gestire il controllo automatico delle squalifiche scadute
 * @param options Opzioni di configurazione
 */
export function useDisqualificationChecker(options: UseDisqualificationCheckerOptions = {}) {
  const {
    intervalMinutes = 60,
    enabled = true,
    onDisqualificationsUpdated
  } = options

  const intervalIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    // Controllo immediato al mount
    const performCheck = async () => {
      try {
        console.log('🔍 Controllo squalifiche scadute...')
        const updatedCount = await checkAllExpiredDisqualifications()
        
        if (updatedCount > 0) {
          console.log(`✅ ${updatedCount} squalifiche scadute aggiornate automaticamente`)
          onDisqualificationsUpdated?.(updatedCount)
        } else {
          console.log('ℹ️ Nessuna squalifica scaduta trovata')
        }
      } catch (error) {
        console.error('❌ Errore nel controllo squalifiche:', error)
      }
    }

    // Esegui il controllo immediato
    performCheck()

    // Avvia il controllo periodico
    intervalIdRef.current = startDisqualificationChecker(intervalMinutes)

    // Cleanup al unmount
    return () => {
      if (intervalIdRef.current) {
        stopDisqualificationChecker(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, [enabled, intervalMinutes, onDisqualificationsUpdated])

  // Funzione per eseguire un controllo manuale
  const performManualCheck = async (): Promise<number> => {
    try {
      console.log('🔍 Controllo manuale squalifiche scadute...')
      const updatedCount = await checkAllExpiredDisqualifications()
      
      if (updatedCount > 0) {
        console.log(`✅ ${updatedCount} squalifiche scadute aggiornate manualmente`)
        onDisqualificationsUpdated?.(updatedCount)
      } else {
        console.log('ℹ️ Nessuna squalifica scaduta trovata')
      }
      
      return updatedCount
    } catch (error) {
      console.error('❌ Errore nel controllo manuale squalifiche:', error)
      return 0
    }
  }

  return {
    performManualCheck
  }
}
