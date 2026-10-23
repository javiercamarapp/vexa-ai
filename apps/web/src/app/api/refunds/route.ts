import {NextRequest} from 'next/server';
import {refunds} from '../../../lib/refunds/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>refunds(request);
