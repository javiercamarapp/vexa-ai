import 'server-only';
import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {PRIVATE_HEADERS} from '../auth';
export function crmFailure(code:string,status:number){
 return NextResponse.json({contract_version:'f03-crm-v1',error:{code,message:'La operación de conexiones no pudo completarse.',retryable:status===503},meta:{trace_id:randomUUID()}},{status,headers:PRIVATE_HEADERS});
}
