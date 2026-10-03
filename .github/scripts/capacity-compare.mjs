// Experimental, synthetic-only comparison. Does not adopt a product change.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {setup, basePort} from '../../packages/jobs/load/harness.mjs';
import {generateDataset} from '../../packages/jobs/load/generator.mjs';
import {sampleHost, hostReady} from './capacity-host.mjs';
import {createQueryProfile} from './capacity-query-profile.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const rel = 'packages/ingestion/persistence/index.mjs';
export function applyVariant(source, variant) {
  assert.equal(variant.schema, 'vexa-persistence-comparison-variant-v1');
  assert.equal(variant.experimental, true);
  assert.equal(hash(source), variant.baselineSha256, 'VARIANT_BASELINE_MISMATCH');
  assert.equal(variant.changes.length, 2);
  let result = source;
  for (const c of variant.changes) {
    assert.equal(typeof c.before, 'string'); assert.ok(c.before.length > 0);
    assert.equal(typeof c.after, 'string');
    assert.equal(result.split(c.before).length - 1, 1, 'VARIANT_CONTRACT_DRIFT');
    result = result.replace(c.before, () => c.after);
  }
  assert.equal(hash(result), variant.proposalSha256, 'VARIANT_RESULT_MISMATCH');
  return result;
}
export function tree(directory) {
  const result = {};
  const walk = (at, prefix = '') => {
    for (const e of fs.readdirSync(at, {withFileTypes: true}).sort((a,b) => a.name.localeCompare(b.name))) {
      const name = path.posix.join(prefix, e.name), file = path.join(at, e.name);
      if (e.isDirectory()) walk(file, name);
      else { assert.ok(e.isFile(), 'BUILD_TREE_UNSUPPORTED_ENTRY'); result[name] = hash(fs.readFileSync(file)); }
    }
  };
  walk(directory); return result;
}
// Durable ingestion CLI intentionally omits intelligence modules. Add the exact
// candidate reader to this owned comparison build, before cloning the variant.
export function completeComparisonBuild(candidate, built) {
  const relative='packages/intelligence/source-reader.mjs';
  const source=path.join(candidate,relative),target=path.join(built,relative);
  assert.ok(fs.statSync(source).isFile()&&!fs.lstatSync(source).isSymbolicLink(),'SOURCE_READER_FILE_REQUIRED');
  assert.ok(!fs.existsSync(target),'SOURCE_READER_BUILD_ALREADY_PRESENT');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
  const sha256=hash(fs.readFileSync(source));assert.equal(hash(fs.readFileSync(target)),sha256);
  return {[relative]:sha256};
}
const expected = rows => ({total: rows, accepted: rows * .98, rejected: rows / 100, duplicates: rows / 100, pending: 0});
export function compareWindows(windows, samples) {
  assert.deepEqual(windows.map(w => w.mode), ['baseline', 'batched', 'batched', 'baseline']);
  const a = windows.filter(w => w.mode === 'baseline').map(w => w.processingMs), b = windows.filter(w => w.mode === 'batched').map(w => w.processingMs);
  assert.ok([...a, ...b].every(n => Number.isFinite(n) && n > 0));
  assert.deepEqual(windows.map(w=>w.index),[0,1,2,3]);
  const complete = windows.every(w => ['before','during','after'].every(phase => samples.some(s => s.window === w.index && s.phase === phase && !s.warmup)));
  const relevant=samples.filter(s=>s.warmup===false&&[0,1,2,3].includes(s.window));
  const stable = complete && relevant.every(s=>['before','during','after'].includes(s.phase)&&hostReady(s));
  const mean = n => n.reduce((a,b) => a+b, 0) / n.length;
  return {baselineMs: a, batchedMs: b, meanBaselineMs: mean(a), meanBatchedMs: mean(b), allBatchedFaster: Math.max(...b) < Math.min(...a), hostSamplesReady: stable, stableGainSupported: stable && Math.max(...b) < Math.min(...a), capacityApproved: false};
}
async function main() {
  const candidate = process.env.VEXA_CANDIDATE; assert.ok(candidate);
  assert.equal(os.platform(), 'linux'); assert.equal(os.arch(), 'arm64'); assert.ok(process.version.startsWith('v22.'));assert.equal(os.cpus().length,4,'STANDARD_RUNNER_CPU');assert.ok(os.totalmem()>=14*1024**3&&os.totalmem()<=18*1024**3,'STANDARD_RUNNER_MEMORY');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'vexa-load308-')); fs.chmodSync(out, 0o700);
  console.log('LOAD308_RUNNING:' + out);
  const report = {schema:'vexa-persistence-comparison-v1', synthetic:true, acceptance:false, production:false, status:'running', candidate, startedAt:new Date().toISOString(), semantics:[], warmups:[], windows:[], hostSamples:[], hardware:{platform:os.platform(),arch:os.arch(),cpus:os.cpus().length,memoryBytes:os.totalmem(),node:process.version}, dependencyManifestSha256:hash(fs.readFileSync(path.join(candidate,'packages/jobs/load/dependencies.json'))),benchmarkImplementation:Object.fromEntries(['generator.mjs','harness.mjs','run.mjs','worker.mjs','dependencies.json'].map(n=>[n,hash(fs.readFileSync(path.join(candidate,'packages/jobs/load',n)))])),comparisonImplementation:Object.fromEntries(['capacity-compare.mjs','capacity-host.mjs','capacity-variant.json','capacity-query-profile.mjs'].map(n=>[n,hash(fs.readFileSync(new URL('./'+n,import.meta.url)))])),limitations:['Exploratory ABBA, two observations per variant; no statistical or commercial capacity claim.','Same database grows across fresh namespaces; no identical snapshot reset between windows.','No inference, client data, provider requests, production restore or global security review.','SQL profiles measure client-observed elapsed time of queries on the wrapped connection, including transport and database work, with instrumentation overhead. Pool acquisition, pre-wrap role checks and Auth/REST HTTP calls are excluded. Statement hashes contain no SQL or parameter values. They do not isolate PostgreSQL CPU, cover all database work or inherit earlier timings.']};
  let h, runtime, active, proposalBuilt;
  const save = () => fs.writeFileSync(path.join(out,'report.json'), JSON.stringify({...report,active},null,2), {mode:0o600});
  const env = actor => ({...h.common,VEXA_WORKER_EMAIL:actor.email,VEXA_WORKER_PASSWORD:actor.password,VEXA_WORKER_USER_ID:actor.id,VEXA_WORKER_TENANT:actor.tenant??h.A.tenant});
  const mods = {};
  async function open(mode, actor = h.bot, options = {}) { const r = await mods[mode].createRuntime(env(actor), options); return r; }
  const counters = id => h.json(`SELECT jsonb_build_object('total',total,'accepted',accepted,'rejected',rejected,'duplicates',duplicates,'pending',pending) FROM imports WHERE id=${q(id)}`);
  const jobSnapshot = id => h.json(`SELECT jsonb_build_object('job',(SELECT row_to_json(j) FROM jobs j WHERE id=${q(id)}),'checkpoint',(SELECT checkpoint FROM checkpoints WHERE job_id=${q(id)} AND stage='ingestion'))`);
  const snapshot = () => Object.fromEntries(['source_heads','source_revisions','source_quarantine','messages','message_revisions','conversations','import_rows','imports','checkpoints'].map(t => [t,hash(h.sql(`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') FROM public.${t} x`))]));
  async function upload(bytes, history=false) {
    const sha = hash(bytes), reserved = await h.request(h.A,'/api/imports',{connection_id:h.A.connection,mapping_version:'csv-message-v1',content_type:'text/csv',size:bytes.length,sha256:sha});
    assert.equal(reserved.status,201); const v=reserved.data.data;
    assert.equal(new URL(v.upload_url).origin,'http://127.0.0.1:'+(basePort()+3));
    const put=await fetch(v.upload_url,{method:'PUT',headers:{'content-type':'text/csv'},body:bytes,signal:AbortSignal.timeout(30000),redirect:'error'});await put.arrayBuffer();assert.equal(put.status,200);
    const mapping={columns:{id:'id',text:'text',date:'date',role:'role',conversation:'conversation'},timezone:'UTC',dateFormat:'iso',...(history?{profile:'history-message-v1'}:{})};
    const mapped=await h.request(h.A,`/api/imports/${v.import_id}/mapping`,{mapping,expected_version:'csv-message-v1'});assert.equal(mapped.status,200);const m=mapped.data.data;
    const confirmed=await h.request(h.A,`/api/imports/${v.import_id}/confirm`,{upload_token:m.upload_token,sha256:sha,mapping_version:m.mapping_version});assert.equal(confirmed.status,202);
    const job=h.json(`SELECT jsonb_build_object('id',id,'state',state) FROM jobs WHERE import_id=${q(v.import_id)}`);assert.equal(job.state,'queued');
    return {importId:v.import_id,jobId:job.id,sha256:sha,bytes:bytes.length};
  }
  async function semantic(name, work) { const item={name,status:'running'};report.semantics.push(item);save();try{await work(item);item.status='pass';}catch(e){item.status='failed';item.error=e.code??e.message;throw e;}finally{save();} }
  try {
    const variant=JSON.parse(fs.readFileSync(new URL('./capacity-variant.json',import.meta.url)));
    const base=fs.readFileSync(path.join(candidate,rel),'utf8'), proposal=applyVariant(base,variant);
    report.persistenceHashes={baseline:hash(base),batched:hash(proposal)};
    h=await setup(candidate,out);
    report.comparisonBuildInputs=completeComparisonBuild(candidate,h.built);
    proposalBuilt=path.join(path.dirname(h.built),'comparison-batched');fs.cpSync(h.built,proposalBuilt,{recursive:true});fs.writeFileSync(path.join(proposalBuilt,rel),proposal);
    const trees={baseline:tree(h.built),batched:tree(proposalBuilt)};
    assert.deepEqual(Object.keys(trees.baseline),Object.keys(trees.batched));
    assert.deepEqual(Object.keys(trees.baseline).filter(p=>trees.baseline[p]!==trees.batched[p]),[rel]);
    fs.writeFileSync(path.join(out,'built-source-hashes.json'),JSON.stringify(trees,null,2),{mode:0o600});
    report.buildComparison={files:Object.keys(trees.baseline).length,changed:[rel],baseline:hash(JSON.stringify(trees.baseline)),batched:hash(JSON.stringify(trees.batched))};
    for (const [mode,directory] of [['baseline',h.built],['batched',proposalBuilt]]) {
      const built=pathToFileURL(directory+'/');mods[mode]={...(await import(new URL('packages/jobs/durable/runtime.mjs',built))),...(await import(new URL('packages/jobs/durable/daemon.mjs',built))),...(await import(new URL('packages/platform/db.mjs',built))),...(await import(new URL('packages/jobs/durable/records.mjs',built))),...(await import(new URL('packages/ingestion/index.mjs',built))),...(await import(new URL('packages/intelligence/source-reader.mjs',built)))};
    }
    for(const semanticMode of ['baseline','batched']) {
    const prefix='SYN-COMP-'+semanticMode+'-';
    runtime=await open(semanticMode);await runtime.repository.heartbeat();
    const long='SYN '+ 'x'.repeat(99996), csv=(text,tick=0)=>Buffer.from('id,text,date,role,conversation\n'+[1,2].map(i=>`${prefix}H${i},${text},2026-09-01T00:00:00.12345${i+tick}Z,customer,${prefix}C${i}`).join('\n')+'\n');
    const bytes=csv(long), imported=await upload(bytes,true), claim=await runtime.repository.claim();assert.equal(claim.id,imported.jobId);
    const source=await runtime.repository.source(claim), records=await mods[semanticMode].recordsFromBytes(bytes,source);assert.equal(records.length,2);assert.ok(records.every(r=>!r.validation_error));
    const chunk={records,checkpoint:{offset:2,scope:mods[semanticMode].contentHash([source.file_hash,source.mapping_version,source.tenant_id,source.connection_id])},done:true};
    await semantic(semanticMode+':worker_revocation_preserves_block',async item=>{
      await runtime.repository.renew(claim);const before=snapshot(),jobBefore=jobSnapshot(claim.id),delegation=h.json(`SELECT jsonb_build_object('enabled',enabled) FROM worker_delegations WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.bot.id)}`);assert.equal(delegation.enabled,true);
      h.sql(`UPDATE worker_delegations SET enabled=false WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.bot.id)}`);
      try{await assert.rejects(()=>runtime.repository.commitChunk(claim,chunk),e=>e.status===403);assert.deepEqual(snapshot(),before);assert.deepEqual(jobSnapshot(claim.id),jobBefore);item.denied=true;}
      finally{h.sql(`UPDATE worker_delegations SET enabled=true WHERE tenant_id=${q(h.A.tenant)} AND user_id=${q(h.bot.id)}`);}
    });
    await semantic(semanticMode+':historical_midchunk_rollback_then_same_block',async item=>{
      await runtime.repository.renew(claim);const before=snapshot(),jobBefore=jobSnapshot(claim.id);
      h.sql(`CREATE SEQUENCE public.syn_comparison_reached; GRANT USAGE,SELECT ON SEQUENCE public.syn_comparison_reached TO vexa_backend; CREATE FUNCTION public.syn_comparison_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT external_id FROM public.messages WHERE id=NEW.message_id)=${q(prefix+'H2')} THEN IF NOT EXISTS(SELECT 1 FROM public.import_rows WHERE import_id=${q(imported.importId)} AND row_ref=${q(String(records[0].row_ref))} AND state='accepted') THEN RAISE EXCEPTION 'FIRST_ROW_NOT_APPLIED'; END IF; PERFORM nextval('public.syn_comparison_reached'); RAISE EXCEPTION 'SYN_COMPARISON_FAULT' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$; CREATE TRIGGER syn_comparison_fault BEFORE INSERT ON public.message_revisions FOR EACH ROW EXECUTE FUNCTION public.syn_comparison_fault()`);
      try{await assert.rejects(()=>runtime.repository.commitChunk(claim,chunk),e=>e.code==='database_unavailable');assert.equal(h.sql('SELECT is_called FROM syn_comparison_reached'),'t');assert.deepEqual(snapshot(),before);assert.deepEqual(jobSnapshot(claim.id),jobBefore);item.firstRowAppliedBeforeFailure=true;item.rolledBackTables=9;}
      finally{h.sql('DROP TRIGGER syn_comparison_fault ON public.message_revisions; DROP FUNCTION public.syn_comparison_fault(); DROP SEQUENCE public.syn_comparison_reached');}
      await runtime.repository.commitChunk(claim,chunk);assert.deepEqual(counters(imported.importId),{total:2,accepted:2,rejected:0,duplicates:0,pending:0});item.recoveredRows=2;
    });
    await semantic(semanticMode+':historical_readback_replay_and_other_tenant',async item=>{
      await runtime.repository.renew(claim);const before=snapshot(),jobBefore=jobSnapshot(claim.id);await runtime.repository.commitChunk(claim,chunk);assert.deepEqual(snapshot(),before);assert.deepEqual(jobSnapshot(claim.id),jobBefore);
      const stored=h.json(`SELECT jsonb_agg(jsonb_build_object('profile',provenance->>'ingestion_profile','original',provenance->'historical_timestamp'->>'original','microseconds',provenance->'historical_timestamp'->>'epoch_microseconds') ORDER BY external_id) FROM source_revisions WHERE connection_id=${q(h.A.connection)} AND entity_type='message' AND external_id LIKE ${q(prefix+'H%')}`);
      assert.deepEqual(stored,records.map(r=>({profile:'history-message-v1',original:r.raw_payload.historical_timestamp.original,microseconds:r.raw_payload.historical_timestamp.epoch_microseconds})));
      const reader=mods[semanticMode].createExtractionSourceReader({storage:runtime.storage});
      const texts=await runtime.database.transaction('read',async scope=>{
        const revisions=(await scope.query('SELECT r.text_ref,r.hash,m.role FROM public.message_revisions r JOIN public.messages m ON m.tenant_id=r.tenant_id AND m.id=r.message_id WHERE m.tenant_id=$1 AND m.connection_id=$2 AND m.external_id LIKE $3 ORDER BY m.external_id',[scope.tenantId,h.A.connection,prefix+'H%'])).rows;
        assert.equal(revisions.length,2);const values=[];for(const revision of revisions)values.push(await reader(scope,revision));return values;
      });assert.deepEqual(texts,[long,long]);item.persistedSourceReaderHashes=texts.map(hash);
      const raw=await runtime.storage.read({tenantId:h.A.tenant},source);assert.equal(hash(raw),hash(bytes));assert.equal(records[0].raw_payload.text.length,100000);
      const other=await open(semanticMode,h.B);try{assert.equal((await other.database.transaction('read',s=>s.query('SELECT id FROM public.source_revisions WHERE connection_id=$1',[h.A.connection]))).rows.length,0);await assert.rejects(()=>other.storage.read({tenantId:h.B.tenant},source),/STORAGE_SCOPE/);}finally{await other.close();}
      await runtime.repository.ack(claim);item.rows=2;item.textLength=100000;item.storageHash=hash(raw);item.replayUnchanged=true;item.otherTenantDenied=true;
    });
    await semantic(semanticMode+':new_revision_and_tombstone_no_resurrection',async item=>{
      const changed=await upload(csv('REV '+long.slice(4),2),true);
      // Revised text must remain within the documented 100K-character limit.
      await mods[semanticMode].runDaemon({...runtime,close:async()=>{}},{once:true});
      const after=counters(changed.importId);assert.deepEqual(after,{total:2,accepted:0,rejected:2,duplicates:0,pending:0});
      const revisions=h.json(`SELECT jsonb_agg(jsonb_build_object('external',external_id,'original',provenance->'historical_timestamp'->>'original','microseconds',provenance->'historical_timestamp'->>'epoch_microseconds') ORDER BY external_id,provenance->'historical_timestamp'->>'original') FROM source_revisions WHERE connection_id=${q(h.A.connection)} AND entity_type='message' AND external_id LIKE ${q(prefix+'H%')}`);
      assert.equal(revisions.length,4);for(const external of [prefix+'H1',prefix+'H2']){const pair=revisions.filter(r=>r.external===external);assert.equal(pair.length,2);assert.notEqual(pair[0].microseconds,pair[1].microseconds);assert.equal(Date.parse(pair[0].original),Date.parse(pair[1].original));}item.originalMicrosecondsDistinct=true;
      assert.equal(h.sql(`SELECT count(*) FROM source_heads WHERE connection_id=${q(h.A.connection)} AND entity_type='message' AND state='ambiguous' AND external_id LIKE ${q(prefix+'H%')}`),'2');
      const owner=await open(semanticMode,h.A);
      try{await owner.database.transaction('retain',async s=>{
        await s.query("INSERT INTO public.retention_policies(tenant_id,version,backup_ttl_seconds,active_erasure,business_history,actor_id) VALUES($1,1,3600,'immediate','retain-authorized-audit',$2) ON CONFLICT (tenant_id) DO NOTHING",[s.tenantId,s.userId]);
        await s.query('SELECT public.retention_erase($1::jsonb)',[JSON.stringify({connectionId:h.A.connection,entityType:'message',externalId:prefix+'H1',requestId:randomUUID(),confirmed:true})]);
      });}finally{await owner.close();}
      const checkDeleted=()=>h.json(`SELECT jsonb_build_object('active',(SELECT count(*) FROM messages WHERE connection_id=${q(h.A.connection)} AND external_id=${q(prefix+'H1')} AND deleted_at IS NULL),'ledger',(SELECT count(*) FROM retention_ledger WHERE connection_id=${q(h.A.connection)} AND external_id=${q(prefix+'H1')} AND entity_type='message'))`);
      assert.deepEqual(checkDeleted(),{active:0,ledger:1});const retried=await upload(bytes,true);await mods[semanticMode].runDaemon({...runtime,close:async()=>{}},{once:true});
      assert.deepEqual(counters(retried.importId),{total:2,accepted:0,rejected:1,duplicates:1,pending:0});assert.deepEqual(checkDeleted(),{active:0,ledger:1});
      assert.equal(h.sql(`SELECT count(*) FROM import_rows WHERE import_id=${q(retried.importId)} AND error_code='SOURCE_TOMBSTONED'`),'1');const later=await upload(csv('NEW '+long.slice(4),4),true);await mods[semanticMode].runDaemon({...runtime,close:async()=>{}},{once:true});assert.deepEqual(counters(later.importId),{total:2,accepted:0,rejected:2,duplicates:0,pending:0});assert.deepEqual(checkDeleted(),{active:0,ledger:1});item.revisionsRetained=true;item.tombstoneRejected=1;item.newRevisionAfterTombstoneDenied=true;item.physicalRawPurgeTested=false;
    });
    await runtime.close();runtime=null;
    }
    const data=path.join(out,'generated');const manifest=generateDataset({rows:10000,seed:10308,directory:data});const input=fs.readFileSync(path.join(data,manifest.files[0].filename),'utf8');assert.equal(hash(input),manifest.files[0].sha256);report.fixture=manifest;
    for (const [index,mode] of ['baseline','batched','baseline','batched','batched','baseline'].entries()) {
      const warmup=index<2, rows=warmup?100:1000, w={index:warmup?index:index-2,mode,warmup,rows,status:'running',concurrency:1,workerChunkRows:100,deadlineMs:900000,chunks:[],sqlQueries:0,startedAt:new Date().toISOString()};active=w;save();
      const profile=createQueryProfile();
      const measured=options=>mods[mode].createDatabase({...options,pool:{async connect(){const c=await options.pool.connect();return {async query(sql,values){w.sqlQueries++;return profile.run(sql,()=>c.query(sql,values));},release(){c.release();}};}}});
      const deadlineAt=Date.now()+900000;runtime=await open(mode,h.bot,{createDatabase:measured,deadlineAt});await runtime.repository.heartbeat();
      await runtime.database.transaction('read',s=>s.query('SELECT 1'));
      const bytes=Buffer.from(input.split('\n').slice(0,rows+1).join('\n').replaceAll('SYN308-10000-10308-',`SYN-COMP-${index}-`).replaceAll('SYN-conversation-10000-10308-',`SYN-COMP-C${index}-`)+'\n');const imported=await upload(bytes);w.fixture={...imported,rows};
      const before=await sampleHost();report.hostSamples.push({...before,window:w.index,warmup,phase:'before'});if(!warmup)assert.ok(hostReady(before),'HOST_NOT_READY');
      w.sqlQueries=0;profile.reset();let observedQueries=0;
      const repository={...runtime.repository,async commitChunk(...args){const t=performance.now(),queries=w.sqlQueries;let committed=false;try{const value=await runtime.repository.commitChunk(...args);committed=true;return value;}finally{const count=w.sqlQueries-queries;w.chunks.push({offset:args[1].checkpoint.offset,rows:args[1].records.length,done:args[1].done,committed,ms:performance.now()-t,queries:count});observedQueries+=count;}}};
      let sampling=null,samplingError=null;const timer=setInterval(()=>{if(!sampling)sampling=sampleHost().then(s=>report.hostSamples.push({...s,window:w.index,warmup,phase:'during'})).catch(e=>{samplingError=e;}).finally(()=>{sampling=null;});},5000);
      const t=performance.now(),cpu=process.cpuUsage();try{await mods[mode].runDaemon({...runtime,repository,close:async()=>{}},{once:true});}finally{w.processingMs=performance.now()-t;w.cpuMicroseconds=process.cpuUsage(cpu);clearInterval(timer);if(sampling)await sampling;}assert.ok(w.processingMs<900000,'WINDOW_DEADLINE');if(samplingError)throw samplingError;w.chunkSqlQueries=observedQueries;w.sqlProfile=profile.snapshot();assert.equal(w.sqlProfile.complete,true,'SQL_PROFILE_INCOMPLETE');assert.equal(w.sqlProfile.completed,w.sqlQueries,'SQL_PROFILE_COUNT');
      const after=await sampleHost();report.hostSamples.push({...after,window:w.index,warmup,phase:'after'});
      w.observed=counters(imported.importId);assert.deepEqual(w.observed,expected(rows));
      w.canonicalRows=Number(h.sql(`SELECT count(*) FROM messages m JOIN conversations c ON c.tenant_id=m.tenant_id AND c.id=m.conversation_id JOIN source_heads head ON head.tenant_id=m.tenant_id AND head.id=m.id AND head.state='unique' JOIN source_revisions r ON r.tenant_id=head.tenant_id AND r.id=head.selected_revision_id AND r.canonical_id=m.id JOIN message_revisions text ON text.tenant_id=r.tenant_id AND text.id=r.message_revision_id AND text.message_id=m.id WHERE m.connection_id=${q(h.A.connection)} AND m.external_id LIKE ${q('SYN-COMP-'+index+'-%')} AND text.hash=r.content_hash AND text.text_ref=r.provenance->>'payload_ref' AND c.external_id LIKE ${q('SYN-COMP-C'+index+'-%')} AND m.deleted_at IS NULL`));assert.equal(w.canonicalRows,rows*.98);

      assert.deepEqual(w.chunks.map(c=>c.offset),Array.from({length:rows/100},(_,i)=>(i+1)*100));assert.ok(w.chunks.every(c=>c.committed&&c.rows===100));assert.equal(w.chunks.at(-1).done,true);
      assert.ok(w.chunks.every(c=>c.queries===(mode==='baseline'?2195:1901)),'EXPECTED_QUERY_REDUCTION');
      const api=await h.request(h.A,'/api/jobs/'+imported.jobId);assert.equal(api.status,200);w.apiCounters=Object.fromEntries(Object.entries(api.data.data.counters).map(([k,v])=>[k,Number(v)]));assert.deepEqual(w.apiCounters,w.observed);
      w.terminal=jobSnapshot(imported.jobId);assert.equal(w.terminal.checkpoint.offset,rows);assert.equal(w.terminal.checkpoint.done,true);assert.equal(w.terminal.job.state,'partial');assert.equal(w.terminal.job.failure_count,0);
      await runtime.close();runtime=null;w.status='completed';w.finishedAt=new Date().toISOString();(warmup?report.warmups:report.windows).push(w);active=null;save();
    }
    report.comparison=compareWindows(report.windows,report.hostSamples);report.deadlineQueryPerTransaction=1;
    assert.deepEqual(tree(h.built),trees.baseline);assert.deepEqual(tree(proposalBuilt),trees.batched);h.verifySources();assert.equal(hash(fs.readFileSync(path.join(candidate,rel))),variant.baselineSha256);report.status='comparison_completed';
  } catch(e) {report.status='failed';report.error={code:e.code??null,message:e.message};process.exitCode=1;}
  finally {
    report.cleanupErrors=[];
    for (const [name,close] of [['runtime',()=>runtime?.close()],['harness',()=>h?.close()]])try{await close();}catch(e){report.cleanupErrors.push({name,message:e.message});}
    if(proposalBuilt&&fs.existsSync(proposalBuilt))report.cleanupErrors.push({name:'experimental-build',message:'EXPERIMENTAL_BUILD_NOT_REMOVED'});
    report.cleanup=fs.existsSync(path.join(out,'cleanup.json'))?JSON.parse(fs.readFileSync(path.join(out,'cleanup.json'))):null;
    if(report.cleanupErrors.length||!report.cleanup?.ownResourcesRemoved||!report.cleanup?.temporaryPathsRemoved){report.status='failed';process.exitCode=1;}
    report.finishedAt=new Date().toISOString();save();console.log('LOAD308_EVIDENCE:'+out);
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
