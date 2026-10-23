export type Miembro={id:string;email:string;role:string;status:string};
export const ROLES:readonly string[];
export const ROL_ES:Readonly<Record<string,string>>;
export const ESTADO_ES:Readonly<Record<string,string>>;
export function rolEs(rol:string):string;
export function estadoEs(estado:string):string;
export function esCuentaTecnica(email:string):boolean;
export function visibles<T extends {email:string}>(items:T[]):T[];
export function puedeRevocar(item:Miembro,opciones?:{viewerId?:string|null;items?:Miembro[];hayMas?:boolean}):boolean;
