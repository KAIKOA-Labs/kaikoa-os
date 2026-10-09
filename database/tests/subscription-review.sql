-- Administrative fixture setup; simulated role/JWT assertions. All changes roll back.
begin;
create temporary table original_entities as select * from public.entities;
create temporary table original_history as select * from public.entity_change_history;
do $setup$
declare v_owner text;
begin
 v_owner := substring(pg_get_functiondef('private.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz)'::regprocedure) from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
 assert v_owner is not null, 'Owner guard missing';
 perform set_config('kaikoa.test_owner',v_owner,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
end $setup$;
set local role authenticated;
do $denied$
begin
 begin
  perform public.update_subscription_review(gen_random_uuid(),null,'daily','keep','Synthetic note',true);
  raise exception 'Non-owner passed';
 exception when insufficient_privilege then null; end;
end $denied$;
reset role;
savepoint fixtures;
do $setup_fixture$
declare v_id uuid; v_other uuid;
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('kaikoa.test_owner'),'role','authenticated')::text,true);
 v_id := public.create_inventory_asset('Subscription fixture ' || gen_random_uuid(),'other','Synthetic description');
 v_other := public.create_inventory_asset('Other fixture ' || gen_random_uuid(),'other','Synthetic description');
 update public.entities set subtype='subscription',metadata=jsonb_build_object('billing',jsonb_build_object('amount',9.99,'currency','EUR','cadence','monthly','verification','UNVERIFIED'),'fixture','preserve') where id=v_id;
 perform set_config('kaikoa.review_id',v_id::text,true);
 perform set_config('kaikoa.other_id',v_other::text,true);
end $setup_fixture$;
set local role authenticated;
do $owner$
declare v_id uuid := current_setting('kaikoa.review_id')::uuid; v_before public.entities%rowtype; v_after public.entities%rowtype;
 v_result jsonb; v_review jsonb; v_next jsonb; v_count int; v_test int;
begin
 select * into strict v_before from public.entities where id=v_id;
 v_result := public.update_subscription_review(v_id,null,'unknown','undecided',' Synthetic initial note ',true);
 v_review := v_result->'review';
 assert (v_result->>'changed')::boolean and v_review->>'note'='Synthetic initial note', 'Initial review failed';
 assert v_review->>'usage'='unknown' and v_review->>'intention'='undecided' and v_review->'version'='1'::jsonb and isfinite((v_review->>'reviewed_at')::timestamptz), 'Review defaults/date incorrect';
 select * into strict v_after from public.entities where id=v_id;
 assert (to_jsonb(v_before)-array['metadata','updated_at'])=(to_jsonb(v_after)-array['metadata','updated_at']), 'Entity fields changed';
 assert v_after.metadata-'subscription_review'=v_before.metadata, 'Billing/other metadata changed';
 assert exists(select 1 from public.entity_change_history where entity_id=v_id and field_name='subscription_review' and previous_value is null and new_value::jsonb=v_review and changed_by=auth.uid()), 'Initial audit missing';
 select count(*) into v_count from public.entity_change_history;
 v_result := public.update_subscription_review(v_id,v_review,'unknown','undecided','Synthetic initial note',false);
 assert not (v_result->>'changed')::boolean and v_result->'review'=v_review, 'No-op changed review/date';
 assert (select updated_at from public.entities where id=v_id)=v_after.updated_at and (select count(*) from public.entity_change_history)=v_count, 'No-op changed version/history';
 for v_test in 1..7 loop
  begin
   perform public.update_subscription_review(v_id,v_review,
    case v_test when 1 then null when 2 then 'active' else 'daily' end,
    case v_test when 3 then 'cancelled' else 'keep' end,
    case v_test when 4 then null when 5 then 'abc' when 6 then repeat('x',1001) else 'Synthetic note' end,v_test<>7);
   raise exception 'Invalid review accepted';
  exception when invalid_parameter_value then null; end;
 end loop;
 v_result := public.update_subscription_review(v_id,v_review,'not_using','cancel','Synthetic intention only',true);
 v_next := v_result->'review';
 assert exists(select 1 from public.entity_change_history where entity_id=v_id and field_name='subscription_review' and previous_value::jsonb=v_review and new_value::jsonb=v_next), 'Update audit missing';
 assert (select status=v_before.status and metadata-'subscription_review'=v_before.metadata from public.entities where id=v_id), 'Cancel intention changed provider/billing state';
 begin
  perform public.update_subscription_review(v_id,v_review,'daily','keep','Synthetic next note',true);
  raise exception 'Stale review accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.update_subscription_review(current_setting('kaikoa.other_id')::uuid,null,'daily','keep','Synthetic note',true);
  raise exception 'Non-subscription accepted';
 exception when no_data_found then null; end;
 begin
  perform public.update_subscription_review(gen_random_uuid(),null,'daily','keep','Synthetic note',true);
  raise exception 'Missing subscription accepted';
 exception when no_data_found then null; end;
end $owner$;
reset role;
-- Unrelated metadata changes must survive a later review; malformed reviews can be repaired.
update public.entities set metadata=jsonb_set(metadata,'{other_update}','true') where id=current_setting('kaikoa.review_id')::uuid;
set local role authenticated;
do $other_metadata$
declare v_id uuid:=current_setting('kaikoa.review_id')::uuid; v_old jsonb; v_result jsonb;
begin
 select metadata->'subscription_review' into v_old from public.entities where id=v_id;
 v_result:=public.update_subscription_review(v_id,v_old,'regularly','review','Synthetic further review',true);
 assert (select metadata->'other_update'='true'::jsonb from public.entities where id=v_id), 'Concurrent unrelated metadata lost';
end $other_metadata$;
reset role;
update public.entities set metadata=jsonb_set(metadata,'{subscription_review}','{"version":1,"usage":"unknown","intention":"undecided","note":12345,"reviewed_at":"2026-10-09T12:00:00Z"}') where id=current_setting('kaikoa.review_id')::uuid;
set local role authenticated;
do $repair$
declare v_id uuid:=current_setting('kaikoa.review_id')::uuid; v_old jsonb; v_result jsonb;
begin
 select metadata->'subscription_review' into v_old from public.entities where id=v_id;
 v_result:=public.update_subscription_review(v_id,v_old,'unknown','undecided','12345',true);
 assert (v_result->>'changed')::boolean and jsonb_typeof(v_result#>'{review,note}')='string', 'Malformed old review not repaired';
end $repair$;
reset role;
update public.entities set status='ARCHIVED' where id=current_setting('kaikoa.review_id')::uuid;
set local role authenticated;
do $archived$
begin
 begin
  perform public.update_subscription_review(current_setting('kaikoa.review_id')::uuid,null,'daily','keep','Synthetic note',true);
  raise exception 'Archived subscription accepted';
 exception when no_data_found then null; end;
end $archived$;
reset role;
rollback to savepoint fixtures;
do $preserved$
begin
 assert not exists((select * from public.entities except select * from original_entities) union all (select * from original_entities except select * from public.entities)), 'Existing entities changed';
 assert not exists((select * from public.entity_change_history except select * from original_history) union all (select * from original_history except select * from public.entity_change_history)), 'Existing history changed';
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
end $preserved$;
set local role anon;
do $anon$
begin
 assert not has_function_privilege('anon','public.update_subscription_review(uuid,jsonb,text,text,text,boolean)','execute'), 'Anonymous execute granted';
 begin
  perform public.update_subscription_review(gen_random_uuid(),null,'daily','keep','Synthetic note',true);
  raise exception 'Anonymous review accepted';
 exception when insufficient_privilege then null; end;
end $anon$;
rollback;
select 'Subscription review simulated access, input/confirmation, exact subtree audit, no-op/stale, intention-only state, unrelated metadata, malformed repair, archive/type and full-row preservation checks passed; fixtures rolled back.' as result;
