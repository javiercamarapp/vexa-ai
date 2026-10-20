-- 20261019000000 hardening: attachments (F1-01), connections (F1-02), association_storage_available (F1-03).
-- Auditoría de seguridad 2026-10-19 (01-suplantacion-aislamiento.md), revisada por revisor independiente.
-- Contrato más estricto: authenticated YA NO escribe connections (la app escribe por vexa_backend con vexa.action);
-- attachments exigen vexa.action import (insert/update) o retain (delete). Down: supabase/operations/20261019000000_*.down.sql
begin;
set local lock_timeout='3s';       -- DROP POLICY/REVOKE piden ACCESS EXCLUSIVE: si hay una lectora larga, falla limpio en vez de encolar a la app
set local statement_timeout='30s';
-- F1-01
do $$ declare t text; g text:='tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid'; begin
 foreach t in array array['attachment_blobs','attachment_links'] loop
  execute format('drop policy if exists backend_scope on public.%I',t);
  execute format('drop policy if exists backend_read on public.%I',t);
  execute format('drop policy if exists backend_insert on public.%I',t);
  execute format('drop policy if exists backend_update on public.%I',t);
  execute format('drop policy if exists backend_delete on public.%I',t);
  execute format('create policy backend_read on public.%I for select to vexa_backend using (%s and public.vexa_member(tenant_id))',t,g);
  execute format('create policy backend_insert on public.%I for insert to vexa_backend with check (%s and public.vexa_backend_action(tenant_id,array[''import'']))',t,g);
  execute format('create policy backend_update on public.%I for update to vexa_backend using (%s and public.vexa_backend_action(tenant_id,array[''import''])) with check (%s and public.vexa_backend_action(tenant_id,array[''import'']))',t,g,g);
  execute format('create policy backend_delete on public.%I for delete to vexa_backend using (%s and public.vexa_backend_action(tenant_id,array[''retain'']))',t,g);
 end loop;
end $$;
-- F1-02 (cambia el contrato F01-03/IMPLEMENTATION-SCHEMA "authenticated escribe connections como owner"; oráculos, pruebas y docs actualizados en el mismo cambio)
drop policy if exists owner_insert on public.connections;
drop policy if exists owner_update on public.connections;
drop policy if exists owner_delete on public.connections;
revoke insert,update,delete on public.connections from authenticated;
-- F1-03
create or replace function public.association_storage_available(p_path text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare i public.imports;
begin
 select * into i from public.imports where object_path=p_path;
 if i.id is null then return false;end if;
 if not exists(select 1 from public.memberships m where m.tenant_id=i.tenant_id and m.user_id=auth.uid() and m.status='active') then return false;end if;
 if i.provenance->'mapping'->>'profile' is distinct from 'hubspot-ticket-contact-association-v1' then return true;end if;
 return public.association_raw_available(i.id);
end $$;
commit;
