import {createHash} from 'node:crypto';
export const sha256 = text => createHash('sha256').update(text,'utf8').digest('hex');
const object = properties => ({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const enumeration = values => ({type:'string',enum:values});
const text = maxLength => ({type:'string',minLength:1,maxLength});
const array = (items,maxItems,minItems=0) => ({type:'array',items,maxItems,minItems});
const evidenceSchema = object({message_revision_id:text(200),start:{type:'integer',minimum:0},end:{type:'integer',minimum:1},quote:text(4000),quote_hash:{type:'string',pattern:'^[a-f0-9]{64}$'},role:enumeration(['customer','agent','internal'])});
export function extractionSchema(taxonomy,{modelOutput=false}={}) {
  const spanSchema=structuredClone(evidenceSchema);
  if(modelOutput){delete spanSchema.properties.quote_hash;spanSchema.required=spanSchema.required.filter(k=>k!=='quote_hash');}
  if(!Array.isArray(taxonomy)||!taxonomy.length||taxonomy.length>100||taxonomy.some(x=>typeof x!=='string'||!x.length||x.length>80)||new Set(taxonomy).size!==taxonomy.length) throw new Error('invalid_taxonomy');
  return object({issues:array(object({category:enumeration(taxonomy),severity:enumeration(['low','medium','high','critical','unknown']),evidence:array(spanSchema,20,1)}),20),sentiment:enumeration(['positive','neutral','negative','mixed','unknown']),intent:enumeration(['question','complaint','request','other','unknown']),urgency:enumeration(['normal','urgent','critical','unknown']),entities:array(object({type:enumeration(['product_mention','order_mention']),value:text(200),evidence:array(spanSchema,5,1)}),20),abstention:{anyOf:[{type:'null'},object({reason:enumeration(['insufficient_evidence','ambiguous','out_of_taxonomy'])})]}});
}
// Deliberately restricted validator for the schema constructed above, not general JSON Schema.
function matches(value,schema) {
  if(schema.anyOf) return schema.anyOf.some(s=>matches(value,s));
  if(schema.type==='null') return value===null;
  if(schema.type==='object') return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===schema.required.length&&schema.required.every(k=>Object.hasOwn(value,k)&&matches(value[k],schema.properties[k]));
  if(schema.type==='array') return Array.isArray(value)&&value.length>=schema.minItems&&value.length<=schema.maxItems&&value.every(x=>matches(x,schema.items));
  if(schema.type==='integer') return Number.isSafeInteger(value)&&value>=schema.minimum;
  if(schema.type==='string') return typeof value==='string'&&(!schema.enum||schema.enum.includes(value))&&(!schema.minLength||[...value].length>=schema.minLength)&&(!schema.maxLength||[...value].length<=schema.maxLength)&&(!schema.pattern||new RegExp(schema.pattern).test(value));
  return false;
}
export function validateRevisions(revisions,tenantId) {
  if(typeof tenantId!=='string'||!tenantId||!Array.isArray(revisions)||!revisions.length||revisions.length>500) return false;
  const ids=new Set();
  for(const r of revisions) {
    if(!r||r.tenant_id!==tenantId||typeof r.message_revision_id!=='string'||!r.message_revision_id||r.message_revision_id.length>200||ids.has(r.message_revision_id)||!['customer','agent','internal'].includes(r.role)||typeof r.text!=='string'||r.text.length>100000||!r.text.isWellFormed()) return false;
    ids.add(r.message_revision_id);
  }
  return true;
}
export function validateEvidence(spans,revisions,{tenantId}={}) {
  const fail={ok:false,error:{code:'invalid_evidence'}};
  if(!validateRevisions(revisions,tenantId)||!Array.isArray(spans)||spans.length>1000) return fail;
  const allowed=new Map(revisions.map(r=>[r.message_revision_id,r]));
  for(const span of spans) {
    if(!matches(span,evidenceSchema)) return fail;
    const r=allowed.get(span.message_revision_id);
    if(!r||r.role!==span.role) return fail;
    const points=[...r.text];
    if(span.end<=span.start||span.end>points.length||points.slice(span.start,span.end).join('')!==span.quote||sha256(span.quote)!==span.quote_hash) return fail;
  }
  return {ok:true};
}
export function validateExtraction(value,revisions,{taxonomy,tenantId}={}) {
  const fail={ok:false,error:{code:'invalid_output'}};
  try {
    if(JSON.stringify(value).length>100000||!matches(value,extractionSchema(taxonomy))) return fail;
    if(value.abstention!==null) {
      if(value.issues.length||value.entities.length||[value.sentiment,value.intent,value.urgency].some(x=>x!=='unknown')) return fail;
    } else if(!value.issues.length) return fail;
    const spans=[...value.issues.flatMap(i=>i.evidence),...value.entities.flatMap(e=>e.evidence)];
    if(!validateEvidence(spans,revisions,{tenantId}).ok) return fail;
    if(value.entities.some(e=>!e.evidence.some(s=>s.quote.includes(e.value)))) return fail;
    return {ok:true,data:value};
  } catch {return fail;}
}

/** Provider schema excludes hashes: only deterministic server code computes them. */
export function validateModelExtraction(value,revisions,options) {
  try {
    if(JSON.stringify(value).length>100000||!matches(value,extractionSchema(options.taxonomy,{modelOutput:true})))return {ok:false,error:{code:'invalid_output'}};
    const enriched=structuredClone(value);
    for(const item of [...enriched.issues,...enriched.entities])for(const span of item.evidence)span.quote_hash=sha256(span.quote);
    return validateExtraction(enriched,revisions,options);
  }catch{return {ok:false,error:{code:'invalid_output'}};}
}
