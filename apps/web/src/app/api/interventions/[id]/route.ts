import {NextRequest} from 'next/server';
import {interventionResponse} from '../../../../lib/interventions/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){return interventionResponse(request,(await context.params).id);}
export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}){return interventionResponse(request,(await context.params).id);}
