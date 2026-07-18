-- Script per aggiungere i campi orario agli eventi esistenti
-- Esegui questo script nel tuo database Supabase

-- 1. Verifica la struttura attuale degli eventi
SELECT 'Struttura attuale events:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- 2. Aggiungi i campi orario se non esistono
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_time time;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time time;

-- 3. Aggiorna gli eventi esistenti con orari di default
-- Per le partite: 17:00
UPDATE public.events 
SET event_time = '17:00:00', start_time = '17:00:00', end_time = '19:00:00'
WHERE event_type = 'partita' AND (event_time IS NULL OR start_time IS NULL);

-- Per i tornei: 09:00
UPDATE public.events 
SET event_time = '09:00:00', start_time = '09:00:00', end_time = '18:00:00'
WHERE event_type = 'torneo' AND (event_time IS NULL OR start_time IS NULL);

-- 4. Verifica gli eventi aggiornati
SELECT 'Eventi aggiornati:' as info;
SELECT id, title, event_date, event_time, start_time, end_time, event_type
FROM public.events 
WHERE event_date >= '2025-01-20'
ORDER BY event_date, event_time;

