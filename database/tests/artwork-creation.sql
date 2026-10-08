-- Administrative connection only. Simulated role/JWT checks; all fixtures roll back.
begin;
do $setup$
declare v_owner text;
begin
  v_owner := substring(pg_get_functiondef('public.create_inventory_asset(text,text,text)'::regprocedure)
    from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
  if v_owner is null then raise exception 'Owner guard requires inspection'; end if;
  perform set_config('kaikoa.test_owner', v_owner, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
end $setup$;
set local role authenticated;
do $nonowner$
begin
  begin
    perform public.create_inventory_asset('Artwork verification fixture', 'artwork', '');
    raise exception 'Non-owner unexpectedly created artwork';
  exception when others then
    if sqlerrm <> 'Not authorized' then raise; end if;
  end;
end $nonowner$;
reset role;
do $owner_claim$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('kaikoa.test_owner'), 'role', 'authenticated')::text, true);
end $owner_claim$;
set local role authenticated;
do $owner$
declare v_id uuid; v_title text := 'Artwork verification fixture ' || gen_random_uuid();
begin
  v_id := public.create_inventory_asset('  ' || v_title || '  ', 'artwork', '  Verification description  ');
  if not exists(select 1 from public.entities where id = v_id and name = v_title
    and entity_type = 'asset' and subtype = 'artwork' and status = 'REVIEW REQUIRED'
    and description = 'Verification description' and data_quality = 'unverified'
    and visibility = 'private' and metadata->>'source_state' = 'OWNER_ENTERED_UNVERIFIED') then
    raise exception 'Artwork defaults or trimming failed';
  end if;
  if (select count(*) from public.entity_change_history where entity_id = v_id
    and changed_by = auth.uid() and field_name = 'created' and previous_value is null and new_value = v_title) <> 1 then
    raise exception 'Artwork creation audit failed';
  end if;
  begin
    perform public.create_inventory_asset(v_title, 'artwork', '');
    raise exception 'Duplicate artwork unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'An asset with this name already exists' then raise; end if;
  end;
  begin
    perform public.create_inventory_asset('Artwork invalid category', 'artwork_edition', '');
    raise exception 'Unsupported artwork subtype unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'Unsupported category' then raise; end if;
  end;
  begin
    perform public.create_inventory_asset(' ', 'artwork', '');
    raise exception 'Blank artwork title unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'Name must be 2 to 120 characters' then raise; end if;
  end;
end $owner$;
reset role;
do $anon_claim$ begin perform set_config('request.jwt.claims', '{"role":"anon"}', true); end $anon_claim$;
set local role anon;
do $anon$
begin
  if has_function_privilege('anon', 'public.create_inventory_asset(text,text,text)', 'EXECUTE') then
    raise exception 'Anonymous RPC execution granted';
  end if;
  begin
    perform public.create_inventory_asset('Anonymous artwork fixture', 'artwork', '');
    raise exception 'Anonymous artwork unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $anon$;
rollback;
select 'Artwork creation, audit, duplicate/validation and simulated owner/non-owner/anonymous assertions passed; fixtures rolled back.' as result;
