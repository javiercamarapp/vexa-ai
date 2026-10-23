import {NextRequest} from 'next/server';
import {freshness} from '../../../lib/insights/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>freshness(request);
