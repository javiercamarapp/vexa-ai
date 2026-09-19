import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
// SYNTHETIC, dedicated PostgreSQL17; no external service, shared DB or published port.
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', U='11111111-1111-4111-8111-111111111111', O='22222222-2222-4222-8222-222222222222';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:30000,maxBuffer:4e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
test('independent review regressions on PostgreSQL17', {timeout:120000}, async t=>{
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
 await t.test('P1 published components and attributions survive retain; draft retention stays permitted',()=>{
  sql(`begin; ${scope('import')} ${snap(10)} ${comp(11,10)} ${attr(12,10,11)} ${pub(10)} ${snap(13)} ${comp(14,13)} ${attr(15,13,14)}
  ${scope('retain')} ${denied(`delete from attributions where id='${id(12)}';`)} ${denied(`delete from components where id='${id(11)}';`)}
  delete from attributions where id='${id(15)}'; delete from components where id='${id(14)}'; delete from metric_snapshots where id='${id(13)}';
  do $$begin if exists(select 1 from components where id='${id(14)}') or not exists(select 1 from components where id='${id(11)}') then raise exception 'retention postcondition'; end if; end$$; rollback;`);
 });
 await t.test('P1 execute requires prior approval',()=>{
  sql(`begin; ${scope('propose',O)} insert into interventions(id,tenant_id,recommendation_id,status,version,owner_id) values('${id(20)}','${A}','${id(3)}','draft',1,'${O}');
  ${scope('execute',O)} ${denied(`update interventions set status='active' where id='${id(20)}';`)}
  rollback;`);
 });
 await t.test('P1 operator INSERT active is rejected',()=>{
  sql(`begin; ${scope('execute',O)} ${denied(`insert into interventions(tenant_id,recommendation_id,status,version,owner_id) values('${A}','${id(3)}','active',1,'${O}');`)} rollback;`);
 });
 await t.test('invisible snapshot fails closed for both child deletes; retain never updates snapshot',()=>{
  sql(`begin; ${snap(90)} ${comp(91,90)} ${attr(92,90,91)}
  create policy synthetic_hidden_snapshot on metric_snapshots as restrictive for select to vexa_backend using (false);
  ${scope('retain')} ${denied(`delete from attributions where id='${id(92)}';`,'foreign_key_violation')}
  ${denied(`delete from components where id='${id(91)}';`,'foreign_key_violation')}
  reset role; drop policy synthetic_hidden_snapshot on metric_snapshots;
  ${scope('retain')} ${denied(`update metric_snapshots set input_hash='ESCAPE' where id='${id(90)}';`,'insufficient_privilege')}
  rollback;`);
 });
 await t.test('P2 attribution component must match tenant AND snapshot',()=>{
  sql(`begin; ${scope('import')} ${snap(30)} ${snap(31)} ${comp(32,31)} ${denied(attr(33,30,32),'foreign_key_violation')} ${attr(34,31,32)} ${denied(`update attributions set snapshot_id='${id(30)}' where id='${id(34)}';`,'foreign_key_violation')} ${denied(`update components set snapshot_id='${id(30)}' where id='${id(32)}';`,'foreign_key_violation')} ${pub(31)} ${denied(`update components set amount_minor=999 where id='${id(32)}';`)} rollback;`);
 });
 await t.test('approval roles, legal execution, assignment and terminal states',()=>{
  sql(`begin; ${scope('propose',O)} insert into interventions(id,tenant_id,recommendation_id,status,version,owner_id) values('${id(40)}','${A}','${id(3)}','draft',1,'${O}');
  ${scope('approve',O)} update interventions set status='approved' where id='${id(40)}';
  reset role; do $$begin if (select status from interventions where id='${id(40)}')<>'draft' then raise exception 'operator approved'; end if; end$$;
  update memberships set status='revoked' where user_id='${U}'; ${scope('approve')} update interventions set status='approved' where id='${id(40)}';
  reset role; do $$begin if (select status from interventions where id='${id(40)}')<>'draft' then raise exception 'revoked owner approved'; end if; end$$;
  update memberships set status='active' where user_id='${U}'; ${scope('approve')} update interventions set status='approved' where id='${id(40)}';
  ${scope('approve')} update interventions set owner_id='${U}' where id='${id(40)}';
  ${scope('execute',O)} update interventions set status='active' where id='${id(40)}';
  reset role; do $$begin if (select status from interventions where id='${id(40)}')<>'approved' then raise exception 'unassigned operator executed'; end if; end$$;
  ${scope('approve')} update interventions set owner_id='${O}' where id='${id(40)}';
  ${scope('execute',O)} update interventions set status='active' where id='${id(40)}'; update interventions set status='measuring' where id='${id(40)}'; update interventions set status='closed' where id='${id(40)}';
  ${denied(`update interventions set status='active' where id='${id(40)}';`)}
  do $$begin if (select status from interventions where id='${id(40)}')<>'closed' then raise exception 'positive state sequence'; end if; end$$; rollback;`);
 });
 // Interactive sessions keep the first transaction open until pg_stat_activity proves
 // the competing statement is waiting on its lock. No timing-only race assertion.
 function session(label){
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',error='';
  child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>error+=x);
  const ended=new Promise(resolve=>child.on('close',code=>resolve({code,output,error})));
  return {child,ended, async send(s){const marker=randomUUID(); child.stdin.write(s+`\nselect '${marker}';\n`); const until=Date.now()+10000; while(!output.includes(marker)){if(error)throw Error(error);assert.ok(Date.now()<until,`session ${label} timed out`);await new Promise(r=>setTimeout(r,20));}},finish(s='commit;'){child.stdin.end(s);return ended;}};
 }
 async function race(first,second,after){
  const tag='schema-race-'+randomUUID(), s=session('holder');
  try{
   await s.send(`begin; ${first}`);
   const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);
   const done=new Promise(resolve=>p.on('close',code=>resolve({code,out,err})));
   p.stdin.end(`set application_name='${tag}'; set statement_timeout='10s'; begin; ${second} commit;`);
   let waiting=false;for(let i=0;i<100;i++){if(sql(`select count(*) from pg_stat_activity where application_name='${tag}' and wait_event_type='Lock'`)==='1'){waiting=true;break;}await new Promise(r=>setTimeout(r,20));}
   await s.finish();const result=await done;assert.ok(waiting,'competing transaction actually waited on lock');after(result);
  }finally{if(s.child.exitCode===null)await s.finish('rollback;');}
 }
 await t.test('concurrent publication versus mutation and retention, both orders',async()=>{
  for(const [k,table,operation] of [[50,'components','update'],[60,'components','delete'],[70,'attributions','delete'],[80,'attributions','update']]){
   sql(`${snap(k)} ${comp(k+1,k)} ${attr(k+2,k,k+1)}`);
   const target=table==='components'?k+1:k+2;
   // Remove attribution first for the component DELETE, so FK rejection cannot mask guard failure.
   if(table==='components'&&operation==='delete')sql(`delete from attributions where id='${id(k+2)}';`);
   const change=operation==='delete'?`delete from ${table} where id='${id(target)}';`:`update ${table} set ${table==='components'?'amount_minor=999':'weight=0.5'} where id='${id(target)}';`;
   const action=operation==='delete'?'retain':'import';
   await race(`${scope('import')} ${pub(k)}`,`${scope(action)} ${change}`,r=>{assert.notEqual(r.code,0);assert.match(r.err,/published component immutable/);});
   assert.equal(sql(`select count(*) from ${table} where id='${id(target)}'`),'1');
   if(operation==='update')assert.equal(sql(`select ${table==='components'?'amount_minor::text':"coalesce(weight::text,'NULL')"} from ${table} where id='${id(target)}'`),table==='components'?'100':'NULL');
   const n=k+100;sql(`${snap(n)} ${comp(n+1,n)} ${attr(n+2,n,n+1)}`);
   if(table==='components'&&operation==='delete')sql(`delete from attributions where id='${id(n+2)}';`);
   const change2=change.replace(id(target),id(target+100));
   await race(`${scope(action)} ${change2}`,`${scope('import')} ${pub(n)}`,r=>assert.equal(r.code,0,r.err));
   assert.equal(sql(`select status from metric_snapshots where id='${id(n)}'`),'published');
   assert.equal(sql(`select count(*) from ${table} where id='${id(target+100)}'`),operation==='delete'?'0':'1');
   if(operation==='update')assert.equal(sql(`select ${table==='components'?'amount_minor':'weight'} from ${table} where id='${id(target+100)}'`),table==='components'?'999':'0.5');
  }
 });
});
