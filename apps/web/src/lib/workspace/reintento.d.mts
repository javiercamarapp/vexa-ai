export const PLAZOS_MS:number[];
export function pedirConReintento(pedir:(signal:AbortSignal)=>Promise<{status:number;json?:unknown}>,opciones?:{plazos?:number[];onReintentando?:(intento:number,causa?:unknown)=>void;signal?:AbortSignal;esperaMs?:number}):Promise<{status:number;json?:unknown;intentos:number;timedOut?:undefined}|{timedOut:true;intentos:number;status?:undefined;json?:undefined}>;
export const ESPERA_REINTENTO_MS:number;export const MENSAJE_SIN_CONEXION:string;export const MENSAJE_REINTENTANDO:string;
export function esErrorDeRed(e:unknown):boolean;
export function mensajeDeError(e:unknown,otro:string):string;
