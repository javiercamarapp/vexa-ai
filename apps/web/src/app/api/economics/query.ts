import {IDIOMA_POR_OMISION,type Idioma} from '../../../lib/i18n/idioma';
import {mensajeError} from '../../../lib/i18n/errores-api';
// Parseo puro (sin red ni base) del GET /api/economics y mapeo único de errores a respuestas. Probado en tests/economics-contract.test.ts.
export type EconomicsView='auto'|'overview'|'page'|'history'|'exposure';
export type ParsedEconomics={view:EconomicsView;scope?:{start:string;end:string;currency:string;exponent:number;basis:string;timezone:string;dateBasis:'occurred_at'};fxRateId?:string;limit?:number;cursor?:string;filters?:Record<string,string>;entityId?:string};
export class QueryRejected extends Error{constructor(public status:number,public code:string){super(code);}}
const SCOPE_KEYS=['start','end','currency','exponent','basis','timezone','fxRateId'];
const VIEW_KEYS=['view','limit','cursor','sourceId','kind','status','filterCurrency','filterBasis','entityId'];
export const VIEWS:EconomicsView[]=['auto','overview','page','history','exposure'];
/** `auto` (sin `view`): contrato completo f05-economics-v1 si el libro es pequeño y la vista acotada si es grande. `overview`, `page`, `history`, `exposure` son siempre acotadas/bajo demanda. */
export function parseEconomicsQuery(params:URLSearchParams):ParsedEconomics{
 for(const key of params.keys())if(!SCOPE_KEYS.includes(key)&&!VIEW_KEYS.includes(key)||params.getAll(key).length!==1)throw new QueryRejected(400,'unsupported_filter');
 const view=(params.get('view')??'auto') as EconomicsView;if(!VIEWS.includes(view))throw new QueryRejected(400,'unsupported_filter');
 const out:ParsedEconomics={view};
 if(params.has('limit')){const l=params.get('limit')!;if(!/^\d{1,3}$/.test(l))throw new QueryRejected(400,'limit_invalid');out.limit=Number(l);}
 if(params.has('cursor'))out.cursor=params.get('cursor')!;
 if(view==='page'){
  for(const key of SCOPE_KEYS)if(params.has(key))throw new QueryRejected(400,'unsupported_filter');
  const f:Record<string,string>={};for(const [q,k] of [['sourceId','sourceId'],['kind','kind'],['status','status'],['filterCurrency','currency'],['filterBasis','basis']] as const)if(params.has(q))f[k]=params.get(q)!;
  out.filters=f;return out;
 }
 if(view==='history'){const id=params.get('entityId');if(!id)throw new QueryRejected(400,'entity_id_invalid');for(const key of [...SCOPE_KEYS,'limit','cursor','sourceId','kind','status','filterCurrency','filterBasis'])if(params.has(key))throw new QueryRejected(400,'unsupported_filter');out.entityId=id;return out;}
 for(const key of ['cursor','sourceId','kind','status','filterCurrency','filterBasis','entityId'])if(params.has(key))throw new QueryRejected(400,'unsupported_filter');
 if(view!=='overview'&&params.has('limit'))throw new QueryRejected(400,'unsupported_filter');
 const exponent=params.get('exponent');if(!exponent||!/^\d$/.test(exponent))throw new QueryRejected(400,'scope_required');
 out.scope={start:params.get('start')??'',end:params.get('end')??'',currency:params.get('currency')??'',exponent:Number(exponent),basis:params.get('basis')??'',timezone:params.get('timezone')??'UTC',dateBasis:'occurred_at'};
 if(params.has('fxRateId'))out.fxRateId=params.get('fxRateId')!;
 return out;
}
const STATUSES=[400,401,403,404,408,409,413,429,503,504];
const isTimeout=(e:{code?:string;message?:string})=>e.code==='57014'||e.code==='economic_query_timeout'||/statement timeout|canceling statement due to/i.test(String(e.message??''));
/** Un timeout NUNCA es el 503 genérico: 504 `economic_query_timeout`, con mensaje claro y reintento. */
export function economicErrorResponse(error:unknown,idioma:Idioma=IDIOMA_POR_OMISION):{status:number;body:{error:{code:string;message:string;retryable:boolean;detail?:string}};headers:Record<string,string>}{
 const e=(error ?? {}) as {status?:number;code?:string;message?:string};
 if(isTimeout(e))return {status:504,headers:{'Retry-After':'5'},body:{error:{code:'economic_query_timeout',retryable:true,message:mensajeError(idioma,'tr.err.econTimeout')}}};
 const status=STATUSES.includes(e.status??0)?e.status!:503;
 const known=typeof e.code==='string'&&/^[a-z_]{3,60}$/.test(e.code)&&status!==503;
 return {status,headers:{},body:{error:{code:'economic_request_failed',retryable:status===503||status===429,message:status===409?mensajeError(idioma,'tr.err.econVersion'):status===400?mensajeError(idioma,'tr.err.econCampos'):mensajeError(idioma,'tr.err.econFallo'),...(known?{detail:e.code}:{})}}};
}
