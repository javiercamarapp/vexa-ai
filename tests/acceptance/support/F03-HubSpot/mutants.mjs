// External behavioral mutations of the real adapter. No production/candidate files are edited.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {candidate} from './http.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f0301-mutants-'));
const suite=fileURLToPath(new URL('./local.test.mjs',import.meta.url));
const source=path.join(candidate,'packages/connectors/index.mjs');
assert.ok(fs.existsSync(source),'MUTATION_REQUIRES_REAL_IMPLEMENTATION');
const controls=[
 ['internal-as-customer','two thread pages','ROLE_SEPARATION',`if(r.role==='internal') return {...r,role:'customer'};`],
 ['drop-message-page','two thread pages','ALL_MESSAGE_PAGES',`if(r.envelope.entity_type==='message'&&r.envelope.external_id==='M2') return null;`],
 ['constant-revision','message content edit','EDIT_REVISION',`return {...r,envelope:{...r.envelope,source_revision:'SYNTHETIC-CONSTANT'}};`],
 ['ticket-as-text','two thread pages','METADATA_NOT_MESSAGE_TEXT',`if(r.envelope.entity_type==='thread') return {...r,text:'SYNTHETIC ticket property'};`],
];
const results=[];
for(const [name,pattern,marker,mutation] of controls){
 const sandbox=path.join(root,name);fs.mkdirSync(path.join(sandbox,'packages/connectors'),{recursive:true});
 const binding=path.join(sandbox,'packages/connectors/index.mjs');
 const prefix=`import * as real from ${JSON.stringify(pathToFileURL(source).href)};\nexport * from ${JSON.stringify(pathToFileURL(source).href)};\n`;
 const clean=prefix+'export const createHubSpotAdapter=real.createHubSpotAdapter;\n';
 function run(label){const r=spawnSync(process.execPath,['--test',`--test-name-pattern=${pattern}`,suite],{env:{...process.env,VEXA_CANDIDATE:sandbox},encoding:'utf8',timeout:15000});fs.writeFileSync(path.join(root,`${name}-${label}.log`),r.stdout+r.stderr,{mode:0o600});assert.equal(r.signal,null,'MUTANT_NOT_TIMEOUT');assert.equal(r.error,undefined,'MUTANT_NOT_SETUP');return {exit:r.status,output:r.stdout+r.stderr};}
 fs.writeFileSync(binding,clean);const before=run('before');assert.equal(before.exit,0,`MUTANT_POSITIVE:${name}`);
 fs.writeFileSync(binding,prefix+`export function createHubSpotAdapter(config){const a=real.createHubSpotAdapter(config);return {...a,async *pages(opts){for await(const p of a.pages(opts)){yield {...p,records:p.records.map(r=>{${mutation}return r;}).filter(Boolean)};}}};}\n`);
 const red=run('red');assert.equal(red.exit,1,`MUTANT_SURVIVED:${name}`);assert.ok(red.output.includes(marker),`WRONG_MUTANT_ORACLE:${name}`);
 fs.writeFileSync(binding,clean);const after=run('restored');assert.equal(after.exit,0,`MUTANT_RESTORE:${name}`);results.push({name,marker,exit_codes:[before.exit,red.exit,after.exit]});
}
fs.writeFileSync(path.join(root,'receipt.json'),JSON.stringify({candidate,results},null,2),{mode:0o600});console.log(JSON.stringify({evidence:root,mutants:results.length,status:'passed'}));
