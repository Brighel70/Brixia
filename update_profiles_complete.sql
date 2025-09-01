-- Script completo per aggiornare la tabella profiles
-- Esegui questo script nel tuo database Supabase

-- 1. Aggiungi il campo telefono (se non esiste)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Aggiungi i campi nome e cognome separati
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 3. Aggiungi commenti per documentare i campi
COMMENT ON COLUMN profiles.phone IS 'Numero di telefono dell''utente';
COMMENT ON COLUMN profiles.first_name IS 'Nome dell''utente';
COMMENT ON COLUMN profiles.last_name IS 'Cognome dell''utente';

-- 4. Popola i campi first_name e last_name dagli utenti esistenti
-- (solo se sono vuoti e full_name contiene uno spazio)
UPDATE profiles 
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN full_name) > 0 
    THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END
WHERE (first_name IS NULL OR first_name = '') 
  AND (last_name IS NULL OR last_name = '')
  AND full_name IS NOT NULL 
  AND full_name != '';

-- 5. Verifica la struttura aggiornata
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Mostra i dati attuali con i nuovi campi
SELECT 
  id,
  full_name,
  first_name,
  last_name,
  email,
  phone,
  role,
  user_role_id,
  created_at
FROM profiles
ORDER BY created_at;

-- 7. Conta quanti utenti hanno i nuovi campi popolati
SELECT 
  'Utenti totali' as info,
  COUNT(*) as count
FROM profiles
UNION ALL
SELECT 
  'Con first_name' as info,
  COUNT(*) as count
FROM profiles 
WHERE first_name IS NOT NULL AND first_name != ''
UNION ALL
SELECT 
  'Con last_name' as info,
  COUNT(*) as count
FROM profiles 
WHERE last_name IS NOT NULL AND last_name != ''
UNION ALL
SELECT 
  'Con telefono' as info,
  COUNT(*) as count
FROM profiles 
WHERE phone IS NOT NULL AND phone != '';




