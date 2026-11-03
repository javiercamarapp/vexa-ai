begin;
-- Unión pedidos <-> tickets (HubSpot) <-> envíos (Speedship) por (order_key, retailer).
-- order_key = Order ID normalizado (paridad con packages/ingestion/pedidos/order-id.mjs). Sin ID válido => order_key NULL («sin ID», nunca cero).
-- Envíos: NO se guarda nombre, empresa, dirección ni zip del receptor; solo tracking, transportista, fechas, motivo, SKU y pedido.
-- Todo con RLS por tenant (tenant = vexa.tenant_id de la sesión + membresía), escritura solo con acción 'import'.

create or replace function public.order_id_normalize(p text) returns text language plpgsql immutable set search_path='' as $$
declare s text;
begin
 if p is null then return null; end if;
 s:=normalize(p,NFKC);
 s:=regexp_replace(s,'[​-‍﻿]','','g');
 s:=replace(s,E' ',' ');
 s:=regexp_replace(s,'[‐-―−﹣－]','-','g');
 s:=regexp_replace(s,'^\s+|\s+$','','g');
 if s='' then return null; end if;
 s:=regexp_replace(s,'^(reference|ref)\s*\d*\s*[-:=]\s*','','i');
 s:=regexp_replace(s,'^(order\s*(id|number|no|num)?|pedido)\s*[:#]\s*','','i');
 s:=regexp_replace(upper(s),'\s+','','g');
 if s ~ '^\d(\.\d+)?E\+\d+$' then
  if s::numeric=trunc(s::numeric) and s::numeric<9007199254740992 then s:=trunc(s::numeric)::text; end if;
 end if;
 s:=regexp_replace(s,'^(\d+)\.0+$','\1');
 s:=regexp_replace(s,'-{2,}','-','g');
 s:=regexp_replace(s,'^[-#.,:;''"`]+|[-#.,:;''"`]+$','','g');
 if s ~ '^\d{17}$' then s:=substr(s,1,3)||'-'||substr(s,4,7)||'-'||substr(s,11); end if;
 if length(s)<4 or length(s)>40 or s !~ '^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$' then return null; end if;
 if s in ('NONE','NULL','NAN','TBD','UNKNOWN','NOORDER','NOTAPPLICABLE') or replace(s,'-','') ~ '^0+$' then return null; end if;
 return s;
end $$;

create or replace function public.order_retailer_normalize(p text) returns text language plpgsql immutable set search_path='' as $$
declare k text;
begin
 if p is null then return null; end if;
 k:=lower(regexp_replace(normalize(p,NFKD),'[̀-ͯ]','','g'));
 k:=regexp_replace(k,'[^a-z0-9]','','g');
 if k='' then return null; end if;
 if k like 'amazon%' or k like 'amz%' then return 'amazon'; end if;
 if k like 'walmart%' then return 'walmart'; end if;
 if k like 'bestbuy%' then return 'bestbuy'; end if;
 if k like 'homedepot%' then return 'homedepot'; end if;
 if k like 'lowes%' or k='lowe' then return 'lowes'; end if;
 return left(k,40);
end $$;
revoke all on function public.order_id_normalize(text),public.order_retailer_normalize(text) from public,anon;
grant execute on function public.order_id_normalize(text),public.order_retailer_normalize(text) to authenticated,vexa_backend;

create table if not exists public.order_shipments (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 carrier text not null check(length(carrier) between 1 and 40), tracking text not null check(length(tracking) between 1 and 80),
 ship_date date, created_date date, reason text check(reason is null or length(reason)<=80), sku text check(sku is null or length(sku)<=60),
 order_key text check(order_key is null or public.order_id_normalize(order_key)=order_key),
 order_format text check(order_format is null or length(order_format)<=40),
 order_source text check(order_source is null or order_source in ('reference_1','reference_2')),
 retailer text not null default 'unknown' check(retailer='unknown' or public.order_retailer_normalize(retailer)=retailer),
 retailer_basis text not null default 'unknown' check(retailer_basis in ('format','ticket','unknown')),
 row_hash text not null check(row_hash ~ '^[a-f0-9]{64}$'),
 unique(tenant_id,id), unique(tenant_id,carrier,tracking)
);
create index if not exists order_shipments_key on public.order_shipments(tenant_id,retailer,order_key) where order_key is not null;

create table if not exists public.ticket_order_refs (
 tenant_id uuid not null references public.organizations(id) on delete restrict,
 ticket_external_id text not null check(length(ticket_external_id) between 1 and 1024),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 order_key text check(order_key is null or public.order_id_normalize(order_key)=order_key),
 retailer text not null default 'unknown' check(retailer='unknown' or public.order_retailer_normalize(retailer)=retailer),
 purchase_date date, sku text check(sku is null or length(sku)<=60), tool_family text check(tool_family is null or length(tool_family)<=60),
 country text check(country is null or length(country)<=40), contact_reason text check(contact_reason is null or length(contact_reason)<=80),
 row_hash text not null check(row_hash ~ '^[a-f0-9]{64}$'),
 primary key(tenant_id,ticket_external_id)
);
create index if not exists ticket_order_refs_key on public.ticket_order_refs(tenant_id,retailer,order_key) where order_key is not null;

do $$ declare tab text; begin
 foreach tab in array array['order_shipments','ticket_order_refs'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',tab);
  execute format('grant select,insert on public.%I to vexa_backend',tab);
  execute format('drop policy if exists backend_read on public.%I',tab);
  execute format('drop policy if exists backend_insert on public.%I',tab);
  execute format('drop policy if exists backend_update on public.%I',tab);
  execute format('create policy backend_read on public.%I for select to vexa_backend using (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_member(tenant_id))',tab);
  execute format('create policy backend_insert on public.%I for insert to vexa_backend with check (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_backend_action(tenant_id,array[''import'']))',tab);
  execute format('create policy backend_update on public.%I for update to vexa_backend using (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_backend_action(tenant_id,array[''import''])) with check (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_backend_action(tenant_id,array[''import'']))',tab);
 end loop;
end $$;
grant update(updated_at,ship_date,created_date,reason,sku,order_key,order_format,order_source,retailer,retailer_basis,row_hash) on public.order_shipments to vexa_backend;
grant update(updated_at,order_key,retailer,purchase_date,sku,tool_family,country,contact_reason,row_hash) on public.ticket_order_refs to vexa_backend;

-- Lote (<=250) de envíos: upsert por (tenant,transportista,tracking); idempotente. p_rows: [{carrier,tracking,ship_date,created_date,reason,sku,order_key,order_format,order_source,retailer,retailer_basis,row_hash}]
create or replace function public.order_shipments_ingest(p_rows jsonb) returns jsonb language plpgsql set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid; n integer; ins integer; upd integer;
begin
 if t is null then raise exception 'TENANT_REQUIRED' using errcode='42501'; end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'INVALID_BATCH'; end if;
 n:=jsonb_array_length(p_rows); if n=0 or n>250 then raise exception 'BATCH_SIZE_INVALID'; end if;
 if (select count(distinct (e->>'carrier')||'|'||(e->>'tracking')) from jsonb_array_elements(p_rows) e)<>n then raise exception 'DUPLICATE_IN_BATCH'; end if;
 with r as (
  insert into public.order_shipments(tenant_id,carrier,tracking,ship_date,created_date,reason,sku,order_key,order_format,order_source,retailer,retailer_basis,row_hash)
  select t,e->>'carrier',e->>'tracking',(e->>'ship_date')::date,(e->>'created_date')::date,e->>'reason',e->>'sku',e->>'order_key',e->>'order_format',e->>'order_source',coalesce(e->>'retailer','unknown'),coalesce(e->>'retailer_basis','unknown'),e->>'row_hash'
  from jsonb_array_elements(p_rows) e
  on conflict(tenant_id,carrier,tracking) do update set ship_date=excluded.ship_date,created_date=excluded.created_date,reason=excluded.reason,sku=excluded.sku,order_key=excluded.order_key,order_format=excluded.order_format,order_source=excluded.order_source,retailer=excluded.retailer,retailer_basis=excluded.retailer_basis,row_hash=excluded.row_hash,updated_at=now()
   where public.order_shipments.row_hash<>excluded.row_hash
  returning (xmax=0) as inserted)
 select count(*) filter(where inserted),count(*) filter(where not inserted) into ins,upd from r;
 return jsonb_build_object('inserted',ins,'updated',upd,'unchanged',n-ins-upd);
end $$;

-- Lote (<=250) de referencias de pedido de tickets de HubSpot. p_rows: [{ticket_external_id,order_key,retailer,purchase_date,sku,tool_family,country,contact_reason,row_hash}]
create or replace function public.ticket_order_refs_ingest(p_rows jsonb) returns jsonb language plpgsql set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid; n integer; ins integer; upd integer;
begin
 if t is null then raise exception 'TENANT_REQUIRED' using errcode='42501'; end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'INVALID_BATCH'; end if;
 n:=jsonb_array_length(p_rows); if n=0 or n>250 then raise exception 'BATCH_SIZE_INVALID'; end if;
 if (select count(distinct e->>'ticket_external_id') from jsonb_array_elements(p_rows) e)<>n then raise exception 'DUPLICATE_IN_BATCH'; end if;
 with r as (
  insert into public.ticket_order_refs(tenant_id,ticket_external_id,order_key,retailer,purchase_date,sku,tool_family,country,contact_reason,row_hash)
  select t,e->>'ticket_external_id',e->>'order_key',coalesce(e->>'retailer','unknown'),(e->>'purchase_date')::date,e->>'sku',e->>'tool_family',e->>'country',e->>'contact_reason',e->>'row_hash'
  from jsonb_array_elements(p_rows) e
  on conflict(tenant_id,ticket_external_id) do update set order_key=excluded.order_key,retailer=excluded.retailer,purchase_date=excluded.purchase_date,sku=excluded.sku,tool_family=excluded.tool_family,country=excluded.country,contact_reason=excluded.contact_reason,row_hash=excluded.row_hash,updated_at=now()
   where public.ticket_order_refs.row_hash<>excluded.row_hash
  returning (xmax=0) as inserted)
 select count(*) filter(where inserted),count(*) filter(where not inserted) into ins,upd from r;
 return jsonb_build_object('inserted',ins,'updated',upd,'unchanged',n-ins-upd);
end $$;
revoke all on function public.order_shipments_ingest(jsonb),public.ticket_order_refs_ingest(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.order_shipments_ingest(jsonb),public.ticket_order_refs_ingest(jsonb) to vexa_backend;

-- Pedidos del libro: la identidad «marketplace|pedido|sku» aporta (retailer, order_key). Identidades sin ese formato (p. ej. gid de Shopify) quedan sin ID.
create or replace view public.order_ledger_keys with (security_invoker=true) as
 select distinct on (e.tenant_id,e.entity_id) e.tenant_id,e.entity_id,
  case when e.external_id ~ '^[^|]+\|[^|]+\|' then coalesce(public.order_retailer_normalize(split_part(e.external_id,'|',1)),'unknown') else 'unknown' end as retailer,
  case when e.external_id ~ '^[^|]+\|[^|]+\|' then public.order_id_normalize(split_part(e.external_id,'|',2)) end as order_key
 from public.economic_ledger_entries e where e.kind='order' order by e.tenant_id,e.entity_id,e.revision desc;

-- Cobertura por retailer y entidad. unknown != zero: sin_id (no trae ID válido o retailer) se separa de sin_ligar (trae ID y no tiene par); cobertura NULL sin denominador.
create or replace view public.order_link_coverage with (security_invoker=true) as
with o as (select tenant_id,entity_id,retailer r,order_key k from public.order_ledger_keys),
 ou as (select distinct on (tenant_id,r,coalesce(k,'#'||entity_id::text)) tenant_id,r,k from o order by tenant_id,r,coalesce(k,'#'||entity_id::text)),
 t as (select tenant_id,retailer r,order_key k from public.ticket_order_refs),
 s as (select tenant_id,retailer r,order_key k from public.order_shipments),
 ok as (select distinct tenant_id,r,k from o where k is not null and r<>'unknown'),
 tk as (select distinct tenant_id,r,k from t where k is not null and r<>'unknown'),
 sk as (select distinct tenant_id,r,k from s where k is not null and r<>'unknown'),
 cand as (select tenant_id,k,count(distinct r) n from (select * from ok union select * from tk) x group by tenant_id,k),
 pedidos as (select ou.tenant_id,ou.r,'pedidos'::text entidad,count(*) total,
   count(*) filter(where k is not null and r<>'unknown' and (exists(select 1 from tk where tk.tenant_id=ou.tenant_id and tk.r=ou.r and tk.k=ou.k) or exists(select 1 from sk where sk.tenant_id=ou.tenant_id and sk.r=ou.r and sk.k=ou.k))) ligados,
   count(*) filter(where k is null or r='unknown') sin_id,
   count(*) filter(where k is not null and r<>'unknown' and exists(select 1 from tk where tk.tenant_id=ou.tenant_id and tk.r=ou.r and tk.k=ou.k)) con_ticket,
   count(*) filter(where k is not null and r<>'unknown' and exists(select 1 from sk where sk.tenant_id=ou.tenant_id and sk.r=ou.r and sk.k=ou.k)) con_envio,
   null::bigint candidatos from ou group by ou.tenant_id,ou.r),
 tickets as (select t.tenant_id,t.r,'tickets'::text entidad,count(*) total,
   count(*) filter(where k is not null and r<>'unknown' and (exists(select 1 from ok where ok.tenant_id=t.tenant_id and ok.r=t.r and ok.k=t.k) or exists(select 1 from sk where sk.tenant_id=t.tenant_id and sk.r=t.r and sk.k=t.k))) ligados,
   count(*) filter(where k is null or r='unknown') sin_id,null::bigint con_ticket,null::bigint con_envio,null::bigint candidatos from t group by t.tenant_id,t.r),
 envios as (select s.tenant_id,s.r,'envios'::text entidad,count(*) total,
   count(*) filter(where k is not null and r<>'unknown' and (exists(select 1 from ok where ok.tenant_id=s.tenant_id and ok.r=s.r and ok.k=s.k) or exists(select 1 from tk where tk.tenant_id=s.tenant_id and tk.r=s.r and tk.k=s.k))) ligados,
   count(*) filter(where k is null or r='unknown') sin_id,null::bigint con_ticket,null::bigint con_envio,
   count(*) filter(where r='unknown' and k is not null and exists(select 1 from cand where cand.tenant_id=s.tenant_id and cand.k=s.k and cand.n=1)) candidatos from s group by s.tenant_id,s.r)
select tenant_id,r as retailer,entidad,total,ligados,sin_id,total-sin_id-ligados as sin_ligar,ligados::numeric/nullif(total,0) as cobertura,con_ticket,con_envio,candidatos
from (select * from pedidos union all select * from tickets union all select * from envios) u;
revoke all on public.order_ledger_keys,public.order_link_coverage from public,anon,authenticated,service_role,vexa_backend;
grant select on public.order_ledger_keys,public.order_link_coverage to vexa_backend;
commit;
