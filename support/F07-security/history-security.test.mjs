import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {recoverOwnedResources} from './history-cleanup.mjs';
import {runHistoryChild} from './history-process.mjs';

const expected=[
  'real CRM historical backfill and explicit owner consent before admission',
  'bounded real background API advances with UI closed',
  'actual CLI termination after commit preserves progress and resumes without duplicate requests',
  'all 102 canonical conversations reach real extraction and grouping without manual submit',
  'cancelled batch stops only its own children; cross-tenant identifiers and missing consent fail',
  'owner revocation blocks children despite active delegated worker and pauses continuation',
  'runtime disabled admits no batch or inference; hosted trigger requires authentication',
];

// Compose the existing functional program; do not replace its actual Auth, SQL,
// HTTP, worker, crash/recovery, browser or provider-fixture assertions.
test('SEC history: complete existing runtime program, exact inventory and cleanup',{timeout:890000},async t=>{
  assert.ok(process.env.VEXA_CANDIDATE,'VEXA_CANDIDATE_REQUIRED');
  const root=fileURLToPath(new URL('../..',import.meta.url));
  const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'rovaq-f07-history-wrapper-'));fs.chmodSync(evidence,0o700);
  const log=path.join(evidence,'history-runtime.log');
  const inheritedBroker=process.env.VEXA_CI_BROKER,inheritedJournal=process.env.VEXA_CI_JOURNAL;
  assert.equal(inheritedBroker!==undefined,inheritedJournal!==undefined,'HISTORY_BROKER_JOURNAL_PAIR_REQUIRED');
  const broker=inheritedBroker??randomUUID(),journal=inheritedJournal??path.join(evidence,'resources.jsonl');
  assert.match(broker,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,'HISTORY_BROKER_REQUIRED');
  if(inheritedJournal===undefined)fs.writeFileSync(journal,'',{flag:'wx',mode:0o600});
  const journalStat=fs.lstatSync(journal);
  assert.ok(journalStat.isFile()&&!journalStat.isSymbolicLink(),'HISTORY_REGULAR_JOURNAL_REQUIRED');
  assert.equal(journalStat.mode&0o777,0o600,'HISTORY_JOURNAL_MUST_BE_0600');
  for(const line of fs.readFileSync(journal,'utf8').split('\n').filter(Boolean))assert.equal(JSON.parse(line).broker,broker,'HISTORY_JOURNAL_BROKER_MISMATCH');
  // Existing history infrastructure reads its evidence-local journal before
  // the inherited broker copies that journal there at cleanup. Adapt only that
  // lookup in a disposable control module, retaining every ownership check.
  const sourceFile=path.join(root,'packages/history/tests/harness.mjs'),original=fs.readFileSync(sourceFile,'utf8');
  const anchor="const journal=path.join(evidence,'resources.jsonl');";
  assert.equal(original.split(anchor).length,2,'HISTORY_JOURNAL_ADAPTER_UNIQUE');
  const adapted=original.replace(anchor,"const journal=process.env.VEXA_CI_JOURNAL??path.join(evidence,'resources.jsonl');");
  const adapter=path.join(evidence,'history-harness-adapter.mjs');fs.writeFileSync(adapter,adapted,{flag:'wx',mode:0o600});
  const sha=value=>createHash('sha256').update(value).digest('hex');
  fs.writeFileSync(path.join(evidence,'history-harness-adapter.json'),JSON.stringify({sourceFile,sourceSHA256:sha(original),adapter,adapterSHA256:sha(adapted),change:'Select exclusive inherited resource journal before evidence-local fallback; preserve 0600, broker label and database-ID ownership assertions'},null,2),{mode:0o600});
  const env={...process.env,VEXA_CI_BROKER:broker,VEXA_CI_JOURNAL:journal,F07_HISTORY_HARNESS:adapter};delete env.NODE_TEST_CONTEXT;delete env.NODE_OPTIONS;delete env.HISTORY_FOCAL;
  const fd=fs.openSync(log,'wx',0o600);
  const sharedGroup=inheritedBroker!==undefined;
  let result;
  try{result=await runHistoryChild({args:[path.join(root,'support/F07-security/history-runtime.mjs')],cwd:root,env,fd,sharedGroup,abortSignal:t.signal,receiptPath:path.join(evidence,'history-process.json')});}
  finally{fs.closeSync(fd);}
  console.log('F07_HISTORY_RUNTIME_LOG:'+log);
  const failed=result.hardKilled||result.timedOut||result.spawnError||result.lifecycleErrors.length||result.exitCode!==0||result.signal!==null;
  // Delegated mode shares the outer group: only that controller can establish
  // absence of every descendant before recovering its exclusive resource journal.
  if(failed&&!sharedGroup){
    assert.equal(result.processGroupAbsent,true,'HISTORY_RECOVERY_BLOCKED_LIVE_OR_UNKNOWN_GROUP');
    recoverOwnedResources({journal,broker,evidence:path.join(evidence,'recovery.json')});
  }
  assert.equal(result.spawnError,null);assert.deepEqual(result.lifecycleErrors,[]);
  assert.equal(result.timedOut,false,'HISTORY_RUNTIME_TIMEOUT');
  assert.equal(result.exitCode,0,'HISTORY_RUNTIME_EXIT:'+log);assert.equal(result.signal,null,'HISTORY_RUNTIME_SIGNAL');
  const text=fs.readFileSync(log,'utf8'),markers=[...text.matchAll(/^HISTORY328_EVIDENCE:(.+)$/gm)];
  assert.equal(markers.length,1,'EXACT_HISTORY_EVIDENCE');
  const source=fs.realpathSync(markers[0][1]),temporary=fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(source),temporary,'HISTORY_OWN_TEMP_DIRECTORY');
  assert.ok(path.basename(source).startsWith('vexa-history328-'),'HISTORY_EVIDENCE_PREFIX');
  const report=JSON.parse(fs.readFileSync(path.join(source,'report.json'),'utf8'));
  assert.equal(report.status,'pass');assert.equal(fs.realpathSync(report.candidate),fs.realpathSync(env.VEXA_CANDIDATE));
  assert.deepEqual(report.checks.map(item=>item.name),expected,'COMPLETE_HISTORY_INVENTORY_NO_FOCAL_SHORTCUT');
  for(const item of report.checks)await t.test(item.name,()=>assert.equal(item.status,'pass'));
  const publications=JSON.parse(fs.readFileSync(path.join(source,'revocation-publication.json'),'utf8'));
  assert.deepEqual(Object.keys(publications.before).sort(),['embeddings','evidence_spans','extraction_claims','extraction_inputs','extraction_runs','issues','problem_embedding_members','problems','redaction_maps'].sort());
  assert.deepEqual(publications.after,publications.before,'HISTORY_PUBLICATION_BYTES_UNCHANGED');
  assert.equal(publications.providerAfter,publications.providerBefore,'HISTORY_PROVIDER_CALLS_UNCHANGED');
  assert.equal(report.cleanup?.ownResourcesRemoved,true);assert.equal(report.cleanup?.temporaryPathsRemoved,true);
  assert.ok(report.cleanup.resources.length>0&&report.cleanup.resources.every(resource=>resource.absent===true),'HISTORY_CLEANUP');
  fs.writeFileSync(path.join(evidence,'composition.json'),JSON.stringify({source,entry:'support/F07-security/history-runtime.mjs',original:'packages/history/tests/functional.mjs at 95b4ec8',checks:expected.length,scope:'control copy adds before/after SQL publication and provider-call oracles; existing real local infrastructure and synthetic providers; candidate harness/config dependencies remain visible in global source snapshot',accepted:false},null,2),{mode:0o600});
});
