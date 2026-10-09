-- Extend the existing audited owner-only creation contract; no table or data changes.
do $migration$
declare v_before text; v_after text;
begin
 v_before := pg_get_functiondef('public.create_inventory_obligation(uuid,text,text,boolean)'::regprocedure);
 if md5(v_before) <> '7e06833b7a40e857e2ec5188a64813e9' then
  raise exception 'Obligation creation baseline changed; inspect before migration';
 end if;
 v_after := replace(v_before,
  'if not exists(select 1 from public.entities where id=p_entity_id and status<>''ARCHIVED'') then raise exception ''Active related asset not found''; end if;',
  $replacement$if p_entity_id is not null then
  perform 1 from public.entities where id=p_entity_id and status<>'ARCHIVED' for share;
  if not found then raise exception 'Active related record not found' using errcode='P0002'; end if;
 end if;
 -- Serialize identical owner submissions before the duplicate read, including null links.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kaikoa:obligation:create:' || coalesce(p_entity_id::text,'general') || ':' || lower(v_title),0));$replacement$);
 v_after := replace(v_after,
  'if exists(select 1 from public.obligations where related_entity_id=p_entity_id and lower(title)=lower(v_title)) then raise exception ''Duplicate obligation title for this asset''; end if;',
  'if exists(select 1 from public.obligations where related_entity_id is not distinct from p_entity_id and lower(title)=lower(v_title)) then raise exception ''An obligation with this title already exists for this related record or general responsibilities'' using errcode=''23505''; end if;');
 if v_after=v_before or position('pg_advisory_xact_lock' in v_after)=0 or position('related_entity_id is not distinct from p_entity_id' in v_after)=0 then
  raise exception 'Creation replacement requires inspection';
 end if;
 execute v_after;
end $migration$;
-- CREATE OR REPLACE preserves ownership, search_path and existing EXECUTE grants.
