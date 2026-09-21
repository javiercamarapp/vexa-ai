import test from 'node:test';
import assert from 'node:assert/strict';
const aliases=await import('./aliases.mjs').catch(()=>({}));
const id='00000000-0000-4000-8000-000000000001';
test('alias confirmation requires an explicit human approval before opening a transaction',async()=>{
 assert.equal(typeof aliases.createAliasRepository,'function','durable alias repository missing');
 let calls=0;const repo=aliases.createAliasRepository({database:{transaction(){calls++;throw Error('unexpected');}}});
 await assert.rejects(repo.confirm({sourceConversationId:id,targetConversationId:id,expectedVersion:0,evidenceRef:'fixture:1',reason:'same source'}),/ALIAS_APPROVAL_REQUIRED/);assert.equal(calls,0);
});
test('undo requires current version and bounded nonblank evidence',async()=>{
 assert.equal(typeof aliases.createAliasRepository,'function');
 const repo=aliases.createAliasRepository({database:{transaction(){throw Error('unexpected');}}});
 await assert.rejects(repo.undo({sourceConversationId:id,expectedVersion:-1,evidenceRef:'fixture:1',reason:'mistake',approved:true}),/ALIAS_VERSION_INVALID/);
 await assert.rejects(repo.undo({sourceConversationId:id,expectedVersion:1,evidenceRef:' ',reason:'mistake',approved:true}),/ALIAS_EVIDENCE_REQUIRED/);
});
test('server-only repository requires the existing transaction boundary',()=>{
 assert.equal(typeof aliases.createAliasRepository,'function');assert.throws(()=>aliases.createAliasRepository({}),/ALIAS_DATABASE_REQUIRED/);
});
