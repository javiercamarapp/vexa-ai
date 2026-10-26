-- Datos 100% SINTETICOS para probar respaldo/restauracion. Dos tenants: A (el que se respalda) y B (senuelo:
-- NO debe aparecer en el respaldo de A). Se ejecuta en un Postgres local desechable con session_replication_role=replica
-- (se saltan triggers-guarda; los datos respetan igualmente FKs y CHECKs). Variables psql: :na (mensajes de A), :nc (clientes de A).
begin;
set session_replication_role=replica;
create or replace function pg_temp.u(s text) returns uuid language sql immutable as $$ select md5(s)::uuid $$;

insert into public.organizations(id,name) values (pg_temp.u('tenant-A'),'Sintetico A'),(pg_temp.u('tenant-B'),'Sintetico B');
insert into auth.users(id,email) values
 (pg_temp.u('user-A-owner'),'a-owner@ejemplo.invalid'),(pg_temp.u('user-A-analyst'),'a-analyst@ejemplo.invalid'),
 (pg_temp.u('user-B-owner'),'b-owner@ejemplo.invalid'),(pg_temp.u('user-stranger'),'extrano@ejemplo.invalid');
insert into public.memberships(tenant_id,user_id,role,status) values
 (pg_temp.u('tenant-A'),pg_temp.u('user-A-owner'),'owner','active'),
 (pg_temp.u('tenant-A'),pg_temp.u('user-A-analyst'),'analyst','active'),
 (pg_temp.u('tenant-B'),pg_temp.u('user-B-owner'),'owner','active');
insert into public.connections(id,tenant_id,source,account_id) values
 (pg_temp.u('conn-A'),pg_temp.u('tenant-A'),'csv','acct-a'),(pg_temp.u('conn-B'),pg_temp.u('tenant-B'),'csv','acct-b');

insert into public.customers(id,tenant_id,external_id,display_name,connection_id)
 select pg_temp.u('cust-A-'||g),pg_temp.u('tenant-A'),'c'||g,'Cliente A '||g,pg_temp.u('conn-A') from generate_series(1,:nc) g;
insert into public.customers(id,tenant_id,external_id,display_name,connection_id)
 select pg_temp.u('cust-B-'||g),pg_temp.u('tenant-B'),'c'||g,'Cliente B '||g,pg_temp.u('conn-B') from generate_series(1,300) g;

insert into public.conversations(id,tenant_id,source,external_id,channel,connection_id,customer_id,started_at)
 select pg_temp.u('conv-A-'||g),pg_temp.u('tenant-A'),'csv','hubspot:'||g,(array['email','chat','phone'])[1+g%3],pg_temp.u('conn-A'),pg_temp.u('cust-A-'||(1+g%:nc)),timestamptz '2026-01-01'+g*interval '7 minutes'
 from generate_series(1,:na/10) g;
insert into public.conversations(id,tenant_id,source,external_id,channel,connection_id,customer_id)
 select pg_temp.u('conv-B-'||g),pg_temp.u('tenant-B'),'csv','hubspot:'||g,'email',pg_temp.u('conn-B'),pg_temp.u('cust-B-'||(1+g%300)) from generate_series(1,400) g;

-- Mensajes con casos duros de COPY: saltos de linea, tabuladores, barras invertidas, la cadena literal \N, unicode, vacio, NULL en columnas opcionales.
insert into public.messages(id,tenant_id,external_id,role,occurred_at,conversation_id,connection_id,provenance)
 select pg_temp.u('msg-A-'||g),pg_temp.u('tenant-A'),
  g||':'||case g%7 when 0 then E'line1\nline2\ttab \\ backslash' when 1 then '\N' when 2 then 'ñandú 日本語 😀' when 3 then '' else 'm' end,
  (array['customer','agent','internal'])[1+g%3],
  case when g%11=0 then null else timestamptz '2026-01-01'+g*interval '1 minute' end,
  pg_temp.u('conv-A-'||(1+g%(:na/10))),case when g%13=0 then null else pg_temp.u('conn-A') end,
  jsonb_build_object('n',g,'t',E'a\tb','u','é')
 from generate_series(1,:na) g;
insert into public.messages(id,tenant_id,external_id,role,conversation_id,connection_id)
 select pg_temp.u('msg-B-'||g),pg_temp.u('tenant-B'),'b'||g,'customer',pg_temp.u('conv-B-'||(1+g%400)),pg_temp.u('conn-B') from generate_series(1,2000) g;

-- Ledger economico (solo-insercion en produccion): fuentes + asientos con report_hash coherente.
insert into public.economic_source_versions(tenant_id,source_id,version,actor_id,name,evidence_type,active,complete,window_start,window_end,watermark,report,report_hash,attested)
 values (pg_temp.u('tenant-A'),pg_temp.u('src-A'),1,pg_temp.u('user-A-owner'),'Pedidos sinteticos','order_export',true,false,'2026-01-01','2026-06-30','2026-06-30',repeat('r',30),encode(sha256(convert_to(repeat('r',30),'UTF8')),'hex'),true),
        (pg_temp.u('tenant-B'),pg_temp.u('src-B'),1,pg_temp.u('user-B-owner'),'Pedidos B','order_export',true,false,'2026-01-01','2026-06-30','2026-06-30',repeat('r',30),encode(sha256(convert_to(repeat('r',30),'UTF8')),'hex'),true);
insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested)
 select pg_temp.u('tenant-A'),pg_temp.u('ent-A-'||g),pg_temp.u('src-A'),1,1,pg_temp.u('user-A-owner'),'ord-'||g,'order','2026-02-01'::timestamptz+g*interval '1 hour','USD',2,'gross',g*100+7,'recorded','{}'::jsonb,repeat('x',25),encode(sha256(convert_to(repeat('x',25),'UTF8')),'hex'),true
 from generate_series(1,300) g;
insert into public.economic_ledger_entries(tenant_id,entity_id,source_id,source_version,revision,actor_id,external_id,kind,effective_at,currency,exponent,basis,amount_minor,status,details,report,report_hash,attested)
 select pg_temp.u('tenant-B'),pg_temp.u('ent-B-'||g),pg_temp.u('src-B'),1,1,pg_temp.u('user-B-owner'),'ord-'||g,'order','2026-02-01','USD',2,'gross',g,'recorded','{}'::jsonb,repeat('x',25),encode(sha256(convert_to(repeat('x',25),'UTF8')),'hex'),true
 from generate_series(1,40) g;

-- Jobs: uno en cola, uno corriendo con lease vencida, uno exitoso; y de B.
insert into public.jobs(tenant_id,type,state,input_ref,input_hash,version,lease_until,lease_owner,fencing_token,deadline) values
 (pg_temp.u('tenant-A'),'import','queued','ref1','h1','v1',null,null,0,null),
 (pg_temp.u('tenant-A'),'import','running','ref2','h2','v1',now()-interval '2 hours','w1',3,now()-interval '1 hour'),
 (pg_temp.u('tenant-A'),'extraction','succeeded','ref3','h3','v1',null,null,1,null),
 (pg_temp.u('tenant-B'),'import','queued','refb','hb','v1',null,null,0,null);
insert into public.audit_events(tenant_id,actor,action,resource,reason,trace_id) values
 (pg_temp.u('tenant-A'),'sys','consumer_heartbeat','ingestion','alive','t1'),(pg_temp.u('tenant-B'),'sys','consumer_heartbeat','ingestion','alive','t2');

-- 0052/0053 (si estan aplicadas).
insert into public.tracker_versions(id,tenant_id,connection_id,file_sha256,label,rank) values
 (pg_temp.u('tv-A1'),pg_temp.u('tenant-A'),pg_temp.u('conn-A'),repeat('a',64),'v1',1),(pg_temp.u('tv-A2'),pg_temp.u('tenant-A'),pg_temp.u('conn-A'),repeat('b',64),'v2',2),
 (pg_temp.u('tv-B1'),pg_temp.u('tenant-B'),pg_temp.u('conn-B'),repeat('c',64),'v1',1);
insert into public.attachment_blobs(id,tenant_id,sha256,bytes,state) select pg_temp.u('blob-A-'||g),pg_temp.u('tenant-A'),md5('A'||g)||md5('z'||g),1000+g,'planned' from generate_series(1,100) g;
insert into public.attachment_blobs(id,tenant_id,sha256,bytes,state) select pg_temp.u('blob-B-'||g),pg_temp.u('tenant-B'),md5('B'||g)||md5('z'||g),10,'planned' from generate_series(1,10) g;
insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id,message_id) select pg_temp.u('tenant-A'),pg_temp.u('blob-A-'||g),'email','f'||g,pg_temp.u('msg-A-'||g) from generate_series(1,100) g;
-- Revisiones de mensaje + embeddings (tipo vector).
insert into public.message_revisions(id,tenant_id,revision,text_ref,hash,message_id)
 select pg_temp.u('rev-A-'||g),pg_temp.u('tenant-A'),'1','ref'||g,md5(g::text),pg_temp.u('msg-A-'||g) from generate_series(1,50) g;
insert into public.message_revisions(id,tenant_id,revision,text_ref,hash,message_id)
 select pg_temp.u('rev-B-'||g),pg_temp.u('tenant-B'),'1','ref'||g,md5(g::text),pg_temp.u('msg-B-'||g) from generate_series(1,5) g;
insert into public.embeddings(tenant_id,model_id,dim,version,content,embedding,message_revision_id)
 select pg_temp.u('tenant-A'),'m-sint',3,'v1','texto '||g,('['||g||',0.5,'||(g*0.25)||']')::extensions.vector,pg_temp.u('rev-A-'||g) from generate_series(1,50) g;
insert into public.embeddings(tenant_id,model_id,dim,version,content,embedding,message_revision_id)
 select pg_temp.u('tenant-B'),'m-sint',3,'v1','b '||g,'[1,2,3]'::extensions.vector,pg_temp.u('rev-B-'||g) from generate_series(1,5) g;
-- Current weekly/CFO tables: direct tenant scope plus receipts inherited through FK.
insert into public.weekly_report_outbox(id,tenant_id,week_start,user_id,state,subject,html,body_text)
 select pg_temp.u('weekly-'||x),pg_temp.u('tenant-'||x),'2026-10-19',pg_temp.u('user-'||x||'-owner'),'sent','SYN weekly '||x,'<p>SYN</p>','SYN weekly '||x from unnest(array['A','B']) x;
insert into public.notification_email_messages(idempotency_key,tenant_id,user_id,weekly_report_id,mailbox_hash,provider,provider_id)
 select md5('weekly-'||x)||md5('key-'||x),pg_temp.u('tenant-'||x),pg_temp.u('user-'||x||'-owner'),pg_temp.u('weekly-'||x),repeat('a',64),'resend','SYN_provider_'||x from unnest(array['A','B']) x;
insert into public.notification_email_receipts(event_id,provider_id,event_type,occurred_at,payload_hash,idempotency_key)
 select 'SYN_receipt_'||x,'SYN_provider_'||x,'email.delivered',now(),repeat('b',64),md5('weekly-'||x)||md5('key-'||x) from unnest(array['A','B']) x;
insert into public.cfo_access_log(tenant_id,actor_id,tool,args_hash,outcome)
 select pg_temp.u('tenant-'||x),pg_temp.u('user-'||x||'-owner'),'resumen_mes',repeat('c',64),'ok' from unnest(array['A','B']) x;
commit;
