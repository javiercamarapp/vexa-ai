export const BASE_LINEA:string;export const BASE_REEMBOLSO:string;export const BASE_SHOPIFY:string;
export const ETIQUETA_BASE:Readonly<Record<string,string>>;
export function baseDe(basis:unknown):string;export function esARevisar(basis:unknown):boolean;
export type FilaLibro={month:string;kind:string;status:string;currency:string;exponent:number|string;basis?:string|null;n:number|string;known?:number|string;[k:string]:unknown};
export function ingresosDelLibro(rows:FilaLibro[]):{filas:FilaLibro[];moneda:string|null;exponente:number|null;base:string|null;etiquetaBase:string|null;otrasBases:{base:string;etiqueta:string}[];otrasMonedas:string[];aRevisar:number};
