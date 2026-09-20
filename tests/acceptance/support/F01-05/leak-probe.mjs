// Runs the unchanged launcher/job; all mutations are in owned temporary copies.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {syntheticJWT} from '../ci/artifact-secrets.mjs';
const source=path.resolve(process.argv[2]);
const control=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'f0105-leak-probe-'));fs.chmodSync(root,0o700);
const results=[];const nonce=randomUUID();
const save=()=>fs.writeFileSync(path.join(root,'results.json'),JSON.stringify({nonce,results},null,2)+'\n',{mode:0o600});
console.log('LEAK_EVIDENCE:'+root);
function copy(label) {
 const destination=path.join(root,label);
 fs.cpSync(source,destination,{recursive:true,filter:p=>!path.relative(source,p).split(path.sep).some(x=>['.git','.runtime','private','node_modules','.next','__pycache__'].includes(x))});
 return destination;
}
function run(candidate,label,expected) {
 const r=spawnSync('python3',['-B',path.join(control,'tests/acceptance/support/ci/run.py'),'--job','web-quality','--candidate',candidate],{cwd:control,encoding:'utf8',timeout:600000,maxBuffer:16*1024*1024});
 fs.writeFileSync(path.join(root,label+'.log'),(r.stdout??'')+(r.stderr??''),{mode:0o600});
 const info=JSON.parse(r.stdout.trim().split('\n').at(-1));
 const receipt=JSON.parse(fs.readFileSync(info.receipt));
 const logs=receipt.commands.map(c=>fs.readFileSync(c.log,'utf8')).join('\n');
 results.push({label,exit:r.status,receipt:info.receipt,expected:expected??'pass',log_sha256:createHash('sha256').update(logs).digest('hex')});save();
 assert.equal(receipt.candidate_working_tree_fingerprint_after,receipt.candidate_working_tree_fingerprint,'CANDIDATE_IMMUTABLE');
 assert.equal(receipt.control_fingerprint_after,receipt.control_fingerprint,'CONTROL_IMMUTABLE');
 if(expected) {assert.equal(r.status,1);assert.ok(logs.includes(expected),'EXACT_MUTANT_DIAGNOSTIC');}
 else {assert.equal(r.status,0);assert.equal(receipt.status,'pass');assert.ok(logs.includes('CLIENT_ARTIFACTS_CLEAN:'));}
 console.log(label+':'+r.status);
}
try {
 const healthy=copy('healthy');run(healthy,'healthy-before');
 const mutant=copy('service-public');const file=path.join(mutant,'apps/web/public/ci-service-canary.txt');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,syntheticJWT('service_role',nonce),{mode:0o600});
 run(mutant,'service-public','CLIENT_SECRET_LEAK:SERVICE_ROLE_JWT:artifact');
 run(healthy,'healthy-restored');
 const ts=copy('ts2322');fs.writeFileSync(path.join(ts,'apps/web/src/ci-mutant.ts'),"const broken: number = 'x'; export { broken };\n");run(ts,'ts2322','TS2322');
 run(healthy,'healthy-final');
}finally {save();}
