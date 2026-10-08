-- Additive upgrade of the existing universal obligation model.
-- Reuse the verified owner guard; do not publish a personal owner identifier.
alter table public.obligations
  add column workflow_note text,
  add column scheduled_at timestamptz,
  add column completed_at timestamptz;
alter table public.obligations
  add constraint obligation_workflow_note_length check (char_length(workflow_note) <= 1000),
  add constraint obligation_schedule_required check (status <> 'SCHEDULED' or scheduled_at is not null),
  add constraint obligation_completion_required check (status <> 'COMPLETED' or completed_at is not null);
comment on column public.obligations.scheduled_at is 'Owner-entered schedule, distinct from due_at; never inferred.';
comment on column public.obligations.completed_at is 'Time completion was explicitly recorded, not inferred repair or payment time.';

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

do $migration$
declare
  v_existing text;
  v_owner text;
  v_definition text;
begin
  v_existing := pg_get_functiondef('public.update_safe_obligation_status(uuid,text)'::regprocedure);
  v_owner := substring(v_existing from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
  if v_owner is null or position('auth.uid() is distinct from' in v_existing) = 0 then
    raise exception 'Existing owner authorization guard requires review';
  end if;
  v_definition := $definition$
create function private.update_obligation_workflow(
  p_obligation_id uuid,
  p_status text,
  p_next_action text,
  p_workflow_note text,
  p_scheduled_at timestamptz,
  p_confirm_completion boolean,
  p_expected_updated_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_old public.obligations%rowtype;
  v_new public.obligations%rowtype;
  v_action text := trim(coalesce(p_next_action, ''));
  v_note text := nullif(trim(coalesce(p_workflow_note, '')), '');
  v_attention boolean;
  v_completed timestamptz;
begin
  if auth.uid() is distinct from __EXISTING_OWNER__ then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('ATTENTION','WAITING_ON','IN_PROGRESS','SCHEDULED','COMPLETED','DEFERRED','UPCOMING') then
    raise exception 'Unsupported workflow status' using errcode = '22023';
  end if;
  if char_length(v_action) < 1 or char_length(v_action) > 1000 or char_length(v_note) > 1000 then
    raise exception 'Action and context must be at most 1000 characters; action is required' using errcode = '22023';
  end if;
  select * into v_old from public.obligations where id = p_obligation_id and status <> 'ARCHIVED' for update;
  if not found then raise exception 'Editable obligation not found' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null or p_expected_updated_at is distinct from v_old.updated_at then
    raise exception 'Record changed; reload before editing' using errcode = '40001';
  end if;
  -- Retain existing UPCOMING records without inventing a confirmed schedule.
  if p_status = 'UPCOMING' and v_old.status <> 'UPCOMING' then
    raise exception 'Choose a workflow state' using errcode = '22023';
  end if;
  if p_status in ('WAITING_ON','SCHEDULED','COMPLETED','DEFERRED') and coalesce(char_length(v_note), 0) < 4 then
    raise exception 'Workflow context is required' using errcode = '22023';
  end if;
  if (p_status = 'SCHEDULED' and (p_scheduled_at is null or not isfinite(p_scheduled_at)))
     or (p_status <> 'SCHEDULED' and p_scheduled_at is not null) then
    raise exception 'A finite scheduled time is required only for Scheduled' using errcode = '22023';
  end if;
  if p_status = 'COMPLETED' and v_old.status <> 'COMPLETED' and p_confirm_completion is distinct from true then
    raise exception 'Explicit completion confirmation is required' using errcode = '22023';
  end if;
  v_attention := case when p_status = 'UPCOMING' then v_old.requires_owner_attention else p_status = 'ATTENTION' end;
  v_completed := case when p_status = 'COMPLETED' then coalesce(v_old.completed_at, clock_timestamp()) else null end;
  if (v_old.status,v_old.next_action,v_old.workflow_note,v_old.scheduled_at,v_old.completed_at,v_old.requires_owner_attention)
     is not distinct from (p_status,v_action,v_note,p_scheduled_at,v_completed,v_attention) then
    return to_jsonb(v_old);
  end if;
  update public.obligations set status = p_status, next_action = v_action,
    workflow_note = v_note, scheduled_at = p_scheduled_at, completed_at = v_completed,
    requires_owner_attention = v_attention, updated_at = clock_timestamp()
    where id = p_obligation_id returning * into v_new;
  insert into public.obligation_change_history(obligation_id,changed_by,field_name,previous_value,new_value)
    select p_obligation_id,auth.uid(),field.key,to_jsonb(v_old)->>field.key,to_jsonb(v_new)->>field.key
    from unnest(array['status','next_action','workflow_note','scheduled_at','completed_at','requires_owner_attention']) as field(key)
    where (to_jsonb(v_old)->field.key) is distinct from (to_jsonb(v_new)->field.key);
  return to_jsonb(v_new);
end $function$;
$definition$;
  execute replace(v_definition, '__EXISTING_OWNER__', format('%L::uuid', v_owner));
  -- Existing clients must use the same state validation and audit rules.
  v_definition := $definition$
create or replace function public.update_safe_obligation_status(p_obligation_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_old public.obligations%rowtype;
begin
  if auth.uid() is distinct from __EXISTING_OWNER__ then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('ATTENTION','UPCOMING','IN_PROGRESS','WAITING_ON') then raise exception 'Unsupported status'; end if;
  select * into v_old from public.obligations where id=p_obligation_id and visibility='safe_preview' and status not in ('ARCHIVED','COMPLETED') for update;
  if not found then raise exception 'Editable obligation not found'; end if;
  if v_old.status=p_status then return false; end if;
  perform public.update_obligation_workflow(p_obligation_id,p_status,v_old.next_action,v_old.workflow_note,null,false,v_old.updated_at);
  return true;
end $function$;
$definition$;
  execute replace(v_definition, '__EXISTING_OWNER__', format('%L::uuid', v_owner));
  -- Prevent the legacy action-only RPC from modifying terminal records.
  v_existing := pg_get_functiondef('public.update_safe_obligation_next_action(uuid,text)'::regprocedure);
  if position('visibility=''safe_preview''' in v_existing) = 0 then raise exception 'Legacy editor requires review'; end if;
  execute replace(v_existing, 'visibility=''safe_preview''', 'visibility=''safe_preview'' and status not in (''ARCHIVED'',''COMPLETED'')');
end $migration$;
create function public.update_obligation_workflow(
  p_obligation_id uuid, p_status text, p_next_action text, p_workflow_note text,
  p_scheduled_at timestamptz, p_confirm_completion boolean, p_expected_updated_at timestamptz
) returns jsonb language sql security invoker set search_path = ''
as $function$
  select private.update_obligation_workflow(p_obligation_id,p_status,p_next_action,p_workflow_note,
    p_scheduled_at,p_confirm_completion,p_expected_updated_at);
$function$;
revoke all on function private.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz) from public, anon;
grant execute on function private.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz) to authenticated;
revoke all on function public.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz) from public, anon;
grant execute on function public.update_obligation_workflow(uuid,text,text,text,timestamptz,boolean,timestamptz) to authenticated;
-- Existing grants and all owner-only SELECT policies remain unchanged.
