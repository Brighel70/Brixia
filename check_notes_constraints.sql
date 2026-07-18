-- Verifica vincoli e struttura tabella notes (per debug errore 409)
-- Esegui in Supabase SQL Editor.

-- 1. Struttura colonne
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'notes' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Tutti i vincoli (UNIQUE, CHECK, FK)
SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, 
       ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'notes' AND tc.table_schema = 'public';

-- 3. Se created_by ha FK a profiles e non accetta 'Sistema', opzione: rendere nullable
-- (decommenta solo se necessario)
/*
ALTER TABLE public.notes ALTER COLUMN created_by DROP NOT NULL;
-- Poi nell'app usa created_by: user?.id ?? null (e la colonna accetta NULL)
*/
