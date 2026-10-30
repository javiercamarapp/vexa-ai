-- R2-14 (auditoría run-2; cierre F5, 29-oct): retención de vexa_platform.security_events y cupo propio para bearer_invalid y webhook_signature_invalid.
--  * Retención: la tabla es solo inserción y crecía sin límite (hasta 600 filas/min). vexa_platform.security_events_retain(keep, lote) borra por lotes las filas MÁS VIEJAS que `keep` (mínimo 30 días, 180 por omisión)
--    y los contadores de más de 2 días. El borrado pasa por append_only() solo si la función fija la variable local `vexa.retention` con la transacción en curso (propósito único: security_events, DELETE);
--    cualquier otro UPDATE/DELETE/TRUNCATE sigue rechazado. Solo vexa_backend ejecuta la función. Programación: supabase/operations/security-events-retention-cron.sql (la aplica Javier).
--  * Cupo: bearer_invalid y webhook_signature_invalid cuentan en su propio contador (120/min) y ya no en el global de 600/min, que un flujo de auth_401/forbidden_403 podía agotar para silenciarlos.
-- Reversión: ver supabase/operations/20261206_f5_seguridad.rollback.sql
begin;
set local lock_timeout='3s'; set local statement_timeout='30s';
create or replace function vexa_platform.append_only() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='security_events' and tg_op='DELETE' and current_setting('vexa.retention',true)='security_events:'||txid_current()::text then return old; end if;
 raise exception using errcode='42501',message=tg_table_name||'_append_only';
end $$;
create function vexa_platform.security_events_retain(p_keep interval default interval '180 days',p_batch int default 5000) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz; n int:=0; c int:=0;
begin
 if p_keep is null or p_keep<interval '30 days' then raise exception using errcode='22023',message='retention_window_too_short';end if;
 p_batch:=least(greatest(coalesce(p_batch,5000),1),20000);
 cutoff:=clock_timestamp()-p_keep;
 perform set_config('vexa.retention','security_events:'||txid_current()::text,true);
 with viejas as (select id from vexa_platform.security_events where at<cutoff order by id limit p_batch)
 delete from vexa_platform.security_events e using viejas v where e.id=v.id;
 get diagnostics n=row_count;
 perform set_config('vexa.retention','',true);
 delete from vexa_platform.security_event_counters where (kind,scope_hash,bucket) in(select k.kind,k.scope_hash,k.bucket from vexa_platform.security_event_counters k where k.bucket<clock_timestamp()-interval '2 days' limit p_batch);
 get diagnostics c=row_count;
 return jsonb_build_object('events_deleted',n,'counters_deleted',c,'more',n=p_batch);
end $$;
revoke all on function vexa_platform.security_events_retain(interval,int) from public,anon,authenticated,service_role;
grant usage on schema vexa_platform to vexa_backend;
grant execute on function vexa_platform.security_events_retain(interval,int) to vexa_backend;

create or replace function public.record_security_event(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=p->>'kind'; sev text; r text; m text; u text; iph text:=nullif(p->>'ip_hash',''); tid uuid; aid uuid; d jsonb:='{}'::jsonb; e record;
 allowed text[]:=array['code','status','format','rows','resource','operation','hits','scope','class','reason_code','minutes'];
 b timestamptz:=date_trunc('minute',clock_timestamp()); n1 int; n2 int; sc text; exempt boolean; own boolean; gk text; gcap int;
begin
 if p is null or jsonb_typeof(p)<>'object' or k is null or k not in('auth_401','forbidden_403','csrf_rejected','bearer_invalid','webhook_signature_invalid','rate_limited','support_start','support_end','support_blocked','export','invitation_sent','alert_raised','body_limit') then
  return jsonb_build_object('stored',false,'reason','invalid_kind');
 end if;
 sev:=case when p->>'severity' in('info','warn','high') then p->>'severity' else case k when 'bearer_invalid' then 'high' when 'webhook_signature_invalid' then 'high' when 'alert_raised' then 'high' when 'csrf_rejected' then 'warn' when 'auth_401' then 'warn' when 'forbidden_403' then 'warn' when 'support_blocked' then 'warn' when 'rate_limited' then 'warn' else 'info' end end;
 r:=left(regexp_replace(coalesce(p->>'route',''),'[?#].*$',''),200);
 m:=case when upper(coalesce(p->>'method','')) in('GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS') then upper(p->>'method') else null end;
 u:=nullif(left(regexp_replace(coalesce(p->>'ua',''),'[^\x20-\x7e]','','g'),120),'');
 if iph is not null and iph !~ '^[a-f0-9]{64}$' then iph:=null; end if;
 begin tid:=nullif(p->>'tenant_id','')::uuid; exception when others then tid:=null; end;
 begin aid:=nullif(p->>'actor_id','')::uuid; exception when others then aid:=null; end;
 if jsonb_typeof(p->'detail')='object' then
  for e in select key,value from jsonb_each(p->'detail') loop
   if e.key=any(allowed) then
    if jsonb_typeof(e.value)='number' then d:=d||jsonb_build_object(e.key,e.value);
    elsif jsonb_typeof(e.value)='boolean' then d:=d||jsonb_build_object(e.key,e.value);
    elsif jsonb_typeof(e.value)='string' and (e.value#>>'{}') ~ '^[A-Za-z0-9_.:/-]{0,64}$' and (e.value#>>'{}') !~* '^(eyj|bearer)' then d:=d||jsonb_build_object(e.key,e.value);
    end if;
   end if;
  end loop;
 end if;
 exempt:=k in('export','support_start','support_end','alert_raised','invitation_sent');
 -- R2-14: los eventos de credenciales inválidas (bearer, firma de webhook) tienen cupo PROPIO (120/min) y no compiten con el tope global de 600/min: 700 auth_401 de 250 huellas ya no los silencian.
 own:=k in('bearer_invalid','webhook_signature_invalid'); gk:=case when own then '*'||k else '*' end; gcap:=case when own then 120 else 600 end;
 sc:=coalesce(iph,aid::text,'-');
 perform pg_advisory_xact_lock(hashtextextended('sec-ev:'||k||':'||sc,0));
 insert into vexa_platform.security_event_counters(kind,scope_hash,bucket,hits) values(k,sc,b,1)
  on conflict(kind,scope_hash,bucket) do update set hits=vexa_platform.security_event_counters.hits+1 returning hits into n1;
 if not exempt then
  insert into vexa_platform.security_event_counters(kind,scope_hash,bucket,hits) values(gk,'*',b,1)
   on conflict(kind,scope_hash,bucket) do update set hits=vexa_platform.security_event_counters.hits+1 returning hits into n2;
  if n2>gcap then return jsonb_build_object('stored',false,'reason','global_cap','hits',n1); end if;
  if n1>3 and n1 not in(10,100,1000,10000,100000) then return jsonb_build_object('stored',false,'reason','sampled','hits',n1); end if;
  if n1>3 then d:=d||jsonb_build_object('hits',n1); end if;
 end if;
 delete from vexa_platform.security_event_counters where (kind,scope_hash,bucket) in(select c.kind,c.scope_hash,c.bucket from vexa_platform.security_event_counters c where c.bucket<clock_timestamp()-interval '1 day' limit 200);
 insert into vexa_platform.security_events(kind,severity,route,method,tenant_id,actor_id,ip_hash,ua,detail) values(k,sev,nullif(r,''),m,tid,aid,iph,u,d);
 return jsonb_build_object('stored',true,'hits',n1);
end $$;

revoke all on function public.record_security_event(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_security_event(jsonb) to vexa_backend;
commit;
