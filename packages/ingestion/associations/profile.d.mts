export const ASSOCIATION_PROFILE:'hubspot-ticket-contact-association-v1';
export const associationFields:string[];
export interface AssociationProof {sourceFileSha256:string;sourceIndex:number;field:string}
export interface AssociationBridge {schema:'association-bridge-v1';property:{status:'missing'|'malformed'|'valid';value:string|null;proof:AssociationProof};notes:{gorgiasId:string;proof:AssociationProof}[];archivedTicket:boolean;sourceNamespaceCandidates:string[]}
export interface AssociationPayload {schema:'association-payload-v1';provider:'hubspot';portalId:string;ticketId:string;contactId:string;nativePair:{from:{id:string};to:{toObjectId:string|number;associationTypes:Record<string,unknown>[];[key:string]:unknown}};source:{sourceFile:string;sourceFileSha256:string;sourceIndex:number;pairIndex:number;containerSha256:string;sourceObservedAt:string};bridge:AssociationBridge;evidenceHash:string;sourceVersionHash:string;globalOrdinal:number}
export interface AssociationRecord {profile:typeof ASSOCIATION_PROFILE;association:AssociationPayload;row_ref:string|number;row_hash:string;batch_hash:string;mapping_version:string;payload_ref:string}
export function associationColumns(columns:unknown):Record<string,string>;
export function associationPayload(headers:unknown,cells:unknown,columns:unknown):AssociationPayload;
export function associationFactId(input:{tenantId:string;connectionId:string;provider:string;portalId:string;ticketId:string;contactId:string}):string;
export function associationEvidenceHash(payload:Pick<AssociationPayload,'nativePair'|'source'|'bridge'>):string;
export function validateAssociationRecord(record:unknown,scope:{tenantId:string;connectionId:string;fileHash:string;mappingVersion:string}):AssociationPayload;
