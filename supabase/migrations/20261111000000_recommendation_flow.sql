-- 20261111000000_recommendation_flow (APLICADA en producción): flujo de aprobación con humano al mando (Proceder / Ajustar / seguimiento / resultado manual).
-- Tabla de eventos de solo-inserción por recomendación: approved (responsable + fecha + intervención borrador), adjusted (prioridad y comentario del responsable),
-- started (en curso) y resolved (resultado manual sí/no/parcial + nota + comparación antes/después SOLO si hubo dato observado). Nada se ejecuta solo.
-- Lo aprobado es inmutable: una vez existe un evento 'approved', la recomendación no se puede revisar ni cambiar de estado (trigger).
-- Reversa: packages/workspace-service/tests/20261111000000_recommendation_flow.down.sql.
begin;
set local lock_timeout='3s';
create table public.recommendation_flow_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,recommendation_id uuid not null,
 recommendation_version integer not null check(recommendation_version>0),
 kind text not null check(kind in ('approved','adjusted','started','resolved')),
 actor_id uuid not null,owner_id uuid,due_date date,
 priority text check(priority in ('critical','high','normal')),
 outcome text check(outcome in ('yes','no','partial')),
 note text check(note is null or length(btrim(note)) between 20 and 2000),
 comment text check(comment is null or length(btrim(comment)) between 1 and 2000),
 intervention_id uuid,
 comparison jsonb check(comparison is null or jsonb_typeof(comparison)='object'),
 idempotency_key text not null check(length(idempotency_key) between 1 and 160),
 created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,id),unique(tenant_id,idempotency_key),
 foreign key(tenant_id) references public.organizations(id) on delete restrict,
 foreign key(tenant_id,recommendation_id) references public.recommendations(tenant_id,id) on delete restrict,
 foreign key(tenant_id,actor_id) references public.memberships(tenant_id,user_id) on delete restrict,
 foreign key(tenant_id,owner_id) references public.memberships(tenant_id,user_id) on delete restrict,
 foreign key(tenant_id,intervention_id) references public.interventions(tenant_id,id) on delete restrict,
 check(kind<>'approved' or (owner_id is not null and due_date is not null and intervention_id is not null)),
 check(kind='approved' or due_date is null),
 check(kind<>'adjusted' or (comment is not null and length(btrim(comment)) between 20 and 2000)),
 check(kind<>'resolved' or (outcome is not null and note is not null)),
 check(kind='resolved' or (outcome is null and comparison is null and note is null))
);
create index recommendation_flow_events_rec on public.recommendation_flow_events(tenant_id,recommendation_id,created_at);
alter table public.recommendation_flow_events enable row level security;alter table public.recommendation_flow_events force row level security;
revoke all on public.recommendation_flow_events from public,anon,authenticated,service_role,vexa_backend;grant select,insert on public.recommendation_flow_events to vexa_backend;
create policy recommendation_flow_read on public.recommendation_flow_events for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id));
create policy recommendation_flow_write on public.recommendation_flow_events for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and actor_id=auth.uid() and current_setting('vexa.action',true)='propose' and public.vexa_member(tenant_id,array['owner','analyst','operator']));
create function public.recommendation_flow_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.recommendations;i public.interventions;
begin
 if tg_op<>'INSERT' then raise insufficient_privilege;end if;
 select * into r from public.recommendations where tenant_id=new.tenant_id and id=new.recommendation_id for share;
 if r.id is null or r.recommendation_schema is distinct from 'recommendation-v1' or r.status<>'proposed' or r.version is distinct from new.recommendation_version then raise check_violation;end if;
 if new.kind='adjusted' then
  if exists(select 1 from public.recommendation_flow_events e where e.tenant_id=new.tenant_id and e.recommendation_id=new.recommendation_id and e.kind='approved') then raise check_violation;end if;
 elsif new.kind='approved' then
  if exists(select 1 from public.recommendation_flow_events e where e.tenant_id=new.tenant_id and e.recommendation_id=new.recommendation_id and e.kind='approved') then raise check_violation;end if;
  select * into i from public.interventions where tenant_id=new.tenant_id and id=new.intervention_id;
  if i.id is null or i.recommendation_id<>r.id or i.provenance->>'kind' is distinct from 'recommendation-draft-v1' or r.owner_id is distinct from new.owner_id or not public.recommendation_member_active(new.tenant_id,new.owner_id) then raise check_violation;end if;
 elsif new.kind='started' then
  if not exists(select 1 from public.recommendation_flow_events e where e.tenant_id=new.tenant_id and e.recommendation_id=new.recommendation_id and e.kind='approved') or exists(select 1 from public.recommendation_flow_events e where e.tenant_id=new.tenant_id and e.recommendation_id=new.recommendation_id and e.kind in ('started','resolved')) then raise check_violation;end if;
 elsif new.kind='resolved' then
  if not exists(select 1 from public.recommendation_flow_events e where e.tenant_id=new.tenant_id and e.recommendation_id=new.recommendation_id and e.kind='approved') or exists(select 1 from public.recommendation_flow_events e where e.tenant_id=new.tenant_id and e.recommendation_id=new.recommendation_id and e.kind='resolved') then raise check_violation;end if;
 end if;
 new.created_at=clock_timestamp();return new;
end $$;
revoke all on function public.recommendation_flow_guard() from public,anon,authenticated,service_role;
create trigger recommendation_flow_guard before insert or update or delete on public.recommendation_flow_events for each row execute function public.recommendation_flow_guard();
-- Lo aprobado es inmutable: tras 'approved' no se revisa ni se cambia el estado de la recomendación.
create function public.recommendation_flow_approved_immutable() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.recommendation_schema='recommendation-v1' and exists(select 1 from public.recommendation_flow_events e where e.tenant_id=old.tenant_id and e.recommendation_id=old.id and e.kind='approved') then raise insufficient_privilege;end if;
 return new;
end $$;
revoke all on function public.recommendation_flow_approved_immutable() from public,anon,authenticated,service_role;
create trigger recommendation_flow_approved_immutable before update on public.recommendations for each row execute function public.recommendation_flow_approved_immutable();
commit;
