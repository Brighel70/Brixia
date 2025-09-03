# Migrazione da birth_year a birth_date

## 📋 Panoramica
Questo documento descrive la migrazione del campo `birth_year` (INTEGER) a `birth_date` (DATE) nelle tabelle `profiles` e `players`.

## 🗄️ Modifiche Database

### 1. Esegui lo script SQL
```bash
# Esegui questo script in Supabase SQL Editor
psql -f update_birth_year_to_birth_date.sql
```

### 2. Verifica le modifiche
```sql
-- Controlla che le colonne siano state aggiunte
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('profiles', 'players') 
AND column_name IN ('birth_year', 'birth_date');

-- Controlla che i dati siano stati migrati
SELECT COUNT(*) as total_profiles, 
       COUNT(birth_date) as profiles_with_birth_date
FROM profiles;

SELECT COUNT(*) as total_players, 
       COUNT(birth_date) as players_with_birth_date  
FROM players;
```

## 💻 Modifiche Frontend

### File Aggiornati:
- ✅ `src/store/data.ts` - Tipo TypeScript aggiornato
- ✅ `src/pages/PlayersView.tsx` - Visualizzazione e logica aggiornate
- ✅ `src/pages/CreatePlayer.tsx` - Form di creazione aggiornato
- ✅ `src/pages/CreateUser.tsx` - Già aggiornato in precedenza

### Modifiche Principali:
1. **Tipo TypeScript**: `birth_year?: number` → `birth_date?: string`
2. **Form Input**: `type="number"` → `type="date"`
3. **Validazione**: Controllo anno → Controllo data completa
4. **Database**: `birth_year: INTEGER` → `birth_date: DATE`

## 🔄 Compatibilità

### Mantenimento Backward Compatibility:
- Le colonne `birth_year` vengono mantenute per compatibilità
- I dati esistenti vengono migrati automaticamente
- Le funzioni esistenti continuano a funzionare

### Rimozione Futura (Opzionale):
```sql
-- Dopo aver verificato che tutto funziona, puoi rimuovere le colonne vecchie:
ALTER TABLE profiles DROP COLUMN IF EXISTS birth_year;
ALTER TABLE players DROP COLUMN IF EXISTS birth_year;
```

## ✅ Test da Eseguire

1. **Creazione Nuovo Staff**: Verifica che il form accetti date complete
2. **Creazione Nuovo Giocatore**: Verifica che il form accetti date complete  
3. **Visualizzazione Giocatori**: Verifica che l'anno venga estratto correttamente
4. **Filtri**: Verifica che i filtri per anno funzionino ancora
5. **Dati Esistenti**: Verifica che i dati migrati vengano visualizzati correttamente

## 🚨 Note Importanti

- **Backup**: Esegui sempre un backup prima di modifiche al database
- **Test**: Testa in ambiente di sviluppo prima della produzione
- **Rollback**: Se necessario, puoi ripristinare `birth_year` e rimuovere `birth_date`
- **Performance**: Gli indici sono stati aggiunti per ottimizzare le query su `birth_date`

## 📞 Supporto

Se riscontri problemi durante la migrazione:
1. Controlla i log di Supabase per errori SQL
2. Verifica che tutti i file frontend siano stati aggiornati
3. Controlla che le variabili d'ambiente siano corrette


