import type {DatabaseScope,DatabaseAction} from '../../platform/src/db';
export type AssociationState='pending'|'resolved'|'blocked'|'retained';
export type AssociationTarget={conversationId:string;customerId:string;conversationHeadVersion:number;customerHeadVersion:number;conversationRevisionId:string;customerRevisionId:string};
export type OriginEntry={importId:string;connectionId:string;fileHash:string;mappingVersion:string;provider:'hubspot';portalId:string;namespace:'hubspot-contact'|'hubspot-ticket'|'gorgias-ticket';sourceManifestHash:string;sourceInventoryHash:string;sourceReceiptHash:string};
export type AssociationCandidate={id:string;connectionId:string;externalId:string;headVersion:number;revisionId:string;proof:Record<string,unknown>};
export type AssociationFact={id:string;source_connection_id:string;provider:string;portal_id:string;ticket_id:string;contact_id:string;first_evidence_hash:string;source_version_hash:string;resolution_state:AssociationState;reason:string;version:number;selected_evidence_hash:string|null;created_at:string;updated_at:string;retained_at:string|null;candidates?:{conversations:AssociationCandidate[];customers:AssociationCandidate[];nextCursor:string|null}};
export type AssociationEvidence={id:string;import_id:string;row_ref:string;state:string;result:{fact_id:string;evidence_hash:string;evidence:Record<string,unknown>;lineage:Record<string,unknown>;[key:string]:unknown};sharedRawUnavailable:boolean};
export type AssociationBinding={id:string;conversation_id:string;customer_id:string;conversation_revision_id:string;customer_revision_id:string;conversation_head_version:number;customer_head_version:number;active:boolean;current:boolean;[key:string]:unknown};
export type AssociationOrigin={id:string;approvalId:string;version:number;state:'approved'|'revoked';manifestHash:string;entries:OriginEntry[];entryHashes:string[]};
export type AssociationResolution={factId:string;version:number;state:AssociationState;requestId:string;bindingIds:string[]};
export type OriginResolution={approvalId:string;version:number;state:'approved'|'revoked';requestId:string;entryHashes:string[]};
export interface AssociationRepository {
 list(input?:{state?:AssociationState|null;cursor?:string|null;limit?:number;conversationId?:string|null;customerId?:string|null}):Promise<{items:AssociationFact[];nextCursor:string|null;canResolve:boolean}>;
 get(input:{factId:string;evidenceCursor?:string|null;candidateCursor?:string|null}):Promise<{fact:AssociationFact;evidence:{items:AssociationEvidence[];nextCursor:string|null};bindings:AssociationBinding[];canResolve:boolean;sharedRawUnavailable:boolean}>;
 edges(input?:{conversationId?:string|null;customerId?:string|null;cursor?:string|null;limit?:number;provenanceCursor?:string|null}):Promise<{items:{conversationId:string;customerId:string;factIds:string[];provenanceCursor:string|null}[];nextCursor:string|null}>;
 resolve(input:{factId:string;expectedVersion:number;evidenceHash:string;requestId:string;decision:'bind'|'none';targets:AssociationTarget[];reason:string}):Promise<AssociationResolution>;
 approveOrigin(input:{approvalId:string;expectedVersion:0;requestId:string;manifestHash:string;entries:OriginEntry[];reason:string}):Promise<OriginResolution>;
 revokeOrigin(input:{approvalId:string;expectedVersion:number;requestId:string;reason:string}):Promise<OriginResolution>;
 origins(input?:{cursor?:string|null;limit?:number}):Promise<{items:AssociationOrigin[];nextCursor:string|null;canApprove:boolean}>;
}
export function lockAssociationChunk(scope:DatabaseScope,input:{jobId:string;records:unknown[]}):Promise<void>;
export function persistAssociationChunk(scope:DatabaseScope,input:{importId:string;records:unknown[]}):Promise<{processed:number;accepted:number;duplicates:number;rejected:number;pendingFacts:number;blockedFacts:number;resolvedFacts:number;retainedFacts:number}>;
export function createAssociationRepository(input:{database:{transaction<T>(action:DatabaseAction,fn:(scope:DatabaseScope)=>Promise<T>):Promise<T>}}):AssociationRepository;
