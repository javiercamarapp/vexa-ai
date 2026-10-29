import type {Metric,RecordView} from '../../lib/workspace/contracts';
export type CfoMetric=Metric & {status?:string;coverage?:{known_n:number;eligible_n:number};missing_reasons?:string[]};
export type Coverage={label:string;bps:number|null;known:number|null;eligible:number|null};
export type CfoRow={key:string;recordId:string;recordTitle:string;version:number;metric:CfoMetric;amount:string|null;display:string;subtotal:string|null;knownSubtotal:string|null;state:'invalid'|'known'|'unknown';coverage:Coverage;reasons:string[];validUnit:boolean};
export function ratioBps(numerator:bigint,denominator:bigint):number|null;
export function metricCoverage(value:unknown,idioma?:string):Coverage;
export function buildCfoModel(items:RecordView[],idioma?:string):{rows:CfoRow[];compatible:boolean;maximum:string|null;currency:string|null;bars:(CfoRow & {bps:number|null;negative:boolean})[];comparisonNote:string};

export function kpiHeadline(row:CfoRow,idioma?:string):{value:string;label:string|null;note:string};

export const TXT:Record<'es'|'en',Record<string,any>>;
