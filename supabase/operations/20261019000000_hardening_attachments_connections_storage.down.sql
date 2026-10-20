-- DOWN de 0056_hardening_propuesto (restaura 0002/0053/0045 tal como estaban). Idempotente. NO relaja nada que no estuviera ya antes de 0056.
begin;
set local lock_timeout='5s';
do $$ declare t text; g text:='tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid'; begin
 foreach t in array array['attachment_blobs','attachment_links'] loop
  execute format('drop policy if exists backend_read on public.%I',t);
  execute format('drop policy if exists backend_insert on public.%I',t);
  execute format('drop policy if exists backend_update on public.%I',t);
  execute format('drop policy if exists backend_delete on public.%I',t);
  execute format('drop policy if exists backend_scope on public.%I',t);
  execute format('create policy backend_scope on public.%I to vexa_backend using (%s and public.vexa_member(tenant_id)) with check (%s and public.vexa_member(tenant_id))',t,g,g);
 end loop;
end $$;
grant insert,update,delete on public.connections to authenticated;
drop policy if exists owner_insert on public.connections;
drop policy if exists owner_update on public.connections;
drop policy if exists owner_delete on public.connections;
create policy owner_insert on public.connections for insert to authenticated with check(public.vexa_member(tenant_id,array['owner']));
create policy owner_update on public.connections for update to authenticated using(public.vexa_member(tenant_id,array['owner'])) with check(public.vexa_member(tenant_id,array['owner']));
create policy owner_delete on public.connections for delete to authenticated using(public.vexa_member(tenant_id,array['owner']));
create or replace function public.association_storage_available(p_path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare i public.imports;begin
 select * into i from public.imports where object_path=p_path;
 if i.id is null then return false;end if;
 if i.provenance->'mapping'->>'profile' is distinct from 'hubspot-ticket-contact-association-v1' then return true;end if;
 return public.association_raw_available(i.id);
end $$;
commit;
