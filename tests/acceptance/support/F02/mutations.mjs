// Control-only authoring probe; clones just the parser into private TMP. Never changes candidate.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const source=path.resolve(process.argv[2]??'');assert.ok(process.argv[2],'usage: node mutations.mjs SOURCE');
const original=fs.readFileSync(path.join(source,'packages/ingestion/index.mjs'),'utf8');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f02-mutants-'));fs.chmodSync(root,0o700);
const cases=[
 ['bytes','CSV byte boundary','> cfg.maxBytes', '> Number.MAX_SAFE_INTEGER','EXPECTED_REJECTION:CSV_LIMIT_BYTES'],
 ['columns','CSV column boundary','values.length>cfg.maxColumns','false','EXPECTED_REJECTION:CSV_LIMIT_COLUMNS'],
 ['field','CSV field boundary','field.length>cfg.maxFieldChars','false','EXPECTED_REJECTION:CSV_LIMIT_FIELD'],
 ['rows','CSV row boundary','++count>cfg.maxRows','(++count, false)','EXPECTED_REJECTION:CSV_LIMIT_ROWS'],
 ['truncation','CSV truncated','if(state===\'quoted\') bad=true','if(false) bad=true','CSV_TRUNCATED_ROW_COUNT'],
 ['execution','CSV formulas/HTML','const scope=validateContext(context); if(scope.source', 'globalThis.__F02_EXECUTED=true; const scope=validateContext(context); if(scope.source','HTML_EXECUTION'],
 ['formula','CSV formulas/HTML','text:data.text.normalize(\'NFC\')','text:data.text.startsWith(\'=\')?\'2\':data.text.normalize(\'NFC\')','HYPERLINK'],
];
cases.push(
 ['tenant','identity isolates',"['v1',e.tenant_id,e.connection_id","['v1','constant',e.connection_id",'IDENTITY_SCOPE:tenant_id','F02-04'],
 ['connection','identity isolates',"e.tenant_id,e.connection_id,e.source","e.tenant_id,'constant',e.source",'IDENTITY_SCOPE:connection_id','F02-04'],
 ['account','identity isolates',"e.source,e.source_account_id,e.entity_type","e.source,'constant',e.entity_type",'IDENTITY_SCOPE:source_account_id','F02-04'],
 ['revision','revision conflict',"if (previous.content_hash !== envelope.content_hash","if (false && previous.content_hash !== envelope.content_hash",'EXPECTED_REJECTION:REVISION_CONFLICT','F02-04'],
 ['silent-drop','10K fixture',"records.push({envelope:Object.freeze","if(records.length===8999) continue; records.push({envelope:Object.freeze",'DUPLICATES_1000','F02-04']
);
const only01=process.argv.includes('--f02-01-only');
const evidence=path.resolve('tests/acceptance/support/F02/evidence'+(only01?'/complete01/node-mutants':''));fs.mkdirSync(evidence,{recursive:true});
function run(dir,pattern,label,gate='F02-01'){const r=spawnSync(process.execPath,['--test','--test-reporter=tap',`--test-name-pattern=${pattern}`,`tests/acceptance/${gate}.test.mjs`],{env:{PATH:process.env.PATH,HOME:process.env.HOME,VEXA_CANDIDATE:dir},encoding:'utf8',timeout:30000,maxBuffer:2e6});fs.writeFileSync(path.join(evidence,label+'.log'),r.stdout+r.stderr);return r;}
const results=[];
try{for(const [id,pattern,from,to,expected,gate]of cases){
 if(only01 && gate==='F02-04')continue;
 assert.equal(original.split(from).length-1,1,`MUTATION_TARGET:${id}`);
 const dir=path.join(root,id);fs.mkdirSync(path.join(dir,'packages/ingestion'),{recursive:true});const file=path.join(dir,'packages/ingestion/index.mjs');fs.writeFileSync(file,original);
 const before=run(dir,pattern,id+'-before',gate);assert.equal(before.status,0,`HEALTHY_FAILED:${id}`);assert.match(before.stdout,/^# tests 1$/m,'EXACTLY_ONE_POSITIVE');
 fs.writeFileSync(file,original.replace(from,to));const mutant=run(dir,pattern,id+'-mutant',gate);
 const output=mutant.stdout+mutant.stderr;
 const killed=mutant.status===1&&/^# fail 1$/m.test(output)&&output.includes('ERR_ASSERTION')&&output.includes(expected)&&!/(IMPLEMENTATION_MISSING|CONTRACT_BINDING_MISSING|SyntaxError|ERR_MODULE_NOT_FOUND)/.test(output);
 fs.writeFileSync(file,original);const after=run(dir,pattern,id+'-after',gate);assert.equal(after.status,0,`RESTORE_FAILED:${id}`);assert.ok(killed,`MUTANT_SURVIVED_OR_SETUP:${id}`);
 results.push({id,before:before.status,mutant:mutant.status,after:after.status,expected,killed});
 }}finally{fs.rmSync(root,{recursive:true,force:true});fs.writeFileSync(path.join(evidence,'mutations.json'),JSON.stringify({source,source_hash:createHash('sha256').update(original).digest('hex'),results,unproven:['XLSX zipbomb/formula/expanded boundaries: binding absent','browser/network beyond fetch and eval','durable DB, Auth, Storage, worker']},null,2)+'\n');}
console.log(JSON.stringify(results));
