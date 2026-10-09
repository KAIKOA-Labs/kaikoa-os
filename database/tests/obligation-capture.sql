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
  perform public.create_inventory_obligation(null,'Synthetic general title','Synthetic action',true);
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
declare v_entity uuid; v_archived uuid; v_general uuid; v_linked uuid; v_review uuid; v_item public.obligations%rowtype;
 v_title text := 'Synthetic capture ' || gen_random_uuid(); v_result jsonb; v_count int; v_test int; v_action text; v_bad_title text;
begin
 v_entity := public.create_inventory_asset('Capture fixture ' || gen_random_uuid(),'other','');
 v_archived := public.create_inventory_asset('Archived capture fixture ' || gen_random_uuid(),'other','');
 perform set_config('kaikoa.archived_parent',v_archived::text,true);
 v_general := public.create_inventory_obligation(null,' ' || v_title || ' ',' Synthetic next action ',true);
 select * into strict v_item from public.obligations where id=v_general;
 assert v_item.related_entity_id is null and v_item.title=v_title and v_item.next_action='Synthetic next action', 'General capture or trimming failed';
 assert v_item.status='ATTENTION' and v_item.requires_owner_attention and v_item.source_state='UNVERIFIED' and v_item.visibility='private', 'Creation defaults changed';
 assert v_item.due_at is null and v_item.scheduled_at is null and v_item.completed_at is null and v_item.workflow_note is null, 'Invented date/context';
 assert v_item.metadata=jsonb_build_object('source','OWNER_ENTERED_UNVERIFIED'), 'Provenance changed';
 assert (select count(*) from public.obligation_change_history where obligation_id=v_general and field_name='created' and previous_value is null and new_value=v_title and changed_by=auth.uid())=1, 'General creation audit missing';
 -- Same title is allowed in distinct related-record scopes.
 v_linked := public.create_inventory_obligation(v_entity,v_title,'Synthetic next action',true);
 assert (select related_entity_id from public.obligations where id=v_linked)=v_entity, 'Linked creation failed';
 v_review := public.create_inventory_obligation(null,v_title || ' review','Synthetic review action',false);
 assert (select not requires_owner_attention and status='ATTENTION' from public.obligations where id=v_review), 'Needs Review default failed';
 select count(*) into v_count from public.obligation_change_history;
 begin
  perform public.create_inventory_obligation(null,' ' || upper(v_title) || ' ','Different action',false);
  raise exception 'General duplicate accepted';
 exception when unique_violation then null; end;
 begin
  perform public.create_inventory_obligation(v_entity,upper(v_title),'Different action',false);
  raise exception 'Linked duplicate accepted';
 exception when unique_violation then null; end;
 assert (select count(*) from public.obligation_change_history)=v_count, 'Rejected duplicate created history';
 assert exists(select 1 from pg_catalog.pg_locks where pid=pg_catalog.pg_backend_pid() and locktype='advisory' and granted), 'Creation did not hold transaction lock';
 for v_test in 1..6 loop
  v_bad_title := case v_test when 1 then null when 2 then '   ' when 3 then 'abc' when 4 then repeat('x',161) else v_title || ' invalid ' || v_test end;
  v_action := case v_test when 5 then '   ' when 6 then repeat('x',1001) else 'Synthetic next action' end;
  begin
   perform public.create_inventory_obligation(null,v_bad_title,v_action,true);
   raise exception 'Invalid capture accepted' using errcode='XX000';
  exception when others then if sqlstate='XX000' then raise; end if; end;
 end loop;
 begin
  perform public.create_inventory_obligation(gen_random_uuid(),v_title || ' missing','Synthetic action',true);
  raise exception 'Missing parent accepted';
 exception when no_data_found then null; end;
 -- General records are immediately editable by the existing workflow/deadline contracts.
 v_result := public.update_obligation_deadline(v_general,'2030-01-01T12:00Z','Synthetic confirmed source',true,v_item.updated_at);
 v_result := public.update_obligation_workflow(v_general,'IN_PROGRESS','Synthetic next action','Synthetic context',null,false,(v_result->>'updated_at')::timestamptz);
 assert (v_result->>'due_at')::timestamptz='2030-01-01T12:00Z'::timestamptz and v_result->'related_entity_id'='null'::jsonb, 'General edit interoperability failed';
 v_result := public.update_obligation_workflow(v_general,'COMPLETED','Synthetic next action','Synthetic completion',null,true,(v_result->>'updated_at')::timestamptz);
 begin
  perform public.create_inventory_obligation(null,v_title,'Synthetic action',true);
  raise exception 'Completed duplicate accepted';
 exception when unique_violation then null; end;
end $owner$;
reset role;
update public.entities set status='ARCHIVED' where id=current_setting('kaikoa.archived_parent')::uuid;
set local role authenticated;
do $archived$
begin
 begin
  perform public.create_inventory_obligation(current_setting('kaikoa.archived_parent')::uuid,'Synthetic archive title','Synthetic action',true);
  raise exception 'Archived parent accepted';
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
 assert not has_function_privilege('anon','public.create_inventory_obligation(uuid,text,text,boolean)','execute'), 'Anonymous execute granted';
 begin
  perform public.create_inventory_obligation(null,'Synthetic general title','Synthetic action',true);
  raise exception 'Anonymous creation passed';
 exception when insufficient_privilege then null; end;
end $anon$;
rollback;
select 'General/linked creation, owner/non-owner/anonymous access, defaults/provenance/audit, scoped duplicates/held lock, input/parent validation, workflow/deadline interoperability and full-row preservation passed; fixtures rolled back.' as result;
