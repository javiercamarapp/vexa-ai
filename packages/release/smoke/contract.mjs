import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const fail=(code,blocked=false)=>{throw Object.assign(Error(code),{code,blocked});};
export const check=(value,code)=>{if(!value)fail(code);};
export const operations=['read','import_syn','export_syn','pause_consumer','resume_consumer','revoke_A'];
export function assertAuthorizationCurrent(authorization){check(Date.parse(authorization.expiresAt)>Date.now(),'AUTHORIZATION_EXPIRED');}
export async function privateJson(file){const s=await fs.lstat(file);check(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o777)===0o600&&s.size<=1048576,'PRIVATE_INPUT_REQUIRED');return JSON.parse(await fs.readFile(file,'utf8'));}
export async function privateDirectory(dir){const s=await fs.lstat(dir);check(s.isDirectory()&&!s.isSymbolicLink()&&(s.mode&0o777)===0o700,'PRIVATE_DIRECTORY_REQUIRED');}
export function origin(value,local){let u;try{u=new URL(value);}catch{fail('ORIGIN_INVALID');}check(u.origin===value&&!u.username&&!u.password&&(u.protocol==='https:'||(local&&u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname))),'ORIGIN_INVALID');return u.origin;}
export function validate(release,authorization,config){
 check(release.schema_version==='vexa-release-manifest-v1'&&/^[a-f0-9]{40}$/.test(release.source?.commit_sha),'RELEASE_INVALID');
 check(authorization.schema==='vexa-smoke-authorization-v1'&&authorization.confirmed===true&&authorization.syntheticOnly===true&&typeof authorization.operator==='string'&&authorization.operator.length>0&&typeof authorization.approvalReference==='string'&&authorization.approvalReference.length>0,'AUTHORIZATION_REQUIRED');
 check(typeof authorization.id==='string'&&authorization.id.length<=100&&Date.parse(authorization.expiresAt)>Date.now()&&Date.parse(authorization.expiresAt)<Date.now()+86400000,'AUTHORIZATION_EXPIRED');
 check(authorization.releaseSha===release.source.commit_sha&&authorization.origin===release.destination?.url&&authorization.origin===config.origin,'DESTINATION_BINDING_INVALID');
 const local=authorization.environment==='local-owned';check(local||authorization.environment==='remote-authorized','ENVIRONMENT_INVALID');origin(config.origin,local);origin(config.storageOrigin,local);check(authorization.storageOrigin===config.storageOrigin,'STORAGE_SCOPE_INVALID');
 check(Array.isArray(authorization.operations)&&operations.every(x=>authorization.operations.includes(x)),'OPERATIONS_NOT_AUTHORIZED');
 const uuid=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);check(uuid(config.accounts?.A?.tenantId)&&uuid(config.accounts?.B?.tenantId)&&config.accounts.A.tenantId!==config.accounts.B.tenantId,'TWO_TENANTS_REQUIRED');
 check(JSON.stringify(authorization.tenants)===JSON.stringify([config.accounts.A.tenantId,config.accounts.B.tenantId]),'TENANT_SCOPE_INVALID');
 for(const account of Object.values(config.accounts)){check(Array.isArray(account.cookies)&&account.cookies.length>0&&account.cookies.length<=10,'AUTH_SESSION_REQUIRED');for(const c of account.cookies)check(/^[a-zA-Z0-9_.-]+$/.test(c.name)&&typeof c.value==='string'&&c.value.length<20000&&!/[\r\n;]/.test(c.value),'AUTH_SESSION_INVALID');check(account.cookies.some(c=>c.name==='vexa_active_org'&&c.value===account.tenantId),'ACTIVE_TENANT_MISMATCH');}
 for(const key of ['connectionId','problemId','customerId','briefId','foreignProblemId','foreignCustomerId'])check(uuid(config.fixture?.[key]),'FIXTURE_IDS_REQUIRED');
 const q=new URLSearchParams(config.fixture.query);check(uuid(q.get('snapshot_id'))&&/^[a-f0-9]{64}$/.test(q.get('scope_hash')??''),'PINNED_SCOPE_REQUIRED');
 for(const key of q.keys())check(['snapshot_id','scope_hash','date_start','date_end','timezone','date_basis','currency','basis','severity','source','category'].includes(key),'SCOPE_QUERY_INVALID');
 check(config.fixture.expected?.exposureMinor==='30000'&&config.fixture.expected?.refundMinor==='1500'&&config.fixture.expected.currency==='USD','FINANCIAL_ORACLE_REQUIRED');
 check(Number.isInteger(config.timeoutMs)&&config.timeoutMs>=1000&&config.timeoutMs<=180000,'TIMEOUT_INVALID');
 check(Number.isInteger(config.operatorTimeoutMs)&&config.operatorTimeoutMs>=1000&&config.operatorTimeoutMs<=180000,'OPERATOR_TIMEOUT_INVALID');
 check(typeof config.controlDirectory==='string'&&path.isAbsolute(config.controlDirectory),'OPERATOR_CONTROL_REQUIRED');
 return {local,expectedSha:release.source.commit_sha};
}
