-- Administrative connection only. Simulated role/JWT checks; all fixtures roll back.
begin;
create temp table kaikoa_entities_before as select * from public.entities;
create temp table kaikoa_history_before as select * from public.entity_change_history;
savepoint fixtures;
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
    perform public.create_inventory_asset('Subscription verification fixture', 'subscription', '');
    raise exception 'Non-owner unexpectedly created subscription';
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
declare v_id uuid; v_title text := 'Subscription verification fixture ' || gen_random_uuid();
begin
  v_id := public.create_inventory_asset('  ' || v_title || '  ', 'subscription', '  Verification description  ');
  if not exists(select 1 from public.entities where id = v_id and name = v_title
    and entity_type = 'asset' and subtype = 'subscription' and status = 'REVIEW REQUIRED'
    and description = 'Verification description' and data_quality = 'unverified'
    and visibility = 'private' and metadata = jsonb_build_object('source_state','OWNER_ENTERED_UNVERIFIED')) then
    raise exception 'Subscription defaults or trimming failed';
  end if;
  if (select count(*) from public.entity_change_history where entity_id = v_id
    and changed_by = auth.uid() and field_name = 'created' and previous_value is null and new_value = v_title) <> 1 then
    raise exception 'Subscription creation audit failed';
  end if;
  begin
    perform public.create_inventory_asset(v_title, 'subscription', '');
    raise exception 'Duplicate subscription unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'An asset with this name already exists' then raise; end if;
  end;
  -- Slug uniqueness spans sections; no duplicate inventory.
  perform public.create_inventory_asset('Cross section fixture ' || v_title, 'other', '');
  begin
    perform public.create_inventory_asset('Cross section fixture ' || v_title, 'subscription', '');
    raise exception 'Cross-section duplicate accepted';
  exception when others then
    if sqlerrm <> 'An asset with this name already exists' then raise; end if;
  end;
  begin
    perform public.create_inventory_asset(upper(v_title), 'subscription', '');
    raise exception 'Case-normalized duplicate accepted';
  exception when others then
    if sqlerrm <> 'An asset with this name already exists' then raise; end if;
  end;
  begin
    perform public.create_inventory_asset('!!!', 'subscription', '');
    raise exception 'Invalid slug accepted';
  exception when others then
    if sqlerrm <> 'Name requires letters or numbers' then raise; end if;
  end;
  begin
    perform public.create_inventory_asset(repeat('x',121), 'subscription', '');
    raise exception 'Oversized name accepted';
  exception when others then
    if sqlerrm <> 'Name must be 2 to 120 characters' then raise; end if;
  end;
  begin
    perform public.create_inventory_asset(v_title || ' description', 'subscription', repeat('x',1001));
    raise exception 'Oversized description accepted';
  exception when others then
    if sqlerrm <> 'Description too long' then raise; end if;
  end;
  assert (select count(*) from public.entity_change_history where entity_id=v_id)=1, 'Failed writes added history';
  begin
    perform public.create_inventory_asset('Subscription invalid category', 'subscription_account', '');
    raise exception 'Unsupported subscription subtype unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'Unsupported category' then raise; end if;
  end;
  begin
    perform public.create_inventory_asset(' ', 'subscription', '');
    raise exception 'Blank subscription title unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'Name must be 2 to 120 characters' then raise; end if;
  end;
  perform public.update_subscription_review(v_id,null,'unknown','undecided','Synthetic review after creation',true);
  assert exists(select 1 from public.entities where id=v_id and metadata->'subscription_review'->>'usage'='unknown' and not metadata ? 'billing'), 'Review interoperability failed';
  assert (select count(*) from public.entity_change_history where entity_id=v_id)=2, 'Creation/review audit mismatch';
  perform set_config('kaikoa.subscription_fixture',v_id::text,true);
end $owner$;
reset role;
update public.entities set status='ARCHIVED' where id=current_setting('kaikoa.subscription_fixture')::uuid;
set local role authenticated;
do $archived$ declare v_name text; begin
 select name into v_name from public.entities where id=current_setting('kaikoa.subscription_fixture')::uuid;
 begin
  perform public.create_inventory_asset(v_name,'subscription','');
  raise exception 'Archived duplicate accepted';
 exception when others then if sqlerrm <> 'An asset with this name already exists' then raise; end if; end;
end $archived$;
reset role;
do $anon_claim$ begin perform set_config('request.jwt.claims', '{"role":"anon"}', true); end $anon_claim$;
set local role anon;
do $anon$
begin
  if has_function_privilege('anon', 'public.create_inventory_asset(text,text,text)', 'EXECUTE') then
    raise exception 'Anonymous RPC execution granted';
  end if;
  begin
    perform public.create_inventory_asset('Anonymous subscription fixture', 'subscription', '');
    raise exception 'Anonymous subscription unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $anon$;
rollback to savepoint fixtures;
do $preservation$ begin
 assert not exists((select * from public.entities except select * from kaikoa_entities_before) union all (select * from kaikoa_entities_before except select * from public.entities)), 'Existing entities changed';
 assert not exists((select * from public.entity_change_history except select * from kaikoa_history_before) union all (select * from kaikoa_history_before except select * from public.entity_change_history)), 'Existing history changed';
end $preservation$;
rollback;
select 'Subscription creation, audit, duplicate/validation and simulated owner/non-owner/anonymous assertions passed; fixtures rolled back.' as result;
