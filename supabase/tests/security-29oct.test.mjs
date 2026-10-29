// Cierre de seguridad 29-oct sobre un Postgres 17 LOCAL (ops/lib/localpg.mjs, sin red): AUTH-03, RLS-01, LIFE-02 y tipos de archivo.
// Cada bloque crea su base, aplica el esquema hasta la última migración vigente en producción, muestra el defecto ANTES y el arreglo DESPUÉS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {startLocalPg} from '../../ops/lib/localpg.mjs';
const mig=n=>new URL('../migrations/'+n,import.meta.url).pathname;
const BASE='20261130000100_retention_erase_attachments.sql';
const h=n=>Number(n).toString(16).padStart(64,'0');
// Los roles de Postgres son del clúster: cada bloque levanta su propio Postgres local efímero.

test('AUTH-03: email_auth_admit limita por IP y por correo, compartido entre conexiones, sin enumerar cuentas',async t=>{
 const pg=await startLocalPg({label:'sec29a'});try{
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
 }finally{await pg.stop();}
});

const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
const U={owner:'00000000-0000-4000-8000-000000000011',analyst:'00000000-0000-4000-8000-000000000012',operator:'00000000-0000-4000-8000-000000000013',viewer:'00000000-0000-4000-8000-000000000014',other:'00000000-0000-4000-8000-000000000015'};
const STRICT=['assumptions','attachment_blobs','attachment_links','attempts','attributions','audit_events','checkpoints','components','connections','conversations','cost_rates','customers','dead_letters','economic_events','embeddings','evidence_spans','external_aliases','extraction_runs','import_rows','import_uploads','imports','issues','jobs','message_revisions','messages','order_lines','orders','outbox','problem_conversations','products','reversals','tombstones'];
const WORK=['interventions','measurement_plans'];
const AGGREGATE=['recommendations','weekly_briefs','metric_snapshots','economic_snapshot_heads','problems','problem_versions'];
const IDENTITY=['memberships','organizations'];

function seedTenants(pg,db){
 const users=Object.values(U).map((id,i)=>`('${id}','u${i}@example.invalid')`).join(',');
 pg.sql(db,`insert into auth.users(id,email) values ${users};
  insert into public.organizations(id,name) values ('${A}','SYN A'),('${B}','SYN B');
  insert into public.memberships(tenant_id,user_id,role,status) values ('${A}','${U.owner}','owner','active'),('${A}','${U.analyst}','analyst','active'),('${A}','${U.operator}','operator','active'),('${A}','${U.viewer}','viewer','active'),('${B}','${U.other}','owner','active');`);
}
function seedContent(pg,db){
 const ids=n=>`'${n}0000000-0000-4000-8000-000000000001'`;
 pg.sql(db,`set session_replication_role=replica;
  insert into public.customers(tenant_id,external_id,display_name) values ('${A}','c-1','Nombre Real Cliente');
  insert into public.message_revisions(tenant_id,revision,text_ref,hash,message_id,redacted_text) values ('${A}','r1','ref','h',${ids(7)},'texto redactado del ticket');
  insert into public.embeddings(tenant_id,model_id,dim,version,content,embedding,message_revision_id) values ('${A}','m',3,'v','contenido embebido','[1,2,3]',${ids(8)});
  insert into public.import_rows(tenant_id,row_ref,import_id) values ('${A}','fila-1',${ids(9)});
  insert into public.interventions(tenant_id,status,version,recommendation_id) values ('${A}','draft',1,${ids(6)});
  insert into public.problems(tenant_id,severity,cause_status) values ('${A}','high','unknown');`);
}
const countAs=(pg,db,uid,table)=>pg.sql(db,`begin; set local role authenticated; set local request.jwt.claim.sub='${uid}'; select count(*) from public.${table}; rollback;`);

test('RLS-01: la API directa deja leer contenido solo a owner/analyst; viewer y operator solo agregados',async t=>{
 const pg=await startLocalPg({label:'sec29b'});try{
 const db='s29b';pg.createDb(db);pg.applySchema(db,{upTo:BASE});seedTenants(pg,db);seedContent(pg,db);
 const content=['customers','message_revisions','embeddings','import_rows'];
 await t.test('ANTES: el defecto existe, un viewer lee nombres, texto redactado, embeddings e import_rows',()=>{
  for(const tb of content)assert.equal(countAs(pg,db,U.viewer,tb),'1',tb+' visible al lector antes del arreglo');
  assert.equal(countAs(pg,db,U.operator,'customers'),'1');
 });
 pg.file(db,mig('20261205000100_direct_read_by_role.sql'));
 await t.test('DESPUÉS: owner y analyst conservan la lectura; operator y viewer no leen contenido; otro tenant nada',()=>{
  for(const tb of content){
   assert.equal(countAs(pg,db,U.owner,tb),'1',tb+' owner');assert.equal(countAs(pg,db,U.analyst,tb),'1',tb+' analyst');
   assert.equal(countAs(pg,db,U.operator,tb),'0',tb+' operator');assert.equal(countAs(pg,db,U.viewer,tb),'0',tb+' viewer');assert.equal(countAs(pg,db,U.other,tb),'0',tb+' otro tenant');
  }
 });
 await t.test('operator conserva su trabajo (interventions); el lector no',()=>{
  assert.equal(countAs(pg,db,U.operator,'interventions'),'1');assert.equal(countAs(pg,db,U.owner,'interventions'),'1');assert.equal(countAs(pg,db,U.viewer,'interventions'),'0');assert.equal(countAs(pg,db,U.other,'interventions'),'0');
 });
 await t.test('los agregados (problems) siguen visibles para todos los roles del tenant, y solo para ellos',()=>{
  for(const r of ['owner','analyst','operator','viewer'])assert.equal(countAs(pg,db,U[r],'problems'),'1',r);
  assert.equal(countAs(pg,db,U.other,'problems'),'0');
 });
 await t.test('identidad intacta: cada rol sigue viendo su membresía y su organización',()=>{
  for(const r of ['owner','analyst','operator','viewer']){assert.equal(countAs(pg,db,U[r],'memberships'),'1',r);assert.equal(countAs(pg,db,U[r],'organizations'),'1',r);}
 });
 await t.test('el backend (pool de la aplicación) sigue leyendo el contenido con su propio rol: las pantallas no cambian',()=>{
  const n=pg.sql(db,`begin; set local role vexa_backend; set local request.jwt.claim.sub='${U.viewer}'; set local vexa.tenant_id='${A}'; set local vexa.action='read'; select count(*) from public.customers; rollback;`);
  assert.equal(n,'1');
 });
 await t.test('anon sigue sin acceso',()=>{assert.throws(()=>pg.sql(db,`begin; set local role anon; select count(*) from public.customers; rollback;`),/permission denied/);});
 await t.test('clasificación completa: toda tabla con lectura directa para authenticated está en la matriz y las estrictas/operativas tienen la política',()=>{
  const readable=pg.sql(db,`select string_agg(distinct tablename,',' order by tablename) from pg_policies where schemaname='public' and permissive='PERMISSIVE' and cmd='SELECT' and roles::text ~ 'authenticated'`).split(',');
  const known=new Set([...STRICT,...WORK,...AGGREGATE,...IDENTITY]);
  assert.deepEqual(readable.filter(x=>!known.has(x)),[],'tabla nueva con lectura directa sin clasificar en RLS-01: decide si el lector la ve');
  const guarded=new Set(pg.sql(db,`select string_agg(tablename,',') from pg_policies where schemaname='public' and policyname='role_scoped_direct_read' and permissive='RESTRICTIVE' and cmd='SELECT'`).split(','));
  for(const tb of [...STRICT,...WORK])assert.ok(guarded.has(tb),tb+' sin política role_scoped_direct_read');
  for(const tb of [...AGGREGATE,...IDENTITY])assert.ok(!guarded.has(tb),tb+' no debe estar restringida');
 });
 }finally{await pg.stop();}
});

test('LIFE-02: retention_erase vacía las celdas del Tracker del ticket borrado y la reingesta no las revive',async t=>{
 const pg=await startLocalPg({label:'sec29c'});try{
 const db='s29c',conn='10000000-0000-4000-8000-000000000001',rid=n=>`50000000-0000-4000-8000-00000000000${n}`;
 pg.createDb(db);pg.applySchema(db,{upTo:BASE});seedTenants(pg,db);
 pg.sql(db,`insert into public.connections(id,tenant_id,source,account_id) values ('${conn}','${A}','syn','acc');
  insert into public.retention_policies(tenant_id,version,backup_ttl_seconds,active_erasure,business_history,actor_id) values ('${A}',1,3600,'immediate','retain-authorized-audit','${U.owner}');
  insert into public.conversations(id,tenant_id,source,external_id,connection_id) values ('20000000-0000-4000-8000-000000000001','${A}','gorgias','gorgias:555','${conn}'),('20000000-0000-4000-8000-000000000002','${A}','gorgias','gorgias:777','${conn}'),('20000000-0000-4000-8000-000000000003','${A}','hubspot','999','${conn}');
  insert into public.tracker_versions(id,tenant_id,connection_id,file_sha256,rank) values ('60000000-0000-4000-8000-000000000001','${A}','${conn}','${'a'.repeat(64)}',1);
  set session_replication_role=replica;`);
 const rev=(n,ticket,secret)=>`insert into public.tracker_row_revisions(id,tenant_id,connection_id,sheet_name,row_number,row_hash,cells,ticket_state,ticket_id,ticket_cell,first_version_id) values ('7000000${n}-0000-4000-8000-000000000001','${A}','${conn}','Refunds',${n},'${String(n).repeat(64).slice(0,64)}','[{"col":1,"v":"${secret}"}]','linked',${ticket?`'${ticket}'`:'null'},'A${n}','60000000-0000-4000-8000-000000000001');`;
 const cells=n=>pg.sql(db,`select cells::text||'|'||coalesce(ticket_id,'~') from public.tracker_row_revisions where row_number=${n}`);
 const erase=(ext,n)=>pg.sql(db,`begin; set local role vexa_backend; set local request.jwt.claim.sub='${U.owner}'; set local vexa.tenant_id='${A}'; set local vexa.action='retain';
  select public.retention_erase('{"connectionId":"${conn}","entityType":"conversation","externalId":"${ext}","requestId":"${rid(n)}","confirmed":"true"}'::jsonb); commit;`);
 pg.sql(db,[1,2,3,4].map(n=>rev(n,['555','777','999','12345'][n-1],'dato-personal-'+n)).join('\n'));
 await t.test('ANTES: el defecto existe, el borrado de la conversación deja las celdas del Tracker',()=>{
  erase('gorgias:777',1);assert.match(cells(2),/dato-personal-2.*\|777/);
 });
 pg.file(db,mig('20261205000200_retention_erase_tracker.sql'));
 await t.test('DESPUÉS: borra solo las celdas del ticket (con y sin prefijo de proveedor); el resto del Tracker queda intacto',()=>{
  erase('gorgias:555',2);assert.equal(cells(1),'[]|~','ticket 555 vaciado');
  erase('999',3);assert.equal(cells(3),'[]|~','ticket 999 sin prefijo vaciado');
  assert.match(cells(4),/dato-personal-4.*\|12345/,'ticket ajeno intacto');
  assert.match(cells(2),/dato-personal-2.*\|777/,'borrado anterior a la migración no se reescribe aquí (ver APLICAR: repetir el borrado)');
 });
 await t.test('las cabezas por fila (tracker_row_heads) ya no devuelven las celdas borradas',()=>{
  pg.sql(db,`insert into public.tracker_row_observations(tenant_id,version_id,sheet_name,row_number,revision_id) values ('${A}','60000000-0000-4000-8000-000000000001','Refunds',1,'70000001-0000-4000-8000-000000000001'),('${A}','60000000-0000-4000-8000-000000000001','Refunds',4,'70000004-0000-4000-8000-000000000001');`);
  assert.equal(pg.sql(db,`select cells::text from public.tracker_row_heads where row_number=1`),'[]');
  assert.match(pg.sql(db,`select cells::text from public.tracker_row_heads where row_number=4`),/dato-personal-4/);
 });
 await t.test('reingesta: una fila nueva de un ticket borrado entra vacía; la de otro ticket entra con sus celdas',()=>{
  pg.sql(db,rev(5,'555','nuevo-dato-5')+rev(6,'888','nuevo-dato-6'));
  assert.equal(cells(5),'[]|~');assert.match(cells(6),/nuevo-dato-6.*\|888/);
 });
 await t.test('la ledger firmada registra el borrado y la función sigue exigiendo owner y confirmación',()=>{
  assert.equal(pg.sql(db,`select count(*) from public.retention_ledger where entity_type='conversation' and external_id in ('gorgias:555','999')`),'2');
  assert.throws(()=>pg.sql(db,`begin; set local role vexa_backend; set local request.jwt.claim.sub='${U.viewer}'; set local vexa.tenant_id='${A}'; set local vexa.action='retain';
   select public.retention_erase('{"connectionId":"${conn}","entityType":"conversation","externalId":"gorgias:777","requestId":"${rid(9)}","confirmed":"true"}'::jsonb); commit;`),/insufficient_privilege|privilege/i);
 });
 }finally{await pg.stop();}
});
