-- METODO ALTERNATIVO: Aggiungere ruoli staff usando una tabella temporanea
-- Questo metodo evita i problemi di commit degli enum

-- STEP 1: Crea una tabella temporanea con i nuovi ruoli
CREATE TEMP TABLE new_staff_roles (
    role_name TEXT PRIMARY KEY,
    display_name TEXT
);

-- STEP 2: Inserisci i nuovi ruoli
INSERT INTO new_staff_roles (role_name, display_name) VALUES
('team_manager', 'Team Manager'),
('accompagnatore', 'Accompagnatore'),
('fisioterapista', 'Fisioterapista'),
('segreteria', 'Segreteria'),
('tesoriere', 'Tesoriere'),
('arbitro', 'Arbitro');

-- STEP 3: Verifica i ruoli esistenti
SELECT 'Ruoli esistenti:' as info;
SELECT unnest(enum_range(NULL::public.role_enum)) AS existing_roles;

-- STEP 4: Mostra i nuovi ruoli da aggiungere
SELECT 'Nuovi ruoli da aggiungere:' as info;
SELECT role_name, display_name FROM new_staff_roles;

-- STEP 5: ISTRUZIONI MANUALI
-- Copia e incolla questi comandi UNO ALLA VOLTA in Supabase SQL Editor:

-- Comando 1:
-- ALTER TYPE public.role_enum ADD VALUE 'team_manager';

-- Comando 2:
-- ALTER TYPE public.role_enum ADD VALUE 'accompagnatore';

-- Comando 3:
-- ALTER TYPE public.role_enum ADD VALUE 'fisioterapista';

-- Comando 4:
-- ALTER TYPE public.role_enum ADD VALUE 'segreteria';

-- Comando 5:
-- ALTER TYPE public.role_enum ADD VALUE 'tesoriere';

-- Comando 6:
-- ALTER TYPE public.role_enum ADD VALUE 'arbitro';

-- STEP 6: Verifica finale (dopo aver eseguito tutti i comandi sopra)
-- SELECT unnest(enum_range(NULL::public.role_enum)) AS all_roles ORDER BY all_roles;




