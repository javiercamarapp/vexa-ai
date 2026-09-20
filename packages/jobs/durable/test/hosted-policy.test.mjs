import test from 'node:test';import assert from 'node:assert/strict';
import {createHostedHandler} from '../hosted.mjs';
import {workerCredentials} from '../credentials.mjs';
const secret='SYNTHETIC'.repeat(5);
test('hosted machine protocol rejects scopes and configuration before creating runtime',async()=>{
 let calls=0;const runtime=async()=>{calls++;throw Error('unavailable');};
 const missing=createHostedHandler({runtime});assert.equal((await missing(new Request('http://localhost',{method:'POST'}))).status,503);
 const h=createHostedHandler({runtime,secret,platformTimeoutMs:60000});
 assert.equal((await h(new Request('http://localhost',{method:'POST',headers:{Authorization:'Bearer wrong'}}))).status,401);
 assert.equal((await h(new Request('http://localhost',{method:'POST',headers:{Authorization:'Bearer '+secret},body:'{"tenant":"A"}'}))).status,400);assert.equal(calls,0);
 assert.equal((await h(new Request('http://localhost',{method:'POST',headers:{Authorization:'Bearer '+secret}}))).status,503);assert.equal(calls,1);
 const invalid=createHostedHandler({runtime,secret,platformTimeoutMs:20000});assert.equal((await invalid(new Request('http://localhost',{method:'POST'}))).status,503);
});
test('credentials never fall back to a browser access token',()=>{assert.throws(()=>workerCredentials({VEXA_WORKER_ACCESS_TOKEN:'browser'}),/WORKER_CONFIGURATION_REQUIRED/);});
