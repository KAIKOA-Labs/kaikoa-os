-- Owner billing is separate from legacy evidence, projections and actual payments.
do $migration$
declare v_guard text; v_owner text;
begin
 v_guard := pg_get_functiondef('private.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz)'::regprocedure);
 if md5(v_guard)<>'05f96fb03e8af16f57cb87c2ba892e04' then raise exception 'Owner baseline changed; inspect before migration'; end if;
 v_owner := substring(v_guard from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
 if v_owner is null or to_regprocedure('public.update_subscription_billing(uuid,jsonb,text,text,text,text,boolean)') is not null then raise exception 'Billing endpoint baseline requires inspection'; end if;
 execute replace($definition$
create function private.update_subscription_billing(p_entity_id uuid,p_expected_billing jsonb,p_amount text,p_currency text,p_cadence text,p_source_note text,p_confirm_billing boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare v_metadata jsonb; v_old jsonb; v_new jsonb; v_amount text := nullif(trim(p_amount),''); v_currency text := nullif(upper(trim(p_currency)),''); v_note text := trim(coalesce(p_source_note,'')); v_old_time timestamptz;
begin
 if auth.uid() is distinct from '__OWNER__'::uuid then raise exception 'Not authorized' using errcode='42501'; end if;
 if (v_amount is not null and v_amount !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$') or (v_currency is not null and v_currency !~ '^[A-Z]{3}$') or p_cadence is null or p_cadence not in ('unknown','monthly','annual') or char_length(v_note) not between 4 and 1000 then
  raise exception 'Use valid billing fields and a source note (4 to 1000 characters)' using errcode='22023';
 end if;
 if v_amount is not null then
  v_amount := regexp_replace(v_amount,'^0+(?=[0-9])','','');
  if position('.' in v_amount)>0 then v_amount:=rtrim(rtrim(v_amount,'0'),'.'); end if;
 end if;
 select metadata into v_metadata from public.entities where id=p_entity_id and subtype='subscription' and status<>'ARCHIVED' for update;
 if not found then raise exception 'Active subscription not found' using errcode='P0002'; end if;
 if jsonb_typeof(v_metadata) is distinct from 'object' then raise exception 'Metadata requires review' using errcode='22023'; end if;
 v_old := nullif(v_metadata->'subscription_billing','null'::jsonb);
 if v_old is distinct from nullif(p_expected_billing,'null'::jsonb) then raise exception 'Subscription billing changed; reload before saving' using errcode='40001'; end if;
 begin
  if jsonb_typeof(v_old->'recorded_at')='string' and v_old->>'recorded_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then v_old_time := (v_old->>'recorded_at')::timestamptz; end if;
 exception when invalid_datetime_format or datetime_field_overflow then v_old_time := null;
 end;
 if v_old->'version'='1'::jsonb and v_old ?& array['version','amount','currency','cadence','source_note','recorded_at'] and v_old-array['version','amount','currency','cadence','source_note','recorded_at']='{}'::jsonb
  and v_old->'amount'=coalesce(to_jsonb(v_amount),'null'::jsonb) and v_old->'currency'=coalesce(to_jsonb(v_currency),'null'::jsonb) and v_old->'cadence'=to_jsonb(p_cadence) and v_old->'source_note'=to_jsonb(v_note) and v_old_time is not null and isfinite(v_old_time) then
  return jsonb_build_object('billing',v_old,'changed',false);
 end if;
 if p_confirm_billing is distinct from true then raise exception 'Confirm billing details before saving' using errcode='22023'; end if;
 v_new := jsonb_build_object('version',1,'amount',v_amount,'currency',v_currency,'cadence',p_cadence,'source_note',v_note,'recorded_at',clock_timestamp());
 update public.entities set metadata=jsonb_set(v_metadata,'{subscription_billing}',v_new,true),updated_at=clock_timestamp() where id=p_entity_id;
 insert into public.entity_change_history(entity_id,changed_by,field_name,previous_value,new_value)
 values(p_entity_id,auth.uid(),'subscription_billing',v_old::text,v_new::text);
 return jsonb_build_object('billing',v_new,'changed',true);
end $body$;
$definition$,'__OWNER__',v_owner);
end $migration$;
create function public.update_subscription_billing(p_entity_id uuid,p_expected_billing jsonb,p_amount text,p_currency text,p_cadence text,p_source_note text,p_confirm_billing boolean)
returns jsonb language sql security invoker set search_path = ''
as $body$ select private.update_subscription_billing(p_entity_id,p_expected_billing,p_amount,p_currency,p_cadence,p_source_note,p_confirm_billing); $body$;
revoke all on function private.update_subscription_billing(uuid,jsonb,text,text,text,text,boolean) from public,anon;
grant execute on function private.update_subscription_billing(uuid,jsonb,text,text,text,text,boolean) to authenticated;
revoke all on function public.update_subscription_billing(uuid,jsonb,text,text,text,text,boolean) from public,anon;
grant execute on function public.update_subscription_billing(uuid,jsonb,text,text,text,text,boolean) to authenticated;
