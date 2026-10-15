begin;
set local transaction_timeout='25000ms';
set local lock_timeout='1000ms';
set local statement_timeout='10000ms';
create index source_heads_customer_overlap_idx on public.source_heads using btree (tenant_id,external_id) where entity_type='customer';
create index source_revisions_customer_overlap_idx on public.source_revisions using btree (tenant_id,external_id) where entity_type='customer';
commit;
