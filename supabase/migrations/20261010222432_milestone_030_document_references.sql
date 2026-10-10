-- References only: no file bytes, OAuth tokens, extracted facts or secret identifiers.
-- Resolve the inspected existing owner guard without committing the private owner UUID.
do $migration$
declare v_guard text; v_owner text;
begin
  v_guard := pg_get_functiondef('private.update_credential_record(uuid,jsonb,text,text,text,date,date,text,text,boolean)'::regprocedure);
  if md5(v_guard) <> '702bd2007ac58da67329f020c24a49c2' then raise exception 'Existing owner guard changed; inspect before migration'; end if;
  v_owner := substring(v_guard from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
  if v_owner is null then raise exception 'Owner guard unavailable'; end if;

  create table public.document_change_history (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.documents(id),
    changed_by uuid,
    actor_kind text not null check (actor_kind in ('owner','agent')),
    field_name text not null,
    previous_value jsonb,
    new_value jsonb,
    source_note text not null check (char_length(source_note) between 4 and 1000),
    changed_at timestamptz not null default now(),
    check ((actor_kind = 'owner' and changed_by is not null) or (actor_kind = 'agent' and changed_by is null))
  );
  alter table public.document_change_history enable row level security;
  revoke all on public.document_change_history from public,anon,authenticated;
  grant select on public.document_change_history to authenticated;
  execute format('create policy authenticated_read_document_history on public.document_change_history for select to authenticated using (auth.uid() = %L::uuid)',v_owner);

  create unique index documents_drive_ref_unique on public.documents(external_ref) where external_provider = 'google_drive';
  create unique index document_links_entity_unique on public.document_links(document_id,entity_id) where entity_id is not null and obligation_id is null;

  execute replace($definition$
create function private.register_drive_reference(
  p_title text,p_document_type text,p_drive_url text,p_source_note text,p_entity_id uuid,p_confirm boolean,p_non_sensitive boolean
)
returns jsonb language plpgsql security definer set search_path = ''
as $body$
declare
  v_title text := trim(coalesce(p_title,''));
  v_note text := trim(coalesce(p_source_note,''));
  v_url text := trim(coalesce(p_drive_url,''));
  v_ref text; v_canonical text; v_existing public.documents%rowtype;
  v_id uuid; v_created boolean := false; v_linked boolean := false; v_new jsonb;
begin
  if auth.uid() is distinct from '__OWNER__'::uuid then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_confirm is distinct from true or p_non_sensitive is distinct from true then
    raise exception 'Confirm a non-sensitive reference' using errcode='22023';
  end if;
  if char_length(v_title) not between 2 and 120 or char_length(v_note) not between 4 and 1000
    or v_title ~ '[[:cntrl:]]' or v_note ~ '[[:cntrl:]]' or char_length(v_url)>500
    or p_document_type is null or p_document_type not in ('drive_library','drive_private_vault','drive_reference') then
    raise exception 'Invalid reference details' using errcode='22023';
  end if;
  -- The browser sends canonical URLs; backend validation is independent.
  if p_document_type in ('drive_library','drive_private_vault') then
    v_ref := substring(v_url from '^https://drive[.]google[.]com/drive/folders/([A-Za-z0-9_-]{10,200})$');
    v_canonical := 'https://drive.google.com/drive/folders/' || v_ref;
  else
    v_ref := substring(v_url from '^https://drive[.]google[.]com/file/d/([A-Za-z0-9_-]{10,200})/view$');
    v_canonical := 'https://drive.google.com/file/d/' || v_ref || '/view';
  end if;
  if v_ref is null or v_canonical is distinct from v_url then raise exception 'Use a canonical Drive link' using errcode='22023'; end if;
  if p_entity_id is not null then
    if p_document_type <> 'drive_reference' then raise exception 'Folder links cannot be evidence for an asset' using errcode='22023'; end if;
    perform 1 from public.entities where id=p_entity_id and status <> 'ARCHIVED' for share;
    if not found then raise exception 'Active related record not found' using errcode='P0002'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('google_drive:' || v_ref,0));
  select * into v_existing from public.documents where external_provider='google_drive' and external_ref=v_ref for update;
  if found then
    if v_existing.title is distinct from v_title or v_existing.document_type is distinct from p_document_type
      or v_existing.source_url is distinct from v_canonical or v_existing.status='ARCHIVED'
      or v_existing.metadata->>'source_note' is distinct from v_note then
      raise exception 'This Drive reference already exists with different details; review it before proceeding' using errcode='40001';
    end if;
    v_id := v_existing.id;
  else
    insert into public.documents(title,document_type,external_provider,external_ref,source_url,status,metadata)
    values(v_title,p_document_type,'google_drive',v_ref,v_canonical,
      case when p_document_type='drive_reference' then 'NEEDS_REVIEW' else 'REFERENCE_ONLY' end,
      jsonb_build_object('version',1,'source_note',v_note,'recorded_by','owner','recorded_at',clock_timestamp(),'content_imported',false,'provider_access','not_authorized'))
    returning id into v_id;
    v_created := true;
    v_new := jsonb_build_object('title',v_title,'document_type',p_document_type,'external_ref',v_ref,'source_url',v_canonical);
    insert into public.document_change_history(document_id,changed_by,actor_kind,field_name,new_value,source_note)
    values(v_id,auth.uid(),'owner','reference_created',v_new,v_note);
  end if;
  if p_entity_id is not null then
    insert into public.document_links(document_id,entity_id,relationship_type)
    values(v_id,p_entity_id,'EVIDENCE_FOR') on conflict (document_id,entity_id) where entity_id is not null and obligation_id is null do nothing;
    if found then
      v_linked := true;
      insert into public.document_change_history(document_id,changed_by,actor_kind,field_name,new_value,source_note)
      values(v_id,auth.uid(),'owner','entity_link_created',jsonb_build_object('entity_id',p_entity_id),v_note);
    end if;
  end if;
  return jsonb_build_object('id',v_id,'created',v_created,'linked',v_linked);
end $body$;
$definition$,'__OWNER__',v_owner);
end $migration$;

create function public.register_drive_reference(p_title text,p_document_type text,p_drive_url text,p_source_note text,p_entity_id uuid,p_confirm boolean,p_non_sensitive boolean)
returns jsonb language sql security invoker set search_path = ''
as $body$ select private.register_drive_reference(p_title,p_document_type,p_drive_url,p_source_note,p_entity_id,p_confirm,p_non_sensitive); $body$;
revoke all on function private.register_drive_reference(text,text,text,text,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function private.register_drive_reference(text,text,text,text,uuid,boolean,boolean) to authenticated;
revoke all on function public.register_drive_reference(text,text,text,text,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.register_drive_reference(text,text,text,text,uuid,boolean,boolean) to authenticated;
