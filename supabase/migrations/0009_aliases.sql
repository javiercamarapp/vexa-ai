begin;
-- Additive event history on the existing alias store. Legacy rows are not fabricated approvals.
alter table public.external_aliases add column source_conversation_id uuid;
alter table public.external_aliases add column operation text check(operation in ('confirm','undo'));
alter table public.external_aliases add column previous_version integer check(previous_version>=0);
alter table public.external_aliases add column reason text;
alter table public.external_aliases add foreign key(tenant_id,source_conversation_id) references public.conversations(tenant_id,id) on delete restrict;
create index on public.external_aliases(tenant_id,source_conversation_id,version desc);

create function public.vexa_alias_event() returns trigger language plpgsql security invoker set search_path='' as $$
declare
 src public.conversations; dst public.conversations; sc public.connections; dc public.connections;
 prev public.external_aliases; total integer; walking uuid; next_id uuid; seen uuid[];
begin
 if tg_op <> 'INSERT' then raise exception 'alias history is append only' using errcode='23514'; end if;
 -- Graph checks after the advisory lock must observe preceding committed edges.
 if current_setting('transaction_isolation') <> 'read committed' then
  raise exception 'alias writes require read committed isolation' using errcode='23514';
 end if;
 if not public.vexa_backend_action(new.tenant_id,array['configure']) or not public.vexa_member(new.tenant_id,array['owner'])
 or new.tenant_id is distinct from nullif(current_setting('vexa.tenant_id',true),'')::uuid
 or auth.uid() is null or new.approved_by is distinct from auth.uid()
 then raise exception 'alias owner approval required' using errcode='42501'; end if;
 if new.operation is null or new.source_conversation_id is null or new.previous_version is null
 or new.evidence_ref is null or length(btrim(new.evidence_ref))=0 or length(new.evidence_ref)>2000
 or new.reason is null or length(btrim(new.reason))=0 or length(new.reason)>1000
 then raise exception 'alias evidence required' using errcode='23514'; end if;
 -- Serialize the whole tenant graph: independent edges can otherwise form a concurrent cycle.
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':aliases',0));
 select * into src from public.conversations where tenant_id=new.tenant_id and id=new.source_conversation_id;
 select * into dst from public.conversations where tenant_id=new.tenant_id and id=new.canonical_id;
 if src.id is null or dst.id is null then raise exception 'alias source or destination absent' using errcode='23503'; end if;
 select * into sc from public.connections where tenant_id=new.tenant_id and id=src.connection_id for share;
 select * into dc from public.connections where tenant_id=new.tenant_id and id=dst.connection_id for share;
 if src.entity_type<>'conversation' or dst.entity_type<>'conversation'
 or (new.source,new.account_id,new.entity_type,new.external_id) is distinct from (src.source,sc.account_id,src.entity_type,src.external_id)
 or sc.source is distinct from src.source or dc.source is distinct from dst.source
 or src.provenance->>'source' is distinct from sc.source or src.provenance->>'account_id' is distinct from sc.account_id
 or dst.provenance->>'source' is distinct from dc.source or dst.provenance->>'account_id' is distinct from dc.account_id
 or exists(select 1 from public.source_revisions r where r.tenant_id=new.tenant_id and r.connection_id in (src.connection_id,dst.connection_id)
   and ((r.provenance->>'source') is distinct from case when r.connection_id=src.connection_id then sc.source else dc.source end
     or (r.provenance->>'account_id') is distinct from case when r.connection_id=src.connection_id then sc.account_id else dc.account_id end))
 then raise exception 'alias source identity mismatch' using errcode='23514'; end if;
 if exists(select 1 from public.source_heads h where h.tenant_id=new.tenant_id and h.id in (src.id,dst.id) and h.state='ambiguous')
 or (select count(*) from public.conversations c where c.tenant_id=new.tenant_id and c.connection_id=src.connection_id and c.entity_type=src.entity_type and c.external_id=src.external_id)<>1
 or (select count(*) from public.conversations c where c.tenant_id=new.tenant_id and c.connection_id=dst.connection_id and c.entity_type=dst.entity_type and c.external_id=dst.external_id)<>1
 then raise exception 'alias identity ambiguous' using errcode='23514'; end if;
 select * into prev from public.external_aliases a where (a.tenant_id,a.source,a.account_id,a.entity_type,a.external_id)=(new.tenant_id,new.source,new.account_id,new.entity_type,new.external_id) order by version desc limit 1;
 if new.previous_version<>coalesce(prev.version,0) or new.version<>coalesce(prev.version,0)+1
 then raise exception 'alias version conflict' using errcode='40001'; end if;
 if prev.operation is not null and prev.source_conversation_id<>src.id then raise exception 'alias identity changed' using errcode='23514'; end if;
 if new.operation='undo' then
  if prev.operation is distinct from 'confirm' or new.canonical_id<>src.id then raise exception 'alias undo requires current confirmation' using errcode='23514'; end if;
 else
  if src.id=dst.id or prev.operation='confirm' then raise exception 'alias confirmation conflicts' using errcode='23514'; end if;
  walking:=dst.id; seen:=array[src.id];
  loop
   if walking=any(seen) then raise exception 'alias cycle' using errcode='23514'; end if;
   seen:=array_append(seen,walking);
   -- A legacy destination cannot silently become authority. Resolve it with fresh evidence first.
   if exists(select 1 from public.external_aliases a join public.conversations c on c.tenant_id=a.tenant_id and c.id=walking
     join public.connections x on x.tenant_id=c.tenant_id and x.id=c.connection_id
     where a.tenant_id=new.tenant_id and a.source=c.source and a.account_id=x.account_id and a.entity_type=c.entity_type and a.external_id=c.external_id
     and a.version=(select max(b.version) from public.external_aliases b where (b.tenant_id,b.source,b.account_id,b.entity_type,b.external_id)=(a.tenant_id,a.source,a.account_id,a.entity_type,a.external_id)) and a.operation is null)
   then raise exception 'legacy alias unresolved' using errcode='23514'; end if;
   select a.canonical_id into next_id from public.external_aliases a where a.tenant_id=new.tenant_id and a.source_conversation_id=walking
    and a.operation='confirm' and a.version=(select max(b.version) from public.external_aliases b where (b.tenant_id,b.source,b.account_id,b.entity_type,b.external_id)=(a.tenant_id,a.source,a.account_id,a.entity_type,a.external_id));
   exit when next_id is null;
   walking:=next_id;
  end loop;
 end if;
 new.created_at:=clock_timestamp(); new.updated_at:=new.created_at;
 return new;
end $$;
revoke all on function public.vexa_alias_event() from public,anon,authenticated,service_role;
create trigger alias_event_guard before insert or update or delete on public.external_aliases for each row execute function public.vexa_alias_event();
revoke update,delete on public.external_aliases from vexa_backend;
commit;
