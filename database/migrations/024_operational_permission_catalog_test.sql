-- Verifica 024: il catalogo operativo esiste e l'Admin lo riceve per intero.
WITH expected(name) AS (
  VALUES
    ('players.view'), ('players.create'), ('players.edit'), ('players.delete'), ('players.export'),
    ('events.view'), ('events.create'), ('events.edit'), ('events.delete'),
    ('sessions.view'), ('sessions.create'), ('sessions.edit'), ('sessions.delete'), ('sessions.start'), ('sessions.stop'),
    ('attendance.view'), ('attendance.mark'), ('attendance.edit'), ('attendance.export'),
    ('staff.view'), ('staff.create'), ('staff.edit'), ('staff.delete'),
    ('categories.view'), ('categories.create'), ('categories.edit'), ('categories.delete'),
    ('settings.view'), ('settings.edit'), ('settings.brand'),
    ('users.view'), ('users.create'), ('users.edit'), ('users.delete'), ('users.manage_permissions'),
    ('council.manage'), ('brand.manage'),
    ('documents.view'), ('documents.manage'), ('health.view'), ('health.manage'),
    ('fees.view'), ('fees.manage')
), checks AS (
  SELECT
    (SELECT count(*) FROM expected) =
    (SELECT count(*) FROM public.permissions p JOIN expected e ON e.name = p.name) AS catalog_complete,
    NOT EXISTS (
      SELECT 1
      FROM expected e
      LEFT JOIN public.permissions p ON p.name = e.name
      LEFT JOIN public.user_roles ur ON ur.name ILIKE 'Admin'
      LEFT JOIN public.role_permissions rp ON rp.role_id = ur.id AND rp.permission_id = p.id
      WHERE p.id IS NULL OR ur.id IS NULL OR rp.permission_id IS NULL
    ) AS admin_has_all_permissions
)
SELECT 'T1_operational_permission_catalog' AS check_id, catalog_complete, admin_has_all_permissions
FROM checks;
