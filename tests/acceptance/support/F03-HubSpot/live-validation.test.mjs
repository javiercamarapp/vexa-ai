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
const c={version:'v4',authentication:'oauth',app_id:'456',authorization_ref:'SYNTHETIC-LOCAL-REVIEW-NOT-APPROVAL',account_id:'123',reviewer:expected.reviewer,implementer:'synthetic-author',expires_at:new Date(Date.now()+60000).toISOString(),reconciliation_file:exportPath,reconciliation_sha256:createHash('sha256').update(fs.readFileSync(exportPath)).digest('hex'),tenant_id:'11111111-1111-4111-8111-111111111111',connection_id:'22222222-2222-4222-8222-222222222222'};
if(mode.startsWith('private-'))c.authentication='private_app';
if(mode==='legacy-v3')c.version='v3';if(mode==='missing-mode')delete c.authentication;if(mode==='wrong-mode')c.authentication='auto';if(mode==='client-id')c.client_id='SYNTHETIC';if(mode==='app-number')c.app_id=456;if(mode==='expired')c.expires_at=new Date(Date.now()-1000).toISOString();if(mode==='long-approval')c.expires_at=new Date(Date.now()+25*3600000).toISOString();
if(mode.endsWith('timeout')){const original=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>original(fn,Math.min(ms,25),...args);}
const cfg=path.join(dir,'config.json');fs.writeFileSync(cfg,JSON.stringify(c),{mode:0o600});process.env.VEXA_HUBSPOT_S01_CONFIG=cfg;process.env.VEXA_HUBSPOT_TOKEN='SYNTHETIC-NOT-A-PROVIDER-TOKEN';process.env.VEXA_HUBSPOT_RECONCILIATION_KEY=key;process.env.VEXA_HUBSPOT_APPROVAL_REFERENCE=mode==='mismatched-approval'?'SYNTHETIC-WRONG-APPROVAL':c.authorization_ref;
globalThis.fetch=async(input,init)=>{const u=new URL(input);seen.push(u.pathname);if(u.origin!=='https://api.hubapi.com')throw Error('SYNTHETIC_BAD_HOST');let body;
if(u.pathname.startsWith('/oauth/')){
 if(init.redirect!=='manual'||!(init.signal instanceof AbortSignal))throw Error('SYNTHETIC_TRANSPORT_POLICY');
 if(c.authentication==='private_app'){
  if(u.pathname!=='/oauth/v2/private-apps/get/access-token-info'||init.method!=='POST'||init.headers['content-type']!=='application/json'||init.body!==JSON.stringify({tokenKey:process.env.VEXA_HUBSPOT_TOKEN})||init.headers.authorization)throw Error('SYNTHETIC_PRIVATE_REQUEST');
  body={hubId:123,appId:456,scopes:['conversations.read']};
 }else{if(!u.pathname.startsWith('/oauth/v1/access-tokens/')||init.method!=='GET'||init.body!==undefined)throw Error('SYNTHETIC_OAUTH_REQUEST');body={hub_id:123,app_id:456,token_type:'access',scopes:['conversations.read']};}
 if(mode==='private-wrong-hub')body.hubId=124;if(mode==='private-wrong-app')body.appId=457;if(mode==='private-app-string')body.appId='456';if(mode==='private-hub-string')body.hubId='123';if(mode==='private-app-unsafe')body.appId=9007199254740992;if(mode==='private-app-null')body.appId=null;if(mode==='private-app-zero')body.appId=0;if(mode==='private-app-negative')body.appId=-456;if(mode==='private-app-object')body.appId={toString:()=>456};if(mode==='private-oauth-shape')body={hub_id:123,app_id:456,scopes:['conversations.read']};if(mode==='oauth-private-shape')body={hubId:123,appId:456,scopes:['conversations.read']};if(mode==='oauth-token-type')body.token_type='refresh';
 if(mode==='private-scope-missing')body.scopes=[];if(mode==='private-scope-type')body.scopes='conversations.read';
 if(mode==='private-redirect')return new Response('{}',{status:302,headers:{location:'https://SYNTHETIC-foreign.invalid'}});
 if(mode==='private-redirected')return {status:200,redirected:true};
 if(mode==='private-http')return new Response('SYNTHETIC_SECRET_SENTINEL',{status:401});
 if(mode==='private-oversize')return new Response(' '.repeat(1024*1024+1));
 if(mode==='private-invalid-json')return new Response('SYNTHETIC_SECRET_SENTINEL');
 if(mode==='private-fetch-timeout')return new Promise(()=>{});
 if(mode==='private-body-timeout')return {status:200,redirected:false,body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{}})}};
 }
else if(u.pathname===base)body={results:all.map(id=>({id}))};
else{const t=u.pathname.slice(base.length+1).split('/')[0];body=u.pathname.endsWith('/messages')?{results:[{id:'M'+t,conversationsThreadId:t,type:'MESSAGE',text:'SYNTHETIC '+t,truncationStatus:'NOT_TRUNCATED',senders:[{actorId:'V-123'}]}]}:{id:t};}
return new Response(JSON.stringify(body));};
const {runLive}=await import(process.env.SYNTHETIC_LIVE_MODULE);let result,error;try{result=await runLive();}catch(e){error=e.message;}console.log(JSON.stringify({SYNTHETIC_ONLY:true,result,error,seen}));
`;
function runScopedProbe(mode){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vexa-live-scope-regression-'));try{const r=spawnSync(process.execPath,['--input-type=module','-e',scopedProbe,dir,mode],{env:{...process.env,SYNTHETIC_LIVE_MODULE:new URL('./live.mjs',import.meta.url).href},encoding:'utf8',timeout:5000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}finally{fs.rmSync(dir,{recursive:true});}}
test('live reads exactly authorized 20 direct threads and no bodies before/after them in account page',()=>{const out=runScopedProbe('authorized-synthetic');assert.equal(out.result?.status,'passed',out.error);const base='/conversations/v3/conversations/threads';assert.ok(!out.seen.includes(base),'NO_ACCOUNT_WIDE_LIST_REQUEST');assert.ok(out.seen.every(p=>!p.includes('OUTSIDE')),'NO_UNAUTHORIZED_BODY');assert.equal(out.seen.filter(p=>p.endsWith('/messages')).length,20);});
test('supervisor approval mismatch fails before ANY provider request',()=>{const out=runScopedProbe('mismatched-approval');assert.equal(out.error,'S01_SUPERVISOR_APPROVAL_MISMATCH');assert.deepEqual(out.seen,[]);});

for(const mode of ['private-valid','oauth-valid'])test('explicit authentication '+mode+' reconciles 20 SYN threads',()=>{const out=runScopedProbe(mode);assert.equal(out.result?.status,'passed',out.error);assert.equal(out.seen.filter(p=>p.startsWith('/oauth/')).length,1);assert.equal(out.seen.filter(p=>p.endsWith('/messages')).length,20);});
for(const mode of ['legacy-v3','missing-mode','wrong-mode','client-id','app-number','expired','long-approval'])test('configuration fails before metadata: '+mode,()=>{const out=runScopedProbe(mode);assert.ok(out.error);assert.deepEqual(out.seen,[]);});
for(const mode of ['private-wrong-hub','private-wrong-app','private-app-string','private-hub-string','private-app-unsafe','private-app-null','private-app-zero','private-app-negative','private-app-object','private-oauth-shape','oauth-private-shape','oauth-token-type','private-scope-missing','private-scope-type','private-redirect','private-redirected','private-http','private-oversize','private-invalid-json','private-fetch-timeout','private-body-timeout'])test('metadata rejection with no fallback or conversations: '+mode,()=>{const out=runScopedProbe(mode);assert.match(out.error,/^S01_/);assert.equal(out.seen.length,1);assert.ok(out.seen[0].startsWith('/oauth/'));assert.ok(!JSON.stringify(out).includes('SYNTHETIC_SECRET_SENTINEL'));});
