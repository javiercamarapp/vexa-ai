begin;
-- Additive F02-02 proposal. Existing core migrations remain byte-identical.
create table public.import_uploads (
 tenant_id uuid not null,
 import_id uuid primary key,
 user_id uuid not null,
 size bigint not null check(size between 1 and 20971520),
 content_type text not null check(content_type in ('text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
 request_hash text not null,
 expires_at timestamptz not null default (now()+interval '15 minutes'),
 job_id uuid,
 foreign key(tenant_id,import_id) references public.imports(tenant_id,id),
 foreign key(tenant_id,user_id) references public.memberships(tenant_id,user_id),
 foreign key(tenant_id,job_id) references public.jobs(tenant_id,id)
);
alter table public.import_uploads enable row level security;
alter table public.import_uploads force row level security;
revoke all on public.import_uploads from public,anon,authenticated,service_role;
grant select on public.import_uploads to authenticated;
grant select,insert,update on public.import_uploads to vexa_backend;
create policy upload_member_read on public.import_uploads for select to authenticated
 using(user_id=auth.uid() and public.vexa_member(tenant_id));
create policy upload_backend on public.import_uploads to vexa_backend
 using(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_member(tenant_id))
 with check(tenant_id=nullif(current_setting('vexa.tenant_id',true),'')::uuid and public.vexa_backend_action(tenant_id,array['import']));
-- Existing broad tenant upload policy is narrowed ONLY for the reserved namespace.
create policy reserved_import_upload on storage.objects as restrictive for insert to authenticated
 with check(bucket_id<>'vexa-private' or split_part(name,'/',2)<>'imports' or exists(
 select 1 from public.import_uploads u join public.imports i on i.id=u.import_id and i.tenant_id=u.tenant_id
 where i.object_path=name and u.user_id=auth.uid() and i.state='reserved' and u.expires_at>now()));
create policy immutable_import_delete on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'vexa-private' or split_part(name,'/',2)<>'imports');
grant usage on schema storage to vexa_backend;
grant select(bucket_id,name,owner_id,metadata) on storage.objects to vexa_backend;
create policy import_backend_object_read on storage.objects for select to vexa_backend
 using(bucket_id='vexa-private' and split_part(name,'/',1)=current_setting('vexa.tenant_id',true)
 and public.vexa_member(nullif(current_setting('vexa.tenant_id',true),'')::uuid));

create function public.confirm_import(p_import uuid,p_hash text,p_size bigint,p_mapping text)
returns table(import_id uuid,job_id uuid,state text)
language plpgsql security invoker set search_path='' as $$
declare i public.imports; u public.import_uploads; j uuid; t uuid;
begin
 t:=nullif(current_setting('vexa.tenant_id',true),'')::uuid;
 if not public.vexa_backend_action(t,array['import']) then raise exception 'denied' using errcode='42501'; end if;
 select * into i from public.imports where id=p_import and tenant_id=t for update;
 select * into u from public.import_uploads where import_uploads.import_id=p_import and tenant_id=t for update;
 if i.id is null or u.import_id is null or u.user_id<>auth.uid() then raise exception 'denied' using errcode='42501'; end if;
 if not exists(select 1 from public.connections where id=i.connection_id and tenant_id=t and status='active') then raise exception 'connection unavailable' using errcode='23514'; end if;
 if i.file_hash<>p_hash or u.size<>p_size or i.mapping_version<>p_mapping then raise exception 'metadata conflict' using errcode='23514'; end if;
 if u.job_id is not null then return query select i.id,u.job_id,i.state; return; end if;
 if u.expires_at<=clock_timestamp() or i.state<>'reserved' then raise exception 'reservation expired' using errcode='23514'; end if;
 if not exists(select 1 from storage.objects where bucket_id='vexa-private' and name=i.object_path and owner_id=u.user_id::text) then raise exception 'object owner invalid' using errcode='23514'; end if;
 insert into public.jobs(tenant_id,type,input_ref,input_hash,version,import_id,max_attempts)
 values(t,'import',i.object_path,i.id::text,p_mapping,i.id,4) returning id into j;
 insert into public.outbox(tenant_id,job_id,input_ref,topic,idempotency_key)
 values(t,j,i.object_path,'import',i.id::text);
 update public.imports set state='queued',updated_at=now() where id=i.id and tenant_id=t;
 update public.import_uploads set job_id=j where import_uploads.import_id=i.id and tenant_id=t;
 return query select i.id,j,'queued'::text;
end $$;
revoke all on function public.confirm_import(uuid,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.confirm_import(uuid,text,bigint,text) to vexa_backend;
-- Signed Storage uploads execute with elevated Storage privileges: RLS alone
-- does not recheck expiry on redemption. This guard applies to that path too.
create function public.guard_reserved_import_object() returns trigger
language plpgsql security definer set search_path='' as $$
declare u public.import_uploads; i public.imports;
begin
 if TG_OP <> 'INSERT' and OLD.bucket_id='vexa-private' and split_part(OLD.name,'/',2)='imports' then
  raise exception 'reserved import object immutable' using errcode='42501';
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 if NEW.bucket_id<>'vexa-private' or split_part(NEW.name,'/',2)<>'imports' then return NEW; end if;
 select * into i from public.imports where object_path=NEW.name;
 select * into u from public.import_uploads where import_id=i.id and tenant_id=i.tenant_id;
 if i.id is null or u.import_id is null or i.state<>'reserved' or u.expires_at<=clock_timestamp()
 or NEW.owner_id is distinct from u.user_id::text
 or not exists(select 1 from public.memberships where tenant_id=u.tenant_id and user_id=u.user_id and status='active' and role in ('owner','analyst'))
 then raise exception 'invalid upload reservation' using errcode='42501'; end if;
 -- Storage signing may perform a rollback-only permission probe without metadata.
 if NEW.metadata ? 'size' and (NEW.metadata->>'size')::bigint is distinct from u.size then
  raise exception 'upload size mismatch' using errcode='23514';
 end if;
 return NEW;
end $$;
revoke all on function public.guard_reserved_import_object() from public,anon,authenticated,service_role,vexa_backend;
create trigger guard_reserved_import_object before insert or update or delete on storage.objects
for each row execute function public.guard_reserved_import_object();
commit;
