-- Script per aggiungere il campo FIR code alla tabella profiles
-- Questo permette di collegare gli utenti Player ai giocatori tramite il codice FIR

-- 1. Aggiungi il campo fir_code alla tabella profiles se non esiste già
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'fir_code'
    ) THEN
        ALTER TABLE profiles ADD COLUMN fir_code text;
        
        -- Aggiungi un commento per spiegare l'uso del campo
        COMMENT ON COLUMN profiles.fir_code IS 'Codice FIR del giocatore collegato (solo per utenti con ruolo Player)';
    END IF;
END $$;

-- 2. Crea un indice per migliorare le performance delle ricerche per FIR code
CREATE INDEX IF NOT EXISTS idx_profiles_fir_code ON profiles(fir_code);

-- 3. Aggiungi una constraint per assicurarsi che il FIR code sia unico quando presente
-- (un giocatore può avere solo un utente Player collegato)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_fir_code_unique 
ON profiles(fir_code) 
WHERE fir_code IS NOT NULL;

-- 4. Verifica che il campo sia stato aggiunto correttamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'fir_code';

-- 5. Mostra un esempio di come collegare un utente Player a un giocatore
-- (Questo è solo un esempio, non viene eseguito)
/*
-- Esempio: Collegare un utente Player al giocatore con FIR code 'ABC123'
UPDATE profiles 
SET fir_code = 'ABC123'
WHERE email = 'marco.rossi@email.com' 
AND role = 'Player';
*/





