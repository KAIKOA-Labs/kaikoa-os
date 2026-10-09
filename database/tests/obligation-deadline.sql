-- Administrative connection; simulated JWT/role tests. All fixtures roll back.
-- Full-row preservation checks stay inside the database; only pass/fail leaves it.
begin;
create temporary table original_obligations as select * from public.obligations;
create temporary table original_history as select * from public.obligation_change_history;
do $setup$
declare v_owner text;
begin
 v_owner := substring(pg_get_functiondef('private.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz)'::regprocedure)
 from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
 if v_owner is null then raise exception 'Owner guard requires inspection'; end if;
 perform set_config('kaikoa.test_owner',v_owner,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
end $setup$;
set local role authenticated;
do $denied$
begin
 begin
  perform public.update_obligation_deadline(gen_random_uuid(),'infinity',null,false,null);
  raise exception 'Non-owner passed guard';
 exception when insufficient_privilege then if sqlerrm <> 'Not authorized' then raise; end if; end;
 begin
  perform private.update_obligation_deadline(gen_random_uuid(),null,'Test context',true,now());
  raise exception 'Non-owner passed private guard';
 exception when insufficient_privilege then null; end;
end $denied$;
reset role;
savepoint fixtures;
do $fixtures$
declare v_id uuid;
begin
 insert into public.obligations(title,status,importance,next_action,requires_owner_attention,metadata,scheduled_at)
 values('Deadline test ' || gen_random_uuid(),'SCHEDULED','NORMAL','Synthetic next action',false,'{"fixture":"preserve"}','2030-01-01T10:00Z') returning id into v_id;
 perform set_config('kaikoa.test_id',v_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('kaikoa.test_owner'),'role','authenticated')::text,true);
end $fixtures$;
set local role authenticated;
do $owner$
declare v_id uuid := current_setting('kaikoa.test_id')::uuid; v_before public.obligations%rowtype;
 v_after public.obligations%rowtype; v_version timestamptz; v_result jsonb; v_count int; v_due timestamptz := '2030-02-01T11:15:42.123456Z'; v_bad timestamptz;
begin
 select * into strict v_before from public.obligations where id=v_id;
 v_result := public.update_obligation_deadline(v_id,v_due,'Synthetic owner source',true,v_before.updated_at);
 assert (v_result->>'changed')::boolean, 'Initial deadline not saved';
 select * into strict v_after from public.obligations where id=v_id;
 assert v_after.due_at=v_due, 'Exact deadline instant lost';
 assert (to_jsonb(v_before)-array['due_at','updated_at'])=(to_jsonb(v_after)-array['due_at','updated_at']), 'Unrelated fields changed';
 assert (select count(*) from public.obligation_change_history where obligation_id=v_id and field_name='due_at' and previous_value is null and new_value::timestamptz=v_due and changed_by=auth.uid())=1, 'Initial audit missing';
 assert (select count(*) from public.obligation_change_history where obligation_id=v_id and field_name='deadline_context' and new_value='Synthetic owner source')=1, 'Context audit missing';
 v_version := v_after.updated_at;
 v_result := public.update_obligation_deadline(v_id,v_due,null,false,v_version);
 assert not (v_result->>'changed')::boolean, 'No-op not recognized';
 assert (select updated_at from public.obligations where id=v_id)=v_version, 'No-op changed version';
 assert (select count(*) from public.obligation_change_history where obligation_id=v_id)=2, 'No-op created history';
 begin
  perform public.update_obligation_deadline(v_id,null,'Clear context',false,v_version);
  raise exception 'Unconfirmed clear accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.update_obligation_deadline(v_id,null,null,true,v_version);
  raise exception 'Missing context accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.update_obligation_deadline(v_id,null,repeat('x',1001),true,v_version);
  raise exception 'Long context accepted';
 exception when invalid_parameter_value then null; end;
 foreach v_bad in array array['infinity'::timestamptz,'-infinity'::timestamptz,'0001-01-01 BC'::timestamptz,'10000-01-01'::timestamptz] loop
  begin
   perform public.update_obligation_deadline(v_id,v_bad,'Synthetic source',true,v_version);
   raise exception 'Invalid deadline accepted';
  exception when invalid_parameter_value then null; end;
 end loop;
 begin
  perform public.update_obligation_deadline(v_id,null,'Clear context',true,null);
  raise exception 'Missing version accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.update_obligation_deadline(v_id,null,'Clear context',true,v_before.updated_at);
  raise exception 'Stale deadline write accepted';
 exception when serialization_failure then null; end;
 -- Existing workflow uses the shared record version and must preserve the deadline.
 begin
  perform public.update_obligation_workflow(v_id,'IN_PROGRESS','Synthetic next action','Synthetic context',null,false,v_before.updated_at);
  raise exception 'Stale workflow write accepted';
 exception when serialization_failure then null; end;
 v_result := public.update_obligation_workflow(v_id,'IN_PROGRESS','Synthetic next action','Synthetic context',null,false,v_version);
 assert (v_result->>'due_at')::timestamptz=v_due, 'Workflow overwrote deadline';
 begin
  perform public.update_obligation_deadline(v_id,null,'Clear context',true,v_version);
  raise exception 'Deadline overwrote newer workflow';
 exception when serialization_failure then null; end;
 v_version := (v_result->>'updated_at')::timestamptz;
 select count(*) into v_count from public.obligation_change_history where obligation_id=v_id;
 v_result := public.update_obligation_deadline(v_id,null,'Confirmed removal source',true,v_version);
 assert (v_result->>'changed')::boolean and v_result->'due_at'='null'::jsonb, 'Clear failed';
 assert (select count(*) from public.obligation_change_history where obligation_id=v_id)=v_count+2, 'Clear audit missing';
 assert exists(select 1 from public.obligation_change_history where obligation_id=v_id and field_name='due_at' and previous_value::timestamptz=v_due and new_value is null), 'Clear before/after audit failed';
 v_version := (v_result->>'updated_at')::timestamptz;
 v_result := public.update_obligation_workflow(v_id,'COMPLETED','Synthetic next action','Synthetic completion context',null,true,v_version);
 begin
  perform public.update_obligation_deadline(v_id,v_due,'Synthetic source',true,(v_result->>'updated_at')::timestamptz);
  raise exception 'Completed deadline edit accepted';
 exception when no_data_found then null; end;
 begin
  perform public.update_obligation_deadline(gen_random_uuid(),v_due,'Synthetic source',true,now());
  raise exception 'Missing record accepted';
 exception when no_data_found then null; end;
end $owner$;
reset role;
update public.obligations set status='ARCHIVED' where id=current_setting('kaikoa.test_id')::uuid;
set local role authenticated;
do $archived$
begin
 begin
  perform public.update_obligation_deadline(current_setting('kaikoa.test_id')::uuid,null,'Synthetic source',true,now());
  raise exception 'Archived deadline edit accepted';
 exception when no_data_found then null; end;
end $archived$;
reset role;
rollback to savepoint fixtures;
do $unchanged$
begin
 assert not exists((select * from public.obligations except select * from original_obligations) union all (select * from original_obligations except select * from public.obligations)), 'Existing obligations changed';
 assert not exists((select * from public.obligation_change_history except select * from original_history) union all (select * from original_history except select * from public.obligation_change_history)), 'Existing audit changed';
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
end $unchanged$;
set local role anon;
do $anon$
begin
 assert not has_function_privilege('anon','public.update_obligation_deadline(uuid,timestamptz,text,boolean,timestamptz)','execute'), 'Anonymous execute granted';
 begin
  perform public.update_obligation_deadline(gen_random_uuid(),null,'Synthetic source',true,now());
  raise exception 'Anonymous write accepted';
 exception when insufficient_privilege then null; end;
end $anon$;
rollback;
select 'Deadline simulated authorization, exact dates, audit/context, clear/no-op, validation, stale workflow interoperability and full-row preservation passed; fixtures rolled back.' as result;
