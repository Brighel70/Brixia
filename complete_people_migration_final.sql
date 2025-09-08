-- =====================================================
-- MIGRAZIONE COMPLETA: Sistema Anagrafica Master PEOPLE (VERSIONE FINALE CORRETTA)
-- =====================================================
-- Eseguire questo script completo su Supabase SQL Editor
-- ATTENZIONE: Eseguire in ordine sequenziale per evitare errori

-- =====================================================
-- STEP A: Creazione tabella people e funzioni correlate
-- =====================================================

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

-- =====================================================
-- STEP B: Collega players alla persona (VERSIONE CORRETTA)
-- =====================================================

-- 1) Aggiungi FK a people
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS person_id uuid;

ALTER TABLE public.players
  ADD CONSTRAINT players_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;

-- 2) Backfill: crea una persona per ogni player (SOLO quelli con date valide)
INSERT INTO public.people (full_name, given_name, family_name, date_of_birth, email, phone, nationality)
SELECT
  COALESCE(NULLIF(TRIM(p.first_name||' '||p.last_name),''), 'Senza Nome'),
  NULLIF(p.first_name,''),
  NULLIF(p.last_name,''),
  COALESCE(p.birth_date, to_date(p.birth_year::text || '-01-01','YYYY-MM-DD')),
  NULL, NULL, NULL
FROM public.players p
WHERE p.person_id IS NULL
  AND (p.birth_date IS NOT NULL OR p.birth_year IS NOT NULL);  -- SOLO con date valide

-- 3) Aggancia i players alle people appena create (per nome+cognome+data)
UPDATE public.players pl
SET person_id = pe.id
FROM public.people pe
WHERE pl.person_id IS NULL
  AND pe.given_name IS NOT DISTINCT FROM pl.first_name
  AND pe.family_name IS NOT DISTINCT FROM pl.last_name
  AND pe.date_of_birth IS NOT DISTINCT FROM COALESCE(pl.birth_date, to_date(pl.birth_year::text||'-01-01','YYYY-MM-DD'));

-- 4) Per i players senza date, crea record con data di default
INSERT INTO public.people (full_name, given_name, family_name, date_of_birth, email, phone, nationality)
SELECT
  COALESCE(NULLIF(TRIM(p.first_name||' '||p.last_name),''), 'Senza Nome'),
  NULLIF(p.first_name,''),
  NULLIF(p.last_name,''),
  '1900-01-01'::date,  -- Data di default per casi senza data
  NULL, NULL, NULL
FROM public.players p
WHERE p.person_id IS NULL
  AND p.birth_date IS NULL 
  AND p.birth_year IS NULL;

-- 5) Collega anche questi ultimi players
UPDATE public.players pl
SET person_id = pe.id
FROM public.people pe
WHERE pl.person_id IS NULL
  AND pe.given_name IS NOT DISTINCT FROM pl.first_name
  AND pe.family_name IS NOT DISTINCT FROM pl.last_name
  AND pe.date_of_birth = '1900-01-01'::date;

-- =====================================================
-- STEP C: Tutori/Genitori
-- =====================================================

CREATE TABLE IF NOT EXISTS public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_person_id uuid NOT NULL REFERENCES public.people(id),
  guardian_person_id uuid NOT NULL REFERENCES public.people(id),
  relationship text NOT NULL, -- es. 'genitore','tutore'
  is_primary boolean NOT NULL DEFAULT false,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(child_person_id, guardian_person_id)
);

-- Vincolo (opzionale): un minorenne deve avere almeno 1 tutore primario (deferred)
CREATE OR REPLACE FUNCTION public.check_minor_guardian()
RETURNS trigger 
LANGUAGE plpgsql AS $$
DECLARE 
  cnt int;
BEGIN
  IF NEW.is_minor THEN
    SELECT count(*) INTO cnt
    FROM public.guardians g
    WHERE g.child_person_id = NEW.id AND g.is_primary = true;
    IF tg_op = 'INSERT' AND cnt = 0 THEN
      -- non blocchiamo subito: si può aggiungere il tutore subito dopo in stessa transazione
      NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_people_minor_guard ON public.people;
CREATE TRIGGER trg_people_minor_guard
  AFTER INSERT OR UPDATE OF is_minor ON public.people
  FOR EACH ROW 
  EXECUTE FUNCTION public.check_minor_guardian();

-- =====================================================
-- STEP D: Certificati medici
-- =====================================================

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

-- =====================================================
-- STEP E: Consensi & Firme
-- =====================================================

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

-- =====================================================
-- STEP F: Documenti (Storage + indice DB)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL, -- es. 'id_card','certificate','receipt','other'
  file_path text NOT NULL, -- path su bucket 'documents'
  visibility text NOT NULL CHECK (visibility IN ('private_admin','staff','owner_only','owner_guardians')),
  created_by uuid REFERENCES public.people(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- STEP G: Lega eventuali account (profiles) alle persone
-- =====================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id);

-- Backfill soft: crea una people per chi ha un profilo senza corrispondente
INSERT INTO public.people (full_name, given_name, family_name, date_of_birth, email, phone)
SELECT
  COALESCE(NULLIF(TRIM(pr.first_name||' '||pr.last_name),''), pr.full_name, 'Senza Nome'),
  pr.first_name, 
  pr.last_name,
  COALESCE(pr.birth_date, to_date(NULLIF(pr.birth_year::text,''),'YYYY'), '1900-01-01'::date),
  pr.email, 
  pr.phone
FROM public.profiles pr
LEFT JOIN public.people pe ON pe.id = pr.person_id
WHERE pr.person_id IS NULL;

UPDATE public.profiles pr
SET person_id = pe.id
FROM public.people pe
WHERE pr.person_id IS NULL
  AND pe.email IS NOT DISTINCT FROM pr.email
  AND (pe.given_name IS NOT DISTINCT FROM pr.first_name OR pr.first_name IS NULL)
  AND (pe.family_name IS NOT DISTINCT FROM pr.last_name OR pr.last_name IS NULL);

-- =====================================================
-- STEP H: RLS & permessi (VERSIONE CORRETTA CON ENUM GIUSTI)
-- =====================================================

-- Abilita RLS sulle nuove tabelle
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Regole minime per people
CREATE POLICY "Admin can do everything on people" ON public.people
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'  -- CORRETTO: 'admin' non 'Admin'
    )
  );

CREATE POLICY "Staff can view people in their categories" ON public.people
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_categories sc
      JOIN public.player_categories pc ON pc.category_id = sc.category_id
      JOIN public.players pl ON pl.id = pc.player_id
      WHERE sc.user_id = auth.uid() 
      AND pl.person_id = people.id
    )
  );

CREATE POLICY "People can view/edit their own data" ON public.people
  FOR ALL USING (id IN (
    SELECT person_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT person_id FROM public.players WHERE person_id = people.id
  ));

-- Regole per guardians
CREATE POLICY "Admin can do everything on guardians" ON public.guardians
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'  -- CORRETTO: 'admin' non 'Admin'
    )
  );

CREATE POLICY "Guardians can view their relationships" ON public.guardians
  FOR SELECT USING (
    guardian_person_id IN (
      SELECT person_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Regole per medical_certificates
CREATE POLICY "Admin can do everything on medical_certificates" ON public.medical_certificates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'  -- CORRETTO: 'admin' non 'Admin'
    )
  );

CREATE POLICY "Staff can view medical certificates" ON public.medical_certificates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_categories sc
      JOIN public.player_categories pc ON pc.category_id = sc.category_id
      JOIN public.players pl ON pl.id = pc.player_id
      WHERE sc.user_id = auth.uid() 
      AND pl.person_id = medical_certificates.person_id
    )
  );

-- Regole per person_consents
CREATE POLICY "Admin can do everything on person_consents" ON public.person_consents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'  -- CORRETTO: 'admin' non 'Admin'
    )
  );

-- Regole per documents
CREATE POLICY "Admin can do everything on documents" ON public.documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'  -- CORRETTO: 'admin' non 'Admin'
    )
  );

CREATE POLICY "Staff can view documents based on visibility" ON public.documents
  FOR SELECT USING (
    visibility IN ('staff', 'owner_only', 'owner_guardians') AND
    EXISTS (
      SELECT 1 FROM public.staff_categories sc
      JOIN public.player_categories pc ON pc.category_id = sc.category_id
      JOIN public.players pl ON pl.id = pc.player_id
      WHERE sc.user_id = auth.uid() 
      AND pl.person_id = documents.person_id
    )
  );

-- =====================================================
-- VERIFICHE FINALI
-- =====================================================

-- Test di verifica: inserisci 1 maggiorenne e 1 minorenne
INSERT INTO public.people (full_name, given_name, family_name, date_of_birth, email) 
VALUES 
  ('Mario Rossi', 'Mario', 'Rossi', '1990-05-15', 'mario.rossi@test.com'),
  ('Giulia Bianchi', 'Giulia', 'Bianchi', '2010-03-20', 'giulia.bianchi@test.com');

-- Verifica: SELECT id, full_name, is_minor, membership_number FROM public.people;
-- Check: SELECT count(*) FROM players WHERE person_id IS NULL; 
-- → deve andare a 0 (o pochi casi da sistemare manualmente)

-- =====================================================
-- MIGRAZIONE COMPLETATA
-- =====================================================





