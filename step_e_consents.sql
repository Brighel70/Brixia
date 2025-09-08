-- STEP E: Consensi & Firme
-- Migrazione sicura per Supabase - Non elimina nulla esistente

CREATE TABLE IF NOT EXISTS public.consent_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  required_for_minor boolean NOT NULL DEFAULT false,
  required_for_adult boolean NOT NULL DEFAULT false,
  version int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.person_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  consent_type_id uuid NOT NULL REFERENCES public.consent_types(id) ON DELETE RESTRICT,
  version int NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  signed_by_person_id uuid NOT NULL REFERENCES public.people(id),
  ip_address inet,
  user_agent text,
  file_path text,
  UNIQUE(person_id, consent_type_id, version)
);

CREATE OR REPLACE FUNCTION public.sign_consent(
  p_person uuid, p_consent_code text, p_signed_by uuid, p_ip inet, p_ua text
) RETURNS public.person_consents 
LANGUAGE plpgsql AS $$
DECLARE 
  ct record; 
  child_minor boolean;
BEGIN
  SELECT * INTO ct FROM public.consent_types WHERE code=p_consent_code AND active=true;
  IF ct IS NULL THEN 
    RAISE EXCEPTION 'Consent % not found/active', p_consent_code; 
  END IF;

  SELECT is_minor INTO child_minor FROM public.people WHERE id=p_person;

  IF child_minor AND ct.required_for_minor THEN
    IF NOT EXISTS (SELECT 1 FROM public.guardians g
                   WHERE g.child_person_id=p_person AND g.guardian_person_id=p_signed_by) THEN
      RAISE EXCEPTION 'Signer is not a guardian';
    END IF;
  END IF;

  INSERT INTO public.person_consents(person_id, consent_type_id, version, signed_by_person_id, ip_address, user_agent)
  VALUES (p_person, ct.id, ct.version, p_signed_by, p_ip, p_ua)
  RETURNING * INTO STRICT ct;
  RETURN ct;
END $$;





