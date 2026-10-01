import {NextRequest} from 'next/server';
import {pushResponse} from '../../../../lib/notifications/push-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>pushResponse(request);
export const POST=(request:NextRequest)=>pushResponse(request);
