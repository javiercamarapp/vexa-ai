import {NextRequest} from 'next/server';
import {ccoHandler} from '../../../lib/cco/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>ccoHandler(request);
