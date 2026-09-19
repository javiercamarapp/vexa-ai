begin;
-- SECURITY INVOKER throughout. Runtime login must be provisioned separately.
create role vexa_backend nologin nosuperuser nobypassrls;
grant usage on schema public, auth to vexa_backend;
grant execute on function auth.uid() to vexa_backend;
grant select on public.memberships to vexa_backend;
create policy backend_membership_self on public.memberships for select to vexa_backend
 using (user_id=(select auth.uid()));
create function public.vexa_member(p_tenant uuid, p_roles text[] default array['owner','analyst','operator','viewer'])
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.memberships m where m.tenant_id=p_tenant
 and m.user_id=(select auth.uid()) and m.status='active' and m.role=any(p_roles))
$$;
revoke all on function public.vexa_member(uuid,text[]) from public,anon;
grant execute on function public.vexa_member(uuid,text[]) to authenticated,vexa_backend;
create function public.vexa_immutable_tenant() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.tenant_id is distinct from old.tenant_id or new.id is distinct from old.id then
 raise exception 'immutable tenant and id' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.vexa_immutable_tenant() from public,anon,authenticated;

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  source text not null, account_id text not null, status text not null default 'active' check (status in ('active','disconnected','reconnect_required','failed','disabled')), credential_ref text, watermark text, last_success timestamptz,
  unique (tenant_id,source,account_id)
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  file_hash text not null, mapping_version text not null, state text not null default 'reserved' check (state in ('reserved','uploaded','mapping','queued','running','partial','succeeded','failed','cancelled')), idempotency_key text not null, object_path text, total bigint not null default 0, accepted bigint not null default 0, rejected bigint not null default 0, duplicates bigint not null default 0, pending bigint not null default 0, check (least(total,accepted,rejected,duplicates,pending)>=0), check (total=accepted+rejected+duplicates+pending),
  connection_id uuid,
  unique (tenant_id,idempotency_key)
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  row_ref text not null, row_hash text, state text not null default 'pending' check (state in ('pending','accepted','rejected','duplicate')), error_code text, payload_ref text,
  import_id uuid not null,
  unique (tenant_id,import_id,row_ref)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  external_id text not null, source_revision text not null default '1', display_name text,
  connection_id uuid,
  unique nulls not distinct (tenant_id,connection_id,external_id,source_revision)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  external_id text not null, source_revision text not null default '1', sku text,
  connection_id uuid,
  unique nulls not distinct (tenant_id,connection_id,external_id,source_revision)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  external_id text not null, source_revision text not null default '1', amount_minor bigint check (amount_minor >= 0), currency text not null check (currency ~ '^[A-Z]{3}$'), exponent smallint not null check (exponent between 0 and 4), occurred_at timestamptz not null,
  connection_id uuid,
  customer_id uuid,
  unique nulls not distinct (tenant_id,connection_id,external_id,source_revision)
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  amount_minor bigint check (amount_minor >= 0), currency text not null check (currency ~ '^[A-Z]{3}$'), exponent smallint not null check (exponent between 0 and 4), external_id text, quantity numeric(20,6) check (quantity>0),
  order_id uuid not null,
  product_id uuid
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  source text not null, entity_type text not null default 'conversation', external_id text not null, source_revision text not null default '1', channel text, language text, started_at timestamptz, deleted_at timestamptz,
  connection_id uuid not null,
  customer_id uuid,
  order_id uuid,
  unique (tenant_id,connection_id,entity_type,external_id,source_revision)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  external_id text not null, source_revision text not null default '1', role text not null check (role in ('customer','agent','internal')), occurred_at timestamptz not null, deleted_at timestamptz,
  conversation_id uuid not null,
  connection_id uuid,
  unique (tenant_id,conversation_id,external_id,source_revision)
);

create table public.message_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  revision text not null, text_ref text not null, redacted_text text, hash text not null, redaction_version text, occurred_at timestamptz, deleted_at timestamptz,
  message_id uuid not null,
  unique (tenant_id,message_id,revision)
);

create table public.external_aliases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  source text not null, account_id text not null, entity_type text not null check (entity_type='conversation'), external_id text not null, evidence_ref text, approved_by uuid, version integer not null check (version>0),
  canonical_id uuid not null,
  unique (tenant_id,source,account_id,entity_type,external_id,version),
  foreign key (tenant_id,approved_by) references public.memberships(tenant_id,user_id) on delete restrict
);

alter table public.imports add foreign key (tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict;
create index on public.imports(tenant_id,connection_id);

alter table public.import_rows add foreign key (tenant_id,import_id) references public.imports(tenant_id,id) on delete restrict;
create index on public.import_rows(tenant_id,import_id);

alter table public.customers add foreign key (tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict;
create index on public.customers(tenant_id,connection_id);

alter table public.products add foreign key (tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict;
create index on public.products(tenant_id,connection_id);

alter table public.orders add foreign key (tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict;
create index on public.orders(tenant_id,connection_id);

alter table public.orders add foreign key (tenant_id,customer_id) references public.customers(tenant_id,id) on delete restrict;
create index on public.orders(tenant_id,customer_id);

alter table public.order_lines add foreign key (tenant_id,order_id) references public.orders(tenant_id,id) on delete restrict;
create index on public.order_lines(tenant_id,order_id);

alter table public.order_lines add foreign key (tenant_id,product_id) references public.products(tenant_id,id) on delete restrict;
create index on public.order_lines(tenant_id,product_id);

alter table public.conversations add foreign key (tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict;
create index on public.conversations(tenant_id,connection_id);

alter table public.conversations add foreign key (tenant_id,customer_id) references public.customers(tenant_id,id) on delete restrict;
create index on public.conversations(tenant_id,customer_id);

alter table public.conversations add foreign key (tenant_id,order_id) references public.orders(tenant_id,id) on delete restrict;
create index on public.conversations(tenant_id,order_id);

alter table public.messages add foreign key (tenant_id,conversation_id) references public.conversations(tenant_id,id) on delete restrict;
create index on public.messages(tenant_id,conversation_id);

alter table public.messages add foreign key (tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict;
create index on public.messages(tenant_id,connection_id);

alter table public.message_revisions add foreign key (tenant_id,message_id) references public.messages(tenant_id,id) on delete restrict;
create index on public.message_revisions(tenant_id,message_id);

alter table public.external_aliases add foreign key (tenant_id,canonical_id) references public.conversations(tenant_id,id) on delete restrict;
create index on public.external_aliases(tenant_id,canonical_id);

alter table public.connections enable row level security;
alter table public.connections force row level security;
revoke all on public.connections from public,anon,authenticated,service_role;
grant select on public.connections to authenticated;
grant select,insert,update,delete on public.connections to vexa_backend;
create policy member_read on public.connections for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.connections to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.connections for each row execute function public.vexa_immutable_tenant();
create index on public.connections(tenant_id,created_at,id);

alter table public.imports enable row level security;
alter table public.imports force row level security;
revoke all on public.imports from public,anon,authenticated,service_role;
grant select on public.imports to authenticated;
grant select,insert,update,delete on public.imports to vexa_backend;
create policy member_read on public.imports for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.imports to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.imports for each row execute function public.vexa_immutable_tenant();
create index on public.imports(tenant_id,created_at,id);

alter table public.import_rows enable row level security;
alter table public.import_rows force row level security;
revoke all on public.import_rows from public,anon,authenticated,service_role;
grant select on public.import_rows to authenticated;
grant select,insert,update,delete on public.import_rows to vexa_backend;
create policy member_read on public.import_rows for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.import_rows to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.import_rows for each row execute function public.vexa_immutable_tenant();
create index on public.import_rows(tenant_id,created_at,id);

alter table public.customers enable row level security;
alter table public.customers force row level security;
revoke all on public.customers from public,anon,authenticated,service_role;
grant select on public.customers to authenticated;
grant select,insert,update,delete on public.customers to vexa_backend;
create policy member_read on public.customers for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.customers to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.customers for each row execute function public.vexa_immutable_tenant();
create index on public.customers(tenant_id,created_at,id);

alter table public.products enable row level security;
alter table public.products force row level security;
revoke all on public.products from public,anon,authenticated,service_role;
grant select on public.products to authenticated;
grant select,insert,update,delete on public.products to vexa_backend;
create policy member_read on public.products for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.products to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.products for each row execute function public.vexa_immutable_tenant();
create index on public.products(tenant_id,created_at,id);

alter table public.orders enable row level security;
alter table public.orders force row level security;
revoke all on public.orders from public,anon,authenticated,service_role;
grant select on public.orders to authenticated;
grant select,insert,update,delete on public.orders to vexa_backend;
create policy member_read on public.orders for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.orders to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.orders for each row execute function public.vexa_immutable_tenant();
create index on public.orders(tenant_id,created_at,id);

alter table public.order_lines enable row level security;
alter table public.order_lines force row level security;
revoke all on public.order_lines from public,anon,authenticated,service_role;
grant select on public.order_lines to authenticated;
grant select,insert,update,delete on public.order_lines to vexa_backend;
create policy member_read on public.order_lines for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.order_lines to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.order_lines for each row execute function public.vexa_immutable_tenant();
create index on public.order_lines(tenant_id,created_at,id);

alter table public.conversations enable row level security;
alter table public.conversations force row level security;
revoke all on public.conversations from public,anon,authenticated,service_role;
grant select on public.conversations to authenticated;
grant select,insert,update,delete on public.conversations to vexa_backend;
create policy member_read on public.conversations for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.conversations to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.conversations for each row execute function public.vexa_immutable_tenant();
create index on public.conversations(tenant_id,created_at,id);

alter table public.messages enable row level security;
alter table public.messages force row level security;
revoke all on public.messages from public,anon,authenticated,service_role;
grant select on public.messages to authenticated;
grant select,insert,update,delete on public.messages to vexa_backend;
create policy member_read on public.messages for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.messages to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.messages for each row execute function public.vexa_immutable_tenant();
create index on public.messages(tenant_id,created_at,id);

alter table public.message_revisions enable row level security;
alter table public.message_revisions force row level security;
revoke all on public.message_revisions from public,anon,authenticated,service_role;
grant select on public.message_revisions to authenticated;
grant select,insert,update,delete on public.message_revisions to vexa_backend;
create policy member_read on public.message_revisions for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.message_revisions to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.message_revisions for each row execute function public.vexa_immutable_tenant();
create index on public.message_revisions(tenant_id,created_at,id);

alter table public.external_aliases enable row level security;
alter table public.external_aliases force row level security;
revoke all on public.external_aliases from public,anon,authenticated,service_role;
grant select on public.external_aliases to authenticated;
grant select,insert,update,delete on public.external_aliases to vexa_backend;
create policy member_read on public.external_aliases for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.external_aliases to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.external_aliases for each row execute function public.vexa_immutable_tenant();
create index on public.external_aliases(tenant_id,created_at,id);

grant insert,update,delete on public.connections to authenticated;
create policy owner_insert on public.connections for insert to authenticated with check(public.vexa_member(tenant_id,array['owner']));
create policy owner_update on public.connections for update to authenticated using(public.vexa_member(tenant_id,array['owner'])) with check(public.vexa_member(tenant_id,array['owner']));
create policy owner_delete on public.connections for delete to authenticated using(public.vexa_member(tenant_id,array['owner']));

commit;
