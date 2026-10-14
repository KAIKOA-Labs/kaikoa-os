-- Private web-preview bucket only. No original masters, documents or public assets.
-- Derive the verified owner guard from the existing owner-authenticated RPC.
do $migration$
declare f text; owner_id text;
begin
  f := pg_get_functiondef('public.update_artwork_inventory(uuid,jsonb,jsonb)'::regprocedure);
  if position('SECURITY DEFINER' in f)=0 or position('Not authorized' in f)=0 then
    raise exception 'Artwork owner guard changed; inspect first';
  end if;
  owner_id := substring(f from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
  if owner_id is null then raise exception 'Owner identity unavailable'; end if;
  if exists(select 1 from storage.buckets where id='kaikoa-private-art-previews') then
    raise exception 'Preview bucket already exists; inspect current policies before migration';
  end if;
  insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
  values ('kaikoa-private-art-previews','kaikoa-private-art-previews',false,524288,array['image/webp']);
  -- Restrict exact known preview names, not arbitrary user paths.
  execute format($policy$
  create policy "kaikoa_art_preview_owner_select"
    on storage.objects for select to authenticated
    using (bucket_id='kaikoa-private-art-previews'
      and auth.uid()=%L::uuid
      and name ~ '^(karmic-bloom/primary|la-vie-en-rose/white|la-vie-en-rose/black|king-of-the-air/primary)\.webp$');
  $policy$,owner_id);
  execute format($policy$
  create policy "kaikoa_art_preview_owner_insert"
    on storage.objects for insert to authenticated
    with check (bucket_id='kaikoa-private-art-previews'
      and auth.uid()=%L::uuid
      and name ~ '^(karmic-bloom/primary|la-vie-en-rose/white|la-vie-en-rose/black|king-of-the-air/primary)\.webp$');
  $policy$,owner_id);
  execute format($policy$
  create policy "kaikoa_art_preview_owner_update"
    on storage.objects for update to authenticated
    using (bucket_id='kaikoa-private-art-previews' and auth.uid()=%L::uuid
      and name ~ '^(karmic-bloom/primary|la-vie-en-rose/white|la-vie-en-rose/black|king-of-the-air/primary)\.webp$')
    with check (bucket_id='kaikoa-private-art-previews' and auth.uid()=%L::uuid
      and name ~ '^(karmic-bloom/primary|la-vie-en-rose/white|la-vie-en-rose/black|king-of-the-air/primary)\.webp$');
  $policy$,owner_id,owner_id);
  execute format($policy$
  create policy "kaikoa_art_preview_owner_delete"
    on storage.objects for delete to authenticated
    using (bucket_id='kaikoa-private-art-previews' and auth.uid()=%L::uuid
      and name ~ '^(karmic-bloom/primary|la-vie-en-rose/white|la-vie-en-rose/black|king-of-the-air/primary)\.webp$');
  $policy$,owner_id);
end $migration$;
