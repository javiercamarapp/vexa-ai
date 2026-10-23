export const PLAZOS_MS:number[];
export function pedirConReintento(pedir:(signal:AbortSignal)=>Promise<{status:number;json?:unknown}>,opciones?:{plazos?:number[];onReintentando?:(intento:number)=>void;signal?:AbortSignal}):Promise<{status:number;json?:unknown;intentos:number;timedOut?:undefined}|{timedOut:true;intentos:number;status?:undefined;json?:undefined}>;
