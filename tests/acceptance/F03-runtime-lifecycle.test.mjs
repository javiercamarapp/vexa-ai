import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {setup,q} from './support/F03-sync/harness.mjs';

test('CRM scheduler lifecycle with actual SQL and synthetic provider', {timeout:240000}, async t=>{
 const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-crm-lifecycle-'));let h;
 try{
  h=await setup(process.env.VEXA_CANDIDATE,evidence);
  const {createCRMRuntime}=await import(pathToFileURL(path.join(h.built,'packages/connectors/runtime.mjs')));
  const {createCRMCredentialResolver}=await import(pathToFileURL(path.join(h.built,'packages/connectors/credentials.mjs')));
  const fixture=async()=>{
   const owner=h.actor(),bot=h.actor('analyst',owner.tenant);
   h.sql(`INSERT INTO worker_delegations(tenant_id,user_id,enabled) VALUES(${q(owner.tenant)},${q(bot.id)},true)`);
   const settings={source:'zendesk',accountId:'SYN-lifecycle',credentialRef:'syn',enabled:true,historyFrom:'2026-01-01T00:00:00Z',overlapSeconds:120,pollSeconds:300};
   let calls=0;
   const resolver=createCRMCredentialResolver(JSON.stringify([{tenantId:owner.tenant,ref:'syn',source:'zendesk',accountId:settings.accountId,token:'SYN-private-token',subdomain:'synthetic-vexa'}]));
   const transport=async url=>{calls++;const u=new URL(url),stamp='2026-09-20T12:00:00Z';return Response.json(u.pathname.includes('/incremental/')?{tickets:[{id:101,status:'open',created_at:stamp,updated_at:stamp}],after_cursor:'SYN-end',end_of_stream:true}:u.pathname.includes('/comments')?{comments:[{id:1001,author_id:3,public:true,plain_body:'SYNTHETIC lifecycle',created_at:stamp}],meta:{has_more:false}}:{user:{id:3,role:'end-user'}});};
   const ownerDB=h.repository(owner).database,workerDB=h.repository(bot).database;
   const configure=createCRMRuntime({database:ownerDB,resolveCredentials:resolver});
   const row=await configure.configure(settings);
   return {owner,bot,ownerDB,workerDB,settings,row,resolver,transport,configure,get calls(){return calls;},worker:createCRMRuntime({database:workerDB,resolveCredentials:resolver,fetch:transport}),due(){h.sql(`UPDATE crm_sync_settings SET next_attempt_at=now()-interval '1 second' WHERE connection_id=${q(row.connectionId)}`);}};
  };
  await t.test('configuration CAS rolls back credential updates and history changes start a new generation',async()=>{
   const f=await fixture();assert.equal((await f.worker.tick()).state,'done');
   const snapshot=h.json(`SELECT row_to_json(s) FROM crm_sync_settings s WHERE connection_id=${q(f.row.connectionId)}`);
   const edit={...f.settings,connectionId:f.row.connectionId,expectedVersion:f.row.version};
   const paused=await f.configure.configure({...edit,enabled:false});
   await assert.rejects(f.configure.configure({...edit,credentialRef:'stale-edit'}));
   assert.equal(h.sql(`SELECT credential_ref FROM connections WHERE id=${q(f.row.connectionId)}`),'syn','STALE_CONFIG_PARTIALLY_COMMITTED');
   f.due();const before=f.calls;assert.equal((await f.worker.tick()).state,'idle');assert.equal(f.calls,before,'PAUSED_CONFIG_FETCHED');
   const resumed=await f.configure.configure({...edit,expectedVersion:paused.version});
   assert.equal(resumed.backfillTo,f.row.backfillTo,'RESUME_RESTARTED_HISTORY');
   const changed=await f.configure.configure({...edit,expectedVersion:resumed.version,historyFrom:'2025-12-01T00:00:00Z'});
   const generation=h.sql(`SELECT generation FROM crm_sync_settings WHERE connection_id=${q(f.row.connectionId)}`);
   assert.equal(Number(generation),snapshot.generation+1,'HISTORY_CHANGE_REUSED_OLD_CURSOR');
   assert.equal((await f.worker.tick()).state,'done');
   assert.equal(h.sql(`SELECT count(DISTINCT window_spec->>'version') FROM sync_cursors WHERE connection_id=${q(f.row.connectionId)}`),'2');
   assert.equal(h.sql(`SELECT count(*) FROM messages WHERE connection_id=${q(f.row.connectionId)}`),'1','HISTORY_RESCAN_DUPLICATED_MESSAGE');
   assert.equal(changed.historyFrom,'2025-12-01T00:00:00.000Z');
  });
  await t.test('missing credentials stop after four scheduled attempts without provider calls or secret persistence',async()=>{
   const f=await fixture(),worker=createCRMRuntime({database:f.workerDB,resolveCredentials:createCRMCredentialResolver('[]'),fetch:f.transport});
   for(let n=1;n<=4;n++){
    f.due();const result=await worker.tick();assert.equal(result.state,'blocked');assert.equal(result.code,'CRM_CREDENTIAL_CONFIGURATION_REQUIRED');
    const row=h.json(`SELECT jsonb_build_object('failures',failure_count,'seconds',extract(epoch from next_attempt_at-clock_timestamp())) FROM crm_sync_settings WHERE connection_id=${q(f.row.connectionId)}`);
    assert.equal(row.failures,n);assert.ok(row.seconds>25*2**(n-1)&&row.seconds<=30*2**(n-1),'RETRY_BACKOFF');
   }
   f.due();assert.equal((await worker.tick()).state,'idle');assert.equal(f.calls,0);
   assert.doesNotMatch(h.sql(`SELECT row_to_json(s)::text FROM crm_sync_settings s WHERE connection_id=${q(f.row.connectionId)}`),/SYN-private-token/);
   const reset=await f.configure.configure({...f.settings,connectionId:f.row.connectionId,expectedVersion:f.row.version});assert.equal(reset.failureCount,0);assert.equal((await f.worker.tick()).state,'done');
  });
  await t.test('concurrent dispatchers claim one connection once and keep canonical deduplication',async()=>{
   const f=await fixture();const second=createCRMRuntime({database:h.repository(f.bot).database,resolveCredentials:f.resolver,fetch:f.transport});
   const results=await Promise.all([f.worker.tick(),second.tick()]);assert.deepEqual(results.map(r=>r.state).sort(),['done','idle']);
   assert.equal(f.calls,3,'CONCURRENT_DISPATCH_DUPLICATED_PROVIDER');assert.equal(h.sql(`SELECT count(*) FROM messages WHERE connection_id=${q(f.row.connectionId)}`),'1');
  });
  await t.test('worker may dispatch but cannot change identity, enabled state, history, credentials or tenant',async()=>{
   const f=await fixture(),other=h.actor();
   for(const assignment of ["enabled=false","history_from='2020-01-01'","actor_id="+q(f.bot.id),'generation=generation+1','version=version+1','tenant_id='+q(other.tenant)]){
    await assert.rejects(f.workerDB.transaction('import',s=>s.query(`UPDATE crm_sync_settings SET ${assignment} WHERE tenant_id=$1 AND connection_id=$2`,[f.owner.tenant,f.row.connectionId])),undefined,'WORKER_CONFIG_CHANGED:'+assignment);
   }
   await assert.rejects(f.workerDB.transaction('import',s=>s.query("UPDATE connections SET credential_ref='attack' WHERE tenant_id=$1 AND id=$2",[f.owner.tenant,f.row.connectionId])));
   const otherDB=h.repository(other).database;
   assert.equal((await otherDB.transaction('read',s=>s.query('SELECT id FROM crm_sync_settings WHERE connection_id=$1',[f.row.connectionId]))).rowCount,0);
   for(const role of ['anon','authenticated','service_role'])assert.equal(h.probe(`SET LOCAL ROLE ${role}; PERFORM * FROM crm_sync_settings;`).code,'42501','DIRECT_ROLE_PRIVATE_SETTINGS:'+role);
   assert.equal((await f.worker.tick()).state,'done','SECURITY_PROBES_DAMAGED_VALID_CONFIG');
  });
  await t.test('credential references cannot cross tenant, source, account or permit arbitrary outbound hosts',async()=>{
   const f=await fixture(),context={tenantId:f.owner.tenant,source:'zendesk',accountId:'SYN-lifecycle',credentialRef:'syn'};
   assert.deepEqual(f.resolver(context),{token:'SYN-private-token',subdomain:'synthetic-vexa'});
   for(const delta of [{tenantId:f.bot.id},{source:'hubspot'},{accountId:'SYN-foreign'},{credentialRef:'missing'}])assert.throws(()=>f.resolver({...context,...delta}),{code:'CRM_CREDENTIAL_CONFIGURATION_REQUIRED'});
   for(const subdomain of ['127.0.0.1','synthetic-vexa.zendesk.com','x@host','https://host','host/path'])assert.throws(()=>createCRMCredentialResolver(JSON.stringify([{tenantId:f.owner.tenant,ref:'syn',source:'zendesk',accountId:'SYN-lifecycle',token:'SYN-private-token',subdomain}])),{code:'CRM_CREDENTIAL_CONFIGURATION_REQUIRED'});
  });
  h.verifySources();
 }finally{if(h)await h.close();console.log('CRM_LIFECYCLE_EVIDENCE:'+evidence);}
});
