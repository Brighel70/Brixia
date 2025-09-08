-- Script per aggiungere i ruoli staff mancanti al database
-- Eseguire questo script in Supabase SQL Editor

-- STEP 1: Aggiungere i nuovi ruoli all'enum role_enum
-- Prima controlliamo i valori attuali
SELECT unnest(enum_range(NULL::public.role_enum)) AS current_roles;

-- Aggiungiamo i nuovi ruoli all'enum esistente UNO ALLA VOLTA
-- IMPORTANTE: Eseguire ogni ALTER TYPE separatamente e committare

-- Ruolo 1: Team Manager
ALTER TYPE public.role_enum ADD VALUE IF NOT EXISTS 'team_manager';

-- Ruolo 2: Accompagnatore  
ALTER TYPE public.role_enum ADD VALUE IF NOT EXISTS 'accompagnatore';

-- Ruolo 3: Fisioterapista
ALTER TYPE public.role_enum ADD VALUE IF NOT EXISTS 'fisioterapista';

-- Ruolo 4: Segreteria
ALTER TYPE public.role_enum ADD VALUE IF NOT EXISTS 'segreteria';

-- Ruolo 5: Tesoriere
ALTER TYPE public.role_enum ADD VALUE IF NOT EXISTS 'tesoriere';

-- Ruolo 6: Arbitro
ALTER TYPE public.role_enum ADD VALUE IF NOT EXISTS 'arbitro';

-- STEP 2: Verificare che i ruoli siano stati aggiunti correttamente
SELECT unnest(enum_range(NULL::public.role_enum)) AS all_roles
ORDER BY all_roles;

-- STEP 3: Aggiungere i ruoli mancanti alla tabella council_members.role se necessario
-- (Questo dipende da come è strutturata la tabella council_members)

-- Verifichiamo la struttura della tabella council_members
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'council_members' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Se council_members.role è un enum separato, aggiungiamo i valori anche lì
-- (Sostituire 'council_role_enum' con il nome effettivo dell'enum se diverso)
-- ALTER TYPE public.council_role_enum ADD VALUE IF NOT EXISTS 'team_manager';
-- ALTER TYPE public.council_role_enum ADD VALUE IF NOT EXISTS 'accompagnatore';
-- ALTER TYPE public.council_role_enum ADD VALUE IF NOT EXISTS 'fisioterapista';
-- ALTER TYPE public.council_role_enum ADD VALUE IF NOT EXISTS 'segreteria';
-- ALTER TYPE public.council_role_enum ADD VALUE IF NOT EXISTS 'tesoriere';
-- ALTER TYPE public.council_role_enum ADD VALUE IF NOT EXISTS 'arbitro';

-- STEP 4: Verifica finale
-- Controlliamo che tutti i ruoli siano disponibili
SELECT 
    'role_enum' as enum_type,
    unnest(enum_range(NULL::public.role_enum)) AS role_value
-- Se esiste un enum separato per council_members, aggiungerlo qui
-- UNION ALL
-- SELECT 
--     'council_role_enum' as enum_type,
--     unnest(enum_range(NULL::public.council_role_enum)) AS role_value
ORDER BY enum_type, role_value;

-- Messaggio di conferma
SELECT 'Script completato: Ruoli staff aggiunti con successo!' as status;
