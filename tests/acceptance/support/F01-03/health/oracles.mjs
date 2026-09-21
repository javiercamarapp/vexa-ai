import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {q,insert} from '../matrix.mjs';
import {read,write,rows,denied} from '../harness.mjs';
import {backend} from '../import-uploads/oracles.mjs';
export const table='connection_health';
export const present=h=>h.sql("SELECT to_regclass('public.connection_health') IS NOT NULL")==='t';
const expected=[['organizations',{tenant_id:'id'}],['connections',{tenant_id:'tenant_id',connection_id:'id'}],['memberships',{tenant_id:'tenant_id',actor_id:'user_id'}],['sync_cursors',{tenant_id:'tenant_id',sync_id:'id'}]];
export function schema(h,fks){
 assert.deepEqual(h.json("SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid='public.connection_health'::regclass"),[true,true],'HEALTH_FORCE_RLS');
 assert.equal(h.sql("SELECT attnotnull FROM pg_attribute WHERE attrelid='public.connection_health'::regclass AND attname='tenant_id'"),'t','HEALTH_TENANT_NOT_NULL');
 for(const role of ['anon','authenticated','service_role','vexa_backend'])for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},'public.connection_health',${q(action)})`),role==='vexa_backend'&&['SELECT','INSERT','UPDATE'].includes(action)?'t':'f',`HEALTH_GRANT:${role}:${action}`);
 const keys=fks.filter(k=>k.table===table);assert.equal(keys.length,4,'HEALTH_FK_COUNT');for(const[parent,mapping]of expected)assert.ok(keys.some(k=>k.parent===parent&&k.validated&&JSON.stringify(Object.entries(k.mapping).sort())===JSON.stringify(Object.entries(mapping).sort())),'HEALTH_FK_REQUIRED:'+parent);
 assert.deepEqual(h.json("SELECT jsonb_agg(a.attname ORDER BY a.attname) FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.conrelid='public.connection_health'::regclass AND c.contype='p'"),['connection_id','tenant_id'],'HEALTH_COMPOSITE_PK');
}
export function seed(h,f,actors){const out={};for(const side of ['a','b']){
 const c=f[side].connections,a=actors[side];const cursor=f.sync[side].sync_cursors;h.sql(`UPDATE sync_cursors SET fence=1,worker_id=${q(randomUUID())},lease_until=clock_timestamp()+interval '30 minutes' WHERE tenant_id=${q(c.tenant_id)} AND id=${q(cursor.id)}`);
 const row={tenant_id:c.tenant_id,connection_id:c.id,sync_id:cursor.id,sync_fence:1,attempt_id:randomUUID(),actor_id:a.id,state:'running'};
 h.sql(`BEGIN; SELECT set_config('request.jwt.claim.sub',${q(a.id)},true),set_config('vexa.tenant_id',${q(c.tenant_id)},true),set_config('vexa.action','import',true); ${insert(table,row)}; COMMIT;`);out[side]={...f[side],memberships:f[side].memberships,sync_cursors:cursor,connection_health:row};
}return out;}
function scans(result,connections,label){assert.equal(result.code,'00000',label);assert.deepEqual(result.rows.map(r=>r.connection_id).sort(),connections.sort(),label);}
export function access(h,f,actors){
 const a=f.a.connection_health,b=f.b.connection_health,A=a.tenant_id,B=b.tenant_id;
 for(const who of [null,...Object.values(actors)])denied(h.probe(read(table),who),'HEALTH_DIRECT_DENIED');denied(h.probe('SET LOCAL ROLE service_role; '+read(table)),'HEALTH_SERVICE_DENIED');
 for(const role of ['a','analyst','operator','viewer','dual'])scans(backend(h,read(table),actors[role],A,'read'),[a.connection_id],'HEALTH_SUMMARY_READ:'+role);
 for(const [actor,tenant]of [[actors.a,B],[actors.dual,null],[actors.outsider,A]])scans(backend(h,read(table),actor,tenant,'read'),[],'HEALTH_READ_SCOPE');
 const remove=`DELETE FROM connection_health WHERE tenant_id=${q(A)};`;
 for(const role of ['a','analyst']){const who=actors[role];rows(backend(h,write(insert(table,{...a,attempt_id:randomUUID(),actor_id:who.id})),who,A,'import',remove),[0],'HEALTH_IMPORT_INSERT:'+role);rows(backend(h,write(`UPDATE connection_health SET actor_id=${q(who.id)},state='partial',error_code='CONTINUATION' WHERE tenant_id=${q(A)}`),who,A,'import'),[0],'HEALTH_IMPORT_UPDATE:'+role);}
 for(const role of ['operator','viewer','outsider']){const who=actors[role];denied(backend(h,write(insert(table,{...a,actor_id:who.id})),who,A,'import',remove),'HEALTH_WRITE_ROLE');denied(backend(h,write(`UPDATE connection_health SET actor_id=${q(who.id)},state='partial' WHERE tenant_id=${q(A)}`),who,A,'import'),'HEALTH_UPDATE_ROLE');}
 for(const action of ['read','configure','retain','approve','execute','propose'])denied(backend(h,write(insert(table,a)),actors.a,A,action,remove),'HEALTH_ACTION_SCOPE');
 denied(backend(h,write(insert(table,{...b,actor_id:actors.dual.id})),actors.dual,A,'import',`DELETE FROM connection_health WHERE tenant_id=${q(B)};`),'HEALTH_DUAL_INSERT_SCOPE');
 denied(backend(h,write(`UPDATE connection_health SET actor_id=${q(actors.dual.id)},state='partial' WHERE tenant_id=${q(B)}`),actors.dual,A,'import'),'HEALTH_DUAL_UPDATE_SCOPE');
 denied(backend(h,write(`UPDATE connection_health SET actor_id=${q(actors.b.id)} WHERE tenant_id=${q(A)}`),actors.a,A,'import'),'HEALTH_ACTOR_SPOOF');
 denied(backend(h,write('DELETE FROM connection_health'),actors.a,A,'retain'),'HEALTH_NO_DELETE');
 denied(backend(h,write(`UPDATE connections SET account_id='SYN-EVIL',credential_ref='SYN-EVIL' WHERE id=${q(f.a.connections.id)}`),actors.analyst,A,'import'),'HEALTH_NO_CONFIG_ESCALATION');
 const blocked=`ALTER TABLE connection_health DISABLE TRIGGER USER; UPDATE connection_health SET state='reconnect_required',provider_permissions='revoked',error_code='RECONNECT_REQUIRED' WHERE tenant_id=${q(A)}; ALTER TABLE connection_health ENABLE TRIGGER USER;`;
 const reset=actor=>`UPDATE connection_health SET actor_id=${q(actor.id)},state='stale',provider_permissions='unknown',error_code='RECONNECT_REQUESTED' WHERE tenant_id=${q(A)}`;
 rows(backend(h,write(reset(actors.a)),actors.a,A,'configure',blocked),[0],'HEALTH_OWNER_RECHECK_POSITIVE');
 for(const role of ['analyst','operator','viewer','outsider'])denied(backend(h,write(reset(actors[role])),actors[role],A,'configure',blocked),'HEALTH_RECHECK_OWNER_ONLY');
 assert.notEqual(backend(h,write(reset(actors.a)),actors.a,A,'import',blocked).code,'00000','HEALTH_IMPORT_CANNOT_CLEAR_REVOCATION');
 for(const change of ["last_success=last_attempt","checkpoint_hash='"+'d'.repeat(64)+"'",'attempt_id='+q(randomUUID()),'observed_unique=100,accepted_unique=100,rejected_unique=0'])assert.notEqual(backend(h,write(reset(actors.a).replace(' WHERE',','+change+' WHERE')),actors.a,A,'configure',blocked).code,'00000','HEALTH_RECHECK_PRESERVES_EVIDENCE:'+change);
 const revoked=`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(A)} AND user_id=${q(actors.a.id)};`;
 scans(backend(h,read(table),actors.a,A,'read',revoked),[],'HEALTH_REVOKED_READ');denied(backend(h,write("UPDATE connection_health SET state='partial'"),actors.a,A,'import',revoked),'HEALTH_REVOKED_WRITE');
 for(const[col,value]of [['tenant_id',B],['connection_id',b.connection_id],['sync_id',b.sync_id],['sync_fence','2']])assert.notEqual(backend(h,write(`UPDATE connection_health SET ${col}=${q(value)} WHERE tenant_id=${q(A)}`),actors.a,A,'import').code,'00000','HEALTH_IDENTITY_IMMUTABLE:'+col);
 assert.notEqual(backend(h,write(`UPDATE connection_health SET state='stale',last_success=last_attempt WHERE tenant_id=${q(A)}`),actors.a,A,'import').code,'00000','HEALTH_FAILED_SUCCESS_GUARD');
}
export function fk(h,f,key){const row={...f.a.connection_health};const physical=value=>h.probe(`ALTER TABLE connection_health DISABLE TRIGGER USER; DELETE FROM connection_health; ${write(insert(table,value))} SET CONSTRAINTS ALL IMMEDIATE;`);rows(physical(row),[0],'HEALTH_PHYSICAL_FK_POSITIVE:'+key.name);const bad={...row};if(key.parent==='organizations')bad.tenant_id=randomUUID();else for(const[col,ref]of Object.entries(key.mapping))if(col!=='tenant_id')bad[col]=f.b[key.parent][ref];const result=physical(bad);assert.equal(result.code,'23503','HEALTH_FK_CROSS:'+key.name);assert.ok(result.constraint,'HEALTH_FK_NAMED');}
