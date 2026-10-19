do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;
create schema auth; create schema storage; create schema extensions;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', deleted_at timestamptz, banned_until timestamptz, created_at timestamptz default now());
create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz default now(), not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb);
alter table storage.objects enable row level security;
create function storage.allow_any_operation(a text[]) returns boolean language sql as $$ select true $$;
-- Sustituto de pgvector para Postgres local sin la extension: el texto '[a,b,c]' es el mismo formato de entrada/salida de pgvector.
create domain extensions.vector as text;
create function extensions.vector_dims(v extensions.vector) returns integer language sql immutable as $$ select coalesce(array_length(string_to_array(btrim(v::text,'[]'),','),1),0) $$;
create function extensions.vector_cosine_distance(a extensions.vector, b extensions.vector) returns double precision language sql immutable as $$ select 0::double precision $$;
create operator extensions.<=> (leftarg = extensions.vector, rightarg = extensions.vector, function = extensions.vector_cosine_distance);
-- Como en Supabase: los roles de la API pueden usar el esquema auth (auth.uid()/auth.jwt()).
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
