import type {MoneyWindow} from './scope.mjs';
export interface CurrencyCatalog {version:string;currencies:Record<string,number>}
export interface Provenance {source:string;reference:string;version:string}
export interface Money {metric_id:string;tenant_id:string;currency:string;exponent:number;catalog_version:string;window:MoneyWindow;basis:string;grain:string;amount_minor:string|null;known_subtotal:string|null;coverage:{known_n:number;eligible_n:number};status:'complete'|'partial'|'unavailable'|'not_applicable';missing_reasons:string[];provenance:Provenance[];additive:boolean}
export interface ApprovedFx {approved:true;approval_ref:string;source:string;date:string;version:string;base:string;quote:string;rate:string;rounding:'half_up'|'half_even'|'toward_zero'}
export interface FxConversion extends ApprovedFx {exact_rate:{numerator:string;denominator:string}}
export class MoneyContractError extends Error {code:string;constructor(code:string)}
export function validateMoney(input:Money,catalog:CurrencyCatalog):Money;
export function sumMoney(inputs:Money[],options:{catalog:CurrencyCatalog}):Money;
export function convertMoney(input:Money,options:{catalog:CurrencyCatalog;targetCurrency:string;fx?:ApprovedFx|null}):{original:Money;converted:Money;conversion:FxConversion|null};
export function formatMinorUnits(amountMinor:string|null,currency:string,exponent:number,locale?:string):string;
export function formatMoney(input:Money,options:{catalog:CurrencyCatalog;locale?:string}):string;
