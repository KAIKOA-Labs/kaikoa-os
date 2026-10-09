-- Add an active-obligation deadline endpoint using the inspected owner guard.
-- No operational records, existing endpoints or table grants change.
do $migration$
declare v_baseline text; v_owner text;
begin
  v_baseline := pg_get_functiondef('private.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz)'::regprocedure);
  if md5(v_baseline) <> '05f96fb03e8af16f57cb87c2ba892e04' then
    raise exception 'Workflow authorization baseline changed; inspect before migration';
  end if;
  v_owner := substring(v_baseline from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
  if v_owner is null or to_regprocedure('public.update_obligation_deadline(uuid,timestamptz,text,boolean,timestamptz)') is not null then
    raise exception 'Deadline endpoint baseline requires inspection';
  end if;
  execute replace($definition$
create function private.update_obligation_deadline(
  p_obligation_id uuid, p_due_at timestamptz, p_context text,
  p_confirm_change boolean, p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare v_old public.obligations%rowtype; v_new public.obligations%rowtype;
  v_context text := trim(coalesce(p_context,''));
begin
  if auth.uid() is distinct from '__OWNER__'::uuid then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_due_at is not null and (not isfinite(p_due_at) or p_due_at < '0001-01-01T00:00:00Z'::timestamptz or p_due_at >= '10000-01-01T00:00:00Z'::timestamptz) then
    raise exception 'Enter a finite deadline in years 0001 through 9999' using errcode='22023';
  end if;
  select * into v_old from public.obligations where id=p_obligation_id and status not in ('ARCHIVED','COMPLETED') for update;
  if not found then raise exception 'Active obligation not found' using errcode='P0002'; end if;
  if p_expected_updated_at is null or p_expected_updated_at is distinct from v_old.updated_at then
    raise exception 'Record changed; reload before editing' using errcode='40001';
  end if;
  if v_old.due_at is not distinct from p_due_at then
    return jsonb_build_object('id',v_old.id,'due_at',v_old.due_at,'updated_at',v_old.updated_at,'changed',false);
  end if;
  if p_confirm_change is distinct from true or char_length(v_context) not between 4 and 1000 then
    raise exception 'Confirm the change and record a reason or source (4 to 1000 characters)' using errcode='22023';
  end if;
  update public.obligations set due_at=p_due_at, updated_at=clock_timestamp()
    where id=p_obligation_id returning * into v_new;
  insert into public.obligation_change_history(obligation_id,changed_by,field_name,previous_value,new_value)
    values(p_obligation_id,auth.uid(),'due_at',v_old.due_at::text,v_new.due_at::text),
      (p_obligation_id,auth.uid(),'deadline_context',null,v_context);
  return jsonb_build_object('id',v_new.id,'due_at',v_new.due_at,'updated_at',v_new.updated_at,'changed',true);
end $body$;
$definition$, '__OWNER__', v_owner);
end $migration$;
create function public.update_obligation_deadline(
  p_obligation_id uuid, p_due_at timestamptz, p_context text,
  p_confirm_change boolean, p_expected_updated_at timestamptz
) returns jsonb language sql security invoker set search_path = ''
as $body$
  select private.update_obligation_deadline(p_obligation_id,p_due_at,p_context,p_confirm_change,p_expected_updated_at);
$body$;
revoke all on function private.update_obligation_deadline(uuid,timestamptz,text,boolean,timestamptz) from public, anon;
grant execute on function private.update_obligation_deadline(uuid,timestamptz,text,boolean,timestamptz) to authenticated;
revoke all on function public.update_obligation_deadline(uuid,timestamptz,text,boolean,timestamptz) from public, anon;
grant execute on function public.update_obligation_deadline(uuid,timestamptz,text,boolean,timestamptz) to authenticated;
