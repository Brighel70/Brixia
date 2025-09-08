-- Script per aggiungere i ruoli staff UNO ALLA VOLTA
-- Eseguire ogni comando separatamente in Supabase SQL Editor

-- 1. Prima controlla i ruoli esistenti
SELECT unnest(enum_range(NULL::public.role_enum)) AS current_roles;

-- 2. Aggiungi i ruoli uno alla volta (esegui ogni comando separatamente):

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

-- 3. Verifica finale (esegui dopo aver aggiunto tutti i ruoli)
SELECT unnest(enum_range(NULL::public.role_enum)) AS all_roles
ORDER BY all_roles;




