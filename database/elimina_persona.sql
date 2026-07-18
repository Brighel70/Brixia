-- ELIMINA UNA PERSONA (e i dati collegati, dove previsto CASCADE)
-- Persona: Gianpaolo Gennari - GNNGPL72A26B157Y
-- ID: a872d076-d370-4bff-bedf-4cacfb350942

-- 1. Verifica prima chi stai per cancellare (controllo di sicurezza)
SELECT id, given_name, family_name, fiscal_code, date_of_birth, status
FROM public.people
WHERE id = 'a872d076-d370-4bff-bedf-4cacfb350942';

-- 2. Elimina la persona (le tabelle con ON DELETE CASCADE cancelleranno automaticamente le righe collegate)
DELETE FROM public.people
WHERE id = 'a872d076-d370-4bff-bedf-4cacfb350942';

-- 3. Verifica che sia stata eliminata (deve restituire 0 righe)
SELECT COUNT(*) AS rimaste FROM public.people WHERE id = 'a872d076-d370-4bff-bedf-4cacfb350942';
