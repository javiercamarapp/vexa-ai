import {snapshotResponse} from '../../../lib/economic-snapshots-server';
import {NextRequest} from 'next/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
// POST stage del corte a ~85 mil asientos tarda ~14 s (JS ~8 s + SQL ~6 s); statement_timeout cuenta por sentencia, el límite real es la duración de la función.
export const maxDuration=60;
export const GET=(request:NextRequest)=>snapshotResponse(request);
export const POST=GET;
