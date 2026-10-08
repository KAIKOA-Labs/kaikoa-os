-- Extend only the existing category allowlist. Preserve the inspected owner guard,
-- audit insert, private/unverified defaults, signature, privileges and search path.
do $migration$
declare
  v_before text;
  v_after text;
  v_old constant text := '(''vessel'',''property'',''digital_asset'',''business'',''equipment'',''other'')';
  v_new constant text := '(''vessel'',''property'',''digital_asset'',''business'',''equipment'',''other'',''artwork'')';
  v_acl aclitem[];
  v_owner oid;
  v_config text[];
begin
  select pg_get_functiondef(oid), proacl, proowner, proconfig
    into v_before, v_acl, v_owner, v_config
    from pg_proc where oid = 'public.create_inventory_asset(text,text,text)'::regprocedure;
  if md5(v_before) <> 'f442df900719d63a38aed6204dd81461' then
    raise exception 'Inventory creation baseline changed; inspect before applying artwork category';
  end if;
  if length(v_before) - length(replace(v_before, v_old, '')) <> length(v_old) then
    raise exception 'Expected a single category allowlist';
  end if;
  execute replace(v_before, v_old, v_new);
  v_after := pg_get_functiondef('public.create_inventory_asset(text,text,text)'::regprocedure);
  if replace(v_after, v_new, v_old) <> v_before then
    raise exception 'Unexpected change beyond artwork category';
  end if;
  if exists(select 1 from pg_proc where oid = 'public.create_inventory_asset(text,text,text)'::regprocedure
    and (proacl is distinct from v_acl or proowner is distinct from v_owner or proconfig is distinct from v_config or not prosecdef)) then
    raise exception 'Inventory creation security attributes changed';
  end if;
end $migration$;
