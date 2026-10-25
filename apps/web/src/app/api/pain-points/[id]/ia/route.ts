import {NextRequest} from 'next/server';
import {painAiHandler} from '../../../../../lib/pain-points/server';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return painAiHandler(request,await params);}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return painAiHandler(request,await params);}
