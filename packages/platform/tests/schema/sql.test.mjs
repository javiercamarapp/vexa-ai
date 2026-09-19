import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
// Dedicated disposable PostgreSQL17 image; no published ports, no shared DB.
// Auth and Storage SQL fixtures below are SYNTHETIC, not HTTP service verification.
function run(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:30000,maxBuffer:4e6});assert.equal(r.status,0,`docker ${args[0]}: ${r.stderr}`);return r.stdout.trim();}
test('SYNTHETIC PostgreSQL17: migrations, constraints, RLS, backend', {timeout:90000},async t=>{
 const name='vexa-schema-syn-'+randomUUID();
 t.after(()=>run(['rm','-f','-v',name]));
 run(['run','--pull','never','--name',name,'-d','-e','POSTGRES_HOST_AUTH_METHOD=trust','public.ecr.aws/supabase/postgres:17.6.1.159']);
 const sql=s=>run(['exec','-i',name,'psql','-X','-qAt','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],s);
 let ready=false;
 for(let i=0;i<100;i++){const r=spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1'],{encoding:'utf8'});if(r.status===0){try{if(sql("select count(*) from pg_roles where rolname='authenticated'")==='1'){ready=true;break;}}catch{}}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'own PostgreSQL ready');
 sql(`create schema if not exists storage;
 create table if not exists storage.buckets(id text primary key,name text,public boolean);
 create table if not exists storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security; grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
 for(const f of fs.readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort())sql(fs.readFileSync(path.join('supabase/migrations',f),'utf8'));
 const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',U='11111111-1111-4111-8111-111111111111';
 sql(`insert into auth.users(id) values('${U}');insert into organizations(id,name) values('${A}','SYNTHETIC A'),('${B}','SYNTHETIC B');insert into memberships(tenant_id,user_id,role,status) values('${A}','${U}','owner','active'),('${B}','${U}','owner','active');`);
 assert.equal(sql("select count(*) from pg_tables where schemaname='public' and tablename not in ('organizations','memberships')"),'36');
 const checks=`
 insert into connections(id,tenant_id,source,account_id,status) values('10000000-0000-4000-8000-000000000001','${A}','synthetic','42','active'),('10000000-0000-4000-8000-000000000002','${B}','synthetic','42','active');
 set role authenticated; select set_config('request.jwt.claim.sub','${U}',false);
 do $$begin
 if (select count(*) from connections)<>2 then raise exception 'dual read';end if;
 begin update connections set tenant_id='${B}',account_id='new' where tenant_id='${A}';raise exception 'tenant mutable';exception when check_violation then null;end;
 end$$;
 reset role;
 update memberships set status='revoked' where tenant_id='${B}';
 set role authenticated;
 do $$begin
 if (select count(*) from connections)<>1 then raise exception 'revoked read';end if;
 begin insert into connections(tenant_id,source,account_id,status) values('${B}','synthetic','unauthorized','active');raise exception 'revoked write';exception when insufficient_privilege then null;end;
 end$$;
 reset role;
 insert into orders(id,tenant_id,external_id,amount_minor,currency,exponent,occurred_at) values('20000000-0000-4000-8000-000000000001','${B}','42',null,'USD',2,now());
 do $$begin
 begin insert into order_lines(tenant_id,order_id,currency,exponent) values('${A}','20000000-0000-4000-8000-000000000001','USD',2);raise exception 'cross FK';exception when foreign_key_violation then null;end;
 begin insert into orders(tenant_id,external_id,amount_minor,currency,exponent,occurred_at) values('${A}','bad',-1,'USD',2,now());raise exception 'negative money';exception when check_violation then null;end;
 begin insert into imports(tenant_id,file_hash,mapping_version,idempotency_key,total,pending) values('${A}','SYN','1','SYN',2,1);raise exception 'bad counters';exception when check_violation then null;end;
 end$$;
 begin;
 set local role vexa_backend;
 select set_config('vexa.tenant_id','${A}',true);
 select set_config('vexa.action','import',true);
 insert into jobs(tenant_id,type,input_ref,input_hash,version) values('${A}','SYN','SYN','SYN','1');
 do $$begin
 begin insert into jobs(tenant_id,type,input_ref,input_hash,version) values('${B}','SYN','SYN','SYN','1');raise exception 'backend escape';exception when insufficient_privilege then null;end;
 end$$;
 select set_config('vexa.action','propose',true);
 do $$begin
 begin insert into jobs(tenant_id,type,input_ref,input_hash,version) values('${A}','ESCAPE','SYN','ESCAPE','1');raise exception 'action escape';exception when insufficient_privilege then null;end;
 end$$;
 rollback;
 `;
 sql(checks);
 sql(`
 update memberships set role='analyst' where tenant_id='${A}' and user_id='${U}';
 begin; set local role vexa_backend;
 select set_config('request.jwt.claim.sub','${U}',true),set_config('vexa.tenant_id','${A}',true),set_config('vexa.action','configure',true);
 do $$begin
 begin insert into connections(tenant_id,source,account_id) values('${A}','SYN','role-escape');raise exception 'analyst configured source';exception when insufficient_privilege then null;end;
 end$$;
 select set_config('vexa.action','import',true);
 insert into jobs(tenant_id,type,input_ref,input_hash,version) values('${A}','SYN','SYN','analyst-positive','1');
 rollback;
 update memberships set role='viewer' where tenant_id='${A}' and user_id='${U}';
 begin; set local role vexa_backend;
 select set_config('request.jwt.claim.sub','${U}',true),set_config('vexa.tenant_id','${A}',true),set_config('vexa.action','import',true);
 do $$begin
 begin insert into jobs(tenant_id,type,input_ref,input_hash,version) values('${A}','SYN','SYN','viewer-escape','1');raise exception 'viewer imported';exception when insufficient_privilege then null;end;
 end$$;
 rollback;
 update memberships set role='owner' where tenant_id='${A}' and user_id='${U}';
 `);
 assert.equal(sql("select rolbypassrls or rolsuper from pg_roles where rolname='vexa_backend'"),'f');
 assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'vexa_%' and p.prosecdef"),'0');
 assert.equal(sql(`select amount_minor is null from orders where tenant_id='${B}'`),'t');
 sql(`
 insert into metric_snapshots(id,tenant_id,scope_hash,input_hash,policy_version,status,watermark) values('30000000-0000-4000-8000-000000000001','${A}','SYN','SYN','1','draft',now());
 insert into components(tenant_id,snapshot_id,amount_minor,currency,exponent) values('${A}','30000000-0000-4000-8000-000000000001',null,'USD',2);
 update metric_snapshots set status='published',bundle_ref='SYNTHETIC bundle',published_at=now();
 do $$begin
 begin update components set amount_minor=0;raise exception 'published changed';exception when check_violation then null;end;
 begin insert into metric_snapshots(tenant_id,scope_hash,input_hash,policy_version,status,watermark) values('${A}','SYN2','SYN','1','published',now());raise exception 'publication incomplete';exception when check_violation then null;end;
 end$$;
 insert into economic_events(id,tenant_id,kind,status,amount_minor,currency,exponent,effective_at,source_ref) values('40000000-0000-4000-8000-000000000001','${A}','refund','observed',100,'USD',2,now(),'SYN');
 do $$begin
 begin insert into reversals(tenant_id,reversal_of,amount_minor,currency,exponent) values('${A}','40000000-0000-4000-8000-000000000001',10,'MXN',2);raise exception 'currency reversal';exception when foreign_key_violation then null;end;
 end$$;
 `);
 console.log('PASS SYNTHETIC: 36 tables; migrations; dual-member immutable tenant; fresh revocation; cross FK; money/counters; restricted backend. Storage/Auth HTTP NOT tested.');
});
