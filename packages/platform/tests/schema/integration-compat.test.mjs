import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
// SYNTHETIC, dedicated PostgreSQL17; no external service, shared DB or published port.
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', U='11111111-1111-4111-8111-111111111111', O='22222222-2222-4222-8222-222222222222';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:30000,maxBuffer:4e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
test('content-bound approval on PostgreSQL17', {timeout:120000}, async t=>{
 const name='vexa-schema-review-'+randomUUID();
 t.after(()=>docker(['rm','-f','-v',name]));
 docker(['run','--pull','never','--name',name,'-d','-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.159']);
 const args=['exec','-i',name,'psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'];
 const sql=s=>docker(args,s);
 let ready=false;
 for(let i=0;i<100;i++){try{if(spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1'],{encoding:'utf8'}).status===0 && sql("select count(*) from pg_roles where rolname='authenticated'")==='1'){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready);
 sql(`create schema if not exists storage; create table if not exists storage.buckets(id text primary key,name text,public boolean); create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;`);
 for(const f of fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())sql(fs.readFileSync('supabase/migrations/'+f,'utf8'));
 sql(`insert into auth.users(id) values('${U}'),('${O}'); insert into organizations(id,name) values('${A}','SYNTHETIC review'); insert into memberships(tenant_id,user_id,role,status) values('${A}','${U}','owner','active'),('${A}','${O}','operator','active');
 insert into economic_events(id,tenant_id,kind,status,amount_minor,currency,exponent,effective_at,source_ref) values('${id(1)}','${A}','refund','observed',100,'USD',2,now(),'SYNTHETIC');
 insert into problems(id,tenant_id,severity,cause_status) values('${id(2)}','${A}','high','unknown'); insert into recommendations(id,tenant_id,problem_id,status,version) values('${id(3)}','${A}','${id(2)}','draft',1);`);
 const scope=(action,user=U)=>`set local role vexa_backend; select set_config('request.jwt.claim.sub','${user}',true),set_config('vexa.tenant_id','${A}',true),set_config('vexa.action','${action}',true);`;
 const snap=n=>`insert into metric_snapshots(id,tenant_id,scope_hash,input_hash,policy_version,status,watermark) values('${id(n)}','${A}','SYN${n}','SYN','1','draft',now());`;
 const comp=(n,s)=>`insert into components(id,tenant_id,snapshot_id,amount_minor,currency,exponent) values('${id(n)}','${A}','${id(s)}',100,'USD',2);`;
 const attr=(n,s,c)=>`insert into attributions(id,tenant_id,snapshot_id,component_id,economic_event_id) values('${id(n)}','${A}','${id(s)}','${id(c)}','${id(1)}');`;
 const pub=n=>`update metric_snapshots set status='published',bundle_ref='SYN',published_at=now() where id='${id(n)}';`;
 const denied=(statement,code='check_violation')=>`do $$begin begin ${statement} raise exception 'UNEXPECTED_ALLOWED'; exception when ${code} then null; end; end$$;`;

 const fixture=()=>`${scope('propose',O)}
 insert into recommendations(id,tenant_id,problem_id,status,version,title) values('${id(4)}','${A}','${id(2)}','draft',1,'replacement');
 insert into interventions(id,tenant_id,recommendation_id,status,version,owner_id,hypothesis) values('${id(20)}','${A}','${id(3)}','draft',1,'${O}','original');
 insert into measurement_plans(id,tenant_id,intervention_id,version,unit,population_ref,date_start,date_end) values('${id(21)}','${A}','${id(20)}',1,'refund','cohort-A','2026-01-01','2026-02-01');
 update interventions set measurement_ref='${id(21)}' where id='${id(20)}';`;
 const approve=()=>`${scope('approve')} update interventions set status='approved' where id='${id(20)}';`;

 await t.test('snapshot missing/cross-tenant parent is FK 23503; published is 23514 and RBAC 42501',()=>{
  const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  sql(`begin; insert into organizations(id,name) values('${B}','SYNTHETIC B');
   insert into metric_snapshots(id,tenant_id,scope_hash,input_hash,policy_version,status,watermark) values('${id(99)}','${B}','B','B','1','draft',now());
   ${scope('import')} ${snap(30)} ${comp(31,30)} ${attr(32,30,31)}
   ${denied(comp(40,98),'foreign_key_violation')} ${denied(comp(40,99),'foreign_key_violation')}
   ${denied(attr(40,98,31),'foreign_key_violation')} ${denied(attr(40,99,31),'foreign_key_violation')}
   ${denied(`update components set snapshot_id='${id(98)}' where id='${id(31)}';`,'foreign_key_violation')}
   ${denied(`update attributions set snapshot_id='${id(99)}' where id='${id(32)}';`,'foreign_key_violation')}
   ${pub(30)} ${denied(`update components set amount_minor=999 where id='${id(31)}';`)}
   ${scope('retain')} ${denied(`delete from attributions where id='${id(32)}';`)}
   ${denied(`delete from components where id='${id(31)}';`)}
   reset role; update memberships set status='revoked' where user_id='${U}';
   ${scope('import')} ${denied(snap(40),'insufficient_privilege')}
   update components set amount_minor=999 where id='${id(31)}';
   reset role; do $$begin if (select amount_minor from components where id='${id(31)}')<>100 or exists(select 1 from components where id='${id(40)}') or not exists(select 1 from attributions where id='${id(32)}') then raise exception 'snapshot postcondition'; end if; end$$;
   rollback;`);
 });
 await t.test('service-style SQL transitions preserve approval with CAS version and transition reason',()=>{
  sql(`begin; ${fixture()} ${scope('approve')}
   update interventions set status='approved',version=version+1,reason='owner approval' where id='${id(20)}' and version=1;
   create temporary table receipt_before as select approval_content from interventions where id='${id(20)}';
   ${scope('execute',O)}
   update interventions set status='active',version=version+1,reason='start execution' where id='${id(20)}' and version=2;
   update measurement_plans set result_ref='SYNTHETIC result' where id='${id(21)}';
   update interventions set status='measuring',version=version+1,reason='measure outcome' where id='${id(20)}' and version=3;
   update interventions set status='closed',version=version+1,reason='measurement complete' where id='${id(20)}' and version=4;
   reset role; do $$begin if not exists(select 1 from interventions where id='${id(20)}' and status='closed' and version=5 and reason='measurement complete' and approval_content=(select approval_content from receipt_before)) then raise exception 'service cycle or receipt changed'; end if; end$$; rollback;`);
 });
 await t.test('operational updates cannot smuggle definitions or forge approval, skip CAS counter, or edit terminal reason',()=>{
  for(const change of ["hypothesis='changed'",`owner_id='${U}'`,`recommendation_id='${id(4)}'`,"baseline_ref=null","measurement_ref=null","provenance='{\"changed\":true}'","approval_content='{}'"]){
   for(const bump of ['',',version=version+1'])sql(`begin; ${fixture()} ${scope('import')} ${snap(30)} ${pub(30)} ${scope('propose',O)} update interventions set baseline_ref='${id(30)}' where id='${id(20)}'; ${approve()} ${scope('execute',O)} ${denied(`update interventions set status='active',reason='execute',${change}${bump} where id='${id(20)}';`)} rollback;`);
  }
  sql(`begin; ${fixture()} ${approve()} ${scope('execute',O)}
   ${denied(`update interventions set status='active',version=version+2,reason='skip' where id='${id(20)}';`)}
   ${denied(`update interventions set status='active',version=version-1,reason='rewind' where id='${id(20)}';`)}
   ${denied(`update interventions set reason='only reason' where id='${id(20)}';`)}
   ${denied(`update interventions set version=version+1 where id='${id(20)}';`)}
   update interventions set status='active',version=version+1,reason='valid' where id='${id(20)}';
   update interventions set status='measuring',version=version+1,reason='valid' where id='${id(20)}';
   update interventions set status='closed',version=version+1,reason='valid' where id='${id(20)}';
   ${denied(`update interventions set version=version+1,reason='rewrite closed' where id='${id(20)}';`)} rollback;`);
 });
});
