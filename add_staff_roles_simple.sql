-- Script SEMPLICE per aggiungere i ruoli staff
-- IMPORTANTE: Eseguire SOLO il primo comando, poi aspettare e eseguire il secondo, ecc.

-- STEP 1: Controlla i ruoli esistenti
SELECT unnest(enum_range(NULL::public.role_enum)) AS current_roles;

-- STEP 2: Aggiungi UN SOLO ruolo alla volta (esegui solo questo):
ALTER TYPE public.role_enum ADD VALUE 'team_manager';

-- STEP 3: Dopo aver eseguito il comando sopra, esegui questo:
-- ALTER TYPE public.role_enum ADD VALUE 'accompagnatore';

-- STEP 4: Dopo aver eseguito il comando sopra, esegui questo:
-- ALTER TYPE public.role_enum ADD VALUE 'fisioterapista';

-- STEP 5: Dopo aver eseguito il comando sopra, esegui questo:
-- ALTER TYPE public.role_enum ADD VALUE 'segreteria';

-- STEP 6: Dopo aver eseguito il comando sopra, esegui questo:
-- ALTER TYPE public.role_enum ADD VALUE 'tesoriere';

-- STEP 7: Dopo aver eseguito il comando sopra, esegui questo:
-- ALTER TYPE public.role_enum ADD VALUE 'arbitro';

-- STEP 8: Verifica finale (esegui dopo aver aggiunto tutti i ruoli)
-- SELECT unnest(enum_range(NULL::public.role_enum)) AS all_roles ORDER BY all_roles;





