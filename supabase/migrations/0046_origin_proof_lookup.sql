begin;
set local transaction_timeout='25000ms';
set local lock_timeout='1000ms';
set local statement_timeout='10000ms';
-- Preserve exact proof joins and tenant scope; only add their lookup path.
create index source_revisions_origin_proof_idx on public.source_revisions (tenant_id,connection_id,mapping_version,((provenance->>'payload_ref')),((canonical_id::text)));
commit;
