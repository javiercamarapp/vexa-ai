import {NextRequest} from 'next/server';
import {painPointsHandler} from '../../../lib/pain-points/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>painPointsHandler(request);
