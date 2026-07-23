-- =============================================================================
-- 026_role_permission_baseline.sql
-- =============================================================================
-- Ricostruisce i permessi demo dei ruoli non amministrativi da un'unica
-- matrice nel database. I nomi legacy restano per compatibilita con le due app
-- fino alla successiva migrazione di unificazione dei nomi.
-- Non modifica persone, profili, codici di accesso o dati operativi.
-- =============================================================================

BEGIN;

-- I ruoli Admin non vengono toccati: possiedono gia il catalogo completo,
-- inclusa la contabilita. Per gli altri ruoli demo sostituiamo i vecchi
-- frammenti con una configurazione coerente.
DELETE FROM public.role_permissions rp
USING public.user_roles ur
WHERE rp.role_id = ur.id
  AND ur.name IN (
    'Dirigente', 'Segreteria', 'Direttore Sportivo', 'Direttore Tecnico',
    'Allenatore', 'Team Manager', 'Accompagnatore',
    'Giocatore', 'Player', 'Preparatore', 'Preparatore Atletico',
    'Medico', 'Fisio', 'Famiglia', 'Familiare', 'Tutor'
  );

WITH defaults_by_role(role_name, permission_name) AS (
  VALUES
    -- Direzione e segreteria
    ('Dirigente', 'players.view'), ('Dirigente', 'players.create'), ('Dirigente', 'players.edit'), ('Dirigente', 'players.delete'), ('Dirigente', 'players.export'),
    ('Dirigente', 'events.view'), ('Dirigente', 'events.create'), ('Dirigente', 'events.edit'), ('Dirigente', 'events.delete'),
    ('Dirigente', 'sessions.view'), ('Dirigente', 'sessions.create'), ('Dirigente', 'sessions.edit'), ('Dirigente', 'sessions.delete'), ('Dirigente', 'sessions.start'), ('Dirigente', 'sessions.stop'),
    ('Dirigente', 'attendance.view'), ('Dirigente', 'attendance.mark'), ('Dirigente', 'attendance.edit'), ('Dirigente', 'attendance.export'),
    ('Dirigente', 'staff.view'), ('Dirigente', 'categories.view'), ('Dirigente', 'categories.create'), ('Dirigente', 'categories.edit'), ('Dirigente', 'categories.delete'),
    ('Dirigente', 'settings.view'), ('Dirigente', 'settings.edit'), ('Dirigente', 'settings.brand'), ('Dirigente', 'users.view'),
    ('Dirigente', 'council.manage'), ('Dirigente', 'brand.manage'), ('Dirigente', 'documents.view'), ('Dirigente', 'documents.manage'), ('Dirigente', 'fees.view'), ('Dirigente', 'fees.manage'),

    ('Segreteria', 'players.view'), ('Segreteria', 'players.create'), ('Segreteria', 'players.edit'), ('Segreteria', 'players.export'),
    ('Segreteria', 'staff.view'), ('Segreteria', 'categories.view'), ('Segreteria', 'events.view'), ('Segreteria', 'sessions.view'),
    ('Segreteria', 'attendance.view'), ('Segreteria', 'attendance.export'), ('Segreteria', 'settings.view'), ('Segreteria', 'users.view'),
    ('Segreteria', 'documents.view'), ('Segreteria', 'documents.manage'), ('Segreteria', 'fees.view'), ('Segreteria', 'fees.manage'),

    -- Direzione sportiva e tecnica
    ('Direttore Sportivo', 'players.view'), ('Direttore Sportivo', 'players.create'), ('Direttore Sportivo', 'players.edit'), ('Direttore Sportivo', 'players.delete'),
    ('Direttore Sportivo', 'events.view'), ('Direttore Sportivo', 'events.create'), ('Direttore Sportivo', 'events.edit'), ('Direttore Sportivo', 'events.delete'),
    ('Direttore Sportivo', 'sessions.view'), ('Direttore Sportivo', 'sessions.create'), ('Direttore Sportivo', 'sessions.edit'), ('Direttore Sportivo', 'sessions.delete'),
    ('Direttore Sportivo', 'attendance.view'), ('Direttore Sportivo', 'attendance.mark'), ('Direttore Sportivo', 'attendance.edit'),
    ('Direttore Sportivo', 'categories.view'), ('Direttore Sportivo', 'categories.create'), ('Direttore Sportivo', 'categories.edit'),

    ('Direttore Tecnico', 'players.view'), ('Direttore Tecnico', 'players.create'), ('Direttore Tecnico', 'players.edit'),
    ('Direttore Tecnico', 'events.view'), ('Direttore Tecnico', 'events.create'), ('Direttore Tecnico', 'events.edit'),
    ('Direttore Tecnico', 'sessions.view'), ('Direttore Tecnico', 'sessions.create'), ('Direttore Tecnico', 'sessions.edit'),
    ('Direttore Tecnico', 'attendance.view'), ('Direttore Tecnico', 'attendance.mark'), ('Direttore Tecnico', 'attendance.edit'), ('Direttore Tecnico', 'categories.view'),

    -- Operativita di squadra
    ('Allenatore', 'players.view'), ('Allenatore', 'players.edit'), ('Allenatore', 'events.view'), ('Allenatore', 'events.create'), ('Allenatore', 'events.edit'),
    ('Allenatore', 'sessions.view'), ('Allenatore', 'sessions.create'), ('Allenatore', 'sessions.edit'), ('Allenatore', 'sessions.start'), ('Allenatore', 'sessions.stop'),
    ('Allenatore', 'attendance.view'), ('Allenatore', 'attendance.mark'), ('Allenatore', 'attendance.edit'), ('Allenatore', 'categories.view'),

    ('Team Manager', 'players.view'), ('Team Manager', 'players.edit'), ('Team Manager', 'events.view'), ('Team Manager', 'events.create'), ('Team Manager', 'events.edit'),
    ('Team Manager', 'attendance.view'), ('Team Manager', 'attendance.mark'), ('Team Manager', 'categories.view'), ('Team Manager', 'documents.view'), ('Team Manager', 'fees.view'),

    ('Accompagnatore', 'players.view'), ('Accompagnatore', 'events.view'), ('Accompagnatore', 'sessions.view'),
    ('Accompagnatore', 'attendance.view'), ('Accompagnatore', 'attendance.mark'), ('Accompagnatore', 'categories.view'),

    -- Area sanitaria
    ('Medico', 'players.view'), ('Medico', 'players.edit'), ('Medico', 'attendance.view'), ('Medico', 'categories.view'),
    ('Medico', 'health.view'), ('Medico', 'health.manage'), ('Medico', 'documents.view'), ('Medico', 'documents.manage'),
    ('Fisio', 'players.view'), ('Fisio', 'players.edit'), ('Fisio', 'attendance.view'), ('Fisio', 'categories.view'),
    ('Fisio', 'health.view'), ('Fisio', 'health.manage'), ('Fisio', 'documents.view'),

    -- Ruoli personali e familiari. RLS applichera poi il perimetro personale.
    ('Giocatore', 'players.view'), ('Giocatore', 'events.view'), ('Giocatore', 'sessions.view'), ('Giocatore', 'attendance.view'), ('Giocatore', 'categories.view'), ('Giocatore', 'documents.view'), ('Giocatore', 'fees.view'),
    ('Player', 'players.view'), ('Player', 'events.view'), ('Player', 'sessions.view'), ('Player', 'attendance.view'), ('Player', 'categories.view'), ('Player', 'documents.view'), ('Player', 'fees.view'),
    ('Preparatore', 'players.view'), ('Preparatore', 'players.edit'), ('Preparatore', 'events.view'), ('Preparatore', 'sessions.view'), ('Preparatore', 'attendance.view'), ('Preparatore', 'categories.view'), ('Preparatore', 'health.view'),
    ('Preparatore Atletico', 'players.view'), ('Preparatore Atletico', 'players.edit'), ('Preparatore Atletico', 'events.view'), ('Preparatore Atletico', 'sessions.view'), ('Preparatore Atletico', 'attendance.view'), ('Preparatore Atletico', 'categories.view'), ('Preparatore Atletico', 'health.view'),
    ('Famiglia', 'players.view'), ('Famiglia', 'events.view'), ('Famiglia', 'sessions.view'), ('Famiglia', 'attendance.view'), ('Famiglia', 'documents.view'), ('Famiglia', 'fees.view'),
    ('Familiare', 'players.view'), ('Familiare', 'events.view'), ('Familiare', 'sessions.view'), ('Familiare', 'attendance.view'), ('Familiare', 'documents.view'), ('Familiare', 'fees.view'),
    ('Tutor', 'players.view'), ('Tutor', 'events.view'), ('Tutor', 'sessions.view'), ('Tutor', 'attendance.view'), ('Tutor', 'documents.view'), ('Tutor', 'fees.view')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM defaults_by_role d
JOIN public.user_roles ur ON ur.name = d.role_name
JOIN public.permissions p ON p.name = d.permission_name
ON CONFLICT DO NOTHING;

COMMIT;
