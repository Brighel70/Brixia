-- Script per aggiornare la tabella profiles con il campo telefono
-- Esegui questo script nel tuo database Supabase

-- 1. Aggiungi il campo telefono alla tabella profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Aggiungi un commento per documentare il campo
COMMENT ON COLUMN profiles.phone IS 'Numero di telefono dell''utente';

-- 3. Verifica la struttura aggiornata
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Mostra i dati attuali
SELECT 
  id,
  full_name,
  email,
  phone,
  role,
  user_role_id,
  created_at
FROM profiles
ORDER BY created_at;




