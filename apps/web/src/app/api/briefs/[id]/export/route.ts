import {NextRequest} from 'next/server';
import {briefResponse} from '../../../../../lib/briefs/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return briefResponse(request,{...await params,export:true});}
