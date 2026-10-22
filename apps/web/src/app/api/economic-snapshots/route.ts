import {snapshotResponse} from '../../../lib/economic-snapshots-server';
import {NextRequest} from 'next/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
// POST stage del corte a ~85 mil asientos: ~14 s medidos en local, pero en producción (22-oct) superó los 60 s (POST /api/economic-snapshots → Task timed out after 60 seconds) con consultas de 5–9 s que recorren todo el libro.
// statement_timeout cuenta por sentencia, el límite real es la duración de la función: se sube a 300 s para que el corte termine mientras se optimizan esas consultas.
export const maxDuration=300;
export const GET=(request:NextRequest)=>snapshotResponse(request);
export const POST=GET;
