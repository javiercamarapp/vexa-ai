// Incidencias por categoría y por mes. Dos capas:
//  1) con un `query` falso: forma de las respuestas, validación, tiempo agotado => status «timeout» (nunca 503 ni cifra inventada), SQL acotado al tenant.
//  2) contra un PostgreSQL efímero real (socket unix, esquema mínimo con las columnas reales de issues/extraction_runs/conversations/messages/problem_embedding_members,
//     datos sintéticos): comprueba el SQL de verdad (GROUPING SETS, fecha = started_at o primer mensaje, borradas fuera, aislamiento por tenant, ventana de 12 meses).
//     Se omite (y lo dice) si no hay binarios de Postgres. Variables: PG_BIN, PGPORT_TEST=59481, PGSOCK_TEST=/tmp/vxinc.
//   node --test packages/workspace-service/tests/incidences.test.mjs
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
import {createIncidencesRepository,shapeCategories,shapeMonthly,CATEGORIES_SQL,MONTHLY_SQL,MAX_CATEGORIES} from '../incidences.mjs';
import {monthWindow} from '../trends.mjs';
const NOW=new Date('2026-10-19T12:00:00Z'),TENANT='aaaaaaaa-2000-0000-0000-00000000000a',PROBLEM='11111111-1111-4111-8111-111111111111';
const fakeDb=(handler,seen=[])=>({async transaction(_a,work){return work({tenantId:TENANT,query:async(text,values)=>{seen.push({text,values});return handler(text,values);}});}});
const plain=(rows)=>(text)=>/set_config|SAVEPOINT/i.test(text)?{rows:[]}:{rows};
const timeoutOn=(re)=>(text)=>{if(/set_config|SAVEPOINT/i.test(text))return {rows:[]};if(re.test(text))throw Object.assign(new Error('canceling statement due to statement timeout'),{code:'57014'});return {rows:[]};};

test('categorías: forma con total, nº de categorías y corridas; incidencias ≠ problemas agrupados',async()=>{
 const seen=[];
 const raw=[{category:null,n:'9614',runs:'4100',is_total:1},{category:'Shipping: Arrived Late',n:'300',runs:'290',is_total:0},{category:'Order: Spare Parts',n:'9314',runs:'4000',is_total:0}];
 const v=await createIncidencesRepository({database:fakeDb(plain(raw),seen),now:()=>NOW}).categories();
 assert.equal(v.status,'ok');assert.equal(v.class,'inferred');assert.equal(v.unit,'incidencias');
 assert.deepEqual(v.totals,{incidences:9614,categories:2,runs:4100});
 assert.deepEqual(v.rows.map(r=>r.count),[300,9314]); // el repositorio no reordena: SQL ordena; la UI reordena de todos modos
 assert.match(v.note,/no problemas agrupados/);assert.match(v.note,/Inferido/);assert.equal(v.noteKey,'tr.nt.incCategorias');
 assert.equal(seen.filter(s=>/FROM public\.issues/.test(s.text)).length,1,'una sola sentencia agregada');
 assert.deepEqual(seen.find(s=>/FROM public\.issues/.test(s.text)).values,[TENANT]);
 assert.doesNotMatch(CATEGORIES_SQL,/economic_ledger|evidence_spans|message_revisions/,'no recorre el libro ni verifica evidencia');
});
test('categorías: sin incidencias => empty; tiempo agotado => timeout sin cifras',async()=>{
 const empty=await createIncidencesRepository({database:fakeDb(plain([{category:null,n:'0',runs:'0',is_total:1}])),now:()=>NOW}).categories();
 assert.equal(empty.status,'empty');assert.equal(empty.totals.incidences,0);
 const t=await createIncidencesRepository({database:fakeDb(timeoutOn(/FROM public\.issues/)),now:()=>NOW}).categories();
 assert.equal(t.status,'timeout');assert.deepEqual(t.rows,[]);assert.equal(t.totals,null);
});
test('categorías: más de 100 se recortan y se declara',()=>{
 const raw=[{category:null,n:'5000',runs:'1',is_total:1},...Array.from({length:MAX_CATEGORIES+1},(_,i)=>({category:'C'+i,n:'1',runs:'1',is_total:0}))];
 const s=shapeCategories(raw);assert.equal(s.rows.length,MAX_CATEGORIES);assert.equal(s.truncated,true);assert.equal(s.totals.incidences,5000);
});
test('mensual: serie de 12 meses con ceros explícitos, fuera de ventana y sin fecha por separado',()=>{
 const win=monthWindow(NOW,12);
 const s=shapeMonthly([{month:'2026-09',n:'7',undated:null},{month:'2026-10',n:'3',undated:null},{month:null,n:'15',undated:'4'}],win);
 assert.equal(s.series.length,12);assert.equal(s.series[0].month,'2025-11');assert.equal(s.series.at(-1).month,'2026-10');
 assert.equal(s.series.find(p=>p.month==='2026-09').count,7);assert.equal(s.series.find(p=>p.month==='2026-01').count,0);
 assert.equal(s.undated,4);assert.equal(s.outsideWindow,11);assert.equal(s.total,25);
});
test('mensual: problema => un parámetro uuid; total => NULL; id inválido => 400 sin consultar',async()=>{
 const seen=[];const repo=createIncidencesRepository({database:fakeDb(plain([{month:'2026-10',n:'2',undated:null,linked_runs:'5'}]),seen),now:()=>NOW});
 const p=await repo.monthly({problemId:PROBLEM});
 const q=seen.find(s=>/problem_embedding_members/.test(s.text));assert.equal(q.values[3],PROBLEM);assert.equal(q.values[0],TENANT);
 assert.equal(p.scope,'problem');assert.equal(p.linkedRuns,5);assert.equal(p.status,'ok');assert.equal(p.class,'inferred');assert.match(p.note,/no es el volumen de clientes afectados/);assert.equal(p.noteKey,'tr.nt.incProblema');
 const t=await repo.monthly();assert.equal(t.scope,'total');assert.equal(t.noteKey,'tr.nt.incTotal');assert.equal(t.linkedRuns,null);assert.equal(seen.filter(x=>/problem_embedding_members/.test(x.text)).at(-1).values[3],null);
 const before=seen.length;
 await assert.rejects(repo.monthly({problemId:'no-es-uuid'}),e=>e.status===400&&e.code==='incidences_input_invalid');
 await assert.rejects(repo.monthly({months:99}),e=>e.status===400);
 assert.equal(seen.length,before);
 assert.doesNotMatch(MONTHLY_SQL,/economic_ledger|evidence_spans|message_revisions/);
});
test('mensual: vacío y tiempo agotado se distinguen y no inventan ceros',async()=>{
 const e=await createIncidencesRepository({database:fakeDb(plain([])),now:()=>NOW}).monthly({problemId:PROBLEM});
 assert.equal(e.status,'empty');assert.equal(e.total,0);
 const t=await createIncidencesRepository({database:fakeDb(timeoutOn(/problem_embedding_members|FROM public\.issues/)),now:()=>NOW}).monthly({problemId:PROBLEM});
 assert.equal(t.status,'timeout');assert.deepEqual(t.series,[]);assert.equal(t.total,null);
});
test('un error que no es de tiempo se propaga (la ruta responde 503, no un resultado falso)',async()=>{
 const boom=(text)=>{if(/set_config|SAVEPOINT/i.test(text))return {rows:[]};throw Object.assign(new Error('boom'),{code:'XX000'});};
 await assert.rejects(createIncidencesRepository({database:fakeDb(boom),now:()=>NOW}).categories(),/boom/);
});

// ---- PostgreSQL real -------------------------------------------------------------------------------------------------------------------------------------
const bin=process.env.PG_BIN??'/opt/homebrew/opt/postgresql@17/bin',port=process.env.PGPORT_TEST??'59481',sock=process.env.PGSOCK_TEST??'/tmp/vxinc';
const hasPg=fs.existsSync(path.join(bin,'initdb'));
test('PostgreSQL real: categorías, fecha por primer mensaje, borradas, tenants y ventana',{skip:hasPg?false:'sin binarios de Postgres (PG_BIN)'},async()=>{
 const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../../..'),pg=createRequire(path.join(root,'package.json'))('pg');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-inc-')),data=path.join(dir,'data');fs.mkdirSync(sock,{recursive:true});
 const run=(cmd,args)=>{const r=spawnSync(path.join(bin,cmd),args,{encoding:'utf8'});if(r.status!==0)throw new Error(cmd+' failed: '+(r.stderr||r.stdout).slice(0,1500));return r.stdout;};
 const TB='bbbbbbbb-2000-0000-0000-00000000000b';let started=false,pool;
 try{
  run('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8']);
  run('pg_ctl',['-D',data,'-l',path.join(dir,'pg.log'),'-o',`-k ${sock} -p ${port} -c listen_addresses=''`,'-w','start']);started=true;
  pool=new pg.Pool({host:sock,port:Number(port),database:'postgres',max:2});
  await pool.query(`
   create table public.conversations(id uuid primary key,tenant_id uuid not null,started_at timestamptz,deleted_at timestamptz);
   create table public.messages(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,conversation_id uuid not null,occurred_at timestamptz not null,deleted_at timestamptz);
   create table public.extraction_runs(id uuid primary key,tenant_id uuid not null,conversation_id uuid not null);
   create table public.issues(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,category text not null,extraction_run_id uuid not null);
   create table public.problem_embedding_members(tenant_id uuid not null,embedding_id uuid not null,problem_id uuid not null,extraction_run_id uuid not null,conversation_id uuid not null);
   create index on public.messages(tenant_id,conversation_id);create index on public.issues(tenant_id,extraction_run_id);`);
  const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,P2='22222222-2222-4222-8222-222222222222';
  // c1: started_at nulo, primer mensaje sep-2026 (y otro en oct) -> 2 incidencias de sep. c2: started_at oct-2026 -> 1 de oct. c3: primer mensaje en 2024 -> fuera de ventana.
  // c4: sin started_at ni mensajes -> sin fecha. c5: borrada. c6: tenant B.
  const convs=[[1,TENANT,null],[2,TENANT,'2026-10-02T10:00:00Z'],[3,TENANT,null],[4,TENANT,null],[5,TENANT,'2026-10-03T10:00:00Z'],[6,TB,'2026-10-04T10:00:00Z']];
  for(const [n,t,s] of convs)await pool.query('insert into public.conversations(id,tenant_id,started_at,deleted_at) values($1,$2,$3,$4)',[id(n),t,s,n===5?'2026-10-10':null]);
  for(const [c,t,at] of [[1,TENANT,'2026-09-05T00:00:00Z'],[1,TENANT,'2026-10-01T00:00:00Z'],[3,TENANT,'2024-02-01T00:00:00Z']])await pool.query('insert into public.messages(tenant_id,conversation_id,occurred_at) values($1,$2,$3)',[t,id(c),at]);
  // una corrida por conversación (runs id 100+n)
  for(const [n,t] of convs)await pool.query('insert into public.extraction_runs(id,tenant_id,conversation_id) values($1,$2,$3)',[id(100+n),t,id(n)]);
  const issues=[[1,'Order: Spare Parts',2],[1,'Shipping: Arrived Late',0],[2,'Order: Spare Parts',1],[3,'Order: Spare Parts',1],[4,'Shipping: Arrived Late',1],[5,'Order: Spare Parts',4],[6,'Order: Spare Parts',9]];
  for(const [c,cat,k] of issues)for(let i=0;i<Math.max(k,1);i++)if(k>0||cat==='Shipping: Arrived Late')await pool.query('insert into public.issues(tenant_id,category,extraction_run_id) values($1,$2,$3)',[c===6?TB:TENANT,cat,id(100+c)]);
  // c1 también trae 1 'Shipping' (k=0 => 1 fila por la regla de arriba). Problema: miembros en las corridas de c1 y c2; otro problema en c3.
  for(const [n,c,p] of [[1,1,PROBLEM],[2,2,PROBLEM],[3,3,P2]])await pool.query('insert into public.problem_embedding_members(tenant_id,embedding_id,problem_id,extraction_run_id,conversation_id) values($1,$2,$3,$4,$5)',[TENANT,id(900+n),p,id(100+c),id(c)]);
  const db={async transaction(_a,work){const c=await pool.connect();try{await c.query('BEGIN READ ONLY');const r=await work({tenantId:TENANT,query:(t,v)=>c.query(t,v)});await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}};
  const repo=createIncidencesRepository({database:db,now:()=>NOW});
  const cats=await repo.categories();
  // Tenant A: Spare Parts = 2 (c1) + 1 (c2) + 1 (c3) + 4 (c5, borrada: las categorías cuentan issues del tenant, no se filtran por conversación) = 8; Shipping = 1 (c1) + 1 (c4) = 2. B excluido.
  assert.equal(cats.status,'ok');assert.deepEqual(cats.rows.map(r=>[r.category,r.count]),[['Order: Spare Parts',8],['Shipping: Arrived Late',2]]);
  assert.deepEqual(cats.totals,{incidences:10,categories:2,runs:5});
  const all=await repo.monthly();
  // Con fecha y no borradas (tenant A): c1 = 3 incidencias (2 Spare + 1 Shipping) fecha sep-2026; c2 = 1 oct-2026; c3 = 1 en 2024 (fuera); c4 = 1 sin fecha. c5 borrada: excluida.
  assert.equal(all.series.find(p=>p.month==='2026-09').count,3);assert.equal(all.series.find(p=>p.month==='2026-10').count,1);
  assert.equal(all.outsideWindow,1);assert.equal(all.undated,1);assert.equal(all.total,6);assert.equal(all.series.length,12);
  const one=await repo.monthly({problemId:PROBLEM});
  assert.equal(one.series.find(p=>p.month==='2026-09').count,3);assert.equal(one.series.find(p=>p.month==='2026-10').count,1);assert.equal(one.total,4);assert.equal(one.linkedRuns,2);assert.equal(one.outsideWindow,0);
  const other=await repo.monthly({problemId:P2});assert.equal(other.total,1);assert.equal(other.outsideWindow,1);assert.equal(other.series.every(p=>p.count===0),true);
  const none=await repo.monthly({problemId:'33333333-3333-4333-8333-333333333333'});assert.equal(none.status,'empty');assert.equal(none.linkedRuns,0);
  // Tope de tiempo real: statement_timeout de 1 ms sobre una consulta que tarda => timeout, no excepción.
  const slow={async transaction(_a,work){const c=await pool.connect();try{await c.query('BEGIN READ ONLY');const r=await work({tenantId:TENANT,query:(t,v)=>/GROUPING SETS/.test(t)?c.query('select pg_sleep(0.3)').then(()=>c.query(t,v)):c.query(t,v)});await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}};
  const to=await createIncidencesRepository({database:slow,now:()=>NOW,timeoutMs:50}).categories();
  assert.equal(to.status,'timeout');
  // Plan: la lectura por categoría de un tenant grande debe ser una pasada (sin recorrer otras tablas).
  const plan=(await pool.query('explain '+CATEGORIES_SQL.replace('$1',`'${TENANT}'`))).rows.map(r=>r['QUERY PLAN']).join('\n');
  assert.doesNotMatch(plan,/conversations|messages|extraction_runs/);
 }finally{await pool?.end().catch(()=>{});if(started)spawnSync(path.join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
});
