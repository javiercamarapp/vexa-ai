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
 await t.test('reviewer bypass: swapped draft recommendation plus hypothesis cannot activate',()=>{
  sql(`begin; ${fixture()} ${approve()} ${scope('execute',O)}
   ${denied(`update interventions set recommendation_id='${id(4)}',hypothesis='replacement',status='active' where id='${id(20)}';`)} rollback;`);
 });
 await t.test('all intervention definition fields bound, including skipped CAS counter and receipt',()=>{
  for(const change of ["hypothesis='changed'","reason='changed'",`recommendation_id='${id(4)}'`,`owner_id='${U}'`,"baseline_ref=null","measurement_ref=null","version=3","idempotency_key='changed'","provenance='{}'::jsonb || '{\"changed\":true}'::jsonb","created_at=now()+interval '1 day'"]){
   // baseline NULL->NULL is a no-op; create a published baseline before approval.
   sql(`begin; ${fixture()} ${scope('import')} ${snap(30)} ${pub(30)} ${scope('propose',O)} update interventions set baseline_ref='${id(30)}' where id='${id(20)}'; ${approve()} ${scope('execute',O)} ${denied(`update interventions set ${change},status='active' where id='${id(20)}';`)} rollback;`);
  }
  sql(`begin; ${fixture()} ${approve()} ${scope('execute',O)} ${denied(`update interventions set approval_content='{}',status='active' where id='${id(20)}';`)} ${denied(`update recommendations set approval_bound=false where id='${id(3)}';`)} rollback;`);
 });
 await t.test('recommendation content frozen, new draft replacement requires owner reapproval',()=>{
  for(const change of ["title='changed'","rationale='changed'","version=2","provenance='{\"changed\":true}'",`owner_id='${U}'`,"status='proposed'","idempotency_key='changed'"]){
   sql(`begin; ${fixture()} ${approve()} ${scope('propose',O)}
    ${denied(`update recommendations set ${change} where id='${id(3)}';`)}
    ${scope('approve')} ${denied(`update recommendations set ${change} where id='${id(3)}';`)}
    update interventions set recommendation_id='${id(4)}',hypothesis='explicitly reapproved' where id='${id(20)}';
    ${scope('execute',O)} update interventions set status='active' where id='${id(20)}';
    do $$begin if (select status from interventions where id='${id(20)}')<>'active' then raise exception 'reapproval positive'; end if; end$$; rollback;`);
  }
 });
 await t.test('measurement definition frozen; result remains operational with assignment and status checks',()=>{
  for(const change of ["unit='changed'","population_ref='changed'","date_start='2025-01-01'","date_end='2027-01-01'","version=2","baseline_ref=null","provenance='{\"changed\":true}'","created_at=now()+interval '1 day'"]){
   sql(`begin; ${fixture()} ${scope('import')} ${snap(30)} ${pub(30)} ${scope('propose',O)} update measurement_plans set baseline_ref='${id(30)}' where id='${id(21)}'; ${approve()} ${scope('execute',O)} update interventions set status='active' where id='${id(20)}'; ${denied(`update measurement_plans set ${change} where id='${id(21)}';`)} rollback;`);
  }
  sql(`begin; ${fixture()} ${approve()} ${scope('execute',O)}
   ${denied(`update measurement_plans set result_ref='too-early' where id='${id(21)}';`)}
   update interventions set status='active' where id='${id(20)}';
   update measurement_plans set result_ref='SYNTHETIC result',updated_at=now() where id='${id(21)}';
   update interventions set status='measuring' where id='${id(20)}';
   update measurement_plans set result_ref='SYNTHETIC measured' where id='${id(21)}';
   update interventions set status='closed' where id='${id(20)}';
   ${denied(`update measurement_plans set result_ref='too-late' where id='${id(21)}';`)}
   do $$begin if (select result_ref from measurement_plans where id='${id(21)}')<>'SYNTHETIC measured' then raise exception 'result positive'; end if; end$$; rollback;`);
 });
 await t.test('plan insertion/deletion, mutable baseline, direct active and forged receipt denied',()=>{
  sql(`begin; ${fixture()} ${scope('import')} ${snap(30)} ${scope('propose',O)} update interventions set baseline_ref='${id(30)}' where id='${id(20)}';
   ${scope('approve')} ${denied(`update interventions set status='approved' where id='${id(20)}';`)}
   ${scope('import')} ${pub(30)} ${approve()} ${scope('execute',O)} update interventions set status='active' where id='${id(20)}';
   ${denied(`insert into measurement_plans(tenant_id,intervention_id,version) values('${A}','${id(20)}',2);`)}
   ${scope('retain')} ${denied(`delete from measurement_plans where id='${id(21)}';`)}
   ${scope('approve')} ${denied(`insert into interventions(tenant_id,recommendation_id,status,version) values('${A}','${id(3)}','active',1);`)}
   ${denied(`insert into interventions(tenant_id,recommendation_id,status,version,approval_content) values('${A}','${id(3)}','draft',1,'{}');`)} rollback;`);
 });

 await t.test('draft editing/retention stays legal; revoked and unassigned operators cannot record results',()=>{
  const X='33333333-3333-4333-8333-333333333333';
  sql(`begin; insert into auth.users(id) values('${X}'); insert into memberships(tenant_id,user_id,role,status) values('${A}','${X}','operator','active');
   ${fixture()} update measurement_plans set unit='legitimate draft change' where id='${id(21)}';
   insert into measurement_plans(id,tenant_id,intervention_id,version) values('${id(22)}','${A}','${id(20)}',2);
   ${scope('retain')} delete from measurement_plans where id='${id(22)}';
   do $$begin begin update interventions set updated_at=now()+interval '1 day' where id='${id(20)}'; exception when insufficient_privilege then null; end; end$$;
   reset role; do $$begin if (select updated_at from interventions where id='${id(20)}')<>now() then raise exception 'retain mutated intervention'; end if; end$$;
   ${approve()} ${scope('execute',O)} update interventions set status='active' where id='${id(20)}';
   do $$begin begin update recommendations set updated_at=now()+interval '1 day' where id='${id(3)}'; exception when insufficient_privilege then null; end; end$$;
   reset role; do $$begin if (select updated_at<>created_at from recommendations where id='${id(3)}') then raise exception 'execute mutated recommendation'; end if; end$$;
   ${scope('execute',X)} update measurement_plans set result_ref='UNASSIGNED' where id='${id(21)}';
   reset role; update memberships set status='revoked' where user_id='${O}';
   ${scope('execute',O)} update measurement_plans set result_ref='REVOKED' where id='${id(21)}';
   reset role; do $$begin if (select result_ref from measurement_plans where id='${id(21)}') is not null then raise exception 'unauthorized measurement'; end if; end$$;
   rollback;`);
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

 await t.test('approval serializes recommendation edits and plan updates/inserts in both orders',async()=>{
  for(const [k,kind] of [[200,'recommendation'],[300,'plan-update'],[400,'plan-insert']]){
   for(const approvalFirst of [true,false]){
    const n=k+(approvalFirst?0:50);
    sql(`insert into recommendations(id,tenant_id,problem_id,status,version,title) values('${id(n)}','${A}','${id(2)}','draft',1,'original');
      insert into interventions(id,tenant_id,recommendation_id,status,version,owner_id) values('${id(n+1)}','${A}','${id(n)}','draft',1,'${O}');
      insert into measurement_plans(id,tenant_id,intervention_id,version,unit) values('${id(n+2)}','${A}','${id(n+1)}',1,'original');`);
    const approval=`${scope('approve')} update interventions set status='approved' where id='${id(n+1)}';`;
    // Owner approve capability keeps rows visible after approval; guards must reject,
    // rather than a hidden row creating a false-positive zero-row UPDATE.
    const edit=`${scope('approve')} `+(kind==='recommendation'
      ? `update recommendations set title='changed' where id='${id(n)}';`
      : kind==='plan-update' ? `update measurement_plans set unit='changed' where id='${id(n+2)}';`
      : `insert into measurement_plans(tenant_id,intervention_id,version,unit) values('${A}','${id(n+1)}',2,'changed');`);
    await race(approvalFirst?approval:edit,approvalFirst?edit:approval,result=>{
      if(approvalFirst){assert.notEqual(result.code,0);assert.match(result.err,/approved (recommendation|plan).*immutable/);}
      else assert.equal(result.code,0,result.err);
    });
    assert.equal(sql(`select status from interventions where id='${id(n+1)}'`),'approved');
    const content=JSON.parse(sql(`select approval_content from interventions where id='${id(n+1)}'`));
    if(kind==='recommendation')assert.equal(content.recommendation.title,approvalFirst?'original':'changed');
    if(kind==='plan-update')assert.equal(content.plans[0].unit,approvalFirst?'original':'changed');
    if(kind==='plan-insert')assert.equal(content.plans.length,approvalFirst?1:2);
   }
  }
 });
});
