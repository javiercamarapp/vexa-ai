import type {Money,CurrencyCatalog,Provenance} from './money.mjs';
import type {EconomicScope} from './repository.mjs';
export type MetricEnvelope={key:string;label:string;money:Money|null;display:string;configurationStatus:'ready'|'catalog_required'|'catalog_mismatch';modeled:boolean;native:{amountMinor:string|null;knownSubtotalMinor:string|null;currency:string;exponent:number}};
export function adaptMoneyMetric(metric:any,options:{tenantId:string;catalog:CurrencyCatalog;scope:EconomicScope;metricId:string;grain?:string;additive?:boolean;provenance?:Provenance[]}):Money;
export function formatMetricEnvelope(envelope:MetricEnvelope,options:{catalog:CurrencyCatalog;locale?:string}):string;
