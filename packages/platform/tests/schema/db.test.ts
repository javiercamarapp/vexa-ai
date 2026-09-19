import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase,requireRow,type SqlConnection,type DatabaseScope} from '../../src/db.ts';
const member={tenant_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:'11111111-1111-4111-8111-111111111111',role:'owner' as const,status:'active' as const,permissions_version:1};
const identity={async getUser(){return {id:member.user_id};},async memberships(){return [member];}};
function fixture(role='owner',failure?:string){
 const statements:{text:string;values:unknown}[]=[];let released=false;
 const connection={async query(text:string,values?:unknown){statements.push({text,values});if(failure&&text==='SELECT domain')throw Object.assign(new Error('SECRET connection string'),{code:failure});return {rows:text.includes('FROM public.memberships')?[{...member,role}]:[],rowCount:0};},release(){released=true;}} as SqlConnection;
 return {db:createDatabase({identity,pool:{async connect(){return connection;}}}),statements,released:()=>released};
}
test('missing configuration is actionable 503; missing row is 404',async()=>{
 await assert.rejects(createDatabase({identity}).transaction('read',async()=>[]),{status:503,code:'database_not_configured'});
 assert.throws(()=>requireRow({rows:[],rowCount:0}),{status:404});
});
test('transaction binds verified identity, read-only mode, no reusable capability',async()=>{
 const f=fixture();let captured:DatabaseScope|undefined;
 await f.db.transaction('read',async scope=>{captured=scope;assert.equal(scope.tenantId,member.tenant_id);await scope.query('SELECT domain');});
 assert.equal(f.statements[0].text,'BEGIN READ ONLY');assert.deepEqual(f.statements[2].values,[member.user_id,member.tenant_id,'read']);
 assert.equal(f.statements.at(-1)?.text,'COMMIT');assert.ok(f.released());
 await assert.rejects(captured!.query('SELECT domain'),{code:'database_scope_expired'});
});
test('fresh database membership determines role, rollback and release on forbidden action',async()=>{
 const f=fixture('viewer');await assert.rejects(f.db.transaction('configure',async()=>true),{status:403});
 assert.equal(f.statements.at(-1)?.text,'ROLLBACK');assert.ok(f.released());
});
test('database failure never becomes an empty list and never exposes driver secrets',async()=>{
 const f=fixture('owner','08006');await assert.rejects(f.db.transaction('read',s=>s.query('SELECT domain')),{status:503,message:'database_unavailable'});
 assert.equal(f.statements.at(-1)?.text,'ROLLBACK');
});
test('RBAC contractual matrix',async()=>{
 const allowed={owner:['read','import','configure','propose','approve','execute','retain'],analyst:['read','import','propose'],operator:['read','propose','execute'],viewer:['read']};
 for(const [role,actions] of Object.entries(allowed))for(const action of allowed.owner){const f=fixture(role);const p=f.db.transaction(action as Parameters<typeof f.db.transaction>[0],async()=>true);if(actions.includes(action))assert.equal(await p,true);else await assert.rejects(p,{status:403});}
});
