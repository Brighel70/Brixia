-- Aggiunge lo stato "In chiusura" agli infortuni: il cliente è in fase di chiusura ma non ancora chiuso.
-- Esegui in Supabase SQL Editor.

ALTER TABLE public.injuries
ADD COLUMN IF NOT EXISTS in_chiusura boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.injuries.in_chiusura IS 'True se l''infortunio è in fase di chiusura (es. dopo visita di chiusura) ma non ancora chiuso/guarito.';

-- Verifica
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'injuries' AND column_name = 'in_chiusura';
