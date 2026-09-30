import test from 'node:test';import assert from 'node:assert/strict';
import {launch,candidateInputs} from '../harness.mjs';
import {seed,foreignKeys} from '../oracles.mjs';
import {q,ident} from '../matrix.mjs';
import * as workers from '../worker-delegations/oracles.mjs';
import * as crm from '../crm-runtime/oracles.mjs';
import * as webhooks from './oracles.mjs';
test('CRM webhook matrix sensitivity on real SQL',{timeout:300000},async t=>{
 const h=await launch({services:true});t.after(()=>h.close());for(const sql of candidateInputs(process.env.VEXA_CANDIDATE))h.sql(sql);
 assert.ok(webhooks.present(h),'WEBHOOK_MUTATIONS_REQUIRE_0040');
 const actors={};for(const key of ['a','b','dual','outsider','viewer','analyst','operator'])actors[key]=await h.user();
 const f=seed(h,actors);workers.seedWorkers(h,actors);crm.seed(h,f,actors);const rows=webhooks.seed(h,f);
 const schema=()=>webhooks.schema(h,foreignKeys(h)),access=()=>webhooks.access(h,rows,actors);
 const cycle=async(name,oracle,mutate,restore,expected)=>t.test(name,()=>{oracle();try{h.sql(mutate);assert.throws(oracle,e=>e.code==='ERR_ASSERTION'&&e.message.includes(expected),'EXPECTED_TARGET_ASSERTION');}finally{h.sql(restore);}oracle();t.diagnostic('positive -> '+expected+' -> restored positive');});
 await cycle('RLS off',schema,'ALTER TABLE crm_webhook_receipts DISABLE ROW LEVEL SECURITY','ALTER TABLE crm_webhook_receipts ENABLE ROW LEVEL SECURITY','CRM_WEBHOOK_FORCED_RLS');
 const read=h.sql("SELECT pg_get_expr(polqual,polrelid) FROM pg_policy WHERE polrelid='crm_webhook_receipts'::regclass AND polname='crm_webhook_read'");
 await cycle('read scope removed',access,'ALTER POLICY crm_webhook_read ON crm_webhook_receipts USING(true)',`ALTER POLICY crm_webhook_read ON crm_webhook_receipts USING(${read})`,'CRM_WEBHOOK_CURRENT_AUTHORIZED_READ');
 const check=h.sql("SELECT pg_get_expr(polwithcheck,polrelid) FROM pg_policy WHERE polrelid='crm_webhook_receipts'::regclass AND polname='crm_webhook_insert'");
 await cycle('insert scope removed',access,'ALTER POLICY crm_webhook_insert ON crm_webhook_receipts WITH CHECK(true)',`ALTER POLICY crm_webhook_insert ON crm_webhook_receipts WITH CHECK(${check})`,'CRM_WEBHOOK_INSERT_CROSS');
 const prune=h.sql("SELECT pg_get_expr(polqual,polrelid) FROM pg_policy WHERE polrelid='crm_webhook_receipts'::regclass AND polname='crm_webhook_prune'");
 await cycle('age guard removed',access,`ALTER POLICY crm_webhook_prune ON crm_webhook_receipts USING(${read})`,`ALTER POLICY crm_webhook_prune ON crm_webhook_receipts USING(${prune})`,'CRM_WEBHOOK_NO_PREMATURE_DELETE');
 await cycle('received_at write granted',access,'GRANT INSERT(received_at) ON crm_webhook_receipts TO vexa_backend','REVOKE INSERT(received_at) ON crm_webhook_receipts FROM vexa_backend','CRM_WEBHOOK_TIMESTAMP_FORGE');
 for(const fk of foreignKeys(h).filter(k=>k.table===webhooks.table)){
  const definition=h.sql(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='crm_webhook_receipts'::regclass AND conname=${q(fk.name)}`),drop=`ALTER TABLE crm_webhook_receipts DROP CONSTRAINT ${ident(fk.name)}`,restore=`ALTER TABLE crm_webhook_receipts ADD CONSTRAINT ${ident(fk.name)} ${definition}`;
  await cycle('missing FK catalog '+fk.parent,schema,drop,restore,'CRM_WEBHOOK_FK_COUNT');
  if(fk.parent==='connections')await cycle('cross-tenant physical FK removed',()=>webhooks.fk(h,rows,fk),drop,restore,'CRM_WEBHOOK_FK_CROSS');
 }
});
