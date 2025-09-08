-- Script per aggiornare la tabella events per supportare array di PDF
-- Esegui questo script in Supabase SQL Editor

-- Aggiungi la colonna per array di PDF
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS verbale_pdfs TEXT[];

-- Aggiungi commento per la colonna
COMMENT ON COLUMN events.verbale_pdfs IS 'Array di nomi file PDF dei verbali del consiglio';

-- Crea indice GIN per l'array
CREATE INDEX IF NOT EXISTS idx_events_verbale_pdfs ON events USING GIN (verbale_pdfs);

-- Migra i dati esistenti da verbale_pdf a verbale_pdfs
UPDATE events 
SET verbale_pdfs = ARRAY[verbale_pdf] 
WHERE verbale_pdf IS NOT NULL AND verbale_pdf != '';

-- Rimuovi la colonna vecchia (opzionale, commenta se vuoi mantenerla)
-- ALTER TABLE events DROP COLUMN IF EXISTS verbale_pdf;










