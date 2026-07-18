-- Aggiunge fee_id alla tabella notes per collegare note alle quote (es. sollecito inviato)
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS fee_id uuid REFERENCES public.fees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notes_fee_id ON public.notes(fee_id);

COMMENT ON COLUMN public.notes.fee_id IS 'ID della quota a cui la nota è collegata (opzionale, per note nella card Quote)';
