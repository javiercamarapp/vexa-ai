import {snapshotResponse} from '../../../../lib/economic-snapshots-server';
import {NextRequest} from 'next/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){return snapshotResponse(request,(await context.params).id);}
