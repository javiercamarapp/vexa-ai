// Emite SQL de una versión sintética y lo aplica a la base local desechable; compara con el ledger. Uso: node emit-check.mjs <socket> <port>
import {spawnSync} from 'node:child_process';import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {buildXlsx} from '../../packages/ingestion/tracker/xlsx-fixture.mjs';
import {readWorkbook,emitVersionSql} from '../../packages/ingestion/tracker/index.mjs';
const [host,port]=process.argv.slice(2),T=randomUUID(),C=randomUUID();
const psqlF=(f)=>spawnSync('psql',['-X','-q','-h',host,'-p',port,'-d','vexa_test','-v','ON_ERROR_STOP=1','-f',f],{encoding:'utf8'});
const one=q=>spawnSync('psql',['-X','-q','-A','-t','-h',host,'-p',port,'-d','vexa_test','-c',q],{encoding:'utf8'}).stdout.trim();
one(`insert into public.organizations values('${T}')`);
const HEAD=['Requester','Hubspot ID','Request Date','Order ID','Notes'];
const wb=readWorkbook(buildXlsx([{name:'Warranty Tools',rows:[HEAD,...Array.from({length:520},(_,i)=>['u'+i,String(10000000000+i),i,"O'"+i,'n$j'+i])]},{name:'WTR',state:'hidden',rows:[HEAD,['a',null,1,'x','y']]}]));
const dir=mkdtempSync(path.join(os.tmpdir(),'tracker-emit-'));
const r=emitVersionSql({workbook:wb,version:{sha256:createHash('sha256').update('x').digest('hex'),rank:1,label:'sintetica',received_at:null},tenantId:T,connectionId:C,dir});
assert.ok(r.files.every(f=>readFileSync(path.join(dir,f),'utf8').length>0));
for(const f of readdirSync(dir).sort()){const x=psqlF(path.join(dir,f));assert.equal(x.status,0,f+x.stderr);}
assert.equal(one(`select count(*) from public.tracker_row_observations where tenant_id='${T}'`),'523');
assert.equal(one(`select state||':'||count(*) from public.tracker_sheet_jobs where tenant_id='${T}' group by state`),'closed:2');
assert.equal(one(`select count(*) from public.tracker_row_revisions where tenant_id='${T}' and cells::text like '%O''%'`),'520');
// reintento de un lote ya cargado con la hoja cerrada: se niega
assert.notEqual(psqlF(path.join(dir,r.files.find(f=>f.endsWith('-001.sql')))).status,0);
rmSync(dir,{recursive:true});console.log('EMIT OK',r.jobs.map(j=>j.batches).join('+'),'lotes');
