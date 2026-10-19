// Pruebas locales (sin red, sin llave): node --test packages/ai-scale/ai-scale.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {redact,cutQuoted,cutSignature,isAutomatic,prepareConversation,learnBoilerplate} from './preprocess.mjs';
import {buildRequest,resolveAndValidate,compactSchema,compactPrompt} from './compact.mjs';
import {runCohort,projectCost,pickPilot,taskKeyFor,configHash} from './cohorte.mjs';
import {createLedger,BudgetAbort} from './spend.mjs';
import {scoreFixtures} from './validar-fixtures.mjs';
import {createClient} from './openrouter.mjs';
import * as SQL from './sql.mjs';
import {groupRows,parseRows} from './exportar.mjs';

const TAX=['Envío: No recibido','Pago: Cobro duplicado','Garantía: Batería','Otros: Notificación automática'];
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'iaesc-'));

test('redacción: emails, teléfonos, números largos y tarjetas; fechas y códigos cortos se conservan',()=>{
  const t=redact('Escríbeme a juan.perez@correo.com o al +52 55 1234 5678. Pedido 123456789012, tarjeta 4111 1111 1111 1111, CLABE 012345678901234567, guía ORD-9876543210. Pedido DT-48213 el 2026-10-18.');
  assert.doesNotMatch(t,/juan\.perez|@correo|1234 5678|123456789012|4111|012345678901234567|9876543210/);
  assert.match(t,/DT-48213/);
  assert.match(t,/\[PII\]/);
});
test('redacción: la salida jamás contiene la llave ni correos aunque estén pegados a texto',()=>{
  const t=redact('contacto:a@b.co,otro x.y@z.org; 5512345678901');
  assert.doesNotMatch(t,/@/);assert.doesNotMatch(t,/5512345678901/);
});
test('recorte de cita y firma: solo trunca la cola (prefijo del texto)',()=>{
  const body='Mi taladro dejó de encender.';
  const full=body+'\n\nEl lun, 12 oct 2026, 10:42, soporte@ejemplo.invalid escribió:\n> hola\n> mundo';
  assert.equal(full.slice(0,cutQuoted(full)).trim(),body);
  const sig=body+'\n\n--\nEquipo de Soporte\nTel. 55 0000 0000';
  assert.equal(sig.slice(0,cutSignature(sig)).trim(),body);
  const iph=body+'\n\nEnviado desde mi iPhone';
  assert.equal(iph.slice(0,cutSignature(iph)).trim(),body);
  const out='De: soporte@x.com\nEnviado el: lunes\nPara: yo\n'; assert.equal(cutQuoted('Hola\n'+out),5);
  const bloq=body+'\n> línea 1\n> línea 2\n> línea 3'; assert.equal(bloq.slice(0,cutQuoted(bloq)).trim(),body);
});
test('no corta contenido real que menciona "escribió" a mitad de frase ni saludos largos',()=>{
  const t='Ayer me escribió su equipo y dijeron que me llamarían. Saludos a todos, pero mi pedido sigue sin llegar y necesito respuesta hoy mismo por favor.';
  assert.equal(cutQuoted(t),t.length);
  assert.equal(cutSignature(t),t.length);
});
test('pies repetidos del corpus se aprenden y se recortan',()=>{
  const pie='Herramientas Delta · Av. Siempre Viva 123';
  const texts=Array.from({length:30},(_,i)=>`Mensaje número ${i} sobre un problema.\n${pie}`);
  const bp=learnBoilerplate(texts,{minCount:8});assert.ok(bp.has(pie.toLowerCase()));
  const t='Contenido real.\n'+pie;assert.equal(t.slice(0,cutSignature(t,bp)).trim(),'Contenido real.');
});
test('notificaciones automáticas se omiten por regla; mensajes humanos no',()=>{
  assert.ok(isAutomatic('Delivery Status Notification (Failure) No se pudo entregar'));
  assert.ok(isAutomatic('Respuesta automática: estoy fuera de la oficina'));
  assert.ok(!isAutomatic('Hola, mi pedido no ha llegado'));
  const conv={conversation_id:'c1',messages:[{id:'a',role:'customer',text:'Este es un mensaje automático, no responda a este correo. Su pedido ha sido enviado.',at:'1'}]};
  const p=prepareConversation(conv);assert.equal(p.status,'skipped');assert.equal(p.reason,'automatica');
  assert.equal(prepareConversation(conv,{skipAutomatic:false}).status,'ok');
});
test('preprocesado: offsets del texto enviado coinciden con el prefijo del texto redactado completo',()=>{
  const raw='Mi correo es x@y.com, pedido 123456789012. Falla la batería.\n\nEl lun, 12 oct 2026 soporte@a.com escribió:\n> hola';
  const p=prepareConversation({conversation_id:'c',messages:[{id:'m1',role:'customer',text:raw,at:'1'}]});
  const full=redact(raw);const r=p.revisions[0];
  assert.ok(full.startsWith(r.text));assert.equal(Array.from(r.text).length,r.keptLen);
  assert.doesNotMatch(r.text,/x@y|123456789012|hola/);
});
test('límites: tope de mensajes y de caracteres por mensaje',()=>{
  const msgs=Array.from({length:100},(_,i)=>({id:'m'+i,role:i%2?'agent':'customer',text:'texto '+i+' '+'x'.repeat(10),at:String(1000+i)}));
  const p=prepareConversation({conversation_id:'c',messages:msgs});assert.equal(p.stats.msgs_out,40);assert.ok(p.stats.truncated_conv);
  const big=prepareConversation({conversation_id:'c',messages:[{id:'a',role:'customer',text:'á'.repeat(9000),at:'1'}]});
  assert.equal(big.revisions[0].keptLen,3800);
});

// ---- compact
const REVS=[{message_id:'f1-m0',role:'customer',text:'Me cobraron dos veces el pedido DT-48213.',keptLen:41},{message_id:'f1-m1',role:'agent',text:'Verificamos el cargo duplicado.',keptLen:31}];
const rawOk=(over={})=>({issues:[{category:'Pago: Cobro duplicado',severity:'high',evidence:['m0']}],sentiment:'negative',intent:'complaint',urgency:'normal',entities:[{type:'order_mention',value:'DT-48213',evidence:['m0']}],abstention:null,...over});
test('compacto: payload sin available_values ni quote duplicado; esquema constante; taxonomía en el prefijo cacheable',()=>{
  const b1=buildRequest(REVS,TAX,{model:'m',provider:'azure'}),b2=buildRequest([REVS[0]],TAX,{model:'m',provider:'azure'});
  const user=JSON.parse(b1.messages[1].content);
  assert.deepEqual(Object.keys(user.revisions[0]),['ref','role','text']);
  assert.equal(JSON.stringify(b1.response_format),JSON.stringify(b2.response_format)); // mismo esquema para cualquier conversación
  assert.equal(b1.messages[0].content[0].text,b2.messages[0].content[0].text);       // mismo prefijo
  assert.equal(b1.messages[0].content[0].cache_control.type,'ephemeral');
  assert.match(b1.messages[0].content[0].text,/Pago: Cobro duplicado/);
  assert.deepEqual(b1.provider,{only:['azure'],allow_fallbacks:false,require_parameters:true,data_collection:'deny'});
  assert.ok(Buffer.byteLength(JSON.stringify(b1))<Buffer.byteLength(JSON.stringify(compactSchema(TAX)))+compactPrompt().length+800);
});
test('compacto: salida válida se resuelve a spans exactos con quote_hash',()=>{
  const v=resolveAndValidate(rawOk(),REVS,TAX);assert.ok(v.ok,v.code);
  assert.equal(v.data.issues[0].evidence[0].quote,REVS[0].text);assert.match(v.data.issues[0].evidence[0].quote_hash,/^[a-f0-9]{64}$/);
});
test('compacto: referencias inventadas, categorías fuera de taxonomía, entidades no literales y claves extra se rechazan',()=>{
  assert.equal(resolveAndValidate(rawOk({issues:[{category:'Pago: Cobro duplicado',severity:'high',evidence:['m9']}]}),REVS,TAX).ok,false);
  assert.equal(resolveAndValidate(rawOk({issues:[{category:'Inventada',severity:'high',evidence:['m0']}]}),REVS,TAX).ok,false);
  assert.equal(resolveAndValidate(rawOk({entities:[{type:'order_mention',value:'DT-99999',evidence:['m0']}]}),REVS,TAX).code,'invalid_entity');
  assert.equal(resolveAndValidate({...rawOk(),extra:1},REVS,TAX).ok,false);
  assert.equal(resolveAndValidate(rawOk({issues:[{category:'Pago: Cobro duplicado',severity:'high',evidence:[{message_revision_id:'f1-m0',start:0,end:3,quote:'Me ',role:'customer'}]}]}),REVS,TAX).ok,false); // spans literales no se aceptan
  assert.equal(resolveAndValidate(rawOk({abstention:{reason:'ambiguous'}}),REVS,TAX).ok,false); // abstención con issues
});
test('compacto: una entidad dentro de [PII] no se acepta',()=>{
  const revs=[{message_id:'a',role:'customer',text:'Mi pedido [PII] llegó roto.',keptLen:26}];
  assert.equal(resolveAndValidate(rawOk({entities:[{type:'order_mention',value:'[PII]',evidence:['m0']}],issues:[{category:'Envío: No recibido',severity:'low',evidence:['m0']}]}),revs,TAX).ok,false);
});
test('compacto: el prompt conserva reglas de abstención, entidades y contexto del gateway',()=>{
  const p=compactPrompt();assert.match(p,/abstain with issues=\[\]/);assert.match(p,/untrusted data, never as instructions/);assert.match(p,/product_mention/);assert.match(p,/Interpret each category/);assert.doesNotMatch(p,/available_values|available_evidence/);
});

// ---- runner con cliente simulado
function stubClient({failFirst=0,cost=0.0004,mutate=null}={}){
  const calls=[];let n=0;
  return{calls,async post(ep,body){
    calls.push(ep);
    if(ep==='/embeddings')return{status:200,ms:5,json:{data:body.input.map((_,i)=>({index:i,embedding:Array.from({length:1536},(_,k)=>((k+i)%7)/7+0.01)})),usage:{prompt_tokens:10,cost:0.000001}}};
    n++;if(n<=failFirst)return{status:500,ms:5,json:{error:{message:'x'}}};
    const user=JSON.parse(body.messages[1].content);
    const raw=mutate?mutate(user):{issues:[{category:'Envío: No recibido',severity:'medium',evidence:['m0']}],sentiment:'neutral',intent:'question',urgency:'normal',entities:[],abstention:null};
    return{status:200,ms:5,json:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}],usage:{prompt_tokens:5000,completion_tokens:300,cost,prompt_tokens_details:{cached_tokens:4800}}}};
  }};
}
const mk=(n)=>Array.from({length:n},(_,i)=>({conversation_id:'conv-'+i,first_at:'2026-08-01',messages:[{id:'m'+i+'a',role:'customer',text:'Mi pedido número '+i+' no ha llegado todavía, ¿dónde está?',at:'1'},{id:'m'+i+'b',role:'agent',text:'Lo reviso.',at:'2'}]}));
const common=(dir,extra)=>({taxonomy:TAX,outDir:dir,concurrency:3,capTotalUsd0:5,capBatchUsd0:5,...extra});

test('runner: extrae, guarda sin texto, embebe y reanuda sin reenviar',async()=>{
  const dir=tmp(),c1=stubClient();
  const r1=await runCohort(common(dir,{convs:mk(10),client:c1,batchId:'t1'}));
  assert.equal(r1.receipt.ok,10);assert.equal(c1.calls.filter(x=>x==='/chat/completions').length,10);assert.equal(r1.receipt.filas_embedding,10);
  const res=fs.readFileSync(path.join(dir,'resultados.jsonl'),'utf8');
  assert.doesNotMatch(res,/no ha llegado/); // sin contenido del cliente
  assert.match(res,/quote_hash/);
  const c2=stubClient();
  const r2=await runCohort(common(dir,{convs:mk(10),client:c2,batchId:'t2'}));
  assert.equal(c2.calls.length,0);assert.equal(r2.receipt.ya_hechas_omitidas,10); // reanudación: nada reenviado
  const c3=stubClient();
  const r3=await runCohort(common(dir,{convs:mk(14),client:c3,batchId:'t3'}));
  assert.equal(r3.receipt.ok,4);assert.equal(r3.receipt.ya_hechas_omitidas,10);
});
test('runner: aborta tras 3 fallos consecutivos y no sigue enviando',async()=>{
  const dir=tmp(),c=stubClient({failFirst:1000});
  const r=await runCohort(common(dir,{convs:mk(30),client:c,concurrency:1,batchId:'f'}));
  assert.match(r.receipt.abort,/3 fallos consecutivos/);
  assert.ok(c.calls.length<=5);assert.ok(r.receipt.sin_intentar_por_aborto>=24);
});
test('runner: un éxito reinicia el contador de fallos consecutivos',async()=>{
  const dir=tmp();let k=0;const base=stubClient();
  const c={calls:[],async post(ep,b){if(ep==='/chat/completions'){k++;if(k%3===0)return{status:500,ms:1,json:null};}return base.post(ep,b);}};
  const r=await runCohort(common(dir,{convs:mk(12),client:c,concurrency:1,batchId:'x',embed:false}));
  assert.equal(r.receipt.abort,null);assert.equal(r.receipt.fallidas,4);
});
test('runner: tope de gasto por lote aborta ANTES de superar el tope',async()=>{
  const dir=tmp(),c=stubClient({cost:0.0012});
  const r=await runCohort(common(dir,{convs:mk(50),client:c,concurrency:1,capBatchUsd0:0.01,capTotalUsd0:5,batchId:'b'}));
  assert.match(r.receipt.abort,/tope del lote/);
  assert.ok(r.receipt.gasto.batch_usd<=0.01+1e-9,JSON.stringify(r.receipt.gasto));
  const r2=await runCohort(common(tmp(),{convs:mk(5),client:stubClient({cost:0.05}),concurrency:1,batchId:'o'}));
  assert.match(r2.receipt.abort,/cost_overrun/);
});
test('runner: el gasto previo en el libro cuenta contra el tope total',async()=>{
  const dir=tmp();const l=createLedger({dir,capTotalUsd:30,capBatchUsd:30,batchId:'old'});l.record({task:'x',kind:'chat',usd:29.999});
  const r=await runCohort(common(dir,{convs:mk(3),client:stubClient(),capTotalUsd0:30,capBatchUsd0:30,batchId:'new'}));
  assert.match(r.receipt.abort,/tope total/);
});
test('runner: salida con referencias inválidas del modelo cuenta como fallo y no se persiste como ok',async()=>{
  const dir=tmp();
  const r=await runCohort(common(dir,{convs:mk(5),client:stubClient({mutate:()=>({issues:[{category:'Envío: No recibido',severity:'low',evidence:['m7']}],sentiment:'neutral',intent:'question',urgency:'normal',entities:[],abstention:null})}),concurrency:1,batchId:'i'}));
  assert.equal(r.receipt.ok,0);assert.match(r.receipt.abort,/fallos consecutivos/);assert.equal(r.receipt.fallos_por_causa.invalid_reference,3);
});
test('runner: conversaciones automáticas o sin cliente se omiten sin llamar a la API',async()=>{
  const dir=tmp(),c=stubClient();
  const convs=[{conversation_id:'a',messages:[{id:'1',role:'customer',text:'Este es un mensaje automático. No responda a este correo.',at:'1'}]},{conversation_id:'b',messages:[{id:'2',role:'agent',text:'Hola',at:'1'}]}];
  const r=await runCohort(common(dir,{convs,client:c,batchId:'s'}));
  assert.equal(c.calls.length,0);assert.deepEqual(r.receipt.omitidas_por_regla,{automatica:1,sin_texto_cliente:1});
});
test('runner: el recibo y los resultados no contienen texto, llaves ni correos',async()=>{
  const dir=tmp();
  const convs=[{conversation_id:'z',messages:[{id:'1',role:'customer',text:'Soy ana@correo.com y mi tarjeta 4111111111111111 falló, pedido DT-1',at:'1'}]}];
  await runCohort(common(dir,{convs,client:stubClient(),batchId:'r'}));
  for(const f of fs.readdirSync(dir)){const t=fs.readFileSync(path.join(dir,f),'utf8');assert.doesNotMatch(t,/ana@correo|4111111111111111|sk-or|Bearer/);}
});
test('taskKey: estable por conversación+contenido+configuración; cambia si cambia el texto o la configuración',()=>{
  const cfg=configHash({model:'m',provider:'azure',taxonomy:TAX});
  assert.equal(taskKeyFor(cfg,'c','h'),taskKeyFor(cfg,'c','h'));
  assert.notEqual(taskKeyFor(cfg,'c','h'),taskKeyFor(cfg,'c','h2'));
  assert.notEqual(taskKeyFor(cfg,'c','h'),taskKeyFor(configHash({model:'m',provider:'azure',taxonomy:[...TAX,'Otra']}),'c','h'));
});
test('piloto: selección determinista e independiente del orden',()=>{
  const a=mk(50),b=[...a].reverse();
  assert.deepEqual(pickPilot(a,10).map(c=>c.conversation_id),pickPilot(b,10).map(c=>c.conversation_id));
});
test('cliente: la llave nunca aparece en errores y se lee del archivo, no de argumentos',async()=>{
  const dir=tmp(),f=path.join(dir,'.env');fs.writeFileSync(f,'OPENROUTER_API_KEY=sk-or-v1-SECRETSECRETSECRET\n');
  let seen;const cl=createClient({envFile:f,rps:1000,fetchImpl:async(u,o)=>{seen=o.headers.Authorization;throw Error('boom sk-or-v1-SECRETSECRETSECRET');}});
  const r=await cl.post('/chat/completions',{a:1});
  assert.equal(seen,'Bearer sk-or-v1-SECRETSECRETSECRET');assert.doesNotMatch(JSON.stringify(r),/SECRET/);
});
test('proyección --dry-count: sin red, escala con conversaciones y cabe en el tope',()=>{
  const p=projectCost({conversations:14000,chars_mean:2600,chars_p50:1500,msgs_mean:3.2,msgs_p50:3});
  assert.ok(p.escenarios.base.total_tibio_con_margen<p.escenarios.base.total_frio_con_margen);
  assert.ok(p.escenarios.pesimista.total_frio_con_margen<30,JSON.stringify(p.escenarios));
  assert.ok(p.escenarios.base.total_batch_estimado<p.escenarios.base.total_tibio_con_margen);
});
test('SQL: solo lectura, ventana parametrizable por primer/último mensaje, entradas validadas',()=>{
  const o={from:'2026-07-01',to:'2026-11-01',basis:'last'};
  for(const f of['seleccionConteos','estadisticas','verificacion','exportarPagina']){
    const q=SQL[f](o);assert.doesNotMatch(q.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n'),SQL.WRITE_WORDS,f);
    assert.match(q,/mm\.last_at >= p\.lo and mm\.last_at < p\.hi/);assert.match(q,new RegExp(SQL.TENANT));
  }
  assert.match(SQL.seleccionConteos({...o,basis:'first'}),/mm\.first_at >= p\.lo/);
  assert.throws(()=>SQL.seleccionConteos({...o,from:'2026-7-1'}));assert.throws(()=>SQL.seleccionConteos({...o,basis:"x'; drop"}));
  assert.throws(()=>SQL.exportarPagina(o,{after:"x'; drop table"}));
});
test('exportar: agrupa filas por conversación, redacta y descarta rol discordante',()=>{
  const rows=[{conversation_id:'c1',message_id:'m1',revision_id:'r1',role:'customer',at:'2026-08-01',text:'Mi mail a@b.com',payload_role:'customer'},{conversation_id:'c1',message_id:'m2',revision_id:'r2',role:'agent',at:'2026-08-02',text:'hola',payload_role:'customer'}];
  const g=groupRows(rows);assert.equal(g.length,1);assert.equal(g[0].messages.length,1);assert.doesNotMatch(g[0].messages[0].text,/a@b/);
  assert.equal(parseRows(JSON.stringify({rows:[1]})).length,1);assert.equal(parseRows('[1,2]').length,2);assert.throws(()=>parseRows('x'));
});
test('puntuación de fixtures: la regla de automáticas y los falsos positivos en negativas se cuentan',()=>{
  const fx=[{id:'a',truth:[['Otros: Notificación automática',[0]]]},{id:'b',truth:[]},{id:'c',truth:[['Pago: Cobro duplicado',[0]]]}];
  const recs=[{conversation_id:'a',status:'skipped'},{conversation_id:'b',status:'ok',issues:[{category:'X',evidence:[{message_id:'b-m0'}]}]},{conversation_id:'c',status:'ok',issues:[{category:'Pago: Cobro duplicado',evidence:[{message_id:'c-m0'}]}]}];
  const s=scoreFixtures(fx,recs);assert.equal(s.tp,2);assert.equal(s.fp,1);assert.equal(s.neg_fp_cases,1);assert.equal(s.support_ok,1);
});
import {clusterRows} from './cluster.mjs';
test('clustering: vectores cercanos se agrupan, lejanos abren problema, determinista y sin texto',()=>{
  const mkv=(a,b)=>{const v=new Float32Array(1536);v[0]=a;v[1]=b;return Buffer.from(v.buffer).toString('base64');};
  const rows=[{message_id:'a',conversation_id:'c1',label:'X',severity:'high',vec_f32_b64:mkv(1,0.01)},{message_id:'b',conversation_id:'c2',label:'X',severity:'low',vec_f32_b64:mkv(1,0.02)},{message_id:'c',conversation_id:'c3',label:'Y',severity:'low',vec_f32_b64:mkv(0,1)}];
  const P=clusterRows(rows,{threshold:0.05});assert.equal(P.length,2);assert.equal(P[0].members,2);assert.equal(P[1].outlier,true);
  assert.deepEqual(clusterRows([...rows].reverse(),{threshold:0.05}),P);
});
import {buildPersistence,persistenceSql,onlyAllowedStatements,derivedId} from './persistir.mjs';
import {sha256} from '../intelligence/index.mjs';
test('persistencia: resultado del runner -> filas coherentes con el lector de evidencia de producción; solo INSERT; idempotente',async()=>{
  const dir=tmp();
  const convs=[{conversation_id:'11111111-1111-4111-8111-111111111111',messages:[
    {id:'aaaaaaaa-0000-4000-8000-000000000001',revision_id:'bbbbbbbb-0000-4000-8000-000000000001',role:'customer',text:'Mi pedido DT-48213 no ha llegado y escribí a x@y.com\n\n--\nFirma',at:'1'},
    {id:'aaaaaaaa-0000-4000-8000-000000000002',revision_id:'bbbbbbbb-0000-4000-8000-000000000002',role:'agent',text:'Lo reviso hoy.',at:'2'}]}];
  const mutate=()=>({issues:[{category:'Envío: No recibido',severity:'high',evidence:['m0']}],sentiment:'negative',intent:'complaint',urgency:'normal',entities:[{type:'order_mention',value:'DT-48213',evidence:['m0']}],abstention:null});
  await runCohort(common(dir,{convs,client:stubClient({mutate}),batchId:'p',embed:false}));
  const rec=fs.readFileSync(path.join(dir,'resultados.jsonl'),'utf8').split('\n').filter(Boolean).map(JSON.parse)[0];
  const p=buildPersistence({conv:convs[0],rec,taxonomy:TAX,boilerplate:null});
  // la cadena de hashes que verifica evidence-repository.mjs
  const revs=p.revs.map(r=>({tenant_id:SQL.TENANT,message_revision_id:r.message_revision_id,role:r.role,text:r.text}));
  assert.equal(p.inputHash,sha256(JSON.stringify({revisions:revs,policyHash:p.policyHash,taxonomy:TAX})));
  assert.equal(p.manifest[0].hash,sha256(revs[0].text));assert.equal(p.revs[0].message_revision_id,derivedId('bbbbbbbb-0000-4000-8000-000000000001',p.policyHash));
  assert.doesNotMatch(revs[0].text,/x@y\.com|Firma/);
  const sql=persistenceSql([p],{commit:false});
  assert.ok(onlyAllowedStatements(sql));assert.match(sql,/rollback;$/);assert.doesNotMatch(sql,/\b(update|delete|drop|truncate|alter)\b/i);
  assert.equal(persistenceSql([p],{commit:true}).endsWith('commit;'),true);
  assert.equal(persistenceSql([p]),persistenceSql([p])); // determinista
  assert.match(sql,/on conflict \(id\) do nothing/);assert.match(sql,/not exists \(select 1 from public\.extraction_runs/);
  // si cambia el texto de entrada, la persistencia se rehúsa
  const changed=structuredClone(convs[0]);changed.messages[0].text='Cambio '+changed.messages[0].text;
  assert.throws(()=>buildPersistence({conv:changed,rec,taxonomy:TAX,boilerplate:null}),/task_key no coincide/);
  // evidencia alterada no pasa
  const tampered=structuredClone(rec);tampered.issues[0].evidence[0].quote_hash='0'.repeat(64);
  assert.throws(()=>buildPersistence({conv:convs[0],rec:tampered,taxonomy:TAX,boilerplate:null}),/quote_hash/);
});
import {extractTaxonomy} from './exportar.mjs';
test('taxonomía: SQL de solo lectura y parser estricto',()=>{
  assert.doesNotMatch(SQL.taxonomia().split('\n').filter(l=>!l.startsWith('--')).join('\n'),SQL.WRITE_WORDS);
  assert.deepEqual(extractTaxonomy(JSON.stringify({rows:[{taxonomy:['a','b']}]})),['a','b']);
  assert.throws(()=>extractTaxonomy(JSON.stringify({rows:[{taxonomy:['a','a']}]})));assert.throws(()=>extractTaxonomy('[]'));
});
import {pilotReport} from './informe-piloto.mjs';
test('informe de piloto: tasas y proyección sin contenido',()=>{
  const recs=[{batch:'p',conversation_id:'a',status:'ok',cost_usd:0.001,issues:[{category:'X',severity:'high'}],entities:[],usage:{prompt:100,cached:90}},{batch:'p',conversation_id:'b',status:'abstained',cost_usd:0.0005,issues:[],entities:[],usage:{prompt:100,cached:90}},{batch:'p',conversation_id:'c',status:'skipped'},{batch:'p',conversation_id:'d',status:'failed',reason:'json_invalido',cost_usd:0.0005}];
  const r=pilotReport(recs,{batch:'p',total:1000});assert.equal(r.enviadas,3);assert.equal(r.tasa_validez,0.6667);assert.equal(r.proyeccion_total_usd.conversaciones,1000);assert.deepEqual(r.categorias_top,[['X',1]]);
  assert.doesNotMatch(JSON.stringify(r),/text|quote/);
});

// ---- exportación csv desde Storage (sintético)
import {resolveCsv,createStorageGet,sweepTemp,installCleanup,TEMP_NAMES} from './exportar-csv.mjs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {contentHash} from '../intelligence/../ingestion/index.mjs';
const U=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function csvFixture(){
  const rows=[['id','text','date','role','conversation'],['1','Mi pedido 123456789012 no llegó, escribo a ana@correo.com','2026-08-01T10:00:00Z','customer','c1'],['2','Lo reviso hoy','2026-08-01T11:00:00Z','agent','c1'],['3','','2026-08-01T12:00:00Z','customer','c1'],['4','Quiero cancelar','2026-08-02T10:00:00Z','customer','c2']];
  const bytes=new TextEncoder().encode(rows.map(r=>r.map(x=>/[,"]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x).join(',')).join('\n')+'\n');
  return{bytes,file_hash:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
}
const payloadOf=(id,text,date,role,conv)=>({external_id:id,text,occurred_at:new Date(date).toISOString(),role,conversation_id:conv,customer_id:null,order_id:null,sku:null,source_cells:[id,text,date,role,conv],source_headers:['id','text','date','role','conversation']});
function world({breakHash=false,missing=false}={}){
  const f=csvFixture(),imp=U(900),tenant=SQL.TENANT;
  const h=(id,text,date,role,conv)=>contentHash(payloadOf(id,text,date,role,conv));
  const mrows=[
    {conversation_id:U(1),source:'csv',message_id:U(11),revision_id:U(21),role:'customer',at:'2026-08-01T10:00:00Z',rev_hash:breakHash?'0'.repeat(64):h('1','Mi pedido 123456789012 no llegó, escribo a ana@correo.com','2026-08-01T10:00:00Z','customer','c1'),import_id:imp,row_ref:'2'},
    {conversation_id:U(1),source:'csv',message_id:U(12),revision_id:U(22),role:'agent',at:'2026-08-01T11:00:00Z',rev_hash:h('2','Lo reviso hoy','2026-08-01T11:00:00Z','agent','c1'),import_id:imp,row_ref:'3'},
    {conversation_id:U(1),source:'csv',message_id:U(13),revision_id:U(23),role:'customer',at:'2026-08-01T12:00:00Z',rev_hash:h('3','','2026-08-01T12:00:00Z','customer','c1'),import_id:imp,row_ref:'4'},
    {conversation_id:U(2),source:'csv',message_id:U(14),revision_id:U(24),role:'customer',at:'2026-08-02T10:00:00Z',rev_hash:h('4','Quiero cancelar','2026-08-02T10:00:00Z','customer','c2'),import_id:imp,row_ref:'5'},
    {conversation_id:U(3),source:'csv',message_id:U(15),revision_id:U(25),role:'customer',at:'2026-08-03T10:00:00Z',rev_hash:'a'.repeat(64),import_id:null,row_ref:null}, // sin payload
  ];
  let pages=0;const sqls=[];
  const runSql=async sql=>{sqls.push(sql);
    if(sql.includes('Metadatos (sin texto) de mensajes')){return pages++===0?[...mrows,{conversation_id:U(3),sentinel:true}]:[];}
    if(sql.includes('Metadatos de imports'))return[{import_id:imp,object_path:`${tenant}/imports/${imp}/a.csv`,file_hash:f.file_hash,mapping_version:'legacy',provenance:{},tenant_id:tenant,connection_id:U(5),created_at:'2026-08-01T00:00:00Z',size:f.size,content_type:'text/csv',source:'csv',account_id:'acc'}];
    throw Error('sql inesperado');};
  return{f,runSql,sqls,storageGet:async()=>missing?null:f.bytes};
}
const win={from:'2026-07-01',to:'2026-11-01',basis:'first'};
test('csv: resuelve texto desde el archivo importado, valida hash, redacta, cuenta y deja fuera lo no resoluble',async()=>{
  const w=world();
  const {convs,report}=await resolveCsv({runSql:w.runSql,storageGet:w.storageGet,win});
  assert.equal(convs.length,2);
  const c1=convs.find(c=>c.conversation_id===U(1));assert.equal(c1.messages.length,2); // el mensaje vacío se descarta
  assert.doesNotMatch(JSON.stringify(convs),/123456789012|ana@correo/);assert.match(c1.messages[0].text,/Mi pedido \[PII\] no llegó/);
  assert.equal(c1.messages[0].revision_id,U(21)); // necesario para persistir
  assert.deepEqual(report.conversaciones,{total:3,resueltas:2,no_resueltas:1});assert.equal(report.no_resueltas_por_causa.sin_payload,1);
  assert.equal(report.mensajes.vacios,1);assert.equal(report.mensajes.sin_payload,1);assert.equal(report.imports.descargados,1);
  assert.equal(report.estadisticas_medidas.conversations,2);
  for(const q of w.sqls)assert.doesNotMatch(q.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n'),SQL.WRITE_WORDS);
  assert.doesNotMatch(JSON.stringify(report),/Mi pedido|Quiero cancelar/);
});
test('csv: hash distinto, objeto ausente y archivo alterado dejan la conversación fuera sin fallar',async()=>{
  let w=world({breakHash:true});let r=await resolveCsv({runSql:w.runSql,storageGet:w.storageGet,win});
  assert.equal(r.report.no_resueltas_por_causa.hash_distinto,1);assert.equal(r.convs.length,1);
  w=world({missing:true});r=await resolveCsv({runSql:w.runSql,storageGet:w.storageGet,win});
  assert.equal(r.convs.length,0);assert.equal(r.report.imports.ausentes,1);assert.equal(r.report.no_resueltas_por_causa.objeto_ausente,2);
  w=world();r=await resolveCsv({runSql:w.runSql,storageGet:async()=>new TextEncoder().encode('x'+Buffer.from(w.f.bytes).toString()),win});
  assert.equal(r.report.no_resueltas_por_causa.hash_archivo,2);
  w=world();r=await resolveCsv({runSql:w.runSql,storageGet:async()=>{throw Error('red caída');},win});assert.equal(r.report.no_resueltas_por_causa.error_descarga,2);
});
test('csv: SIN caché en disco: durante toda la resolución no se escribe ningún archivo y la memoria es de un objeto a la vez',async()=>{
  const w=world();const calls=[];const orig={w:fs.writeFileSync,a:fs.appendFileSync,m:fs.mkdirSync,ws:fs.createWriteStream};
  for(const k of['writeFileSync','appendFileSync','mkdirSync','createWriteStream'])fs[k]=(...x)=>{calls.push(k);return orig[{writeFileSync:'w',appendFileSync:'a',mkdirSync:'m',createWriteStream:'ws'}[k]](...x);};
  let r;try{r=await resolveCsv({runSql:w.runSql,storageGet:w.storageGet,win});}finally{fs.writeFileSync=orig.w;fs.appendFileSync=orig.a;fs.mkdirSync=orig.m;fs.createWriteStream=orig.ws;}
  assert.deepEqual(calls,[]);assert.equal(r.report.imports.memoria_pico_bytes,w.f.size);
});
test('csv: Ctrl+C/SIGTERM barren temporales y el barrido inicial elimina restos; ningún temporal contiene texto',()=>{
  const dir=tmp();const mkTemp=()=>{for(const n of TEMP_NAMES){fs.mkdirSync(path.join(dir,n),{recursive:true});fs.rmSync(path.join(dir,n),{recursive:true,force:true});}fs.writeFileSync(path.join(dir,'.q.sql'),'select 1');fs.writeFileSync(path.join(dir,'.page.sql'),'select 2');fs.mkdirSync(path.join(dir,'.cache-storage'));fs.writeFileSync(path.join(dir,'.cache-storage','x.bin'),'resto');};
  mkTemp();sweepTemp(dir);assert.deepEqual(fs.readdirSync(dir),[]);
  for(const sig of['SIGINT','SIGTERM']){mkTemp();let code=null;const un=installCleanup(dir,{exit:c=>{code=c;}});process.emit(sig);un();assert.deepEqual(fs.readdirSync(dir),[]);assert.equal(code,sig==='SIGINT'?130:143);}
});
test('storage: solo GET, host verificado contra el proyecto, ruta confinada al tenant, llave nunca expuesta',async()=>{
  const dir=tmp(),f=path.join(dir,'.env');const KEY='sbKEYSECRET1234567890';
  fs.writeFileSync(f,`SUPABASE_URL=https://${SQL.PROJECT_REF}.supabase.co\nSUPABASE_SERVICE_KEY=${KEY}\n`);
  let seen;const get=createStorageGet({envFile:f,fetchImpl:async(u,o)=>{seen={u,o};return new Response(new Uint8Array([1,2,3]),{status:200});}});
  const b=await get(`${SQL.TENANT}/imports/x/a b.csv`);assert.deepEqual([...b],[1,2,3]);assert.equal(seen.o.method,'GET');assert.match(seen.u,/vexa-private\/ab12cd34.*a%20b\.csv$/);
  await assert.rejects(()=>get('otro-tenant/imports/x/a.csv'));await assert.rejects(()=>get(`${SQL.TENANT}/imports/../../x`));
  const nf=createStorageGet({envFile:f,fetchImpl:async()=>new Response('{"error":"x"}',{status:404})});assert.equal(await nf(`${SQL.TENANT}/imports/x/a.csv`),null);
  const err=createStorageGet({envFile:f,fetchImpl:async()=>new Response(KEY,{status:500})});await assert.rejects(()=>err(`${SQL.TENANT}/imports/x/a.csv`),e=>!e.message.includes(KEY));
  fs.writeFileSync(f,`SUPABASE_URL=https://otroproyecto.supabase.co\nSUPABASE_SERVICE_KEY=${KEY}\n`);
  assert.throws(()=>createStorageGet({envFile:f}),e=>/host/.test(e.message)&&!e.message.includes('otroproyecto')&&!e.message.includes(KEY));
});
test('SQL csv: solo lectura, left join para contar sin payload, ids de import validados',()=>{
  const q=SQL.csvMensajesPagina(win);assert.match(q,/left join public\.import_rows/);assert.match(q,/source not in \('hubspot','zendesk'\)/);
  assert.throws(()=>SQL.importsMeta(["x'; drop"]));assert.throws(()=>SQL.importsMeta([]));
  assert.match(SQL.seleccionConteos(win),/imports_de_storage_necesarios/);
});
test('proyección por fuente suma conversaciones reales de la cohorte (12,002)',()=>{
  const st=n=>({conversations:n,chars_mean:2571,chars_p50:1400,msgs_mean:2.5,msgs_p50:2});
  const p=projectCost({por_fuente:{hubspot:st(2035),csv:st(9967)}});const q=projectCost(st(12002));
  assert.equal(p.conversations,12002);assert.ok(Math.abs(p.escenarios.base.total_tibio_con_margen-q.escenarios.base.total_tibio_con_margen)<0.02);
});

// ---- Persistencia contra Postgres local con las migraciones reales (0001-0044)
import {pgAvailable,withLocalPg,SEED_SQL} from './test-pg.mjs';
const PG={tenant:SQL.TENANT,conn:U(5),conv:U(1),msgs:[{id:U(11),rev:U(21),srev:U(31),role:'customer'},{id:U(12),rev:U(22),srev:U(32),role:'agent'}]};
async function pgPersistFixture(statusOverride=null){
  const dir=tmp();
  const convs=[{conversation_id:U(1),messages:[{id:U(11),revision_id:U(21),role:'customer',text:'Mi pedido DT-48213 no ha llegado',at:'1'},{id:U(12),revision_id:U(22),role:'agent',text:'Lo reviso hoy.',at:'2'}]}];
  const mutate=()=>statusOverride==='abstained'?{issues:[],sentiment:'unknown',intent:'unknown',urgency:'unknown',entities:[],abstention:{reason:'insufficient_evidence'}}
    :{issues:[{category:'Envío: No recibido',severity:'high',evidence:['m0']}],sentiment:'negative',intent:'complaint',urgency:'normal',entities:[{type:'order_mention',value:'DT-48213',evidence:['m0']}],abstention:null};
  await runCohort(common(dir,{convs,client:stubClient({mutate}),batchId:'pg',embed:false}));
  const rec=fs.readFileSync(path.join(dir,'resultados.jsonl'),'utf8').split('\n').filter(Boolean).map(JSON.parse).at(-1);
  return{convs,rec,p:buildPersistence({conv:convs[0],rec,taxonomy:TAX,boilerplate:null})};
}
test('persistencia: el estado que se inserta cumple el CHECK real de extraction_runs (ok->succeeded, abstención->abstained)',async()=>{
  const {p}=await pgPersistFixture();assert.equal(p.status,'succeeded');
  assert.equal((await pgPersistFixture('abstained')).p.status,'abstained');
});
test('persistencia en Postgres local con migraciones reales: inserta, es idempotente y respeta corridas oficiales',{skip:!pgAvailable()&&'sin postgres local',timeout:120000},async()=>{
  const {p}=await pgPersistFixture();
  await withLocalPg(async({psql,sock})=>{
    for(const s of SEED_SQL(PG).split(/;\n/).filter(x=>x.trim()))assert.ok(psql(s).ok);
    const sql=persistenceSql([p],{commit:true});
    const run=()=>{const r=spawnSync('psql',['-h',sock,'-U','postgres','-d','t','-q','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8'});return r;};
    const r1=run();assert.equal(r1.status,0,r1.stderr);
    const cnt=t=>+psql(`select count(*) from public.${t}`).out;
    assert.equal(psql("select status from public.extraction_runs").out,'succeeded');
    assert.deepEqual([cnt('extraction_runs'),cnt('issues'),cnt('evidence_spans'),cnt('redaction_maps'),cnt('message_revisions')],[1,1,1,2,4]);
    assert.equal(run().status,0);assert.deepEqual([cnt('extraction_runs'),cnt('issues'),cnt('evidence_spans')],[1,1,1]); // idempotente
  });
});
test('persistencia en Postgres local: no duplica conversaciones que ya tienen extracción oficial; SQL previa de conteo es de solo lectura',{skip:!pgAvailable()&&'sin postgres local',timeout:120000},async()=>{
  assert.doesNotMatch(SQL.corridasPrevias(win).split('\n').filter(l=>!l.startsWith('--')).join('\n'),SQL.WRITE_WORDS);
  const {p}=await pgPersistFixture();
  await withLocalPg(async({psql,sock})=>{
    for(const s of SEED_SQL(PG).split(/;\n/).filter(x=>x.trim()))assert.ok(psql(s).ok);
    const official=U(777);
    assert.ok(psql(`insert into public.extraction_runs(id,tenant_id,model_id,prompt_hash,schema_hash,input_hash,status,conversation_id) values('${official}','${SQL.TENANT}','m','p','s','h','succeeded','${U(1)}')`).ok);
    const r=spawnSync('psql',['-h',sock,'-U','postgres','-d','t','-q','-v','ON_ERROR_STOP=1','-c',persistenceSql([p],{commit:true})],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
    assert.equal(+psql('select count(*) from public.extraction_runs').out,1); // solo la oficial
    assert.equal(+psql('select count(*) from public.issues').out,0);assert.equal(+psql('select count(*) from public.message_revisions').out,2);assert.equal(+psql('select count(*) from public.redaction_maps').out,0); // nada huérfano
  });
});
test('duplicados: el mismo archivo importado dos veces no genera el mismo mensaje dos veces (SQL y JS), y se cuenta',async()=>{
  assert.match(SQL.csvMensajesPagina(win),/row_number\(\) over \(partition by m\.id/);assert.match(SQL.csvMensajesPagina(win),/where rn=1/);
  assert.match(SQL.exportarPagina(win),/row_number\(\) over \(partition by m\.id/);assert.match(SQL.exportarPagina(win),/where rn=1/);
  const w=world();const dupRows=[];let pg=0;
  const runSql=async sql=>{if(sql.includes('Metadatos (sin texto)')){if(pg++>0)return[];const rows=await w.runSql(sql);return[...rows.filter(r=>!r.sentinel),...rows.filter(r=>r.message_id===U(11)).map(r=>({...r,n_rows:2})),{conversation_id:U(3),sentinel:true}];}return w.runSql(sql);};
  const r=await resolveCsv({runSql,storageGet:w.storageGet,win});
  const ids=r.convs.flatMap(c=>c.messages.map(m=>m.id));assert.equal(new Set(ids).size,ids.length);assert.equal(r.report.duplicados.filas_repetidas_descartadas,1);
  const st={};const g=groupRows([{conversation_id:'c',message_id:'m',revision_id:'r',role:'customer',at:'1',text:'hola',n_rows:2},{conversation_id:'c',message_id:'m',revision_id:'r',role:'customer',at:'1',text:'hola',n_rows:2}],{stats:st});
  assert.equal(g[0].messages.length,1);assert.equal(st.duplicados,1);
});
test('duplicados en Postgres local: dos import_rows para el mismo mensaje producen UNA fila',{skip:!pgAvailable()&&'sin postgres local',timeout:120000},async()=>{
  await withLocalPg(async({psql})=>{
    for(const s of SEED_SQL(PG).split(/;\n/).filter(x=>x.trim()))assert.ok(psql(s).ok);
    // dos imports distintos con el mismo payload_ref (mismo archivo importado dos veces)
    for(const [i,imp] of [[1,U(901)],[2,U(902)]]){
      assert.ok(psql(`insert into public.imports(id,tenant_id,file_hash,mapping_version,idempotency_key,connection_id) values('${imp}','${SQL.TENANT}','${'d'.repeat(64)}','legacy','k${i}','${PG.conn}')`).ok);
      assert.ok(psql(`insert into public.import_rows(tenant_id,import_id,row_ref,payload_ref) values('${SQL.TENANT}','${imp}','2','import:i:row:0')`).ok);}
    const q=SQL.csvMensajesPagina({from:'2000-01-01',to:'2100-01-01',basis:'first'},{limit:10});
    const out=psql(q.replace(/--[^\n]*\n/g,'\n').replace(/;\s*$/,'').replace(/^/,'copy (').concat(') to stdout')); // copy para contar filas
    const rows=out.out.split('\n').filter(l=>l&&!/\tt$/.test(l));
    assert.equal(rows.filter(l=>l.includes(U(11))).length,1,out.err+out.out);
  });
});
test('todas las consultas SQL generadas se ejecutan sin error sobre el esquema real (Postgres local)',{skip:!pgAvailable()&&'sin postgres local',timeout:120000},async()=>{
  await withLocalPg(async({psql})=>{
    for(const s of SEED_SQL(PG).split(/;\n/).filter(x=>x.trim()))assert.ok(psql(s).ok);
    const w={from:'2000-01-01',to:'2100-01-01',basis:'first'};
    for(const [n,q] of Object.entries({conteos:SQL.seleccionConteos(w),estadisticas:SQL.estadisticas(w),verificacion:SQL.verificacion(w),previas:SQL.corridasPrevias(w),hubspot:SQL.exportarPagina(w),csv:SQL.csvMensajesPagina(w),imports:SQL.importsMeta([U(901)]),taxonomia:SQL.taxonomia(),last:SQL.seleccionConteos({...w,basis:'last'})})){
      const r=psql(q.replace(/;\s*$/,'')+';');assert.ok(r.ok,n+': '+r.err.slice(0,200));}
  });
});

// ---- Redacción adversarial (casos del revisor independiente) y ReDoS
const MUST_REDACT=[
['tel:5512345678x',['5512345678']],['٥٥١٢٣٤٥٦٧٨',['٥٥١٢٣٤٥٦٧٨','٥٥']],['５５１２３４５６７８',['５５１２','5512']],['55–1234–5678',['1234–5678','1234-5678']],['55 1234 5678',['1234']],['55/1234/5678',['1234/5678']],
['+52 1 55 1234 5678',['1234 5678']],['(55) 1234-5678',['1234-5678']],['https://wa.me/525512345678',['525512345678']],['cel5512345678',['5512345678']],
['juan (arroba) gmail punto com',['juan','gmail']],['juan[at]gmail.com',['juan','gmail']],['juan @ gmail.com',['juan','gmail']],['mailto:ventas@acme.com?subject=hola',['acme']],['josé.pérez@correo.mx',['pérez']],
['PEPJ800101HDFRRN09',['PEPJ8001']],['PEPJ800101AB1',['PEPJ8001']],['ABC010101XYZ',['ABC0101']],['mi RFC pepj800101ab1 gracias',['pepj8001']],
['1Z999AA10123456784',['1Z999','10123456784']],['794644790138',['7946']],['1,234,567,890',['234,567']],['123 456 789',['456']],['123-45-6789',['45-6789']],['123.456.789',['456.789']],
['4111 1111 1111 1111',['1111']],['4111-1111-1111-1111',['1111']],['3782 822463 10005',['822463','10005']],['4111  1111  1111  1111',['1111']],['4111.1111.1111.1111',['1111']],['012 180 00123456789 7',['00123456789','180']],['012180001234567897',['0121800']],
['ORD-123456789012',['123456789012']],['pedido#1234567890',['1234567890']],['folio A12345678B',['12345678']],['ES9121000418450200051332',['0418']],['imei 356938035643809',['3569380']],['521551234567@s.whatsapp.net',['521551234567']],
['https://app.x.com/reset?token=abc123DEF456ghi789&user=42',['abc123']],['https://api.x.com/v1?api_key=sk_live_51HxYzAbCdEfGh',['sk_live']],['Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc',['eyJhbGci']],['mi contraseña es Hunter2!',['Hunter2']],['api_key=abcd1234efgh',['abcd1234']],
['mi ip 189.203.45.12',['189.203.45']],['55 1234 5678 ext. 123',['1234 5678']],
];
test('redacción adversarial: ningún fragmento sensible sobrevive (RFC/CURP, tokens, URLs, teléfonos raros, emails ofuscados, tarjetas/CLABE con separadores, guías)',()=>{
  const leaks=[];for(const [t,must] of MUST_REDACT){const o=redact(t);for(const m of must)if(o.includes(m))leaks.push([t,o]);}
  assert.deepEqual(leaks,[]);
});
test('redacción: texto normal, fechas y códigos de producto no se destruyen',()=>{
  const ok='Pedido DT-48213 del taladro X20 modelo DCD771C2, 2 piezas, 3 cajas el 20 de octubre. Total $1,299.00 y 12/10/2026 10:30';
  assert.equal(redact(ok),ok);
});
test('redacción: riesgo residual documentado (nombres, direcciones, CP, fecha de nacimiento, números en palabras, 6 dígitos) NO se redacta',()=>{
  for(const t of['Hola soy Juan Carlos Pérez Gómez','CP 97000','Calle Reforma 123, Col. Roma Norte','nací el 01/01/1980','12 34 56'])assert.equal(redact(t),t);
});
test('redacción conserva el invariante de offsets: el texto enviado es prefijo del redactado normalizado',()=>{
  const raw='Mi cel ５５１２３４５６７８ y juan[at]gmail.com, falla la batería.\n\n--\nFirma';
  const p=prepareConversation({conversation_id:'c',messages:[{id:'m',role:'customer',text:raw,at:'1'}]});
  assert.ok(redact(raw).startsWith(p.revisions[0].text));assert.doesNotMatch(p.revisions[0].text,/5512|gmail|５５/);
});
test('ReDoS: 100k caracteres adversariales en < 1 s por mensaje (prepareConversation y funciones de corte)',()=>{
  const T={espacios:' '.repeat(99990)+'x',El:'El abc '.repeat(14000),digitos:'1 '.repeat(50000),guiones:'-'.repeat(100000),saltos:'\n \n'.repeat(33000)+'hola',under:'_'.repeat(99999)+'x',arrobas:'a@'.repeat(50000),mix:('De: x\n'+'Enviado: ').repeat(10000),alnum:'a1'.repeat(50000),puntos:'1.'.repeat(50000),parens:'('.repeat(100000),url:'http://'+'a'.repeat(100000),email:'a'.repeat(100000)+'@',arroba:'a (arroba) '.repeat(9000),key:'password '.repeat(11000),comas:'1,'.repeat(50000)};
  for(const [k,t] of Object.entries(T)){
    let t0=performance.now();prepareConversation({conversation_id:'c',messages:[{id:'1',role:'customer',text:t+' pedido',at:'1'}]});assert.ok(performance.now()-t0<1000,k+' prepare');
    for(const [n,f] of [['cutQuoted',()=>cutQuoted(t)],['cutSignature',()=>cutSignature(t,null)],['isAutomatic',()=>isAutomatic(t)]]){t0=performance.now();f();assert.ok(performance.now()-t0<1000,k+' '+n);}
  }
});

// ---- Costos (hallazgos del revisor)
import {bookedCost,ALLOWED_MODELS,HARD_CAP_USD} from './cohorte.mjs';
test('costo: negativo, no finito, NaN, string inválido o ausente se cobran al TECHO; 4xx/429 sin costo no cobran; timeouts (status 0) y 5xx cobran techo',()=>{
  for(const bad of[-1,NaN,Infinity,'abc',null,undefined,{}, '-1'])assert.equal(bookedCost(bad,200,0.002),0.002,String(bad));
  assert.equal(bookedCost('0.0004',200,0.002),0.0004);assert.equal(bookedCost(0.0004,200,0.002),0.0004);assert.equal(bookedCost(0,200,0.002),0);
  assert.equal(bookedCost(undefined,0,0.002),0.002);assert.equal(bookedCost(undefined,503,0.002),0.002);assert.equal(bookedCost(undefined,429,0.002),0);assert.equal(bookedCost(undefined,401,0.002),0);
});
test('costo: el libro nunca disminuye con costo negativo y el tope total se fuerza a US$30 aunque se pase otro',async()=>{
  const dir=tmp(),neg=stubClient({cost:-1});
  const r=await runCohort(common(dir,{convs:mk(5),client:neg,concurrency:1,embed:false,batchId:'n'}));
  assert.ok(r.receipt.gasto.total_usd>0);
  const r2=await runCohort({...common(tmp(),{convs:mk(2),client:stubClient(),batchId:'cap'}),capTotalUsd0:1000,capBatchUsd0:1000});
  assert.equal(r2.receipt.gasto.cap_total_usd,HARD_CAP_USD);
  await assert.rejects(()=>runCohort({...common(tmp(),{convs:mk(1),client:stubClient()}),capTotalUsd0:NaN}));
  await assert.rejects(()=>runCohort({...common(tmp(),{convs:mk(1),client:stubClient()}),model:'openai/gpt-5'}),/modelo no permitido/);
  await assert.rejects(()=>runCohort({...common(tmp(),{convs:mk(1),client:stubClient()}),provider:'otro'}),/proveedor no permitido/);
  assert.deepEqual([...ALLOWED_MODELS],['anthropic/claude-haiku-5.5']);
});
test('costo: llamadas con timeout (status 0) cuentan al techo en el libro',async()=>{
  const dir=tmp();const c={calls:0,async post(){c.calls++;return{status:0,ms:0,json:null,err:'timeout'};}};
  const r=await runCohort(common(dir,{convs:mk(10),client:c,concurrency:1,embed:false,batchId:'t'}));
  assert.ok(r.receipt.gasto.total_usd>0);
});

// ---- Consistencia cohorte <-> persistir (pie aprendido sobre toda la entrada y congelado)
import {loadOrLearnBoilerplate} from './cohorte.mjs';
import {selectCandidates} from './persistir.mjs';
test('boilerplate: se aprende sobre TODA la entrada, se congela en archivo y piloto/persistir leen el mismo conjunto (task_key coinciden)',async()=>{
  const u=i=>`c${String(i).padStart(7,'0')}-0000-4000-8000-000000000001`;
  const C=Array.from({length:1000},(_,i)=>({conversation_id:u(i),first_at:'2026-08-01',messages:[{id:`a${String(i).padStart(7,'0')}-0000-4000-8000-000000000001`,revision_id:`b${String(i).padStart(7,'0')}-0000-4000-8000-000000000001`,role:'customer',text:`Mi pedido ${i} no llega hoy`+(i%40===0?'\nEquipo de Atención a Clientes Acme Ltda':''),at:'1'}]}));
  const dir=tmp();const frozen=loadOrLearnBoilerplate(dir,C);assert.ok(frozen.size>0);
  assert.ok(fs.existsSync(path.join(dir,'boilerplate.json')));
  assert.equal(loadOrLearnBoilerplate(dir,C.slice(0,5)).size,frozen.size); // reutiliza el congelado, no re-aprende del subconjunto
  const pilot=pickPilot(C,200);
  await runCohort(common(dir,{convs:pilot,client:stubClient(),batchId:'p',embed:false,boilerplate:frozen}));
  const recs=fs.readFileSync(path.join(dir,'resultados.jsonl'),'utf8').split('\n').filter(Boolean).map(JSON.parse);
  let bad=0;for(const r of recs){try{buildPersistence({conv:C.find(c=>c.conversation_id===r.conversation_id),rec:r,taxonomy:TAX,boilerplate:loadOrLearnBoilerplate(dir,C)});}catch{bad++;}}
  assert.equal(bad,0);
  // contraste: aprender solo del piloto SÍ produce descartes (el defecto original)
  const pilotOnly=learnBoilerplate(pilot.flatMap(c=>c.messages.map(m=>m.text)));assert.notEqual(pilotOnly.size,frozen.size);
});
test('persistir no toma registros failed/skipped, aunque sean los más recientes',()=>{
  const convs=new Map([['a',{}],['b',{}]]);
  const recs=[{conversation_id:'a',status:'ok',task_key:'k1'},{conversation_id:'a',status:'failed',task_key:'k2'},{conversation_id:'b',status:'skipped'},{conversation_id:'b',status:'failed'},{conversation_id:'z',status:'ok'}];
  const sel=selectCandidates(recs,convs);assert.deepEqual(sel.map(([c,r])=>[c,r.map(x=>x.task_key)]),[['a',['k1']]]);
});

// ---- ejecutar-cohorte.sh: confirmación interactiva; opciones numéricas estrictas
import {intOpt,moneyOpt} from './cli-util.mjs';
const SH=path.join(path.dirname(new URL(import.meta.url).pathname),'ejecutar-cohorte.sh');
function fakeNode(){const dir=tmp(),log=path.join(dir,'calls.log'),f=path.join(dir,'fake-node');fs.writeFileSync(f,`#!/bin/bash\necho "$@" >> ${log}\n`,{mode:0o755});return{f,log,dir};}
test('ejecutar-cohorte.sh: la bandera --yes-send-real-text no está fija; sin terminal o sin escribir ENVIAR no se envía nada',()=>{
  const src=fs.readFileSync(SH,'utf8');assert.equal((src.match(/--yes-send-real-text/g)||[]).length,1);assert.match(src,/CONFIRM_FLAG="--yes-send-real-text"/);
  for(const step of['piloto','resto']){
    const {f,log}=fakeNode();
    const r=spawnSync('bash',[SH,step],{encoding:'utf8',input:'ENVIAR\n',env:{...process.env,NODE:f}});
    assert.notEqual(r.status,0);assert.match(r.stdout,/No hay terminal interactiva/);assert.equal(fs.existsSync(log),false);
  }
});
const PTY_PY=`import os,pty,sys,select
ans,sh,step=sys.argv[1:4]
pid,fd=pty.fork()
if pid==0:
    os.execvp('bash',['bash',sh,step])
buf=b''
sent=False
while True:
    r,_,_=select.select([fd],[],[],20)
    if not r: break
    try: d=os.read(fd,4096)
    except OSError: break
    if not d: break
    buf+=d
    if not sent and b'confirmar:' in buf:
        os.write(fd,(ans+'\\n').encode()); sent=True
os.waitpid(pid,0)
sys.stdout.write(buf.decode(errors='replace'))`;
test('ejecutar-cohorte.sh: con terminal, una respuesta distinta de ENVIAR cancela; ENVIAR continúa y pasa la bandera',()=>{
  const run=(answer,step)=>{const {f,log}=fakeNode();const r=spawnSync('python3',['-c',PTY_PY,answer,SH,step],{encoding:'utf8',env:{...process.env,NODE:f}});return{r,log};};
  let x=run('no','piloto');assert.match(x.r.stdout,/Cancelado/);assert.equal(fs.existsSync(x.log),false);
  x=run('enviar','resto');assert.match(x.r.stdout,/Cancelado/);assert.equal(fs.existsSync(x.log),false); // minúsculas no vale
  x=run('ENVIAR','piloto');assert.match(fs.readFileSync(x.log,'utf8'),/--pilot 200.*--yes-send-real-text/);
});
test('opciones numéricas estrictas: --max y compañía exigen entero positivo; topes numéricos válidos',()=>{
  assert.equal(intOpt(['--max','5'],'max',1),5);assert.equal(intOpt([],'max',7),7);
  for(const bad of['abc','5.5','-1','0','1e3','Infinity','NaN',''])assert.throws(()=>intOpt(['--max',bad],'max',1),/entero positivo/,bad);
  assert.throws(()=>intOpt(['--max'],'max',1));assert.equal(moneyOpt(['--cap','0.5'],'cap',1),0.5);assert.throws(()=>moneyOpt(['--cap','NaN'],'cap',1));assert.throws(()=>moneyOpt(['--cap','-3'],'cap',1));
});

test('preprocesado: un mensaje con el mismo id nunca se envía dos veces',()=>{
  const m={id:'x',role:'customer',text:'Mi pedido no llegó',at:'1'};
  const p=prepareConversation({conversation_id:'c',messages:[m,{...m},{id:'y',role:'agent',text:'Lo reviso',at:'2'}]});
  assert.equal(p.revisions.length,2);assert.equal(p.stats.dup_msgs,1);
});
