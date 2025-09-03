-- Script per aggiornare i campi birth_year a birth_date
-- Converte da INTEGER (anno) a DATE (data completa)

-- 1. Aggiungi la colonna birth_date alla tabella profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 2. Aggiungi la colonna birth_date alla tabella players  
ALTER TABLE players ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 3. Migra i dati esistenti da birth_year a birth_date
-- Per profiles: converte l'anno in una data (1 gennaio di quell'anno)
UPDATE profiles 
SET birth_date = DATE(birth_year || '-01-01') 
WHERE birth_year IS NOT NULL AND birth_date IS NULL;

-- Per players: converte l'anno in una data (1 gennaio di quell'anno)
UPDATE players 
SET birth_date = DATE(birth_year || '-01-01') 
WHERE birth_year IS NOT NULL AND birth_date IS NULL;

-- 4. Aggiungi commenti per documentare le colonne
COMMENT ON COLUMN profiles.birth_date IS 'Data di nascita completa (YYYY-MM-DD)';
COMMENT ON COLUMN players.birth_date IS 'Data di nascita completa (YYYY-MM-DD)';

-- 5. Crea indici per le nuove colonne (opzionale, per performance)
CREATE INDEX IF NOT EXISTS idx_profiles_birth_date ON profiles(birth_date);
CREATE INDEX IF NOT EXISTS idx_players_birth_date ON players(birth_date);

-- 6. Aggiorna le funzioni che usano birth_year per usare birth_date
-- (Se ci sono funzioni specifiche che dipendono da birth_year, vanno aggiornate qui)

-- NOTA: Le colonne birth_year vengono mantenute per compatibilità
-- Possono essere rimosse in futuro con:
-- ALTER TABLE profiles DROP COLUMN IF EXISTS birth_year;
-- ALTER TABLE players DROP COLUMN IF EXISTS birth_date;


