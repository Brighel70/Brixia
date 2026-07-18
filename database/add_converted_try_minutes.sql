-- Traccia quali mete del giocatore hanno già una trasformazione abbinata
ALTER TABLE public.match_statistics
ADD COLUMN IF NOT EXISTS converted_try_minutes INTEGER[] DEFAULT '{}';

COMMENT ON COLUMN public.match_statistics.converted_try_minutes IS
  'Minuti delle mete segnate da questo giocatore che hanno già una trasformazione abbinata';
