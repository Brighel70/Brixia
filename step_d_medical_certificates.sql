-- STEP D: Certificati medici
-- Migrazione sicura per Supabase - Non elimina nulla esistente

CREATE TABLE IF NOT EXISTS public.medical_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('non_agonistico','agonistico')),
  issued_on date NOT NULL,
  expires_on date NOT NULL,
  provider text,
  file_path text,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','expired','missing'))
);

CREATE OR REPLACE FUNCTION public.trg_med_cert_status()
RETURNS trigger 
LANGUAGE plpgsql AS $$
BEGIN
  NEW.status := CASE WHEN NEW.expires_on < current_date THEN 'expired' ELSE 'valid' END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_med_cert_bu_status ON public.medical_certificates;
CREATE TRIGGER trg_med_cert_bu_status
  BEFORE INSERT OR UPDATE OF expires_on ON public.medical_certificates
  FOR EACH ROW 
  EXECUTE FUNCTION public.trg_med_cert_status();

-- View di supporto
CREATE OR REPLACE VIEW public.v_person_medical_status AS
SELECT p.id AS person_id,
       EXISTS (
         SELECT 1 FROM public.medical_certificates mc
         WHERE mc.person_id=p.id AND mc.status='valid'
       ) AS has_valid,
       (SELECT min(expires_on) FROM public.medical_certificates mc
         WHERE mc.person_id=p.id AND mc.expires_on>=current_date) AS next_expiry
FROM public.people p;





