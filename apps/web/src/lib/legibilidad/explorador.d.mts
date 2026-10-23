export const AVISO_TERCEROS:string;
export const AVISO_IMPORTE:string;
export const claveCita:(c:{messageRevisionId?:string;quoteHash?:string;quote?:string})=>string;
export function agruparCitas<T extends {messageRevisionId?:string;quoteHash?:string;quote?:string}>(citas:T[]|null|undefined):(T&{veces:number})[];
export const citasDistintas:(citas:unknown[]|null|undefined)=>number|null;
export const hayImporteConocido:(items:{metrics?:{amount_minor:string|null|undefined}[]}[]|null|undefined)=>boolean;
export const textoConversaciones:(n:number|null|undefined)=>string|null;
export const textoCitas:(n:number|null|undefined)=>string|null;
export function resumenResultados(o:{total:number;texto?:string;estado?:string}):string;
