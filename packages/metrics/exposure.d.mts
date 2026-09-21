import type {EconomicScope} from './repository.mjs';
import type {LedgerMetric,LedgerInput} from '../economics/adapter.mjs';
export type RelationInput={problemId:string;ledgerRowId:string;expectedVersion:number;active:boolean;report:string;attested:true};
export type AliasInput={aliasRowId:string;canonicalRowId:string;expectedVersion:number;active:boolean;report:string;attested:true};
export type CustomerInput={orderRowId:string;customerKey:string|null;expectedVersion:number;report:string;attested:true};
export type CoverageInput={scope:EconomicScope;expectedInputHash:string;expectedVersion:number;complete:boolean;report:string;attested:true};
export type RelationView={id:string;problemId:string;entityId:string;ledgerRowId:string;kind:string;version:number;active:boolean;valid:boolean;reason:string|null;report:string|null};
export type AliasView={id:string;aliasEntityId:string;canonicalEntityId:string;aliasRowId:string;canonicalRowId:string;version:number;active:boolean;valid:boolean;reason:string|null;report:string|null};
export type CustomerBinding={id:string;entityId:string;orderRowId:string;customerKey:string|null;version:number;valid:boolean;reason:string|null;report:string|null};
export type CustomerMetric={count:number|null;knownCount:number;knownOrderCount:number;totalOrderCount:number;status:string;customerKeys:string[]};
export type EventMetric={refunds:LedgerMetric;replacement:LedgerMetric;supportModel:LedgerMetric;eventIds:string[]};
export type ExposureMetrics={global:LedgerMetric;byProblem:Record<string,LedgerMetric>;problemRowsAreAdditive:false;membership:Array<{problemId:string;orderId:string}>;warning:string;customerExposure:{global:CustomerMetric;byProblem:Record<string,CustomerMetric>};eventUnion:{global:EventMetric;byProblem:Record<string,EventMetric>;problemRowsAreAdditive:false}};
export type ExposureView={inputHash:string;scope:EconomicScope;canonicalAllOrders:LedgerMetric;coverage:{version:number;complete:boolean;current:boolean;report:string|null;reason:string|null}|null;relations:RelationView[];aliases:AliasView[];customerBindings:CustomerBinding[];problemOptions:Array<{id:string;label:string;version:number}>;metrics:ExposureMetrics};
export function createExposureRepository(options:{database:any}):{record(input:RelationInput):Promise<RelationView>;recordAlias(input:AliasInput):Promise<AliasView>;recordCustomer(input:CustomerInput):Promise<CustomerBinding>;recordCoverage(input:CoverageInput):Promise<ExposureView['coverage']>};
/** Internal same-transaction read used by the economic repository. */
export function readExposure(scope:any,input:any):Promise<ExposureView>;
export function calculateExposure(input:LedgerInput):unknown;
