-- ========================================
-- Script per verificare e popolare la tabella user_roles
-- ========================================

-- 1. Verifica se la tabella user_roles esiste
SELECT 'Verifica esistenza tabella user_roles:' as info;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles'
) as table_exists;

-- 2. Verifica il contenuto attuale della tabella user_roles
SELECT 'Contenuto attuale tabella user_roles:' as info;
SELECT COUNT(*) as total_roles FROM user_roles;

-- 3. Mostra tutti i ruoli esistenti
SELECT 'Ruoli esistenti:' as info;
SELECT id, name, position_order FROM user_roles ORDER BY position_order;

-- 4. Verifica le policy RLS sulla tabella user_roles
SELECT 'Policy RLS su user_roles:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'user_roles';

-- 5. Se la tabella è vuota, popolala con i ruoli staff (id = UUID generato automaticamente)
INSERT INTO public.user_roles (name, position_order)
SELECT v.name, v.position_order
FROM (VALUES
  ('Admin', 1),
  ('Dirigente', 2),
  ('Allenatore', 3),
  ('Preparatore Atletico', 4),
  ('Team Manager', 5),
  ('Accompagnatore', 6),
  ('Direttore Tecnico', 7),
  ('Direttore Sportivo', 8),
  ('Giocatore', 9),
  ('Tutor', 10),
  ('Familiare', 11)
) AS v(name, position_order)
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE LOWER(name) = LOWER(v.name));

-- 6. Verifica i ruoli dopo l'inserimento
SELECT 'Ruoli dopo inserimento:' as info;
SELECT COUNT(*) as total_roles FROM user_roles;
SELECT id, name, position_order FROM user_roles ORDER BY position_order;

-- 7. Test di accesso alla tabella
SELECT 'Test accesso user_roles:' as info;
SELECT COUNT(*) as accessible_roles FROM user_roles;

-- ========================================
-- COMPLETATO! ✅
-- ========================================








