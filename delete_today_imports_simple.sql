-- ========================================
-- CANCELLA RECORD IMPORTATI OGGI (VERSIONE SEMPLICE)
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase
-- ATTENZIONE: Questo script elimina TUTTI i record della tabella people
-- che sono stati creati oggi (data odierna) e hanno is_player = true

-- Prima: Controlla quanti record verranno eliminati
SELECT COUNT(*) as record_da_eliminare
FROM public.people
WHERE DATE(created_at) = CURRENT_DATE
  AND is_player = true;

-- ELIMINA i record importati oggi (giocatori)
DELETE FROM public.people
WHERE DATE(created_at) = CURRENT_DATE
  AND is_player = true
  AND fiscal_code IS NOT NULL
  AND fiscal_code != '';

-- Verifica che siano stati eliminati
SELECT 
  COUNT(*) as record_rimanenti_oggi,
  'Se vedi 0, eliminazione completata' as messaggio
FROM public.people
WHERE DATE(created_at) = CURRENT_DATE
  AND is_player = true;

