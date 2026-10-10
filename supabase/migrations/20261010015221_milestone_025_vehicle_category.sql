-- Extend only the existing category allowlist. Preserve the inspected owner guard,
-- audit insert, private/unverified defaults, signature, privileges and search path.
do $migration$
declare
  v_before text;
  v_after text;
  v_old constant text := '(''vessel'',''property'',''digital_asset'',''business'',''equipment'',''other'',''artwork'',''subscription'')';
  v_new constant text := '(''vessel'',''property'',''digital_asset'',''business'',''equipment'',''vehicle'',''other'',''artwork'',''subscription'')';
  v_acl aclitem[];
  v_owner oid;
  v_config text[];
  v_security_definer boolean;
begin
  select pg_get_functiondef(oid), proacl, proowner, proconfig, prosecdef
    into v_before, v_acl, v_owner, v_config, v_security_definer
    from pg_proc where oid = 'public.create_inventory_asset(text,text,text)'::regprocedure;
  if md5(v_before) <> '08ae6db7775420e738518c85d2629973' then
    raise exception 'Inventory creation baseline changed; inspect before adding vehicle category';
  end if;
  if length(v_before) - length(replace(v_before, v_old, '')) <> length(v_old) then
    raise exception 'Expected a single category allowlist';
  end if;
  execute replace(v_before, v_old, v_new);
  v_after := pg_get_functiondef('public.create_inventory_asset(text,text,text)'::regprocedure);
  if replace(v_after, v_new, v_old) <> v_before then
    raise exception 'Unexpected change beyond vehicle category';
  end if;
  if exists(select 1 from pg_proc where oid = 'public.create_inventory_asset(text,text,text)'::regprocedure
    and (proacl is distinct from v_acl or proowner is distinct from v_owner or proconfig is distinct from v_config or prosecdef is distinct from v_security_definer or not prosecdef)) then
    raise exception 'Inventory creation security attributes changed';
  end if;
end $migration$;
