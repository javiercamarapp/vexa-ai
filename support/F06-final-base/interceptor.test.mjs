import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const moduleURL=process.env.F06_PREVIEW_UI_STATES_MODULE?pathToFileURL(process.env.F06_PREVIEW_UI_STATES_MODULE):new URL('../../tests/acceptance/support/F02-preview/ui-states.mjs',import.meta.url);
const {uiStates}=await import(moduleURL);
test('a failed browser assertion removes only its abort interceptor before later cases',async()=>{
 const routes=new Map(),unrouted=[];let attempts=0;
 const locator={filter(){return this;},async waitFor(){},async click(){attempts++;throw Error('SYN_INTERACTION_FAILURE');}};
 const page={async route(pattern,handler){routes.set(String(pattern),handler);},async unroute(pattern,handler){assert.equal(routes.get(String(pattern)),handler,'ONLY_OWN_INTERCEPTOR');routes.delete(String(pattern));unrouted.push(handler);},async goto(){const handler=[...routes.values()][0];void handler({async continue(){}});},getByRole(){return locator;}};
 await assert.rejects(uiStates(page,{base:'http://127.0.0.1:1'}),/SYN_INTERACTION_FAILURE/);
 assert.equal(attempts,1);assert.equal(unrouted.length,2,'LOADING_AND_ABORT_INTERCEPTORS_REMOVED');assert.equal(routes.size,0,'ABORT_MUST_NOT_POISON_LATER_CASES');
});
