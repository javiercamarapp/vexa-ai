export const ESTADO_VINCULO:Readonly<Record<string,string>>;
export const FILTROS_VINCULO:readonly {value:string;label:string}[];
export function motivoVinculo(codigo:string|null|undefined):string;
export function detalleAsociaciones(texto:string|null|undefined):string;
export function estadoProcesamiento(input:{lotes:number;lista:boolean}):{tone:'info'|'warn'|'ok';titulo:string;texto:string;puedeAutorizar:boolean};
export function tituloLote(createdAt:string|null|undefined):string;
