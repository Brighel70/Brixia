-- ========================================
-- MIGRAZIONE: Rinomina people3 in people
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Rinomina la tabella people3 in people
ALTER TABLE public.people3 RENAME TO people;

-- 2. Rinomina la sequenza se esiste
ALTER SEQUENCE IF EXISTS people_next_membership_number_seq RENAME TO people_next_membership_number_seq;

-- 3. Aggiorna i riferimenti nelle foreign key di altre tabelle
-- (Questo dovrebbe essere fatto automaticamente da PostgreSQL)

-- 4. Verifica che la tabella sia stata rinominata correttamente
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('people', 'people3');

-- 5. Verifica le foreign key che puntano alla tabella people
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND ccu.table_name = 'people';

-- 6. Se tutto è corretto, elimina la vecchia tabella people (se esiste)
-- ATTENZIONE: Solo se non contiene dati importanti!
-- DROP TABLE IF EXISTS public.people_old;

console.log('✅ Script di migrazione creato!')
console.log('📋 Copia e incolla nel SQL Editor di Supabase')
