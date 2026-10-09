-- Add one guarded, audited metadata endpoint; no tables, records or existing RPCs change.
-- Reuse the inspected fixed-owner guard without publishing the owner's identifier.
do $migration$
declare v_baseline text; v_owner text;
begin
  v_baseline := pg_get_functiondef('public.create_inventory_asset(text,text,text)'::regprocedure);
  if md5(v_baseline) <> '994c27249f70f45eb088732990569e10' then
    raise exception 'Inventory owner-guard baseline changed; inspect before migration';
  end if;
  v_owner := substring(v_baseline from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
  if v_owner is null or to_regprocedure('public.update_artwork_inventory(uuid,jsonb,jsonb)') is not null then
    raise exception 'Artwork endpoint baseline requires inspection';
  end if;
  execute replace($definition$
create function public.update_artwork_inventory(p_entity_id uuid, p_expected_inventory jsonb, p_inventory jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $body$
declare
  v_old jsonb; v_row jsonb; v_ap jsonb; v_seen text[] := array[]::text[];
  v_label text; v_value jsonb; v_limit numeric; v_printed numeric;
  v_key text; v_date text;
begin
  if auth.uid() is distinct from '__OWNER__'::uuid then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_inventory is null or jsonb_typeof(p_inventory) <> 'object'
    or (p_inventory - array['version','editions','artist_proofs']) <> '{}'::jsonb
    or not (p_inventory ?& array['version','editions','artist_proofs'])
    or p_inventory->'version' <> '1'::jsonb then raise exception 'Invalid artwork inventory'; end if;
  if jsonb_typeof(p_inventory->'editions') <> 'array' then raise exception 'Invalid editions'; end if;
  if jsonb_array_length(p_inventory->'editions') > 50 then raise exception 'Too many editions'; end if;
  v_ap := p_inventory->'artist_proofs';
  if jsonb_typeof(v_ap) <> 'object' or (v_ap - array['allowance','printed_count','image_size','source_note','source_date']) <> '{}'::jsonb
    or not (v_ap ?& array['allowance','printed_count','image_size','source_note','source_date']) then raise exception 'Invalid artist proofs'; end if;
  for v_row in select value from jsonb_array_elements(p_inventory->'editions') loop
    if jsonb_typeof(v_row) <> 'object' or (v_row - array['label','image_size','edition_limit','printed_count','source_note','source_date']) <> '{}'::jsonb
      or not (v_row ?& array['label','image_size','edition_limit','printed_count','source_note','source_date']) then raise exception 'Invalid edition'; end if;
    if jsonb_typeof(v_row->'label') <> 'string' then raise exception 'Invalid edition label'; end if;
    v_label := v_row->>'label';
    if char_length(v_label) not between 1 and 120 or trim(v_label) <> v_label or v_label = '' then raise exception 'Invalid edition label'; end if;
    if lower(v_label) = any(v_seen) then raise exception 'Duplicate edition label'; end if;
    v_seen := array_append(v_seen,lower(v_label));
  end loop;
  -- The same validation applies to edition counts and the separate artwork-wide AP allowance.
  for v_row in select value from jsonb_array_elements((p_inventory->'editions') || jsonb_build_array(v_ap)) loop
    foreach v_key in array array['image_size','source_note'] loop
      if jsonb_typeof(v_row->v_key) <> 'string' or trim(v_row->>v_key) <> (v_row->>v_key)
        or char_length(v_row->>v_key) > (case when v_key='image_size' then 120 else 1000 end) then raise exception 'Invalid source text'; end if;
    end loop;
    if v_row ? 'label' and v_row->>'source_note' = '' then raise exception 'Edition source note required'; end if;
    if not (v_row ? 'label') and (v_row->'allowance' <> 'null'::jsonb or v_row->'printed_count' <> 'null'::jsonb
      or v_row->>'image_size' <> '' or v_row->'source_date' <> 'null'::jsonb) and v_row->>'source_note' = '' then raise exception 'Artist proof source note required'; end if;
    v_limit := null; v_printed := null;
    foreach v_key in array array[case when v_row ? 'label' then 'edition_limit' else 'allowance' end,'printed_count'] loop
      v_value := v_row->v_key;
      if v_value <> 'null'::jsonb then
        if jsonb_typeof(v_value) <> 'number' then raise exception 'Invalid count'; end if;
        if (v_value::text)::numeric < (case when v_key='edition_limit' then 1 else 0 end)
          or (v_value::text)::numeric > 1000000 or trunc((v_value::text)::numeric) <> (v_value::text)::numeric then raise exception 'Invalid count'; end if;
        if v_key='printed_count' then v_printed := (v_value::text)::numeric; else v_limit := (v_value::text)::numeric; end if;
      end if;
    end loop;
    if v_limit is not null and v_printed is not null and v_printed > v_limit then raise exception 'Printed count exceeds limit'; end if;
    if v_row->'source_date' <> 'null'::jsonb then
      v_date := v_row->>'source_date';
      if jsonb_typeof(v_row->'source_date') <> 'string' or v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or left(v_date,4)='0000' then raise exception 'Invalid source date'; end if;
      if to_char(v_date::date,'YYYY-MM-DD') <> v_date then raise exception 'Invalid source date'; end if;
    end if;
  end loop;
  select metadata->'artwork_inventory' into v_old from public.entities
    where id=p_entity_id and entity_type='asset' and subtype='artwork' and status <> 'ARCHIVED' for update;
  if not found then raise exception 'Artwork not found'; end if;
  if v_old is distinct from p_expected_inventory then raise exception 'Artwork inventory changed; reload before saving' using errcode='40001'; end if;
  if v_old is not distinct from p_inventory then return false; end if;
  update public.entities set metadata=jsonb_set(metadata,'{artwork_inventory}',p_inventory), updated_at=now() where id=p_entity_id;
  insert into public.entity_change_history(entity_id,changed_by,field_name,previous_value,new_value)
    values(p_entity_id,auth.uid(),'artwork_inventory',v_old::text,p_inventory::text);
  return true;
end; $body$;
$definition$, '__OWNER__', v_owner);
end $migration$;
revoke all on function public.update_artwork_inventory(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.update_artwork_inventory(uuid,jsonb,jsonb) to authenticated;
