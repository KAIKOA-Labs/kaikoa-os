-- Simulated database role/JWT assertions, not real browser-session evidence.
-- Synthetic fixtures and all writes roll back; never assign live owner groups here.
begin;
create temp table kaikoa_entities_before as select * from public.entities;
create temp table kaikoa_history_before as select * from public.entity_change_history;
savepoint fixtures;
do $setup$ declare v_owner text; v_id uuid; v_other uuid; begin
 v_owner:=substring(pg_get_functiondef('private.update_credential_group(uuid,jsonb,text,boolean)'::regprocedure) from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
 assert v_owner is not null, 'Inspect owner guard';
 perform set_config('kaikoa.test_owner',v_owner,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
 v_id:=public.create_credential_record('Group fixture '||gen_random_uuid(),'other',null,null,null,null,'needs_review','Synthetic source',true);
 v_other:=public.create_inventory_asset('Other group fixture '||gen_random_uuid(),'other','');
 update public.entities set metadata=metadata||jsonb_build_object('fixture','preserve') where id=v_id;
 perform set_config('kaikoa.group_id',v_id::text,true);
 perform set_config('kaikoa.other_id',v_other::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
end $setup$;
set local role authenticated;
do $nonowner$ begin
 begin perform public.update_credential_group(current_setting('kaikoa.group_id')::uuid,null,'philippines_ppl',true); raise exception 'Non-owner accepted';
 exception when insufficient_privilege then assert sqlerrm='Not authorized', 'Unexpected denial'; end;
end $nonowner$;
reset role;
do $owner_claim$ begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('kaikoa.test_owner'),'role','authenticated')::text,true); end $owner_claim$;
set local role authenticated;
do $owner$ declare v_id uuid:=current_setting('kaikoa.group_id')::uuid; v_before public.entities%rowtype; v_after public.entities%rowtype; v_result jsonb; v_count bigint; v_case int; begin
 select * into v_before from public.entities where id=v_id;
 v_result:=public.update_credential_group(v_id,null,'philippines_ppl',true);
 assert v_result='{"credential_group":"philippines_ppl","changed":true}'::jsonb, 'Group save failed';
 select * into v_after from public.entities where id=v_id;
 assert v_after.metadata-'credential_group'=v_before.metadata and (to_jsonb(v_after)-array['metadata','updated_at'])=(to_jsonb(v_before)-array['metadata','updated_at']), 'Credential/entity facts changed';
 assert (select count(*) from public.entity_change_history where entity_id=v_id and field_name='credential_group')=1, 'Expected one group audit';
 assert exists(select 1 from public.entity_change_history where entity_id=v_id and field_name='credential_group' and previous_value is null and new_value::jsonb='"philippines_ppl"'::jsonb and changed_by=auth.uid()), 'Group audit mismatch';
 select count(*) into v_count from public.entity_change_history where entity_id=v_id;
 v_result:=public.update_credential_group(v_id,'"philippines_ppl"','philippines_ppl',true);
 assert v_result->'changed'='false'::jsonb and (select updated_at=v_after.updated_at from public.entities where id=v_id) and (select count(*) from public.entity_change_history where entity_id=v_id)=v_count, 'No-op changed audit/version';
 begin perform public.update_credential_group(v_id,null,'certificates',true); raise exception 'Stale accepted'; exception when serialization_failure then null; end;
 for v_case in 1..3 loop
  begin perform public.update_credential_group(v_id,'"philippines_ppl"',case when v_case=1 then 'unsupported' else 'certificates' end,case when v_case=2 then false when v_case=3 then null else true end); raise exception 'Invalid case accepted';
  exception when invalid_parameter_value then null; end;
 end loop;
 assert (select metadata=v_after.metadata from public.entities where id=v_id) and (select count(*) from public.entity_change_history where entity_id=v_id)=v_count, 'Rejected save changed state';
 v_result:=public.update_credential_group(v_id,'"philippines_ppl"',null,true);
 assert v_result='{"credential_group":null,"changed":true}'::jsonb and (select metadata=v_before.metadata from public.entities where id=v_id), 'Clear changed facts';
 assert exists(select 1 from public.entity_change_history where entity_id=v_id and field_name='credential_group' and previous_value::jsonb='"philippines_ppl"'::jsonb and new_value is null), 'Clear audit missing';
 begin perform public.update_credential_group(current_setting('kaikoa.other_id')::uuid,null,'philippines_ppl',true); raise exception 'Other subtype accepted'; exception when no_data_found then null; end;
 begin perform public.update_credential_group(gen_random_uuid(),null,'philippines_ppl',true); raise exception 'Missing accepted'; exception when no_data_found then null; end;
end $owner$;
reset role;
update public.entities set subtype='passport' where id=current_setting('kaikoa.group_id')::uuid;
set local role authenticated;
do $legacy$ begin
 assert public.update_credential_group(current_setting('kaikoa.group_id')::uuid,null,'passports',true)->'changed'='true'::jsonb, 'Legacy passport rejected';
end $legacy$;
reset role;
update public.entities set status='ARCHIVED' where id=current_setting('kaikoa.group_id')::uuid;
set local role authenticated;
do $archive$ begin
 begin perform public.update_credential_group(current_setting('kaikoa.group_id')::uuid,'"passports"','other',true); raise exception 'Archived accepted'; exception when no_data_found then null; end;
end $archive$;
reset role;
do $anon_claim$ begin
 assert not has_function_privilege('anon','private.update_credential_group(uuid,jsonb,text,boolean)','execute'), 'Private anon execute granted';
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
end $anon_claim$;
set local role anon;
do $anon$ begin
 assert not has_function_privilege('anon','public.update_credential_group(uuid,jsonb,text,boolean)','execute'), 'Anon execute granted';
 begin perform public.update_credential_group(gen_random_uuid(),null,'other',true); raise exception 'Anon accepted'; exception when insufficient_privilege then null; end;
end $anon$;
reset role;
rollback to savepoint fixtures;
do $preservation$ begin
 assert not exists((select * from public.entities except select * from kaikoa_entities_before) union all (select * from kaikoa_entities_before except select * from public.entities)), 'Existing entities changed';
 assert not exists((select * from public.entity_change_history except select * from kaikoa_history_before) union all (select * from kaikoa_history_before except select * from public.entity_change_history)), 'Existing history changed';
end $preservation$;
rollback;
select 'Group role/JWT, confirmation, stale/no-op/audit, clear and preservation assertions passed; synthetic fixtures rolled back.' as result;
