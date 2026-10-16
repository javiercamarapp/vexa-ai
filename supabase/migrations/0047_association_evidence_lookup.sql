begin;
set local transaction_timeout='25000ms';
set local lock_timeout='1000ms';
set local statement_timeout='10000ms';
-- Equality on fact_id implies IS NOT NULL; the former JSON-key predicate
-- was not implied by the existing duplicate lookup and prevented index use.
-- Preserve tenant, fact, evidence, and row identity without changing functions.
create index association_evidence_lookup_idx on public.import_rows
 (tenant_id,((provenance->'result'->>'fact_id')),((provenance->'result'->>'evidence_hash')),id)
 where (provenance->'result'->>'fact_id') is not null;
commit;
