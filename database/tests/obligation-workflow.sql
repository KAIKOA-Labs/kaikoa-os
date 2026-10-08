-- Run after the milestone migration. All test mutations roll back.
begin;
select set_config('request.jwt.claim.sub', substring(
  pg_get_functiondef('private.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz)'::regprocedure)
  from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'), true);
set local role authenticated;
do $test$
declare
  v_old public.obligations%rowtype; v_result jsonb; v_version timestamptz;
  v_count integer; v_state text; v_schedule timestamptz; v_confirm boolean;
begin
  select * into v_old from public.obligations where status not in ('ARCHIVED','COMPLETED') order by id limit 1;
  assert found, 'Owner must read a live obligation';
  v_version := v_old.updated_at;
  foreach v_state in array array['WAITING_ON','IN_PROGRESS','SCHEDULED','COMPLETED','DEFERRED','ATTENTION'] loop
    v_schedule := case when v_state='SCHEDULED' then '2030-01-01T10:00:00Z'::timestamptz else null end;
    v_confirm := v_state='COMPLETED';
    v_result := public.update_obligation_workflow(v_old.id,v_state,'Rollback test action','Rollback test context',v_schedule,v_confirm,v_version);
    assert v_result->>'status'=v_state, 'Workflow transition must persist';
    assert (v_result->>'requires_owner_attention')::boolean=(v_state='ATTENTION'), 'Owner attention must match state';
    assert (v_result->>'completed_at' is not null)=(v_state='COMPLETED'), 'Completion timestamp must track explicit completion';
    assert v_result->'metadata'=to_jsonb(v_old)->'metadata', 'Metadata must be preserved';
    assert v_result->>'due_at' is not distinct from to_jsonb(v_old)->>'due_at', 'Deadline must be preserved';
    assert v_result->>'source_state'=v_old.source_state, 'Provenance must not be promoted';
    v_version := (v_result->>'updated_at')::timestamptz;
  end loop;
  select count(*) into v_count from public.obligation_change_history where obligation_id=v_old.id;
  perform public.update_obligation_workflow(v_old.id,'ATTENTION','Rollback test action','Rollback test context',null,false,v_version);
  assert (select count(*) from public.obligation_change_history where obligation_id=v_old.id)=v_count, 'No-op must not add history';
  begin
    perform public.update_obligation_workflow(v_old.id,'COMPLETED','Rollback test action','Rollback test context',null,false,v_version);
    raise exception 'TEST FAILED: unconfirmed completion accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.update_obligation_workflow(v_old.id,'SCHEDULED','Rollback test action','Rollback test context',null,false,v_version);
    raise exception 'TEST FAILED: invented schedule accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.update_obligation_workflow(v_old.id,'SCHEDULED','Rollback test action','Rollback test context','infinity',false,v_version);
    raise exception 'TEST FAILED: infinite schedule accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.update_obligation_workflow(v_old.id,'WAITING_ON','Rollback test action','',null,false,v_version);
    raise exception 'TEST FAILED: unexplained dependency accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.update_obligation_workflow(v_old.id,null,'Rollback test action','Rollback test context',null,false,v_version);
    raise exception 'TEST FAILED: null status accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.update_obligation_workflow(v_old.id,'ATTENTION','Rollback test action','Rollback test context',null,false,v_old.updated_at);
    raise exception 'TEST FAILED: stale write accepted';
  exception when serialization_failure then null; end;
  select * into v_old from public.obligations where status='ARCHIVED' limit 1;
  assert found, 'Archived fixture required';
  begin
    perform public.update_obligation_workflow(v_old.id,'ATTENTION','Rollback test action','Rollback test context',null,false,v_old.updated_at);
    raise exception 'TEST FAILED: archived record edited';
  exception when no_data_found then null; end;
end $test$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$
declare v_table text; v_empty boolean;
begin
  foreach v_table in array array['entities','relationships','obligations','documents','document_links','events','entity_change_history','obligation_change_history'] loop
    execute format('select count(*)=0 from public.%I',v_table) into strict v_empty;
    assert v_empty, 'Non-owner read must return zero rows';
  end loop;
  begin
    perform public.update_obligation_workflow(gen_random_uuid(),'COMPLETED','Test action','Test context',null,true,now());
    raise exception 'TEST FAILED: non-owner workflow write accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.update_safe_obligation_status(gen_random_uuid(),'ATTENTION');
    raise exception 'TEST FAILED: non-owner legacy status write accepted';
  exception when insufficient_privilege then null; end;
end $test$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $test$
begin
  begin
    perform public.update_obligation_workflow(gen_random_uuid(),'ATTENTION','Test action','Test context',null,false,now());
    raise exception 'TEST FAILED: anonymous workflow write accepted';
  exception when insufficient_privilege then null; end;
end $test$;
rollback;
