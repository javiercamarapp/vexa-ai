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

test('STO-01 (tipos): un miembro solo sube a vexa-private el espacio de importaciones, CSV/XLSX, hasta 20 MiB; viewer/operator nunca',async t=>{
 const pg=await startLocalPg({label:'sec29d'});try{
 const db='s29d',imp='80000000-0000-4000-8000-000000000001',CSV='text/csv',XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 pg.createDb(db);pg.applySchema(db,{upTo:BASE});seedTenants(pg,db);
 pg.sql(db,`create or replace function storage.allow_any_operation(a text[]) returns boolean language sql as $$ select false $$;
  grant usage on schema storage to authenticated; grant select,insert on storage.objects to authenticated;
  set session_replication_role=replica;
  insert into public.imports(id,tenant_id,file_hash,mapping_version,idempotency_key,object_path,state) values ('${imp}','${A}','h','v','k','${A}/imports/${imp}/original','reserved');
  insert into public.import_uploads(tenant_id,import_id,user_id,size,content_type,request_hash) values ('${A}','${imp}','${U.analyst}',100,'text/csv','r');`);
 const put=(uid,name,meta)=>{try{pg.sql(db,`begin; set local role authenticated; set local request.jwt.claim.sub='${uid}'; insert into storage.objects(bucket_id,name,owner_id,metadata) values ('vexa-private','${name}','${uid}','${JSON.stringify(meta)}'::jsonb); rollback;`);return 'ok';}catch(e){return /row-level security|permission denied|upload size mismatch|invalid upload reservation/.test(String(e.message))?'denied':'error:'+e.message.slice(0,200);}};
 const reserved=`${A}/imports/${imp}/original`;
 await t.test('ANTES: un analista sube cualquier ruta y tipo bajo su prefijo (HTML, ejecutable, SVG, sin límite)',()=>{
  assert.equal(put(U.analyst,`${A}/attachments/zz/evil.html`,{mimetype:'text/html',size:5}),'ok');
  assert.equal(put(U.analyst,`${A}/otra/cosa.exe`,{mimetype:'application/x-msdownload',size:5}),'ok');
 });
 pg.file(db,mig('20261205000300_vexa_private_member_upload_types.sql'));
 await t.test('DESPUÉS: fuera del espacio de importaciones no sube nadie por sesión de usuario',()=>{
  for(const uid of [U.owner,U.analyst]){assert.equal(put(uid,`${A}/attachments/zz/evil.html`,{mimetype:'text/html',size:5}),'denied');assert.equal(put(uid,`${A}/otra/cosa.bin`,{mimetype:CSV,size:5}),'denied');}
 });
 await t.test('en importaciones: CSV y XLSX pasan; otros tipos o más de 20 MiB no (se aísla esta política desactivando el guard de reserva, que valida tipo y tamaño exactos de otra forma)',()=>{
  pg.sql(db,`alter table storage.objects disable trigger guard_reserved_import_object`);
  assert.equal(put(U.analyst,reserved,{mimetype:CSV,size:100}),'ok');
  assert.equal(put(U.analyst,reserved,{mimetype:XLSX,size:100}),'ok');
  assert.equal(put(U.analyst,reserved,{mimetype:'text/html',size:100}),'denied');
  assert.equal(put(U.analyst,reserved,{mimetype:'application/x-msdownload',size:100}),'denied');
  assert.equal(put(U.analyst,reserved,{mimetype:CSV,size:20971521}),'denied');
  assert.equal(put(U.analyst,reserved,{mimetype:CSV,size:20971520}),'ok');
  pg.sql(db,`alter table storage.objects enable trigger guard_reserved_import_object`);
 });
 await t.test('sin metadato de tipo o tamaño no se bloquea lo legítimo (la reserva ya fijó ambos); sigue exigiendo la reserva y el rol',()=>{
  assert.equal(put(U.analyst,reserved,{mimetype:CSV,size:100}),'ok');
  assert.equal(put(U.owner,reserved,{mimetype:CSV}),'denied','la reserva es del analista que la pidió');
  assert.equal(put(U.viewer,reserved,{mimetype:CSV,size:1}),'denied');assert.equal(put(U.operator,reserved,{mimetype:CSV,size:1}),'denied');
  assert.equal(put(U.other,reserved,{mimetype:CSV,size:1}),'denied','otro tenant');
 });
 await t.test('otros buckets no se afectan por la política',()=>{
  pg.sql(db,`insert into storage.buckets(id,name) values ('otro','otro')`);
  pg.sql(db,`begin; set local role authenticated; set local request.jwt.claim.sub='${U.analyst}'; commit;`);
  assert.equal(pg.sql(db,`select count(*) from pg_policies where tablename='objects' and policyname='vexa_private_member_upload_types' and qual is null and with_check ~ 'vexa-private'`),'1');
 });
 }finally{await pg.stop();}
});

test('security_events: solo inserción, sin PII, muestreo, aislamiento por rol, alertas por umbral y bitácoras inmutables',async t=>{
 const pg=await startLocalPg({label:'sec29e'});try{
 const db='s29e',ADMIN='00000000-0000-4000-8000-0000000000aa',SESS='00000000-0000-4000-8000-0000000000bb';
 pg.createDb(db);pg.applySchema(db,{upTo:BASE});seedTenants(pg,db);
 pg.sql(db,`alter table auth.users add column if not exists email_confirmed_at timestamptz default now();
  insert into auth.users(id,email) values ('${ADMIN}','admin@example.invalid');
  insert into auth.sessions(id,user_id) values ('${SESS}','${ADMIN}');
  insert into vexa_platform.administrators(user_id) values ('${ADMIN}');`);
 pg.file(db,mig('20261205000400_security_events.sql'));
 const rec=(o,role='vexa_backend')=>JSON.parse(pg.sql(db,`begin; set local role ${role}; select public.record_security_event($j$${JSON.stringify(o)}$j$::jsonb); commit;`).split('\n').find(l=>l.startsWith('{')));
 const asAdmin=(sql)=>pg.sql(db,`begin; set local role authenticated; set local request.jwt.claim.sub='${ADMIN}'; set local request.jwt.claims='{"session_id":"${SESS}"}'; ${sql}; commit;`).split('\n').filter(l=>l&&l!=='BEGIN'&&l!=='COMMIT'&&!l.startsWith('SET')).join('');
 const count=(w='true')=>Number(pg.sql(db,`select count(*) from vexa_platform.security_events where ${w}`));
 await t.test('solo inserción: UPDATE, DELETE y TRUNCATE fallan incluso para el dueño de la tabla',()=>{
  rec({kind:'auth_401',route:'/api/x',method:'GET'});
  for(const q of [`update vexa_platform.security_events set severity='info'`,`delete from vexa_platform.security_events`,`truncate vexa_platform.security_events`])assert.throws(()=>pg.sql(db,q),/append_only/,q);
 });
 await t.test('sin PII ni secretos: correo, JWT y Bearer en el detalle se descartan; IP inválida y agente se sanean; la ruta pierde la consulta',()=>{
  const r=rec({kind:'forbidden_403',route:'/api/briefs?email=a@b.co&token=eyJabc',method:'post',ip_hash:'203.0.113.9',ua:'Mozilla/5.0\u0007 (X11)'+'x'.repeat(300),
   detail:{code:'role_insufficient',email:'real@example.com',reason_code:'real@example.com',scope:'Bearer abc.def',resource:'eyJhbGciOi.payload.sig',rows:3,extra:'x',status:403}});
  assert.equal(r.stored,true);
  const row=JSON.parse(pg.sql(db,`select to_jsonb(e) from vexa_platform.security_events e where kind='forbidden_403' order by id desc limit 1`));
  assert.equal(row.route,'/api/briefs');assert.equal(row.method,'POST');assert.equal(row.ip_hash,null,'IP en claro rechazada: solo se aceptan huellas hex de 64');
  assert.ok(row.ua.length<=120&&!/[\u0000-\u001f]/.test(row.ua));
  assert.deepEqual(row.detail,{code:'role_insufficient',rows:3,status:403});
  const all=pg.sql(db,`select string_agg(e::text,' ') from vexa_platform.security_events e`);
  assert.ok(!/@|eyJ|Bearer|203\.0\.113/.test(all),'ninguna fila contiene correo, token ni IP');
 });
 await t.test('tipo de evento inválido no inserta ni lanza; entradas raras no rompen',()=>{
  assert.equal(rec({kind:'raro'}).stored,false);assert.equal(rec({kind:'auth_401',tenant_id:'no-uuid',actor_id:'x',detail:'texto'}).stored,true);
 });
 await t.test('deduplicación: 3 primeros del minuto por huella, luego solo 10, 100…; los contadores cuentan todo',()=>{
  const ip=h(777);const before=count(`ip_hash='${ip}'`);
  // 120 llamadas en UNA transacción (misma cubeta de minuto aunque la máquina esté cargada).
  pg.sql(db,`begin; set local role vexa_backend; do $$ begin for i in 1..120 loop perform public.record_security_event('{"kind":"auth_401","route":"/api/problems","method":"GET","ip_hash":"${ip}"}'::jsonb); end loop; end $$; commit;`);
  assert.equal(count(`ip_hash='${ip}'`)-before,3+2,'3 + los eventos 10 y 100');
  assert.equal(pg.sql(db,`select hits from vexa_platform.security_event_counters where kind='auth_401' and scope_hash='${ip}'`),'120');
  assert.equal(pg.sql(db,`select (detail->>'hits') from vexa_platform.security_events where ip_hash='${ip}' and detail ? 'hits' order by id desc limit 1`),'100');
 });
 await t.test('exportación y soporte no se muestrean: cada una deja su fila',()=>{
  const a=count(`kind='export'`);for(let i=0;i<8;i++)rec({kind:'export',tenant_id:A,actor_id:U.owner,detail:{resource:'workspace',format:'csv',rows:i}});
  assert.equal(count(`kind='export'`)-a,8);
 });
 await t.test('aislamiento: anon, authenticated, owner/viewer de un tenant y service_role no leen ni escriben; el administrador lee por función',()=>{
  for(const role of ['anon','authenticated','service_role'])assert.throws(()=>rec({kind:'auth_401'},role),/permission denied/,role);
  assert.throws(()=>pg.sql(db,`begin; set local role authenticated; set local request.jwt.claim.sub='${U.owner}'; select * from vexa_platform.security_events; commit;`),/permission denied/);
  assert.throws(()=>pg.sql(db,`begin; set local role vexa_backend; select * from vexa_platform.security_events; commit;`),/permission denied/);
  assert.throws(()=>pg.sql(db,`begin; set local role authenticated; set local request.jwt.claim.sub='${U.owner}'; set local request.jwt.claims='{"session_id":"${SESS}"}'; select public.platform_security_events('{}'::jsonb); commit;`),/platform_access_denied/,'un propietario no es administrador');
  const out=JSON.parse(asAdmin(`select public.platform_security_events('{"kind":"export","limit":5}'::jsonb)`));
  assert.equal(out.items.length,5);assert.ok(out.nextCursor);assert.ok(out.items.every(i=>i.kind==='export'&&!('ip_hash' in i)));
  const f=JSON.parse(asAdmin(`select public.platform_security_events('{"severity":"warn","since":"2020-01-01T00:00:00Z"}'::jsonb)`));assert.ok(f.items.length>0&&f.items.every(i=>i.severity==='warn'));
  assert.throws(()=>asAdmin(`select public.platform_security_events('{"x":1}'::jsonb)`),/platform_input_invalid/);
 });
 await t.test('alerta por umbral: 20 fallos de una misma fuente, un Bearer inválido o 5 firmas inválidas; el cron deja un solo alert_raised por cubeta',()=>{
  const quiet=JSON.parse(asAdmin(`select public.platform_security_alerts()`));
  assert.ok(!quiet.alerts.some(a=>a.kind==='bearer_invalid'));
  rec({kind:'bearer_invalid',route:'/api/internal/crm',method:'POST',ip_hash:h(5)});
  for(let i=0;i<6;i++)rec({kind:'webhook_signature_invalid',route:'/api/webhooks/email',method:'POST',ip_hash:h(6)});
  const a=JSON.parse(asAdmin(`select public.platform_security_alerts()`)).alerts;
  assert.ok(a.some(x=>x.kind==='bearer_invalid'&&x.severity==='high'));assert.ok(a.some(x=>x.kind==='webhook_signature_invalid'&&x.severity==='high'&&x.hits>=6));
  assert.ok(a.some(x=>x.kind==='auth_failures'),'los 120 fallos de la misma huella superan 20');
  const ev=()=>JSON.parse(pg.sql(db,`begin; set local role vexa_backend; select public.evaluate_security_alerts(); commit;`).split('\n').find(l=>l.startsWith('{')));
  assert.equal(ev().raised,true);assert.equal(ev().raised,false);assert.equal(count(`kind='alert_raised'`),1);
  assert.throws(()=>pg.sql(db,`begin; set local role authenticated; select public.evaluate_security_alerts(); commit;`),/permission denied/);
 });
 await t.test('bitácoras de plataforma y de equipo son solo inserción y el motivo de soporte se enmascara',()=>{
  pg.sql(db,`insert into vexa_platform.audit(actor_id,operation,details) values ('${ADMIN}','support_start','{"reason":"cliente juan@empresa.com tel +52 55 1234 5678 pidió revisar"}')`);
  const d=pg.sql(db,`select details->>'reason' from vexa_platform.audit order by id desc limit 1`);
  assert.ok(!/@|1234/.test(d)&&/\[correo\]/.test(d)&&/\[numero\]/.test(d),d);
  assert.throws(()=>pg.sql(db,`update vexa_platform.audit set operation='x'`),/append_only/);assert.throws(()=>pg.sql(db,`delete from vexa_platform.audit`),/append_only/);
  pg.sql(db,`insert into public.team_audit(tenant_id,actor_id,operation,target_id) values ('${A}','${U.owner}','role','${U.viewer}')`);
  assert.throws(()=>pg.sql(db,`update public.team_audit set operation='x'`),/append_only/);assert.throws(()=>pg.sql(db,`delete from public.team_audit`),/append_only/);
 });
 }finally{await pg.stop();}
});

test('H-01: contadores de peticiones y arrendamientos de concurrencia compartidos, solo huellas y solo vexa_backend',async t=>{
 const pg=await startLocalPg({label:'sec29f'});try{
 const db='s29f';pg.createDb(db);pg.applySchema(db,{upTo:BASE});seedTenants(pg,db);pg.file(db,mig('20261205000500_api_rate_limit.sql'));
 const bk=(sql,role='vexa_backend')=>pg.sql(db,`begin; set local role ${role}; ${sql}; commit;`).split('\n').filter(l=>l&&!['BEGIN','COMMIT','SET'].includes(l)).join('|');
 await t.test('suma por lotes en la misma ventana, por clase y por huella; otra huella y otra clase no se mezclan',()=>{
  assert.equal(bk(`select public.api_rate_add('read','${h(1)}',5)`),'5');assert.equal(bk(`select public.api_rate_add('read','${h(1)}',7)`),'12');
  assert.equal(bk(`select public.api_rate_add('read','${h(2)}',1)`),'1');assert.equal(bk(`select public.api_rate_add('write','${h(1)}',2)`),'2');
 });
 await t.test('la ventana siguiente reinicia y la poda quita ventanas de más de 10 minutos',()=>{
  pg.sql(db,`insert into public.api_rate_counters(class,key_hash,window_start,hits) values ('read','${h(9)}',date_trunc('minute',clock_timestamp())-interval '30 minutes',99),('read','${h(1)}',date_trunc('minute',clock_timestamp())-interval '1 minute',500)`);
  assert.equal(bk(`select public.api_rate_add('read','${h(1)}',1)`),'13','la ventana anterior no cuenta');
  assert.equal(pg.sql(db,`select count(*) from public.api_rate_counters where window_start<clock_timestamp()-interval '10 minutes'`),'0');
 });
 await t.test('entradas inválidas y permisos: sin huella hex, n fuera de rango; anon/authenticated/service_role no ejecutan ni leen',()=>{
  for(const q of [`select public.api_rate_add('read','1.2.3.4',1)`,`select public.api_rate_add('READ','${h(1)}',1)`,`select public.api_rate_add('read','${h(1)}',0)`,`select public.api_rate_add('read','${h(1)}',10001)`])assert.throws(()=>bk(q),/api_rate_input_invalid/,q);
  for(const role of ['anon','authenticated','service_role'])assert.throws(()=>bk(`select public.api_rate_add('read','${h(1)}',1)`,role),/permission denied/,role);
  assert.throws(()=>bk(`select * from public.api_rate_counters`),/permission denied/);assert.throws(()=>bk(`select * from public.api_concurrency_leases`,'authenticated'),/permission denied/);
  assert.equal(pg.sql(db,`select count(*) from public.api_rate_counters where key_hash !~ '^[a-f0-9]{64}$'`),'0');
 });
 await t.test('concurrencia por organización: el tope se respeta, otra organización no se ve afectada, liberar y caducar devuelven cupo',()=>{
  const get=(tenant,max=2)=>bk(`select coalesce(public.api_concurrency_acquire('${tenant}','workspace',${max},60)::text,'NULL')`);
  const l1=get(A),l2=get(A);assert.match(l1,/^[0-9a-f-]{36}$/);assert.match(l2,/^[0-9a-f-]{36}$/);
  assert.equal(get(A),'NULL','tercera simultánea rechazada');assert.match(get(B),/^[0-9a-f-]{36}$/,'otra organización con su propio cupo');
  bk(`select public.api_concurrency_release('${l1}')`);assert.match(get(A),/^[0-9a-f-]{36}$/,'liberar devuelve cupo');
  pg.sql(db,`update public.api_concurrency_leases set expires_at=clock_timestamp()-interval '1 second' where tenant_id='${A}'`);
  assert.match(get(A),/^[0-9a-f-]{36}$/,'un arrendamiento caducado (instancia muerta) no bloquea para siempre');
  assert.throws(()=>bk(`select public.api_concurrency_acquire('${A}','workspace',0,60)`),/api_concurrency_input_invalid/);
  assert.throws(()=>bk(`select public.api_concurrency_acquire('${A}','workspace',2,60)`,'authenticated'),/permission denied/);
 });
 }finally{await pg.stop();}
});

test('M-03: tope de invitaciones por organización (20/h, 100/día), por organización, con evento y sin correo en el registro',async t=>{
 const pg=await startLocalPg({label:'sec29g'});try{
 const db='s29g';pg.createDb(db);pg.applySchema(db,{upTo:BASE});seedTenants(pg,db);pg.file(db,mig('20261205000400_security_events.sql'));pg.file(db,mig('20261205000600_invitation_quota.sql'));
 const inv=(tenant,n,backdate='')=>pg.sql(db,`insert into public.team_invitations(tenant_id,request_id,email,role,created_by,created_at,expires_at) select '${tenant}',gen_random_uuid(),'secreto'||md5(random()::text||g)||'@example.invalid','viewer','${U.owner}',clock_timestamp()${backdate},clock_timestamp()+interval '3 days' from generate_series(1,${n}) g`);
 await t.test('20 por hora pasan; la 21 se rechaza con team_invitation_quota; otra organización no se ve afectada',()=>{
  inv(A,20);assert.throws(()=>inv(A,1),/team_invitation_quota/);inv(B,1);
  assert.equal(pg.sql(db,`select count(*) from public.team_invitations where tenant_id='${A}'`),'20');
 });
 await t.test('100 por día: con 100 invitaciones de hace 2 horas, la siguiente se rechaza aunque la hora esté libre',()=>{
  inv(B,99,` - interval '2 hours'`);assert.throws(()=>inv(B,1),/team_invitation_quota/);
 });
 await t.test('eventos: uno por invitación aceptada, sin correo ni identificadores de invitado',()=>{
  assert.equal(pg.sql(db,`select count(*) from vexa_platform.security_events where kind='invitation_sent'`),'120');
  assert.equal(pg.sql(db,`select count(*) from vexa_platform.security_events where kind='rate_limited'`),'0','el rechazo revierte la transacción; la aplicación registra el 429');
  assert.ok(!/secreto|@example/.test(pg.sql(db,`select string_agg(e::text,' ') from vexa_platform.security_events e`)));
 });
 }finally{await pg.stop();}
});

test('M3 + B1: privilegios por defecto cerrados para anon/authenticated, funciones de disparador sin EXECUTE público y search_path vacío',async t=>{
 const pg=await startLocalPg({label:'sec29h'});try{
 const db='s29h';
 // Réplica de Supabase: roles postgres y supabase_admin con privilegios por defecto abiertos en public (el defecto de la plataforma).
 pg.sql('postgres',`create role postgres superuser login; create role supabase_admin superuser login`);
 pg.createDb(db);
 pg.applySchema(db,{upTo:'20261205000600_invitation_quota.sql'});
 pg.sql(db,`alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;
  alter default privileges for role postgres in schema public grant all on sequences to anon,authenticated,service_role;
  alter default privileges for role postgres in schema public grant execute on functions to anon,authenticated,service_role;
  alter default privileges for role supabase_admin in schema public grant all on tables to anon,authenticated,service_role`);
 const crear=(rol,n)=>pg.sql(db,`set role ${rol}; create table public.${n}(a int); create function public.f_${n}() returns int language sql as $$ select 1 $$; reset role`);
 const tiene=(n,rol,priv='SELECT')=>pg.sql(db,`select has_table_privilege('${rol}','public.${n}','${priv}')`);
 await t.test('ANTES: una tabla nueva de postgres o supabase_admin queda abierta a anon (el defecto)',()=>{
  crear('postgres','antes_pg');crear('supabase_admin','antes_sa');
  assert.equal(tiene('antes_pg','anon'),'t');assert.equal(tiene('antes_sa','authenticated','DELETE'),'t');
  assert.equal(pg.sql(db,`select has_function_privilege('anon','public.f_antes_pg()','execute')`),'t');
  assert.equal(pg.sql(db,`select has_function_privilege('anon','public.cfo_access_log_append_only()','execute')`),'t');
 });
 const antes=pg.sql(db,`select string_agg(proname||'='||coalesce(proconfig::text,''),';' order by proname) from pg_proc where proname in ('ai_budget_attempt_guard','ai_budget_limit_guard','ai_budget_reconciliation_guard','ai_budget_reservation_guard')`);
 const msg=()=>{try{pg.sql(db,`insert into public.ai_budget_limits(tenant_id) values ('${A}')`);return 'sin error';}catch(e){return /budget [a-z ]+/.exec(String(e.message))?.[0]??String(e.message).slice(0,120);}};
 const msgAntes=msg();
 pg.file(db,mig('20261205000700_default_privileges_and_trigger_functions.sql'));
 await t.test('DESPUÉS: tablas, secuencias y funciones nuevas ya no se abren a anon ni authenticated; service_role conserva su acceso',()=>{
  crear('postgres','despues_pg');crear('supabase_admin','despues_sa');
  for(const n of ['despues_pg','despues_sa'])for(const rol of ['anon','authenticated']){assert.equal(tiene(n,rol),'f',n+' '+rol);assert.equal(tiene(n,rol,'INSERT'),'f');}
  assert.equal(tiene('despues_pg','service_role'),'t');
  assert.equal(pg.sql(db,`select count(*) from pg_proc p, aclexplode(p.proacl) a join pg_roles r on r.oid=a.grantee where p.proname='f_despues_pg' and r.rolname in ('anon','authenticated')`),'0','sin entradas explícitas para anon/authenticated en funciones nuevas');
  assert.equal(pg.sql(db,`select count(*) from pg_proc p, aclexplode(p.proacl) a join pg_roles r on r.oid=a.grantee where p.proname='f_antes_pg' and r.rolname in ('anon','authenticated')`),'2','antes sí las tenía');
  assert.equal(pg.sql(db,`select count(*) from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public' and exists(select 1 from aclexplode(d.defaclacl) a join pg_roles r on r.oid=a.grantee where r.rolname in ('anon','authenticated'))`),'0','pg_default_acl de public ya no menciona a anon ni authenticated');
 });
 await t.test('B1: ninguna función de public es ejecutable por anon; las cinco de disparador tampoco por authenticated ni PUBLIC; las ai_budget_* con search_path vacío y el mismo comportamiento',()=>{
  for(const f of ['ai_budget_attempt_guard','ai_budget_limit_guard','ai_budget_reconciliation_guard','ai_budget_reservation_guard','cfo_access_log_append_only'])
   for(const rol of ['anon','authenticated','public'])assert.equal(pg.sql(db,`select has_function_privilege('${rol}','public.${f}()','execute')`),'f',f+' '+rol);
  assert.equal(pg.sql(db,`select count(*) from pg_proc p where pronamespace='public'::regnamespace and prokind='f' and proname in ('ai_budget_attempt_guard','ai_budget_limit_guard','ai_budget_reconciliation_guard','ai_budget_reservation_guard') and array_to_string(proconfig,',')='search_path=""'`),'4');
  // Vigilancia: ninguna función de public (de las migraciones del proyecto) es ejecutable por anon, ni por PUBLIC.
  assert.equal(pg.sql(db,`select coalesce(string_agg(proname,','),'') from pg_proc p where pronamespace='public'::regnamespace and prokind='f' and proname !~ '^f_' and has_function_privilege('anon',p.oid,'execute') and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`),'','funciones de public ejecutables por anon');
  assert.notEqual(antes,'');assert.equal(msg(),msgAntes,'el disparador sigue evaluándose igual con search_path vacío: '+msgAntes);
  assert.match(msgAntes,/budget/);
 });
 }finally{await pg.stop();}
});
