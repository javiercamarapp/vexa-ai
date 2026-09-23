import {NextRequest} from 'next/server';
import {briefResponse} from '../../../lib/briefs/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>briefResponse(request);
export const POST=(request:NextRequest)=>briefResponse(request);
