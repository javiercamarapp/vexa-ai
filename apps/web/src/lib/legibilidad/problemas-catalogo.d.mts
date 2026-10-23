import type {Metric,RecordView} from '../workspace/contracts';
export type FilaProblema={id:string;titulo:string;categoria:string;clave:string;conversaciones:number|null;severidad:string|null;critico:boolean|null;senalesCriticas:number|null;motivoCritico:'severity'|'category'|'both'|null;citas:number|null;recomendaciones:number|null;ejemplo:string|null;importe:(Metric&{coverage?:{known_n:number;eligible_n:number};missing_reasons?:string[]})|null;metrica?:Metric|null;registro?:RecordView;grupo?:{n:number;de:number};general?:boolean};
export type CategoriaProblemas={clave:string;nombre:string;grupos:number;conversaciones:number|null;criticos:number|null;filas:FilaProblema[]};
export type CatalogoResumen={status:'ok';total:number;rows:{id:string;label:string;conversations:number;severity:string|null;critical:boolean|null;critical_signals?:number|null;critical_reason?:'severity'|'category'|'both'|null;citations:number|null;recommendations:number|null;quote:string|null}[];critical?:{groups:number;signals:number}|null;parts:{signals:'ok'|'unavailable';severity:'ok'|'unavailable';quotes:'ok'|'unavailable'}};
export type ColumnaOrden='categoria'|'conversaciones'|'severidad'|'critico'|'citas'|'recomendaciones'|'importe';
export function etiquetaSeveridad(v:unknown):string|null;
export function filasDesdeCatalogo(catalogo:CatalogoResumen|null|undefined):FilaProblema[];
export function filasDesdeItems(items:readonly RecordView[]|null|undefined):FilaProblema[];
export function hayImporte(filas:readonly FilaProblema[]):boolean;
export function numerarGrupos(filas:readonly FilaProblema[]):FilaProblema[];
export function fraseGrupo(f:FilaProblema):string;
export function agruparCategorias(filas:readonly FilaProblema[]):CategoriaProblemas[];
export function resumenFilas(filas:readonly FilaProblema[]):{grupos:number;categorias:number;criticos:number|null;senalesCriticas:number|null};
export function ordenarFilas(filas:readonly FilaProblema[],opts?:{col?:ColumnaOrden;dir?:'asc'|'desc'}):FilaProblema[];
export function filtrarFilas(filas:readonly FilaProblema[],opts?:{texto?:string;clave?:string|null;soloCriticos?:boolean}):FilaProblema[];

export const ETIQUETA_GENERAL:string;
export function marcarGeneral(filas:readonly FilaProblema[],opts?:{umbral?:number}):FilaProblema[];
