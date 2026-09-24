begin;
create table public.history_batches (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.organizations(id),owner_id uuid not null,connection_id uuid not null,request_key uuid not null,
 extraction_hash text not null check(extraction_hash ~ '^[a-f0-9]{64}$'),embedding_hash text not null check(embedding_hash ~ '^[a-f0-9]{64}$'),
 consent_at timestamptz not null default clock_timestamp(),cutoff timestamptz not null default clock_timestamp(),cursor uuid,enumerated boolean not null default false,
 state text not null default 'active' check(state in ('active','paused','cancelled','completed')),reason text,version integer not null default 1,
 last_tick timestamptz,created_at timestamptz not null default clock_timestamp(),unique(tenant_id,id),unique(tenant_id,owner_id,request_key),
 foreign key(tenant_id,owner_id) references public.memberships(tenant_id,user_id),foreign key(tenant_id,connection_id) references public.connections(tenant_id,id)
);
create table public.history_items (
 tenant_id uuid not null,batch_id uuid not null,conversation_id uuid not null,extraction_job uuid,embedding_job uuid,
 state text not null default 'pending' check(state in ('pending','extracting','grouping','completed','skipped','failed')),reason text,last_checked timestamptz,
 primary key(tenant_id,batch_id,conversation_id),foreign key(tenant_id,batch_id) references public.history_batches(tenant_id,id),foreign key(tenant_id,conversation_id) references public.conversations(tenant_id,id),
 foreign key(tenant_id,extraction_job) references public.jobs(tenant_id,id),foreign key(tenant_id,embedding_job) references public.jobs(tenant_id,id),unique(extraction_job),unique(embedding_job)
);
create function public.history_worker(p_tenant uuid) returns boolean language sql security definer set search_path='' as $$
 select p_tenant=nullif(current_setting('vexa.tenant_id',true),'')::uuid and current_setting('vexa.action',true) in ('read','import') and exists(select 1 from public.memberships m join public.worker_delegations d on d.tenant_id=m.tenant_id and d.user_id=m.user_id where m.tenant_id=p_tenant and m.user_id=auth.uid() and m.status='active' and m.role='analyst' and d.enabled)
$$;
create function public.history_batch_authorized(p_batch uuid) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.history_batches b join public.memberships m on m.tenant_id=b.tenant_id and m.user_id=b.owner_id join public.connections c on c.tenant_id=b.tenant_id and c.id=b.connection_id where b.id=p_batch and b.tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and b.state='active' and m.status='active' and m.role='owner' and c.status='active')
$$;
revoke all on function public.history_batch_authorized(uuid) from public,anon,authenticated,service_role;
grant execute on function public.history_batch_authorized(uuid) to vexa_backend;
create function public.history_child_authorized(p_job uuid) returns boolean language sql security definer set search_path='' as $$
 select not exists(select 1 from public.history_items i where i.extraction_job=p_job or i.embedding_job=p_job)
 or exists(select 1 from public.history_items i join public.history_batches b on b.tenant_id=i.tenant_id and b.id=i.batch_id join public.memberships m on m.tenant_id=b.tenant_id and m.user_id=b.owner_id join public.connections c on c.tenant_id=b.tenant_id and c.id=b.connection_id where (i.extraction_job=p_job or i.embedding_job=p_job) and b.tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and b.state='active' and m.status='active' and m.role='owner' and c.status='active')
$$;
alter table public.history_batches enable row level security;alter table public.history_batches force row level security;
alter table public.history_items enable row level security;alter table public.history_items force row level security;
revoke all on public.history_batches,public.history_items from public,anon,authenticated,service_role,vexa_backend;
grant select,insert,update on public.history_batches,public.history_items to vexa_backend;
create policy history_batch_read on public.history_batches for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (public.vexa_member(tenant_id,array['owner']) or public.history_worker(tenant_id)));
create policy history_batch_insert on public.history_batches for insert to vexa_backend with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and owner_id=auth.uid() and public.vexa_member(tenant_id,array['owner']) and public.vexa_backend_action(tenant_id,array['import']));
create policy history_batch_update on public.history_batches for update to vexa_backend using(current_setting('vexa.action',true)='import' and tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (public.vexa_member(tenant_id,array['owner']) or public.history_worker(tenant_id))) with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (public.vexa_member(tenant_id,array['owner']) or public.history_worker(tenant_id)));
create policy history_items_read on public.history_items for select to vexa_backend using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and (public.vexa_member(tenant_id,array['owner']) or public.history_worker(tenant_id)));
create policy history_items_write on public.history_items for all to vexa_backend using(current_setting('vexa.action',true)='import' and public.history_worker(tenant_id)) with check(current_setting('vexa.action',true)='import' and public.history_worker(tenant_id));
create function public.history_batch_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='UPDATE' and (to_jsonb(new)-array['cursor','enumerated','state','reason','version','last_tick']) is distinct from (to_jsonb(old)-array['cursor','enumerated','state','reason','version','last_tick']) then raise insufficient_privilege;end if;
 if tg_op='UPDATE' and old.state='paused' and new.state='active' and not (old.owner_id=auth.uid() and public.vexa_member(old.tenant_id,array['owner'])) then raise insufficient_privilege;end if;
 if tg_op='UPDATE' and old.state in ('cancelled','completed') and new is distinct from old then raise insufficient_privilege;end if;
 if tg_op='INSERT' and (new.state<>'active' or new.cursor is not null or new.enumerated or new.version<>1) then raise check_violation;end if;
 return new;end $$;
create trigger history_batch_guard before insert or update on public.history_batches for each row execute function public.history_batch_guard();
create function public.reserve_history_scope() returns uuid language plpgsql security definer set search_path='' as $$ declare chosen uuid;begin
 if auth.uid() is null or current_setting('vexa.action',true) is distinct from 'worker_dispatch' then raise insufficient_privilege;end if;
 select d.tenant_id into chosen from public.worker_delegations d join public.memberships m on m.tenant_id=d.tenant_id and m.user_id=d.user_id where d.user_id=auth.uid() and d.enabled and m.status='active' and m.role='analyst' and exists(select 1 from public.history_batches b where b.tenant_id=d.tenant_id and b.state='active') order by d.extraction_last_dispatched_at nulls first,d.tenant_id limit 1 for update of d skip locked;
 if chosen is not null then update public.worker_delegations set extraction_last_dispatched_at=clock_timestamp() where tenant_id=chosen and user_id=auth.uid();end if;return chosen;end $$;
revoke all on function public.history_worker(uuid),public.history_child_authorized(uuid),public.reserve_history_scope(),public.history_batch_guard() from public,anon,authenticated,service_role;
grant execute on function public.history_worker(uuid),public.history_child_authorized(uuid),public.reserve_history_scope() to vexa_backend;

create function public.history_request_key(p_batch uuid,p_source uuid,p_config text,p_purpose text) returns uuid language sql immutable set search_path='' as $$
 select substring(encode(sha256(convert_to(p_batch::text||':'||p_source::text||':'||p_config||':'||p_purpose,'UTF8')),'hex'),1,32)::uuid
$$;
revoke all on function public.history_request_key(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.history_request_key(uuid,uuid,text,text) to vexa_backend;
create function public.history_item_guard() returns trigger language plpgsql set search_path='' as $$ declare b public.history_batches;begin
 select * into b from public.history_batches where tenant_id=new.tenant_id and id=new.batch_id;
 if not public.history_worker(new.tenant_id) or not public.history_batch_authorized(new.batch_id) then raise insufficient_privilege;end if;
 if tg_op='INSERT' and (new.state<>'pending' or new.extraction_job is not null or new.embedding_job is not null) then raise check_violation;end if;
 if tg_op='UPDATE' and (new.tenant_id,new.batch_id,new.conversation_id) is distinct from (old.tenant_id,old.batch_id,old.conversation_id) then raise insufficient_privilege;end if;
 if tg_op='UPDATE' and ((old.extraction_job is not null and new.extraction_job is distinct from old.extraction_job) or (old.embedding_job is not null and new.embedding_job is distinct from old.embedding_job)) then raise insufficient_privilege;end if;
 if not exists(select 1 from public.conversations c where c.tenant_id=new.tenant_id and c.id=new.conversation_id and c.connection_id=b.connection_id) then raise check_violation;end if;
 if new.extraction_job is not null and not exists(select 1 from public.extraction_requests r where r.tenant_id=new.tenant_id and r.job_id=new.extraction_job and r.conversation_id=new.conversation_id and r.config_hash=b.extraction_hash and r.request_key=public.history_request_key(b.id,new.conversation_id,b.extraction_hash,'extraction') and (tg_op='UPDATE' and old.extraction_job is not null or r.actor_id=auth.uid())) then raise check_violation;end if;
 if new.embedding_job is not null and not exists(select 1 from public.problem_embedding_requests r join public.extraction_runs e on e.tenant_id=r.tenant_id and e.id=r.extraction_run_id where r.tenant_id=new.tenant_id and r.job_id=new.embedding_job and e.job_id=new.extraction_job and r.config_hash=b.embedding_hash and r.request_key=public.history_request_key(b.id,new.conversation_id,b.embedding_hash,'embedding') and (tg_op='UPDATE' and old.embedding_job is not null or r.actor_id=auth.uid())) then raise check_violation;end if;
 return new;end $$;
create trigger history_item_guard before insert or update on public.history_items for each row execute function public.history_item_guard();
revoke all on function public.history_item_guard() from public,anon,authenticated,service_role;
-- Existing authority is preserved, with an additional batch-only condition.
create or replace function public.extraction_actor_authorized(p_job uuid) returns boolean
language sql security definer set search_path='' as $$
 select public.history_child_authorized(p_job) and current_setting('vexa.action',true)='import' and exists(
 select 1 from public.extraction_requests r
 join public.memberships original on original.tenant_id=r.tenant_id and original.user_id=r.actor_id
 join public.memberships bot on bot.tenant_id=r.tenant_id and bot.user_id=auth.uid()
 join public.worker_delegations d on d.tenant_id=bot.tenant_id and d.user_id=bot.user_id
 where r.job_id=p_job and r.tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid
 and original.status='active' and original.role in ('owner','analyst')
 and bot.status='active' and bot.role='analyst' and d.enabled)
$$;

-- Existing authority is preserved, with an additional batch-only condition.
create or replace function public.problem_actor_authorized(p_job uuid) returns boolean language sql security definer set search_path='' as $$
 select public.history_child_authorized(p_job) and current_setting('vexa.action',true)='import' and exists(select 1 from public.problem_embedding_requests r
 join public.jobs j on j.tenant_id=r.tenant_id and j.id=r.job_id
 join public.memberships a on a.tenant_id=r.tenant_id and a.user_id=r.actor_id
 join public.memberships b on b.tenant_id=r.tenant_id and b.user_id=auth.uid()
 join public.worker_delegations d on d.tenant_id=b.tenant_id and d.user_id=b.user_id
 where r.job_id=p_job and r.tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and j.type='embedding' and j.cancel_requested_at is null
 and a.status='active' and a.role in ('owner','analyst') and b.status='active' and b.role='analyst' and d.enabled)
$$;
commit;
