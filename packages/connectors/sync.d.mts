import type {HubSpotConfig,ZendeskConfig} from './index.js';
import type {SourceContext} from '../ingestion/index.js';
export interface SyncWindow {from:string;to:string;overlapSeconds:number;version:string;fetchFrom?:string}
export interface SyncPage {records:unknown[];errors:unknown[];checkpoint:unknown;done:boolean;coverage?:Record<string,unknown>}
export interface SyncRow {id:string;tenant_id:string;connection_id:string;import_id:string;scope_hash:string;mode:'live'|'backfill';window_spec:SyncWindow;mapping_version:string;checkpoint:unknown;version:string|number;done:boolean;worker_id:string|null;fence:string|number;lease_until:Date|null;context?:SourceContext;counts?:Record<string,number>}
export interface SyncOwnership {syncId:string;workerId:string;fence:number}
export interface SyncInput {connectionId:string;mode:'live'|'backfill';window:SyncWindow;mappingVersion?:'crm-canonical-v1'}
export interface SyncDatabase {transaction<T>(action:'read'|'import',work:(scope:{tenantId:string;userId:string;query(sql:string,values?:readonly unknown[]):Promise<{rows:any[];rowCount:number|null}>})=>Promise<T>):Promise<T>}
export interface SyncRepository {
 recoverCompleted?(input:{syncId:string}):Promise<void>;
 beginAttempt?(input:{connectionId:string;syncId:string;workerId:string;fence:number}):Promise<{connectionId:string;attemptId:string}>;
 finishAttempt?(input:{connectionId:string;attemptId:string;syncId:string;outcome?:'done'|'continuation';error?:unknown}):Promise<void>;
 ensure(input:SyncInput):Promise<SyncRow>;
 claim(input:{syncId:string;workerId:string;leaseMs?:number}):Promise<SyncRow>;
 current(input:SyncOwnership):Promise<SyncRow & {context:SourceContext}>;
 commitPage(input:SyncOwnership & {expectedVersion:number;page:SyncPage}):Promise<SyncRow>;
 release(input:SyncOwnership):Promise<void>;
 readPayload(input:{importId:string;rowRef:string}|{payloadRef:string}):Promise<{original:unknown;normalized:unknown;result:unknown}|null>;
}
export type SyncAdapterFactory=(input:{context:SourceContext;window:SyncWindow;mode:'live'|'backfill';deadlineMs:number})=>{pages(input:{checkpoint:unknown}):AsyncGenerator<SyncPage>}|Promise<{pages(input:{checkpoint:unknown}):AsyncGenerator<SyncPage>}>;
export function createSyncRepository(input:{database:SyncDatabase}):SyncRepository;
export function normalizeSyncRecord(record:unknown):{code:string}|{envelope:unknown;payload:unknown};
export function createCRMAdapterFactory(config:Partial<HubSpotConfig & ZendeskConfig>):SyncAdapterFactory;
export function runSync(input:SyncInput & {repository:SyncRepository;adapterFactory:SyncAdapterFactory;workerId?:string;leaseMs?:number;maxPages?:number;deadlineMs?:number;clock?:()=>number}):Promise<{state:'done'|'continuation';syncId:string;checkpoint:unknown;version?:number;pages:number}>;
