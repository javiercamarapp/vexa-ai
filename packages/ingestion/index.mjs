import { parseCSV } from './csv.mjs';
export { parseCSV, parseCSVStream } from './csv.mjs';
import { createHash } from 'node:crypto';

export class IngestionError extends Error {
  constructor(code, field = null) { super(code); this.name = 'IngestionError'; this.code = code; this.field = field; }
}
const fail = (code, field) => { throw new IngestionError(code, field); };
export function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096 || /[\u0000-\u001f]/u.test(value)) fail('INVALID_STRING', field);
  return value;
}
export function timestamp(value, field = 'timestamp', nullable = false) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'string') fail('INVALID_TIMESTAMP', field);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) fail('INVALID_TIMESTAMP', field);
  const [,y,mo,d,h,mi,s,z] = m;
  const days = new Date(Date.UTC(+y, +mo, 0)).getUTCDate();
  if (+y < 1000 || +mo < 1 || +mo > 12 || +d < 1 || +d > days || +h > 23 || +mi > 59 || +s > 59 || (z !== 'Z' && (+z.slice(1,3) > 23 || +z.slice(4) > 59))) fail('INVALID_TIMESTAMP', field);
  const ms = Date.parse(value); if (!Number.isFinite(ms)) fail('INVALID_TIMESTAMP', field);
  return new Date(ms).toISOString();
}
export function contentHash(value) {
  const canonical = v => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
    if (Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
    if (v && Object.getPrototypeOf(v) === Object.prototype) return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
    fail('INVALID_JSON');
  };
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function validateContext(context) {
  for (const field of ['tenant_id','connection_id']) if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(context?.[field] ?? '')) fail('INVALID_CONTEXT',field);
  if (!['csv','hubspot','zendesk'].includes(context.source)) fail('INVALID_CONTEXT','source');
  requiredString(context.source_account_id,'source_account_id');
  return { tenant_id: context.tenant_id, connection_id: context.connection_id, source: context.source, source_account_id: context.source_account_id };
}
export function createEnvelope(context, record, payload) {
  const scope = validateContext(context);
  const hash = contentHash(payload);
  const envelope = { ...scope };
  for (const field of ['entity_type','external_id','payload_ref']) envelope[field] = requiredString(record[field],field);
  envelope.source_revision = record.source_revision == null || record.source_revision === '' ? `sha256:${hash}` : requiredString(record.source_revision,'source_revision');
  envelope.occurred_at = timestamp(record.occurred_at,'occurred_at',true);
  envelope.observed_at = timestamp(record.observed_at,'observed_at');
  envelope.content_hash = hash;
  envelope.deleted_at = timestamp(record.deleted_at,'deleted_at',true);
  return Object.freeze(envelope);
}
export function identityKey(e) {
  return JSON.stringify(['v1',e.tenant_id,e.connection_id,e.source,e.source_account_id,e.entity_type,e.external_id].map((v,i)=>requiredString(v,`identity_${i}`)));
}
export function revisionKey(e) { return JSON.stringify([identityKey(e),requiredString(e.source_revision,'source_revision')]); }
// Reference in-memory history only: no durable checkpoint, no money, no revision ordering inferred.
export class RevisionLedger {
  #entities = new Map();
  get size() { return this.#entities.size; }
  apply(envelope) {
    const key = identityKey(envelope), revisions = this.#entities.get(key) ?? new Map();
    const previous = revisions.get(envelope.source_revision);
    if (previous) {
      if (previous.content_hash !== envelope.content_hash || previous.occurred_at !== envelope.occurred_at || previous.deleted_at !== envelope.deleted_at) fail('REVISION_CONFLICT');
      return { status:'duplicate',identity_key:key };
    }
    const status = revisions.size ? 'revision' : 'inserted';
    revisions.set(envelope.source_revision,Object.freeze({...envelope})); this.#entities.set(key,revisions);
    return {status,identity_key:key};
  }
  history(envelope) { return [...(this.#entities.get(identityKey(envelope))?.values() ?? [])]; }
}

export function normalizeCSV(input, { context, observed_at, mappingVersion, limits } = {}) {
  const scope=validateContext(context); if(scope.source!=='csv') fail('INVALID_CONTEXT','source');
  timestamp(observed_at); requiredString(mappingVersion,'mappingVersion');
  const parsed=parseCSV(input,{...limits,maxRows:limits?.maxRows === undefined ? 50001 : limits.maxRows+1}), head=parsed.rows[0];
  const required=['external_id','source_revision','occurred_at','text','role'];
  if(!head || head.line!==1 || new Set(head.values).size!==head.values.length || required.some(k=>!head.values.includes(k))) fail('CSV_HEADER');
  const bytes=typeof input==='string'?Buffer.from(input):input;
  const batch_hash=createHash('sha256').update(bytes).digest('hex');
  const records=[],errors=[...parsed.errors];
  for(const row of parsed.rows.slice(1)) {
    try {
      if(row.values.length!==head.values.length) fail('CSV_COLUMN_COUNT');
      const data=Object.fromEntries(head.values.map((k,i)=>[k,row.values[i]]));
      if(!['customer','agent','internal','unknown'].includes(data.role)) fail('INVALID_ROLE','role');
      if([...data.text.normalize('NFC')].length>2000) fail('CSV_LIMIT_MESSAGE','text');
      let money;
      if(Object.hasOwn(data,'amount')) money=parseMoney(data.amount,data.currency);
      const row_hash=contentHash(data);
      const message={text:data.text.normalize('NFC'),role:data.role,customer_id:data.customer_id||null,sku:data.sku||null,order_id:data.order_id||null,conversation_external_id:data.conversation_id||null,content_format:'plain_text',redaction:'none'};
      const envelope=createEnvelope(scope,{entity_type:'message',external_id:data.external_id||`csv:${contentHash([mappingVersion,batch_hash,row.line])}`,source_revision:data.source_revision||null,occurred_at:data.occurred_at,observed_at,payload_ref:`csv:${batch_hash}:line:${row.line}`},data);
      records.push({...(money ? {money} : {}),envelope:Object.freeze({...envelope,adapter_version:'csv-message-v1'}),raw_payload:data,message,row_ref:row.line,row_hash,batch_hash,mapping_version:mappingVersion});
    } catch(error) { if(!(error instanceof IngestionError)) throw error; errors.push({code:error.code,field:error.field,line:row.line}); }
  }
  return {records,errors:errors.sort((a,b)=>a.line-b.line),batch_hash,mapping_version:mappingVersion,coverage:{accepted:records.length,rejected:errors.length,unknown_customers:records.filter(x=>x.message.customer_id===null).length,unknown_skus:records.filter(x=>x.message.sku===null).length}};
}

// Caller authorizes approval; this pure map is not an RBAC or persistent audit implementation.
export class ExplicitAliases {
  #aliases = new Map();
  approve(envelopes, approval) {
    for (const field of ['tenant_id','canonical_id','evidence_ref','approved_by','version']) requiredString(approval?.[field],field);
    if (!Array.isArray(envelopes) || !envelopes.length) fail('ALIAS_EMPTY');
    const target = JSON.stringify(['canonical',approval.tenant_id,approval.canonical_id]);
    const keys = envelopes.map(envelope => {
      if (envelope.tenant_id !== approval.tenant_id) fail('ALIAS_TENANT');
      const key = identityKey(envelope), previous = this.#aliases.get(key);
      if (previous && previous.target !== target) fail('ALIAS_CONFLICT');
      return key;
    });
    // Validate all aliases before mutation; a cross-tenant pair cannot partially apply.
    for (const key of keys) this.#aliases.set(key,Object.freeze({target,approval:Object.freeze({...approval})}));
    return target;
  }
  resolve(envelope) { const key=identityKey(envelope); return this.#aliases.get(key)?.target ?? key; }
}

// Versioned transformation: content_hash always authenticates the ORIGINAL row.
// The normalized hash is separate provenance, never a replacement envelope hash.
export function adaptCSVRaw(envelope, raw) {
  if(envelope.adapter_version!=='csv-message-v1'||envelope.source!=='csv'||envelope.entity_type!=='message') fail('CSV_ADAPTER_VERSION');
  if(contentHash(raw)!==envelope.content_hash) fail('CSV_RAW_HASH_MISMATCH');
  if(!raw || typeof raw.text!=='string' || !['customer','agent','internal'].includes(raw.role)) fail('CSV_MESSAGE_INVALID');
  if(typeof raw.conversation_id!=='string'||!raw.conversation_id.trim()) fail('CSV_CONVERSATION_REQUIRED');
  if(raw.external_id && raw.external_id!==envelope.external_id) fail('CSV_IDENTITY_MISMATCH');
  if(raw.source_revision && raw.source_revision!==envelope.source_revision) fail('CSV_IDENTITY_MISMATCH');
  if(timestamp(raw.occurred_at,'occurred_at')!==envelope.occurred_at) fail('CSV_IDENTITY_MISMATCH');
  return {text:raw.text.normalize('NFC'),role:raw.role,customer_id:raw.customer_id||null,sku:raw.sku||null,order_id:raw.order_id||null,conversation_external_id:raw.conversation_id,content_format:'plain_text',redaction:'none'};
}

// Explicit supported currencies; no inferred exchange rates, exponent or floating arithmetic.
export function parseMoney(amount,currency){
 const exponents={USD:2,MXN:2,EUR:2,GBP:2,CAD:2,AUD:2,JPY:0,KWD:3};
 if(typeof amount!=='string'||!/^[-+]?\d+(?:\.\d+)?$/.test(amount)) fail('INVALID_AMOUNT','amount');
 if(!Object.hasOwn(exponents,currency)) fail('INVALID_CURRENCY','currency');
 const exponent=exponents[currency],negative=amount.startsWith('-');
 const [whole,fraction='']=amount.replace(/^[-+]/,'').split('.');
 if(fraction.length>exponent) fail('INVALID_AMOUNT','amount');
 const minor=BigInt(whole)*10n**BigInt(exponent)+BigInt(fraction.padEnd(exponent,'0')||'0');
 return {amount_minor:((negative?-1n:1n)*minor).toString(),currency,exponent};
}
export { parseXLSX } from './xlsx.mjs';
