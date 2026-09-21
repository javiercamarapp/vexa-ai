import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const digest=x=>createHash('sha256').update(x).digest('hex');
test('F04 redaction functional mutants must fail the actual external assertions',{timeout:60000},async t=>{
 const source=path.resolve(process.env.VEXA_CANDIDATE??process.cwd()),evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-redaction-mutants-')),candidate=path.join(evidence,'candidate'),target=path.join(candidate,'packages/intelligence');fs.chmodSync(evidence,0o700);fs.mkdirSync(target,{recursive:true});
 const redaction=fs.readFileSync(path.join(source,'packages/intelligence/redact.mjs'),'utf8'),index=fs.readFileSync(path.join(source,'packages/intelligence/index.mjs'),'utf8');fs.writeFileSync(path.join(target,'index.mjs'),index);const module=path.join(target,'redact.mjs'),gate=fileURLToPath(new URL('./local.test.mjs',import.meta.url)),results=[];
 const childEnv={...process.env,VEXA_CANDIDATE:candidate};delete childEnv.NODE_TEST_CONTEXT;
 const run=(name,body)=>{fs.writeFileSync(module,body);const r=spawnSync(process.execPath,['--test',gate],{env:childEnv,encoding:'utf8',timeout:15000});fs.writeFileSync(path.join(evidence,name+'.log'),r.stdout+r.stderr,{mode:0o600});return r;};
 try{
  const baseline=run('baseline',redaction);assert.equal(baseline.status,0);assert.match(baseline.stdout,/tests 6/,'REAL_BASELINE_TEST_COUNT');
  const mutations=[
   ['email',s=>s.replace('  capture(/[\\p{L}', '  if(false)capture(/[\\p{L}'),'PII_BEFORE_PROVIDER'],
   ['phone',s=>s.replace('  capture(/(?<!','  if(false)capture(/(?<!'),'PII_BEFORE_PROVIDER'],
   ['names',s=>s.replace('for(const name of new Set(p.names.map(folded)))','for(const name of [])'),'PII_BEFORE_PROVIDER'],
   ['offsets',s=>s.replace('const points=[...text]','const points=text.split(\'\')'),'Unicode offsets exact'],
   ['union',s=>s.replace('last.end=Math.max(last.end,span.end)','last.end=Math.min(last.end,span.end)'),'OVERLAP_REDACTION'],
   ['suppression',s=>s.replace('ranges.push({start:0,end:points.length})','ranges.push({start:0,end:0})'),'full suppression is explicit'],
   ['unicode',s=>s.replace('||!text.isWellFormed()',''),'Missing expected exception']
  ];
  for(const[name,mutate,assertion]of mutations)await t.test(name+' green → assertion rejection → restored green',()=>{const changed=mutate(redaction);assert.notEqual(changed,redaction,'MUTANT_APPLIED');const r=run(name,changed);assert.equal(r.status,1,'MUTANT_MUST_FAIL');assert.match(r.stdout+r.stderr,/ERR_ASSERTION|AssertionError/,'NOT_SETUP_ERROR');assert.ok((r.stdout+r.stderr).includes(assertion),'EXPECTED_ORACLE:'+assertion);assert.equal(run(name+'-restored',redaction).status,0,'RESTORED_GREEN');results.push({name,original:digest(redaction),mutant:digest(changed),exit:1,restored:0});});
  assert.equal(digest(fs.readFileSync(path.join(source,'packages/intelligence/redact.mjs'))),digest(redaction),'PRODUCT_UNTOUCHED');
 }finally{fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(results,null,2),{mode:0o600});fs.rmSync(candidate,{recursive:true,force:true});console.log('F04_REDACTION_MUTANTS_EVIDENCE:'+evidence);}
});
