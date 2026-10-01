import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {q,insert} from './matrix.mjs';import {write,denied} from './harness.mjs';import {backend} from './import-uploads/oracles.mjs';
export const tables=['notification_email_messages','notification_email_receipts','notification_email_suppressions'];
export const present=h=>tables.filter(t=>h.sql(`SELECT to_regclass(${q('public.'+t)}) IS NOT NULL`)==='t');
export const ownsFk=k=>tables.includes(k.table);
// Provider receipts precede tenant mapping. Only these two exact global references are allowed.
export const globalFk=k=>(k.table==='notification_email_receipts'&&k.parent==='notification_email_messages'&&JSON.stringify(k.mapping)==='{"idempotency_key":"idempotency_key"}')||(k.table==='notification_email_suppressions'&&k.parent==='notification_email_receipts'&&JSON.stringify(k.mapping)==='{"source_event_id":"event_id"}');
const signatures=['notification_email_recipient(uuid,uuid)','notification_email_prepare(text,uuid,uuid,text)','notification_email_accepted(text,text,text)','notification_email_receipt(text,text,text,timestamp with time zone,text,text)'];
const helpers=['notification_email_reduce(text)','notification_email_items_current(uuid,uuid,uuid)'];
const key=(table,row)=>table==='notification_email_messages'?`idempotency_key=${q(row.idempotency_key)}`:table==='notification_email_receipts'?`event_id=${q(row.event_id)}`:`tenant_id=${q(row.tenant_id)} AND user_id=${q(row.user_id)} AND mailbox_hash=${q(row.mailbox_hash)}`;
const read=(table,row)=>`SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM public.${table} x WHERE ${key(table,row)};`;
export function schema(h,fks){
 assert.deepEqual(present(h),tables,'EMAIL_THREE_CANONICAL_TABLES');
 for(const table of tables){
  assert.deepEqual(h.json(`SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity) FROM pg_class WHERE oid=${q('public.'+table)}::regclass`),[true,true],'EMAIL_FORCE_RLS:'+table);
  if(table!=='notification_email_receipts')assert.equal(h.sql(`SELECT attnotnull FROM pg_attribute WHERE attrelid=${q('public.'+table)}::regclass AND attname='tenant_id'`),'t','EMAIL_TENANT_REQUIRED');
  else assert.equal(h.sql("SELECT count(*) FROM pg_attribute WHERE attrelid='public.notification_email_receipts'::regclass AND attname='tenant_id' AND NOT attisdropped"),'0','EMAIL_ORPHAN_NO_PAYLOAD_TENANT');
  for(const role of ['anon','authenticated','service_role','vexa_backend','vexa_email_service'])for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']){
   const allowed=table==='notification_email_messages'&&role==='vexa_backend'&&action==='SELECT';assert.equal(h.sql(`SELECT has_table_privilege(${q(role)},${q('public.'+table)},${q(action)})`),allowed?'t':'f','EMAIL_LEAST_PRIVILEGE:'+table+':'+role+':'+action);
  }
 }
 const own=fks.filter(ownsFk);assert.equal(own.length,5,'EMAIL_FIVE_FKS');
 const expected=[['notification_email_messages','notification_outbox',{tenant_id:'tenant_id',job_id:'id'}],['notification_email_messages','memberships',{tenant_id:'tenant_id',user_id:'user_id'}],['notification_email_receipts','notification_email_messages',{idempotency_key:'idempotency_key'}],['notification_email_suppressions','memberships',{tenant_id:'tenant_id',user_id:'user_id'}],['notification_email_suppressions','notification_email_receipts',{source_event_id:'event_id'}]];
 for(const[table,parent,mapping]of expected){const fk=own.find(k=>k.table===table&&k.parent===parent);assert.ok(fk?.validated,'EMAIL_FK_VALIDATED:'+table+':'+parent);assert.deepEqual(fk.mapping,mapping,'EMAIL_EXACT_FK_MAPPING');assert.deepEqual(fk.nullable,table==='notification_email_receipts'?['idempotency_key']:[],'EMAIL_FK_NULLABILITY');}
 assert.deepEqual(h.json("SELECT jsonb_build_array(rolcanlogin,rolinherit,rolsuper,rolbypassrls) FROM pg_roles WHERE rolname='vexa_email_service'"),[false,false,false,false],'EMAIL_SERVICE_PRIVATE_ROLE');
 for(const role of ['anon','authenticated','service_role','vexa_backend'])assert.equal(h.sql(`SELECT pg_has_role(${q(role)},'vexa_email_service','MEMBER')`),'f','EMAIL_NO_CAPABILITY_INHERITANCE');
 assert.equal(h.sql("SELECT has_schema_privilege('vexa_email_service','public','CREATE')"),'f','EMAIL_SERVICE_NO_SCHEMA_WRITE');
 for(const signature of [...signatures,...helpers])for(const role of ['anon','authenticated','service_role','vexa_backend','vexa_email_service'])assert.equal(h.sql(`SELECT has_function_privilege(${q(role)},${q('public.'+signature)},'EXECUTE')`),role==='vexa_email_service'&&signatures.includes(signature)?'t':'f','EMAIL_RPC_ACL:'+signature+':'+role);
}
export function seed(h,base,actors){const f={};for(const side of ['a','b']){
 const src=base[side],actor=actors[side],out=src.notification_outbox,k=out.idempotency_key,pid='SYN_MATRIX_EMAIL_'+randomUUID().replaceAll('-',''),eid='SYN_MATRIX_RECEIPT_'+randomUUID().replaceAll('-','');
 const mailbox=h.sql(`SELECT encode(sha256(convert_to(lower(btrim(email)),'UTF8')),'hex') FROM auth.users WHERE id=${q(actor.id)}`);
 h.sql(insert('notification_email_messages',{idempotency_key:k,tenant_id:out.tenant_id,job_id:out.id,user_id:out.user_id,mailbox_hash:mailbox,provider:'resend',provider_id:pid,acceptance:'accepted'})+';');
 h.sql(`BEGIN;SET LOCAL ROLE vexa_email_service;SELECT public.notification_email_receipt(${q(eid)},${q(pid)},'email.complained',clock_timestamp(),${q('a'.repeat(64))});COMMIT;`);
 f[side]={...src};for(const table of tables){const where=table==='notification_email_messages'?`idempotency_key=${q(k)}`:table==='notification_email_receipts'?`event_id=${q(eid)}`:`tenant_id=${q(out.tenant_id)} AND user_id=${q(out.user_id)} AND mailbox_hash=${q(mailbox)}`;f[side][table]=h.json(`SELECT to_jsonb(x) FROM public.${table} x WHERE ${where}`);assert.ok(f[side][table],'EMAIL_FIXTURE_REQUIRED:'+table);}
 }return f;}
export function fk(h,f,k){
 const row=f.a[k.table],same=Object.fromEntries(Object.keys(k.mapping).map(c=>[c,row[c]]));
 const probe=values=>h.probe(write(`UPDATE public.${k.table} SET ${Object.entries(values).map(([col,v])=>`${col}=${q(v)}`).join(',')} WHERE ${key(k.table,row)}`)+'SET CONSTRAINTS ALL IMMEDIATE;');
 assert.equal(probe(same).code,'00000','EMAIL_FK_POSITIVE:'+k.name);const bad={...same};
 for(const[col,ref]of Object.entries(k.mapping))if(col!=='tenant_id')bad[col]=globalFk(k)?(col==='idempotency_key'?'f'.repeat(64):'SYN_MISSING_'+randomUUID().replaceAll('-','')):f.b[k.parent][ref];
 assert.equal(probe(bad).code,'23503','EMAIL_FK_DANGLING_OR_CROSS_TENANT:'+k.name);
}
export function access(h,f,actors){
 for(const table of tables){const query=read(table,f.a[table]);
  for(const actor of [null,...Object.values(actors)])denied(h.probe(query,actor),'EMAIL_BROWSER_PRIVATE:'+table);
  for(const role of ['service_role','vexa_email_service'])denied(h.probe('SET LOCAL ROLE '+role+';'+query),'EMAIL_DIRECT_ROLE_PRIVATE:'+table);
  if(table==='notification_email_messages'){const own=backend(h,query,actors.a,f.a.tenant,'read');assert.equal(own.code,'00000');assert.equal(own.rows.length,1,'EMAIL_OWN_STATUS');for(const actor of [actors.viewer,actors.operator,actors.outsider,actors.b])denied(backend(h,query,actor,f.a.tenant,'read'),'EMAIL_NO_FOREIGN_STATUS');denied(backend(h,query,actors.dual,f.b.tenant,'read'),'EMAIL_SELECTED_TENANT');denied(backend(h,query,actors.a,f.a.tenant,'read',`UPDATE memberships SET status='revoked' WHERE tenant_id=${q(f.a.tenant)} AND user_id=${q(actors.a.id)};`),'EMAIL_FRESH_MEMBERSHIP');}
  else denied(backend(h,query,actors.a,f.a.tenant,'read'),'EMAIL_BACKEND_PRIVATE:'+table);
  for(const action of ['read','import','configure','notify'])for(const stmt of [write(`UPDATE public.${table} SET ${table==='notification_email_receipts'?'event_id=event_id':'tenant_id=tenant_id'} WHERE ${key(table,f.a[table])}`),write(`DELETE FROM public.${table} WHERE ${key(table,f.a[table])}`)])denied(backend(h,stmt,actors.a,f.a.tenant,action),'EMAIL_NO_DIRECT_MUTATION:'+table);
 }
}
