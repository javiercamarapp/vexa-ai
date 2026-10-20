-- Prueba de 0053 sobre Postgres local efimero (stubs + 0001 + 0002 + 0053). Falla con ON_ERROR_STOP.
\set ON_ERROR_STOP on
create or replace function pg_temp.expect_fail(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ESPERABA FALLO % y no fallo: %', code, sql;
exception when others then
  if sqlstate = 'P0001' and sqlerrm like 'ESPERABA%' then raise; end if;
  if sqlstate <> code then raise exception 'codigo % != % en: % (%)', sqlstate, code, sql, sqlerrm; end if;
end $$;
-- Equivalente a los grants por defecto de Supabase que los stubs no traen.
grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
\set A '\'aaaaaaaa-0000-0000-0000-000000000001\''
\set B '\'bbbbbbbb-0000-0000-0000-000000000002\''
\set UA '\'a0000000-0000-0000-0000-0000000000a1\''
\set UB '\'b0000000-0000-0000-0000-0000000000b1\''
\set UV '\'c0000000-0000-0000-0000-0000000000c1\''
insert into public.organizations(id,name) values (:A,'A'),(:B,'B');
insert into auth.users(id,email) values (:UA,'a@x'),(:UB,'b@x'),(:UV,'v@x');
insert into public.memberships(tenant_id,user_id,role,status) values (:A,:UA,'owner','active'),(:B,:UB,'owner','active'),(:A,:UV,'viewer','revoked');
insert into public.connections(id,tenant_id,source,account_id) values ('11111111-0000-0000-0000-000000000001',:A,'hubspot','x');
insert into public.conversations(id,tenant_id,source,external_id,connection_id) values ('22222222-0000-0000-0000-000000000001',:A,'hubspot','c1','11111111-0000-0000-0000-000000000001');

-- 1) backend (tenant A) escribe; no puede escribir en B
set role vexa_backend;
-- 0056: las escrituras de vexa_backend exigen vexa.action='import' (insert/update) y 'retain' (delete).
select set_config('vexa.tenant_id',:A,false), set_config('request.jwt.claim.sub',:UA,false), set_config('vexa.action','import',false);
insert into public.attachment_blobs(tenant_id,sha256,bytes,mime_type,extension,object_path,state)
 values (:A, repeat('a',64), 11, 'text/plain','.txt', :A||'/attachments/aa/'||repeat('a',64),'uploaded');
insert into public.attachment_blobs(tenant_id,sha256,bytes,state) values (:A, repeat('b',64), 5, 'planned');
select pg_temp.expect_fail($q$insert into public.attachment_blobs(tenant_id,sha256,bytes) values ('bbbbbbbb-0000-0000-0000-000000000002',repeat('c',64),1)$q$,'42501');
-- unicidad por tenant+hash
select pg_temp.expect_fail($q$insert into public.attachment_blobs(tenant_id,sha256,bytes) values ('aaaaaaaa-0000-0000-0000-000000000001',repeat('a',64),11)$q$,'23505');
-- checks
select pg_temp.expect_fail($q$insert into public.attachment_blobs(tenant_id,sha256,bytes) values ('aaaaaaaa-0000-0000-0000-000000000001','XYZ',1)$q$,'23514');
select pg_temp.expect_fail($q$insert into public.attachment_blobs(tenant_id,sha256,bytes,object_path,state) values ('aaaaaaaa-0000-0000-0000-000000000001',repeat('d',64),1,'bbbbbbbb-0000-0000-0000-000000000002/attachments/dd/'||repeat('d',64),'uploaded')$q$,'23514');
select pg_temp.expect_fail($q$insert into public.attachment_blobs(tenant_id,sha256,bytes,state) values ('aaaaaaaa-0000-0000-0000-000000000001',repeat('e',64),1,'uploaded')$q$,'23514');
-- identidad de contenido inmutable
select pg_temp.expect_fail($q$update public.attachment_blobs set sha256=repeat('f',64) where sha256=repeat('b',64)$q$,'23514');
select pg_temp.expect_fail($q$update public.attachment_blobs set bytes=6 where sha256=repeat('b',64)$q$,'23514');
select pg_temp.expect_fail($q$update public.attachment_blobs set tenant_id='bbbbbbbb-0000-0000-0000-000000000002' where sha256=repeat('b',64)$q$,'23514');
update public.attachment_blobs set state='verified', verified_at=now() where sha256=repeat('a',64);
-- vinculos: dos archivos origen, un solo blob (duplicado conservado)
insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id,conversation_id)
 select :A, id, 'conversation','f1','22222222-0000-0000-0000-000000000001' from public.attachment_blobs where sha256=repeat('a',64);
insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id,note_ref)
 select :A, id, 'note','f2','n-1' from public.attachment_blobs where sha256=repeat('a',64);
select pg_temp.expect_fail($q$insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id) select 'aaaaaaaa-0000-0000-0000-000000000001', id,'note','f2' from public.attachment_blobs where sha256=repeat('a',64)$q$,'23505');
select pg_temp.expect_fail($q$insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id,conversation_id) select 'aaaaaaaa-0000-0000-0000-000000000001', id,'email','f3','99999999-0000-0000-0000-000000000009' from public.attachment_blobs where sha256=repeat('a',64)$q$,'23503');
-- mismo hash en otro tenant no se comparte (sin dedup cruzado): otro backend/tenant B
reset role; set role vexa_backend;
select set_config('vexa.tenant_id',:B,false), set_config('request.jwt.claim.sub',:UB,false), set_config('vexa.action','import',false);
insert into public.attachment_blobs(tenant_id,sha256,bytes) values (:B, repeat('a',64), 11);
do $$ begin if exists(select 1 from public.attachment_blobs where tenant_id='aaaaaaaa-0000-0000-0000-000000000001') then raise exception 'B ve blobs de A'; end if; end $$;
select pg_temp.expect_fail($q$insert into public.attachment_links(tenant_id,blob_id,source_family,source_file_id) values ('bbbbbbbb-0000-0000-0000-000000000002',gen_random_uuid(),'note','x')$q$,'23503');
reset role;

-- 1b) contrato 0056 (solo si la politica endurecida esta aplicada): sin accion o con accion ajena no hay escritura; DELETE exige 'retain'.
set role vexa_backend;
select set_config('vexa.tenant_id',:A,false), set_config('request.jwt.claim.sub',:UA,false), set_config('vexa.action','import',false);
do $$ declare n bigint; hardened boolean := exists(select 1 from pg_policies where schemaname='public' and tablename='attachment_blobs' and policyname='backend_delete'); begin
 if not hardened then return; end if;
 insert into public.attachment_blobs(tenant_id,sha256,bytes,state) values ('aaaaaaaa-0000-0000-0000-000000000001', repeat('7',64), 1, 'planned');
 -- sin accion: INSERT denegado
 perform set_config('vexa.action','',true);
 begin insert into public.attachment_blobs(tenant_id,sha256,bytes,state) values ('aaaaaaaa-0000-0000-0000-000000000001', repeat('8',64), 1, 'planned'); raise exception 'insert sin accion paso';
 exception when insufficient_privilege then null; end;
 -- accion read: INSERT denegado, UPDATE y DELETE no afectan filas
 perform set_config('vexa.action','read',true);
 begin insert into public.attachment_blobs(tenant_id,sha256,bytes,state) values ('aaaaaaaa-0000-0000-0000-000000000001', repeat('8',64), 1, 'planned'); raise exception 'insert con read paso';
 exception when insufficient_privilege then null; end;
 update public.attachment_blobs set state='planned' where sha256=repeat('7',64); get diagnostics n = row_count; if n<>0 then raise exception 'update con read afecto % filas', n; end if;
 delete from public.attachment_blobs where sha256=repeat('7',64); get diagnostics n = row_count; if n<>0 then raise exception 'delete con read afecto % filas', n; end if;
 -- accion import: DELETE no afecta filas (solo retain)
 perform set_config('vexa.action','import',true);
 delete from public.attachment_blobs where sha256=repeat('7',64); get diagnostics n = row_count; if n<>0 then raise exception 'delete con import afecto % filas', n; end if;
 -- accion retain: DELETE si; UPDATE no
 perform set_config('vexa.action','retain',true);
 update public.attachment_blobs set state='planned' where sha256=repeat('7',64); get diagnostics n = row_count; if n<>0 then raise exception 'update con retain afecto % filas', n; end if;
 delete from public.attachment_blobs where sha256=repeat('7',64); get diagnostics n = row_count; if n<>1 then raise exception 'delete con retain afecto % filas', n; end if;
 perform set_config('vexa.action','import',true);
end $$;
reset role;

-- 2) lectura authenticated por tenant; sin escritura
set role authenticated;
select set_config('request.jwt.claim.sub',:UA,false);
do $$ begin if (select count(*) from public.attachment_blobs)<>2 or (select count(*) from public.attachment_links)<>2 then raise exception 'A debe ver 2 blobs y 2 links'; end if; end $$;
select pg_temp.expect_fail($q$insert into public.attachment_blobs(tenant_id,sha256,bytes) values ('aaaaaaaa-0000-0000-0000-000000000001',repeat('9',64),1)$q$,'42501');
select pg_temp.expect_fail($q$delete from public.attachment_links$q$,'42501');
select set_config('request.jwt.claim.sub',:UB,false);
do $$ begin if (select count(*) from public.attachment_blobs)<>1 or (select count(*) from public.attachment_links)<>0 then raise exception 'B debe ver solo su blob'; end if; end $$;
select set_config('request.jwt.claim.sub',:UV,false); -- membresia revocada
do $$ begin if (select count(*) from public.attachment_blobs)<>0 then raise exception 'miembro revocado no debe ver nada'; end if; end $$;
reset role;
set role anon;
select pg_temp.expect_fail($q$select * from public.attachment_blobs$q$,'42501');
reset role;
select 'TODAS LAS PRUEBAS 0053 OK' as resultado;
