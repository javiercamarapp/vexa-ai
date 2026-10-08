import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {routeMode} from '../../tests/acceptance/support/F01-04/routes.mjs';

test('official F01-04 stays full under inherited probe hints; narrow modes require explicit caller',()=>{
 const prior=process.env.VEXA_F01_04_MODE;
 try{
  process.env.VEXA_F01_04_MODE='role-probe';
  assert.equal(routeMode(),'routes');
  assert.equal(routeMode({mode:'routes'}),'routes');
  assert.equal(routeMode({mode:'role-probe'}),'role-probe');
  assert.equal(routeMode({mode:'dependency-probe'}),'dependency-probe');
  assert.throws(()=>routeMode({mode:'all-pass'}),/ROUTE_TEST_MODE/);
  const entry=fs.readFileSync(new URL('../../tests/acceptance/F01-04.test.mjs',import.meta.url),'utf8');
  assert.ok(entry.includes("routes(h,candidate,{mode:'routes'})"),'OFFICIAL_ENTRY_EXPLICIT_FULL_SCOPE');
 }finally{if(prior===undefined)delete process.env.VEXA_F01_04_MODE;else process.env.VEXA_F01_04_MODE=prior;}
});
