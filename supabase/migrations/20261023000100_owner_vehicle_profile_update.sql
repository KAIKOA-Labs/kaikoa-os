-- Owner-only audited updates for existing linked vehicle_profile documents.
create or replace function public.update_vehicle_profile(
 p_entity_id uuid, p_expected_profile jsonb, p_next_profile jsonb, p_source_note text, p_confirm boolean
) returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
 v_doc uuid; v_metadata jsonb; v_old jsonb; v_new jsonb;
 v_note text := trim(coalesce(p_source_note,''));
 v_draft jsonb; v_date text; v_key text;
begin
 if auth.uid() is distinct from '71c79582-5e00-4ac7-89d6-d098ac96da9e'::uuid then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 if p_confirm is distinct from true or char_length(v_note) not between 8 and 1000 or v_note ~ '[[:cntrl:]]' then
  raise exception 'Review and confirm the source note' using errcode='22023';
 end if;
 perform 1 from public.entities where id=p_entity_id and subtype='vehicle' and status <> 'ARCHIVED' for update;
 if not found then raise exception 'Active vehicle not found' using errcode='P0002'; end if;
 select d.id,d.metadata into v_doc,v_metadata from public.documents d
 join public.document_links l on l.document_id=d.id
 where l.entity_id=p_entity_id and l.obligation_id is null and d.document_type='vehicle_profile' and d.status <> 'ARCHIVED'
 for update of d;
 if v_doc is null then raise exception 'Existing vehicle profile not found' using errcode='P0002'; end if;
 v_old := v_metadata->'vehicle_profile';
 if v_old is distinct from p_expected_profile then
  raise exception 'Vehicle profile changed; reload before saving' using errcode='40001';
 end if;
 if jsonb_typeof(p_next_profile) is distinct from 'object' or
    (select count(*) from jsonb_object_keys(p_next_profile)) <> 13 or
    not p_next_profile ?& array['display_name','current_base','registration_plate','condition','registration','insurance',
       'registration_expires_on','insurance_expires_on','serviced_on','service_interval','checked_on','owner_ready','maintenance_note'] then
  raise exception 'Invalid vehicle fields' using errcode='22023';
 end if;
 if char_length(trim(coalesce(p_next_profile->>'display_name',''))) not between 1 and 120
    or char_length(coalesce(p_next_profile->>'current_base','')) > 120
    or char_length(coalesce(p_next_profile->>'registration_plate','')) > 30
    or p_next_profile->>'condition' not in ('unknown','excellent','good','needs_work')
    or p_next_profile->>'registration' not in ('unknown','current','needs_review')
    or p_next_profile->>'insurance' not in ('unknown','paid','unpaid')
    or p_next_profile->>'service_interval' not in ('unknown','annual')
    or jsonb_typeof(p_next_profile->'owner_ready') <> 'boolean'
    or char_length(coalesce(p_next_profile->>'maintenance_note','')) > 500 then
  raise exception 'Invalid vehicle profile values' using errcode='22023';
 end if;
 foreach v_key in array array['registration_expires_on','insurance_expires_on','serviced_on','checked_on'] loop
  v_date := p_next_profile->>v_key;
  if v_date is not null then
   if v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid date' using errcode='22023'; end if;
   begin perform v_date::date; exception when others then raise exception 'Invalid date' using errcode='22023'; end;
  end if;
 end loop;
 if (p_next_profile->>'owner_ready')::boolean and
    (p_next_profile->>'condition' not in ('good','excellent') or
     p_next_profile->>'registration' <> 'current' or
     p_next_profile->>'insurance' <> 'paid' or
     (p_next_profile->>'checked_on') is null or
     (p_next_profile->>'registration_expires_on') is null or
     (p_next_profile->>'insurance_expires_on') is null or
     (p_next_profile->>'registration_expires_on')::date < current_date or
     (p_next_profile->>'insurance_expires_on')::date < current_date) then
   raise exception 'Owner-ready requires current registration, insurance and a dated check' using errcode='22023';
 end if;
 v_new := p_next_profile || jsonb_build_object('version',1,'recorded_at',clock_timestamp(),'source_note',v_note);
 if (v_old - 'recorded_at') = (v_new - 'recorded_at') then return jsonb_build_object('changed',false,'vehicle_profile',v_old); end if;
 update public.documents set metadata=jsonb_set(v_metadata,'{vehicle_profile}',v_new,true),updated_at=clock_timestamp() where id=v_doc;
 insert into public.document_change_history(document_id,changed_by,actor_kind,field_name,previous_value,new_value,source_note)
 values(v_doc,auth.uid(),'owner','vehicle_profile',v_old,v_new,v_note);
 return jsonb_build_object('changed',true,'vehicle_profile',v_new);
end;
$fn$;
revoke all on function public.update_vehicle_profile(uuid,jsonb,jsonb,text,boolean) from public,anon;
grant execute on function public.update_vehicle_profile(uuid,jsonb,jsonb,text,boolean) to authenticated;