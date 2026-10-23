import {NextRequest} from 'next/server';
import {recommendationResponse} from '../../../../../lib/recommendations/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Operaciones del flujo de aprobación (approve | adjust | start | resolve): POST con {operation,...}. GET devuelve la recomendación con su flujo.
async function handle(request:NextRequest,context:{params:Promise<{id:string}>}){return recommendationResponse(request,await context.params);}
export const GET=handle;export const POST=handle;
