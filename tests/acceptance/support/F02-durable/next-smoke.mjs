// Build authored candidate in TMP; exercise genuine Next route, no DB claim.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyBuildInputs,buildEnvironment} from '../../scaffold-copy.mjs';
const candidate=process.env.VEXA_CANDIDATE;assert.ok(candidate,'CANDIDATE_REQUIRED');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'f02-next-smoke-'));
let child;
const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['apps/web/src/lib/imports/server.ts','packages/jobs/imports.mjs','supabase/migrations/0005_import_outbox.sql'];
const before=Object.fromEntries(files.map(f=>[f,digest(path.join(candidate,f))]));
try {
 copyBuildInputs(candidate,tmp);const env=buildEnvironment(process.env,tmp);
 for(const args of [['ci','--offline','--ignore-scripts','--no-audit','--no-fund'],['run','build','--workspace','@vexa/web']]){
  const r=spawnSync('npm',args,{cwd:tmp,env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  console.log('COMMAND',JSON.stringify(['npm',...args]),'EXIT',r.status,'ERROR',r.error?.code??null);process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');assert.equal(r.status,0,'NEXT_BUILD_SETUP');
 }
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 child=spawn(process.execPath,[path.join(tmp,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:path.join(tmp,'apps/web'),env,stdio:'ignore'});
 let response;for(let i=0;i<100;i++){try{response=await fetch(`http://127.0.0.1:${port}/api/imports`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(1000)});break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert.ok(response,'NEXT_NOT_READY');assert.equal(response.status,503,'UNCONFIGURED_FAIL_CLOSED');const body=await response.json();assert.equal(body.error.code,'auth_not_configured');assert.ok(body.meta.trace_id);console.log('NEXT_REAL_ROUTE:503/auth_not_configured; no authenticated SQL/Storage SSR claim');
} finally {
 if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}
 for(const [f,h] of Object.entries(before))assert.equal(digest(path.join(candidate,f)),h,'SOURCE_UNCHANGED:'+f);
 console.log('SOURCE_SHA256',JSON.stringify(before));fs.rmSync(tmp,{recursive:true,force:true});
}
