// External exam bindings, not product schema. See README for unresolved names.
import {randomUUID} from 'node:crypto';
export const q = x => "'" + String(x).replaceAll("'", "''") + "'";
export const ident = x => '"' + x.replaceAll('"','""') + '"';
export const insert = (table,row) => `INSERT INTO public.${ident(table)} (${Object.keys(row).map(ident)}) VALUES (${Object.values(row).map(v=>v===null?'NULL':q(typeof v==='object'?JSON.stringify(v):v))})`;
// Direct user DML is reserved to the backend except source configuration.
// API permissions do NOT imply table-level grants for imports/jobs/money.
export const definitions = [
  ['connections',{source:'hubspot',account_id:'syn-account',status:'active'}],
  ['external_aliases',{source:'hubspot',account_id:'syn-account',entity_type:'conversation',external_id:'42',version:1},[['canonical_id','conversations']]],
  ['imports',{file_hash:'syn-hash',mapping_version:'1',state:'queued',idempotency_key:'syn-import',total:1,accepted:0,rejected:0,duplicates:0,pending:1}],
  ['import_rows',{row_ref:'1',state:'pending'},[['import_id','imports']]],
  ['customers',{external_id:'42'}], ['products',{external_id:'42',sku:'SYN-SKU'}],
  ['orders',{external_id:'42',amount_minor:1000,currency:'USD',exponent:2,occurred_at:'2026-09-01T00:00:00Z'},[['customer_id','customers']]],
  ['order_lines',{amount_minor:1000,currency:'USD',exponent:2},[['order_id','orders'],['product_id','products']]],
  ['conversations',{source:'hubspot',entity_type:'conversation',external_id:'42',source_revision:'1'},[['connection_id','connections'],['customer_id','customers'],['order_id','orders']]],
  ['messages',{role:'customer',external_id:'42',occurred_at:'2026-09-01T00:00:00Z'},[['conversation_id','conversations']]],
  ['message_revisions',{revision:'1',text_ref:'SYN',hash:'syn-hash'},[['message_id','messages']]],
  ['jobs',{type:'synthetic',state:'queued',input_ref:'synthetic',input_hash:'syn-hash',version:'1',fencing_token:0}],
  ['attempts',{state:'running',attempt_number:1},[['job_id','jobs']]],
  ['checkpoints',{checkpoint:{},stage:'synthetic'},[['job_id','jobs']]],
  ['outbox',{state:'pending',input_ref:'synthetic'},[['job_id','jobs']]],
  ['dead_letters',{reason:'synthetic'},[['job_id','jobs']]],
  ['extraction_runs',{model_id:'synthetic',prompt_hash:'syn-hash',schema_hash:'syn-hash',status:'succeeded'},[['conversation_id','conversations']]],
  ['issues',{category:'synthetic'},[['extraction_run_id','extraction_runs']]],
  ['evidence_spans',{start:0,end:9,quote_hash:'syn-hash'},[['message_revision_id','message_revisions']]],
  ['embeddings',{model_id:'synthetic-3d',dim:3,version:'1',content:'SYN',embedding:'[1,0,0]'},[['message_revision_id','message_revisions']]],
  ['problems',{severity:'low',cause_status:'unknown'}],
  ['problem_versions',{version:1},[['problem_id','problems']]],
  ['problem_conversations',{},[['problem_id','problems'],['conversation_id','conversations']]],
  ['economic_events',{kind:'refund',status:'observed',amount_minor:100,currency:'USD',exponent:2,effective_at:'2026-09-01T00:00:00Z',source_ref:'synthetic'},[['order_id','orders']]],
  ['reversals',{amount_minor:100,currency:'USD',exponent:2},[['reversal_of','economic_events']]],
  ['cost_rates',{amount_minor:100,currency:'USD',exponent:2,effective_at:'2026-09-01T00:00:00Z'}],
  ['assumptions',{version:1}],
  ['metric_snapshots',{scope_hash:'syn-scope',input_hash:'syn-input',policy_version:'1',status:'draft',watermark:'2026-09-01T00:00:00Z'}],
  ['components',{amount_minor:100,currency:'USD',exponent:2},[['snapshot_id','metric_snapshots']]],
  ['attributions',{},[['snapshot_id','metric_snapshots'],['economic_event_id','economic_events']]],
  ['recommendations',{status:'draft',version:1},[['problem_id','problems']]],
  ['interventions',{status:'draft',version:1},[['recommendation_id','recommendations']]],
  ['measurement_plans',{version:1},[['intervention_id','interventions']]],
  ['weekly_briefs',{status:'draft',version:1},[['snapshot_id','metric_snapshots']]],
  ['audit_events',{actor:'synthetic',action:'fixture',resource:'synthetic',reason:'exam',trace_id:'syn-trace'}],
  ['tombstones',{deleted_source_key:'syn-deleted'}],
];
export const relations = definitions.flatMap(([table,,refs=[]])=>refs.map(([column,parent])=>({table,column,parent})));
export function fixture(tenant) {
  const ids=Object.fromEntries(definitions.map(([name])=>[name,randomUUID()]));
  const rows=Object.fromEntries(definitions.map(([name,values,refs=[]])=>[name,{
    tenant_id:tenant,id:ids[name],...values,...Object.fromEntries(refs.map(([col,parent])=>[col,ids[parent]]))
  }]));
  rows.embeddings.content=tenant.endsWith('a')?'SOLO_A_7E':'SOLO_B_9F';
  return rows;
}
export function ordered() {
  const result=[],pending=[...definitions];
  while(pending.length) {
    const i=pending.findIndex(([, ,refs=[]])=>refs.every(([,p])=>result.some(([n])=>n===p)));
    if(i<0)throw Error('EXAM: fixture relation cycle');
    result.push(pending.splice(i,1)[0]);
  }
  return result;
}

// Monotonic per execution; never reuse numeric domain identities across clones.
let serial=100;
export function freshRow(source) {
  const row={...source,id:randomUUID()};
  const n=++serial;
  for(const key of ['external_id','account_id','idempotency_key','input_hash','scope_hash','deleted_source_key','row_ref','source_ref','version','revision','source_revision','attempt_number','stage'])
    if(key in row)row[key]=typeof row[key]==='number'?n:/^\d+$/.test(row[key])?String(n):'synthetic-'+randomUUID();
  // Temporal association clones retain their parents, but get a separate closed
  // historical window. Never reuse the seed's open or bounded interval.
  if('valid_from' in row){
    const start=Date.parse(source.valid_from);
    if(!Number.isFinite(start))throw Error('FIXTURE_INVALID_VALID_FROM');
    const until=source.valid_until==null?null:Date.parse(source.valid_until);
    if(until!==null && (!Number.isFinite(until)||until<=start))throw Error('FIXTURE_INVALID_VALID_WINDOW');
    row.valid_from=new Date(start-n*2000).toISOString();
    row.valid_until=new Date(start-n*2000+1000).toISOString();
  }
  return row;
}
