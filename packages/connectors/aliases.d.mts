import type {DatabaseScope,DatabaseAction} from '../platform/src/db.js';
export interface AliasDatabase {transaction<T>(action:DatabaseAction,work:(scope:DatabaseScope)=>Promise<T>):Promise<T>}
export interface AliasApproval {sourceConversationId:string;expectedVersion:number;evidenceRef:string;reason:string;approved:true}
export interface AliasEvent {id:string;tenant_id:string;source:string;account_id:string;entity_type:'conversation';external_id:string;canonical_id:string;source_conversation_id:string|null;operation:'confirm'|'undo'|null;previous_version:number|null;version:number;evidence_ref:string|null;reason:string|null;approved_by:string|null;created_at:Date|string;updated_at:Date|string;provenance:Record<string,unknown>}
export interface AliasIdentity {conversation_id:string;connection_id:string;source:string;account_id:string;entity_type:string;external_id:string;identity_key:string}
export function createAliasRepository(options:{database:AliasDatabase}):Readonly<{
 propose(input:{sourceConversationId:string;targetConversationId:string}):Promise<{status:'proposed';source:AliasIdentity;target:AliasIdentity;expectedVersion:number;requiresApproval:true;legacyUnresolved:boolean}>;
 confirm(input:AliasApproval&{targetConversationId:string}):Promise<AliasEvent>;
 undo(input:AliasApproval):Promise<AliasEvent>;
 resolve(input:{conversationId:string}):Promise<{conversation_id:string;canonical_id:string;version:number}>;
 list():Promise<Array<{canonical_id:string;conversation_ids:string[]}>>;
 history(input:{sourceConversationId:string}):Promise<AliasEvent[]>;
}>;

export function projectAliases(rows:Array<Record<string,unknown>>,events:Array<Record<string,unknown>>):{rows:Array<Record<string,unknown>>;resolve(id:string):{conversation_id:string;canonical_id:string;version:number}};
