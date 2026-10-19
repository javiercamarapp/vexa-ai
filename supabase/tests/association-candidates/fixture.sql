-- Synthetic data only. Variables: tag (text), nfacts, nvalid, msgs (messages per
-- gorgias conversation), nimpt (ticket imports, >= 8), noise (unreferenced conversations).
\set ON_ERROR_STOP on
set session_replication_role=replica;
create or replace function pg_temp.u(text) returns uuid language sql immutable as $$ select md5($1)::uuid $$;
select pg_temp.u(:'tag'||'t') t,pg_temp.u(:'tag'||'c') c,pg_temp.u(:'tag'||'c2') c2,pg_temp.u(:'tag'||'ch') ch \gset
begin;
insert into connections(id,tenant_id,source,account_id,status) values(:'c'::uuid,:'t'::uuid,'csv','acct','active'),(:'c2'::uuid,:'t'::uuid,'csv','acct2','active'),(:'ch'::uuid,:'t'::uuid,'hubspot','50961427','active');
-- contact imports (4 on c, 1 on c2) and ticket imports (:nimpt on c, 1 on c2)
insert into imports(id,tenant_id,connection_id,file_hash,mapping_version,idempotency_key,state,provenance,total,accepted,rejected,duplicates,pending)
select pg_temp.u(:'tag'||'ic'||n),:'t'::uuid,:'c'::uuid,md5(:'tag'||'cf'||n)||md5(:'tag'||'cg'||n),'mv-c',:'tag'||'imp-c-'||n,'succeeded','{"mapping":{"profile":"hubspot-contact-csv-v1"}}'::jsonb,0,0,0,0,0 from generate_series(1,4) n
union all select pg_temp.u(:'tag'||'ixc'),:'t'::uuid,:'c2'::uuid,md5(:'tag'||'c2f')||md5(:'tag'||'c2g'),'mv-c',:'tag'||'imp-cx','succeeded','{"mapping":{"profile":"hubspot-contact-csv-v1"}}'::jsonb,0,0,0,0,0
union all select pg_temp.u(:'tag'||'it'||n),:'t'::uuid,:'c'::uuid,md5(:'tag'||'tf'||n)||md5(:'tag'||'tg'||n),'mv-t',:'tag'||'imp-t-'||n,'succeeded','{"mapping":{"profile":"hubspot-message-csv-v1"}}'::jsonb,0,0,0,0,0 from generate_series(1,:nimpt) n
union all select pg_temp.u(:'tag'||'ixt'),:'t'::uuid,:'c2'::uuid,md5(:'tag'||'t2f')||md5(:'tag'||'t2g'),'mv-t',:'tag'||'imp-tx','succeeded','{"mapping":{"profile":"hubspot-message-csv-v1"}}'::jsonb,0,0,0,0,0;
-- facts: valid property for i<=nvalid, notes for i%5=0, retained i%23=0
insert into native_customer_associations(id,tenant_id,source_connection_id,provider,portal_id,ticket_id,contact_id,first_evidence_hash,immutable_evidence,first_import_row_id,source_version_hash,selected_evidence_hash,resolution_state,reason)
select pg_temp.u(:'tag'||'f'||i),:'t'::uuid,:'c'::uuid,'hubspot','50961427','t'||i,'c'||i,md5(:'tag'||'e'||i)||md5(:'tag'||'E'||i),
 case when i%23=0 then '{"retained":true}'::jsonb else jsonb_build_object('bridge',jsonb_build_object('property',case when i<=:nvalid then jsonb_build_object('status','valid','value','g'||i) else jsonb_build_object('status','missing','value',null) end,'notes',case when i%5=0 then jsonb_build_array(jsonb_build_object('gorgiasId','n'||i)) else '[]'::jsonb end)) end,
 pg_temp.u(:'tag'||'fr'||i),md5(:'tag'||'v'||i)||md5(:'tag'||'V'||i),
 case when i%29=0 and i%23<>0 then md5(:'tag'||'e'||i)||md5(:'tag'||'E'||i) end,
 case when i%23=0 then 'retained' when i%3=0 then 'pending' else 'resolved' end,'syn' from generate_series(1,:nfacts) i;
-- evidence override through import_rows (selected_evidence_hash): value h<i> instead of g<i>
insert into import_rows(tenant_id,import_id,row_ref,row_hash,state,payload_ref,provenance)
select :'t'::uuid,pg_temp.u(:'tag'||'it1'),'ev'||i,md5('ev'||i),'accepted','csv:ev:'||i,jsonb_build_object('result',jsonb_build_object('fact_id',pg_temp.u(:'tag'||'f'||i)::text,'evidence_hash',md5(:'tag'||'e'||i)||md5(:'tag'||'E'||i),'evidence',jsonb_build_object('bridge',jsonb_build_object('property',jsonb_build_object('status','valid','value','h'||i),'notes','[]'::jsonb))))
from generate_series(1,:nfacts) i where i%29=0 and i%23<>0;
-- customers: on c unless i%7=0 (then only c2); i%19=0 on both
create temp table cu as
select i,x.conn,x.acct,row_number() over() seq,gen_random_uuid() id,gen_random_uuid() rid from generate_series(1,:nfacts) i
 cross join lateral (select :'c'::uuid conn,'acct' acct where i%7<>0 union all select :'c2'::uuid,'acct2' where i%7=0 or i%19=0) x;
insert into customers(id,tenant_id,external_id,source_revision,connection_id,display_name) select id,:'t'::uuid,'c'||i,'r1',conn,'SYN' from cu;
insert into source_revisions(id,tenant_id,connection_id,entity_type,external_id,source_revision,content_hash,fingerprint,mapping_version,snapshot,canonical_id,customer_id,provenance)
select rid,:'t'::uuid,conn,'customer','c'||i,'r1',md5('c'||seq)||md5('x'||seq),md5('c'||seq)||md5('y'||seq),'mv-c','[]',id,id,jsonb_build_object('adapter_version','csv-customer-v1','ingestion_profile','hubspot-contact-csv-v1','account_id',acct,'payload_ref','csv:c:'||seq) from cu;
insert into source_heads(id,tenant_id,connection_id,entity_type,external_id,selected_revision_id,version,state) select id,:'t'::uuid,conn,'customer','c'||i,case when i%43=0 then null else rid end,1,case when i%43=0 then 'ambiguous' else 'unique' end from cu;
insert into import_rows(tenant_id,import_id,row_ref,row_hash,state,payload_ref,provenance)
select :'t'::uuid,case when conn=:'c'::uuid then pg_temp.u(:'tag'||'ic'||(seq%4+1)) else pg_temp.u(:'tag'||'ixc') end,'cu'||seq,md5('cu'||seq),'accepted','csv:c:'||seq,jsonb_build_object('result',jsonb_build_object('canonical_id',id::text)) from cu
union all select :'t'::uuid,pg_temp.u(:'tag'||'ic'||((seq+1)%4+1)),'cud'||seq,md5('cud'||seq),'duplicate','csv:c:'||seq,jsonb_build_object('result',jsonb_build_object('canonical_id',id::text)) from cu where conn=:'c'::uuid and seq%11=0;
commit;
begin;
-- conversations. kind: h=hubspot ticket, g=gorgias value, n=gorgias note id, o=evidence override, z=noise
create temp table cv as
select row_number() over() seq,e.*,gen_random_uuid() id,gen_random_uuid() rid from (
 select i,'hubspot:t'||i ext,case when i%10=0 then :'c2'::uuid else :'c'::uuid end conn,case when i%9=0 then 0 else 3 end nmsg,'h' kind from generate_series(1,:nfacts) i
 union all select i,'gorgias:g'||i,case when i%10=0 then :'c2'::uuid else :'c'::uuid end,case when i%12=0 then 0 else :msgs end,'g' from generate_series(1,:nfacts) i
 union all select i,'gorgias:n'||i,:'c'::uuid,:msgs/2+1,'n' from generate_series(1,:nfacts) i where i%5=0
 union all select i,'gorgias:h'||i,:'c'::uuid,4,'o' from generate_series(1,:nfacts) i where i%29=0
 union all select n,'gorgias:z'||n,:'c'::uuid,3,'z' from generate_series(1,:noise) n) e;
insert into conversations(id,tenant_id,source,entity_type,external_id,source_revision,connection_id,channel,deleted_at)
select id,:'t'::uuid,'csv','conversation',ext,'r1',conn,'email',case when kind='h' and i%31=0 then now() end from cv;
insert into source_revisions(id,tenant_id,connection_id,entity_type,external_id,source_revision,content_hash,fingerprint,mapping_version,snapshot,canonical_id,conversation_id,provenance)
select rid,:'t'::uuid,conn,'conversation',ext,'csv-container-v1',md5(ext)||md5('x'||seq),md5(ext)||md5('y'||seq),'mv-t','[]',id,id,jsonb_build_object('account_id',case when conn=:'c'::uuid then 'acct' else 'acct2' end) from cv;
insert into source_heads(id,tenant_id,connection_id,entity_type,external_id,selected_revision_id,version,state) select id,:'t'::uuid,conn,'conversation',ext,case when kind='g' and i%37=0 then null else rid end,1,case when kind='g' and i%37=0 then 'ambiguous' else 'unique' end from cv;
-- native hubspot conversations (owner_choice only): i%6=0
create temp table nx as select i,gen_random_uuid() id,gen_random_uuid() rid from generate_series(1,:nfacts) i where i%6=0;
insert into conversations(id,tenant_id,source,entity_type,external_id,source_revision,connection_id,channel) select id,:'t'::uuid,'hubspot','conversation','t'||i,'r1',:'ch'::uuid,'email' from nx;
insert into source_revisions(id,tenant_id,connection_id,entity_type,external_id,source_revision,content_hash,fingerprint,mapping_version,snapshot,canonical_id,conversation_id,provenance)
select rid,:'t'::uuid,:'ch'::uuid,'conversation','t'||i,'r1',md5('nx'||i)||md5('a'),md5('nx'||i)||md5('b'),'mv-n','[]',id,id,'{"source":"hubspot","account_id":"50961427"}'::jsonb from nx;
insert into source_heads(id,tenant_id,connection_id,entity_type,external_id,selected_revision_id,version,state) select id,:'t'::uuid,:'ch'::uuid,'conversation','t'||i,rid,1,'unique' from nx;
-- messages: j%8=0 no import row, j%9=0 deleted, j%13=0 ambiguous head, j%17=0 only a rejected row,
-- j%5=0 also a duplicate row in the next import, j%41=0 retention-deleted
create temp table ms as select row_number() over() n,cv.seq cs,cv.conn,cv.id cid,j,gen_random_uuid() id,gen_random_uuid() rid,'m'||cv.seq||'-'||j ext from cv cross join lateral generate_series(1,cv.nmsg) j;
insert into messages(id,tenant_id,external_id,source_revision,role,conversation_id,connection_id,deleted_at) select id,:'t'::uuid,ext,'r1','customer',cid,conn,case when j%9=0 then now() end from ms;
insert into source_revisions(id,tenant_id,connection_id,entity_type,external_id,source_revision,content_hash,fingerprint,mapping_version,snapshot,canonical_id,message_id,related_conversation_id,provenance)
select rid,:'t'::uuid,conn,'message',ext,'r1',md5(ext)||md5('x'),md5(ext)||md5('y'),'mv-t','[]',id,id,cid,jsonb_build_object('adapter_version','csv-message-v1','payload_ref',case when j%8=0 then 'csv:none:'||n else 'csv:m:'||n end) from ms;
insert into source_heads(id,tenant_id,connection_id,entity_type,external_id,selected_revision_id,version,state) select id,:'t'::uuid,conn,'message',ext,case when j%13=0 then null else rid end,1,case when j%13=0 then 'ambiguous' else 'unique' end from ms;
insert into import_rows(tenant_id,import_id,row_ref,row_hash,state,payload_ref,provenance)
select :'t'::uuid,case when conn=:'c'::uuid then pg_temp.u(:'tag'||'it'||((cs+j)%:nimpt+1)) else pg_temp.u(:'tag'||'ixt') end,'m'||n,md5('m'||n),case when j%17=0 then 'rejected' else 'accepted' end,'csv:m:'||n,jsonb_build_object('result',jsonb_build_object('canonical_id',id::text)) from ms where j%8<>0
union all select :'t'::uuid,case when conn=:'c'::uuid then pg_temp.u(:'tag'||'it'||((cs+j+1)%:nimpt+1)) else pg_temp.u(:'tag'||'ixt') end,'md'||n,md5('md'||n),'duplicate','csv:m:'||n,jsonb_build_object('result',jsonb_build_object('canonical_id',id::text)) from ms where j%8<>0 and j%5=0;
insert into retention_ledger(tenant_id,id,connection_id,entity_type,external_id,actor_id,policy_version) select :'t'::uuid,gen_random_uuid(),conn,'message',ext,pg_temp.u('actor'),1 from ms where j%41=0;
commit;
begin;
-- origin approvals. AP1 and AP2 overlap on imports 2-3 (tie-break by approval id); AP3 covers connection c2;
-- AP4 is approved (v1) then revoked (v2) for import nimpt-1; imports nimpt-1 and nimpt end up without origin.
create temp table e as
select 'ap1' ap,pg_temp.u(:'tag'||'ic'||n) imp,:'c'::uuid conn,'hubspot-contact' ns,'mv-c' mv,md5(:'tag'||'cf'||n)||md5(:'tag'||'cg'||n) fh,'50961427' portal from generate_series(1,3) n
union all select 'ap1',pg_temp.u(:'tag'||'it'||n),:'c'::uuid,x,'mv-t',md5(:'tag'||'tf'||n)||md5(:'tag'||'tg'||n),'50961427' from generate_series(1,:nimpt-2) n,unnest(array['hubspot-ticket','gorgias-ticket']) x
union all select 'ap2',pg_temp.u(:'tag'||'it'||n),:'c'::uuid,x,'mv-t',md5(:'tag'||'tf'||n)||md5(:'tag'||'tg'||n),case when n=3 and x='hubspot-ticket' then '1' else '50961427' end from generate_series(2,3) n,unnest(array['hubspot-ticket','gorgias-ticket']) x
union all select 'ap3',pg_temp.u(:'tag'||'ixc'),:'c2'::uuid,'hubspot-contact','mv-c',md5(:'tag'||'c2f')||md5(:'tag'||'c2g'),'50961427'
union all select 'ap3',pg_temp.u(:'tag'||'ixt'),:'c2'::uuid,x,'mv-t',md5(:'tag'||'t2f')||md5(:'tag'||'t2g'),'50961427' from unnest(array['hubspot-ticket','gorgias-ticket']) x
union all select 'ap4',pg_temp.u(:'tag'||'it'||(:nimpt-1)),:'c'::uuid,x,'mv-t',md5(:'tag'||'tf'||(:nimpt-1))||md5(:'tag'||'tg'||(:nimpt-1)),'50961427' from unnest(array['hubspot-ticket','gorgias-ticket']) x;
insert into audit_events(tenant_id,actor,action,resource,reason,trace_id,provenance)
select :'t'::uuid,'SYN','association_origin_approved',pg_temp.u(:'tag'||ap)::text,'syn',pg_temp.u(:'tag'||ap)::text||':1',
 jsonb_build_object('schema','association-origin-approval-v1','approvalId',pg_temp.u(:'tag'||ap),'version',1,'state','approved','requestId',pg_temp.u(:'tag'||ap),
  'entries',jsonb_agg(jsonb_build_object('importId',imp,'connectionId',conn,'fileHash',fh,'mappingVersion',mv,'provider','hubspot','portalId',portal,'namespace',ns,'sourceManifestHash',repeat('1',64),'sourceInventoryHash',repeat('2',64),'sourceReceiptHash',repeat('3',64))))
from e group by ap;
insert into audit_events(tenant_id,actor,action,resource,reason,trace_id,provenance)
select :'t'::uuid,'SYN','association_origin_revoked',pg_temp.u(:'tag'||'ap4')::text,'syn',pg_temp.u(:'tag'||'ap4')::text||':2',
 jsonb_build_object('schema','association-origin-approval-v1','approvalId',pg_temp.u(:'tag'||'ap4'),'version',2,'state','revoked','requestId',pg_temp.u(:'tag'||'ap4r'),'entries','[]'::jsonb);
commit;
analyze;
