-- Compares the 0049 function (association_candidates_old) with 0054 (association_candidates)
-- over many fact sets and both owner_choice values. Variable: t (tenant uuid).
\set ON_ERROR_STOP on
select set_config('cmp.t',:'t',false) \gset
create temp table sets(name text primary key,ids uuid[]);
insert into sets
select 'all',array_agg(id) from public.native_customer_associations where tenant_id=:'t'::uuid
union all select 'empty','{}'::uuid[]
union all select 'unknown',array[md5('nope')::uuid]
union all select 'first50',array_agg(id) from (select id from public.native_customer_associations where tenant_id=:'t'::uuid order by id limit 50) x
union all select 'third',array_agg(id) from (select id,row_number() over(order by id) rn from public.native_customer_associations where tenant_id=:'t'::uuid) x where rn%3=0
union all select 'retained',array_agg(id) from public.native_customer_associations where tenant_id=:'t'::uuid and resolution_state='retained'
union all select 'dups',array_agg(id)||array_agg(id) from (select id from public.native_customer_associations where tenant_id=:'t'::uuid order by id limit 20) x;
create temp table res_old(name text,oc boolean,fact_id uuid,kind text,id uuid,connection_id uuid,external_id text,revision_id uuid,head_version bigint,proof jsonb);
create temp table res_new(like res_old);
do $$ declare s record; oc boolean; begin
 for s in select * from sets loop foreach oc in array array[false,true] loop
  insert into res_old select s.name,oc,* from public.association_candidates_old(current_setting('cmp.t')::uuid,s.ids,oc);
  insert into res_new select s.name,oc,* from public.association_candidates(current_setting('cmp.t')::uuid,s.ids,oc);
 end loop; end loop; end $$;
select
 (select count(*) from res_old) rows_old,(select count(*) from res_new) rows_new,
 (select count(*) from (select * from res_old except select * from res_new) x) only_old,
 (select count(*) from (select * from res_new except select * from res_old) x) only_new,
 (select count(*) from res_old where name='all' and not oc) all_false,
 (select count(*) from res_old where name='all' and oc) all_true,
 (select count(distinct proof->>'approvalId') from res_old where name='all') approvals,
 (select count(*) from res_old where name in('empty','unknown','retained')) empty_cases,
 (select count(*) from (select name,oc,fact_id,kind,id from res_new group by 1,2,3,4,5 having count(*)>1) x) dup_keys \gset
\echo rows_old=:rows_old rows_new=:rows_new only_old=:only_old only_new=:only_new all_false=:all_false all_true=:all_true approvals=:approvals empty_cases=:empty_cases dup_keys=:dup_keys
