import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {setup,q} from './support/F03-sync/harness.mjs';
import {backend} from './support/F01-03/import-uploads/oracles.mjs';
import {read,write} from './support/F01-03/harness.mjs';
import {insert} from './support/F01-03/matrix.mjs';
import {randomUUID} from 'node:crypto';
test('CRM SQL security mutants and scheduler operation approval', {timeout:240000},async t=>{
 const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-crm-security-'));let h;const mutants=[];
 try{
  h=await setup(process.env.VEXA_CANDIDATE,evidence);
  const a=h.actor(),b=h.actor(),worker=h.actor('analyst',a.tenant),dual=h.actor('owner',a.tenant);
  h.sql(`INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(b.tenant)},${q(dual.id)},'owner','active');INSERT INTO worker_delegations(tenant_id,user_id,enabled) VALUES(${q(a.tenant)},${q(worker.id)},true)`);
  const settings=actor=>({id:randomUUID(),tenant_id:actor.tenant,connection_id:actor.connection,actor_id:actor.id,enabled:true,history_from:'2025-01-01',backfill_to:'2026-01-01'}),x=settings(a),y=settings(b);
  h.sql(insert('crm_sync_settings',x)+';'+insert('crm_sync_settings',y)+';');
  const ddl=fs.readFileSync(path.join(process.env.VEXA_CANDIDATE,'supabase/migrations/0013_crm_runtime.sql'),'utf8');
  const fn=name=>{const start=ddl.indexOf('create function public.'+name);assert.ok(start>=0);const end=ddl.indexOf('$$;',start);assert.ok(end>start);return ddl.slice(start,end+3).replace('create function','create or replace function');};
  async function mutant(name,change,restore,oracle,target){
   oracle();let caught;
   try{h.sql(change);try{oracle();}catch(e){caught=e;}assert.equal(caught?.code,'ERR_ASSERTION','MUTANT_MUST_FAIL_ASSERTION:'+name);assert.match(caught.message,target,'MUTANT_SPECIFIC_ORACLE:'+name);}
   finally{h.sql(restore);oracle();}
   mutants.push({name,baseline:'pass',mutation:'assertion-rejected',restored:'pass'});
  }
  await t.test('tenant scope mutation is caught by a dual-member functional query',()=>mutant('dual-scope',
   'ALTER POLICY crm_read ON crm_sync_settings USING(public.vexa_member(tenant_id));',
   "ALTER POLICY crm_read ON crm_sync_settings USING(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));",
   ()=>{const r=backend(h,read('crm_sync_settings'),dual,a.tenant,'read');assert.equal(r.code,'00000');assert.deepEqual(r.rows.map(row=>row.id),[x.id],'CRM_DUAL_SCOPE');},/CRM_DUAL_SCOPE/));
  await t.test('worker configuration mutation is caught by an actual UPDATE',()=>mutant('worker-config',
   "CREATE OR REPLACE FUNCTION public.crm_settings_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN RETURN NEW;END$$;",
   fn('crm_settings_guard'),
   ()=>{const r=backend(h,write(`UPDATE crm_sync_settings SET generation=generation+1 WHERE id=${q(x.id)}`),worker,a.tenant,'import');assert.equal(r.code,'42501','CRM_WORKER_CONFIG');},/CRM_WORKER_CONFIG/));
  await t.test('original owner revocation mutation is caught by delegated authorization',()=>mutant('owner-revocation',
   fn('crm_actor_authorized').replace("actor.status='active' and ",''),fn('crm_actor_authorized'),
   ()=>{const r=backend(h,`SELECT jsonb_build_array(jsonb_build_object('allowed',public.crm_actor_authorized(${q(a.connection)}))) INTO result;`,worker,a.tenant,'import',`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(a.tenant)} AND user_id=${q(a.id)};`);assert.equal(r.code,'00000');assert.equal(r.rows[0].allowed,false,'CRM_OWNER_REVOKED');},/CRM_OWNER_REVOKED/));
  await t.test('cron registration rejects absent approval and uses separate encrypted secret and revocation',()=>{
   const original=fs.readFileSync(path.join(process.env.VEXA_CANDIDATE,'supabase/operations/crm-cron.sql'),'utf8');
   const body=original.slice(original.indexOf('DO $$'),original.indexOf('commit;'));
   const denied=h.probe(body);assert.equal(denied.code,'P0001','CRON_APPROVAL_REQUIRED');
   h.sql('CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net; CREATE EXTENSION IF NOT EXISTS supabase_vault;');
   // The registration and revocation happen in one rolled-back transaction. No job
   // becomes visible to cron and no request is sent to this reserved .invalid host.
   const approved=`PERFORM set_config('vexa.crm_bootstrap_approved','yes',true); PERFORM set_config('vexa.crm_endpoint','https://synthetic-vexa.invalid/api/internal/crm',true); PERFORM set_config('vexa.crm_secret','SYN-'||repeat('x',40),true);`;
   const register=h.probe(approved+body+`SELECT jsonb_build_array(jsonb_build_object('jobs',(SELECT count(*) FROM cron.job WHERE jobname='vexa-crm-chunk' AND schedule='30 seconds' AND command LIKE '%vault.decrypted_secrets%' AND command NOT LIKE '%SYN-%'),'secret',(SELECT count(*) FROM vault.secrets WHERE name='vexa_crm_trigger'))) INTO result;`);
   fs.writeFileSync(path.join(evidence,'cron-register-probe.json'),JSON.stringify(register),{mode:0o600});assert.equal(register.code,'00000','CRON_REGISTRATION');assert.deepEqual(register.rows,[{jobs:1,secret:1}]);
   const revoked=h.probe(approved+body+"PERFORM set_config('vexa.crm_revoke','yes',true);"+body+"SELECT jsonb_build_array(jsonb_build_object('jobs',(SELECT count(*) FROM cron.job WHERE jobname='vexa-crm-chunk'))) INTO result;");
   assert.equal(revoked.code,'00000','CRON_REVOCATION');assert.deepEqual(revoked.rows,[{jobs:0}]);
   assert.equal(h.sql("SELECT count(*) FROM cron.job WHERE jobname='vexa-crm-chunk'"),'0','CRON_NO_PERSISTED_EFFECT');
  });
  h.verifySources();fs.writeFileSync(path.join(evidence,'mutants.json'),JSON.stringify(mutants),{mode:0o600});
 }finally{if(h)await h.close();console.log('CRM_SECURITY_EVIDENCE:'+evidence);}
});
