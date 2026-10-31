export type SummaryMeta={source:'summary'|'direct';freshness:string;refreshedAt:string|null;cutoff:string|null;label:string|null};
export type TrendClass='observed'|'estimated';
/** Criterio de «mes completo» (packages/metrics/complete-months.mjs): `data` = hay fecha del último dato cargado; `calendar` = solo se descarta el mes en curso. */
export type Completeness={basis:'data'|'calendar';dataThrough:string|null;partialMonth:string|null;partialMonths:string[]};
export type ConversationTrend={status:'ok'|'empty'|'timeout';class:TrendClass;series:{month:string;count:number}[];outsideWindow:number|null;total:number|null;sampled?:boolean;samplePercent?:number|null;sampleNote?:string|null;definition?:string;undated?:number|null;summary?:SummaryMeta;completeness?:Completeness;analysis?:{status:'ok'|'timeout'|'unavailable';analyzed:number|null}};
export type LedgerMonth={month:string;orders:{count:number;amountMinor:string;unknownAmounts:number};refunds:{count:number;amountMinor:string;unknownAmounts:number}};
export type LedgerTrend={status:'ok'|'empty'|'timeout';class:TrendClass;currency?:string|null;exponent?:number|null;otherCurrencies?:string[];orderBasis?:{base:string;label:string}|null;otherBases?:{base:string;etiqueta:string}[];toReviewRows?:number;series:LedgerMonth[];currencies:string[];summary?:SummaryMeta;completeness?:Completeness};
export type TrendsView={generatedAt:string;window:{start:string;end:string;months:number};note:string;noteKey?:string;conversations:ConversationTrend;ledger:LedgerTrend};
export const TREND_MONTHS:number;export const LOCAL_TIMEOUT_MS:number;export const SAMPLE_PERCENT:number;
export function monthWindow(now?:Date,months?:number):{start:Date;end:Date;list:string[]};
export function createTrendsRepository(options:{database:any;now?:()=>Date;timeoutMs?:number}):{monthly(input?:{months?:number}):Promise<TrendsView>};
