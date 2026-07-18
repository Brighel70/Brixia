-- Fix Row Level Security policies for player_guardian_relationships table

-- Abilita RLS sulla tabella (se non è già abilitato)
ALTER TABLE player_guardian_relationships ENABLE ROW LEVEL SECURITY;

-- Rimuovi policy esistenti (se ce ne sono)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON player_guardian_relationships;
DROP POLICY IF EXISTS "Enable read access for all users" ON player_guardian_relationships;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON player_guardian_relationships;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON player_guardian_relationships;

-- Crea nuove policy per permettere operazioni CRUD agli utenti autenticati

-- Policy per INSERT: permette agli utenti autenticati di inserire relazioni
CREATE POLICY "Enable insert for authenticated users only" ON player_guardian_relationships
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy per SELECT: permette agli utenti autenticati di leggere le relazioni
CREATE POLICY "Enable read access for all users" ON player_guardian_relationships
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy per UPDATE: permette agli utenti autenticati di aggiornare le relazioni
CREATE POLICY "Enable update for authenticated users only" ON player_guardian_relationships
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy per DELETE: permette agli utenti autenticati di eliminare le relazioni
CREATE POLICY "Enable delete for authenticated users only" ON player_guardian_relationships
    FOR DELETE USING (auth.role() = 'authenticated');

-- Verifica che le policy siano state create correttamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'player_guardian_relationships';





