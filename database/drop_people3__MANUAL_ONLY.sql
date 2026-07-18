-- ❌ MANUAL ONLY: run ONLY after completing docs/PEOPLE3_DROP_CHECKLIST.md
-- ═══════════════════════════════════════════════════════════════════════════════
-- NON eseguire questo script senza aver completato TUTTA la checklist.
-- Backup obbligatorio. Verifiche tecniche obbligatorie.
-- ═══════════════════════════════════════════════════════════════════════════════

-- STEP 1: Ultimo check — esegui e verifica che restituisca 0 righe
-- Se vedi righe, NON procedere con il DROP.
SELECT 
  tc.table_name,
  tc.constraint_name,
  ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'people3';
-- Atteso: 0 righe. Se > 0 → STOP, risolvi le FK prima.

-- STEP 2: Conferma manuale
-- L'operatore deve confermare esplicitamente di aver:
-- - completato docs/PEOPLE3_DROP_CHECKLIST.md
-- - fatto backup/snapshot
-- - eseguito inventory_people3_dependencies.sql con 0 dipendenze attive
--
-- Solo dopo conferma, decommentare e eseguire la riga sotto:

-- DROP TABLE IF EXISTS public.people3;

-- ⚠️ NON usare CASCADE di default.
-- CASCADE eliminerebbe anche tabelle che referenziano people3 (es. people3_people_map
-- se avesse FK verso people3). È pericoloso perché può eliminare dati inaspettati.
-- Se necessario (es. people3_people_map dipende da people3), valutare prima di
-- droppare people3_people_map separatamente, poi people3.
-- In caso estremo, CASCADE andrebbe usato solo se si è certi di ciò che si elimina:
-- DROP TABLE IF EXISTS public.people3 CASCADE;  -- ⚠️ Pericoloso: elimina anche oggetti dipendenti
