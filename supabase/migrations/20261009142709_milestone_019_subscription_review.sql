-- Add an audited review subtree; no subscription, billing or provider state is changed.
do $migration$
declare v_guard text; v_owner text;
begin
 v_guard := pg_get_functiondef('private.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz)'::regprocedure);
 if md5(v_guard)<>'05f96fb03e8af16f57cb87c2ba892e04' then raise exception 'Owner baseline changed; inspect before migration'; end if;
 v_owner := substring(v_guard from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
 if v_owner is null or to_regprocedure('public.update_subscription_review(uuid,jsonb,text,text,text,boolean)') is not null then raise exception 'Review endpoint baseline requires inspection'; end if;
 execute replace($definition$
create function private.update_subscription_review(p_entity_id uuid,p_expected_review jsonb,p_usage text,p_intention text,p_note text,p_confirm_review boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare v_metadata jsonb; v_old jsonb; v_new jsonb; v_note text := trim(coalesce(p_note,'')); v_old_time timestamptz;
begin
 if auth.uid() is distinct from '__OWNER__'::uuid then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_usage is null or p_usage not in ('unknown','daily','regularly','rarely','not_using') or p_intention is null or p_intention not in ('undecided','keep','review','cancel') or char_length(v_note) not between 4 and 1000 then
  raise exception 'Select a valid usage/decision and enter a review note (4 to 1000 characters)' using errcode='22023';
 end if;
 select metadata into v_metadata from public.entities where id=p_entity_id and subtype='subscription' and status<>'ARCHIVED' for update;
 if not found then raise exception 'Active subscription not found' using errcode='P0002'; end if;
 if jsonb_typeof(v_metadata)<>'object' then raise exception 'Metadata requires review' using errcode='22023'; end if;
 v_old := nullif(v_metadata->'subscription_review','null'::jsonb);
 if v_old is distinct from nullif(p_expected_review,'null'::jsonb) then raise exception 'Subscription review changed; reload before saving' using errcode='40001'; end if;
 begin
  if jsonb_typeof(v_old->'reviewed_at')='string' then v_old_time := (v_old->>'reviewed_at')::timestamptz; end if;
 exception when invalid_datetime_format or datetime_field_overflow then v_old_time := null;
 end;
 if v_old->'version'='1'::jsonb and v_old-array['version','usage','intention','note','reviewed_at']='{}'::jsonb
  and v_old->>'usage'=p_usage and v_old->>'intention'=p_intention and v_old->>'note'=v_note and v_old_time is not null and isfinite(v_old_time) then
  return jsonb_build_object('review',v_old,'changed',false);
 end if;
 if p_confirm_review is distinct from true then raise exception 'Confirm this review before saving' using errcode='22023'; end if;
 v_new := jsonb_build_object('version',1,'usage',p_usage,'intention',p_intention,'note',v_note,'reviewed_at',clock_timestamp());
 update public.entities set metadata=jsonb_set(v_metadata,'{subscription_review}',v_new,true),updated_at=clock_timestamp() where id=p_entity_id;
 insert into public.entity_change_history(entity_id,changed_by,field_name,previous_value,new_value)
 values(p_entity_id,auth.uid(),'subscription_review',v_old::text,v_new::text);
 return jsonb_build_object('review',v_new,'changed',true);
end $body$;
$definition$,'__OWNER__',v_owner);
end $migration$;
create function public.update_subscription_review(p_entity_id uuid,p_expected_review jsonb,p_usage text,p_intention text,p_note text,p_confirm_review boolean)
returns jsonb language sql security invoker set search_path = ''
as $body$ select private.update_subscription_review(p_entity_id,p_expected_review,p_usage,p_intention,p_note,p_confirm_review); $body$;
revoke all on function private.update_subscription_review(uuid,jsonb,text,text,text,boolean) from public,anon;
grant execute on function private.update_subscription_review(uuid,jsonb,text,text,text,boolean) to authenticated;
revoke all on function public.update_subscription_review(uuid,jsonb,text,text,text,boolean) from public,anon;
grant execute on function public.update_subscription_review(uuid,jsonb,text,text,text,boolean) to authenticated;
