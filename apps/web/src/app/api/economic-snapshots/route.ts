import {snapshotResponse} from '../../../lib/economic-snapshots-server';
import {NextRequest} from 'next/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=(request:NextRequest)=>snapshotResponse(request);
export const POST=GET;
