-- ========================================
-- COMPLETAMENTO PERMESSI PER TUTTI I RUOLI
-- ========================================

-- 1. DIRETTORE SPORTIVO: gestione sportiva completa
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Direttore Sportivo'
AND p.name IN (
  'players.view', 'players.create', 'players.edit', 'players.delete',
  'events.view', 'events.create', 'events.edit',
  'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.delete',
  'attendance.view', 'attendance.mark', 'attendance.edit',
  'categories.view', 'categories.create', 'categories.edit'
);

-- 2. DIRETTORE TECNICO: gestione tecnica
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Direttore Tecnico'
AND p.name IN (
  'players.view', 'players.create', 'players.edit',
  'events.view', 'events.create', 'events.edit',
  'sessions.view', 'sessions.create', 'sessions.edit',
  'attendance.view', 'attendance.mark', 'attendance.edit',
  'categories.view'
);

-- 3. TEAM MANAGER: gestione squadra
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Team Manager'
AND p.name IN (
  'players.view', 'players.edit',
  'events.view',
  'sessions.view',
  'attendance.view', 'attendance.mark',
  'categories.view'
);

-- 4. ACCOMPAGNATORE: supporto
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Accompagnatore'
AND p.name IN (
  'players.view',
  'events.view',
  'sessions.view',
  'attendance.view', 'attendance.mark'
);

-- 5. PREPARATORE: preparazione fisica
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Preparatore'
AND p.name IN (
  'players.view', 'players.edit',
  'events.view', 'events.create', 'events.edit',
  'sessions.view', 'sessions.create', 'sessions.edit',
  'attendance.view', 'attendance.mark', 'attendance.edit'
);

-- 6. MEDICO: informazioni sanitarie
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Medico'
AND p.name IN (
  'players.view', 'players.edit',
  'events.view',
  'sessions.view',
  'attendance.view', 'attendance.mark'
);

-- 7. FISIO: fisioterapia
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Fisio'
AND p.name IN (
  'players.view', 'players.edit',
  'events.view',
  'sessions.view',
  'attendance.view', 'attendance.mark'
);

-- 8. FAMIGLIA: accesso limitato
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Famiglia'
AND p.name IN (
  'players.view',
  'events.view',
  'sessions.view'
);

-- 9. GIOCATORE: solo i propri dati (stesso di Player)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Giocatore'
AND p.name IN (
  'players.view',
  'events.view',
  'sessions.view',
  'attendance.view',
  'categories.view'
);

-- 10. TUTOR: gestione atleti minorenni
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Tutor'
AND p.name IN (
  'players.view', 'players.edit',
  'events.view',
  'sessions.view',
  'attendance.view'
);

-- VERIFICA FINALE
SELECT 
  'VERIFICA COMPLETAMENTO' as status,
  (SELECT COUNT(*) FROM public.role_permissions) as total_role_permissions;

-- MOSTRA TUTTI I RUOLI CON I LORO PERMESSI
SELECT 
  ur.name as ruolo,
  COUNT(rp.permission_id) as permessi_totali
FROM public.user_roles ur
LEFT JOIN public.role_permissions rp ON ur.id = rp.role_id
GROUP BY ur.id, ur.name, ur.position_order
ORDER BY ur.position_order;








