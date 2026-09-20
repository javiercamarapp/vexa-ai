import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const live=fileURLToPath(new URL('./live.mjs',import.meta.url));
const invoke=`import {runLive} from ${JSON.stringify(new URL('./live.mjs',import.meta.url).href)};try{await runLive();process.exitCode=0;}catch(e){console.log(e.message);process.exitCode=1;}`;
function call(config){const env={...process.env};delete env.VEXA_HUBSPOT_S01_CONFIG;delete env.VEXA_HUBSPOT_TOKEN;delete env.VEXA_HUBSPOT_RECONCILIATION_KEY;if(config)env.VEXA_HUBSPOT_S01_CONFIG=config;return spawnSync(process.execPath,['--input-type=module','-e',invoke],{env,encoding:'utf8',timeout:5000});}
test('live absence stays blocked with no network or token required',()=>{const r=call();assert.equal(r.status,1);assert.match(r.stdout,/S01_LIVE_BLOCKED/);});
test('arbitrary passed JSON cannot satisfy live and parse errors redact input',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-f0301-live-input-'));try{const config=path.join(dir,'config.json');fs.writeFileSync(config,JSON.stringify({passed:true,status:'passed',s01_accepted:true}),{mode:0o600});let r=call(config);assert.equal(r.status,1);assert.match(r.stdout,/S01_AUTHORIZATION_REFERENCE_REQUIRED/);fs.writeFileSync(config,'SYNTHETIC_SECRET_SENTINEL_INVALID_JSON');r=call(config);assert.equal(r.status,1);assert.match(r.stdout,/S01_LIVE_FAILED_REDACTED/);assert.ok(!(r.stdout+r.stderr).includes('SYNTHETIC_SECRET_SENTINEL'));}finally{fs.rmSync(dir,{recursive:true});}});
// Synthetic isolated process: exercises the live driver without real provider access.
// This test can never be used as S01 live acceptance.
const scopedProbe=String.raw`
import fs from 'node:fs';import path from 'node:path';import {createHash,createHmac} from 'node:crypto';
const dir=process.argv[1],mode=process.argv[2],base='/conversations/v3/conversations/threads',key='SYNTHETIC-REVIEW-KEY-NOT-A-REAL-KEY',seen=[];
const threads=Array.from({length:20},(_,i)=>'T'+(i+1)),all=['OUTSIDE_BEFORE',...threads,'OUTSIDE_AFTER'];
const expected={origin:'authorized-ui-or-export',account_id:'123',reviewer:'synthetic-independent-reviewer',threads,messages:threads.map(t=>({id:'M'+t,thread:t,digest:createHmac('sha256',key).update(JSON.stringify(['M'+t,t,'customer','public','SYNTHETIC '+t,[]])).digest('hex')}))};
const exportPath=path.join(dir,'export.json');fs.writeFileSync(exportPath,JSON.stringify(expected),{mode:0o600});
const c={version:'v3',authorization_ref:'SYNTHETIC-LOCAL-REVIEW-NOT-APPROVAL',account_id:'123',client_id:'SYNTHETIC-client',reviewer:expected.reviewer,implementer:'synthetic-author',expires_at:new Date(Date.now()+60000).toISOString(),reconciliation_file:exportPath,reconciliation_sha256:createHash('sha256').update(fs.readFileSync(exportPath)).digest('hex'),tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222'};
const cfg=path.join(dir,'config.json');fs.writeFileSync(cfg,JSON.stringify(c),{mode:0o600});process.env.VEXA_HUBSPOT_S01_CONFIG=cfg;process.env.VEXA_HUBSPOT_TOKEN='SYNTHETIC-NOT-A-PROVIDER-TOKEN';process.env.VEXA_HUBSPOT_RECONCILIATION_KEY=key;process.env.VEXA_HUBSPOT_APPROVAL_REFERENCE=mode==='mismatched-approval'?'SYNTHETIC-WRONG-APPROVAL':c.authorization_ref;
globalThis.fetch=async(input)=>{const u=new URL(input);seen.push(u.pathname);if(u.origin!=='https://api.hubapi.com')throw Error('SYNTHETIC_BAD_HOST');let body;
if(u.pathname.startsWith('/oauth/'))body={hub_id:123,client_id:c.client_id,scopes:['conversations.read']};
else if(u.pathname===base)body={results:all.map(id=>({id}))};
else{const t=u.pathname.slice(base.length+1).split('/')[0];body=u.pathname.endsWith('/messages')?{results:[{id:'M'+t,conversationsThreadId:t,type:'MESSAGE',text:'SYNTHETIC '+t,truncationStatus:'NOT_TRUNCATED',senders:[{actorId:'V-123'}]}]}:{id:t};}
return new Response(JSON.stringify(body));};
const {runLive}=await import(process.env.SYNTHETIC_LIVE_MODULE);let result,error;try{result=await runLive();}catch(e){error=e.message;}console.log(JSON.stringify({SYNTHETIC_ONLY:true,result,error,seen}));
`;
function runScopedProbe(mode){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-live-scope-regression-'));try{const r=spawnSync(process.execPath,['--input-type=module','-e',scopedProbe,dir,mode],{env:{...process.env,SYNTHETIC_LIVE_MODULE:new URL('./live.mjs',import.meta.url).href},encoding:'utf8',timeout:5000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}finally{fs.rmSync(dir,{recursive:true});}}
test('live reads exactly authorized 20 direct threads and no bodies before/after them in account page',()=>{const out=runScopedProbe('authorized-synthetic');assert.equal(out.result?.status,'passed',out.error);const base='/conversations/v3/conversations/threads';assert.ok(!out.seen.includes(base),'NO_ACCOUNT_WIDE_LIST_REQUEST');assert.ok(out.seen.every(p=>!p.includes('OUTSIDE')),'NO_UNAUTHORIZED_BODY');assert.equal(out.seen.filter(p=>p.endsWith('/messages')).length,20);});
test('supervisor approval mismatch fails before ANY provider request',()=>{const out=runScopedProbe('mismatched-approval');assert.equal(out.error,'S01_SUPERVISOR_APPROVAL_MISMATCH');assert.deepEqual(out.seen,[]);});
