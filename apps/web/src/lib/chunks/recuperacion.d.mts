export const CLAVE_RECARGA:string;
export function esErrorDeChunk(error:unknown):boolean;
export function recargarSiChunk(error:unknown,opciones:{storage:Pick<Storage,'getItem'|'setItem'>|null|undefined;recargar:()=>void;ahora?:()=>number}):boolean;
