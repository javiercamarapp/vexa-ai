import {NextRequest} from 'next/server';
import {detailResponse} from '../../../../lib/workspace/detail-server';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>detailResponse(request);
export const POST=(request:NextRequest)=>detailResponse(request);
