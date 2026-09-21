import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {setup,q} from './harness.mjs';
test('extraction claims bind current actor and the running extraction job',{timeout:180000},async t=>{
 const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-extraction-claims-'));let h;
 try{
  h=await setup(process.env.VEXA_CANDIDATE,evidence);const a=await h.actor(),foreign=await h.actor(),connection=randomUUID(),conversation=randomUUID(),run=randomUUID(),job=h.job(a),otherJob=h.job(a),token=randomUUID();
  h.sql(`INSERT INTO connections(id,tenant_id,source,account_id) VALUES(${q(connection)},${q(a.tenant)},'csv','SYN-claims');INSERT INTO conversations(id,tenant_id,connection_id,source,external_id) VALUES(${q(conversation)},${q(a.tenant)},${q(connection)},'csv','SYN-claims');INSERT INTO extraction_runs(id,tenant_id,conversation_id,job_id,model_id,prompt_hash,schema_hash,input_hash,status) VALUES(${q(run)},${q(a.tenant)},${q(conversation)},${q(job)},'unattempted','SYN-prompt','SYN-schema','SYN-input','running')`);
  const probe=({actor=a.id,jobId=job,prepare=''}={})=>h.probe(`${prepare} GRANT ALL ON exam_result TO vexa_backend; SET LOCAL ROLE vexa_backend;PERFORM set_config('request.jwt.claim.sub',${q(a.id)},true);PERFORM set_config('vexa.tenant_id',${q(a.tenant)},true);PERFORM set_config('vexa.action','import',true);INSERT INTO extraction_claims(tenant_id,run_id,job_id,task_key,actor_id,owner_token) VALUES(${q(a.tenant)},${q(run)},${q(jobId)},'SYN-task',${q(actor)},${q(token)});GET DIAGNOSTICS affected=ROW_COUNT;result=jsonb_build_array(jsonb_build_object('affected',affected));`);
  await t.test('valid current actor and matching running job are accepted',()=>{const r=probe();assert.equal(r.code,'00000');assert.deepEqual(r.rows,[{affected:1}]);});
  await t.test('another tenant actor cannot be attributed to this claim',()=>{const r=probe({actor:foreign.id});fs.writeFileSync(path.join(evidence,'actor-probe.json'),JSON.stringify(r),{mode:0o600});assert.equal(r.code,'42501','EXTRACTION_CLAIM_ACTOR_SPOOF');});
  await t.test('claim job must match its extraction run',()=>{const r=probe({jobId:otherJob});fs.writeFileSync(path.join(evidence,'job-probe.json'),JSON.stringify(r),{mode:0o600});assert.equal(r.code,'42501','EXTRACTION_CLAIM_JOB_MISMATCH');});
  for(const [name,prepare]of [
   ['cancelled',`UPDATE jobs SET cancel_requested_at=now() WHERE id=${q(job)};`],
   ['terminal',`UPDATE jobs SET state='succeeded' WHERE id=${q(job)};`],
   ['wrong job type',`UPDATE jobs SET type='import' WHERE id=${q(job)};`],
   ['terminal run',`UPDATE extraction_runs SET status='failed' WHERE id=${q(run)};`]
  ])await t.test(name+' cannot create an active extraction claim',()=>assert.equal(probe({prepare}).code,'42501','EXTRACTION_CLAIM_JOB_STATE:'+name));
  h.verifySources();
 }finally{if(h)await h.close();console.log('F04_CLAIMS_EVIDENCE:'+evidence);}
});
