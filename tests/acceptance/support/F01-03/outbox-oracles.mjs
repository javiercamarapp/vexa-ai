import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {q,insert} from './matrix.mjs';
import {write,denied} from './harness.mjs';
import {backend} from './import-uploads/oracles.mjs';
export const tables=['notification_delivery_policies','notification_outbox','notification_outbox_items','notification_dispatch_limits','notification_reconciliation_evidence','notification_reconciliations'];
export const present=h=>tables.filter(t=>h.sql(`SELECT to_regclass(${q('public.'+t)}) IS NOT NULL`)==='t');
export const ownsFk=k=>tables.includes(k.table);
const proofTable='notification_reconciliation_evidence';
const json=x=>q(JSON.stringify(x))+'::jsonb';
const scope=(a,t,action)=>`DO $ctx$ BEGIN PERFORM set_config('request.jwt.claim.sub',${q(a.id)},true);PERFORM set_config('vexa.tenant_id',${q(t)},true);PERFORM set_config('vexa.action',${q(action)},true);END $ctx$;SET LOCAL ROLE vexa_backend;`;
const run=(h,a,t,action,sql)=>h.json('BEGIN;'+scope(a,t,action)+sql+';COMMIT;');
const policy=channel=>({channel,enabled:true,expectedVersion:0,intervalMs:1000,digestWindowMs:0,maxAttempts:5,lifetimeMs:86400000});
const rpc=(name,...args)=>`public.${name}(${args.join(',')})`;
const ok=(r,label)=>{assert.equal(r.code,'00000',label+':'+JSON.stringify(r));return r.rows;};
const reject=(r,label,codes=['42501','23514','23503','23505','40001'])=>assert.ok(codes.includes(r.code),label+':'+JSON.stringify(r));
const key=(table,row)=>table==='notification_outbox_items'?`tenant_id=${q(row.tenant_id)} AND event_id=${q(row.event_id)} AND user_id=${q(row.user_id)} AND channel=${q(row.channel)}`:table==='notification_dispatch_limits'?`tenant_id=${q(row.tenant_id)} AND user_id=${q(row.user_id)} AND channel=${q(row.channel)}`:`tenant_id=${q(row.tenant_id)} AND id=${q(row.id)}`;
const read=(table,row)=>`SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM public.${table} x WHERE ${key(table,row)};`;
export function schema(h,fks){
 assert.deepEqual(present(h),tables,'OUTBOX_SIX_CANONICAL_TABLES');
 for(const table of tables){assert.deepEqual(h.json(`SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid=${q('public.'+table)}::regclass`),[true,true],'OUTBOX_FORCE_RLS:'+table);assert.equal(h.sql(`SELECT attnotnull FROM pg_attribute WHERE attrelid=${q('public.'+table)}::regclass AND attname='tenant_id'`),'t');
  for(const role of ['anon','authenticated','service_role','vexa_backend','vexa_notification_verifier'])for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']){const allowed=table===proofTable?role==='vexa_notification_verifier'&&['INSERT','SELECT'].includes(action):role==='vexa_backend'&&action==='SELECT';assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},${q('public.'+table)},${q(action)})`),allowed?'t':'f','OUTBOX_MINIMAL_GRANT:'+table+':'+role+':'+action);}
 }
 const own=fks.filter(ownsFk);assert.equal(own.length,16,'OUTBOX_SIXTEEN_TENANT_FKS');for(const k of own)assert.ok(k.validated&&(k.parent==='organizations'?k.mapping.tenant_id==='id':k.mapping.tenant_id==='tenant_id'),'OUTBOX_TENANT_FK:'+k.name);
 assert.deepEqual(h.json("SELECT jsonb_build_array(rolcanlogin,rolinherit,rolsuper,rolbypassrls) FROM pg_roles WHERE rolname='vexa_notification_verifier'"),[false,false,false,false],'OUTBOX_VERIFIER_PRIVATE_ROLE');
 for(const role of ['anon','authenticated','service_role','vexa_backend'])assert.equal(h.sql(`SELECT pg_has_role(${q(role)},'vexa_notification_verifier','MEMBER')`),'f','OUTBOX_NO_VERIFIER_INHERITANCE');
 assert.equal(h.sql("SELECT has_schema_privilege('vexa_notification_verifier','public','CREATE')"),'f','OUTBOX_VERIFIER_NO_SCHEMA_WRITE');
}
export async function seed(h,base,actors){const out={};
 for(const side of ['a','b']){const t=base[side].memberships.tenant_id,a=actors[side];
  for(const channel of ['email','inapp']){run(h,a,t,'configure',`SELECT public.notification_policy_set(${json(policy(channel))})`);for(const eventType of ['*','membership.welcome']){const old=h.json(`SELECT coalesce((SELECT to_jsonb(p) FROM notification_preferences p WHERE tenant_id=${q(t)} AND user_id=${q(a.id)} AND channel=${q(channel)} AND event_type=${q(eventType)}),'null'::jsonb)`)||null;h.sql('BEGIN;'+scope(a,t,'notify')+(old?`UPDATE notification_preferences SET enabled=true,version=version+1 WHERE tenant_id=${q(t)} AND user_id=${q(a.id)} AND channel=${q(channel)} AND event_type=${q(eventType)}`:insert('notification_preferences',{tenant_id:t,user_id:a.id,channel,event_type:eventType,enabled:true,version:1}))+';COMMIT;');}}
  const payload={eventId:randomUUID(),type:'membership.welcome',resourceId:a.id,userId:a.id,channel:'email'};
  const id=run(h,a,t,'import',`SELECT to_jsonb(public.notification_enqueue(${json(payload)}))`),claim=run(h,a,t,'import','SELECT public.notification_claim(30000)');assert.equal(claim.id,id,'OUTBOX_SEED_CLAIM');const f=claim.fencing_token;
  assert.equal(run(h,a,t,'import',`SELECT public.notification_begin_send(${q(id)},${q(f)}::bigint,true)`).kind,'ready','OUTBOX_SEED_READY');assert.equal(run(h,a,t,'import',`SELECT public.notification_finish(${q(id)},${q(f)}::bigint,'{"kind":"uncertain"}')`).state,'uncertain','OUTBOX_SEED_UNCERTAIN');
  const evidence={tenant_id:t,id:randomUUID(),job_id:id,fence:f,decision:'accepted',idempotency_key:claim.idempotency_key,provider_id:'SYN_SQL_RECEIPT',proof_hash:'a'.repeat(64)};
  h.sql('BEGIN;SET LOCAL ROLE vexa_notification_verifier;'+insert(proofTable,evidence)+';COMMIT;');
  const rec={id,expectedFence:f,decision:'accepted',evidenceId:evidence.id,requestKey:randomUUID(),idempotencyKey:claim.idempotency_key,providerId:'SYN_SQL_RECEIPT'};run(h,a,t,'configure',`SELECT public.notification_reconcile(${json(rec)})`);
  const row=h.json(`SELECT to_jsonb(o) FROM notification_outbox o WHERE tenant_id=${q(t)} AND id=${q(id)}`),saved={tenant:t,actor:a,payload,rec,...base[side],memberships:base[side].memberships};
  for(const table of tables){const where=table==='notification_delivery_policies'?`id=${q(row.policy_id)}`:table==='notification_outbox'?`id=${q(id)}`:table==='notification_dispatch_limits'?`user_id=${q(a.id)} AND channel='email'`:table===proofTable?`id=${q(evidence.id)}`:`job_id=${q(id)}`;saved[table]=h.json(`SELECT to_jsonb(x) FROM ${table} x WHERE tenant_id=${q(t)} AND ${where} LIMIT 1`);assert.ok(saved[table],'OUTBOX_SEED_ROW:'+table);}
  saved.jobs=h.json(`SELECT to_jsonb(j) FROM jobs j WHERE tenant_id=${q(t)} AND id=${q(id)}`);saved.notification_events=h.json(`SELECT to_jsonb(e) FROM notification_events e WHERE tenant_id=${q(t)} AND id=${q(payload.eventId)}`);out[side]=saved;
 }
 h.sql(`INSERT INTO worker_delegations(tenant_id,user_id,enabled) VALUES(${q(out.a.tenant)},${q(actors.analyst.id)},true) ON CONFLICT(tenant_id,user_id) DO UPDATE SET enabled=true;`);
 return out;
}
export function fk(h,f,k){const row=f.a[k.table];const probe=values=>h.probe(`ALTER TABLE public.${k.table} DISABLE TRIGGER USER;${write(`UPDATE public.${k.table} SET ${Object.entries(values).map(([col,v])=>`${col}=${q(v)}`).join(',')} WHERE ${key(k.table,row)}`)}SET CONSTRAINTS ALL IMMEDIATE;`);const same=Object.fromEntries(Object.keys(k.mapping).map(c=>[c,row[c]]));assert.equal(probe(same).code,'00000','OUTBOX_FK_POSITIVE:'+k.name);const bad={...same};for(const[col,ref]of Object.entries(k.mapping))if(k.parent==='organizations')bad[col]=randomUUID();else if(col!=='tenant_id')bad[col]=f.b[k.parent][ref];assert.equal(probe(bad).code,'23503','OUTBOX_FOREIGN_FK:'+k.name);}
export function access(h,f,a){for(const table of tables){const query=read(table,f.a[table]);if(table!==proofTable)for(const actor of [a.a,a.analyst])assert.equal(ok(backend(h,query,actor,f.a.tenant,'read'),'OUTBOX_AUTHORIZED_READ').length,1);
 for(const actor of [null,...Object.values(a)])denied(h.probe(query,actor),'OUTBOX_BROWSER_PRIVATE');denied(h.probe('SET LOCAL ROLE service_role;'+query),'OUTBOX_SERVICE_PRIVATE');
 for(const actor of [a.viewer,a.operator,a.outsider,a.b])denied(backend(h,query,actor,f.a.tenant,'read'),'OUTBOX_NON_WORKER_NO_ROWS');denied(backend(h,query,a.dual,f.b.tenant,'read'),'OUTBOX_TENANT_SELECTOR');
 for(const action of ['read','import','configure','notify','materialize'])for(const stmt of [write(`DELETE FROM public.${table} WHERE ${key(table,f.a[table])}`),write(`UPDATE public.${table} SET tenant_id=tenant_id WHERE ${key(table,f.a[table])}`)])denied(backend(h,stmt,a.a,f.a.tenant,action),'OUTBOX_NO_DIRECT_MUTATION');
 if(table!==proofTable)for(const prep of [`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(f.a.tenant)} AND user_id=${q(a.a.id)};`,`UPDATE memberships SET role='viewer' WHERE tenant_id=${q(f.a.tenant)} AND user_id=${q(a.a.id)};`])denied(backend(h,query,a.a,f.a.tenant,'read',prep),'OUTBOX_CURRENT_ACTOR');
 }
 for(const action of ['read','import','notify','configure'])denied(backend(h,write(`UPDATE jobs SET state='queued',lease_until=null WHERE tenant_id=${q(f.a.tenant)} AND id=${q(f.a.jobs.id)}`),a.a,f.a.tenant,action),'OUTBOX_CANONICAL_JOB_CANNOT_BYPASS_RPC');
 denied(backend(h,read('notification_outbox',f.a.notification_outbox),a.analyst,f.a.tenant,'read',`UPDATE worker_delegations SET enabled=false WHERE tenant_id=${q(f.a.tenant)} AND user_id=${q(a.analyst.id)};`),'OUTBOX_CURRENT_DELEGATION');
}
