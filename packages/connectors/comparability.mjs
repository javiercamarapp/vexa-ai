/** Dataset migration comparison. No provider calls, inferred money or mutable baselines. */
import {createHash} from 'node:crypto';
import {aggregateMoney} from '../economics/index.mjs';
import {projectAliases} from './aliases.mjs';
const KIND='migration-source-v1',LIMIT=10000;
const fail=message=>{throw Object.assign(new Error(message),{code:'23514'});};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
const date=(v,precision=3)=>{
 const m=typeof v==='string'&&v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/);
 if(!m||!Number.isFinite(Date.parse(v))||(m[7]?.length??0)>precision)fail('COMPARISON_DATE_INVALID');
 const y=Number(m[1]),month=Number(m[2]),day=Number(m[3]),days=[31,(y%4===0&&(y%100!==0||y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
 if(month<1||month>12||day<1||day>days[month-1]||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)fail('COMPARISON_DATE_INVALID');
 return new Date(v).toISOString();
};
export function comparisonScope(input){
 if(!input||Object.keys(input).some(k=>!['dateStart','dateEnd','timezone','currency','dateBasis','sources','channels'].includes(k)))fail('COMPARISON_SCOPE_INVALID');
 const dateStart=date(input.dateStart),dateEnd=date(input.dateEnd);if(dateStart>=dateEnd)fail('COMPARISON_WINDOW_INVALID');
 if(typeof input.timezone!=='string')fail('COMPARISON_TIMEZONE_REQUIRED');try{new Intl.DateTimeFormat('en',{timeZone:input.timezone});}catch{fail('COMPARISON_TIMEZONE_INVALID');}
 if(!/^[A-Z]{3}$/.test(input.currency)||input.dateBasis!=='conversation')fail('COMPARISON_BASIS_INVALID');
 const list=(value,label)=>{if(!Array.isArray(value)||value.length>30||value.some(x=>typeof x!=='string'||!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(x)))fail('COMPARISON_'+label+'_INVALID');return [...new Set(value)].sort();};
 return {dateStart,dateEnd,timezone:input.timezone,currency:input.currency,dateBasis:'conversation',sources:list(input.sources,'SOURCES'),channels:list(input.channels,'CHANNELS')};
}
export function compareSnapshots(before,after){
 const reasons=[];if(stable(before.scope)!==stable(after.scope))reasons.push('scope_changed');
 for(const [field,reason]of [['pipelineVersion','pipeline_changed'],['mappingVersions','mapping_changed'],['taxonomyVersion','taxonomy_changed'],['currencyExponents','currency_unit_changed']])if(stable(before.method[field])!==stable(after.method[field]))reasons.push(reason);
 const channelCount=(counts,key)=>Object.hasOwn(counts,key)?counts[key]:0;
 const channels=[...new Set([...Object.keys(before.summary.channels),...Object.keys(after.summary.channels)])].sort().map(channel=>({channel,before:channelCount(before.summary.channels,channel),after:channelCount(after.summary.channels,channel),delta:(channelCount(after.summary.channels,channel))-(channelCount(before.summary.channels,channel))}));
 if(channels.some(c=>(c.before===0)!==(c.after===0)))reasons.push('channel_coverage_changed');
 if(before.summary.warnings.length||after.summary.warnings.length)reasons.push('incomplete_evidence');
 if(!before.summary.sourceConversations||!after.summary.sourceConversations)reasons.push('empty_dataset');
 const money={};for(const code of [...new Set([...Object.keys(before.summary.money),...Object.keys(after.summary.money)])].sort()){
  const a=before.summary.money[code]??null,b=after.summary.money[code]??null;
  money[code]={before:a,after:b,deltaMinor:!reasons.length&&a?.amountMinor!=null&&b?.amountMinor!=null?(BigInt(b.amountMinor)-BigInt(a.amountMinor)).toString():null};
 }
 return {state:reasons.length?'no_comparable':'comparable',reasons,before,after,channels,money,counts:Object.fromEntries(['conversations','sourceConversations','messages','orders'].map(k=>[k,{before:before.summary[k],after:after.summary[k],delta:after.summary[k]-before.summary[k]}])),savings:null,causallyAttributed:false,notice:'Diferencias descriptivas del dataset; no demuestran ahorro ni efecto causal.'};
}
// All relations are read in ONE SQL statement: alias events and source rows share an MVCC snapshot.
// No raw text, credentials, provider URLs or customer names enter the frozen dataset.
const captureSql=`WITH origins AS MATERIALIZED (
 SELECT h.id,jsonb_agg(DISTINCT jsonb_build_object('raw_hash',d.raw_hash,'channel',
  CASE WHEN d.original->'envelope'->>'source'='zendesk' THEN d.original->'payload'->'via'->>'channel'
       WHEN d.original->'envelope'->>'source'='hubspot' THEN d.original->'payload'->>'originalChannelId' END)) AS channel_origins
 FROM public.sync_raw_objects d JOIN public.source_heads h ON h.tenant_id=d.tenant_id AND h.id::text=d.result->>'canonical_id' AND h.connection_id=d.connection_id
 JOIN public.source_revisions v ON v.tenant_id=h.tenant_id AND v.id=h.selected_revision_id
 WHERE d.tenant_id=$1 AND v.entity_type='conversation' AND d.result->>'status' IN ('inserted','duplicate')
 AND d.normalized->'envelope'->>'source_revision'=v.source_revision AND d.normalized->'envelope'->>'content_hash'=v.content_hash
 GROUP BY h.id
), cs AS MATERIALIZED (
 SELECT c.id,c.tenant_id,c.connection_id,c.source,c.entity_type,c.external_id,c.channel,c.started_at,c.deleted_at,c.order_id,
 jsonb_build_object('source',c.provenance->>'source','account_id',c.provenance->>'account_id') AS provenance,
 x.account_id,x.source AS connection_source,h.state AS revision_state,h.selected_revision_id,r.mapping_version,o.channel_origins
 FROM public.conversations c JOIN public.connections x ON x.tenant_id=c.tenant_id AND x.id=c.connection_id
 LEFT JOIN public.source_heads h ON h.tenant_id=c.tenant_id AND h.id=c.id
 LEFT JOIN public.source_revisions r ON r.tenant_id=h.tenant_id AND r.id=h.selected_revision_id
 LEFT JOIN origins o ON o.id=c.id
 WHERE c.tenant_id=$1 ORDER BY c.id LIMIT 10001
), ms AS MATERIALIZED (
 SELECT m.id,m.conversation_id,m.occurred_at,m.deleted_at,h.state AS revision_state,h.selected_revision_id,r.mapping_version
 FROM public.messages m LEFT JOIN public.source_heads h ON h.tenant_id=m.tenant_id AND h.id=m.id
 LEFT JOIN public.source_revisions r ON r.tenant_id=h.tenant_id AND r.id=h.selected_revision_id
 WHERE m.tenant_id=$1 ORDER BY m.id LIMIT 10001
), os AS MATERIALIZED (
 SELECT o.id,o.amount_minor::text AS amount_minor,o.currency,o.exponent,h.state AS revision_state,h.selected_revision_id,r.mapping_version
 FROM public.orders o LEFT JOIN public.source_heads h ON h.tenant_id=o.tenant_id AND h.id=o.id
 LEFT JOIN public.source_revisions r ON r.tenant_id=h.tenant_id AND r.id=h.selected_revision_id
 WHERE o.tenant_id=$1 ORDER BY o.id LIMIT 10001
), als AS MATERIALIZED (
 SELECT id,source,account_id,entity_type,external_id,canonical_id,source_conversation_id,operation,version
 FROM public.external_aliases WHERE tenant_id=$1 ORDER BY version,id LIMIT 10001
) SELECT statement_timestamp() AS watermark,
 coalesce((SELECT jsonb_agg(to_jsonb(cs)) FROM cs),'[]') AS conversations,
 coalesce((SELECT jsonb_agg(to_jsonb(ms)) FROM ms),'[]') AS messages,
 coalesce((SELECT jsonb_agg(to_jsonb(os)) FROM os),'[]') AS orders,
 coalesce((SELECT jsonb_agg(to_jsonb(als)) FROM als),'[]') AS aliases`;
function dataset(raw,scope){
 for(const k of ['conversations','messages','orders','aliases'])if(raw[k].length>LIMIT)fail('COMPARISON_DATASET_LIMIT');
 const warnings=new Set(),versions=new Set();
 raw.conversations=raw.conversations.map(c=>{if(c.channel)return c;const values=[...new Set((c.channel_origins??[]).map(x=>x.channel))];const valid=values.length===1&&typeof values[0]==='string'&&/^[a-z0-9][a-z0-9_-]{0,39}$/.test(values[0]);return {...c,channel:valid?c.source+'_'+values[0]:null,channel_ambiguous:values.length>1};});
 const projection=projectAliases(raw.conversations,raw.aliases);
 const relevant=raw.conversations.filter(c=>!scope.sources.length||scope.sources.includes(c.source));
 if(relevant.some(c=>!c.started_at))warnings.add('conversation_date_unknown');
 const conversations=relevant.filter(c=>!c.deleted_at&&c.started_at&&new Date(c.started_at).toISOString()>=scope.dateStart&&new Date(c.started_at).toISOString()<scope.dateEnd&&(!scope.channels.length||scope.channels.includes(c.channel)));
 const ids=new Set(conversations.map(c=>c.id)),orderIds=new Set(conversations.map(c=>c.order_id).filter(Boolean));
 const messages=raw.messages.filter(m=>ids.has(m.conversation_id)&&!m.deleted_at);
 const orders=raw.orders.filter(o=>orderIds.has(o.id));
 if(orders.length!==orderIds.size)fail('COMPARISON_ORDER_UNAVAILABLE');
 for(const row of [...conversations,...messages,...orders]){if(row.revision_state==='ambiguous')warnings.add('ambiguous_revision');if(!row.mapping_version||!row.selected_revision_id)warnings.add('unversioned_source');else versions.add(row.mapping_version);}
 if(messages.some(m=>!m.occurred_at))warnings.add('message_date_unknown');
 const byChannel=new Map();for(const c of conversations){if(!c.channel)warnings.add('channel_unknown');if(c.channel_ambiguous)warnings.add('channel_ambiguous');const key=c.channel??'unknown';if(!byChannel.has(key))byChannel.set(key,new Set());byChannel.get(key).add(projection.resolve(c.id).canonical_id);}
 const currencies=new Map();for(const o of orders){if(currencies.has(o.currency)&&currencies.get(o.currency)!==o.exponent)fail('COMPARISON_EXPONENT_CONFLICT');currencies.set(o.currency,o.exponent);}
 const money=aggregateMoney(orders.filter(o=>o.currency===scope.currency).map(o=>({id:o.id,currency:o.currency,amountMinor:o.amount_minor})));
 if(orders.some(o=>o.currency!==scope.currency))warnings.add('orders_in_other_currency');
 const summary={conversations:new Set(conversations.map(c=>projection.resolve(c.id).canonical_id)).size,sourceConversations:conversations.length,messages:messages.length,orders:orders.length,channels:Object.fromEntries([...byChannel].sort(([a],[b])=>a.localeCompare(b)).map(([c,ids])=>[c,ids.size])),money,warnings:[...warnings].sort()};
 const method={pipelineVersion:'canonical-source-v2',mappingVersions:[...versions].sort(),taxonomyVersion:'not-applied',currencyExponents:Object.fromEntries([...currencies].sort(([a],[b])=>a.localeCompare(b)))};
 // Freeze identities, selected revisions, alias lineage and method, not mutable table references.
 const inputs={scope,method,conversations,messages,orders,aliases:raw.aliases};
 return {scope,method,watermark:new Date(raw.watermark).toISOString(),inputHash:hash({scope,method,summary,inputs}),summary,inputs};
}
function publicSnapshot(row){
 const d=row.provenance?.dataset;if(row.status!=='published'||row.policy_version!==KIND||row.provenance?.kind!==KIND||!d||hash({scope:d.scope,method:d.method,summary:d.summary,inputs:d.inputs})!==row.input_hash||d.inputHash!==row.input_hash||hash(d.scope)!==row.scope_hash||row.bundle_ref!==KIND+':'+row.input_hash||new Date(row.watermark).toISOString()!==d.watermark)fail('COMPARISON_SNAPSHOT_INVALID');
 return {id:row.id,createdAt:new Date(row.created_at).toISOString(),scope:d.scope,method:d.method,watermark:d.watermark,inputHash:d.inputHash,summary:d.summary};
}
export function createComparisonRepository({database}={}){
 if(typeof window!=='undefined'||typeof database?.transaction!=='function')fail('COMPARISON_DATABASE_REQUIRED');
 return Object.freeze({
  async capture(input){const scope=comparisonScope(input);return database.transaction('import',async tx=>{
   const raw=(await tx.query(captureSql,[tx.tenantId])).rows[0],d=dataset(raw,scope),scopeHash=hash(scope);
   const value=JSON.stringify({kind:KIND,dataset:d});
   const inserted=await tx.query(`INSERT INTO public.metric_snapshots(tenant_id,scope_hash,input_hash,policy_version,watermark,status,bundle_ref,date_start,date_end,timezone,currency,date_basis,published_at,provenance) VALUES($1,$2,$3,$4,$5,'published',$6,$7,$8,$9,$10,'conversation',clock_timestamp(),$11::jsonb) ON CONFLICT(tenant_id,scope_hash,input_hash,policy_version) DO NOTHING RETURNING *`,[tx.tenantId,scopeHash,d.inputHash,KIND,d.watermark,KIND+':'+d.inputHash,scope.dateStart,scope.dateEnd,scope.timezone,scope.currency,value]);
   const row=inserted.rows[0]??(await tx.query('SELECT * FROM public.metric_snapshots WHERE tenant_id=$1 AND scope_hash=$2 AND input_hash=$3 AND policy_version=$4',[tx.tenantId,scopeHash,d.inputHash,KIND])).rows[0];return publicSnapshot(row);
  });},
  async list({cursor=null}={}){
   let last=null;if(cursor!==null){try{if(typeof cursor!=='string'||cursor.length>300||!/^[a-zA-Z0-9_-]+$/.test(cursor))fail('COMPARISON_CURSOR_INVALID');last=JSON.parse(Buffer.from(cursor,'base64url').toString());if(!uuid(last.id))fail('COMPARISON_CURSOR_INVALID');date(last.createdAt,6);}catch{fail('COMPARISON_CURSOR_INVALID');}}
   return database.transaction('read',async tx=>{const rows=(await tx.query("SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cursor_created_at FROM public.metric_snapshots WHERE tenant_id=$1 AND status='published' AND provenance->>'kind'=$2 AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::uuid)) ORDER BY created_at DESC,id DESC LIMIT 51",[tx.tenantId,KIND,last?.createdAt??null,last?.id??null])).rows;
    const snapshots=rows.slice(0,50).map(publicSnapshot),tail=rows[49];return {snapshots,nextCursor:rows.length>50?Buffer.from(JSON.stringify({createdAt:tail.cursor_created_at,id:tail.id})).toString('base64url'):null};});
  },
  async compare({beforeId,afterId}){if(!uuid(beforeId)||!uuid(afterId)||beforeId===afterId)fail('COMPARISON_IDS_INVALID');return database.transaction('read',async tx=>{
   const rows=(await tx.query("SELECT * FROM public.metric_snapshots WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND status='published' AND provenance->>'kind'=$3",[tx.tenantId,[beforeId,afterId],KIND])).rows;
   if(rows.length!==2)fail('COMPARISON_SNAPSHOT_UNAVAILABLE');return compareSnapshots(publicSnapshot(rows.find(r=>r.id===beforeId)),publicSnapshot(rows.find(r=>r.id===afterId)));
  });},
 });
}
