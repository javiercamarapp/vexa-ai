-- STO-01, segunda mitad (cierre de seguridad 29-oct): ademas de limitar la LECTURA de crudos por rol (20261130000000), se limita lo que un miembro
-- puede SUBIR por su propia sesion a vexa-private. Antes, owner/analyst podian insertar cualquier ruta bajo su prefijo y cualquier tipo de archivo
-- (0004: vexa_private_upload), sin limite de tamano por bucket.
-- Ahora, con la sesion de un usuario (rol authenticated), en vexa-private solo se admite el espacio reservado de importaciones (<tenant>/imports/...),
-- con tipo CSV o XLSX y hasta 20 MiB (el mismo tope que valida la reserva en la aplicacion). Los adjuntos los carga el proceso de ingestion con su
-- propia credencial de servidor, que no pasa por RLS y no se ve afectado.
-- Si el metadato `mimetype` o `size` no viene en el momento de la insercion, no se bloquea (la reserva ya fijo el tipo y el tamano): solo se rechaza
-- lo que declara un tipo distinto o un tamano mayor. No se toca la configuracion del bucket (los adjuntos usan tipos y tamanos distintos).
-- ALCANCE REAL (R2-05, auditoria run-2): esta politica solo acota la RUTA (imports/) y lo que el cliente DECLARE en metadata al insertar. Storage fija el tipo y el tamano reales despues de la insercion,
-- asi que NO es un limite de bytes ni de tipo: eso lo imponen la reserva de la aplicacion (tipo y tamano acordados) y el lector de importaciones (que valida el contenido). Un limite real exige
-- file_size_limit/allowed_mime_types en el bucket o un bucket aparte para imports/; no se fijo aqui porque los adjuntos (carga TUS de archivos grandes) comparten vexa-private y se romperian.
-- Reversion: drop policy vexa_private_member_upload_types on storage.objects;
begin;
set local lock_timeout='3s'; set local statement_timeout='30s';
create policy vexa_private_member_upload_types on storage.objects as restrictive for insert to authenticated
 with check(bucket_id<>'vexa-private' or (
  split_part(name,'/',2)='imports'
  and coalesce(lower(metadata->>'mimetype'),'text/csv') in ('text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  and (case when coalesce(metadata->>'size','') ~ '^[0-9]{1,15}$' then (metadata->>'size')::bigint<=20971520 else true end)));
comment on policy vexa_private_member_upload_types on storage.objects is
 'STO-01: un miembro solo sube a vexa-private el espacio reservado de importaciones, CSV/XLSX y hasta 20 MiB; los adjuntos entran por la credencial de servidor.';
commit;
