import type {BudgetRepository} from './budget.js';
export type Purpose='extraction'|'explorer'|'embedding'|'brief';
export type BudgetView={id:string;jobId:string;purpose:Purpose;window:string;taskKey:string;state:'reserved'|'uncertain'|'settled'|'released';heldMinor:string;actualMinor:string|null;reportedMinor:string;version:number};
import type {DatabaseAction,DatabaseScope} from '../platform/src/db.js';
export interface DurableBudgetRepository extends BudgetRepository {
 configure(input:{window:string;limitMinor:string;purpose:Purpose|'all';expectedVersion?:number}):Promise<{id:string;version:number;purpose:Purpose|'all';window:string;limitMinor:string}>;
 list(input:{window:string}):Promise<BudgetView[]>;
 reconcile(input:{reservationId:string;expectedVersion:number;actualMinor:string;evidenceHash:string;confirmedProviderEvidence:true}):Promise<BudgetView>;
}
export function createDurableBudgetRepository(options:{database:{transaction<T>(action:DatabaseAction,work:(scope:DatabaseScope)=>Promise<T>):Promise<T>};purpose:Purpose;jobId:string;ownerToken?:string}):DurableBudgetRepository;
