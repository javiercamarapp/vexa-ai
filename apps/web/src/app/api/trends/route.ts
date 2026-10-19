import {NextRequest} from 'next/server';
import {provenance} from '../../../lib/provenance/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>provenance(request,'trends');
