-- Script per aggiungere la foreign key mancante in staff_categories

-- Aggiungi la foreign key per user_id
ALTER TABLE public.staff_categories 
ADD CONSTRAINT staff_categories_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Verifica che la foreign key sia stata aggiunta
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
  AND tc.table_name = 'staff_categories'
  AND tc.table_schema = 'public';

-- Messaggio di conferma
SELECT 'Foreign key aggiunta con successo!' as status;








