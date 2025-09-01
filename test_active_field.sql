-- Test per verificare se il campo active esiste
-- Esegui questo script nel tuo database Supabase

-- Verifica la struttura della tabella
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'categories' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verifica se il campo active esiste
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'categories' 
      AND column_name = 'active' 
      AND table_schema = 'public'
    ) 
    THEN 'Campo active ESISTE' 
    ELSE 'Campo active NON ESISTE' 
  END as status;

-- Mostra tutte le categorie con il campo active
SELECT code, name, active, sort FROM categories ORDER BY sort;

