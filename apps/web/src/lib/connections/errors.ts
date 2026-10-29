import {mensajesDe} from '../i18n/errores-api';
import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {PRIVATE_HEADERS} from '../auth';
export function crmFailure(code:string,status:number,request?:NextRequest){
 const m=mensajesDe(request??{cookies:{get:()=>undefined}});
 return NextResponse.json({contract_version:'f03-crm-v1',error:{code,message:m('tr.err.conexOpFallo'),retryable:status===503},meta:{trace_id:randomUUID()}},{status,headers:PRIVATE_HEADERS});
}
