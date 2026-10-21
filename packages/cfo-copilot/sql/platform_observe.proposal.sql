-- PROPUESTA (no aplicada): observabilidad de plataforma de SOLO LECTURA para la consola /platform y su copiloto.
-- Mover a supabase/migrations/<marca de tiempo>_platform_observe.sql y aplicar con el proceso aprobado SOLO tras revisión.
-- Devuelve AGREGADOS por organización (conteos, estados, gasto). Nunca texto de mensajes, correos de clientes ni payloads.
-- Autoridad: vexa_platform.require_admin() (sesión viva + administrador activo), igual que platform_manage. Sin escrituras.
-- Requiere que el dueño de la función (postgres) lea con BYPASSRLS: verificar con
--   select rolbypassrls from pg_roles where rolname = current_user;   (SELECT de solo lectura por MCP)
begin;
create function public.platform_observe(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin(); op text:=p_input->>'operation'; result jsonb;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>1024 or op is distinct from 'snapshot' or (p_input-'operation')<>'{}'::jsonb then
  raise exception using errcode='22023',message='platform_input_invalid';
 end if;
 perform set_config('statement_timeout','8000',true);
 with org as (
  select o.id,o.name,o.created_at,
   coalesce((select window_key from public.ai_budget_reservations r where r.tenant_id=o.id order by r.created_at desc limit 1),(select l.window_key from public.ai_budget_limits l where l.tenant_id=o.id order by l.id limit 1),'') as wk
  from public.organizations o order by o.name limit 200),
 enriched as (
  select org.id,org.name,org.created_at,
   jsonb_build_object('owner',coalesce(mem.owner,0),'analyst',coalesce(mem.analyst,0),'operator',coalesce(mem.operator,0),'viewer',coalesce(mem.viewer,0),'total',coalesce(mem.total,0)) as members,
   coalesce(inv.pending,0) as inv_pending,coalesce(inv.expired,0) as inv_expired,
   greatest(imp.last_at,job.last_at,led.last_at) as last_activity,
   jsonb_build_object('rows',coalesce(led.rows,0)) as ledger,
   jsonb_build_object('total',coalesce(imp.total,0),'open',coalesce(imp.open,0),'failed',coalesce(imp.failed,0),'lastAt',imp.last_at) as imports,
   jsonb_build_object('queued',coalesce(job.queued,0),'running',coalesce(job.running,0),'partial',coalesce(job.partial,0),'failed',coalesce(job.failed,0),'stuck',coalesce(job.stuck,0),'succeeded24h',coalesce(job.ok24,0),'failed24h',coalesce(job.fail24,0)) as jobs,
   jsonb_build_object('hubspot',coalesce(src.hubspot,'{"loaded":false,"total":0,"incorporated":0,"rejected":0,"pending":0,"lastUpdate":null}'::jsonb),
     'csv',coalesce(src.csv,'{"loaded":false,"total":0,"incorporated":0,"rejected":0,"pending":0,"lastUpdate":null}'::jsonb),
     'zendesk',coalesce(src.zendesk,'{"loaded":false,"total":0,"incorporated":0,"rejected":0,"pending":0,"lastUpdate":null}'::jsonb),
     'excel',coalesce(src.excel,'{"loaded":false,"total":0,"incorporated":0,"rejected":0,"pending":0,"lastUpdate":null}'::jsonb),
     'ledger',jsonb_build_object('loaded',coalesce(led.rows,0)>0,'total',coalesce(led.rows,0),'incorporated',coalesce(led.rows,0),'rejected',0,'pending',0,'lastUpdate',led.last_at),
     'associations',jsonb_build_object('loaded',coalesce(asoc.total,0)>0,'total',coalesce(asoc.total,0),'incorporated',coalesce(asoc.resolved,0),'rejected',0,'pending',coalesce(asoc.total,0)-coalesce(asoc.resolved,0),'lastUpdate',null),
     'attachments',jsonb_build_object('loaded',coalesce(att.total,0)>0,'total',coalesce(att.total,0),'incorporated',coalesce(att.total,0),'rejected',0,'pending',0,'lastUpdate',att.last_at)) as sources,
   jsonb_build_object('spentMicro',coalesce(ai.spent,0)::text,'limitMicro',coalesce(ai.lim,0)::text,'window',org.wk,'uncertain',coalesce(ai.uncertain,0)) as ai
  from org
  left join lateral (select count(*) filter(where status='active') total,count(*) filter(where status='active' and role='owner') owner,count(*) filter(where status='active' and role='analyst') analyst,count(*) filter(where status='active' and role='operator') operator,count(*) filter(where status='active' and role='viewer') viewer from public.memberships m where m.tenant_id=org.id) mem on true
  left join lateral (select count(*) filter(where status='pending' and expires_at>clock_timestamp()) pending,count(*) filter(where status in('pending','expired') and expires_at<=clock_timestamp()) expired from public.team_invitations t where t.tenant_id=org.id) inv on true
  left join lateral (select count(*) rows,max(l.recorded_at) last_at from public.economic_ledger_entries l where l.tenant_id=org.id) led on true
  left join lateral (select count(*) total,count(*) filter(where state in('reserved','uploaded','mapping','queued','running','partial')) open,count(*) filter(where state='failed' and updated_at>clock_timestamp()-interval '30 days') failed,max(updated_at) last_at from public.imports i where i.tenant_id=org.id) imp on true
  left join lateral (select count(*) filter(where state='queued') queued,count(*) filter(where state='running') running,count(*) filter(where state='partial') partial,count(*) filter(where state='failed' and updated_at>clock_timestamp()-interval '30 days') failed,count(*) filter(where state='running' and lease_until<clock_timestamp()-interval '15 minutes') stuck,count(*) filter(where state='succeeded' and updated_at>clock_timestamp()-interval '24 hours') ok24,count(*) filter(where state='failed' and updated_at>clock_timestamp()-interval '24 hours') fail24,max(updated_at) last_at from public.jobs j where j.tenant_id=org.id) job on true
  left join lateral (select
     max(jsonb_build_object('loaded',true,'total',s.total,'incorporated',s.acc+s.dup,'rejected',s.rej,'pending',s.pen,'lastUpdate',s.last_at)::text) filter(where s.source='hubspot')::jsonb hubspot,
     max(jsonb_build_object('loaded',true,'total',s.total,'incorporated',s.acc+s.dup,'rejected',s.rej,'pending',s.pen,'lastUpdate',s.last_at)::text) filter(where s.source='csv')::jsonb csv,
     max(jsonb_build_object('loaded',true,'total',s.total,'incorporated',s.acc+s.dup,'rejected',s.rej,'pending',s.pen,'lastUpdate',s.last_at)::text) filter(where s.source='zendesk')::jsonb zendesk,
     max(jsonb_build_object('loaded',true,'total',s.total,'incorporated',s.acc+s.dup,'rejected',s.rej,'pending',s.pen,'lastUpdate',s.last_at)::text) filter(where s.source='excel')::jsonb excel
    from (select coalesce(c.source,'sin_conexion') source,coalesce(sum(i.total),0) total,coalesce(sum(i.accepted),0) acc,coalesce(sum(i.duplicates),0) dup,coalesce(sum(i.rejected),0) rej,coalesce(sum(i.pending),0) pen,max(i.updated_at) last_at
      from public.imports i left join public.connections c on c.tenant_id=i.tenant_id and c.id=i.connection_id where i.tenant_id=org.id group by 1) s) src on true
  left join lateral (select count(*) total,count(*) filter(where resolution_state<>'unresolved') resolved from public.native_customer_associations a where a.tenant_id=org.id) asoc on true
  left join lateral (select count(*) total,max(b.created_at) last_at from public.attachment_blobs b where b.tenant_id=org.id) att on true
  left join lateral (select coalesce(sum(coalesce(r.actual_minor,r.held_minor)) filter(where r.state in('reserved','uncertain','settled')),0) spent,count(*) filter(where r.state='uncertain') uncertain,
     (select l.limit_minor from public.ai_budget_limits l where l.tenant_id=org.id and l.purpose='all' and l.window_key=org.wk limit 1) lim
     from public.ai_budget_reservations r where r.tenant_id=org.id and r.window_key=org.wk) ai on true)
 select jsonb_build_object('generatedAt',clock_timestamp(),
   'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'createdAt',e.created_at,'members',e.members,'invitationsPending',e.inv_pending,'invitationsExpired',e.inv_expired,'lastActivityAt',e.last_activity,'ledger',e.ledger,'imports',e.imports,'jobs',e.jobs,'sources',e.sources,'ai',e.ai) order by e.name) from enriched e),'[]'::jsonb),
   'failedJobs',coalesce((select jsonb_agg(f order by f->>'updatedAt' desc) from (
      select jsonb_build_object('id',j.id,'organizationId',j.tenant_id,'type',j.type,'state',j.state,'attempts',(select count(*) from public.attempts a where a.tenant_id=j.tenant_id and a.job_id=j.id),'errorCode',null,'updatedAt',j.updated_at,'stuck',(j.state='running' and j.lease_until<clock_timestamp()-interval '15 minutes')) f
      from public.jobs j where (j.state='failed' and j.updated_at>clock_timestamp()-interval '30 days') or (j.state='running' and j.lease_until<clock_timestamp()-interval '15 minutes') order by j.updated_at desc limit 50) q),'[]'::jsonb),
   'opsSignals','[]'::jsonb)
 into result;
 return result;
end $$;
revoke all on function public.platform_observe(jsonb) from public,anon;
grant execute on function public.platform_observe(jsonb) to authenticated;

-- Bitácora del copiloto de plataforma: cada herramienta que consulta deja una fila en vexa_platform.audit ANTES de leer.
-- Si esta función falla o no existe, el copiloto NO ejecuta la herramienta (fail-closed).
create function public.platform_copilot_audit(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=vexa_platform.require_admin(); tool text:=p_input->>'tool'; outcome text:=p_input->>'outcome'; args_hash text:=p_input->>'argsHash'; tid uuid:=nullif(p_input->>'organizationId','')::uuid;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>2048 or (p_input-array['tool','outcome','argsHash','organizationId'])<>'{}'::jsonb
   or tool is null or tool !~ '^[a-z_]{1,40}$' or outcome is null or outcome !~ '^[a-z_:]{1,40}$' or (args_hash is not null and args_hash !~ '^[a-f0-9]{64}$') then
  raise exception using errcode='22023',message='platform_input_invalid';
 end if;
 if tid is not null and not exists(select 1 from public.organizations where id=tid) then raise exception using errcode='22023',message='platform_input_invalid';end if;
 insert into vexa_platform.audit(actor_id,operation,tenant_id,request_id,details) values(u,'copilot_query',tid,gen_random_uuid(),jsonb_build_object('tool',tool,'outcome',outcome,'argsHash',args_hash));
 return jsonb_build_object('recorded',true);
end $$;
revoke all on function public.platform_copilot_audit(jsonb) from public,anon;
grant execute on function public.platform_copilot_audit(jsonb) to authenticated;
commit;
