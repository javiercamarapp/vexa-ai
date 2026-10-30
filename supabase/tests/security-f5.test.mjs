// F5-seguridad (29-oct) sobre un Postgres 17 LOCAL efímero (ops/lib/localpg.mjs, sin red). Cada bloque muestra el defecto ANTES de la migración nueva y el arreglo DESPUÉS.
// Base: esquema hasta la última migración de seguridad del 29-oct (0700). Las migraciones F5 (20261206*) se aplican encima.
//   node --test supabase/tests/security-f5.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {startLocalPg} from '../../ops/lib/localpg.mjs';
const mig=n=>new URL('../migrations/'+n,import.meta.url).pathname;
const BASE='20261205000700_default_privileges_and_trigger_functions.sql';
const ADM='a0000000-0000-4000-8000-000000000001';

test('R2-01: con mfa_required activo, require_admin en la base exige aal2 (la propia /seguridad y el estado «soy administrador» siguen con aal1); apagado no cambia nada',async t=>{
 const pg=await startLocalPg({label:'f5mfa'});try{
 const db='f5a';pg.createDb(db);pg.applySchema(db,{upTo:BASE});
 pg.sql(db,`alter table auth.users add column if not exists email_confirmed_at timestamptz;
  insert into auth.users(id,email,email_confirmed_at) values ('${ADM}','admin@x.test',now()),('c0000000-0000-4000-8000-000000000003','otro@x.test',now());
  insert into auth.sessions(user_id) select id from auth.users;
  insert into vexa_platform.administrators(user_id) values ('${ADM}');`);
 const como=(uid,aal,sql)=>{const sid=pg.sql(db,`select id from auth.sessions where user_id='${uid}' limit 1`);return pg.sql(db,`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${uid}',true), set_config('request.jwt.claims','{"session_id":"${sid}","aal":"${aal}"}',true); ${sql}; rollback;`);};
 const falla=(uid,aal,sql,msg)=>assert.throws(()=>como(uid,aal,sql),new RegExp(msg));
 const OPS={manage_list:`select public.platform_manage('{"operation":"list"}')`,observe:`select public.platform_observe('{"operation":"snapshot"}')`,
  security_events:`select public.platform_security_events('{}')`,support_active:`select public.platform_support('{"operation":"active"}')`};
 const encender=()=>pg.sql(db,`update vexa_platform.settings set value='true'::jsonb where key='mfa_required'`);
 await t.test('ANTES: con el interruptor encendido y una sesión aal1, las operaciones de plataforma pasan (el defecto)',()=>{
  encender();
  assert.doesNotThrow(()=>como(ADM,'aal1',OPS.manage_list),'platform_manage list pasa con aal1');
  assert.doesNotThrow(()=>como(ADM,'aal1',OPS.support_active),'platform_support active pasa con aal1');
 });
 pg.file(db,mig('20261206000000_platform_mfa_in_database.sql'));
 await t.test('DESPUÉS: con el interruptor encendido y aal1, cada operación falla con platform_mfa_required; con aal2 pasan',()=>{
  encender();
  for(const [n,q] of Object.entries(OPS))falla(ADM,'aal1',q,'platform_mfa_required');
  falla(ADM,'aal1',`select public.platform_org_detail('01000000-0000-4000-8000-000000000001')`,'platform_mfa_required');
  falla(ADM,'aal1',`select public.platform_team_manage('01000000-0000-4000-8000-000000000001','{"operation":"list"}')`,'platform_mfa_required');
  for(const [n,q] of Object.entries(OPS))assert.doesNotThrow(()=>como(ADM,'aal2',q),n+' con aal2');
 });
 await t.test('la operación status sigue respondiendo con aal1 (enrolar el TOTP no se bloquea) y un no administrador sigue siendo platform_access_denied',()=>{
  encender();
  assert.match(como(ADM,'aal1',`select public.platform_manage('{"operation":"status"}')`),/"administrator": true|"administrator":true/);
  falla('c0000000-0000-4000-8000-000000000003','aal2',`select public.platform_manage('{"operation":"status"}')`,'platform_access_denied');
  falla('c0000000-0000-4000-8000-000000000003','aal2',OPS.manage_list,'platform_access_denied');
 });
 await t.test('con el interruptor apagado (valor por defecto) nada cambia: aal1 opera todo',()=>{
  pg.sql(db,`update vexa_platform.settings set value='false'::jsonb where key='mfa_required'`);
  for(const q of Object.values(OPS))assert.doesNotThrow(()=>como(ADM,'aal1',q));
  assert.equal(pg.sql(db,`select value from vexa_platform.settings where key='mfa_required'`),'false');
 });
 await t.test('permisos: authenticated no ejecuta require_admin_aal1 ni el núcleo directamente; anon no ejecuta platform_manage',()=>{
  assert.throws(()=>pg.sql(db,`begin; set local role authenticated; select vexa_platform.require_admin_aal1(); rollback;`),/permission denied/);
  assert.throws(()=>pg.sql(db,`begin; set local role authenticated; select vexa_platform.platform_manage_core('{"operation":"status"}'); rollback;`),/permission denied/);
  assert.throws(()=>pg.sql(db,`begin; set local role anon; select public.platform_manage('{"operation":"status"}'); rollback;`),/permission denied/);
 });
 }finally{await pg.stop();}
});

const h=n=>Number(n).toString(16).padStart(64,'0');
test('R2-06: el tope horario del correo cuenta por par (correo, IP): una IP atacante no deja sin enlace a la víctima desde otra IP',async t=>{
 const pg=await startLocalPg({label:'f5email'});try{
 const db='f5b';pg.createDb(db);pg.applySchema(db,{upTo:BASE});
 const call=(ip,em)=>JSON.parse(pg.sql(db,`begin; set local role vexa_backend; select public.email_auth_admit(${ip?`'${ip}'`:'null'},'${em}'); commit;`).split('\n').find(l=>l.startsWith('{')));
 const envejecer=()=>pg.sql(db,`update public.email_auth_events set at=at-interval '2 minutes'`);
 const victima=h(900),ipA=h(1),ipB=h(2);
 await t.test('ANTES: 6 admisiones desde la IP A (una por minuto) dejan a la IP B de la víctima en duplicate durante la hora (el defecto)',()=>{
  for(let i=0;i<6;i++){assert.equal(call(ipA,victima).verdict,'ok',`A ${i}`);envejecer();}
  assert.equal(call(ipB,victima).verdict,'duplicate','la víctima queda bloqueada por lo que hizo el atacante');
 });
 pg.file(db,mig('20261206000100_email_auth_per_ip_hourly_cap.sql'));
 pg.sql(db,`delete from public.email_auth_events`);
 await t.test('DESPUÉS: la IP A llega a su tope horario por correo (6), pero pasados 60 s la IP B se admite',()=>{
  for(let i=0;i<6;i++){assert.equal(call(ipA,victima).verdict,'ok',`A ${i}`);envejecer();}
  assert.equal(call(ipA,victima).verdict,'duplicate','la IP A ya agotó sus 6 por hora para ese correo');
  assert.equal(call(ipB,victima).verdict,'ok','otra IP no hereda el castigo');
 });
 await t.test('la ventana de 60 s sigue siendo global por correo (un solo envío pendiente): la IP B inmediatamente después de la A es duplicate',()=>{
  assert.equal(call(h(3),h(901)).verdict,'ok');assert.equal(call(h(4),h(901)).verdict,'duplicate');
 });
 await t.test('sin IP conocida, el par (correo, null) también tiene su tope horario; el veredicto no depende de que exista la cuenta',()=>{
  for(let i=0;i<6;i++){assert.equal(call(null,h(902)).verdict,'ok');envejecer();}
  assert.equal(call(null,h(902)).verdict,'duplicate');
  assert.equal(pg.sql(db,`select count(*) from public.email_auth_events where (key_hash !~ '^[a-f0-9]{64}$') or (ip_hash is not null and ip_hash !~ '^[a-f0-9]{64}$')`),'0');
 });
 }finally{await pg.stop();}
});

// ---- Autoridad del equipo: R2-09, R2-02 y MFA opcional de propietarios ----
const T1='11111111-0000-4000-8000-000000000001',T2='11111111-0000-4000-8000-000000000002',T3='11111111-0000-4000-8000-000000000003';
const UA='aaaaaaa1-0000-4000-8000-000000000001',UB='aaaaaaa2-0000-4000-8000-000000000002',UX='aaaaaaa3-0000-4000-8000-000000000003',UC='aaaaaaa4-0000-4000-8000-000000000004',UADM='aaaaaaa5-0000-4000-8000-000000000005';
const rid=n=>`bbbbbbb${n}-0000-4000-8000-00000000000${n}`;
function equipo(pg,db){
 pg.sql(db,`alter table auth.users add column if not exists email_confirmed_at timestamptz;
  create table if not exists auth.mfa_factors(id uuid default gen_random_uuid(), user_id uuid, status text, factor_type text default 'totp');
  insert into auth.users(id,email,email_confirmed_at) values ('${UA}','a@x.test',now()),('${UB}','b@x.test',now()),('${UX}','x@x.test',now()),('${UC}','c@x.test',now()),('${UADM}','adm@x.test',now());
  insert into auth.sessions(user_id) select id from auth.users;
  insert into vexa_platform.administrators(user_id) values ('${UADM}');
  insert into public.organizations(id,name) values ('${T1}','T1'),('${T2}','T2'),('${T3}','T3');
  insert into public.memberships(tenant_id,user_id,role,status) select t::uuid,u::uuid,r,'active' from (values ('${T1}','${UA}','owner'),('${T1}','${UB}','owner'),('${T1}','${UC}','analyst'),('${T2}','${UA}','owner'),('${T2}','${UB}','owner'),('${T3}','${UA}','owner'),('${T3}','${UB}','owner')) v(t,u,r);`);
 const como=(uid,aal,sql)=>{const sid=pg.sql(db,`select id from auth.sessions where user_id='${uid}' limit 1`);return pg.sql(db,`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${uid}',true), set_config('request.jwt.claims','{"session_id":"${sid}","aal":"${aal}"}',true); ${sql}; rollback;`);};
 const comoCommit=(uid,aal,sql)=>{const sid=pg.sql(db,`select id from auth.sessions where user_id='${uid}' limit 1`);return pg.sql(db,`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${uid}',true), set_config('request.jwt.claims','{"session_id":"${sid}","aal":"${aal}"}',true); ${sql}; commit;`);};
 const json=out=>JSON.parse(out.split('\n').find(l=>l.startsWith('{')));
 const tm=(t,o)=>`select public.team_manage('${t}','${JSON.stringify(o)}'::jsonb)`;
 const ptm=(t,o)=>`select public.platform_team_manage('${t}','${JSON.stringify(o)}'::jsonb)`;
 const version=(t,u)=>pg.sql(db,`select permissions_version from public.memberships where tenant_id='${t}' and user_id='${u}'`);
 return {como,comoCommit,json,tm,ptm,version};
}
const F5=['20261206000000_platform_mfa_in_database.sql','20261206000100_email_auth_per_ip_hourly_cap.sql','20261206000300_team_authority_and_owner_mfa.sql'];

test('R2-09: revocar o degradar a quien creó invitaciones pendientes las cancela; aceptar exige que el autor siga siendo propietario',async t=>{
 const pg=await startLocalPg({label:'f5team'});try{
 const db='f5c';pg.createDb(db);pg.applySchema(db,{upTo:BASE});const e=equipo(pg,db);
 const invitar=(t,quien,rolInv,n,correo='x@x.test')=>e.comoCommit(quien,'aal1',e.tm(t,{operation:'invite',email:correo,role:rolInv,requestId:rid(n),confirmed:true}));
 const idInv=t=>pg.sql(db,`select id from public.team_invitations where tenant_id='${t}' order by created_at desc limit 1`);
 const aceptar=(id)=>e.comoCommit(UX,'aal1',e.tm(T1,{operation:'accept',id}).replace(`'${T1}'`,'null'));
 await t.test('ANTES: A invita a X como propietario, B revoca a A y X todavía puede aceptar (el defecto)',()=>{
  invitar(T1,UA,'owner',1);const id=idInv(T1);
  e.comoCommit(UB,'aal1',e.tm(T1,{operation:'revoke',id:UA,version:Number(e.version(T1,UA))}));
  assert.doesNotThrow(()=>aceptar(id),'la invitación de un propietario revocado sigue aceptándose');
  assert.equal(pg.sql(db,`select role from public.memberships where tenant_id='${T1}' and user_id='${UX}'`),'owner');
 });
 for(const f of F5)pg.file(db,mig(f));
 await t.test('DESPUÉS (revocación): la invitación queda cancelada y aceptar falla',()=>{
  invitar(T2,UA,'owner',2);const id=idInv(T2);
  e.comoCommit(UB,'aal1',e.tm(T2,{operation:'revoke',id:UA,version:Number(e.version(T2,UA))}));
  assert.equal(pg.sql(db,`select status from public.team_invitations where id='${id}'`),'cancelled');
  assert.throws(()=>aceptar(id),/team_invitation_unavailable/);
  assert.equal(pg.sql(db,`select count(*) from public.memberships where tenant_id='${T2}' and user_id='${UX}'`),'0');
 });
 await t.test('DESPUÉS (degradación): al bajar a A a analista sus invitaciones pendientes se cancelan; las de B siguen vivas',()=>{
  invitar(T3,UA,'owner',3,'x@x.test');
  e.comoCommit(UB,'aal1',e.tm(T3,{operation:'invite',email:'otro@x.test',role:'viewer',requestId:rid(4),confirmed:true}));
  e.comoCommit(UB,'aal1',e.tm(T3,{operation:'role',id:UA,version:Number(e.version(T3,UA)),role:'analyst'}));
  assert.equal(pg.sql(db,`select count(*) from public.team_invitations where tenant_id='${T3}' and status='cancelled' and created_by='${UA}'`),'1');
  assert.equal(pg.sql(db,`select count(*) from public.team_invitations where tenant_id='${T3}' and status='pending' and created_by='${UB}'`),'1');
 });
 await t.test('red de seguridad al aceptar: si el autor dejó de ser propietario sin pasar por team_manage, aceptar también falla',()=>{
  const T4='11111111-0000-4000-8000-000000000004';
  pg.sql(db,`insert into public.organizations(id,name) values ('${T4}','T4'); insert into public.memberships(tenant_id,user_id,role,status) values ('${T4}','${UA}','owner','active'),('${T4}','${UB}','owner','active');`);
  invitar(T4,UA,'viewer',5);const id=idInv(T4);
  pg.sql(db,`update public.memberships set status='revoked' where tenant_id='${T4}' and user_id='${UA}'`);
  assert.throws(()=>e.como(UX,'aal1',e.tm(T4,{operation:'accept',id})),/team_invitation_unavailable/);
 });
 }finally{await pg.stop();}
});

test('R2-02: la plataforma solo concede propietario con sesión de soporte vigente en esa organización, motivo y segundo factor; el resto de roles no cambia',async t=>{
 const pg=await startLocalPg({label:'f5plat'});try{
 const db='f5d';pg.createDb(db);pg.applySchema(db,{upTo:BASE});const e=equipo(pg,db);
 const inv=(rol,n,extra={})=>e.ptm(T1,{operation:'invite',email:`p${n}@x.test`,role:rol,requestId:rid(n),confirmed:true,...extra});
 await t.test('ANTES: un administrador invita a un propietario sin soporte ni motivo (el defecto)',()=>{
  assert.doesNotThrow(()=>e.comoCommit(UADM,'aal1',inv('owner',1)));
 });
 for(const f of F5)pg.file(db,mig(f));
 await t.test('DESPUÉS: sin sesión de soporte falla; con soporte pero sin motivo falla; invitar otros roles sigue igual',()=>{
  assert.throws(()=>e.como(UADM,'aal1',inv('owner',2,{reason:'Cliente pidió acceso de propietario'})),/platform_owner_grant_requires_support/);
  assert.doesNotThrow(()=>e.como(UADM,'aal1',inv('analyst',3)),'analista no exige soporte');
  pg.sql(db,`insert into vexa_platform.support_sessions(admin_id,tenant_id,reason,request_id,expires_at) values ('${UADM}','${T1}','revisar carga de HubSpot','${rid(9)}',clock_timestamp()+interval '30 minutes')`);
  assert.throws(()=>e.como(UADM,'aal1',inv('owner',4)),/team_input_invalid/);
  assert.throws(()=>e.como(UADM,'aal1',inv('owner',4,{reason:'corto'})),/team_input_invalid/);
 });
 await t.test('con soporte vigente en OTRA organización no basta; con soporte, motivo y (interruptor activo) aal2 pasa y deja el motivo en team_audit',()=>{
  assert.throws(()=>e.como(UADM,'aal1',e.ptm(T2,{operation:'invite',email:'q@x.test',role:'owner',requestId:rid(5),confirmed:true,reason:'Cliente pidió acceso de propietario'})),/platform_owner_grant_requires_support/);
  pg.sql(db,`update vexa_platform.settings set value='true'::jsonb where key='mfa_required'`);
  assert.throws(()=>e.como(UADM,'aal1',inv('owner',6,{reason:'Cliente pidió acceso de propietario'})),/platform_mfa_required/);
  pg.sql(db,`update vexa_platform.settings set value='false'::jsonb where key='mfa_required'`);
  e.comoCommit(UADM,'aal1',inv('owner',7,{reason:'Cliente pidió acceso de propietario'}));
  assert.equal(pg.sql(db,`select after_value->>'reason' from public.team_audit where tenant_id='${T1}' and operation='invite' and after_value->>'platform'='true' order by id desc limit 1`),'Cliente pidió acceso de propietario');
 });
 await t.test('cambiar el rol de un miembro a propietario también exige soporte y motivo',()=>{
  const v=Number(e.version(T1,UC));
  assert.throws(()=>e.como(UADM,'aal1',e.ptm(T2,{operation:'role',id:UA,version:1,role:'owner'})),/platform_owner_grant_requires_support|team_version_conflict/);
  pg.sql(db,`delete from vexa_platform.support_sessions`);
  assert.throws(()=>e.como(UADM,'aal1',e.ptm(T1,{operation:'role',id:UC,version:v,role:'owner',reason:'Cliente pidió acceso de propietario'})),/platform_owner_grant_requires_support/);
 });
 }finally{await pg.stop();}
});

test('MFA de propietarios por organización: apagada por defecto, se enciende con aal2 y dos propietarios, y entonces las acciones fuertes exigen aal2 en la base',async t=>{
 const pg=await startLocalPg({label:'f5omfa'});try{
 const db='f5e';pg.createDb(db);pg.applySchema(db,{upTo:BASE});const e=equipo(pg,db);
 for(const f of F5)pg.file(db,mig(f));
 const org=(t,o)=>`select public.org_security('${t}','${JSON.stringify(o)}'::jsonb)`;
 const invitar=(n)=>e.tm(T1,{operation:'invite',email:`m${n}@x.test`,role:'viewer',requestId:rid(n),confirmed:true});
 await t.test('por defecto está apagada: un propietario con aal1 invita, cambia roles y lee la opción',()=>{
  assert.equal(e.json(e.como(UA,'aal1',org(T1,{operation:'get'}))).requireOwnerMfa,false);
  assert.doesNotThrow(()=>e.como(UA,'aal1',invitar(1)));
 });
 await t.test('quien no es propietario no lee ni cambia la opción (team_owner_required)',()=>{
  assert.throws(()=>e.como(UC,'aal2',org(T1,{operation:'get'})),/team_owner_required/);
  assert.throws(()=>e.como(UC,'aal2',org(T1,{operation:'set',enabled:true,confirmed:true})),/team_owner_required/);
 });
 await t.test('encenderla exige aal2 y al menos dos propietarios activos; el aviso cuenta propietarios sin factor',()=>{
  assert.throws(()=>e.comoCommit(UA,'aal1',org(T1,{operation:'set',enabled:true,confirmed:true})),/owner_mfa_required/);
  assert.throws(()=>e.comoCommit(UA,'aal2',org(T1,{operation:'set',enabled:true})),/team_input_invalid/,'sin confirmed');
  const antes=e.json(e.como(UA,'aal1',org(T1,{operation:'get'})));assert.equal(antes.activeOwners,2);assert.equal(antes.ownersWithoutFactor,2);
  pg.sql(db,`insert into auth.mfa_factors(user_id,status) values ('${UA}','verified'),('${UB}','unverified')`);
  assert.equal(e.json(e.como(UA,'aal1',org(T1,{operation:'get'}))).ownersWithoutFactor,1);
  const r=e.json(e.comoCommit(UA,'aal2',org(T1,{operation:'set',enabled:true,confirmed:true})));assert.equal(r.requireOwnerMfa,true);assert.equal(r.changed,true);
  assert.equal(pg.sql(db,`select operation from public.team_audit where tenant_id='${T1}' and operation like 'owner_mfa%'`),'owner_mfa_on');
  pg.sql(db,`insert into public.organizations(id,name) values ('22222222-0000-4000-8000-000000000001','Sola'); insert into public.memberships(tenant_id,user_id,role,status) values ('22222222-0000-4000-8000-000000000001','${UA}','owner','active')`);
  assert.throws(()=>e.comoCommit(UA,'aal2',org('22222222-0000-4000-8000-000000000001',{operation:'set',enabled:true,confirmed:true})),/owner_mfa_needs_second_owner/);
 });
 await t.test('encendida: invitar, cambiar rol, revocar y cancelar con aal1 fallan con owner_mfa_required; con aal2 pasan; listar y aceptar no se ven afectados',()=>{
  assert.throws(()=>e.como(UA,'aal1',invitar(2)),/owner_mfa_required/);
  assert.throws(()=>e.como(UA,'aal1',e.tm(T1,{operation:'role',id:UC,version:Number(e.version(T1,UC)),role:'viewer'})),/owner_mfa_required/);
  assert.throws(()=>e.como(UA,'aal1',e.tm(T1,{operation:'revoke',id:UC,version:Number(e.version(T1,UC))})),/owner_mfa_required/);
  assert.doesNotThrow(()=>e.como(UA,'aal2',invitar(2)));
  assert.doesNotThrow(()=>e.como(UA,'aal1',e.tm(T1,{operation:'list'})),'listar sigue con aal1');
 });
 await t.test('apagarla también exige aal2; otra organización no se ve afectada; el rol del backend ve el interruptor y authenticated no',()=>{
  assert.throws(()=>e.comoCommit(UA,'aal1',org(T1,{operation:'set',enabled:false,confirmed:true})),/owner_mfa_required/);
  assert.doesNotThrow(()=>e.como(UA,'aal1',e.tm(T2,{operation:'invite',email:'z@x.test',role:'viewer',requestId:rid(3),confirmed:true})),'T2 no la activó');
  assert.equal(pg.sql(db,`begin; set local role vexa_backend; select public.owner_mfa_required('${T1}'); commit;`).split('\n')[0],'t');
  assert.throws(()=>pg.sql(db,`begin; set local role authenticated; select public.owner_mfa_required('${T1}'); rollback;`),/permission denied/);
  assert.throws(()=>pg.sql(db,`begin; set local role authenticated; select * from public.organization_security; rollback;`),/permission denied/);
  const r=e.json(e.comoCommit(UA,'aal2',org(T1,{operation:'set',enabled:false,confirmed:true})));assert.equal(r.requireOwnerMfa,false);
  assert.doesNotThrow(()=>e.como(UA,'aal1',invitar(7)),'apagada otra vez');
 });
 }finally{await pg.stop();}
});

test('R2-14: la retención borra solo filas viejas (por lotes, con piso de 30 días) y bearer_invalid tiene cupo propio fuera del tope global de 600/min',async t=>{
 const pg=await startLocalPg({label:'f5ret'});try{
 const db='f5f';pg.createDb(db);pg.applySchema(db,{upTo:BASE});
 const rec=(kind,ip,n=1)=>pg.sql(db,`begin; set local role vexa_backend; select public.record_security_event(jsonb_build_object('kind','${kind}','ip_hash','${h(ip)}','route','/x','method','GET')) from generate_series(1,${n}); commit;`);
 const cuenta=k=>Number(pg.sql(db,`select count(*) from vexa_platform.security_events where kind='${k}'`));
 const inundar=(kind,total,huellas)=>pg.sql(db,`begin; set local role vexa_backend; select public.record_security_event(jsonb_build_object('kind','${kind}','ip_hash',encode(sha256((g%${huellas})::text::bytea),'hex'),'route','/x','method','GET')) from generate_series(1,${total}) g; commit;`);
 await t.test('ANTES: 700 auth_401 de 250 huellas agotan el tope global y un bearer_invalid ya no se guarda (el defecto)',()=>{
  inundar('auth_401',700,250);
  assert.ok(Number(pg.sql(db,`select max(hits) from vexa_platform.security_event_counters where kind='*'`))>600,'tope global rebasado');
  const antes=cuenta('bearer_invalid');rec('bearer_invalid',9001);
  assert.equal(cuenta('bearer_invalid'),antes,'silenciado por el tope global');
 });
 pg.file(db,mig('20261206000200_security_events_retention.sql'));
 await t.test('DESPUÉS: con el tope global agotado, bearer_invalid y webhook_signature_invalid se siguen guardando (cupo propio de 120/min)',()=>{
  const b0=cuenta('bearer_invalid'),w0=cuenta('webhook_signature_invalid');
  rec('bearer_invalid',9002);rec('webhook_signature_invalid',9003);
  assert.equal(cuenta('bearer_invalid'),b0+1);assert.equal(cuenta('webhook_signature_invalid'),w0+1);
  inundar('bearer_invalid',400,200);
  assert.ok(cuenta('bearer_invalid')-b0<=125,'tope propio de 120 por minuto, hubo '+(cuenta('bearer_invalid')-b0));
 });
 await t.test('retención: borra solo filas de más de 180 días, por lotes; un periodo menor a 30 días se rechaza; UPDATE/DELETE directos siguen prohibidos',()=>{
  pg.sql(db,`alter table vexa_platform.security_events disable trigger security_events_append_only;
   update vexa_platform.security_events set at=clock_timestamp()-interval '200 days' where id in(select id from vexa_platform.security_events order by id limit 30);
   update vexa_platform.security_events set at=clock_timestamp()-interval '100 days' where id in(select id from vexa_platform.security_events order by id desc limit 10);
   alter table vexa_platform.security_events enable trigger security_events_append_only;`);
  const total=Number(pg.sql(db,`select count(*) from vexa_platform.security_events`));
  const r1=JSON.parse(pg.sql(db,`begin; set local role vexa_backend; select vexa_platform.security_events_retain(interval '180 days',20); commit;`).split('\n')[0]);
  assert.equal(r1.events_deleted,20);assert.equal(r1.more,true);
  const r2=JSON.parse(pg.sql(db,`begin; set local role vexa_backend; select vexa_platform.security_events_retain(interval '180 days',20); commit;`).split('\n')[0]);
  assert.equal(r2.events_deleted,10);assert.equal(r2.more,false);
  assert.equal(Number(pg.sql(db,`select count(*) from vexa_platform.security_events`)),total-30,'solo se fueron las de 200 días; las de 100 y las recientes se conservan');
  assert.throws(()=>pg.sql(db,`begin; set local role vexa_backend; select vexa_platform.security_events_retain(interval '10 days'); commit;`),/retention_window_too_short/);
  assert.throws(()=>pg.sql(db,`delete from vexa_platform.security_events where id=(select min(id) from vexa_platform.security_events)`),/security_events_append_only/,'DELETE directo sigue prohibido');
  assert.throws(()=>pg.sql(db,`update vexa_platform.security_events set severity='info'`),/security_events_append_only/);
  assert.throws(()=>pg.sql(db,`select set_config('vexa.retention','security_events:1',false); delete from vexa_platform.security_events`),/security_events_append_only/,'una variable adivinada no abre el borrado');
  assert.throws(()=>pg.sql(db,`begin; set local role authenticated; select vexa_platform.security_events_retain(); rollback;`),/permission denied/);
 });
 }finally{await pg.stop();}
});
