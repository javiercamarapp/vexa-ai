export const ESTADO_CARGA:Readonly<Record<string,string>>;
export const TONO_CARGA:Readonly<Record<string,string>>;
export function estadoCarga(estado:string):string;
export function tonoCarga(estado:string):'ok'|'warn'|'bad'|'info'|'muted';
export function filasConfirmadas(n:number|string):string;
export function ultimoProgreso(iso:string|null|undefined):string;
export function errorDeCarga(status:number|undefined,code?:string):{tipo:'inexistente'|'sin-acceso'|'no-configurado'|'reintentar';mensaje:string};
export function reintentable(tipo:string):boolean;

export function hayErroresParaDescargar(rechazadas:unknown):boolean;
