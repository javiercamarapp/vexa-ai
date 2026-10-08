// Prepare/capture the native witness BEFORE any local test imports the candidate.
import {prepareLiveControl} from './support/F03-HubSpot-v5/bootstrap.mjs';
import test, {after} from 'node:test';
const control=await prepareLiveControl();
after(()=>control.close());
try { await import('./support/F03-HubSpot/local.test.mjs'); }
catch(error){control.close();throw error;}
test('S01 real-provider dual-oracle witness', {timeout:250000}, async()=>{
 try { await control.runLive(); } finally { control.close(); }
});
