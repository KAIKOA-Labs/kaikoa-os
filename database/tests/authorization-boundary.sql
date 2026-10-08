-- Run as the administrative SQL connection. Every check rolls back.
-- These are simulated database roles/JWT claims, not real-account HTTP tests.
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
do $test$
declare table_name text; total bigint; statement text;
begin
  foreach table_name in array array['entities','relationships','obligations','documents','document_links','events','entity_change_history','obligation_change_history'] loop
    execute format('select count(*) from public.%I',table_name) into total;
    if total<>0 then raise exception 'Non-owner can read %',table_name; end if;
  end loop;
  foreach statement in array array[
    'select public.archive_unverified_asset(''00000000-0000-4000-8000-000000000006''::uuid)',
    'select public.archive_unverified_obligation(''00000000-0000-4000-8000-000000000006''::uuid)',
    'select public.create_inventory_asset(''Security fixture'',''other'',''Fixture description'')',
    'select public.create_inventory_obligation(''00000000-0000-4000-8000-000000000006''::uuid,''Security fixture'',''Fixture action'',true)',
    'select public.update_safe_entity_description(''00000000-0000-4000-8000-000000000006''::uuid,''Fixture description'')',
    'select public.update_safe_obligation_next_action(''00000000-0000-4000-8000-000000000006''::uuid,''Fixture action'')',
    'select public.update_safe_obligation_status(''00000000-0000-4000-8000-000000000006''::uuid,''ATTENTION'')',
    'select public.update_obligation_workflow(''00000000-0000-4000-8000-000000000006''::uuid,''ATTENTION'',''Fixture action'',''Fixture context'',null,false,now())'
  ] loop
    begin
      execute statement;
      raise exception 'Non-owner RPC unexpectedly succeeded: %',statement;
    exception when others then
      if sqlerrm <> 'Not authorized' then raise; end if;
    end;
  end loop;
  foreach table_name in array array['entities','relationships','obligations','documents','document_links','events','entity_change_history','obligation_change_history'] loop
    if has_table_privilege('authenticated','public.'||table_name,'INSERT') or
       has_table_privilege('authenticated','public.'||table_name,'UPDATE') or
       has_table_privilege('authenticated','public.'||table_name,'DELETE') then
      raise exception 'Direct client writes granted: %',table_name;
    end if;
  end loop;
end $test$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $test$
declare table_name text; total bigint; function_name text;
begin
  foreach table_name in array array['entities','relationships','obligations','documents','document_links','events','entity_change_history','obligation_change_history'] loop
    begin
      execute format('select count(*) from public.%I',table_name) into total;
      if total<>0 then raise exception 'Anonymous can read %',table_name; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
  foreach function_name in array array[
    'public.archive_unverified_asset(uuid)', 'public.archive_unverified_obligation(uuid)',
    'public.create_inventory_asset(text,text,text)', 'public.create_inventory_obligation(uuid,text,text,boolean)',
    'public.update_safe_entity_description(uuid,text)', 'public.update_safe_obligation_next_action(uuid,text)',
    'public.update_safe_obligation_status(uuid,text)',
    'public.update_obligation_workflow(uuid,text,text,text,timestamp with time zone,boolean,timestamp with time zone)'
  ] loop
    if has_function_privilege('anon',function_name,'EXECUTE') then raise exception 'Anonymous RPC execute granted: %',function_name; end if;
  end loop;
end $test$;
rollback;
select 'Authorization assertions passed; transaction rolled back.' as result;
