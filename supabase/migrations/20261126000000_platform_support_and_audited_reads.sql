-- SUPERADMIN (24-oct-2026). PROPUESTA ESCRITA, NO APLICADA: la aplica el dueño.
-- 1) Cierra el hueco de platform_team_manage: listar miembros/invitaciones (correos) de OTRA organización se audita SIEMPRE, antes de leer (falla cerrado).
-- 2) «Ver como» (sesión de soporte): tabla + RPC platform_support (start/end/active) con motivo obligatorio, tope 60 min, una sesión por administrador, solo lectura.
-- 3) Ficha 360 por organización: platform_org_detail(tenant), solo agregados (sin correos ni contenido de cliente), audita cada lectura.
-- 4) Interruptor de MFA (AAL2) en vexa_platform.settings, APAGADO por defecto: no bloquea a nadie hasta que el dueño lo encienda.
-- Prefijo posterior a 20261124000000. Redefine solo platform_team_manage (definida únicamente en 20260930224057; ninguna migración con prefijo mayor la toca).
-- La rama de lectura para RLS (vexa_member) va APARTE en 20261126000100 y NO debe aplicarse sin el inventario de pg_policies descrito allí.
begin;

-- Interruptores de plataforma (solo servidor). mfa_required=false: nadie se bloquea.
create table vexa_platform.settings (
 key text primary key check (key ~ '^[a-z_]{1,40}$'),
 value jsonb not null,
 updated_at timestamptz not null default now()
);
insert into vexa_platform.settings(key,value) values ('mfa_required','false'::jsonb);
alter table vexa_platform.settings enable row level security;
alter table vexa_platform.settings force row level security;

-- Sesiones de soporte («ver como»): solo lectura por construcción (mode='read'), máximo 60 minutos, una activa por administrador.
create table vexa_platform.support_sessions (
 id uuid primary key default gen_random_uuid(),
 admin_id uuid not null references auth.users(id),
 tenant_id uuid not null references public.organizations(id),
 reason text not null check (char_length(btrim(reason)) between 10 and 500),
 mode text not null default 'read' check (mode='read'),
 request_id uuid not null,
 started_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 ended_at timestamptz,
 ended_by uuid,
 end_reason text check (end_reason in ('ended','expired')),
 unique (admin_id, request_id),
 check (expires_at > started_at and expires_at <= started_at + interval '60 minutes'),
 check ((ended_at is null) = (end_reason is null))
);
create unique index support_sessions_one_active on vexa_platform.support_sessions (admin_id) where ended_at is null;
create index support_sessions_tenant_idx on vexa_platform.support_sessions (tenant_id, started_at desc);
alter table vexa_platform.support_sessions enable row level security;
alter table vexa_platform.support_sessions force row level security;
revoke all on vexa_platform.settings, vexa_platform.support_sessions from public,anon,authenticated;

-- MFA: verdadero si el interruptor está apagado o la sesión es AAL2. Hoy solo lo exigen las operaciones nuevas de soporte.
create function vexa_platform.mfa_satisfied() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select value='true'::jsonb from vexa_platform.settings where key='mfa_required'),false) is not true
  or coalesce(auth.jwt()->>'aal','')='aal2'
$$;

-- Sesión de soporte: start | end | active. Autoridad: require_admin() (grant fresco + sesión viva). Cada inicio/fin deja fila en vexa_platform.audit.
create function public.platform_support(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin(); op text:=p_input->>'operation'; s vexa_platform.support_sessions; tid uuid; rsn text; mins int; rid uuid;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>2048 then raise exception using errcode='22023',message='platform_input_invalid';end if;
 if op='active' and (p_input-'operation')='{}'::jsonb then
  select ss.* into s from vexa_platform.support_sessions ss where ss.admin_id=u and ss.ended_at is null and ss.expires_at>clock_timestamp();
  if not found then return jsonb_build_object('active',false);end if;
  return jsonb_build_object('active',true,'session',jsonb_build_object('id',s.id,'tenantId',s.tenant_id,'tenantName',(select o.name from public.organizations o where o.id=s.tenant_id),'reason',s.reason,'startedAt',s.started_at,'expiresAt',s.expires_at,'mode',s.mode));
 elsif op='start' and (p_input-array['operation','tenant','reason','minutes','requestId','confirmed'])='{}'::jsonb then
  if jsonb_typeof(p_input->'tenant') is distinct from 'string' or jsonb_typeof(p_input->'reason') is distinct from 'string' or jsonb_typeof(p_input->'requestId') is distinct from 'string'
     or (p_input ? 'minutes' and jsonb_typeof(p_input->'minutes') is distinct from 'number') or p_input->'confirmed' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='platform_input_invalid';end if;
  tid:=(p_input->>'tenant')::uuid; rid:=(p_input->>'requestId')::uuid; rsn:=btrim(p_input->>'reason');
  mins:=coalesce((p_input->>'minutes')::numeric,30)::int;
  if (p_input ? 'minutes' and (p_input->>'minutes')::numeric<>mins) or mins not between 5 and 60 or char_length(rsn) not between 10 and 500 then raise exception using errcode='22023',message='platform_input_invalid';end if;
  if not vexa_platform.mfa_satisfied() then raise exception using errcode='42501',message='platform_mfa_required';end if;
  if not exists(select 1 from public.organizations where id=tid) then raise exception using errcode='22023',message='platform_input_invalid';end if;
  perform pg_advisory_xact_lock(hashtextextended('platform-support:'||u::text,0));
  select ss.* into s from vexa_platform.support_sessions ss where ss.admin_id=u and ss.request_id=rid;
  if found then
   if s.tenant_id<>tid or s.reason<>rsn then raise exception using errcode='P0001',message='platform_request_conflict';end if;
   return jsonb_build_object('id',s.id,'tenantId',s.tenant_id,'expiresAt',s.expires_at,'replay',true);
  end if;
  if exists(select 1 from public.memberships m where m.tenant_id=tid and m.user_id=u and m.status='active') then raise exception using errcode='22023',message='platform_support_own_organization';end if;
  update vexa_platform.support_sessions set ended_at=expires_at,end_reason='expired' where admin_id=u and ended_at is null and expires_at<=clock_timestamp();
  if exists(select 1 from vexa_platform.support_sessions where admin_id=u and ended_at is null) then raise exception using errcode='P0001',message='platform_support_active';end if;
  insert into vexa_platform.support_sessions(admin_id,tenant_id,reason,request_id,expires_at) values(u,tid,rsn,rid,clock_timestamp()+make_interval(mins=>mins)) returning * into s;
  insert into vexa_platform.audit(actor_id,operation,tenant_id,request_id,details) values(u,'support_start',tid,rid,jsonb_build_object('sessionId',s.id,'reason',rsn,'minutes',mins));
  return jsonb_build_object('id',s.id,'tenantId',s.tenant_id,'expiresAt',s.expires_at,'replay',false);
 elsif op='end' and (p_input-'operation')='{}'::jsonb then
  perform pg_advisory_xact_lock(hashtextextended('platform-support:'||u::text,0));
  update vexa_platform.support_sessions set ended_at=clock_timestamp(),ended_by=u,end_reason='ended' where admin_id=u and ended_at is null and expires_at>clock_timestamp() returning * into s;
  if not found then
   update vexa_platform.support_sessions set ended_at=expires_at,end_reason='expired' where admin_id=u and ended_at is null and expires_at<=clock_timestamp();
   return jsonb_build_object('ended',false);
  end if;
  insert into vexa_platform.audit(actor_id,operation,tenant_id,request_id,details) values(u,'support_end',s.tenant_id,gen_random_uuid(),jsonb_build_object('sessionId',s.id));
  return jsonb_build_object('ended',true);
 end if;
 raise exception using errcode='22023',message='platform_input_invalid';
end $$;

-- Ficha 360: SOLO agregados (conteos, estados, fechas, gasto). Sin correos, sin texto de mensajes, sin account_id ni credenciales.
-- Audita la lectura ANTES de leer (falla cerrado); una fila por minuto y administrador/organización.
create function public.platform_org_detail(p_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin(); result jsonb; wk text;
begin
 if p_tenant is null or not exists(select 1 from public.organizations where id=p_tenant) then raise exception using errcode='22023',message='platform_input_invalid';end if;
 perform set_config('statement_timeout','8000',true);
 if not exists(select 1 from vexa_platform.audit where actor_id=u and operation='org_view' and tenant_id=p_tenant and created_at>clock_timestamp()-interval '60 seconds') then
  insert into vexa_platform.audit(actor_id,operation,tenant_id,request_id,details) values(u,'org_view',p_tenant,gen_random_uuid(),'{}'::jsonb);
 end if;
 wk:=coalesce((select r.window_key from public.ai_budget_reservations r where r.tenant_id=p_tenant order by r.created_at desc limit 1),(select l.window_key from public.ai_budget_limits l where l.tenant_id=p_tenant order by l.id limit 1),'');
 select jsonb_build_object('generatedAt',clock_timestamp(),
  'organization',(select jsonb_build_object('id',o.id,'name',o.name,'createdAt',o.created_at) from public.organizations o where o.id=p_tenant),
  'members',(select jsonb_build_object('owner',count(*) filter(where role='owner'),'analyst',count(*) filter(where role='analyst'),'operator',count(*) filter(where role='operator'),'viewer',count(*) filter(where role='viewer'),'total',count(*)) from public.memberships m where m.tenant_id=p_tenant and m.status='active'),
  'invitations',(select jsonb_build_object('pending',count(*) filter(where status='pending' and expires_at>clock_timestamp()),'expired',count(*) filter(where status in('pending','expired') and expires_at<=clock_timestamp()),'deliveryProblems',count(*) filter(where status='pending' and delivery in('failed','uncertain'))) from public.team_invitations t where t.tenant_id=p_tenant),
  'connections',coalesce((select jsonb_agg(jsonb_build_object('source',q.source,'status',q.status,'health',q.state,'lastSuccess',q.last_success,'errorCode',q.error_code) order by q.source) from (
     select c.source,c.status,h.state,coalesce(h.last_success,c.last_success) last_success,h.error_code from public.connections c left join public.connection_health h on h.tenant_id=c.tenant_id and h.connection_id=c.id where c.tenant_id=p_tenant limit 20) q),'[]'::jsonb),
  'sources',coalesce((select jsonb_agg(jsonb_build_object('source',s.source,'total',s.total,'incorporated',s.acc+s.dup,'rejected',s.rej,'pending',s.pen,'lastUpdate',s.last_at) order by s.source) from (
     select coalesce(c.source,'sin_conexion') source,coalesce(sum(i.total),0) total,coalesce(sum(i.accepted),0) acc,coalesce(sum(i.duplicates),0) dup,coalesce(sum(i.rejected),0) rej,coalesce(sum(i.pending),0) pen,max(i.updated_at) last_at
     from public.imports i left join public.connections c on c.tenant_id=i.tenant_id and c.id=i.connection_id where i.tenant_id=p_tenant group by 1) s),'[]'::jsonb),
  'imports',(select jsonb_build_object('total',count(*),'open',count(*) filter(where state in('reserved','uploaded','mapping','queued','running','partial')),'failed30d',count(*) filter(where state='failed' and updated_at>clock_timestamp()-interval '30 days'),'lastAt',max(updated_at)) from public.imports i where i.tenant_id=p_tenant),
  'jobs',(select jsonb_build_object('queued',count(*) filter(where state='queued'),'running',count(*) filter(where state='running'),'partial',count(*) filter(where state='partial'),'failed30d',count(*) filter(where state='failed' and updated_at>clock_timestamp()-interval '30 days'),'stuck',count(*) filter(where state='running' and lease_until<clock_timestamp()-interval '15 minutes'),'succeeded24h',count(*) filter(where state='succeeded' and updated_at>clock_timestamp()-interval '24 hours'),'failed24h',count(*) filter(where state='failed' and updated_at>clock_timestamp()-interval '24 hours'),'lastAt',max(updated_at)) from public.jobs j where j.tenant_id=p_tenant),
  'ledger',(select jsonb_build_object('rows',count(*),'lastAt',max(l.recorded_at)) from public.economic_ledger_entries l where l.tenant_id=p_tenant),
  'ai',(select jsonb_build_object('window',wk,'spentMicro',coalesce(sum(coalesce(r.actual_minor,r.held_minor)) filter(where r.state in('reserved','uncertain','settled')),0)::text,'uncertain',count(*) filter(where r.state='uncertain'),
      'limitMicro',coalesce((select l.limit_minor from public.ai_budget_limits l where l.tenant_id=p_tenant and l.purpose='all' and l.window_key=wk limit 1),0)::text) from public.ai_budget_reservations r where r.tenant_id=p_tenant and r.window_key=wk),
  'cuts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'status',c.status,'asOf',c.as_of,'publishedAt',c.published_at,'createdAt',c.created_at,'components',c.component_count) order by c.created_at desc) from (
     select * from public.metric_snapshots ms where ms.tenant_id=p_tenant order by ms.created_at desc limit 5) c),'[]'::jsonb),
  'support',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'adminId',x.admin_id,'reason',x.reason,'startedAt',x.started_at,'expiresAt',x.expires_at,'endedAt',x.ended_at,'endReason',x.end_reason) order by x.started_at desc) from (
     select * from vexa_platform.support_sessions ss where ss.tenant_id=p_tenant order by ss.started_at desc limit 10) x),'[]'::jsonb),
  'audit',coalesce((select jsonb_agg(jsonb_build_object('operation',a.operation,'actorId',a.actor_id,'createdAt',a.created_at) order by a.id desc) from (
     select * from vexa_platform.audit au where au.tenant_id=p_tenant order by au.id desc limit 10) a),'[]'::jsonb))
 into result;
 return result;
end $$;

-- Cierra el hueco: misma función que 20260930224057 + auditoría de TODA lectura (members/invitations) de cualquier organización, antes de leer.
create or replace function public.platform_team_manage(p_tenant uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin(); result jsonb; op text:=p_input->>'operation'; allowed text[];
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>4096 then raise exception using errcode='22023',message='team_input_invalid';end if;
 allowed:=case op
  when 'list' then array['operation','kind','cursor'] when 'invite' then array['operation','email','role','requestId','confirmed']
  when 'role' then array['operation','id','version','role'] when 'revoke' then array['operation','id','version']
  when 'cancel' then array['operation','id','version'] when 'claim' then array['operation','id'] when 'receipt' then array['operation','id','delivery'] end;
 if allowed is null or p_input-allowed<>'{}'::jsonb or (op='list' and coalesce(p_input->>'kind','members') not in ('members','invitations')) or (op='invite' and p_input->'confirmed' is distinct from 'true'::jsonb) then raise exception using errcode='22023',message='team_input_invalid';end if;
 if p_tenant is null or not exists(select 1 from public.organizations where id=p_tenant) then raise exception using errcode='42501',message='platform_access_denied';end if;
 if op='list' then
  -- Lectura de correos de otra organización: se registra ANTES de leer. Si la bitácora falla, no se lee.
  insert into vexa_platform.audit(actor_id,operation,tenant_id,request_id,details) values(u,'team_list',p_tenant,gen_random_uuid(),jsonb_build_object('kind',coalesce(p_input->>'kind','members'),'paged',p_input ? 'cursor'));
 end if;
 result:=vexa_platform.team_manage_core(p_tenant,p_input,true);
 if p_input->>'operation'<>'list' then
  insert into vexa_platform.audit(actor_id,operation,tenant_id,target_id) values(u,'team_'||(p_input->>'operation'),p_tenant,coalesce(nullif(p_input->>'id','')::uuid,nullif(result->>'id','')::uuid));
 end if;
 return result;
end $$;

revoke all on all functions in schema vexa_platform from public,anon,authenticated;
revoke all on function public.platform_support(jsonb),public.platform_org_detail(uuid),public.platform_team_manage(uuid,jsonb) from public,anon;
grant execute on function public.platform_support(jsonb),public.platform_org_detail(uuid),public.platform_team_manage(uuid,jsonb) to authenticated;
commit;
