begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
grant usage on schema extensions to authenticated,vexa_backend;

create table public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  model_id text not null, prompt_hash text not null, schema_hash text not null, input_hash text, status text not null check (status in ('queued','running','succeeded','failed','abstained','policy_blocked')), usage jsonb not null default '{}'::jsonb,
  conversation_id uuid not null,
  job_id uuid
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  category text not null, severity text, sentiment text, intent text, urgency text, abstention_reason text,
  extraction_run_id uuid not null
);

create table public.evidence_spans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  "start" integer not null check ("start">=0), "end" integer not null, quote_hash text not null, check ("end">"start"),
  message_revision_id uuid not null,
  issue_id uuid
);

create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  model_id text not null, dim integer not null check (dim>0 and dim<=4096), version text not null, content text not null, embedding extensions.vector not null, check (extensions.vector_dims(embedding)=dim),
  message_revision_id uuid not null,
  unique (tenant_id,message_revision_id,model_id,version)
);

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  severity text not null check (severity in ('low','medium','high','critical')), cause_status text not null check (cause_status in ('unknown','hypothesis','supported','rejected')), title text, archived_at timestamptz
);

create table public.problem_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  version integer not null check (version>0), title text, rationale text, change_kind text check (change_kind in ('create','edit','split','merge')),
  problem_id uuid not null,
  previous_version_id uuid,
  unique (tenant_id,problem_id,version)
);

create table public.problem_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  valid_from timestamptz not null default now(), valid_until timestamptz, check (valid_until is null or valid_until>valid_from),
  problem_id uuid not null,
  conversation_id uuid not null,
  issue_id uuid,
  unique (tenant_id,problem_id,conversation_id,valid_from)
);

create table public.economic_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  kind text not null check (kind in ('refund','replacement','return','support','order_exposure','revenue_at_risk')), status text not null check (status in ('observed','modeled','inferred','unknown')), amount_minor bigint check (amount_minor >= 0), currency text not null check (currency ~ '^[A-Z]{3}$'), exponent smallint not null check (exponent between 0 and 4), effective_at timestamptz not null, source_ref text not null, window_start timestamptz, window_end timestamptz, check (window_end is null or window_end>window_start),
  order_id uuid,
  evidence_span_id uuid,
  cost_rate_id uuid,
  assumption_id uuid,
  unique (tenant_id,kind,source_ref),
  unique (tenant_id,id,currency,exponent)
);

create table public.reversals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  amount_minor bigint check (amount_minor >= 0), currency text not null check (currency ~ '^[A-Z]{3}$'), exponent smallint not null check (exponent between 0 and 4), source_ref text, effective_at timestamptz not null default now(),
  reversal_of uuid not null,
  foreign key (tenant_id,reversal_of,currency,exponent) references public.economic_events(tenant_id,id,currency,exponent) on delete restrict,
  unique (tenant_id,source_ref)
);

create table public.cost_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  amount_minor bigint check (amount_minor >= 0), currency text not null check (currency ~ '^[A-Z]{3}$'), exponent smallint not null check (exponent between 0 and 4), effective_at timestamptz not null, effective_until timestamptz, unit text, version integer not null default 1 check (version>0), check (effective_until is null or effective_until>effective_at)
);

create table public.assumptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  version integer not null check (version>0), name text, value_decimal numeric, unit text, rationale text, approved_by uuid, window_start timestamptz, window_end timestamptz, check (window_end is null or window_end>window_start),
  foreign key (tenant_id,approved_by) references public.memberships(tenant_id,user_id) on delete restrict
);

create table public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  scope_hash text not null, input_hash text not null, policy_version text not null, watermark timestamptz not null, status text not null check (status in ('draft','published','failed')), bundle_ref text, date_start timestamptz, date_end timestamptz, timezone text, currency text check (currency ~ '^[A-Z]{3}$'), date_basis text check (date_basis in ('conversation','order','refund')), published_at timestamptz, check (date_end is null or date_end>date_start),
  job_id uuid,
  unique (tenant_id,scope_hash,input_hash,policy_version),
  check (status<>'published' or (bundle_ref is not null and published_at is not null))
);

create table public.components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  amount_minor bigint check (amount_minor >= 0), currency text not null check (currency ~ '^[A-Z]{3}$'), exponent smallint not null check (exponent between 0 and 4), metric text, kind text check (kind in ('observed','modeled','inferred')), known_subtotal_minor bigint, known_count bigint, total_count bigint, check (known_count>=0 and total_count>=known_count),
  snapshot_id uuid not null,
  problem_id uuid
);

create table public.attributions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  weight numeric check (weight>=0 and weight<=1),
  snapshot_id uuid not null,
  economic_event_id uuid not null,
  component_id uuid,
  problem_id uuid
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  approval_bound boolean not null default false,
  status text not null check (status in ('draft','proposed','accepted','dismissed')), version integer not null check (version>0), title text, rationale text, owner_id uuid, idempotency_key text,
  problem_id uuid not null,
  snapshot_id uuid,
  evidence_span_id uuid,
  foreign key (tenant_id,owner_id) references public.memberships(tenant_id,user_id) on delete restrict,
  unique (tenant_id,idempotency_key)
);

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  status text not null check (status in ('draft','approved','active','measuring','closed','cancelled')), version integer not null check (version>0), owner_id uuid, hypothesis text, reason text, idempotency_key text,
  recommendation_id uuid not null,
  baseline_ref uuid,
  measurement_ref uuid,
  approval_content jsonb,
  foreign key (tenant_id,owner_id) references public.memberships(tenant_id,user_id) on delete restrict,
  unique (tenant_id,idempotency_key)
);

create table public.measurement_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  version integer not null check (version>0), unit text, population_ref text, date_start timestamptz, date_end timestamptz, result_ref text, check (date_end is null or date_end>date_start),
  intervention_id uuid not null,
  baseline_ref uuid,
  unique (tenant_id,intervention_id,version)
);

create table public.weekly_briefs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  unique (tenant_id,id),
  status text not null check (status in ('draft','published','failed')), version integer not null check (version>0), scope_hash text, content_ref text, week_start date,
  snapshot_id uuid not null,
  unique (tenant_id,snapshot_id,version)
);

alter table public.extraction_runs add foreign key (tenant_id,conversation_id) references public.conversations(tenant_id,id) on delete restrict;
create index on public.extraction_runs(tenant_id,conversation_id);

alter table public.extraction_runs add foreign key (tenant_id,job_id) references public.jobs(tenant_id,id) on delete restrict;
create index on public.extraction_runs(tenant_id,job_id);

alter table public.issues add foreign key (tenant_id,extraction_run_id) references public.extraction_runs(tenant_id,id) on delete restrict;
create index on public.issues(tenant_id,extraction_run_id);

alter table public.evidence_spans add foreign key (tenant_id,message_revision_id) references public.message_revisions(tenant_id,id) on delete restrict;
create index on public.evidence_spans(tenant_id,message_revision_id);

alter table public.evidence_spans add foreign key (tenant_id,issue_id) references public.issues(tenant_id,id) on delete restrict;
create index on public.evidence_spans(tenant_id,issue_id);

alter table public.embeddings add foreign key (tenant_id,message_revision_id) references public.message_revisions(tenant_id,id) on delete restrict;
create index on public.embeddings(tenant_id,message_revision_id);

alter table public.problem_versions add foreign key (tenant_id,problem_id) references public.problems(tenant_id,id) on delete restrict;
create index on public.problem_versions(tenant_id,problem_id);

alter table public.problem_versions add foreign key (tenant_id,previous_version_id) references public.problem_versions(tenant_id,id) on delete restrict;
create index on public.problem_versions(tenant_id,previous_version_id);

alter table public.problem_conversations add foreign key (tenant_id,problem_id) references public.problems(tenant_id,id) on delete restrict;
create index on public.problem_conversations(tenant_id,problem_id);

alter table public.problem_conversations add foreign key (tenant_id,conversation_id) references public.conversations(tenant_id,id) on delete restrict;
create index on public.problem_conversations(tenant_id,conversation_id);

alter table public.problem_conversations add foreign key (tenant_id,issue_id) references public.issues(tenant_id,id) on delete restrict;
create index on public.problem_conversations(tenant_id,issue_id);

alter table public.economic_events add foreign key (tenant_id,order_id) references public.orders(tenant_id,id) on delete restrict;
create index on public.economic_events(tenant_id,order_id);

alter table public.economic_events add foreign key (tenant_id,evidence_span_id) references public.evidence_spans(tenant_id,id) on delete restrict;
create index on public.economic_events(tenant_id,evidence_span_id);

alter table public.economic_events add foreign key (tenant_id,cost_rate_id) references public.cost_rates(tenant_id,id) on delete restrict;
create index on public.economic_events(tenant_id,cost_rate_id);

alter table public.economic_events add foreign key (tenant_id,assumption_id) references public.assumptions(tenant_id,id) on delete restrict;
create index on public.economic_events(tenant_id,assumption_id);

alter table public.reversals add foreign key (tenant_id,reversal_of) references public.economic_events(tenant_id,id) on delete restrict;
create index on public.reversals(tenant_id,reversal_of);

alter table public.metric_snapshots add foreign key (tenant_id,job_id) references public.jobs(tenant_id,id) on delete restrict;
create index on public.metric_snapshots(tenant_id,job_id);

alter table public.components add foreign key (tenant_id,snapshot_id) references public.metric_snapshots(tenant_id,id) on delete restrict;
create index on public.components(tenant_id,snapshot_id);

alter table public.components add foreign key (tenant_id,problem_id) references public.problems(tenant_id,id) on delete restrict;
create index on public.components(tenant_id,problem_id);

alter table public.attributions add foreign key (tenant_id,snapshot_id) references public.metric_snapshots(tenant_id,id) on delete restrict;
create index on public.attributions(tenant_id,snapshot_id);

alter table public.attributions add foreign key (tenant_id,economic_event_id) references public.economic_events(tenant_id,id) on delete restrict;
create index on public.attributions(tenant_id,economic_event_id);

alter table public.attributions add foreign key (tenant_id,component_id) references public.components(tenant_id,id) on delete restrict;
create index on public.attributions(tenant_id,component_id);
-- Keep the tenant FK above; additionally a published attribution may only
-- depend on a component protected by that same snapshot's publication lock.
alter table public.components add unique (tenant_id,snapshot_id,id);
alter table public.attributions add constraint attribution_component_snapshot_fk
 foreign key (tenant_id,snapshot_id,component_id)
 references public.components(tenant_id,snapshot_id,id) on delete restrict;
create index on public.attributions(tenant_id,snapshot_id,component_id);


alter table public.attributions add foreign key (tenant_id,problem_id) references public.problems(tenant_id,id) on delete restrict;
create index on public.attributions(tenant_id,problem_id);

alter table public.recommendations add foreign key (tenant_id,problem_id) references public.problems(tenant_id,id) on delete restrict;
create index on public.recommendations(tenant_id,problem_id);

alter table public.recommendations add foreign key (tenant_id,snapshot_id) references public.metric_snapshots(tenant_id,id) on delete restrict;
create index on public.recommendations(tenant_id,snapshot_id);

alter table public.recommendations add foreign key (tenant_id,evidence_span_id) references public.evidence_spans(tenant_id,id) on delete restrict;
create index on public.recommendations(tenant_id,evidence_span_id);

alter table public.interventions add foreign key (tenant_id,recommendation_id) references public.recommendations(tenant_id,id) on delete restrict;
create index on public.interventions(tenant_id,recommendation_id);

alter table public.interventions add foreign key (tenant_id,baseline_ref) references public.metric_snapshots(tenant_id,id) on delete restrict;
create index on public.interventions(tenant_id,baseline_ref);

alter table public.interventions add foreign key (tenant_id,measurement_ref) references public.measurement_plans(tenant_id,id) on delete restrict;
create index on public.interventions(tenant_id,measurement_ref);

alter table public.measurement_plans add foreign key (tenant_id,intervention_id) references public.interventions(tenant_id,id) on delete restrict;
create index on public.measurement_plans(tenant_id,intervention_id);

alter table public.measurement_plans add foreign key (tenant_id,baseline_ref) references public.metric_snapshots(tenant_id,id) on delete restrict;
create index on public.measurement_plans(tenant_id,baseline_ref);

alter table public.weekly_briefs add foreign key (tenant_id,snapshot_id) references public.metric_snapshots(tenant_id,id) on delete restrict;
create index on public.weekly_briefs(tenant_id,snapshot_id);

alter table public.extraction_runs enable row level security;
alter table public.extraction_runs force row level security;
revoke all on public.extraction_runs from public,anon,authenticated,service_role;
grant select on public.extraction_runs to authenticated;
grant select,insert,update,delete on public.extraction_runs to vexa_backend;
create policy member_read on public.extraction_runs for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.extraction_runs to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.extraction_runs for each row execute function public.vexa_immutable_tenant();
create index on public.extraction_runs(tenant_id,created_at,id);

alter table public.issues enable row level security;
alter table public.issues force row level security;
revoke all on public.issues from public,anon,authenticated,service_role;
grant select on public.issues to authenticated;
grant select,insert,update,delete on public.issues to vexa_backend;
create policy member_read on public.issues for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.issues to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.issues for each row execute function public.vexa_immutable_tenant();
create index on public.issues(tenant_id,created_at,id);

alter table public.evidence_spans enable row level security;
alter table public.evidence_spans force row level security;
revoke all on public.evidence_spans from public,anon,authenticated,service_role;
grant select on public.evidence_spans to authenticated;
grant select,insert,update,delete on public.evidence_spans to vexa_backend;
create policy member_read on public.evidence_spans for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.evidence_spans to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.evidence_spans for each row execute function public.vexa_immutable_tenant();
create index on public.evidence_spans(tenant_id,created_at,id);

alter table public.embeddings enable row level security;
alter table public.embeddings force row level security;
revoke all on public.embeddings from public,anon,authenticated,service_role;
grant select on public.embeddings to authenticated;
grant select,insert,update,delete on public.embeddings to vexa_backend;
create policy member_read on public.embeddings for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.embeddings to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.embeddings for each row execute function public.vexa_immutable_tenant();
create index on public.embeddings(tenant_id,created_at,id);

alter table public.problems enable row level security;
alter table public.problems force row level security;
revoke all on public.problems from public,anon,authenticated,service_role;
grant select on public.problems to authenticated;
grant select,insert,update,delete on public.problems to vexa_backend;
create policy member_read on public.problems for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.problems to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.problems for each row execute function public.vexa_immutable_tenant();
create index on public.problems(tenant_id,created_at,id);

alter table public.problem_versions enable row level security;
alter table public.problem_versions force row level security;
revoke all on public.problem_versions from public,anon,authenticated,service_role;
grant select on public.problem_versions to authenticated;
grant select,insert,update,delete on public.problem_versions to vexa_backend;
create policy member_read on public.problem_versions for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.problem_versions to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.problem_versions for each row execute function public.vexa_immutable_tenant();
create index on public.problem_versions(tenant_id,created_at,id);

alter table public.problem_conversations enable row level security;
alter table public.problem_conversations force row level security;
revoke all on public.problem_conversations from public,anon,authenticated,service_role;
grant select on public.problem_conversations to authenticated;
grant select,insert,update,delete on public.problem_conversations to vexa_backend;
create policy member_read on public.problem_conversations for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.problem_conversations to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.problem_conversations for each row execute function public.vexa_immutable_tenant();
create index on public.problem_conversations(tenant_id,created_at,id);

alter table public.economic_events enable row level security;
alter table public.economic_events force row level security;
revoke all on public.economic_events from public,anon,authenticated,service_role;
grant select on public.economic_events to authenticated;
grant select,insert,update,delete on public.economic_events to vexa_backend;
create policy member_read on public.economic_events for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.economic_events to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.economic_events for each row execute function public.vexa_immutable_tenant();
create index on public.economic_events(tenant_id,created_at,id);

alter table public.reversals enable row level security;
alter table public.reversals force row level security;
revoke all on public.reversals from public,anon,authenticated,service_role;
grant select on public.reversals to authenticated;
grant select,insert,update,delete on public.reversals to vexa_backend;
create policy member_read on public.reversals for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.reversals to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.reversals for each row execute function public.vexa_immutable_tenant();
create index on public.reversals(tenant_id,created_at,id);

alter table public.cost_rates enable row level security;
alter table public.cost_rates force row level security;
revoke all on public.cost_rates from public,anon,authenticated,service_role;
grant select on public.cost_rates to authenticated;
grant select,insert,update,delete on public.cost_rates to vexa_backend;
create policy member_read on public.cost_rates for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.cost_rates to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.cost_rates for each row execute function public.vexa_immutable_tenant();
create index on public.cost_rates(tenant_id,created_at,id);

alter table public.assumptions enable row level security;
alter table public.assumptions force row level security;
revoke all on public.assumptions from public,anon,authenticated,service_role;
grant select on public.assumptions to authenticated;
grant select,insert,update,delete on public.assumptions to vexa_backend;
create policy member_read on public.assumptions for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.assumptions to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.assumptions for each row execute function public.vexa_immutable_tenant();
create index on public.assumptions(tenant_id,created_at,id);

alter table public.metric_snapshots enable row level security;
alter table public.metric_snapshots force row level security;
revoke all on public.metric_snapshots from public,anon,authenticated,service_role;
grant select on public.metric_snapshots to authenticated;
grant select,insert,update,delete on public.metric_snapshots to vexa_backend;
create policy member_read on public.metric_snapshots for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.metric_snapshots to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.metric_snapshots for each row execute function public.vexa_immutable_tenant();
create index on public.metric_snapshots(tenant_id,created_at,id);

alter table public.components enable row level security;
alter table public.components force row level security;
revoke all on public.components from public,anon,authenticated,service_role;
grant select on public.components to authenticated;
grant select,insert,update,delete on public.components to vexa_backend;
create policy member_read on public.components for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.components to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.components for each row execute function public.vexa_immutable_tenant();
create index on public.components(tenant_id,created_at,id);

alter table public.attributions enable row level security;
alter table public.attributions force row level security;
revoke all on public.attributions from public,anon,authenticated,service_role;
grant select on public.attributions to authenticated;
grant select,insert,update,delete on public.attributions to vexa_backend;
create policy member_read on public.attributions for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.attributions to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.attributions for each row execute function public.vexa_immutable_tenant();
create index on public.attributions(tenant_id,created_at,id);

alter table public.recommendations enable row level security;
alter table public.recommendations force row level security;
revoke all on public.recommendations from public,anon,authenticated,service_role;
grant select on public.recommendations to authenticated;
grant select,insert,update,delete on public.recommendations to vexa_backend;
create policy member_read on public.recommendations for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.recommendations to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.recommendations for each row execute function public.vexa_immutable_tenant();
create index on public.recommendations(tenant_id,created_at,id);

alter table public.interventions enable row level security;
alter table public.interventions force row level security;
revoke all on public.interventions from public,anon,authenticated,service_role;
grant select on public.interventions to authenticated;
grant select,insert,update,delete on public.interventions to vexa_backend;
create policy member_read on public.interventions for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.interventions to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.interventions for each row execute function public.vexa_immutable_tenant();
create index on public.interventions(tenant_id,created_at,id);

alter table public.measurement_plans enable row level security;
alter table public.measurement_plans force row level security;
revoke all on public.measurement_plans from public,anon,authenticated,service_role;
grant select on public.measurement_plans to authenticated;
grant select,insert,update,delete on public.measurement_plans to vexa_backend;
create policy member_read on public.measurement_plans for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.measurement_plans to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.measurement_plans for each row execute function public.vexa_immutable_tenant();
create index on public.measurement_plans(tenant_id,created_at,id);

alter table public.weekly_briefs enable row level security;
alter table public.weekly_briefs force row level security;
revoke all on public.weekly_briefs from public,anon,authenticated,service_role;
grant select on public.weekly_briefs to authenticated;
grant select,insert,update,delete on public.weekly_briefs to vexa_backend;
create policy member_read on public.weekly_briefs for select to authenticated using (public.vexa_member(tenant_id));
create policy backend_scope on public.weekly_briefs to vexa_backend
 using (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check (tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create trigger immutable_tenant before update on public.weekly_briefs for each row execute function public.vexa_immutable_tenant();
create index on public.weekly_briefs(tenant_id,created_at,id);


-- Exact scan supports varying model dimensions; ANN needs a model-specific index.
create function public.match_embeddings(query_embedding extensions.vector, match_count integer, tenant_id uuid,
 model_id text default null, version text default null)
returns table(id uuid, content text, similarity double precision)
language sql stable security invoker set search_path='' as $$
 select e.id,e.content,1-(e.embedding operator(extensions.<=>) query_embedding)
 from public.embeddings e where e.tenant_id=match_embeddings.tenant_id
 and public.vexa_member(e.tenant_id)
 and e.dim=extensions.vector_dims(query_embedding)
 and (match_embeddings.model_id is null or e.model_id=match_embeddings.model_id)
 and (match_embeddings.version is null or e.version=match_embeddings.version)
 order by e.embedding operator(extensions.<=>) query_embedding,e.id
 limit greatest(0,least(coalesce(match_count,0),100))
$$;
revoke all on function public.match_embeddings(extensions.vector,integer,uuid,text,text) from public,anon;
grant execute on function public.match_embeddings(extensions.vector,integer,uuid,text,text) to authenticated,vexa_backend;

insert into storage.buckets(id,name,public) values ('vexa-private','vexa-private',false);
-- Compare text: malformed client paths cannot trigger a UUID cast failure.
create policy vexa_private_read on storage.objects for select to authenticated
 using (bucket_id='vexa-private' and exists(select 1 from public.memberships m
 where m.tenant_id::text=split_part(name,'/',1) and m.user_id=(select auth.uid()) and m.status='active'));
create policy vexa_private_upload on storage.objects for insert to authenticated
 with check (bucket_id='vexa-private' and exists(select 1 from public.memberships m
 where m.tenant_id::text=split_part(name,'/',1) and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','analyst')));
create policy vexa_private_delete on storage.objects for delete to authenticated
 using (bucket_id='vexa-private' and exists(select 1 from public.memberships m
 where m.tenant_id::text=split_part(name,'/',1) and m.user_id=(select auth.uid()) and m.status='active' and m.role='owner'));
-- No UPDATE policy: object names/tenants and uploaded bytes cannot be swapped.

create function public.vexa_snapshot_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare sid uuid; published boolean;
begin
 if tg_table_name='metric_snapshots' then
   if old.status='published' then raise exception 'published snapshot immutable' using errcode='23514'; end if;
   if tg_op='UPDATE' and new.status='published' and (new.bundle_ref is null or new.published_at is null) then
     raise exception 'publication requires bundle and time' using errcode='23514'; end if;
 else
   if tg_op<>'INSERT' then
     select s.status='published' into published from public.metric_snapshots s where s.tenant_id=old.tenant_id and s.id=old.snapshot_id for update;
     if not found or published is null then raise exception 'snapshot unavailable' using errcode='23503'; end if;
     if published then raise exception 'published component immutable' using errcode='23514'; end if;
   end if;
   if tg_op<>'DELETE' then
     select s.status='published' into published from public.metric_snapshots s where s.tenant_id=new.tenant_id and s.id=new.snapshot_id for update;
     if not found or published is null then raise exception 'snapshot unavailable' using errcode='23503'; end if;
     if published then raise exception 'published component immutable' using errcode='23514'; end if;
   end if;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function public.vexa_snapshot_guard() from public,anon,authenticated;
create trigger snapshot_guard before update or delete on public.metric_snapshots for each row execute function public.vexa_snapshot_guard();
create trigger component_guard before insert or update or delete on public.components for each row execute function public.vexa_snapshot_guard();
create trigger attribution_guard before insert or update or delete on public.attributions for each row execute function public.vexa_snapshot_guard();


-- Backend capabilities are transaction-local, selected by trusted repositories after
-- Auth validation. A permitted action cannot write unrelated domain tables.
create function public.vexa_backend_action(p_tenant uuid, p_actions text[])
returns boolean language sql stable security invoker set search_path='' as $$
 select current_setting('vexa.action',true)=any(p_actions)
 and public.vexa_member(p_tenant,case current_setting('vexa.action',true)
   when 'import' then array['owner','analyst']
   when 'propose' then array['owner','analyst','operator']
   when 'execute' then array['owner','operator']
   else array['owner'] end)
$$;
revoke all on function public.vexa_backend_action(uuid,text[]) from public,anon,authenticated;
grant execute on function public.vexa_backend_action(uuid,text[]) to vexa_backend;
create policy backend_insert_capability on public.connections as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['configure']));
create policy backend_update_capability on public.connections as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['configure'])) with check (public.vexa_backend_action(tenant_id,array['configure']));
create policy backend_delete_capability on public.connections as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.external_aliases as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['configure']));
create policy backend_update_capability on public.external_aliases as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['configure'])) with check (public.vexa_backend_action(tenant_id,array['configure']));
create policy backend_delete_capability on public.external_aliases as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.cost_rates as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['configure']));
create policy backend_update_capability on public.cost_rates as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['configure'])) with check (public.vexa_backend_action(tenant_id,array['configure']));
create policy backend_delete_capability on public.cost_rates as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.assumptions as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['configure']));
create policy backend_update_capability on public.assumptions as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['configure'])) with check (public.vexa_backend_action(tenant_id,array['configure']));
create policy backend_delete_capability on public.assumptions as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.imports as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.imports as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.imports as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.import_rows as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.import_rows as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.import_rows as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.customers as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.customers as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.customers as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.products as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.products as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.products as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.orders as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.orders as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.orders as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.order_lines as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.order_lines as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.order_lines as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.conversations as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.conversations as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.conversations as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.messages as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.messages as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.messages as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.message_revisions as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.message_revisions as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.message_revisions as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.jobs as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.jobs as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.jobs as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.attempts as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.attempts as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.attempts as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.checkpoints as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.checkpoints as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.checkpoints as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.outbox as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.outbox as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.outbox as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.dead_letters as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.dead_letters as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.dead_letters as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.extraction_runs as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.extraction_runs as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.extraction_runs as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.issues as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.issues as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.issues as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.evidence_spans as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.evidence_spans as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.evidence_spans as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.embeddings as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.embeddings as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.embeddings as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.problems as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.problems as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.problems as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.problem_versions as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.problem_versions as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.problem_versions as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.problem_conversations as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.problem_conversations as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.problem_conversations as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.economic_events as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.economic_events as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.economic_events as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.reversals as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.reversals as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.reversals as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.metric_snapshots as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
-- Row locking also evaluates UPDATE USING: retain may lock but WITH CHECK
-- still forbids every actual UPDATE. Missing/hidden parents fail closed above.
create policy backend_update_capability on public.metric_snapshots as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import','retain'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.metric_snapshots as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.components as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.components as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.components as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.attributions as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.attributions as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.attributions as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.weekly_briefs as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_update_capability on public.weekly_briefs as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['import'])) with check (public.vexa_backend_action(tenant_id,array['import']));
create policy backend_delete_capability on public.weekly_briefs as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.interventions as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['propose','approve','execute']));
create policy backend_update_capability on public.interventions as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['propose','approve','execute','retain'])) with check (public.vexa_backend_action(tenant_id,array['propose','approve','execute']));
create policy backend_delete_capability on public.interventions as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.measurement_plans as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['propose','approve','execute']));
create policy backend_update_capability on public.measurement_plans as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['propose','approve','execute'])) with check (public.vexa_backend_action(tenant_id,array['propose','approve','execute']));
create policy backend_delete_capability on public.measurement_plans as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.recommendations as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['propose','approve']));
create policy backend_update_capability on public.recommendations as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['propose','approve','execute'])) with check (public.vexa_backend_action(tenant_id,array['propose','approve']));
create policy backend_delete_capability on public.recommendations as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.tombstones as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_update_capability on public.tombstones as restrictive for update to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain'])) with check (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_delete_capability on public.tombstones as restrictive for delete to vexa_backend using (public.vexa_backend_action(tenant_id,array['retain']));
create policy backend_insert_capability on public.audit_events as restrictive for insert to vexa_backend with check (public.vexa_backend_action(tenant_id,array['import','configure','propose','approve','execute','retain']));
revoke update,delete on public.audit_events from vexa_backend;

-- Compare OLD and NEW under the row lock held by UPDATE. RLS alone cannot
-- distinguish an approved predecessor from a draft that ends up active.
-- Freeze a referenced recommendation under its own row lock before approving.
-- Later versions must be new rows; even an owner cannot silently rewrite history.
create function public.vexa_recommendation_definition_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and old.approval_bound and
    (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then
   raise exception 'approved recommendation immutable' using errcode='23514';
 end if;
 if tg_op='INSERT' and new.approval_bound then
   raise exception 'recommendation must start unbound' using errcode='23514';
 end if;
 if tg_op='UPDATE' and new.approval_bound is distinct from old.approval_bound and
    (current_setting('vexa.action',true) is distinct from 'approve' or not public.vexa_member(new.tenant_id,array['owner'])) then
   raise exception 'only approval can bind recommendation' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.vexa_recommendation_definition_guard() from public,anon,authenticated;
create trigger recommendation_definition_guard before insert or update on public.recommendations
 for each row execute function public.vexa_recommendation_definition_guard();

-- The database owns the approval receipt. Entire definition rows are bound, with
-- an explicit allowlist of operational fields; new definition columns fail closed.
create function public.vexa_approval_content(i public.interventions) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.recommendations; p public.measurement_plans; plans jsonb := '[]'; sid uuid;
begin
 select * into r from public.recommendations where tenant_id=i.tenant_id and id=i.recommendation_id for share;
 if not found then raise exception 'recommendation unavailable' using errcode='23514'; end if;
 for p in select * from public.measurement_plans where tenant_id=i.tenant_id and intervention_id=i.id order by id for share loop
   plans := plans || jsonb_build_array(to_jsonb(p)-array['updated_at','result_ref']);
 end loop;
 if i.measurement_ref is not null and not exists (
   select 1 from public.measurement_plans where tenant_id=i.tenant_id and id=i.measurement_ref and intervention_id=i.id
 ) then raise exception 'measurement belongs to another intervention' using errcode='23514'; end if;
 -- Baselines are immutable published bundles, never mutable draft references.
 for sid in select i.baseline_ref union select r.snapshot_id union
   select baseline_ref from public.measurement_plans where tenant_id=i.tenant_id and intervention_id=i.id loop
   if sid is not null and not exists(select 1 from public.metric_snapshots where tenant_id=i.tenant_id and id=sid and status='published') then
     raise exception 'approval requires published baseline' using errcode='23514';
   end if;
 end loop;
 return jsonb_build_object('intervention',to_jsonb(i)-array['status','version','reason','updated_at','approval_content'],
   'recommendation',to_jsonb(r)-array['updated_at'],'plans',plans);
end $$;
revoke all on function public.vexa_approval_content(public.interventions) from public,anon,authenticated;
grant execute on function public.vexa_approval_content(public.interventions) to vexa_backend;

create function public.vexa_intervention_transition() returns trigger
language plpgsql security invoker set search_path='' as $$
declare action text := current_setting('vexa.action',true);
begin
 if tg_op='INSERT' then
   if new.status<>'draft' or new.approval_content is not null then
     raise exception 'interventions must start draft' using errcode='23514';
   end if;
 else
   if new.approval_content is distinct from old.approval_content then
     raise exception 'approval receipt is database owned' using errcode='23514';
   end if;
   -- CAS bookkeeping is not approved content. If touched after draft it must
   -- accompany a state transition and advance exactly one; content checks below
   -- still apply independently of the counter. Legacy status-only writes remain
   -- compatible; the service enforces expected_version and always increments.
   if old.status<>'draft' and (new.version,new.reason) is distinct from (old.version,old.reason) and
      (new.status is not distinct from old.status or new.version<>old.version+1) then
     raise exception 'operational change requires transition and next version' using errcode='23514';
   end if;
   if action='approve' and public.vexa_member(new.tenant_id,array['owner']) and new.status='approved' then
     update public.recommendations set approval_bound=true where tenant_id=new.tenant_id and id=new.recommendation_id;
     if not found then raise exception 'recommendation unavailable' using errcode='23514'; end if;
     new.approval_content := public.vexa_approval_content(new);
   elsif old.status<>'draft' then
     if (to_jsonb(new)-array['status','version','reason','updated_at']) is distinct from (to_jsonb(old)-array['status','version','reason','updated_at']) then
       raise exception 'approved definition immutable without reapproval' using errcode='23514';
     end if;
     if action='execute' and (old.approval_content is null or old.approval_content is distinct from public.vexa_approval_content(new)) then
       raise exception 'approved content changed; reapproval required' using errcode='23514';
     end if;
   end if;
 end if;
 if tg_op='UPDATE' and new.status is distinct from old.status then
   if action='approve' and public.vexa_member(new.tenant_id,array['owner']) and
      ((old.status='draft' and new.status='approved') or
       (old.status in ('draft','approved','active','measuring') and new.status='cancelled')) then
     return new;
   end if;
   if action='execute' and public.vexa_member(new.tenant_id,array['owner','operator']) and
      (public.vexa_member(new.tenant_id,array['owner']) or old.owner_id=(select auth.uid())) and
      ((old.status='approved' and new.status='active') or
       (old.status='active' and new.status='measuring') or
       (old.status='measuring' and new.status='closed')) then
     return new;
   end if;
   raise exception 'invalid intervention transition' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.vexa_intervention_transition() from public,anon,authenticated;
create trigger intervention_transition before insert or update on public.interventions
 for each row execute function public.vexa_intervention_transition();

-- Proposal permission cannot approve an intervention or claim someone else's execution.
create policy backend_intervention_state on public.interventions as restrictive for all to vexa_backend
 using ((current_setting('vexa.action',true)<>'execute' or public.vexa_member(tenant_id,array['owner']) or owner_id=(select auth.uid())) and (current_setting('vexa.action',true)<>'propose' or status='draft'))
 with check ((current_setting('vexa.action',true)<>'propose' or status='draft')
 and (current_setting('vexa.action',true)<>'execute' or ((public.vexa_member(tenant_id,array['owner']) or owner_id=(select auth.uid())) and status in ('active','measuring','closed'))));
create policy backend_measurement_assignment on public.measurement_plans as restrictive for all to vexa_backend
 using (current_setting('vexa.action',true)<>'execute' or public.vexa_member(tenant_id,array['owner']) or exists(select 1 from public.interventions i where i.tenant_id=measurement_plans.tenant_id and i.id=measurement_plans.intervention_id and i.owner_id=(select auth.uid())))
 with check (current_setting('vexa.action',true)<>'execute' or public.vexa_member(tenant_id,array['owner']) or exists(select 1 from public.interventions i where i.tenant_id=measurement_plans.tenant_id and i.id=measurement_plans.intervention_id and i.owner_id=(select auth.uid())));

create policy backend_recommendation_state on public.recommendations as restrictive for all to vexa_backend
 using (current_setting('vexa.action',true)<>'propose' or status in ('draft','proposed'))
 with check (current_setting('vexa.action',true)<>'propose' or status in ('draft','proposed'));
-- Every plan write locks the parent, including INSERT (prevents phantom plans
-- racing approval). RLS-hidden/unassigned parents fail closed. Only measured
-- result_ref and bookkeeping timestamp may change after approval.
create function public.vexa_plan_definition_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare i public.interventions; tid uuid; iid uuid;
begin
 if tg_op='DELETE' then tid:=old.tenant_id; iid:=old.intervention_id;
 else tid:=new.tenant_id; iid:=new.intervention_id; end if;
 if tg_op='UPDATE' and (new.intervention_id,new.tenant_id) is distinct from (old.intervention_id,old.tenant_id) then
   raise exception 'plan parent immutable' using errcode='23514';
 end if;
 select * into i from public.interventions where tenant_id=tid and id=iid for update;
 if not found then raise exception 'intervention unavailable' using errcode='23514'; end if;
 if i.status<>'draft' then
   if tg_op<>'UPDATE' then raise exception 'approved plan set immutable' using errcode='23514'; end if;
   if (to_jsonb(new)-array['updated_at','result_ref']) is distinct from (to_jsonb(old)-array['updated_at','result_ref']) then
     raise exception 'approved plan definition immutable' using errcode='23514';
   end if;
 end if;
 if tg_op='UPDATE' and new.result_ref is distinct from old.result_ref then
   if current_setting('vexa.action',true) is distinct from 'execute' or i.status not in ('active','measuring') or
      i.approval_content is null or i.approval_content is distinct from public.vexa_approval_content(i) then
     raise exception 'measurement requires execution of approved content' using errcode='23514';
   end if;
 elsif tg_op='INSERT' and new.result_ref is not null then
   raise exception 'cannot insert measured result' using errcode='23514';
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function public.vexa_plan_definition_guard() from public,anon,authenticated;
create trigger plan_definition_guard before insert or update or delete on public.measurement_plans
 for each row execute function public.vexa_plan_definition_guard();

alter table public.economic_events add constraint unknown_amount_is_null check (status<>'unknown' or amount_minor is null);
create index orders_occurred on public.orders(tenant_id,occurred_at,id);
create index messages_occurred on public.messages(tenant_id,occurred_at,id);
create index economic_events_effective on public.economic_events(tenant_id,effective_at,id);
create unique index attempts_sequence on public.attempts(tenant_id,job_id,attempt_number);
commit;
