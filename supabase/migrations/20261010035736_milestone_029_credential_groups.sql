-- Persist owner-selected display groups without changing credential facts.
do $migration$
declare v_guard text; v_owner text;
begin
  v_guard := pg_get_functiondef('private.update_credential_record(uuid,jsonb,text,text,text,date,date,text,text,boolean)'::regprocedure);
  if md5(v_guard) <> '702bd2007ac58da67329f020c24a49c2' then raise exception 'Credential owner guard changed; inspect before migration'; end if;
  v_owner := substring(v_guard from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
  if v_owner is null then raise exception 'Owner guard unavailable'; end if;
  execute replace($definition$
create function private.update_credential_group(p_entity_id uuid,p_expected_group jsonb,p_group text,p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare v_metadata jsonb; v_old jsonb; v_new jsonb;
begin
  if auth.uid() is distinct from '__OWNER__'::uuid then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_confirm is distinct from true or (p_group is not null and p_group not in ('passports','national_ids','driving_licenses','philippines_ppl','licenses','certificates','other')) then
    raise exception 'Confirm a supported inventory group' using errcode='22023';
  end if;
  select metadata into v_metadata from public.entities where id=p_entity_id and subtype in ('credential','passport') and status <> 'ARCHIVED' for update;
  if not found then raise exception 'Active credential not found' using errcode='P0002'; end if;
  if jsonb_typeof(v_metadata) is distinct from 'object' then raise exception 'Metadata requires review' using errcode='22023'; end if;
  v_old := nullif(v_metadata->'credential_group','null'::jsonb);
  if v_old is distinct from nullif(p_expected_group,'null'::jsonb) then raise exception 'Group changed; reload before saving' using errcode='40001'; end if;
  v_new := to_jsonb(p_group);
  if v_old is not distinct from v_new then return jsonb_build_object('credential_group',v_old,'changed',false); end if;
  if p_group is null then v_metadata := v_metadata - 'credential_group';
  else v_metadata := jsonb_set(v_metadata,'{credential_group}',v_new,true); end if;
  update public.entities set metadata=v_metadata,updated_at=clock_timestamp() where id=p_entity_id;
  insert into public.entity_change_history(entity_id,changed_by,field_name,previous_value,new_value)
    values(p_entity_id,auth.uid(),'credential_group',v_old::text,v_new::text);
  return jsonb_build_object('credential_group',v_new,'changed',true);
end $body$;
$definition$,'__OWNER__',v_owner);
end $migration$;
create function public.update_credential_group(p_entity_id uuid,p_expected_group jsonb,p_group text,p_confirm boolean)
returns jsonb language sql security invoker set search_path = ''
as $body$ select private.update_credential_group(p_entity_id,p_expected_group,p_group,p_confirm); $body$;
revoke all on function private.update_credential_group(uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function private.update_credential_group(uuid,jsonb,text,boolean) to authenticated;
revoke all on function public.update_credential_group(uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.update_credential_group(uuid,jsonb,text,boolean) to authenticated;
