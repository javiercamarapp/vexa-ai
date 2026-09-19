import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createDatabase} from '/Users/javiercamaraportepetit/vexa/.runtime/renewed-app-integration-1789837609558767000/app/packages/platform/src/db.ts';
import {createWorkspaceService} from '/Users/javiercamaraportepetit/vexa/.runtime/renewed-app-integration-1789837609558767000/app/packages/workspace-service/index.mjs';
import {readWorkspace} from '/Users/javiercamaraportepetit/vexa/.runtime/renewed-app-integration-1789837609558767000/app/apps/web/src/lib/workspace/data.ts';
import {scopeHash} from '/Users/javiercamaraportepetit/vexa/.runtime/renewed-app-integration-1789837609558767000/app/apps/web/src/lib/workspace/contracts.ts';
const A=randomUUID(),B=randomUUID(),U=randomUUID(),O=randomUUID(),V=randomUUID(),S=randomUUID(),P=randomUUID(),R=randomUUID(),E=randomUUID();
const scope={date_start:'2026-08-01T00:00:00.000Z',date_end:'2026-09-01T00:00:00.000Z',timezone:'UTC',date_basis:'order',currency:'USD',sku:[],source:[],snapshot_id:S};
function run(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:30000,maxBuffer:4e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
// Test-only psql transport. Application uses createDatabase's real SqlPool boundary.
// Dollar parameters become escaped SQL literals only here, never in product code.
const literal=v=>v===null?'NULL':Array.isArray(v)?`ARRAY[${v.map(literal).join(',')}]::text[]`:typeof v==='number'?String(v):`'${String(v).replaceAll("'","''")}'`;
function pool(name){return {async connect(){
 const child=spawn('docker',['exec','-i',name,'psql','-X','-qAt','-U','supabase_admin','-d','postgres'],{stdio:['pipe','pipe','pipe']});
 let buffer='',pending,errors='',lastSQL='';child.stdout.on('data',d=>{buffer+=d;const match=buffer.match(/\n?WS_END ([0-9A-Z]{5})\n/);if(match&&pending){const data=buffer.slice(0,match.index).trim();buffer=buffer.slice(match.index+match[0].length);const p=pending;pending=undefined;if(match[1]!=='00000')(console.error('SYNTHETIC SQL ERROR',match[1],errors,lastSQL),p.reject(Object.assign(Error(errors),{code:match[1]})));else {try{const rows=data?JSON.parse(data):[];p.resolve({rows,rowCount:rows.length});}catch(e){p.reject(Error(data));}}errors='';}});
 child.stderr.on('data',d=>errors+=d);child.on('exit',()=>{if(pending)pending.reject(Error('psql exited'));});
 return {query(text,values=[]){return new Promise((resolve,reject)=>{assert.equal(pending,undefined);pending={resolve,reject};lastSQL=text;let sql=text.replace(/\$(\d+)/g,(_,n)=>literal(values[Number(n)-1]));if(/^SELECT\b/i.test(sql))sql=`SELECT coalesce(json_agg(row_to_json(t)),'[]'::json) FROM (${sql}) t`;else if(/\bRETURNING\b/i.test(sql))sql=`WITH t AS (${sql}) SELECT coalesce(json_agg(row_to_json(t)),'[]'::json) FROM t`;child.stdin.write(sql+';\n\\echo WS_END :SQLSTATE\n');});},release(){child.stdin.end('\\q\n');}};
 }};}
test('REAL PostgreSQL17 isolated: service, canonical entities, RLS and atomic commands',{timeout:120000},async t=>{
 const name='vexa-workspace-'+randomUUID();t.after(()=>run(['rm','-f','-v',name]));
 run(['run','--pull','never','--name',name,'--network','none','-d','-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.159']);
 const sql=text=>run(['exec','-i',name,'psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],text);
 let ready=false;for(let i=0;i<100;i++){try{run(['exec',name,'pg_isready','-h','127.0.0.1']);if(sql("select count(*) from pg_roles where rolname='authenticated'")==='1'){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 sql('create schema if not exists storage;create table if not exists storage.buckets(id text primary key,name text,public boolean);create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;');
 for(const file of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort())sql(readFileSync('supabase/migrations/'+file,'utf8'));
 sql(readFileSync('packages/workspace-service/sql/001_workspace_service.sql','utf8'));
 sql(`INSERT INTO auth.users(id) VALUES('${U}'),('${O}'),('${V}');INSERT INTO public.organizations(id,name) VALUES('${A}','SYNTHETIC A'),('${B}','SYNTHETIC B');INSERT INTO public.memberships(tenant_id,user_id,role,status) VALUES('${A}','${U}','owner','active'),('${A}','${O}','operator','active'),('${A}','${V}','viewer','active');
 INSERT INTO public.metric_snapshots(id,tenant_id,scope_hash,input_hash,policy_version,watermark,status,date_start,date_end,timezone,currency,date_basis) VALUES('${S}','${A}','SYNTHETIC_SCOPE','SYNTHETIC_INPUT','policy-v1','2026-09-01','draft','2026-08-01','2026-09-01','UTC','USD','order');
 INSERT INTO workspace_service.snapshot_scope VALUES('${A}','${S}','model-v1','analysis-v1','gross',2,'{}','{}',true,true,'SYNTHETIC complete',null);
 INSERT INTO public.problems(id,tenant_id,severity,cause_status,title) VALUES('${P}','${A}','high','unknown','SYNTHETIC problem');
 INSERT INTO public.problem_versions(id,tenant_id,version,title,rationale,problem_id) VALUES('${P}','${A}',1,'SYNTHETIC problem','Evidence needed','${P}');
 INSERT INTO workspace_service.snapshot_problems VALUES('${A}','${S}','${P}','${P}');
 INSERT INTO public.connections(id,tenant_id,source,account_id,status) VALUES('${P}','${A}','csv','SYN','active');
 INSERT INTO public.conversations(id,tenant_id,source,external_id,connection_id) VALUES('${P}','${A}','csv','SYN','${P}');
 INSERT INTO public.messages(id,tenant_id,external_id,role,occurred_at,conversation_id) VALUES('${P}','${A}','SYN','customer','2026-08-10','${P}');
 INSERT INTO public.message_revisions(id,tenant_id,revision,text_ref,redacted_text,hash,message_id) VALUES('${P}','${A}','1','public.message_revisions/${P}','SYNTHETIC quote','SYN','${P}');
 INSERT INTO public.evidence_spans(id,tenant_id,"start","end",quote_hash,message_revision_id) VALUES('${E}','${A}',0,15,'${createHash('sha256').update('SYNTHETIC quote').digest('hex')}','${P}');
 INSERT INTO workspace_service.snapshot_evidence VALUES('${A}','${S}','${P}','${E}');
 INSERT INTO public.components(tenant_id,snapshot_id,metric,kind,amount_minor,known_subtotal_minor,currency,exponent) VALUES('${A}','${S}','exposure','observed',null,100,'USD',2);
 INSERT INTO public.recommendations(id,tenant_id,status,version,title,problem_id,snapshot_id,evidence_span_id) VALUES('${R}','${A}','proposed',1,'SYNTHETIC recommendation','${P}','${S}','${E}');
 UPDATE public.metric_snapshots SET status='published',bundle_ref='public.components/${S}',published_at=now() WHERE id='${S}';`);
 const identity=user=>({getUser:async()=>({id:user}),memberships:async()=>[{tenant_id:A,user_id:user,role:'owner',status:'active',permissions_version:1}]});
 const service=user=>createWorkspaceService({database:createDatabase({identity:identity(user),pool:pool(name),selectedTenant:A})});
 const owner=service(U),operator=service(O),viewer=service(V);
 const command={resource:'recommendations',id:R,scope,expected_version:1,idempotency_key:randomUUID(),reason:'SYNTHETIC test',owner_id:U};

 await t.test('real service increments operational CAS and rejects stale version without changing approval',async()=>{
 const intervention=await owner.command(command);
 const plan=randomUUID();
 sql(`UPDATE public.interventions SET hypothesis='SYNTHETIC hypothesis',measurement_ref=NULL WHERE id='${intervention.id}'; INSERT INTO public.measurement_plans(id,tenant_id,version,unit,population_ref,date_start,date_end,intervention_id,baseline_ref) VALUES('${plan}','${A}',1,'orders','SYN cohort','2026-09-01','2026-09-02','${intervention.id}','${S}'); INSERT INTO workspace_service.plan_details VALUES('${A}','${plan}','refunds','SYN control','metric-v1');`);
 const base={resource:'interventions',id:intervention.id,scope,expected_version:1,idempotency_key:randomUUID(),reason:'SYN approval',target:'approved'};
 const approved=await owner.command(base);assert.equal(approved.version,2);
 const receipt=sql(`select approval_content from public.interventions where id='${intervention.id}'`);
 await assert.rejects(owner.command({...base,idempotency_key:randomUUID()}),e=>e.status===409&&e.code==='version_conflict');
 const active=await owner.command({...base,expected_version:2,target:'active',reason:'start',idempotency_key:randomUUID()});assert.equal(active.status,'active');assert.equal(active.version,3);
 await assert.rejects(owner.command({...base,expected_version:2,target:'measuring',reason:'stale',idempotency_key:randomUUID()}),e=>e.status===409&&e.code==='version_conflict');
 const measuring=await owner.command({...base,expected_version:3,target:'measuring',reason:'measure',idempotency_key:randomUUID()});assert.equal(measuring.status,'measuring');assert.equal(measuring.version,4);
 assert.equal(sql(`select approval_content from public.interventions where id='${intervention.id}'`),receipt);
 assert.equal(sql(`select reason from public.interventions where id='${intervention.id}'`),'measure');
 assert.equal(sql(`select count(*) from workspace_service.commands`),'4');
 assert.equal(sql(`select count(*) from public.audit_events`),'4');
 assert.equal(sql(`select count(*) from workspace_service.outbox`),'4');
 });
});
