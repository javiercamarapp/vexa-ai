begin;
-- Tracker (libro Tracker del cliente piloto): una hoja = un job, lotes <=250 filas, valor Y fórmula por celda,
-- una versión por archivo recibido. La cabeza de cada fila es su observación en la versión de MAYOR rango
-- (decisión explícita: manda la más reciente; las anteriores se conservan como revisiones).
-- source_revisions/source_heads no sirven aquí: su entity_type no admite filas de hoja y una segunda revisión
-- distinta deja la cabeza 'ambiguous' sin elegir; el Tracker necesita una política determinista por rango.
-- Nada se actualiza ni se borra: revisiones, observaciones y rechazos son solo INSERT.

create table public.tracker_versions (
 id uuid primary key, tenant_id uuid not null references public.organizations(id) on delete restrict,
 created_at timestamptz not null default now(),
 provenance jsonb not null default '{}'::jsonb check(jsonb_typeof(provenance)='object'),
 connection_id uuid not null, file_sha256 text not null check(file_sha256 ~ '^[a-f0-9]{64}$'),
 label text, rank integer not null, received_at timestamptz,
 unique(tenant_id,id), unique(tenant_id,connection_id,file_sha256), unique(tenant_id,connection_id,rank),
 foreign key(tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict
);
create table public.tracker_sheet_jobs (
 id uuid primary key, tenant_id uuid not null references public.organizations(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 version_id uuid not null, sheet_name text not null check(length(sheet_name) between 1 and 128),
 sheet_state text not null check(sheet_state in ('visible','hidden')),
 expected_rows integer not null check(expected_rows>=0), expected_cells integer not null check(expected_cells>=0),
 state text not null default 'open' check(state in ('open','closed')),
 unique(tenant_id,id), unique(tenant_id,version_id,sheet_name),
 foreign key(tenant_id,version_id) references public.tracker_versions(tenant_id,id) on delete restrict
);
create table public.tracker_row_revisions (
 id uuid primary key, tenant_id uuid not null references public.organizations(id) on delete restrict,
 created_at timestamptz not null default now(),
 connection_id uuid not null, sheet_name text not null, row_number integer not null check(row_number between 1 and 1048576),
 row_hash text not null check(row_hash ~ '^[a-f0-9]{64}$'),
 cells jsonb not null check(jsonb_typeof(cells)='array'),
 ticket_state text not null check(ticket_state in ('header','linked','candidate','malformed_id','conflicting_ids','no_ticket')),
 ticket_id text, ticket_cell text, first_version_id uuid not null,
 unique(tenant_id,id), unique(tenant_id,connection_id,sheet_name,row_number,row_hash),
 foreign key(tenant_id,first_version_id) references public.tracker_versions(tenant_id,id) on delete restrict
);
create table public.tracker_row_observations (
 tenant_id uuid not null references public.organizations(id) on delete restrict,
 version_id uuid not null, sheet_name text not null, row_number integer not null, revision_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(tenant_id,version_id,sheet_name,row_number),
 foreign key(tenant_id,version_id) references public.tracker_versions(tenant_id,id) on delete restrict,
 foreign key(tenant_id,revision_id) references public.tracker_row_revisions(tenant_id,id) on delete restrict
);
create index on public.tracker_row_observations(tenant_id,revision_id);
create table public.tracker_row_rejections (
 tenant_id uuid not null references public.organizations(id) on delete restrict,
 version_id uuid not null, sheet_name text not null, row_number integer not null,
 code text not null check(code ~ '^[A-Z_]{3,64}$'), field text, raw_hash text not null check(raw_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 primary key(tenant_id,version_id,sheet_name,row_number,code),
 foreign key(tenant_id,version_id) references public.tracker_versions(tenant_id,id) on delete restrict
);

do $$ declare tab text; begin
 foreach tab in array array['tracker_versions','tracker_sheet_jobs','tracker_row_revisions','tracker_row_observations','tracker_row_rejections'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('alter table public.%I force row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',tab);
  execute format('grant select,insert on public.%I to vexa_backend',tab);
  execute format('create policy backend_read on public.%I for select to vexa_backend using (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_member(tenant_id))',tab);
  execute format('create policy backend_insert on public.%I for insert to vexa_backend with check (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_backend_action(tenant_id,array[''import'']))',tab);
 end loop;
end $$;
-- Único campo mutable: el cierre del job de hoja.
grant update(state,updated_at) on public.tracker_sheet_jobs to vexa_backend;
create policy backend_update on public.tracker_sheet_jobs for update to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']));

-- Cabeza por fila = observación de la versión de mayor rango. Con security_invoker aplica la RLS de quien consulta.
create view public.tracker_row_heads with (security_invoker=true) as
 select distinct on (o.tenant_id,v.connection_id,o.sheet_name,o.row_number)
  o.tenant_id,v.connection_id,o.sheet_name,o.row_number,o.version_id as head_version_id,v.rank as head_rank,o.revision_id,r.row_hash,r.ticket_state,r.ticket_id,r.cells
 from public.tracker_row_observations o
 join public.tracker_versions v on v.tenant_id=o.tenant_id and v.id=o.version_id
 join public.tracker_row_revisions r on r.tenant_id=o.tenant_id and r.id=o.revision_id
 order by o.tenant_id,v.connection_id,o.sheet_name,o.row_number,v.rank desc;
revoke all on public.tracker_row_heads from public,anon,authenticated,service_role,vexa_backend;
grant select on public.tracker_row_heads to vexa_backend;

-- Id de revisión estable: sha256 de (tenant,conexión,hoja,fila,hash) -> idempotente entre reintentos.
create function public.tracker_revision_id(p_tenant uuid,p_conn uuid,p_sheet text,p_row integer,p_hash text) returns uuid language sql immutable set search_path='' as $$
 select (substr(h,1,8)||'-'||substr(h,9,4)||'-5'||substr(h,14,3)||'-a'||substr(h,18,3)||'-'||substr(h,21,12))::uuid
 from (select encode(sha256(convert_to(p_tenant::text||'|'||p_conn::text||'|'||p_sheet||'|'||p_row||'|'||p_hash,'UTF8')),'hex') h) x
$$;

-- Un lote (<=250 filas) de una hoja de una versión; atómico y reintentable. Devuelve conteos.
-- p_rows: [{row_number,row_hash,cells,ticket_state,ticket_id,ticket_cell}]; p_rejections: [{row_number,code,field,raw_hash}].
create function public.tracker_ingest_batch(p_version uuid,p_sheet text,p_rows jsonb,p_rejections jsonb default '[]'::jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;
 conn uuid;n integer;inserted integer;revised integer;unchanged integer;replay integer;clash integer;
begin
 if t is null then raise exception 'TENANT_REQUIRED' using errcode='42501';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_typeof(p_rejections)<>'array' then raise exception 'INVALID_BATCH';end if;
 n:=jsonb_array_length(p_rows)+jsonb_array_length(p_rejections);
 if n=0 or n>250 then raise exception 'BATCH_SIZE_INVALID';end if;
 select connection_id into conn from public.tracker_versions where tenant_id=t and id=p_version;
 if conn is null then raise exception 'VERSION_UNKNOWN';end if;
 if not exists(select 1 from public.tracker_sheet_jobs where tenant_id=t and version_id=p_version and sheet_name=p_sheet and state='open') then raise exception 'SHEET_JOB_NOT_OPEN';end if;
 if (select count(distinct (e->>'row_number')::integer) from jsonb_array_elements(p_rows) e)<>jsonb_array_length(p_rows) then raise exception 'DUPLICATE_ROW_IN_BATCH';end if;
 with b as (select (e->>'row_number')::integer rn,e->>'row_hash' h,public.tracker_revision_id(t,conn,p_sheet,(e->>'row_number')::integer,e->>'row_hash') rev from jsonb_array_elements(p_rows) e),
 c as (select b.*,o.revision_id prior,exists(select 1 from public.tracker_row_revisions r where r.tenant_id=t and r.connection_id=conn and r.sheet_name=p_sheet and r.row_number=b.rn) seen,
        exists(select 1 from public.tracker_row_revisions r where r.tenant_id=t and r.id=b.rev) known
       from b left join public.tracker_row_observations o on o.tenant_id=t and o.version_id=p_version and o.sheet_name=p_sheet and o.row_number=b.rn)
 select count(*) filter(where prior is not null and prior<>rev),count(*) filter(where prior is not null),
        count(*) filter(where prior is null and not known and not seen),count(*) filter(where prior is null and not known and seen),count(*) filter(where prior is null and known)
  into clash,replay,inserted,revised,unchanged from c;
 if clash>0 then raise exception 'ROW_CONFLICT_IN_VERSION';end if;
 insert into public.tracker_row_revisions(id,tenant_id,connection_id,sheet_name,row_number,row_hash,cells,ticket_state,ticket_id,ticket_cell,first_version_id)
  select public.tracker_revision_id(t,conn,p_sheet,(e->>'row_number')::integer,e->>'row_hash'),t,conn,p_sheet,(e->>'row_number')::integer,e->>'row_hash',e->'cells',e->>'ticket_state',e->>'ticket_id',e->>'ticket_cell',p_version
  from jsonb_array_elements(p_rows) e on conflict do nothing;
 insert into public.tracker_row_observations(tenant_id,version_id,sheet_name,row_number,revision_id)
  select t,p_version,p_sheet,(e->>'row_number')::integer,public.tracker_revision_id(t,conn,p_sheet,(e->>'row_number')::integer,e->>'row_hash') from jsonb_array_elements(p_rows) e on conflict do nothing;
 insert into public.tracker_row_rejections(tenant_id,version_id,sheet_name,row_number,code,field,raw_hash)
  select t,p_version,p_sheet,(e->>'row_number')::integer,e->>'code',e->>'field',e->>'raw_hash' from jsonb_array_elements(p_rejections) e on conflict do nothing;
 return jsonb_build_object('inserted',inserted,'revised',revised,'unchanged',unchanged,'replay',replay,'rejected',jsonb_array_length(p_rejections));
end $$;

-- Cierra el job de hoja solo si filas aceptadas + rechazadas == filas esperadas (leídas del archivo).
create function public.tracker_close_sheet(p_version uuid,p_sheet text) returns jsonb language plpgsql set search_path='' as $$
declare t uuid:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;j public.tracker_sheet_jobs;obs integer;rej integer;
begin
 select * into j from public.tracker_sheet_jobs where tenant_id=t and version_id=p_version and sheet_name=p_sheet for update;
 if not found then raise exception 'SHEET_JOB_UNKNOWN';end if;
 select count(*) into obs from public.tracker_row_observations where tenant_id=t and version_id=p_version and sheet_name=p_sheet;
 select count(distinct row_number) into rej from public.tracker_row_rejections where tenant_id=t and version_id=p_version and sheet_name=p_sheet;
 if obs+rej<>j.expected_rows then raise exception 'SHEET_COUNT_MISMATCH';end if;
 update public.tracker_sheet_jobs set state='closed',updated_at=now() where tenant_id=t and id=j.id;
 return jsonb_build_object('accepted',obs,'rejected',rej,'expected',j.expected_rows);
end $$;
revoke all on function public.tracker_revision_id(uuid,uuid,text,integer,text),public.tracker_ingest_batch(uuid,text,jsonb,jsonb),public.tracker_close_sheet(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.tracker_revision_id(uuid,uuid,text,integer,text),public.tracker_ingest_batch(uuid,text,jsonb,jsonb),public.tracker_close_sheet(uuid,text) to vexa_backend;
commit;
