import {NextRequest} from 'next/server';
import {insights} from '../../../lib/insights/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>insights(request);
