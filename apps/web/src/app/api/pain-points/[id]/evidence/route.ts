import {NextRequest} from 'next/server';
import {painEvidenceHandler} from '../../../../../lib/pain-points/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return painEvidenceHandler(request,await params);}
