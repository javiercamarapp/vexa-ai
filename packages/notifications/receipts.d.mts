import type {Pool} from 'pg';
export type EmailReceipt={eventId:string;providerId:string;type:string;occurredAt:string;payloadHash:string;bounceKind?:'Permanent'|'Transient'|'Undetermined'|null};
export type ReceiptRepository={resolveRecipient(identity:{tenantId:string;userId:string}):Promise<unknown>;prepare(input:Record<string,unknown>):Promise<unknown>;accepted(input:Record<string,unknown>):Promise<unknown>;record(input:EmailReceipt):Promise<unknown>};
export function createReceiptRepository(options:{pool:Pool}):ReceiptRepository;
export function handleEmailWebhook(request:Request,options:{webhookSecret?:string;repository?:ReceiptRepository;readTimeoutMs?:number}):Promise<Response>;
