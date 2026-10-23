import {NextRequest} from 'next/server';
import {gaps} from '../../../lib/gaps/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>gaps(request);
