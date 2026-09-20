import './support/F03-HubSpot/local.test.mjs';
import test from 'node:test';
import {runLive} from './support/F03-HubSpot/live.mjs';
test('F03-01 S01 real account scopes messages and independent UI/export reconciliation',{timeout:270000},async()=>{
 await runLive();
});
