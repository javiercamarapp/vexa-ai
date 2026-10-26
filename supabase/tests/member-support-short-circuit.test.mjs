import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startLocalPg} from '../../ops/lib/localpg.mjs';

const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
const owner='00000000-0000-4000-8000-000000000011', viewer='00000000-0000-4000-8000-000000000012', admin='00000000-0000-4000-8000-000000000013', stranger='00000000-0000-4000-8000-000000000014';
const migration=fileURLToPath(new URL('../migrations/20261129000000_member_support_short_circuit.sql',import.meta.url));

test('member RLS: ordinary membership and server-only support remain separate',async t=>{
 const pg=await startLocalPg({label:'member-support'}),db='member_support_test';
 try{
  pg.createDb(db);pg.applySchema(db,{upTo:'20261128000000_cfo_access_log.sql'});
  pg.sql(db,`insert into auth.users(id,email) values ('${owner}','owner@example.invalid'),('${viewer}','viewer@example.invalid'),('${admin}','admin@example.invalid'),('${stranger}','stranger@example.invalid');
   insert into public.organizations(id,name) values ('${A}','SYN A'),('${B}','SYN B');
   insert into public.memberships(tenant_id,user_id,role,status) values ('${A}','${owner}','owner','active'),('${A}','${viewer}','viewer','active');
   insert into vexa_platform.administrators(user_id,active) values ('${admin}',true);
   insert into vexa_platform.support_sessions(admin_id,tenant_id,reason,request_id,expires_at) values ('${admin}','${A}','SYN local regression',gen_random_uuid(),clock_timestamp()+interval '10 minutes');`);
  const as=(role,uid,expr,{action='read',tenant=A,readonly=false}={})=>pg.sql(db,`begin${readonly?' read only':''}; set local role ${role}; set local request.jwt.claim.sub='${uid}'; set local vexa.action='${action}'; set local vexa.tenant_id='${tenant}'; select ${expr}; rollback;`);
  const member=(tenant=A,roles=null)=>`public.vexa_member('${tenant}'${roles===null?'':`,${roles}`})`;
  await t.test('old function reproduces permission denial for a normal owner',()=>assert.throws(()=>as('authenticated',owner,member()),/permission denied for function vexa_support_active/));
  const aclBefore=pg.sql(db,`select proacl::text from pg_proc where oid='public.vexa_member(uuid,text[])'::regprocedure`);
  pg.file(db,migration);
  await t.test('function stays invoker, stable, with the original ACL',()=>{
   const metadata=JSON.parse(pg.sql(db,`select json_build_object('definer',prosecdef,'volatility',provolatile,'config',proconfig)::text from pg_proc where oid='public.vexa_member(uuid,text[])'::regprocedure`));
   assert.deepEqual(metadata,{definer:false,volatility:'s',config:['search_path=""']});
   assert.equal(pg.sql(db,`select proacl::text from pg_proc where oid='public.vexa_member(uuid,text[])'::regprocedure`),aclBefore);
  });
  for(const [name,role,uid,expr,expected,opts] of [
   ['normal owner reads own organization','authenticated',owner,member(),'t'],
   ['owner keeps owner-only access','authenticated',owner,member(A,"array['owner']"),'t'],
   ['owner cannot read other organization','authenticated',owner,member(B),'f'],
   ['viewer reads own organization','authenticated',viewer,member(),'t'],
   ['viewer cannot acquire owner role','authenticated',viewer,member(A,"array['owner']"),'f'],
   ['stranger gets false, not an exception','authenticated',stranger,member(),'f'],
   ['administrator cannot use support from authenticated','authenticated',admin,member(),'f'],
   ['backend support reads A','vexa_backend',admin,member(),'t'],
   ['backend support cannot read B','vexa_backend',admin,member(B),'f'],
   ['backend support cannot request write roles','vexa_backend',admin,member(A,"array['owner','analyst','operator']"),'f'],
   ['support rejects empty requested roles','vexa_backend',admin,member(A,'array[]::text[]'),'f'],
   ['support rejects null requested roles','vexa_backend',admin,member(A,'null::text[]'),'f'],
   ['support rejects non-read action','vexa_backend',admin,member(),'f',{action:'propose'}],
   ['support rejects mismatched transaction tenant','vexa_backend',admin,member(),'f',{tenant:B}],
   ['backend cannot invent support for a stranger','vexa_backend',stranger,member(),'f'],
   ['read-only transaction still admits authorized support','vexa_backend',admin,member(),'t',{readonly:true}],
  ])await t.test(name,()=>assert.equal(as(role,uid,expr,opts),expected));
  await t.test('anonymous cannot execute membership or support checks',()=>{
   assert.equal(pg.sql(db,`select has_function_privilege('anon','public.vexa_member(uuid,text[])','EXECUTE')`),'f');
   assert.throws(()=>as('anon','',member()),/permission denied for function vexa_member/);
  });
  await t.test('private helper remains inaccessible to client roles',()=>{
   for(const role of ['anon','authenticated']){
    assert.equal(pg.sql(db,`select has_function_privilege('${role}','public.vexa_support_active(uuid)','EXECUTE')`),'f');
    assert.throws(()=>as(role,admin,`public.vexa_support_active('${A}')`),/permission denied for function vexa_support_active/);
   }
  });
  await t.test('read-only support cannot mutate rows',()=>assert.throws(()=>pg.sql(db,`begin read only;set local role vexa_backend;delete from public.memberships;rollback;`),/read-only transaction/));
  await t.test('revoked membership fails closed',()=>{
   pg.sql(db,`update public.memberships set status='revoked' where user_id='${owner}'`);
   assert.equal(as('authenticated',owner,member()),'f');
  });
  await t.test('inactive administrator loses support immediately',()=>{
   pg.sql(db,`update vexa_platform.administrators set active=false where user_id='${admin}'`);
   assert.equal(as('vexa_backend',admin,member()),'f');
   pg.sql(db,`update vexa_platform.administrators set active=true where user_id='${admin}'`);
  });
  await t.test('ended support loses access immediately',()=>{
   pg.sql(db,`update vexa_platform.support_sessions set ended_at=clock_timestamp(),end_reason='ended' where admin_id='${admin}'`);
   assert.equal(as('vexa_backend',admin,member()),'f');
  });
  await t.test('expired support loses access immediately',()=>{
   pg.sql(db,`update vexa_platform.support_sessions set ended_at=null,end_reason=null,started_at=clock_timestamp()-interval '20 minutes',expires_at=clock_timestamp()-interval '10 minutes' where admin_id='${admin}'`);
   assert.equal(as('vexa_backend',admin,member()),'f');
  });
  await t.test('source drift guard rejects an unexpected function version',()=>assert.throws(()=>pg.file(db,migration),/VEXA_MEMBER_SOURCE_DRIFT/));
 }finally{await pg.stop();}
});
