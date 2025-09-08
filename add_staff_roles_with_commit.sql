-- Script per aggiungere i ruoli staff con commit forzato
-- Eseguire TUTTO il contenuto di questo script in una volta

-- 1. Prima controlla i ruoli esistenti
SELECT unnest(enum_range(NULL::public.role_enum)) AS current_roles;

-- 2. Aggiungi tutti i ruoli in una singola transazione
-- Usando una funzione per evitare problemi di commit

DO $$
BEGIN
    -- Aggiungi team_manager
    BEGIN
        ALTER TYPE public.role_enum ADD VALUE 'team_manager';
    EXCEPTION
        WHEN duplicate_object THEN
            NULL; -- Ignora se già esiste
    END;
    
    -- Aggiungi accompagnatore
    BEGIN
        ALTER TYPE public.role_enum ADD VALUE 'accompagnatore';
    EXCEPTION
        WHEN duplicate_object THEN
            NULL; -- Ignora se già esiste
    END;
    
    -- Aggiungi fisioterapista
    BEGIN
        ALTER TYPE public.role_enum ADD VALUE 'fisioterapista';
    EXCEPTION
        WHEN duplicate_object THEN
            NULL; -- Ignora se già esiste
    END;
    
    -- Aggiungi segreteria
    BEGIN
        ALTER TYPE public.role_enum ADD VALUE 'segreteria';
    EXCEPTION
        WHEN duplicate_object THEN
            NULL; -- Ignora se già esiste
    END;
    
    -- Aggiungi tesoriere
    BEGIN
        ALTER TYPE public.role_enum ADD VALUE 'tesoriere';
    EXCEPTION
        WHEN duplicate_object THEN
            NULL; -- Ignora se già esiste
    END;
    
    -- Aggiungi arbitro
    BEGIN
        ALTER TYPE public.role_enum ADD VALUE 'arbitro';
    EXCEPTION
        WHEN duplicate_object THEN
            NULL; -- Ignora se già esiste
    END;
END $$;

-- 3. Verifica finale
SELECT unnest(enum_range(NULL::public.role_enum)) AS all_roles
ORDER BY all_roles;

-- 4. Messaggio di conferma
SELECT 'Tutti i ruoli staff sono stati aggiunti con successo!' as status;




