-- Bounded physical-print metadata endpoint; preserves existing edition editor and all other metadata.
do $m$
declare f text; owner_id text;
begin
 if to_regprocedure('public.update_artwork_print_registry(uuid,jsonb,jsonb)') is not null then raise exception 'Inspect existing print endpoint'; end if;
 f:=pg_get_functiondef('public.update_artwork_inventory(uuid,jsonb,jsonb)'::regprocedure);
 if position('SECURITY DEFINER' in f)=0 or position('Not authorized' in f)=0 then raise exception 'Inspect owner guard'; end if;
 owner_id:=substring(f from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
 if owner_id is null then raise exception 'Owner not found'; end if;
 execute replace($def$
create function public.update_artwork_print_registry(p_entity_id uuid,p_expected_registry jsonb,p_registry jsonb)
returns boolean language plpgsql security definer set search_path=''
as $body$
declare old_doc jsonb; rule jsonb; item jsonb; prior jsonb; latest jsonb; oldprint jsonb;
  label text; kind text; fingerprint text; keys text[]:=array[]::text[]; labels text[]:=array[]::text[];
  k text; v jsonb; n numeric; lim numeric; note text;
begin
 if auth.uid() is distinct from '__OWNER__'::uuid then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_registry is null or jsonb_typeof(p_registry)<>'object' or (p_registry-array['version','rules','prints'])<>'{}'::jsonb
   or not (p_registry ?& array['version','rules','prints']) or p_registry->'version'<>'1'::jsonb
   or jsonb_typeof(p_registry->'rules')<>'array' or jsonb_typeof(p_registry->'prints')<>'array'
   or jsonb_array_length(p_registry->'rules')>50 or jsonb_array_length(p_registry->'prints')>1000
 then raise exception 'Invalid print registry'; end if;
 for rule in select value from jsonb_array_elements(p_registry->'rules') loop
   if jsonb_typeof(rule)<>'object' or (rule-array['edition_label','numbered_limit','artist_proof_limit','reproduction_locked'])<>'{}'::jsonb
      or not (rule ?& array['edition_label','numbered_limit','artist_proof_limit','reproduction_locked']) then raise exception 'Invalid edition rule'; end if;
   label:=rule->>'edition_label';
   if jsonb_typeof(rule->'edition_label')<>'string' or length(label) not between 1 and 120 or trim(label)<>label
       or lower(label)=any(labels) or jsonb_typeof(rule->'reproduction_locked')<>'boolean' then raise exception 'Invalid edition rule'; end if;
   labels:=array_append(labels,lower(label));
   foreach k in array array['numbered_limit','artist_proof_limit'] loop
     v:=rule->k;
     if jsonb_typeof(v)<>'number' then raise exception 'Invalid edition limit'; end if;
     n:=(v::text)::numeric;
     if n<(case when k='numbered_limit' then 1 else 0 end) or n>1000000 or trunc(n)<>n then raise exception 'Invalid edition limit'; end if;
   end loop;
 end loop;
 for item in select value from jsonb_array_elements(p_registry->'prints') loop
   if jsonb_typeof(item)<>'object' or (item-array['edition_label','kind','number','production','location','availability','fulfillment','payment','allocation','source_note'])<>'{}'::jsonb
      or not (item ?& array['edition_label','kind','number','production','location','availability','fulfillment','payment','allocation','source_note'])
      then raise exception 'Invalid print record'; end if;
   label:=item->>'edition_label'; kind:=item->>'kind'; rule:=null;
   select value into rule from jsonb_array_elements(p_registry->'rules') where value->>'edition_label'=label limit 1;
   if rule is null or kind not in ('numbered','artist_proof') or jsonb_typeof(item->'number')<>'number'
     then raise exception 'Invalid edition reference'; end if;
   n:=(item->'number')::text::numeric;
   lim:=case when kind='numbered' then (rule->>'numbered_limit')::numeric else (rule->>'artist_proof_limit')::numeric end;
   if n<1 or n>lim or trunc(n)<>n then raise exception 'Print outside edition limit'; end if;
   fingerprint:=lower(label)||'|'||kind||'|'||n::text;
   if fingerprint=any(keys) then raise exception 'Duplicate physical print'; end if;
   keys:=array_append(keys,fingerprint);
   if jsonb_typeof(item->'production')<>'string'
     or jsonb_typeof(item->'availability')<>'string'
     or jsonb_typeof(item->'fulfillment')<>'string'
     or jsonb_typeof(item->'payment')<>'string'
     or item->>'production' not in ('unknown','printed_signed','framed_boxed')
     or item->>'availability' not in ('unknown','available','reserved','sold','gift')
     or item->>'fulfillment' not in ('unknown','held','awaiting_handover','shipped','delivered')
     or item->>'payment' not in ('unverified','reported_paid','verified_paid','not_applicable')
     then raise exception 'Invalid print status'; end if;
   foreach k in array array['location','allocation','source_note'] loop
     v:=item->k;
     if v='null'::jsonb then
       if k='source_note' then raise exception 'Source note required'; end if;
     else
       if jsonb_typeof(v)<>'string' then raise exception 'Invalid print text'; end if;
       note:=item->>k;
       if length(note)=0 or trim(note)<>note or length(note)>(case when k='source_note' then 1000 else 240 end)
         then raise exception 'Invalid print text'; end if;
     end if;
   end loop;
   if (item->>'availability'='reserved' and item->'allocation'='null'::jsonb)
     or (item->>'fulfillment'='delivered' and item->'location'='null'::jsonb)
     then raise exception 'Missing allocation or custody'; end if;
 end loop;
 select metadata->'artwork_print_registry' into old_doc from public.entities
   where id=p_entity_id and entity_type='asset' and subtype='artwork' and status<>'ARCHIVED' for update;
 if not found then raise exception 'Artwork not found'; end if;
 if old_doc is distinct from p_expected_registry then raise exception 'Print registry changed; reload before saving' using errcode='40001'; end if;
 if old_doc is not null then
   for prior in select value from jsonb_array_elements(old_doc->'rules') where value->'reproduction_locked'='true'::jsonb loop
     latest:=null;
     select value into latest from jsonb_array_elements(p_registry->'rules') where value->>'edition_label'=prior->>'edition_label' limit 1;
     if latest is distinct from prior then raise exception 'Locked edition cannot be changed'; end if;
     for oldprint in select value from jsonb_array_elements(old_doc->'prints') where value->>'edition_label'=prior->>'edition_label' loop
       if not exists(select 1 from jsonb_array_elements(p_registry->'prints') p where p.value->>'edition_label'=oldprint->>'edition_label'
          and p.value->>'kind'=oldprint->>'kind' and p.value->'number'=oldprint->'number')
          then raise exception 'Locked print cannot be deleted'; end if;
     end loop;
   end loop;
 end if;
 if old_doc is not distinct from p_registry then return false; end if;
 update public.entities set metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{artwork_print_registry}',p_registry),updated_at=now() where id=p_entity_id;
 insert into public.entity_change_history(entity_id,changed_by,field_name,previous_value,new_value)
 values(p_entity_id,auth.uid(),'artwork_print_registry',old_doc::text,p_registry::text);
 return true;
end;$body$;
$def$,'__OWNER__',owner_id);
end $m$;
revoke all on function public.update_artwork_print_registry(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.update_artwork_print_registry(uuid,jsonb,jsonb) to authenticated;
