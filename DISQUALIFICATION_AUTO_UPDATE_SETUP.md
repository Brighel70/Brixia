# Sistema di Aggiornamento Automatico Squalifiche

## 📋 Panoramica

Il sistema implementato controlla automaticamente le squalifiche scadute e rimuove il flag "SQUALIFICATO" quando la data di scadenza è passata.

## 🚀 Funzionalità Implementate

### 1. **Controllo Automatico Frontend**
- Controllo automatico al caricamento di ogni pagina persona
- Controllo periodico ogni 60 minuti (configurabile)
- Aggiornamento automatico dei dati visualizzati

### 2. **Funzioni Database**
- `check_and_update_expired_disqualifications()`: Trova e aggiorna le squalifiche scadute
- `execute_disqualification_check()`: Esegue il controllo e restituisce un messaggio
- `trigger_check_disqualification_date_trigger`: Trigger automatico per controlli in tempo reale

### 3. **Utilità JavaScript**
- `checkAllExpiredDisqualifications()`: Controlla e aggiorna tutte le squalifiche scadute
- `isDisqualificationExpired()`: Controlla se una squalifica specifica è scaduta
- `startDisqualificationChecker()`: Avvia il controllo periodico
- `useDisqualificationChecker()`: Hook React per il controllo automatico

## ⚙️ Configurazione

### Passo 1: Esegui lo Script SQL
Esegui il file `check_disqualification_expiry.sql` nel tuo database Supabase:

```sql
-- Esegui tutto il contenuto del file check_disqualification_expiry.sql
-- Questo creerà le funzioni e i trigger necessari
```

### Passo 2: Verifica le Funzioni
Puoi testare le funzioni direttamente nel database:

```sql
-- Controlla manualmente le squalifiche scadute
SELECT * FROM execute_disqualification_check();

-- Controlla le squalifiche scadute con dettagli
SELECT * FROM check_and_update_expired_disqualifications();
```

### Passo 3: Configurazione Frontend (Opzionale)
Il sistema è già integrato e funziona automaticamente. Se vuoi personalizzare:

```typescript
// In src/hooks/useDisqualificationChecker.ts
const { performManualCheck } = useDisqualificationChecker({
  intervalMinutes: 30, // Controllo ogni 30 minuti invece di 60
  enabled: true,
  onDisqualificationsUpdated: (count) => {
    console.log(`${count} squalifiche aggiornate!`)
  }
})
```

## 🔄 Come Funziona

### Controllo Automatico
1. **Al caricamento pagina**: Controlla immediatamente le squalifiche scadute
2. **Controllo periodico**: Ogni 60 minuti controlla di nuovo
3. **Trigger database**: Controlla automaticamente quando vengono modificati i dati

### Logica di Controllo
```sql
-- Trova giocatori squalificati con data scadenza passata
WHERE disqualified = true 
  AND disqualification_end_date IS NOT NULL 
  AND disqualification_end_date < CURRENT_DATE
```

### Aggiornamento Automatico
```sql
-- Rimuove la squalifica e la data di scadenza
UPDATE people 
SET 
  disqualified = false,
  disqualification_end_date = NULL
WHERE id = player_id
```

## 📊 Monitoraggio

### Log Console
Il sistema genera log dettagliati:
- `🔍 Controllo squalifiche scadute...`
- `✅ X squalifiche scadute aggiornate automaticamente`
- `ℹ️ Nessuna squalifica scaduta trovata`

### Notifiche (Opzionale)
Puoi aggiungere notifiche visive usando il componente `DisqualificationNotification`:

```tsx
import DisqualificationNotification from '@/components/DisqualificationNotification'

// Nel tuo componente
<DisqualificationNotification
  updatedCount={updatedCount}
  updatedPlayers={updatedPlayers}
  visible={showNotification}
  onClose={() => setShowNotification(false)}
/>
```

## 🛠️ Manutenzione

### Controllo Manuale
Puoi eseguire un controllo manuale:

```typescript
import { checkAllExpiredDisqualifications } from '@/utils/disqualificationChecker'

const updatedCount = await checkAllExpiredDisqualifications()
console.log(`Aggiornate ${updatedCount} squalifiche`)
```

### Pulizia Database
Per rimuovere le funzioni (se necessario):

```sql
DROP FUNCTION IF EXISTS check_and_update_expired_disqualifications();
DROP FUNCTION IF EXISTS execute_disqualification_check();
DROP FUNCTION IF EXISTS trigger_check_disqualification_date();
DROP TRIGGER IF EXISTS check_disqualification_date_trigger ON people;
```

## ✅ Test

### Test Manuale
1. Crea un giocatore squalificato con data di scadenza nel passato
2. Ricarica la pagina
3. Verifica che il flag "SQUALIFICATO" sia stato rimosso automaticamente

### Test Database
```sql
-- Crea un giocatore di test con squalifica scaduta
INSERT INTO people (given_name, family_name, disqualified, disqualification_end_date)
VALUES ('Test', 'Player', true, '2023-01-01');

-- Esegui il controllo
SELECT * FROM execute_disqualification_check();

-- Verifica che la squalifica sia stata rimossa
SELECT given_name, family_name, disqualified, disqualification_end_date 
FROM people 
WHERE given_name = 'Test';
```

## 🚨 Risoluzione Problemi

### Problema: Le squalifiche non vengono aggiornate
**Soluzione**: Verifica che le funzioni SQL siano state create correttamente

### Problema: Controllo troppo frequente
**Soluzione**: Modifica `intervalMinutes` nel hook `useDisqualificationChecker`

### Problema: Errori di permessi
**Soluzione**: Assicurati che l'utente Supabase abbia i permessi per eseguire le funzioni

## 📈 Prestazioni

- **Controllo frontend**: Eseguito solo quando necessario
- **Controllo database**: Ottimizzato con indici su `disqualified` e `disqualification_end_date`
- **Trigger**: Eseguito solo su INSERT/UPDATE, non impatta le performance

Il sistema è progettato per essere efficiente e non impattare le performance dell'applicazione.











