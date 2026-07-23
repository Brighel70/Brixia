-- Verifica 026: tutti i ruoli operativi demo possiedono una base di permessi.
WITH expected_roles(role_name) AS (
  VALUES
    ('Admin'), ('Dirigente'), ('Segreteria'), ('Direttore Sportivo'), ('Direttore Tecnico'),
    ('Allenatore'), ('Team Manager'), ('Accompagnatore'), ('Giocatore'), ('Player'),
    ('Preparatore'), ('Preparatore Atletico'), ('Medico'), ('Fisio'),
    ('Famiglia'), ('Familiare'), ('Tutor')
), role_counts AS (
  SELECT
    e.role_name,
    ur.id AS role_id,
    count(rp.permission_id) AS permission_count
  FROM expected_roles e
  LEFT JOIN public.user_roles ur ON ur.name = e.role_name
  LEFT JOIN public.role_permissions rp ON rp.role_id = ur.id
  GROUP BY e.role_name, ur.id
)
SELECT
  'T1_role_permission_baseline' AS check_id,
  jsonb_agg(jsonb_build_object('ruolo', role_name, 'permessi', permission_count) ORDER BY role_name) AS ruolo_permessi,
  bool_and(role_id IS NOT NULL AND permission_count > 0) AS tutti_i_ruoli_pronti
FROM role_counts;
