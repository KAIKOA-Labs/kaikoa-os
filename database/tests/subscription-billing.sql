-- Administrative simulated role/JWT checks. Synthetic fixtures always roll back.
begin;
create temp table kaikoa_entities_before as select * from public.entities;
create temp table kaikoa_history_before as select * from public.entity_change_history;
savepoint fixtures;
do $setup$ declare v_owner text; v_id uuid; v_other uuid; begin
 v_owner := substring(pg_get_functiondef('private.update_subscription_billing(uuid,jsonb,text,text,text,text,boolean)'::regprocedure) from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
 assert v_owner is not null, 'Owner guard requires inspection';
 perform set_config('kaikoa.test_owner',v_owner,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
 v_id:=public.create_inventory_asset('Billing fixture '||gen_random_uuid(),'subscription','Synthetic source');
 v_other:=public.create_inventory_asset('Other billing fixture '||gen_random_uuid(),'other','');
 update public.entities set metadata=metadata||jsonb_build_object('billing',jsonb_build_object('amount',12.34,'currency','EUR','cadence','monthly','verification','SYNTHETIC','projected_cost_usd',42),'fixture','preserve') where id=v_id;
 perform set_config('kaikoa.billing_id',v_id::text,true); perform set_config('kaikoa.other_id',v_other::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
end $setup$;
set local role authenticated;
do $nonowner$ begin
 begin perform public.update_subscription_billing(current_setting('kaikoa.billing_id')::uuid,null,'1','USD','monthly','Synthetic source',true); raise exception 'Non-owner accepted';
 exception when insufficient_privilege then assert sqlerrm='Not authorized', 'Unexpected denial'; end;
end $nonowner$;
reset role;
do $owner_claim$ begin perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('kaikoa.test_owner'),'role','authenticated')::text,true); end $owner_claim$;
set local role authenticated;
do $owner$ declare v_id uuid:=current_setting('kaikoa.billing_id')::uuid; v_before public.entities%rowtype; v_after public.entities%rowtype; v_result jsonb; v_old jsonb; v_next jsonb; v_count bigint; v_case int; begin
 select * into v_before from public.entities where id=v_id;
 v_result:=public.update_subscription_billing(v_id,null,'999999999999.999999',' php ','monthly',' Synthetic source ',true); v_old:=v_result->'billing';
 assert v_result->'changed'='true'::jsonb and v_old->>'amount'='999999999999.999999' and v_old->>'currency'='PHP' and v_old->>'source_note'='Synthetic source', 'Precise input/default normalization failed';
 assert jsonb_typeof(v_old->'recorded_at')='string' and isfinite((v_old->>'recorded_at')::timestamptz), 'Server date missing';
 select * into v_after from public.entities where id=v_id;
 assert v_after.metadata-'subscription_billing'=v_before.metadata and (to_jsonb(v_after)-array['metadata','updated_at'])=(to_jsonb(v_before)-array['metadata','updated_at']), 'Original billing/entity fields changed';
 assert exists(select 1 from public.entity_change_history where entity_id=v_id and field_name='subscription_billing' and previous_value is null and new_value::jsonb=v_old and changed_by=auth.uid()), 'Creation audit missing';
 select count(*) into v_count from public.entity_change_history where entity_id=v_id;
 v_result:=public.update_subscription_billing(v_id,v_old,'999999999999.999999','PHP','monthly','Synthetic source',false);
 assert v_result->'changed'='false'::jsonb and v_result->'billing'=v_old, 'No-op failed';
 assert (select updated_at=v_after.updated_at from public.entities where id=v_id) and (select count(*) from public.entity_change_history where entity_id=v_id)=v_count, 'No-op changed history/version';
 for v_case in 1..12 loop
  begin
   perform public.update_subscription_billing(v_id,v_old,
    case v_case when 1 then '-1' when 2 then '1e3' when 3 then '0.0000001' when 4 then '1000000000000' when 5 then '1,000' else '1' end,
    case v_case when 6 then 'AA' else 'USD' end,
    case v_case when 7 then 'weekly' when 8 then null else 'monthly' end,
    case v_case when 9 then 'bad' when 10 then repeat('x',1001) else 'Synthetic changed source' end,
    case v_case when 11 then false when 12 then null else true end);
   raise exception 'Invalid billing case % accepted',v_case;
  exception when invalid_parameter_value then null; end;
 end loop;
 assert (select metadata->'subscription_billing'=v_old from public.entities where id=v_id) and (select count(*) from public.entity_change_history where entity_id=v_id)=v_count, 'Rejected input changed state/history';
 begin perform public.update_subscription_billing(v_id,null,'2','EUR','annual','Synthetic source',true); raise exception 'Stale billing accepted'; exception when serialization_failure then null; end;
 v_result:=public.update_subscription_billing(v_id,v_old,'000.000000',null,'unknown','Synthetic zero amount',true); v_next:=v_result->'billing';
 assert v_next->>'amount'='0' and v_next->'currency'='null'::jsonb and v_next->>'cadence'='unknown', 'Zero/independent unknown failed';
 assert exists(select 1 from public.entity_change_history where entity_id=v_id and field_name='subscription_billing' and previous_value::jsonb=v_old and new_value::jsonb=v_next), 'Before/after audit mismatch';
 v_result:=public.update_subscription_billing(v_id,v_next,null,null,'unknown','Synthetic unknown billing',true); v_old:=v_result->'billing';
 assert v_old->'amount'='null'::jsonb and v_old->'currency'='null'::jsonb, 'Unknown amount/currency failed';
 perform public.update_subscription_review(v_id,null,'unknown','undecided','Synthetic independent review',true);
 assert (select metadata->'subscription_billing'=v_old and metadata->'billing'=v_before.metadata->'billing' from public.entities where id=v_id), 'Review changed billing';
 begin perform public.update_subscription_billing(current_setting('kaikoa.other_id')::uuid,null,'1','USD','monthly','Synthetic source',true); raise exception 'Other subtype accepted'; exception when no_data_found then null; end;
 begin perform public.update_subscription_billing(gen_random_uuid(),null,'1','USD','monthly','Synthetic source',true); raise exception 'Missing entity accepted'; exception when no_data_found then null; end;
end $owner$;
reset role;
update public.entities set metadata=metadata||jsonb_build_object('unrelated_fixture',true) where id=current_setting('kaikoa.billing_id')::uuid;
set local role authenticated;
do $unrelated$ declare v_id uuid:=current_setting('kaikoa.billing_id')::uuid; v_old jsonb; v_new jsonb; begin
 select metadata->'subscription_billing' into v_old from public.entities where id=v_id;
 v_new:=public.update_subscription_billing(v_id,v_old,'0012.340000',' eur ','annual','Synthetic next source',true)->'billing';
 assert v_new->>'amount'='12.34' and (select metadata->'unrelated_fixture'='true'::jsonb and metadata ? 'subscription_review' from public.entities where id=v_id), 'Canonical amount/unrelated subtree preservation failed';
end $unrelated$;
reset role;
update public.entities set metadata=jsonb_set(metadata,'{subscription_billing}','{"version":1,"amount":12345,"currency":"USD","cadence":"monthly","source_note":"Synthetic malformed","recorded_at":"2026-10-09T14:00:00Z"}') where id=current_setting('kaikoa.billing_id')::uuid;
set local role authenticated;
do $repair$ declare v_id uuid:=current_setting('kaikoa.billing_id')::uuid; v_old jsonb; v_result jsonb; begin
 select metadata->'subscription_billing' into v_old from public.entities where id=v_id;
 v_result:=public.update_subscription_billing(v_id,v_old,'12345','USD','monthly','Synthetic malformed',true);
 assert v_result->'changed'='true'::jsonb and v_result->'billing'->'amount'='"12345"'::jsonb, 'Malformed amount was treated as no-op';
end $repair$;
reset role;
do $malformed_shapes$ declare v_bad jsonb; v_id uuid:=current_setting('kaikoa.billing_id')::uuid; v_result jsonb; begin
 foreach v_bad in array array['123'::jsonb,'[]'::jsonb,'"malformed"'::jsonb,'{"version":1,"amount":"1","currency":"USD","cadence":"monthly","source_note":"Synthetic source","recorded_at":"2026-02-30T12:00:00Z"}'::jsonb] loop
  update public.entities set metadata=jsonb_set(metadata,'{subscription_billing}',v_bad) where id=v_id;
  v_result:=public.update_subscription_billing(v_id,v_bad,'1','USD','monthly','Synthetic source',true);
  assert v_result->'changed'='true'::jsonb, 'Malformed billing shape/date treated as no-op';
 end loop;
end $malformed_shapes$;
update public.entities set status='ARCHIVED' where id=current_setting('kaikoa.billing_id')::uuid;
set local role authenticated;
do $archive$ begin
 begin perform public.update_subscription_billing(current_setting('kaikoa.billing_id')::uuid,null,'1','USD','monthly','Synthetic source',true); raise exception 'Archived accepted'; exception when no_data_found then null; end;
end $archive$;
reset role;
do $anon_claim$ begin perform set_config('request.jwt.claims','{"role":"anon"}',true); end $anon_claim$;
set local role anon;
do $anon$ begin
 assert not has_function_privilege('anon','public.update_subscription_billing(uuid,jsonb,text,text,text,text,boolean)','execute'), 'Anonymous execute granted';
 begin perform public.update_subscription_billing(gen_random_uuid(),null,'1','USD','monthly','Synthetic source',true); raise exception 'Anonymous accepted'; exception when insufficient_privilege then null; end;
end $anon$;
reset role;
rollback to savepoint fixtures;
do $preservation$ begin
 assert not exists((select * from public.entities except select * from kaikoa_entities_before) union all (select * from kaikoa_entities_before except select * from public.entities)), 'Existing entities changed';
 assert not exists((select * from public.entity_change_history except select * from kaikoa_history_before) union all (select * from kaikoa_history_before except select * from public.entity_change_history)), 'Existing history changed';
end $preservation$;
rollback;
select 'Subscription billing access, precision, validation, stale/no-op/audit, legacy/review preservation and repair checks passed; fixtures rolled back.' as result;
