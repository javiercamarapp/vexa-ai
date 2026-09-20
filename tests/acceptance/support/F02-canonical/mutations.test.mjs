import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {runtime,q} from '../F02-durable/runtime.mjs';
import {insert} from '../F01-03/matrix.mjs';
import {write,rows} from '../F01-03/harness.mjs';
import {backend} from '../F01-03/import-uploads/oracles.mjs';
test('three real mutants each baseline 0 -> assertion 1 -> restored 0',{timeout:120000},async t=>{
 const candidate=process.env.VEXA_CANDIDATE,h=await runtime(candidate);t.after(()=>h.close());
 const entry=path.join(candidate,'packages/ingestion/persistence/index.mjs');
 const {persistCanonical}=await import(pathToFileURL(entry));
 const db=h.ports.database(new Request('http://fixture.test',{headers:{Authorization:'Bearer '+h.A.token,'x-vexa-organization':h.A.tenant}}));
 const make=sku=>{const payload={sku};const hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');return {row_ref:randomUUID(),mapping_version:'1',payload,envelope:{tenant_id:h.A.tenant,connection_id:h.A.connection,source:'csv',source_account_id:h.sql(`SELECT account_id FROM connections WHERE id=${q(h.A.connection)}`),entity_type:'product',external_id:'mutation-product',source_revision:'1',occurred_at:'2026-09-01T00:00:00Z',observed_at:'2026-09-02T00:00:00Z',content_hash:hash,payload_ref:'sha256:'+hash}};};
 const save=async(fn,record)=>{const id=randomUUID();h.sql(`INSERT INTO imports(id,tenant_id,connection_id,file_hash,mapping_version,state,idempotency_key) VALUES(${q(id)},${q(h.A.tenant)},${q(h.A.connection)},'fixture','1','queued',${q(id)})`);return db.transaction('import',s=>fn(s,{importId:id,record}));};
 assert.equal((await save(persistCanonical,make('ORIGINAL'))).status,'inserted');
 await t.test('DB dedup unique constraint',()=>{
  const row=h.json("SELECT to_jsonb(r) FROM source_revisions r WHERE external_id='mutation-product'");row.id=randomUUID();
  const check=()=>assert.equal(h.probe(write(insert('source_revisions',row))).code,'23505','MUTANT_DEDUP_DB');
  const constraint=h.json("SELECT jsonb_build_object('name',conname,'ddl',pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid='source_revisions'::regclass AND contype='u' AND pg_get_constraintdef(oid) LIKE '%external_id%'");
  assert.ok(constraint?.name,'MUTATION_SETUP_CONSTRAINT');check();
  h.sql(`ALTER TABLE source_revisions DROP CONSTRAINT "${constraint.name}"`);
  try{assert.throws(check,{code:'ERR_ASSERTION',actual:'00000',expected:'23505'});}finally{h.sql(`ALTER TABLE source_revisions ADD CONSTRAINT "${constraint.name}" ${constraint.ddl}`);}check();t.diagnostic('DEDUP 0 -> 1 assertion (00000 vs 23505) -> 0');
 });
 await t.test('real persistence conflict branch',async()=>{
  const check=async fn=>assert.equal((await save(fn,make('CHANGED'))).status,'conflict','MUTANT_CONFLICT');
  await check(persistCanonical);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'f0204-mutant-'));const file=path.join(temp,'mutant.mjs');
  let source=fs.readFileSync(entry,'utf8');assert.ok(source.includes("old.fingerprint===fingerprint?'duplicate':'conflict'"),'MUTATION_SETUP_BRANCH');
  source=source.replace("'../index.mjs'",JSON.stringify(pathToFileURL(path.join(candidate,'packages/ingestion/index.mjs')).href)).replace("old.fingerprint===fingerprint?'duplicate':'conflict'","true?'duplicate':'conflict'");fs.writeFileSync(file,source);
  try{const mutant=await import(pathToFileURL(file));await assert.rejects(check(mutant.persistCanonical),{code:'ERR_ASSERTION',actual:'duplicate',expected:'conflict'});}finally{fs.rmSync(temp,{recursive:true,force:true});}
  await check(persistCanonical);t.diagnostic('CONFLICT 0 -> 1 assertion (duplicate vs conflict) -> 0');
 });
 await t.test('DB tenant insert policy',()=>{
  const row=h.json("SELECT to_jsonb(r) FROM source_revisions r WHERE external_id='mutation-product'");row.id=randomUUID();row.external_id='tenant-mutant';
  const probe=()=>backend(h,write(insert('source_revisions',row)),h.B,h.B.tenant);
  const check=()=>assert.equal(probe().code,'42501','MUTANT_TENANT');
  const expression=h.sql("SELECT pg_get_expr(polwithcheck,polrelid) FROM pg_policy WHERE polrelid='source_revisions'::regclass AND polname='backend_insert'");assert.ok(expression,'MUTATION_SETUP_POLICY');check();
  h.sql('ALTER POLICY backend_insert ON source_revisions WITH CHECK (true)');
  try{assert.throws(check,{code:'ERR_ASSERTION',actual:'00000',expected:'42501'});}finally{h.sql(`ALTER POLICY backend_insert ON source_revisions WITH CHECK (${expression})`);}check();t.diagnostic('TENANT 0 -> 1 assertion (00000 vs 42501) -> 0');
 });
});
