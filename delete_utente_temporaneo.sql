-- =============================================================================
-- Elimina "Utente Temporaneo" (utente prova) e tutte le referenze
-- =============================================================================
-- Esegui nel SQL Editor di Supabase (usa l'account con permessi di modifica).
-- La persona potrebbe essere referenziata in match_lists.created_by:
-- prima si eliminano o aggiornano quelle righe, poi si elimina la persona.
-- =============================================================================

-- 1) Opzione A: Elimina le liste gara create da "Utente Temporaneo"
-- (sconsigliato se vuoi tenere le liste: usa Opzione B)
DELETE FROM public.match_lists
WHERE created_by IN (
  SELECT id FROM public.people WHERE full_name = 'Utente Temporaneo'
);

-- 2) Oppure Opzione B: Assegna le liste a un altro utente (es. primo admin)
-- Decommenta e imposta l'UUID della persona che diventerà "creatore":
/*
UPDATE public.match_lists
SET created_by = 'UUID-PERSONA-ADMIN-QUI'
WHERE created_by IN (
  SELECT id FROM public.people WHERE full_name = 'Utente Temporaneo'
);
*/

-- 3) Rimuovi invite_used_by su people che puntano al profilo dell'utente
UPDATE public.people
SET invite_used_by = NULL
WHERE invite_used_by IN (
  SELECT id FROM public.profiles WHERE person_id IN (
    SELECT id FROM public.people WHERE full_name = 'Utente Temporaneo'
  )
);

-- 4) Elimina da player_guardian_relationships
DELETE FROM public.player_guardian_relationships
WHERE player_person_id IN (SELECT id FROM public.people WHERE full_name = 'Utente Temporaneo')
   OR guardian_person_id IN (SELECT id FROM public.people WHERE full_name = 'Utente Temporaneo');

-- 5) Elimina da profiles
DELETE FROM public.profiles
WHERE person_id IN (SELECT id FROM public.people WHERE full_name = 'Utente Temporaneo');

-- 6) Elimina la persona
DELETE FROM public.people
WHERE full_name = 'Utente Temporaneo';

-- Verifica
SELECT 'Operazione completata. Persone rimanenti con nome Utente Temporaneo:' AS info;
SELECT COUNT(*) FROM public.people WHERE full_name = 'Utente Temporaneo';
-- Atteso: 0
