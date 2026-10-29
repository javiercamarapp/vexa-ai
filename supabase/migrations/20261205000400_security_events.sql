-- Registro mínimo de eventos de seguridad (auditoría 3, R-1/R-3/A-1; cierre 29-oct).
--  * vexa_platform.security_events: SOLO INSERCIÓN (disparador anti UPDATE/DELETE/TRUNCATE), RLS forzada, sin acceso directo a nadie.
--    La escribe public.record_security_event (solo vexa_backend) y la leen los administradores de plataforma por public.platform_security_events.
--  * Sin PII ni secretos por construcción: IP solo como HMAC (lo calcula el servidor con sal del entorno), agente de usuario truncado a 120 sin controles,
--    ruta sin consulta (<=200), y detalle con lista blanca de claves y valores de código corto (letras, números y _ . : / -). Lo demás se descarta.
--  * Muestreo y deduplicación: contadores por minuto por (tipo, huella). Se guardan los 3 primeros eventos del minuto y luego solo las potencias de 10
--    (con el total en detail.hits); un tope global de 600 por minuto. Los contadores (exactos) alimentan las alertas por umbral.
--  * Dispara además la inmutabilidad de vexa_platform.audit y public.team_audit (como cfo_access_log) y enmascara correos/teléfonos del motivo de soporte.
-- Reversión: drop function public.record_security_event(jsonb),public.platform_security_events(jsonb),public.platform_security_alerts(interval);
--  drop table vexa_platform.security_event_counters,vexa_platform.security_events; drop trigger audit_append_only on vexa_platform.audit; drop trigger team_audit_append_only on public.team_audit;
--  drop trigger audit_mask_reason on vexa_platform.audit. (La tabla de eventos solo se puede borrar con DROP: los disparadores no impiden DDL.)
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table vexa_platform.security_events(
 id bigint generated always as identity primary key,
 at timestamptz not null default clock_timestamp(),
 kind text not null check(kind in('auth_401','forbidden_403','csrf_rejected','bearer_invalid','webhook_signature_invalid','rate_limited','support_start','support_end','support_blocked','export','invitation_sent','alert_raised','body_limit')),
 severity text not null check(severity in('info','warn','high')),
 route text check(route is null or length(route)<=200),
 method text check(method is null or method in('GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS')),
 tenant_id uuid, actor_id uuid,
 ip_hash text check(ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$'),
 ua text check(ua is null or length(ua)<=120),
 detail jsonb not null default '{}'::jsonb check(jsonb_typeof(detail)='object' and octet_length(detail::text)<=1024)
);
create index security_events_recent on vexa_platform.security_events(at desc);
create index security_events_kind on vexa_platform.security_events(kind,at desc);
create table vexa_platform.security_event_counters(
 kind text not null, scope_hash text not null, bucket timestamptz not null, hits integer not null default 0,
 primary key(kind,scope_hash,bucket)
);
create index security_event_counters_bucket on vexa_platform.security_event_counters(bucket);
alter table vexa_platform.security_events enable row level security;
alter table vexa_platform.security_events force row level security;
alter table vexa_platform.security_event_counters enable row level security;
alter table vexa_platform.security_event_counters force row level security;
revoke all on vexa_platform.security_events,vexa_platform.security_event_counters from public,anon,authenticated,service_role,vexa_backend;

create function vexa_platform.append_only() returns trigger language plpgsql set search_path='' as $$
begin raise exception using errcode='42501',message=tg_table_name||'_append_only'; end $$;
create trigger security_events_append_only before update or delete on vexa_platform.security_events for each row execute function vexa_platform.append_only();
create trigger security_events_no_truncate before truncate on vexa_platform.security_events for each statement execute function vexa_platform.append_only();
-- A-1: las bitácoras de plataforma y de equipo también pasan a solo inserción (ninguna función las actualiza ni borra: verificado con grep de las migraciones).
create trigger audit_append_only before update or delete on vexa_platform.audit for each row execute function vexa_platform.append_only();
create trigger team_audit_append_only before update or delete on public.team_audit for each row execute function vexa_platform.append_only();
-- R-4: el motivo de soporte es texto libre; se enmascaran correos y secuencias largas de dígitos (teléfonos, documentos). ownerEmail NO se toca aquí: la
-- repetición idempotente de 'create' compara details con el correo en claro (ver INFORME, aplazado con motivo).
create function vexa_platform.mask_audit_reason() returns trigger language plpgsql set search_path='' as $$
begin
 if new.details ? 'reason' and jsonb_typeof(new.details->'reason')='string' then
  new.details=jsonb_set(new.details,'{reason}',to_jsonb(regexp_replace(regexp_replace(new.details->>'reason','[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','[correo]','g'),'[0-9][0-9 ()+.-]{6,}[0-9]','[numero]','g')));
 end if;
 return new;
end $$;
create trigger audit_mask_reason before insert on vexa_platform.audit for each row execute function vexa_platform.mask_audit_reason();

-- Escritura: sanea, cuenta, muestrea e inserta. Nunca lanza por datos malos (los descarta) para no romper al llamador.
create function public.record_security_event(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=p->>'kind'; sev text; r text; m text; u text; iph text:=nullif(p->>'ip_hash',''); tid uuid; aid uuid; d jsonb:='{}'::jsonb; e record;
 allowed text[]:=array['code','status','format','rows','resource','operation','hits','scope','class','reason_code','minutes'];
 b timestamptz:=date_trunc('minute',clock_timestamp()); n1 int; n2 int; sc text; exempt boolean;
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
 sc:=coalesce(iph,aid::text,'-');
 perform pg_advisory_xact_lock(hashtextextended('sec-ev:'||k||':'||sc,0));
 insert into vexa_platform.security_event_counters(kind,scope_hash,bucket,hits) values(k,sc,b,1)
  on conflict(kind,scope_hash,bucket) do update set hits=vexa_platform.security_event_counters.hits+1 returning hits into n1;
 if not exempt then
  insert into vexa_platform.security_event_counters(kind,scope_hash,bucket,hits) values('*','*',b,1)
   on conflict(kind,scope_hash,bucket) do update set hits=vexa_platform.security_event_counters.hits+1 returning hits into n2;
  if n2>600 then return jsonb_build_object('stored',false,'reason','global_cap','hits',n1); end if;
  if n1>3 and n1 not in(10,100,1000,10000,100000) then return jsonb_build_object('stored',false,'reason','sampled','hits',n1); end if;
  if n1>3 then d:=d||jsonb_build_object('hits',n1); end if;
 end if;
 delete from vexa_platform.security_event_counters where (kind,scope_hash,bucket) in(select c.kind,c.scope_hash,c.bucket from vexa_platform.security_event_counters c where c.bucket<clock_timestamp()-interval '1 day' limit 200);
 insert into vexa_platform.security_events(kind,severity,route,method,tenant_id,actor_id,ip_hash,ua,detail) values(k,sev,nullif(r,''),m,tid,aid,iph,u,d);
 return jsonb_build_object('stored',true,'hits',n1);
end $$;
revoke all on function public.record_security_event(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_security_event(jsonb) to vexa_backend;

-- Lectura (solo administrador de plataforma con grant fresco y sesión viva).
create function public.platform_security_events(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin(); k text:=nullif(p_input->>'kind',''); s text:=nullif(p_input->>'severity',''); since timestamptz; cur bigint; lim int; items jsonb; nxt bigint;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or (p_input-array['kind','severity','since','cursor','limit'])<>'{}'::jsonb then raise exception using errcode='22023',message='platform_input_invalid'; end if;
 begin since:=nullif(p_input->>'since','')::timestamptz; cur:=nullif(p_input->>'cursor','')::bigint; lim:=least(greatest(coalesce(nullif(p_input->>'limit','')::int,50),1),100);
 exception when others then raise exception using errcode='22023',message='platform_input_invalid'; end;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.id desc),'[]'::jsonb) into items from (
  select id,at,kind,severity,route,method,tenant_id as "tenantId",actor_id as "actorId",left(ip_hash,12) as "ipRef",ua,detail from vexa_platform.security_events
  where (k is null or kind=k) and (s is null or severity=s) and (since is null or at>=since) and (cur is null or id<cur) order by id desc limit lim+1) q;
 if jsonb_array_length(items)>lim then nxt:=(items->(lim-1)->>'id')::bigint; items:=items-lim; end if;
 return jsonb_build_object('items',items,'nextCursor',nxt);
end $$;

-- Alertas por umbral sobre los contadores exactos de los últimos 15 minutos (los eventos guardados están muestreados; los contadores no).
create function public.platform_security_alerts(p_window interval default interval '15 minutes') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin(); t timestamptz:=clock_timestamp()-least(p_window,interval '24 hours'); out jsonb:='[]'::jsonb; n bigint; mx bigint;
begin
 select coalesce(sum(hits),0) into n from vexa_platform.security_event_counters where kind in('auth_401','forbidden_403') and bucket>=date_trunc('minute',t);
 select coalesce(max(s),0) into mx from (select sum(hits) s from vexa_platform.security_event_counters where kind in('auth_401','forbidden_403') and scope_hash<>'-' and bucket>=date_trunc('minute',t) group by scope_hash) q;
 if n>=50 or mx>=20 then out:=out||jsonb_build_array(jsonb_build_object('id','sec-auth-failures','kind','auth_failures','severity','warn','hits',n,'maxPerSource',mx,'title','Fallos de autenticación o autorización por encima del umbral')); end if;
 select coalesce(sum(hits),0) into n from vexa_platform.security_event_counters where kind='bearer_invalid' and bucket>=date_trunc('minute',t);
 if n>=1 then out:=out||jsonb_build_array(jsonb_build_object('id','sec-bearer','kind','bearer_invalid','severity','high','hits',n,'title','Bearer inválido en una ruta interna')); end if;
 select coalesce(sum(hits),0) into n from vexa_platform.security_event_counters where kind='webhook_signature_invalid' and bucket>=date_trunc('minute',t);
 if n>=5 then out:=out||jsonb_build_array(jsonb_build_object('id','sec-webhook','kind','webhook_signature_invalid','severity','high','hits',n,'title','Firmas de webhook inválidas repetidas'));
 elsif n>=1 then out:=out||jsonb_build_array(jsonb_build_object('id','sec-webhook','kind','webhook_signature_invalid','severity','warn','hits',n,'title','Firma de webhook inválida')); end if;
 select coalesce(sum(hits),0) into n from vexa_platform.security_event_counters where kind='csrf_rejected' and bucket>=date_trunc('minute',t);
 if n>=10 then out:=out||jsonb_build_array(jsonb_build_object('id','sec-csrf','kind','csrf_rejected','severity','warn','hits',n,'title','Origen o CSRF rechazado repetidamente')); end if;
 select coalesce(sum(hits),0) into n from vexa_platform.security_event_counters where kind='rate_limited' and bucket>=date_trunc('minute',t);
 if n>=100 then out:=out||jsonb_build_array(jsonb_build_object('id','sec-ratelimit','kind','rate_limited','severity','warn','hits',n,'title','Muchos bloqueos por límite de peticiones')); end if;
 return jsonb_build_object('windowMinutes',extract(epoch from least(p_window,interval '24 hours'))/60,'alerts',out);
end $$;
revoke all on function public.platform_security_events(jsonb),public.platform_security_alerts(interval) from public,anon,service_role;
grant execute on function public.platform_security_events(jsonb),public.platform_security_alerts(interval) to authenticated;

-- Evaluación para el cron interno de cada 15 min (solo vexa_backend): si hay alertas, deja UN evento alert_raised por cubeta de 15 minutos.
create function public.evaluate_security_alerts() returns jsonb language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp()-interval '15 minutes'; auth_n bigint; auth_max bigint; bearer_n bigint; hook_n bigint; csrf_n bigint; codes text[]:='{}'; slot text:=to_char(date_trunc('hour',clock_timestamp())+floor(extract(minute from clock_timestamp())/15)*interval '15 minutes','YYYYMMDDHH24MI');
begin
 select coalesce(sum(hits),0) into auth_n from vexa_platform.security_event_counters where kind in('auth_401','forbidden_403') and bucket>=date_trunc('minute',t);
 select coalesce(max(s),0) into auth_max from (select sum(hits) s from vexa_platform.security_event_counters where kind in('auth_401','forbidden_403') and scope_hash<>'-' and bucket>=date_trunc('minute',t) group by scope_hash) q;
 select coalesce(sum(hits),0) into bearer_n from vexa_platform.security_event_counters where kind='bearer_invalid' and bucket>=date_trunc('minute',t);
 select coalesce(sum(hits),0) into hook_n from vexa_platform.security_event_counters where kind='webhook_signature_invalid' and bucket>=date_trunc('minute',t);
 select coalesce(sum(hits),0) into csrf_n from vexa_platform.security_event_counters where kind='csrf_rejected' and bucket>=date_trunc('minute',t);
 if auth_n>=50 or auth_max>=20 then codes:=array_append(codes,'auth_failures'); end if;
 if bearer_n>=1 then codes:=array_append(codes,'bearer_invalid'); end if;
 if hook_n>=5 then codes:=array_append(codes,'webhook_signature_invalid'); end if;
 if csrf_n>=10 then codes:=array_append(codes,'csrf_rejected'); end if;
 if cardinality(codes)=0 then return jsonb_build_object('raised',false); end if;
 if exists(select 1 from vexa_platform.security_events where kind='alert_raised' and detail->>'scope'=slot) then return jsonb_build_object('raised',false,'dedup',true); end if;
 insert into vexa_platform.security_events(kind,severity,route,detail) values('alert_raised','high','cron/security-alerts',jsonb_build_object('scope',slot,'code',array_to_string(codes,','),'hits',auth_n+bearer_n+hook_n+csrf_n));
 return jsonb_build_object('raised',true,'codes',to_jsonb(codes));
end $$;
revoke all on function public.evaluate_security_alerts() from public,anon,authenticated,service_role;
grant execute on function public.evaluate_security_alerts() to vexa_backend;
commit;
