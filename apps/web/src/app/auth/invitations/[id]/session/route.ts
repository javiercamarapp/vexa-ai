import {NextRequest} from 'next/server';
import {handleTeam} from '../../../../../lib/team/server';
export const runtime='nodejs';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handleTeam(request,(await params).id);}
export const POST=GET;
