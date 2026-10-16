begin;
set local transaction_timeout='25000ms';
set local lock_timeout='1000ms';
set local statement_timeout='10000ms';
-- Candidate endpoints require exact import lineage and accepted/duplicate rows.
-- Keep those predicates and tenant scope unchanged; add their missing lookup.
create index import_rows_origin_proof_idx on public.import_rows
 (tenant_id,payload_ref,((provenance->'result'->>'canonical_id')))
 where state in ('accepted','duplicate');
commit;
