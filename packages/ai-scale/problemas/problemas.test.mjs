// Pruebas locales (sin red, sin llave, datos 100 % sintéticos): node --test packages/ai-scale/problemas/problemas.test.mjs
// Las de Postgres usan initdb desechable en /private/tmp/claude-501 con las migraciones REALES 0001-0044 (stubs de vector como en ../test-pg.mjs) y se destruyen al terminar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {sha256} from '../../intelligence/index.mjs';
import {prepareConversation} from '../preprocess.mjs';
import {buildPersistence,persistenceSql} from '../persistir.mjs';
import {configHash,taskKeyFor,DEFAULT_MODEL} from '../cohorte.mjs';
import {createLedger} from '../spend.mjs';
import {pgAvailable,withLocalPg,SEED_SQL} from '../test-pg.mjs';
import {createProblemRepository} from '../../problems/repository.mjs';
import * as N from './nucleo.mjs';
import {planSql,cerrar,combinarParaRollback} from './agrupar.mjs';
import {embeberFaltantes,estimar} from './embeber.mjs';

const TAX=['Envío: No recibido','Pago: Cobro duplicado','Garantía: Batería'];
const TENANT_A=N.TENANT,TENANT_B='bbbbbbbb-0000-4000-8000-000000000001';
const U=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'prob-'));

// ---- generador de vectores sintéticos (PRNG con semilla): centros casi ortogonales + ruido pequeño
function prng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function gauss(r){return Math.sqrt(-2*Math.log(r()+1e-12))*Math.cos(2*Math.PI*r());}
const center=k=>{const r=prng(1000+k),v=new Float32Array(N.EMBED_DIM);let n=0;for(let i=0;i<v.length;i++){v[i]=gauss(r);n+=v[i]*v[i];}n=Math.sqrt(n);for(let i=0;i<v.length;i++)v[i]/=n;return v;};
const near=(k,seed,noise=0.0025)=>{const c=center(k),r=prng(seed),v=new Float32Array(c.length);for(let i=0;i<v.length;i++)v[i]=c[i]+noise*gauss(r);return v;};

// ---- conversaciones sintéticas persistibles con el flujo REAL (buildPersistence + persistenceSql)
const MODEL=DEFAULT_MODEL,PROVIDER='azure';
function conversacion({tenant,n,cat,sev='high',text,extra=null}){
  const conv={conversation_id:U(1000+n),messages:[
    {id:U(2000+2*n),revision_id:U(3000+2*n),role:'customer',text,at:'1'},
    {id:U(2001+2*n),revision_id:U(3001+2*n),role:'agent',text:extra??'Lo reviso hoy mismo.',at:'2'}]};
  const prep=prepareConversation(conv,{boilerplate:null});
  const first=prep.revisions[0],quote=Array.from(first.text).slice(0,12).join('');
  const rec={task_key:taskKeyFor(configHash({model:MODEL,provider:PROVIDER,taxonomy:TAX}),conv.conversation_id,prep.input_hash),conversation_id:conv.conversation_id,status:'ok',model:MODEL,provider:PROVIDER,
    usage:{prompt:10,completion:5},sentiment:'negative',intent:'complaint',urgency:'normal',
    issues:[{category:cat,severity:sev,evidence:[{message_id:first.message_id,start:0,end:12,quote_hash:sha256(quote),role:'customer'}]}],entities:[]};
  const p=buildPersistence({conv,rec,taxonomy:TAX,boilerplate:null,tenant});
  return{conv,rec,p,n,tenant};
}
const SET_A=[[1,'Envío: No recibido','Mi pedido DT-48213 no ha llegado todavía y ya pasaron doce días.',0],[2,'Envío: No recibido','Hace dos semanas pedí un taladro y nunca lo recibí en mi casa.',0],
  [3,'Envío: No recibido','La paquetería dice entregado pero mi paquete nunca llegó a la puerta.',0],[4,'Pago: Cobro duplicado','Me cobraron dos veces el mismo pedido en la tarjeta de crédito.',1],
  [5,'Pago: Cobro duplicado','Veo dos cargos idénticos de mi compra del lunes en el estado de cuenta.',1],[6,'Garantía: Batería','Mi batería de cuatro amperios ya no carga y solo parpadea en rojo.',2]];
const SET_B=[[11,'Envío: No recibido','El pedido de mi tienda no ha llegado, llevamos una semana esperando.',0],[12,'Pago: Cobro duplicado','Dos cobros iguales aparecen en la cuenta de mi negocio.',1]];
const CL=Object.fromEntries([...SET_A,...SET_B].map(c=>[c[0],c[3]]));
const vecDe=c=>near(CL[c.n],5000+c.n);
function mundo(){
  const A=SET_A.map(c=>conversacion({tenant:TENANT_A,n:c[0],cat:c[1],text:c[2]})),B=SET_B.map(c=>conversacion({tenant:TENANT_B,n:c[0],cat:c[1],text:c[2]}));
  return{A,B};
}
function filasDe(items,vecOf,{mode='mensaje',tenant,version}={}){
  const {rows}=N.construirFilas(items.map(i=>i.p),{mode,tenant,version});
  const byPrep=new Map(items.flatMap(i=>i.p.revs.map(r=>[i.p.taskKey+'|'+r.message_id,vecOf(i)])));
  for(const r of rows)r.vec=byPrep.get(r.taskKey+'|'+r.prepId);
  return rows;
}

// ================================================================== puras
test('ids: embedding y problema usan stableId con la misma entrada que el runtime oficial (determinista y por tenant)',()=>{
  const a=N.embeddingId({tenant:TENANT_A,revision:U(1),version:'v'}),b=N.embeddingId({tenant:TENANT_B,revision:U(1),version:'v'});
  assert.match(a,/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);assert.notEqual(a,b);
  assert.equal(a,N.embeddingId({tenant:TENANT_A,revision:U(1),version:'v'}));assert.notEqual(a,N.embeddingId({tenant:TENANT_A,revision:U(1),version:'w'}));
  assert.notEqual(N.problemIdFor({tenant:TENANT_A,embedding:a}),N.problemIdFor({tenant:TENANT_B,embedding:a}));
});
test('vectores: ida y vuelta base64 float32',()=>{const v=near(1,1);assert.deepEqual(Array.from(N.b64ToF32(N.f32ToB64(v))),Array.from(v));});
test('construirFilas: mayor severidad por mensaje, descarta unknown, tope 32 y texto según modo',()=>{
  const {A}=mundo();const c=A[0];
  const f=N.construirFilas([c.p],{mode:'mensaje',tenant:TENANT_A});assert.equal(f.rows.length,1);assert.equal(f.rows[0].text,c.p.revs[0].text);assert.equal(f.rows[0].label,'Envío: No recibido');
  const q=N.construirFilas([c.p],{mode:'quote',tenant:TENANT_A});assert.equal(q.rows[0].text,Array.from(c.p.revs[0].text).slice(0,12).join(''));assert.notEqual(q.rows[0].id,f.rows[0].id); // versión distinta => espacio distinto
  const unk=structuredClone(c.p);unk.data.issues[0].severity='unknown';const u=N.construirFilas([unk],{tenant:TENANT_A});assert.equal(u.rows.length,0);assert.equal(u.descartadasSeveridad,1);
  const abst={...c.p,status:'abstained'};assert.equal(N.construirFilas([abst],{tenant:TENANT_A}).rows.length,0);
  // empate de severidad: gana la primera cita; severidad mayor: gana la mayor
  const two=structuredClone(c.p);two.data.issues=[{category:'Pago: Cobro duplicado',severity:'low',evidence:two.data.issues[0].evidence},{category:'Envío: No recibido',severity:'critical',evidence:two.data.issues[0].evidence}];
  assert.deepEqual([N.construirFilas([two],{tenant:TENANT_A}).rows[0].label,N.construirFilas([two],{tenant:TENANT_A}).rows[0].severity],['Envío: No recibido','critical']);
});
test('agrupar: voraz por vecino más cercano con umbral <= ; determinista; el prefijo (canario) reproduce la misma asignación',()=>{
  const {A}=mundo();const rows=filasDe(A,vecDe,{tenant:TENANT_A});
  const g=N.agrupar(rows,{threshold:0.2,tenant:TENANT_A});
  assert.equal(g.problemas.size,3);// envío(3) + pago(2) + garantía(1)
  assert.deepEqual(N.resumenAgrupacion(rows,g),{filas:6,problemas:3,outliers:1,tamano:{p50:2,p90:3,max:3},pctEnProblemasDeMasDe1:83.3});
  const g2=N.agrupar(rows,{threshold:0.2,tenant:TENANT_A});assert.deepEqual(g.asig,g2.asig);
  const pref=N.agrupar(rows.slice(0,4),{threshold:0.2,tenant:TENANT_A});assert.deepEqual(pref.asig,g.asig.slice(0,4));
  assert.equal(N.agrupar(rows,{threshold:0,tenant:TENANT_A}).problemas.size,6);// umbral 0: nada se une (distancias > 0)
  assert.equal(N.agrupar(rows,{threshold:0.5,tenant:TENANT_A}).problemas.size,3);
  const founder=g.asig.find(x=>x.founder);assert.equal(founder.problemId,N.problemIdFor({tenant:TENANT_A,embedding:rows[0].id}));
  for(const bad of [-0.1,1,NaN])assert.throws(()=>N.agrupar(rows,{threshold:bad}),/umbral/);
  const cal=N.calibrar(rows,{tenant:TENANT_A});assert.ok(cal.distancia_vecino_previo.p50<=cal.distancia_vecino_previo.p95);assert.ok(JSON.stringify(cal).length<3000);
});
test('SQL: lista cerrada de sentencias (solo INSERT/begin/commit/rollback/DO/set_config); rechaza UPDATE/DELETE/DROP',()=>{
  const {A}=mundo();const rows=filasDe(A,vecDe,{tenant:TENANT_A});const plan=planSql(rows,{threshold:0.2,tenant:TENANT_A,version:'v1'});
  for(const s of [...plan.lotes,...plan.versiones])assert.ok(N.onlyAllowedStatements(cerrar(s,true)));
  for(const bad of ['update public.problems set title=null;','delete from public.problems;','drop table public.problems;','insert into public.issues(id) values(1);','truncate public.embeddings;',"insert into public.problems(id) select 1; delete from public.problems;"])assert.ok(!N.onlyAllowedStatements([bad]));
  assert.ok(!/\bupdate\b|\bdelete\b/i.test(plan.lotes.flat().join('\n').replace(/'(?:[^']|'')*'/g,"''")));
});
test('verificación: solo lectura y sin texto de clientes',()=>{const q=N.verificacionSql({version:'v1'});assert.doesNotMatch(q.replace(/--[^\n]*/g,''),/\b(insert|update|delete|drop|alter|truncate|create)\b/i);assert.doesNotMatch(q,/content|redacted_text|quote/);});

// ================================================================== paso 1 (OpenRouter simulado: sin red)
const stubEmbedClient=({cost=0.00001,fail=false}={})=>({calls:[],async post(ep,body){this.calls.push({ep,n:body.input.length,provider:body.provider,model:body.model});
  if(fail)return{status:500,json:null};return{status:200,json:{data:body.input.map((_,i)=>({index:i,embedding:Array.from(near(1,i+1))})),usage:{cost,prompt_tokens:10}}};}});
test('embeber: no envía nada sin confirmación; con ENVIAR envía en lotes <=32, provider fijo, guarda vectores con hash y es reanudable',async()=>{
  const {A}=mundo();const rows=filasDe(A,()=>null,{tenant:TENANT_A});for(let k=0;k<70;k++)rows.push({...rows[0],prepId:'x'+k,text:'texto sintético '+k,textHash:sha256('t'+k)});
  const dir=tmp();const out=path.join(dir,'e.jsonl');
  const ledger=()=>createLedger({dir,file:'g.jsonl',capTotalUsd:0.2,capBatchUsd:0.2,batchId:'t'});
  const c0=stubEmbedClient();await assert.rejects(embeberFaltantes({faltantes:rows,client:c0,ledger:ledger(),outFile:out,mode:'mensaje',confirm:async()=>false}),/no confirmado/);assert.equal(c0.calls.length,0);assert.ok(!fs.existsSync(out));
  const c1=stubEmbedClient();const r=await embeberFaltantes({faltantes:rows,client:c1,ledger:ledger(),outFile:out,mode:'mensaje',confirm:async()=>true});
  assert.equal(r.enviadas,rows.length);assert.ok(c1.calls.every(c=>c.n<=32&&c.ep==='/embeddings'&&c.provider.only[0]==='azure'&&c.provider.data_collection==='deny'&&c.provider.allow_fallbacks===false));
  assert.deepEqual(c1.calls.map(c=>c.n),[32,32,12]);
  const lines=fs.readFileSync(out,'utf8').trim().split('\n').map(JSON.parse);assert.equal(lines.length,rows.length);assert.ok(lines.every(l=>l.dim===1536&&l.text_hash&&l.vec_f32_b64&&!('text' in l)));
  assert.ok(Math.abs(r.gasto.total_usd-0.00003)<1e-9);
  // los vectores guardados se adjuntan; texto cambiado => obsoleto
  const vecs=await N.leerVectores([out],{mode:'mensaje'});const re=rows.map(x=>({...x,vec:null}));const a=N.adjuntarVectores(re,vecs,{mode:'mensaje'});assert.equal(a.sinVector,0);assert.equal(a.obsoletos,0);
  re[0].textHash='otro';re.forEach(x=>x.vec=null);assert.equal(N.adjuntarVectores(re,vecs,{mode:'mensaje'}).obsoletos>=1,true);
});
test('embeber: el tope fijo de gasto aborta ANTES de enviar y el techo estimado mayor al tope se rechaza',async()=>{
  const rows=Array.from({length:40},(_,k)=>({taskKey:'t',prepId:'p'+k,text:'x'.repeat(2000),textHash:'h'+k,label:'l',severity:'high'}));
  const dir=tmp();const mk=cap=>createLedger({dir,file:'g2.jsonl',capTotalUsd:cap,capBatchUsd:cap,batchId:'t'});
  const c=stubEmbedClient();const r=await embeberFaltantes({faltantes:rows,client:c,ledger:mk(0.0008),outFile:path.join(dir,'o.jsonl'),mode:'mensaje',confirm:async()=>true,log:()=>{}});
  assert.equal(c.calls.length,0);assert.equal(r.enviadas,0);
  await assert.rejects(embeberFaltantes({faltantes:Array.from({length:400000},()=>({text:'x'.repeat(100)})),client:c,ledger:mk(0.2),outFile:path.join(dir,'o2.jsonl'),mode:'mensaje',confirm:async()=>true}),/supera el tope/);
  assert.ok(estimar(rows).usd_techo<0.01);
  const f=stubEmbedClient({fail:true});const rr=await embeberFaltantes({faltantes:rows.slice(0,3),client:f,ledger:mk(0.2),outFile:path.join(dir,'o3.jsonl'),mode:'mensaje',confirm:async()=>true,log:()=>{}});assert.equal(rr.enviadas,0);assert.equal(rr.fallidas,3);
});

// ================================================================== Postgres local con migraciones reales
const AUTH_UID=`create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`;
const OWNER={A:U(9001),B:U(9002)};
function sembrar(psql,world){
  assert.ok(psql(AUTH_UID).ok);assert.ok(psql('alter table auth.users add column deleted_at timestamptz, add column banned_until timestamptz').ok);
  const done=new Set();
  for(const c of [...world.A,...world.B]){
    const o={tenant:c.tenant,conn:U(500+c.n),conv:c.conv.conversation_id,csrev:U(600+c.n),msgs:c.conv.messages.map((m,i)=>({id:m.id,rev:m.revision_id,srev:U(700+c.n*2+i),role:m.role}))};
    let sql=SEED_SQL(o);if(done.has(c.tenant))sql=sql.replace(/^\s*insert into public\.organizations[^\n]*\n/m,'');done.add(c.tenant);
    // account_id único por conexión (unique tenant,source,account_id)
    sql=sql.replace("values('"+o.conn+"','"+o.tenant+"','csv','acc')","values('"+o.conn+"','"+o.tenant+"','csv','acc"+c.n+"')");
    for(const s of sql.split(/;\n/).filter(x=>x.trim()))assert.ok(psql(s).ok,s.slice(0,80)+' -> '+psql(s).err);
  }
  // snapshot que exige el repositorio de evidencia (una fila messages por revisión)
  assert.ok(psql(`update public.source_revisions s set snapshot=jsonb_build_array(jsonb_build_object('table','messages','row',jsonb_build_object('id',m.id,'role',m.role,'conversation_id',m.conversation_id))) from public.messages m where s.entity_type='message' and s.canonical_id=m.id and s.tenant_id=m.tenant_id`).ok);
  for(const [k,t] of [['A',TENANT_A],['B',TENANT_B]]){assert.ok(psql(`insert into auth.users(id) values('${OWNER[k]}')`).ok);const m=psql(`insert into public.memberships(tenant_id,user_id,role,status) values('${t}','${OWNER[k]}','owner','active')`);assert.ok(m.ok,m.err);}
}
const persistir=(sock,items,tenant)=>{const r=spawnSync('psql',['-h',sock,'-U','postgres','-d','t','-q','-v','ON_ERROR_STOP=1','-c',persistenceSql(items.map(i=>i.p),{tenant,commit:true})],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
const correr=(sock,stmts)=>spawnSync('psql',['-h',sock,'-U','postgres','-d','t','-q','-v','ON_ERROR_STOP=1','-f','-'],{input:stmts.join('\n')+'\n',encoding:'utf8'});
// misma forma que packages/platform/src/db.ts: BEGIN, SET LOCAL ROLE vexa_backend, GUCs de sesión
function baseDatos(client,tenantId,userId){return{transaction:async(action,work)=>{
  await client.query(action==='read'?'BEGIN READ ONLY':'BEGIN');
  try{await client.query('SET LOCAL ROLE vexa_backend');
    await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('vexa.tenant_id',$2,true),set_config('vexa.action',$3,true)",[userId,tenantId,action]);
    const m=(await client.query("select tenant_id,user_id,role from public.memberships where tenant_id=$1 and user_id=$2 and status='active'",[tenantId,userId])).rows[0];if(!m)throw Error('sin membresía');
    const r=await work({tenantId:m.tenant_id,userId:m.user_id,role:m.role,query:(t,v=[])=>client.query(t,v)});await client.query('COMMIT');return r;
  }catch(e){await client.query('ROLLBACK');throw e;}}};}
const VERSION=N.defaultVersion('mensaje');

test('Postgres local: miembros+versiones se insertan, son idempotentes, no duplican, respetan tenants y las vistas REALES (repository.list/detail) los muestran',{skip:!pgAvailable()&&'sin postgres local',timeout:300000},async()=>{
  const world=mundo();
  await withLocalPg(async({psql,sock})=>{
    sembrar(psql,world);persistir(sock,world.A,TENANT_A);persistir(sock,world.B,TENANT_B);
    const cnt=(t,w='')=>+psql(`select count(*) from public.${t} ${w}`).out;
    assert.equal(cnt('extraction_runs'),8);
    const rowsA=filasDe(world.A,vecDe,{tenant:TENANT_A,version:VERSION}),rowsB=filasDe(world.B,vecDe,{tenant:TENANT_B,version:VERSION});
    const planA=planSql(rowsA,{threshold:0.2,tenant:TENANT_A,version:VERSION,batchSize:2,vectorType:'text'}),planB=planSql(rowsB,{threshold:0.2,tenant:TENANT_B,version:VERSION,batchSize:2,vectorType:'text'});
    assert.equal(planA.lotes.length,3);
    // --- rollback-test: ejecuta todo (miembros + versiones, incluido el trigger problem_snapshot_guard) y no deja nada
    const rb=correr(sock,combinarParaRollback(planA));assert.equal(rb.status,0,rb.stderr);
    assert.deepEqual([cnt('embeddings'),cnt('problems'),cnt('problem_embedding_members'),cnt('problem_versions')],[0,0,0,0]);
    // --- commit
    const aplicar=(plan)=>{for(const s of plan.lotes){const r=correr(sock,cerrar(s,true));assert.equal(r.status,0,r.stderr);}for(const s of plan.versiones){const r=correr(sock,cerrar(s,true));assert.equal(r.status,0,r.stderr);}};
    aplicar(planA);
    const estado=()=>[cnt('embeddings'),cnt('problems'),cnt('problem_embedding_members'),cnt('problem_versions')];
    assert.deepEqual(estado(),[6,3,6,3]);
    // idempotencia: repetir NO duplica nada (ni versiones)
    aplicar(planA);assert.deepEqual(estado(),[6,3,6,3]);
    // aislamiento: el tenant B no toca A y sus ids son distintos
    aplicar(planB);assert.deepEqual(estado(),[8,5,8,5]);
    assert.equal(cnt('problems',`where tenant_id='${TENANT_A}'`),3);assert.equal(cnt('problems',`where tenant_id='${TENANT_B}'`),2);
    assert.equal(+psql(`select count(*) from (select id from public.problems group by id having count(*)>1) x`).out,0);
    // el contenido guardado es el esperado
    assert.equal(psql(`select dim||'|'||model_id||'|'||version from public.embeddings limit 1`).out,`1536|${N.EMBED_MODEL}|${VERSION}`);
    assert.deepEqual(psql(`select title||':'||n from (select p.title,count(*) n from public.problems p join public.problem_embedding_members m on m.tenant_id=p.tenant_id and m.problem_id=p.id where p.tenant_id='${TENANT_A}' group by 1 order by 1) x`).out.split('\n'),['Envío: No recibido:3','Garantía: Batería:1','Pago: Cobro duplicado:2']);
    // --- canario (prefijo) + completo: mismo resultado final que ir directo, y la versión sube solo si cambia la membresía
    assert.ok(psql(`select 1`).ok);
    // --- guardas: corrida inexistente aborta sin insertar; asignación previa distinta aborta
    const roto=structuredClone(rowsA.slice(0,1));roto[0].runId=U(424242);
    const pr=planSql(roto,{threshold:0.2,tenant:TENANT_A,version:VERSION,vectorType:'text'});const gr=correr(sock,cerrar(pr.lotes[0],true));assert.notEqual(gr.status,0);assert.match(gr.stderr,/faltan corridas/);
    const otroUmbral=planSql(rowsA,{threshold:0,tenant:TENANT_A,version:VERSION,batchSize:50,vectorType:'text'});const g2=correr(sock,cerrar(otroUmbral.lotes[0],true));assert.notEqual(g2.status,0);assert.match(g2.stderr,/asignación previa distinta/);
    assert.deepEqual(estado(),[8,5,8,5]);
    // --- las vistas reales
    const client=new pg.Client({host:sock,user:'postgres',database:'t'});await client.connect();
    try{
      const repoA=createProblemRepository({database:baseDatos(client,TENANT_A,OWNER.A)}),repoB=createProblemRepository({database:baseDatos(client,TENANT_B,OWNER.B)});
      const listA=await repoA.list(),listB=await repoB.list();
      assert.equal(listA.length,3);assert.equal(listB.length,2);
      const envio=listA.find(p=>p.label==='Envío: No recibido');
      assert.deepEqual([envio.version,envio.state,envio.outlier,envio.dimensions,envio.embeddingVersion,envio.modelId,envio.embeddingIds.length,envio.conversationIds.length],[1,'active',false,1536,VERSION,N.EMBED_MODEL,3,3]);
      assert.equal(listA.find(p=>p.label==='Garantía: Batería').outlier,true);
      assert.ok(listA.every(p=>p.embeddingIds.every(id=>rowsA.some(r=>r.id===id))));// nada de B en A
      assert.ok(listB.every(p=>p.embeddingIds.every(id=>rowsB.some(r=>r.id===id))));
      const det=await repoA.detail({problemId:envio.id});assert.equal(det.history.length,1);assert.equal(det.embeddingIds.length,3);
      await assert.rejects(repoB.detail({problemId:envio.id}),/problem_not_found/);// tenant B no puede abrir un problema de A
      const src=await repoA.sources();assert.equal(src.length,6);
    }finally{await client.end();}
    // --- membresía crece (canario -> completo): nueva versión 2 con todos los miembros; sin cambios no hay versión nueva
    const extra=conversacion({tenant:TENANT_A,n:7,cat:'Envío: No recibido',text:'Mi compra no llega, ya van tres semanas de espera sin noticias.'});
    sembrar2(psql,extra);persistir(sock,[extra],TENANT_A);
    const rows2=filasDe([...world.A,extra],c=>c.n===7?near(0,9999):vecDe(c),{tenant:TENANT_A,version:VERSION});
    const plan2=planSql(rows2,{threshold:0.2,tenant:TENANT_A,version:VERSION,batchSize:50,vectorType:'text'});aplicar(plan2);
    assert.deepEqual(estado(),[9,5,9,6]);// 1 embedding/miembro nuevo, 1 versión nueva (solo el problema de envíos creció)
    assert.equal(psql(`select max(version) from public.problem_versions v join public.problems p on p.id=v.problem_id and p.tenant_id=v.tenant_id where p.title='Envío: No recibido' and p.tenant_id='${TENANT_A}'`).out,'2');
    aplicar(plan2);assert.deepEqual(estado(),[9,5,9,6]);
    // --- consultas de verificación (MCP): incoherencias en 0
    const V=N.verificacionSql({tenant:TENANT_A,version:VERSION}).split(/\n(?=-- \d\.)/).slice(1);
    const rr=psql(V[1].replace(/^--[^\n]*\n/gm,'').trim().replace(/;\s*$/,'')).out.split('|');assert.deepEqual(rr.map(Number),[0,0,0,0,0,0]);
    assert.deepEqual(psql(V[2].replace(/^--[^\n]*\n/gm,'').trim().replace(/;\s*$/,'')).out.split('|').map(Number),[2,2]);// en la prueba el tenant B SÍ usó la etapa (2 embeddings/2 problemas); en producción esta consulta debe dar 0
    for(const q of V)assert.ok(psql(q.replace(/^--[^\n]*\n/gm,'').trim().replace(/;\s*$/,'')).ok,q.slice(0,60));
  });
});
function sembrar2(psql,c){
  const o={tenant:c.tenant,conn:U(500+c.n),conv:c.conv.conversation_id,csrev:U(600+c.n),msgs:c.conv.messages.map((m,i)=>({id:m.id,rev:m.revision_id,srev:U(700+c.n*2+i),role:m.role}))};
  let sql=SEED_SQL(o).replace(/^\s*insert into public\.organizations[^\n]*\n/m,'').replace("values('"+o.conn+"','"+o.tenant+"','csv','acc')","values('"+o.conn+"','"+o.tenant+"','csv','acc"+c.n+"')");
  for(const s of sql.split(/;\n/).filter(x=>x.trim()))assert.ok(psql(s).ok);
  assert.ok(psql(`update public.source_revisions s set snapshot=jsonb_build_array(jsonb_build_object('table','messages','row',jsonb_build_object('id',m.id,'role',m.role,'conversation_id',m.conversation_id))) from public.messages m where s.entity_type='message' and s.canonical_id=m.id and s.tenant_id=m.tenant_id and m.conversation_id='${c.conv.conversation_id}'`).ok);
}

// ================================================================== CLI de punta a punta en seco (archivos sintéticos; sin red ni base)
test('CLI: embeber --dry-count y agrupar --calibrar/--threshold en seco; sin --run no ejecuta nada; rechaza tenant ajeno, umbral inválido y --run sin umbral/vectores',async()=>{
  const {A}=mundo();const root=tmp(),cdir=path.join(root,'cohorte');fs.mkdirSync(cdir);
  const w=(f,lines)=>fs.writeFileSync(path.join(cdir,f),lines.map(l=>JSON.stringify(l)).join('\n')+'\n');
  w('resultados.jsonl',A.map(c=>c.rec));w('entrada.jsonl',A.map(c=>c.conv));
  fs.writeFileSync(path.join(cdir,'boilerplate.json'),JSON.stringify({version:2,hash:'x',config_hash:configHash({model:MODEL,provider:PROVIDER,taxonomy:TAX}),window_hash:null,window:null,n:0,lines:[]}));
  fs.writeFileSync(path.join(root,'tax.json'),JSON.stringify(TAX));
  const emb=A.flatMap(c=>c.p.revs.filter(r=>r.role==='customer').map(r=>({task_key:c.p.taskKey,conversation_id:c.conv.conversation_id,message_id:r.message_id,label:'x',severity:'high',model:N.EMBED_MODEL,dim:1536,vec_f32_b64:N.f32ToB64(vecDe(c))})));
  const sh=(script,args,env={})=>spawnSync('node',[path.join(path.dirname(new URL(import.meta.url).pathname),script),...args],{encoding:'utf8',env:{...process.env,IA_ESCALA_OUT:root,...env}});
  // sin vectores todavía
  let r=sh('embeber.mjs',['--taxonomy',path.join(root,'tax.json')]);assert.equal(r.status,0,r.stderr);let j=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  assert.deepEqual([j.conversaciones,j.filas_candidatas,j.con_vector,j.faltantes],[6,6,0,6]);assert.ok(j.estimacion.usd_techo<0.001&&j.tope_usd===0.2);assert.match(r.stdout,/No se llamó a ninguna API/);
  r=sh('embeber.mjs',['--taxonomy',path.join(root,'tax.json'),'--send'],{});assert.notEqual(r.status,0); // sin TTY no se puede confirmar ENVIAR (o no hay llave): no envía
  assert.ok(!fs.existsSync(path.join(root,'problemas','gasto-embeddings-problemas.jsonl'))||fs.readFileSync(path.join(root,'problemas','gasto-embeddings-problemas.jsonl'),'utf8')==='');
  w('embeddings.jsonl',emb);
  r=sh('embeber.mjs',['--taxonomy',path.join(root,'tax.json'),'--send']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/nada que enviar/);
  r=sh('agrupar.mjs',['--taxonomy',path.join(root,'tax.json'),'--calibrar']);assert.equal(r.status,0,r.stderr);j=JSON.parse(r.stdout);assert.equal(j.con_vector,6);assert.equal(j.calibracion.por_umbral.length,8);
  r=sh('agrupar.mjs',['--taxonomy',path.join(root,'tax.json'),'--threshold','0.2']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/DRY-RUN\. Nada se ejecutó\./);j=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  assert.deepEqual([j.problemas,j.outliers,j.filas_candidatas,j.sin_vector],[3,1,6,0]);
  const files=fs.readdirSync(path.join(root,'problemas','sql-problemas'));assert.ok(files.some(f=>f.startsWith('lote-'))&&files.some(f=>f.startsWith('versiones-')));
  assert.ok(fs.readFileSync(path.join(root,'problemas','sql-problemas',files.find(f=>f.startsWith('lote-'))),'utf8').trim().endsWith('rollback;')); // el dry-run termina en rollback
  assert.equal((fs.statSync(path.join(root,'problemas','sql-problemas',files[0])).mode&0o777),0o600);
  r=sh('agrupar.mjs',['--taxonomy',path.join(root,'tax.json'),'--tenant',TENANT_B,'--threshold','0.2']);assert.notEqual(r.status,0);assert.match(r.stderr,/no autorizados/);
  r=sh('agrupar.mjs',['--taxonomy',path.join(root,'tax.json'),'--threshold','1.5']);assert.notEqual(r.status,0);
  r=sh('agrupar.mjs',['--taxonomy',path.join(root,'tax.json'),'--run','--commit']);assert.equal(r.status,0);assert.match(r.stdout,/Falta --threshold/); // sin umbral no hace nada
  r=sh('agrupar.mjs',['--taxonomy',path.join(root,'tax.json'),'--threshold','0.2','--run']);assert.notEqual(r.status,0);assert.match(r.stderr,/exactamente uno/);
  r=sh('agrupar.mjs',['--taxonomy',path.join(root,'tax.json'),'--threshold','0.2','--run','--rollback-test']);assert.notEqual(r.status,0);assert.match(r.stderr,/--max/);
  // canario --max 2: solo 2 conversaciones
  r=sh('agrupar.mjs',['--taxonomy',path.join(root,'tax.json'),'--threshold','0.2','--max','2']);j=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));assert.equal(j.conversaciones,2);
  r=sh('agrupar.mjs',['--taxonomy',path.join(root,'tax.json'),'--emit-verificacion',path.join(root,'problemas','verificacion.sql')]);assert.equal(r.status,0);assert.ok(fs.existsSync(path.join(root,'problemas','verificacion.sql')));
  // con un vector faltante, --run se niega (no agrupa con datos incompletos)
  w('embeddings.jsonl',emb.slice(1));
  r=sh('agrupar.mjs',['--taxonomy',path.join(root,'tax.json'),'--threshold','0.2','--run','--rollback-test','--max','5']);assert.notEqual(r.status,0);assert.match(r.stderr,/faltan vectores/);
});

// ================================================================== corridas ausentes: --omitir-sin-corrida y diagnóstico
test('Postgres local: conversaciones sin corrida succeeded abortan el lote; con preflight+omisión se excluyen y se cuentan; idempotente; diagnóstico clasifica la causa',{skip:!pgAvailable()&&'sin postgres local',timeout:300000},async()=>{
  const world=mundo();
  await withLocalPg(async({psql,sock})=>{
    sembrar(psql,world);
    const by=n=>world.A.find(c=>c.n===n);
    persistir(sock,[by(1),by(2),by(4),by(5)],TENANT_A);               // 3 y 6 NO se persisten
    // la conversación 6 ya tenía una corrida oficial (otro id): persistir.mjs no escribe la suya (NOOFF)
    assert.ok(psql(`insert into public.extraction_runs(id,tenant_id,model_id,prompt_hash,schema_hash,input_hash,status,conversation_id) values('${U(777)}','${TENANT_A}','m','p','s','h','succeeded','${by(6).conv.conversation_id}')`).ok);
    const cnt=t=>+psql(`select count(*) from public.${t}`).out;
    const rows=filasDe(world.A,vecDe,{tenant:TENANT_A,version:VERSION});
    // sin omisión: el guard aborta y no inserta nada (lote atómico)
    const plan0=planSql(rows,{threshold:0.2,tenant:TENANT_A,version:VERSION,batchSize:50,vectorType:'text'});
    const g=correr(sock,cerrar(plan0.lotes[0],true));assert.notEqual(g.status,0);assert.match(g.stderr,/faltan corridas/);assert.equal(cnt('embeddings'),0);
    // preflight (formato agnóstico: psql -At) + filtro
    const exec=sql=>{const r=spawnSync('psql',['-h',sock,'-U','postgres','-d','t','-At','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
    const ex=N.preflightCorridas([...new Set(rows.map(r=>r.runId))],{tenant:TENANT_A,exec});assert.equal(ex.size,4);
    const fr=N.filtrarSinCorrida(rows,ex);assert.deepEqual([fr.omitidas.conversaciones,fr.omitidas.filas,fr.kept.length],[2,2,4]);
    const plan=planSql(fr.kept,{threshold:0.2,tenant:TENANT_A,version:VERSION,batchSize:2,vectorType:'text'});
    const aplicar=()=>{for(const s of [...plan.lotes,...plan.versiones]){const r=correr(sock,cerrar(s,true));assert.equal(r.status,0,r.stderr);}};
    aplicar();const est=()=>[cnt('embeddings'),cnt('problems'),cnt('problem_embedding_members'),cnt('problem_versions')];
    assert.deepEqual(est(),[4,2,4,2]);aplicar();assert.deepEqual(est(),[4,2,4,2]); // idempotente
    // si NADA existe, el preflight se niega a omitir todo
    assert.throws(()=>N.preflightCorridas([U(999001)],{tenant:TENANT_A,exec}),/preflight/);
    // diagnóstico: 4 ok, 1 con otra corrida oficial (6), 1 sin corrida (3)
    const d=exec(N.diagnosticoSql(world.A.map(c=>c.p),{tenant:TENANT_A})).trim().split('\n');
    assert.deepEqual(d.map(l=>l.split('|')[0]+'|'+l.split('|').at(-1)),['0 ok: corrida succeeded existe|4','3 sin corrida propia; la conversación tiene otra corrida oficial (succeeded)|1','5 sin corrida: persistir no la escribió (¿recuperada después, o descartada?)|1']);
    // y las vistas reales siguen coherentes
    const client=new pg.Client({host:sock,user:'postgres',database:'t'});await client.connect();
    try{assert.equal((await createProblemRepository({database:baseDatos(client,TENANT_A,OWNER.A)}).list()).length,2);}finally{await client.end();}
  });
});
