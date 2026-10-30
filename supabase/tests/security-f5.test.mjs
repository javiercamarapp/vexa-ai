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
