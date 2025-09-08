-- STEP A: Creazione tabella people e funzioni correlate
-- Migrazione sicura per Supabase - Non elimina nulla esistente

-- 1) Tabella master "people"
CREATE TABLE IF NOT EXISTS public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  given_name text,
  family_name text,
  date_of_birth date NOT NULL,
  is_minor boolean NOT NULL DEFAULT false,
  gender text CHECK (gender IN ('M','F','X')),
  fiscal_code text UNIQUE,
  email text UNIQUE,
  phone text,
  address_street text,
  address_city text,
  address_zip text,
  address_region text,
  address_country text,
  nationality text,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_notes text,
  membership_number text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() 
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN 
  NEW.updated_at := now(); 
  RETURN NEW; 
END $$;

DROP TRIGGER IF EXISTS trg_people_updated ON public.people;
CREATE TRIGGER trg_people_updated 
  BEFORE UPDATE ON public.people
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_updated_at();

-- 3) Funzione per calcolare is_minor
CREATE OR REPLACE FUNCTION public.compute_is_minor(dob date)
RETURNS boolean 
LANGUAGE sql 
IMMUTABLE AS
$$ 
  SELECT (date_part('year', age(current_date, dob)) < 18) 
$$;

CREATE OR REPLACE FUNCTION public.trg_people_minor()
RETURNS trigger 
LANGUAGE plpgsql AS $$
BEGIN 
  NEW.is_minor := public.compute_is_minor(NEW.date_of_birth); 
  RETURN NEW; 
END $$;

DROP TRIGGER IF EXISTS trg_people_bi_minor ON public.people;
CREATE TRIGGER trg_people_bi_minor
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.people
  FOR EACH ROW 
  EXECUTE FUNCTION public.trg_people_minor();

-- 4) Sequenza e trigger per membership_number
CREATE SEQUENCE IF NOT EXISTS public.seq_membership;

CREATE OR REPLACE FUNCTION public.trg_people_membership()
RETURNS trigger 
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.membership_number IS NULL THEN
    NEW.membership_number := to_char(now(),'YY') || lpad(nextval('public.seq_membership')::text,6,'0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_people_bi_membership ON public.people;
CREATE TRIGGER trg_people_bi_membership
  BEFORE INSERT ON public.people
  FOR EACH ROW 
  EXECUTE FUNCTION public.trg_people_membership();

-- 5) Validazione Codice Fiscale
CREATE OR REPLACE FUNCTION public.is_valid_cf(cf text)
RETURNS boolean 
LANGUAGE plpgsql AS $$
DECLARE 
  s text := upper(regexp_replace(cf, '\s+', '', 'g'));
BEGIN
  IF s IS NULL THEN 
    RETURN true;  -- CF facoltativo
  END IF;
  IF length(s) <> 16 THEN 
    RETURN false; 
  END IF;
  IF s !~ '^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$' THEN 
    RETURN false; 
  END IF;
  RETURN true; -- TODO: checksum pari/dispari se vuoi rigore 100%
END $$;

ALTER TABLE public.people
  DROP CONSTRAINT IF EXISTS ck_people_cf;
ALTER TABLE public.people
  ADD CONSTRAINT ck_people_cf CHECK (public.is_valid_cf(fiscal_code));

-- Test di verifica: inserisci 1 maggiorenne e 1 minorenne
-- INSERT INTO public.people (full_name, given_name, family_name, date_of_birth, email) 
-- VALUES 
--   ('Mario Rossi', 'Mario', 'Rossi', '1990-05-15', 'mario.rossi@test.com'),
--   ('Giulia Bianchi', 'Giulia', 'Bianchi', '2010-03-20', 'giulia.bianchi@test.com');

-- Verifica: SELECT id, full_name, is_minor, membership_number FROM public.people;





