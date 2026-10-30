// Cliente del cargador de archivos de miembros: tipos, limites y utilidades puras (sin DOM) para que se prueben aparte.
// Reutiliza la reserva y subida de /api/imports; solo anade las rutas member-file/preview y member-file/register.
import type {MemberFileKind,MemberFilePreview} from '../../../../../packages/ingestion/member-files.mjs';
import type {Clave} from '../i18n';
export type {MemberFileKind,MemberFilePreview};
export const MEMBER_FILE_MAX_BYTES=20*1024*1024;
export const CSV_TYPE='text/csv';
export const XLSX_TYPE='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MEMBER_FILE_MAPPING_VERSION='member-file-v1';
export const KIND_ORDER:readonly MemberFileKind[]=['sales_by_sku','marketplace_orders','marketplace_returns','reviews','speedship_shipments'];
export const CURRENCIES=['USD','MXN','CAD','EUR','GBP'] as const;
export type FileCheck={ok:true;type:typeof CSV_TYPE|typeof XLSX_TYPE}|{ok:false;reason:'empty'|'too_large'|'tsv'|'legacy_xls'|'unsupported'};
/** Tipo y tamano admitidos antes de subir nada: CSV o XLSX, 1 byte a 20 MiB. TSV y XLS se rechazan con motivo propio. */
export function checkFile(name:string,size:number):FileCheck{
 const lower=name.toLowerCase();
 if(!Number.isFinite(size)||size<1)return {ok:false,reason:'empty'};
 if(size>MEMBER_FILE_MAX_BYTES)return {ok:false,reason:'too_large'};
 if(lower.endsWith('.csv'))return {ok:true,type:CSV_TYPE};
 if(lower.endsWith('.xlsx'))return {ok:true,type:XLSX_TYPE};
 if(lower.endsWith('.tsv')||lower.endsWith('.txt'))return {ok:false,reason:'tsv'};
 if(lower.endsWith('.xls')||lower.endsWith('.xlsm'))return {ok:false,reason:'legacy_xls'};
 return {ok:false,reason:'unsupported'};
}
export async function sha256Hex(bytes:ArrayBuffer):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
/** Importe en unidades menores (texto) a texto legible, sin pasar por flotantes. */
export function formatMinor(minor:string,exponent:number,currency:string,locale:string):string{
 if(!/^-?\d+$/.test(minor)||!Number.isInteger(exponent)||exponent<0||exponent>6)return '—';
 const negative=minor.startsWith('-'),digits=minor.replace('-','').padStart(exponent+1,'0');
 const whole=BigInt(digits.slice(0,digits.length-exponent)),fraction=exponent?digits.slice(digits.length-exponent):'';
 const sep=(new Intl.NumberFormat(locale).formatToParts(1.1).find(p=>p.type==='decimal')?.value)??'.';
 return `${negative?'-':''}${whole.toLocaleString(locale)}${fraction?sep+fraction:''} ${currency}`;
}
const REASON_KEYS:Record<string,Clave>={
 MISSING_VALUE:'cargador.motivo.MISSING_VALUE',INVALID_DATE:'cargador.motivo.INVALID_DATE',INVALID_TIMESTAMP:'cargador.motivo.INVALID_DATE',DST_FOLD:'cargador.motivo.INVALID_DATE',DST_GAP:'cargador.motivo.INVALID_DATE',
 FUTURE_DATE:'cargador.motivo.FUTURE_DATE',DATE_OUT_OF_RANGE:'cargador.motivo.DATE_OUT_OF_RANGE',UNSUPPORTED_EXCEL_DATE:'cargador.motivo.UNSUPPORTED_EXCEL_DATE',
 INVALID_NUMBER:'cargador.motivo.INVALID_NUMBER',NUMBER_OUT_OF_RANGE:'cargador.motivo.NUMBER_OUT_OF_RANGE',INVALID_MONEY:'cargador.motivo.INVALID_MONEY',NEGATIVE_AMOUNT:'cargador.motivo.NEGATIVE_AMOUNT',
 INVALID_CURRENCY:'cargador.motivo.INVALID_CURRENCY',CURRENCY_REQUIRED:'cargador.motivo.CURRENCY_REQUIRED',TEXT_TOO_LONG:'cargador.motivo.TEXT_TOO_LONG',VALUE_TOO_LONG:'cargador.motivo.VALUE_TOO_LONG',
 INVALID_CHARACTERS:'cargador.motivo.INVALID_CHARACTERS',COLUMN_COUNT:'cargador.motivo.COLUMN_COUNT',DUPLICATE_ROW:'cargador.motivo.DUPLICATE_ROW',CSV_SYNTAX:'cargador.motivo.CSV_SYNTAX',
};
export const reasonKey=(code:string):Clave|null=>Object.hasOwn(REASON_KEYS,code)?REASON_KEYS[code]:null;
const ERROR_KEYS:Record<string,Clave>={
 CSV_ENCODING:'cargador.err.CSV_ENCODING',CSV_LIMIT_ROWS:'cargador.err.LIMIT_ROWS',XLSX_LIMIT_ROWS:'cargador.err.LIMIT_ROWS',INVALID_HEADER:'cargador.err.INVALID_HEADER',DUPLICATE_OR_EMPTY_HEADER:'cargador.err.DUPLICATE_OR_EMPTY_HEADER',
 SHEET_NOT_FOUND:'cargador.err.SHEET_NOT_FOUND',SHEET_REQUIRED:'cargador.err.sheet_required',sheet_required:'cargador.err.sheet_required',currency_required:'cargador.err.currency_required',member_file_headers_invalid:'cargador.err.member_file_headers_invalid',
 member_file_no_valid_rows:'cargador.err.member_file_no_valid_rows',member_file_immutable:'cargador.err.member_file_immutable',reservation_expired:'cargador.err.reservation_expired',confirmation_conflict:'cargador.err.confirmation_conflict',
 object_too_large:'cargador.err.object_too_large',INVALID_CURRENCY:'cargador.err.INVALID_CURRENCY',DATE_FORMAT_REQUIRED:'cargador.err.DATE_FORMAT_REQUIRED',role_insufficient:'cargador.err.forbidden',upload_failed:'cargador.err.subida',
};
/** Texto de un codigo de error del servidor; los XLSX_* (archivo danado o no admitido) comparten mensaje. Sin clave conocida devuelve null. */
export function errorKey(code:string,status?:number):Clave|null{
 if(Object.hasOwn(ERROR_KEYS,code))return ERROR_KEYS[code];
 if(/^XLSX_/.test(code))return 'cargador.err.XLSX';
 if(status===401||status===403)return 'cargador.err.forbidden';
 return null;
}
export class MemberFileError extends Error{constructor(public code:string,public status:number){super(code);}}
export type MemberFileDetail={import:{id:string;state:string;file_hash:string;expires_at:string;content_type:string};preview_state:string;member_file?:RegisteredFile};
export type RegisteredFile={kind:MemberFileKind;file_sha256:string;size:number;content_type:string;sheet:string|null;rows:{read:number;accepted:number;rejected:number;duplicates:number};cut:string|null;date_min:string|null;registered_at:string;applied:boolean;aggregates:NonNullable<MemberFilePreview['aggregates']>;options:MemberFilePreview['options'];header_map:Record<string,string>};
export type PreviewOptions={kind:MemberFileKind;sheet?:string|null;date_format:string;timezone?:string;currency?:string|null};
/** Llamada JSON a /api/imports; lanza MemberFileError con el codigo del servidor (sin el cuerpo, que no lleva datos del archivo). */
export async function importsApi<T=unknown>(route:string,body?:unknown,key?:string,signal?:AbortSignal):Promise<T>{
 const r=await fetch('/api/imports'+route,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body),signal}).catch(()=>{throw new MemberFileError('network',0);});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new MemberFileError(String(j?.error?.code??'unknown'),r.status);
 return j.data as T;
}
export const previewBody=(o:PreviewOptions)=>({kind:o.kind,...(o.sheet?{sheet:o.sheet}:{}),date_format:o.date_format,timezone:o.timezone??'UTC',...(o.currency?{currency:o.currency}:{})});
const FIELD_KEYS=['sku','date','quantity','amount','currency','channel','order_id','line_price','unit_price','marketplace','status','reason','refund_amount','return_id','rating','text','review_id','tracking','created','carrier','ship_date','quoted_amount','service_level','reference_1','reference_2','receiver_zip'];
export const fieldKey=(field:string|null):Clave|null=>field!==null&&FIELD_KEYS.includes(field)?`cargador.campo.${field}` as Clave:null;
/** Solo la parte de fecha (AAAA-MM-DD) de un instante ISO; los cortes se muestran en UTC. */
export const dayOf=(iso:string|null):string=>iso?iso.slice(0,10):'—';
