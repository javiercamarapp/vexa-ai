-- H-01 (auditoría 1; cierre 29-oct): límite general de peticiones a /api/* RESPALDADO EN BASE y tope de concurrencia por organización.
-- Hasta hoy solo el enlace de acceso, el copiloto y el agente tenían límite, y los tres en memoria de cada instancia; el resto dependía de un pool de 5 conexiones.
--  * api_rate_add: contador por (clase, huella, minuto). La aplicación acumula localmente y suma por lotes (un viaje a la base cada ~5 s por huella y por instancia,
--    no uno por petición); la base devuelve el total global del minuto y cada instancia decide con él. Solo huellas HMAC (IP y sesión), nunca valores en claro.
--  * api_concurrency_*: arrendamientos con caducidad (60 s por defecto) por (organización, clase) para que una organización no agote el pool con importaciones o
--    consultas de espacio de trabajo simultáneas. La caducidad evita fugas si una instancia muere.
-- Reversión: drop function public.api_rate_add(text,text,int),public.api_concurrency_acquire(uuid,text,int,int),public.api_concurrency_release(uuid); drop table public.api_rate_counters,public.api_concurrency_leases;
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create table public.api_rate_counters(
 class text not null check(class ~ '^[a-z_]{1,24}$'),
 key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),
 window_start timestamptz not null,
 hits integer not null default 0 check(hits>=0),
 primary key(class,key_hash,window_start)
);
create index api_rate_counters_window on public.api_rate_counters(window_start);
create table public.api_concurrency_leases(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.organizations(id) on delete cascade,
 class text not null check(class ~ '^[a-z_]{1,24}$'),
 expires_at timestamptz not null
);
create index api_concurrency_leases_lookup on public.api_concurrency_leases(tenant_id,class,expires_at);
alter table public.api_rate_counters enable row level security;
alter table public.api_rate_counters force row level security;
alter table public.api_concurrency_leases enable row level security;
alter table public.api_concurrency_leases force row level security;
revoke all on public.api_rate_counters,public.api_concurrency_leases from public,anon,authenticated,service_role,vexa_backend;

create function public.api_rate_add(p_class text,p_key text,p_n integer) returns integer language plpgsql security definer set search_path='' as $$
declare w timestamptz:=date_trunc('minute',clock_timestamp()); total integer;
begin
 if p_class is null or p_class !~ '^[a-z_]{1,24}$' or p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_n is null or p_n<1 or p_n>10000 then
  raise exception using errcode='22023',message='api_rate_input_invalid';
 end if;
 insert into public.api_rate_counters(class,key_hash,window_start,hits) values(p_class,p_key,w,p_n)
  on conflict(class,key_hash,window_start) do update set hits=public.api_rate_counters.hits+excluded.hits returning hits into total;
 -- Poda acotada de ventanas viejas (más de 10 minutos).
 delete from public.api_rate_counters where (class,key_hash,window_start) in(select c.class,c.key_hash,c.window_start from public.api_rate_counters c where c.window_start<w-interval '10 minutes' limit 200);
 return total;
end $$;
revoke all on function public.api_rate_add(text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.api_rate_add(text,text,integer) to vexa_backend;

-- Devuelve el id del arrendamiento, o null si la organización ya tiene p_max vigentes de esa clase.
create function public.api_concurrency_acquire(p_tenant uuid,p_class text,p_max integer,p_ttl_seconds integer default 60) returns uuid language plpgsql security definer set search_path='' as $$
declare n integer; lease uuid;
begin
 if p_tenant is null or p_class is null or p_class !~ '^[a-z_]{1,24}$' or p_max is null or p_max<1 or p_max>50 or p_ttl_seconds is null or p_ttl_seconds not between 5 and 300 then
  raise exception using errcode='22023',message='api_concurrency_input_invalid';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('api-conc:'||p_tenant::text||':'||p_class,0));
 delete from public.api_concurrency_leases where tenant_id=p_tenant and class=p_class and expires_at<=clock_timestamp();
 select count(*) into n from public.api_concurrency_leases where tenant_id=p_tenant and class=p_class;
 if n>=p_max then return null; end if;
 insert into public.api_concurrency_leases(tenant_id,class,expires_at) values(p_tenant,p_class,clock_timestamp()+make_interval(secs=>p_ttl_seconds)) returning id into lease;
 return lease;
end $$;
create function public.api_concurrency_release(p_lease uuid) returns void language sql security definer set search_path='' as $$
 delete from public.api_concurrency_leases where id=p_lease
$$;
revoke all on function public.api_concurrency_acquire(uuid,text,integer,integer),public.api_concurrency_release(uuid) from public,anon,authenticated,service_role;
grant execute on function public.api_concurrency_acquire(uuid,text,integer,integer),public.api_concurrency_release(uuid) to vexa_backend;
commit;
