-- Tighten no-op recognition so malformed legacy review values are repairable.
do $migration$
declare v_before text; v_after text;
begin
 v_before := pg_get_functiondef('private.update_subscription_review(uuid,jsonb,text,text,text,boolean)'::regprocedure);
 if md5(v_before)<>'9ef6a00cf012db0d3952965994f6f506' then raise exception 'Review baseline changed; inspect before repair'; end if;
 v_after := replace(v_before,
  $old$if v_old->'version'='1'::jsonb and v_old-array$old$,
  $new$if jsonb_typeof(v_old->'usage')='string' and jsonb_typeof(v_old->'intention')='string' and jsonb_typeof(v_old->'note')='string'
  and (v_old->>'reviewed_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
  and v_old->'version'='1'::jsonb and v_old-array$new$);
 if v_after=v_before then raise exception 'Review no-op replacement failed'; end if;
 execute v_after;
end $migration$;
