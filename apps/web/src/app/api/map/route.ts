import {NextRequest} from 'next/server';
import {mapHandler} from '../../../lib/map/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>mapHandler(request);
