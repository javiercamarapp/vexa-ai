begin;
-- Inbound CRM sync hints only. No notification delivery objects or policies.
create table public.crm_webhook_receipts (
 id bigint generated always as identity primary key,
 tenant_id uuid not null references public.organizations(id),
 connection_id uuid not null,
 digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 received_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,connection_id,digest),
 foreign key(tenant_id,connection_id) references public.connections(tenant_id,id)
);
create index crm_webhook_receipts_recent on public.crm_webhook_receipts(tenant_id,connection_id,received_at);
alter table public.crm_webhook_receipts enable row level security;
alter table public.crm_webhook_receipts force row level security;
revoke all on public.crm_webhook_receipts from public,anon,authenticated,service_role,vexa_backend;
grant select,delete on public.crm_webhook_receipts to vexa_backend;
grant insert(tenant_id,connection_id,digest) on public.crm_webhook_receipts to vexa_backend;
revoke all on sequence public.crm_webhook_receipts_id_seq from public,anon,authenticated,service_role,vexa_backend;
grant usage on sequence public.crm_webhook_receipts_id_seq to vexa_backend;
create policy crm_webhook_read on public.crm_webhook_receipts for select to vexa_backend using(
 tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.crm_actor_authorized(connection_id));
create policy crm_webhook_insert on public.crm_webhook_receipts for insert to vexa_backend with check(
 tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.crm_actor_authorized(connection_id));
create policy crm_webhook_prune on public.crm_webhook_receipts for delete to vexa_backend using(
 tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.crm_actor_authorized(connection_id)
 and received_at<clock_timestamp()-interval '10 minutes');
commit;
