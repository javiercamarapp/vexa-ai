import {NextRequest} from 'next/server';
import {incidences} from '../../../../lib/incidences/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>incidences(request,'monthly');
