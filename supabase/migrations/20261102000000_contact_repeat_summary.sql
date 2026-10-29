-- 20261102000000 (PROPUESTA, NO APLICADA): resumen precomputado de CONTACTO REPETIDO para la pantalla «Fuga de reembolsos» (/refunds).
-- Por qué: la tasa de contacto repetido (contactos con 2 o más tickets en 90 días) exige la fecha del primer mensaje de ~100 mil conversaciones y una ventana por contacto
-- sobre ~72 mil vínculos (varios segundos, con RLS por fila no cabe en el tope de 2.5-8 s de una lectura de pantalla). Aquí corre UNA vez por refresco, fuera de la ruta del usuario.
-- Sin esta migración la pantalla muestra «No disponible ahora» en esa sección (nunca 0) y todo lo demás sigue funcionando.
-- Qué NO hace: no cambia ninguna política, función ni dato existente; no se refresca sola (lo ejecuta un operador: select public.refresh_contact_repeat('<tenant>')).
-- Definiciones (idénticas a las consultas de DATOS.md, 23-oct, verificadas contra el cliente piloto): fecha del ticket = primer mensaje no borrado de la conversación; contacto = cliente con vínculo activo;
-- «repite» = el ticket tiene al menos otro ticket del mismo contacto en los 90 días previos o el mismo instante. Categorías = issues.category (IA), solo cubre las conversaciones con extracción.
-- Reversa: packages/workspace-service/tests/20261102000000_contact_repeat_summary.down.sql
begin;
set local lock_timeout='3s';
do $$
begin
 if to_regclass('public.conversation_customer_association_bindings') is null or to_regclass('public.messages') is null or to_regclass('public.issues') is null then
  raise exception 'faltan tablas base: aplique antes las migraciones de asociaciones y extracción';
 end if;
 if to_regprocedure('public.vexa_member(uuid,text[])') is null then raise exception 'falta public.vexa_member'; end if;
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'el propietario de la migración (%) debe ser superusuario o tener BYPASSRLS', current_user;
 end if;
end $$;

create table if not exists public.contact_repeat_summary(
 tenant_id uuid primary key references public.organizations(id),
 refreshed_at timestamptz not null,
 source_watermark timestamptz,
 contacts bigint not null check(contacts>=0),
 contacts_ge2_90 bigint not null check(contacts_ge2_90>=0),
 contacts_ge3_90 bigint not null check(contacts_ge3_90>=0),
 linked_tickets bigint not null check(linked_tickets>=0),
 repeat_tickets_90 bigint not null check(repeat_tickets_90>=0),
 total_tickets bigint not null check(total_tickets>=0),
 by_category jsonb not null default '[]'::jsonb check(jsonb_typeof(by_category)='array')
);
alter table public.contact_repeat_summary enable row level security;
alter table public.contact_repeat_summary force row level security;
revoke all on public.contact_repeat_summary from public,anon,authenticated,service_role,vexa_backend;
grant select on public.contact_repeat_summary to vexa_backend;
drop policy if exists summary_read on public.contact_repeat_summary;
create policy summary_read on public.contact_repeat_summary for select to vexa_backend
 using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (select public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid)));

-- Función de refresco: SECURITY DEFINER acotada, search_path vacío, SIN ningún GRANT (solo el propietario/operador). Reemplaza la fila del tenant en UNA transacción (idempotente).
create or replace function public.refresh_contact_repeat(p_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare wm timestamptz; ts timestamptz:=clock_timestamp(); r record; cats jsonb; total bigint;
begin
 if p_tenant is null then raise exception 'SUMMARY_INPUT_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.organizations where id=p_tenant) then raise exception 'SUMMARY_TENANT_UNKNOWN' using errcode='22023'; end if;
 perform set_config('lock_timeout','5s',true);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':summary:contact_repeat',0));
 select max(created_at) into wm from public.conversation_customer_association_bindings where tenant_id=p_tenant;
 select count(*) into total from public.conversations where tenant_id=p_tenant and deleted_at is null;
 with f as (select conversation_id,min(occurred_at) t from public.messages where tenant_id=p_tenant and deleted_at is null group by 1),
 b as (select bd.customer_id,bd.conversation_id,f.t from public.conversation_customer_association_bindings bd join f on f.conversation_id=bd.conversation_id where bd.tenant_id=p_tenant and bd.active),
 x as (select customer_id,t,count(*) over (partition by customer_id order by t range between interval '90 days' preceding and current row) in90 from b)
 select count(distinct customer_id) c,count(distinct customer_id) filter(where in90>=2) c2,count(distinct customer_id) filter(where in90>=3) c3,count(*) n,count(*) filter(where in90>=2) rep into r from x;
 -- Repetición por categoría de IA: clientes (con 50 tickets o menos en total, para no contar alias de marketplace) con 2+ tickets, entre los clientes vinculados a conversaciones de la categoría.
 with bd as (select customer_id,conversation_id from public.conversation_customer_association_bindings where tenant_id=p_tenant and active),
 tot as (select customer_id,count(*) tot from bd group by 1 having count(*)<=50),
 cat as (select distinct i.category,bd.customer_id from public.issues i join public.extraction_runs er on er.id=i.extraction_run_id and er.tenant_id=i.tenant_id join bd on bd.conversation_id=er.conversation_id where i.tenant_id=p_tenant),
 agg as (select category,count(*) customers,count(*) filter(where tot>=2) repeaters from cat join tot using(customer_id) group by 1 having count(*)>=20)
 select coalesce(jsonb_agg(jsonb_build_object('category',category,'customers',customers,'repeaters',repeaters) order by repeaters::numeric/customers desc,customers desc),'[]'::jsonb) into cats from agg;
 insert into public.contact_repeat_summary(tenant_id,refreshed_at,source_watermark,contacts,contacts_ge2_90,contacts_ge3_90,linked_tickets,repeat_tickets_90,total_tickets,by_category)
 values(p_tenant,ts,wm,r.c,r.c2,r.c3,r.n,r.rep,total,cats)
 on conflict(tenant_id) do update set refreshed_at=excluded.refreshed_at,source_watermark=excluded.source_watermark,contacts=excluded.contacts,contacts_ge2_90=excluded.contacts_ge2_90,contacts_ge3_90=excluded.contacts_ge3_90,
  linked_tickets=excluded.linked_tickets,repeat_tickets_90=excluded.repeat_tickets_90,total_tickets=excluded.total_tickets,by_category=excluded.by_category;
 return jsonb_build_object('summary','contact_repeat','contacts',r.c,'contacts_ge2_90',r.c2,'contacts_ge3_90',r.c3,'linked_tickets',r.n,'refreshed_at',ts);
end $$;
revoke all on function public.refresh_contact_repeat(uuid) from public,anon,authenticated,service_role,vexa_backend;
commit;
