-- Add a guarded title/link correction endpoint; no operational records change.
do $migration$
declare v_guard text; v_owner text;
begin
 v_guard := pg_get_functiondef('private.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz)'::regprocedure);
 if md5(v_guard)<>'05f96fb03e8af16f57cb87c2ba892e04'
   or md5(pg_get_functiondef('public.create_inventory_obligation(uuid,text,text,boolean)'::regprocedure))<>'fbdc47f3944824f9cf116f3fc2c1006c' then
  raise exception 'Owner/creation baseline changed; inspect before migration';
 end if;
 v_owner := substring(v_guard from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
 if v_owner is null or to_regprocedure('public.update_obligation_details(uuid,text,uuid,text,boolean,timestamptz)') is not null then
  raise exception 'Details endpoint baseline requires inspection';
 end if;
 execute replace($definition$
create function private.update_obligation_details(
 p_obligation_id uuid, p_title text, p_related_entity_id uuid, p_context text,
 p_confirm_change boolean, p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare v_old public.obligations%rowtype; v_new public.obligations%rowtype;
 v_title text := trim(coalesce(p_title,'')); v_context text := trim(coalesce(p_context,''));
begin
 if auth.uid() is distinct from '__OWNER__'::uuid then raise exception 'Not authorized' using errcode='42501'; end if;
 if char_length(v_title) not between 4 and 160 then raise exception 'Title must be 4 to 160 characters' using errcode='22023'; end if;
 select * into v_old from public.obligations where id=p_obligation_id and status not in ('ARCHIVED','COMPLETED') for update;
 if not found then raise exception 'Active obligation not found' using errcode='P0002'; end if;
 if p_expected_updated_at is null or p_expected_updated_at is distinct from v_old.updated_at then
  raise exception 'Record changed; reload before editing' using errcode='40001';
 end if;
 if (v_old.title,v_old.related_entity_id) is not distinct from (v_title,p_related_entity_id) then
  return jsonb_build_object('id',v_old.id,'title',v_old.title,'related_entity_id',v_old.related_entity_id,'updated_at',v_old.updated_at,'changed',false);
 end if;
 if p_confirm_change is distinct from true or char_length(v_context) not between 4 and 1000 then
  raise exception 'Confirm the correction and record a reason (4 to 1000 characters)' using errcode='22023';
 end if;
 -- Retaining an existing archived link is allowed; a newly selected link must be active.
 if p_related_entity_id is not null and p_related_entity_id is distinct from v_old.related_entity_id then
  perform 1 from public.entities where id=p_related_entity_id and status<>'ARCHIVED' for share;
  if not found then raise exception 'Active related record not found' using errcode='P0002'; end if;
 end if;
 -- Use the same target-scope lock as creation to protect duplicate corrections/creates.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kaikoa:obligation:create:' || coalesce(p_related_entity_id::text,'general') || ':' || lower(v_title),0));
 if exists(select 1 from public.obligations where id<>p_obligation_id and related_entity_id is not distinct from p_related_entity_id and lower(title)=lower(v_title)) then
  raise exception 'An obligation with this title already exists in this related-record scope' using errcode='23505';
 end if;
 update public.obligations set title=v_title,related_entity_id=p_related_entity_id,updated_at=clock_timestamp() where id=p_obligation_id returning * into v_new;
 insert into public.obligation_change_history(obligation_id,changed_by,field_name,previous_value,new_value)
  select p_obligation_id,auth.uid(),field.key,to_jsonb(v_old)->>field.key,to_jsonb(v_new)->>field.key
  from unnest(array['title','related_entity_id']) as field(key)
  where to_jsonb(v_old)->field.key is distinct from to_jsonb(v_new)->field.key;
 insert into public.obligation_change_history(obligation_id,changed_by,field_name,previous_value,new_value)
  values(p_obligation_id,auth.uid(),'details_context',null,v_context);
 return jsonb_build_object('id',v_new.id,'title',v_new.title,'related_entity_id',v_new.related_entity_id,'updated_at',v_new.updated_at,'changed',true);
end $body$;
$definition$,'__OWNER__',v_owner);
end $migration$;
create function public.update_obligation_details(
 p_obligation_id uuid, p_title text, p_related_entity_id uuid, p_context text,
 p_confirm_change boolean, p_expected_updated_at timestamptz
) returns jsonb language sql security invoker set search_path = ''
as $body$
 select private.update_obligation_details(p_obligation_id,p_title,p_related_entity_id,p_context,p_confirm_change,p_expected_updated_at);
$body$;
revoke all on function private.update_obligation_details(uuid,text,uuid,text,boolean,timestamptz) from public,anon;
grant execute on function private.update_obligation_details(uuid,text,uuid,text,boolean,timestamptz) to authenticated;
revoke all on function public.update_obligation_details(uuid,text,uuid,text,boolean,timestamptz) from public,anon;
grant execute on function public.update_obligation_details(uuid,text,uuid,text,boolean,timestamptz) to authenticated;
