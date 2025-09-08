-- Verifica se i campi is_sponsor_potential e is_club_useful esistono nella tabella tutors
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'tutors' 
AND column_name IN ('is_sponsor_potential', 'is_club_useful') 
ORDER BY column_name;

-- Mostra tutti i campi della tabella tutors per confronto
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'tutors' 
ORDER BY ordinal_position;


