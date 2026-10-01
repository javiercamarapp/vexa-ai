import assert from 'node:assert/strict';
export {seedNotificationResource} from '../F06-notifications/fixtures.mjs';
export {createReader} from '../F06-recommendations/fixtures.mjs';
export {q} from './harness.mjs';
export async function preferences(h,actor,eventType='brief.available',enabled=true,channel='inapp'){
 for(const type of ['*',eventType]){const loaded=await h.request(actor,'/api/notifications/preferences');assert.equal(loaded.status,200);const row=loaded.data.data.preferences.find(x=>x.channel===channel&&x.eventType===type);const result=await h.request(actor,'/api/notifications/preferences',{channel,eventType:type,enabled,expectedVersion:row.version});assert.equal(result.status,200,JSON.stringify(result.data));}
}
export async function policy(h,actor,channel='inapp',enabled=true){const loaded=await h.request(actor,'/api/notifications/delivery');assert.equal(loaded.status,200);const row=loaded.data.data.find(x=>x.channel===channel);const input={channel,enabled,expectedVersion:row.version,intervalMs:1000,digestWindowMs:0,maxAttempts:2,lifetimeMs:60000};const result=await h.request(actor,'/api/notifications/delivery',input);assert.equal(result.status,200,JSON.stringify(result.data));return input;}
