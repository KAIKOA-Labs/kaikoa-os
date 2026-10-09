-- Simulated role/JWT assertions on synthetic fixtures; every mutation rolls back.
-- Compare full source rows inside the database; return only pass/fail.
begin;
create temporary table original_entities as select * from public.entities;
create temporary table original_entity_history as select * from public.entity_change_history;
create temporary table original_obligations as select * from public.obligations;
create temporary table original_history as select * from public.obligation_change_history;
do $setup$
declare v_owner text;
begin
 v_owner := substring(pg_get_functiondef('public.create_inventory_obligation(uuid,text,text,boolean)'::regprocedure)
 from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
 assert v_owner is not null, 'Owner guard missing';
 perform set_config('kaikoa.test_owner',v_owner,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
end $setup$;
set local role authenticated;
do $denied$
begin
 begin
  perform public.update_obligation_details(gen_random_uuid(),'Synthetic title',null,'Synthetic reason',true,now());
  raise exception 'Non-owner creation passed' using errcode='XX000';
 exception when others then if sqlerrm <> 'Not authorized' then raise; end if; end;
end $denied$;
reset role;
savepoint fixtures;
do $claim$ begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('kaikoa.test_owner'),'role','authenticated')::text,true);
end $claim$;
set local role authenticated;
do $owner$
declare v_entity uuid; v_parent uuid; v_id uuid; v_duplicate uuid; v_retained uuid; v_before public.obligations%rowtype; v_after public.obligations%rowtype;
 v_title text := 'Synthetic details ' || gen_random_uuid(); v_next text; v_result jsonb; v_version timestamptz; v_count int; v_test int;
begin
 v_entity := public.create_inventory_asset('Details fixture ' || gen_random_uuid(),'other','');
 v_parent := public.create_inventory_asset('Archived details fixture ' || gen_random_uuid(),'other','');
 v_id := public.create_inventory_obligation(null,v_title,'Synthetic next action',false);
 select * into strict v_before from public.obligations where id=v_id;
 v_result := public.update_obligation_deadline(v_id,'2030-01-01T12:00Z','Synthetic deadline source',true,v_before.updated_at);
 v_result := public.update_obligation_workflow(v_id,'IN_PROGRESS','Synthetic next action','Synthetic context',null,false,(v_result->>'updated_at')::timestamptz);
 select * into strict v_before from public.obligations where id=v_id;
 v_next := v_title || ' corrected';
 v_duplicate := public.create_inventory_obligation(v_entity,v_title || ' duplicate','Synthetic next action',true);
 perform public.create_inventory_obligation(null,v_title || ' duplicate','Synthetic next action',true);
 v_result := public.update_obligation_details(v_id,' ' || v_next || ' ',v_entity,'Synthetic correction reason',true,v_before.updated_at);
 select * into strict v_after from public.obligations where id=v_id;
 assert v_after.title=v_next and v_after.related_entity_id=v_entity, 'Title/link correction failed';
 assert (to_jsonb(v_after)-array['title','related_entity_id','updated_at'])=(to_jsonb(v_before)-array['title','related_entity_id','updated_at']), 'Unrelated fields changed';
 assert exists(select 1 from public.obligation_change_history where obligation_id=v_id and field_name='title' and previous_value=v_title and new_value=v_next and changed_by=auth.uid()), 'Title audit failed';
 assert exists(select 1 from public.obligation_change_history where obligation_id=v_id and field_name='related_entity_id' and previous_value is null and new_value=v_entity::text), 'Link audit failed';
 assert exists(select 1 from public.obligation_change_history where obligation_id=v_id and field_name='details_context' and new_value='Synthetic correction reason'), 'Reason audit failed';
 assert exists(select 1 from pg_catalog.pg_locks where pid=pg_catalog.pg_backend_pid() and locktype='advisory' and granted), 'Target transaction lock absent';
 v_version := v_after.updated_at;
 select count(*) into v_count from public.obligation_change_history;
 v_result := public.update_obligation_details(v_id,v_next,v_entity,null,false,v_version);
 assert not (v_result->>'changed')::boolean, 'No-op not recognized';
 assert (select updated_at from public.obligations where id=v_id)=v_version and (select count(*) from public.obligation_change_history)=v_count, 'No-op changed version/history';
 begin
  perform public.update_obligation_details(v_id,upper(v_title || ' duplicate'),v_entity,'Synthetic reason',true,v_version);
  raise exception 'Linked duplicate accepted';
 exception when unique_violation then null; end;
 begin
  perform public.update_obligation_details(v_id,upper(v_title || ' duplicate'),null,'Synthetic reason',true,v_version);
  raise exception 'General duplicate accepted';
 exception when unique_violation then null; end;
 for v_test in 1..7 loop
  begin
   perform public.update_obligation_details(v_id,
    case v_test when 1 then null when 2 then 'abc' when 3 then repeat('x',161) else v_next || ' revised' end,
    v_entity,case v_test when 4 then null when 5 then 'abc' when 6 then repeat('x',1001) else 'Synthetic reason' end,
    v_test<>7,v_version);
   raise exception 'Invalid correction accepted';
  exception when invalid_parameter_value then null; end;
 end loop;
 begin
  perform public.update_obligation_details(v_id,v_next,null,'Synthetic reason',true,null);
  raise exception 'Missing version accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.update_obligation_details(v_id,v_next,null,'Synthetic reason',true,v_before.updated_at);
  raise exception 'Stale details accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.update_obligation_workflow(v_id,'IN_PROGRESS','Synthetic changed action','Synthetic context',null,false,v_before.updated_at);
  raise exception 'Details failed to protect stale workflow';
 exception when serialization_failure then null; end;
 begin
  perform public.update_obligation_deadline(v_id,null,'Synthetic removal',true,v_before.updated_at);
  raise exception 'Details failed to protect stale deadline';
 exception when serialization_failure then null; end;
 begin
  perform public.update_obligation_details(v_id,v_next,gen_random_uuid(),'Synthetic reason',true,v_version);
  raise exception 'Missing parent accepted';
 exception when no_data_found then null; end;
 begin
  perform public.update_obligation_details(gen_random_uuid(),v_next,null,'Synthetic reason',true,now());
  raise exception 'Missing obligation accepted';
 exception when no_data_found then null; end;
 begin
  perform public.create_inventory_obligation(v_entity,v_next,'Synthetic duplicate action',true);
  raise exception 'Creation duplicated corrected record';
 exception when unique_violation then null; end;
 assert (select count(*) from public.obligation_change_history)=v_count, 'Rejected corrections changed audit';
 v_result := public.update_obligation_details(v_id,v_next,null,'Synthetic unlink reason',true,v_version);
 assert v_result->'related_entity_id'='null'::jsonb, 'Unlink failed';
 assert (select count(*) from public.obligation_change_history)=v_count+2, 'Unlink should audit only link and reason';
 assert exists(select 1 from public.obligation_change_history where obligation_id=v_id and field_name='related_entity_id' and previous_value=v_entity::text and new_value is null), 'Unlink before/after failed';
 v_version := (v_result->>'updated_at')::timestamptz;
 v_result := public.update_obligation_workflow(v_id,'IN_PROGRESS','Synthetic changed action','Synthetic context',null,false,v_version);
 begin
  perform public.update_obligation_details(v_id,v_next,v_entity,'Synthetic reason',true,v_version);
  raise exception 'Details overwrote newer workflow';
 exception when serialization_failure then null; end;
 v_version := (v_result->>'updated_at')::timestamptz;
 v_result := public.update_obligation_deadline(v_id,null,'Synthetic removal',true,v_version);
 begin
  perform public.update_obligation_details(v_id,v_next,v_entity,'Synthetic reason',true,v_version);
  raise exception 'Details overwrote newer deadline';
 exception when serialization_failure then null; end;
 v_result := public.update_obligation_workflow(v_id,'COMPLETED','Synthetic changed action','Synthetic completion',null,true,(v_result->>'updated_at')::timestamptz);
 begin
  perform public.update_obligation_details(v_id,v_next,v_entity,'Synthetic reason',true,(v_result->>'updated_at')::timestamptz);
  raise exception 'Completed details edited';
 exception when no_data_found then null; end;
 v_retained := public.create_inventory_obligation(v_parent,v_title || ' retained','Synthetic action',true);
 perform set_config('kaikoa.retained_id',v_retained::text,true);
 perform set_config('kaikoa.archived_parent',v_parent::text,true);
 perform set_config('kaikoa.archived_obligation',v_duplicate::text,true);
end $owner$;
reset role;
update public.entities set status='ARCHIVED' where id=current_setting('kaikoa.archived_parent')::uuid;
update public.obligations set status='ARCHIVED' where id=current_setting('kaikoa.archived_obligation')::uuid;
set local role authenticated;
do $archived$
declare v_item public.obligations%rowtype; v_id uuid; v_result jsonb;
begin
 select * into strict v_item from public.obligations where id=current_setting('kaikoa.retained_id')::uuid;
 v_result := public.update_obligation_details(v_item.id,v_item.title || ' corrected',v_item.related_entity_id,'Synthetic retained-link correction',true,v_item.updated_at);
 assert (v_result->>'related_entity_id')::uuid=v_item.related_entity_id, 'Existing archived link was lost';
 v_id := public.create_inventory_obligation(null,'Synthetic archive-target ' || gen_random_uuid(),'Synthetic action',true);
 select * into strict v_item from public.obligations where id=v_id;
 begin
  perform public.update_obligation_details(v_id,v_item.title,current_setting('kaikoa.archived_parent')::uuid,'Synthetic new link',true,v_item.updated_at);
  raise exception 'New archived parent accepted';
 exception when no_data_found then null; end;
 begin
  perform public.update_obligation_details(current_setting('kaikoa.archived_obligation')::uuid,'Synthetic corrected title',null,'Synthetic reason',true,now());
  raise exception 'Archived obligation edited';
 exception when no_data_found then null; end;
end $archived$;
reset role;
rollback to savepoint fixtures;
do $preserved$
begin
 assert not exists((select * from public.entities except select * from original_entities) union all (select * from original_entities except select * from public.entities)), 'Existing entities changed';
 assert not exists((select * from public.entity_change_history except select * from original_entity_history) union all (select * from original_entity_history except select * from public.entity_change_history)), 'Existing entity history changed';
 assert not exists((select * from public.obligations except select * from original_obligations) union all (select * from original_obligations except select * from public.obligations)), 'Existing obligations changed';
 assert not exists((select * from public.obligation_change_history except select * from original_history) union all (select * from original_history except select * from public.obligation_change_history)), 'Existing obligation history changed';
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
end $preserved$;
set local role anon;
do $anon$
begin
 assert not has_function_privilege('anon','public.update_obligation_details(uuid,text,uuid,text,boolean,timestamptz)','execute'), 'Anonymous execute granted';
 begin
  perform public.update_obligation_details(gen_random_uuid(),'Synthetic title',null,'Synthetic reason',true,now());
  raise exception 'Anonymous creation passed';
 exception when insufficient_privilege then null; end;
end $anon$;
rollback;
select 'Obligation details simulated access, title/link/clear/audit/context, no-op, duplicate/lock, validation, stale workflow/deadline interoperability, archive/completion and full-row preservation passed; fixtures rolled back.' as result;
