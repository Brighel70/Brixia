-- ========================================
-- COPIA DATI DA PEOPLE3 A PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Prima svuota la tabella people (se contiene dati)
TRUNCATE TABLE public.people;

-- 2. Copia tutti i dati da people3 a people
INSERT INTO public.people (
  id,
  full_name,
  given_name,
  family_name,
  date_of_birth,
  is_minor,
  gender,
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
  membership_number,
  status,
  is_player,
  is_staff,
  injured,
  player_categories,
  player_positions,
  staff_roles,
  staff_categories,
  fir_code,
  birth_year,
  guardian1_full_name,
  guardian1_relationship,
  guardian1_email,
  guardian1_phone,
  guardian1_can_view,
  guardian1_can_edit,
  guardian1_is_primary,
  guardian2_full_name,
  guardian2_relationship,
  guardian2_email,
  guardian2_phone,
  guardian2_can_view,
  guardian2_can_edit,
  guardian2_is_primary,
  medical_certificate_kind,
  medical_certificate_issued_on,
  medical_certificate_expires_on,
  medical_certificate_provider,
  initial_note
)
SELECT 
  id,
  full_name,
  given_name,
  family_name,
  date_of_birth::text as "date_of_birth (YYYY-MM-DD)",
  CASE WHEN is_minor THEN 'TRUE' ELSE 'FALSE' END as "is_minor (TRUE/FALSE)",
  gender as "gender (M/F/X)",
  fiscal_code,
  email,
  phone,
  address_street,
  address_city,
  address_zip::bigint as address_zip,
  address_region,
  address_country,
  nationality,
  emergency_contact_name,
  emergency_contact_phone,
  medical_notes,
  membership_number as "membership_number (leave blank if auto)",
  status as "status (active/inactive/pending)",
  is_player as "is_player (TRUE/FALSE)",
  CASE WHEN is_staff THEN 'TRUE' ELSE 'FALSE' END as "is_staff (TRUE/FALSE)",
  CASE WHEN injured THEN 'TRUE' ELSE 'FALSE' END as "injured (TRUE/FALSE)",
  CASE 
    WHEN player_categories IS NOT NULL THEN array_to_string(player_categories::text[], ',')
    ELSE NULL 
  END as "player_categories (comma-separated CATEGORY CODEs)",
  CASE 
    WHEN player_positions IS NOT NULL THEN array_to_string(player_positions::text[], ',')
    ELSE NULL 
  END as "player_positions (comma-separated position names)",
  CASE 
    WHEN staff_roles IS NOT NULL THEN array_to_string(staff_roles::text[], ',')
    ELSE NULL 
  END as "staff_roles (comma-separated)",
  CASE 
    WHEN staff_categories IS NOT NULL THEN array_to_string(staff_categories::text[], ',')
    ELSE NULL 
  END as "staff_categories (comma-separated CATEGORY CODEs)",
  fir_code,
  birth_year as "birth_year (YYYY)",
  NULL as guardian1_full_name,
  NULL as guardian1_relationship,
  NULL as guardian1_email,
  NULL as guardian1_phone,
  false as "guardian1_can_view (TRUE/FALSE)",
  'FALSE' as "guardian1_can_edit (TRUE/FALSE)",
  false as "guardian1_is_primary (TRUE/FALSE)",
  NULL as guardian2_full_name,
  NULL as guardian2_relationship,
  NULL as guardian2_email,
  NULL as guardian2_phone,
  'FALSE' as "guardian2_can_view (TRUE/FALSE)",
  'FALSE' as "guardian2_can_edit (TRUE/FALSE)",
  'FALSE' as "guardian2_is_primary (TRUE/FALSE)",
  NULL as "medical_certificate_kind (non_agonistico/agonistico)",
  NULL as "medical_certificate_issued_on (YYYY-MM-DD)",
  NULL as "medical_certificate_expires_on (YYYY-MM-DD)",
  NULL as medical_certificate_provider,
  NULL as "initial_note (optional)"
FROM public.people3;

-- 3. Verifica che i dati siano stati copiati
SELECT COUNT(*) as total_records FROM public.people;

-- 4. Mostra alcuni esempi di dati copiati
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
