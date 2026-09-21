import test from 'node:test';
import assert from 'node:assert/strict';
import {safeHealthError,healthView} from './health.mjs';
test('provider secrets never become health diagnostics',()=>{assert.deepEqual(safeHealthError({status:401,message:'Bearer secret https://api.test?token=secret'}),{state:'reconnect_required',code:'RECONNECT_REQUIRED'});assert.deepEqual(safeHealthError(new Error('token=secret')),{state:'stale',code:'SYNC_FAILED'});assert.equal(safeHealthError({code:'TIMEOUT'}).code,'TIMEOUT');});
test('unknown health remains unknown; response explicitly excludes credentials',()=>{const v=healthView({id:'x',source:'zendesk',account_id:'a',status:'active',credential_ref:'secret',watermark:{token:'secret'}},0);assert.equal(v.lastSuccess,null);assert.equal(v.coverage,null);assert.equal(v.lagSeconds,null);assert.equal(JSON.stringify(v).includes('secret'),false);});
