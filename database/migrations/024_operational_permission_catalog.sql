-- =============================================================================
-- 024_operational_permission_catalog.sql
-- =============================================================================
-- Catalogo unico dei permessi operativi TeamFlow.
-- Non attiva o modifica policy RLS: prepara il database a ricevere policy
-- coerenti, senza cambiare l'accesso corrente alle schermate operative.
-- =============================================================================

BEGIN;

INSERT INTO public.permissions (name, description, category, position_order)
VALUES
  ('players.view', 'Visualizzare anagrafiche giocatori.', 'players', 10),
  ('players.create', 'Creare anagrafiche giocatori.', 'players', 20),
  ('players.edit', 'Modificare anagrafiche giocatori.', 'players', 30),
  ('players.delete', 'Eliminare anagrafiche giocatori.', 'players', 40),
  ('players.export', 'Esportare dati giocatori.', 'players', 50),
  ('events.view', 'Visualizzare eventi e partite.', 'events', 110),
  ('events.create', 'Creare eventi e partite.', 'events', 120),
  ('events.edit', 'Modificare eventi e partite.', 'events', 130),
  ('events.delete', 'Eliminare eventi e partite.', 'events', 140),
  ('sessions.view', 'Visualizzare allenamenti e sessioni.', 'sessions', 210),
  ('sessions.create', 'Creare allenamenti e sessioni.', 'sessions', 220),
  ('sessions.edit', 'Modificare allenamenti e sessioni.', 'sessions', 230),
  ('sessions.delete', 'Eliminare allenamenti e sessioni.', 'sessions', 240),
  ('sessions.start', 'Avviare una sessione.', 'sessions', 250),
  ('sessions.stop', 'Chiudere una sessione.', 'sessions', 260),
  ('attendance.view', 'Visualizzare le presenze.', 'attendance', 310),
  ('attendance.mark', 'Segnare le presenze.', 'attendance', 320),
  ('attendance.edit', 'Modificare le presenze.', 'attendance', 330),
  ('attendance.export', 'Esportare le presenze.', 'attendance', 340),
  ('staff.view', 'Visualizzare lo staff.', 'staff', 410),
  ('staff.create', 'Creare anagrafiche staff.', 'staff', 420),
  ('staff.edit', 'Modificare anagrafiche staff.', 'staff', 430),
  ('staff.delete', 'Eliminare anagrafiche staff.', 'staff', 440),
  ('categories.view', 'Visualizzare le categorie.', 'categories', 510),
  ('categories.create', 'Creare categorie.', 'categories', 520),
  ('categories.edit', 'Modificare categorie.', 'categories', 530),
  ('categories.delete', 'Eliminare categorie.', 'categories', 540),
  ('settings.view', 'Visualizzare impostazioni.', 'settings', 610),
  ('settings.edit', 'Modificare impostazioni.', 'settings', 620),
  ('settings.brand', 'Gestire identita e brand.', 'settings', 630),
  ('users.view', 'Visualizzare gli accessi.', 'users', 710),
  ('users.create', 'Creare accessi.', 'users', 720),
  ('users.edit', 'Modificare accessi.', 'users', 730),
  ('users.delete', 'Revocare accessi.', 'users', 740),
  ('council.manage', 'Gestire consigli.', 'council', 810),
  ('brand.manage', 'Gestire il brand.', 'brand', 820),
  ('documents.view', 'Visualizzare documenti autorizzati.', 'documents', 830),
  ('documents.manage', 'Caricare, aggiornare o eliminare documenti autorizzati.', 'documents', 840),
  ('health.view', 'Visualizzare informazioni sanitarie autorizzate.', 'health', 850),
  ('health.manage', 'Gestire informazioni sanitarie autorizzate.', 'health', 860),
  ('fees.view', 'Visualizzare quote e pagamenti autorizzati.', 'fees', 870),
  ('fees.manage', 'Gestire quote e pagamenti autorizzati.', 'fees', 880)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    category = EXCLUDED.category,
    position_order = EXCLUDED.position_order;

-- Admin conserva l'accesso completo; le assegnazioni già presenti sugli altri
-- ruoli non vengono né alterate né cancellate.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur
JOIN public.permissions p ON p.name IN (
  'players.view', 'players.create', 'players.edit', 'players.delete', 'players.export',
  'events.view', 'events.create', 'events.edit', 'events.delete',
  'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.delete', 'sessions.start', 'sessions.stop',
  'attendance.view', 'attendance.mark', 'attendance.edit', 'attendance.export',
  'staff.view', 'staff.create', 'staff.edit', 'staff.delete',
  'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
  'settings.view', 'settings.edit', 'settings.brand',
  'users.view', 'users.create', 'users.edit', 'users.delete', 'users.manage_permissions',
  'council.manage', 'brand.manage',
  'documents.view', 'documents.manage', 'health.view', 'health.manage',
  'fees.view', 'fees.manage'
)
WHERE ur.name ILIKE 'Admin'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
