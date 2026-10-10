-- Add an audited, masked metadata subtree for personal identity and license records.
-- The inventory stores no complete identifiers, document images or vault contents.
do $migration$
declare
  v_before text;
  v_after text;
  v_owner text;
  v_old constant text := '(''vessel'',''property'',''digital_asset'',''business'',''equipment'',''vehicle'',''other'',''artwork'',''subscription'')';
  v_new constant text := '(''vessel'',''property'',''digital_asset'',''business'',''equipment'',''vehicle'',''other'',''artwork'',''subscription'',''credential'')';
  v_acl aclitem[];
  v_function_owner oid;
  v_config text[];
  v_security_definer boolean;
begin
  select pg_get_functiondef(oid), proacl, proowner, proconfig, prosecdef
    into v_before, v_acl, v_function_owner, v_config, v_security_definer
    from pg_proc where oid = 'public.create_inventory_asset(text,text,text)'::regprocedure;
  if md5(v_before) <> 'a16abd1238edd025cf0e706d3ca7994c' then
    raise exception 'Inventory creation baseline changed; inspect before adding credential records';
  end if;
  if length(v_before) - length(replace(v_before, v_old, '')) <> length(v_old) then
    raise exception 'Expected a single inventory category allowlist';
  end if;
  execute replace(v_before, v_old, v_new);
  v_after := pg_get_functiondef('public.create_inventory_asset(text,text,text)'::regprocedure);
  if replace(v_after, v_new, v_old) <> v_before then
    raise exception 'Unexpected change beyond the credential category';
  end if;
  if exists(select 1 from pg_proc where oid = 'public.create_inventory_asset(text,text,text)'::regprocedure
    and (proacl is distinct from v_acl or proowner is distinct from v_function_owner or proconfig is distinct from v_config or prosecdef is distinct from v_security_definer or not prosecdef)) then
    raise exception 'Inventory creation security attributes changed';
  end if;
  v_owner := substring(v_before from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
  if v_owner is null or to_regprocedure('public.update_credential_record(uuid,jsonb,text,text,text,date,date,text,text,boolean)') is not null
    or to_regprocedure('public.create_credential_record(text,text,text,text,date,date,text,text,boolean)') is not null then
    raise exception 'Credential endpoint baseline requires inspection';
  end if;
  execute replace($definition$
create function private.update_credential_record(
  p_entity_id uuid, p_expected_record jsonb, p_credential_type text, p_issuer text,
  p_last_four text, p_expires_on date, p_reminder_on date, p_record_state text,
  p_source_note text, p_confirm boolean
) returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare
  v_metadata jsonb; v_old jsonb; v_new jsonb;
  v_type text := trim(coalesce(p_credential_type,''));
  v_issuer text := nullif(trim(coalesce(p_issuer,'')), '');
  v_suffix text := nullif(trim(coalesce(p_last_four,'')), '');
  v_state text := trim(coalesce(p_record_state,''));
  v_note text := trim(coalesce(p_source_note,''));
begin
  if auth.uid() is distinct from '__OWNER__'::uuid then raise exception 'Not authorized' using errcode='42501'; end if;
  if v_type not in ('passport','national_id','driver_license','pilot_license','radio_license','boating_license','professional_license','certification','other')
    or (v_issuer is not null and (char_length(v_issuer) > 120 or v_issuer ~ '[0-9]{7,}'))
    or (v_suffix is not null and v_suffix !~ '^[0-9]{4}$')
    or (p_expires_on is not null and not isfinite(p_expires_on))
    or (p_reminder_on is not null and not isfinite(p_reminder_on))
    or (p_expires_on is null and p_reminder_on is not null)
    or (p_expires_on is not null and p_reminder_on is not null and p_reminder_on > p_expires_on)
    or v_state not in ('needs_review','owner_confirmed','in_progress','unknown')
    or char_length(v_note) not between 4 and 1000
    or v_note ~ '[0-9]{7,}' then
    raise exception 'Use valid credential metadata; enter only a four-digit suffix and no full identifiers' using errcode='22023';
  end if;
  select metadata into v_metadata from public.entities
    where id=p_entity_id and subtype in ('credential','passport') and status <> 'ARCHIVED' for update;
  if not found then raise exception 'Active credential record not found' using errcode='P0002'; end if;
  if jsonb_typeof(v_metadata) is distinct from 'object' then raise exception 'Metadata requires review' using errcode='22023'; end if;
  v_old := nullif(v_metadata->'credential_record','null'::jsonb);
  if v_old is distinct from nullif(p_expected_record,'null'::jsonb) then
    raise exception 'Credential record changed; reload before saving' using errcode='40001';
  end if;
  v_new := jsonb_build_object(
    'version',1,'credential_type',v_type,'issuer',v_issuer,'last_four',v_suffix,
    'expires_on',p_expires_on,'reminder_on',p_reminder_on,'record_state',v_state,
    'source_note',v_note,'recorded_at',clock_timestamp()
  );
  if v_old->'version'='1'::jsonb
    and v_old ?& array['version','credential_type','issuer','last_four','expires_on','reminder_on','record_state','source_note','recorded_at']
    and v_old-array['version','credential_type','issuer','last_four','expires_on','reminder_on','record_state','source_note','recorded_at']='{}'::jsonb
    and (v_old-'recorded_at')=(v_new-'recorded_at') then
    return jsonb_build_object('credential_record',v_old,'changed',false);
  end if;
  if p_confirm is distinct from true then raise exception 'Confirm these credential details before saving' using errcode='22023'; end if;
  v_new := jsonb_set(v_new,'{recorded_at}',to_jsonb(clock_timestamp()),true);
  update public.entities set metadata=jsonb_set(v_metadata,'{credential_record}',v_new,true),updated_at=clock_timestamp() where id=p_entity_id;
  insert into public.entity_change_history(entity_id,changed_by,field_name,previous_value,new_value)
    values(p_entity_id,auth.uid(),'credential_record',v_old::text,v_new::text);
  return jsonb_build_object('credential_record',v_new,'changed',true);
end $body$;
$definition$,'__OWNER__',v_owner);
end $migration$;

create function public.update_credential_record(
  p_entity_id uuid, p_expected_record jsonb, p_credential_type text, p_issuer text,
  p_last_four text, p_expires_on date, p_reminder_on date, p_record_state text,
  p_source_note text, p_confirm boolean
) returns jsonb language sql security invoker set search_path = ''
as $body$ select private.update_credential_record(p_entity_id,p_expected_record,p_credential_type,p_issuer,p_last_four,p_expires_on,p_reminder_on,p_record_state,p_source_note,p_confirm); $body$;

create function public.create_credential_record(
  p_name text, p_credential_type text, p_issuer text, p_last_four text,
  p_expires_on date, p_reminder_on date, p_record_state text, p_source_note text,
  p_confirm boolean
) returns uuid language plpgsql security invoker set search_path = ''
as $body$
declare v_id uuid;
begin
  if p_confirm is distinct from true then raise exception 'Confirm these credential details before saving' using errcode='22023'; end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 120 or trim(p_name) ~ '[0-9]{7,}' then
    raise exception 'Use a descriptive name without full identifiers' using errcode='22023';
  end if;
  v_id := public.create_inventory_asset(p_name,'credential','');
  perform public.update_credential_record(v_id,null,p_credential_type,p_issuer,p_last_four,p_expires_on,p_reminder_on,p_record_state,p_source_note,true);
  return v_id;
end $body$;

revoke all on function private.update_credential_record(uuid,jsonb,text,text,text,date,date,text,text,boolean) from public,anon,authenticated;
grant execute on function private.update_credential_record(uuid,jsonb,text,text,text,date,date,text,text,boolean) to authenticated;
revoke all on function public.update_credential_record(uuid,jsonb,text,text,text,date,date,text,text,boolean) from public,anon;
grant execute on function public.update_credential_record(uuid,jsonb,text,text,text,date,date,text,text,boolean) to authenticated;
revoke all on function public.create_credential_record(text,text,text,text,date,date,text,text,boolean) from public,anon;
grant execute on function public.create_credential_record(text,text,text,text,date,date,text,text,boolean) to authenticated;
