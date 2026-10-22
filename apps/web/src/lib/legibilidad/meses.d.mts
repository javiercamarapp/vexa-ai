import type {LedgerMonth,Completeness} from '../../../../../packages/workspace-service/trends.mjs';
export type Medida='orders'|'refunds';
export type ComparacionMensual={sinCobertura:boolean;delta:{value:string;dir:'up'|'down'|'flat'}|null;rotulo:string;parcial:{month:string;dataThrough:string|null}|null;meses:LedgerMonth[]};
export function ledgerConDatos(medida:Medida):(p:LedgerMonth)=>boolean;
export function comparacionMensual(series:readonly LedgerMonth[]|null|undefined,medida:Medida,completitud?:Completeness|null,ahora?:Date):ComparacionMensual;
