import type {Clave} from '../i18n';
export function kpiConversaciones(conv:unknown,ahora?:Date,ctx?:{t?:(clave:Clave,vars?:Record<string,string|number>)=>string|null;loc?:string}):{valor:number|null;mes:string|null;delta:{value:string;dir:'up'|'down'|'flat'}|null;rotulo:string;estimado:boolean;spark?:number[];coberturaBaja?:string[];coberturaParcial?:string[];datosHasta?:string|null}|null;
export function mesesCoberturaBaja(conv:unknown,ahora?:Date):Map<string,number>;
export function kpiPedidos(led:unknown,ahora?:Date):{amountMinor:string|null;mes:string|null;currency:string;exponent:number;count?:number;unknown?:number;delta:{value:string;dir:'up'|'down'|'flat'}|null;rotulo:string}|null;
export function topProblemas(items:readonly unknown[],n?:number):readonly unknown[];
export function estadoFuentes(view:unknown,cortes?:{libro?:string|null;conversaciones?:string|null;t?:(clave:Clave,vars?:Record<string,string|number>)=>string|null;loc?:string}):{cargadas:number|null;total:number|null;sinCargar:string[];incorporacion:{incorporadas:number;de:number;pct:number;texto:string;base:string}|null;cortes:{etiqueta:string;dia:string|null}[]};
export function lineaAvisos(o?:{critico?:boolean;pendiente?:boolean;parcialCarga?:boolean;faltantes?:string[];conv?:unknown;led?:unknown;ahora?:Date;t?:(clave:Clave,vars?:Record<string,string|number>)=>string|null;loc?:string}):string|null;
export function coberturaDeTendencias(conv:unknown):import('../../../../../packages/workspace-service/cifras-cobertura.mjs').CoberturaAnalisis;
export function avisosCoherentes<T extends {key:string}>(avisos:readonly T[]|null|undefined,conteoCriticos:{groups:number;signals:number|null}|null):T[];
