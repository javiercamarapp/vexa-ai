export const TTL_MS:number;export const VIDA_MS:number;
export function claveCache(recurso:string,consulta:string):string;
export function guardarCache(clave:string,datos:unknown,opciones?:{ahora?:number;almacen?:Storage|null}):void;
export function leerCache(clave:string,opciones?:{ahora?:number;almacen?:Storage|null}):{datos:unknown;edadMs:number;fresca:boolean}|null;
export function invalidarCache(opciones?:{almacen?:Storage|null}):void;
export function olvidarMemoria():void;
export function guardarVista(clave:string,vista:unknown,opciones?:{almacen?:Storage|null}):void;
export function leerVista(clave:string,opciones?:{almacen?:Storage|null}):unknown;
export function hace(ms:number):string;
