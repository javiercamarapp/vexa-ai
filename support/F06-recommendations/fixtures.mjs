// SYN277 reuses actual authorized extraction, vector grouping and immutable financial publication.
export {seedWorkspace as seedRecommendations,scope} from '../F06-workspace/fixtures.mjs';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {q} from './harness.mjs';
export async function createReader(h){
 const response=await h.auth('auth','/signup',null,{method:'POST',body:{email:'syn-reader-'+randomUUID()+'@example.test',password:'SYN-'+randomUUID()}});assert.equal(response.status,200,'REAL_READER_AUTH_SIGNUP');assert.ok(response.data.access_token&&response.data.refresh_token);const actor={id:response.data.user.id,token:response.data.access_token,refresh:response.data.refresh_token,tenant:h.A.tenant};h.sql(`INSERT INTO memberships(tenant_id,user_id,role,status) VALUES(${q(actor.tenant)},${q(actor.id)},'viewer','active')`);return actor;
}
