// Regresiones de la auditoria de seguridad 28-oct sobre un Postgres 17 LOCAL (ops/lib/localpg.mjs, sin red):
// STO-01 (lectura de crudos por rol) y LIFE-01 (borrado de adjuntos en retention_erase + guard).
import test from 'node:test';
import assert from 'node:assert/strict';
import {startLocalPg} from '../../ops/lib/localpg.mjs';

const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
const U={owner:'00000000-0000-4000-8000-000000000011',analyst:'00000000-0000-4000-8000-000000000012',operator:'00000000-0000-4000-8000-000000000013',viewer:'00000000-0000-4000-8000-000000000014',other:'00000000-0000-4000-8000-000000000015'};

test('STO-01 + LIFE-01',async t=>{
 const pg=await startLocalPg({label:'sec28'}),db='sec28';
 try{
  pg.createDb(db);pg.applySchema(db,{upTo:'20261129000000_member_support_short_circuit.sql'});
  // El stub local devuelve true para allow_any_operation (0041 negaria todo): aqui no es una operacion de firmado.
  pg.sql(db,`create or replace function storage.allow_any_operation(a text[]) returns boolean language sql as $$ select false $$;`);
  const users=Object.entries(U).map(([,id],i)=>`('${id}','u${i}@example.invalid')`).join(',');
  pg.sql(db,`insert into auth.users(id,email) values ${users};
   insert into public.organizations(id,name) values ('${A}','SYN A'),('${B}','SYN B');
   insert into public.memberships(tenant_id,user_id,role,status) values ('${A}','${U.owner}','owner','active'),('${A}','${U.analyst}','analyst','active'),('${A}','${U.operator}','operator','active'),('${A}','${U.viewer}','viewer','active'),('${B}','${U.other}','owner','active');`);

  await t.test('STO-01: solo owner/analyst ven los crudos de vexa-private de su tenant',()=>{
   pg.sql(db,`grant usage on schema storage to authenticated; grant select on storage.objects to authenticated;
    insert into storage.objects(bucket_id,name) values ('vexa-private','${A}/raw/x.csv'),('vexa-private','${A}/attachments/ab/${'a'.repeat(64)}'),('other-bucket','${A}/pub.txt'),('vexa-private','not-a-uuid/x');`);
   const count=(uid,extra='')=>pg.sql(db,`begin; set local role authenticated; set local request.jwt.claim.sub='${uid}'; select count(*) from storage.objects where bucket_id='vexa-private' ${extra}; rollback;`);
   // ANTES del arreglo la politica permisiva deja pasar a cualquier miembro: el defecto existe en 0004.
   assert.equal(count(U.viewer),'2');
   pg.file(db,new URL('../migrations/20261130000000_vexa_private_read_roles.sql',import.meta.url).pathname);
   assert.equal(count(U.owner),'2');assert.equal(count(U.analyst),'2');
   assert.equal(count(U.operator),'0');assert.equal(count(U.viewer),'0');
   assert.equal(count(U.other),'0','otro tenant no ve nada');
   assert.equal(pg.sql(db,`begin; set local role authenticated; set local request.jwt.claim.sub='${U.owner}'; select count(*) from storage.objects where name='not-a-uuid/x'; rollback;`),'0','ruta mal formada no rompe con cast');
  });

  await t.test('LIFE-01: retention_erase borra vinculos/blobs, registra artefactos y el guard rechaza reinserciones',()=>{
   const sha=n=>String(n).repeat(64).slice(0,64);
   pg.sql(db,`insert into public.connections(id,tenant_id,source,account_id) values ('10000000-0000-4000-8000-000000000001','${A}','syn','acc');
    insert into public.retention_policies(tenant_id,version,backup_ttl_seconds,active_erasure,business_history,actor_id) values ('${A}',1,3600,'immediate','retain-authorized-audit','${U.owner}');
    insert into public.conversations(id,tenant_id,source,external_id,connection_id) values ('20000000-0000-4000-8000-000000000001','${A}','syn','conv-1','10000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002','${A}','syn','conv-2','10000000-0000-4000-8000-000000000001');
    insert into public.messages(id,tenant_id,external_id,role,occurred_at,conversation_id,connection_id) values ('30000000-0000-4000-8000-000000000001','${A}','m-1','customer',now(),'20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),('30000000-0000-4000-8000-000000000002','${A}','m-2','customer',now(),'20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
    insert into public.attachment_blobs(id,tenant_id,sha256,bytes,object_path,state) values
     ('40000000-0000-4000-8000-000000000001','${A}','${sha(1)}',10,'${A}/attachments/11/${sha(1)}','uploaded'),
     ('40000000-0000-4000-8000-000000000002','${A}','${sha(2)}',10,'${A}/attachments/22/${sha(2)}','uploaded'),
     ('40000000-0000-4000-8000-000000000003','${A}','${sha(3)}',10,'${A}/attachments/33/${sha(3)}','uploaded'),
     ('40000000-0000-4000-8000-000000000004','${A}','${sha(4)}',10,'${A}/attachments/44/${sha(4)}','uploaded'),
     ('40000000-0000-4000-8000-000000000005','${A}','${sha(5)}',10,'${A}/attachments/55/${sha(5)}','uploaded');
    insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id,conversation_id,message_id) values
     ('${A}','40000000-0000-4000-8000-000000000001','conversation','f-1','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),
     ('${A}','40000000-0000-4000-8000-000000000002','conversation','f-2','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),
     ('${A}','40000000-0000-4000-8000-000000000002','conversation','f-3','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002');
    -- R2-01: vinculos sin mensaje/conversacion resueltos
    insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id,provenance) values
     ('${A}','40000000-0000-4000-8000-000000000003','conversation','f-B','{"message_id":"m-1","resolution":"message_ambiguous"}'),
     ('${A}','40000000-0000-4000-8000-000000000004','conversation','f-D','{"thread_id":"conv-1"}'),
     ('${A}','40000000-0000-4000-8000-000000000002','conversation','f-live-orphan','{"message_id":"m-2"}'),
     ('${A}','40000000-0000-4000-8000-000000000005','note','n-1','{}');`);
   pg.file(db,new URL('../migrations/20261130000100_retention_erase_attachments.sql',import.meta.url).pathname);
   const rid='50000000-0000-4000-8000-000000000001';
   const out=pg.sql(db,`begin; set local role vexa_backend; set local request.jwt.claim.sub='${U.owner}'; set local vexa.tenant_id='${A}'; set local vexa.action='retain';
    select public.retention_erase('{"connectionId":"10000000-0000-4000-8000-000000000001","entityType":"conversation","externalId":"conv-1","requestId":"${rid}","confirmed":"true"}'::jsonb); commit;`);
   assert.match(out,/active_content_erased/);
   assert.equal(pg.sql(db,`select count(*) from public.attachment_links where conversation_id='20000000-0000-4000-8000-000000000001'`),'0');
   assert.equal(pg.sql(db,`select count(*) from public.attachment_links where source_file_id='f-3'`),'1','el vinculo de otra conversacion queda');
   assert.equal(pg.sql(db,`select count(*) from public.attachment_blobs where id='40000000-0000-4000-8000-000000000001'`),'0','blob sin otros vinculos: borrado');
   assert.equal(pg.sql(db,`select count(*) from public.attachment_blobs where id='40000000-0000-4000-8000-000000000002'`),'1','blob compartido: se conserva');
   assert.equal(pg.sql(db,`select status||':'||class from public.retention_artifacts where object_path='${A}/attachments/11/${sha(1)}'`),'pending:raw');
   assert.equal(pg.sql(db,`select count(*) from public.retention_artifacts where object_path='${A}/attachments/22/${sha(2)}'`),'0','blob compartido no se purga fisicamente');
   const gone=id=>pg.sql(db,`select count(*) from public.attachment_links where source_file_id='${id}'`);
   assert.equal(gone('f-B'),'0','message_ambiguous del origen borrado');assert.equal(gone('f-D'),'0','sin resolver (thread_id) del origen borrado');
   assert.equal(gone('f-live-orphan'),'1','sin resolver de otro origen vivo se conserva');assert.equal(gone('n-1'),'1','nota sin referencia no atribuible: se conserva');
   for(const n of [3,4])assert.equal(pg.sql(db,`select status||':'||class from public.retention_artifacts where object_path='${A}/attachments/${n}${n}/${sha(n)}'`),'pending:raw',`blob ${n} purgado`);
   assert.equal(pg.sql(db,`select count(*) from public.attachment_blobs where id in ('40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004')`),'0');
   assert.equal(pg.sql(db,`select count(*) from public.attachment_blobs where id='40000000-0000-4000-8000-000000000005'`),'1','blob de la nota intacto');
   assert.equal(pg.sql(db,`select count(*) from public.retention_artifacts where object_path='${A}/attachments/55/${sha(5)}'`),'0');
   assert.equal(pg.sql(db,`select count(*) from public.attachment_blobs where id='40000000-0000-4000-8000-000000000002'`),'1','blob compartido entre vinculo borrado y vivos');
   for(const prov of ['{"message_id":"m-1"}','{"thread_id":"conv-1"}'])assert.throws(()=>pg.sql(db,`insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id,provenance) values ('${A}','40000000-0000-4000-8000-000000000002','conversation','f-re-'||md5('${prov}'),'${prov}')`),/SOURCE_TOMBSTONED/);
   pg.sql(db,`insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id,provenance) values ('${A}','40000000-0000-4000-8000-000000000002','note','n-2','{}')`);
   assert.throws(()=>pg.sql(db,`insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id,conversation_id,message_id) values ('${A}','40000000-0000-4000-8000-000000000002','conversation','f-4','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001')`),/SOURCE_TOMBSTONED/);
   assert.equal(pg.sql(db,`select count(*) from pg_trigger where tgname='retention_source_guard' and tgrelid='public.attachment_links'::regclass`),'1');
  });
 }finally{await pg.stop();}
});
