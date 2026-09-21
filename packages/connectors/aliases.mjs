/** Durable, explicit conversation identity approvals. Inject the existing server createDatabase boundary. */
import {identityKey} from '../ingestion/index.mjs';
const fail=message=>{throw Object.assign(new Error(message),{code:'23514'});};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const tuple=r=>JSON.stringify([r.source,r.account_id,r.entity_type,r.external_id]);
function approval(input){
 if(input?.approved!==true)fail('ALIAS_APPROVAL_REQUIRED');
 if(!uuid(input.sourceConversationId))fail('ALIAS_ID_INVALID');
 if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||input.expectedVersion>=2147483647)fail('ALIAS_VERSION_INVALID');
 if(typeof input.evidenceRef!=='string'||!input.evidenceRef.trim()||input.evidenceRef.length>2000)fail('ALIAS_EVIDENCE_REQUIRED');
 if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000)fail('ALIAS_REASON_REQUIRED');
 // Snapshot caller-controlled values before entering an asynchronous transaction.
 return {sourceConversationId:input.sourceConversationId,targetConversationId:input.targetConversationId,expectedVersion:input.expectedVersion,evidenceRef:input.evidenceRef.trim(),reason:input.reason.trim()};
}
function describe(row){
 return {conversation_id:row.id,connection_id:row.connection_id,source:row.source,account_id:row.account_id,entity_type:row.entity_type,external_id:row.external_id,
 identity_key:identityKey({tenant_id:row.tenant_id,connection_id:row.connection_id,source:row.source,source_account_id:row.account_id,entity_type:row.entity_type,external_id:row.external_id})};
}
/** Shared pure projection; SQL callers must supply one authorized, consistent dataset. */
export function projectAliases(rows,events){
  const latest=new Map();for(const event of events)latest.set(tuple(event),event);
  const byId=new Map(rows.map(row=>[row.id,row]));
  const byTuple=new Map();
  for(const row of rows){
   if(row.entity_type!=='conversation'||row.source!==row.connection_source||row.provenance?.source!==row.source||row.provenance?.account_id!==row.account_id)fail('ALIAS_SOURCE_IDENTITY_CHANGED');
   if(row.revision_state==='ambiguous'||byTuple.has(tuple(row)))fail('ALIAS_IDENTITY_AMBIGUOUS');
   byTuple.set(tuple(row),row);
  }
  const edges=new Map(),versions=new Map();
  for(const event of latest.values()){
   if(!event.operation)fail('ALIAS_LEGACY_UNRESOLVED');
   const original=byTuple.get(tuple(event));
   if(!original||original.id!==event.source_conversation_id||!byId.has(event.canonical_id))fail('ALIAS_SOURCE_IDENTITY_CHANGED');
   versions.set(original.id,event.version);
   if(event.operation==='confirm')edges.set(original.id,event.canonical_id);
  }
  const resolve=id=>{
   if(!byId.has(id))fail('ALIAS_CONVERSATION_UNAVAILABLE');
   const seen=new Set();let canonical=id;
   while(edges.has(canonical)){if(seen.has(canonical))fail('ALIAS_CYCLE');seen.add(canonical);canonical=edges.get(canonical);}
   return {conversation_id:id,canonical_id:canonical,version:versions.get(id)??0};
  };
  return {rows,resolve};
}
export function createAliasRepository({database}={}){
 if(typeof window!=='undefined'||typeof database?.transaction!=='function')fail('ALIAS_DATABASE_REQUIRED');
 async function source(scope,id){
  const row=(await scope.query('SELECT c.*,x.account_id,x.source AS connection_source FROM public.conversations c JOIN public.connections x ON x.tenant_id=c.tenant_id AND x.id=c.connection_id WHERE c.tenant_id=$1 AND c.id=$2',[scope.tenantId,id])).rows[0];
  if(!row)fail('ALIAS_CONVERSATION_UNAVAILABLE');
  if(row.entity_type!=='conversation'||row.source!==row.connection_source||row.provenance?.source!==row.source||row.provenance?.account_id!==row.account_id)fail('ALIAS_SOURCE_IDENTITY_CHANGED');
  return row;
 }
 async function load(scope){
  const rows=(await scope.query('SELECT c.*,x.account_id,x.source AS connection_source,h.state AS revision_state FROM public.conversations c JOIN public.connections x ON x.tenant_id=c.tenant_id AND x.id=c.connection_id LEFT JOIN public.source_heads h ON h.tenant_id=c.tenant_id AND h.id=c.id WHERE c.tenant_id=$1 ORDER BY c.id',[scope.tenantId])).rows;
  const events=(await scope.query('SELECT * FROM public.external_aliases WHERE tenant_id=$1 ORDER BY version,id',[scope.tenantId])).rows;
  return projectAliases(rows,events);
 }
 async function append(input,operation){
  const a=approval(input);
  if(operation==='confirm'&&!uuid(a.targetConversationId))fail('ALIAS_ID_INVALID');
  return database.transaction('configure',async scope=>{
   const original=await source(scope,a.sourceConversationId);
   // actor is selected by PostgreSQL; no body identity or mutable session cache is authoritative.
   const result=await scope.query(`INSERT INTO public.external_aliases
    (tenant_id,source,account_id,entity_type,external_id,canonical_id,source_conversation_id,operation,previous_version,version,evidence_ref,reason,approved_by,provenance)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,auth.uid(),$13) RETURNING *`,
    [scope.tenantId,original.source,original.account_id,original.entity_type,original.external_id,operation==='undo'?original.id:a.targetConversationId,original.id,operation,a.expectedVersion,a.expectedVersion+1,a.evidenceRef,a.reason,JSON.stringify({kind:'explicit-conversation-alias-v1',source_identity:describe(original).identity_key})]);
   return result.rows[0];
  });
 }
 return Object.freeze({
  /** A proposal carries identity and CAS version only. It never inserts an approval or merges sources. */
  async propose({sourceConversationId,targetConversationId}){
   if(!uuid(sourceConversationId)||!uuid(targetConversationId)||sourceConversationId===targetConversationId)fail('ALIAS_ID_INVALID');
   return database.transaction('propose',async scope=>{
    const original=await source(scope,sourceConversationId),target=await source(scope,targetConversationId);
    const events=(await scope.query('SELECT version,operation FROM public.external_aliases WHERE tenant_id=$1 AND source=$2 AND account_id=$3 AND entity_type=$4 AND external_id=$5 ORDER BY version DESC LIMIT 1',[scope.tenantId,original.source,original.account_id,original.entity_type,original.external_id])).rows;
    return {status:'proposed',source:describe(original),target:describe(target),expectedVersion:events[0]?.version??0,requiresApproval:true,legacyUnresolved:events.length>0&&events[0].operation===null};
   });
  },
  confirm:input=>append(input,'confirm'),
  undo:input=>append(input,'undo'),
  async resolve({conversationId}){
   if(!uuid(conversationId))fail('ALIAS_ID_INVALID');
   return database.transaction('read',async scope=>(await load(scope)).resolve(conversationId));
  },
  /** Projection only: stable original IDs and snapshots remain in their original tables. */
  async list(){return database.transaction('read',async scope=>{
   const state=await load(scope),groups=new Map();
   for(const row of state.rows){const canonical=state.resolve(row.id).canonical_id;if(!groups.has(canonical))groups.set(canonical,{canonical_id:canonical,conversation_ids:[]});groups.get(canonical).conversation_ids.push(row.id);}
   return [...groups.values()].sort((a,b)=>a.canonical_id.localeCompare(b.canonical_id));
  });},
  async history({sourceConversationId}){
   if(!uuid(sourceConversationId))fail('ALIAS_ID_INVALID');
   return database.transaction('read',async scope=>{
    const original=await source(scope,sourceConversationId);
    return (await scope.query('SELECT * FROM public.external_aliases WHERE tenant_id=$1 AND source=$2 AND account_id=$3 AND entity_type=$4 AND external_id=$5 ORDER BY version,id',[scope.tenantId,original.source,original.account_id,original.entity_type,original.external_id])).rows;
   });
  },
 });
}
