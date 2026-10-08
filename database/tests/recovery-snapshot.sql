-- Read-only source/isolated-target snapshot. This is not a restore script.
-- Output contains private counts and content fingerprints: never commit it.
-- Compare snapshots only for the same recovery point; later writes may differ.
-- Missing required tables cause an error: stop instead of claiming recovery.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TIME ZONE 'UTC';

WITH expected(name) AS (
  VALUES ('entities'), ('relationships'), ('obligations'), ('documents'),
         ('document_links'), ('events'), ('entity_change_history'),
         ('obligation_change_history')
), tables AS (
  SELECT e.name, c.oid,
    jsonb_build_object(
      'name', e.name, 'exists', c.oid IS NOT NULL,
      'rls', c.relrowsecurity,
      'authenticated_select', CASE WHEN c.oid IS NOT NULL
        THEN has_table_privilege('authenticated', c.oid, 'SELECT') END,
      'authenticated_write', CASE WHEN c.oid IS NOT NULL
        THEN has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE') END,
      'anon_select', CASE WHEN c.oid IS NOT NULL
        THEN has_table_privilege('anon', c.oid, 'SELECT') END,
      'columns', (SELECT jsonb_agg(jsonb_build_object(
        'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
        'not_null', a.attnotnull,
        'default', pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
        FROM pg_attribute a LEFT JOIN pg_attrdef d
        ON d.adrelid=a.attrelid AND d.adnum=a.attnum
        WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)
    ) AS metadata
  FROM expected e LEFT JOIN pg_class c
    ON c.oid=to_regclass(format('public.%I',e.name))
), checks AS (
  SELECT count(oid)=8 AS all_tables_present,
    bool_and(coalesce((metadata->>'rls')::boolean,false)) AS all_rls_enabled,
    bool_and(coalesce((metadata->>'authenticated_select')::boolean,false))
      AS authenticated_select_enabled,
    bool_and(oid IS NOT NULL AND NOT coalesce(
      (metadata->>'authenticated_write')::boolean,true)) AS no_direct_writes,
    bool_and(oid IS NOT NULL AND NOT coalesce(
      (metadata->>'anon_select')::boolean,true)) AS no_anonymous_reads
  FROM tables
), contents AS (
  SELECT 'entities' AS name, count(*) AS row_count,
    md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) AS content_hash
    FROM public.entities t
  UNION ALL SELECT 'relationships',count(*),
    md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM public.relationships t
  UNION ALL SELECT 'obligations',count(*),
    md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM public.obligations t
  UNION ALL SELECT 'documents',count(*),
    md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM public.documents t
  UNION ALL SELECT 'document_links',count(*),
    md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM public.document_links t
  UNION ALL SELECT 'events',count(*),
    md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM public.events t
  UNION ALL SELECT 'entity_change_history',count(*),
    md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM public.entity_change_history t
  UNION ALL SELECT 'obligation_change_history',count(*),
    md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM public.obligation_change_history t
)
SELECT jsonb_build_object(
  'checked_at', transaction_timestamp(),
  'readiness', (SELECT to_jsonb(checks) FROM checks),
  'tables', (SELECT jsonb_agg(metadata ORDER BY name) FROM tables),
  'contents', (SELECT jsonb_agg(to_jsonb(contents) ORDER BY name) FROM contents),
  'policies', (SELECT jsonb_agg(jsonb_build_object(
    'table', tablename, 'name', policyname, 'roles', roles, 'command', cmd,
    'expression_hash', md5(coalesce(qual,'')||coalesce(with_check,'')))
    ORDER BY tablename,policyname)
    FROM pg_policies WHERE schemaname='public'
    AND tablename IN (SELECT name FROM expected)),
  'functions', (SELECT jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', p.proname,
    'arguments', pg_get_function_identity_arguments(p.oid),
    'definer', p.prosecdef, 'definition_hash', md5(pg_get_functiondef(p.oid)),
    'authenticated_execute', has_function_privilege('authenticated',p.oid,'EXECUTE'),
    'anon_execute', has_function_privilege('anon',p.oid,'EXECUTE'))
    ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','private') AND p.prokind='f'),
  'constraints', (SELECT jsonb_agg(jsonb_build_object(
    'table',c.relname,'name',k.conname,
    'definition_hash',md5(pg_get_constraintdef(k.oid))) ORDER BY c.relname,k.conname)
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN (SELECT name FROM expected)),
  'auth_user_count', (SELECT count(*) FROM auth.users),
  'storage_bucket_count', (SELECT count(*) FROM storage.buckets),
  'storage_object_count', (SELECT count(*) FROM storage.objects)
) AS recovery_snapshot;

COMMIT;
