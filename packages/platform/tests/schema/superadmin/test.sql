create function pg_temp.as_user(u uuid, aal text default 'aal1') returns void language sql as $$
 select set_config('request.jwt.claim.sub',u::text,false), set_config('request.jwt.claims',jsonb_build_object('session_id',(select id from auth.sessions where user_id=u limit 1),'aal',aal)::text,false) $$;
create function pg_temp.expect(q text, msg text) returns void language plpgsql as $$
declare ok boolean:=false; begin
 begin execute q; exception when others then ok:=(sqlerrm=msg); if not ok then raise exception 'EXPECTED % GOT % for %',msg,sqlerrm,q; end if; end;
 if not ok then raise exception 'EXPECTED error % but none for %',msg,q; end if; end $$;
create function pg_temp.eq(a anycompatible, b anycompatible, what text) returns void language plpgsql as $$ begin if a is distinct from b then raise exception 'ASSERT % : % <> %',what,a,b; end if; end $$;

insert into auth.users(id,email,email_confirmed_at) values ('a0000000-0000-4000-8000-000000000001','admin@x.test',now()),('b0000000-0000-4000-8000-000000000002','owner@x.test',now()),('c0000000-0000-4000-8000-000000000003','other@x.test',now());
insert into auth.sessions(user_id) select id from auth.users;
insert into vexa_platform.administrators(user_id) values ('a0000000-0000-4000-8000-000000000001');
insert into public.organizations(id,name) values ('01000000-0000-4000-8000-000000000001','Org Uno'),('02000000-0000-4000-8000-000000000002','Org Dos');
insert into public.memberships values ('01000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002','owner','active',1);
insert into public.metric_snapshots(tenant_id,status,component_count) values ('01000000-0000-4000-8000-000000000001','published',3);
grant usage on schema public, auth to vexa_backend; grant select on auth.users to vexa_backend; grant select on public.memberships to vexa_backend;
grant execute on function auth.uid(), public.vexa_request_uid() to vexa_backend;

-- 1) lectura de equipo ajeno audita
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
set role authenticated;
select jsonb_array_length(public.platform_team_manage('01000000-0000-4000-8000-000000000001','{"operation":"list"}')->'items') as miembros \gset
reset role;
select pg_temp.eq(:miembros, 1, 'lista de miembros');
select pg_temp.eq((select count(*) from vexa_platform.audit where operation='team_list' and tenant_id='01000000-0000-4000-8000-000000000001'), 1::bigint, 'team_list auditado');
select pg_temp.eq((select details->>'kind' from vexa_platform.audit where operation='team_list'), 'members', 'kind');
-- invitaciones tambien
set role authenticated; select public.platform_team_manage('02000000-0000-4000-8000-000000000002','{"operation":"list","kind":"invitations"}') as _; reset role;
select pg_temp.eq((select count(*) from vexa_platform.audit where operation='team_list'), 2::bigint, 'dos lecturas auditadas');
-- no admin
select pg_temp.as_user('b0000000-0000-4000-8000-000000000002');
set role authenticated;
select pg_temp.expect($q$select public.platform_team_manage('01000000-0000-4000-8000-000000000001','{"operation":"list"}')$q$,'platform_access_denied');
select pg_temp.expect($q$select public.platform_support('{"operation":"active"}')$q$,'platform_access_denied');
select pg_temp.expect($q$select public.platform_org_detail('01000000-0000-4000-8000-000000000001')$q$,'platform_access_denied');
reset role;
select pg_temp.eq((select count(*) from vexa_platform.audit where operation='team_list'), 2::bigint, 'no admin no audita');

-- 2) soporte
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
set role authenticated;
select pg_temp.expect($q$select public.platform_support('{"operation":"start","tenant":"01000000-0000-4000-8000-000000000001","reason":"corto","requestId":"11111111-1111-4111-8111-111111111111","confirmed":true}')$q$,'platform_input_invalid');
select pg_temp.expect($q$select public.platform_support('{"operation":"start","tenant":"01000000-0000-4000-8000-000000000001","reason":"revisar carga de HubSpot","minutes":61,"requestId":"11111111-1111-4111-8111-111111111111","confirmed":true}')$q$,'platform_input_invalid');
select pg_temp.expect($q$select public.platform_support('{"operation":"start","tenant":"01000000-0000-4000-8000-000000000001","reason":"revisar carga de HubSpot","requestId":"11111111-1111-4111-8111-111111111111"}')$q$,'platform_input_invalid');
select pg_temp.expect($q$select public.platform_support('{"operation":"start","tenant":"99000000-0000-4000-8000-000000000001","reason":"revisar carga de HubSpot","requestId":"11111111-1111-4111-8111-111111111111","confirmed":true}')$q$,'platform_input_invalid');
select public.platform_support('{"operation":"start","tenant":"01000000-0000-4000-8000-000000000001","reason":"revisar carga de HubSpot","minutes":45,"requestId":"11111111-1111-4111-8111-111111111111","confirmed":true}')->>'replay' as r1 \gset
select public.platform_support('{"operation":"start","tenant":"01000000-0000-4000-8000-000000000001","reason":"revisar carga de HubSpot","minutes":45,"requestId":"11111111-1111-4111-8111-111111111111","confirmed":true}')->>'replay' as r2 \gset
select pg_temp.expect($q$select public.platform_support('{"operation":"start","tenant":"02000000-0000-4000-8000-000000000002","reason":"revisar carga de HubSpot","requestId":"22222222-2222-4222-8222-222222222222","confirmed":true}')$q$,'platform_support_active');
select pg_temp.expect($q$select public.platform_support('{"operation":"start","tenant":"02000000-0000-4000-8000-000000000002","reason":"otro motivo distinto","requestId":"11111111-1111-4111-8111-111111111111","confirmed":true}')$q$,'platform_request_conflict');
select public.platform_support('{"operation":"active"}')->'session'->>'mode' as modo, (public.platform_support('{"operation":"active"}')->'session'->>'expiresAt')::timestamptz - now() < interval '46 minutes' as ventana \gset
reset role;
select pg_temp.eq(:'r1','false','primer inicio'); select pg_temp.eq(:'r2','true','replay'); select pg_temp.eq(:'modo','read','modo lectura'); select pg_temp.eq(:'ventana'::boolean,true,'ventana<=45');
select pg_temp.eq((select count(*) from vexa_platform.audit where operation='support_start' and details->>'reason'='revisar carga de HubSpot'), 1::bigint, 'support_start auditado con motivo');

-- 3) rama de lectura (vexa_member) como servidor
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true), set_config('vexa.tenant_id','01000000-0000-4000-8000-000000000001',true), set_config('vexa.action','read',true);
select pg_temp.eq(public.vexa_member('01000000-0000-4000-8000-000000000001'), true, 'soporte lee org A');
select pg_temp.eq(public.vexa_member('01000000-0000-4000-8000-000000000001',array['owner']), false, 'soporte NO como owner');
select pg_temp.eq(public.vexa_member('01000000-0000-4000-8000-000000000001',array['owner','analyst','operator']), false, 'soporte NO sin viewer');
select pg_temp.eq(public.vexa_member('02000000-0000-4000-8000-000000000002'), false, 'soporte NO lee org B');
select set_config('vexa.action','import',true);
select pg_temp.eq(public.vexa_member('01000000-0000-4000-8000-000000000001'), false, 'soporte NO con accion distinta de read');
select set_config('vexa.action','',true);
select pg_temp.eq(public.vexa_member('01000000-0000-4000-8000-000000000001'), false, 'soporte NO sin accion (cliente PostgREST)');
rollback;
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000003',true), set_config('vexa.tenant_id','01000000-0000-4000-8000-000000000001',true), set_config('vexa.action','read',true);
select pg_temp.eq(public.vexa_member('01000000-0000-4000-8000-000000000001'), false, 'usuario sin sesion no lee');
rollback;
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true), set_config('vexa.tenant_id','01000000-0000-4000-8000-000000000001',true), set_config('vexa.action','read',true);
select pg_temp.eq(public.vexa_member('01000000-0000-4000-8000-000000000001',array['owner']), true, 'miembro real intacto');
rollback;

-- 4) org_detail
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
set role authenticated;
select public.platform_org_detail('01000000-0000-4000-8000-000000000001') as d \gset
select public.platform_org_detail('01000000-0000-4000-8000-000000000001') as d2 \gset
select pg_temp.expect($q$select public.platform_org_detail('99000000-0000-4000-8000-000000000001')$q$,'platform_input_invalid');
reset role;
select pg_temp.eq((:'d'::jsonb)->'members'->>'owner','1','owner count');
select pg_temp.eq((:'d'::jsonb)->'cuts'->0->>'status','published','cortes');
select pg_temp.eq((:'d'::jsonb)->'support'->0->>'reason','revisar carga de HubSpot','historial soporte');
select pg_temp.eq(position('@' in :'d'), 0, 'sin correos en la ficha');
select pg_temp.eq((select count(*) from vexa_platform.audit where operation='org_view'), 1::bigint, 'org_view auditado y deduplicado');

-- 5) fin y MFA
set role authenticated;
select public.platform_support('{"operation":"end"}')->>'ended' as e1 \gset
select public.platform_support('{"operation":"end"}')->>'ended' as e2 \gset
select public.platform_support('{"operation":"active"}')->>'active' as act \gset
reset role;
select pg_temp.eq(:'e1','true','fin'); select pg_temp.eq(:'e2','false','fin repetido'); select pg_temp.eq(:'act','false','ya no activa');
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true), set_config('vexa.tenant_id','01000000-0000-4000-8000-000000000001',true), set_config('vexa.action','read',true);
select pg_temp.eq(public.vexa_member('01000000-0000-4000-8000-000000000001'), false, 'tras terminar no lee');
rollback;
-- expiracion
insert into vexa_platform.support_sessions(admin_id,tenant_id,reason,request_id,started_at,expires_at) values ('a0000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001','sesion que expira ya',gen_random_uuid(),clock_timestamp()-interval '10 minutes',clock_timestamp()-interval '1 minute');
begin; set local role vexa_backend;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true), set_config('vexa.tenant_id','01000000-0000-4000-8000-000000000001',true), set_config('vexa.action','read',true);
select pg_temp.eq(public.vexa_member('01000000-0000-4000-8000-000000000001'), false, 'expirada no lee');
rollback;
-- mas de 60 min rechazado por la tabla
select pg_temp.expect($q$insert into vexa_platform.support_sessions(admin_id,tenant_id,reason,request_id,expires_at) values ('a0000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000001','muy larga, sesenta y uno',gen_random_uuid(),clock_timestamp()+interval '61 minutes')$q$,'new row for relation "support_sessions" violates check constraint "support_sessions_check"');
-- MFA apagado por defecto no bloquea; encendido exige aal2
update vexa_platform.settings set value='true'::jsonb where key='mfa_required';
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001','aal1');
set role authenticated;
select pg_temp.expect($q$select public.platform_support('{"operation":"start","tenant":"01000000-0000-4000-8000-000000000001","reason":"revisar carga de HubSpot","requestId":"33333333-3333-4333-8333-333333333333","confirmed":true}')$q$,'platform_mfa_required');
reset role;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001','aal2');
set role authenticated;
select public.platform_support('{"operation":"start","tenant":"01000000-0000-4000-8000-000000000001","reason":"revisar carga de HubSpot","requestId":"33333333-3333-4333-8333-333333333333","confirmed":true}')->>'replay' as m \gset
reset role;
select pg_temp.eq(:'m','false','aal2 inicia');
-- admin miembro de la org no puede
delete from vexa_platform.support_sessions; update vexa_platform.settings set value='false'::jsonb where key='mfa_required';
insert into public.memberships values ('02000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','viewer','active',1);
set role authenticated;
select pg_temp.expect($q$select public.platform_support('{"operation":"start","tenant":"02000000-0000-4000-8000-000000000002","reason":"revisar carga de HubSpot","requestId":"44444444-4444-4444-8444-444444444444","confirmed":true}')$q$,'platform_support_own_organization');
reset role;

-- 6) team_my_invitations: solo el propio correo confirmado
insert into public.team_invitations(tenant_id,request_id,email,role,expires_at) values
 ('01000000-0000-4000-8000-000000000001',gen_random_uuid(),'other@x.test','analyst',now()+interval '3 days'),
 ('02000000-0000-4000-8000-000000000002',gen_random_uuid(),'other@x.test','viewer',now()-interval '2 days'),
 ('01000000-0000-4000-8000-000000000001',gen_random_uuid(),'owner@x.test','viewer',now()+interval '3 days');
select pg_temp.as_user('c0000000-0000-4000-8000-000000000003');
set role authenticated;
select public.team_my_invitations() as mi \gset
reset role;
select pg_temp.eq(jsonb_array_length((:'mi'::jsonb)->'pending'),1,'una pendiente propia');
select pg_temp.eq((:'mi'::jsonb)->'pending'->0->>'organization','Org Uno','organizacion');
select pg_temp.eq(jsonb_array_length((:'mi'::jsonb)->'expired'),1,'una vencida propia');
select pg_temp.eq(position('owner@x.test' in :'mi'),0,'sin correos ajenos');
update auth.users set email_confirmed_at=null where id='c0000000-0000-4000-8000-000000000003';
set role authenticated;
select public.team_my_invitations() as mi2 \gset
reset role;
select pg_temp.eq(jsonb_array_length((:'mi2'::jsonb)->'pending'),0,'correo sin confirmar -> vacio');
set role authenticated; select set_config('request.jwt.claim.sub','',false); select pg_temp.expect($q$select public.team_my_invitations()$q$,'team_authentication_required'); reset role;
select 'sql-ok' as resultado;
