// Coverage band + citation -> origin chain against a real ephemeral PostgreSQL (unix socket, synthetic data, real migrations, real RLS).
//   node packages/workspace-service/tests/provenance.mjs      (env: PG_BIN, PGPORT_TEST=59474, PGSOCK_TEST=/tmp/vxpv)
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.resolve(here,'../../..'),mig=path.join(root,'supabase/migrations');
const pg=createRequire(path.join(root,'package.json'))('pg');
const {createProvenanceRepository}=await import('../provenance.mjs');
const bin=process.env.PG_BIN??'/opt/homebrew/opt/postgresql@17/bin',port=process.env.PGPORT_TEST??'59474',sock=process.env.PGSOCK_TEST??'/tmp/vxpv';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-provenance-')),data=path.join(dir,'data');fs.mkdirSync(sock,{recursive:true});
const run=(cmd,args)=>{const r=spawnSync(path.join(bin,cmd),args,{encoding:'utf8'});if(r.status!==0)throw new Error(cmd+' failed: '+(r.stderr||r.stdout).slice(0,1500));return r.stdout;};
const psql=a=>run('psql',['-h',sock,'-p',port,'-d','postgres','-X','-q','-v','ON_ERROR_STOP=1',...a]);
const results=[];const check=(n,p,d='')=>{results.push(p);console.log((p?'PASS ':'FAIL ')+n+(d?' '+d:''));};
const TA='aaaaaaaa-1000-0000-0000-00000000000a',TB='bbbbbbbb-1000-0000-0000-00000000000b',UA='11111111-0000-0000-0000-00000000000a',UV='11111111-0000-0000-0000-0000000000a1',UB='11111111-0000-0000-0000-00000000000b';
const CA='cccccccc-1000-0000-0000-00000000000a',CB='cccccccc-1000-0000-0000-00000000000b',CA2='cccccccc-1000-0000-0000-0000000000a2';
const REV_FILE='eeeeeeee-0000-0000-0000-000000000001',REV_SYNC='eeeeeeee-0000-0000-0000-000000000002',REV_B='eeeeeeee-0000-0000-0000-00000000000b';
let started=false,pool;
const dbFor=(user,tenant)=>({async transaction(action,work){const c=await pool.connect();let open=false;try{await c.query('BEGIN READ ONLY');open=true;await c.query('SET LOCAL ROLE vexa_backend');
 await c.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('vexa.tenant_id',$2,true),set_config('statement_timeout','10000',true),set_config('vexa.action',$3,true)",[user,tenant,action]);
 const r=await work({tenantId:tenant,userId:user,query:(t,v)=>c.query(t,v)});await c.query('COMMIT');open=false;return r;}finally{if(open)await c.query('ROLLBACK').catch(()=>{});c.release();}}});
const h=c=>c.repeat(64);
try{
 run('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',data,'-l',path.join(dir,'pg.log'),'-o',`-k ${sock} -p ${port} -c listen_addresses='' -c shared_buffers=128MB`,'-w','start']);started=true;
 psql(['-f',path.join(root,'supabase/tests/association-candidates/stubs.sql')]);
 for(const n of fs.readdirSync(mig).filter(n=>/^\d{4}_.*\.sql$/.test(n)&&(n<'0050'||n.startsWith('0054'))).sort()){const f=path.join(dir,n);fs.writeFileSync(f,fs.readFileSync(path.join(mig,n),'utf8').replace(/^create extension if not exists vector.*$/m,''));psql(['-f',f]);}
 fs.writeFileSync(path.join(dir,'seed.sql'),`
insert into auth.users(id,email) values ('${UA}','a@syn.invalid'),('${UV}','v@syn.invalid'),('${UB}','b@syn.invalid');
insert into public.organizations(id,name) values ('${TA}','SYN A'),('${TB}','SYN B');
insert into public.memberships(tenant_id,user_id,role,status) values ('${TA}','${UA}','owner','active'),('${TA}','${UV}','viewer','active'),('${TB}','${UB}','owner','active');
insert into public.connections(id,tenant_id,source,account_id) values ('${CA}','${TA}','hubspot','syn-a'),('${CA2}','${TA}','csv','syn-a-csv'),('${CB}','${TB}','hubspot','syn-b');
insert into public.imports(id,tenant_id,file_hash,mapping_version,state,idempotency_key,total,accepted,rejected,duplicates,pending,connection_id) values
 ('f0000000-0000-0000-0000-000000000001','${TA}','${h('1')}','m1','succeeded','k1',100,80,10,5,5,'${CA}'),
 ('f0000000-0000-0000-0000-000000000002','${TA}','${h('2')}','m1','running','k2',50,10,0,0,40,'${CA}'),
 ('f0000000-0000-0000-0000-000000000003','${TA}','${h('3')}','m2','succeeded','k3',20,20,0,0,0,'${CA2}'),
 ('f0000000-0000-0000-0000-000000000004','${TB}','${h('4')}','m1','succeeded','k4',999,999,0,0,0,'${CB}');
insert into public.conversations(id,tenant_id,source,external_id,connection_id) values ('d0000000-0000-0000-0000-000000000001','${TA}','hubspot','hubspot:1','${CA}'),('d0000000-0000-0000-0000-00000000000b','${TB}','hubspot','hubspot:b','${CB}');
insert into public.messages(id,tenant_id,external_id,role,conversation_id,connection_id) values
 ('a0000000-0000-0000-0000-000000000001','${TA}','m1','customer','d0000000-0000-0000-0000-000000000001','${CA}'),
 ('a0000000-0000-0000-0000-000000000002','${TA}','m2','customer','d0000000-0000-0000-0000-000000000001','${CA}'),
 ('a0000000-0000-0000-0000-00000000000b','${TB}','mb','customer','d0000000-0000-0000-0000-00000000000b','${CB}');
insert into public.message_revisions(id,tenant_id,revision,text_ref,hash,message_id) values
 ('${REV_FILE}','${TA}','1','ref1','${h('a')}','a0000000-0000-0000-0000-000000000001'),
 ('${REV_SYNC}','${TA}','1','ref2','${h('b')}','a0000000-0000-0000-0000-000000000002'),
 ('${REV_B}','${TB}','1','refb','${h('c')}','a0000000-0000-0000-0000-00000000000b');
insert into public.import_rows(tenant_id,row_ref,row_hash,state,payload_ref,import_id) values ('${TA}','row-17','${h('d')}','accepted','payload-17','f0000000-0000-0000-0000-000000000001');
insert into public.source_revisions(id,tenant_id,provenance,connection_id,entity_type,external_id,source_revision,content_hash,fingerprint,mapping_version,message_revision_id,snapshot,canonical_id,message_id) values
 (gen_random_uuid(),'${TA}','{"payload_ref":"payload-17"}','${CA}','message','ext-17','1','${h('e')}','${h('7')}','m1','${REV_FILE}','[]','a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001'),
 (gen_random_uuid(),'${TA}','{}','${CA}','message','ext-sync','1','${h('f')}','${h('8')}','m1','${REV_SYNC}','[]','a0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002');`);
 psql(['-f',path.join(dir,'seed.sql')]);
 pool=new pg.Pool({host:sock,port:Number(port),database:'postgres',max:2});
 const owner=createProvenanceRepository({database:dbFor(UA,TA)}),viewer=createProvenanceRepository({database:dbFor(UV,TA)}),other=createProvenanceRepository({database:dbFor(UB,TB)});
 const cov=await owner.coverage(),by=Object.fromEntries(cov.sources.map(s=>[s.key,s]));
 check('coverage: hubspot sums only this tenant (80+10 accepted + 5 duplicates = 95 incorporated, 10 rejected, 45 pending of 150)',by.hubspot.incorporated===95&&by.hubspot.rejected===10&&by.hubspot.pending===45&&by.hubspot.total===150,JSON.stringify(by.hubspot));
 check('coverage: open import counted',by.hubspot.openImports===1&&by.hubspot.imports===2);
 check('coverage: csv loaded 20/20',by.csv.loaded&&by.csv.incorporated===20&&by.csv.pending===0);
 check('coverage: sources never imported are "not loaded", not zero',by.excel.loaded===false&&by.zendesk.loaded===false&&by.excel.total===0);
 check('coverage: another tenant never leaks (B sees 999, A does not)',(await other.coverage()).sources.find(s=>s.key==='hubspot').total===999);
 check('coverage: viewer role can read',(await viewer.coverage()).sources.length>=4);
 const full=await owner.origin({messageRevisionId:REV_FILE});
 check('origin: full chain revision -> source record -> file row -> file hash',full.complete&&full.chain.map(c=>c.step).join()==='message_revision,source_record,import_row,import_file'&&full.chain[3].hash===h('1')&&full.chain[2].detail==='row-17'&&full.chain[0].hash===h('a'),full.chain.map(c=>c.hashShort).join('>'));
 const sync=await owner.origin({messageRevisionId:REV_SYNC});
 check('origin: sync-sourced revision reports the gap honestly',!sync.complete&&sync.chain.length===2&&/sincronización directa/.test(sync.gap));
 let e1,e2,e3;try{await owner.origin({messageRevisionId:REV_B});}catch(e){e1=e;}try{await owner.origin({messageRevisionId:'nope'});}catch(e){e2=e;}try{await other.origin({messageRevisionId:REV_FILE});}catch(e){e3=e;}
 check('origin: cross-tenant revision is 404 (RLS + tenant filter)',e1?.status===404&&e3?.status===404);
 check('origin: invalid id is 400',e2?.status===400);
}catch(e){console.error(e);results.push(false);}
finally{await pool?.end().catch(()=>{});if(started)spawnSync(path.join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
const ok=results.length>0&&results.every(Boolean);console.log(ok?'ALL PASS':'FAILED');process.exitCode=ok?0:1;
