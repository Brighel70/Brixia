-- =============================================================================
-- setup_storage_accounting_docs.sql
-- Bucket privato per PDF contratti/fatture Contabilità.
-- Eseguire in Supabase SQL Editor (Storage policies).
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'accounting-docs',
  'accounting-docs',
  false,
  20971520, -- 20 MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS accounting_docs_select ON storage.objects;
CREATE POLICY accounting_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'accounting-docs'
    AND (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.view')
    )
  );

DROP POLICY IF EXISTS accounting_docs_insert ON storage.objects;
CREATE POLICY accounting_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'accounting-docs'
    AND (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.create')
      OR public.has_accounting_permission('accounting.edit_draft')
      OR public.has_accounting_permission('accounting.post')
    )
  );

DROP POLICY IF EXISTS accounting_docs_update ON storage.objects;
CREATE POLICY accounting_docs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'accounting-docs'
    AND (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.create')
      OR public.has_accounting_permission('accounting.edit_draft')
      OR public.has_accounting_permission('accounting.post')
    )
  )
  WITH CHECK (
    bucket_id = 'accounting-docs'
    AND (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.create')
      OR public.has_accounting_permission('accounting.edit_draft')
      OR public.has_accounting_permission('accounting.post')
    )
  );
