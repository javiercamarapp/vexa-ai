import test from 'node:test';
import assert from 'node:assert/strict';
import {canaries,syntheticJWT,assertNoSecrets,redact,inspectPublished} from '../ci/artifact-secrets.mjs';
import {buildEnvironment} from '../../scaffold-copy.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

test('role-specific detection; public JWT allowed; nonce unique; diagnostics redacted',()=>{
 const c=canaries();assert.notEqual(c.nonce,canaries().nonce);
 for(const role of ['anon','authenticated','public'])assert.doesNotThrow(()=>assertNoSecrets(syntheticJWT(role,c.nonce),c,'test'));
 const foreign=syntheticJWT('service_role','independent-reviewer');
 for(const value of [foreign,JSON.stringify({key:foreign}),encodeURIComponent(foreign),foreign.replaceAll('.','\\u002e')])assert.throws(()=>assertNoSecrets(value,c,'test'),/^Error: CLIENT_SECRET_LEAK:SERVICE_ROLE_JWT:test$/);
 assert.throws(()=>assertNoSecrets(c.server,c,'test'),/SERVER_CANARY/);
 for(const value of [c.server,c.service,c.anon,foreign])assert.ok(!redact(value,c).includes(value));
 const env=buildEnvironment({PATH:process.env.PATH,SUPABASE_SERVICE_ROLE_KEY:foreign,NEXT_PUBLIC_BAD:foreign,NODE_OPTIONS:'bad'},'/tmp/build');
 for(const key of ['SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_BAD','NODE_OPTIONS'])assert.equal(env[key],undefined);
});

test('published artifacts and actual HTTP responses fail independently, restore healthy',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'leak-unit-'));const c=canaries();let mode='healthy';
 fs.mkdirSync(path.join(root,'public'));fs.writeFileSync(path.join(root,'public','anon.txt'),c.anon);
 const server=http.createServer((req,res)=>{if(mode==='header')res.setHeader('x-fixture',c.server);res.end(mode==='http'?syntheticJWT('service_role','foreign'):c.anon);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 try {
  await inspectPublished(root,origin,c);
  mode='http';await assert.rejects(inspectPublished(root,origin,c),/SERVICE_ROLE_JWT:http/);mode='header';await assert.rejects(inspectPublished(root,origin,c),/SERVER_CANARY:response_headers/);mode='healthy';
  for(const dir of ['public','.next/static','.next/server/app']) {
   fs.mkdirSync(path.join(root,dir),{recursive:true});const file=path.join(root,dir,'leak.html');fs.writeFileSync(file,c.server);
   await assert.rejects(inspectPublished(root,origin,c),/SERVER_CANARY/);fs.unlinkSync(file);
  }
  await inspectPublished(root,origin,c);
 }finally {await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
