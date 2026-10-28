-- STO-01 (auditoria de seguridad 28-oct): vexa_private_read (0004) solo exige membresia activa, asi que un
-- viewer/operator podia listar y descargar los archivos crudos sin redactar. Se agrega una politica RESTRICTIVE
-- que exige rol owner/analyst para leer vexa-private con una sesion `authenticated`.
-- No afecta al backend: import_backend_object_read (0005) es para vexa_backend; la descarga de importaciones
-- la hace el mismo owner/analyst que subio el archivo (vexa_private_upload ya exige esos roles).
-- Se compara texto (como en 0004) para que una ruta mal formada no dispare un cast de UUID.
begin;
create policy vexa_private_read_roles on storage.objects as restrictive for select to authenticated
 using (bucket_id<>'vexa-private' or exists(select 1 from public.memberships m
 where m.tenant_id::text=split_part(name,'/',1) and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','analyst')));
comment on policy vexa_private_read_roles on storage.objects is
 'STO-01: crudos de vexa-private solo para owner/analyst; viewer/operator leen el texto redactado en tablas, no los bytes.';
commit;
