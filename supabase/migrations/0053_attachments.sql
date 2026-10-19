begin;
-- Attachment metadata for the bulk history ingest. Bytes live in the private
-- Storage bucket under <tenant>/attachments/<aa>/<sha256>; content is
-- addressed per tenant (never cross-tenant dedup). Every source file identity
-- is kept in attachment_links even when several files share one blob.
-- Same posture as 0002: SECURITY INVOKER, FORCE RLS, authenticated read-only,
-- writes only through vexa_backend scoped to vexa.tenant_id.

create table public.attachment_blobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes bigint not null check (bytes>=0),
  mime_type text check (mime_type is null or length(mime_type) between 3 and 127),
  extension text check (extension is null or extension ~ '^\.?[a-z0-9]{1,16}$'),
  object_path text,
  state text not null default 'planned' check (state in ('planned','uploaded','verified','metadata_only','failed')),
  verified_at timestamptz,
  unique (tenant_id,sha256),
  check (object_path is null or object_path = tenant_id::text||'/attachments/'||substr(sha256,1,2)||'/'||sha256),
  check (state not in ('uploaded','verified') or object_path is not null),
  check (state<>'verified' or verified_at is not null)
);

create table public.attachment_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  blob_id uuid not null,
  source_family text not null check (source_family in ('conversation','note','email')),
  source_file_id text not null check (length(source_file_id) between 1 and 128),
  conversation_id uuid,
  message_id uuid,
  note_ref text check (note_ref is null or length(note_ref) between 1 and 256),
  unique (tenant_id,source_family,source_file_id)
);

alter table public.attachment_links add foreign key (tenant_id,blob_id) references public.attachment_blobs(tenant_id,id) on delete restrict;
alter table public.attachment_links add foreign key (tenant_id,conversation_id) references public.conversations(tenant_id,id) on delete restrict;
alter table public.attachment_links add foreign key (tenant_id,message_id) references public.messages(tenant_id,id) on delete restrict;
create index on public.attachment_links(tenant_id,blob_id);
create index on public.attachment_links(tenant_id,conversation_id) where conversation_id is not null;
create index on public.attachment_links(tenant_id,message_id) where message_id is not null;
create index on public.attachment_blobs(tenant_id,state);

-- The content identity of a blob never changes; only its storage state moves.
create function public.attachment_blob_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.sha256 is distinct from old.sha256 or new.bytes is distinct from old.bytes then
  raise exception 'attachment content identity is immutable' using errcode='23514'; end if;
 if old.object_path is not null and new.object_path is distinct from old.object_path then
  raise exception 'attachment object path is immutable' using errcode='23514'; end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function public.attachment_blob_guard() from public,anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['attachment_blobs','attachment_links'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to vexa_backend',t);
  execute format('create policy member_read on public.%I for select to authenticated using (public.vexa_member(tenant_id))',t);
  execute format('create policy backend_scope on public.%I to vexa_backend using (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_member(tenant_id)) with check (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_member(tenant_id))',t);
  execute format('create trigger immutable_tenant before update on public.%I for each row execute function public.vexa_immutable_tenant()',t);
  execute format('create index on public.%I(tenant_id,created_at,id)',t);
 end loop;
end $$;
create trigger attachment_blob_guard before update on public.attachment_blobs for each row execute function public.attachment_blob_guard();

commit;
