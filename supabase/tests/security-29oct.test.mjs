// Cierre de seguridad 29-oct sobre un Postgres 17 LOCAL (ops/lib/localpg.mjs, sin red): AUTH-03, RLS-01, LIFE-02 y tipos de archivo.
// Cada bloque crea su base, aplica el esquema hasta la última migración vigente en producción, muestra el defecto ANTES y el arreglo DESPUÉS.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {startLocalPg} from '../../ops/lib/localpg.mjs';
const mig=n=>new URL('../migrations/'+n,import.meta.url).pathname;
const BASE='20261130000100_retention_erase_attachments.sql';
const h=n=>Number(n).toString(16).padStart(64,'0');
const pg=await startLocalPg({label:'sec29'});
after(async()=>{await pg.stop();});

test('AUTH-03: email_auth_admit limita por IP y por correo, compartido entre conexiones, sin enumerar cuentas',async t=>{
 const db='s29a';pg.createDb(db);pg.applySchema(db,{upTo:BASE});pg.file(db,mig('20261205000000_email_auth_throttle.sql'));
 const call=(ip,em,role='vexa_backend')=>JSON.parse(pg.sql(db,`begin; set local role ${role}; select public.email_auth_admit(${ip?`'${ip}'`:'null'},'${em}'); commit;`).split('\n').find(l=>l.startsWith('{')));
 await t.test('IP: 10 correos distintos por minuto, el 11.º es ip_limited con Retry-After; otra IP sigue admitida',()=>{
  for(let i=0;i<10;i++)assert.equal(call(h(1),h(100+i)).verdict,'ok',`intento ${i}`);
  const r=call(h(1),h(200));assert.equal(r.verdict,'ip_limited');assert.ok(r.retry_after>=1&&r.retry_after<=60);
  assert.equal(call(h(2),h(201)).verdict,'ok','otra IP legítima no se ve afectada por la atacante');
 });
 await t.test('correo: la misma huella dos veces en un minuto es duplicate (aunque venga de otra IP o de ninguna)',()=>{
  assert.equal(call(h(3),h(300)).verdict,'ok');assert.equal(call(h(4),h(300)).verdict,'duplicate');assert.equal(call(null,h(300)).verdict,'duplicate');
 });
 await t.test('tope por hora del correo (6) y de la IP (60): se aplican con eventos antiguos fuera del minuto',()=>{
  pg.sql(db,`insert into public.email_auth_events(scope,key_hash,at) select 'email','${h(400)}',clock_timestamp()-interval '30 minutes'-(g||' seconds')::interval from generate_series(1,6) g;`);
  assert.equal(call(h(5),h(400)).verdict,'duplicate','6 en la última hora = tope');
  pg.sql(db,`insert into public.email_auth_events(scope,key_hash,at) select 'ip','${h(6)}',clock_timestamp()-interval '30 minutes'-(g||' seconds')::interval from generate_series(1,60) g;`);
  const r=call(h(6),h(401));assert.equal(r.verdict,'ip_limited');assert.equal(r.retry_after,300);
 });
 await t.test('no enumera cuentas: el veredicto no depende de que exista un usuario con ese correo',()=>{
  pg.sql(db,`insert into auth.users(id,email) values (gen_random_uuid(),'real@example.invalid');`);
  const a=[call(h(7),h(500)).verdict,call(h(7),h(500)).verdict],b=[call(h(8),h(501)).verdict,call(h(8),h(501)).verdict];
  assert.deepEqual(a,b);assert.deepEqual(a,['ok','duplicate']);
  assert.equal(pg.sql(db,`select count(*) from public.email_auth_events where key_hash !~ '^[a-f0-9]{64}$'`),'0','solo huellas');
 });
 await t.test('los rechazados no inflan la tabla y la poda quita filas de más de 1 hora',()=>{
  const before=Number(pg.sql(db,`select count(*) from public.email_auth_events`));
  for(let i=0;i<5;i++)call(h(1),h(600+i));// la IP h(1) ya está limitada
  assert.equal(Number(pg.sql(db,`select count(*) from public.email_auth_events`)),before);
  pg.sql(db,`insert into public.email_auth_events(scope,key_hash,at) values ('ip','${h(9)}',clock_timestamp()-interval '3 hours')`);
  call(h(10),h(700));assert.equal(pg.sql(db,`select count(*) from public.email_auth_events where at<clock_timestamp()-interval '1 hour'`),'0');
 });
 await t.test('permisos: anon, authenticated y service_role no ejecutan la función ni tocan la tabla; entrada inválida se rechaza',()=>{
  for(const role of ['anon','authenticated'])assert.throws(()=>call(h(11),h(800),role),/permission denied/);
  assert.throws(()=>pg.sql(db,`begin; set local role authenticated; select count(*) from public.email_auth_events; commit;`),/permission denied/);
  assert.throws(()=>pg.sql(db,`begin; set local role vexa_backend; select count(*) from public.email_auth_events; commit;`),/permission denied/,'ni el backend lee la tabla directo');
  assert.throws(()=>pg.sql(db,`begin; set local role vexa_backend; select public.email_auth_admit('1.2.3.4','nada'); commit;`),/email_auth_input_invalid/);
 });
});
