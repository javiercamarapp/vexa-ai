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

// Optional server-owned object/episode protocol. Absence is handled by callers,
// never by coercing malformed presence to a legacy configuration.
const semanticVersion='object-episode-v1';
const closed=(value,fields)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k));
const semanticFail=code=>{throw Object.assign(new Error(code),{semanticCode:code});};
const canonicalSemantic=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item);
export function semanticProfile(value,taxonomy){
  extractionSchema(taxonomy);
  if(!closed(value,['version','enabled','taxonomyHash','conditions'])||value.version!==semanticVersion||value.enabled!==true||taxonomy.length!==45||value.taxonomyHash!==sha256(JSON.stringify(taxonomy))||!Array.isArray(value.conditions)||value.conditions.length!==taxonomy.length)semanticFail('policy_mismatch');
  const conditions=value.conditions.map((row,index)=>{
    if(!closed(row,['category','requiredEpisode'])||row.category!==taxonomy[index]||!['any','independent_acquisition'].includes(row.requiredEpisode))semanticFail('policy_mismatch');
    return {category:row.category,requiredEpisode:row.requiredEpisode};
  });
  const policy={version:semanticVersion,enabled:true,taxonomyHash:value.taxonomyHash,conditions};
  return {policy,hash:sha256(JSON.stringify(policy))};
}
export const semanticInstructions="\nThe enabled object-episode-v1 protocol replaces partial classification with an explicit typed decision for every distinct need. Return needs before issues and link every issue by needId. A primary object is the functional object of the episode, while a requested object may be its component or the subject of a question. A new component for an acquired primary object remains restore_existing_use/acquired, not independent_acquisition. An independently requested additional unit can be not_acquired even when its name and model equal an owned unit. Do not merge episodes by identical names. Use independent_acquisition only with customer context supporting a new acquisition of the primary object. Copy each object anchor as an exact literal of at most 200 Unicode points with one available evidence ref; never invent or normalize a literal or infer a quoted speaker. requestEvidence and contextEvidence contain only supplied ref strings. Respect the supplied semantic_policy conditions for each category: independent_acquisition requires that purpose, not_acquired primaryState, both object anchors, same_object or component_of relation and context evidence. restore_existing_use requires acquired primaryState, both anchors, same_object or component_of and context evidence. purpose other permits unknown objects for non-product needs. purpose unknown must be ambiguous. Classified needs require issues; unresolved needs cannot have issues. Do not conceal an unresolved need to publish a partial success: mixed classified and unresolved needs are quarantined. All-unresolved output must use total abstention, no issues/entities and unknown sentiment/intent/urgency; use ambiguous if any need is ambiguous, otherwise out_of_taxonomy. Empty needs require insufficient_evidence with the same empty/unknown shape. Keep labels literal and use the most specific supported category. These typed claims and exact citations do not prove semantic truth. Return no free-form reasoning.\nAssess ambiguity by whether missing context could change category eligibility or the relevant episode. Missing identifying detail alone does not require abstention when the request and category conditions are supported; an exact generic object phrase can be a valid anchor. Do not invent details or entities.\nResolve references across revisions before enumerating needs. Follow-ups, paraphrases, operational updates and quoted repetitions that context links to the same request and episode belong to one need with combined evidence. Preserve separately supported objectives or episodes, including additional units of the same model. Identical labels or literals alone do not prove continuity; different wording alone does not prove independence.";
export function semanticWireSchema(schema,refs){
  const out=structuredClone(schema),ref=enumeration([...refs.evidence.keys()]);
  const anchor={anyOf:[{type:'null'},object({literal:text(200),evidence:ref})]};
  const need=object({id:enumeration(Array.from({length:20},(_,i)=>'n'+i)),primaryObject:anchor,requestedObject:anchor,relationToPrimary:enumeration(['same_object','component_of','unknown']),primaryState:enumeration(['acquired','not_acquired','unknown']),purpose:enumeration(['restore_existing_use','independent_acquisition','other','unknown']),requestEvidence:array(ref,5,1),contextEvidence:array(ref,5),disposition:enumeration(['classified','ambiguous','out_of_taxonomy'])});
  out.properties={needs:array(need,20),...out.properties};out.required=['needs',...out.required];
  const issue=out.properties.issues.items;issue.properties.needId=enumeration(Array.from({length:20},(_,i)=>'n'+i));issue.required.push('needId');issue.properties.evidence.items=ref;
  return out;
}
const normalizedNeedSchema=object({id:enumeration(Array.from({length:20},(_,i)=>'n'+i)),primaryObject:{anyOf:[{type:'null'},evidenceSchema]},requestedObject:{anyOf:[{type:'null'},evidenceSchema]},relationToPrimary:enumeration(['same_object','component_of','unknown']),primaryState:enumeration(['acquired','not_acquired','unknown']),purpose:enumeration(['restore_existing_use','independent_acquisition','other','unknown']),requestEvidence:array(evidenceSchema,5,1),contextEvidence:array(evidenceSchema,5),disposition:enumeration(['classified','ambiguous','out_of_taxonomy'])});
const sameSemantic=(a,b)=>canonicalSemantic(a)===canonicalSemantic(b);
const uniqueSpans=spans=>new Set(spans.map(canonicalSemantic)).size===spans.length;
function safeAnchor(literal,span,revisions){
  if(typeof literal!=='string'||!literal.isWellFormed()||![...literal].length||[...literal].length>200)semanticFail('invalid_anchor');
  const source=revisions.find(r=>r.message_revision_id===span.message_revision_id);
  if(!source)semanticFail('invalid_anchor');
  const points=[...source.text],start=points.slice(0,span.start).join('').length,end=points.slice(0,span.end).join('').length;
  const markers=[...source.text.matchAll(/\[(?:PII|REDACTED)\]/g)].map(m=>[m.index,m.index+m[0].length]);
  for(let at=source.text.indexOf(literal,start);at!==-1&&at+literal.length<=end;at=source.text.indexOf(literal,at+1)){
    if(markers.some(([a,b])=>a<at+literal.length&&b>at))continue;
    const offset=[...source.text.slice(0,at)].length;
    return {message_revision_id:source.message_revision_id,start:offset,end:offset+[...literal].length,quote:literal,quote_hash:sha256(literal),role:source.role};
  }
  semanticFail('invalid_anchor');
}
function semanticWindows(revisions){
  return revisions.flatMap(r=>{const points=[...r.text],spans=[];for(let start=0;start<points.length;start+=3800){const end=Math.min(start+4000,points.length),quote=points.slice(start,end).join('');spans.push({message_revision_id:r.message_revision_id,start,end,quote,quote_hash:sha256(quote),role:r.role});if(end===points.length)break;}return spans;});
}
export function decodeSemanticWire(value,schema,refs,revisions){
  if(Buffer.byteLength(JSON.stringify(value))>100000||!matches(value,schema))semanticFail('invalid_reference');
  const resolve=ref=>{const span=refs.evidence.get(ref);if(!span)semanticFail('invalid_reference');return {...structuredClone(span),quote_hash:sha256(span.quote)};};
  const needs=value.needs.map((n,index)=>{
    if(n.id!=='n'+index||new Set(n.requestEvidence).size!==n.requestEvidence.length||new Set(n.contextEvidence).size!==n.contextEvidence.length)semanticFail('invalid_reference');
    const anchors={};for(const k of ['primaryObject','requestedObject'])anchors[k]=n[k]===null?null:safeAnchor(n[k].literal,resolve(n[k].evidence),revisions);
    return {...structuredClone(n),...anchors,requestEvidence:n.requestEvidence.map(resolve),contextEvidence:n.contextEvidence.map(resolve)};
  });
  const wireData=structuredClone(value),issueNeedIds=value.issues.map(i=>i.needId);
  for(const issue of value.issues){const need=value.needs.find(n=>n.id===issue.needId);if(!need)semanticFail('invalid_reference');const allowed=new Set([...need.requestEvidence,...need.contextEvidence,...[need.primaryObject,need.requestedObject].filter(Boolean).map(a=>a.evidence)]);if(issue.evidence.some(ref=>!allowed.has(ref)))semanticFail('invalid_reference');}
  delete wireData.needs;for(const issue of wireData.issues)delete issue.needId;
  return {wireData,needs,issueNeedIds};
}
const semanticSourceHash=revisions=>sha256(JSON.stringify(revisions.map(r=>({id:r.message_revision_id,role:r.role,hash:sha256(r.text)}))));
export function semanticBasisFor(data,needs,issueNeedIds,revisions,profile){
  return {version:semanticVersion,semanticPolicyHash:profile.hash,sourceBindingHash:semanticSourceHash(revisions),resultBindingHash:sha256(canonicalSemantic(data)),needs,issueNeedIds,status:data.abstention?'abstained':'coherent'};
}
export function validateSemanticBasis(basis,data,revisions,{taxonomy,tenantId,profile}){
  try{
    if(!closed(basis,['version','semanticPolicyHash','sourceBindingHash','resultBindingHash','needs','issueNeedIds','status'])||basis.version!==semanticVersion||basis.semanticPolicyHash!==profile.hash)semanticFail('policy_mismatch');
    if(Buffer.byteLength(JSON.stringify(basis))>100000)semanticFail('basis_too_large');
    if(basis.sourceBindingHash!==semanticSourceHash(revisions))semanticFail('source_binding_mismatch');
    if(basis.resultBindingHash!==sha256(canonicalSemantic(data)))semanticFail('result_binding_mismatch');
    if(!validateExtraction(data,revisions,{taxonomy,tenantId}).ok||!matches(basis.needs,array(normalizedNeedSchema,20))||!Array.isArray(basis.issueNeedIds)||basis.issueNeedIds.length!==data.issues.length)semanticFail('invalid_reference');
    const windows=semanticWindows(revisions),condition=new Map(profile.policy.conditions.map(c=>[c.category,c.requiredEpisode]));
    for(const [index,n] of basis.needs.entries()){
      if(n.id!=='n'+index||!uniqueSpans(n.requestEvidence)||!uniqueSpans(n.contextEvidence))semanticFail('invalid_reference');
      const spans=[...n.requestEvidence,...n.contextEvidence];
      if(!validateEvidence(spans,revisions,{tenantId}).ok||spans.some(s=>!windows.some(w=>sameSemantic(s,w))))semanticFail('invalid_reference');
      const anchorWindows=[];
      for(const anchor of [n.primaryObject,n.requestedObject].filter(Boolean)){
        if(!validateEvidence([anchor],revisions,{tenantId}).ok||[...anchor.quote].length>200)semanticFail('invalid_anchor');
        const supporting=windows.filter(w=>{try{return sameSemantic(safeAnchor(anchor.quote,w,revisions),anchor);}catch{return false;}});
        if(!supporting.length)semanticFail('invalid_anchor');anchorWindows.push(...supporting);
      }
      const issues=data.issues.filter((_,i)=>basis.issueNeedIds[i]===n.id);
      if((n.disposition==='classified')!==!!issues.length)semanticFail('episode_incoherent');
      if(n.purpose==='unknown'&&n.disposition!=='ambiguous')semanticFail('episode_incoherent');
      if(['restore_existing_use','independent_acquisition'].includes(n.purpose)&&(!n.primaryObject||!n.requestedObject||!['same_object','component_of'].includes(n.relationToPrimary)||!n.contextEvidence.length||n.primaryState!==(n.purpose==='restore_existing_use'?'acquired':'not_acquired')))semanticFail('episode_incoherent');
      for(const issue of issues){
        if(issue.evidence.some(s=>![...spans,...anchorWindows].some(w=>sameSemantic(s,w))))semanticFail('invalid_reference');
        if(!condition.has(issue.category)||condition.get(issue.category)==='independent_acquisition'&&n.purpose!=='independent_acquisition')semanticFail('category_condition_unsatisfied');
      }
    }
    if(basis.issueNeedIds.some(id=>!basis.needs.some(n=>n.id===id)))semanticFail('invalid_reference');
    const classified=basis.needs.filter(n=>n.disposition==='classified');
    if(classified.length&&classified.length!==basis.needs.length)semanticFail('mixed_unresolved_needs');
    if(!classified.length){
      const reason=!basis.needs.length?'insufficient_evidence':basis.needs.some(n=>n.disposition==='ambiguous')?'ambiguous':'out_of_taxonomy';
      if(data.abstention?.reason!==reason||data.issues.length||data.entities.length||[data.sentiment,data.intent,data.urgency].some(v=>v!=='unknown')||basis.status!=='abstained')semanticFail('episode_incoherent');
    }else if(data.abstention!==null||basis.status!=='coherent')semanticFail('episode_incoherent');
    return {ok:true};
  }catch(e){return {ok:false,code:semanticCodes.includes(e?.semanticCode)?e.semanticCode:'invalid_reference'};}
}
const semanticCodes=['invalid_anchor','invalid_reference','episode_incoherent','category_condition_unsatisfied','mixed_unresolved_needs','source_binding_mismatch','result_binding_mismatch','policy_mismatch','basis_too_large'];
export function semanticDiagnostic(profile,code,needs=[]){return {version:semanticVersion,semanticPolicyHash:profile.hash,code:semanticCodes.includes(code)?code:'invalid_reference',needIds:Array.isArray(needs)?needs.map(n=>n?.id).filter((id,i)=>id==='n'+i).slice(0,20):[]};}
