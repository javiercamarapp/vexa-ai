\set ON_ERROR_STOP on
-- Isolated PostgreSQL fixture: auth.users and auth.uid are synthetic substitutes, not Supabase Auth.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
\ir ../../../supabase/migrations/0001_identity.sql
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.organizations(id,name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SYNTHETIC A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','SYNTHETIC B');
insert into public.memberships(tenant_id,user_id,role,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner','active'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','viewer','active');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$begin
 if (select count(*) from public.organizations) <> 1 then raise exception 'organization isolation failed'; end if;
 if exists(select 1 from public.organizations where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'foreign organization leaked'; end if;
 if (select count(*) from public.memberships) <> 1 then raise exception 'membership isolation failed'; end if;
 begin
  update public.memberships set role='owner' where tenant_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  raise exception 'membership write allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.organizations(name) values ('unauthorized');
  raise exception 'organization write allowed';
 exception when insufficient_privilege then null; end;
end$$;
reset role;
update public.memberships set status='revoked',permissions_version=2 where user_id='11111111-1111-4111-8111-111111111111';
set role authenticated;
do $$begin
 if exists(select 1 from public.organizations) then raise exception 'revoked user reads organization'; end if;
 if (select count(*) from public.memberships) <> 1 then raise exception 'self membership not readable'; end if;
end$$;
select set_config('request.jwt.claim.sub','',false);
do $$begin
 if exists(select 1 from public.organizations) or exists(select 1 from public.memberships) then raise exception 'missing identity reads data'; end if;
end$$;
reset role;
set role anon;
do $$begin
 begin perform * from public.organizations; raise exception 'anon reads organizations'; exception when insufficient_privilege then null; end;
 begin perform * from public.memberships; raise exception 'anon reads memberships'; exception when insufficient_privilege then null; end;
end$$;
reset role;
do $$begin
 begin
  insert into public.memberships(tenant_id,user_id,role,status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','viewer','active');
  raise exception 'auth.users FK absent';
 exception when foreign_key_violation then null; end;
 begin
  update public.memberships set role='admin'; raise exception 'invalid role allowed';
 exception when check_violation then null; end;
 begin
  update public.memberships set status='anything'; raise exception 'invalid status allowed';
 exception when check_violation then null; end;
 begin
  update public.memberships set permissions_version=0; raise exception 'invalid permissions version allowed';
 exception when check_violation then null; end;
 begin
  insert into public.memberships select * from public.memberships; raise exception 'duplicate membership allowed';
 exception when unique_violation then null; end;
end$$;
select 'PASS: isolated SQL constraints, read isolation, revocation, default-deny writes and anonymous denial' as result;
