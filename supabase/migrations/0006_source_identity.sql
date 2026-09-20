begin;
-- Public inventory: external security matrix must include BOTH new tables.
create table public.source_revisions (
 id uuid primary key, tenant_id uuid not null references public.organizations(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 provenance jsonb not null check(jsonb_typeof(provenance)='object'),
 connection_id uuid not null, entity_type text not null check(entity_type in ('customer','product','order','conversation','message')),
 external_id text not null, source_revision text not null, content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'), mapping_version text not null,
 related_customer_id uuid, related_product_id uuid, related_order_id uuid, related_conversation_id uuid, message_revision_id uuid,
 foreign key(tenant_id,related_customer_id) references public.customers(tenant_id,id) on delete restrict,
 foreign key(tenant_id,related_product_id) references public.products(tenant_id,id) on delete restrict,
 foreign key(tenant_id,related_order_id) references public.orders(tenant_id,id) on delete restrict deferrable initially deferred,
 foreign key(tenant_id,related_conversation_id) references public.conversations(tenant_id,id) on delete restrict,
 foreign key(tenant_id,message_revision_id) references public.message_revisions(tenant_id,id) on delete restrict deferrable initially deferred,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='array'),
 canonical_id uuid not null, customer_id uuid, product_id uuid, order_id uuid, conversation_id uuid, message_id uuid,
 unique(tenant_id,id), unique(tenant_id,connection_id,entity_type,external_id,source_revision),
 check(num_nonnulls(customer_id,product_id,order_id,conversation_id,message_id)=1),
 check(canonical_id=coalesce(customer_id,product_id,order_id,conversation_id,message_id)),
 check((entity_type='customer' and customer_id is not null) or (entity_type='product' and product_id is not null) or (entity_type='order' and order_id is not null) or (entity_type='conversation' and conversation_id is not null) or (entity_type='message' and message_id is not null)),
 foreign key(tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict,
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id) on delete restrict deferrable initially deferred,
 foreign key(tenant_id,product_id) references public.products(tenant_id,id) on delete restrict deferrable initially deferred,
 foreign key(tenant_id,order_id) references public.orders(tenant_id,id) on delete restrict deferrable initially deferred,
 foreign key(tenant_id,conversation_id) references public.conversations(tenant_id,id) on delete restrict deferrable initially deferred,
 foreign key(tenant_id,message_id) references public.messages(tenant_id,id) on delete restrict deferrable initially deferred
);
create table public.source_quarantine (
 id uuid primary key, tenant_id uuid not null references public.organizations(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 provenance jsonb not null check(jsonb_typeof(provenance)='object'),
 import_id uuid not null, import_row_id uuid not null, original_revision_id uuid,
 code text not null, evidence_hash text not null check(evidence_hash ~ '^[a-f0-9]{64}$'),
 unique(tenant_id,id),
 foreign key(tenant_id,import_id) references public.imports(tenant_id,id) on delete restrict,
 foreign key(tenant_id,import_row_id) references public.import_rows(tenant_id,id) on delete restrict,
 foreign key(tenant_id,original_revision_id) references public.source_revisions(tenant_id,id) on delete restrict
);
do $$ declare tab text; begin
 foreach tab in array array['source_revisions','source_quarantine'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('alter table public.%I force row level security',tab);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role,vexa_backend',tab);
 execute format('grant select,insert on public.%I to vexa_backend',tab);
 execute format('create policy backend_read on public.%I for select to vexa_backend using (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_member(tenant_id))',tab);
 execute format('create policy backend_insert on public.%I for insert to vexa_backend with check (tenant_id=nullif(current_setting(''vexa.tenant_id'',true),'''')::uuid and public.vexa_backend_action(tenant_id,array[''import'']))',tab);
 execute format('create index on public.%I(tenant_id,created_at,id)',tab);
 end loop;
end $$;
-- Version content is immutable; heads are the mutable selection, never the history.
alter table public.source_revisions add unique(tenant_id,canonical_id,id);
create table public.source_heads (
 id uuid primary key, tenant_id uuid not null references public.organizations(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 provenance jsonb not null default '{}'::jsonb check(jsonb_typeof(provenance)='object'),
 connection_id uuid not null, entity_type text not null check(entity_type in ('customer','product','order','conversation','message')),
 external_id text not null, selected_revision_id uuid, version integer not null check(version>0),
 state text not null check(state in ('unique','ambiguous','selected')),
 check((state='ambiguous')=(selected_revision_id is null)),
 unique(tenant_id,id), unique(tenant_id,connection_id,entity_type,external_id),
 foreign key(tenant_id,connection_id) references public.connections(tenant_id,id) on delete restrict,
 foreign key(tenant_id,id,selected_revision_id) references public.source_revisions(tenant_id,canonical_id,id) on delete restrict
);

alter table public.source_heads enable row level security;
alter table public.source_heads force row level security;
revoke all on public.source_heads from public,anon,authenticated,service_role,vexa_backend;
grant select,insert,update on public.source_heads to vexa_backend;
create policy backend_read on public.source_heads for select to vexa_backend using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
-- Initial heads may withhold authority; a unique choice requires one revision.
create policy backend_insert on public.source_heads for insert to vexa_backend with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']) and version=1 and (state='ambiguous' or (state='unique' and (select count(*) from public.source_revisions r where r.tenant_id=source_heads.tenant_id and r.canonical_id=source_heads.id)=1)));
-- Analysts can invalidate authority on new evidence, never choose a revision.
-- Keep USING permissive for import's SELECT FOR UPDATE; validate the new state.
create policy backend_update on public.source_heads for update to vexa_backend using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import'])) with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']) and (public.vexa_member(tenant_id,array['owner']) or state='ambiguous'));
create trigger immutable_tenant before update on public.source_heads for each row execute function public.vexa_immutable_tenant();
alter table public.messages alter column occurred_at drop not null;
-- message_revisions is canonical history, including source ingestion versions.
revoke update,delete on public.message_revisions from vexa_backend;
commit;
