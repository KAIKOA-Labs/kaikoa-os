-- Administrative connection only. Simulated role/JWT assertions, fixtures rolled back.
-- Compare private content inside the database; return no row bodies or content derivatives.
begin;
create temporary table original_entities as select * from public.entities;
create temporary table original_history as select * from public.entity_change_history;
do $setup$
declare v_owner text;
begin
 v_owner := substring(pg_get_functiondef('public.create_inventory_asset(text,text,text)'::regprocedure)
   from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
 if v_owner is null then raise exception 'Owner guard requires inspection'; end if;
 perform set_config('kaikoa.test_owner',v_owner,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
end $setup$;
set local role authenticated;
do $denied$
begin
 begin
  perform public.update_artwork_inventory(gen_random_uuid(),null,null);
  raise exception 'Non-owner unexpectedly passed guard';
 exception when insufficient_privilege then
  if sqlerrm <> 'Not authorized' then raise; end if;
 end;
end $denied$;
reset role;
savepoint fixtures;
do $owner_claim$ begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('kaikoa.test_owner'),'role','authenticated')::text,true);
end $owner_claim$;
set local role authenticated;
do $owner$
declare v_id uuid; v_other uuid; v_inventory jsonb; v_next jsonb; v_bad jsonb; v_test int; v_metadata jsonb; v_before public.entities%rowtype; v_after public.entities%rowtype;
begin
 v_id := public.create_inventory_asset('Edition test ' || gen_random_uuid(),'artwork','Verification fixture');
 select * into v_before from public.entities where id=v_id;
 v_metadata := v_before.metadata;
 v_inventory := jsonb_build_object('version',1,'editions',jsonb_build_array(jsonb_build_object('label','White','image_size','45 x 60 cm','edition_limit',20,'printed_count',null,'source_note','Synthetic verification source','source_date',null)),
 'artist_proofs',jsonb_build_object('allowance',2,'printed_count',null,'image_size','','source_note','Synthetic owner report','source_date',null));
 if not public.update_artwork_inventory(v_id,null,v_inventory) then raise exception 'First save failed'; end if;
 select * into v_after from public.entities where id=v_id;
 if v_after.metadata->'artwork_inventory' is distinct from v_inventory or v_after.metadata-'artwork_inventory' is distinct from v_metadata then raise exception 'Metadata preservation failed'; end if;
 if (to_jsonb(v_after)-array['metadata','updated_at']) is distinct from (to_jsonb(v_before)-array['metadata','updated_at']) then raise exception 'Non-inventory fields changed'; end if;
 if (select count(*) from public.entity_change_history where entity_id=v_id and field_name='artwork_inventory' and previous_value is null and new_value::jsonb=v_inventory and changed_by=auth.uid()) <> 1 then raise exception 'Initial audit failed'; end if;
 if public.update_artwork_inventory(v_id,v_inventory,v_inventory) then raise exception 'No-op save not recognized'; end if;
 if (select count(*) from public.entity_change_history where entity_id=v_id and field_name='artwork_inventory') <> 1 then raise exception 'No-op created audit'; end if;
 v_next := jsonb_set(v_inventory,'{editions,0,printed_count}','7');
 if not public.update_artwork_inventory(v_id,v_inventory,v_next) then raise exception 'Update failed'; end if;
 if (select count(*) from public.entity_change_history where entity_id=v_id and field_name='artwork_inventory' and previous_value::jsonb=v_inventory and new_value::jsonb=v_next) <> 1 then raise exception 'Update audit failed'; end if;
 begin
  perform public.update_artwork_inventory(v_id,v_inventory,v_inventory);
  raise exception 'Stale update unexpectedly passed';
 exception when serialization_failure then
  if sqlerrm <> 'Artwork inventory changed; reload before saving' then raise; end if;
 end;
 for v_test in 1..14 loop
  v_bad := case v_test
   when 1 then jsonb_set(v_next,'{editions,0,printed_count}','21')
   when 2 then jsonb_set(v_next,'{editions,0,edition_limit}','0')
   when 3 then jsonb_set(v_next,'{editions,0,printed_count}','-1')
   when 4 then jsonb_set(v_next,'{editions,0,printed_count}','1.5')
   when 5 then jsonb_set(v_next,'{editions,0,source_note}','""')
   when 6 then jsonb_set(v_next,'{editions,0,source_date}','"2026-02-30"')
   when 7 then jsonb_set(v_next,'{editions}',(v_next->'editions') || jsonb_set(v_next#>'{editions,0}','{label}','"white"'))
   when 8 then v_next || '{"price":100}'::jsonb
   when 9 then jsonb_set(v_next,'{artist_proofs,printed_count}','3')
   when 10 then jsonb_set(v_next,'{artist_proofs,source_note}','""')
   when 11 then jsonb_set(v_next,'{editions,0,edition_limit}','"20"')
   when 12 then v_next - 'artist_proofs'
   when 13 then jsonb_set(v_next,'{editions,0,source_date}','"0000-01-01"')
   when 14 then jsonb_set(v_next,'{editions,0,label}','" White "') end;
  begin
   perform public.update_artwork_inventory(v_id,v_next,v_bad);
   raise exception 'Invalid case % unexpectedly accepted',v_test using errcode='XX000';
  exception when others then
   if sqlstate='XX000' then raise; end if;
  end;
 end loop;
 v_other := public.create_inventory_asset('Non artwork test ' || gen_random_uuid(),'other','');
 begin
  perform public.update_artwork_inventory(v_other,null,v_inventory);
  raise exception 'Non-artwork accepted' using errcode='XX000';
 exception when others then if sqlerrm <> 'Artwork not found' then raise; end if; end;
 -- Zero is known; unknown capacity still permits a recorded printed count.
 v_inventory := jsonb_set(v_next,'{editions,0,printed_count}','0');
 perform public.update_artwork_inventory(v_id,v_next,v_inventory);
 v_next := jsonb_set(v_inventory,'{editions,0,edition_limit}','null');
 perform public.update_artwork_inventory(v_id,v_inventory,v_next);
end $owner$;
reset role;
rollback to savepoint fixtures;
do $unchanged$
begin
 if exists((select * from public.entities except select * from original_entities) union all (select * from original_entities except select * from public.entities)) then raise exception 'Existing entities changed'; end if;
 if exists((select * from public.entity_change_history except select * from original_history) union all (select * from original_history except select * from public.entity_change_history)) then raise exception 'Existing history changed'; end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
end $unchanged$;
set local role anon;
do $anon$
begin
 if has_function_privilege('anon','public.update_artwork_inventory(uuid,jsonb,jsonb)','execute') then raise exception 'Anonymous execute granted'; end if;
 begin
  perform public.update_artwork_inventory(gen_random_uuid(),null,null);
  raise exception 'Anonymous update succeeded';
 exception when insufficient_privilege then null; end;
end $anon$;
rollback;
select 'Artwork inventory simulated authorization, audit, validation, stale/no-op and in-database content preservation checks passed; fixtures rolled back.' as result;
