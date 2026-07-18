// Utilità per controllare e aggiornare automaticamente le squalifiche scadute
import { supabase } from '@/lib/supabaseClient'

export interface DisqualificationCheckResult {
  updated_count: number
  updated_players: string[]
  message: string
}

/**
 * Controlla e aggiorna le squalifiche scadute nel database
 * @returns Promise<DisqualificationCheckResult>
 */
export async function checkExpiredDisqualifications(): Promise<DisqualificationCheckResult> {
  try {
    console.log('🔍 Controllo squalifiche scadute...')
    
    // Chiama la funzione del database per controllare le squalifiche scadute
    const { data, error } = await supabase.rpc('execute_disqualification_check')
    
    if (error) {
      console.error('❌ Errore nel controllo squalifiche:', error)
      throw error
    }
    
    console.log('✅ Controllo squalifiche completato:', data)
    
    return {
      updated_count: 0, // La funzione SQL restituisce solo un messaggio
      updated_players: [],
      message: data || 'Controllo completato'
    }
  } catch (error) {
    console.error('❌ Errore nel controllo squalifiche:', error)
    throw error
  }
}

/**
 * Controlla se un giocatore specifico ha una squalifica scaduta
 * @param playerId ID del giocatore
 * @returns Promise<boolean> true se la squalifica è scaduta
 */
export async function isDisqualificationExpired(playerId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('people')
      .select('disqualified, disqualification_end_date')
      .eq('id', playerId)
      .single()
    
    if (error) {
      console.error('❌ Errore nel controllo squalifica giocatore:', error)
      return false
    }
    
    if (!data.disqualified || !data.disqualification_end_date) {
      return false
    }
    
    const today = new Date()
    const endDate = new Date(data.disqualification_end_date)
    
    return endDate < today
  } catch (error) {
    console.error('❌ Errore nel controllo squalifica:', error)
    return false
  }
}

/**
 * Aggiorna automaticamente una squalifica scaduta per un giocatore specifico
 * @param playerId ID del giocatore
 * @returns Promise<boolean> true se aggiornato con successo
 */
export async function updateExpiredDisqualification(playerId: string): Promise<boolean> {
  try {
    console.log(`🔄 Aggiornamento squalifica scaduta per giocatore ${playerId}...`)
    
    const { error } = await supabase
      .from('people')
      .update({
        disqualified: false,
        disqualification_end_date: null
      })
      .eq('id', playerId)
      .eq('disqualified', true) // Solo se attualmente squalificato
    
    if (error) {
      console.error('❌ Errore nell\'aggiornamento squalifica:', error)
      return false
    }
    
    console.log('✅ Squalifica aggiornata con successo')
    return true
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento squalifica:', error)
    return false
  }
}

/**
 * Avvia il controllo periodico delle squalifiche scadute
 * @param intervalMinutes Intervallo in minuti tra i controlli (default: 60)
 * @returns ID dell'intervallo per poterlo fermare
 */
export function startDisqualificationChecker(intervalMinutes: number = 60): number {
  console.log(`🚀 Avvio controllo periodico squalifiche ogni ${intervalMinutes} minuti`)
  
  return window.setInterval(async () => {
    try {
      await checkExpiredDisqualifications()
    } catch (error) {
      console.error('❌ Errore nel controllo periodico squalifiche:', error)
    }
  }, intervalMinutes * 60 * 1000)
}

/**
 * Ferma il controllo periodico delle squalifiche
 * @param intervalId ID dell'intervallo da fermare
 */
export function stopDisqualificationChecker(intervalId: number): void {
  console.log('🛑 Fermato controllo periodico squalifiche')
  clearInterval(intervalId)
}

/**
 * Controlla e aggiorna le squalifiche scadute per tutti i giocatori
 * @returns Promise<number> Numero di giocatori aggiornati
 */
export async function checkAllExpiredDisqualifications(): Promise<number> {
  try {
    console.log('🔍 Controllo completo squalifiche scadute...')
    
    // Trova tutti i giocatori squalificati con data di scadenza passata
    const { data: players, error: fetchError } = await supabase
      .from('people')
      .select('id, given_name, family_name, disqualification_end_date')
      .eq('disqualified', true)
      .not('disqualification_end_date', 'is', null)
    
    if (fetchError) {
      console.error('❌ Errore nel recupero giocatori squalificati:', fetchError)
      return 0
    }
    
    if (!players || players.length === 0) {
      console.log('ℹ️ Nessun giocatore squalificato trovato')
      return 0
    }
    
    const today = new Date()
    const expiredPlayers = players.filter(player => {
      const endDate = new Date(player.disqualification_end_date)
      return endDate < today
    })
    
    if (expiredPlayers.length === 0) {
      console.log('ℹ️ Nessuna squalifica scaduta trovata')
      return 0
    }
    
    console.log(`🔄 Trovate ${expiredPlayers.length} squalifiche scadute da aggiornare`)
    
    // Aggiorna tutti i giocatori con squalifiche scadute
    const { error: updateError } = await supabase
      .from('people')
      .update({
        disqualified: false,
        disqualification_end_date: null
      })
      .in('id', expiredPlayers.map(p => p.id))
    
    if (updateError) {
      console.error('❌ Errore nell\'aggiornamento squalifiche:', updateError)
      return 0
    }
    
    console.log(`✅ Aggiornate ${expiredPlayers.length} squalifiche scadute`)
    expiredPlayers.forEach(player => {
      console.log(`  - ${player.given_name} ${player.family_name} (scaduta il ${player.disqualification_end_date})`)
    })
    
    return expiredPlayers.length
  } catch (error) {
    console.error('❌ Errore nel controllo completo squalifiche:', error)
    return 0
  }
}
