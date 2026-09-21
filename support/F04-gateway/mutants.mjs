import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function runMutants(candidate){
 const source=path.join(candidate,'packages/gateway/index.mjs');assert.ok(fs.existsSync(source),'F04_GATEWAY_IMPLEMENTATION_MISSING');
 const original=fs.readFileSync(source,'utf8'),before=hash(original),rows=[];
 const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f0401-mutants-'));fs.chmodSync(evidence,0o700);
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f0401-candidate-'));fs.chmodSync(temporary,0o700);
 const entry=fileURLToPath(new URL('../../tests/acceptance/F04-01.test.mjs',import.meta.url));
 const write=(name,value)=>fs.writeFileSync(path.join(evidence,name),value,{mode:0o600});
 const run=name=>{const env={PATH:process.env.PATH,VEXA_CANDIDATE:temporary,VEXA_F04_MUTANT_CHILD:'1'};delete env.NODE_TEST_CONTEXT;const result=spawnSync(process.execPath,['--test',entry],{env,encoding:'utf8',timeout:15000,maxBuffer:2e6});write(name+'.log',result.stdout+result.stderr);assert.equal(result.error,undefined,'F04_MUTANT_PROCESS_FAILURE');assert.equal(result.signal,null,'F04_MUTANT_PROCESS_SIGNAL');return {exit:result.status,log:result.stdout+result.stderr};};
 const mutations=[
  {name:'catalog_context_null_guard_omitted',from:'if(!catalogEntry)continue;',to:'/* defective context lookup at expiry boundary */',assertion:'F04_EXPIRY_BOUNDARY_MUST_RETURN_POLICY_BLOCKED'},
  {name:'runtime_default_enabled',from:"if(runtime!=='enabled')return error('runtime_disabled');",to:"if(false)return error('runtime_disabled');",assertion:'F04_BLOCKED_RESULT_REQUIRED'},
  {name:'model_allowlist_ignored',from:'p.allowedModels.includes(c.model)&&',to:'',assertion:'F04_BLOCKED_RESULT_REQUIRED'},
  {name:'post_await_eligibility_omitted',from:"if(!eligible(c,p,clock.now(),catalogSnapshot))return finish(error('policy_blocked'));",to:'/* defective send after stale reserve/attempt */',assertion:'F04_BLOCKED_RESULT_REQUIRED'},
  {name:'residency_ignored',from:'c.residency===p.residency&&',to:'',assertion:'F04_BLOCKED_RESULT_REQUIRED'},
  {name:'deny_misrepresented_as_zdr',from:'(!p.requireZdr||c.zdr===true)&&',to:'',assertion:'F04_BLOCKED_RESULT_REQUIRED'},
 ];
 try{
  for(const area of ['gateway','intelligence'])fs.cpSync(path.join(candidate,'packages',area),path.join(temporary,'packages',area),{recursive:true});
  write('source.json',JSON.stringify({candidate,file:'packages/gateway/index.mjs',sha256:before,node:process.version}));
  assert.equal(run('baseline').exit,0,'F04_MUTATION_BASELINE_MUST_PASS');
  for(const mutant of mutations){
   assert.equal(original.split(mutant.from).length-1,1,'F04_MUTANT_ANCHOR_UNIQUE:'+mutant.name);
   fs.writeFileSync(path.join(temporary,'packages/gateway/index.mjs'),original.replace(mutant.from,mutant.to));
   const red=run(mutant.name+'-red');assert.equal(red.exit,1,'F04_MUTANT_SURVIVED:'+mutant.name);assert.match(red.log,/AssertionError/,'F04_MUTANT_MUST_FAIL_ASSERTION');assert.ok(red.log.includes(mutant.assertion),'F04_MUTANT_WRONG_ORACLE:'+mutant.name);assert.doesNotMatch(red.log,/SyntaxError|ERR_MODULE_NOT_FOUND|F04_GATEWAY_IMPLEMENTATION_MISSING/,'F04_MUTANT_SETUP_FAILURE');
   fs.writeFileSync(path.join(temporary,'packages/gateway/index.mjs'),original);assert.equal(run(mutant.name+'-restored').exit,0,'F04_MUTANT_RESTORE_MUST_PASS');rows.push({name:mutant.name,baseline:0,mutant:1,restored:0,assertion:mutant.assertion});
  }
  assert.equal(hash(fs.readFileSync(source)),before,'F04_PRODUCT_SOURCE_CHANGED');
  write('results.json',JSON.stringify({node:process.version,sourceHash:before,mutants:rows}));
 }finally{
  fs.rmSync(temporary,{recursive:true,force:true});write('cleanup.json',JSON.stringify({temporary,removed:!fs.existsSync(temporary),activeChildren:0}));
 }
 return evidence;
}
