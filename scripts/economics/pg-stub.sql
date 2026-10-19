-- Stubs MÍNIMOS de Supabase para aplicar 0001..0051 en un Postgres LOCAL desechable.
-- No es Supabase: solo auth/storage/extensions/roles que las migraciones referencian.
do $$ declare r text; begin foreach r in array array['anon','authenticated','service_role','supabase_admin'] loop if not exists(select 1 from pg_roles where rolname=r) then execute format('create role %I nologin',r); end if; end loop; end $$;
create schema auth;create schema extensions;create schema storage;
create table auth.users(id uuid primary key default gen_random_uuid(),email text,email_confirmed_at timestamptz,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}'::jsonb,deleted_at timestamptz,banned_until timestamptz,is_anonymous boolean default false);
create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,not_after timestamptz,created_at timestamptz default now(),aal text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'anon')$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
grant usage on schema auth to anon,authenticated,service_role;
-- vector mínimo (sin pgvector): tipo, <=> y vector_dims con semántica trivial; no se ejercen en estas pruebas.
create type extensions.vector as (v real[]);
create function extensions.vector_dims(extensions.vector) returns integer language sql immutable as $$select coalesce(array_length(($1).v,1),0)$$;
create function extensions.vec_cos(a extensions.vector,b extensions.vector) returns double precision language sql immutable as $$select 0::double precision$$;
create operator extensions.<=> (leftarg=extensions.vector,rightarg=extensions.vector,function=extensions.vec_cos);
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),version text);
alter table storage.objects enable row level security;
create function storage.allow_any_operation(text[]) returns boolean language sql stable as $$select false$$;
create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
grant usage on schema storage,extensions to anon,authenticated,service_role;
