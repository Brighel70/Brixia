-- Controllo della sola eccezione A1. Non modifica nulla.
SELECT
  id,
  email,
  full_name,
  role,
  user_role_id,
  created_at
FROM public.profiles
WHERE person_id IS NULL
ORDER BY created_at;
