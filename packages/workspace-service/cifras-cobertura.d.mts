export const SQL_ANALIZADAS:string;export const BASE_ANALISIS:string;
export type CoberturaAnalisis={n:number|null;de:number|null;pct:number|null;texto:string;base:string;estimado:boolean;nota:string};
export function coberturaAnalisisIA(a?:{analizadas?:unknown;base?:unknown;estimado?:boolean}):CoberturaAnalisis;
export function coberturaIncorporacion(hub:unknown):{incorporadas:number;de:number;pct:number;texto:string;base:string}|null;
