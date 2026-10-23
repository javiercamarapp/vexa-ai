import {NextRequest} from 'next/server';
import {workloadHandler} from '../../../lib/workload/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>workloadHandler(request);
