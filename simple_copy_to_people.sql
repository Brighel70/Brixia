-- ========================================
-- COPIA SEMPLICE DATI DA PEOPLE3 A PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Prima controlla la struttura della tabella people
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Svuota la tabella people
TRUNCATE TABLE public.people;

-- 3. Copia solo i campi che esistono in entrambe le tabelle
INSERT INTO public.people (
  id,
  full_name,
  given_name,
  family_name,
  "date_of_birth (YYYY-MM-DD)",
  "is_minor (TRUE/FALSE)",
  "gender (M/F/X)",
  fiscal_code,
  email,
  phone,
  address_street,
  address_city,
  address_zip,
  address_region,
  address_country,
  nationality,
  emergency_contact_name,
  emergency_contact_phone,
  medical_notes,
  "membership_number (leave blank if auto)",
  "status (active/inactive/pending)",
  "is_player (TRUE/FALSE)",
  "is_staff (TRUE/FALSE)",
  "injured (TRUE/FALSE)",
  "player_categories (comma-separated CATEGORY CODEs)",
  "player_positions (comma-separated position names)",
  "staff_roles (comma-separated)",
  "staff_categories (comma-separated CATEGORY CODEs)",
  fir_code,
  "birth_year (YYYY)",
  guardian1_full_name,
  guardian1_relationship,
  guardian1_email,
  guardian1_phone,
  "guardian1_can_view (TRUE/FALSE)",
  "guardian1_can_edit (TRUE/FALSE)",
  "guardian1_is_primary (TRUE/FALSE)",
  guardian2_full_name,
  guardian2_relationship,
  guardian2_email,
  guardian2_phone,
  "guardian2_can_view (TRUE/FALSE)",
  "guardian2_can_edit (TRUE/FALSE)",
  "guardian2_is_primary (TRUE/FALSE)",
  "medical_certificate_kind (non_agonistico/agonistico)",
  "medical_certificate_issued_on (YYYY-MM-DD)",
  "medical_certificate_expires_on (YYYY-MM-DD)",
  medical_certificate_provider,
  "initial_note (optional)"
)
SELECT 
  id,
  full_name,
  given_name,
  family_name,
  date_of_birth::text,
  CASE WHEN is_minor THEN 'TRUE' ELSE 'FALSE' END,
  gender,
  fiscal_code,
  email,
  phone,
  address_street,
  address_city,
  address_zip::bigint,
  address_region,
  address_country,
  nationality,
  emergency_contact_name,
  emergency_contact_phone,
  medical_notes,
  membership_number,
  status,
  CASE WHEN is_player THEN 'TRUE' ELSE 'FALSE' END,
  CASE WHEN is_staff THEN 'TRUE' ELSE 'FALSE' END,
  CASE WHEN injured THEN 'TRUE' ELSE 'FALSE' END,
  CASE 
    WHEN player_categories IS NOT NULL THEN array_to_string(player_categories::text[], ',')
    ELSE NULL 
  END,
  CASE 
    WHEN player_positions IS NOT NULL THEN array_to_string(player_positions::text[], ',')
    ELSE NULL 
  END,
  CASE 
    WHEN staff_roles IS NOT NULL THEN array_to_string(staff_roles::text[], ',')
    ELSE NULL 
  END,
  CASE 
    WHEN staff_categories IS NOT NULL THEN array_to_string(staff_categories::text[], ',')
    ELSE NULL 
  END,
  fir_code,
  birth_year,
  NULL, -- guardian1_full_name
  NULL, -- guardian1_relationship
  NULL, -- guardian1_email
  NULL, -- guardian1_phone
  false, -- guardian1_can_view
  'FALSE', -- guardian1_can_edit
  false, -- guardian1_is_primary
  NULL, -- guardian2_full_name
  NULL, -- guardian2_relationship
  NULL, -- guardian2_email
  NULL, -- guardian2_phone
  'FALSE', -- guardian2_can_view
  'FALSE', -- guardian2_can_edit
  'FALSE', -- guardian2_is_primary
  NULL, -- medical_certificate_kind
  NULL, -- medical_certificate_issued_on
  NULL, -- medical_certificate_expires_on
  NULL, -- medical_certificate_provider
  NULL  -- initial_note
FROM public.people3;

-- 4. Verifica che i dati siano stati copiati
SELECT COUNT(*) as total_records FROM public.people;

-- 5. Mostra alcuni esempi di dati copiati
SELECT 
  id,
  full_name,
  "date_of_birth (YYYY-MM-DD)",
  "is_minor (TRUE/FALSE)",
  "gender (M/F/X)",
  email,
  phone
FROM public.people 
LIMIT 5;
