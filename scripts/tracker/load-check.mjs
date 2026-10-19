// Prueba del cargador contra el esquema REAL 0001..0053 en Postgres local desechable, con libros SINTÉTICOS.
// Uso: node load-check.mjs <socket> <port> <db>
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,chmodSync,existsSync,readdirSync,readFileSync,rmSync,mkdirSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {buildXlsx} from '../../packages/ingestion/tracker/xlsx-fixture.mjs';
import {loadTracker,sha256Bytes,PROJECT_REF,Receipts} from '../../packages/ingestion/tracker/loader.mjs';
const [host,port,db]=process.argv.slice(2);
const psql=(args,user)=>spawnSync('psql',['-X','-q','-A','-t','-h',host,'-p',port,'-d',db,...(user?['-U',user]:[]),...args],{encoding:'utf8'});
const one=q=>psql(['-c',q]).stdout.trim();
const sqlCmd=['psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-h',host,'-p',port,'-d',db,'-f'];
const T=randomUUID(),C=(()=>{const h=createHash('sha256').update('c'+T).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;})();
assert.equal(psql(['-c',`insert into public.organizations(id,name) values('${T}','sintetico')`]).status,0);
const tmp=mkdtempSync(path.join(os.tmpdir(),'load-check-'));
const refOk=path.join(tmp,'ref-ok');writeFileSync(refOk,PROJECT_REF+'\n');
const refBad=path.join(tmp,'ref-bad');writeFileSync(refBad,'abcdefghijklmnopqrst\n');
const HEAD=['Requester','Hubspot ID','Request Date','Order ID','Notes'];
const mk=(extra=0,edit=false)=>[
 {name:'Tools',rows:[HEAD,...Array.from({length:520+extra},(_,i)=>{const n=i+2;return ['u'+n,String(10000000000+n),n,"O'"+n,(edit&&(n===5||n===77))?'EDITADA $j'+n:'n$j'+n];})]},
 {name:'Oculta',state:'hidden',rows:[HEAD,['a',null,1,'x','y'],['b','sin-numero',2,'x','y']]},
 {name:'Parts',rows:[HEAD,['p','12',1,'x','y'],['q',String(20000000001),3,'x','y']]}];
const b1=buildXlsx(mk()),b2=buildXlsx(mk(3,true));
writeFileSync(path.join(tmp,'v1.xlsx'),b1);writeFileSync(path.join(tmp,'v2.xlsx'),b2);
const versions=[{key:'t1',rank:1,file:'v1.xlsx',sha256:sha256Bytes(b1),received_at:null},{key:'t2',rank:2,file:'v2.xlsx',sha256:sha256Bytes(b2),received_at:'2026-10-05T23:20:14Z'}];
const index=new Set(Array.from({length:520+3},(_,i)=>String(10000000000+i+2)).filter((_,i)=>i%2===0));
const base=(extra={})=>({root:tmp,tenant:T,connectionId:C,versions,ticketIndex:index,ticketIndexSha:'a'.repeat(64),sqlCmd,projectRefFile:refOk,workBase:tmp,...extra});
const err=async(fn)=>{try{await fn();}catch(e){return e;}return null;};
const R=n=>path.join(tmp,'rec-'+n);

// 1) DRY-RUN: cuenta y NO escribe (ni base ni recibo)
const d=await loadTracker(base({receiptsDir:R('dry')}));
assert.ok(d.mode.startsWith('DRY-RUN'));assert.equal(d.versions.length,2);assert.equal(d.versions[0].rows,521+3+3);assert.equal(d.versions[1].rows,524+3+3);
assert.ok(d.versions.every(v=>v.max_batch<=250&&v.rejected===0));
assert.equal(existsSync(R('dry')),false,'dry-run creó recibo');
assert.equal(one(`select count(*) from public.tracker_versions`),'0');

// 2) Guardas: proyecto equivocado, tenant inexistente, rol sin bypass; nada se escribe
let e=await err(()=>loadTracker(base({execute:true,receiptsDir:R('bad'),projectRefFile:refBad})));assert.equal(e.code,'PROJECT_MISMATCH');
e=await err(()=>loadTracker(base({execute:true,receiptsDir:R('bad'),projectRefFile:path.join(tmp,'no-existe')})));assert.equal(e.code,'PROJECT_MISMATCH');
e=await err(()=>loadTracker(base({execute:true,receiptsDir:R('bad'),tenant:randomUUID()})));assert.equal(e.code,'TENANT_NOT_FOUND');
psql(['-c',`create role nobypass login nosuperuser nobypassrls; grant select on public.organizations to nobypass`]);
e=await err(()=>loadTracker(base({execute:true,receiptsDir:R('bad'),sqlCmd:['psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-U','nobypass','-h',host,'-p',port,'-d',db,'-f']})));
assert.equal(e.code,'ROLE_CANNOT_BYPASS_RLS');
e=await err(()=>loadTracker(base({execute:true,receiptsDir:R('bad'),versions:[{...versions[0],sha256:'0'.repeat(64)}]})));assert.equal(e.code,'HASH_MISMATCH');
assert.equal(existsSync(R('bad')),false);assert.equal(one(`select count(*) from public.tracker_versions`),'0');

// 3) Fallo en mitad de la carga: se detiene en el primer error, queda recibo y se reanuda sin repetir
const wrapper=path.join(tmp,'flaky.sh');writeFileSync(wrapper,`#!/bin/bash\nf="\${@: -1}"\nif [ -f "${tmp}/FLAG" ] && [[ "$f" == *"01-tools-002.sql" ]]; then rm "${tmp}/FLAG"; echo "ERROR:  boom SHEET_JOB_NOT_OPEN"; exit 1; fi\nexec psql -X -A -t -v ON_ERROR_STOP=1 -h ${host} -p ${port} -d ${db} -f "$f"\n`);chmodSync(wrapper,0o755);
writeFileSync(path.join(tmp,'FLAG'),'x');
e=await err(()=>loadTracker(base({execute:true,receiptsDir:R('a'),sqlCmd:[wrapper]})));
assert.equal(e.code,'BATCH_FAILED');assert.match(e.step,/t1\/01-tools-002\.sql/);assert.deepEqual(e.errors,['SHEET_JOB_NOT_OPEN']);
const rec1=readFileSync(path.join(R('a'),'recibo.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
assert.equal(rec1.filter(r=>r.status==='ok').length,2); // 000-version + tools-001
assert.equal(rec1.at(-1).status,'error');
assert.equal(one(`select count(*) from public.tracker_row_observations`),'250');
// 4) Reanudación completa (+ la segunda versión); el recibo no guarda datos de celdas
const full=await loadTracker(base({execute:true,receiptsDir:R('a')}));
assert.equal(full.executed.length,2);
const exp1=521+3+3,exp2=524+3+3;
assert.equal(full.executed[0].verified.obs+full.executed[0].verified.rej,exp1);assert.equal(full.executed[1].verified.obs,exp2);
assert.equal(full.executed[0].skipped>=2,true);
assert.equal(one(`select count(*) from public.tracker_sheet_jobs where state<>'closed'`),'0');
assert.equal(one(`select count(*) from public.tracker_sheet_jobs`),'6');
assert.equal(one(`select count(*) from public.tracker_row_observations`),String(exp1+exp2));
// cabeza = versión de mayor rango; 2 filas editadas generan revisión nueva; 3 filas nuevas
assert.equal(one(`select count(*) from public.tracker_row_heads where tenant_id='${T}' and head_rank=2`),String(exp2));
assert.equal(one(`select count(*) from public.tracker_row_revisions`),String(exp1+2+3));
assert.equal(one(`select string_agg(ticket_state||':'||n,',' order by ticket_state) from (select ticket_state,count(*) n from public.tracker_row_revisions where first_version_id=(select id from public.tracker_versions where rank=1) group by 1) x`),'candidate:261,header:3,linked:260,malformed_id:2,no_ticket:1');
// el recibo solo tiene conteos/nombres: ningún valor de celda
const rtxt=readFileSync(path.join(R('a'),'recibo.jsonl'),'utf8');assert.ok(!/EDITADA|sintetico|O'/.test(rtxt));
// los SQL con datos se borraron al terminar
assert.deepEqual(readdirSync(tmp).filter(f=>f.startsWith('tracker-carga-')),[]);

// 5) Idempotencia: repetir todo no cambia nada; el recibo ya lo da por hecho
const again=await loadTracker(base({execute:true,receiptsDir:R('a')}));
assert.equal(again.executed.every(x=>x.files===0),true);
assert.equal(one(`select count(*) from public.tracker_row_observations`),String(exp1+exp2));
// 6) Aun sin recibo (perdido), las hojas cerradas en remoto no se repiten ni fallan
const lost=await loadTracker(base({execute:true,receiptsDir:R('lost')}));
assert.equal(lost.executed.every(x=>x.files<=1),true); // solo 000-version.sql (idempotente) se repiteassert.equal(one(`select count(*) from public.tracker_row_revisions`),String(exp1+5));
// 7) Cambiar el índice de tickets con un recibo existente se niega (las revisiones son solo INSERT)
e=await err(()=>loadTracker(base({execute:true,receiptsDir:R('a'),ticketIndexSha:'b'.repeat(64)})));assert.equal(e.code,'RECEIPT_MANIFEST_MISMATCH');assert.equal(e.field,'ticket_index_sha256');
// 8) --max-files: carga parcial controlada
const T2=randomUUID();psql(['-c',`insert into public.organizations(id,name) values('${T2}','sintetico2')`]);
const part=await loadTracker(base({execute:true,receiptsDir:R('p'),maxFiles:2,tenant:T2,connectionId:randomUUID(),versions:[versions[0]]}));
assert.ok(part.stopped_at);
// la conexión existente se reutiliza aunque se pase otro id
const reuse=await loadTracker(base({execute:true,receiptsDir:R('a'),connectionId:randomUUID()}));
assert.equal(reuse.connection_reused,true);
// 9) Ejecutor por defecto: `supabase db query --linked -f <archivo>` (shim local que reenvía a psql)
const bin=path.join(tmp,'bin');mkdirSync(bin);writeFileSync(path.join(bin,'supabase'),`#!/bin/bash
[ "$1 $2 $3 $4" = "db query --linked -f" ] || { echo "argv inesperado" >&2; exit 64; }
exec psql -X -A -t -v ON_ERROR_STOP=1 -h ${host} -p ${port} -d ${db} -f "$5"\n`.replace('\\n','\n'));chmodSync(path.join(bin,'supabase'),0o755);
process.env.PATH=bin+':'+process.env.PATH;
const viaDefault=await loadTracker({...base({execute:true,receiptsDir:R('d'),tenant:T2,connectionId:randomUUID(),versions:[versions[0]]}),sqlCmd:undefined});
assert.equal(viaDefault.executed[0].verified.obs,exp1);
// 10) Índice de tickets: consulta SELECT de solo lectura contra conversaciones reales del esquema
const {candidateIds,summarySql,idsSql,parseIdsResult}=await import('../../packages/ingestion/tracker/ticket-index.mjs');
const {planVersion,loadBytes}=await import('../../packages/ingestion/tracker/loader.mjs');
const ids=candidateIds(planVersion(loadBytes(tmp,versions[1]),{}).jobs);
assert.equal(ids.length,523+1); // 523 de Tools + 20000000001 (Parts); '12' y 'sin-numero' no son candidatos
const conn=randomUUID();
psql(['-c',`insert into public.connections(id,tenant_id,source,account_id) values('${conn}','${T}','hubspot','p1');
 insert into public.conversations(tenant_id,source,external_id,connection_id) values
 ('${T}','hubspot','10000000002','${conn}'),('${T}','csv','hubspot:10000000003','${conn}'),('${T}','csv','gorgias:10000000004','${conn}'),('${T}','csv','hubspot:10000000006','${conn}');
 insert into public.conversations(tenant_id,source,external_id,connection_id,deleted_at) values('${T}','hubspot','10000000005','${conn}',now())`]);
const q1=psql(['-c',summarySql(T)]);assert.equal(q1.status,0,q1.stderr);assert.match(q1.stdout,/TICKETS_SUMMARY csv\/prefijo=2 hubspot\/numerico=1 END/);
const q2=psql(['-c',idsSql(T)]);assert.equal(q2.status,0,q2.stderr);
assert.match(q2.stdout,/\|csv=2 hubspot=1/);
const pr=parseIdsResult(JSON.stringify({rows:[{ids:q2.stdout.trim()}]}),ids);
assert.deepEqual(pr.ids.sort(),['10000000002','10000000003','10000000006']); // nativa numerica + historicas con prefijo; sin gorgias ni borradas
assert.throws(()=>parseIdsResult('nada',ids),/RESULT_UNREADABLE/);
assert.equal(parseIdsResult('TICKETS_FOUND:10000000002 99999999999 10000000002:END',ids).ignored_not_candidate,1);
assert.throws(()=>idsSql("x'; drop table y;--"),/INVALID_TENANT/);
rmSync(tmp,{recursive:true,force:true});
console.log('LOAD OK: dry-run, guardas, fallo+reanudación, idempotencia, recibo, ejecutor por defecto, índice de tickets');
