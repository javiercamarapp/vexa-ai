-- 20261127000000 (PROPUESTA, NO APLICADA): «Lectura de IA» de Puntos de dolor (L4), reporte semanal (L5) y baja de un clic (L6).
-- Qué AÑADE (todo por tenant, RLS forzada, SOLO LECTURA para la app; toda escritura pasa por funciones security definer con guarda de rol y de presupuesto,
--   mismo patrón que 20261125000000_perf_frio_precalculos y 20261112000000_insight_inbound_load):
--   analysis_runs          una corrida por (punto, corte, versión de prompt): consenso y confianza. IDEMPOTENTE: la clave única impide duplicar.
--   analysis_reads         las tres lecturas (causa_raiz | impacto | accion) de cada corrida. La clase es SIEMPRE 'inferred' (check): la salida de IA es Inferido.
--   analysis_spend         ledger de gasto de IA por semana (lunes UTC). Se CONSULTA antes de cada llamada (analysis_budget_reserve) y se REGISTRA después con el costo real
--                          (analysis_budget_settle). Tope: US$5.00 por semana y por organización (5 000 000 micro-USD). Una llamada sin respuesta queda 'uncertain' y cuenta su reserva.
--   weekly_report_outbox   vista previa del reporte semanal por destinatario (asunto, HTML, texto, foto de los puntos). Sin correo: solo user_id. Estado preview|sent|suppressed|failed.
--   report_unsubscribes    bajas del reporte semanal (L6), respetadas por weekly_recipients y por weekly_report_claim.
-- Funciones: analysis_budget_status/reserve/settle, analysis_run_save, analysis_run_view, weekly_recipients, weekly_report_record, weekly_report_claim, weekly_report_mark, weekly_unsubscribe.
-- Reglas: ingreso bruto (jamás margen), monedas separadas, unknown != 0, sin PII (el contenido de IA se valida en la app antes de guardarse; aquí solo jsonb acotado).
-- Autorización: analizar = acción 'import' (propietario o analista); estado del tope = cualquier miembro; reporte semanal = 'import' del actor de sistema (usuario del worker, miembro del tenant);
--   baja = acción 'weekly_unsubscribe' que solo fija el endpoint público DESPUÉS de verificar el token firmado (HMAC) en el servidor.
-- Reversa: packages/workspace-service/tests/20261127000000_pain_points_ia_semanal.down.sql
begin;
set local lock_timeout='3s';
do $$ begin
 if to_regprocedure('public.vexa_backend_action(uuid,text[])') is null or to_regprocedure('public.vexa_member(uuid,text[])') is null then raise exception 'faltan funciones base de acceso'; end if;
 if to_regclass('public.organizations') is null or to_regclass('public.memberships') is null then raise exception 'faltan tablas base'; end if;
end $$;

create table if not exists public.analysis_runs(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.organizations(id),
 point_id text not null check(point_id ~ '^P[0-9]{1,2}(~[A-Za-z0-9._-]{1,60})?$'),
 cut text not null check(length(cut) between 1 and 80),
 prompt_version text not null check(prompt_version ~ '^[a-z0-9._-]{1,40}$'),
 status text not null check(status in('completo','parcial')),
 consensus jsonb not null default '{}'::jsonb check(pg_column_size(consensus)<=8192),
 confidence numeric(4,3) check(confidence is null or confidence between 0 and 1),
 created_by uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 unique(tenant_id,point_id,cut,prompt_version)
);
create table if not exists public.analysis_reads(
 tenant_id uuid not null,
 run_id uuid not null,
 role text not null check(role in('causa_raiz','impacto','accion')),
 status text not null check(status in('ok','invalido','error')),
 kind text not null default 'inferred' check(kind='inferred'),
 content jsonb not null default '{}'::jsonb check(pg_column_size(content)<=8192),
 invalid_reason text check(invalid_reason is null or length(invalid_reason)<=80),
 attempt integer not null default 1 check(attempt between 1 and 20),
 provider text check(provider is null or length(provider)<=40),
 model text check(model is null or length(model)<=80),
 tokens_in integer check(tokens_in is null or tokens_in>=0),
 tokens_out integer check(tokens_out is null or tokens_out>=0),
 cost_micro bigint check(cost_micro is null or cost_micro>=0),
 created_at timestamptz not null default now(),
 primary key(run_id,role),
 foreign key(tenant_id,run_id) references public.analysis_runs(tenant_id,id) on delete cascade
);
create table if not exists public.analysis_spend(
 tenant_id uuid not null references public.organizations(id),
 run_key text not null check(length(run_key) between 1 and 200),
 week_start date not null,
 state text not null check(state in('reserved','settled','uncertain')),
 estimate_micro bigint not null check(estimate_micro>0 and estimate_micro<=5000000),
 actual_micro bigint check(actual_micro is null or actual_micro>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(tenant_id,run_key)
);
create index if not exists analysis_spend_week on public.analysis_spend(tenant_id,week_start);
create index if not exists analysis_runs_point on public.analysis_runs(tenant_id,point_id,updated_at desc);

create table if not exists public.weekly_report_outbox(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.organizations(id),
 week_start date not null,
 user_id uuid not null,
 state text not null check(state in('preview','sending','sent','suppressed','failed')),
 subject text not null check(length(subject)<=120),
 html text not null check(length(html)<=200000),
 body_text text not null check(length(body_text)<=100000),
 snapshot jsonb not null default '[]'::jsonb check(pg_column_size(snapshot)<=65536),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,week_start,user_id)
);
create table if not exists public.report_unsubscribes(
 tenant_id uuid not null references public.organizations(id),
 user_id uuid not null,
 scope text not null check(scope in('weekly')),
 created_at timestamptz not null default now(),
 primary key(tenant_id,user_id,scope)
);

do $$
declare t text;
begin
 foreach t in array array['analysis_runs','analysis_reads','analysis_spend','weekly_report_outbox','report_unsubscribes'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',t);
  execute format('grant select on public.%I to vexa_backend',t);
  execute format('drop policy if exists pp_read on public.%I',t);
  execute format($p$create policy pp_read on public.%I for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)))$p$,t);
 end loop;
end $$;

-- Autorización común: el tenant de la sesión coincide y la acción es 'import' (propietario o analista).
create or replace function public.pp_ia_authorized(p_tenant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_tenant is not null and p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(p_tenant,array['import'])
$$;
revoke all on function public.pp_ia_authorized(uuid) from public,anon,authenticated,service_role;
grant execute on function public.pp_ia_authorized(uuid) to vexa_backend;

-- Tope semanal: US$5.00 = 5 000 000 micro-USD, ventana = semana ISO (lunes UTC).
create or replace function public.analysis_week_start() returns date language sql stable set search_path='' as $$ select (date_trunc('week',(now() at time zone 'utc')))::date $$;
revoke all on function public.analysis_week_start() from public,anon,authenticated,service_role;
grant execute on function public.analysis_week_start() to vexa_backend;

create or replace function public.analysis_budget_status(p_tenant uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare wk date:=public.analysis_week_start(); used bigint; cap constant bigint:=5000000;
begin
 if p_tenant is null or p_tenant is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid or not public.vexa_member(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 select coalesce(sum(coalesce(actual_micro,estimate_micro)),0) into used from public.analysis_spend where tenant_id=p_tenant and week_start=wk;
 return jsonb_build_object('weekStart',wk,'capMicro',cap,'usedMicro',used,'remainingMicro',greatest(cap-used,0),'exhausted',used>=cap);
end $$;
revoke all on function public.analysis_budget_status(uuid) from public,anon,authenticated,service_role;
grant execute on function public.analysis_budget_status(uuid) to vexa_backend;

-- Consulta ANTES de la llamada: reserva la estimación si cabe en el tope. Una clave repetida en curso devuelve 'en_curso' (nunca gasta dos veces); una reserva abandonada (> 10 min) se retoma.
create or replace function public.analysis_budget_reserve(p_tenant uuid,p_key text,p_estimate bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare wk date:=public.analysis_week_start(); used bigint; cap constant bigint:=5000000; ex record;
begin
 if not public.pp_ia_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 if p_key is null or length(p_key)>200 or p_estimate is null or p_estimate<=0 or p_estimate>cap then raise exception 'ANALYSIS_INPUT_INVALID' using errcode='22023'; end if;
 perform set_config('lock_timeout','5s',true);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':analysis_budget',0));
 select * into ex from public.analysis_spend where tenant_id=p_tenant and run_key=p_key;
 select coalesce(sum(coalesce(actual_micro,estimate_micro)),0) into used from public.analysis_spend where tenant_id=p_tenant and week_start=wk and run_key<>p_key;
 if ex.run_key is not null and ex.state<>'reserved' then
  return jsonb_build_object('allowed',false,'reason','ya_registrada','usedMicro',used+coalesce(ex.actual_micro,ex.estimate_micro),'capMicro',cap);
 end if;
 if ex.run_key is not null and ex.state='reserved' and ex.updated_at>now()-interval '10 minutes' then
  return jsonb_build_object('allowed',false,'reason','en_curso','usedMicro',used+ex.estimate_micro,'capMicro',cap);
 end if;
 if used+p_estimate>cap then
  return jsonb_build_object('allowed',false,'reason','tope','usedMicro',used,'capMicro',cap,'remainingMicro',greatest(cap-used,0));
 end if;
 insert into public.analysis_spend(tenant_id,run_key,week_start,state,estimate_micro,actual_micro,created_at,updated_at)
  values(p_tenant,p_key,wk,'reserved',p_estimate,null,now(),now())
  on conflict(tenant_id,run_key) do update set state='reserved',estimate_micro=excluded.estimate_micro,week_start=excluded.week_start,updated_at=now()
  where public.analysis_spend.state='reserved';
 return jsonb_build_object('allowed',true,'usedMicro',used+p_estimate,'capMicro',cap,'remainingMicro',greatest(cap-used-p_estimate,0));
end $$;
revoke all on function public.analysis_budget_reserve(uuid,text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.analysis_budget_reserve(uuid,text,bigint) to vexa_backend;

-- Registro DESPUÉS: costo real. p_actual null = costo incierto (timeout/sin respuesta): conserva la reserva y cuenta como gasto.
create or replace function public.analysis_budget_settle(p_tenant uuid,p_key text,p_actual bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if not public.pp_ia_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 if p_actual is not null and (p_actual<0 or p_actual>50000000) then raise exception 'ANALYSIS_INPUT_INVALID' using errcode='22023'; end if;
 update public.analysis_spend set state=case when p_actual is null then 'uncertain' else 'settled' end,actual_micro=p_actual,updated_at=now()
  where tenant_id=p_tenant and run_key=p_key and state='reserved' returning * into r;
 if r.run_key is null then raise exception 'ANALYSIS_RESERVATION_UNKNOWN' using errcode='22023'; end if;
 return jsonb_build_object('state',r.state,'actualMicro',r.actual_micro);
end $$;
revoke all on function public.analysis_budget_settle(uuid,text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.analysis_budget_settle(uuid,text,bigint) to vexa_backend;

-- Vista de una corrida con sus lecturas (invoker: respeta la RLS del lector).
create or replace function public.analysis_run_view(p_run uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',r.id,'puntoId',r.point_id,'corte',r.cut,'version',r.prompt_version,'estado',r.status,'consenso',r.consensus,'confianza',r.confidence,
   'creadoEn',r.created_at,'actualizadoEn',r.updated_at,
   'lecturas',coalesce((select jsonb_agg(jsonb_build_object('rol',a.role,'estado',a.status,'clase',a.kind,'contenido',a.content,'motivoInvalido',a.invalid_reason,'intento',a.attempt,
      'proveedor',a.provider,'modelo',a.model,'tokensIn',a.tokens_in,'tokensOut',a.tokens_out,'costoMicro',a.cost_micro) order by a.role) from public.analysis_reads a where a.run_id=r.id),'[]'::jsonb))
 from public.analysis_runs r where r.id=p_run
$$;
revoke all on function public.analysis_run_view(uuid) from public,anon,authenticated,service_role;
grant execute on function public.analysis_run_view(uuid) to vexa_backend;

-- Guarda una corrida de forma idempotente: crea la corrida o conserva la existente; una lectura 'ok' nunca se sobrescribe (solo se reemplazan invalido/error o las que faltan).
create or replace function public.analysis_run_save(p_tenant uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; rd jsonb; n int;
begin
 if not public.pp_ia_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 if p is null or jsonb_typeof(p)<>'object' or jsonb_typeof(p->'lecturas')<>'array' or jsonb_array_length(p->'lecturas')>3 then raise exception 'ANALYSIS_INPUT_INVALID' using errcode='22023'; end if;
 insert into public.analysis_runs(tenant_id,point_id,cut,prompt_version,status,consensus,confidence,created_by)
  values(p_tenant,p->>'puntoId',p->>'corte',p->>'version',p->>'estado',coalesce(p->'consenso','{}'::jsonb),(p->>'confianza')::numeric,nullif(current_setting('request.jwt.claim.sub',true),'')::uuid)
  on conflict(tenant_id,point_id,cut,prompt_version) do nothing returning id into rid;
 if rid is null then select id into rid from public.analysis_runs where tenant_id=p_tenant and point_id=p->>'puntoId' and cut=p->>'corte' and prompt_version=p->>'version'; end if;
 for rd in select * from jsonb_array_elements(p->'lecturas') loop
  insert into public.analysis_reads(tenant_id,run_id,role,status,content,invalid_reason,attempt,provider,model,tokens_in,tokens_out,cost_micro)
   values(p_tenant,rid,rd->>'rol',rd->>'estado',coalesce(rd->'contenido','{}'::jsonb),left(rd->>'motivoInvalido',80),coalesce((rd->>'intento')::int,1),left(rd->>'proveedor',40),left(rd->>'modelo',80),
     (rd->>'tokensIn')::int,(rd->>'tokensOut')::int,(rd->>'costoMicro')::bigint)
   on conflict(run_id,role) do update set status=excluded.status,content=excluded.content,invalid_reason=excluded.invalid_reason,attempt=excluded.attempt,provider=excluded.provider,model=excluded.model,
     tokens_in=excluded.tokens_in,tokens_out=excluded.tokens_out,cost_micro=excluded.cost_micro,created_at=now()
   where public.analysis_reads.status<>'ok';
 end loop;
 select count(*) into n from public.analysis_reads where run_id=rid and status='ok';
 update public.analysis_runs set status=case when n>=3 then 'completo' else 'parcial' end,consensus=coalesce(p->'consenso',consensus),confidence=(p->>'confianza')::numeric,updated_at=now()
  where id=rid and (status<>'completo' or n>=3);
 return public.analysis_run_view(rid);
end $$;
revoke all on function public.analysis_run_save(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.analysis_run_save(uuid,jsonb) to vexa_backend;

-- ---------------------------------------------------------------- reporte semanal (L5) y baja (L6)
-- Destinatarios: propietarios y analistas activos que NO se dieron de baja. Sin correos: solo user_id y rol (el transporte resuelve el buzón al enviar).
create or replace function public.weekly_recipients(p_tenant uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.pp_ia_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'role',m.role) order by m.user_id) from public.memberships m
   where m.tenant_id=p_tenant and m.status='active' and m.role in('owner','analyst')
     and not exists(select 1 from public.report_unsubscribes u where u.tenant_id=m.tenant_id and u.user_id=m.user_id and u.scope='weekly')),'[]'::jsonb);
end $$;
revoke all on function public.weekly_recipients(uuid) from public,anon,authenticated,service_role;
grant execute on function public.weekly_recipients(uuid) to vexa_backend;

-- Registra la vista previa de un destinatario; idempotente por (tenant, semana, destinatario). Un destinatario dado de baja no genera fila.
create or replace function public.weekly_report_record(p_tenant uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; uid uuid:=(p->>'userId')::uuid;
begin
 if not public.pp_ia_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 if exists(select 1 from public.report_unsubscribes u where u.tenant_id=p_tenant and u.user_id=uid and u.scope='weekly') then return jsonb_build_object('inserted',false,'reason','baja'); end if;
 if not exists(select 1 from public.memberships m where m.tenant_id=p_tenant and m.user_id=uid and m.status='active') then raise exception 'ANALYSIS_INPUT_INVALID' using errcode='22023'; end if;
 insert into public.weekly_report_outbox(tenant_id,week_start,user_id,state,subject,html,body_text,snapshot)
  values(p_tenant,(p->>'weekStart')::date,uid,'preview',p->>'subject',p->>'html',p->>'text',coalesce(p->'snapshot','[]'::jsonb))
  on conflict(tenant_id,week_start,user_id) do nothing returning id into rid;
 if rid is null then return jsonb_build_object('inserted',false,'reason','ya_existe','id',(select id from public.weekly_report_outbox where tenant_id=p_tenant and week_start=(p->>'weekStart')::date and user_id=uid)); end if;
 return jsonb_build_object('inserted',true,'id',rid);
end $$;
revoke all on function public.weekly_report_record(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.weekly_report_record(uuid,jsonb) to vexa_backend;

-- Antes de enviar: solo desde 'preview' y solo si el destinatario sigue sin baja. Si se dio de baja, queda 'suppressed' y NO se envía.
create or replace function public.weekly_report_claim(p_tenant uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if not public.pp_ia_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 select * into r from public.weekly_report_outbox where tenant_id=p_tenant and id=p_id for update;
 if r.id is null then raise exception 'ANALYSIS_INPUT_INVALID' using errcode='22023'; end if;
 if r.state<>'preview' then return jsonb_build_object('send',false,'reason',r.state); end if;
 if exists(select 1 from public.report_unsubscribes u where u.tenant_id=p_tenant and u.user_id=r.user_id and u.scope='weekly') then
  update public.weekly_report_outbox set state='suppressed',updated_at=now() where id=r.id;
  return jsonb_build_object('send',false,'reason','baja');
 end if;
 update public.weekly_report_outbox set state='sending',updated_at=now() where id=r.id;
 return jsonb_build_object('send',true,'userId',r.user_id);
end $$;
revoke all on function public.weekly_report_claim(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.weekly_report_claim(uuid,uuid) to vexa_backend;

create or replace function public.weekly_report_mark(p_tenant uuid,p_id uuid,p_state text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.pp_ia_authorized(p_tenant) then raise exception 'denied' using errcode='42501'; end if;
 if p_state is null or p_state not in('sent','failed') then raise exception 'ANALYSIS_INPUT_INVALID' using errcode='22023'; end if;
 update public.weekly_report_outbox set state=p_state,updated_at=now() where tenant_id=p_tenant and id=p_id and state='sending';
end $$;
revoke all on function public.weekly_report_mark(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.weekly_report_mark(uuid,uuid,text) to vexa_backend;

-- Baja de un clic. NO usa sesión: la autoriza el token HMAC que la aplicación verificó, y la conexión fija 'vexa.action'='weekly_unsubscribe'. Solo da de baja a un miembro real del tenant.
-- Idempotente. p_resubscribe=true la revierte (enlace «Volver a suscribirme» de la confirmación).
create or replace function public.weekly_unsubscribe(p_tenant uuid,p_user uuid,p_resubscribe boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if current_setting('vexa.action',true) is distinct from 'weekly_unsubscribe' or p_tenant is null or p_user is null then raise exception 'denied' using errcode='42501'; end if;
 if not exists(select 1 from public.memberships m where m.tenant_id=p_tenant and m.user_id=p_user) then return jsonb_build_object('ok',false,'reason','desconocido'); end if;
 if p_resubscribe then
  delete from public.report_unsubscribes where tenant_id=p_tenant and user_id=p_user and scope='weekly';
  return jsonb_build_object('ok',true,'estado','suscrito');
 end if;
 insert into public.report_unsubscribes(tenant_id,user_id,scope) values(p_tenant,p_user,'weekly') on conflict do nothing;
 get diagnostics n=row_count;
 return jsonb_build_object('ok',true,'estado','baja','yaEstaba',n=0);
end $$;
revoke all on function public.weekly_unsubscribe(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.weekly_unsubscribe(uuid,uuid,boolean) to vexa_backend;
commit;
