-- Script per aggiornare la tabella events con i nuovi campi
-- Aggiunge i campi per partecipanti del consiglio e PDF verbale

-- Aggiungi colonna per i partecipanti del consiglio (array di stringhe)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS participants TEXT[];

-- Aggiungi colonna per il PDF del verbale
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS verbale_pdf TEXT;

-- Aggiungi colonna per gli invitati (array di stringhe)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS invited TEXT[];

-- Aggiungi commenti per chiarezza
COMMENT ON COLUMN public.events.participants IS 'Array di nomi dei partecipanti per eventi consiglio';
COMMENT ON COLUMN public.events.invited IS 'Array di nomi degli invitati per eventi consiglio';
COMMENT ON COLUMN public.events.verbale_pdf IS 'Nome del file PDF del verbale per eventi consiglio';

-- Crea un indice per migliorare le performance sui partecipanti
CREATE INDEX IF NOT EXISTS idx_events_participants ON public.events USING GIN(participants);

-- Crea un indice per migliorare le performance sugli invitati
CREATE INDEX IF NOT EXISTS idx_events_invited ON public.events USING GIN(invited);
