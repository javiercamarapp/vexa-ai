import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeNext, assertOrigin, resolveSession, authorizeSelection, type IdentityPort, type Membership} from '../src/session.ts';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const origin='http://localhost:3000';
const member:Membership={tenant_id:A,user_id:'user-a',role:'owner',status:'active',permissions_version:1};
function fixture(rows:Membership[]=[member]):IdentityPort { return {getUser:async()=>({id:'user-a'}),memberships:async()=>rows}; }
for(const next of ['https://evil.test','//evil.test','/\\evil.test','/a/..//evil.test','/%5cevil.test','/%2f%2fevil.test']) test(`redirect rejects ${next}`,()=>assert.equal(safeNext(next,origin),'/'));
test('local redirect preserves query and normalized path',()=>assert.equal(safeNext('/a/../?tab=one',origin),'/?tab=one'));
for(const value of [null,'https://evil.test','http://localhost:3000.evil.test','null']) test(`CSRF rejects ${value}`,()=>assert.throws(()=>assertOrigin(value,origin),{code:'csrf_rejected'}));
test('fresh same-origin POST passes',()=>assert.doesNotThrow(()=>assertOrigin(origin,origin)));
test('unauthenticated never queries membership',async()=>{let read=false; await assert.rejects(resolveSession({getUser:async()=>null,memberships:async()=>{read=true;return [member];}},A),{status:401});assert.equal(read,false);});
test('foreign selection fails authorization; prior selection still works',async()=>{const port=fixture();await assert.rejects(authorizeSelection(port,B),{status:403,code:'organization_not_authorized'});assert.equal((await resolveSession(port,A)).active.tenant_id,A);});
test('valid new selection returns selected UUID',async()=>{const port=fixture([member,{...member,tenant_id:B}]);assert.equal((await authorizeSelection(port,B)).tenant_id,B);});
test('revocation blocks next request with same authenticated user',async()=>{const rows=[{...member}];const port=fixture(rows);await resolveSession(port,A);rows[0].status='revoked';await assert.rejects(resolveSession(port,A),{status:403});});
test('revoked selected membership never silently switches',async()=>await assert.rejects(resolveSession(fixture([{...member,status:'revoked'},{...member,tenant_id:B}]),A),{status:403}));
test('invited and foreign user rows confer no access',async()=>await assert.rejects(resolveSession(fixture([{...member,status:'invited'},{...member,user_id:'other'}])),{status:403}));
test('DB failures stay failures, never empty memberships',async()=>await assert.rejects(resolveSession({getUser:async()=>({id:'user-a'}),memberships:async()=>{throw new Error('DB unavailable');}}),/DB unavailable/));
test('logout invalidation blocks next request',async()=>{let loggedIn=true;const port={...fixture(),getUser:async()=>loggedIn?{id:'user-a'}:null};await resolveSession(port,A);loggedIn=false;await assert.rejects(resolveSession(port,A),{status:401});});
