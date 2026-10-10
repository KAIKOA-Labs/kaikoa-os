-- Synthetic role/JWT simulation. This is not a real browser-session test.
begin;
create temporary table drive_test_context(owner_id uuid,active_id uuid,archived_id uuid);
insert into drive_test_context
select substring(pg_get_functiondef('private.update_credential_record(uuid,jsonb,text,text,text,date,date,text,text,boolean)'::regprocedure) from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')::uuid,gen_random_uuid(),gen_random_uuid();
grant select on drive_test_context to authenticated,anon;
create temporary table drive_test_baseline as
select (select count(*) from public.entities) entities_count,(select count(*) from public.entity_change_history) entity_audits,
 (select count(*) from public.obligations) obligations_count,(select count(*) from public.obligation_change_history) obligation_audits;
insert into public.entities(id,slug,name,entity_type,subtype,status)
select active_id,'synthetic-drive-active-' || active_id::text,'Synthetic Drive test active','asset','other','REVIEW REQUIRED' from drive_test_context
union all select archived_id,'synthetic-drive-archived-' || archived_id::text,'Synthetic Drive test archived','asset','other','ARCHIVED' from drive_test_context;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true) is not null as owner_claims_set from drive_test_context;
set local role authenticated;
do $test$
declare r jsonb; v_id uuid; v_time timestamptz; v_note text := 'Synthetic harmless fixture for reference testing.';
 v_url text := 'https://drive.google.com/file/d/synthetic_file_030_12345/view';
 v_entity uuid; v_archived uuid; v_count bigint;
begin
 select active_id,archived_id into v_entity,v_archived from drive_test_context;
 r:=public.register_drive_reference('Synthetic Drive test','drive_reference',v_url,v_note,null,true,true);
 if not (r->>'created')::boolean then raise exception 'Expected creation'; end if;
 v_id:=(r->>'id')::uuid;
 select updated_at into v_time from public.documents where id=v_id;
 r:=public.register_drive_reference('Synthetic Drive test','drive_reference',v_url,v_note,null,true,true);
 if (r->>'created')::boolean or (r->>'linked')::boolean or (r->>'id')::uuid<>v_id then raise exception 'Retry was not a no-op'; end if;
 if (select updated_at from public.documents where id=v_id)<>v_time then raise exception 'No-op changed version'; end if;
 r:=public.register_drive_reference('Synthetic Drive test','drive_reference',v_url,v_note,v_entity,true,true);
 if (r->>'created')::boolean or not (r->>'linked')::boolean then raise exception 'Expected only a new related-record link'; end if;
 r:=public.register_drive_reference('Synthetic Drive test','drive_reference',v_url,v_note,v_entity,true,true);
 if (r->>'created')::boolean or (r->>'linked')::boolean then raise exception 'Link retry was not a no-op'; end if;
 if (select count(*) from public.document_change_history where document_id=v_id)<>2 then raise exception 'Incorrect creation/link audit count'; end if;
 if exists(select 1 from public.document_change_history where document_id=v_id and (actor_kind<>'owner' or changed_by is distinct from auth.uid())) then raise exception 'Incorrect owner attribution'; end if;
 if (select count(*) from public.document_links where document_id=v_id)<>1 then raise exception 'Duplicate link'; end if;
 if (select status from public.documents where id=v_id)<>'NEEDS_REVIEW' or (select metadata->>'content_imported' from public.documents where id=v_id)<>'false' then raise exception 'Incorrect evidence defaults'; end if;
 begin perform public.register_drive_reference('Different title','drive_reference',v_url,v_note,null,true,true); raise exception 'Conflict was accepted'; exception when serialization_failure then null; end;
 begin perform public.register_drive_reference('Synthetic Drive test','drive_reference',v_url,'Different source',null,true,true); raise exception 'Source conflict was accepted'; exception when serialization_failure then null; end;
 begin perform public.register_drive_reference('Synthetic Drive test','drive_reference',v_url,v_note,null,false,true); raise exception 'Unconfirmed save accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.register_drive_reference('Synthetic Drive test','drive_reference',v_url,v_note,null,true,false); raise exception 'Sensitive declaration accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.register_drive_reference('Synthetic Drive test','drive_reference',v_url,v_note,null,true,null); raise exception 'Null declaration accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.register_drive_reference('Synthetic Drive test','passport',v_url,v_note,null,true,true); raise exception 'Unsupported document type accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.register_drive_reference('Synthetic Drive test','drive_reference','https://evil.example/file/d/synthetic_file_030_12345/view',v_note,null,true,true); raise exception 'External URL accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.register_drive_reference('Synthetic Drive test','drive_reference',v_url || '?token=secret',v_note,null,true,true); raise exception 'Access query accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.register_drive_reference('Synthetic Drive test','drive_reference',v_url,v_note,v_archived,true,true); raise exception 'Archived link accepted'; exception when no_data_found then null; end;
 begin perform public.register_drive_reference('Synthetic Drive test','drive_reference',v_url,v_note,gen_random_uuid(),true,true); raise exception 'Missing related record accepted'; exception when no_data_found then null; end;
 r:=public.register_drive_reference('Synthetic folder','drive_library','https://drive.google.com/drive/folders/synthetic_folder_030_12345',v_note,null,true,true);
 if (select status from public.documents where id=(r->>'id')::uuid)<>'REFERENCE_ONLY' then raise exception 'Folder imported as evidence'; end if;
 begin perform public.register_drive_reference('Synthetic folder','drive_library','https://drive.google.com/drive/folders/synthetic_folder_030_12345',v_note,v_entity,true,true); raise exception 'Folder used as asset evidence'; exception when invalid_parameter_value then null; end;
 begin insert into public.documents(title,document_type) values('Disallowed direct write','test'); raise exception 'Direct document write accepted'; exception when insufficient_privilege then null; end;
 begin delete from public.document_change_history where document_id=v_id; raise exception 'History deletion accepted'; exception when insufficient_privilege then null; end;
end $test$;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true) is not null as non_owner_claims_set;
do $test$
begin
 if exists(select 1 from public.documents) or exists(select 1 from public.document_links) or exists(select 1 from public.document_change_history) then raise exception 'Non-owner data disclosure'; end if;
 begin perform public.register_drive_reference('Rejected test','drive_reference','https://drive.google.com/file/d/synthetic_nonowner_12345/view','Synthetic harmless fixture.',null,true,true); raise exception 'Non-owner save accepted'; exception when insufficient_privilege then null; end;
end $test$;
reset role;
select set_config('request.jwt.claims','{}',true) is not null as anonymous_claims_set;
set local role anon;
do $test$
begin
 begin perform * from public.documents; raise exception 'Anonymous document read accepted'; exception when insufficient_privilege then null; end;
 begin perform * from public.document_change_history; raise exception 'Anonymous audit read accepted'; exception when insufficient_privilege then null; end;
 begin perform public.register_drive_reference('Rejected anonymous','drive_reference','https://drive.google.com/file/d/synthetic_anonymous_12345/view','Synthetic harmless fixture.',null,true,true); raise exception 'Anonymous RPC accepted'; exception when insufficient_privilege then null; end;
end $test$;
reset role;
do $test$
declare b record;
begin
 select * into b from drive_test_baseline;
 if (select count(*) from public.entities)<>b.entities_count+2 or (select count(*) from public.entity_change_history)<>b.entity_audits
   or (select count(*) from public.obligations)<>b.obligations_count or (select count(*) from public.obligation_change_history)<>b.obligation_audits then raise exception 'Existing records or audits changed'; end if;
end $test$;
select 'PASS: synthetic owner/non-owner/anonymous, validation, retry, conflict, linking, audit and preservation assertions' result;
rollback;
